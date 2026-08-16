// ═══════════════════════════════════════════════════════════════════════════
// BookYourShow — AI Controller
// Proxies chat requests to the Python RAG microservice on port 8001.
// Falls back to the Node.js Groq service if Python RAG is unavailable.
// Includes persistent conversation history via MongoDB ChatSession.
// ═══════════════════════════════════════════════════════════════════════════

import { Request, Response } from 'express';
import { z } from 'zod';
import { logger } from '../middleware/logger.js';
import { env } from '../config/env.js';
import { ChatSession } from '../models/mongo/ChatSession.js';

const RAG_SERVICE_URL = 'http://localhost:8001';
const RAG_TIMEOUT_MS = 45_000; // 45 seconds before aborting

// -- Input validation
const chatSchema = z.object({
  message: z.string().min(1).max(1000),
  sessionId: z.string().optional(),
  history: z
    .array(z.object({
      role: z.enum(['user', 'assistant']),
      content: z.string().max(2000),
    }))
    .max(20)
    .optional()
    .default([]),
});

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

function generateTitle(message: string): string {
  const truncated = message.slice(0, 60).trim();
  return truncated.length < message.length ? truncated + '...' : truncated;
}

// -- POST /api/v1/ai/chat
export async function chat(req: Request, res: Response): Promise<void> {
  const parsed = chatSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      error: { code: 'INVALID_INPUT', message: 'Invalid request body', details: parsed.error.flatten() },
    });
    return;
  }

  const { message, history, sessionId } = parsed.data;
  const userId = req.user?.userId;
  logger.info(`AI chat: "${message.slice(0, 60)}" from ${req.ip} (user: ${userId || 'guest'})`);

  // Load or create session for authenticated users
  let session: any = null;
  let contextHistory = history;

  if (userId && sessionId) {
    session = await ChatSession.findOne({ _id: sessionId, userId }).lean();
    if (session) {
      contextHistory = session.messages.slice(-20).map((m: any) => ({
        role: m.role,
        content: m.content,
      }));
    }
  } else if (userId) {
    session = await ChatSession.create({
      userId,
      title: generateTitle(message),
      messages: [],
      lastMessageAt: new Date(),
    });
  }

  const ragAvailable = await isPythonRagAvailable();
  let fullResponse = '';
  let streamSuccess = false;

  if (ragAvailable) {
    try {
      const abortCtrl = new AbortController();
      const timeoutId = setTimeout(() => {
        abortCtrl.abort();
        logger.warn('RAG service request timed out after 45s');
      }, RAG_TIMEOUT_MS);

      const ragRes = await fetch(`${RAG_SERVICE_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, history: contextHistory }),
        signal: abortCtrl.signal,
      });

      clearTimeout(timeoutId);

      if (!ragRes.ok || !ragRes.body) throw new Error('RAG service returned error');

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      if (session) res.setHeader('X-Session-Id', session._id.toString());
      res.flushHeaders();

      const reader = ragRes.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        res.write(chunk);

        const lines = chunk.split('\n');
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const json = JSON.parse(line.slice(6));
            if (json.content) fullResponse += json.content;
          } catch {}
        }
      }

      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
      streamSuccess = true;
    } catch (err: any) {
      if (err.name === 'AbortError') {
        logger.error('RAG request aborted due to timeout');
        if (!res.headersSent) {
          res.setHeader('Content-Type', 'text/event-stream');
          res.setHeader('Cache-Control', 'no-cache');
          res.flushHeaders();
        }
        res.write(`data: ${JSON.stringify({ error: 'Response took too long. Please try a shorter question.' })}\n\n`);
        res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
        res.end();
        return;
      }
      logger.warn(`Python RAG proxy failed: ${err.message}, falling back to Node Groq`);
    }
  }

  // Save messages to history
  if (session && streamSuccess && fullResponse) {
    await ChatSession.findByIdAndUpdate(session._id, {
      $push: {
        messages: {
          $each: [
            { role: 'user', content: message, createdAt: new Date() },
            { role: 'assistant', content: fullResponse, createdAt: new Date() },
          ],
        },
      },
      lastMessageAt: new Date(),
    });
  }

  if (streamSuccess) return;

  // Fallback: Node.js direct Groq
  if (!env.GROQ_API_KEY || env.GROQ_API_KEY === 'your_groq_api_key_here') {
    res.status(503).json({
      success: false,
      error: { code: 'AI_UNAVAILABLE', message: 'AI service is starting up. Please try again in a moment.' },
    });
    return;
  }

  try {
    const { retrieveMovieContext, streamChatResponse } = await import('../services/ai.service.js');
    const movieContext = await retrieveMovieContext(message);
    const messages = [
      ...contextHistory.map((h) => ({ role: h.role as 'user' | 'assistant', content: h.content })),
      { role: 'user' as const, content: message },
    ];
    if (session) res.setHeader('X-Session-Id', session._id.toString());
    await streamChatResponse(messages, movieContext, res);
  } catch (err: any) {
    logger.error(`AI chat fallback error: ${err.message}`);
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: { code: 'AI_ERROR', message: err.message } });
    } else {
      res.write(`data: ${JSON.stringify({ error: 'Internal AI error. Please try again.' })}\n\n`);
      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
    }
  }
}

// -- GET /api/v1/ai/status
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

// -- GET /api/v1/ai/sessions
export async function listSessions(req: Request, res: Response): Promise<void> {
  const userId = req.user?.userId;
  if (!userId) {
    res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Login required' } });
    return;
  }
  const sessions = await ChatSession.find({ userId })
    .sort({ lastMessageAt: -1 })
    .limit(50)
    .select('title lastMessageAt createdAt messages')
    .lean();
  res.json({
    success: true,
    data: {
      sessions: sessions.map((s: any) => ({
        id: s._id,
        title: s.title,
        lastMessageAt: s.lastMessageAt,
        createdAt: s.createdAt,
        messageCount: s.messages.length,
        preview: s.messages[s.messages.length - 1]?.content?.slice(0, 100) || '',
      })),
    },
  });
}

// -- GET /api/v1/ai/sessions/:id
export async function getSession(req: Request, res: Response): Promise<void> {
  const userId = req.user?.userId;
  if (!userId) {
    res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Login required' } });
    return;
  }
  const session = await ChatSession.findOne({ _id: req.params.id, userId }).lean();
  if (!session) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Session not found' } });
    return;
  }
  res.json({ success: true, data: { session } });
}

// -- DELETE /api/v1/ai/sessions/:id
export async function deleteSession(req: Request, res: Response): Promise<void> {
  const userId = req.user?.userId;
  if (!userId) {
    res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Login required' } });
    return;
  }
  await ChatSession.deleteOne({ _id: req.params.id, userId });
  res.json({ success: true, data: { message: 'Session deleted' } });
}
