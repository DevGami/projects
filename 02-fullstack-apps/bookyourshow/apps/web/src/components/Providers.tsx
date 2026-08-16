"use client";

import { useEffect } from "react";
import { Toaster } from "react-hot-toast";
import { useAuthStore } from "@/stores/auth.store";
import { ErrorBoundary } from "@/components/ErrorBoundary";

export function Providers({ children }: { children: React.ReactNode }) {
  const hydrate = useAuthStore((s) => s.hydrate);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  return (
    <ErrorBoundary>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: "oklch(0.22 0.02 260)",
            color: "oklch(0.93 0.01 260)",
            border: "1px solid oklch(1 0 0 / 0.1)",
            borderRadius: "12px",
          },
          success: {
            iconTheme: { primary: "oklch(0.72 0.19 155)", secondary: "white" },
          },
          error: {
            iconTheme: { primary: "oklch(0.65 0.22 15)", secondary: "white" },
          },
        }}
      />
      {children}
    </ErrorBoundary>
  );
}
