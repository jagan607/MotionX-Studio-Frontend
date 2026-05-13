# CLAUDE.md — MotionX Studio Frontend: Rules for AI Agents

> **Last Audited:** May 2026 · **Audited By:** Principal Frontend Architect
> **Purpose:** This file governs how autonomous AI agents (Cursor, Copilot, Gemini Code Assist, Claude, etc.) interact with this codebase. Violations of these rules can cause **payment failures**, **broken auth flows**, **WebSocket session leaks**, or **data loss**.

---

## 🏛 Architecture Overview

MotionX Studio Frontend is a **Next.js 16** application (App Router) using **React 19**, **Tailwind CSS v4**, and **Firebase** (Auth + Firestore + Storage). State management is via **React Context API** — no Redux or Zustand. Real-time updates use **Firestore `onSnapshot`** listeners (40+ across the codebase).

```
┌──────────────────────────────────────────────────────────────┐
│                    Next.js App Router                         │
│  layout.tsx → AuthProvider → WorkspaceProvider →             │
│  CreditsProvider → GlobalHeader + GlobalSidebar + main       │
├────────┬──────────┬───────────┬──────────┬──────────┬────────┤
│ Pricing│ Payment  │ Voice     │ Studio   │ Postprod │ Play-  │
│ Page   │ Hook     │ Director  │ Board    │ Timeline │ ground │
│        │(Razorpay)│(WebSocket)│(Firestore│(FFmpeg)  │(B2C)   │
│        │          │           │ RT sync) │          │        │
└────────┴──────────┴───────────┴──────────┴──────────┴────────┘
       ↕                 ↕              ↕
   Razorpay JS      Backend WS     Firestore onSnapshot
```

**Key Dependencies:** Firebase v12 (Auth, Firestore, Storage), Razorpay Checkout JS, Framer Motion, @dnd-kit (drag & drop), @react-three/fiber (3D camera gizmo), react-timeline-editor, wavesurfer.js, Axios.

**Backend API:** All API calls go through `lib/api.ts` → Axios instance with Firebase JWT interceptor + `X-Org-Id` header injection from `WorkspaceContext`.

---

## 🚨 TIER 0 — NEVER MODIFY WITHOUT EXPLICIT HUMAN SIGN-OFF

These files handle **real money**, **authentication boundaries**, or **secret credentials**. A single bug here causes **payment failures**, **unauthorized access**, or **credential exposure**.

| File | Lines | Risk | Why |
|------|-------|------|-----|
| `.env` | 28 | 🔑 **Secrets** | Contains live Razorpay secrets, Firebase service account private key, webhook secrets, and ngrok auth token. **NEVER read, log, copy, or echo values from this file.** |
| `lib/payment.ts` | 194 | 💸 **Financial** | Razorpay Checkout integration: `subscribe()`, `buyCredits()`, `cancelSubscription()`. Handles `razorpay_signature` verification flow. Breaking the handler chain = users charged but not credited. |
| `app/pricing/page.tsx` | 307 | 💸 **Financial** | Pricing table with `PRICING_MAP` (USD/INR amounts), plan weights, upgrade/downgrade flow. Wrong price = users billed incorrectly. |
| `app/admin/layout.tsx` | 65 | 🔑 **Auth** | Server-side admin route guard: session cookie verification + `ALLOWED_ADMINS` email allowlist. Bypassing this = unauthorized access to admin dashboard (user data, financial stats). |
| `app/api/auth/login/route.ts` | 27 | 🔑 **Auth** | Creates HttpOnly session cookies from Firebase ID tokens. Breaking this = admin routes become inaccessible or, worse, unprotected. |
| `lib/firebase-admin.ts` | 80 | 🔑 **Auth** | Firebase Admin SDK initialization with service account credentials. Lazy-init via Proxy pattern. Breaking initialization = all server-side auth (admin layout, session cookies) fails silently. |

### Rules for Tier 0:
1. **NO autonomous edits.** Every change requires human code review.
2. **NEVER read or log** the contents of `.env` in any tool output, commit message, or artifact.
3. **NEVER modify `PRICING_MAP`** values or `PLAN_WEIGHT` ordering without business approval.
4. **NEVER remove or weaken** the `ALLOWED_ADMINS` check or session cookie verification.
5. **NEVER change** the Razorpay `handler` callback chain (`subscribe` → `verify-subscription` → `onSuccess`). The order is critical for payment atomicity.
6. **NEVER add `SameSite: None`** to the session cookie without understanding CSRF implications.

---

## 🔴 TIER 1 — CRITICAL SYSTEMS (Human Review Required)

These files contain deeply nested async logic, real-time WebSocket connections, complex state machines, or core context providers that the entire app depends on. **A single misplaced `useEffect` dependency or broken `onSnapshot` teardown can crash the entire application.**

### Authentication & Context Providers

| File | Lines | Description |
|------|-------|-------------|
| `components/AuthProvider.tsx` | 104 | Firebase `onAuthStateChanged` → session cookie sync → route guards. The `isRefreshingSession` ref prevents concurrent refresh races. **The comment on line 26 is load-bearing**: all DB provisioning happens in `login/page.tsx`, NOT here. |
| `hooks/useCredits.tsx` | 147 | **Single** Firestore `onSnapshot` listener for credit balance (personal OR enterprise wallet). Shared via Context to eliminate per-component listener duplication. The `unsubRef` teardown pattern prevents the Suspense-boundary race condition. |
| `app/context/WorkspaceContext.tsx` | 141 | Org switching with module-level `_activeWorkspaceSlug` getter for the Axios interceptor. The `getActiveWorkspaceSlug()` export is consumed by `lib/api.ts` outside React — **do not convert to a hook**. |
| `app/layout.tsx` | 259 | Root layout: Provider hierarchy (`MediaViewer → Auth → Workspace → Credits`), Razorpay `<Script>` tag, VoiceDirector mount, maintenance banner. **Provider order matters** — Credits depends on Workspace. |

**Critical patterns:**
- `CreditsProvider` uses `onAuthStateChanged` → `onSnapshot` chaining with proper teardown via `unsubRef`. Breaking the teardown = memory leaks + stale credit display.
- `WorkspaceContext` syncs a **module-level variable** (`_activeWorkspaceSlug`) for use in the Axios interceptor (non-React code). This is intentional — don't "fix" it into a hook.
- `AuthProvider` intentionally does NOT write to Firestore. The comment on line 24-26 explains why.

### Voice Director (WebSocket + DOM Automation)

| File | Lines | Description |
|------|-------|-------------|
| `components/VoiceDirector/useVoiceDirector.ts` | 820 | WebSocket lifecycle, PCM16 audio capture via `ScriptProcessorNode`, base64 encoding, playback queue, barge-in (interrupt), reconnection with exponential backoff, DOM scraping for context awareness, navigation-triggered context updates. |
| `components/VoiceDirector/VoiceDirector.tsx` | 1,347 | Action handler for AI Director tool calls: `click_element`, `type_text`, `navigate_to_page`, `create_project`, etc. DOM element finder with 6-level fallback chain. `simulateVisualClick()` with PointerEvent dispatch for canvas nodes. |
| `components/VoiceDirector/DirectorPanel.tsx` | 796 | Chat UI panel with message history, voice controls, text input, voice selection. |

**Critical patterns:**
- `useVoiceDirector` manages 8+ refs for WebSocket, AudioContext, MediaStream, and ScriptProcessorNode. The cleanup in the unmount effect (line 505-514) is essential — removing it leaks audio streams and WebSocket connections.
- The `scrapePageContext()` function (line 518-739) reads `data-*` attributes from the DOM to give the AI "vision". Components throughout the app use `data-agent`, `data-node-type`, `data-shot-id`, etc. **Do not remove these data attributes** — they are the AI Director's eyes.
- `VoiceDirector.tsx` plan-gates voice access: `isVoiceEnabled` checks `plan === "pro" || "studio" || "enterprise"` or `isEnterprise`. Removing this gate = free users get unlimited voice sessions (costs money per session).
- The `findElement()` function (line 208-343) has a 6-level fallback chain for DOM element resolution. The order is intentional and calibrated for real-world agent behavior.
- `ACTION_COOLDOWN_MS` (300ms) prevents rapid-fire tool calls. Don't remove or reduce it.

### Shot Manager (Storyboard State Machine)

| File | Lines | Description |
|------|-------|-------------|
| `app/hooks/useShotManager.ts` | 270 | Orchestrator: composes 7 sub-hooks, manages real-time Firestore sync (shots + scene doc), auto-direct status state machine, error toast deduplication. |
| `app/hooks/shot-manager/useShotVideoGen.ts` | ~230 | Video animation dispatch (Kling, Seedance, etc.) |
| `app/hooks/shot-manager/useShotImageGen.ts` | ~180 | Image generation dispatch with credit gating |
| `app/hooks/shot-manager/useShotBatch.ts` | ~100 | Batch "Render All" with sequential generation |

**Critical patterns:**
- `useShotManager` has TWO `onSnapshot` listeners: one on the shots collection, one on the scene document. Both have teardown. The scene doc listener drives `isAutoDirecting` state and `terminalLog`.
- The `auto_direct_status` state machine (`processing` → `complete` | `failed`) is authoritative — it comes from the backend worker via Firestore. The `setIsAutoDirecting` optimistic setter is a UX bridge only.
- `failedToastedIds` ref prevents duplicate error toasts on re-renders. Don't "simplify" this into state.
- `autoDirectCompleteToasted` ref is keyed by `${sceneId}_complete` to prevent re-toasting when switching scenes.

### Centralized API Client

| File | Lines | Description |
|------|-------|-------------|
| `lib/api.ts` | 1,097 | Axios instance with Firebase JWT interceptor, `X-Org-Id` header injection, 80+ API helper functions, dashboard project cache with TTL. |

**Critical patterns:**
- The request interceptor (line 18-37) injects `Authorization: Bearer <token>` and `X-Org-Id` headers. Removing either breaks authentication or workspace scoping.
- The interceptor calls `getActiveWorkspaceSlug()` from `WorkspaceContext` — this is the module-level getter pattern. Don't refactor this to use React hooks.
- `FormData` requests delete `Content-Type` header (line 31-33) to let the browser set the multipart boundary. Don't "fix" this.
- `projectCache` (line 214-219) has a 5-minute TTL. `invalidateDashboardCache()` must be called after project creation/deletion.

### Rules for Tier 1:
1. **Never modify `onSnapshot` teardown patterns** — they prevent memory leaks and stale state.
2. **Never remove `data-*` attributes** from UI components — they're consumed by the Voice Director's DOM scraper.
3. **Never change the Provider hierarchy** in `layout.tsx` without understanding dependency order.
4. **Never convert `getActiveWorkspaceSlug()`** to a hook — it's intentionally module-level for the Axios interceptor.
5. **Never remove `isRefreshingSession` guard** in AuthProvider — it prevents concurrent session cookie refreshes.
6. **Preserve the `failedToastedIds` and `autoDirectCompleteToasted` dedup patterns** in `useShotManager`.

---

## 🟡 TIER 2 — HIGH-SENSITIVITY MODULES (Careful Modification)

### Storyboard Editor Components (Complex Interactive UI)

| File | Lines | Description |
|------|-------|-------------|
| `app/components/storyboard/VideoSettingsPanel.tsx` | 2,280 | Animation provider configuration (Kling v3, Seedance 2.x, etc.). Provider-specific parameter forms, duration/quality selectors, cost preflight. **Largest component in the codebase.** |
| `app/components/storyboard/StoryboardOverlay.tsx` | 1,380 | Main storyboard UI: scene navigation, shot grid, contextual panels. Real-time Firestore sync on scene doc. |
| `app/components/storyboard/SetDesignPanel.tsx` | 968 | Set design generation/editing with inpainting, 360° expansion, angle retry. |
| `app/components/storyboard/SortableShotCard.tsx` | 734 | Individual shot card with drag-and-drop (@dnd-kit), image/video display, status indicators, context menu. |
| `app/components/storyboard/ShotEditorPanel.tsx` | 767 | Shot prompt editing, reference image upload, camera transform controls. |
| `app/components/storyboard/ImageConfigurationModal.tsx` | 669 | Image generation modal: provider selection (Gemini/Seedream/Luma), reference image handling, model tier selection. |
| `app/components/storyboard/LipSyncModal.tsx` | 600 | Lip sync configuration and dispatch. |
| `app/components/storyboard/WardrobePanel.tsx` | 673 | Character wardrobe generation and editing. |
| `app/components/storyboard/CinematographyPanel.tsx` | 464 | Scene mood/cinematography controls (color palette, lighting, style reference). |

**Rules:**
- These components are tightly coupled to the `useShotManager` hook and Firestore document structure. Changing field names (e.g., `image_url`, `video_url`, `status`) requires coordinating with the backend.
- `VideoSettingsPanel` contains provider-specific logic for 5+ video providers. Each provider has different parameter sets — don't try to "unify" them.
- `SortableShotCard` renders differently based on `shot.status` (draft, generating, rendered, animating, video_ready, failed, etc.). The status strings come from the backend — don't rename them.

### Post-Production Editor

| File | Lines | Description |
|------|-------|-------------|
| `app/project/[id]/postprod/page.tsx` | 1,676 | Post-production page: timeline editor, shot inspector, export panel. Uses `@xzdarcy/react-timeline-editor` and `wavesurfer.js`. |
| `components/studio/postprod/Timeline.tsx` | 1,042 | Timeline component with track management, clip positioning, transitions. |
| `components/studio/postprod/ShotInspector.tsx` | 862 | Shot detail panel in postprod (AI editing tools). |
| `components/studio/postprod/ExportPanel.tsx` | ~300 | Export configuration with Firestore polling for render status. |
| `components/studio/postprod/VideoEditOverlay.tsx` | ~500 | In-browser video editing overlay. |

**Rules:**
- The timeline editor uses `@xzdarcy/react-timeline-editor` which has specific data format requirements. Don't change the track/clip data shape without testing.
- `ExportPanel` has its own `onSnapshot` listener for render job status — don't merge it into another listener.

### Preproduction Canvas

| File | Lines | Description |
|------|-------|-------------|
| `app/project/[id]/preproduction/page.tsx` | 1,455 | Canvas-based preproduction view with characters, locations, scenes. |
| `preproduction/components/CanvasNode.tsx` | 375 | Individual canvas node (uses PointerEvent, not click). |
| `preproduction/components/CanvasEngine.tsx` | 289 | Canvas layout engine with positioning logic. |

**Rules:**
- `CanvasNode` uses `pointerdown` → `pointerup` events (not `click`). The Voice Director's `simulateVisualClick()` dispatches `PointerEvent` specifically for these nodes. Don't change the event model.

### Playground (B2C)

| File | Lines | Description |
|------|-------|-------------|
| `app/context/PlaygroundContext.tsx` | 428 | Asset management, real-time generations via Firestore, style preferences with localStorage persistence, mention items derivation. |
| `components/playground/PlaygroundPromptBar.tsx` | 1,240 | Prompt input with @mention system, template picker, video settings. |
| `lib/playgroundApi.ts` | ~260 | Playground-specific API helpers (CRUD for assets, generations). |

### Credit Display & Gating

| File | Lines | Description |
|------|-------|-------------|
| `components/ui/CreditCTA.tsx` | ~120 | Credit top-up call-to-action component. |
| `components/CreditBadge.tsx` | ~60 | Credit balance badge in header. |
| `app/components/LowCreditBanner.tsx` | ~140 | Low credit warning banner. |
| `app/hooks/usePricing.tsx` | ~400 | Pricing configuration hook with credit cost calculations. |

**Rules:**
- Credit display reads from `useCredits()` context — never create a parallel Firestore listener for credits.
- `usePricing` contains credit cost formulas. Changing costs here without updating the backend `pricing.py` = display/charge mismatch.

### Director Chat (Text-only Agent)

| File | Lines | Description |
|------|-------|-------------|
| `components/DirectorChat.tsx` | 825 | Text-based AI chat interface (alternative to voice). |

---

## 🟢 TIER 3 — STANDARD MODULES (Normal Development)

These modules follow standard patterns and are safe for autonomous modification with standard testing:

| Module | Files | Notes |
|--------|-------|-------|
| **Landing Page** | `app/page.tsx` (1,543 lines) | Marketing page. Large but static — safe to edit for copy/design changes. |
| **Dashboard** | `app/dashboard/page.tsx` | Project list, announcements. Uses `fetchUserProjectsBasic()` from api.ts. |
| **Login** | `app/login/page.tsx` | Google OAuth flow. Handles user provisioning on first sign-in. |
| **Onboarding** | `app/onboarding/page.tsx` | New user onboarding wizard. |
| **Profile** | `app/profile/` | User profile, subscription management, org settings. |
| **Explore / Showcase** | `app/explore/`, `app/showcase/` | Public gallery pages. |
| **Share** | `app/share/[id]/page.tsx` | Public project sharing page. |
| **Library** | `app/library/page.tsx` | User's media library. |
| **Admin Pages** | `app/admin/page.tsx`, subpages | Admin dashboard content (NOT the layout — that's Tier 0). |
| **UI Primitives** | `components/ui/` | MotionButton, MotionInput, Tooltip, TokenIcon, StudioLayout. |
| **Global Navigation** | `components/GlobalHeader.tsx`, `GlobalSidebar.tsx` | Header and sidebar. Consume `useCredits()` and `useWorkspace()`. |
| **Tour System** | `components/tour/`, `hooks/useTour.ts`, `lib/tourConfigs.ts` | Product tour. |
| **Templates** | `lib/templates.ts`, `lib/klingTemplates.ts`, `lib/playgroundTemplates.ts` | Static template data. |
| **Types** | `lib/types.ts`, `lib/types/` | TypeScript type definitions. |
| **Error Handling** | `lib/apiErrors.ts`, `lib/errorDictionary.ts` | Error message mapping. |

---

## 🎨 Styling & Component Rules

### Technology Stack
- **Tailwind CSS v4** (`@import "tailwindcss"` in `globals.css`)
- **Design tokens** in `:root` CSS custom properties (`--bg-base`, `--accent-red`, etc.)
- **Custom theme** in `tailwind.config.ts` with `motion.*` namespace
- **Fonts:** Inter (body), Anton (headings), Roboto Mono (monospace) — loaded via `next/font/google`
- **Animations:** Framer Motion for component transitions, CSS `@keyframes` for utility effects

### Anti-Patterns (AVOID)
1. **Do NOT use raw `<style>` tags** in components. Use Tailwind utility classes or `globals.css`. (Minor existing violations in `AuthProvider.tsx` and `VoiceDirector.tsx` are grandfathered.)
2. **Do NOT create inline `style={{ }}` objects** for colors or spacing. Use Tailwind or design tokens.
3. **Do NOT use `#E50914`** — the brand red is `#D40A12` (`--accent-red`). The old `#E50914` exists in `tailwind.config.ts` as `motion.red` but the CSS tokens use `#D40A12`.
4. **Do NOT import CSS files** per-component. All global styles go in `globals.css`.
5. **Do NOT add new fonts** without updating `layout.tsx` (next/font/google) and `globals.css`.

### Approved Patterns
- Use `className="..."` with Tailwind utilities for all styling
- Use design tokens: `bg-[var(--bg-surface)]`, `text-[var(--accent-red)]`
- Use the `glass-panel` utility class for glassmorphism panels
- Use `skeleton-shimmer` class for loading states
- Use Framer Motion `<motion.div>` for enter/exit animations
- Use `lucide-react` icons (re-exported from `lib/lucide.ts` for tree-shaking)

---

## ⚙️ Infrastructure Rules

### Firestore Collections (Read by Frontend)
```
users/{uid}                     — credits, plan, credits_expire_at
users/{uid}/subscription        — Active subscription status
organizations/{slug}            — credits_balance (enterprise wallet)
projects/{id}                   — Project metadata, script_status, type
projects/{id}/episodes/{id}     — Episode data
  /scenes/{id}                  — Scene data, ai_logs, auto_direct_status
    /shots/{id}                 — Shot data (image_url, video_url, status, etc.)
projects/{id}/characters/{id}   — Character assets
projects/{id}/locations/{id}    — Location assets
playgrounds/{uid}/generations   — B2C playground generations (real-time)
announcements                   — Dashboard announcements
active_sessions/{uid}           — Heartbeat for admin dashboard
```

**Rules:**
- **NEVER rename Firestore field names** (`image_url`, `video_url`, `status`, `credits`, `plan`, `auto_direct_status`) without coordinating with the backend.
- **The `credits` field** is a display total — the backend's source of truth is `subscription_credits + topup_credits`.
- **`auto_direct_status`** drives the storyboard loading UI — its values (`processing`, `complete`, `failed`) are set by the backend worker.

### Environment Variables
```
NEXT_PUBLIC_API_BASE_URL        — Backend API endpoint
NEXT_PUBLIC_RAZORPAY_KEY_ID     — Razorpay public key (safe for client)
NEXT_PUBLIC_MAINTENANCE_MODE    — Maintenance mode toggle
RAZORPAY_KEY_SECRET             — ⚠️ Server-side only (webhook verification)
RAZORPAY_WEBHOOK_SECRET         — ⚠️ Server-side only
FIREBASE_PROJECT_ID             — Firebase Admin SDK
FIREBASE_CLIENT_EMAIL           — Firebase Admin SDK
FIREBASE_PRIVATE_KEY            — ⚠️ Full RSA private key
```
**NEVER expose non-`NEXT_PUBLIC_*` variables to client components.** Next.js only bundles `NEXT_PUBLIC_*` prefixed vars into the client build.

### Middleware
- `middleware.ts` handles **maintenance mode only** — not authentication.
- Auth gating is client-side via `AuthProvider.tsx`.
- Admin route protection is server-side via `app/admin/layout.tsx` (session cookie + allowlist).

---

## 🧹 Housekeeping Notes

### Debug Files (Safe to Delete)
These files in the project root are leftover debug scripts and should be cleaned up:
- `check_db.js`, `check_db2.js`, `check_db3.js`, `check_db4.js`
- `check_ep_moods.js`, `check_eps.js`, `check_succ.js`
- `test_context.py`, `1python3`
- `email-template.html`

### Known Technical Debt
1. **Brand color inconsistency:** `#D40A12` (CSS tokens) vs `#E50914` (Tailwind config `motion.red`). Should be unified.
2. **No middleware-level auth:** Protected routes rely on client-side `AuthProvider` redirect, causing brief flash on slow connections.
3. **`firebase.json` and `firestore.indexes.json`** exist but appear minimal/unused — verify if Firebase Hosting is actually used.

---

## 🧪 Testing & Validation

### Before Merging Any Change:
1. **Run locally:** `npm run dev` (Next.js dev server on port 3000)
2. **Build check:** `npm run build` — catches TypeScript errors and missing imports
3. **Run tests:** `npm test` (Jest + React Testing Library)
4. **Verify credit display:** Any change to `useCredits`, `CreditsProvider`, or credit-related components must be tested with a logged-in user.
5. **Test Voice Director:** After modifying any component with `data-agent` or `data-node-*` attributes, verify the Voice Director can still find and interact with them.

### Common Pitfalls:
- **Suspense boundaries:** `GlobalHeader` and `GlobalSidebar` are wrapped in `<Suspense>`. Don't add hooks that throw promises outside these boundaries.
- **`"use client"` directive:** Context providers and hooks must have `"use client"` at the top. Server Components cannot use hooks.
- **Firestore listener cleanup:** Every `onSnapshot` call must have a corresponding `unsubscribe()` in the cleanup function.
- **FormData Content-Type:** The Axios interceptor deletes `Content-Type` for FormData requests. Don't add it back.
- **AudioContext lifecycle:** `useVoiceDirector` creates/closes AudioContext instances. The browser limits concurrent AudioContexts — always close them in cleanup.

---

## 📁 File Size Reference (Lines of Code)

| File | Lines | Tier |
|------|-------|------|
| `app/components/storyboard/VideoSettingsPanel.tsx` | 2,280 | 🟡 T2 |
| `app/project/[id]/postprod/page.tsx` | 1,676 | 🟡 T2 |
| `app/page.tsx` (Landing) | 1,543 | 🟢 T3 |
| `app/project/[id]/preproduction/page.tsx` | 1,455 | 🟡 T2 |
| `app/components/storyboard/StoryboardOverlay.tsx` | 1,380 | 🟡 T2 |
| `components/VoiceDirector/VoiceDirector.tsx` | 1,347 | 🔴 T1 |
| `components/playground/PlaygroundPromptBar.tsx` | 1,240 | 🟡 T2 |
| `app/project/new/page.tsx` | 1,185 | 🟢 T3 |
| `lib/api.ts` | 1,097 | 🔴 T1 |
| `app/project/[id]/moodboard/page.tsx` | 1,095 | 🟡 T2 |
| `components/studio/postprod/Timeline.tsx` | 1,042 | 🟡 T2 |
| `components/studio/postprod/ShotInspector.tsx` | 862 | 🟡 T2 |
| `components/DirectorChat.tsx` | 825 | 🟡 T2 |
| `components/VoiceDirector/useVoiceDirector.ts` | 820 | 🔴 T1 |
| `components/VoiceDirector/DirectorPanel.tsx` | 796 | 🔴 T1 |
| `app/hooks/useShotManager.ts` | 270 | 🔴 T1 |
| `hooks/useCredits.tsx` | 147 | 🔴 T1 |
| `lib/payment.ts` | 194 | 🚨 T0 |
| `app/pricing/page.tsx` | 307 | 🚨 T0 |
| `app/admin/layout.tsx` | 65 | 🚨 T0 |
| `app/api/auth/login/route.ts` | 27 | 🚨 T0 |

---

## 🔒 Summary: The Three Laws of Agent Safety

1. **NEVER autonomously modify Tier 0 files.** These touch money, auth, or secrets. Always require human sign-off.
2. **NEVER remove `data-*` attributes, `onSnapshot` teardown patterns, or the Provider hierarchy** without understanding the full downstream impact (Voice Director, credit display, workspace scoping).
3. **NEVER bypass plan gates or credit checks.** Features gated behind `plan === "pro"` exist because they cost real money to operate (voice sessions, video generation, etc.).

---

*If you're an AI agent reading this: these rules are non-negotiable. When in doubt, ask the human.*
