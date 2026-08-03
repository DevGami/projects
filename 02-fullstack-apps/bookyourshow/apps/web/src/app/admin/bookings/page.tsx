"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";
import { api } from "@/lib/api";

interface Booking {
  id: string;
  movieTitle: string;
  userId: string;
  seats: any[];
  totalAmount: string;
  status: string;
  bookedAt: string;
  showtime: {
    showDate: string;
    showTime: string;
    screen: { name: string; theater: { name: string; city: string } };
  };
}

const STATUS_OPTIONS = ["ALL", "PENDING", "CONFIRMED", "CANCELLED"];
const STATUS_COLORS: Record<string, string> = {
  CONFIRMED: "text-green-400 bg-green-400/10 border-green-400/20",
  PENDING: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20",
  CANCELLED: "text-red-400 bg-red-400/10 border-red-400/20",
};

export default function AdminBookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [status, setStatus] = useState("ALL");
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchBookings(); }, [page, status]);

  async function fetchBookings() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "15" });
      if (status !== "ALL") params.set("status", status);
      const res = await api.get<{ bookings: Booking[]; total: number; pages: number }>(`/admin/bookings?${params}`);
      setBookings(res.data?.bookings || []);
      setTotal(res.data?.total || 0);
      setPages(res.data?.pages || 1);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Bookings</h1>
          <p className="text-sm text-slate-400 mt-1">{total} total bookings</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-6">
        {STATUS_OPTIONS.map((s) => (
          <button
            key={s}
            onClick={() => { setStatus(s); setPage(1); }}
            className={`px-4 py-1.5 rounded-xl text-xs font-semibold border transition ${
              status === s
                ? "bg-brand-500/20 border-brand-500/40 text-brand-300"
                : "bg-surface-800 border-white/8 text-slate-400 hover:text-white"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-2xl bg-surface-800 border border-white/8 overflow-hidden mb-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/8 text-xs text-slate-500 uppercase tracking-wider">
              <th className="px-5 py-3 text-left">Movie</th>
              <th className="px-5 py-3 text-left">Show</th>
              <th className="px-5 py-3 text-left">Seats</th>
              <th className="px-5 py-3 text-left">Amount</th>
              <th className="px-5 py-3 text-left">Status</th>
              <th className="px-5 py-3 text-left">Booked</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i}>
                  <td className="px-5 py-4" colSpan={6}>
                    <div className="h-4 bg-surface-700 animate-pulse rounded" />
                  </td>
                </tr>
              ))
            ) : bookings.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-12 text-center text-slate-500">No bookings found</td>
              </tr>
            ) : (
              bookings.map((b) => (
                <tr key={b.id} className="hover:bg-white/2 transition">
                  <td className="px-5 py-3">
                    <p className="font-medium text-white">{b.movieTitle}</p>
                    <p className="text-xs text-slate-500">{b.id.slice(0, 8)}…</p>
                  </td>
                  <td className="px-5 py-3 text-slate-400">
                    <p>{b.showtime.screen.theater.name}</p>
                    <p className="text-xs">{new Date(b.showtime.showDate).toLocaleDateString("en-IN")} · {b.showtime.showTime}</p>
                  </td>
                  <td className="px-5 py-3 text-slate-300">{(b.seats as any[]).length} seats</td>
                  <td className="px-5 py-3 font-semibold text-white">₹{Math.round(Number(b.totalAmount))}</td>
                  <td className="px-5 py-3">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border uppercase ${STATUS_COLORS[b.status] || STATUS_COLORS.PENDING}`}>
                      {b.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-slate-500 text-xs">
                    {new Date(b.bookedAt).toLocaleDateString("en-IN")}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-500">Page {page} of {pages}</p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-1.5 rounded-lg bg-surface-800 border border-white/8 text-slate-400 hover:text-white disabled:opacity-40 transition"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(pages, p + 1))}
              disabled={page === pages}
              className="p-1.5 rounded-lg bg-surface-800 border border-white/8 text-slate-400 hover:text-white disabled:opacity-40 transition"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
