import { Schema, model, Document } from 'mongoose';

// ── Types ───────────────────────────────────────────────────────────────────
export interface ICastMember {
  name: string;
  character?: string;
  photo?: string;
}

export interface IMovie extends Document {
  tmdbId: number;
  title: string;
  originalTitle?: string;
  slug: string;
  genres: string[];
  language: string;
  originalLanguage?: string;
  rating: number | null;
  voteCount: number;
  popularity: number;            // TMDB popularity score
  revenue: number;               // Box office revenue (USD)
  duration: number | null;      // Runtime in minutes
  poster: string | null;
  backdrop: string | null;
  description: string;
  cast: ICastMember[];
  director?: string;
  trailerUrl?: string;
  releaseDate: Date | null;
  certificate?: string;         // "U/A", "A", "U"
  status: 'now_showing' | 'upcoming' | 'ended';
  isActive: boolean;
  formats: string[];            // ["2D", "3D", "IMAX"]
  customDescription?: string;   // Admin override for TMDB description
  lastSyncedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ── Schema ──────────────────────────────────────────────────────────────────
const castMemberSchema = new Schema<ICastMember>(
  {
    name: { type: String, required: true },
    character: { type: String },
    photo: { type: String },
  },
  { _id: false }
);

const movieSchema = new Schema<IMovie>(
  {
    tmdbId: { type: Number, required: true, unique: true, index: true },
    title: { type: String, required: true },
    originalTitle: { type: String },
    slug: { type: String, required: true, unique: true, index: true },
    genres: { type: [String], default: [] },
    language: { type: String, required: true },
    originalLanguage: { type: String },
    rating: { type: Number, default: null },
    voteCount: { type: Number, default: 0 },
    popularity: { type: Number, default: 0 },
    revenue: { type: Number, default: 0 },
    duration: { type: Number, default: null },
    poster: { type: String, default: null },
    backdrop: { type: String, default: null },
    description: { type: String, required: true },
    cast: { type: [castMemberSchema], default: [] },
    director: { type: String },
    trailerUrl: { type: String },
    releaseDate: { type: Date, default: null },
    certificate: { type: String },
    status: {
      type: String,
      enum: ['now_showing', 'upcoming', 'ended'],
      default: 'now_showing',
      index: true,
    },
    isActive: { type: Boolean, default: true },
    formats: { type: [String], default: ['2D'] },
    customDescription: { type: String },
    lastSyncedAt: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
  }
);

// Text index for search (language_override prevents conflict with our 'language' field)
movieSchema.index(
  { title: 'text', description: 'text' },
  { language_override: 'textSearchLanguage', default_language: 'none' }
);

export const Movie = model<IMovie>('Movie', movieSchema);
