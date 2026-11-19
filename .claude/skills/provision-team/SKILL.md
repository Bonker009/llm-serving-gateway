---
name: provision-team
description: Create a team and its scoped virtual API key on the LiteLLM gateway — either in bulk via scripts/provision_keys.sh/.ps1, or one at a time in the dashboard UI (Teams/Keys pages). Use when asked to onboard a project, mint a virtual key, or set a team's model allow-list or rpm/tpm limits.
---

# Provision a team + virtual key

Two paths:
- **Dashboard UI** — the Teams and Keys pages (`:8080`) create/edit/delete teams and
  keys interactively; a new key is revealed once to copy. Best for one-off changes.
- **Bulk script** — `scripts/provision_keys.sh` (bash+curl+jq) or `.ps1` (PowerShell)
  onboards several projects at once. Each run creates, per project: a **team** scoped to
  an allowed model list, and a **virtual key** under that team with rpm/tpm limits.

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
- Script keys are written to `provisioned.keys.txt` (gitignored) — **distribute
  securely and delete**. Never paste a real `sk-...` key or the master key into chat,
  commits, or tool output.
- Verify afterward in the dashboard Teams/Keys pages (http://localhost:8080) or via
  `/team/list` on the gateway.
- The script is not idempotent (re-running creates more teams/keys); for single
  tweaks prefer the UI edit buttons or check existing teams first.
