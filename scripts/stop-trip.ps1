$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$pidPath = Join-Path $projectRoot '.runtime\trip.pid'
if (-not (Test-Path -LiteralPath $pidPath)) { Write-Output 'Trip mode is not running.'; exit 0 }
$tripPid = [int](Get-Content -LiteralPath $pidPath -Raw)
$process = Get-CimInstance Win32_Process -Filter "ProcessId = $tripPid"
if (-not $process) { Write-Output 'Trip mode is already stopped.'; Remove-Item -LiteralPath (Join-Path $projectRoot '.runtime\trip.lock') -ErrorAction SilentlyContinue; exit 0 }
if ($process.CommandLine -notlike '*trip.mjs*') { throw 'PID belongs to another command; refusing to stop it.' }
Stop-Process -Id $tripPid
Remove-Item -LiteralPath (Join-Path $projectRoot '.runtime\trip.lock') -ErrorAction SilentlyContinue
Write-Output "Stopped trip mode (PID $tripPid)."
