"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { Star, Search, X, ArrowUpDown, ChevronLeft, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";
import { api } from "@/lib/api";
import { TMDB_IMAGE } from "@/lib/constants";
import { MovieGridSkeleton } from "@/components/ui/Skeleton";
import { useCityStore } from "@/stores/city.store";

interface Movie {
  _id: string;
  tmdbId: number;
  title: string;
  slug: string;
  genres: string[];
  language: string;
  rating: number | null;
  popularity: number;
  revenue: number;
  duration: number | null;
  poster: string | null;
  formats: string[];
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const SORT_OPTIONS = [
  { value: "rating", label: "Highest Rated" },
  { value: "popularity", label: "Most Popular" },
  { value: "title", label: "A → Z" },
  { value: "revenue", label: "Box Office" },
] as const;

const LANGUAGES = ["English", "Hindi", "Tamil", "Telugu", "Punjabi", "Korean"];

const PAGE_SIZE = 12;

export default function MoviesPage() {
  const { city } = useCityStore();
  const [movies, setMovies] = useState<Movie[]>([]);
  const [genres, setGenres] = useState<string[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [activeGenre, setActiveGenre] = useState("");
  const [activeLanguage, setActiveLanguage] = useState("");
  const [activeSort, setActiveSort] = useState("rating");
  const [page, setPage] = useState(1);

  // Search (separate flow)
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Movie[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  // Fetch genres once
  useEffect(() => {
    api.get<{ genres: string[] }>("/movies/genres")
      .then((r) => setGenres(r.data?.genres || []))
      .catch(console.error);
  }, []);

  // Fetch paginated movies whenever filters/page change
  const fetchMovies = useCallback(async () => {
    if (searchQuery.trim()) return; // search mode — don't paginate
    setIsLoading(true);
    try {
      const res = await api.get<{ movies: Movie[]; pagination: Pagination }>(
        "/movies",
        {
          page,
          limit: PAGE_SIZE,
          ...(activeGenre ? { genre: activeGenre } : {}),
          ...(activeLanguage ? { language: activeLanguage } : {}),
          sort: activeSort,
          order: "desc",
        }
      );
      setMovies(res.data?.movies || []);
      setPagination(res.data?.pagination || null);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [page, activeGenre, activeLanguage, activeSort, searchQuery]);

  useEffect(() => {
    fetchMovies();
  }, [fetchMovies]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [activeGenre, activeLanguage, activeSort]);

  // Search debounce
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults(null);
      return;
    }
    setIsSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = await api.get<{ movies: Movie[] }>("/movies/search", { q: searchQuery });
        setSearchResults(res.data?.movies || []);
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const displayMovies = searchResults !== null ? searchResults : movies;

  return (
    <div className="min-h-screen mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <h1 className="text-2xl font-bold text-white mb-6">Now Showing</h1>

        {/* ── Search + Sort Row ── */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search movies..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl bg-surface-800 border border-white/10 py-2.5 pl-10 pr-10 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {!searchQuery && (
            <div className="flex items-center gap-2">
              <ArrowUpDown className="h-4 w-4 text-slate-400 shrink-0" />
              <select
                value={activeSort}
                onChange={(e) => setActiveSort(e.target.value)}
                className="rounded-xl bg-surface-800 border border-white/10 py-2.5 px-4 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-500/50 transition appearance-none cursor-pointer"
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value} className="bg-surface-800 text-white">
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* ── Genre Filter Row ── */}
        {!searchQuery && genres.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-2 mb-3 no-scrollbar">
            <button
              onClick={() => setActiveGenre("")}
              className={`shrink-0 px-4 py-2 rounded-xl text-sm font-medium transition ${
                activeGenre === ""
                  ? "bg-brand-500 text-white"
                  : "bg-surface-800 text-slate-400 hover:bg-surface-700 hover:text-white border border-white/10"
              }`}
            >
              All Genres
            </button>
            {genres.map((g) => (
              <button
                key={g}
                onClick={() => setActiveGenre(activeGenre === g ? "" : g)}
                className={`shrink-0 px-4 py-2 rounded-xl text-sm font-medium transition ${
                  activeGenre === g
                    ? "bg-brand-500 text-white"
                    : "bg-surface-800 text-slate-400 hover:bg-surface-700 hover:text-white border border-white/10"
                }`}
              >
                {g}
              </button>
            ))}
          </div>
        )}

        {/* ── Language Filter Row ── */}
        {!searchQuery && (
          <div className="flex gap-2 overflow-x-auto pb-3 mb-6 no-scrollbar">
            <button
              onClick={() => setActiveLanguage("")}
              className={`shrink-0 px-4 py-1.5 rounded-lg text-xs font-medium transition ${
                activeLanguage === ""
                  ? "bg-accent-500 text-white"
                  : "bg-surface-800 text-slate-500 hover:text-white border border-white/10"
              }`}
            >
              All Languages
            </button>
            {LANGUAGES.map((lang) => (
              <button
                key={lang}
                onClick={() => setActiveLanguage(activeLanguage === lang ? "" : lang)}
                className={`shrink-0 px-4 py-1.5 rounded-lg text-xs font-medium transition ${
                  activeLanguage === lang
                    ? "bg-accent-500 text-white"
                    : "bg-surface-800 text-slate-500 hover:text-white border border-white/10"
                }`}
              >
                {lang}
              </button>
            ))}
          </div>
        )}

        {/* Active filter summary */}
        {!searchQuery && (activeGenre || activeLanguage) && (
          <p className="text-xs text-slate-500 mb-4">
            Showing{" "}
            {[activeGenre, activeLanguage].filter(Boolean).join(" + ")}
            {" · "}
            <button onClick={() => { setActiveGenre(""); setActiveLanguage(""); }} className="text-brand-400 hover:underline">
              Clear filters
            </button>
          </p>
        )}

        {/* ── Movie Grid ── */}
        {isLoading || isSearching ? (
          <MovieGridSkeleton count={PAGE_SIZE} />
        ) : displayMovies.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-lg text-slate-400">No movies found</p>
            <p className="text-sm text-slate-600 mt-1">
              {searchQuery
                ? "Try a different search term"
                : "Try changing the filters"}
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-5">
              {displayMovies.map((movie, i) => (
                <motion.div
                  key={movie._id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03, duration: 0.3 }}
                >
                  <Link href={`/movies/${movie.slug}`} className="group block">
                    <div className="rounded-2xl bg-surface-800 border border-white/8 overflow-hidden transition-all duration-300 hover:border-brand-500/30 hover:shadow-xl hover:shadow-brand-500/5 hover:-translate-y-1">
                      <div className="relative aspect-[2/3] overflow-hidden">
                        <Image
                          src={TMDB_IMAGE.poster(movie.poster)}
                          alt={movie.title}
                          fill
                          className="object-cover transition-transform duration-500 group-hover:scale-105"
                          sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 20vw"
                        />
                        {movie.rating && (
                          <div className="absolute top-2 right-2 flex items-center gap-1 bg-black/70 backdrop-blur-sm rounded-lg px-2 py-1 text-xs font-semibold text-amber-400">
                            <Star className="h-3 w-3 fill-amber-400" />
                            {movie.rating.toFixed(1)}
                          </div>
                        )}
                        {movie.language && movie.language !== "English" && (
                          <div className="absolute top-2 left-2 bg-brand-600/80 backdrop-blur-sm rounded-md px-1.5 py-0.5 text-[10px] font-medium text-white">
                            {movie.language}
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-3">
                          <span className="text-xs text-white font-medium bg-accent-500 rounded-lg px-3 py-1.5">
                            Book Now →
                          </span>
                        </div>
                      </div>
                      <div className="p-3">
                        <h3 className="text-sm font-semibold text-white line-clamp-1 group-hover:text-brand-300 transition">
                          {movie.title}
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5 truncate">
                          {movie.genres.length > 0 ? movie.genres.slice(0, 2).join(", ") : movie.language}
                        </p>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>

            {/* ── Pagination ── */}
            {searchResults === null && pagination && pagination.totalPages > 1 && (
              <div className="flex items-center justify-center gap-3 mt-10">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-surface-800 border border-white/10 text-sm text-slate-300 hover:bg-surface-700 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                  <ChevronLeft className="h-4 w-4" /> Prev
                </button>

                <div className="flex items-center gap-1.5">
                  {Array.from({ length: Math.min(pagination.totalPages, 7) }, (_, i) => {
                    const pageNum = i + 1;
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setPage(pageNum)}
                        className={`w-9 h-9 rounded-xl text-sm font-medium transition ${
                          page === pageNum
                            ? "bg-brand-500 text-white"
                            : "bg-surface-800 border border-white/10 text-slate-400 hover:bg-surface-700 hover:text-white"
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                  {pagination.totalPages > 7 && (
                    <span className="text-slate-600 px-1">…{pagination.totalPages}</span>
                  )}
                </div>

                <button
                  onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                  disabled={page === pagination.totalPages}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-surface-800 border border-white/10 text-sm text-slate-300 hover:bg-surface-700 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                  Next <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}

            {/* Page info */}
            {searchResults === null && pagination && (
              <p className="text-center text-xs text-slate-600 mt-3">
                {pagination.total} movies · Page {page} of {pagination.totalPages}
              </p>
            )}
          </>
        )}
      </motion.div>
    </div>
  );
}
