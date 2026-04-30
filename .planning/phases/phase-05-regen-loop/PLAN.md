# Phase 5: KI-Re-Gen-Loop (Mobile-UI ↔ Server-Agent ↔ Postiz)

**Repos:** Beide!
- Postiz-Fork: `~/Desktop/Coding/postiz-husatech/` Branch `feat/regen-loop`
- Server-Agent: `~/Desktop/Coding/husatech-social-agent/` Branch `feat/regen-loop`

**Coding-Team-Fokus:** backend (Server-Agent) + frontend (Mobile-UI) + qa
**Goal:** Status-Change auf `re_gen` triggert vollen Re-Gen-Flow. Server-Agent zieht Comments + Body + Media, ruft claude --print mit Brand-Voice + Comments, ggfs. ImageProvider, updated via Postiz Public-API mit korrektem `type='update'` PostGroup-Payload.

---

## Server-Agent Side (Phase 5 — backend + qa)

### Files-to-create / modify (im husatech-social-agent Repo)

**`agent/providers/posting/postiz.py`** (REDESIGN `update_post`):
- Neue Signature: `update_post(post_id: str, *, group_id: str, integration_id: str, date: str, content: str, image_ids: list[str], children: list[dict], short_link: bool, tags: list[str]) -> dict`
- Ruft `POST /public/v1/posts` mit `type='update'` und vollem PostGroup-Payload
- Tests: `test_postiz_update_post_full_group_payload` mit pytest_httpx-Mock

**`agent/workflows/regen.py`** (NEU):
- `class RegenWorkflow`:
  - `async def trigger(self, post_id: str) -> dict`:
    1. PostingProvider.get_post(post_id) → full post
    2. PostingProvider.list_comments(post_id) → all comments
    3. ContextLoader.load(brand_voice_paths) → context dict
    4. AIProvider.regenerate(current=body, feedback=comments, brand_context=context, skill="linkedin-review") → {body, first_comment, image_prompt, alt_hooks}
    5. (optional) ImageProvider.generate(prompt=image_prompt) → bytes
    6. (if image) PostingProvider.upload_media(image_bytes) → mediaId
    7. PostingProvider.update_post(post_id, content=new_body, image_ids=[mediaId], ...) → success
- Returns: `{ status: "done", post_id, new_body, new_image_url? }`

**`agent/api/main.py`** (NEU Endpoint):
- `POST /regen` mit Bearer-Auth-Dep
- Body: `{ post_id: str }`
- Calls `RegenWorkflow().trigger(post_id)`
- Returns: 202 Accepted with `{ status: "started", post_id }` (sync für V1; async via FastAPI BackgroundTask in V2)

### Tests
- `tests/test_regen_workflow.py` — full flow with mock providers
- `tests/test_regen_endpoint.py` — POST /regen with auth + mock workflow

---

## Mobile-UI Side (Phase 5 — frontend + qa)

### Files-to-modify (im postiz-husatech Repo)

**`apps/frontend/src/hooks/use-post-mutate.ts`** (UPDATE):
- Add `triggerRegen(post_id: string, feedback?: string): Promise<void>`:
  - POST to `process.env.NEXT_PUBLIC_HUSATECH_AGENT_BASE_URL/regen` with Bearer-Token
  - Toast on start "🤖 KI arbeitet..."
  - On success: `mutate()` for SWR refresh (Server-Agent has updated Postiz already)
  - On error: warning toast + throw

**`apps/frontend/src/components/mobile/StatusPicker.tsx`** (UPDATE):
- When user selects `re_gen`: call `triggerRegen(post_id)` instead of just status-change
- Status-Pille shows pulse animation while in re_gen state

**`apps/frontend/src/components/mobile/MobileShell.tsx`** (UPDATE):
- KI-Visual-Banner-Slot fills with active state during re_gen
- Banner: `🤖 KI arbeitet — Body+Bild...` with cancel-button (cancel = ignore Server-Agent response, restore original)

**`apps/frontend/.env.example`** (UPDATE):
- `NEXT_PUBLIC_HUSATECH_AGENT_BASE_URL=http://127.0.0.1:9100` (must be NEXT_PUBLIC for client-side fetch)
- `NEXT_PUBLIC_HUSATECH_AGENT_TOKEN=` (Note: this exposes token client-side. V2 should proxy via Postiz backend.)

### Note on env-vars (sicherer Ansatz für V2)
Phase 5 V1: client-side fetch zum Server-Agent mit shared token (akzeptabel weil single-User Husatech).
Phase 7+: Postiz-Backend-Proxy, sodass Token niemals client-side ist.

---

## Out-of-Scope (Phase 5 macht NICHT)

- Vorschlags-Workflow (Phase 6)
- Initial-AI-Generation für leeren Post (Phase 6 — Endpoint `/initial-gen`)
- AdaptForButton wirklich umsetzen (Phase 6)
- WebSocket / Server-Sent-Events für Live-Progress (Phase 7)
- Cancel-Button-echte-Cancellation (V2 — nur UI-cancel, Server-Agent läuft trotzdem fertig)

---

## Acceptance-Kriterium

1. Server-Agent: `POST /regen` mit Bearer-Token → 202, startet RegenWorkflow
2. Server-Agent: ohne/falscher Token → 401
3. Server-Agent: missing post_id im Body → 422
4. Server-Agent: post_id nicht in Postiz → 404 (oder 502 wenn Postiz down)
5. RegenWorkflow ruft alle 5 Provider-Steps in Reihenfolge (mit Mock-Test verifiziert)
6. update_post via `POST /public/v1/posts type='update'` mit vollem PostGroup-Payload (tags + shortLink + alle children)
7. Mobile-UI: Status auf `re_gen` setzen → HTTP-Call an Agent
8. Mobile-UI: Top-Bar zeigt KI-Banner während Operation
9. Mobile-UI: Toast bei Start, Success, Error
10. Mobile-UI: SWR-Refresh nach Success → neuer Body sichtbar
11. End-to-End: Mock-Postiz + echte Server-Agent + Mobile-UI → Status-Change → updated Body in Mobile-UI sichtbar (mit local dev setup)
12. Zwei Repos haben jeweils eigenen `feat/regen-loop` Branch mit atomic Commits
13. `pytest` grün im husatech-social-agent
14. `pnpm -w run build:frontend` grün

---

## Commit-Strategie

**husatech-social-agent:**
1. `feat(workflows): add RegenWorkflow with 6-step provider orchestration`
2. `feat(providers/posting): redesign update_post with full PostGroup payload`
3. `feat(api): add POST /regen endpoint with Bearer auth + workflow trigger`
4. `test: add regen workflow + endpoint pytest suite`

**postiz-husatech:**
1. `feat(mobile): add triggerRegen mutation hook calling agent /regen`
2. `feat(mobile): wire StatusPicker re_gen → triggerRegen + active KI banner`
3. `feat(mobile): MobileShell active KI-Visual-Banner during regen`
4. `chore(env): add NEXT_PUBLIC_HUSATECH_AGENT vars`
5. `test(mobile): add Playwright tests for regen status change`
