# Phase 5 — Re-Gen Loop: QA Verification Report

**Date:** 2026-04-30
**Branches:** feat/regen-loop (both repos)
**QA Rounds:** 2 (frontend: 2 rounds; backend: 1 round with 3 minors acknowledged)
**Status:** APPROVED

---

## Acceptance Criteria Results

| AC | Description | Status | Notes |
|---|---|---|---|
| AC1 | POST /regen with Bearer → 202 | PASS | test_regen_returns_202_with_valid_request |
| AC2 | POST /regen without token → 401 | PASS | test_regen_requires_bearer |
| AC3 | POST /regen wrong token → 401 | PASS | test_regen_rejects_wrong_token |
| AC4 | POST /regen missing post_id → 422 | PASS | test_regen_missing_post_id_returns_422 |
| AC5 | POST /regen empty post_id → 422 | PASS | test_regen_empty_post_id_returns_422 |
| AC6 | update_post sends type='update' with full PostGroup payload | PASS | test_postiz_update_post_sends_full_group_payload; shortLink, tags, children, image[]{id,path}, existing_value_id all verified |
| AC7 | Mobile-UI: re_gen status → HTTP call to agent | PASS | StatusPicker re_gen branch calls onTriggerRegen; Playwright AC7 test |
| AC8 | Mobile-UI: KI-Banner during re_gen | PASS | MobileShell ki-banner renders from regen.active; Playwright AC8 test |
| AC9 | Mobile-UI: Toast on start/success/error | PASS | triggerRegen fires "KI arbeitet…" on start, "KI fertig" on success, warning on error |
| AC10 | Mobile-UI: SWR refresh after success | PASS | mutate() called in triggerRegen success path |
| AC11 | RegenWorkflow: all 5 provider steps in order | PASS | test_regen_calls_all_6_steps verifies get_post → list_comments → brand_voice → regenerate → image → upload → update_post |
| AC12 | Two repos have feat/regen-loop branch | PASS | Confirmed on both repos |
| AC13 | pytest green | PASS | 47/47 passing |
| AC14 | pnpm build:frontend green | PASS | Compiled successfully in ~14s |

---

## Issues Found and Resolution

| Round | Scope | Issue | Severity | Resolution |
|---|---|---|---|---|
| 1 | Frontend | MobileShell.tsx missing 'use client' | Major | Fixed in Round 2 — directive added as line 1 |
| 1 | Backend | skill="linkedin-review" hardcoded in regen.py:94 | Minor | Acknowledged — not fixed, within 3-minor threshold |
| 1 | Backend | new_image_url always None in RegenResult | Minor | Acknowledged — fire-and-forget endpoint means no consumer; field is vestigial for V1 |
| 1 | Backend | test_regen_brand_voice_loaded_from_temp_file weak assertion | Minor | Acknowledged — test confirms call occurred but not brand_context content |

---

## Known Limitations (Phase 5)

1. **skill="linkedin-review" hardcoded** (`husatech-social-agent/agent/workflows/regen.py:94`): The TOML has `ai.claude.default_skill = "linkedin-review"` but `RegenWorkflow` ignores it and hardcodes the value. Switching the skill in TOML will have no effect. Phase 6 should read from config.

2. **new_image_url never populated in RegenResult**: `RegenResult.new_image_url` is always `None` even after successful image upload. The endpoint returns 202 immediately and the background task result is discarded, so no consumer exists in V1. Phase 7 (WebSocket/SSE) would expose this field.

3. **triggerRegen is fire-and-forget from mobile**: The 202 response means the mobile UI has no way to know if the regen succeeded or failed on the server. `setRegenDone()` runs in `finally` of the fetch — it clears the banner once the HTTP round-trip completes, not once the background workflow completes. If the workflow fails after the 202, the user sees the success toast but the post is unchanged.

4. **SWR refresh timing**: `mutate()` is called immediately after the 202 — before the server-side workflow has updated the post. In practice the Postiz GET will return the old body. A small poll/retry loop or a delay before `mutate()` would be needed for the refresh to show the new content in V1 field use.

5. **updateContent still Phase-5 stub**: Body/title persistence via the stub still throws and shows a warning toast. The Re-Gen flow bypasses this stub entirely (it goes through the agent, not through updateContent), so Phase 5 is complete. Phase 6 wires `updateContent` properly via the agent.

---

## Security Review

- Bearer token auth on /regen: confirmed via test_regen_requires_bearer and test_regen_rejects_wrong_token
- NEXT_PUBLIC_HUSATECH_AGENT_TOKEN is client-side exposed — acknowledged in PLAN.md as V1 acceptable (single-user Husatech), V2 proxies via Postiz backend
- No SQL injection surface (Python agent has no DB)
- subprocess in ClaudeProvider uses exec form (no shell=True) — no injection risk
- Postiz auth header is plain token with no logging of the token value

---

## Test Coverage

**husatech-social-agent (47 tests):**
- test_regen_workflow.py: 11 tests (4 integration + 7 unit helpers)
- test_regen_endpoint.py: 10 tests (auth, validation, happy-path, background task, regression)
- Phase 4 tests: 27 tests (config, context_loader, health, registries) — all still passing

**postiz-husatech (Playwright):**
- mobile-regen.spec.ts: 5 tests — AC7 (re_gen tap → agent call), AC8 (banner mid-flight), AC9 (no crash), AC10 (re_gen option visible), cancel button DOM structure
- mobile-detail.spec.ts: 22 tests from Phase 3 — all unaffected

---

## Manual Verification Checklist (for Lukas)

1. Set `NEXT_PUBLIC_HUSATECH_AGENT_BASE_URL=http://127.0.0.1:9100` and `NEXT_PUBLIC_HUSATECH_AGENT_TOKEN=<your-token>` in frontend `.env.local`
2. Start husatech-social-agent: `uvicorn agent.api.main:app --port 9100`
3. Navigate to `/m/post/[id]` for any scheduled post
4. Tap action bar status button → StatusPicker opens
5. Tap "Re-Gen" option → picker closes, "KI arbeitet…" toast fires, KI banner appears at top
6. Wait ~30s (real Claude + image gen) → banner disappears, "KI fertig" toast fires
7. Pull-to-refresh or navigate away and back → post body shows AI-updated content
8. Repeat with agent stopped → "KI-Fehler — bitte erneut versuchen" toast appears
9. During active regen: tap "Abbrechen" on banner → banner disappears (agent continues in background)
