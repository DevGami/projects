import { Request, Response } from 'express';
import { prisma } from '../config/database.js';
import { logger } from '../middleware/logger.js';
import type {
  CreateTheaterInput,
  UpdateTheaterInput,
  CreateScreenInput,
  UpdateScreenInput,
  ListTheatersQuery,
} from '../schemas/theater.schemas.js';

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/v1/theaters — Create theater (Admin)
// ═══════════════════════════════════════════════════════════════════════════
export async function createTheater(req: Request, res: Response): Promise<void> {
  const data = req.body as CreateTheaterInput;

  const theater = await prisma.theater.create({ data });
  logger.info(`Theater created: ${theater.name} (${theater.city})`);

  res.status(201).json({
    success: true,
    data: theater,
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/v1/theaters — List theaters (Public)
// ═══════════════════════════════════════════════════════════════════════════
export async function listTheaters(req: Request, res: Response): Promise<void> {
  const { city, page, limit } = ((req as any).validatedQuery || req.query) as ListTheatersQuery;
  const skip = (page - 1) * limit;

  const where: any = { isActive: true };
  if (city) where.city = { contains: city, mode: 'insensitive' };

  const [theaters, total] = await Promise.all([
    prisma.theater.findMany({
      where,
      skip,
      take: limit,
      include: {
        screens: {
          where: { isActive: true },
          select: { id: true, name: true, rows: true, cols: true, seatLayout: true },
        },
      },
      orderBy: { name: 'asc' },
    }),
    prisma.theater.count({ where }),
  ]);

  res.json({
    success: true,
    data: {
      theaters,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    },
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/v1/theaters/:id — Theater detail + screens (Public)
// ═══════════════════════════════════════════════════════════════════════════
export async function getTheater(req: Request, res: Response): Promise<void> {
  const { id } = req.params as { id: string };

  const theater = await prisma.theater.findUnique({
    where: { id },
    include: {
      screens: {
        where: { isActive: true },
        orderBy: { name: 'asc' },
      },
    },
  });

  if (!theater) {
    res.status(404).json({
      success: false,
      error: { code: 'THEATER_NOT_FOUND', message: 'Theater not found' },
    });
    return;
  }

  res.json({ success: true, data: theater });
}

// ═══════════════════════════════════════════════════════════════════════════
// PUT /api/v1/theaters/:id — Update theater (Admin)
// ═══════════════════════════════════════════════════════════════════════════
export async function updateTheater(req: Request, res: Response): Promise<void> {
  const { id } = req.params as { id: string };
  const data = req.body as UpdateTheaterInput;

  try {
    const theater = await prisma.theater.update({ where: { id }, data });
    logger.info(`Theater updated: ${theater.name}`);
    res.json({ success: true, data: theater });
  } catch {
    res.status(404).json({
      success: false,
      error: { code: 'THEATER_NOT_FOUND', message: 'Theater not found' },
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/v1/theaters/:id/screens — Add screen to theater (Admin)
// ═══════════════════════════════════════════════════════════════════════════
export async function createScreen(req: Request, res: Response): Promise<void> {
  const theaterId = req.params.id as string;
  const data = req.body as CreateScreenInput;

  // Verify theater exists
  const theater = await prisma.theater.findUnique({ where: { id: theaterId } });
  if (!theater) {
    res.status(404).json({
      success: false,
      error: { code: 'THEATER_NOT_FOUND', message: 'Theater not found' },
    });
    return;
  }

  const screen = await prisma.screen.create({
    data: { ...data, theaterId },
  });
  logger.info(`Screen created: ${screen.name} in ${theater.name}`);

  res.status(201).json({ success: true, data: screen });
}

// ═══════════════════════════════════════════════════════════════════════════
// PUT /api/v1/theaters/:id/screens/:screenId — Update screen (Admin)
// ═══════════════════════════════════════════════════════════════════════════
export async function updateScreen(req: Request, res: Response): Promise<void> {
  const screenId = req.params.screenId as string;
  const data = req.body as UpdateScreenInput;

  try {
    const screen = await prisma.screen.update({
      where: { id: screenId },
      data,
    });
    logger.info(`Screen updated: ${screen.name}`);
    res.json({ success: true, data: screen });
  } catch {
    res.status(404).json({
      success: false,
      error: { code: 'SCREEN_NOT_FOUND', message: 'Screen not found' },
    });
  }
}
