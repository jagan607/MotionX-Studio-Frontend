/**
 * Maintenance Mode — shared constant.
 *
 * Reads the NEXT_PUBLIC_MAINTENANCE_MODE env variable once at module-load.
 * Works in both server components / middleware (Node / Edge) and client
 * components (Next.js inlines NEXT_PUBLIC_* at build time).
 *
 * Toggle via .env:  NEXT_PUBLIC_MAINTENANCE_MODE=true | false
 * Requires a server restart (or Vercel redeploy) to take effect.
 */
export const IS_MAINTENANCE_MODE =
  process.env.NEXT_PUBLIC_MAINTENANCE_MODE === "true";
