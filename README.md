# AI Gateway — LiteLLM Proxy

A single OpenAI-compatible API gateway (port **4000**) in front of the existing
on-prem inference backends (Ollama, vLLM, Whisper). Each project gets its own
virtual API key routed to shared or dedicated models, with per-team rate limits
and usage logging.

```
                         ┌─────────────────────────────┐
  team keys  ──────────► │   LiteLLM Gateway  :4000     │
  (sk-...)               │   OpenAI-compatible /v1      │
                         └──────────────┬──────────────┘
                                        │ host.docker.internal
        ┌───────────────┬───────────────┼───────────────┬───────────────┐
        ▼               ▼               ▼               ▼               ▼
   Ollama :11434   Ollama :11434   Whisper :8001   vLLM :8002/3/4  (shared Postgres)
   gemma4:12b      bge-m3          transcriptions  reconix/webblock/camfinsight
   (shared)        (shared)        (HRD)           (dedicated per project)
```

## Files

| File | Purpose |
|------|---------|
| `litellm_config.yaml` | Maps gateway model names → backend endpoints |
| `docker-compose.yml` | LiteLLM + Postgres (keys, limits, usage logs) |
| `.env.example` | Secrets template — copy to `.env` |
| `systemd/ollama-override.conf` | Shared-Ollama tuning (parallel slots, keep-alive) |
| `scripts/provision_keys.sh` / `.ps1` | Create a team + key per project |
| `dashboard/` | Custom admin UI (:8080) — React SPA + FastAPI proxy; read-only requests/tokens/latency, teams & logs |

## Model map

| Gateway name (teams call this) | Backend | Tier |
|--------------------------------|---------|------|
| `gemma4-12b` | Ollama `gemma4:12b` @ 11434 | Shared |
| `bge-m3` (embeddings) | Ollama `bge-m3` @ 11434 | Shared |
| `whisper-large-v3-turbo` | Whisper @ 8001 | Shared (HRD) |
| `reconix-qwen35b` | vLLM @ 8002 | Dedicated |
| `webblock-coder30b` | vLLM @ 8003 | Dedicated |
| `camfinsight-qwen8b` | vLLM @ 8004 | Dedicated |

---

## 1. Prepare the backends

Run the shared Ollama tuning on the **host** (see comments in the file):

```bash
sudo mkdir -p /etc/systemd/system/ollama.service.d
sudo cp systemd/ollama-override.conf /etc/systemd/system/ollama.service.d/override.conf
sudo systemctl daemon-reload && sudo systemctl restart ollama
ollama pull gemma4:12b && ollama pull bge-m3
ollama ps   # confirm both stay loaded after a test query
```

Make sure Whisper is on `127.0.0.1:8001` and the three vLLM servers are on
`8002/8003/8004`, each exposing an OpenAI-compatible `/v1`.

## 2. Configure secrets

```bash
cp .env.example .env
# edit .env:
#   - LITELLM_MASTER_KEY  -> openssl rand -hex 32  (prefix with sk-)
#   - LITELLM_SALT_KEY    -> set ONCE, never change after first start
#   - POSTGRES_PASSWORD   -> must match the password inside DATABASE_URL
```

> **Why the Postgres block matters:** the guide's original snippet left the
> `litellm-db` service without `POSTGRES_USER/PASSWORD/DB` or a data volume.
> `docker-compose.yml` here sets all three (user/db are fixed to `litellm`,
> password comes from `.env`) and adds a named volume + healthcheck so LiteLLM
> only starts once the database is ready.

## 3. Start the gateway

```bash
docker compose up -d
docker compose logs -f litellm      # watch for "Application startup complete"
curl http://localhost:4000/health/liveliness
```

Admin UI: `http://<host>:4000/ui` — log in with `LITELLM_MASTER_KEY`.

## 4. Provision per-team keys

Each project becomes a **team** (scoped to its allowed models) with one virtual
key (rate-limited). Edit the `PROJECTS` list in the script to change limits or
model access.

**Linux server:**
```bash
export LITELLM_MASTER_KEY=sk-master-...        # same value as in .env
cd scripts && ./provision_keys.sh
```

**Windows (PowerShell):**
```powershell
$env:LITELLM_MASTER_KEY = "sk-master-..."
cd scripts; ./provision_keys.ps1
```

Keys are printed and written to `scripts/provisioned.keys.txt` (gitignored).
**Distribute each key to its team over a secure channel, then delete the file.**

What each team can access:

| Team | Key can call |
|------|--------------|
| reconix | `reconix-qwen35b`, `gemma4-12b`, `bge-m3` |
| webblock | `webblock-coder30b`, `gemma4-12b`, `bge-m3` |
| camfinsight | `camfinsight-qwen8b`, `gemma4-12b`, `bge-m3` |
| hrd | `whisper-large-v3-turbo`, `gemma4-12b`, `bge-m3` |

A key calling a model outside its allow-list is rejected by the gateway.

## 5. How teams use it

Point any OpenAI SDK at the gateway and use the team's key:

```python
from openai import OpenAI
client = OpenAI(base_url="http://<gateway-host>:4000/v1", api_key="sk-<team-key>")

client.chat.completions.create(
    model="gemma4-12b",
    messages=[{"role": "user", "content": "hello"}],
)
```

```bash
# Transcription (HRD)
curl http://<gateway-host>:4000/v1/audio/transcriptions \
  -H "Authorization: Bearer sk-<hrd-key>" \
  -F model="whisper-large-v3-turbo" -F file="@meeting.mp3"
```

## Dashboard (custom admin UI)

A **React (Vite + Tailwind + shadcn/ui) SPA** served by a thin **FastAPI** proxy
(`dashboard/`) runs alongside the gateway on **port 8080**. It gives you read-only
observability — **requests, tokens, latency** (this is a local workspace: no spend,
cost, or budget) — without exposing the master key to the browser. The master key
stays server-side; the dashboard is protected by HTTP Basic auth
(`DASHBOARD_USERNAME` / `DASHBOARD_PASSWORD` from `.env`).

The Docker image builds the SPA in a Node stage, then Python serves it — so a UI
change needs `docker compose up -d --build dashboard` to go live. It comes up with
`docker compose up -d`.

Open `http://<host>:8080` and log in. Pages:

| Page | Shows |
|------|-------|
| **Overview** | Stat tiles (teams, models, requests, tokens, success rate, p95 latency) + charts: requests/day, tokens/day, requests by model & team, success-vs-error, latency p50/p95, a usage-by-model table, and CSV/JSON **export** |
| **Request logs** | Per-request log with search, status/model/team filters, an **Errors-only** lens, sortable columns, pagination, **CSV export**, auto-refresh, and a click-through detail drawer (full metadata, token breakdown, latency) |
| **Infrastructure** | Backend **server instances grouped by host:port** — provider, domain, tier, the models each hosts and which teams use them; an on-demand **health check**; a model detail drawer with a **copy-as-curl** snippet; CSV/JSON export |
| **Playground** | Pick a model, send a chat or embedding request through the gateway, see the response + latency + token usage (internal-dev test console) |
| **Teams** | Create / edit / delete teams (alias, model access, rpm/tpm) with a **per-team drill-down** (usage, success rate, recent requests) and CSV export |
| **Keys** | Create / edit / **revoke** virtual keys (alias, team, models, limits); a created key is revealed **once** to copy |

The dashboard is a **full management console** — teams, virtual keys, and models all
support create/update/delete. Reads: `/api/health`, `/api/teams`, `/api/logs`,
`/api/models`, `/api/model-health`, `/api/keys`. Writes (proxied to LiteLLM with the
server-side master key): `/api/teams/{create,update,delete}`,
`/api/keys/{create,update,delete}`, `/api/models/{create,update,delete}`, plus the
playground `POST /api/test`. Analytics are computed client-side from LiteLLM's
`/team/list` and `/spend/logs` (the shared Postgres LiteLLM already writes to — no
separate store). `scripts/provision_keys.*` still works for bulk/scripted provisioning.
Models defined in `litellm_config.yaml` are read-only in the UI (edit the file);
UI-created models live in Postgres (`store_model_in_db: true`).

> **Note:** request logs appear only if LiteLLM is persisting them. It writes
> spend logs to Postgres by default when `database_url` is set (it is). If your
> Logs tab is empty after real traffic, confirm the gateway has processed
> requests and that `store_model_in_db` / DB logging is active.

### Running the dashboard standalone (optional)

```bash
cd dashboard
# 1) Build the SPA so FastAPI has something to serve (app/webdist)
cd frontend && npm install && npm run build && cp -r dist ../app/webdist && cd ..
# 2) Run the API server
pip install -r requirements.txt
LITELLM_BASE_URL=http://localhost:4000 \
LITELLM_MASTER_KEY=sk-master-... \
DASHBOARD_USERNAME=admin DASHBOARD_PASSWORD=secret \
uvicorn app.main:app --host 0.0.0.0 --port 8080
```

For live frontend development, run `npm run dev` in `dashboard/frontend/` and point
its `/api` calls at the running backend on `:8080`.

## Managing keys later

- **LiteLLM Admin UI** (`:4000/ui`) — create/rotate/revoke keys and adjust limits.
  (The custom dashboard on :8080 is read-only and does not manage keys.)
- **API** — e.g. revoke: `curl -X POST .../key/delete -H "Authorization: Bearer $MASTER" -d '{"keys":["sk-..."]}'`

## Notes

- Rate limits in the scripts are `rpm_limit` (requests/min) and `tpm_limit`
  (tokens/min) per key. Budgets (`max_budget` in USD) are omitted because local
  models have no per-token cost unless you register custom pricing — add them in
  the script if you want spend caps.
- vLLM endpoints all use the `hosted_vllm/` prefix (standardized from the
  original mix of `hosted_vllm/` and `openai/`); both route to an
  OpenAI-compatible `/v1`, but one prefix keeps the config consistent.
