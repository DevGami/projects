"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Building2, MapPin, Trash2, X, ChevronDown } from "lucide-react";
import { api } from "@/lib/api";

interface Screen { id: string; name: string; totalSeats: number }
interface Theater { id: string; name: string; city: string; address: string | null; screens: Screen[] }

const CITIES = ["Mumbai", "Delhi", "Bangalore", "Hyderabad", "Chennai", "Kolkata", "Pune", "Ahmedabad", "Jaipur", "Surat"];

export default function AdminTheatersPage() {
  const [theaters, setTheaters] = useState<Theater[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", city: "Mumbai", address: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchTheaters(); }, []);

  async function fetchTheaters() {
    setLoading(true);
    try {
      const res = await api.get<{ theaters: Theater[] }>("/theaters");
      setTheaters(res.data?.theaters || []);
    } finally { setLoading(false); }
  }

  async function handleCreate() {
    setSaving(true);
    try {
      await api.post("/admin/theaters", form);
      setShowModal(false);
      setForm({ name: "", city: "Mumbai", address: "" });
      await fetchTheaters();
    } finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this theater? All associated showtimes will be affected.")) return;
    await api.delete(`/admin/theaters/${id}`);
    setTheaters((prev) => prev.filter((t) => t.id !== id));
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Theaters</h1>
          <p className="text-sm text-slate-400 mt-1">{theaters.length} theaters</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium transition"
        >
          <Plus className="h-4 w-4" /> Add Theater
        </button>
      </div>

      {/* Theater Cards */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 rounded-2xl bg-surface-800 animate-pulse" />
          ))}
        </div>
      ) : theaters.length === 0 ? (
        <div className="text-center py-16 text-slate-500">No theaters yet</div>
      ) : (
        <div className="space-y-3">
          {theaters.map((theater) => (
            <motion.div
              key={theater.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl bg-surface-800 border border-white/8 overflow-hidden"
            >
              <div className="flex items-center justify-between px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-brand-500/20 flex items-center justify-center">
                    <Building2 className="h-5 w-5 text-brand-400" />
                  </div>
                  <div>
                    <p className="font-semibold text-white">{theater.name}</p>
                    <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                      <MapPin className="h-3 w-3" />
                      {theater.city}{theater.address ? ` · ${theater.address}` : ""}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">{theater.screens?.length || 0} screens</span>
                  <button
                    onClick={() => setExpanded(expanded === theater.id ? null : theater.id)}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-white transition"
                  >
                    <ChevronDown className={`h-4 w-4 transition-transform ${expanded === theater.id ? "rotate-180" : ""}`} />
                  </button>
                  <button
                    onClick={() => handleDelete(theater.id)}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-400/10 transition"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <AnimatePresence>
                {expanded === theater.id && (
                  <motion.div
                    initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }}
                    className="overflow-hidden border-t border-white/8"
                  >
                    <div className="px-5 py-3">
                      {(theater.screens || []).length === 0 ? (
                        <p className="text-sm text-slate-500 py-2">No screens configured</p>
                      ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                          {theater.screens.map((screen) => (
                            <div key={screen.id} className="rounded-xl bg-surface-900 border border-white/5 px-3 py-2">
                              <p className="text-xs font-semibold text-white">{screen.name}</p>
                              <p className="text-[10px] text-slate-500">{screen.totalSeats} seats</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
              className="w-full max-w-sm rounded-2xl bg-surface-800 border border-white/10 p-6"
            >
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold text-white">Add Theater</h2>
                <button onClick={() => setShowModal(false)} className="p-1 rounded-lg text-slate-500 hover:text-white">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Theater Name</label>
                  <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="PVR Cinemas"
                    className="w-full px-3 py-2 rounded-xl bg-surface-900 border border-white/8 text-sm text-white focus:outline-none focus:border-brand-500/50" />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">City</label>
                  <select value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-surface-900 border border-white/8 text-sm text-white focus:outline-none">
                    {CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Address (optional)</label>
                  <input value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                    placeholder="Mall of India, Noida"
                    className="w-full px-3 py-2 rounded-xl bg-surface-900 border border-white/8 text-sm text-white focus:outline-none focus:border-brand-500/50" />
                </div>
              </div>
              <button
                onClick={handleCreate}
                disabled={saving || !form.name}
                className="mt-5 w-full py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-semibold text-sm transition disabled:opacity-60"
              >
                {saving ? "Creating…" : "Create Theater"}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
