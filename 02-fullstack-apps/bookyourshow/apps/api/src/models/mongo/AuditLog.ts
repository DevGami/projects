import { Schema, model, Document } from 'mongoose';

// ── Types ───────────────────────────────────────────────────────────────────
export interface IAuditLog extends Document {
  action: string;             // "booking.created", "user.login", "payment.captured"
  userId?: string;            // UUID from PostgreSQL (optional for anonymous actions)
  ip?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
  timestamp: Date;
}

// ── Schema ──────────────────────────────────────────────────────────────────
const auditLogSchema = new Schema<IAuditLog>(
  {
    action: { type: String, required: true, index: true },
    userId: { type: String, index: true },
    ip: { type: String },
    userAgent: { type: String },
    metadata: { type: Schema.Types.Mixed },
    timestamp: { type: Date, default: Date.now, index: true },
  },
  {
    // No updatedAt needed for immutable logs
    timestamps: false,
  }
);

// TTL index: auto-delete logs older than 90 days
auditLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

export const AuditLog = model<IAuditLog>('AuditLog', auditLogSchema);
