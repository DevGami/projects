import { HTMLAttributes } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  hover?: boolean;
  glass?: boolean;
}

export function Card({
  hover = false,
  glass = false,
  className = "",
  children,
  ...props
}: CardProps) {
  return (
    <div
      className={`
        rounded-2xl border border-white/8 overflow-hidden
        ${glass
          ? "bg-surface-800/50 backdrop-blur-md"
          : "bg-surface-800"
        }
        ${hover
          ? "transition-all duration-300 hover:border-brand-500/30 hover:shadow-xl hover:shadow-brand-500/5 hover:-translate-y-0.5"
          : ""
        }
        ${className}
      `}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardContent({
  className = "",
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`p-4 sm:p-5 ${className}`} {...props}>
      {children}
    </div>
  );
}
