$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
& node (Join-Path $PSScriptRoot 'init-env.mjs')
if ($LASTEXITCODE -ne 0) { throw 'Could not prepare private configuration' }
$logPath = Join-Path $projectRoot '.runtime\stack-start.log'
Write-Output "Pulling and starting pinned services; details: $logPath"
# Compose writes normal progress to stderr; Windows PowerShell 5.1 would turn
# that into a terminating error under 'Stop'. Judge success by the exit code.
$ErrorActionPreference = 'Continue'
& docker compose --ansi never --progress plain --project-name creative-veto-spike --env-file (Join-Path $projectRoot '.runtime\stack.env') -f (Join-Path $projectRoot 'infra\compose.yml') --profile collab --profile gateway up -d *>> $logPath
$composeExit = $LASTEXITCODE
$ErrorActionPreference = 'Stop'
if ($composeExit -ne 0) { throw "Switch stack startup failed (exit $composeExit); see $logPath" }
Write-Output 'Starting the isolated creative-veto-spike stack. Run npm run setup after the services are healthy.'
