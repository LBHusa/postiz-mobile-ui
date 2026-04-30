# Phase 6: Vorschlags-Workflow + Inbox

**Repos:** Beide.
- Postiz-Fork: `feat/proposals` Branch
- Server-Agent: `feat/proposals` Branch

**Coding-Team:** backend (Server-Agent + Cron) + frontend (Mobile-UI Inbox) + qa
**Goal:** Datengetriebene Vorschläge auf LinkedIn — Cron + manueller Trigger, Mobile-Inbox-Screen mit expandable Cards, Telegram-Notification, Calendar-Vorschlags-Marker.

---

## Server-Agent Side

### Files-to-create

**`agent/workflows/weekly_proposals.py`** (NEU):
```python
class WeeklyProposalsWorkflow:
    async def generate(weeks_ahead: int = 1, options: dict = {}) -> list[Proposal]:
        # 1. Pull existing planned posts from Postiz
        # 2. Analyze pillar/funnel distribution
        # 3. Pull last 4 weeks performance data via /analytics
        # 4. Load brand-voice + content-strategy via ContextLoader
        # 5. claude --print with proposal-skill + all data
        # 6. Pick unoccupied slots (Mo/Mi/Do/Fr × 3 time slots)
        # 7. Save proposals to local SQLite
        # 8. Send Telegram notification
```

**`agent/db/proposals.py`** (NEU):
- SQLAlchemy or sqlite3-direct
- `class Proposal`: week_iso, suggested_date/time, title, content_outline, media_description, media_format, platform, pillar, funnel_stage, data_basis, status, accepted_postiz_id

**`agent/api/proposals.py`** (NEU):
- `GET /proposals?status=pending` — list proposals
- `POST /proposals/generate` (body: `{ weeks_ahead, options }`)
- `POST /proposals/:id/accept` — generates full post + creates Postiz draft
- `POST /proposals/:id/regenerate` (body: `{ feedback }`)
- `POST /proposals/:id/reject`

**`agent/cron/scheduler.py`** (NEU):
- APScheduler init
- Every Sunday 18:00 → `WeeklyProposalsWorkflow.generate(weeks_ahead=1)`

**`agent/notifications/telegram.py`** (NEU):
- httpx call to Telegram Bot API
- `send_proposal_notification(count, week_iso)` — formats message with deep-link to mobile-inbox

### Tests
- `tests/test_proposals_workflow.py`
- `tests/test_proposals_endpoints.py`
- `tests/test_telegram.py` (mock httpx)

---

## Mobile-UI Side

### Files-to-create

- `apps/frontend/src/components/mobile/ProposalsInbox.tsx` — main screen, list of expandable cards
- `apps/frontend/src/components/mobile/ProposalCard.tsx` — expandable card with content-outline + data-basis + 3 action buttons
- `apps/frontend/src/components/mobile/ProposalGenerateSheet.tsx` — manual trigger sheet (1/2/4 weeks, options)
- `apps/frontend/src/hooks/use-proposals.ts` — SWR fetch from agent /proposals
- `apps/frontend/src/hooks/use-proposal-actions.ts` — accept/regenerate/reject mutations

### Files-to-modify

- `apps/frontend/src/app/(app)/m/vorschlaege/page.tsx` — REPLACE Placeholder with ProposalsInbox
- `apps/frontend/src/components/mobile/BottomNav.tsx` — Badge mit Anzahl pending proposals
- `apps/frontend/src/hooks/use-mobile-proposals.ts` — REPLACE Stub: jetzt echte fetch von agent statt static mock
- `apps/frontend/src/components/mobile/CalendarDayCell.tsx` — display proposals as gestrichelte Punkte (use-mobile-proposals jetzt real)
- `apps/frontend/src/components/mobile/DaySheet.tsx` — handle proposal cards (with [Annehmen] direct action)

---

## Acceptance-Kriterium

1. Server-Agent: `POST /proposals/generate weeks_ahead=2` returns 8 proposals
2. Cron: läuft Sonntag 18:00 (test via APScheduler manual-fire)
3. Telegram-Notification fires nach Generate
4. Mobile: `/m/vorschlaege` zeigt expandable Liste
5. Manuell-Trigger Sheet: 1/2/4 Wochen Auswahl + Generieren-Button
6. Calendar zeigt gestrichelte Punkte für proposals
7. [Annehmen]-Action: ruft `POST /proposals/:id/accept` → Server-Agent erstellt Postiz-Draft → Calendar zeigt Punkt jetzt vollständig (nicht gestrichelt)
8. [Anders]-Action: feedback-input → Server-Agent regeneriert
9. [Verwerfen]-Action: deactivates proposal
10. BottomNav-Vorschläge-Tab Badge zeigt count

---

## Out-of-Scope

- Multi-Plattform Vorschläge (V1: nur LinkedIn)
- Performance-Data-Reality (Postiz Analytics-API ist mock-d in V1, real-data in V2)
- Push-Notifications-Native (Telegram reicht V1)

---

## Commit-Strategie

**husatech-social-agent (~5 commits):**
1. `feat(db): add Proposal SQLAlchemy model + sqlite migration`
2. `feat(workflows): add WeeklyProposalsWorkflow`
3. `feat(api): add /proposals CRUD + generate endpoints`
4. `feat(cron): add APScheduler for Sunday 18:00 generate`
5. `feat(notifications): add Telegram notifier`

**postiz-husatech (~5 commits):**
1. `feat(mobile): add use-proposals + use-proposal-actions hooks`
2. `feat(mobile): add ProposalsInbox + ProposalCard expandable`
3. `feat(mobile): add ProposalGenerateSheet manual trigger`
4. `feat(mobile): wire vorschlaege/page.tsx + replace stub useMobileProposals`
5. `feat(mobile): show gestrichelte calendar dots for proposals + DaySheet integration`
