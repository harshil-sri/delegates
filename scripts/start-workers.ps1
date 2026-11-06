$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$runtimeDir = Join-Path $projectRoot '.runtime'
$pidPath = Join-Path $runtimeDir 'listener.pid'
if (Test-Path -LiteralPath $pidPath) {
    $listenerPid = [int](Get-Content -LiteralPath $pidPath -Raw)
    $existing = Get-CimInstance Win32_Process -Filter "ProcessId = $listenerPid"
    if ($existing -and $existing.CommandLine -like ('*' + $projectRoot + '*listen.mjs*')) {
        Write-Output "Workers already running (PID $listenerPid)."
        exit 0
    }
}
$scriptPath = Join-Path $PSScriptRoot 'listen.mjs'
$child = Start-Process -FilePath (Get-Command node).Source -ArgumentList @(('"'+$scriptPath+'"')) -WorkingDirectory $projectRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $runtimeDir 'listener.out.log') -RedirectStandardError (Join-Path $runtimeDir 'listener.err.log') -PassThru
Write-Output "Started local advocate workers and court clerk (PID $($child.Id))."
