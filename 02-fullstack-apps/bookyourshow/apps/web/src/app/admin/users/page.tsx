"use client";

import { useEffect, useState } from "react";
import { Search, Shield, User, ChevronLeft, ChevronRight } from "lucide-react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth.store";

interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: "USER" | "ADMIN";
  emailVerified: boolean;
  createdAt: string;
  _count: { bookings: number };
}

export default function AdminUsersPage() {
  const { user: me } = useAuthStore();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => fetchUsers(), 300);
    return () => clearTimeout(t);
  }, [page, search]);

  async function fetchUsers() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20", search });
      const res = await api.get<{ users: AdminUser[]; total: number; pages: number }>(`/admin/users?${params}`);
      setUsers(res.data?.users || []);
      setTotal(res.data?.total || 0);
      setPages(res.data?.pages || 1);
    } finally {
      setLoading(false);
    }
  }

  async function toggleRole(user: AdminUser) {
    if (user.id === me?.id) return;
    const newRole = user.role === "ADMIN" ? "USER" : "ADMIN";
    setUpdating(user.id);
    try {
      await api.patch(`/admin/users/${user.id}/role`, { role: newRole });
      setUsers((prev) => prev.map((u) => u.id === user.id ? { ...u, role: newRole } : u));
    } finally {
      setUpdating(null);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Users</h1>
          <p className="text-sm text-slate-400 mt-1">{total} registered users</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
        <input
          type="text"
          placeholder="Search by name or email…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-surface-800 border border-white/8 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-brand-500/50"
        />
      </div>

      {/* Table */}
      <div className="rounded-2xl bg-surface-800 border border-white/8 overflow-hidden mb-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/8 text-xs text-slate-500 uppercase tracking-wider">
              <th className="px-5 py-3 text-left">User</th>
              <th className="px-5 py-3 text-left">Bookings</th>
              <th className="px-5 py-3 text-left">Joined</th>
              <th className="px-5 py-3 text-left">Role</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i}><td colSpan={4} className="px-5 py-4">
                  <div className="h-4 bg-surface-700 animate-pulse rounded" />
                </td></tr>
              ))
            ) : users.length === 0 ? (
              <tr><td colSpan={4} className="px-5 py-12 text-center text-slate-500">No users found</td></tr>
            ) : (
              users.map((u) => (
                <tr key={u.id} className="hover:bg-white/2 transition">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-gradient-to-br from-brand-400 to-accent-500 flex items-center justify-center text-sm font-bold text-white shrink-0">
                        {u.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-white flex items-center gap-1">
                          {u.name}
                          {u.id === me?.id && <span className="text-[10px] text-brand-400">(you)</span>}
                        </p>
                        <p className="text-xs text-slate-500">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-slate-300">{u._count.bookings}</td>
                  <td className="px-5 py-3 text-slate-500 text-xs">
                    {new Date(u.createdAt).toLocaleDateString("en-IN")}
                  </td>
                  <td className="px-5 py-3">
                    <button
                      onClick={() => toggleRole(u)}
                      disabled={u.id === me?.id || updating === u.id}
                      className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg border transition disabled:opacity-50 disabled:cursor-not-allowed ${
                        u.role === "ADMIN"
                          ? "text-brand-400 bg-brand-400/10 border-brand-400/20 hover:bg-brand-400/20"
                          : "text-slate-400 bg-surface-700 border-white/8 hover:bg-white/5"
                      }`}
                    >
                      {u.role === "ADMIN" ? <Shield className="h-3 w-3" /> : <User className="h-3 w-3" />}
                      {updating === u.id ? "…" : u.role}
                    </button>
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
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
              className="p-1.5 rounded-lg bg-surface-800 border border-white/8 text-slate-400 hover:text-white disabled:opacity-40 transition">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={page === pages}
              className="p-1.5 rounded-lg bg-surface-800 border border-white/8 text-slate-400 hover:text-white disabled:opacity-40 transition">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
