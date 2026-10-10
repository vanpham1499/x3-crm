param(
  [Parameter(Mandatory=$true)][string]$EnginePath,
  [Parameter(Mandatory=$true)][string]$NativeInputName,
  [Parameter(Mandatory=$true)][string]$NativeOutputName,
  [Parameter(Mandatory=$true)][string]$BridgeInputName,
  [Parameter(Mandatory=$true)][string]$BridgeOutputName
)
$ErrorActionPreference = 'Stop'
$workspace = (Resolve-Path (Join-Path $PSScriptRoot '../../..')).Path
$callToken = Join-Path $workspace '.local/zalo-call-assets/audio-token'
$connectorToken = Join-Path $workspace 'tooling/zalo-team/.local/web-token'
foreach ($requiredFile in @($EnginePath, $callToken, $connectorToken)) {
  if (!(Test-Path -LiteralPath $requiredFile -PathType Leaf)) { throw 'CALL_CONFIGURATION_FILE_MISSING' }
}
# These changes apply only to this process and the child worker. No audio device,
# Windows service, firewall rule or system environment variable is changed.
$env:CALL_NATIVE_ENGINE = (Resolve-Path -LiteralPath $EnginePath).Path
$env:CALL_TOKEN_FILE = $callToken
$env:CALL_CONNECTOR_TOKEN_FILE = $connectorToken
$env:CALL_BIND_ADDRESS = '127.0.0.1'
$env:CALL_MEDIA_ADDRESS = '127.0.0.1'
$env:CALL_ENGINE_INPUT = $NativeInputName
$env:CALL_ENGINE_OUTPUT = $NativeOutputName
$env:CALL_VIRTUAL_INPUT = $BridgeInputName
$env:CALL_VIRTUAL_OUTPUT = $BridgeOutputName
Set-Location -LiteralPath $workspace
node (Join-Path $workspace 'apps/backend/integrations/zalo/call/audio-worker.mjs')
exit $LASTEXITCODE
