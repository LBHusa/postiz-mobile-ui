# Phase 2: MobileCalendar (Monat + Woche, mit Vorschlags-Markern)

**Branch:** `feat/mobile-calendar` (von `feat/mobile-shell` ab — nach Phase 1 Merge)
**Coding-Team-Fokus:** frontend (lead) + frontend-design + qa
**Frontend-Design-Skill:** JA — Calendar ist visuell zentral, distinct visual design wichtig
**Goal:** Mobile-Calendar produktiv: Monatsansicht (Default) + Wochenansicht, dynamische Daten aus `useCalendar`-Context (existing), Tap-on-Day → Bottom-Sheet, Vorschlags-Markierungen als Stub (echte Daten kommen Phase 6).

---

## Files-to-create

### Wiederverwendbare Mobile-Calendar-Components
- `apps/frontend/src/components/mobile/MobileCalendar.tsx` — Wrapper mit View-Switcher (Monat | Woche), nutzt `useCalendar()`-Context
- `apps/frontend/src/components/mobile/MobileCalendarMonth.tsx` — 7-Spalten-Monatsraster mit Status-Punkten pro Tag
- `apps/frontend/src/components/mobile/MobileCalendarWeek.tsx` — 7-Tag-Header mit Counters + Posts gruppiert pro Tag (kein 24h-Grid)
- `apps/frontend/src/components/mobile/CalendarDayCell.tsx` — eine Tageszelle (in Monatsansicht) mit Punkten
- `apps/frontend/src/components/mobile/CalendarPostCard.tsx` — eine Post-Karte (Time + Plattform-Logos + Title-Snippet + Status-Pille)
- `apps/frontend/src/components/mobile/DaySheet.tsx` — Bottom-Sheet bei Tap-on-Day mit Tagesliste
- `apps/frontend/src/components/mobile/StatusDot.tsx` — Status-Punkt (gefüllt für echte Posts, gestrichelt für Vorschläge)
- `apps/frontend/src/components/mobile/PlatformLogos.tsx` — Mini-Plattform-Logos (dynamic aus `integration.picture`)

### Hooks
- `apps/frontend/src/hooks/use-status-mapping.ts` — Mapping Postiz `enum State` → 8 unsere Status-States (idea/draft/re_gen/approved/scheduled/online/failed/proposal)
  - Phase 2: read-only mapping, kein Status-Setting noch (das kommt Phase 3 Detail-Page)
- `apps/frontend/src/hooks/use-mobile-calendar-config.ts` — Config aus localStorage (View-Pref Monat/Woche, etc.)

### Routes (echte page.tsx)
- `apps/frontend/src/app/(app)/m/kalender/page.tsx` — REPLACE Placeholder mit echter `<MobileCalendar />` Komponente

---

## Files-to-modify

### `apps/frontend/src/app/(app)/m/layout.tsx`
- Header-Title-Slot dynamisch (z.B. "Kalender" für /m/kalender, "Vorschläge" für /m/vorschlaege)
- HeaderRight-Slot mit "+" Button für /m/kalender (Tap → Sheet "Datum wählen")
- View-Switcher (Mo|Wo) als Header-Right-Slot in Calendar-Page

### Reuse statt Replace (KEINE Änderung):
- `apps/frontend/src/components/launches/calendar.context.tsx` — wird DIREKT importiert, NICHT modifiziert
- `apps/frontend/src/components/launches/helpers/use.values.ts` — wenn relevant

---

## Out-of-Scope (Phase 2 macht NICHT)

- Detail-Page (Phase 3)
- Tap-Verhalten "Plus → direkt Detail-Page" (Phase 3)
- KI-Visual-Banner active state (Phase 5)
- Vorschlags-Daten-Source (Phase 6 — wir mocken Vorschläge in Phase 2)
- DnD auf Mobile (out-of-scope, ggfs. V2)
- Drag-to-Schedule (out-of-scope V1)
- Wochenansicht-Tag-Swipe-Gesten (Phase 2-extension oder Phase 7)

---

## Acceptance-Kriterium (live verifizierbar)

1. **Monatsansicht Default**: `/m/kalender` zeigt aktuelle Postiz-Posts als farbige Punkte korrekt im Kalenderraster
2. **Punkt-Farben** entsprechen Status-Mapping (gelb=Draft, blau=Scheduled, grün=Online, rot=Failed)
3. **Mehrere Posts/Tag** zeigen mehrere Punkte (max 4 sichtbar, dann "+N")
4. **Vorschlags-Punkte** als gestrichelte Variante sichtbar (mit Mock-Daten — z.B. eine Vorschlag-Post in `useMobileProposals()` Hook der zunächst statisch retournt)
5. **Wochenansicht via Toggle** zeigt 7-Tag-Header mit Counters pro Tag + Posts darunter gruppiert
6. **Tap auf Tag mit 1 Post** → DaySheet öffnet sich (Bottom-Sheet) mit dem Post als Karte
7. **Tap auf Tag mit mehreren Posts** → DaySheet mit Liste
8. **Tap auf leeren Tag** → DaySheet mit "+ Neuer Post für diesen Tag" Button (Tap führt zu Phase-3-Stub: Toast "Phase 3 noch nicht da")
9. **Plattform-Logos** kommen aus `integration.picture` (verifiziert via dynamischer Hook-Call), NICHT hardcoded
10. **Heute** ist als Pille hervorgehoben im Monatsraster
11. **View-Switcher** Toggle (Mo | Wo) oben rechts, persistiert via localStorage
12. **Wochen-Navigation** ‹/› funktioniert korrekt (vorherige/nächste Woche/Monat)
13. **Existing Desktop-Calendar** `/launches` rendert weiterhin korrekt (kein Regress)
14. **Performance**: Calendar mit 50+ Posts rendert in <200ms (Lighthouse-Audit)

---

## Verification-Approach

- Frontend-Agent: implementiert
- Frontend-Design-Agent: Visual-Polish (Farben, Spacing, Typografie, Animations für Tap-Feedback) — basierend auf ui-spec.md Section 4
- QA-Agent: Playwright-Tests für 14 Acceptance-Kriterien

---

## Wichtige Reuse-Hinweise

`calendar.context.tsx` ist UI-agnostisch und liefert:
- `useCalendar()` mit `posts`, `setFilters`, `currentDay`, `currentWeek`, `display`, etc.
- SWR-basiert, refresh interval 1h
- Zwei parallele Queries: calendar view + list view

→ MobileCalendar nutzt `useCalendar()` direkt. Keine eigene SWR-Logik. Kein Backend-Code.

---

## Anti-Hardcoding-Pflicht (aus ui-spec.md Section 1.1)

- Status-States: NICHT hardcoded — kommen aus Server-Agent `/api/workflow/states` (in Phase 4 implementiert; Phase 2 nutzt Stub-Hook `useStatusStates()` der vorerst statische Liste retournt)
- Plattform-Logos: aus `integration.picture` URL via `useIntegrations()` Hook
- Plattform-Names: aus `integration.name`

Phase 2 darf temporäre Stub-Hooks haben (für Daten die in späteren Phasen kommen), aber KEINE statischen Plattform-Logos im Code.

---

## Frontend-Design-Skill-Use (V1 erstmaliger Einsatz)

Phase 2 ist die erste Phase mit echtem distinctem visuellem Design. Frontend-Design-Skill produziert:
- Farb-Tokens für die 8 Status-Punkte (im Einklang mit existing colors.scss)
- Spacing-System für Calendar-Cells (Mobile: 14% Breite pro Spalte, etc.)
- Typografie für Date-Labels, Counter, Plattform-Names
- Animations für Tap-Feedback (Sheet-Slide-Up, Punkt-Highlight)
- Custom Tailwind-Plugins für Edge-Cases (z.B. radial gradient für selected day)

Output Frontend-Design: optisch finalisierte Komponenten, mit Abstimmung auf Notion-Mobile-Look (clean, Whitespace, sanft animiert).

---

## Commit-Strategie

- 1 Commit pro logischer Einheit:
  - `feat(mobile): add use-status-mapping + use-mobile-calendar-config hooks`
  - `feat(mobile): add StatusDot, PlatformLogos primitives`
  - `feat(mobile): add CalendarDayCell + CalendarPostCard`
  - `feat(mobile): add MobileCalendarMonth + MobileCalendarWeek views`
  - `feat(mobile): add DaySheet with day list and add-post action`
  - `feat(mobile): wire MobileCalendar into /m/kalender route`
  - `feat(mobile): integrate frontend-design polish for calendar`
  - `test(mobile): add Playwright tests for Phase 2 acceptance criteria`
  - `chore(mobile): mark Phase 2 verification complete`
