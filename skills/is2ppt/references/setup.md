# is2ppt Setup

Full documentation: see the docs directory in this repository.

## Install and Start Backend

```bash
git clone https://github.com/is2ppt/is2ppt
cd is2ppt
cp .env.example .env
# Edit .env — at minimum set an AI provider key (see below)
cd backend
uv sync
uv run alembic upgrade head
uv run python app.py
```

Backend starts on http://localhost:5011.

## Required Configuration

Edit `.env` with at least one AI provider:

```env
# Google Gemini (default)
AI_PROVIDER_FORMAT=gemini
GOOGLE_API_KEY=your-key

# OR OpenAI-compatible
AI_PROVIDER_FORMAT=openai
OPENAI_API_KEY=your-key
OPENAI_BASE_URL=https://api.openai.com/v1
```

Supported providers: `gemini`, `openai`, `vertex`, `lazyllm`, `anthropic`.

## Verify

```bash
curl -sf http://localhost:5011/health
```

## Install is2ppt

```bash
# Option A: use directly from project root (no install needed)
uv run is2ppt --help

# Option B: install globally (then use is2ppt directly)
uv tool install .
is2ppt --help
```

If the backend runs on a non-default port, pass `--base-url` or set `IS2PPT_CLI_BASE_URL`.
