import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { chat, aiStatus } from '../controllers/ai.controller.js';

const router = Router();

const aiLimiter = rateLimit({
  windowMs: 60 * 1000,   // 1 minute
  max: 10,               // 10 AI requests per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: { code: 'AI_RATE_LIMIT', message: 'Too many AI requests. Wait a moment.' },
  },
});

// ── Routes ───────────────────────────────────────────────────────────────────
router.get('/status', aiStatus);
router.post('/chat', aiLimiter, chat);

export default router;
