# Phase 4: Server-Agent Foundation

**Repo:** `~/Desktop/Coding/husatech-social-agent/` (separat vom Postiz-Fork)
**Deployment-Ziel:** `/root/husatech/social-agent/` auf Server 77 (Phase 7 deployed)
**Coding-Team-Fokus:** backend (lead) + researcher + qa
**Goal:** Provider-Plug-in-Architektur (Posting/AI/Image), Brand-Voice-Loader, FastAPI-Skeleton, Postiz-API-Client. KEIN Re-Gen-Loop noch (Phase 5).

---

## Repo-Layout

```
husatech-social-agent/
├── README.md
├── pyproject.toml                       (FastAPI + httpx + APScheduler + python-frontmatter + pytest)
├── .env.example
├── .gitignore
├── config/
│   └── providers.toml                   (Provider-Auswahl, V1-Defaults)
├── agent/
│   ├── __init__.py
│   ├── core/
│   │   ├── __init__.py
│   │   ├── config.py                    (TOML-Load, Settings-DTO)
│   │   ├── context_loader.py            (mtime-cached MD-File-Loader)
│   │   └── logger.py                    (structured logging)
│   ├── providers/
│   │   ├── __init__.py
│   │   ├── posting/
│   │   │   ├── __init__.py
│   │   │   ├── base.py                  (PostingProvider ABC)
│   │   │   ├── postiz.py                (Default V1 — uses Postiz Public-API)
│   │   │   └── registry.py              (load active per config)
│   │   ├── ai/
│   │   │   ├── __init__.py
│   │   │   ├── base.py                  (AIProvider ABC)
│   │   │   ├── claude.py                (Default V1 — claude --print + Skill)
│   │   │   └── registry.py
│   │   └── image/
│   │       ├── __init__.py
│   │       ├── base.py                  (ImageProvider ABC)
│   │       ├── nano_banana.py           (Default V1 — Gemini Nano Banana 2)
│   │       ├── gpt_image.py             (V1 Alternative — OpenAI gpt-image-1)
│   │       └── registry.py
│   └── api/
│       ├── __init__.py
│       ├── main.py                      (FastAPI app, /health, /providers)
│       └── deps.py                      (Auth-Dependency: Bearer-Token-Check)
├── tests/
│   ├── __init__.py
│   ├── test_config.py
│   ├── test_context_loader.py
│   ├── test_provider_registry.py
│   └── test_health.py
└── data/                                (NICHT committed — symlinks zu ~/company/brand/, ~/content/)
    └── .gitkeep
```

---

## Files-to-create

### Top-Level

**`pyproject.toml`:**
- `[project]` name="husatech-social-agent", version="0.1.0", python="^3.11"
- Dependencies: `fastapi`, `uvicorn[standard]`, `httpx`, `apscheduler`, `python-frontmatter`, `pydantic-settings`, `tomli` (Python<3.11) oder built-in `tomllib`, `python-multipart`
- Dev-Dependencies: `pytest`, `pytest-asyncio`, `pytest-httpx`, `ruff`, `mypy`

**`.env.example`:**
```
# Postiz
POSTIZ_API_URL=http://127.0.0.1:5000
POSTIZ_API_KEY=

# AI Providers
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
GEMINI_API_KEY=

# Server-Agent
AGENT_PORT=9100
AGENT_HOST=0.0.0.0
AGENT_TOKEN=                              # Shared-Secret für Mobile-UI auth

# Telegram (Phase 6)
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=

# Mode
LOG_LEVEL=info
ENV=development
```

**`config/providers.toml`:**
```toml
[posting]
active = "postiz"

[posting.postiz]
api_url_env = "POSTIZ_API_URL"
api_key_env = "POSTIZ_API_KEY"
auth_header = "Authorization"             # plain "<token>" NO Bearer prefix per Postiz quirk
timeout_seconds = 30

[ai]
active = "claude"

[ai.claude]
binary = "claude"
default_skill = "linkedin-review"
timeout_seconds = 300
print_flag = "--print"

[image]
active = "nano_banana"

[image.nano_banana]
helper_path = "~/infrastructure/scripts/image_helpers/gemini_image.py"
api_key_env = "GEMINI_API_KEY"
default_aspect = "4:5"
default_size = "2K"
default_temperature = 0.3
thinking_level = "HIGH"
refs_dir = "~/content/assets/lukas-photos/selected/"

[image.gpt_image]
api_key_env = "OPENAI_API_KEY"
model = "gpt-image-1"
default_size = "1024x1536"
default_quality = "high"
```

### Core

**`agent/core/config.py`:**
- Pydantic-Settings + TOML-Load
- `class AgentConfig(BaseSettings)`: lädt `.env` + `config/providers.toml`
- Properties: posting_provider_name, ai_provider_name, image_provider_name, postiz_api_url, postiz_api_key, agent_token, etc.

**`agent/core/context_loader.py`:**
- `class ContextLoader`:
  - `__init__(self, base_paths: list[Path])`: registers paths
  - `load(self, paths: list[str]) -> dict[str, str]`: returns {path: content}, mtime-cached
  - mtime-cache: `_cache: dict[Path, tuple[float, str]]` (mtime, content)
  - Cache invalidiert nur wenn mtime sich ändert

**`agent/core/logger.py`:**
- structured JSON logger via standard library

### Providers — Base + Registry

**`agent/providers/posting/base.py`:**
```python
from abc import ABC, abstractmethod
from typing import TypedDict

class Integration(TypedDict):
    id: str
    name: str
    picture: str | None
    provider: str
    disabled: bool

class PostingProvider(ABC):
    @abstractmethod
    async def list_integrations(self) -> list[Integration]: ...

    @abstractmethod
    async def list_posts(self, *, from_date: str, to_date: str, status: list[str] | None = None) -> list[dict]: ...

    @abstractmethod
    async def get_post(self, post_id: str) -> dict: ...

    @abstractmethod
    async def create_post(self, *, integrations: list[str], date: str, content: str, image_ids: list[str] | None = None, type: str = "schedule") -> dict: ...

    @abstractmethod
    async def update_post(self, post_id: str, *, content: str | None = None, image_ids: list[str] | None = None) -> dict: ...

    @abstractmethod
    async def delete_post(self, post_id: str) -> None: ...

    @abstractmethod
    async def upload_media(self, file_path: str) -> str: ...   # returns mediaId

    @abstractmethod
    async def list_comments(self, post_id: str) -> list[dict]: ...
```

**`agent/providers/posting/postiz.py`:**
- `class PostizProvider(PostingProvider)`: implements via httpx + Postiz Public-API
- Auth: header `Authorization: <token>` (plain, NO Bearer)
- Endpoints: `/public/v1/integrations`, `/public/v1/posts`, `/public/v1/upload`, `/public/posts/:id/comments` (no-auth)
- update_post: uses `POST /public/v1/posts type='update'` Pattern

**`agent/providers/posting/registry.py`:**
- `def get_posting_provider(config: AgentConfig) -> PostingProvider`: factory based on config

**`agent/providers/ai/base.py`:**
```python
class AIProvider(ABC):
    @abstractmethod
    async def generate(self, *, prompt: str, system: str | None = None, skill: str | None = None) -> str: ...

    @abstractmethod
    async def regenerate(self, *, current: str, feedback: str, brand_context: str, skill: str) -> dict: ...
    # returns {body, first_comment, image_prompt, alt_hooks, reasoning}
```

**`agent/providers/ai/claude.py`:**
- `class ClaudeProvider(AIProvider)`: invokes `claude --print` subprocess
- Argv: `[binary, "--print", prompt]`
- timeout from config
- structured output parsing (claude returns JSON when prompted)

**`agent/providers/image/base.py`:**
```python
class ImageProvider(ABC):
    @abstractmethod
    async def generate(self, *, prompt: str, reference_images: list[str] | None = None, aspect_ratio: str = "4:5") -> bytes: ...
    # returns image bytes
```

**`agent/providers/image/nano_banana.py`:**
- `class NanoBananaProvider(ImageProvider)`: calls existing `gemini_image.py` helper via subprocess
- Or: directly uses `google-generativeai` client (V2 — Phase 4 reuses helper)

**`agent/providers/image/gpt_image.py`:**
- `class GptImageProvider(ImageProvider)`: uses `openai` SDK with `gpt-image-1`

### API

**`agent/api/main.py`:**
- FastAPI app
- Endpoints (Phase 4):
  - `GET /health` — liveness check, returns provider status
  - `GET /providers` — lists active provider names + connectivity
- CORS: allow `socialmedia.wawihub.de` and `localhost:4200`

**`agent/api/deps.py`:**
- Bearer-Token-auth dependency
- Reads `AGENT_TOKEN` from env, validates request `Authorization` header

### Tests

**`tests/test_config.py`:**
- Loads providers.toml + .env, asserts active providers
- Validates expected fields present

**`tests/test_context_loader.py`:**
- Creates temp .md files
- Verifies mtime-cache: load twice without modification → no disk read
- Modify file, load again → cache invalidates

**`tests/test_provider_registry.py`:**
- For each provider: instantiate from config, verify class type
- Mock HTTP calls (httpx_mock) for Postiz provider

**`tests/test_health.py`:**
- FastAPI test-client
- GET /health → 200, JSON with `status: "ok"` + provider list

---

## Out-of-Scope (Phase 4 macht NICHT)

- Re-Gen-Loop endpoints (Phase 5)
- Vorschlags-Workflow (Phase 6)
- Telegram-Integration (Phase 6)
- Webhook-Endpoint für Mobile-UI (Phase 5)
- AI-Real-Calls in Tests (mock claude binary, mock httpx)
- Deployment-Setup (Phase 7)

---

## Acceptance-Kriterium

1. `pip install -e .` läuft durch (alle deps okay)
2. `pytest` läuft → mindestens 4 Test-Dateien grün
3. `python -m agent.cli health` (oder `uvicorn agent.api.main:app --port 9100`) startet ohne Error
4. `curl http://127.0.0.1:9100/health` → 200, JSON mit `{status: "ok", providers: {posting: "postiz", ai: "claude", image: "nano_banana"}}`
5. `curl http://127.0.0.1:9100/providers` (mit Bearer-Token) → 200 mit Provider-Detail
6. Bearer-Token-Check: ohne Token → 401
7. Brand-Voice-Loader: kann `~/company/brand/brand-voice.md` laden (echte Datei auf Lukas-System; falls nicht da: graceful fallback mit Logger-Warning)
8. PostingProvider.list_integrations: kann gegen Mock-Postiz korrekte Response parsen
9. `config/providers.toml` ist Single-Source-of-Truth für Provider-Auswahl — Switch von claude → openai erfordert NUR TOML-Edit
10. README.md hat Setup-Anleitung + Architektur-Skizze

---

## Commit-Strategie

1. `chore: init husatech-social-agent repo with pyproject.toml + config skeleton`
2. `feat(core): add config loader (env + TOML) with pydantic-settings`
3. `feat(core): add context-loader with mtime caching`
4. `feat(providers/posting): add PostingProvider ABC + PostizProvider via Public-API`
5. `feat(providers/ai): add AIProvider ABC + ClaudeProvider subprocess wrapper`
6. `feat(providers/image): add ImageProvider ABC + NanoBananaProvider + GptImageProvider`
7. `feat(api): add FastAPI app with /health and /providers endpoints + Bearer-auth dep`
8. `test: add pytest suite for config, context-loader, registries, health`
9. `docs: add README with setup, architecture, provider-switch example`
