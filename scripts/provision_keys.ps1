# ============================================================================
# Provision one team + one virtual key per project on the LiteLLM gateway.
# PowerShell equivalent of provision_keys.sh (no jq/curl required).
#
# Usage (PowerShell):
#   $env:LITELLM_MASTER_KEY = "sk-master-..."          # same as in .env
#   $env:LITELLM_GATEWAY_URL = "http://localhost:4000" # optional (default)
#   ./provision_keys.ps1
# ============================================================================
$ErrorActionPreference = "Stop"

$Gateway   = if ($env:LITELLM_GATEWAY_URL) { $env:LITELLM_GATEWAY_URL } else { "http://localhost:4000" }
$MasterKey = $env:LITELLM_MASTER_KEY
if (-not $MasterKey) { throw "Set `$env:LITELLM_MASTER_KEY (your gateway master key)" }

$Headers = @{ Authorization = "Bearer $MasterKey"; "Content-Type" = "application/json" }

# alias, allowed models, rpm, tpm
$Projects = @(
  @{ alias = "reconix";     models = @("reconix-qwen35b","gemma4-12b","bge-m3");   rpm = 120; tpm = 200000 },
  @{ alias = "webblock";    models = @("webblock-coder30b","gemma4-12b","bge-m3"); rpm = 120; tpm = 200000 },
  @{ alias = "camfinsight"; models = @("camfinsight-qwen8b","gemma4-12b","bge-m3"); rpm = 120; tpm = 200000 },
  @{ alias = "hrd";         models = @("whisper-large-v3-turbo","gemma4-12b","bge-m3"); rpm = 120; tpm = 200000 }
)

function Invoke-LiteLLM($Method, $Path, $Body) {
  Invoke-RestMethod -Method $Method -Uri "$Gateway$Path" -Headers $Headers `
    -Body ($Body | ConvertTo-Json -Depth 6)
}

Write-Host "Gateway: $Gateway"
Write-Host "Provisioning $($Projects.Count) projects...`n"

$OutFile = "provisioned.keys.txt"
Set-Content -Path $OutFile -Value $null

foreach ($p in $Projects) {
  try {
    # 1) Team
    $team = Invoke-LiteLLM "POST" "/team/new" @{ team_alias = $p.alias; models = $p.models }
    $teamId = $team.team_id

    # 2) Virtual key under the team, with rate limits
    $key = Invoke-LiteLLM "POST" "/key/generate" @{
      key_alias = "key-$($p.alias)"
      team_id   = $teamId
      models    = $p.models
      rpm_limit = $p.rpm
      tpm_limit = $p.tpm
      metadata  = @{ project = $p.alias }
    }

    Write-Host ("{0,-12} team_id={1}" -f $p.alias, $teamId)
    Write-Host ("             key={0}" -f $key.key)
    Write-Host ("             models={0}  rpm={1} tpm={2}`n" -f ($p.models -join ","), $p.rpm, $p.tpm)
    Add-Content -Path $OutFile -Value ("{0}`t{1}`t{2}" -f $p.alias, $teamId, $key.key)
  }
  catch {
    Write-Host "!! Failed for '$($p.alias)': $($_.Exception.Message)" -ForegroundColor Red
  }
}

Write-Host "Done. Keys written to $OutFile (gitignored — distribute securely, then delete)."
