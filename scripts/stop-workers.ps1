$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$pidPath = Join-Path $projectRoot '.runtime\listener.pid'
if (-not (Test-Path -LiteralPath $pidPath)) { Write-Output 'No saved listener PID.'; exit 0 }
$listenerPid = [int](Get-Content -LiteralPath $pidPath -Raw)
$process = Get-CimInstance Win32_Process -Filter "ProcessId = $listenerPid"
if (-not $process) { Write-Output 'Workers are already stopped.'; exit 0 }
if ($process.CommandLine -notlike ('*' + $projectRoot + '*listen.mjs*')) { throw 'PID belongs to another command; refusing to stop it.' }
Stop-Process -Id $listenerPid
Write-Output "Stopped this project's listener (PID $listenerPid)."
