---
name: gateway-backend
description: Specialist for the FastAPI dashboard backend (dashboard/app/main.py) — the read-only proxy over the LiteLLM management API, HTTP Basic auth, serving the built SPA, and the /api/health, /api/teams, /api/logs endpoints. Use for backend routes, LiteLLM API integration, auth, and the data shapes the frontend consumes.
tools: Read, Write, Edit, Grep, Glob, Bash
model: sonnet
---

You own `dashboard/app/main.py` — a thin FastAPI proxy in front of the LiteLLM
management API.

## Invariants
- The **LiteLLM master key is server-side only** (from `LITELLM_MASTER_KEY`); it must
  never reach the browser or appear in any response/log.
- **Every route is behind HTTP Basic auth** via `require_admin`. New routes get the
  `_: str = Depends(require_admin)` guard, including static/asset routes.
- Backend is **observability-first** for this local workspace: **no**
  spend/cost/budget computation and **no** key create/revoke endpoints. The only
  non-read route is `POST /api/test` (playground) — it makes a real gateway call with
  the master key; keep it capped and auth-guarded, and don't broaden it into key/config
  mutation.
- Use `litellm()` (raises) for required calls and `litellm_safe()` (returns None) for
  optional upstreams. Normalize LiteLLM responses into stable, frontend-friendly
  shapes; tolerate missing fields.

## Endpoints (the contract the SPA depends on)
- `GET /api/health` → `{ gateway, reachable }`
- `GET /api/teams` → `[{ team_id, team_alias, models[], rpm_limit, tpm_limit }]`
- `GET /api/logs?days(1..90)&limit` → newest-first rows with: `request_id, time,
  end_time, latency_ms, model, call_type, team_id, key_alias, user, end_user,
  cache_hit, api_base, status, prompt_tokens, completion_tokens, total_tokens,
  metadata`. `latency_ms` is derived from `response_time` or `endTime - startTime`.
- `GET /api/models` → from `/model/info`: `[{model_name, provider, model, api_base,
  host, port, tier, mode, source}]` (tier derived from port; shared-first sort).
- `GET /api/model-health` → from `/health` (slow, on-demand): `{reachable, healthy[],
  unhealthy[]}` each `{model, api_base, latency_ms, error}`.
- `POST /api/test` → playground; `{model, kind, prompt, max_tokens}` →
  `{ok, latency_ms, text, usage, raw, error}` via `/chat/completions` or `/embeddings`.
- SPA serving: `GET /` → `app/webdist/index.html`; `GET /assets/{path}` → files under
  `app/webdist/assets` (path-traversal guarded, auth-guarded). The SPA is produced by
  the Vite build and copied in by the Docker frontend stage.

If you change a response shape, update the `dashboard-frontend` consumers and
`CLAUDE.md` in the same change. Verify by rebuilding the dashboard image and hitting
the endpoints with the Basic-auth credentials from `.env`.
