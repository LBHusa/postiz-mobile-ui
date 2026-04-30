# Phasen-Plan — Mobile-First Postiz-Fork V1

**Stand:** 2026-04-30
**Quellen:** `.planning/ui-spec.md` + `.planning/proposals/01-mobile-first-strategy.md` + `.planning/codebase/*.md`
**Prinzip:** Jede Phase atomic, eigener Branch, expliziter Acceptance-Test, niemals oberflaechlich.

---

## Phasen-Uebersicht

| # | Phase | Branch | Coding-Team-Fokus | Dauer-Estimate |
|---|---|---|---|---|
| 1 | PWA + Mobile-Layout-Shell | `feat/mobile-shell` | frontend + qa | 1 Tag |
| 2 | MobileCalendar (Monat + Woche, mit Vorschlags-Markern) | `feat/mobile-calendar` | frontend + frontend-design + qa | 2-3 Tage |
| 3 | MobilePostDetail (Notion-Page, Comments, Plattform-Cards) | `feat/mobile-detail` | frontend + frontend-design + qa | 3-4 Tage |
| 4 | Server-Agent Foundation (Provider-Plug-in, Brand-Voice-Loader, Postiz-Client) | `feat/server-agent-foundation` (eigenes Repo) | backend + database + researcher + qa | 2 Tage |
| 5 | Re-Gen-Loop (Comment+Status-Trigger → KI → Postiz-Update) | `feat/regen-loop` (Repo: Server-Agent) | backend + qa | 2 Tage |
| 6 | Vorschlags-Workflow + Inbox (Server-Worker + Mobile-Inbox-Screen) | `feat/proposals` (beide Repos) | backend + frontend + frontend-design + qa | 3-4 Tage |
| 7 | Hardening + Deployment (Tests, ESLint-Fix, Container-Switch Server 77) | `feat/deploy` | qa + backend + researcher | 1-2 Tage |

**Gesamt: 14-19 Tage** (eine Person, fokussiert).

---

## Pro-Phase Verbindlichkeiten

Jede Phase MUSS haben:
1. **Eigener Branch** ab `main` des Forks (`origin/main` oder `husatech-main`)
2. **PLAN.md im Phase-Folder** mit:
   - Goal (1 Satz)
   - Files-to-create (Liste)
   - Files-to-modify (Liste mit konkreten Aenderungen)
   - Acceptance-Kriterium (live verifizierbar, nicht "Code existiert")
   - Out-of-Scope (was NICHT in dieser Phase)
3. **Atomic Commits** mit beschreibenden Messages
4. **Coding-Team-Review** vor Merge: frontend + backend + database + qa + researcher (je nach Fokus)
5. **Live-Verifikation** des Acceptance-Kriteriums (bei UI: dev-server + Browser; bei Backend: curl-Tests)
6. **VERIFICATION.md im Phase-Folder** mit:
   - Was getestet wurde
   - Was funktioniert
   - Bekannte Issues (falls in OK-Range)

---

## Phase 1: PWA + Mobile-Layout-Shell

**Goal:** Mobile-Layer existiert unter `/m/*`, ist als PWA installierbar, hat Bottom-Tab-Navigation, hat Tailwind-Mobile-First-Breakpoints. Noch leer (Calendar/Detail/Inbox kommen in Phase 2-3-6).

**Detail-Plan:** `phases/phase-01-pwa-shell/PLAN.md`

**Acceptance:**
- `socialmedia.wawihub.de/m` redirectet zu `/m/kalender`
- `/m/kalender` zeigt leeren Calendar-Skeleton mit Header "Kalender"
- BottomNav unten hat 3 Tabs (Kalender / Vorschlaege / Mehr) — Tap wechselt URL
- iPhone Safari: "Zum Home-Bildschirm" zeigt Husatech-Icon, oeffnet als Standalone-App ohne Browser-Chrome
- `viewport`-Meta korrekt gesetzt (keine horizontale Scrollbar mobile)
- Tailwind-Standard-Breakpoints `sm/md/lg` funktionieren parallel zu existierenden `mobile:`-Customs

---

## Phase 2: MobileCalendar

**Goal:** Calendar-Screen produktiv: Monatsansicht + Wochenansicht, dynamisch aus `useCalendar`-Context, Vorschlags-Punkte als gestrichelte Markierung (Daten zunaechst gemockt — echte Vorschlaege kommen in Phase 6).

**Detail-Plan:** `phases/phase-02-mobile-calendar/PLAN.md`

**Acceptance:**
- Monatsansicht zeigt aktuelle Postiz-Posts als farbige Punkte korrekt
- Tap auf Tag mit 1 Post → Detail-Page (404-Page acceptable in dieser Phase)
- Tap auf Tag mit mehreren Posts → Bottom-Sheet mit Liste
- Tap auf "+" oben rechts → "Datum waehlen"-Sheet → Detail-Page mit vorgewaehltem Datum
- Toggle zwischen Monat / Woche oben rechts
- Wochenansicht zeigt 7-Tag-Header mit Counters + Posts gruppiert pro Tag
- Status-Punkte korrekt nach 8 States gefaerbt
- Plattform-Logos kommen aus `integration.picture` (dynamisch via `useIntegrations()`)

---

## Phase 3: MobilePostDetail

**Goal:** Vollstaendige Detail-Page (Notion-Style): Title-Edit, Properties-Block, Body mit Tiptap, Media-Block mit zwei Buttons (KI/Upload), 3 Comment-Modi, Plattform-Cards mit Format-Settings, "Anpassen fuer"-Button (Stub, ohne echten Server-Agent), Bottom-Action-Bar.

**Detail-Plan:** `phases/phase-03-mobile-detail/PLAN.md`

**Acceptance:**
- Detail-Page rendert alle Properties (Datum, Zeit, Status, Plattformen)
- Title inline editierbar, persistiert beim Tab-Wechsel
- Body editierbar in Tiptap mit Mobile-friendly Toolbar
- Bild-Block: [📁 Upload] funktioniert (echte Datei via Postiz `POST /api/upload`)
- Bild-Block: [🤖 KI generieren] zeigt Stub-Toast "noch nicht verbunden, Phase 5"
- Long-Press auf Body-Text → Custom-Menu mit "💬 Kommentieren" → Bottom-Sheet → Comment speichert via Postiz `/api/posts/:id/comments`
- Page-Comment via [💬+] funktioniert
- Plattform-Cards (dynamisch) mit Auswahl-Toggle + ausklappbarem Format-Picker
- Status-Picker via Bottom-Sheet, persistiert via Postiz Status-API

---

## Phase 4: Server-Agent Foundation

**Goal:** Eigenes Repo `husatech-social-agent` (Python, FastAPI) auf Server 77 unter `/root/husatech/social-agent/`. Provider-Plug-in-Architektur (PostingProvider/AIProvider/ImageProvider mit Postiz/Claude/NB2 als V1-Defaults). Brand-Voice-Loader mit mtime-Cache. Health-Endpoint. KEIN Re-Gen-Loop noch (kommt Phase 5).

**Detail-Plan:** `phases/phase-04-server-agent-foundation/PLAN.md`

**Acceptance:**
- Repo `LBHusa/husatech-social-agent` existiert auf GitHub + lokal
- `pyproject.toml` mit allen Deps, `pip install -e .` laeuft durch
- `python -m agent.cli health` liefert: alle Provider connected, Brand-Voice-Files alle gefunden
- `config/providers.toml` ist Single-Source-of-Truth
- Postiz-API-Client kann via `pos_*`-Token Posts listen, einen Test-Post erstellen + loeschen
- Brand-Voice-Loader laedt nur expliziet angegebene Files, mtime-Cache funktioniert
- FastAPI startet auf Port 9100, `/health` liefert 200

---

## Phase 5: Re-Gen-Loop

**Goal:** Mobile-UI Status-Picker auf "Re-Gen" triggert Server-Agent. Server-Agent zieht Comments + Body + Media via Postiz-API, ruft claude --print mit Brand-Voice + Comments, ggfs. ImageProvider, updated Body + Media via Postiz-API. Top-Bar zeigt KI-Visual.

**Detail-Plan:** `phases/phase-05-regen-loop/PLAN.md`

**Acceptance:**
- Mobile-UI Status auf "Re-Gen" → POST `agent.husatech.de/regen` mit Post-ID
- Server-Agent zieht Comments via Postiz `GET /api/posts/:id/comments`
- claude --print mit Skill `linkedin-review` + Comments + Brand-Voice → JSON-Output
- Body + ggfs. Bild via Postiz `POST /public/v1/posts type=update` aktualisiert
- Mobile-UI sieht Update via SWR-Refresh
- Top-Bar-Banner und Skeleton-Placeholder waehrend Generation sichtbar
- Status zurueck auf `draft` nach Erfolg, oder `failed` mit Error-Toast

---

## Phase 6: Vorschlags-Workflow + Inbox

**Goal:** Vorschlags-Inbox-Screen + Server-Workflow `weekly_proposals.py`. Cron So 18:00 + manueller Trigger. Telegram-Push bei neuen Vorschlaegen. Vorschlaege erscheinen im Calendar als gestrichelte Punkte.

**Detail-Plan:** `phases/phase-06-proposals-inbox/PLAN.md`

**Acceptance:**
- Vorschlags-Inbox-Screen unter `/m/vorschlaege` zeigt Liste mit expandable Cards
- Manueller Trigger: 1/2/4 Wochen → Server-Agent generiert N Vorschlaege strategisch
- Server-Agent beruecksichtigt bereits geplante Posts (vermeidet Doppel-Pillar/-Funnel)
- Datum + Uhrzeit variieren (Mo/Mi/Do/Fr × 3 Tageszeiten randomisiert)
- Telegram-Notification bei Generation-Done
- Calendar zeigt gestrichelte Punkte fuer Vorschlaege
- Inbox + Calendar haben "Annehmen"-Action: Server-Agent erstellt vollen Beitrag (Body + Bild + First-Comment) → Postiz-Draft
- Cron-Job auf Server 77 laeuft jeden Sonntag 18:00 (APScheduler)

---

## Phase 7: Hardening + Deployment

**Goal:** Mindest-Tests fuer Mobile-Code + Server-Agent. ESLint-Workflow im Postiz-Fork fixen. Server-77-Container ersetzen (Old-Postiz-Container backup, neuer Husatech-Postiz-Container live).

**Detail-Plan:** `phases/phase-07-hardening-deploy/PLAN.md`

**Acceptance:**
- Frontend: 1 Smoke-Test pro Mobile-Component (Vitest + Testing-Library)
- Server-Agent: 1 Test pro Provider-Interface + 1 End-to-End (Mock-Postiz)
- ESLint laeuft sauber im Postiz-Fork
- `socialmedia.wawihub.de` zeigt neue Husatech-Postiz-Build
- Old-Postiz-Container-Backup verfuegbar fuer Rollback
- `agent.husatech.de` (oder Subpath) erreichbar, alle Endpoints funktional
- Telegram-Notification bei Cron-Run + bei Re-Gen-Erfolg/Fehler
- Memory-Update mit "V2 V1 deployed"

---

## Reihenfolge-Logik

- Phase 1-3 sind reines Frontend (am Postiz-Fork) — koennen ohne Server-Agent laufen
- Phase 4 startet Server-Agent-Repo separat (eigenes GitHub-Repo)
- Phase 5 verbindet Mobile-UI mit Server-Agent fuer Re-Gen
- Phase 6 ergaenzt Vorschlags-Workflow (auf Server) + Inbox-UI
- Phase 7 hardened beides + deployt

Reihenfolge ist sequentiell — KEINE Phasen parallel weil die spaeter die frueheren als Foundation brauchen. Coding-Team kann innerhalb einer Phase parallel arbeiten (frontend + backend + qa gleichzeitig).
