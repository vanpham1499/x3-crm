param(
  [Parameter(Mandatory=$true)][string]$ResultPath,
  [Parameter(Mandatory=$true)][ValidatePattern('^[a-f0-9-]{36}$')][string]$RequestId
)
$ErrorActionPreference = 'Stop'
if ($ResultPath.Contains('"')) { throw 'Invalid picker path' }
$source = Join-Path $PSScriptRoot 'FilePicker.cs'
$hash = (Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash.Substring(0,16)
$binary = Join-Path (Split-Path -Parent $ResultPath) ('file-picker-' + $hash + '.exe')
if (-not (Test-Path -LiteralPath $binary)) {
  Add-Type -Path $source -ReferencedAssemblies System.Windows.Forms,System.Drawing,System.Web.Extensions -OutputAssembly $binary -OutputType WindowsApplication
}
# An interactive GUI program, without a console. The user explicitly requested this dialog.
Start-Process -FilePath $binary -ArgumentList @(('"' + $ResultPath + '"'), $RequestId) -WindowStyle Normal