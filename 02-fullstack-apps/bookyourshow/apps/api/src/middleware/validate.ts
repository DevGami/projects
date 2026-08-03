import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

// ── Zod Request Validation Middleware ────────────────────────────────────────
// Usage: router.post('/signup', validate(signupSchema), controller)

interface ValidationSchemas {
  body?: ZodSchema;
  params?: ZodSchema;
  query?: ZodSchema;
}

export function validate(schemas: ValidationSchemas) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      if (schemas.body) {
        req.body = schemas.body.parse(req.body);
      }
      if (schemas.params) {
        const parsed = schemas.params.parse(req.params);
        Object.assign(req.params, parsed);
      }
      if (schemas.query) {
        const parsed = schemas.query.parse(req.query);
        // Store validated query on req for downstream use
        // (Express 5 makes req.query read-only)
        (req as any).validatedQuery = parsed;
      }
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const formattedErrors = error.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        }));

        // Use the first specific validation error as the message so
        // the frontend toast shows a helpful reason (e.g. "Must contain uppercase")
        const primaryMessage = formattedErrors[0]?.message || 'Request validation failed';

        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: primaryMessage,
            details: formattedErrors,
          },
        });
        return;
      }
      next(error);
    }
  };
}
