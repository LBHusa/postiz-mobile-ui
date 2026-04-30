# Mobile UI Feasibility — Postiz Frontend

**Repo:** `/Users/lukas/Desktop/Coding/postiz-husatech/`
**Analysis Date:** 2026-04-30
**Verdict:** **Hard rebuild, not a retrofit.** The Calendar + Add/Edit modal flow is hardcoded to desktop pixel widths with no mobile branches. Layout chrome is fixed at desktop. PWA is not present at all. Trying to bolt mobile onto the existing components is more work than building parallel mobile-only routes that share the API layer.

---

## 1. Frontend Framework

**Next.js 16.2.1 with App Router.** The CLAUDE.md at repo root says "Vite ReactJS" — that's outdated. The app actually uses Next.js (App Router). Verify by:

- `apps/frontend/package.json:7` — `"dev": "next dev -p 4200"`, `"build": "next build"`
- `apps/frontend/next.config.js` — full Next config with `withSentryConfig`, custom `headers()`, `redirects()`, `rewrites()`
- Root `package.json` enforces `"next": "16.2.1"` in pnpm overrides
- Routes live in `apps/frontend/src/app/` using App Router groups: `(app)`, `(extension)`, `(provider)`, with nested `(site)` group

**React 19.2.4** (overridden in root pnpm config).

**Path alias:** `@gitroom/frontend/...` resolves to `apps/frontend/src/...` via tsconfig. Other workspaces aliased: `@gitroom/react`, `@gitroom/helpers`, `@gitroom/nestjs-libraries`.

**Known mismatch with CLAUDE.md:** repo's CLAUDE.md tells you to look at `tailwind.config.js` — actual file is `tailwind.config.cjs`. Also says Vite — actually Next.

---

## 2. Tailwind Setup

**Version: Tailwind 3.4.17** (still v3, not v4). Confirmed in root `package.json`. Note: `@tailwindcss/postcss` v4 is also listed as dependency but unused — the active PostCSS config (`apps/frontend/postcss.config.mjs`) uses standard `tailwindcss` plugin.

**Config file:** `apps/frontend/tailwind.config.cjs`

**Key facts that hurt mobile-first work:**

1. **No standard mobile-first breakpoints.** `screens.sm/md/lg/xl` are NOT defined. Instead the codebase invented its own (lines 251-273):
   ```js
   mobile:    { raw: '(max-width: 1025px)' }   // desktop-down, NOT mobile-up
   tablet:    { raw: '(max-width: 1300px)' }
   iconBreak: { raw: '(max-width: 1560px)' }
   maxMedia:  { raw: '(max-width: 1400px)' }
   minCustom: { raw: '(min-height: 800px)' }
   custom:    { raw: '(max-height: 800px)' }
   xs:        { max: '401px' }
   ```
   These are all **max-width queries** = desktop-first. The `mobile:` prefix means "below 1025px", which is the opposite convention from Tailwind's default `sm:`/`md:` mobile-first approach. Any new mobile component you write using standard Tailwind muscle memory (`sm:`, `md:`, `lg:`) will silently do nothing.

2. **Theme uses CSS variables** for everything (`--color-primary`, `--new-bgColor`, etc.) defined in `apps/frontend/src/app/colors.scss`. Light/dark are class-toggled on `body` (`darkMode: 'class'`).

3. **CLAUDE.md notes:** `--color-custom*` variables are **deprecated**. Don't use them.

4. **Font:** `Plus_Jakarta_Sans` via `next/font/google` (`new-layout/layout.component.tsx:45`).

5. **Plugins:** `tailwind-scrollbar`, `tailwindcss-rtl`, plus custom `child` / `child-hover` variants.

**Implication for mobile-first rebuild:** You can either (a) add proper Tailwind defaults `screens: { sm: '640px', md: '768px', ... }` and risk colliding with the existing `mobile:` etc., or (b) embrace the existing `mobile:` (max-width 1025) and do desktop-first like the rest of the codebase. Recommendation: add standard `sm/md/lg` for new mobile routes only — the existing custom screens stay as they are.

---

## 3. Calendar Component — The Big One to Replace

**Files:**
- `apps/frontend/src/components/launches/calendar.tsx` — **1304 lines**, exports `DayView`, `WeekView`, `MonthView`, `ListView`, `CalendarColumn`, `CalendarItem`, `Calendar`
- `apps/frontend/src/components/launches/calendar.context.tsx` — 350 lines, SWR-based data layer
- `apps/frontend/src/components/launches/launches.component.tsx` — 604 lines, the page shell with channel sidebar
- `apps/frontend/src/components/launches/filters.tsx` — date navigation + view switcher
- `apps/frontend/src/components/launches/helpers/dnd.provider.tsx` — DnD provider
- Route: `apps/frontend/src/app/(app)/(site)/launches/page.tsx` → renders `<LaunchesComponent />`

**Date library:** **dayjs 1.11.10** with plugins `isoWeek`, `weekOfYear`, `localizedFormat`, `isSameOrAfter`, `isSameOrBefore`, plus 14 locale imports loaded eagerly at top of `calendar.tsx:18-31`. No `date-fns`.

**Data fetching:** SWR with two parallel queries — calendar view (`/posts?display=...&startDate=...&endDate=...`) and list view (`/posts/list?page=...`). See `calendar.context.tsx:200-230`. Refresh interval 1h, no focus revalidation. Posts are minified on the wire and rehydrated via `expandPosts` from `@gitroom/helpers/utils/posts.list.minify`.

**View structure (WeekView, calendar.tsx:343-414):**
```
grid [grid-template-columns:136px_repeat(7,_minmax(0,_1fr))]
24 hour rows × 7 day columns = 168 cells
```
That's 7 columns of hour slots — totally unusable on a 375px mobile screen. There's no responsive collapse, no swipe-to-scroll between days, no "agenda mode" except the existing `ListView` (calendar.tsx:492+) which is the closest thing to mobile-friendly today.

**MonthView (lines 415-491):** `grid grid-cols-7` of fixed cells — same issue, 7 columns crushed at mobile.

**Drag-and-drop:** `react-dnd` with `react-dnd-html5-backend` only (`helpers/dnd.provider.tsx:4-5`). HTML5Backend **does not work on touch devices**. To support mobile drag-drop you'd need `react-dnd-touch-backend` or `react-dnd-multi-backend`. For Lukas's "tap day → new post" Notion pattern you can skip drag entirely on mobile.

**Recommendation:** Build a fresh `MobileCalendar` component. Reuse `CalendarWeekProvider` (the SWR/context layer in `calendar.context.tsx` is solid and API-agnostic). Throw away every view component (`DayView`, `WeekView`, `MonthView`).

---

## 4. Post Detail / Add-Edit Modal

**Entry points:**
- `apps/frontend/src/components/new-launch/add.edit.modal.tsx` — 226 lines, three nested wrappers (`AddEditModal` → `AddEditModalInner` → `AddEditModalInnerInner`) hydrating zustand store from existing post data
- `apps/frontend/src/components/new-launch/manage.modal.tsx` — **704 lines**, the actual UI shell
- `apps/frontend/src/components/new-launch/editor.tsx` — **1046 lines**, Tiptap-based rich editor with media uploader, emoji picker, mentions
- `apps/frontend/src/components/new-launch/store.ts` — 654 lines, zustand store for the entire post draft state
- `apps/frontend/src/components/new-launch/picks.socials.component.tsx` — channel picker
- `apps/frontend/src/components/new-launch/select.current.tsx` — switches between global/per-channel content
- `apps/frontend/src/components/new-launch/providers/show.all.providers.tsx` — preview pane with all platform previews

**How it's opened:** The Calendar's `usePostActions` hook (`calendar.tsx:96+`) calls `modal.openModal({ fullScreen: true, removeLayout: true, classNames: { modal: 'w-[100%] max-w-[1400px]' } })`. The modal is a fullscreen takeover even on desktop, but capped at 1400px width.

**Mobile-friendliness — verdict: zero.** Hardcoded layout in `manage.modal.tsx`:
- Outer container: `p-[40px]` (40px padding burns half a mobile viewport)
- Two columns side-by-side: editor on left flexes, **preview pane is `w-[580px] flex flex-col`** (`manage.modal.tsx:535`) — fixed 580px right column never collapses
- Bottom toolbar: `h-[84px]` with date picker, tags, repeater, draft button, schedule button — all in one row, no wrap
- Header bars: `h-[65px]` × 2 (one per column)
- Settings dropdown overlay: nested inside same column, no mobile sheet pattern
- `<CopilotPopup>` chat assistant pinned absolute over everything (`manage.modal.tsx:666+`)

**Rich editor stack (Tiptap 3.0.6):**
- `@tiptap/starter-kit`, `@tiptap/react`, `@tiptap/pm`
- Extensions: `extension-bold`, `extension-document`, `extension-heading`, `extension-history`, `extension-link`, `extension-list`, `extension-mention`, `extension-paragraph`, `extension-text`, `extension-underline`, `extension-suggestion`
- Tiptap is mobile-friendly itself, but the surrounding chrome (formatting toolbar, signature, mention dropdowns) is desktop-only

**Modal manager itself has a mobile-killer baseline:** `apps/frontend/src/components/layout/new-modal.tsx:200` sets `min-w-[600px]` for any modal that doesn't pass an explicit `size` prop. Modals will horizontally overflow a 375px screen.

**Recommendation:** Build a fresh `MobilePostDetail` route (not a modal — a real page at `/m/post/[id]`). Reuse the zustand store from `new-launch/store.ts` (it's UI-agnostic), reuse Tiptap editor wiring, but write a new layout (single column, bottom-pinned action bar, swipeable platform previews).

---

## 5. Layout / Navigation

**Top-level layout:** `apps/frontend/src/components/new-layout/layout.component.tsx`

**Structure (lines 89-141):**
```jsx
<div className="flex flex-col min-h-screen min-w-screen p-[12px]">
  <Impersonate />
  <AnnouncementBanner />
  <div className="flex-1 flex gap-[8px]">      // horizontal flex
    <Support />
    <div className="w-[80px]">                  // fixed-width left rail
      <div className="fixed h-full w-[64px] start-[17px] top-0">
        <Logo /> <TopMenu />
      </div>
    </div>
    <div className="flex-1">
      <div className="h-[80px] px-[20px]">      // fixed top header
        <Title /> <StreakComponent /> <OrgSelector /> <ModeComponent />
        <LanguageComponent /> <ChromeExtensionComponent />
        <FeedbackIcon /> <NotificationComponent />
      </div>
      <div>{children}</div>
    </div>
  </div>
</div>
```

- **Left sidebar:** `w-[80px]` icon rail, `position: fixed`, `start-[17px]` (12px outer padding + 5px). No mobile breakpoint — it always renders, eating 80+12+12=~104px of horizontal space.
- **Top header:** `h-[80px]` with 8 inline icons. On mobile they overflow horizontally because they're in a flex-row with `gap-[20px]` and explicit dividers (`w-[1px] h-[20px] bg-blockSeparator`).
- **No bottom nav.** No mobile drawer/hamburger.
- **No `mobile:` or breakpoint usage** anywhere in `layout.component.tsx` or `top.menu.tsx`.

**TopMenu** (`apps/frontend/src/components/layout/top.menu.tsx`) — defines two menu groups with hardcoded SVG icons for: Calendar/Launches, Agent, Analytics, Media, Plugs, Integrations (firstMenu) + UGC, Affiliate, Billing, Settings (secondMenu). Each item is a `<MenuItem>` from `new-layout/menu-item.tsx`.

**Mobile integration component exists but is unused:** `apps/frontend/src/components/new-layout/mobile.integration.tsx` — wraps `<AddProviderComponent isMobile={true} />`. It's referenced nowhere in routes — appears to be dead code or extension-only. The `isMobile?: boolean` prop on `AddProviderComponent` (`add.provider.component.tsx:384`) does flip some classes (`removeLayout`, `fullScreen`, `bg-black p-[20px]`) but it's only a partial path through one component, not a real mobile UI.

**Recommendation:** Build a parallel mobile route group `apps/frontend/src/app/(app)/(mobile)/` with its own `layout.tsx` that renders a different shell: bottom tab bar (Calendar / Add / Settings), no left rail, no fixed top header. Then conditionally route mobile users via middleware or a UA check on the existing `(site)` layout.

---

## 6. Component Library

**No shadcn. No Radix. No Headless UI.** I checked — `@radix-ui/*`, `@headlessui/react`, `cva`, `class-variance-authority` are all absent from `package.json`. There's no `cn(...)` utility function in the codebase (`clsx` is used directly).

**What's actually used as a "library":**
- **Mantine 5.10.5** — `@mantine/core`, `@mantine/dates`, `@mantine/hooks`, `@mantine/modals`. **This is two major versions behind current Mantine (v8).** Used for: hooks (`useInterval`), some date pickers, the original modal system (mostly replaced by custom `new-modal.tsx`). The `MantineWrapper` (`libraries/react-shared-libraries/src/helpers/mantine.wrapper.tsx`) is still mounted in the layout.
- **Custom UI primitives** in `libraries/react-shared-libraries/src/form/`: `button.tsx`, `input.tsx`, `select.tsx`, `checkbox.tsx`, `slider.tsx`, `textarea.tsx`, `color.picker.tsx`, `custom.select.tsx`, `total.tsx`, `canonical.tsx`. Imported as `@gitroom/react/form/button`.
- **Custom icon set** at `apps/frontend/src/components/ui/icons/index.tsx` — **901 lines of inline SVG components** (`SettingsIcon`, `ChevronDownIcon`, `CloseIcon`, `TrashIcon`, `LockIcon`, `EmojiIcon`, `DelayIcon`, `ResetIcon`, `ConnectionLineIcon`, `DropdownArrowSmallIcon`, etc.). Plus `@meronex/icons` for some.
- **Custom modal manager:** `apps/frontend/src/components/layout/new-modal.tsx` (~400 lines, zustand-backed)
- **Custom toaster:** `libraries/react-shared-libraries/src/toaster/`
- **Tooltip:** `react-tooltip` (rendered globally via `<ToolTip />`)
- **Date picker:** `apps/frontend/src/components/launches/helpers/date.picker.tsx`
- **Editor:** Tiptap (see section 4)
- **Media uploader:** Uppy (`@uppy/core`, `@uppy/dashboard`, `@uppy/aws-s3`, `@uppy/transloadit`, `@uppy/react`)
- **Markdown editor:** `@uiw/react-md-editor` (used in markdown channels)
- **Emoji picker:** `emoji-picker-react`
- **CopilotKit:** `@copilotkit/react-core`, `@copilotkit/react-ui`, `@copilotkit/react-textarea` — AI assistant overlay
- **Chart.js** for analytics
- **Polotno** for design canvas

**Implication:** No clean abstracted UI library to drop into mobile. Rolling your own thin Tailwind primitives (Button, Sheet, BottomSheet, Input, Picker) for mobile is fine and matches the codebase style. Per CLAUDE.md: "Never install frontend components from npmjs, focus on writing native components."

---

## 7. State Management

**Two layers:**

1. **SWR 2.2.5** for server data. Used everywhere. CLAUDE.md mandates: "always use SWR to fetch stuff, and use `useFetch` hook from `libraries/helpers/src/utils/custom.fetch.tsx`". Each SWR call must be its own hook (lint rule: react-hooks/rules-of-hooks). Count: 127 `useSWR` calls across components.
   - Example: `calendar.context.tsx:201-214` shows the pattern with `refreshInterval`, `refreshWhenOffline: false`, etc.

2. **Zustand 5.0.5** for client UI state.
   - `apps/frontend/src/components/new-launch/store.ts` (`useLaunchStore`) — 654 lines, manages selected channels, post drafts (global + per-channel), tags, date, repeater, editor mode, etc.
   - `apps/frontend/src/components/layout/new-modal.tsx` — modal stack (`useModalStore`)
   - `useShallow` is used everywhere for performance.

**No React Query, no Redux, no Jotai, no Recoil.**

`useFetch` hook lives at `libraries/helpers/src/utils/custom.fetch.tsx` — handles auth headers + base URL.

**Recommendation:** Reuse both. The zustand store especially is a clean abstraction the new mobile UI can drive without touching the desktop UI.

---

## 8. Forms

**Stack: react-hook-form 7.58.1 + Yup 1.4.0 (`@hookform/resolvers/yup`).** Zod is also a dependency (3.25.76) but not actually wired into form resolvers based on grep — it's used for tRPC-style API validation in backend libs.

**Examples:**
- `apps/frontend/src/components/launches/add.provider.component.tsx:194-196` — `useForm({ resolver: yupResolver(schema) })`
- `apps/frontend/src/components/settings/signatures.component.tsx:148-149` — same pattern
- `apps/frontend/src/components/settings/teams.component.tsx:38` — `useForm`
- `apps/frontend/src/components/launches/helpers/use.values.ts:55-88` — central `useForm` wrapper + `useSettings = useFormContext`

**Pattern:** `<FormProvider>` from RHF wraps fields, child components use `useFormContext()` / `useSettings()` to read. Schema validation via Yup.

**No zod-form integration.** No tRPC. Field components are custom (`@gitroom/react/form/input`, etc.) and accept RHF props.

**Recommendation:** Reuse RHF + Yup. The form abstractions don't conflict with mobile.

---

## 9. PWA Readiness

**There is NO PWA setup. None.**

Verified absences:
- No `manifest.json` or `manifest.webmanifest` in `apps/frontend/public/` (full file list checked — only favicons, logos, login backgrounds, platform icons)
- No `manifest` reference in any route or `next.config.js`
- No `next-pwa`, `@ducanh2912/next-pwa`, `@serwist/next` in `package.json`
- No `service-worker.ts`, `sw.ts`, or `workbox` config
- No `<link rel="manifest">` in any layout (checked `apps/frontend/src/app/(app)/layout.tsx` and `(extension)/layout.tsx`)
- No viewport meta tag in any layout (Next.js default applies, but no custom mobile viewport config)
- No `apple-touch-icon`, `theme-color`, or iOS install metadata
- No `app/manifest.ts` or `app/manifest.json/route.ts` route handler (Next 13+ convention)

The Postiz #740 issue marking PWA as "feature request" is accurate — nothing exists.

**Adding PWA is a small, separate piece of work.** With Next 16 App Router, the cleanest approach is:
1. Create `apps/frontend/src/app/manifest.ts` exporting a `MetadataRoute.Manifest` object (Next handles serving)
2. Add icons to `apps/frontend/public/icons/pwa/`
3. Add `viewport` and `themeColor` to `app/(app)/layout.tsx` via `export const viewport: Viewport`
4. For offline / installable: use `@serwist/next` (modern, Next 16 compatible) — `next-pwa` is dead and unmaintained
5. Sentry is already wired (`withSentryConfig` in `next.config.js`) — make sure service worker doesn't intercept Sentry calls

**Estimated PWA effort:** half a day for installable + manifest + icons. Full offline post-drafting would be a separate workstream (needs IndexedDB-backed zustand persistence and an outbox for the post API).

---

## 10. Mobile Responsive Issues — Concrete List

**Hardcoded fixed widths that break mobile** (all from grep):
- `apps/frontend/src/components/new-layout/layout.component.tsx:103` — `w-[80px]` left rail wrapper
- `apps/frontend/src/components/new-layout/layout.component.tsx:107` — `fixed h-full w-[64px] start-[17px] top-0` left rail content
- `apps/frontend/src/components/new-layout/layout.component.tsx:118` — `h-[80px]` top header, no responsive collapse
- `apps/frontend/src/components/launches/launches.component.tsx:503` — channel sidebar `w-[260px]` (or `w-[100px]` collapsed)
- `apps/frontend/src/components/new-launch/manage.modal.tsx:535` — preview pane `w-[580px]`
- `apps/frontend/src/components/new-launch/manage.modal.tsx:446` — `p-[40px]` outer padding
- `apps/frontend/src/components/new-launch/manage.modal.tsx:450,536` — header bars `h-[65px]`
- `apps/frontend/src/components/new-launch/manage.modal.tsx:552` — bottom action bar `h-[84px]`
- `apps/frontend/src/components/layout/new-modal.tsx:200` — modal manager baseline `min-w-[600px]`
- `apps/frontend/src/components/layout/new-modal.tsx:189` — `pt-[100px] pb-[100px]` modal vertical padding
- `apps/frontend/src/components/launches/calendar.tsx:368` — week grid `[grid-template-columns:136px_repeat(7,_minmax(0,_1fr))]`
- `apps/frontend/src/components/launches/calendar.tsx:467` — month grid `grid-cols-7`
- Plus: `third-party.component.tsx:120`, `plugs.tsx:126`, `agents/agent.tsx:111`, `settings/settings.component.tsx:120` all use `w-[260px]` channel sidebar
- 7 different modals hard-set `max-w-[1400px]` — fine on desktop, irrelevant on mobile

**Other issues:**
- DnD uses HTML5Backend only — no touch support (`launches/helpers/dnd.provider.tsx`)
- No viewport meta in `app/(app)/layout.tsx` — uses Next.js default which may not include `width=device-width`
- `react-dnd` paired with `react-sortablejs` for some lists — sortablejs supports touch but the Calendar uses react-dnd
- Filters component (`launches/filters.tsx:275`) uses `flex flex-col md:flex-row` — this is one of the few places using a real Tailwind breakpoint, but `md:` is undefined in the config so it falls back to Tailwind's default 768px (Tailwind ships its defaults if not overridden — needs verification, but `md:` does work in `embedded.billing.tsx`)
- 35 total uses of `mobile:`/`tablet:`/`md:` across all components — concentrated in `billing/`, `auth/`, `first.billing.component.tsx` (the marketing-style billing page is the only properly responsive area). Calendar, launches, manage modal, top menu, layout: **zero responsive breakpoints**.

---

## 11. Theme / Dark Mode

**Class-based dark mode** (`tailwind.config.cjs:3` — `darkMode: 'class'`).

- Mode stored in cookie via `react-use-cookie` (`mode = 'dark' | 'light'`, default `'dark'`)
- Toggle: `apps/frontend/src/components/layout/mode.component.tsx`
- Body class set imperatively: `document.body.classList.add(mode)` (line 19)
- All theme tokens are CSS variables defined under `.dark` and `.light` selectors in `apps/frontend/src/app/colors.scss` (lines 1-80+)
- The `(app)/layout.tsx:54` hardcodes `'dark'` class on body initially: `className={clsx(jakartaSans.className, 'dark text-primary !bg-primary')}`
- An EventEmitter (`modeEmitter`) is exported from `mode.component.tsx` for reactive mode-aware components

**Recommendation:** Reuse the dark/light system. CSS variables make the new mobile components automatically themed.

---

## 12. Keep vs Replace — Strategic Map

**KEEP (don't touch — work fine on desktop, used on mobile-rare flows):**

| Area | Files | Why |
|---|---|---|
| Auth | `apps/frontend/src/app/(app)/auth/*`, `apps/frontend/src/components/auth/*` | Login/register/activate/forgot — accessed once, mostly forms. Already partially responsive. |
| Integrations connect (OAuth flow) | `apps/frontend/src/app/(app)/integrations/social/[provider]/page.tsx`, `apps/frontend/src/components/launches/add.provider.component.tsx` (with `isMobile` flag) | OAuth happens in popup/redirect — mobile-irrelevant. Add provider component already has partial mobile branch. |
| Billing | `apps/frontend/src/app/(app)/(site)/billing/`, `apps/frontend/src/components/billing/*` | Already the most responsive area in the codebase (`first.billing.component.tsx` has 21+ `mobile:` usages). |
| Settings (basic) | `apps/frontend/src/app/(app)/(site)/settings/`, `apps/frontend/src/components/settings/*` | Forms — RHF/Yup, easy to mobile-tune later if needed. |
| Calendar context / data layer | `apps/frontend/src/components/launches/calendar.context.tsx` | UI-agnostic SWR + filter state. Mobile UI consumes this directly. |
| Post draft store | `apps/frontend/src/components/new-launch/store.ts` | Zustand store is pure state, no UI. |
| Tiptap editor wiring | `apps/frontend/src/components/new-launch/editor.tsx` (the Tiptap setup parts) | Editor itself works on mobile; chrome doesn't. Strip the chrome, keep the extensions config. |
| Backend API | All `apps/backend/*`, all DB schemas | Untouched. |

**REPLACE (build mobile-first parallel, don't try to retrofit):**

| Area | Files | Approach |
|---|---|---|
| App shell / layout | `apps/frontend/src/components/new-layout/layout.component.tsx`, `apps/frontend/src/components/layout/top.menu.tsx` | New `apps/frontend/src/app/(app)/(mobile)/layout.tsx` with bottom nav. |
| Calendar UI | `apps/frontend/src/components/launches/calendar.tsx` (1304 lines), `apps/frontend/src/components/launches/launches.component.tsx`, `apps/frontend/src/components/launches/filters.tsx` | New mobile calendar: month grid as primary, tap day → opens detail. Reuse `useCalendar` context. |
| Add/edit post UI | `apps/frontend/src/components/new-launch/manage.modal.tsx` (704 lines) | New mobile post detail page (full route, not modal): single-column editor, swipeable platform previews, bottom action sheet. |
| Modal system on mobile | `apps/frontend/src/components/layout/new-modal.tsx` (`min-w-[600px]` baseline) | Either fork a `MobileSheet` component (slide-up) or pass explicit `size: '100%'` everywhere. Easier to skip modals entirely on mobile and use real routes. |
| Channel sidebar | `apps/frontend/src/components/launches/launches.component.tsx:498-594` | Replace with bottom-sheet drawer accessible via floating button. |
| DnD | `apps/frontend/src/components/launches/helpers/dnd.provider.tsx` | Skip on mobile. Use long-press → action menu (move/duplicate/delete) instead. |

**ADD NEW:**

- `apps/frontend/src/app/manifest.ts` — PWA manifest
- `apps/frontend/public/icons/pwa/icon-192.png`, `icon-512.png`, `apple-touch-icon.png`
- `apps/frontend/src/app/(app)/(mobile)/` route group + layout + pages
- `apps/frontend/src/components/mobile/` directory for mobile-specific primitives (BottomSheet, MobileCalendar, MobilePostDetail, MobileNav)
- Optional: middleware in `apps/frontend/src/proxy.ts` (already exists) or new `middleware.ts` to route mobile UA to `(mobile)` group, OR just give Lukas a manual toggle

---

## 13. Effort Estimate (Honest)

**This is not "make existing screens responsive" — that path is more work than rebuilding.**

Realistic phases:

1. **PWA + viewport + manifest** — 0.5 day
2. **Mobile route group + bottom nav layout shell** — 1 day
3. **Mobile calendar** (month view, tap-to-open, list fallback, reuse `CalendarWeekProvider`) — 2-3 days
4. **Mobile post detail page** (single-column Tiptap, channel picker as sheet, date/time picker as sheet, action bar) — 3-4 days
5. **Mobile-friendly modals** (BottomSheet primitive, replace usage in detail flow) — 1 day
6. **Touch-friendly date picker** (current one in `helpers/date.picker.tsx` uses Mantine — may or may not be mobile-friendly, verify) — 0.5-1 day
7. **Polish: gestures (swipe between days/months), pull-to-refresh, install prompt** — 1 day
8. **AI background flow** (the "tap day → AI generates draft" pattern Lukas wants) — separate workstream depending on existing AI endpoints

**Total mobile MVP: 9-12 dev days** assuming Lukas-equivalent Next.js+Tailwind familiarity. Add 50% buffer for the unfamiliar Tiptap/Uppy/zustand/SWR stack interactions.

---

## 14. Risks / Gotchas

1. **CLAUDE.md is partially wrong** — says "Vite", actually Next.js. Says `tailwind.config.js`, actually `.cjs`. Update it as you go.
2. **`mobile:` prefix in Tailwind config means max-width:1025** — the opposite of mobile-first convention. Easy to write code that does the wrong thing. Add proper `sm/md/lg` breakpoints to the config OR be very deliberate.
3. **Mantine v5 is two majors out of date** and partly used (date picker, hooks). Don't ship more Mantine code; build native.
4. **CopilotKit popup** is mounted on the manage modal (`manage.modal.tsx:666`) and elsewhere — may overlap mobile UI. Hide on mobile breakpoint.
5. **The post draft state machine in `store.ts` has tight coupling to "global vs internal" content** (per-channel overrides). The mobile UI must respect this duality or platform-specific posts break.
6. **DnD + react-dnd-html5-backend** on shared components like `MenuComponent` (channel reorder). Touching `launches.component.tsx` to mobile-hide the channel sidebar means DnD only runs on desktop — fine.
7. **i18n loaded eagerly** — `calendar.tsx:18-31` imports 14 dayjs locales unconditionally. Bundle size hit. Worth deferring to lazy loading for mobile bundle.
8. **Sentry sourcemaps + `productionBrowserSourceMaps: true`** — your mobile route bundle will be uploaded to Sentry too. Make sure DSN is set / errorHandler in `next.config.js:104` already swallows Sentry build failures.
9. **No middleware-based mobile detection currently.** `proxy.ts` exists for API proxying, not UA routing. You'll add middleware or a client-side redirect.
10. **`p-[12px]` on the outer layout div** (`layout.component.tsx:91`) — even on mobile your viewport loses 24px horizontal. Negligible but worth noting.

---

## TL;DR for Lukas

- **Framework:** Next.js 16.2.1 App Router + React 19. Solid foundation.
- **Tailwind:** v3 with custom desktop-first `mobile:`/`tablet:` (max-width) breakpoints. No `sm/md/lg` defined. Add them or work around.
- **Calendar (`apps/frontend/src/components/launches/calendar.tsx`):** 1304 lines, hardcoded 7-column grid, react-dnd HTML5Backend (no touch). Replace entirely. Reuse the SWR context (`calendar.context.tsx`).
- **Post detail (`apps/frontend/src/components/new-launch/manage.modal.tsx`):** 704 lines, hardcoded `w-[580px]` preview pane + 40px padding + 84px bottom toolbar. Replace entirely as a real route, not a modal. Reuse the zustand store (`store.ts`) and Tiptap editor extensions.
- **Layout:** fixed `w-[80px]` left rail + `h-[80px]` top header, no breakpoints. Build a parallel mobile layout with bottom tabs.
- **No PWA, no manifest, no service worker.** Adding installable PWA is half a day.
- **No shadcn/Radix.** Custom Tailwind primitives + Mantine v5 (legacy). Build mobile primitives natively per CLAUDE.md guidance.
- **State/forms/data-fetching:** SWR + zustand + RHF+Yup. All reusable.
- **Strategy:** Don't retrofit — build `(app)/(mobile)/` parallel route group sharing the API/SWR/zustand layers, replace UI for the 2 screens (Calendar + Post Detail) plus a thin mobile shell. Keep auth, integrations connect, billing, settings as-is.
- **Effort:** 9-12 dev days for mobile MVP excluding AI-background-generation flow.

Key files to open first when planning:
- `/Users/lukas/Desktop/Coding/postiz-husatech/apps/frontend/tailwind.config.cjs`
- `/Users/lukas/Desktop/Coding/postiz-husatech/apps/frontend/src/app/(app)/layout.tsx`
- `/Users/lukas/Desktop/Coding/postiz-husatech/apps/frontend/src/app/(app)/(site)/layout.tsx`
- `/Users/lukas/Desktop/Coding/postiz-husatech/apps/frontend/src/components/new-layout/layout.component.tsx`
- `/Users/lukas/Desktop/Coding/postiz-husatech/apps/frontend/src/components/launches/calendar.context.tsx` (reuse)
- `/Users/lukas/Desktop/Coding/postiz-husatech/apps/frontend/src/components/new-launch/store.ts` (reuse)
- `/Users/lukas/Desktop/Coding/postiz-husatech/apps/frontend/src/components/launches/calendar.tsx` (replace UI)
- `/Users/lukas/Desktop/Coding/postiz-husatech/apps/frontend/src/components/new-launch/manage.modal.tsx` (replace UI)
- `/Users/lukas/Desktop/Coding/postiz-husatech/apps/frontend/src/components/layout/new-modal.tsx` (fork or skip on mobile)
