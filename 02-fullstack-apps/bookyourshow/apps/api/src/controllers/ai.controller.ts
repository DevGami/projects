// ═══════════════════════════════════════════════════════════════════════════
// BookYourShow — AI Controller
// Proxies chat requests to the Python RAG microservice on port 8001.
// Falls back to the Node.js Groq service if Python RAG is unavailable.
// ═══════════════════════════════════════════════════════════════════════════

import { Request, Response } from 'express';
import { z } from 'zod';
import { logger } from '../middleware/logger.js';
import { env } from '../config/env.js';

const RAG_SERVICE_URL = 'http://localhost:8001';

// ── Input validation ─────────────────────────────────────────────────────────
const chatSchema = z.object({
  message: z.string().min(1).max(500),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().max(1000),
      }),
    )
    .max(10)
    .optional()
    .default([]),
});

// ── Check if Python RAG service is available ─────────────────────────────────
async function isPythonRagAvailable(): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 1500);
    const res = await fetch(`${RAG_SERVICE_URL}/health`, { signal: ctrl.signal });
    clearTimeout(timeout);
    const data = await res.json() as any;
    return data?.status === 'ok';
  } catch {
    return false;
  }
}

// ── POST /api/v1/ai/chat ─────────────────────────────────────────────────────
export async function chat(req: Request, res: Response): Promise<void> {
  const parsed = chatSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      error: { code: 'INVALID_INPUT', message: 'Invalid request body', details: parsed.error.flatten() },
    });
    return;
  }

  const { message, history } = parsed.data;
  logger.info(`AI chat: "${message.slice(0, 60)}" from ${req.ip}`);

  // ── Try Python RAG service first (FAISS + Groq) ───────────────────────────
  const ragAvailable = await isPythonRagAvailable();

  if (ragAvailable) {
    try {
      const ragRes = await fetch(`${RAG_SERVICE_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, history }),
      });

      if (!ragRes.ok || !ragRes.body) throw new Error('RAG service returned error');

      // Pipe the SSE stream straight through
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      res.flushHeaders();

      const reader = ragRes.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(decoder.decode(value, { stream: true }));
      }
      res.end();
      return;
    } catch (err: any) {
      logger.warn(`Python RAG proxy failed: ${err.message}, falling back to Node Groq`);
    }
  }

  // ── Fallback: Node.js direct Groq (no FAISS, basic MongoDB search) ─────────
  if (!env.GROQ_API_KEY || env.GROQ_API_KEY === 'your_groq_api_key_here') {
    res.status(503).json({
      success: false,
      error: {
        code: 'AI_UNAVAILABLE',
        message: 'AI service is starting up. Please try again in a moment.',
      },
    });
    return;
  }

  try {
    const { retrieveMovieContext, streamChatResponse } = await import('../services/ai.service.js');
    const movieContext = await retrieveMovieContext(message);
    const messages = [
      ...history.map((h) => ({ role: h.role as 'user' | 'assistant', content: h.content })),
      { role: 'user' as const, content: message },
    ];
    await streamChatResponse(messages, movieContext, res);
  } catch (err: any) {
    logger.error(`AI chat fallback error: ${err.message}`);
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: { code: 'AI_ERROR', message: err.message } });
    }
  }
}

// ── GET /api/v1/ai/status ─────────────────────────────────────────────────────
export async function aiStatus(_req: Request, res: Response): Promise<void> {
  const ragAvailable = await isPythonRagAvailable();
  const groqConfigured = !!env.GROQ_API_KEY && env.GROQ_API_KEY !== 'your_groq_api_key_here';

  res.json({
    success: true,
    data: {
      available: ragAvailable || groqConfigured,
      mode: ragAvailable ? 'python-rag (FAISS + Groq)' : groqConfigured ? 'node-groq (fallback)' : 'unavailable',
      ragService: ragAvailable,
      groqConfigured,
    },
  });
}
