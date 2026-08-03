// ═══════════════════════════════════════════════════════════════════════════
// BookYourShow — AI Service
// RAG: retrieve relevant movies from MongoDB, build context, stream Groq LLM
// ═══════════════════════════════════════════════════════════════════════════

import { Response } from 'express';
import Groq from 'groq-sdk';
import { Movie } from '../models/mongo/Movie.js';
import { env } from '../config/env.js';
import { logger } from '../middleware/logger.js';

// ── Groq client (lazy — only created when key is available) ─────────────────
let groqClient: Groq | null = null;

function getGroqClient(): Groq {
  if (!groqClient) {
    if (!env.GROQ_API_KEY || env.GROQ_API_KEY === 'your_groq_api_key_here') {
      throw new Error('GROQ_API_KEY is not configured. Get a free key at https://console.groq.com');
    }
    groqClient = new Groq({ apiKey: env.GROQ_API_KEY });
  }
  return groqClient;
}

// ── Movie Context Retrieval ──────────────────────────────────────────────────
interface MovieContext {
  title: string;
  genres: string[];
  rating: number;
  language?: string;
  runtime?: number;
  releaseDate?: string;
  description?: string;
  status: string;
}

export async function retrieveMovieContext(query: string): Promise<MovieContext[]> {
  try {
    // Try full-text search first (requires text index on MongoDB)
    let movies: any[] = [];

    if (query && query.trim().length > 1) {
      movies = await Movie.find(
        { $text: { $search: query }, isActive: true },
        { score: { $meta: 'textScore' } },
      )
        .sort({ score: { $meta: 'textScore' } })
        .select('title genres rating language runtime releaseDate description customDescription status')
        .limit(6)
        .lean();
    }

    // Fallback: if no text search results, get top-rated now-showing movies
    if (movies.length === 0) {
      movies = await Movie.find({ status: 'now_showing', isActive: true })
        .sort({ rating: -1 })
        .select('title genres rating language runtime releaseDate description customDescription status')
        .limit(8)
        .lean();
    }

    return movies.map((m) => ({
      title: m.title,
      genres: m.genres || [],
      rating: m.rating || 0,
      language: m.language,
      runtime: m.runtime,
      releaseDate: m.releaseDate ? new Date(m.releaseDate).toLocaleDateString('en-IN') : undefined,
      description: m.customDescription || m.description,
      status: m.status,
    }));
  } catch (err: any) {
    // If text index missing, fall back to rating-based fetch
    logger.warn(`Movie text search failed (no text index?), falling back: ${err.message}`);
    const movies = await Movie.find({ isActive: true })
      .sort({ rating: -1 })
      .select('title genres rating language runtime status')
      .limit(8)
      .lean();

    return movies.map((m) => ({
      title: m.title,
      genres: m.genres || [],
      rating: m.rating || 0,
      status: m.status,
    }));
  }
}

// ── System Prompt Builder ────────────────────────────────────────────────────
function buildSystemPrompt(movies: MovieContext[]): string {
  const movieList = movies
    .map((m) => {
      const parts = [`• ${m.title}`];
      if (m.genres.length) parts.push(`  Genres: ${m.genres.join(', ')}`);
      if (m.rating) parts.push(`  Rating: ${m.rating.toFixed(1)}/10`);
      if (m.language) parts.push(`  Language: ${m.language}`);
      if (m.runtime) parts.push(`  Runtime: ${m.runtime} min`);
      if (m.status === 'now_showing') parts.push(`  Status: Now Showing ✓`);
      else if (m.status === 'upcoming') parts.push(`  Status: Upcoming`);
      if (m.description) parts.push(`  About: ${m.description.slice(0, 150)}...`);
      return parts.join('\n');
    })
    .join('\n\n');

  return `You are a friendly and knowledgeable movie assistant for BookYourShow, India's leading movie ticketing platform.

You help users discover movies, find what's playing now, check ratings, and decide what to watch.

Here are the relevant movies from our database:

${movieList}

Guidelines:
- Be concise and conversational — max 3-4 short paragraphs
- Use the movie data above as your primary source of truth
- If a movie isn't in the list, say you don't have info on it currently
- Always suggest booking on BookYourShow for now-showing movies
- You can make genre/mood-based recommendations from the list
- Respond in a warm, enthusiastic tone — you love movies!
- Use bullet points or line breaks for readability when listing movies`;
}

// ── Stream Chat Response via SSE ─────────────────────────────────────────────
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export async function streamChatResponse(
  messages: ChatMessage[],
  movieContext: MovieContext[],
  res: Response,
): Promise<void> {
  const groq = getGroqClient();

  const systemPrompt = buildSystemPrompt(movieContext);

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const messagesWithSystem: Groq.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    ...messages.slice(-8).map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
  ];

  try {
    const stream = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: messagesWithSystem,
      temperature: 0.7,
      max_tokens: 512,
      stream: true,
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content || '';
      if (delta) {
        // SSE format: "data: <json>\n\n"
        res.write(`data: ${JSON.stringify({ content: delta })}\n\n`);
      }
    }

    // Signal completion
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err: any) {
    logger.error(`Groq streaming error: ${err.message}`);
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    res.end();
  }
}
