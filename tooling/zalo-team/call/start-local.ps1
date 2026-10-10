param([string]$NodePath)
$ErrorActionPreference = 'Stop'
# 9260 is reserved for the live ZRTC gateway; audio-only Docker tests use 9261.
$callExistingHealth = $null
try { $callExistingHealth = Invoke-RestMethod -Uri 'http://127.0.0.1:9260/health' -TimeoutSec 2 } catch {}
if ($null -ne $callExistingHealth) {
  if ($callExistingHealth.callReady -eq $true -and $callExistingHealth.provider -eq 'zrtc') {
    Write-Output 'Zalo Team call gateway is already ready on 9260.'
    exit 0
  }
  throw 'Port 9260 is occupied by a service that cannot place Zalo calls. Stop that service first; audio-only tests must use port 9261.'
}
$callWorkspace = (Resolve-Path (Join-Path $PSScriptRoot '../../..')).Path
$callTokenPath = Join-Path $callWorkspace '.local/zalo-call-assets/audio-token'
$connectorTokenPath = Join-Path $callWorkspace 'tooling/zalo-team/.local/web-token'
if (!(Test-Path -LiteralPath $connectorTokenPath -PathType Leaf)) { throw 'Start the Zalo Team web connector first.' }
if (!(Test-Path -LiteralPath $callTokenPath -PathType Leaf)) {
  New-Item -ItemType Directory -Force -Path (Split-Path $callTokenPath) | Out-Null
  $callTokenBytes = New-Object byte[] 32
  $callRng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  try { $callRng.GetBytes($callTokenBytes) } finally { $callRng.Dispose() }
  [IO.File]::WriteAllText($callTokenPath, ([BitConverter]::ToString($callTokenBytes).Replace('-', '').ToLowerInvariant()))
  [Array]::Clear($callTokenBytes, 0, $callTokenBytes.Length)
}
# Process-scoped only. No Zalo PC process, virtual device or system setting.
$env:CALL_ENGINE = 'zrtc'
$env:CALL_TOKEN_FILE = $callTokenPath
$env:CALL_CONNECTOR_TOKEN_FILE = $connectorTokenPath
$env:CALL_BIND_ADDRESS = '127.0.0.1'
$env:CALL_MEDIA_ADDRESS = '127.0.0.1'
Set-Location -LiteralPath $callWorkspace
if (!$NodePath) { $NodePath = (Get-Command node.exe -ErrorAction Stop).Source }
& $NodePath (Join-Path $callWorkspace 'apps/backend/integrations/zalo/call/audio-worker.mjs')
exit $LASTEXITCODE
