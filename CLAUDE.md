# CLAUDE.md — AI Gateway (LiteLLM proxy + admin dashboard)

Guidance for Claude Code when working in this repo. Read this first.

## What this project is

A single OpenAI-compatible **LiteLLM gateway** (`:4000`) in front of on-prem
inference backends (Ollama, vLLM, Whisper), plus a custom **FastAPI + React admin
dashboard** (`:8080`). Teams call the gateway with virtual keys routed to shared or
dedicated models, with per-team rate limits and request logging.

This is a **local workspace server**, not a billed multi-tenant SaaS. Deliberate
consequences:

- **No spend / cost / budget** anywhere in the dashboard. Do not add spend columns,
  budget fields, or cost math. If asked for "usage", mean **requests, tokens,
  latency** — never dollars.
- The dashboard is a **full management console**: teams, virtual keys, and models all
  support create / update / delete (proxied to the LiteLLM mgmt API with the
  server-side master key). The `scripts/provision_keys.*` scripts still work for bulk
  provisioning, but the UI can now do it too. Destructive actions confirm first; a
  created key is revealed **once**.

## Layout

| Path | Purpose |
|------|---------|
| `litellm_config.yaml` | Maps gateway model names → backend endpoints (the routing source of truth) |
| `docker-compose.yml` | `litellm` + `litellm-db` (Postgres) + `dashboard` |
| `.env` / `.env.example` | Secrets (gitignored real `.env`) |
| `scripts/provision_keys.{sh,ps1}` | Create a team + virtual key per project |
| `systemd/` | Host-side Ollama tuning |
| `dashboard/app/main.py` | FastAPI: HTTP Basic auth + proxy over the LiteLLM mgmt API (reads + teams/keys/models management) + serves the SPA |
| `dashboard/frontend/` | React + Vite + Tailwind + shadcn/ui SPA (the admin UI) |
| `dashboard/Dockerfile` | Multi-stage: Node builds the SPA → Python serves `app/webdist` |

## Dashboard architecture

- **Backend** (`dashboard/app/main.py`): thin proxy. The LiteLLM **master key stays
  server-side** (from env) and is never sent to the browser. Every route is behind
  HTTP Basic auth (`require_admin`). Endpoints:
  - `GET /api/health` → `{ gateway, reachable }`
  - `GET /api/teams` → `[{ team_id, team_alias, models[], rpm_limit, tpm_limit }]`
  - `GET /api/logs?days&limit` → enriched per-request rows (latency, tokens, status,
    metadata) — the SPA computes **all** analytics client-side from these.
  - `GET /api/models` → backend inventory from `/model/info`
    (`model_name, provider, model, api_base, host, port, tier, mode, source`).
  - `GET /api/model-health` → live per-backend health from `/health` (slow; on-demand).
  - `GET /api/server` → **Server Monitor**: live HOST metrics. GPU via `nvidia-smi`
    (util, memory, temp, power, clocks, PCIe, throttle reasons, ECC, encoder/decoder,
    per-process); CPU (util + user/system/iowait/steal breakdown), memory/swap, network
    I/O and disk I/O rates, top processes, uptime via `psutil`; disk capacity;
    temperatures (lm-sensors, Linux); logged-in users. Collected in
    `app/server_monitor.py` from read-only host mounts + the NVIDIA runtime on the
    `dashboard` service in `docker-compose.yml`; rate-based readings share one short
    sampling window. The SPA keeps a rolling in-memory history for trend sparklines.
    Every section degrades gracefully (`available: false` / `[]`) when a tool or mount
    is missing — no spend/cost.
  - `GET /api/keys` → virtual keys (masked token, team, models, limits).
  - `POST /api/test` → **playground**: real request through the gateway.
  - **Writes** (proxied to LiteLLM, master key server-side, Basic-auth guarded):
    `POST /api/teams/{create,update,delete}`, `/api/keys/{create,update,delete}`,
    `/api/models/{create,update,delete}`. No key value ever reaches the browser except
    the one-time reveal returned by `keys/create`.
- **Frontend** (`dashboard/frontend/`): Vite builds to `dist/`; the Docker frontend
  stage copies it to `app/webdist`. FastAPI serves `webdist/index.html` at `/` and
  `webdist/assets/*` at `/assets/*` (both auth-guarded). The SPA talks to `/api/*`
  same-origin. Charts via Recharts; UI via shadcn-style components in
  `src/components/ui/`.

## Common tasks

### Run / rebuild the whole stack
```bash
docker compose up -d --build          # all services
docker compose up -d --build dashboard # just the dashboard (rebuilds the SPA)
docker compose ps                      # status
docker compose logs -f dashboard       # tail
```
Dashboard → http://localhost:8080 (Basic auth: `DASHBOARD_USERNAME` / `DASHBOARD_PASSWORD` from `.env`).
Gateway → http://localhost:4000.

### Develop the frontend
```bash
cd dashboard/frontend
npm install
npm run dev      # Vite dev server (proxy /api to :8080 if needed)
npm run build    # produces dist/ — what the backend serves
```
A UI change is **not live until the dashboard image is rebuilt** (`docker compose up
-d --build dashboard`) — the SPA is baked into the image, not volume-mounted.

### Add or re-route a model
Edit `litellm_config.yaml` (`model_list`), then `docker compose restart litellm`.
Models are reachable from the container via `host.docker.internal`. Keep the README
model-map table in sync.

### Provision a team + key
Two ways: the **dashboard UI** (Teams / Keys pages → create), or
`scripts/provision_keys.sh` (or `.ps1`) for bulk/scripted setup (needs
`LITELLM_MASTER_KEY`).

## Conventions

- Backend: a proxy over the LiteLLM mgmt API — reads via `litellm_safe()`, writes via
  `litellm()`; **never expose the master key**; guard every route with `require_admin`.
  Writes stay scoped to teams/keys/models management — no spend/budget surfaces.
- Frontend: JavaScript + JSX (no TypeScript); numbers use tabular-nums; mono font for
  IDs/models/tokens; design both light & dark themes; status colors (success/warn/
  critical) are reserved and separate from the azure accent.
- Secrets live in `.env` only. Never commit real secrets; never print them in logs or
  tool output.
- Verify UI changes by rebuilding the dashboard image and loading `:8080`, not just by
  reading the diff.

## Specialized agents & skills

Project agents live in `.claude/agents/` and skills in `.claude/skills/`:
- Agents: `dashboard-frontend`, `gateway-backend`, `gateway-infra`.
- Skills: `run-stack`, `dashboard-dev`, `gateway-models`, `provision-team`.
Prefer the matching agent/skill when a task fits it.
