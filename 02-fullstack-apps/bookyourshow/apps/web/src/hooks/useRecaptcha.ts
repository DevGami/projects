"use client";

import { useCallback, useEffect, useRef } from "react";

// ═══════════════════════════════════════════════════════════════════════════
// Google reCAPTCHA v3 — React Hook
// Invisible, score-based bot detection
// ═══════════════════════════════════════════════════════════════════════════

const RECAPTCHA_SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || "";

/**
 * Load the reCAPTCHA v3 script once globally.
 * Returns an `execute(action)` function that resolves to a token.
 *
 * If NEXT_PUBLIC_RECAPTCHA_SITE_KEY is not set, `execute()` returns `undefined`
 * (dev-friendly — backend will also skip verification).
 */
export function useRecaptcha() {
  const loadedRef = useRef(false);

  useEffect(() => {
    if (!RECAPTCHA_SITE_KEY || loadedRef.current) return;
    if (document.querySelector(`script[src*="recaptcha/api.js"]`)) {
      loadedRef.current = true;
      return;
    }

    const script = document.createElement("script");
    script.src = `https://www.google.com/recaptcha/api.js?render=${RECAPTCHA_SITE_KEY}`;
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);
    loadedRef.current = true;
  }, []);

  const execute = useCallback(
    async (action: string): Promise<string | undefined> => {
      if (!RECAPTCHA_SITE_KEY) return undefined;

      // Wait for grecaptcha to be ready
      return new Promise((resolve) => {
        const w = window as any;
        if (w.grecaptcha?.ready) {
          w.grecaptcha.ready(async () => {
            try {
              const token = await w.grecaptcha.execute(RECAPTCHA_SITE_KEY, { action });
              resolve(token);
            } catch {
              resolve(undefined);
            }
          });
        } else {
          // Script not loaded yet, retry after a delay
          setTimeout(async () => {
            try {
              if (w.grecaptcha?.execute) {
                const token = await w.grecaptcha.execute(RECAPTCHA_SITE_KEY, { action });
                resolve(token);
              } else {
                resolve(undefined);
              }
            } catch {
              resolve(undefined);
            }
          }, 1000);
        }
      });
    },
    []
  );

  return { execute, isConfigured: !!RECAPTCHA_SITE_KEY };
}
