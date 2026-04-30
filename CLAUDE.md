This project is Postiz, a tool to schedule social media and chat posts to 28+ channels.
You can add posts to the calendar, they will be added into a workflow and posted at the right time.
You can find things like:
- Schedule posts
- Calendar view
- Analytics
- Team management
- Media library

This project is a monorepo with a root only package.json of dependencies.
Made with PNPM.
We have 3 important folders

- apps/backend - this is where the API code is (NESTJS)
- apps/orchestrator - this is temporal, it's for background jobs (NESTJS) it contains all the workflows and activities
- apps/frontend - this is the code of the frontend (Next.js 16 App Router + React 19)
- /libraries contains a lot of services shared between backend and orchestrator and frontend components.

We are using only pnpm, don't use any other dependency manager.
Never install frontend components from npmjs, focus on writing native components.

The project uses tailwind 3, before writing any component look at:
- /apps/frontend/src/app/colors.scss
- /apps/frontend/src/app/global.scss
- /apps/frontend/tailwind.config.cjs

All the --color-custom* are deprecated, don't use them.

And check other components in the system before to get the right design.

When working on the backend we need to pass the 3 layers:
Controller >> Service >> Repository (no shortcuts)
In some cases we will have
Controller >> Mananger >> Service >> Repository.

Most of the server logic should be inside of libs/server.
The backend repository is mostly used to write controller, and import files from libs.server.

For the frontend follow this:
- Many of the UI components lives in /apps/frontend/src/components/ui
- Routing is in /apps/frontend/src/app
- Components are in /apps/frontend/src/components
- always use SWR to fetch stuff, and use "useFetch" hook from /libraries/helpers/src/utils/custom.fetch.tsx

When using SWR, each one have to be in a seperate hook and must comply with react-hooks/rules-of-hooks, never put eslint-disable-next-line on it.

It means that this is valid:
const useCommunity = () => {
   return useSWR....
}

This is not valid:
const useCommunity = () => {
  return {
    communities: () => useSWR<CommunitiesListResponse>("communities", getCommunities),
    providers: () => useSWR<ProvidersListResponse>("providers", getProviders),
  };
}

- Linting of the project can run only from the root.
- Use only pnpm.

## Mobile-First Layer (Phase 1+)

Mobile routes live at `apps/frontend/src/app/(app)/m/*`. They live INSIDE the `(app)` route group to inherit the root layout (`<html>`/`<body>`, Plus_Jakarta_Sans font, Sentry, Plausible, PHProvider, VariableContextComponent, FetchWrapperComponent, ChangeDirClient). The mobile `layout.tsx` only swaps the desktop chrome (sidebar+topbar) for a mobile shell (top header + bottom tab bar) and mounts a smaller provider subset.

- Routes: `apps/frontend/src/app/(app)/m/kalender`, `apps/frontend/src/app/(app)/m/vorschlaege`, `apps/frontend/src/app/(app)/m/mehr`
- URL paths remain `/m/kalender`, `/m/vorschlaege`, `/m/mehr` — `(app)` is URL-transparent
- Components: `apps/frontend/src/components/mobile/` (BottomNav, MobileShell, etc.)
- `(app)/m/layout.tsx` is a Client Component (`'use client'`) with Provider-Set: `ContextWrapper` + `MantineWrapper` + `Toaster` + `CheckPayment` + `PreConditionComponent` + `MobileShell`. Do NOT add `<html>`/`<body>` here — those are in `(app)/layout.tsx`.
- `viewport` export and iOS PWA meta tags (`apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style: black-translucent`, `apple-mobile-web-app-title`, `apple-touch-icon`) live in `(app)/layout.tsx` — Server Component requirement.
- Tailwind for mobile: use standard `sm/md/lg/xl/2xl` breakpoints (mobile-first, min-width). Do NOT use the custom `mobile:` prefix (that is max-width: 1025px — desktop-first).
- PWA: `apps/frontend/src/app/manifest.ts` with `start_url: '/m/kalender'`, `scope: '/m/'`, `id: '/m/'`, maskable icon variant. Service-Worker via `@serwist/next` (Phase 1 V1: minimal default cache, no offline pages).
- Server-Agent auth: `HUSATECH_AGENT_BASE_URL` + `HUSATECH_AGENT_TOKEN` env vars (see `.env.example`). All agent calls use `Authorization: Bearer <token>`.
- Desktop UI (`(app)/(site)/...`) is untouched — mobile layer is parallel under same `(app)` root, sharing all root providers.