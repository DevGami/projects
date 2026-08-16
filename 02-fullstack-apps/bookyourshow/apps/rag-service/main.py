"""
BookYourShow — Movie RAG Microservice
======================================
FastAPI sidecar on port 8001.
Pipeline: MongoDB movies → FAISS+BM25 hybrid retrieval → Groq Llama → answer

Adapted from the RAG-practice project (same architecture, movie-specific).
"""

import sys
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

import os
import json
import asyncio
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from typing import Optional
from fastapi.responses import StreamingResponse
from fastapi import BackgroundTasks
from contextlib import asynccontextmanager

load_dotenv()

# ── Lazy-load RAG pipeline ────────────────────────────────────────────── #
_rag = None

def get_rag():
    global _rag
    if _rag is None:
        from movie_rag import MovieRAG
        _rag = MovieRAG(persist_dir="faiss_store")
    return _rag

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize RAG in background executor on startup so it doesn't block port binding
    loop = asyncio.get_event_loop()
    loop.run_in_executor(None, get_rag)
    yield
    # Cleanup if necessary

app = FastAPI(title="BookYourShow Movie RAG Service", docs_url="/docs", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

os.makedirs("faiss_store", exist_ok=True)

# ── Request / Response models ─────────────────────────────────────────── #
class Message(BaseModel):
    role: str   # "user" | "assistant"
    content: str

class ChatRequest(BaseModel):
    message: str
    history: Optional[list[Message]] = []

# (Moved get_rag up to avoid reference errors before app definition)

# ── Endpoints ─────────────────────────────────────────────────────────── #
@app.get("/health")
async def health():
    """Lightweight — responds immediately without triggering RAG init."""
    return {"status": "ok", "initialized": _rag is not None}

@app.get("/health/detail")
async def health_detail():
    """Detailed health — triggers RAG init if not done yet."""
    rag = get_rag()
    return {
        "status": "ok",
        "chunks_indexed": rag.vectorstore.index.ntotal if rag.vectorstore.index else 0,
        "model": "llama-3.1-8b-instant",
    }

@app.post("/chat")
async def chat(req: ChatRequest):
    """Stream chat response as SSE."""
    rag = get_rag()

    history = [(m.role, m.content) for m in (req.history or [])]

    async def event_stream():
        try:
            async for token in rag.astream_response(req.message, history):
                yield f"data: {json.dumps({'content': token})}\n\n"
            yield f"data: {json.dumps({'done': True})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )

@app.post("/index/rebuild")
async def rebuild_index(background_tasks: BackgroundTasks):
    """Re-fetch movies from MongoDB and rebuild FAISS index in the background."""
    def run_rebuild():
        rag = get_rag()
        rag.rebuild_index()
    
    background_tasks.add_task(run_rebuild)
    return {"message": "Index rebuild started in background."}



if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8001, reload=True)
