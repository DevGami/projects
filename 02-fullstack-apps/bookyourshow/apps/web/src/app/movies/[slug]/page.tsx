"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { Star, Clock, Calendar, Play, ArrowLeft } from "lucide-react";
import { api } from "@/lib/api";
import { TMDB_IMAGE } from "@/lib/constants";
import { Badge, Button } from "@/components/ui";
import { Skeleton } from "@/components/ui/Skeleton";

interface Movie {
  _id: string;
  tmdbId: number;
  title: string;
  slug: string;
  genres: string[];
  language: string;
  originalLanguage?: string;
  rating: number | null;
  voteCount: number;
  duration: number | null;
  poster: string | null;
  backdrop: string | null;
  description: string;
  cast: { name: string; character?: string; photo?: string }[];
  director?: string;
  trailerUrl?: string;
  releaseDate: string | null;
  certificate?: string;
  formats: string[];
}

export default function MovieDetailPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [movie, setMovie] = useState<Movie | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchMovie() {
      try {
        const res = await api.get<{ movie: Movie }>(`/movies/${slug}`);
        setMovie(res.data?.movie || null);
      } catch (err) {
        console.error("Failed to fetch movie:", err);
      } finally {
        setIsLoading(false);
      }
    }
    fetchMovie();
  }, [slug]);

  if (isLoading) return <MovieDetailSkeleton />;
  if (!movie) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
        <p className="text-xl text-slate-400">Movie not found</p>
        <Link href="/">
          <Button variant="secondary">
            <ArrowLeft className="h-4 w-4" /> Go Home
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* ── Backdrop Hero ─────────────────────────────────────── */}
      <div className="relative h-[50vh] sm:h-[60vh]">
        <Image
          src={TMDB_IMAGE.backdropOriginal(movie.backdrop)}
          alt={movie.title}
          fill
          className="object-cover"
          priority
          sizes="100vw"
          quality={90}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-surface-900 via-surface-900/50 to-surface-900/20" />
        <div className="absolute inset-0 bg-gradient-to-r from-surface-900/90 via-surface-900/30 to-transparent" />
      </div>

      {/* ── Movie Info ────────────────────────────────────────── */}
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 -mt-48 sm:-mt-56 pb-16">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col sm:flex-row gap-6 sm:gap-8"
        >
          {/* Poster */}
          <div className="shrink-0 mx-auto sm:mx-0">
            <div className="relative w-48 sm:w-56 aspect-[2/3] rounded-2xl overflow-hidden shadow-2xl border border-white/10">
              <Image
                src={TMDB_IMAGE.poster(movie.poster)}
                alt={movie.title}
                fill
                className="object-cover"
                sizes="224px"
              />
            </div>
          </div>

          {/* Details */}
          <div className="flex-1 text-center sm:text-left">
            {/* Badges */}
            <div className="flex flex-wrap items-center gap-2 justify-center sm:justify-start mb-3">
              {movie.rating && (
                <Badge variant="success">
                  <Star className="h-3 w-3 fill-current" />
                  {movie.rating.toFixed(1)} ({movie.voteCount.toLocaleString()})
                </Badge>
              )}
              {movie.certificate && <Badge>{movie.certificate}</Badge>}
              {movie.duration && (
                <Badge>
                  <Clock className="h-3 w-3" />
                  {Math.floor(movie.duration / 60)}h {movie.duration % 60}m
                </Badge>
              )}
              {movie.releaseDate && (
                <Badge>
                  <Calendar className="h-3 w-3" />
                  {new Date(movie.releaseDate).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </Badge>
              )}
            </div>

            {/* Title */}
            <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">
              {movie.title}
            </h1>

            {/* Meta */}
            <p className="text-sm text-slate-400 mb-4">
              {movie.genres.join(" • ")} • {movie.language}
              {movie.director && ` • Directed by ${movie.director}`}
            </p>

            {/* Formats */}
            {movie.formats.length > 0 && (
              <div className="flex gap-2 justify-center sm:justify-start mb-5">
                {movie.formats.map((f) => (
                  <span
                    key={f}
                    className="text-xs font-semibold text-brand-300 bg-brand-500/15 border border-brand-500/30 rounded-lg px-2.5 py-1"
                  >
                    {f}
                  </span>
                ))}
              </div>
            )}

            {/* Description */}
            <p className="text-sm text-slate-300 leading-relaxed mb-6 max-w-2xl">
              {movie.description}
            </p>

            {/* CTA */}
            <div className="flex items-center gap-3 justify-center sm:justify-start">
              <Link href={`/movies/${movie.slug}/showtimes`}>
                <Button variant="accent" size="lg">
                  <Play className="h-4 w-4 fill-current" />
                  Book Tickets
                </Button>
              </Link>
              {movie.trailerUrl && (
                <a href={movie.trailerUrl} target="_blank" rel="noopener noreferrer">
                  <Button variant="secondary" size="lg">
                    <Play className="h-4 w-4" />
                    Watch Trailer
                  </Button>
                </a>
              )}
            </div>
          </div>
        </motion.div>

        {/* ── Cast ─────────────────────────────────────────────── */}
        {movie.cast.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="mt-12"
          >
            <h2 className="text-xl font-bold text-white mb-5">Cast</h2>
            <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar">
              {movie.cast.slice(0, 12).map((member, i) => (
                <div
                  key={i}
                  className="shrink-0 w-28 text-center"
                >
                  <div className="relative w-20 h-20 mx-auto rounded-full overflow-hidden bg-surface-700 border-2 border-white/10">
                    {member.photo ? (
                      <Image
                        src={TMDB_IMAGE.profile(member.photo)}
                        alt={member.name}
                        fill
                        className="object-cover"
                        sizes="80px"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-lg font-bold text-slate-500">
                        {member.name.charAt(0)}
                      </div>
                    )}
                  </div>
                  <p className="text-xs font-medium text-white mt-2 truncate">
                    {member.name}
                  </p>
                  {member.character && (
                    <p className="text-[10px] text-slate-500 truncate">
                      {member.character}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

// ── Skeleton ────────────────────────────────────────────────────────────────
function MovieDetailSkeleton() {
  return (
    <div className="min-h-screen">
      <Skeleton className="h-[60vh] w-full rounded-none" />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 -mt-48 pb-16">
        <div className="flex flex-col sm:flex-row gap-8">
          <Skeleton className="w-56 aspect-[2/3] rounded-2xl shrink-0 mx-auto sm:mx-0" />
          <div className="flex-1 space-y-4 pt-4">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-10 w-80" />
            <Skeleton className="h-4 w-64" />
            <Skeleton className="h-20 w-full max-w-lg" />
            <Skeleton className="h-12 w-40" />
          </div>
        </div>
      </div>
    </div>
  );
}
