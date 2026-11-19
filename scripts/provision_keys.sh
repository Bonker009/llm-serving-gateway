#!/usr/bin/env bash
# ============================================================================
# Provision one team + one virtual key per project on the LiteLLM gateway.
#
# Each team is scoped to ONLY the models it is allowed to call:
#   - its dedicated TIER-2 model, plus the shared TIER-1 models (gemma + bge).
# Each key inherits the team's model allow-list and gets rpm/tpm rate limits.
#
# Usage (run from anywhere that can reach the gateway):
#   export LITELLM_MASTER_KEY=sk-master-...          # same as in .env
#   export LITELLM_GATEWAY_URL=http://localhost:4000 # optional, this is default
#   ./provision_keys.sh
#
# Requires: curl, jq
# ============================================================================
set -euo pipefail

GATEWAY="${LITELLM_GATEWAY_URL:-http://localhost:4000}"
MASTER_KEY="${LITELLM_MASTER_KEY:?Set LITELLM_MASTER_KEY (your gateway master key)}"

command -v jq >/dev/null || { echo "jq is required (e.g. apt install jq)"; exit 1; }

# project_alias | allowed models (comma-sep) | rpm | tpm
PROJECTS=(
  "reconix|reconix-qwen35b,gemma4-12b,bge-m3|120|200000"
  "webblock|webblock-coder30b,gemma4-12b,bge-m3|120|200000"
  "camfinsight|camfinsight-qwen8b,gemma4-12b,bge-m3|120|200000"
  "hrd|whisper-large-v3-turbo,gemma4-12b,bge-m3|120|200000"
)

# Convert "a,b,c" -> JSON array ["a","b","c"]
to_json_array() {
  printf '%s' "$1" | jq -R 'split(",")'
}

api() {  # api <METHOD> <PATH> <JSON_BODY>
  curl -sS -X "$1" "${GATEWAY}$2" \
    -H "Authorization: Bearer ${MASTER_KEY}" \
    -H "Content-Type: application/json" \
    -d "$3"
}

echo "Gateway: ${GATEWAY}"
echo "Provisioning ${#PROJECTS[@]} projects..."
echo

OUTFILE="provisioned.keys.txt"
: > "$OUTFILE"

for entry in "${PROJECTS[@]}"; do
  IFS='|' read -r alias models rpm tpm <<<"$entry"
  models_json=$(to_json_array "$models")

  # 1) Create (or reuse) the team.
  team_body=$(jq -n --arg a "$alias" --argjson m "$models_json" \
    '{team_alias:$a, models:$m}')
  team_resp=$(api POST /team/new "$team_body")
  team_id=$(printf '%s' "$team_resp" | jq -r '.team_id // empty')

  if [[ -z "$team_id" ]]; then
    echo "!! Failed to create team '${alias}':"
    printf '   %s\n' "$team_resp"
    continue
  fi

  # 2) Create the virtual key under that team, with rate limits.
  key_body=$(jq -n \
    --arg a "$alias" --arg t "$team_id" --argjson m "$models_json" \
    --argjson rpm "$rpm" --argjson tpm "$tpm" \
    '{key_alias:("key-"+$a), team_id:$t, models:$m,
      rpm_limit:$rpm, tpm_limit:$tpm, metadata:{project:$a}}')
  key_resp=$(api POST /key/generate "$key_body")
  vkey=$(printf '%s' "$key_resp" | jq -r '.key // empty')

  if [[ -z "$vkey" ]]; then
    echo "!! Failed to create key for '${alias}':"
    printf '   %s\n' "$key_resp"
    continue
  fi

  printf "%-12s team_id=%s\n             key=%s\n             models=%s  rpm=%s tpm=%s\n\n" \
    "$alias" "$team_id" "$vkey" "$models" "$rpm" "$tpm"
  printf "%s\t%s\t%s\n" "$alias" "$team_id" "$vkey" >> "$OUTFILE"
done

echo "Done. Keys written to ${OUTFILE} (gitignored — distribute securely, then delete)."
