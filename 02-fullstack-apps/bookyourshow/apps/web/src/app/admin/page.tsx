"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Users, Film, Ticket, TrendingUp, RefreshCw, Clock } from "lucide-react";
import { api } from "@/lib/api";

interface Stats {
  totalUsers: number;
  totalMovies: number;
  totalBookings: number;
  bookingsToday: number;
  revenueThisWeek: number;
}
interface RecentBooking {
  id: string;
  movieTitle: string;
  status: string;
  totalAmount: string;
  bookedAt: string;
}

const STATUS_COLORS: Record<string, string> = {
  CONFIRMED: "text-green-400 bg-green-400/10 border-green-400/20",
  PENDING: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20",
  CANCELLED: "text-red-400 bg-red-400/10 border-red-400/20",
};

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [recent, setRecent] = useState<RecentBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");

  useEffect(() => {
    fetchStats();
  }, []);

  async function fetchStats() {
    setLoading(true);
    try {
      const res = await api.get<{ stats: Stats; recentBookings: RecentBooking[] }>("/admin/stats");
      setStats(res.data!.stats);
      setRecent(res.data!.recentBookings);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function handleSync() {
    setSyncing(true);
    setSyncMsg("");
    try {
      const res = await api.post<{ message: string }>("/admin/movies/sync");
      setSyncMsg(res.data?.message || "Sync complete");
      await fetchStats();
    } catch {
      setSyncMsg("Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  const STAT_CARDS = stats
    ? [
        { label: "Total Users", value: stats.totalUsers, icon: Users, color: "from-blue-500 to-cyan-500" },
        { label: "Total Movies", value: stats.totalMovies, icon: Film, color: "from-purple-500 to-brand-500" },
        { label: "Total Bookings", value: stats.totalBookings, icon: Ticket, color: "from-emerald-500 to-teal-500" },
        { label: "Bookings Today", value: stats.bookingsToday, icon: Clock, color: "from-orange-500 to-amber-500" },
        {
          label: "Revenue This Week",
          value: `₹${stats.revenueThisWeek.toLocaleString("en-IN")}`,
          icon: TrendingUp,
          color: "from-pink-500 to-rose-500",
        },
      ]
    : [];

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-sm text-slate-400 mt-1">System overview and quick actions</p>
        </div>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-500/20 border border-brand-500/30 text-brand-300 hover:bg-brand-500/30 transition text-sm font-medium disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
          {syncing ? "Syncing…" : "Sync TMDB"}
        </button>
      </div>

      {syncMsg && (
        <div className="mb-6 px-4 py-3 rounded-xl bg-brand-500/10 border border-brand-500/20 text-brand-300 text-sm">
          {syncMsg}
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-8">
        {loading
          ? Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-28 rounded-2xl bg-surface-800 animate-pulse" />
            ))
          : STAT_CARDS.map(({ label, value, icon: Icon, color }, i) => (
              <motion.div
                key={label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="rounded-2xl bg-surface-800 border border-white/8 p-5"
              >
                <div className={`h-10 w-10 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center mb-3`}>
                  <Icon className="h-5 w-5 text-white" />
                </div>
                <p className="text-2xl font-bold text-white">{value}</p>
                <p className="text-xs text-slate-500 mt-1">{label}</p>
              </motion.div>
            ))}
      </div>

      {/* Recent Bookings */}
      <div className="rounded-2xl bg-surface-800 border border-white/8">
        <div className="px-6 py-4 border-b border-white/8">
          <h2 className="text-sm font-semibold text-white">Recent Bookings</h2>
        </div>
        <div className="divide-y divide-white/5">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="px-6 py-4 flex gap-4">
                <div className="flex-1 h-4 bg-surface-700 animate-pulse rounded" />
                <div className="w-24 h-4 bg-surface-700 animate-pulse rounded" />
              </div>
            ))
          ) : recent.length === 0 ? (
            <p className="px-6 py-8 text-center text-slate-500 text-sm">No bookings yet</p>
          ) : (
            recent.map((b) => (
              <div key={b.id} className="px-6 py-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-white">{b.movieTitle}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {new Date(b.bookedAt).toLocaleDateString("en-IN")} · #{b.id.slice(0, 8)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-lg border uppercase ${
                      STATUS_COLORS[b.status] || STATUS_COLORS.PENDING
                    }`}
                  >
                    {b.status}
                  </span>
                  <span className="text-sm font-bold text-white">₹{Math.round(Number(b.totalAmount))}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
