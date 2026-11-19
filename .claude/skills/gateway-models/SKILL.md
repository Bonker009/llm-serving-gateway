---
name: gateway-models
description: Add, remove, or re-route a model on the LiteLLM gateway by editing litellm_config.yaml. Use when asked to expose a new model name, point a model at a different backend endpoint/port, change the provider prefix, or adjust routing/timeout settings.
---

# Add / route a gateway model

`litellm_config.yaml` → `model_list` is the source of truth. Each entry maps a
**gateway model name** (what teams call) to a **backend** reached from the container
via `host.docker.internal`.

## Entry shape
```yaml
- model_name: <name-teams-call>          # e.g. myproj-qwen8b
  litellm_params:
    model: <provider_prefix>/<backend-model-id>
    api_base: http://host.docker.internal:<port>/v1
    api_key: "local-no-key"              # for OpenAI-compatible self-hosted backends
```

## Provider prefixes used here
- `ollama_chat/<model>` — Ollama chat models (e.g. `gemma4:12b`), `api_base` :11434
  (no `/v1`).
- `ollama/<model>` — Ollama embeddings (e.g. `bge-m3`).
- `openai/<model>` — OpenAI-compatible server (e.g. faster-whisper at :8001/v1).
- `hosted_vllm/<model>` — self-hosted vLLM endpoints (dedicated project models on
  :8002–:8004/v1). Standardize new vLLM models on this prefix.

## Tiers (keep the README table in sync)
- Tier 1 shared: `gemma4-12b`, `bge-m3`, `whisper-large-v3-turbo`.
- Tier 2 dedicated per project: `*-qwen*` etc. on their own vLLM port.

## Apply & verify
```bash
docker compose restart litellm
docker compose logs -f litellm        # watch for routing/registration errors
# list models via the gateway (reads master key from .env):
set -a && . ./.env && set +a
curl -s http://localhost:4000/v1/models -H "Authorization: Bearer $LITELLM_MASTER_KEY"
```

## Notes
- `store_model_in_db: true` means models can also be managed from the LiteLLM Admin UI
  (persisted in Postgres) — but the YAML stays the reviewable source of truth; prefer
  editing it.
- `litellm_settings.drop_params: true` silently drops params a backend doesn't support.
- If a team should call a new model, add it to that team's allow-list (see the
  `provision-team` skill) — exposing a model doesn't grant access by itself.
- This is a local workspace: do **not** add per-model pricing/budget config.
