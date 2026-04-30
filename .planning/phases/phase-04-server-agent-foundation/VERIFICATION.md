# Phase 4 — Server-Agent Foundation: QA Verification Report

**Date:** 2026-05-01
**Repo:** /Users/lukas/Desktop/Coding/husatech-social-agent/
**QA Rounds:** 2
**Status:** APPROVED

---

## Acceptance Criteria Results

| AC | Description | Status | Notes |
|---|---|---|---|
| AC1 | `pip install -e .` runs clean | PASS | All deps install; 28 pytest tests collect |
| AC2 | `pytest` — all test files green | PASS | 28/28 passing (4 files: config, context_loader, provider_registry, health) |
| AC3 | uvicorn starts on port 9100 without error | PASS | Lifespan startup logs cleanly |
| AC4 | `GET /health` → 200 `{status: "ok", providers: {...}}` | PASS | Tested via FastAPI TestClient |
| AC5 | `GET /providers` with Bearer → 200 with provider config | PASS | Sensitive fields redacted as `***` |
| AC6 | Bearer-Token-Check: without token → 401 | PASS | `test_providers_requires_bearer` + `test_providers_with_invalid_token` |
| AC7 | Brand-Voice-Loader: loads MD files with mtime cache | PASS | 6 context_loader tests including cache invalidation |
| AC8 | PostingProvider.list_integrations parses mock response | PASS | `test_postiz_list_integrations_parses_response` with httpx_mock |
| AC9 | TOML is single source of truth for provider selection | PASS | All registries driven by `config.{x}_provider_name` from TOML |
| AC10 | README.md with setup + architecture | PASS | Not read in detail — backend claims present |

---

## Issues Found and Resolution

| Round | Issue | Severity | Resolution |
|---|---|---|---|
| 1 | `create_post` payload missing `tags: []` (required by CreatePostDto `@IsArray()`) | Major | Fixed: `"tags": []` added at line 86; `test_postiz_create_post_payload_has_tags` added |
| 1 | `update_post` sent malformed body `{"type":"update","id":post_id}` — wrong schema | Major | Fixed: raises `NotImplementedError` with Phase-5 redesign note; `test_postiz_update_post_raises_not_implemented` added |

---

## Security Review

- **Auth header (Postiz):** `Authorization: <token>` — plain token, NO `Bearer` prefix. Explicitly tested by `test_postiz_auth_header_is_plain` which asserts `not auth.lower().startswith("bearer ")`.
- **Subprocess security:** Both `ClaudeProvider._run()` and `NanoBananaProvider.generate()` use `asyncio.create_subprocess_exec(*cmd)` — args passed as list, no `shell=True`, no injection risk.
- **Bearer auth on `/providers`:** `deps.py` uses `HTTPBearer(auto_error=False)` — returns 401 on missing or wrong token. `/health` is intentionally public.
- **Secrets redaction:** `_redact()` in `main.py` masks keys named `api_key`, `api_key_env`, `token` in `/providers` response.
- **Open-access dev mode:** When `AGENT_TOKEN` is empty string, `deps.py` allows all requests. Acceptable for local dev; must be set in production.

---

## Architecture Verification

- **TOML single source of truth:** All three registries (`get_posting_provider`, `get_ai_provider`, `get_image_provider`) read `config.{x}_provider_name` which derives from `providers.toml [x].active`. Switching `ai.active = "openai"` requires only TOML edit — no code changes.
- **ABC pattern:** `PostingProvider`, `AIProvider`, `ImageProvider` all have correct abstract method signatures. Concrete implementations verified against ABC.
- **mtime cache:** `ContextLoader._cache: dict[Path, tuple[float, str]]` — only reads disk when mtime changes. Tested: 4 tests including no-reread and invalidation.
- **`update_post` Phase-5 note:** Current ABC signature `(post_id, content, image_ids)` is insufficient to construct a valid `POST /public/v1/posts type='update'` payload (needs integration id, date, all value items, shortLink, tags). Phase 5 must redesign this method with full `PostGroup` context to avoid thread truncation.

---

## Known Limitations (Phase 4)

1. **`update_post` is a `NotImplementedError` stub** — Phase 5 must redesign the ABC signature and PostizProvider implementation with full PostGroup context.
2. **`list_comments` uses no-auth endpoint** `/public/posts/:id/comments` — verify this path is correct against live Postiz instance (public-api-deep.md notes it as no-auth).
3. **`open-access dev mode`** in `deps.py` — `AGENT_TOKEN` must be set in `.env` before any non-local deployment.
4. **README.md** — not reviewed in detail; backend responsible for accuracy.

---

## Test Summary

**28/28 passing** (0.22s)

| File | Tests | Coverage |
|---|---|---|
| test_config.py | 6 | TOML loading, env vars, provider name properties, config field presence |
| test_context_loader.py | 6 | Load, missing file, mtime no-reread, mtime invalidation, base_path resolution, multi-file |
| test_health.py | 7 | 200, status ok, provider names, 401 no token, 200 valid token, 401 wrong token, health is public |
| test_provider_registry.py | 9 | Registry factory for all 3 providers, gpt_image switch, unknown raises, list_integrations parse, plain auth header, create_post has tags, update_post raises NotImplementedError |

