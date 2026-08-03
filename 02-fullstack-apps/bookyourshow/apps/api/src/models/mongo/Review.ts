import { Schema, model, Document } from 'mongoose';

// ── Types ───────────────────────────────────────────────────────────────────
export interface IReview extends Document {
  movieTmdbId: number;
  userId: string;             // UUID from PostgreSQL
  userName: string;
  rating: number;             // 1-10
  title: string;
  content: string;
  likes: number;
  spoiler: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ── Schema ──────────────────────────────────────────────────────────────────
const reviewSchema = new Schema<IReview>(
  {
    movieTmdbId: { type: Number, required: true, index: true },
    userId: { type: String, required: true },
    userName: { type: String, required: true },
    rating: { type: Number, required: true, min: 1, max: 10 },
    title: { type: String, required: true, maxlength: 200 },
    content: { type: String, required: true, maxlength: 2000 },
    likes: { type: Number, default: 0 },
    spoiler: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  }
);

// Compound index: one review per user per movie
reviewSchema.index({ movieTmdbId: 1, userId: 1 }, { unique: true });

export const Review = model<IReview>('Review', reviewSchema);
