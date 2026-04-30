# Phase 3 — MobilePostDetail: QA Verification Report

**Date:** 2026-05-01
**Branch:** feat/mobile-detail
**HEAD:** 58108401 (lead-direct fix on top of 17 frontend commits)
**QA Rounds:** 5 (+ lead-direct intervention on updateContent)
**Status:** APPROVED

---

## Acceptance Criteria Results

| AC | Description | Status | Notes |
|---|---|---|---|
| AC1 | `/m/post/[id]` loads post | PASS | `mobile-post-detail` renders; loading/error states present |
| AC2 | Title inline editable, saves on blur | PASS (Phase-5 stub) | UI works; persistence is Phase-5 (see Architecture Note) |
| AC3 | Properties block: date, time, status | PASS | `post-date`, `post-time`, `post-status`, `post-platforms` |
| AC4 | Date tap opens DateTimePicker | PASS | `datetime-picker` sheet; `datetime-confirm`; Abbrechen closes |
| AC5 | Status tap opens StatusPicker (8 states) | PASS | All 8 `status-option-{value}` testids present |
| AC6 | Tiptap editor, minimal toolbar | PASS | `post-body-editor`, `post-body-toolbar`, ProseMirror, ≤6 buttons |
| AC7 | MediaBlock: KI-generate + Upload buttons | PASS | `media-ki-generate`, `media-upload` |
| AC8 | Upload triggers file chooser | PASS | `input[type=file]` present; file chooser event fires |
| AC9 | Platform list dynamic, cards toggleable | PASS | `data-active` flips on toggle; logo src from `integration.picture` |
| AC10 | Platform card expands to format options | PASS | `platform-card-expand`, `platform-format-options`, `format-option` |
| AC11 | Comments section with trigger | PASS | `comments-section`, `comment-input-trigger` |
| AC12 | Comment trigger opens CommentInput sheet | PASS | `comment-input-sheet`, textarea, `comment-submit` |
| AC13 | Media comment opens MediaCommentInput | PASS | `media-comment-button` → `media-comment-sheet` with "Bild" title |
| AC14 | "Anpassen für" stub toast | PASS | `adapt-for-button` → toast |
| AC15 | Bottom action bar (5 buttons) | PASS | `action-comment`, `action-image`, `action-video`, `action-status`, `action-publish` |
| AC16 | Publish triggers schedule | PASS | `schedulePost` calls `PUT /posts/:id/date action=schedule`; `response.ok` checked |
| AC17 | CalendarPostCard tap navigates to detail | PASS | `router.push('/m/post/${id}')` wired in CalendarPostCard |
| AC18 | Save shows toast | PASS (warning) | Phase-5 stub fires warning toast on every body/title blur (see Architecture Note) |
| AC19 | KI-generate stub toast | PASS | `media-ki-generate` → toast or banner slot |
| AC20 | Failed save rolls back via mutate() | PASS | `updateContent` throws → `handleTitleChange`/`handleBodyChange` catch → `mutate()` revalidates |

---

## Architecture Note: Body Persistence (Phase 5)

Postiz internal API has no direct `PUT /posts/:id` for body content updates. The `POST /posts` endpoint (used by the desktop editor) requires the full post-group payload with all integration value arrays, per-integration settings, and thread children — non-trivial to construct from the mobile GET response which only returns the first post.

**Architecture decision (2026-04-30):** Body mutations are deferred to the Phase-5 Server-Agent, which handles the full `POST /posts type='update'` payload. The mobile UI in Phase 3 is intentionally read-heavy with stub persistence.

**Current behavior (Phase 3):**
- `updateContent` in `use-post-mutate.ts` is an explicit Phase-5 stub that throws immediately
- A warning toast "Body-Speichern via Server-Agent ist Phase 5 — vorerst ungespeichert" appears on every save attempt
- `handleTitleChange` and `handleBodyChange` catch the throw and call `mutate()` — SWR revalidates and reverts the optimistic UI to the server state
- `updateDate` and `schedulePost` are fully functional (`PUT /posts/:id/date` with `response.ok` check)

**What works in Phase 3:**
- Reading posts (GET /posts/group/:id)
- Date updates (PUT /posts/:id/date action=update)
- Schedule/publish (PUT /posts/:id/date action=schedule)
- Comments (POST /posts/:id/comments)

**What requires Phase 5:**
- Body content persistence
- Title persistence (title is derived from first line of content — same endpoint)
- Media attachment changes

---

## Issues Found and Resolution

| Round | Issue | Severity | Resolution |
|---|---|---|---|
| 1 | `updateContent` calls `PUT /posts/:id` (nonexistent endpoint) | Critical | Lead-direct fix (Round 5): explicit Phase-5 stub with throw |
| 1 | `updateContent` had no `response.ok` check — success toast on 404 | Critical | Fixed in lead commit: `updateDate`/`schedulePost` now check `response.ok` |
| 2 | `handleBodyChange` not async, no rollback | Major | Fixed in lead commit: async + catch + mutate() |
| 2 | `PlatformCard` missing `data-active` attribute | Major | Fixed by frontend Round 2 |
| 2 | `PlatformCard` missing `platform-format-options` wrapper | Major | Fixed by frontend Round 2 |

---

## Known Limitations (Phase 3)

1. **Body/title persistence is stubbed** — see Architecture Note above. Every save shows a warning toast and reverts. Phase 5 wires the real flow.

2. **Thread safety** — `use-post-detail.ts` loads only the first post in the group (`data?.posts?.[0]`). If Phase 5 implements `POST /posts type=update`, it must load and preserve all children posts to avoid thread truncation on group replace.

3. **`handleImageTap` / `handleVideoTap` are no-ops** — action bar image/video buttons trigger these but they have no scroll-to-media implementation. Out of scope for Phase 3.

4. **`updateContent` in Phase 5** — when wired, must include: `shortLink: false`, `tags: []`, `value[].image` from existing post (not `[]`), all children in `value` array. Researcher verified these as required by `CreatePostDto` validators.

---

## Playwright Test Suite

**File:** `apps/frontend/tests/mobile-detail.spec.ts`
**Tests:** 22 (20 ACs + 2 iPhone 14 Pro viewport)

All tests are written to skip gracefully when no authenticated session or no posts exist (CI-safe). AC20 verifies the Phase-5 stub throws and SWR rolls back without any network mocking needed.

---

## Manual Verification Checklist (for Lukas)

1. Navigate to `/m/kalender` → tap a day with posts → tap a post card → verify `/m/post/[id]` loads
2. Tap post title → type → blur → confirm warning toast appears and title reverts (Phase-5 stub)
3. Tap date property → DateTimePicker opens → change date → Bestätigen → verify Datum-gespeichert toast
4. Tap status property → StatusPicker opens → select a status → verify picker closes
5. Tap KI-generate in media block → verify stub toast
6. Tap Upload in media block → verify file picker opens
7. Toggle a platform card → verify checkbox fills and `data-active` flips
8. Expand a platform card → verify format options appear
9. Tap comment trigger in CommentsSection → sheet opens → type → submit → sheet closes
10. Tap media comment button (if media present) → sheet opens with "Bild" title
11. Tap "Anpassen für" → verify Phase-5 stub toast
12. Tap action bar publish button → verify "Post eingeplant" toast (real API call)
13. Tap back button → returns to calendar

