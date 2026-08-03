"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Trash2, X } from "lucide-react";
import { api } from "@/lib/api";

interface Showtime {
  id: string;
  showDate: string;
  showTime: string;
  language: string;
  format: string;
  basePrice: number;
  movie: { title: string; posterUrl: string | null };
  screen: { name: string; theater: { name: string; city: string } };
}

interface Movie { id: string; title: string }
interface Screen { id: string; name: string; theater: { name: string; city: string } }

export default function AdminShowtimesPage() {
  const [showtimes, setShowtimes] = useState<Showtime[]>([]);
  const [movies, setMovies] = useState<Movie[]>([]);
  const [screens, setScreens] = useState<Screen[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ movieId: "", screenId: "", showDate: "", showTime: "10:00", basePrice: 200, language: "Hindi", format: "2D" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([fetchShowtimes(), fetchMovies(), fetchScreens()]);
  }, []);

  async function fetchShowtimes() {
    setLoading(true);
    try {
      const res = await api.get<{ showtimes: Showtime[] }>("/admin/showtimes?limit=50");
      setShowtimes(res.data?.showtimes || []);
    } finally { setLoading(false); }
  }

  async function fetchMovies() {
    const res = await api.get<{ movies: Movie[] }>("/movies/now-showing?limit=200");
    setMovies(res.data?.movies || []);
  }

  async function fetchScreens() {
    const res = await api.get<{ theaters: any[] }>("/theaters");
    const allScreens: Screen[] = [];
    (res.data?.theaters || []).forEach((t: any) => {
      (t.screens || []).forEach((s: any) => {
        allScreens.push({ id: s.id, name: s.name, theater: { name: t.name, city: t.city } });
      });
    });
    setScreens(allScreens);
  }

  async function handleCreate() {
    setSaving(true);
    try {
      await api.post("/admin/showtimes", form);
      setShowModal(false);
      setForm({ movieId: "", screenId: "", showDate: "", showTime: "10:00", basePrice: 200, language: "Hindi", format: "2D" });
      await fetchShowtimes();
    } finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this showtime?")) return;
    await api.delete(`/admin/showtimes/${id}`);
    setShowtimes((prev) => prev.filter((s) => s.id !== id));
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Showtimes</h1>
          <p className="text-sm text-slate-400 mt-1">{showtimes.length} scheduled showtimes</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium transition"
        >
          <Plus className="h-4 w-4" /> Add Showtime
        </button>
      </div>

      {/* Table */}
      <div className="rounded-2xl bg-surface-800 border border-white/8 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/8 text-xs text-slate-500 uppercase tracking-wider">
              <th className="px-5 py-3 text-left">Movie</th>
              <th className="px-5 py-3 text-left">Theater</th>
              <th className="px-5 py-3 text-left">Date & Time</th>
              <th className="px-5 py-3 text-left">Format</th>
              <th className="px-5 py-3 text-left">Base Price</th>
              <th className="px-5 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {loading ? Array.from({ length: 6 }).map((_, i) => (
              <tr key={i}><td colSpan={6} className="px-5 py-4">
                <div className="h-4 bg-surface-700 animate-pulse rounded" />
              </td></tr>
            )) : showtimes.length === 0 ? (
              <tr><td colSpan={6} className="px-5 py-12 text-center text-slate-500">No showtimes yet</td></tr>
            ) : showtimes.map((s) => (
              <tr key={s.id} className="hover:bg-white/2 transition">
                <td className="px-5 py-3 font-medium text-white">{s.movie.title}</td>
                <td className="px-5 py-3 text-slate-400">
                  {s.screen.theater.name}<br />
                  <span className="text-xs">{s.screen.name} · {s.screen.theater.city}</span>
                </td>
                <td className="px-5 py-3 text-slate-300">
                  {new Date(s.showDate).toLocaleDateString("en-IN")} · {s.showTime}
                </td>
                <td className="px-5 py-3 text-slate-400">{s.language} · {s.format}</td>
                <td className="px-5 py-3 text-white font-semibold">₹{s.basePrice}</td>
                <td className="px-5 py-3 text-right">
                  <button onClick={() => handleDelete(s.id)}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-400/10 transition">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
              className="w-full max-w-md rounded-2xl bg-surface-800 border border-white/10 p-6"
            >
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold text-white">Add Showtime</h2>
                <button onClick={() => setShowModal(false)} className="p-1 rounded-lg text-slate-500 hover:text-white">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-3">
                <Select label="Movie" value={form.movieId} onChange={(v) => setForm((f) => ({ ...f, movieId: v }))}
                  options={movies.map((m) => ({ value: m.id, label: m.title }))} />
                <Select label="Screen" value={form.screenId} onChange={(v) => setForm((f) => ({ ...f, screenId: v }))}
                  options={screens.map((s) => ({ value: s.id, label: `${s.theater.name} — ${s.name} (${s.theater.city})` }))} />
                <Field label="Date" type="date" value={form.showDate} onChange={(v) => setForm((f) => ({ ...f, showDate: v }))} />
                <Field label="Time" type="time" value={form.showTime} onChange={(v) => setForm((f) => ({ ...f, showTime: v }))} />
                <Field label="Base Price (₹)" type="number" value={String(form.basePrice)} onChange={(v) => setForm((f) => ({ ...f, basePrice: Number(v) }))} />
                <div className="grid grid-cols-2 gap-3">
                  <Select label="Language" value={form.language} onChange={(v) => setForm((f) => ({ ...f, language: v }))}
                    options={["Hindi","English","Tamil","Telugu","Kannada","Bengali"].map((l) => ({ value: l, label: l }))} />
                  <Select label="Format" value={form.format} onChange={(v) => setForm((f) => ({ ...f, format: v }))}
                    options={["2D","3D","IMAX","4DX"].map((fmt) => ({ value: fmt, label: fmt }))} />
                </div>
              </div>

              <button
                onClick={handleCreate}
                disabled={saving || !form.movieId || !form.screenId || !form.showDate}
                className="mt-5 w-full py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-semibold text-sm transition disabled:opacity-60"
              >
                {saving ? "Creating…" : "Create Showtime"}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Field({ label, type, value, onChange }: { label: string; type: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-xs text-slate-400 mb-1">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 rounded-xl bg-surface-900 border border-white/8 text-sm text-white focus:outline-none focus:border-brand-500/50" />
    </div>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <div>
      <label className="block text-xs text-slate-400 mb-1">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 rounded-xl bg-surface-900 border border-white/8 text-sm text-white focus:outline-none focus:border-brand-500/50">
        <option value="">Select {label}…</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}
