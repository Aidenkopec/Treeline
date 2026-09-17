import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

/**
 * Served on every route and every file in public/. No nonce: the inline RSC
 * payload would need per-request HTML, deopting the prerender, so script-src
 * bounds a compromised dependency rather than defending against XSS.
 */
export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  // 'unsafe-eval' in dev only: React reconstructs server error stacks with eval.
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  // For Next's own prerendered _global-error.html, which carries style attributes.
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self'",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "worker-src 'none'",
].join("; ");

export const SECURITY_HEADERS: { key: string; value: string }[] = [
  { key: "Content-Security-Policy", value: CONTENT_SECURITY_POLICY },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  headers: async () => [{ source: "/(.*)", headers: SECURITY_HEADERS }],
};

export default nextConfig;
