param(
  [Parameter(Mandatory=$true)][string]$Php,
  [Parameter(Mandatory=$true)][string]$Backend,
  [Parameter(Mandatory=$true)][ValidatePattern('^[a-f0-9]{64}$')][string]$Owner,
  [Parameter(Mandatory=$true)][string]$Log
)
$ErrorActionPreference = 'Stop'
$phpPath = (Resolve-Path -LiteralPath $Php).Path
$backendPath = (Resolve-Path -LiteralPath $Backend).Path
$artisanPath = Join-Path $backendPath 'artisan'
if (-not (Test-Path -LiteralPath $artisanPath -PathType Leaf) -or $artisanPath.Contains('"')) { throw 'Invalid backend path' }
$workerArgs = @('-d', 'extension=pdo_pgsql', '-d', 'memory_limit=192M', ('"' + $artisanPath + '"'), 'zalo-team:file-worker', $Owner)
Start-Process -FilePath $phpPath -ArgumentList $workerArgs -WorkingDirectory $backendPath -WindowStyle Hidden -RedirectStandardOutput $Log -RedirectStandardError ($Log + '.err')
