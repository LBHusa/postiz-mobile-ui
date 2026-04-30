# Phase 3: MobilePostDetail (Notion-Page Style)

**Branch:** `feat/mobile-detail` (von `feat/mobile-calendar` ab)
**Coding-Team-Fokus:** frontend (lead) + frontend-design + qa
**Goal:** Vollständige Detail-Page im Notion-Style: Title-Edit, Properties-Block, Body in Tiptap, Media-Block (KI/Upload), 3 Comment-Modi, Plattform-Cards mit Format-Settings, "Anpassen für"-Stub, Bottom-Action-Bar.

---

## Files-to-create

### Mobile-Detail-Components
- `apps/frontend/src/components/mobile/MobilePostDetail.tsx` — Main-Component (Notion-Page-Style, Properties-Block, scrollable, Action-Bar)
- `apps/frontend/src/components/mobile/PostTitle.tsx` — inline-editable Heading (Tap → Input)
- `apps/frontend/src/components/mobile/PostProperties.tsx` — Datum/Uhrzeit/Status/Plattformen Block
- `apps/frontend/src/components/mobile/PostBodyEditor.tsx` — Tiptap-Editor (mobile-tuned, REUSE `editor.tsx` Tiptap-Extensions, eigenes Chrome)
- `apps/frontend/src/components/mobile/MediaBlock.tsx` — Bild/Video-Anzeige + 2 Buttons (KI-generieren / Upload)
- `apps/frontend/src/components/mobile/PlatformCard.tsx` — Eine Plattform-Card mit Toggle + Format-Picker (per-Platform)
- `apps/frontend/src/components/mobile/PlatformList.tsx` — Liste der Plattform-Cards
- `apps/frontend/src/components/mobile/CommentsSection.tsx` — Page-Comments-Liste + neuer Kommentar
- `apps/frontend/src/components/mobile/CommentInput.tsx` — Bottom-Sheet für neuen Kommentar
- `apps/frontend/src/components/mobile/InlineCommentMark.tsx` — Tiptap-Extension für Inline-Selection-Comments (Long-Press → "Kommentieren")
- `apps/frontend/src/components/mobile/MediaCommentInput.tsx` — Bottom-Sheet für Media-Kommentar
- `apps/frontend/src/components/mobile/StatusPicker.tsx` — Bottom-Sheet mit allen Status-States
- `apps/frontend/src/components/mobile/DateTimePicker.tsx` — Mobile-friendly Date+Time-Picker (eigener, NICHT Mantine das auf Mobile schwierig)
- `apps/frontend/src/components/mobile/PostActionBar.tsx` — Fixed-Bottom Action-Bar [💬+] [📷] [🎬] [Status ▾] [📤]
- `apps/frontend/src/components/mobile/AdaptForButton.tsx` — "Anpassen für ausgewählte Plattformen" (Stub bis Phase 5)

### Hooks
- `apps/frontend/src/hooks/use-post-detail.ts` — Lädt Post via `useFetch` + SWR `/posts/:id`
- `apps/frontend/src/hooks/use-post-mutate.ts` — Update-Funktionen (PATCH /posts/:id für body, date, status)
- `apps/frontend/src/hooks/use-comments.ts` — Comments lesen + schreiben via Postiz internal API
- `apps/frontend/src/hooks/use-media-upload.ts` — Multipart Upload via `/api/upload`
- `apps/frontend/src/hooks/use-platform-formats.ts` — Format-Optionen pro Plattform (statisch in Phase 3, dynamisch via Server-Agent in Phase 4+)

### Routes
- `apps/frontend/src/app/(app)/m/post/[id]/page.tsx` — Detail-Page-Route mit `<MobilePostDetail postId={params.id} />`

---

## Files-to-modify

### Calendar-Wire-Up
- `apps/frontend/src/components/mobile/CalendarPostCard.tsx` — Tap aktiviert `router.push(/m/post/{post.id})`
- `apps/frontend/src/components/mobile/DaySheet.tsx` — Tap-on-Post-Card aktiviert ebenfalls Navigation

### REUSE statt Replace (NICHT modifizieren):
- `apps/frontend/src/components/new-launch/store.ts` — Zustand-Store für Post-Drafts (Phase 4-5 dann genutzt für KI-Generation)
- `apps/frontend/src/components/new-launch/editor.tsx` — Tiptap-Extension-Config (importieren, eigenes Chrome bauen)
- Postiz internal API endpoints (`/api/posts/*`, `/api/upload`) — wir rufen via existing `useFetch`-Hook

---

## Out-of-Scope (Phase 3 macht NICHT)

- KI-Re-Gen-Loop (Phase 5 — Status-Picker zeigt "Re-Gen" als Option, aber Trigger ist Stub-Toast)
- Server-Agent-Integration (Phase 4-5)
- Vorschlags-Annahme (Phase 6)
- Status-Transitions wirklich an Postiz schicken (Phase 5 — Stub: Postiz `PUT /posts/:id/status` für draft↔schedule schon Phase 3, aber Re-Gen nur lokal)
- Inline-Selection-Comments für Tiptap-Mark — Phase 3 macht Page-Comments + Media-Comments. Inline-Selection ist ggfs. Phase 7 Polish (komplex)
- Adaptiv pro Plattform unterschiedlicher Body-Override — Phase 3 zeigt UI-Toggle (per-Platform-Toggle "abweichend"), aber actual Variation kommt Phase 5 via Server-Agent

---

## Acceptance-Kriterium (live verifizierbar)

1. `/m/post/[id]` lädt einen existierenden Postiz-Post (via internal `/api/posts/:id`)
2. Title inline editierbar — Tap zum Editieren, Speichern via Blur-Event
3. Properties-Block zeigt Datum, Uhrzeit, Status, Plattformen — alle inline editierbar
4. Datum-Tap öffnet DateTimePicker-Sheet (mobile-friendly)
5. Status-Tap öffnet StatusPicker-Sheet mit 8 States (idea/draft/re_gen/approved/scheduled/online/failed/proposal)
6. Body in Tiptap editierbar (mobile-Toolbar minimal, KEIN großes Format-Menü)
7. Media-Block zeigt Bild/Video falls vorhanden + 2 Buttons (KI-generieren = Stub-Toast / Upload = funktional)
8. Upload-Button öffnet System-File-Picker, lädt Datei via Postiz `/api/upload`, mediaId im Post-State updated
9. Plattform-List ist dynamisch (aus `useIntegrations()`), pro Plattform-Card togglebar (Multi-Select)
10. Plattform-Card ausklappbar zeigt plattform-spezifische Format-Settings (LinkedIn: Carousel-Toggle; IG: post/story/reel; etc.)
11. Comments-Section unten zeigt existierende Comments via `/api/posts/:id/comments` + neuer-Kommentar-Input
12. Page-Comment via Floating-Button schreibt via Postiz `/api/posts/:id/comments`
13. Media-Comment via Tap-on-Bild öffnet MediaCommentInput-Sheet
14. "Anpassen für"-Button als Stub mit Toast "Phase 5"
15. Bottom-Action-Bar: [💬+], [📷], [🎬], [Status ▾], [📤 Online]
16. [📤 Online]-Button setzt Status auf "schedule" via Postiz `PUT /posts/:id/status`
17. Tap-from-Calendar (CalendarPostCard) → navigiert zu `/m/post/[id]`
18. Bei Daten-Save: Toast-Notification mit Erfolg/Fehler
19. KI-Visual-Banner-Slot in MobileShell wird bei Re-Gen-Click angezeigt (Stub-Animation, kein echter Server-Call)
20. Inline-Edit-Konflikte: optimistische Updates mit Rollback bei Fehler

---

## Frontend-Design-Skill-Use (zentral)

Phase 3 ist die UI-zentralste Phase. Frontend-Design-Skill produziert:
- Notion-Style Layout (Whitespace, Typography, Inline-Edit-Patterns)
- Properties-Block-Design (Icons + Labels + Values)
- Bottom-Action-Bar Design
- Tap-Feedback-Animations
- Sheet-Slide-Up + Backdrop-Pattern
- Tiptap-Mobile-Toolbar (clean, minimal)
- Plattform-Card-Expansion-Animation

---

## Anti-Hardcoding (KRITISCH)

- Plattform-Format-Optionen aus `usePlatformFormats(platformProvider)` Hook — Phase 3 statische Map, Phase 4+ dynamisch
- Status-Liste aus `useStatusStates()` Hook
- Plattform-Logos aus `integration.picture`
- KEINE harten LinkedIn/IG/FB Format-Listen im Code

---

## Commit-Strategie (atomic, in Reihenfolge)

1. `feat(mobile): add use-post-detail + use-post-mutate hooks`
2. `feat(mobile): add use-comments + use-media-upload hooks`
3. `feat(mobile): add PostTitle inline-editable primitive`
4. `feat(mobile): add PostProperties block (date, time, status, platforms)`
5. `feat(mobile): add DateTimePicker mobile-friendly`
6. `feat(mobile): add StatusPicker bottom sheet`
7. `feat(mobile): add MediaBlock with KI/Upload buttons`
8. `feat(mobile): add PlatformCard + PlatformList (dynamic, per-platform formats)`
9. `feat(mobile): add CommentsSection + CommentInput + MediaCommentInput`
10. `feat(mobile): add PostBodyEditor (Tiptap mobile chrome)`
11. `feat(mobile): add PostActionBar bottom-fixed`
12. `feat(mobile): add MobilePostDetail orchestrator + AdaptForButton stub`
13. `feat(mobile): wire detail page route /m/post/[id]`
14. `feat(mobile): wire CalendarPostCard tap → detail navigation`
15. `feat(mobile): integrate frontend-design polish for detail page`
16. `test(mobile): add Playwright tests for Phase 3 acceptance criteria`

---

## Verification-Approach

- Frontend implementiert + self-test mit Playwright CLI
- Frontend-Design polish nach Basis-Implementation
- QA: Code-Review pro Commit + 20-AC-Test-Suite + VERIFICATION.md
