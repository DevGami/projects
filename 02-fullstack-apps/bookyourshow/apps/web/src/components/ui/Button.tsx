import { ButtonHTMLAttributes, forwardRef } from "react";

// ── Variants ────────────────────────────────────────────────────────────────
const variants = {
  primary:
    "bg-brand-500 text-white hover:bg-brand-600 shadow-lg shadow-brand-500/25 active:scale-[0.98]",
  secondary:
    "bg-surface-700 text-slate-200 hover:bg-surface-600 border border-white/10 active:scale-[0.98]",
  accent:
    "bg-accent-500 text-white hover:bg-accent-600 shadow-lg shadow-accent-500/25 active:scale-[0.98]",
  ghost:
    "bg-transparent text-slate-300 hover:bg-surface-700 hover:text-white",
  danger:
    "bg-red-600 text-white hover:bg-red-700 shadow-lg shadow-red-500/20 active:scale-[0.98]",
} as const;

const sizes = {
  sm: "px-3 py-1.5 text-xs rounded-lg",
  md: "px-4 py-2.5 text-sm rounded-xl",
  lg: "px-6 py-3 text-base rounded-xl",
} as const;

// ── Types ───────────────────────────────────────────────────────────────────
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  isLoading?: boolean;
}

// ── Component ───────────────────────────────────────────────────────────────
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", isLoading, className = "", children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={`
          inline-flex items-center justify-center gap-2 font-semibold
          transition-all duration-200 ease-out
          disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none
          ${variants[variant]} ${sizes[size]} ${className}
        `}
        {...props}
      >
        {isLoading && (
          <svg
            className="animate-spin h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
