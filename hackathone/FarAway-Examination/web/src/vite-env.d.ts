/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Clerk publishable key — required, set in .env.local */
  readonly VITE_CLERK_PUBLISHABLE_KEY: string;
  /**
   * Cloud API base URL.
   * Defaults to /api/v1 (proxied by Vite dev server to http://localhost:8000).
   * Set to full URL in production: https://api.fortisexam.in/api/v1
   */
  readonly VITE_API_BASE_URL?: string;
  /**
   * Edge server API base URL (separate server, RSA JWT auth).
   * Defaults to /edge/api/v1.
   * Set to full URL when running against a real edge node.
   */
  readonly VITE_EDGE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
