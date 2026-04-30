# Postiz Tech Stack

**Analysis Date:** 2026-04-30
**Repository version:** v1.47.0 (`/Users/lukas/Desktop/Coding/postiz-husatech/version.txt`)
**Repository name in package.json:** `gitroom` (the upstream brand was Gitroom; the product is now called Postiz)

This document is the foundational tech-stack reference for the Husatech fork of Postiz. Other agents will produce ARCHITECTURE.md, MOBILE.md and WORKFLOW.md separately.

---

## 1. Top-Level Stack & Monorepo Structure

### Monorepo Tooling

| Tool | Version | Source |
|------|---------|--------|
| pnpm (package manager) | `pnpm@10.6.1` | `/package.json` `packageManager` field |
| pnpm workspaces | (config) | `/pnpm-workspace.yaml` |
| Node.js (runtime) | `>=22.12.0 <23.0.0` (engines) | `/package.json` `engines` |
| Node.js (Volta pin) | `20.17.0` | `/package.json` `volta` block (legacy/pinned) |
| Node.js (Dockerfile.dev) | `node:22.20-bookworm-slim` | `/Dockerfile.dev` line 1 |
| Node.js (Jenkins/GH Actions ESLint) | `20` | `/Jenkins/Build.Jenkinsfile`, `.github/workflows/eslint` |
| Node.js (GH Actions build.yml) | `22.12.0` | `/.github/workflows/build.yml` |
| TypeScript | `5.5.4` | root devDependencies |
| TypeScript path aliases | `@gitroom/*` | `/tsconfig.base.json` (see paths section below) |
| pnpm lockfile size | 39,833 lines | `/pnpm-lock.yaml` |

There is a Node version mismatch in the repo: `engines` says `>=22.12.0 <23.0.0`, but `volta.node` says `20.17.0`, the Jenkins pipeline installs `20.x`, and the ESLint workflow uses `20`. The Dockerfile and GH Actions `build.yml` use `22.x`. **Use Node 22.12.x for parity with the Docker image.**

### Workspace Layout

`/pnpm-workspace.yaml`:
```yaml
packages:
  - apps/*
  - libraries/*
```

`.npmrc` settings (`/.npmrc`):
- `node-linker=hoisted` (single flat node_modules)
- `inject-workspace-packages=true`
- `restrict-manifest-changes=true`
- `sync-injected-deps-after-scripts[]=build`
- `ignore-workspace-root-check=true`

### Apps (`/apps/*`)

| Path | Package name | Purpose | Runtime / framework |
|------|--------------|---------|---------------------|
| `apps/backend` | `postiz-backend` | REST API + Public API + MCP server | NestJS 10 + Express |
| `apps/frontend` | `postiz-frontend` | Web UI (the part that breaks on mobile) | Next.js 16.2.1 (App Router) |
| `apps/orchestrator` | `postiz-orchestrator` | Temporal workers + workflows + activities | NestJS 10 + Temporal |
| `apps/commands` | `postiz-command` | Nest CLI commands (one-off tasks) | NestJS 10 + `nestjs-command` |
| `apps/extension` | `postiz-extension` | Chrome extension (cookie-based platform auth, e.g. Skool) | Vite + React, Manifest V3 |
| `apps/sdk` | `@postiz/node` | Public Node.js SDK published to npm | tsup, ships CJS + d.ts |

### Libraries (`/libraries/*`)

| Path | Purpose |
|------|---------|
| `libraries/nestjs-libraries` | Shared backend services, Prisma schema/services, integration providers, temporal helpers, agent (LangGraph), 3rd-party services, openai, redis, upload, video, short-linking, track, sentry, throttler |
| `libraries/react-shared-libraries` | Shared React utilities: form helpers, sentry, toaster, translation (i18next), helpers (posthog, variable.context, useFetch) |
| `libraries/helpers` | Cross-cutting helpers: auth, configuration checker, decorators, subdomain, swagger loader, generic utils |
| `libraries/plugins/src/list/public-api` | **Git submodule** to `git@github.com:gitroomhq/public-api.git` (`/.gitmodules`) — currently not present locally |

### Path Aliases (`/tsconfig.base.json`)

```jsonc
"paths": {
  "@gitroom/backend/*":            ["apps/backend/src/*"],
  "@gitroom/frontend/*":           ["apps/frontend/src/*"],
  "@gitroom/orchestrator/*":       ["apps/orchestrator/src/*"],
  "@gitroom/extension/*":          ["apps/extension/src/*"],
  "@gitroom/nestjs-libraries/*":   ["libraries/nestjs-libraries/src/*"],
  "@gitroom/react/*":              ["libraries/react-shared-libraries/src/*"],
  "@gitroom/helpers/*":            ["libraries/helpers/src/*"],
  "@gitroom/plugins/*":            ["libraries/plugins/src/*"]
}
```
TS strict mode is on, but `strictNullChecks: false`, `strictBindCallApply: false`, `strictPropertyInitialization: false`. `noImplicitAny: true`. Target: `es2015`, lib: `es2020 + dom`.

---

## 2. Frontend Stack (`/apps/frontend`)

### Framework

| Item | Version | Source |
|------|---------|--------|
| Next.js | `16.2.1` (pinned via pnpm `overrides`) | `/package.json`, `/apps/frontend/next.config.js` |
| React | `19.2.4` (pinned via pnpm `overrides`) | `/package.json` |
| React DOM | `19.2.4` | `/package.json` |
| `@types/react` | `19.1.8` | `/package.json` |
| `@types/react-dom` | `19.1.6` | `/package.json` |
| Routing | App Router (Next.js 13+ style) | `/apps/frontend/src/app/` |
| `reactStrictMode` | **`false`** | `/apps/frontend/next.config.js` line 23 |
| Production source maps | enabled (for Sentry) | `/apps/frontend/next.config.js` line 26 |
| Frontend dev port | `4200` | `apps/frontend/package.json` `dev` script |

The Next.js `app/` directory uses route groups: `(app)`, `(provider)`, `(extension)`. Inside `(app)` there are nested groups `(site)`, `(preview)`. Main authenticated pages live under `apps/frontend/src/app/(app)/(site)/`:

```
launches/    — calendar / scheduling
analytics/
admin/
agents/      — AI agent feature
billing/
media/
plugs/
settings/
third-party/
err/
```

`apps/frontend/src/app/layout.tsx` does NOT exist as a top-level layout. Instead each route group has its own layout (`(app)/layout.tsx`, `(provider)/layout.tsx`, `(extension)/layout.tsx`). The `(app)/layout.tsx` is the main HTML shell, sets `dark text-primary !bg-primary` body class, loads `Plus_Jakarta_Sans` Google font, and disables Plausible if Stripe is unset.

### Styling

| Item | Version | Source |
|------|---------|--------|
| TailwindCSS | `3.4.17` | `/apps/frontend/tailwind.config.cjs`, root deps |
| `@tailwindcss/postcss` | `^4.1.7` (root deps but unused in frontend pipeline) | root deps |
| `@tailwindcss/vite` | `^4.0.17` (root devDeps, used elsewhere) | root devDeps |
| PostCSS | `8.4.38` | root devDeps |
| autoprefixer | `^10.4.17` | root devDeps |
| `tailwind-scrollbar` | `^3.1.0` (Tailwind plugin) | `tailwind.config.cjs` plugin |
| `tailwindcss-rtl` | `^0.9.0` (Tailwind plugin) | `tailwind.config.cjs` plugin |
| Sass | `^1.89.2` | root deps |
| `@pigment-css/react` | `^0.0.30` | root deps (CSS-in-JS) |

Frontend uses **Tailwind v3.4.17** (as confirmed by `/CLAUDE.md`: "The project uses tailwind 3"). Tailwind v4 is in deps but appears unused by the frontend Next app. Tailwind config `darkMode: 'class'`. Content scans `./src/**/*.{ts,tsx,html}` and `../../libraries/**/*.{ts,tsx,html}`.

**Color system uses CSS variables** (`var(--color-primary)`, `var(--new-bgColor)` etc.) defined in `/apps/frontend/src/app/colors.scss` and `/apps/frontend/src/app/global.scss`. There is a deprecation note in `/CLAUDE.md`: "All the `--color-custom*` are deprecated, don't use them."

**Custom Tailwind breakpoints** (in `tailwind.config.cjs`):
```js
mobile:    '(max-width: 1025px)'
tablet:    '(max-width: 1300px)'
iconBreak: '(max-width: 1560px)'
maxMedia:  '(max-width: 1400px)'
minCustom: '(min-height: 800px)'
custom:    '(max-height: 800px)'
xs:        max '401px'
```
Note: "mobile" here means `<= 1025px` (so it covers tablets too) — this is unusual and is one of the reasons the mobile UX is broken.

PostCSS config (`/apps/frontend/postcss.config.mjs`) only loads `tailwindcss` (no autoprefixer in the frontend chain).

### State Management & Data Fetching

| Library | Version | Purpose |
|---------|---------|---------|
| `zustand` | `^5.0.5` | Client state (used in `components/layout/new-modal.tsx` and `components/new-launch/store.ts`) |
| `swr` | `^2.2.5` | Server state / data fetching (31 files use `react-hook-form`; many use `useSWR`) |
| Native React `useState`/`useReducer` | (built-in) | Local state |
| Custom `useFetch` hook | `libraries/helpers/src/utils/custom.fetch.tsx` | Wraps fetch + auth |

`/CLAUDE.md` mandates: "always use SWR to fetch stuff, and use `useFetch` hook from `/libraries/helpers/src/utils/custom.fetch.tsx`". SWR hooks must be one-per-hook (`react-hooks/rules-of-hooks` strictly enforced).

### Forms & Validation

| Library | Version | Purpose |
|---------|---------|---------|
| `react-hook-form` | `^7.58.1` | Form state — used in 31 frontend files |
| `@hookform/resolvers` | `^3.3.4` | Resolver glue |
| `yup` | `^1.4.0` | Frontend validation schemas (5 files) |
| `class-validator` | `^0.14.1` | Backend DTO validation (NestJS) |
| `class-validator-jsonschema` | `^5.1.0` | DTO → JSON schema (Swagger / MCP) |
| `class-transformer` | `^0.5.1` | Backend transform decorators |
| `zod` | `^3.25.76` | Used by Mastra/AI SDK and some MCP tool schemas |

### UI Component Libraries

There is **no single dominant component library**. The frontend rolls its own components. UI components live in `/apps/frontend/src/components/` (29 subfolders) and `/apps/frontend/src/components/ui/` (only 4 helpers).

| Library | Version | Where used |
|---------|---------|------------|
| `@mantine/core`, `@mantine/dates`, `@mantine/hooks`, `@mantine/modals` | `^5.10.5` | Mantine v5 used selectively (e.g. `useClickOutside` in `components/launches/menu/menu.tsx`). Note: Mantine v5 is **two majors out of date** (Mantine 7 is current). |
| `@tiptap/*` (15 packages, all `^3.0.x`) | `^3.0.6+` | Rich-text editor in `components/new-launch/editor.tsx` and `mention.component.tsx` |
| `react-tooltip` | `^5.26.2` | Tooltips |
| `tippy.js` | `^6.3.7` | Tooltips (TipTap) |
| `react-tag-autocomplete` | `^7.2.0` | Tag inputs |
| `sweetalert2` + `@sweetalert2/theme-dark` | `11.4.8` / `^5.0.16` | Confirm/alert dialogs |
| `@uiw/react-md-editor` | `^4.0.3` | Markdown editor |
| `emoji-picker-react` | `^4.12.0` | Emoji picker |
| `react-colorful` | `^5.6.1` | Color picker |
| `react-country-flag` | `^3.1.0` | Flags |
| `react-dropzone` | `^14.3.5` | File drop |
| `react-loading` | `^2.0.3` | Spinners |
| `chart.js` | `^4.4.1` | Charts (analytics) |
| `polotno` | `^3.0.0-beta.25` | Image/video editor (loaded via `@gitroom/frontend/components/launches/polonto*`) — gated by `NEXT_PUBLIC_POLOTNO` env var |
| `@uppy/*` (10 packages) | `^4.x` | File upload UI: core, dashboard, drag-drop, transloadit, xhr-upload, aws-s3, compressor, react, status-bar, progress-bar |
| `@neynar/react` | `^1.2.22` | Farcaster login UI |
| `@solana/wallet-adapter-react` + `-react-ui` | `^0.15.35` / `^0.9.35` | Solana wallet (Web3 features) |
| `@stripe/react-stripe-js` + `@stripe/stripe-js` | `^5.4.1` / `^8.6.0` | Stripe Elements |
| CopilotKit `@copilotkit/{react-core,react-ui,react-textarea,runtime}` | `1.10.6` | AI Copilot (chat assistant) |
| `@uidotdev/usehooks` | `^2.4.1` | Misc React hooks |
| `react-hotkeys-hook` | `^5.1.0` | Keyboard shortcuts |
| `react-use-cookie`, `react-use-keypress` | `^1.6.1`, `^1.3.1` | Misc |
| `react-i18next` | `^15.5.2` | i18n hooks |
| `clsx` | `^2.1.0` | Conditional classNames |
| `copy-to-clipboard` | `^3.3.3` | Clipboard |
| `dayjs` | `^1.11.10` | Dates (UTC plugin used in orchestrator) |

### Drag & Drop / Calendar (the broken part on mobile)

The calendar at `apps/frontend/src/components/launches/calendar.tsx` is hand-rolled (about 600+ lines) — there is **no `react-big-calendar` or `fullcalendar` dependency**. DnD is `react-dnd` + `react-dnd-html5-backend`:

| Library | Version | Where |
|---------|---------|-------|
| `react-dnd` | `^16.0.1` | `components/launches/calendar.tsx`, `components/launches/launches.component.tsx`, `components/launches/helpers/dnd.provider.tsx` |
| `react-dnd-html5-backend` | `^16.0.1` | same |
| `react-sortablejs` | `^6.1.4` | Sortable lists |
| `array-move` | `^4.0.0` | Reorder helpers |

`react-dnd-html5-backend` is **HTML5 drag-and-drop only — it does not work on touch devices**. This is a primary reason the mobile experience is broken. To fix mobile, switch to `react-dnd-touch-backend` or replace with `@dnd-kit/core` (touch-native).

### Icons

There is **no general-purpose icon library** (no `react-icons`, `@heroicons`, `lucide-react`, `@meronex/icons` actually consumed in `apps/frontend/src/`, despite `@meronex/icons` being in root deps). Icons are inline JSX SVGs scattered across components. The `apps/frontend/src/components/icons/` folder does not exist; icons live with their components.

### Misc Frontend Libraries

| Library | Version | Purpose |
|---------|---------|---------|
| `axios` | `^1.14.0` | HTTP client (rare; most fetching uses native fetch via `useFetch`) |
| `lodash` | `^4.17.21` | Utility |
| `i18next` + `i18next-browser-languagedetector` + `i18next-resources-to-backend` | `^25.2.1` / `^8.1.0` / `^1.2.1` | i18n |
| `i18n-iso-countries` | `^7.14.0` | ISO country codes |
| `slugify` | `^1.6.6` | Slugs |
| `isomorphic-dompurify` | `^3.10.0` | HTML sanitization |
| `next-plausible` | `^3.12.0` | Plausible analytics |
| `posthog-js` | `^1.178.0` | PostHog analytics |
| `@dub/analytics` | `^0.0.32` | Dub link analytics |
| `react-country-flag`, `timezones-list` | `^3.1.0` / `^3.1.0` | Flag + timezone picker |

### Web3

| Library | Version | Purpose |
|---------|---------|---------|
| `@solana/wallet-adapter-react` + `-react-ui` | `^0.15.35` / `^0.9.35` | Solana wallet integrations |
| `viem` | `^2.22.9` | Ethereum/EVM client |
| `bs58` | `^6.0.0` | Base58 (Solana addresses) |
| `tweetnacl` | `^1.0.3` | Crypto |
| `crypto-hash` | `^3.0.0` | (transpiled by Next: `transpilePackages: ['crypto-hash']`) |
| `@postiz/wallets` | `^0.0.1` | Custom wallet wrapper |

---

## 3. Backend Stack (`/apps/backend` + `/libraries/nestjs-libraries`)

### NestJS Core

| Item | Version | Source |
|------|---------|--------|
| `@nestjs/common`, `@nestjs/core` | `^10.0.2` | Note: NestJS 10 (NestJS 11 is the current latest) |
| `@nestjs/cli` | `10.0.2` | Build CLI |
| `@nestjs/schematics` | `^10.0.1` | devDeps |
| `@nestjs/microservices` | `^10.3.1` | Microservices transport |
| `@nestjs/platform-express` | `^10.0.2` | Express adapter |
| `@nestjs/schedule` | `^4.0.0` | Cron schedule (likely legacy; Temporal handles most jobs) |
| `@nestjs/swagger` | `^7.3.0` | OpenAPI generation, loaded in `apps/backend/src/main.ts` line 5 via `loadSwagger` |
| `@nestjs/throttler` | `^6.3.0` | Rate limiting; uses `@nest-lab/throttler-storage-redis ^1.2.0` |
| `@nestjs/testing` | `^10.0.2` | devDeps |
| `nestjs-real-ip` | `^3.0.1` | Real IP behind proxy |
| `nestjs-command` | `^3.1.4` | CLI commands (used by `apps/commands`) |
| `nestjs-temporal-core` | `^3.2.0` | Temporal integration |
| Backend port | `3000` | `apps/backend/src/main.ts` line 69 |

The backend entry point is `/apps/backend/src/main.ts`. Bootstrap order:
1. `initializeSentry('backend', true)` — Sentry must come first.
2. `Runtime.install({ shutdownSignals: [] })` — Temporal runtime (note: backend itself runs Temporal client + MCP).
3. `process.env.TZ = 'UTC'` — global UTC timezone.
4. `NestFactory.create(AppModule, { rawBody: true, cors: { ... } })`.
5. `await startMcp(app)` — MCP server (`@modelcontextprotocol/sdk`) is bootstrapped on the backend.
6. Global pipes: `ValidationPipe({ transform: true })`.
7. Global filters: `SubscriptionExceptionFilter`, `HttpExceptionFilter`.
8. `loadSwagger(app)` — OpenAPI/Swagger.
9. Listens on `process.env.PORT || 3000`.

`AppModule` (`/apps/backend/src/app.module.ts`) imports:
- `SentryModule.forRoot()`
- `DatabaseModule` (`@gitroom/nestjs-libraries/database/prisma`)
- `ApiModule` (`/apps/backend/src/api/api.module.ts` — controllers under `/apps/backend/src/api/routes/`)
- `PublicApiModule` (`/apps/backend/src/public-api/public.api.module.ts`)
- `AgentModule` (`@gitroom/nestjs-libraries/agent` — LangGraph)
- `ThirdPartyModule`, `VideoModule`, `ChatModule`
- `getTemporalModule(false)` — temporal client only, no workers
- `TemporalRegisterMissingSearchAttributesModule`, `InfiniteWorkflowRegisterModule`
- `ThrottlerModule` with Redis storage (`ttl: 3600000`, `limit: API_LIMIT || 30`)

Global guards: `ThrottlerBehindProxyGuard`, `PoliciesGuard` (CASL).

### ORM & Database

| Item | Version | Source |
|------|---------|--------|
| Prisma | `6.5.0` | root deps + scripts use `pnpm dlx prisma@6.5.0` |
| `@prisma/client` | `6.5.0` | root deps |
| Schema location | `/libraries/nestjs-libraries/src/database/prisma/schema.prisma` | 959 lines, 48 models |
| Database | PostgreSQL 17 (alpine) | `docker-compose.yaml` line 127 |
| `provider` in schema | `postgresql` | `schema.prisma` line 7 |
| Generator runtime | `nodejs` (Prisma 6 with explicit runtime) | `schema.prisma` line 3 |
| Prisma client path | default `node_modules/@prisma/client` | (no custom output) |

**48 Prisma models** in `schema.prisma`:
```
Organization, Tags, TagsPosts, User, UsedCodes, UserOrganization, GitHub,
Trending, TrendingLog, ItemUser, Star, Media, SocialMediaAgency,
SocialMediaAgencyNiche, Credits, Subscription, Customer, Integration,
Signatures, Comments, Post, Notifications, MessagesGroup, PayoutProblems,
Orders, OrderItems, Messages, Plugs, ExisingPlugData, PopularPosts,
IntegrationsWebhooks, Webhooks, AutoPost, Sets, ThirdParty, Errors,
Mentions, mastra_ai_spans, mastra_evals, mastra_messages, mastra_resources,
mastra_scorers, mastra_threads, mastra_traces, mastra_workflow_snapshot,
OAuthApp, OAuthAuthorization, Announcement
```

Note: 8 of these (`mastra_*`) are owned by the Mastra agent framework (chat memory + traces). 2 (`OAuthApp`, `OAuthAuthorization`) are for the Postiz OAuth provider role.

Schema is pushed (not migrated) in dev: `pnpm run prisma-db-push` runs `prisma db push --accept-data-loss`. There is no `migrations/` folder. Reset is `prisma db push --force-reset`. **Prisma Migrate is NOT used** — this means schema changes destroy data on push. For production this is a concern.

`postinstall` hook auto-generates the Prisma client (`pnpm run prisma-generate`).

### Architectural Layers (per `/CLAUDE.md`)

```
Controller >> Service >> Repository (no shortcuts)
Controller >> Manager >> Service >> Repository (when applicable)
```

Most server logic lives in `/libraries/nestjs-libraries/`. The backend app itself is mostly thin controllers that import services from `nestjs-libraries`.

`DatabaseModule` (`/libraries/nestjs-libraries/src/database/prisma/database.module.ts`) is `@Global()` and provides 30+ services & repositories. Each domain has both a `*.service.ts` and `*.repository.ts`:

```
agencies/, announcements/, autopost/, errors/, integrations/, media/,
notifications/, oauth/, organizations/, posts/, sets/, signatures/,
subscriptions/, third-party/, users/, webhooks/
```

Plus services at the module root: `EmailService`, `StripeService`, `OpenaiService`, `FalService`, `TrackService`, `ShortLinkService`, `IntegrationManager`, `RefreshIntegrationService`, `VideoManager`, `ExtractContentService`.

### Redis

| Item | Version | Source |
|------|---------|--------|
| `ioredis` | `^5.3.2` | Primary Redis client; `/libraries/nestjs-libraries/src/redis/redis.service.ts` |
| `redis` | `^4.6.12` | Secondary node-redis client (used for some specific flows) |
| Redis image | `redis:7.2` (prod compose) / `redis:7-alpine` (dev compose) | `docker-compose.yaml`, `docker-compose.dev.yaml` |
| Redis port | `6379` | dev compose maps `6379:6379` |
| Mock fallback | `MockRedis` class | `redis.service.ts` lines 4-30 — used when `REDIS_URL` is unset |

Redis usage:
- Throttler storage (`@nest-lab/throttler-storage-redis`)
- Pub/sub for cross-service events
- Caching
- Session-related data

`ioredis` is configured with `maxRetriesPerRequest: null, connectTimeout: 10000` (`redis.service.ts` line 27).

### Temporal (Background Jobs)

| Item | Version | Source |
|------|---------|--------|
| `@temporalio/activity` | `^1.14.0` | root deps |
| `@temporalio/client` | `^1.14.0` | root deps |
| `@temporalio/common` | `^1.14.0` | root deps |
| `@temporalio/worker` | `^1.14.0` | root deps (used in orchestrator) |
| `@temporalio/workflow` | `^1.14.0` | root deps |
| `nestjs-temporal-core` | `^3.2.0` | NestJS module wrapper |
| Temporal server image | `temporalio/auto-setup:1.28.1` | `docker-compose.yaml` line 205 |
| Temporal admin tools image | `temporalio/admin-tools:1.28.1-tctl-1.18.4-cli-1.4.1` | `docker-compose.yaml` line 229 |
| Temporal UI image | `temporalio/ui:2.34.0` (port 8080) | `docker-compose.yaml` line 242 |
| Temporal port | `7233` | `docker-compose.yaml` line 204 |
| Temporal Postgres backend | `postgres:16` (separate from app DB) | `docker-compose.yaml` line 190 |
| Temporal Elasticsearch | `elasticsearch:7.17.27` | `docker-compose.yaml` line 172 |
| Default namespace | `default` | env `TEMPORAL_NAMESPACE` |
| Dynamic config files | `/dynamicconfig/development-sql.yaml`, `/dynamicconfig/development-cass.yaml` | mounted into temporal container |

The orchestrator app (`/apps/orchestrator`) is **the Temporal worker process**. It also runs a tiny NestJS app on `process.env.ORCHESTRATOR_PORT || 3002` for health checks (`HealthController` at `/apps/orchestrator/src/health.controller.ts`).

Workflows live at `/apps/orchestrator/src/workflows/` (re-exported from `index.ts`):
```
post-workflows/post.workflow.v1.0.1.ts
post-workflows/post.workflow.v1.0.2.ts   # current version
autopost.workflow.ts                     # AI autoposting
digest.email.workflow.ts                 # daily/weekly digest
missing.post.workflow.ts                 # detects missed posts
send.email.workflow.ts                   # transactional emails (via Temporal!)
refresh.token.workflow.ts                # OAuth token refresh
streak.workflow.ts                       # user streaks
```

Activities at `/apps/orchestrator/src/activities/`:
```
post.activity.ts            # social-platform posting
email.activity.ts           # email sending
integrations.activity.ts    # OAuth refresh, integration health
autopost.activity.ts        # (also imported as service)
```

`getTemporalModule()` (`/libraries/nestjs-libraries/src/temporal/temporal.module.ts`) creates **one task queue per social platform identifier** (e.g. `x`, `linkedin`, `facebook`). Each platform gets its own worker so a backed-up X queue doesn't block LinkedIn. `maxConcurrentJob` is per-platform.

Search attributes (`/libraries/nestjs-libraries/src/temporal/temporal.search.attribute.ts`) are auto-registered via `TemporalRegisterMissingSearchAttributesModule`.

Temporal is also used for **email sending** (not directly via the email service for queued mail). `EmailService` injects `TemporalService` and dispatches.

### AI / LLM Stack (extensive)

| Library | Version | Purpose |
|---------|---------|---------|
| `openai` | `^6.2.0` | OpenAI SDK (used in `OpenaiService`, `ExtractContentService`, AI image gen) |
| `@ai-sdk/openai` | `^2.0.52` | Vercel AI SDK provider |
| `@ag-ui/mastra` | `^1.0.1` | Mastra AG UI integration |
| `mastra` + `@mastra/core` + `@mastra/mcp` + `@mastra/memory` + `@mastra/pg` | `^1.3.19` / `^1.21.0` / `^1.4.1` / `^1.13.0` / `^1.8.5` | Mastra agent framework (writes to `mastra_*` Prisma tables) |
| `@modelcontextprotocol/sdk` | `^1.22.0` | MCP server bootstrap (`startMcp` in backend) |
| `@langchain/community` + `@langchain/core` + `@langchain/langgraph` + `@langchain/openai` + `@langchain/tavily` | `^1.1.27` / `^1.1.39` / `^1.2.8` / `^1.4.3` / `^1.2.0` | LangGraph powers `AgentGraphService` and `AgentGraphInsertService` in `/libraries/nestjs-libraries/src/agent/` |
| CopilotKit (`@copilotkit/runtime` and 3 react packages) | `1.10.6` | CopilotKit chat UI runtime mounted in backend |
| `fal` (used via `FalService`) | not pinned (uses `pLimit` wrapper in `/libraries/nestjs-libraries/src/openai/fal.service.ts`) | AI image generation; service exists but `@fal-ai/*` package is NOT in dependencies — uses HTTP calls or older SDK |

The `ChatModule` (`/libraries/nestjs-libraries/src/chat/chat.module.ts`) and `AgentModule` (graph-based AI) are separate concerns. MCP exposes Postiz as a tool to external agents.

### Email

| Provider | Library | File |
|----------|---------|------|
| Resend | `resend ^3.2.0` | `/libraries/nestjs-libraries/src/emails/resend.provider.ts` |
| Nodemailer (SMTP) | `nodemailer ^7.0.11` | `/libraries/nestjs-libraries/src/emails/node.mailer.provider.ts` |
| EmptyProvider (noop) | (own) | `/libraries/nestjs-libraries/src/emails/empty.provider.ts` |
| Selector | `EmailService` reads `process.env.EMAIL_PROVIDER` | `/libraries/nestjs-libraries/src/services/email.service.ts` |
| Templates | React-based (likely) under `/libraries/nestjs-libraries/src/emails/` | (see folder `emails/`) |

If `RESEND_API_KEY` is set, user activation is required (per `.env.example` comment).

### Authentication & Authorization

| Library | Version | Purpose |
|---------|---------|---------|
| `jsonwebtoken` + `@types/jsonwebtoken` | `^9.0.2` / `^9.0.5` | JWT signing/verification |
| `bcrypt` + `@types/bcrypt` | `^5.1.1` / `^5.0.2` | Password hashing |
| `@casl/ability` | `^6.5.0` | Permissions/RBAC (used in `PoliciesGuard`) |
| `cookie-parser` + `@types/cookie-parser` | `^1.4.7` / `^1.4.6` | Cookie parsing |
| `nestjs-real-ip` | `^3.0.1` | Behind-proxy real IP |

OAuth providers supported (per `.env.example`):
- **Generic OAuth (Authentik-style)**: `POSTIZ_OAUTH_*` env vars
- **GitHub OAuth** for sign-in: `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`

Postiz also acts as an **OAuth provider itself** (models `OAuthApp`, `OAuthAuthorization` in schema, `oauth/` routes in app).

JWT secret: `JWT_SECRET` env var (required).

### Other Backend Libraries

| Library | Version | Purpose |
|---------|---------|---------|
| `compression` | `^1.8.1` | gzip middleware |
| `multer` | `^1.4.5-lts.1` | File upload (NestJS) |
| `sharp` | `^0.33.4` | Image processing (resize, format conversion) |
| `canvas` | `^2.11.2` | Server-side canvas (for image gen) |
| `image-to-pdf` | `^3.0.2` | PDF conversion |
| `music-metadata` | `^7.14.0` | Audio file metadata |
| `subtitle` | `4.2.2-alpha.0` | Subtitle parsing |
| `file-type` | `^16.5.4` | MIME type detection |
| `fast-xml-parser` | `^4.5.1` | RSS/XML parsing |
| `parse5` | `^6.0.1` | HTML parsing |
| `rss-parser` | `^3.13.0` | RSS feeds |
| `striptags` + `remove-markdown` | `^3.2.0` / `^0.5.0` | Text cleaning |
| `dompurify` (via isomorphic) | `^3.10.0` | HTML sanitization |
| `slugify` | `^1.6.6` | URL slugs |
| `tldts` | `^6.1.47` | TLD parsing |
| `simple-statistics` | `^7.8.3` | Stats math |
| `bottleneck` | `^2.19.5` | Rate limiting |
| `async-mutex` | `^0.5.0` | Mutex |
| `p-limit` | `^3.1.0` | Concurrency limiting |
| `node-fetch` | `^3.3.2` | Fetch (server-side & SDK) |
| `ws`, `bufferutil`, `utf-8-validate` | `^8.18.0` / `^4.0.8` / `^5.0.10` | WebSockets |
| `dotenv` + `dotenv-cli` | `^16.5.0` / `^8.0.0` | Env loading (used in dev scripts) |
| `yargs` + `@types/yargs` | `^17.7.2` / `^17.0.32` | CLI parsing (commands app) |
| `evp_bytestokey` | `^1.0.3` | Crypto key derivation |
| `md5` + `sha256` | `^2.3.0` / `^0.2.0` | Hashing |
| `accept-language` | `^3.0.20` | Accept-Language header parser |
| `transloadit` | `^3.0.2` | Transloadit upload helper |
| `json-to-graphql-query` | `^2.2.5` | Used for GraphQL (LinkedIn?) |
| `reflect-metadata` | `^0.1.13` | NestJS decorator metadata |
| `rxjs` | `^7.8.0` | NestJS observables |
| `tslib` | `^2.3.0` | TS helpers |

### Storage & Uploads

| Library | Version | Purpose |
|---------|---------|---------|
| `@aws-sdk/client-s3` | `^3.787.0` | S3 client (Cloudflare R2 compatible) |
| `@aws-sdk/s3-request-presigner` | `^3.787.0` | Presigned URLs |
| Upload providers | (own) | `/libraries/nestjs-libraries/src/upload/`: `cloudflare.storage.ts`, `r2.uploader.ts`, `local.storage.ts`, `upload.factory.ts` |

`STORAGE_PROVIDER` env var: `local` or `cloudflare`. Local stores at `UPLOAD_DIRECTORY`, served via Next.js rewrite `/uploads/:path*` → `/api/uploads/:path*` (`apps/frontend/next.config.js` lines 47-56).

---

## 4. Build / Dev Tooling

### Root `/package.json` Scripts

| Script | Purpose |
|--------|---------|
| `pnpm dev` | Run extension + orchestrator + backend + frontend in parallel |
| `pnpm dev-backend` | Run backend + frontend only |
| `pnpm dev:backend`, `dev:frontend`, `dev:orchestrator` | Run one app |
| `pnpm dev:stripe` | Concurrently runs `stripe listen --forward-to localhost:3000/stripe` + dev |
| `pnpm dev:docker` | `docker compose -f ./docker-compose.dev.yaml up -d` (Postgres + Redis + pgAdmin + RedisInsight + Temporal stack) |
| `pnpm build` | Builds frontend + backend + orchestrator (`workspace-concurrency=1` to limit RAM) |
| `pnpm build:frontend`, `build:backend`, `build:orchestrator`, `build:extension` | Build one app |
| `pnpm pm2` | Reset PM2 + push DB + start all in PM2 + tail logs |
| `pnpm pm2-run` | Used inside Docker by `Dockerfile.dev` (line 28) |
| `pnpm prisma-generate` | `prisma@6.5.0 generate` against schema |
| `pnpm prisma-db-push` | `prisma@6.5.0 db push --accept-data-loss` |
| `pnpm prisma-db-pull` | Introspect existing DB |
| `pnpm prisma-reset` | Force reset + push |
| `pnpm publish-sdk` | Publishes `@postiz/node` |
| `pnpm test` | `jest --coverage --detectOpenHandles --reporters=default --reporters=jest-junit` |
| `pnpm postinstall` | Auto-runs `prisma-generate` |
| `pnpm docker-build`, `docker-create` | Local Docker image build/create scripts |

### Per-App Scripts

| App | dev | build | start |
|-----|-----|-------|-------|
| backend | `dotenv -e ../../.env -- nest start --watch --entryFile=./apps/backend/src/main` | `cross-env NODE_ENV=production nest build` | `node --experimental-require-module ./dist/apps/backend/src/main.js` |
| frontend | `dotenv -e ../../.env -- next dev -p 4200` | `next build` | `next start -p 4200` |
| orchestrator | `dotenv -e ../../.env -- nest start --watch --entryFile=./apps/orchestrator/src/main` | `cross-env NODE_ENV=production nest build` | `node --experimental-require-module ./dist/apps/orchestrator/src/main.js` |
| commands | `dotenv -e ../../.env -- nest start --watch --entryFile=./apps/command/src/main` | `cross-env NODE_ENV=production nest build` | `node ./dist/apps/command/src/main.js` |
| extension | `vite build --config vite.config.chrome.ts --mode development --watch` | `vite build && cp manifest.json dist/manifest.json && zip -r extension.zip` | (n/a) |
| sdk | (n/a) | `tsup` → CJS + d.ts → `dist/` | (n/a, library) |

The `--experimental-require-module` Node flag is used for backend/orchestrator runtime. PM2 (`pm2 start pnpm --name {app}`) wraps all 3 main apps in production.

### Docker

| File | Purpose |
|------|---------|
| `/Dockerfile.dev` | Single image bundling all apps (used despite name); base `node:22.20-bookworm-slim` + nginx + pnpm + pm2; runs `pnpm install && pnpm run build`, starts with `nginx && pnpm run pm2`. **There is no production-only Dockerfile** — `Dockerfile.dev` is also used in `build-containers.yml` to push `ghcr.io/gitroomhq/postiz-app:latest`. |
| `/docker-compose.yaml` | "Production-style" compose: postiz app + postgres:17-alpine + redis:7.2 + spotlight (Sentry debug) + Temporal stack (auto-setup 1.28.1, postgres:16, elasticsearch 7.17.27, admin-tools, ui 2.34.0). Header note: "Use docs.postiz.com for prod" — this file isn't authoritative. |
| `/docker-compose.dev.yaml` | Dev-only services: postgres:17-alpine + redis:7-alpine + pgAdmin 4 + RedisInsight + Temporal stack. Header: "**Do not use this yml for production. It is not up-to-date.**" |
| `/var/docker/docker-build.sh` | Local image build (target `dist` and `devcontainer`) |
| `/var/docker/docker-create.sh` | Creates and runs local container on ports 3000 + 4200 |
| `/var/docker/nginx.conf` | Reverse proxy: listens on `5000`, proxies `/api/` → `:3000`, serves `/uploads/` from disk, rest → frontend `:4200`. Sets pass-through headers: `Reload`, `Onboarding`, `Activate`, `Auth`, `Showorg`, `Impersonate`, `Accept-Language`. Client max body size 2G. |
| `/.devcontainer/devcontainer.json` | VSCode dev container config (image `localhost/postiz-devcontainer`, forwards 3000+4200) |
| `/.dockerignore` | Excludes node_modules, dist, .next, .git, .nx, etc. |
| `/dynamicconfig/development-sql.yaml` + `/dynamicconfig/development-cass.yaml` | Temporal dynamic config (mounted into temporal container) |

### `.env.example` Summary (`/.env.example`, 124 lines)

Required:
- `DATABASE_URL` (Postgres)
- `REDIS_URL`
- `JWT_SECRET`
- `FRONTEND_URL`, `NEXT_PUBLIC_BACKEND_URL`, `BACKEND_INTERNAL_URL`
- Cloudflare R2: `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_ACCESS_KEY`, `CLOUDFLARE_SECRET_ACCESS_KEY`, `CLOUDFLARE_BUCKETNAME`, `CLOUDFLARE_BUCKET_URL`, `CLOUDFLARE_REGION`

Optional (key categories):
- Email: `RESEND_API_KEY`, `EMAIL_FROM_ADDRESS`, `EMAIL_FROM_NAME`, `DISABLE_REGISTRATION`
- Storage: `STORAGE_PROVIDER` (`local`|`cloudflare`), `UPLOAD_DIRECTORY`, `NEXT_PUBLIC_UPLOAD_STATIC_DIRECTORY`
- Social media OAuth (28 keys): `X_*`, `LINKEDIN_*`, `REDDIT_*`, `GITHUB_*`, `BEEHIIVE_*`, `LISTMONK_*`, `THREADS_*`, `FACEBOOK_*`, `YOUTUBE_*`, `TIKTOK_*`, `PINTEREST_*`, `DRIBBBLE_*`, `DISCORD_*`, `SLACK_*`, `MASTODON_*`
- Chrome Extension: `EXTENSION_ID`
- AI: `OPENAI_API_KEY`
- Misc UI: `NEXT_PUBLIC_DISCORD_SUPPORT`, `NEXT_PUBLIC_POLOTNO`, `NOT_SECURED`, `API_LIMIT=30`
- Stripe: `FEE_AMOUNT=0.05`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_SIGNING_KEY`, `STRIPE_SIGNING_KEY_CONNECT`
- Generic OAuth (Authentik): `NEXT_PUBLIC_POSTIZ_OAUTH_DISPLAY_NAME`, `NEXT_PUBLIC_POSTIZ_OAUTH_LOGO_URL`, `POSTIZ_GENERIC_OAUTH`, `POSTIZ_OAUTH_URL`, `POSTIZ_OAUTH_AUTH_URL`, `POSTIZ_OAUTH_TOKEN_URL`, `POSTIZ_OAUTH_USERINFO_URL`, `POSTIZ_OAUTH_CLIENT_ID`, `POSTIZ_OAUTH_CLIENT_SECRET`, `POSTIZ_OAUTH_SCOPE`
- Short-link providers: `DUB_*`, `SHORT_IO_SECRET_KEY`, `KUTT_*`, `LINK_DRIP_*`
- Developer: `NX_ADD_PLUGINS=false`, `IS_GENERAL=true`

Vars mentioned in code but not in `.env.example`:
- `TEMPORAL_ADDRESS`, `TEMPORAL_TLS`, `TEMPORAL_API_KEY`, `TEMPORAL_NAMESPACE`
- `EMAIL_PROVIDER` (Resend / NodeMailer / Empty)
- `FACEBOOK_PIXEL_ACCESS_TOKEN`, `NEXT_PUBLIC_FACEBOOK_PIXEL`
- `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN`, `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_SPOTLIGHT`
- `MAIN_URL`
- `DATAFAST_WEBSITE_ID`
- `ORCHESTRATOR_PORT` (defaults `3002`)
- `PORT` (backend, defaults `3000`)

---

## 5. Testing

| Tool | Version | Source |
|------|---------|--------|
| Jest | `29.7.0` | root devDeps |
| `@types/jest` | `29.5.12` | devDeps |
| `ts-jest` | `^29.1.0` | devDeps |
| `babel-jest` | `29.7.0` | devDeps |
| `jest-environment-jsdom` | `29.7.0` | devDeps |
| `jest-environment-node` | `^29.4.1` | devDeps |
| `jest-junit` | `^16.0.0` | devDeps (CI report) |
| `jest-mock-extended` | `^4.0.0-beta1` | devDeps |
| `jsdom` | `~22.1.0` | devDeps |
| `@testing-library/react` | `16.3.0` | devDeps |
| Vitest | `3.1.4` | devDeps (likely for extension only) |
| `@vitest/ui` + `@vitest/coverage-v8` | `1.6.0` | devDeps |

Jest config:
- `/jest.config.ts` → uses `getJestProjects()` from `@nx/jest` (Nx is referenced even though there's no nx.json — leftover Nx scaffolding)
- `/jest.preset.js` → spreads `@nx/jest/preset`
- `/package.json` test script: `jest --coverage --detectOpenHandles --reporters=default --reporters=jest-junit`
- jest-junit output: `./reports/junit.xml`

**Test coverage status: essentially zero.** A repo-wide search for `*.test.*` and `*.spec.*` (excluding `node_modules`) found **no test files**. There are no e2e tests, no Playwright/Cypress configs, no `e2e/` directories. The Jest setup exists but isn't used. SonarQube exclusions (`sonar-project.properties` line 7) explicitly exclude `**/*.spec.ts,**/*.test.ts` so even if tests existed they would be excluded from coverage.

This is a major risk for refactoring. Any UI rebuild for mobile must **avoid relying on test safety nets** — there are none.

---

## 6. CI / CD / Deployment

### `.github/workflows/`

| File | Trigger | Purpose |
|------|---------|---------|
| `build.yml` | `push` (any branch) | Install deps + `pnpm run build` on Node 22.12.0 with pnpm 8 (matrix). Caches pnpm store + `.next/cache`. |
| `build-containers.yml` | `workflow_dispatch` + tag push | Multi-arch (amd64 + arm64) Docker buildx build of `Dockerfile.dev`, pushes to `ghcr.io/gitroomhq/postiz-app:{tag}` and `:latest`. Manifests merged at the end. |
| `build-extension.yaml` | `workflow_dispatch` | Builds Chrome extension (`pnpm run build:extension`) with `FRONTEND_URL=https://platform.postiz.com`, uploads zip to Nextcloud. |
| `publish-extension.yml` | `workflow_dispatch` | Builds and publishes extension to Chrome Web Store via `mnao305/chrome-extension-upload@v5.0.0`. Secrets: `CHROME_EXTENSION_ID`, `CHROME_CLIENT_ID`, `CHROME_CLIENT_SECRET`, `CHROME_REFRESH_TOKEN`. |
| `codeql.yml` | `push` to `main` (paths apps/** + libraries/**) | GitHub CodeQL javascript-typescript analysis (`build-mode: none`). |
| `eslint` (file, not subfolder) | `push` to main + PR | Runs ESLint on backend + frontend with `@microsoft/eslint-formatter-sarif`, uploads SARIF to GitHub Security. **Looks for `apps/{service}/.eslintrc.json` which doesn't exist (root uses `eslint.config.mjs`) — this workflow appears broken.** |
| `pr-quality.yml` | PR opened/reopened | `peakoss/anti-slop@v0` — auto-rejects spam PRs (max 2 emojis, conventional title required, blocked terms include "Generated with Claude Code,Generated with Codex"). |
| `issue-label-triggers.yml` | issue labeled | Auto-comments + closes when label `trigger-public-website`. |
| `stale.yml` | every 30 min | `actions/stale@v9` — closes stale issues/PRs after 90+7 days; restricted to `gitroomhq/postiz-app` repo. |
| `Dependabot.yml` (config, not workflow) | — | Located at `/.github/Dependabot.yml` |

### Jenkins (`/Jenkins/`)

`Build.Jenkinsfile`: declarative pipeline that installs Node 20 + pnpm 8, runs `pnpm install && pnpm run build`, downloads SonarQube Scanner CLI 4.7.0.2747, runs analysis against `SonarQube-Server` installation. SHA-based `projectVersion`.

`BuildPR.Jenkinsfile`: same but with PR-specific Sonar params (`-Dsonar.pullrequest.key`, `-branch`, `-base`).

### Railway (`/railway.toml`)

```toml
[phases.setup]
    nixPkgs = ['nodejs', 'python3']
    aptPkgs = ['build-essential', 'libudev-dev']
```
Minimal — just adds `python3` (needed for `node-gyp`/`canvas`/native builds) and build tools. No service definitions; everything else is implicit Nixpacks defaults.

### SonarQube (`/sonar-project.properties`)

```properties
sonar.projectKey=gitroomhq_postiz-app_bd4cd369-af44-4d19-903b-c4bdb0b66022
sonar.projectName=Postiz App
sonar.javascript.node.maxspace=24576
sonar.exclusions=**/node_modules/**,**/dist/**,**/build/**,**/coverage/**,**/*.spec.ts,**/*.test.ts,*.png
```

---

## 7. Linting / Formatting

| Tool | Version | Config |
|------|---------|--------|
| ESLint | `8.57.0` | Root: `/eslint.config.mjs` (flat config) extending `next/core-web-vitals` and `next/typescript`. Frontend: `/apps/frontend/eslint.config.mjs` (flat config, separate). |
| `@typescript-eslint/eslint-plugin` | `7.18.0` | devDeps |
| `@typescript-eslint/parser` | `7.18.0` | devDeps |
| `eslint-config-next` | `16.2.1` | devDeps |
| `eslint-config-prettier` | `^9.0.0` | devDeps |
| `eslint-plugin-import` | `2.27.5` | devDeps |
| `eslint-plugin-jsx-a11y` | `6.7.1` | devDeps |
| `eslint-plugin-react` | `7.32.2` | devDeps |
| `eslint-plugin-react-hooks` | `4.6.0` | devDeps |
| Prettier | `^2.6.2` | `/.prettierrc` (only `singleQuote: true`) — **Prettier 2 is two majors behind**; Prettier 3 is current |

**Disabled ESLint rules in root config** (`/eslint.config.mjs`):
- `react/no-unescaped-entities`
- `@typescript-eslint/no-explicit-any` (so `any` is allowed!)
- `@typescript-eslint/no-unused-vars`
- `react/display-name`
- `@typescript-eslint/ban-ts-comment`
- `@typescript-eslint/no-empty-object-type`
- `@typescript-eslint/prefer-as-const`
- `@typescript-eslint/no-non-null-asserted-optional-chain`

This is permissive — does not enforce strict TS at lint level. The `/CLAUDE.md` instructs: "Linting of the project can run only from the root."

`.prettierignore`: `/dist`, `/coverage`, `/.nx/cache`. `.eslintignore`: `node_modules`.

---

## 8. SDK Package (`/apps/sdk`)

Published as `@postiz/node` v1.0.8 (npm). Single class `Postiz` (`/apps/sdk/src/index.ts`):
```typescript
new Postiz(apiKey, path = 'https://api.postiz.com')
```
Methods:
- `post(posts: CreatePostDto)` → POST `/public/v1/posts`
- `postList(filters: GetPostsDto)` → GET `/public/v1/posts?...`
- `upload(file: Buffer, extension: string)` → POST `/public/v1/upload` (multipart)
- `integrations()` → GET `/public/v1/integrations`
- `deletePost(id: string)` → DELETE `/public/v1/posts/{id}`

Authorization is sent as a raw `Authorization` header (no Bearer prefix). Uses `node-fetch ^3.3.2` (only runtime dep).

Build (`/apps/sdk/tsup.config.ts`):
- Entry: `src/index.ts`
- Format: `cjs` only (no ESM)
- Minify: true
- DTS: true
- Out: `dist/`

DTOs are imported from the shared `nestjs-libraries` (`CreatePostDto`, `GetPostsDto`) — so the SDK depends on workspace types but only ships the published surface.

---

## 9. Internationalization

| File | Purpose |
|------|---------|
| `/i18n.json` | Lingo.dev config — provider OpenAI `gpt-4.1`, source `en`, 14 target locales: `he, ru, zh, fr, bn, es, pt, de, it, ja, ko, ar, tr, vi`. Bucket includes `libraries/react-shared-libraries/src/translation/locales/[locale]/translation.json`. |
| `/i18n.lock` | Lingo.dev lockfile (40,499 lines!) — caches translation hashes |

Runtime stack:
- `i18next ^25.2.1` (core)
- `i18next-browser-languagedetector ^8.1.0` (client)
- `i18next-resources-to-backend ^1.2.1` (lazy-load resources)
- `react-i18next ^15.5.2` (React bindings)
- `i18n-iso-countries ^7.14.0` (country names)

Files at `/libraries/react-shared-libraries/src/translation/`:
- `i18n.config.ts` — defines `cookieName`, `fallbackLng`
- `i18next.ts` — i18next instance setup
- `get.transation.service.client.ts` — client-side `useT()` hook (used by `Menu`, etc.)
- `get.translation.service.backend.ts` — server-side translation in Next.js server components
- `translated-label.tsx` — wrapper component
- `locales/{en,de,es,fr,it,ja,ko,pt,ru,tr,vi,ar,bn,he,zh,ka_ge}/translation.json` — actual translations

Note: `ka_ge` (Georgian) is in `locales/` but **NOT listed in `i18n.json`** target locales — so it won't be auto-updated by Lingo.

Translation language is stored in a cookie (read in `(app)/layout.tsx`). Language fallback is the `fallbackLng` constant.

---

## 10. Observability & Analytics

| Service | Library | Notes |
|---------|---------|-------|
| Sentry (backend) | `@sentry/nestjs ^10.26.0`, `@sentry/profiling-node ^10.25.0` | `initializeSentry('backend', true)` first line of `main.ts` |
| Sentry (frontend) | `@sentry/nextjs ^10.26.0`, `@sentry/react ^10.25.0` | Wrapped via `withSentryConfig()` in `next.config.js` with sourcemap upload |
| Sentry Spotlight | `ghcr.io/getsentry/spotlight:latest` | Local debug Sentry receiver in `docker-compose.yaml` (port 8969) |
| PostHog | `posthog-js ^1.178.0` | `/libraries/react-shared-libraries/src/helpers/posthog.tsx` (`PHProvider`) |
| Plausible | `next-plausible ^3.12.0` | Wrapped in app layout — only enabled when `STRIPE_PUBLISHABLE_KEY` is set |
| Dub Analytics | `@dub/analytics ^0.0.32` | `components/layout/dubAnalytics.tsx` |
| Datafast | `https://datafa.st/js/script.js` | Optional script loaded from layout when `DATAFAST_WEBSITE_ID` is set |
| Facebook Pixel (server) | `facebook-nodejs-business-sdk ^21.0.5` + `@types/facebook-nodejs-business-sdk ^20.0.2` | Server-side Conversions API in `TrackService` (`/libraries/nestjs-libraries/src/track/track.service.ts`). Init via `FACEBOOK_PIXEL_ACCESS_TOKEN` + `NEXT_PUBLIC_FACEBOOK_PIXEL`. |

---

## 11. Chrome Extension (`/apps/extension`)

| Item | Value |
|------|-------|
| Manifest version | `manifest_version: 3` |
| Build tool | Vite 6 + `@crxjs/vite-plugin ^2.0.0-beta.32` (devDeps) + `@vitejs/plugin-react` |
| Dev hot-reload | `hot-reload-extension-vite ^1.0.13` (port 8081) |
| Background script | `dist/background.js` (ES module service worker) |
| Permissions | `cookies`, `alarms`, `storage` |
| Host permissions | `*://*.skool.com/*` + dynamic from `providers/provider.registry` |
| Externally connectable | `localhost`, `https://*.postiz.com/*` |
| Webextension polyfill | `webextension-polyfill ^0.12.0` |
| Output | `apps/extension/dist/` zipped to `apps/extension/extension.zip` |

Purpose (per package.json): "Postiz browser extension for cookie-based platform authentication" — used for platforms that don't expose OAuth (e.g. Skool). The extension grabs cookies and forwards to backend.

---

## 12. Quick Reference: Versions That Matter for Mobile UI Rebuild

| Concern | Version | Implication |
|---------|---------|-------------|
| Next.js | `16.2.1` | Bleeding edge (Next 16 is very new). App Router is mandatory. `proxyTimeout: 90_000` is set. Use server components carefully. |
| React | `19.2.4` | React 19 — `use()`, server actions, async transitions all available. `reactStrictMode: false` so don't rely on dev-mode double-invokes for catching bugs. |
| TailwindCSS | `3.4.17` | NOT Tailwind 4. Use v3 syntax. `darkMode: 'class'`. |
| Tailwind `mobile` breakpoint | `<= 1025px` | Covers tablets too. Means most "mobile" styles already apply on iPad. |
| `react-dnd-html5-backend` | `^16.0.1` | **Does not work on touch devices.** Replace with `react-dnd-touch-backend` or migrate calendar to `@dnd-kit/core`. |
| Mantine | `5.10.5` | Two majors behind. Hooks like `useClickOutside` are mostly stable across versions, but if you upgrade, expect breakage. |
| Zustand | `^5.0.5` | Latest. |
| SWR | `^2.2.5` | Latest stable. |
| Prisma | `6.5.0` | Use `db push` workflow — there are no migrations. Schema changes will lose data unless dump+restore. |
| Node | `>=22.12.0 <23.0.0` (engines) but `volta=20.17.0` | Use 22.12.x to match Docker. |
| pnpm | `10.6.1` | Pinned — don't switch package managers. |
| Tests | None exist | No safety net. Manual + e2e (you'll need to add) is the only check. |
| Frontend dev port | `4200` | Watch out: backend at `3000`, orchestrator at `3002`, nginx at `5000`, Temporal UI at `8080`. |

---

## 12. Known Tech-Stack Anomalies (For Awareness)

These are factual observations from the codebase, not opinions:

1. **Two Node versions in play**: Volta says 20.17.0, engines says 22.12.0+, ESLint workflow uses 20, Docker uses 22.20. Anything that hard-pins via Volta will get a lower version than what runs in containers.

2. **No migrations folder**: Prisma is run with `db push --accept-data-loss`. There is no migration history. For an installed user upgrading versions, schema changes are destructive unless they manually `prisma migrate diff` against a backup.

3. **`Dockerfile.dev` is the production image** — there is no separate `Dockerfile`. The `dev` suffix is misleading.

4. **`docker-compose.yaml` has a comment saying not to use it for production** — yet it's the only compose file that includes the app itself. The dev compose only runs infra.

5. **Two compose files duplicate the entire Temporal stack** — Postgres 16 + Elasticsearch 7.17.27 + Temporal 1.28.1 + admin-tools + UI 2.34.0 are defined in both files.

6. **Tailwind 4 is in deps but unused** — `@tailwindcss/postcss ^4.1.7`, `@tailwindcss/vite ^4.0.17`. Frontend explicitly uses Tailwind 3.4.17.

7. **Mantine v5 is two majors out of date** — only used for `useClickOutside` and a few hooks. Could be removed entirely for a cleaner mobile rebuild.

8. **Custom calendar (no `react-big-calendar`/`fullcalendar`)** — `apps/frontend/src/components/launches/calendar.tsx` is hand-written. The DnD layer uses HTML5 backend which doesn't support touch — this is the core mobile breakage.

9. **No tests** — `pnpm test` works but there are no `*.spec.ts`/`*.test.ts` files. SonarQube also excludes them.

10. **Mastra agent framework writes 8 tables to the main DB** — `mastra_*` tables are coupled to the application schema, not in a separate database.

11. **Nx remnants** — `jest.config.ts` imports `getJestProjects` from `@nx/jest` and `jest.preset.js` spreads `@nx/jest/preset`, but there is no `nx.json` or full Nx setup. The repo started as Nx and was migrated to plain pnpm workspaces. Some scaffolding remains.

12. **Node CLI flag `--experimental-require-module`** — backend and orchestrator start scripts use this flag. Means CommonJS/ESM interop is needed at runtime.

13. **OpenAI SDK is `openai ^6.2.0`** — **OpenAI SDK v6 was released in October 2025 and is currently unstable (major version `6.x`)**. The codebase pins to a moving target.

14. **Submodule for plugins** — `libraries/plugins/src/list/public-api` is a git submodule pointing at `git@github.com:gitroomhq/public-api.git`. Not present locally; needs `git submodule update --init` or it won't compile.

15. **`react/no-unescaped-entities` and `@typescript-eslint/no-explicit-any` are disabled** — TypeScript strictness is loose at lint level despite `strict: true` in tsconfig.

---

*End of tech-stack analysis. Other agents will produce architecture, mobile, and workflow documents.*
