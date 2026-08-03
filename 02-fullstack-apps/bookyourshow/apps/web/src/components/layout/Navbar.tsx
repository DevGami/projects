"use client";

import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { Search, MapPin, User, LogOut, Menu, X, Film, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuthStore } from "@/stores/auth.store";
import { useCityStore } from "@/stores/city.store";
import { CITIES, type City } from "@/lib/constants";

export function Navbar() {
  const { user, isAuthenticated, logout } = useAuthStore();
  const { city, setCity } = useCityStore();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isCityOpen, setIsCityOpen] = useState(false);
  const cityRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (cityRef.current && !cityRef.current.contains(e.target as Node)) {
        setIsCityOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setIsProfileOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <header className="sticky top-0 z-50 glass">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-4">
          {/* ── Logo ─────────────────────────────────────────── */}
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <Film className="h-7 w-7 text-brand-400" />
            <span className="text-lg font-bold tracking-tight hidden sm:block">
              Book<span className="text-brand-400">Your</span>Show
            </span>
          </Link>

          {/* ── Search (Desktop) ─────────────────────────────── */}
          <div className="hidden md:flex flex-1 max-w-md mx-4">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search for movies..."
                className="w-full rounded-xl bg-surface-800 border border-white/10 py-2 pl-10 pr-4 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500/50 transition"
              />
            </div>
          </div>

          {/* ── Right Section ────────────────────────────────── */}
          <div className="flex items-center gap-3">
            {/* City Badge (Locked to Ahmedabad) */}
            <div className="relative hidden sm:block">
              <div className="flex items-center gap-1.5 rounded-xl bg-surface-800/60 border border-white/8 px-3 py-2 text-sm font-medium text-white shadow-sm">
                <MapPin className="h-3.5 w-3.5 text-accent-500" />
                <span className="max-w-[80px] truncate">Ahmedabad</span>
              </div>
            </div>

            {/* Auth Section */}
            {isAuthenticated && user ? (
              <div className="relative" ref={profileRef}>
                <button
                  onClick={() => setIsProfileOpen(!isProfileOpen)}
                  className="flex items-center gap-2 rounded-xl bg-surface-700 px-3 py-2 text-sm font-medium text-white hover:bg-surface-600 transition"
                >
                  <div className="h-6 w-6 rounded-full bg-brand-500 flex items-center justify-center text-xs font-bold">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="hidden sm:block max-w-[100px] truncate">{user.name}</span>
                </button>

                <AnimatePresence>
                  {isProfileOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -6, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -6, scale: 0.97 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 mt-2 w-48 rounded-xl bg-surface-800/95 backdrop-blur-xl border border-white/10 py-1 shadow-2xl shadow-black/40 z-50"
                    >
                      <Link
                        href="/profile"
                        className="flex items-center gap-2 px-4 py-2.5 text-sm text-slate-300 hover:bg-surface-700 hover:text-white transition"
                        onClick={() => setIsProfileOpen(false)}
                      >
                        <User className="h-4 w-4" />
                        Profile
                      </Link>
                      <Link
                        href="/bookings"
                        className="flex items-center gap-2 px-4 py-2.5 text-sm text-slate-300 hover:bg-surface-700 hover:text-white transition"
                        onClick={() => setIsProfileOpen(false)}
                      >
                        <Film className="h-4 w-4" />
                        My Bookings
                      </Link>
                      <hr className="border-white/10 my-1" />
                      <button
                        onClick={() => {
                          logout();
                          setIsProfileOpen(false);
                        }}
                        className="flex items-center gap-2 px-4 py-2.5 text-sm text-red-400 hover:bg-surface-700 w-full transition"
                      >
                        <LogOut className="h-4 w-4" />
                        Sign Out
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <Link
                href="/auth/login"
                className="rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 transition shadow-lg shadow-brand-500/20"
              >
                Sign In
              </Link>
            )}

            {/* Mobile Menu Toggle */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-surface-700 transition"
            >
              {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* ── Mobile Menu ──────────────────────────────────────── */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="md:hidden border-t border-white/10 bg-surface-800/95 backdrop-blur-md overflow-hidden"
          >
            <div className="px-4 py-4 space-y-3">
              {/* Mobile Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search for movies..."
                  className="w-full rounded-xl bg-surface-700 border border-white/10 py-2.5 pl-10 pr-4 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 transition"
                />
              </div>

              {/* Mobile City — Grid of chips */}
              <div>
                <p className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold mb-2 px-1">
                  Select City
                </p>
                <div className="flex flex-wrap gap-2">
                  {CITIES.map((c) => (
                    <button
                      key={c}
                      onClick={() => {
                        setCity(c);
                        setIsMobileMenuOpen(false);
                      }}
                      className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
                        c === city
                          ? "bg-brand-500/20 text-brand-300 border border-brand-500/30"
                          : "bg-surface-700 text-slate-400 border border-white/5 hover:text-white hover:bg-surface-600"
                      }`}
                    >
                      <MapPin className="h-3 w-3" />
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
