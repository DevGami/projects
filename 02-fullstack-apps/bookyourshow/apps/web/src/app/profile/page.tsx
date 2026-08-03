"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { User, Mail, Shield, Calendar, Ticket, ChevronRight, Phone } from "lucide-react";
import { useAuthStore } from "@/stores/auth.store";
import { Button } from "@/components/ui";

export default function ProfilePage() {
  const router = useRouter();
  const { user, isAuthenticated, isHydrated } = useAuthStore();

  useEffect(() => {
    if (isHydrated && !isAuthenticated) {
      router.push("/auth/login");
    }
  }, [isHydrated, isAuthenticated, router]);

  if (!isHydrated || !user) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-brand-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] mx-auto max-w-2xl px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="space-y-6"
      >
        <h1 className="text-2xl font-bold text-white">My Profile</h1>

        {/* ── Profile Card ────────────────────────────────────── */}
        <div className="rounded-2xl bg-surface-800 border border-white/8 p-6 sm:p-8 shadow-2xl">
          {/* Avatar */}
          <div className="flex items-center gap-4 mb-8">
            <div className="h-16 w-16 rounded-full bg-gradient-to-br from-brand-400 to-accent-500 flex items-center justify-center text-2xl font-bold text-white shrink-0">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">{user.name}</h2>
              <p className="text-sm text-slate-400">{user.email}</p>
              <span className={`inline-flex items-center gap-1 mt-1 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${user.role === "ADMIN" ? "bg-brand-500/20 text-brand-300" : "bg-slate-700 text-slate-400"}`}>
                {user.role === "ADMIN" ? "Administrator" : "Member"}
              </span>
            </div>
          </div>

          {/* Info Rows */}
          <div className="space-y-0 divide-y divide-white/5">
            <InfoRow icon={<User className="h-4 w-4" />} label="Full Name" value={user.name} />
            <InfoRow icon={<Mail className="h-4 w-4" />} label="Email Address" value={user.email} />
            <InfoRow icon={<Shield className="h-4 w-4" />} label="Account Role" value={user.role === "ADMIN" ? "Administrator" : "Standard User"} />
            <InfoRow icon={<Phone className="h-4 w-4" />} label="Phone" value={user.phone || "Not provided"} />
            <InfoRow icon={<Calendar className="h-4 w-4" />} label="User ID" value={user.id.slice(0, 8) + "…"} />
          </div>
        </div>

        {/* ── Quick Actions ──────────────────────────────────── */}
        <div className="rounded-2xl bg-surface-800 border border-white/8 overflow-hidden">
          <div className="px-6 py-4 border-b border-white/5">
            <h3 className="text-sm font-semibold text-white">Quick Actions</h3>
          </div>
          <Link href="/bookings" className="flex items-center justify-between px-6 py-4 hover:bg-surface-700 transition group">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-brand-500/15 flex items-center justify-center">
                <Ticket className="h-4 w-4 text-brand-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">My Bookings</p>
                <p className="text-xs text-slate-500">View all your ticket bookings</p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-slate-500 group-hover:text-white transition" />
          </Link>
          {user.role === "ADMIN" && (
            <Link href="/admin" className="flex items-center justify-between px-6 py-4 hover:bg-surface-700 transition group border-t border-white/5">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-accent-500/15 flex items-center justify-center">
                  <Shield className="h-4 w-4 text-accent-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">Admin Panel</p>
                  <p className="text-xs text-slate-500">Manage movies, theaters & users</p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-500 group-hover:text-white transition" />
            </Link>
          )}
        </div>
      </motion.div>
    </div>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 py-3.5">
      <div className="text-slate-500 shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] text-slate-500 uppercase tracking-wider">{label}</p>
        <p className="text-sm text-white font-medium truncate">{value}</p>
      </div>
    </div>
  );
}
