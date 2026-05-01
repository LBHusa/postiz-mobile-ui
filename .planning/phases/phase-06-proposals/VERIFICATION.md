# Phase 6 — Proposals Inbox: QA Verification Report

**Date:** 2026-04-30
**Branches:** feat/proposals (husatech-social-agent), feat/regen-loop / main (postiz-husatech)
**QA Rounds:** Frontend 1/3 (approved), Backend 2/3 (approved after critical fixes)
**Status:** APPROVED

---

## Acceptance Criteria Results

| AC | Description | Status | Notes |
|---|---|---|---|
| AC1 | POST /proposals/generate weeks_ahead → 202 started | PASS | test_generate_returns_202; weeks_ahead 1-12 validated |
| AC2 | Cron registered Sunday 18:00 Europe/Berlin | PASS | scheduler.py CronTrigger day_of_week=sun, hour=18, tz=Europe/Berlin |
| AC3 | Telegram notification fires after generate() | PASS | test_workflow_sends_telegram_notification; count + week_iso asserted |
| AC4 | GET /proposals supports ?status= and ?week= filters | PASS | test_get_proposals_filter_by_status, test_get_proposals_filter_by_week |
| AC5 | GET /proposals requires Bearer | PASS | test_get_proposals_requires_auth |
| AC6 | POST /proposals/generate validates weeks_ahead | PASS | test_generate_validates_weeks_range (0 = 422, 13 = 422) |
| AC7 | POST /proposals/{id}/accept — 202, BackgroundTask | PASS | test_accept_returns_202; _run_accept mocked |
| AC8 | POST /proposals/{id}/regenerate — 202, applies feedback | PASS | test_regenerate_returns_202 |
| AC9 | POST /proposals/{id}/reject — 200, status rejected | PASS | test_reject_pending_proposal |
| AC10 | 409 on accept/reject of already-accepted proposal | PASS | test_reject_accepted_proposal_returns_409 |
| AC11 | 404 on unknown proposal ID | PASS | test_accept_unknown_404, test_regenerate_unknown_404 |
| AC12 | Frontend: ProposalsInbox loading/empty/grouped states | PASS | proposals-loading, proposals-empty, proposals-generate-trigger testids |
| AC13 | Frontend: ProposalCard expand/collapse + 3 actions | PASS | proposal-card, proposal-card-toggle, proposal-accept/regenerate/reject |
| AC14 | Frontend: ProposalGenerateSheet week selector + options | PASS | proposal-generate-sheet, weeks-option-{1,2,4}, option-{3 keys} |
| AC15 | Frontend: DaySheet inline Annehmen for proposals | PASS | day-sheet-accept-proposal gated on isProposal |
| AC16 | Frontend: Badge count from pending proposals | PASS | layout.tsx pendingProposals.length to MobileShell badgeCount |
| AC17 | Frontend: Dynamic title per route | PASS | ROUTE_TITLES map in layout.tsx |
| AC18 | Build green | PASS | Compiled successfully in 18.1s |
| AC19 | pytest green | PASS | 85/85 passing |

---

## Issues Found and Resolution

| Round | Scope | Issue | Severity | Resolution |
|---|---|---|---|---|
| 1 | Backend | _week_iso() returned "W18" — newDayjs("W18").isoWeek() = NaN | Critical | Fixed: returns ISO Monday date "2026-05-04" |
| 1 | Backend | Options camelCase from frontend ignored by snake_case reads | Critical | Fixed: dual-key fallback avoidExisting / avoid_existing |
| 1 | Frontend | week_iso label fragile (flagged as minor pre-backend) | Minor | Resolved by backend fix |
| 1 | Frontend | as any on p.content in MobileCalendar.tsx | Minor | Pre-existing, acknowledged |
| 1 | Frontend | useCallback with compile-time env values in use-proposals.ts | Minor | Cosmetic, no runtime impact |

---

## Security Review

- SQLite: all queries parameterized — no injection risk
- Bearer auth on all 5 /proposals endpoints verified by test suite
- PROPOSALS_DB_PATH env override ensures test isolation
- Telegram bot_token never logged
- Image temp file cleanup in finally block — no disk leak on accept path

---

## Known Limitations (Phase 6)

1. accept 202 is fire-and-forget — UI shows success toast but post may still fail after 202. User must pull-to-refresh to confirm.
2. week_iso stored as ISO Monday date string in DB. Any pre-existing "W18"-format rows would group incorrectly — not a concern for fresh deployments.
3. Platform hardcoded to "linkedin". _find_linkedin_integration uses .lower() for case tolerance.
4. AI parse fallback produces skeleton titles "[Entwurf] TOFU — pillar" — visible in inbox. No visual distinction from real AI proposals.
5. SWR refresh fires on 202 before BackgroundTask completes — inbox shows stale state until next manual refresh.

---

## Test Coverage

husatech-social-agent: 85/85 passing
- test_proposals_workflow.py: 15 tests (5 integration + 10 unit, incl. 4 new fix tests)
- test_proposals_endpoints.py: 15 tests (all CRUD endpoints + auth)
- test_telegram.py: 5 tests
- Phase 4+5 tests: 50 — all unaffected

postiz-husatech: no new Playwright spec (agent not running in CI; structure verified by build + testid audit)

---

## Manual Verification Checklist (for Lukas)

1. /m/vorschlaege loads empty state with "Jetzt generieren" button
2. Tap Generieren — sheet opens with 1/2/4-Wochen selector and 3 option toggles
3. Submit — 202; after ~30s pull-to-refresh to see proposals
4. KW header shows "KW 19 . 2026" format (not NaN)
5. Toggling an option to false before generating — verify the workflow respects it
6. Tap proposal card — expands; Annehmen/Anders/Verwerfen visible
7. Annehmen — proposal eventually shows accepted status
8. Anders — feedback input appears, submit triggers regenerate
9. Verwerfen — proposal removed from pending list
10. Calendar: proposals appear as dots; DaySheet Annehmen button visible inline
11. BottomNav badge count matches pending proposal count
12. Telegram notification received after cron or manual generate
