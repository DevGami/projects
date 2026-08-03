import { HTMLAttributes } from "react";

const variants = {
  default: "bg-surface-700 text-slate-300 border-white/10",
  brand: "bg-brand-500/20 text-brand-300 border-brand-500/30",
  accent: "bg-accent-500/20 text-accent-500 border-accent-500/30",
  success: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  warning: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  danger: "bg-red-500/20 text-red-400 border-red-500/30",
} as const;

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: keyof typeof variants;
}

export function Badge({
  variant = "default",
  className = "",
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={`
        inline-flex items-center gap-1 rounded-lg border px-2 py-0.5
        text-xs font-medium
        ${variants[variant]} ${className}
      `}
      {...props}
    >
      {children}
    </span>
  );
}
