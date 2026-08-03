"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "framer-motion";
import { Mail, Lock, Eye, EyeOff, Film } from "lucide-react";
import toast from "react-hot-toast";
import { useAuthStore } from "@/stores/auth.store";
import { Button } from "@/components/ui/Button";
import { ApiError } from "@/lib/api";
import { useRecaptcha } from "@/hooks/useRecaptcha";

// ── Schema ──────────────────────────────────────────────────────────────────
const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});
type LoginForm = z.infer<typeof loginSchema>;

const GOOGLE_AUTH_URL = "http://localhost:5000/api/v1/auth/google";

// ═══════════════════════════════════════════════════════════════════════════
export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const login = useAuthStore((s) => s.login);
  const [showPassword, setShowPassword] = useState(false);
  const { execute: executeRecaptcha } = useRecaptcha();

  // Show Google error if redirected back
  const googleError = searchParams.get("error");
  const redirectTo = searchParams.get("redirect") || "/";

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  async function onSubmit(data: LoginForm) {
    try {
      const captchaToken = await executeRecaptcha("login");
      await login(data.email, data.password, captchaToken);
      toast.success("Welcome back!");
      router.push(redirectTo);
    } catch (err) {
      if (err instanceof ApiError) {
        // If email not verified, redirect to verify page
        if (err.code === "EMAIL_NOT_VERIFIED") {
          toast("Please verify your email first", { icon: "📧" });
          router.push(`/auth/verify-email?email=${encodeURIComponent(data.email)}`);
          return;
        }
        toast.error(err.message);
      } else {
        toast.error("Something went wrong. Try again.");
      }
    }
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
          <h1 className="text-2xl font-bold text-white">Welcome back</h1>
          <p className="text-sm text-slate-400 mt-1">
            Sign in to book your next movie experience
          </p>
        </div>

        {/* Google Error */}
        {googleError && (
          <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400 text-center">
            Google sign-in failed. Please try again.
          </div>
        )}

        {/* Form Card */}
        <div className="rounded-2xl bg-surface-800 border border-white/8 p-6 sm:p-8 shadow-2xl">
          {/* Google Sign-In */}
          <a
            href={GOOGLE_AUTH_URL}
            onClick={() => {
              // Store redirect target so Google callback can restore it
              if (redirectTo !== "/") {
                sessionStorage.setItem("bys_auth_redirect", redirectTo);
              }
            }}
            className="flex items-center justify-center gap-3 w-full rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-gray-800 hover:bg-gray-50 transition shadow-sm active:scale-[0.98]"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Sign in with Google
          </a>

          {/* Divider */}
          <div className="flex items-center gap-3 my-5">
            <div className="h-px flex-1 bg-white/10" />
            <span className="text-xs text-slate-500 uppercase tracking-wider font-medium">or</span>
            <div className="h-px flex-1 bg-white/10" />
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {/* Email */}
            <div className="space-y-1.5">
              <label htmlFor="email" className="block text-sm font-medium text-slate-300">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <input
                  {...register("email")}
                  type="email"
                  id="email"
                  placeholder="you@example.com"
                  className={`w-full rounded-xl bg-surface-700 border py-2.5 pl-10 pr-4 text-sm text-white placeholder-slate-500 transition focus:outline-none focus:ring-2 focus:ring-brand-500/50 ${
                    errors.email ? "border-red-500/60" : "border-white/10"
                  }`}
                />
              </div>
              {errors.email && (
                <p className="text-xs text-red-400">{errors.email.message}</p>
              )}
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label htmlFor="password" className="block text-sm font-medium text-slate-300">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <input
                  {...register("password")}
                  type={showPassword ? "text" : "password"}
                  id="password"
                  placeholder="••••••••"
                  className={`w-full rounded-xl bg-surface-700 border py-2.5 pl-10 pr-10 text-sm text-white placeholder-slate-500 transition focus:outline-none focus:ring-2 focus:ring-brand-500/50 ${
                    errors.password ? "border-red-500/60" : "border-white/10"
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-xs text-red-400">{errors.password.message}</p>
              )}
            </div>

            {/* Forgot password link */}
            <div className="text-right">
              <Link
                href="/auth/forgot-password"
                className="text-xs text-slate-500 hover:text-brand-400 transition"
              >
                Forgot password?
              </Link>
            </div>

            {/* Submit */}
            <Button
              type="submit"
              isLoading={isSubmitting}
              className="w-full"
              size="lg"
            >
              Sign In
            </Button>
          </form>

          {/* Divider */}
          <div className="mt-6 text-center">
            <p className="text-sm text-slate-500">
              Don&apos;t have an account?{" "}
              <Link
                href="/auth/signup"
                className="text-brand-400 hover:text-brand-300 font-medium transition"
              >
                Create one
              </Link>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
