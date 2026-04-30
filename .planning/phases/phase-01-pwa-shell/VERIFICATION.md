# Phase 1 PWA Shell — Verification Report

**Date:** 2026-04-30
**Branch:** feat/mobile-shell
**QA Agent:** qa

---

## Code Review Summary (Tasks #2–#6)

All 5 implementation tasks reviewed and approved. Architecture went through one mid-phase refactor (Lead decision: routes moved from `app/m/*` multi-root to `app/(app)/m/*` to inherit providers).

| Task | Status | Notes |
|------|--------|-------|
| #2 Tailwind breakpoints | APPROVED | sm/md/lg/xl/2xl added, all 7 existing custom breakpoints preserved |
| #3 PWA Manifest + Icons | APPROVED | 4 icons (incl. maskable), scope/id/lang/dir added, manifest correct |
| #4 Mobile Routes (app)/m/* | APPROVED | redirect + 3 placeholder pages under (app)/m/, URL-transparent |
| #5 MobileShell + BottomNav | APPROVED | md:hidden, safe-area padding, usePathname active-tab, KI-banner slot |
| #6 Viewport/env/CLAUDE.md | APPROVED | viewport in (app)/layout.tsx, iOS meta tags, 2 env vars, CLAUDE.md corrected |

**Bugs found and fixed during review:**
1. `m/layout.tsx` (original multi-root variant) was missing `<html>/<body>` shell and `global.scss` import — resolved by Lead refactoring routes under `(app)/m/`
2. `MobileShell.tsx` `pb-16` on `<main>` not accounting for `env(safe-area-inset-bottom)` — fixed to `calc(64px + env(safe-area-inset-bottom))`

**Acknowledged minor (non-blocking):** `useSWR('/user/self')` called directly in `(app)/m/layout.tsx` component body instead of a dedicated hook. Identical pattern exists in `layout.component.tsx:61` — existing codebase inconsistency, not a new violation. Extract to `useUserSelf()` hook in Phase 2.

---

## Final Architecture (Phase 1)

```
apps/frontend/src/app/
├── (app)/
│   ├── layout.tsx          ← Root: html/body, font, Sentry, Plausible, PHProvider,
│   │                          VariableContextComponent, viewport export, iOS meta tags
│   ├── (site)/...          ← Desktop routes (unchanged)
│   └── m/
│       ├── layout.tsx      ← Client Component: ContextWrapper + MantineWrapper +
│       │                      Toaster + CheckPayment + PreConditionComponent + MobileShell
│       ├── page.tsx        ← redirect('/m/kalender')
│       ├── kalender/page.tsx
│       ├── vorschlaege/page.tsx
│       └── mehr/page.tsx
├── manifest.ts             ← PWA manifest (start_url=/m/kalender, scope=/m/)
└── sw.ts                   ← Serwist service worker (via @serwist/next in next.config.js)

apps/frontend/public/icons/pwa/
├── icon-192.png            ← 192×192 PNG
├── icon-512.png            ← 512×512 PNG (any)
├── icon-512-maskable.png   ← 512×512 PNG (maskable)
└── apple-touch-icon.png    ← 180×180 PNG

apps/frontend/src/components/mobile/
├── MobileShell.tsx         ← header (sticky, KI-banner slot, headerRight) + main + BottomNav
└── BottomNav.tsx           ← md:hidden, 3 tabs, usePathname active, badge slot
```

---

## Playwright Test Suite

**File:** `apps/frontend/tests/mobile-shell.spec.ts`
**Config:** `apps/frontend/playwright.config.ts`
**Tests:** 12 test cases × 2 browser projects = 24 total
**Playwright:** 1.59.1 (installed as devDependency in apps/frontend/package.json)

### Run command (requires `pnpm dev` on localhost:4200 with configured .env):
```bash
pnpm exec playwright test --config apps/frontend/playwright.config.ts
```

### Auth note
`(app)/m/layout.tsx` fetches `/user/self` before rendering — unauthenticated requests redirect to login. Tests AC2–AC5 use `test.skip()` when the session is unauthenticated. AC1, AC4 (scroll check only), AC6–AC10 work without auth.

For full authenticated test run, set a valid session cookie in `playwright.config.ts`:
```ts
use: {
  storageState: 'tests/auth.json',  // created via: playwright codegen --save-storage=tests/auth.json
}
```

### Tests per Acceptance Criterion

| AC | Test | Automatable | Auth required |
|----|------|-------------|---------------|
| AC1 | /m → redirect to /m/kalender | YES | No |
| AC2 | /m/kalender shows BottomNav + header | YES | Yes (skips if unauthed) |
| AC3 | Tab nav: URL change + active class | YES | Yes (skips if unauthed) |
| AC4 | iPhone 14 Pro: no horizontal scroll | YES | No (scroll check works pre-render) |
| AC5 | Desktop 1920px: BottomNav hidden | YES | Yes (skips if unauthed) |
| AC6 | /launches renders after Tailwind change | YES | No (accepts auth redirect) |
| AC7 | sm/md/lg breakpoints change color | YES | No (injects test element) |
| AC8 | /manifest.webmanifest valid JSON + fields | YES | No |
| AC9 | /icons/pwa/icon-192.png HTTP 200 PNG | YES | No |
| AC10 | viewport meta width=device-width | YES | No |

---

## Manual Tests Required for Lukas

### M1 — iPhone Safari "Add to Home Screen" (PWA Install)

**Requires:** iOS device + HTTPS URL (ngrok or deploy)

1. `pnpm dev` locally + `ngrok http 4200`, OR deploy to `socialmedia.wawihub.de`
2. Open **Safari** on iPhone (not Chrome — Chrome on iOS cannot install PWAs)
3. Navigate to `https://<url>/m/kalender`, log in
4. Tap Share button → "Add to Home Screen"

**Expected:**
- Icon shows (placeholder for now)
- App name: "Husatech Social"
- Opens without Safari URL bar (standalone mode)
- Status bar: dark (`black-translucent` + `#0a0a0a` theme)

### M2 — Lighthouse PWA Audit

**Requires:** Chrome DevTools, HTTPS URL

1. Open `https://<url>/m/kalender` in Chrome
2. DevTools → Lighthouse → check "Progressive Web App" → Analyze
3. Verify: "Installable" criterion passes

**Note:** Service worker IS included (Serwist, `disable: process.env.NODE_ENV === 'development'`). Test on the HTTPS production/ngrok URL, not on localhost (SW is disabled in dev mode).

---

## Known Issues (Minor — Non-Blocking)

| # | Issue | Accepted? |
|---|-------|-----------|
| 1 | `useSWR('/user/self')` in `(app)/m/layout.tsx` body instead of own hook | Yes — matches existing desktop pattern. Fix in Phase 2. |
| 2 | `Plus_Jakarta_Sans` font not loaded in mobile layout (inherited but font weight/style not re-specified) | Yes — font is loaded via `(app)/layout.tsx`, applies globally. No visible regression. |
| 3 | No LayoutContext (CopilotKit etc.) in mobile — intentional | Yes — mobile does not use CopilotKit. By design. |
| 4 | Serwist SW disabled in dev (`disable: NODE_ENV === 'development'`) | Yes — per standard practice. Test on prod/HTTPS. |
