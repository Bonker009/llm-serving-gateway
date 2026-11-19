---
name: provision-team
description: Create a team and its scoped virtual API key on the LiteLLM gateway using scripts/provision_keys.sh or .ps1. Use when asked to onboard a project, mint a virtual key, set a team's model allow-list or rpm/tpm limits. This is the ONLY supported way to create keys — the dashboard has no key UI.
---

# Provision a team + virtual key

Keys are minted out-of-band with `scripts/provision_keys.sh` (bash+curl+jq) or
`scripts/provision_keys.ps1` (PowerShell). Each run creates, per project: a **team**
scoped to an allowed model list, and a **virtual key** under that team with rpm/tpm
limits. The dashboard is intentionally read-only and does **not** mint keys.

## Run it
```bash
export LITELLM_MASTER_KEY=sk-master-...            # must match .env
export LITELLM_GATEWAY_URL=http://localhost:4000   # optional (default)
./scripts/provision_keys.sh                         # needs curl + jq
```
PowerShell: `scripts/provision_keys.ps1` (same env vars). Suggest the user run an
interactive login/secret export themselves with the `!` prefix if needed.

## Edit who gets what
Projects are defined in the `PROJECTS` array near the top of the script:
```
"<alias>|<model1,model2,...>|<rpm>|<tpm>"
```
Each project is scoped to its **dedicated** model plus the **shared** Tier-1 models
(`gemma4-12b`, `bge-m3`). To onboard a new project, add a line; to change access or
limits, edit its entry. Model names must already exist in `litellm_config.yaml` (see
the `gateway-models` skill).

## Output & safety
- Keys are written to `provisioned.keys.txt` (gitignored) — **distribute securely and
  delete**. Never paste a real `sk-...` key or the master key into chat, commits, or
  tool output.
- Verify afterward in the dashboard Teams tab (http://localhost:8080) or via
  `/team/list` on the gateway.
- Re-running creates additional teams/keys; it is not idempotent — check existing
  teams first if you only meant to tweak one.
