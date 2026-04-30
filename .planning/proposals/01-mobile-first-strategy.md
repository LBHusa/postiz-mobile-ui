# Aenderungsvorschlaege — Mobile-First Postiz-Fork (vereinfacht)

**Stand:** 2026-04-30 (V2 — Server-Agent-Architektur)
**Quelle:** `.planning/codebase/SUMMARY.md` + 4 Mapper-Dokumente
**Prinzip:** UI ist die Wahrheit, Backend folgt. Niemals oberflaechlich. Keine Quick Wins. Fundamental.

---

## Scope-Klarstellung (Lukas, 30.04.)

> "Es soll einfach nur die Erweiterung sein von der jetzigen App. Es soll einfach eine saubere User Interface Funktion geben. Die ganzen anderen Funktionen koennen einfach auf dem Server liegen, weil die gar nicht auf der Plattform zu liegen haben. Das einzige wofuer die Plattform wirklich da ist, den Content visuell darzustellen, damit ich ihn posten kann und dass dort auf die Schnittstellen liegen, dass ich es ueberhaupt auf die Plattform schaff mit dem Content."

> "Ich moechte, dass er mich Plattform unabhaengig macht und auch KI unabhaengig. Ich will in der Lage sein, alles auszutauschen. Deswegen muss der Workflow, meine Vorlagen, meine Copies, meine Brand-Voice, meine Workflows alles serverseitig abgelegt sein in den richtigen Dateien, in den richtigen MD Files, in den richtigen Hooks und so weiter, dass der Kontext auch moeglichst gering bleibt. Und die Plattform Postiz ist wirklich nur dafuer da, den Content rueber zu schieben und fuer mich zu bearbeiten."

**Konsequenz:** Postiz ist ein **austauschbarer Posting-Provider**. Claude ist ein **austauschbarer AI-Provider**. Nano Banana 2 ist ein **austauschbarer Image-Provider**. Server-Agent ist Provider-agnostisch — alle Plattform-/KI-Bindungen liegen hinter Interfaces.

**Was Postiz wird:**
- Mobile-UI (Anzeigen + Editieren + Plattform-Picken + Medien-Hinterlegen + KI-Re-Gen-Trigger)
- Posting-Bridge zu LinkedIn / Meta / X / TikTok / etc. (das was Postiz schon kann — 35 Provider, OAuth, Token-Refresh, Temporal-Posting)
- API-Schnittstelle nach auszen (Public-API) damit Server-Agent reinschreiben kann

**Was Postiz NICHT wird:**
- Workflow-Engine
- Status-State-Machine
- Brand-Voice-Loader
- Re-Gen-Worker
- AI-Pipeline mit Brand-Voice-Awareness

**Was AUF dem SERVER (77) bleibt / kommt:**
- KI-Agent (claude --print + linkedin-review Skill — existiert)
- Brand-Voice-Loader (Markdown-Files unter `~/company/brand/*` — existiert)
- Image-Generator (gemini_image.py / Nano Banana 2 — existiert)
- Postiz-API-Client (neuer Worker, der via Postiz Public-API Posts erstellt + updated)
- Comment-Watcher (Polling oder Webhook auf Postiz-Comments)
- Status-Tracking falls noetig (in Server-DB, NICHT in Postiz)

---

## A. Architektur — Plattform-/AI-unabhaengig

```
┌──────────────────────────────────────────────────────────────────┐
│  Mobile-Web-UI                                                    │
│  Lukas iPhone — als PWA installiert                                │
│  (HEUTE: Postiz Frontend Mobile-Route-Group;                       │
│   MORGEN moeglich: anderes Frontend, gleiches Server-Pattern)      │
└──────────────────────────────────────────────────────────────────┘
                ↑↓ via PostingProvider-Interface (HTTP)
                │
┌──────────────────────────────────────────────────────────────────┐
│  Husatech Server-Agent (Server 77, eigenes Repo)                   │
│  Plattform-/AI-/Image-agnostisch via Provider-Interfaces           │
│                                                                    │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │  Brand-Voice + Workflows als MD-Files + Skills + Hooks      │  │
│  │  ~/company/brand/*.md                                        │  │
│  │  ~/content/calendar/content-strategy.md                      │  │
│  │  ~/content/knowledge-base/content-formeln.md                 │  │
│  │  ~/.claude/skills/linkedin-review/SKILL.md                   │  │
│  │  ~/agent/hooks/on-comment-added.sh, on-status-changed.sh     │  │
│  │  Mtime-Cache + Skill-Driven-Pipeline + Hook-Trigger          │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                    │
│  ┌──────────────────┐  ┌──────────────────┐  ┌─────────────────┐  │
│  │ PostingProvider  │  │ AIProvider       │  │ ImageProvider    │  │
│  │ - postiz.py *    │  │ - claude.py *    │  │ - nano_banana.py*│  │
│  │ - direct_li.py   │  │ - openai.py      │  │ - gpt_image.py * │  │
│  │ - buffer.py      │  │ - gemini.py      │  │                  │  │
│  └────────┬─────────┘  └────────┬─────────┘  └────────┬────────┘  │
└───────────┼──────────────────────┼──────────────────────┼─────────┘
            │                      │                      │
            ▼                      ▼                      ▼
  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
  │ Postiz / Buffer /│  │ Anthropic / Open-│  │ Google Gemini     │
  │ Direct-LinkedIn  │  │ AI / Gemini / etc.│  │ (NB2) / OpenAI    │
  │                  │  │                   │  │ gpt-image-1       │
  └──────────────────┘  └──────────────────┘  └──────────────────┘
            │
            ▼
  ┌──────────────────────────────────────────────────────┐
  │ LinkedIn / Meta / X / TikTok / YouTube / etc.        │
  └──────────────────────────────────────────────────────┘

  * = Default-Implementation V1
```

**Wesentliche Aenderungen gegenueber V1-Vorschlag:**
- ❌ Saeule 2 (Workflow-Modul in NestJS) — geloescht. Postiz' eigene 4 States (`QUEUE | PUBLISHED | ERROR | DRAFT`) reichen, weil Status-Logic auf Server lebt.
- ❌ Saeule 3 (Brand-Voice-Modul in NestJS) — geloescht. Bleibt auf Server als MD-Files.
- ❌ `WorkflowStatus`-Prisma-Modell — geloescht. Status auf Server.
- ❌ Hooks in `posts.service.ts:1003` und `posts.repository.ts:385` — geloescht. KEINE Backend-Aenderungen.
- ✅ Saeule 1 (Mobile-Route-Group) — einziges Postiz-Aenderungs-Thema.
- ✅ NEU: Server-Agent als **Plug-in-Plattform** mit Provider-Interfaces — Postiz/Claude/NB2/gpt-image-1 sind austauschbar.
- ✅ NEU: Workflows als **MD-Files + Hooks + Skills** auf Server, NICHT als Code.
- ✅ Service-Account-Token (`pos_*` OAuth-Token) fuer Server-Agent — neu betont.
- ✅ Image-Provider V1: NUR Nano Banana 2 + OpenAI gpt-image-1 (kein fal.ai, kein FLUX, kein DALL-E-3 — Lukas-explizite Anweisung).

---

## B. Was am Postiz-Code veraendert wird

### B1. Frontend — neue Files (additive only, KEIN Desktop-Code-Change)

| Pfad | Zweck |
|---|---|
| `apps/frontend/src/app/manifest.ts` | PWA-Manifest |
| `apps/frontend/public/icons/pwa/icon-192.png` + `512` + `apple-touch-icon.png` | PWA-Icons |
| `apps/frontend/src/app/(mobile)/layout.tsx` | Mobile-Shell mit BottomNav |
| `apps/frontend/src/app/(mobile)/page.tsx` | Redirect → /m/kalender |
| `apps/frontend/src/app/(mobile)/kalender/page.tsx` | MobileCalendar |
| `apps/frontend/src/app/(mobile)/post/[id]/page.tsx` | MobilePostDetail |
| `apps/frontend/src/components/mobile/MobileCalendar.tsx` | Monatsraster mobile |
| `apps/frontend/src/components/mobile/MobilePostDetail.tsx` | Single-Column Detail-Page |
| `apps/frontend/src/components/mobile/BottomSheet.tsx` | Slide-up-Sheet-Primitive |
| `apps/frontend/src/components/mobile/BottomNav.tsx` | Fixed-Bottom-Tab-Bar |
| `apps/frontend/src/components/mobile/NewPostSheet.tsx` | Tap-on-Day "Neuer Post" |
| `apps/frontend/src/components/mobile/PlatformPicker.tsx` | Plattform-Auswahl |
| `apps/frontend/src/components/mobile/MediaPicker.tsx` | Bild/Video hinterlegen |
| `apps/frontend/src/components/mobile/RegenButton.tsx` | "KI nochmal"-Button — triggert Server-Agent via Postiz-Comment oder direkter HTTP-Call |

### B2. Frontend — minimale Modifikationen am existierenden Code

| Pfad | Aenderung | Begruendung |
|---|---|---|
| `apps/frontend/tailwind.config.cjs` | Standard-Breakpoints `sm: '640px', md: '768px', lg: '1024px'` ergaenzen | Mobile-First-Konvention im neuen Code, Desktop-Code bleibt funktional weil er existierende Customs nutzt |
| `apps/frontend/src/app/(app)/layout.tsx` (oder root) | `viewport`-Export ergaenzen mit `width=device-width, initial-scale=1, viewport-fit=cover` | Korrekte Mobile-Viewport-Meta |
| `CLAUDE.md` (Repo-Root) | Korrigieren: "Vite" → "Next.js", `tailwind.config.js` → `.cjs`, plus Mobile-Architektur-Section | Repo-Doku-Realitaets-Drift |

### B3. Backend — KEINE Aenderungen am Postiz-Code

Wir editieren NICHTS im Backend. Server-Agent nutzt ausschlieszlich:
- Public-API `/public/v1/*` (Bearer `pos_*` OAuth-Token)
- ggfs. interne `/api/*` mit Cookie-Auth (falls Public-API Luecken hat — pruefen wir gleich mit Public-API-Deep-Analyse)

**Konsequenz:** Postiz-Updates upstream koennen viel einfacher gepullt werden, weil unsere Aenderungen sich auf Frontend `(mobile)` und neue `mobile/`-Components beschraenken. Merge-Konflikte fast ausgeschlossen.

### B4. Optional — wenn Public-API Luecken zeigt

Falls die Deep-Analyse zeigt dass z.B. "Update body of existing post" oder "List comments via API" fehlt, dann waere die saubere Loesung:
- Neuer Public-API-Endpoint im `apps/backend/src/public-api/routes/v1/`
- Folgt dem existierenden Pattern (Auth-Decorator, DTO, Service-Aufruf)
- Aenderung minimal-invasiv

---

## C. UI-Spec — siehe `.planning/ui-spec.md`

Die vollstaendige UI-Spezifikation (4 Screens + Klick-Pfade + KI-Visual-Pattern + Anti-Hardcoding-Liste + alle Server-Agent-Endpoints + Postiz-API-Endpoints) ist in einer eigenen Datei: **[`/Users/lukas/Desktop/Coding/postiz-husatech/.planning/ui-spec.md`](../ui-spec.md)**

Highlights aus der UI-Spec:
- **4 Screens**: Calendar (Monat+Woche) · Detail-Page (Notion-Style) · Vorschlags-Inbox (expandable Cards) · Vorschlags-Detail
- **3 BottomNav-Tabs**: Kalender, Vorschlaege, Mehr
- **Notion-Pattern**: Plus-Tap geht direkt zur Detail-Page, kein Sheet vorher
- **Inline-/Page-/Media-Comments** auf Beitraegen, alle drei Modi gleichzeitig nutzbar
- **Status-Change auf `re_gen` triggert KI-Loop** mit allen Comments als Kontext
- **Vorschlags-Workflow** generiert datengetriebene Wochenvorschlaege, Telegram-Notification + In-App-Badge

---

## C-Legacy. Mobile-UI Funktions-Liste (frueher Stand, jetzt in ui-spec.md vollstaendig)

Basierend auf Lukas' Aussage was die UI koennen muss:

### Calendar-Screen
- Anzeige aller geplanten / gedrafteten Posts ueber Tage
- Tap auf existierenden Post → Detail-Page
- Tap auf leeren Tag → NewPostSheet (Plattform + Uhrzeit + optional Idee + "Erstellen")
- Status-Indikatoren visuell (draft / scheduled / published / failed) — Postiz-States genuegen
- Wochen- oder Monatsansicht — zu entscheiden in UI-Planung

### Detail-Screen
- Body anzeigen + inline editierbar (Tiptap mobile)
- Bild anzeigen + austauschbar (Upload neu / Generieren-via-KI)
- Video anzeigen + austauschbar
- Plattform-Auswahl sichtbar + aenderbar
- First Comment (LinkedIn) anzeigen + editierbar
- Datum + Uhrzeit aenderbar
- KI-Feedback-Feld + "KI nochmal"-Button → triggert Server-Agent
- Action-Bar: [Verwerfen] [Speichern] [Online gehen]

### NewPostSheet
- Plattform-Picker (Multi-Select aus Lukas' verbundenen Accounts)
- Uhrzeit-Picker
- Optional: 1-Zeilen-Hook fuer KI ("Aufhaenger fuer KI")
- "Erstellen"-Button → erstellt leeren Post mit Marker `ai_initial=true` ODER triggert direkt Server-Agent

### "KI-nochmal"-Mechanik — Default umgedreht nach Public-API-Realitaet

Die Public-API-Deep-Analyse (`.planning/codebase/public-api-deep.md`) zeigt:
- **`GET /public/posts/:id/comments` ist no-auth (jeder mit Post-ID kann lesen)** ✓
- **Write-Comment existiert NUR im internal `/api/*` mit Cookie-JWT** ✗ Public-API hat keinen Comment-Write-Endpoint
- **Webhooks feuern NUR bei successful-publish, kein comment-added** ✗

→ **Variante 1 (Comment-Pattern) wuerde erfordern, dass Mobile-UI Comments schreibt** — was nur via interne Cookie-JWT-API geht. Das ist ok wenn Mobile-UI im selben Frontend lebt (sie hat dann den Cookie ohnehin), aber unsauber als "Server-Agent-Trigger" weil der Server-Agent KEINEN Cookie hat.

**Neue Default-Empfehlung: Variante 2 (Direct-Webhook).**

Fluss:
```
Mobile-UI (im Postiz-Frontend, hat User-Cookie)
   ↓ "KI nochmal"-Button mit Feedback-Text
   ↓ POST https://agent.husatech.de/regen
   ↓   { post_id, feedback, current_body, image_url, platforms }
   ↓   Authorization: Bearer <SHARED_AGENT_TOKEN>
   ▼
Server-Agent (Server 77)
   ↓ Brand-Voice + Skill + Feedback laden
   ↓ AIProvider.regenerate(...)
   ↓ ggfs. ImageProvider.generate(...)
   ▼
Postiz Public-API
   ↓ POST /public/v1/posts mit type='update', posts[].value[i].id=...
   ▼
Mobile-UI sieht aktualisierten Body via SWR-Refresh
```

Vorteile:
- Sauber getrennte API-Surfaces (Postiz fuer Daten, Agent fuer KI)
- Keine Polling-Pflicht
- Schnelle Reaktionszeit
- Comment-Schema in Postiz bleibt frei

Nachteile (akzeptabel):
- Zwei API-Surfaces im Frontend (loesbar mit thin wrapper-hook)
- Agent-Endpoint braucht eigenen Auth (Shared-Token reicht fuer Single-User)
- CORS-Setup zwischen agents.wawihub.de (UI) und agent.husatech.de (Server) — trivial

---

## D. AGPL-Compliance

Unveraendert: Selfhost auf Server 77, NUR Husatech-interne Nutzung → keine AGPL-Source-Disclosure-Pflicht. Sehr sauber: weil Aenderungen jetzt fast nur Frontend-Additive sind, ist die Diff-Liste gegen Upstream sehr klein.

---

## E. Reihenfolge — vereinfachte Phasen

**Phase 1 — UI-Spec:** Mit `/frontend-design:frontend-design` Skill Wireframes fuer 3 Screens + Klick-Pfade. Output: `.planning/ui-spec.md`. **KEIN Code.**

**Phase 2 — Public-API-Verifikation:** (laeuft gerade als deep-analyse) Wir wissen exakt was via API geht und wo Luecken sind.

**Phase 3 — PWA-Foundation + Mobile-Layout-Shell:** Manifest + `(mobile)/layout.tsx` mit BottomNav + Tailwind-Breakpoints + Viewport-Meta.

**Phase 4 — MobileCalendar:** `useCalendar`-Context wiederverwenden, neuer Mobile-Grid, Tap-on-Day → NewPostSheet.

**Phase 5 — MobilePostDetail:** `useLaunchStore` wiederverwenden, single-column Layout, Bild/Video-Picker, Plattform-Picker, KI-nochmal-Trigger.

**Phase 6 — Server-Agent (auf Server 77, eigenes Repo):** Postiz-API-Client + Comment-Watcher + claude --print Worker mit Brand-Voice. Das ist KEIN Postiz-Fork-Code, das ist eigenes Server-Repo.

**Phase 7 — Hardening + Deployment:** Frontend-Tests fuer neuen Mobile-Code, ESLint-Fix, Server-77-Container ersetzen.

Jede Phase: explizites Akzeptanz-Kriterium, atomic Commit auf eigenem Branch, `/coding-team` Review.

---

## F. Entscheidungen die Lukas treffen muss vor Phase 1

| # | Frage | Default-Vorschlag |
|---|---|---|
| 1 | **Plattformen fuer V1 Mobile-UI**? | LinkedIn + Meta (Instagram + Facebook). Vorschlags-Worker V1: NUR LinkedIn. |
| 2 | **KI-nochmal-Mechanik**: Comment-Pattern, direkter Webhook, oder Custom-Field? | **Direct-Webhook** (Variante 2) — verifiziert sauberer nach Public-API-Realitaet, weil Comment-Write nicht via Public-API exposed ist |
| 3 | **PWA-Scope**: nur installierbar oder auch offline? | Nur installierbar (V1) |
| 4 | **Existierenden Postiz-Container auf Server 77 ersetzen oder parallel laufen lassen**? | Ersetzen (Container-Switch nach Test) |
| 5 | **Server-Agent**: in welchem Repo? Eigenes neues Repo oder Teil des command-center? | Eigenes Repo `husatech-social-agent` (klare Trennung) |
| 6 | **Provider-Default V1**: Postiz + Claude + NB2 als Default fixieren? | Ja — alle drei als V1-Defaults, Interface aber austauschbar. Image-Slot zusaetzlich gpt-image-1 als zweite V1-Option, mehr Provider NICHT in V1 |
| 7 | **Wo lebt das Server-Agent-Repo physisch**? | `/root/husatech/social-agent/` auf Server 77 (analog zu jtl-plattform-mcp) |
| 8 | **Sprache des Server-Agents**: Python (FastAPI/APScheduler — vorhandene Patterns) oder Node? | Python (Lukas hat schon Brand-Voice-Loader, gemini_image.py, content_review_loop.py) |

---

## I. Postiz Public-API — verifizierte Realitaet (Stand 30.04.2026)

Quelle: `.planning/codebase/public-api-deep.md` (1223 Zeilen, Source-zitiert)

### Auth
- Header: **plain `Authorization: <token>` (KEIN `Bearer`-Prefix)**
- API-Key per-Org (eine pro Organization), `fixedEncryption(makeId(20))`-Format
- `pos_*` OAuth-Token: scope-less, kein Refresh, nur Revoke
- Rate-Limit nur auf `POST /public/v1/posts` (default 30/h, env `API_LIMIT`)

### Was der Server-Agent via Public-API kann
| Capability | Endpoint | Status |
|---|---|---|
| Post erstellen (multi-plattform) | `POST /public/v1/posts` mit N Posts in `posts[]`, jeder mit eigener `integration.id` | ✅ nativ |
| Post body austauschen | `POST /public/v1/posts` mit `type='update'`, `posts[].value[i].id=<existing>` | ✅ State preserved |
| Posts listen | `GET /posts` (Filter via Query) | ✅ |
| Post detail | `GET /posts/:id/missing` | ✅ teilweise (eigentlich fuer "missing slots") |
| Status setzen | `PUT /posts/:id/status` | ⚠ nur `draft ↔ schedule` |
| Post loeschen | `DELETE /posts/:id` | ✅ |
| Media hochladen | `POST /upload` (multipart), `POST /upload-from-url` | ✅ |
| Video generieren | `POST /generate-video`, `POST /video/function` | ✅ |
| Integrations listen | `GET /integrations` | ✅ |
| Comments lesen | `GET /public/posts/:id/comments` (no-auth!) | ✅ |
| **Comments schreiben** | nur internal `/api/*` mit Cookie-JWT | ❌ GAP |
| **Webhooks bei post-create / comment-added** | nur `successful-publish` feuert | ❌ GAP |
| Postiz-AI von auszen triggern | nicht exposed | ❌ (irrelevant fuer uns — KI ist auf Server) |

### Subtle Bug zu beachten
Drafts via Public-API: Controller erzwingt `replaceDraft=true`, was `mapTypeToPost` als scheduled validiert (vollstaendiges `settings` noetig), dann body.type='draft' restoriert. **Konsequenz:** Wenn Server-Agent Draft via Public-API anlegt, muss er complete `settings`-Block senden (anders als internal API).

### Konsequenz fuer den Plan
- **Server-Agent nutzt ausschliesslich Public-API** (kein Cookie-JWT als Lukas-User noetig)
- **Mobile-UI nutzt internal `/api/*`** (sie hat Cookie ohnehin) fuer alles inklusive Comment-Schreiben (falls noetig)
- **"KI nochmal"-Trigger geht NICHT ueber Postiz-Comments**, sondern direkten HTTP-Call vom Mobile-UI zum Server-Agent (Variante 2 oben)
- **Webhook-Limitation tolerierbar**: wir brauchen kein Webhook von Postiz, weil Mobile-UI direkt triggert

---

## H. Plattform-/KI-Unabhaengigkeit als Architektur-Prinzip

**Server-Agent-Repo-Layout (Vorschlag):**

```
~/agent/husatech-social-agent/        (oder /root/husatech/social-agent/)
├── README.md
├── pyproject.toml                    (FastAPI + httpx + APScheduler + python-frontmatter)
├── agent/
│   ├── core/
│   │   ├── orchestrator.py          (Hauptloop: Hooks → Skills → Provider-Calls)
│   │   ├── context_loader.py        (Mtime-Cached MD-File-Loader, minimal Context)
│   │   ├── skill_runner.py          (claude --print Subprocess-Wrapper)
│   │   └── hook_dispatcher.py       (Hook-Registry + Trigger-Matching)
│   ├── providers/
│   │   ├── posting/
│   │   │   ├── base.py              (Interface PostingProvider)
│   │   │   ├── postiz.py            (Default V1)
│   │   │   ├── direct_linkedin.py   (Future)
│   │   │   └── buffer.py            (Future)
│   │   ├── ai/
│   │   │   ├── base.py              (Interface AIProvider)
│   │   │   ├── claude.py            (Default V1 via claude --print + Skill)
│   │   │   ├── openai.py            (Future)
│   │   │   └── gemini.py            (Future)
│   │   └── image/
│   │       ├── base.py              (Interface ImageProvider)
│   │       ├── nano_banana.py       (Default V1, Google Gemini Nano Banana 2)
│   │       └── gpt_image.py         (V1 Alternative, OpenAI gpt-image-1)
│   ├── workflows/
│   │   ├── on_comment_added.py      (Hook: regen Body)
│   │   ├── on_post_created.py       (Hook: initial AI generation)
│   │   ├── on_status_changed.py     (Hook: schedule, publish, etc.)
│   │   └── scheduled_check.py       (Hook: nightly diversity check)
│   └── api/
│       ├── webhooks.py              (Endpoint /webhooks/postiz)
│       └── manual_trigger.py        (Endpoint /trigger/regen)
├── config/
│   ├── providers.toml               (Welcher Provider aktiv ist — austauschbar via Edit)
│   └── workflows.toml               (Welche Hooks aktiv sind)
└── data/
    ├── brand/                       (Symlinks zu ~/company/brand/*.md)
    └── strategy/                    (Symlinks zu ~/content/calendar/*.md)
```

**Konfiguration ueber TOML, nicht Code:**

```toml
# config/providers.toml
[posting]
active = "postiz"

[posting.postiz]
api_url = "http://127.0.0.1:5000"
api_key_env = "POSTIZ_API_KEY"

[ai]
active = "claude"

[ai.claude]
binary = "claude"
skill = "linkedin-review"
timeout = 300

[image]
active = "nano_banana"   # alternativ: "gpt_image"

[image.nano_banana]
helper_path = "~/infrastructure/scripts/image_helpers/gemini_image.py"
api_key_env = "GEMINI_API_KEY"
default_aspect = "4:5"

[image.gpt_image]
api_key_env = "OPENAI_API_KEY"
model = "gpt-image-1"        # OpenAI's aktuelles Image-Modell
default_size = "1024x1536"
default_quality = "high"
```

**Provider austauschen = nur TOML editieren + neuer Provider implementiert das Interface.**

**Workflows als MD + Hooks (nicht als Code):**

Beispiel `agent/workflows/on_comment_added.py`:
```python
def trigger(post_id: str, comment: str) -> None:
    context = load_context([
        "~/company/brand/brand-voice.md",
        "~/content/calendar/content-strategy.md",
        f"~/content/social-media/{platform}/channel-config.md",
    ])
    skill = "~/.claude/skills/linkedin-review/SKILL.md"
    new_body = ai_provider.regenerate(
        skill=skill,
        context=context,
        existing_post=fetch_post(post_id),
        feedback=comment,
    )
    posting_provider.update_post(post_id, body=new_body)
```

**Kontext-Minimierung:**
- `load_context()` laedt NUR die genannten Dateien
- mtime-Cache vermeidet redundante Disk-Reads
- KEIN globaler "alles laden" — pro Hook nur was relevant
- Skills sind self-contained → claude bekommt nur Skill-MD + Context-Files + Comment

---

## G. Was NICHT Teil dieses Vorschlags ist

- Web-Push-Notifications
- Analytics-Mobile-Views
- Postiz' eigene "Plugs" / Automation-Pipelines
- Marketplace (Sets/Orders)
- Skool-Integration (Chrome-Extension)
- UGC / Affiliate / Streak / Onboarding
- Settings-Page Mobile-optimieren (vorerst Desktop)
- Multi-User / Multi-Tenant (Lukas nur)
- Brand-Voice-Loader im Postiz-Backend (gehoert auf Server)
- Status-State-Machine im Postiz-Backend (gehoert auf Server)
