"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { RefreshCw, Star, Eye, EyeOff, Trash2, Search } from "lucide-react";
import { api } from "@/lib/api";

interface Movie {
  _id: string;
  tmdbId: number;
  title: string;
  genres: string[];
  releaseDate: string;
  rating: number;
  status: string;
  poster: string | null;
}

export default function AdminMoviesPage() {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => { fetchMovies(); }, []);

  async function fetchMovies() {
    setLoading(true);
    try {
      const res = await api.get<{ movies: Movie[] }>("/movies?limit=50");
      setMovies(res.data?.movies || []);
    } finally {
      setLoading(false);
    }
  }

  async function handleSync() {
    setSyncing(true);
    try {
      await api.post("/admin/movies/sync");
      await fetchMovies();
    } finally {
      setSyncing(false);
    }
  }

  async function toggleShowing(movie: Movie) {
    const isNowShowing = movie.status === "now_showing";
    await api.patch(`/admin/movies/${movie._id}`, { isNowShowing: !isNowShowing });
    setMovies((prev) => prev.map((m) => m._id === movie._id ? { ...m, status: !isNowShowing ? "now_showing" : "upcoming" } : m));
  }

  async function deleteMovie(id: string) {
    if (!confirm("Delete this movie? This cannot be undone.")) return;
    await api.delete(`/admin/movies/${id}`);
    setMovies((prev) => prev.filter((m) => m._id !== id));
  }

  const filtered = movies.filter((m) => m.title.toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Movies</h1>
          <p className="text-sm text-slate-400 mt-1">{movies.length} movies in database</p>
        </div>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-500/20 border border-brand-500/30 text-brand-300 hover:bg-brand-500/30 transition text-sm font-medium"
        >
          <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
          {syncing ? "Syncing…" : "Sync TMDB"}
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
        <input
          type="text"
          placeholder="Search movies..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-surface-800 border border-white/8 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-brand-500/50"
        />
      </div>

      {/* Table */}
      <div className="rounded-2xl bg-surface-800 border border-white/8 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/8 text-xs text-slate-500 uppercase tracking-wider">
              <th className="px-6 py-3 text-left">Movie</th>
              <th className="px-6 py-3 text-left">Genres</th>
              <th className="px-6 py-3 text-left">Rating</th>
              <th className="px-6 py-3 text-left">Now Showing</th>
              <th className="px-6 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i}>
                  <td className="px-6 py-4" colSpan={5}>
                    <div className="h-4 bg-surface-700 animate-pulse rounded" />
                  </td>
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                  No movies found
                </td>
              </tr>
            ) : (
              filtered.map((movie) => (
                <motion.tr
                  key={movie._id || movie.tmdbId}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="hover:bg-white/2 transition"
                >
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-3">
                      {movie.poster ? (
                        <img
                          src={`https://image.tmdb.org/t/p/w92${movie.poster}`}
                          alt={movie.title}
                          className="h-10 w-7 rounded object-cover shrink-0"
                        />
                      ) : (
                        <div className="h-10 w-7 rounded bg-surface-700 shrink-0" />
                      )}
                      <span className="font-medium text-white truncate max-w-[200px]">{movie.title}</span>
                    </div>
                  </td>
                  <td className="px-6 py-3 text-slate-400">
                    {(movie.genres || []).slice(0, 2).join(", ")}
                  </td>
                  <td className="px-6 py-3">
                    <span className="flex items-center gap-1 text-yellow-400">
                      <Star className="h-3 w-3 fill-yellow-400" />
                      {movie.rating?.toFixed(1)}
                    </span>
                  </td>
                  <td className="px-6 py-3">
                    <button
                      onClick={() => toggleShowing(movie)}
                      className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg border transition ${
                        movie.status === "now_showing"
                          ? "text-green-400 bg-green-400/10 border-green-400/20 hover:bg-green-400/20"
                          : "text-slate-500 bg-surface-700 border-white/8 hover:bg-white/5"
                      }`}
                    >
                      {movie.status === "now_showing" ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                      {movie.status === "now_showing" ? "Live" : "Hidden"}
                    </button>
                  </td>
                  <td className="px-6 py-3 text-right">
                    <button
                      onClick={() => deleteMovie(movie._id)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-400/10 transition"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </motion.tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
