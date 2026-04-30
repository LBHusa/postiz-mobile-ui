# Postiz-Fork Codebase-Index — Synthesis

**Stand:** 2026-04-30
**Quellen:** `tech-stack.md` (832), `architecture.md` (812), `mobile-ui-feasibility.md` (383), `workflow-ai-integration.md` (1169) = 3196 Zeilen verifizierter Realitaet aus dem Source.

Dies ist die konsolidierte Sicht. Fuer Tiefe siehe die vier Quell-Files.

---

## 1. Was Postiz IST (verifiziert)

| Layer | Realitaet |
|---|---|
| **Frontend** | Next.js 16.2.1 App Router + React 19.2.4 + Tailwind 3.4.17 + SWR 2.2.5 + Zustand 5.0.5 + RHF 7.58 + Yup + Tiptap 3 + Mantine 5 (legacy, partial) |
| **Backend** | NestJS 10 + Prisma 6 + PostgreSQL 17 + Redis + Temporal 1.28 + 35 Social-Provider |
| **AI** | OpenAI SDK 6 (gpt-4.1 + DALL-E-3) + LangGraph 1.2 + Mastra 1.21 + CopilotKit + MCP-Server fuer Postiz-Agent CLI |
| **Apps** | backend (3000) + frontend (4200) + orchestrator (Temporal worker, 3002 health) + extension (Chrome MV3) + sdk (`@postiz/node`) + commands (CLI) |
| **API-Surfaces** | `/api/*` (cookie-JWT) + `/public/v1/*` (API-key oder `pos_*` OAuth-Token) + MCP (`/mcp`, `/mcp/:id`, `/mcp-oauth`, `/sse/:id`) |
| **Multi-Tenant** | `Organization` ist die Unit; `auth` + `showorg` Cookies; `@GetOrgFromRequest()` auf jeder authentifizierten Route |
| **Lizenz** | AGPL-3.0 (selfhost = unproblematisch fuer Husatech) |

## 2. Was Postiz NICHT hat (was wir bauen muessen)

| Bereich | Status im Code | Konsequenz fuer Lukas |
|---|---|---|
| **Approval-Workflow** | Existiert NICHT als Code (nur 4 Post-States: `QUEUE \| PUBLISHED \| ERROR \| DRAFT`) | Eigener Status-Layer noetig |
| **Comment-getriggerte AI-Re-Gen** | Comments-Schema + Endpoints da, aber kein Trigger; Plug-In-Punkt: `posts.service.ts:1003` | Eigener Trigger-Service noetig |
| **Brand-Voice-aware AI** | 3 AI-Systeme parallel, alle hardcoded OpenAI-System-Prompts; cleanster Slot: `load.tools.service.ts:49` (Mastra `instructions` callback) | Brand-Voice-Loader vorhandene Markdown-Files (`~/company/brand/*`) einsetzen |
| **Post-Lifecycle-Webhooks** | Nur `successful publish`-Webhook implementiert (`post.workflow.v1.0.2.ts:243-248`) | Erweitern fuer mehr Lifecycle-Events |
| **Mobile-UI** | Komplett desktop-first (1304-LOC Calendar mit 7-Spalten-Grid, 704-LOC Modal mit `w-[580px]` Preview-Pane, fixed 80px-Sidebar + 80px-Header) | Parallele `(mobile)`-Route-Group, NICHT retrofit |
| **PWA** | Kein manifest, kein service-worker, kein viewport-meta | 0.5d Setup mit `@serwist/next` + `app/manifest.ts` |
| **Tests** | Jest configured, **null Tests im Repo** | Wir setzen Test-Maszstab selbst, mindestens fuer neuen Mobile-Code |
| **DB-Migrations** | Nutzt `prisma db push --accept-data-loss`, KEIN migrations-Folder | Beim Erweitern: Migrations-Folder + `prisma migrate` einfuehren oder `db push`-Pattern uebernehmen |

## 3. Was Postiz BEREITS hat (= Wert des Forks)

- **35 Plattform-Integrationen produktionsreif** (LinkedIn, Meta, X, TikTok, YouTube, Instagram, Pinterest, Threads, BlueSky, Mastodon, Reddit + 24 weitere) inkl. OAuth-Flows + Token-Refresh + per-provider Temporal-Task-Queues
- **48-Model Prisma-Schema** mit Multi-Tenant, Org/User, Posts, Media, Subscriptions, Webhooks, Comments
- **Tiptap-Editor** mit Mentions/Suggestions, Uppy-Media-Uploader, Polotno-Canvas
- **Calendar-Context-Layer** (`calendar.context.tsx`) ist UI-agnostisch — Mobile-UI kann ihn 1:1 weiterverwenden
- **Zustand-Store** fuer Post-Drafts (`new-launch/store.ts`) ist UI-agnostisch — Mobile-UI kann ihn 1:1 weiterverwenden
- **Postiz-Agent CLI + MCP-Server** = wenn Lukas spaeter Claude/AI-Agenten Posts erstellen lassen will, ist die Schnittstelle schon da
- **Calendar hat bereits eine `'list'`-View** (`calendar.context.tsx:55-80`) = Mobile-Baseline brauchbar
- **`mobile.integration.tsx` Component existiert** (aber unused) = teilweise Mobile-Konzept im Repo

## 4. Stack-Kompatibilitaet mit Lukas-Skills

| Stack-Teil | Lukas kennt | Aufwand |
|---|---|---|
| Next.js + Tailwind | ja, aus eigenen Projekten | gering |
| React 19 / SWR / Zustand / RHF + Yup | ja, oder leicht zu lesen | gering |
| Tiptap | nein | mittel — aber in Mobile-Detail nur Editor-Surface, nicht Setup |
| NestJS / Prisma | Lukas nutzt FastAPI; NestJS-Pattern aehnlich genug | mittel |
| Temporal | nein, neuartig | mittel — fuer Mobile-UI nicht relevant; relevant nur falls eigene Workflows hinzugefuegt werden |
| Mastra + LangGraph + CopilotKit | nein | mittel — relevant nur wenn AI-Layer modifiziert wird |

## 5. Stack-Risiken / Anomalien (aus Tech-Stack-Map)

1. CLAUDE.md im Repo ist outdated (sagt "Vite", ist Next.js)
2. `mobile:` Tailwind-Breakpoint ist `max-width:1025px` (= desktop-first, gegen die Konvention) — falle fuer neue Mobile-Components
3. **Null Tests** im gesamten Repo — kein Safety-Net beim Refactoring
4. ESLint-Config `eslint` Workflow ist defekt (sucht `.eslintrc.json`, das nicht existiert)
5. Mantine v5 ist 2 Major-Versionen veraltet (aktuell v8) — partiell genutzt
6. Mastra schreibt 8 AI-Tabellen mit in die Haupt-DB
7. OpenAI SDK 6 ist cutting-edge, Breaking-Changes-Risiko
8. Node-Versions-Mismatch: Volta 20.17, Jenkins 20, Docker 22.20, Engines `>=22.12.0`
9. Prisma `db push` statt Migrations — bei Production-Deploy heikel
10. Root `package.json` haelt ALLE Deps, apps haben nur Scripts

---

## 6. Strategie-Empfehlung — Mobile-First Implementation

**Architektur-Pattern: parallele Route-Group, KEIN Retrofit.**

```
apps/frontend/src/app/
├── (app)/                       ← bestehender Desktop-Pfad (unveraendert)
│   ├── (site)/launches/         ← bestehende Calendar-Page (unveraendert)
│   ├── (site)/billing/...
│   └── ...
├── (mobile)/                    ← NEU: parallele Route-Group
│   ├── layout.tsx              ← Bottom-Tab-Layout, kein 80px-Rail
│   ├── kalender/page.tsx       ← MobileCalendar
│   ├── post/[id]/page.tsx      ← MobilePostDetail (page, nicht modal)
│   └── settings/page.tsx       ← optional later
└── manifest.ts                  ← NEU: PWA Manifest
```

**Was wir wiederverwenden (UI-Layer-agnostic):**
- `calendar.context.tsx` — SWR-basierte Calendar-Data
- `new-launch/store.ts` — Zustand Post-Draft-State
- Tiptap-Editor-Extension-Config (nur Chrome austauschen)
- RHF + Yup Form-Validation
- Theme-System (CSS-Variablen, dark/light)

**Was wir NEU bauen (Mobile-spezifisch):**
- Bottom-Tab-Layout
- MobileCalendar (Monatsansicht statt 7-Spalten-Wochengrid)
- BottomSheet-Primitive (slide-up, kein Modal)
- MobilePostDetail-Page (single-column, swipeable Plattform-Previews)
- Touch-friendly Date-Picker (Mantine-v5-Replacement oder native)
- PWA-Manifest + Icons

**Was wir am Backend ERWEITERN (in eigenen NestJS-Modulen, NICHT existierende anfassen):**
- Neuer `WorkflowModule`: Status-States (idea / draft / review / re_gen / approved / scheduled / online / failed) parallel zum existierenden `enum State`
- Neuer `BrandVoiceModule`: laedt `~/company/brand/*` Markdown-Files mit mtime-Cache, exposed als Mastra-Tool oder System-Prompt-Layer
- Neuer `RegenerationService`: triggert auf Comment-Insert (Plug-In bei `posts.service.ts:1003`) — laeuft `claude --print` mit Brand-Voice + Comment-Context
- Erweiterung des Webhook-Systems: zusaetzliche Event-Types (`post.created`, `post.draft_ready`, `post.comment_added`, `post.regenerated`, `post.approved`)
- Optional: Image-Provider-Layer fuer Nano-Banana-2 als Alternative zu DALL-E-3

**Was wir NICHT anfassen:**
- 35 Social-Provider (`integrations/social/*`)
- Temporal-Workflows fuer Posting
- Auth/JWT/OAuth
- Billing/Subscription
- Marketplace (Sets/Orders/MessagesGroup)
- Existierende Desktop-UI

---

## 7. Reihenfolge der Phasen — Vorschlag

**Phase 0 (jetzt):** Indexing fertig + Aenderungsvorschlaege geschrieben (= dieses File + change-proposals.md)

**Phase 1 — UI-PLANUNG vor Code:**
- Wireframes Mobile-Calendar (Monatsraster + Tap-Verhalten)
- Wireframes MobilePostDetail (Body-Edit, KI-Comment-Feld, Bild-Review, Action-Bar)
- Wireframes BottomSheet "Neuer Post"
- Klick-Pfade durchspielen (User-Flow von Tap-Tag bis Online)
- UI-Spec dokumentieren in `.planning/ui-spec.md`

**Phase 2 — PWA-Foundation + Mobile-Layout-Shell:**
- `app/manifest.ts`, Icons, Viewport-Meta
- `(mobile)/layout.tsx` mit Bottom-Tabs
- Tailwind: optional standard-Breakpoints `sm/md/lg` zusaetzlich zu existierenden `mobile:`
- Mobile-Detection Middleware (oder Toggle)

**Phase 3 — Mobile-Calendar + Post-Detail (UI):**
- MobileCalendar wiederverwendet `useCalendar`-Context
- MobilePostDetail-Page wiederverwendet `useLaunchStore` + Tiptap-Extensions
- BottomSheet-Primitive

**Phase 4 — Workflow-Erweiterung + Status-States (Backend):**
- Status-Layer parallel zu `enum State`
- Migration oder `db push`-Strategie geklaert
- Webhook-Events fuer Status-Transitions

**Phase 5 — Brand-Voice + Comment-Trigger AI (Backend):**
- BrandVoiceModule
- RegenerationService
- Mobile-UI bekommt "KI nochmal"-Button

**Phase 6 — Image-Provider (optional):**
- Nano Banana 2 als Provider neben DALL-E-3

**Phase 7 — Hardening:**
- Mindest-Tests fuer neuen Code (`apps/frontend/src/components/mobile/*`, `apps/backend/src/api/routes/{workflow,brand-voice,regeneration}/*`)
- ESLint-Workflow fixen
- Deployment auf Server 77

---

## 8. Was VOR dem UI-Plan geklaert werden muss

1. **Plattformen fuer V1?** Lukas postet aktuell LinkedIn primaer. V1 nur LinkedIn, oder direkt Meta/Instagram mit dabei?
2. **Status-States — sind die acht oben (idea/draft/review/re_gen/approved/scheduled/online/failed) richtig?** Oder reichen weniger?
3. **Mobile-Detection: User-Agent-Routing oder manueller Toggle?** Erstes ist Magie, zweites ist explizit.
4. **PWA: Installierbar nur, oder auch offline-faehig?** Offline-Drafting waere extra Workstream (IndexedDB + Outbox).
5. **Image-Provider: behalten wir DALL-E-3 als Default und fuegen Nano Banana 2 als Alternative hinzu, oder ersetzen wir komplett?**
6. **Brand-Voice-Files-Standort:** auf Server 77 unter `~/company/brand/*` — wie kommen die in den Postiz-Container? (Volume-Mount, Git-Repo, separater Brand-Voice-Service mit eigenem API)

Diese sechs Fragen muessen vor dem UI-Wireframing beantwortet sein, weil sie die UI direkt formen.
