import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Maintenance-mode middleware.
 *
 * When NEXT_PUBLIC_MAINTENANCE_MODE=true, any request to an authenticated
 * route is redirected to the landing page ("/").
 *
 * Allowed during maintenance:
 *   /              — landing page (with disabled CTAs + banner)
 *   /pricing       — informational only
 *   /explore       — public gallery (CTAs disabled in-page)
 *   /showcase      — public showcase
 *   /api/*         — API routes (webhooks, etc.)
 *   /_next/*       — static assets
 *   /favicon.ico
 *
 * Blocked during maintenance (redirected to /):
 *   /login, /dashboard, /project/*, /playground,
 *   /onboarding, /profile, /admin, /series/*
 */

const MAINTENANCE_MODE = process.env.NEXT_PUBLIC_MAINTENANCE_MODE === "true";

const PROTECTED_PREFIXES = [
  "/login",
  "/dashboard",
  "/project",
  "/playground",
  "/onboarding",
  "/profile",
  "/admin",
  "/series",
];

export function middleware(request: NextRequest) {
  if (!MAINTENANCE_MODE) return NextResponse.next();

  const { pathname } = request.nextUrl;

  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix + "/")
  );

  if (isProtected) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Run on all page routes, skip Next.js internals + static assets + API routes.
     * Regex: match everything except paths starting with _next/static, _next/image,
     * favicon.ico, or api/.
     */
    "/((?!_next/static|_next/image|favicon.ico|api/).*)",
  ],
};
