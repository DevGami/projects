"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Loader2, CheckCircle, XCircle } from "lucide-react";
import { useAuthStore } from "@/stores/auth.store";
import { API_BASE_URL } from "@/lib/constants";

// ═══════════════════════════════════════════════════════════════════════════
// Google OAuth Callback Page — Secure Token Exchange
//
// SECURITY FIX: We no longer extract JWT tokens from URL params.
// Instead we receive a short-lived one-time code and exchange it via POST.
// This prevents tokens from appearing in browser history / server logs.
// ═══════════════════════════════════════════════════════════════════════════
export default function GoogleCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setUser = useAuthStore((s) => s.setUser);
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("Something went wrong. Please try again.");

  useEffect(() => {
    const code = searchParams.get("code");
    const error = searchParams.get("error");

    if (error || !code) {
      setErrorMsg(error === "google_failed" ? "Google sign-in failed." : "No authorization code received.");
      setStatus("error");
      setTimeout(() => router.push("/auth/login?error=google_failed"), 2500);
      return;
    }

    // Exchange the one-time code for tokens via a secure POST
    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/auth/google/exchange`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include", // Receive the HttpOnly refresh token cookie
          body: JSON.stringify({ code }),
        });

        const data = await res.json();

        if (!res.ok || !data.success) {
          throw new Error(data.error?.message || "Exchange failed");
        }

        const { accessToken, refreshToken, user } = data.data;

        // Store both tokens in localStorage (same flow as email/password login)
        // The HttpOnly cookie also holds the refresh token as a secondary safety net.
        localStorage.setItem("bys_access_token", accessToken);
        if (refreshToken) {
          localStorage.setItem("bys_refresh_token", refreshToken);
        }

        // Set user in Zustand store
        setUser({
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        });

        setStatus("success");
        // Restore redirect target (e.g. /book/showtimeId) saved before Google OAuth
        const redirectTo = sessionStorage.getItem("bys_auth_redirect") || "/";
        sessionStorage.removeItem("bys_auth_redirect");
        setTimeout(() => router.push(redirectTo), 1500);
      } catch (err) {
        console.error("Google token exchange failed:", err);
        setErrorMsg("Failed to complete sign-in. Please try again.");
        setStatus("error");
        setTimeout(() => router.push("/auth/login?error=google_failed"), 2500);
      }
    })();
  }, [searchParams, setUser, router]);

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center"
      >
        {status === "loading" && (
          <>
            <Loader2 className="h-12 w-12 text-brand-400 animate-spin mx-auto mb-4" />
            <p className="text-lg font-medium text-white">Signing you in with Google...</p>
            <p className="text-sm text-slate-400 mt-1">Please wait</p>
          </>
        )}
        {status === "success" && (
          <>
            <CheckCircle className="h-12 w-12 text-emerald-400 mx-auto mb-4" />
            <p className="text-lg font-medium text-white">Welcome to BookYourShow! 🎬</p>
            <p className="text-sm text-slate-400 mt-1">Redirecting...</p>
          </>
        )}
        {status === "error" && (
          <>
            <XCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
            <p className="text-lg font-medium text-white">Sign-in failed</p>
            <p className="text-sm text-slate-400 mt-1">{errorMsg}</p>
          </>
        )}
      </motion.div>
    </div>
  );
}
