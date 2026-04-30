# Postiz Architecture

**Analysis Date:** 2026-04-30
**Scope:** Architectural map of the Postiz fork (`/Users/lukas/Desktop/Coding/postiz-husatech/`).
**Audience:** Future Claude instances working on the mobile-first Postiz rewrite.
**Source of truth:** Real source files. The repo's own `CLAUDE.md` is partially wrong (claims Vite frontend; actual frontend is Next.js 16 App Router — verified via `apps/frontend/next.config.js` and `apps/frontend/package.json`).

---

## 1. Pattern Overview

**Overall:** PNPM workspace monorepo with five runtimes and three shared library packages. NestJS for all backend services, Next.js 16 App Router for the web client, Vite for the Chrome extension, tsup for the public SDK. Asynchronous post publishing is offloaded to **Temporal** (the `orchestrator` app is the worker host). Postgres + Prisma for app data, Redis for rate-limit state and OAuth handoffs, Elasticsearch behind Temporal. The whole codebase uses the TypeScript path alias `@gitroom/*` (origin name; package.json is still `"name": "gitroom"`) — `@gitroom/backend` -> `apps/backend/src`, `@gitroom/frontend` -> `apps/frontend/src`, `@gitroom/orchestrator` -> `apps/orchestrator/src`, `@gitroom/nestjs-libraries` -> `libraries/nestjs-libraries/src`, `@gitroom/helpers` -> `libraries/helpers/src`, `@gitroom/react` -> `libraries/react-shared-libraries/src`.

**Key Characteristics:**
- **Three NestJS apps share one DI module graph** via `libraries/nestjs-libraries` (`DatabaseModule`, `AgentModule`, `ChatModule`, `ThirdPartyModule`, `VideoModule`, Temporal modules). Backend, orchestrator, and the `commands` CLI all bootstrap a `NestFactory` and import the same Prisma services.
- **Strict 3-layer rule on backend:** Controller -> Service -> Repository (sometimes Controller -> Manager -> Service -> Repository). Controllers live in `apps/backend/src/api/routes/`; services + repositories live under `libraries/nestjs-libraries/src/database/prisma/<entity>/`.
- **All scheduled posting goes through Temporal.** The backend never publishes directly — it writes the `Post` row, then calls `PostsService.startWorkflow(...)` which signals/starts `postWorkflowV102` on Temporal. The orchestrator process is the Temporal worker that runs the workflow and dispatches activities (which call back into the Prisma services and the social provider classes).
- **Two parallel HTTP API surfaces** on the same Nest app: `/api/...` (cookie/JWT, internal frontend) and `/public/v1/...` (API-key or OAuth `pos_*` token, external SDK + MCP).
- **Multi-tenant by `Organization`.** Almost every database row hangs off `organizationId`. The `User` <-> `Organization` join is `UserOrganization` with `Role` (SUPERADMIN/ADMIN/USER). Auth middleware resolves both the `User` and the active `Organization` per request.
- **AI is first-class:** Mastra agents (`libraries/nestjs-libraries/src/chat/`) expose Postiz tools both via CopilotKit (in-app chat sidebar) and via **MCP** (Model Context Protocol) endpoints (`/mcp`, `/mcp/:id`, `/mcp-oauth`, `/sse/:id`) mounted in `main.ts`.
- **Browser extension is for cookie scraping**, not a content script. It reads cookies from social platforms (currently only Skool) and posts them back to `/integrations/extension-refresh` so the backend can authenticate as the user without their password.

---

## 2. Top-Level Layout

```
postiz-husatech/
|-- apps/
|   |-- backend/            # NestJS HTTP API (port 3000) - controllers + auth + entry point
|   |-- frontend/           # Next.js 16 App Router (port 4200)
|   |-- orchestrator/       # NestJS Temporal worker (port 3002 health) - runs workflows + activities
|   |-- extension/          # Vite-built Chrome MV3 extension (cookie scraper)
|   |-- sdk/                # @postiz/node - tsup-bundled public REST client
|   `-- commands/           # NestJS CLI (nestjs-command) - refresh tokens, run agent, configuration
|-- libraries/
|   |-- nestjs-libraries/   # All shared backend logic (services, repositories, integrations, AI, dtos)
|   |-- helpers/            # Cross-runtime helpers (auth JWT, fetch wrapper, swagger, subdomain)
|   `-- react-shared-libraries/  # Shared React UI primitives, i18n, toaster, variable context
|-- prisma schema lives at libraries/nestjs-libraries/src/database/prisma/schema.prisma
|-- docker-compose.yaml          # Production single-container postiz + postgres + redis + temporal stack
|-- docker-compose.dev.yaml      # Dev infra only (postgres, redis, temporal cluster, pgAdmin)
|-- pnpm-workspace.yaml          # apps/* + libraries/*
|-- package.json                 # ROOT package.json holds ALL prod deps - apps/* package.json are nearly empty
`-- tsconfig.base.json           # path aliases (@gitroom/*)
```

**Workspace dependency model (notable):** `package.json` at the root holds every runtime dependency for all apps. Each `apps/*/package.json` only contains scripts (`dev`, `build`, `start`, `pm2`). This is unusual — there is no per-app dependency boundary. Adding a dep means editing root `package.json`.

---

## 3. The Five Apps

### 3.1 `apps/backend` — Public-facing HTTP API (NestJS)

- **Entrypoint:** `apps/backend/src/main.ts` — bootstraps NestFactory, installs Sentry, sets `process.env.TZ='UTC'`, configures CORS (allows `auth`, `showorg`, `impersonate` headers — these are the multi-tenant routing headers), registers global `ValidationPipe`, mounts cookie-parser + compression, attaches global filters (`SubscriptionExceptionFilter`, `HttpExceptionFilter`), starts Swagger via `loadSwagger`, and **calls `startMcp(app)`** which registers the MCP endpoints (`/mcp`, `/mcp/:id`, `/mcp-oauth`, `/sse/:id`, `/.well-known/oauth-*`) before listening on `PORT` (default 3000).
- **Root module:** `apps/backend/src/app.module.ts` — `@Global()`, imports:
  - `DatabaseModule` (all Prisma services)
  - `ApiModule` (the cookie-auth REST API, see 3.1.1)
  - `PublicApiModule` (the API-key REST API, see 3.1.2)
  - `AgentModule` (graph services for AI agent)
  - `ThirdPartyModule` (Heygen, Reelfarm)
  - `VideoModule` (Veo3, image-slides)
  - `ChatModule` (Mastra service + tool list)
  - `getTemporalModule(false)` — Temporal **client** only (no workers in this process)
  - `TemporalRegisterMissingSearchAttributesModule` (registers custom search attributes `postId`, `organizationId`)
  - `InfiniteWorkflowRegisterModule` (kicks off `missingPostWorkflow` if `RUN_CRON=true`)
  - `ThrottlerModule` backed by Redis (`@nest-lab/throttler-storage-redis`, default 30 req/h)
  - Sentry NestJS module
- **Global guards:** `ThrottlerBehindProxyGuard` then `PoliciesGuard` (CASL-based; reads `@CheckPolicies(...)` decorators on controller methods, evaluates against `org` + `role` + `Section/Action`). Throws `SubscriptionException` if the org's plan doesn't permit the section.

#### 3.1.1 `ApiModule` — internal API for the web frontend

Located at `apps/backend/src/api/api.module.ts`. Mounts these controllers (all under whatever path `@Controller('/...')` declares — there is **no global prefix**):

| Controller | File | Path | Auth | Purpose |
|---|---|---|---|---|
| `RootController` | `routes/root.controller.ts` | `GET /` | none | Health/version |
| `StripeController` | `routes/stripe.controller.ts` | `POST /stripe` | webhook signature | Stripe webhook receiver |
| `AuthController` | `routes/auth.controller.ts` | `/auth/*` | none (login flow) | register, login, forgot, activate, OAuth provider exchange, mobile OAuth callback |
| `PublicController` | `routes/public.controller.ts` | `/public/*` | none | Posts preview, agent (server-sent agent stream), Stripe-related, crypto callbacks |
| `MonitorController` | `routes/monitor.controller.ts` | `GET /monitor/queue/:name` | none | Queue health |
| `EnterpriseController` | `routes/enterprise.controller.ts` | `/enterprise/*` | none | Enterprise create-user, URL, delete-channel |
| `NoAuthIntegrationsController` | `routes/no.auth.integrations.controller.ts` | `/integrations/*` (subset) | none | OAuth-callback handling, `social-connect/:integration`, `extension-refresh` (extension cookies in) |
| `OAuthController` + `OAuthAuthorizedController` | `routes/oauth.controller.ts` | `/oauth/authorize`, `/oauth/token` | mixed | Postiz-as-OAuth-provider for 3rd-party apps |
| **Authenticated controllers (cookie-JWT via `AuthMiddleware`):** | | | | |
| `UsersController` | `routes/users.controller.ts` | `/user/*` | cookie | self, personal, impersonate, email-notifs, api-key/rotate, subscription, organizations, change-org, logout |
| `AnalyticsController` | `routes/analytics.controller.ts` | `/analytics/:integration`, `/analytics/post/:postId` | cookie | per-channel and per-post analytics |
| `IntegrationsController` | `routes/integrations.controller.ts` | `/integrations/*` | cookie | provider connect, list, settings, plugs, mentions, telegram updates, moltbook |
| `SettingsController` | `routes/settings.controller.ts` | `/settings/*` | cookie | team, shortlink |
| `PostsController` | `routes/posts.controller.ts` | `/posts/*` | cookie | CRUD posts, find-slot, statistics, comments, tags, separate-posts, generator/draft |
| `MediaController` | `routes/media.controller.ts` | `/media/*` | cookie | upload, generate-image, generate-video, video-options, save-media |
| `BillingController` | `routes/billing.controller.ts` | `/billing/*` | cookie | embedded, subscribe, portal, lifetime, charges, refund, crypto |
| `NotificationsController` | `routes/notifications.controller.ts` | `/notifications/*` | cookie | list |
| `CopilotController` | `routes/copilot.controller.ts` | `/copilot/*` | cookie | `POST /chat`, `POST /agent`, `GET /credits`, `GET /:thread/list`, `GET /list` — CopilotKit + Mastra agent stream |
| `WebhookController` | `routes/webhooks.controller.ts` | `/webhooks/*` | cookie | CRUD webhooks, send |
| `SignatureController` | `routes/signature.controller.ts` | `/signatures/*` | cookie | CRUD post signatures |
| `AutopostController` | `routes/autopost.controller.ts` | `/autopost/*` | cookie | RSS-driven auto-posting CRUD + active toggle |
| `SetsController` | `routes/sets.controller.ts` | `/sets/*` | cookie | post sets (templates) |
| `ThirdPartyController` | `routes/third-party.controller.ts` | `/third-party/*` | cookie | Heygen/Reelfarm credentials, function/import |
| `OAuthAppController` | `routes/oauth-app.controller.ts` | `/user/oauth-app/*` | cookie | manage your OAuth apps (Postiz acting as IdP) |
| `ApprovedAppsController` | `routes/approved-apps.controller.ts` | `/user/approved-apps/*` | cookie | apps user authorized |
| `AnnouncementsController` | `routes/announcements.controller.ts` | `/announcements/*` | cookie | platform announcements |
| `AdminController` | `routes/admin.controller.ts` | `/admin/*` | cookie + SUPERADMIN | errors, errors/platforms |

`AuthMiddleware` (`apps/backend/src/services/auth/auth.middleware.ts`) is registered in `ApiModule.configure()` for all entries in `authenticatedController[]`. It reads JWT from cookie `auth` (or `auth` header for cross-origin), supports `impersonate` via cookie/header for super-admins, resolves the active org from cookie `showorg`, and attaches `req.user` + `req.org`. Public auth (`PublicAuthMiddleware`) reads `Authorization` and routes to either OAuth-token (`pos_*` prefix) or API-key lookup.

#### 3.1.2 `PublicApiModule` — external REST API

`apps/backend/src/public-api/public.api.module.ts` mounts a single controller — `PublicIntegrationsController` at `/public/v1/*`. Endpoints (verified in `apps/backend/src/public-api/routes/v1/public.integrations.controller.ts`):

```
POST   /public/v1/upload                        multipart upload to Media
POST   /public/v1/upload-from-url               server-side download with SSRF-safe dispatcher
GET    /public/v1/find-slot/:id?                next available posting time slot
GET    /public/v1/posts                         list posts (filtered)
POST   /public/v1/posts                         schedule a post (triggers Temporal via PostsService.createPost)
DELETE /public/v1/posts/:id                     delete by id
DELETE /public/v1/posts/group/:group            delete by post group
GET    /public/v1/is-connected                  health check for client
GET    /public/v1/integrations                  list connected channels
GET    /public/v1/social/:integration           start OAuth flow, returns redirect URL
GET    /public/v1/notifications                 paginated
POST   /public/v1/generate-video                AI video gen
POST   /public/v1/video/function                video step function (Veo3)
DELETE /public/v1/integrations/:id              disconnect channel + delete its posts
GET    /public/v1/integration-settings/:id      provider rules + max length + zod schema
GET    /public/v1/posts/:id/missing             missing media check
PUT    /public/v1/posts/:id/status              draft <-> schedule
PUT    /public/v1/posts/:id/release-id          attach platform-side post id
GET    /public/v1/analytics/:integration?date=  per-channel analytics
GET    /public/v1/analytics/post/:postId?date=  per-post analytics
POST   /public/v1/integration-trigger/:id       call any provider tool method by name
```

This is the surface the SDK (`apps/sdk/src/index.ts`) and external integrators consume.

#### 3.1.3 Auth and permissions (backend)

- JWT issuance/verification: `libraries/helpers/src/auth/auth.service.ts`. Used by middleware.
- `apps/backend/src/services/auth/auth.service.ts` (`AuthService`) — orchestrates registration, login, forgot password, OAuth provider redirect.
- `apps/backend/src/services/auth/providers/`: `github.provider.ts`, `google.provider.ts`, `farcaster.provider.ts`, `wallet.provider.ts`, `oauth.provider.ts` (generic OIDC), `providers.manager.ts`. `Provider` enum in Prisma: `LOCAL`, `GITHUB`, `GOOGLE`, `FARCASTER`, `WALLET`, `GENERIC`.
- `apps/backend/src/services/auth/permissions/`:
  - `permissions.guard.ts` — global `PoliciesGuard`. Skips `/auth/*`, `/integrations/social-connect/*`, `/integrations/provider/*`. Reads `@CheckPolicies` metadata.
  - `permissions.service.ts` — builds CASL `Ability` from org + role + subscription.
  - `permission.exception.class.ts` — `Sections` (POSTS_PER_MONTH, CHANNEL, etc.) and `AuthorizationActions`.
  - `subscription.exception.ts` — turns CASL deny into an HTTP payment-required-style error.

### 3.2 `apps/frontend` — Next.js 16 App Router web client

**Verified:** `apps/frontend/package.json` declares `next dev -p 4200`; `apps/frontend/next.config.js` exists with `withSentryConfig`. App Router is in use. (CLAUDE.md's "Vite ReactJS" claim is wrong.) React 19.2.4. Dev server on port 4200.

**Frontend structure:**

```
apps/frontend/src/
|-- app/                              # Next.js App Router
|   |-- layout.tsx (only via groups)
|   |-- global-error.tsx              # Sentry error boundary
|   |-- global.scss / colors.scss     # Tailwind 3 base
|   |-- polonto.css
|   |-- (app)/                        # Main authenticated app - has layout.tsx
|   |   |-- layout.tsx                # Sentry + i18n + Plus_Jakarta_Sans + VariableContextComponent + Plausible + Posthog + LayoutContext
|   |   |-- (site)/                   # Routes that render inside the chrome with sidebar
|   |   |   |-- layout.tsx
|   |   |   |-- launches/page.tsx     # -> <LaunchesComponent /> (calendar - main app surface)
|   |   |   |-- analytics/page.tsx
|   |   |   |-- billing/page.tsx + lifetime/page.tsx
|   |   |   |-- settings/page.tsx
|   |   |   |-- media/page.tsx
|   |   |   |-- plugs/page.tsx        # automation plugs
|   |   |   |-- third-party/page.tsx
|   |   |   |-- err/page.tsx
|   |   |   |-- admin/errors/page.tsx
|   |   |   `-- agents/page.tsx + [id]/page.tsx + layout.tsx   # AI agent threads
|   |   |-- (preview)/p/[id]/         # public post preview (no auth)
|   |   |-- auth/                     # login, register, forgot, activate
|   |   |-- api/uploads/              # local file proxy when STORAGE_PROVIDER=local
|   |   |-- integrations/social/[provider]/page.tsx  # OAuth callback landing
|   |   `-- oauth/authorize/          # Postiz-as-OAuth-IdP consent screen
|   |-- (extension)/                  # Standalone layout for browser-extension iframes
|   |   |-- layout.tsx                # No sentry/plausible - minimal context
|   |   `-- modal/[style]/[platform]/page.tsx
|   `-- (provider)/                   # Iframe-based bridge for OAuth provider redirects
|       |-- layout.tsx
|       `-- provider/add/page.tsx + [p]/{page,bridge,in-bridge}.tsx
|-- proxy.ts                           # Next.js middleware (config.matcher excludes /api, /_next, /_static, /_vercel, dotted paths)
|-- instrumentation.ts                 # Sentry server-side init
|-- sentry.edge.config.ts / sentry.server.config.ts
`-- components/                        # All React components - see 3.2.2
```

**`proxy.ts` is the Next.js middleware** (re-exported as `proxy` and bound via Next's middleware contract). Responsibilities:
- Locale resolution (cookie `i18next` or `Accept-Language`) — sets `headerName` for SSR translation
- Auth gating: if no `auth` cookie and not on `/auth/*` -> redirect to `/auth?provider=...`
- Logout: clears `auth` cookie scoped to FRONTEND_URL apex domain
- Org join via `?org=...` query — calls backend `/user/join-org` and sets `showorg` cookie
- Root path `/` redirects to `/launches` (when `IS_GENERAL=true`) or `/analytics`
- Login-required modal redirect for `/modal/*`
- Skips `/uploads/*`, `/p/*`, `/provider/*`, `/icons/*`, `/integrations/social/*` (except login state)

#### 3.2.1 Frontend <-> backend communication

There is **no GraphQL, no tRPC**. Pure REST over JSON, plus SSE streams for the AI agent and CopilotKit.

- **From the browser:** `useFetch()` hook (`libraries/helpers/src/utils/custom.fetch.tsx`) -> `customFetch()` (`libraries/helpers/src/utils/custom.fetch.func.ts`). Base URL is injected through `VariableContextComponent` from `process.env.NEXT_PUBLIC_BACKEND_URL`. SWR is the data layer (rule: every SWR call must be in its own custom hook for `react-hooks/rules-of-hooks` compliance — per the repo's `CLAUDE.md`).
- **From server components / Next middleware:** `internalFetch()` (`libraries/helpers/src/utils/internal.fetch.ts`) reads `cookies()` and dispatches to `process.env.BACKEND_INTERNAL_URL` with `auth` and `showorg` cookies forwarded as headers.
- **WebSocket?** No long-lived WS in app code. The MCP server uses **SSE** (`/sse/:id` + `/message/:id`). CopilotKit `/copilot/agent` also returns a streaming response.
- **MCP** is exposed at `/mcp`, `/mcp/:id` (API-key in URL, used for personal MCP), `/mcp-oauth` (OAuth-protected) — registered in `libraries/nestjs-libraries/src/chat/start.mcp.ts` and called from `apps/backend/src/main.ts:50`.

#### 3.2.2 `apps/frontend/src/components/` layout

```
admin/                  # admin tooling
agents/                 # AI agent UI (chat, input, textarea)
analytics/              # charts (chart.js based) + stars/forks
approved-apps/
auth/                   # login.tsx, register.tsx, forgot.tsx, activate.tsx, OIDC button, web3 nayner button
autopost/
billing/                # billing.component.tsx, embedded.billing.tsx, lifetime.deal.tsx, finish.trial.tsx, faq, purchase.crypto
developer/
launches/               # CALENDAR - the main scheduling surface
|   |-- calendar.tsx               (the calendar grid; supports 'week'|'month'|'day'|'list' via cookie 'calendar-display')
|   |-- calendar.context.tsx       (CalendarContext, SWR-driven posts loader, drag-and-drop reschedule)
|   |-- launches.component.tsx     (page wrapper)
|   |-- new.post.tsx, add.provider.component.tsx, polonto.tsx (image editor)
|   |-- ai.image.tsx, ai.video.tsx (AI generation modals)
|   |-- filters.tsx, time.table.tsx, statistics.tsx
|   |-- helpers/                   (date.picker, dnd.provider, use.integration.list, use.values, etc.)
|   |-- menu/menu.tsx, comments/comment.component.tsx
|   `-- generator/generator.tsx
layout/                 # Top menu, organization selector, language, settings, mode (light/dark), streak, support, drop-files, impersonate, layout.context.tsx, user.context.tsx, set.timezone.tsx
media/                  # media.component.tsx, new.uploader.tsx (Uppy)
new-launch/             # NEW post composer (TipTap editor, picks-socials, modal wrapper)
new-layout/             # Newer chrome (logo, menu-item, mobile.integration.tsx <- worth inspecting for mobile work, change.dir.client (RTL), sentry.feedback)
notifications/
onboarding/             # github.onboarding, onboarding.modal
platform-analytics/
plugs/                  # automation plug builder
post-url-selector/
preview/, provider-preview/, public-api/
sets/                   # post-set manager
settings/
standalone-modal/       # used by (extension)/modal/[style]/[platform]
third-parties/
ui/                     # logo-text, check.icon, icons/, is.scroll.hook, translated-label
videos/
webhooks/
signature.tsx
```

**Mobile-relevant entry points already in tree:**
- `components/new-layout/mobile.integration.tsx` — there is *some* prior mobile awareness
- `components/launches/calendar.tsx` — has a `'list'` view in addition to week/month/day. List view fetches a different endpoint (`/posts-list-...`).

### 3.3 `apps/orchestrator` — Temporal worker (NestJS)

- **Entrypoint:** `apps/orchestrator/src/main.ts` — `NestFactory.create(AppModule)`, listens on `ORCHESTRATOR_PORT` (default 3002) only for the `/health` controller. The actual work is the Temporal worker(s) which Nest's lifecycle starts.
- **Module:** `apps/orchestrator/src/app.module.ts` imports `DatabaseModule` and `getTemporalModule(true, require.resolve('./workflows'), [PostActivity, AutopostService, EmailActivity, IntegrationsActivity])`. The `true` flag means **this process spawns workers**.
- **Worker fanout:** `getTemporalModule()` (`libraries/nestjs-libraries/src/temporal/temporal.module.ts`) registers one worker per task queue: `'main'` plus one per social integration (e.g. `x`, `linkedin`, `reddit`, ...). The task queue name is `integration.identifier.split('-')[0]`. This means each provider gets its own worker concurrency budget (`maxConcurrentJob` per provider).
- **Workflows** (`apps/orchestrator/src/workflows/`):
  - `post-workflows/post.workflow.v1.0.1.ts` and `v1.0.2.ts` — the production post workflow. v1.0.2 is what `PostsService.startWorkflow` triggers. It:
    1. Sleeps until `publishDate`
    2. Calls `postSocial` activity (provider-specific task queue)
    3. Optionally posts comment thread
    4. Sends webhooks
    5. Loads internal+global plugs (e.g. repost-on-likes), sorts by delay, processes them
    6. If `intervalInDays`, starts a child workflow as repeat-post
    7. On `refresh_token` ApplicationFailure, transparently refreshes the OAuth token and retries
  - `autopost.workflow.ts` — RSS-driven hourly poll of an `AutoPost` row
  - `digest.email.workflow.ts` — long-lived per-org email queue, batches notifications hourly using `setHandler(emailSignal)` + `condition` + `continueAsNew`
  - `send.email.workflow.ts` — one-shot sendEmail
  - `streak.workflow.ts` — 22-hour sleep then warn user about losing streak
  - `refresh.token.workflow.ts` — sleeps until `tokenExpiration`, then refreshes
  - `missing.post.workflow.ts` — registered once on backend boot via `InfiniteWorkflowRegisterModule` when `RUN_CRON=true`; loops every hour calling `searchForMissingThreeHoursPosts` activity
- **Activities** (`apps/orchestrator/src/activities/`):
  - `post.activity.ts` — `PostActivity` class. Methods: `getPostsList`, `inAppNotification`, `changeState`, `updatePost`, `sendWebhooks`, `isCommentable`, `postSocial`, `postComment`, `getIntegrationById`, `refreshTokenWithCause`, `internalPlugs`, `globalPlugs`, `processInternalPlug`, `processPlug`, `searchForMissingThreeHoursPosts`. Each is `@ActivityMethod()`. It depends on `PostsService`, `NotificationService`, `IntegrationManager`, `IntegrationService`, `RefreshIntegrationService`, `WebhooksService`, `TemporalService`, `SubscriptionService`.
  - `email.activity.ts` — `sendEmailAsync`, `getUserOrgs`, `setStreak`
  - `integrations.activity.ts` — `getIntegrationsById`, `refreshToken`
  - `autopost.activity.ts` — `autoPost(id)`
- **Signals** (`apps/orchestrator/src/signals/`): `email.signal.ts` (`emailSignal`, type `Email`), `send.email.signal.ts`. Plus the inline `poke` signal in `post.workflow.v1.0.2.ts` for waking up sleeping workflows.

**Where Temporal is invoked from the backend** (verified):
| Service | Call | Workflow |
|---|---|---|
| `posts.service.ts:709` | `client.workflow.start('postWorkflowV102', ...)` | post-publish |
| `autopost.service.ts` | `client.workflow.start('autoPostWorkflow', ...)` | RSS auto-post |
| `notification.service.ts` | `client.workflow.signalWithStart('digestEmailWorkflow', ...)` | per-org email digest |
| `refresh.integration.service.ts` | `client.workflow.start('refreshTokenWorkflow', ...)` | token refresh schedule |
| `services/email.service.ts` | `client.workflow.signalWithStart('sendEmailWorkflow', ...)` | one-shot email |
| `infinite.workflow.register.ts` | `client.workflow.start('missingPostWorkflow', ...)` (only if `RUN_CRON=true`) | safety-net poller |
| `post.activity.ts:52` | `client.workflow.signalWithStart('postWorkflowV102', { signal: 'poke', ... })` | recover stuck posts |

Search attributes used: `postId`, `organizationId` (registered via `TemporalRegisterMissingSearchAttributesModule`).

### 3.4 `apps/extension` — Chrome MV3 cookie-scraper

- **Verified entrypoint:** `apps/extension/src/background.ts` (210 lines). MV3 service worker.
- **Manifest** (`apps/extension/manifest.json`): permissions = `cookies`, `alarms`, `storage`. Host permission only `*://*.skool.com/*`. **No content scripts**, no UI, no popup. `externally_connectable.matches` = `localhost`, `*.postiz.com`.
- **What it does:**
  - Listens for `chrome.runtime.onMessageExternal` from the Postiz web app
  - Origin allow-list checked via regex (`localhost*` and `*.postiz.com`)
  - Message types: `PING`, `GET_PROVIDERS`, `GET_COOKIES`, `STORE_REFRESH_TOKEN`, `REMOVE_REFRESH_TOKEN`
  - On `STORE_REFRESH_TOKEN` it persists `{jwt, backendUrl, provider}` to `chrome.storage.local` and registers a 24-hour `chrome.alarms` job that re-extracts cookies and POSTs them to `${backendUrl}/integrations/extension-refresh` (base64-encoded JSON)
- **Provider registry:** `apps/extension/src/providers/list/skool.provider.ts` (currently the only provider — but the registry pattern + `cookies: [{name, required}]` interface scales to others). `apps/extension/src/providers/cookie-provider.interface.ts` declares `CookieProvider` shape: `identifier`, `name`, `url`, `cookies: {name, required}[]`.
- **Backend hook:** `apps/backend/src/api/routes/no.auth.integrations.controller.ts:325` — `@Post('/extension-refresh')` receives `{jwt, cookies}` and updates the integration token. Verifies `integrationProvider?.isChromeExtension` flag on the social provider.
- **Build:** Vite (`vite.config.chrome.ts`, `vite.config.base.ts`, `custom-vite-plugins.ts`) — outputs to `dist/` and zips as `extension.zip`.

### 3.5 `apps/sdk` — `@postiz/node` external client

- 95-line single file: `apps/sdk/src/index.ts`. Built via tsup (`apps/sdk/tsup.config.ts`).
- Wraps the public REST API (`/public/v1/*`) with five methods: `post()`, `postList()`, `upload()`, `integrations()`, `deletePost()`.
- Authenticates via `Authorization` header containing the org's API key (no `Bearer` prefix — verified in `PublicAuthMiddleware`).
- Imports DTOs **directly from the backend**: `import { CreatePostDto } from '@gitroom/nestjs-libraries/dtos/posts/create.post.dto'`. This is fragile cross-package coupling — the SDK ships the DTO types. Default base URL: `https://api.postiz.com`.

### 3.6 `apps/commands` — NestJS CLI

- Bootstraps `NestFactory.createApplicationContext(CommandModule)` and runs the `nestjs-command` `CommandService`.
- Tasks (`apps/commands/src/tasks/`):
  - `refresh.tokens.ts` — manual token refresh
  - `configuration.ts` — environment validation
  - `agent.run.ts` — runs the Mastra agent from CLI
- Imports `DatabaseModule` and `AgentModule` — full DI access. Used for cron-style operations and for `pnpm commands:build:development`.

---

## 4. Shared libraries

### 4.1 `libraries/nestjs-libraries/src/`

```
agent/
|-- agent.categories.ts             # post category taxonomy
|-- agent.topics.ts                 # topic seeds
|-- agent.graph.service.ts          # LangGraph state machine for post generation
|-- agent.graph.insert.service.ts   # variant for "insert into existing post"
`-- agent.module.ts                 # @Global module exposes both services
chat/                                # AI agent runtime + MCP
|-- mastra.service.ts               # Mastra agent factory; uses @mastra/core, @mastra/memory, @mastra/pg
|-- mastra.store.ts
|-- load.tools.service.ts           # composes tools at request time
|-- start.mcp.ts                    # mounts /mcp, /mcp/:id, /mcp-oauth, /sse/:id, /.well-known/oauth-* on the Nest Express app
|-- oauth-middleware.ts + oauth-types.ts   # OAuth resource server impl for MCP
|-- async.storage.ts                # AsyncLocalStorage for request -> org context inside tools
|-- auth.context.ts
|-- rules.description.decorator.ts  # collects per-provider posting rules
|-- validation.schemas.helper.ts    # converts DTOs to JSON Schema for tools
|-- agent.tool.interface.ts
|-- chat.module.ts                  # @Global; provides MastraService, LoadToolsService, ...toolList
`-- tools/
    |-- tool.list.ts                # registers all tools
    |-- generate.image.tool.ts
    |-- generate.video.tool.ts
    |-- generate.video.options.tool.ts
    |-- integration.list.tool.ts
    |-- integration.schedule.post.ts
    |-- integration.trigger.tool.ts
    |-- integration.validation.tool.ts
    `-- video.function.tool.ts
crypto/
`-- nowpayments.ts                  # crypto subscription provider
database/
`-- prisma/
    |-- schema.prisma               # 959 lines - see 5
    |-- prisma.service.ts           # exports PrismaService, PrismaRepository, PrismaTransaction
    |-- database.module.ts          # @Global; wires every <entity>.service + <entity>.repository
    |-- agencies/{agencies.service.ts, agencies.repository.ts}
    |-- announcements/...
    |-- autopost/...
    |-- errors/...
    |-- integrations/{integration.service.ts, integration.repository.ts}
    |-- media/...
    |-- notifications/...
    |-- oauth/{oauth.service.ts, oauth.repository.ts}
    |-- organizations/{organization.service.ts, organization.repository.ts}
    |-- posts/{posts.service.ts, posts.repository.ts}    # 1011 + 888 lines - biggest service
    |-- sets/...
    |-- signatures/...
    |-- subscriptions/{subscription.service.ts, subscription.repository.ts, pricing.ts}
    |-- third-party/...
    |-- users/{users.service.ts, users.repository.ts}
    `-- webhooks/{webhooks.service.ts, webhooks.repository.ts}
dtos/                                # class-validator + class-transformer DTOs
|-- agencies, analytics, announcements, auth, autopost, billing, comments, generator, integrations,
|-- media, notifications, oauth, plugs, posts (create.post.dto, get.posts.dto, change.post.status.dto),
|-- sets, settings, signature, third-party, users, videos, webhooks
emails/                              # MJML/HTML email templates
integrations/                        # SOCIAL PROVIDER GRAPH - see 6
|-- integration.manager.ts           # the registry: socialIntegrationList[]
|-- integration.missing.scopes.ts
|-- refresh.integration.service.ts
|-- social.abstract.ts               # base class for all providers; throws RefreshToken error type
|-- tool.decorator.ts                # @Tool / @Rules decorators harvested by chat tools
`-- social/                          # 36 provider files (see 6)
newsletter/                          # mailing list integration
openai/
|-- openai.service.ts                # OpenAI SDK wrapper
|-- extract.content.service.ts       # parse URL -> post draft
`-- fal.service.ts                   # fal.ai image gen (Nano Banana etc.)
redis/
`-- redis.service.ts                 # exports ioRedis singleton
sentry/
|-- initialize.sentry.ts
`-- sentry.exception.ts              # FILTER constant for module providers
services/
|-- codes.service.ts                 # 6-digit verification codes (TOTP-ish)
|-- email.service.ts                 # email dispatch (uses Resend or SMTP); also signal-with-starts sendEmailWorkflow
|-- exception.filter.ts              # HttpExceptionFilter, HttpForbiddenException, SubscriptionException
|-- make.is.ts                       # makeId() - random ID generator
|-- stripe.country.list.ts
`-- stripe.service.ts                # Stripe checkout, subscriptions, webhooks
short-linking/
`-- short.link.service.ts            # dub.co integration
temporal/
|-- temporal.module.ts               # getTemporalModule(isWorkers, path?, activityClasses?)
|-- temporal.register.ts             # registers custom search attributes via admin client
|-- temporal.search.attribute.ts     # postId, organizationId
`-- infinite.workflow.register.ts    # boots missingPostWorkflow when RUN_CRON=true
throttler/
`-- throttler.provider.ts            # ThrottlerBehindProxyGuard (uses X-Forwarded-For)
track/
`-- track.service.ts                 # PostHog/UTM event tracking
upload/
|-- upload.module.ts
|-- upload.factory.ts                # picks LocalStorage or CloudflareStorage by STORAGE_PROVIDER env
|-- upload.interface.ts
|-- local.storage.ts                 # writes to UPLOAD_DIRECTORY
|-- cloudflare.storage.ts            # R2-via-S3 SDK
|-- r2.uploader.ts
`-- custom.upload.validation.ts      # CustomFileValidationPipe (file-type sniff)
user/
|-- user.from.request.ts             # @GetUserFromRequest() param decorator
|-- org.from.request.ts              # @GetOrgFromRequest() param decorator (read in every authenticated route)
|-- user.agent.ts
`-- track.enum.ts
videos/
|-- video.module.ts
|-- video.manager.ts                 # registry
|-- video.interface.ts
|-- images-slides/                   # static-image-to-video
`-- veo3/                            # Google Veo 3 integration
3rdparties/                          # external-tool integrations not "social"
|-- thirdparty.manager.ts
|-- thirdparty.module.ts
|-- thirdparty.interface.ts
|-- heygen/                          # avatar video
`-- reelfarm/                        # short-form video
```

### 4.2 `libraries/helpers/src/`

```
auth/auth.service.ts                 # JWT sign/verify (HS256, secret = process.env.JWT_SECRET). Used by both backend and Next middleware.
configuration/configuration.checker.ts  # ConfigurationChecker - validates env on backend boot
decorators/{plug.decorator.ts, post.plug.ts}  # decorators harvested into the plug system (auto-actions)
subdomain/
|-- all.two.level.subdomain.ts       # public-suffix list
`-- subdomain.management.ts          # getCookieUrlFromDomain - derives apex domain for cookie scope (multi-subdomain SSO)
swagger/load.swagger.ts              # mounts /docs (NestJS Swagger)
utils/
|-- custom.fetch.func.ts             # core fetch wrapper (handles auth header, baseUrl, beforeRequest/afterRequest hooks, reload header propagation)
|-- custom.fetch.tsx                 # FetchProvider context + useFetch() hook (client component)
|-- internal.fetch.ts                # server-side variant for Next server components (reads cookies(), posts to BACKEND_INTERNAL_URL)
|-- count.length.ts                  # post char counting per network
|-- is.dev.ts                        # NODE_ENV check
|-- is.general.server.side.ts        # IS_GENERAL flag
|-- linkedin.company.prevent.remove.ts
|-- posts.list.minify.ts             # minify/expand posts list payload over the wire
|-- read.or.fetch.ts
|-- remove.markdown.ts
|-- sanitize.post.content.ts
|-- strip.html.validation.ts
|-- timer.ts                         # await timer(ms)
|-- use.fire.events.ts
|-- use.wait.for.class.tsx
|-- utm.saver.tsx                    # client component that captures UTM into cookies on mount
|-- valid.images.ts
`-- valid.url.path.ts
```

### 4.3 `libraries/react-shared-libraries/src/`

```
form/                                # native form primitives (no external UI lib)
|-- button.tsx, input.tsx, textarea.tsx, select.tsx, custom.select.tsx,
|-- checkbox.tsx, color.picker.tsx, slider.tsx, total.tsx, canonical.tsx
helpers/
|-- variable.context.tsx             # VariableContextComponent - injects all NEXT_PUBLIC_* env vars into a React context (THE source of truth for client config)
|-- posthog.tsx                      # PHProvider
|-- delete.dialog.tsx                # SweetAlert2 wrapper
|-- safe.image.tsx, image.with.fallback.tsx
|-- mantine.wrapper.tsx              # Mantine 5.10 provider (used by provider/ layout only)
|-- uppy.upload.ts                   # Uppy + Transloadit composition
|-- use.is.visible.tsx, use.media.directory.ts, use.prevent.window.unload.tsx, use.state.callback.ts, use.track.tsx
|-- utc.date.render.tsx              # client-only UTC->locale date renderer
|-- video.frame.tsx, video.or.image.tsx
|-- testomonials.tsx                 # marketing
`-- is.general.tsx
sentry/                              # client-side Sentry init pieces
toaster/toaster.tsx                  # SweetAlert2 toast wrapper used as global useToaster()
translation/
|-- i18n.config.ts                   # cookieName, headerName, languages, fallbackLng
|-- i18next.ts
|-- get.transation.service.client.ts # useT() hook
|-- get.translation.service.backend.ts
|-- translated-label.tsx
`-- locales/                         # JSON translations
```

---

## 5. Database (Prisma + Postgres)

**Schema:** `libraries/nestjs-libraries/src/database/prisma/schema.prisma` (959 lines).
**Datasource:** `postgresql`, URL from `DATABASE_URL`. Prisma 6.5.0 client.
**Generation:** `pnpm prisma-generate` runs from root via `pnpm dlx prisma@6.5.0 generate --schema ./libraries/nestjs-libraries/src/database/prisma/schema.prisma`. Schema push: `pnpm prisma-db-push`. Migrations are NOT used — the project pushes schema directly (`db push --accept-data-loss`).

### 5.1 Core domain model

```
Organization (the tenant)
|-- 1..* User via UserOrganization (role: SUPERADMIN | ADMIN | USER, disabled: bool)
|-- 1..* Integration  (the connected social channel)
|       |-- 1..* Post (state: QUEUE|PUBLISHED|ERROR|DRAFT)
|       |      |-- 1..* Comments  (in-app team comments on the post)
|       |      |-- 1..* TagsPosts -> Tags
|       |      |-- 0..* Errors    (post failure log)
|       |      |-- 0..1 parentPost (Post recursive - comment threads, child posts in chain)
|       |      |-- 0..1 lastMessage -> Messages (marketplace order chat)
|       |      `-- 0..1 submittedForOrder/submittedForOrganization (cross-org submit flow)
|       |-- 0..* Plugs (integration-scoped automations)
|       |-- 0..* IntegrationsWebhooks -> Webhooks
|       `-- 0..1 Customer  (sub-grouping of channels - agency feature)
|-- 0..* Media  (uploaded files; type: image/video; thumbnail; deletedAt)
|-- 0..1 Subscription (tier: STANDARD|PRO|TEAM|ULTIMATE; period: MONTHLY|YEARLY; isLifetime; cancelAt)
|-- 0..* Credits (per-org credit pool; type defaults to "ai_images")
|-- 0..* Notifications
|-- 0..* Webhooks
|-- 0..* Signatures (autoAdd)
|-- 0..* Sets (post templates)
|-- 0..* AutoPost (RSS feeds -> posts)
|-- 0..* ThirdParty (Heygen, Reelfarm credentials)
|-- 0..* Tags (for posts)
|-- 0..* OAuthApp (Postiz acting as OAuth IdP)
|-- 0..* OAuthAuthorization
|-- 0..* GitHub (linked GitHub account for stars-driven posts)
`-- 0..* Errors / UsedCodes / Customer

User
|-- 1..* organizations (UserOrganization)
|-- 1..* OAuthAuthorization (apps user authorized)
|-- 0..1 SocialMediaAgency (separate "agency profile" feature)
|-- 0..* ItemUser (key/value per user; e.g. dismissed banners)
|-- 0..* Comments (authored comments on posts)
`-- marketplace fields: groupBuyer/groupSeller (MessagesGroup), orderBuyer/orderSeller (Orders), payoutProblems

Post
|-- id (cuid), state, publishDate, organizationId, integrationId, content
|-- group       (groups multiple Posts that go out together as one "thread")
|-- parentPostId  (intra-thread linking)
|-- delay       (minutes after parent for comments)
|-- settings    (JSON string - provider-specific publish options)
|-- image       (legacy single-image; current uploads go via Media)
|-- intervalInDays  (for repeat-post)
|-- releaseId / releaseURL  (returned by social provider after publish)
`-- submittedFor*  (marketplace: a creator submits a post to a buyer's org for approval)
```

### 5.2 Marketplace tables (a parallel domain)

`SocialMediaAgency`, `SocialMediaAgencyNiche`, `Customer`, `MessagesGroup`, `Messages`, `Orders`, `OrderItems`, `PayoutProblems`. This is the "Gitroom marketplace" feature — buyers hire agencies to post on their behalf. Likely **out of scope for the mobile-first fork** but the relations are tangled into `User`, `Organization`, `Integration`, `Post`.

### 5.3 Integrations table — the channel connector

```prisma
model Integration {
  id, internalId, organizationId, name, picture, providerIdentifier, type,
  token (encrypted access token), refreshToken, tokenExpiration,
  disabled, deletedAt, refreshNeeded, inBetweenSteps,
  postingTimes (default [{time:120},{time:400},{time:700}]),
  customInstanceDetails, customerId, rootInternalId, additionalSettings,
  @@unique([organizationId, internalId])
}
```
- `providerIdentifier` is the key into `socialIntegrationList` (e.g. `'x'`, `'linkedin'`, `'instagram-standalone'`).
- `internalId` = the platform-side user id; `rootInternalId` is set when the integration is a sub-page of a parent integration (e.g. LinkedIn page under personal LinkedIn).
- Token encryption: `token`/`refreshToken` are stored encrypted (handled by `IntegrationService`). The `Integration.refreshNeeded` flag is set when refresh fails — backend then surfaces a re-auth banner.

### 5.4 AI / Mastra tables

`mastra_messages`, `mastra_resources`, `mastra_threads`, `mastra_traces`, `mastra_workflow_snapshot`, `mastra_evals` (`@@ignore`-d), `mastra_ai_spans` (`@@ignore`-d), `mastra_scorers`. These are owned by the Mastra runtime — Postiz reuses the same Postgres DB instead of running a separate Mastra DB.

### 5.5 OAuth-as-IdP tables

`OAuthApp` (clientId, clientSecret, redirectUrl), `OAuthAuthorization` (accessToken, authorizationCode, codeExpiresAt, revokedAt). Backed by `OAuthController` and `OAuthAuthorizedController` at `/oauth/authorize` and `/oauth/token`. This is how external apps (and the MCP `/mcp-oauth` endpoint) get a `pos_*` token. Resolved in `PublicAuthMiddleware` and in `start.mcp.ts:resolveAuth()`.

### 5.6 Other notables

- `Subscription` is `@@unique` per `organizationId` (one subscription per org).
- `Credits` is append-only ledger (each spend is a new row with negative `credits`).
- `Trending` / `TrendingLog` / `Star` / `PopularPosts` — content-discovery and marketing metrics tables.
- `Mentions` is a global lookup, no orgId — shared across the app for @-suggestion lookups.
- `Errors` per `organizationId+postId+platform` for post-level failure logs.

---

## 6. Social integrations (the heart of the system)

**File:** `libraries/nestjs-libraries/src/integrations/integration.manager.ts`

Defines `socialIntegrationList: Array<SocialAbstract & SocialProvider>` containing **35 active providers** (one is commented out — `MastodonCustomProvider`). Each provider class implements `SocialProvider` interface (`libraries/nestjs-libraries/src/integrations/social/social.integrations.interface.ts`) and extends `SocialAbstract` (`libraries/nestjs-libraries/src/integrations/social.abstract.ts`).

**Provider files** (`libraries/nestjs-libraries/src/integrations/social/`):
```
x.provider.ts                   linkedin.provider.ts          linkedin.page.provider.ts
reddit.provider.ts              instagram.provider.ts         instagram.standalone.provider.ts
facebook.provider.ts            threads.provider.ts           youtube.provider.ts
gmb.provider.ts (Google My Business)   tiktok.provider.ts     pinterest.provider.ts
dribbble.provider.ts            discord.provider.ts           slack.provider.ts
kick.provider.ts                twitch.provider.ts            mastodon.provider.ts
mastodon.custom.provider.ts (commented out)                   bluesky.provider.ts
lemmy.provider.ts               farcaster.provider.ts         telegram.provider.ts
nostr.provider.ts               vk.provider.ts                medium.provider.ts
dev.to.provider.ts              hashnode.provider.ts          hashnode.tags.ts
wordpress.provider.ts           listmonk.provider.ts          moltbook.provider.ts
whop.provider.ts                skool.provider.ts             mewe.provider.ts
```
Plus the abstract base + interface.

**Provider capabilities (selected fields):**
- `identifier`, `name`, `toolTip`, `editor`
- `externalUrl?` — provider redirects elsewhere for auth (e.g. Wordpress self-hosted)
- `isWeb3?` — Farcaster, Nostr (uses wallet adapter)
- `isChromeExtension?` + `extensionCookies?` — Skool (auth via the Chrome extension's cookie scrape)
- `customFields?()` — async list of extra inputs (e.g. Mastodon URL)
- `maxLength(verified)` / `dto` (post settings DTO) / `refreshWait` flag
- `generateAuthUrl()` returns `{codeVerifier, state, url}` — state is stashed in Redis under `organization:${state}` and `login:${state}`, expiring in 1h
- `refreshToken(...)`, `postSocial(...)`, `postComment(...)`, analytics methods
- `@Tool()` and `@Rules()` decorators tag methods that the AI agent can call

**Integration boot flow** (verified in `no.auth.integrations.controller.ts` + `integrations.controller.ts`):
1. Client calls `GET /integrations/social/:integration` -> backend returns auth URL, stashes Redis state
2. Provider redirects back to `FRONTEND_URL/integrations/social/:provider?code=...&state=...`
3. Frontend `app/(app)/integrations/social/[provider]/page.tsx` calls `POST /integrations/social-connect/:integration` with the code
4. Backend exchanges code, stores `Integration` row with token, schedules `refreshTokenWorkflow` for token expiry

---

## 7. Multi-tenancy

- **Tenant unit = `Organization`** (uuid). One user belongs to many orgs via `UserOrganization`.
- **Header/cookie scheme:** `auth` (JWT, contains `User`), `showorg` (active org id). Both can be cookies *or* headers — CORS exposes them. A super-admin can also pass `impersonate` to act as another org.
- **Auth middleware** (`apps/backend/src/services/auth/auth.middleware.ts`) resolves both:
  ```
  user = AuthService.verifyJWT(req.cookies.auth || req.headers.auth)
  org  = orgs.find(o => o.id === req.cookies.showorg) || orgs[0]
  req.user = user; req.org = org;
  ```
- **Param decorators** (`libraries/nestjs-libraries/src/user/`): every authenticated controller method takes `@GetOrgFromRequest() org: Organization` and/or `@GetUserFromRequest() user: User`. There is **no implicit org filtering at the ORM level** — every Prisma query in repositories takes `orgId` explicitly. Skipping it would be a tenancy leak.
- **Public API** (`PublicAuthMiddleware`): API key (raw string) or OAuth token (`pos_*` prefix). Both resolve to an `Organization` and assign `req.org = { ...org, users: [{ users: { role: 'SUPERADMIN' } }] }` — i.e. API keys always act as super-admin within their org.
- **Cookie scope:** `getCookieUrlFromDomain(FRONTEND_URL)` extracts the apex (e.g. `.postiz.com`) so subdomain frontends share auth.

---

## 8. Data flow: scheduling a post

The end-to-end flow that mobile-first must preserve:

```
1. UI: user picks day in calendar (week/month/day/list view) - components/launches/calendar.tsx
       -> opens AddEditModal (new-launch/add.edit.modal.tsx)
       -> composes content with TipTap editor + picks-socials + media (Uppy)
2. UI submits -> POST /posts (cookie auth)
       posts.controller.ts:@Post('/') -> posts.service.ts:createPost(orgId, body)
3. posts.service.ts:
       a. Optional: shortLinkService.convertTextToShortLinks(...)
       b. postsRepository.createOrUpdatePost(...) - creates Post rows in QUEUE state
       c. startWorkflow(taskQueue, postId, orgId, state):
          - Lists running workflows by search-attr postId -> terminates them
          - If state !== 'DRAFT': client.workflow.start('postWorkflowV102', {
              workflowId: `post_${postId}`, taskQueue: 'main',
              workflowIdConflictPolicy: 'TERMINATE_EXISTING',
              args: [{taskQueue: provider, postId, organizationId}]
            })
4. Temporal queues the workflow. orchestrator app picks it up via the 'main' worker.
5. postWorkflowV102 (apps/orchestrator/src/workflows/post-workflows/post.workflow.v1.0.2.ts):
       a. await sleep until publishDate
       b. Read post (getPostsList activity)
       c. If integration.refreshNeeded or .disabled -> inAppNotification, exit
       d. postSocial activity on the provider-specific task queue (e.g. 'x', 'linkedin')
       e. On postSocial.RefreshToken error -> refreshTokenWithCause + retry (5 attempts)
       f. updatePost(id, postId, releaseURL) -> state = PUBLISHED
       g. inAppNotification(...) success
       h. sendWebhooks(...)
       i. Process internal+global plugs sorted by delay (each may sleep + invoke processPlug/processInternalPlug)
       j. If intervalInDays -> startChild(postWorkflowV102, ...) for the next iteration
6. Frontend SWR revalidation:
       - Calendar context polls /posts (filtered by date range) every interval
       - inAppNotification is shown via NotificationService -> digestEmailWorkflow batches emails
```

**Failure recovery:** `missingPostWorkflow` (started by `InfiniteWorkflowRegisterModule` when `RUN_CRON=true`) loops every hour. Calls `searchForMissingThreeHoursPosts` activity (in `post.activity.ts:47`) which finds QUEUE posts with publishDate in the past, then `signalWithStart('postWorkflowV102', {signal: 'poke'})` to wake or recreate them. The `poke` signal is set in v1.0.2 but currently only flips a `poked` boolean — it's a placeholder for future behavior.

---

## 9. Cross-cutting concerns

**Logging:** NestJS `Logger`. Sentry initialized via `initializeSentry('backend'|'orchestrator', true)` at the very top of `main.ts` (must be first import — see `apps/backend/src/main.ts:1-2`). Sentry NestJS module integrated globally; `FILTER` constant is registered as a provider in `AppModule`.

**Validation:** `class-validator` + `class-transformer` DTOs in `libraries/nestjs-libraries/src/dtos/`. Global `ValidationPipe({transform: true})` in `main.ts`. `class-validator-jsonschema` exposes the same schemas to MCP tools (`getValidationSchemas()` in `chat/validation.schemas.helper.ts`).

**Throttling:** `@nestjs/throttler` + `ThrottlerStorageRedisService`. `ThrottlerBehindProxyGuard` reads `X-Forwarded-For` to apply per-IP limits behind a proxy. Default 30 req/h, override via `API_LIMIT`.

**Authentication summary:**
| Surface | Mechanism | Identity |
|---|---|---|
| `/api/*` (cookie) | JWT in cookie `auth` + active org in `showorg` | User + chosen Organization |
| `/api/auth/*` | none | login flow |
| `/integrations/social-connect/*`, `/integrations/provider/*` | none | provider OAuth callback |
| `/public/v1/*` | API key (`Authorization: <key>`) or `Authorization: pos_<oauth>` | Organization (always SUPERADMIN role) |
| `/mcp/:id` | API key in URL | Organization |
| `/mcp` | `Authorization: Bearer <api_key>` | Organization |
| `/mcp-oauth` | OAuth flow -> resolves to `Organization` via `OAuthAuthorization` | Organization |
| Browser extension | JWT (`auth`) provided when enrolled, stored in `chrome.storage.local`, replayed to `/integrations/extension-refresh` | User+Organization |

**File storage:** `UploadFactory.createStorage()` (`libraries/nestjs-libraries/src/upload/upload.factory.ts`) returns either `LocalStorage` (writes to `UPLOAD_DIRECTORY`, served via Next rewrite from `/uploads/*` -> `/api/uploads/*`) or `CloudflareStorage` (R2 via the AWS S3 SDK; presigned URLs via `@aws-sdk/s3-request-presigner`). Selected by `STORAGE_PROVIDER` env. Frontend env var `NEXT_PUBLIC_UPLOAD_STATIC_DIRECTORY` is the public URL prefix.

**Image / video / AI generation:**
- `OpenaiService` — chat completions, post generation, separation
- `FalService` — fal.ai image gen
- `VideoManager` — registry; `Veo3` (Google) and image-slide synthesis
- `ThirdPartyManager` — `Heygen` (avatar video), `Reelfarm` (short-form)
- `Polotno` (frontend) — image editor for post media

**Internationalisation:** `i18next` + `react-i18next`. Cookie name `i18next` (verified in `i18n.config.ts`). `proxy.ts` middleware sets locale per request; `app/(app)/layout.tsx` reads cookie and forwards to `VariableContextComponent`.

---

## 10. Notable architecture quirks for the mobile fork

1. **`@gitroom/*` aliases everywhere** — when grepping or refactoring, use `@gitroom/backend`, `@gitroom/frontend`, `@gitroom/nestjs-libraries`, `@gitroom/helpers`, `@gitroom/react`. Defined in `tsconfig.base.json`.
2. **CLAUDE.md is partially wrong** — claims Vite frontend; it is Next.js 16 App Router. Ignore the Vite reference.
3. **No NestJS global prefix** — controllers are mounted at the path declared in `@Controller('/foo')`. There is no `/api/v1` prefix on the backend itself; the `/api` prefix is *only* added by the frontend deployment via `NEXT_PUBLIC_BACKEND_URL=http://.../api` (see docker-compose.yaml:9-11).
4. **Frontend uses two backend URLs:** `NEXT_PUBLIC_BACKEND_URL` (browser) vs `BACKEND_INTERNAL_URL` (Next server runtime, typically `http://localhost:3000`).
5. **The orchestrator MUST be running** for any post to publish. Backend posts to Temporal; if no worker -> posts pile up in QUEUE forever. Recovery is `missingPostWorkflow` (cron) but it only triggers if `RUN_CRON=true` is set on the **backend** (not orchestrator).
6. **The "main" task queue handles workflow logic; per-provider task queues handle the network calls.** This isolation lets one slow provider not block others. When adding a new social provider, its worker is auto-created from `socialIntegrationList[].identifier.split('-')[0]`.
7. **Mastra agent depends on the same Postgres DB** (`mastra_*` tables). It's bundled in `app.module.ts` and its memory/threads are visible via `/copilot/list`, `/copilot/:thread/list`. For a slim mobile-first build, removing AI requires excising `AgentModule` + `ChatModule` + `start.mcp.ts` + `CopilotController` + the `mastra_*` tables.
8. **CopilotKit (in-app chat UI)** is mounted in the frontend layout (CSS + provider) and hits `/copilot/chat`, `/copilot/agent`. This is separate from the public MCP — internal users use CopilotKit; external clients use MCP.
9. **`apps/sdk`** publishes to npm as `@postiz/node` and **imports DTO types directly from `@gitroom/nestjs-libraries`**. This means the SDK build has a hard compile-time dependency on the backend's DTO files. Renaming DTOs breaks the SDK.
10. **Marketplace tables and routes** (`Orders`, `MessagesGroup`, `SocialMediaAgency`, `PayoutProblems`, etc.) are entangled with `User`/`Organization`. They support the "buy a post from an agency" flow, surfaced via `apps/frontend/src/app/(provider)/`. Likely candidates for removal in a mobile-first scope, but the FK relations on `User` and `Post.submittedFor*` mean schema cleanup is non-trivial.
11. **`apps/extension`** only provides Skool auth via cookie scraping today; the registry pattern in `apps/extension/src/providers/list/` is ready for more, but `manifest.json:host_permissions` only lists `*.skool.com`. The web app talks to the extension via `chrome.runtime.onMessageExternal` — the extension ID lives in `EXTENSION_ID` env var, surfaced in `VariableContextComponent`.
12. **Calendar.tsx already supports a 'list' view** (verified in `calendar.context.tsx:55-80`) — useful baseline for mobile, though the visual layout still assumes desktop. The `mobile.integration.tsx` component in `new-layout/` is the only existing mobile-aware piece in the tree.

---

## 11. Process map (when running locally)

```
+------------------------------------------------------------------------+
|  Postgres (5432, postiz-postgres) <- Prisma ORM                         |
|  Redis    (6379, postiz-redis)    <- throttler, OAuth state, ioredis    |
|  Temporal (7233) + temporal-postgres + temporal-elasticsearch + UI:8080 |
+------------------------+-----------------------------+------------------+
                         |                             |
   +---------------------v---------+    +--------------v----------------+
   |  apps/backend (NestJS, :3000) |    | apps/orchestrator (NestJS,    |
   |  + MCP /mcp /mcp/:id /sse/:id |    |   :3002 health, Temporal      |
   |  + Swagger /docs              |<---|   workers: 'main' + per       |
   |  Temporal client only         |    |   social provider)            |
   +------^------------------------+    +-------------------------------+
          | /api proxied                              ^
          |                                           | Temporal SDK
   +------+---------------+                           |
   | apps/frontend         |                          |
   | Next.js 16 (:4200)    |                          |
   | - SSR via Express     |                          |
   | - middleware proxy.ts |                          |
   +------^----------------+                          |
          |                                           |
   +------+-----------+    +------------------+       |
   | Browser (web app)|    | apps/extension   |       |
   | + extension link |    | (Chrome MV3)     |       |
   +------------------+    | -> /integrations/|       |
                           |   extension-     |       |
                           |   refresh        |       |
                           +------------------+       |
   +------------------------------------+             |
   | apps/sdk (@postiz/node, external)  |--- REST ----+
   | apps/commands (CLI, ad-hoc)        |
   +------------------------------------+
```

---

## 12. Where to look first when redesigning for mobile

| Concern | Files |
|---|---|
| Calendar UI | `apps/frontend/src/components/launches/calendar.tsx`, `calendar.context.tsx`, `launches.component.tsx` |
| New post composer | `apps/frontend/src/components/new-launch/add.edit.modal.tsx`, `editor.tsx`, `picks.socials.component.tsx`, `store.ts` |
| Mobile-aware piece (existing) | `apps/frontend/src/components/new-layout/mobile.integration.tsx` |
| Layout chrome | `apps/frontend/src/app/(app)/layout.tsx`, `(site)/layout.tsx`, `components/new-layout/layout.component.tsx` |
| Auth + org switching | `components/layout/user.context.tsx`, `organization.selector.tsx`, `proxy.ts` (middleware) |
| Backend post creation | `apps/backend/src/api/routes/posts.controller.ts`, `libraries/nestjs-libraries/src/database/prisma/posts/posts.service.ts` (1011 lines - biggest hot path) |
| Public REST surface | `apps/backend/src/public-api/routes/v1/public.integrations.controller.ts` (the only place to add new public endpoints if mobile uses public API) |
| Schema | `libraries/nestjs-libraries/src/database/prisma/schema.prisma` |
| Provider catalog | `libraries/nestjs-libraries/src/integrations/integration.manager.ts` (the source for what's connectable) |
| AI agent (optional removal) | `libraries/nestjs-libraries/src/agent/`, `chat/`, `apps/backend/src/api/routes/copilot.controller.ts`, `start.mcp.ts` |

---

*Architecture analysis: 2026-04-30*
