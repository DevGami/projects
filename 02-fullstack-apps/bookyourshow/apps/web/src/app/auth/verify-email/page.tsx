"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Mail, ShieldCheck, RefreshCw, Film } from "lucide-react";
import toast from "react-hot-toast";
import { api, ApiError } from "@/lib/api";
import { useAuthStore } from "@/stores/auth.store";
import { Button } from "@/components/ui/Button";

// ═══════════════════════════════════════════════════════════════════════════
export default function VerifyEmailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email") || "";
  const setUser = useAuthStore((s) => s.setUser);
  
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Auto-focus first input
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  // Cooldown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => c - 1), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  function handleChange(index: number, value: string) {
    if (!/^\d*$/.test(value)) return; // only digits
    const newOtp = [...otp];
    newOtp[index] = value.slice(-1); // only last char
    setOtp(newOtp);

    // Auto-advance to next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all filled
    if (newOtp.every((d) => d !== "")) {
      submitOtp(newOtp.join(""));
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length === 6) {
      const newOtp = pasted.split("");
      setOtp(newOtp);
      inputRefs.current[5]?.focus();
      submitOtp(pasted);
    }
  }

  async function submitOtp(code: string) {
    if (isVerifying || !email) return;
    setIsVerifying(true);
    try {
      const res = await api.post<{
        user: { id: string; name: string; email: string; role: "USER" | "ADMIN"; emailVerified: boolean };
        accessToken: string;
      }>("/auth/verify-otp", { email, otp: code });

      if (res.data) {
        // Save tokens and set user
        localStorage.setItem("bys_access_token", res.data.accessToken);
        setUser(res.data.user);
        toast.success("Email verified! Welcome to BookYourShow 🎬");
        router.push("/");
      }
    } catch (err) {
      setOtp(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
      if (err instanceof ApiError) {
        toast.error(err.message);
      } else {
        toast.error("Verification failed. Try again.");
      }
    } finally {
      setIsVerifying(false);
    }
  }

  async function resendOtp() {
    if (isResending || cooldown > 0 || !email) return;
    setIsResending(true);
    try {
      await api.post("/auth/resend-otp", { email });
      toast.success("New OTP sent! Check your email.");
      setCooldown(60);
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.message);
      } else {
        toast.error("Failed to resend OTP.");
      }
    } finally {
      setIsResending(false);
    }
  }

  if (!email) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-slate-400 mb-4">No email provided for verification.</p>
          <Button onClick={() => router.push("/auth/signup")}>Go to Sign Up</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md"
      >
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-4">
            <Film className="h-8 w-8 text-brand-400" />
            <span className="text-2xl font-bold">
              Book<span className="text-brand-400">Your</span>Show
            </span>
          </div>
          <div className="mx-auto mb-4 h-16 w-16 rounded-2xl bg-brand-500/15 flex items-center justify-center">
            <ShieldCheck className="h-8 w-8 text-brand-400" />
          </div>
          <h1 className="text-2xl font-bold text-white">Verify your email</h1>
          <p className="text-sm text-slate-400 mt-2">
            We sent a 6-digit code to
          </p>
          <p className="text-sm text-brand-300 font-medium flex items-center justify-center gap-1.5 mt-1">
            <Mail className="h-3.5 w-3.5" />
            {email}
          </p>
        </div>

        {/* OTP Card */}
        <div className="rounded-2xl bg-surface-800 border border-white/8 p-6 sm:p-8 shadow-2xl">
          {/* 6-digit input */}
          <div className="flex justify-center gap-3 mb-6" onPaste={handlePaste}>
            {otp.map((digit, i) => (
              <input
                key={i}
                ref={(el) => { inputRefs.current[i] = el; }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleChange(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                className={`w-12 h-14 sm:w-14 sm:h-16 text-center text-xl sm:text-2xl font-bold rounded-xl border transition-all focus:outline-none focus:ring-2 focus:ring-brand-500/60 ${
                  digit
                    ? "bg-brand-500/10 border-brand-500/40 text-brand-300"
                    : "bg-surface-700 border-white/10 text-white"
                }`}
              />
            ))}
          </div>

          {/* Verify button */}
          <Button
            onClick={() => submitOtp(otp.join(""))}
            isLoading={isVerifying}
            disabled={otp.some((d) => d === "")}
            className="w-full"
            size="lg"
          >
            Verify Email
          </Button>

          {/* Resend */}
          <div className="mt-5 text-center">
            <p className="text-xs text-slate-500 mb-2">Didn&apos;t receive the code?</p>
            <button
              onClick={resendOtp}
              disabled={cooldown > 0 || isResending}
              className={`inline-flex items-center gap-1.5 text-sm font-medium transition ${
                cooldown > 0
                  ? "text-slate-600 cursor-not-allowed"
                  : "text-brand-400 hover:text-brand-300 cursor-pointer"
              }`}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isResending ? "animate-spin" : ""}`} />
              {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend OTP"}
            </button>
          </div>

          {/* MailHog hint (dev only) */}
          <div className="mt-4 p-3 rounded-xl bg-amber-500/8 border border-amber-500/15">
            <p className="text-[11px] text-amber-400/80 text-center">
              📧 Dev: Check{" "}
              <a
                href="http://localhost:8025"
                target="_blank"
                rel="noreferrer"
                className="underline hover:text-amber-300"
              >
                MailHog (localhost:8025)
              </a>{" "}
              for the OTP email
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
