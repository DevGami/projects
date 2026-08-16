"""
MovieRAG — Movie-specific RAG pipeline for BookYourShow
=========================================================
Adapted from RAG-practice/src/search.py + vectorstore.py.

Key changes:
- Data source: MongoDB (movie collection) instead of uploaded files
- System prompt: Movie assistant persona for BookYourShow
- Streaming: yields tokens instead of returning full string
- Model: llama-3.1-8b-instant (faster, still great for movie Q&A)
"""

import sys
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

import os
import pickle
import numpy as np
from typing import Generator
from dotenv import load_dotenv

load_dotenv()

# ── System prompt ─────────────────────────────────────────────────────── #
SYSTEM_PROMPT = """You are a friendly and knowledgeable movie assistant for BookYourShow, India's top movie ticketing platform.

Your job:
- Help users find movies to watch based on their mood, genre, or preference
- Answer questions about movies currently showing or upcoming
- Give ratings, descriptions, languages, and runtimes when asked
- Recommend movies based on what's in the database

Rules:
- Answer from the retrieved movie context ONLY
- Be conversational and enthusiastic — you love movies!
- Keep answers concise (2-4 sentences or a short bullet list)
- Always suggest booking on BookYourShow for now-showing movies
- If you don't have info on a specific movie, say so honestly
- Respond in English unless user writes in another language
"""

# ── Movie document text builder ────────────────────────────────────────── #
def movie_to_text(movie: dict) -> str:
    """Convert a MongoDB movie document into a rich text chunk for embedding."""
    parts = [f"Title: {movie.get('title', 'Unknown')}"]

    if movie.get('genres'):
        parts.append(f"Genres: {', '.join(movie['genres'])}")

    if movie.get('rating'):
        parts.append(f"Rating: {movie['rating']:.1f}/10")

    if movie.get('language'):
        parts.append(f"Language: {movie['language']}")

    if movie.get('runtime'):
        parts.append(f"Runtime: {movie['runtime']} minutes")

    status = movie.get('status', '')
    if status == 'now_showing':
        parts.append("Status: Now Showing — available to book on BookYourShow")
    elif status == 'upcoming':
        parts.append("Status: Upcoming")

    desc = movie.get('customDescription') or movie.get('description') or movie.get('overview', '')
    if desc:
        parts.append(f"Description: {desc[:400]}")

    if movie.get('cast'):
        cast_names = [c.get('name', '') for c in movie['cast'][:4] if c.get('name')]
        if cast_names:
            parts.append(f"Cast: {', '.join(cast_names)}")

    if movie.get('director'):
        parts.append(f"Director: {movie['director']}")

    return '\n'.join(parts)


# ── FAISS Vector Store (same as RAG-practice) ─────────────────────────── #
class MovieVectorStore:
    def __init__(self, persist_dir: str, model_name: str = "all-MiniLM-L6-v2"):
        self.persist_dir = persist_dir
        self.index = None
        self.metadata = []  # list of {"text": ..., "title": ...}
        self.bm25 = None

        from sentence_transformers import SentenceTransformer
        self.model = SentenceTransformer(model_name)
        print(f"[INFO] Embedding model ready: {model_name}")

    def _embed(self, texts: list[str]) -> np.ndarray:
        return self.model.encode(
            texts, batch_size=32, normalize_embeddings=True, show_progress_bar=True
        ).astype("float32")

    def build_from_movies(self, movies: list[dict]) -> int:
        import faiss
        texts = [movie_to_text(m) for m in movies]
        metadata = [{"text": t, "title": m.get("title", ""), "status": m.get("status", "")} for t, m in zip(texts, movies)]

        print(f"[INFO] Embedding {len(texts)} movies…")
        embeddings = self._embed(texts)
        dim = embeddings.shape[1]

        self.index = faiss.IndexFlatIP(dim)  # cosine (normalized vecs)
        self.index.add(embeddings)
        self.metadata = metadata

        from rank_bm25 import BM25Okapi
        tokenized_corpus = [t.lower().split() for t in texts]
        self.bm25 = BM25Okapi(tokenized_corpus)

        # Persist
        faiss.write_index(self.index, os.path.join(self.persist_dir, "faiss.index"))
        with open(os.path.join(self.persist_dir, "metadata.pkl"), "wb") as f:
            pickle.dump(self.metadata, f)
        with open(os.path.join(self.persist_dir, "bm25.pkl"), "wb") as f:
            pickle.dump(self.bm25, f)

        print(f"[INFO] FAISS index built: {self.index.ntotal} vectors")
        return len(texts)

    def load(self):
        import faiss
        idx_path = os.path.join(self.persist_dir, "faiss.index")
        meta_path = os.path.join(self.persist_dir, "metadata.pkl")
        bm25_path = os.path.join(self.persist_dir, "bm25.pkl")
        if os.path.exists(idx_path) and os.path.exists(meta_path) and os.path.exists(bm25_path):
            self.index = faiss.load_index(idx_path)
            with open(meta_path, "rb") as f:
                self.metadata = pickle.load(f)
            with open(bm25_path, "rb") as f:
                self.bm25 = pickle.load(f)
            print(f"[INFO] Loaded FAISS index: {self.index.ntotal} vectors & BM25")
        else:
            print("[WARN] No saved index found — rebuild needed")

    def query(self, text: str, top_k: int = 5, threshold: float = 0.25) -> list[dict]:
        if self.index is None or self.index.ntotal == 0 or self.bm25 is None:
            return []
        
        # FAISS search
        query_vec = self.model.encode([text], normalize_embeddings=True).astype("float32")
        scores, indices = self.index.search(query_vec, min(top_k * 2, self.index.ntotal))
        
        faiss_ranks = {}
        for rank, (score, idx) in enumerate(zip(scores[0], indices[0])):
            if idx >= 0:
                faiss_ranks[idx] = rank

        # BM25 search
        tokenized_query = text.lower().split()
        bm25_scores = self.bm25.get_scores(tokenized_query)
        bm25_top_indices = np.argsort(bm25_scores)[::-1][:top_k * 2]
        
        bm25_ranks = {}
        for rank, idx in enumerate(bm25_top_indices):
            if bm25_scores[idx] > 0:
                bm25_ranks[idx] = rank

        # RRF (Reciprocal Rank Fusion)
        k = 60
        rrf_scores = {}
        all_indices = set(faiss_ranks.keys()).union(set(bm25_ranks.keys()))
        
        for idx in all_indices:
            score = 0.0
            if idx in faiss_ranks:
                score += 1.0 / (k + faiss_ranks[idx])
            if idx in bm25_ranks:
                score += 1.0 / (k + bm25_ranks[idx])
            rrf_scores[idx] = score

        # Sort and return top_k
        sorted_indices = sorted(rrf_scores.keys(), key=lambda x: rrf_scores[x], reverse=True)[:top_k]
        
        results = []
        for idx in sorted_indices:
            results.append({**self.metadata[idx], "score": float(rrf_scores[idx])})
        return results



# ── Main MovieRAG class ────────────────────────────────────────────────── #
class MovieRAG:
    def __init__(self, persist_dir: str = "faiss_store"):
        self.persist_dir = persist_dir
        self.vectorstore = MovieVectorStore(persist_dir)

        # Try to load saved index, otherwise fetch from MongoDB
        idx_path = os.path.join(persist_dir, "faiss.index")
        if os.path.exists(idx_path):
            self.vectorstore.load()
        else:
            print("[INFO] No saved index — fetching movies from MongoDB…")
            self.rebuild_index()

        # Init Groq LLM
        api_key = os.getenv("GROQ_API_KEY")
        if not api_key:
            raise ValueError("GROQ_API_KEY not set in .env")

        from langchain_groq import ChatGroq
        self.llm = ChatGroq(
            groq_api_key=api_key,
            model_name="llama-3.1-8b-instant",
            temperature=0.5,
            max_tokens=512,
            streaming=True,
        )
        print("[INFO] Groq LLM ready: llama-3.1-8b-instant")

    def rebuild_index(self) -> int:
        """Fetch all movies from MongoDB and rebuild the FAISS index."""
        from pymongo import MongoClient

        mongo_uri = os.getenv("MONGODB_URI", "mongodb://localhost:27017/bookyourshow")
        client = MongoClient(mongo_uri)
        db = client.get_default_database()

        movies = list(db.movies.find({"isActive": True}, {
            "title": 1, "genres": 1, "rating": 1, "language": 1, "runtime": 1,
            "status": 1, "description": 1, "customDescription": 1, "overview": 1,
            "cast": 1, "director": 1,
        }))
        client.close()

        print(f"[INFO] Fetched {len(movies)} movies from MongoDB")
        return self.vectorstore.build_from_movies(movies)

    async def astream_response(self, query: str, history: list[tuple] = []):
        """Retrieve relevant movies, build prompt, stream Groq response token by token asynchronously."""
        from langchain_core.messages import SystemMessage, HumanMessage, AIMessage

        # 1. Retrieve relevant movie chunks (run synchronous FAISS query in executor)
        import asyncio
        loop = asyncio.get_event_loop()
        results = await loop.run_in_executor(None, self.vectorstore.query, query, 5)

        # 2. Build context
        if results:
            context_parts = [r["text"] for r in results]
            context = "\n\n---\n\n".join(context_parts)
            human_content = (
                f"Relevant movies from our database:\n\n{context}\n\n"
                f"User question: {query}\n\n"
                "Answer based on the movies above. Be helpful and concise."
            )
        else:
            human_content = (
                f"User question: {query}\n\n"
                "No specific movies found matching this query. "
                "Answer generally about what BookYourShow offers, or suggest the user browse by genre."
            )

        # 3. Build message history (last 6 exchanges)
        messages = [SystemMessage(content=SYSTEM_PROMPT)]
        for role, content in history[-6:]:
            if role == "user":
                messages.append(HumanMessage(content=content))
            elif role == "assistant":
                messages.append(AIMessage(content=content))
        messages.append(HumanMessage(content=human_content))

        # 4. Stream tokens asynchronously
        async for chunk in self.llm.astream(messages):
            token = chunk.content
            if token:
                yield token


if __name__ == "__main__":
    import asyncio
    async def main():
        rag = MovieRAG()
        print("\n--- Test Query ---")
        async for t in rag.astream_response("What action movies are playing now?"):
            print(t, end="", flush=True)
        print()
    asyncio.run(main())
