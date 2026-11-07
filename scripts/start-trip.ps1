# Starts trip mode in the background. Stop the court workers first:
#   .\scripts\stop-workers.ps1 ; .\scripts\start-trip.ps1
# Add -Reset to clear both schedules and plans before a fresh demo take.
param([switch]$Reset)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$runtimeDir = Join-Path $projectRoot '.runtime'
$scriptPath = Join-Path $PSScriptRoot 'trip.mjs'
$nodeArgs = @(('"' + $scriptPath + '"'))
if ($Reset) { $nodeArgs += '--reset'; $nodeArgs += '--announce' }
$child = Start-Process -FilePath (Get-Command node).Source -ArgumentList $nodeArgs -WorkingDirectory $projectRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $runtimeDir 'trip.out.log') -RedirectStandardError (Join-Path $runtimeDir 'trip.err.log') -PassThru
Write-Output "Started trip mode (PID $($child.Id)). Logs: .runtime\trip.out.log / trip.err.log"
