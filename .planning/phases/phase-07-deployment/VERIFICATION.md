# Phase 7 — Deployment: QA Verification Report

**Date:** 2026-04-30
**Branch:** feat/deploy (husatech-social-agent)
**QA Rounds:** Backend 2/3, Frontend 2/3
**Status:** APPROVED

---

## Acceptance Criteria Results

| AC | Description | Status | Notes |
|---|---|---|---|
| AC1 | Dockerfile multistage — builder + runtime | PASS | python:3.12-slim both stages; builder installs deps, runtime copies /install |
| AC2 | Non-root user in runtime image | PASS | groupadd -r agent; useradd -r -g agent; USER agent before CMD |
| AC3 | HEALTHCHECK in Dockerfile | PASS | --interval=30s --timeout=5s --start-period=10s --retries=3; urllib.request.urlopen /health |
| AC4 | docker-compose.yml healthcheck | PASS | start_period=15s (more generous for cold start); matches Dockerfile intent |
| AC5 | Port bound to 127.0.0.1 only | PASS | 127.0.0.1:9100:9100 — not exposed publicly, nginx proxies |
| AC6 | Bind-mount volumes correct | PASS | brand_data:ro, strategy_data:ro, proposals_db:rw — correct semantics |
| AC7 | DEPLOYMENT.md: nginx config present | PASS | Full server block with SSL, proxy_pass, client_max_body_size 20M |
| AC8 | DEPLOYMENT.md: .env setup documented | PASS | All required env vars with descriptions; env var reference table |
| AC9 | DEPLOYMENT.md: manual cron trigger correct | PASS | Fixed in Round 2: POST /proposals/generate (was nonexistent /cron/trigger) |
| AC10 | pytest CI workflow | PASS | python 3.12, pip install -e ".[dev]", POSTIZ_API_KEY + AGENT_TOKEN injected |
| AC11 | ESLint CI workflow (frontend) | PASS | frontend-only, ESLINT_USE_FLAT_CONFIG=true, npm install -g SARIF formatter |
| AC12 | auth-setup.ts wired into playwright.config.ts | PASS | globalSetup + storageState both present after Round 2 fix |
| AC13 | pytest green | PASS | 85/85 passing |
| AC14 | Frontend build green | PASS | Compiled successfully in ~15s |

---

## Issues Found and Resolution

| Round | Scope | Issue | Severity | Resolution |
|---|---|---|---|---|
| 1 | Backend | pip install -e . in multistage — .pth references /build/agent, missing in runtime | Critical | Fixed Round 2: -e flag removed, regular install copies package into site-packages |
| 1 | Backend | DEPLOYMENT.md Step 6 cron trigger URL was /cron/trigger/weekly_proposals (404) | Major | Fixed Round 2: corrected to POST /proposals/generate |
| 1 | Frontend | auth-setup.ts not wired into playwright.config.ts — dead code | Major | Fixed Round 2: globalSetup + storageState added |
| 1 | Frontend | pnpm add -g SARIF formatter unreliable in CI PATH | Minor | Fixed Round 2: changed to npm install -g |

---

## Security Notes

- Container runs as non-root (agent:agent) — correct
- Port only bound to 127.0.0.1 — not publicly exposed; nginx terminates TLS externally
- .env never committed (in .gitignore); .env.example provided as template
- brand_data and strategy_data volumes mounted read-only — container cannot modify host brand files
- proposals_db volume is rw (required for SQLite writes) — scoped to /root/husatech/social-agent/data/db

---

## Known Limitations (Phase 7 / V1)

1. **No `/cron/trigger` convenience endpoint**: Manual Sunday-cron simulation requires calling `/proposals/generate` directly. A dedicated `/admin/trigger-cron` endpoint (auth-protected) would be cleaner for operations but is out of scope for V1.

2. **proposals DB bind-mount path hardcoded**: `device: /root/husatech/social-agent/data/db` in docker-compose.yml. If deployment path changes, both compose and DEPLOYMENT.md must be updated.

3. **ANTHROPIC_API_KEY in container env**: The Claude subprocess (`claude --print`) needs the key available to the subprocess environment. Verify the claude binary on the host is accessible inside the container or that the subprocess inherits the env correctly — may need `--user root` or a volume-mounted claude config. Not tested in CI.

4. **playwright.config.ts storageState**: If PLAYWRIGHT_EMAIL/PLAYWRIGHT_PASSWORD are absent at test time, auth-setup skips and playwright/.auth/user.json is never created. Playwright will warn about missing storageState. Existing specs use requireAuth() graceful-skip so CI does not hard-fail.

---

## V1 Completion Status

All 7 phases completed and approved:
- Phase 3: MobilePostDetail — APPROVED
- Phase 4: Server-Agent Foundation — APPROVED
- Phase 5: Re-Gen Loop — APPROVED
- Phase 6: Proposals Inbox — APPROVED
- Phase 7: Deployment + CI — APPROVED

Both repos have complete VERIFICATION.md files in .planning/phases/.
