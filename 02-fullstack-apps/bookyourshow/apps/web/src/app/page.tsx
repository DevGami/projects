"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Star, Clock, ChevronRight, TrendingUp } from "lucide-react";
import { api } from "@/lib/api";
import { TMDB_IMAGE } from "@/lib/constants";
import { Badge } from "@/components/ui";
import { MovieGridSkeleton } from "@/components/ui/Skeleton";
import { useCityStore } from "@/stores/city.store";

// ── Types ───────────────────────────────────────────────────────────────────
interface Movie {
  _id: string;
  tmdbId: number;
  title: string;
  slug: string;
  genres: string[];
  language: string;
  rating: number | null;
  voteCount: number;
  duration: number | null;
  poster: string | null;
  backdrop: string | null;
  description: string;
  releaseDate: string | null;
  certificate?: string;
  formats: string[];
}

// ═══════════════════════════════════════════════════════════════════════════
// Landing Page
// ═══════════════════════════════════════════════════════════════════════════
export default function HomePage() {
  const { city } = useCityStore();
  const [movies, setMovies] = useState<Movie[]>([]);
  const [heroIndex, setHeroIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchMovies() {
      setIsLoading(true);
      try {
        const res = await api.get<{ movies: Movie[]; total: number }>(
          "/movies/now-showing",
          { city }
        );
        setMovies(res.data?.movies || []);
      } catch (err) {
        console.error("Failed to fetch movies:", err);
      } finally {
        setIsLoading(false);
      }
    }
    fetchMovies();
  }, [city]);

  // Auto-rotate hero every 6 seconds
  const heroMovies = movies.slice(0, 5);
  useEffect(() => {
    if (heroMovies.length <= 1) return;
    const timer = setInterval(() => {
      setHeroIndex((prev) => (prev + 1) % heroMovies.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [heroMovies.length]);

  const currentHero = heroMovies[heroIndex];

  return (
    <div className="min-h-screen">
      {/* ── Hero Section ──────────────────────────────────────────── */}
      {currentHero && (
        <section className="relative h-[65vh] sm:h-[75vh] overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentHero.tmdbId}
              initial={{ opacity: 0, scale: 1.05 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.8 }}
              className="absolute inset-0"
            >
              <Image
                src={TMDB_IMAGE.backdropOriginal(currentHero.backdrop)}
                alt={currentHero.title}
                fill
                className="object-cover"
                priority
              />
              {/* Gradient overlays */}
              <div className="absolute inset-0 bg-gradient-to-t from-surface-900 via-surface-900/40 to-transparent" />
              <div className="absolute inset-0 bg-gradient-to-r from-surface-900/80 via-transparent to-transparent" />
            </motion.div>
          </AnimatePresence>

          {/* Hero Content */}
          <div className="absolute inset-0 flex items-end">
            <div className="mx-auto max-w-7xl w-full px-4 sm:px-6 lg:px-8 pb-12 sm:pb-16">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentHero.tmdbId}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                  className="max-w-xl"
                >
                  {/* Badges */}
                  <div className="flex items-center gap-2 mb-3">
                    {currentHero.rating && (
                      <Badge variant="success">
                        <Star className="h-3 w-3 fill-current" />
                        {currentHero.rating.toFixed(1)}
                      </Badge>
                    )}
                    {currentHero.certificate && (
                      <Badge variant="default">{currentHero.certificate}</Badge>
                    )}
                    {currentHero.duration && (
                      <Badge variant="default">
                        <Clock className="h-3 w-3" />
                        {Math.floor(currentHero.duration / 60)}h{" "}
                        {currentHero.duration % 60}m
                      </Badge>
                    )}
                  </div>

                  {/* Title */}
                  <h1 className="text-3xl sm:text-5xl font-bold text-white mb-3 leading-tight">
                    {currentHero.title}
                  </h1>

                  {/* Genres */}
                  <p className="text-sm text-slate-400 mb-4">
                    {currentHero.genres.slice(0, 3).join(" • ")} •{" "}
                    {currentHero.language}
                  </p>

                  {/* Description */}
                  <p className="text-sm text-slate-300 line-clamp-2 mb-6 leading-relaxed">
                    {currentHero.description}
                  </p>

                  {/* CTA Buttons */}
                  <div className="flex items-center gap-3">
                    <Link
                      href={`/movies/${currentHero.slug}`}
                      className="inline-flex items-center gap-2 rounded-xl bg-accent-500 px-6 py-3 text-sm font-semibold text-white hover:bg-accent-600 transition shadow-lg shadow-accent-500/25 active:scale-[0.98]"
                    >
                      <Play className="h-4 w-4 fill-current" />
                      Book Now
                    </Link>
                    <Link
                      href={`/movies/${currentHero.slug}`}
                      className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-6 py-3 text-sm font-semibold text-white hover:bg-white/20 transition backdrop-blur-sm active:scale-[0.98]"
                    >
                      View Details
                    </Link>
                  </div>
                </motion.div>
              </AnimatePresence>

              {/* Hero Dots */}
              {heroMovies.length > 1 && (
                <div className="flex items-center gap-2 mt-6">
                  {heroMovies.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setHeroIndex(i)}
                      className={`h-1.5 rounded-full transition-all duration-300 ${
                        i === heroIndex
                          ? "w-8 bg-brand-400"
                          : "w-1.5 bg-white/30 hover:bg-white/50"
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ── Now Showing Grid ─────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <TrendingUp className="h-5 w-5 text-accent-500" />
            <h2 className="text-xl sm:text-2xl font-bold text-white">
              Now Showing
            </h2>
          </div>
          <Link
            href="/movies"
            className="flex items-center gap-1 text-sm text-brand-400 hover:text-brand-300 transition font-medium"
          >
            View All
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>

        {isLoading ? (
          <MovieGridSkeleton count={10} />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-6">
            {movies.map((movie) => (
              <MovieCard key={movie._id} movie={movie} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Movie Card Component
// ═══════════════════════════════════════════════════════════════════════════
function MovieCard({ movie }: { movie: Movie }) {
  return (
    <Link href={`/movies/${movie.slug}`} className="group">
      <div className="rounded-2xl bg-surface-800 border border-white/8 overflow-hidden transition-all duration-300 hover:border-brand-500/30 hover:shadow-xl hover:shadow-brand-500/5 hover:-translate-y-1">
        {/* Poster */}
        <div className="relative aspect-[2/3] overflow-hidden">
          <Image
            src={TMDB_IMAGE.poster(movie.poster)}
            alt={movie.title}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 20vw"
            onError={(e) => { (e.target as HTMLImageElement).src = '/poster-placeholder.svg'; }}
          />

          {/* Rating overlay */}
          {movie.rating && (
            <div className="absolute top-2 right-2 flex items-center gap-1 bg-black/70 backdrop-blur-sm rounded-lg px-2 py-1 text-xs font-semibold text-amber-400">
              <Star className="h-3 w-3 fill-amber-400" />
              {movie.rating.toFixed(1)}
            </div>
          )}
          {/* Hover overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-3">
            <span className="text-xs text-white font-medium bg-accent-500 rounded-lg px-3 py-1.5">
              Book Now →
            </span>
          </div>
        </div>

        {/* Info */}
        <div className="p-3 sm:p-4">
          <h3 className="text-sm font-semibold text-white line-clamp-1 group-hover:text-brand-300 transition">
            {movie.title}
          </h3>
          <p className="text-xs text-slate-500 mt-1 truncate min-h-[1.25rem]">
            {movie.genres.length > 0
              ? movie.genres.slice(0, 2).join(", ")
              : movie.language || "Movie"}
          </p>
          <div className="flex gap-1.5 mt-2 min-h-[1.25rem]">
            {movie.formats.length > 0
              ? movie.formats.slice(0, 3).map((f) => (
                  <span
                    key={f}
                    className="text-[10px] font-medium text-slate-400 bg-surface-700 rounded px-1.5 py-0.5"
                  >
                    {f}
                  </span>
                ))
              : <span className="text-[10px] font-medium text-slate-400 bg-surface-700 rounded px-1.5 py-0.5">2D</span>
            }
          </div>
        </div>
      </div>
    </Link>
  );
}
