[CmdletBinding()]
param(
    [string]$Server = '45.252.251.120',
    [string]$SshUser = 'root',
    [string]$RemoteDir = '/opt/x3crm',
    [string]$SshKey = '',
    [string]$LocalDbContainer = 'x3sales-postgres',
    [string]$LocalDatabase = 'x3crm',
    [string]$LocalDbUser = 'x3crm'
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$RepoRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$UploadsTarget = [IO.Path]::GetFullPath((Join-Path $RepoRoot 'apps\frontend\public\uploads'))
$FrontendPublicRoot = [IO.Path]::GetFullPath((Join-Path $RepoRoot 'apps\frontend\public'))
$BackupRoot = [IO.Path]::GetFullPath((Join-Path $RepoRoot 'tooling\backups'))
$RunId = Get-Date -Format 'yyyyMMdd-HHmmss'
$WorkDir = Join-Path $BackupRoot "production-sync-$RunId"
$DumpPath = Join-Path $WorkDir 'x3crm-production.dump'
$UploadsArchive = Join-Path $WorkDir 'x3crm-uploads.tar.gz'
$UploadsStaging = Join-Path $WorkDir 'uploads'
$StatusPath = Join-Path $BackupRoot 'last-production-sync.json'
$SshExe = 'C:\Windows\System32\OpenSSH\ssh.exe'
$AskPassExe = Join-Path $RepoRoot 'tooling\deployment\ssh-askpass.cmd'
$Target = "$SshUser@$Server"
$SshOptions = @('-o', 'StrictHostKeyChecking=yes', '-o', 'ConnectTimeout=15')
$ValidationDatabase = "${LocalDatabase}_production_sync"
$ContainerDumpPath = "/tmp/x3crm-production-$RunId.dump"
$syncSucceeded = $false
$containerDumpCopied = $false
$validationDatabaseCreated = $false

function Write-Step([string]$Message) {
    Write-Host "`n==> $Message" -ForegroundColor Cyan
}

function Assert-LastExitCode([string]$Action) {
    if ($LASTEXITCODE -ne 0) {
        throw "$Action failed with exit code $LASTEXITCODE."
    }
}

function Assert-SafeChildPath([string]$Path, [string]$Parent) {
    $resolvedPath = [IO.Path]::GetFullPath($Path).TrimEnd('\')
    $resolvedParent = [IO.Path]::GetFullPath($Parent).TrimEnd('\') + '\'

    if (-not $resolvedPath.StartsWith($resolvedParent, [StringComparison]::OrdinalIgnoreCase)) {
        throw "Unsafe local path outside expected parent: $resolvedPath"
    }
}

function New-SshProcess([string]$RemoteCommand) {
    $info = [Diagnostics.ProcessStartInfo]::new()
    $info.FileName = $SshExe
    $info.UseShellExecute = $false
    $info.CreateNoWindow = $true
    $info.RedirectStandardOutput = $true
    $info.RedirectStandardError = $true

    $arguments = @($SshOptions + @($Target, $RemoteCommand)) | ForEach-Object {
        '"' + ([string]$_).Replace('"', '\"') + '"'
    }
    $info.Arguments = $arguments -join ' '

    if (-not $SshKey) {
        $info.EnvironmentVariables['SSH_ASKPASS'] = $AskPassExe
        $info.EnvironmentVariables['SSH_ASKPASS_REQUIRE'] = 'force'
        $info.EnvironmentVariables['DISPLAY'] = 'x3crm-sync'
        $info.EnvironmentVariables['X3_DEPLOY_PASSWORD'] = $env:X3_DEPLOY_PASSWORD
    }

    return [Diagnostics.Process]::new() | ForEach-Object {
        $_.StartInfo = $info
        $_
    }
}

function Invoke-SshText([string]$RemoteCommand, [string]$Action) {
    $process = New-SshProcess $RemoteCommand
    [void]$process.Start()
    $stdoutTask = $process.StandardOutput.ReadToEndAsync()
    $stderrTask = $process.StandardError.ReadToEndAsync()
    $process.WaitForExit()
    $stdout = $stdoutTask.GetAwaiter().GetResult()
    $stderr = $stderrTask.GetAwaiter().GetResult()

    if ($process.ExitCode -ne 0) {
        throw "$Action failed: $($stderr.Trim())"
    }

    return $stdout.Trim()
}

function Save-SshBinaryOutput([string]$RemoteCommand, [string]$Destination, [string]$Action) {
    $process = New-SshProcess $RemoteCommand
    [void]$process.Start()
    $stderrTask = $process.StandardError.ReadToEndAsync()

    $file = [IO.File]::Open($Destination, [IO.FileMode]::Create, [IO.FileAccess]::Write, [IO.FileShare]::None)
    try {
        $process.StandardOutput.BaseStream.CopyTo($file)
    } finally {
        $file.Dispose()
    }

    $process.WaitForExit()
    $stderr = $stderrTask.GetAwaiter().GetResult()

    if ($process.ExitCode -ne 0) {
        throw "$Action failed: $($stderr.Trim())"
    }

    if ((Get-Item -LiteralPath $Destination).Length -eq 0) {
        throw "$Action returned an empty file."
    }
}

foreach ($required in @($SshExe, $AskPassExe, $FrontendPublicRoot)) {
    if (-not (Test-Path -LiteralPath $required)) {
        throw "Required path not found: $required"
    }
}

Assert-SafeChildPath $UploadsTarget $FrontendPublicRoot
Assert-SafeChildPath $WorkDir $BackupRoot

if ($SshKey) {
    if (-not (Test-Path -LiteralPath $SshKey)) {
        throw "SSH key not found: $SshKey"
    }

    $SshOptions += @('-i', $SshKey, '-o', 'BatchMode=yes')
} else {
    $securePassword = Read-Host "SSH password for $Target" -AsSecureString
    $passwordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
    try {
        $env:X3_DEPLOY_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPointer)
    } finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer)
    }

    $SshOptions += @('-o', 'PubkeyAuthentication=no')
}

New-Item -ItemType Directory -Path $WorkDir, $UploadsStaging -Force | Out-Null

try {
    Write-Step 'Checking production and local PostgreSQL'
    $preflight = Invoke-SshText -RemoteCommand "cd '$RemoteDir' && docker compose exec -T db pg_isready -U x3crm -d x3crm >/dev/null && docker compose exec -T backend test -d /app/public/uploads && printf PRODUCTION_OK" -Action 'Production preflight'
    if ($preflight -ne 'PRODUCTION_OK') {
        throw "Unexpected production preflight response: $preflight"
    }

    & docker compose -f (Join-Path $RepoRoot 'tooling\development\compose.local.yml') up -d postgres | Out-Host
    Assert-LastExitCode 'Start local PostgreSQL'
    & docker exec $LocalDbContainer pg_isready -U $LocalDbUser -d $LocalDatabase | Out-Host
    Assert-LastExitCode 'Check local PostgreSQL'

    Write-Step 'Streaming production database to local temporary storage'
    Save-SshBinaryOutput -RemoteCommand "cd '$RemoteDir' && docker compose exec -T db pg_dump -U x3crm -d x3crm -Fc --no-owner --no-privileges" -Destination $DumpPath -Action 'Download production database'

    Write-Step 'Streaming production uploads to local temporary storage'
    Save-SshBinaryOutput -RemoteCommand "cd '$RemoteDir' && docker compose exec -T backend tar -czf - -C /app/public/uploads ." -Destination $UploadsArchive -Action 'Download production uploads'

    Write-Step 'Validating database dump and uploads before deleting local data'
    & docker cp $DumpPath "${LocalDbContainer}:$ContainerDumpPath"
    Assert-LastExitCode 'Copy database dump into local PostgreSQL container'
    $containerDumpCopied = $true
    & docker exec $LocalDbContainer pg_restore -l $ContainerDumpPath | Out-Null
    Assert-LastExitCode 'Validate production database dump'

    $archiveEntries = @(& tar -tzf $UploadsArchive)
    Assert-LastExitCode 'Validate production uploads archive'
    $unsafeEntry = $archiveEntries | Where-Object {
        $_ -match '(^|/)\.\.(/|$)' -or $_ -match '^[/\\]'
    } | Select-Object -First 1
    if ($unsafeEntry) {
        throw "Unsafe path found in uploads archive: $unsafeEntry"
    }

    & tar -xzf $UploadsArchive -C $UploadsStaging
    Assert-LastExitCode 'Extract production uploads'

    Write-Step 'Restoring production database into a validated temporary database'
    & docker exec $LocalDbContainer psql -U $LocalDbUser -d postgres -v ON_ERROR_STOP=1 -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$ValidationDatabase' AND pid <> pg_backend_pid();" | Out-Null
    Assert-LastExitCode 'Close temporary database connections'
    & docker exec $LocalDbContainer dropdb -U $LocalDbUser --if-exists $ValidationDatabase
    Assert-LastExitCode 'Drop previous temporary database'
    & docker exec $LocalDbContainer createdb -U $LocalDbUser $ValidationDatabase
    Assert-LastExitCode 'Create temporary database'
    $validationDatabaseCreated = $true
    & docker exec $LocalDbContainer pg_restore -U $LocalDbUser -d $ValidationDatabase --no-owner --no-privileges --exit-on-error $ContainerDumpPath
    Assert-LastExitCode 'Restore production database into temporary database'

    Write-Step 'Replacing the local database'
    & docker exec $LocalDbContainer psql -U $LocalDbUser -d postgres -v ON_ERROR_STOP=1 -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$LocalDatabase' AND pid <> pg_backend_pid();" | Out-Null
    Assert-LastExitCode 'Close local database connections'
    & docker exec $LocalDbContainer dropdb -U $LocalDbUser --if-exists $LocalDatabase
    Assert-LastExitCode 'Delete old local database'
    & docker exec $LocalDbContainer psql -U $LocalDbUser -d postgres -v ON_ERROR_STOP=1 -c "ALTER DATABASE `"$ValidationDatabase`" RENAME TO `"$LocalDatabase`";" | Out-Null
    Assert-LastExitCode 'Activate production database locally'
    $validationDatabaseCreated = $false

    Write-Step 'Replacing local uploads'
    New-Item -ItemType Directory -Path $UploadsTarget -Force | Out-Null
    Get-ChildItem -LiteralPath $UploadsTarget -Force |
        Where-Object { $_.Name -notin @('.gitignore', '.gitkeep') } |
        Remove-Item -Recurse -Force
    Get-ChildItem -LiteralPath $UploadsStaging -Force |
        Copy-Item -Destination $UploadsTarget -Recurse -Force

    $databaseBytes = (Get-Item -LiteralPath $DumpPath).Length
    $uploadsArchiveBytes = (Get-Item -LiteralPath $UploadsArchive).Length
    $uploadFiles = Get-ChildItem -LiteralPath $UploadsTarget -File -Recurse -Force |
        Where-Object { $_.Name -notin @('.gitignore', '.gitkeep') }
    $uploadBytes = ($uploadFiles | Measure-Object -Property Length -Sum).Sum
    if ($null -eq $uploadBytes) { $uploadBytes = 0 }

    [ordered]@{
        syncedAt = (Get-Date).ToString('o')
        source = $Target
        database = $LocalDatabase
        databaseDumpBytes = $databaseBytes
        uploadFileCount = @($uploadFiles).Count
        uploadBytes = [int64]$uploadBytes
        uploadsArchiveBytes = $uploadsArchiveBytes
    } | ConvertTo-Json | Set-Content -LiteralPath $StatusPath -Encoding UTF8

    $syncSucceeded = $true
    Write-Host "`nProduction data is now active locally." -ForegroundColor Green
    Write-Host "Database: $LocalDatabase"
    Write-Host "Uploads: $(@($uploadFiles).Count) files / $([math]::Round($uploadBytes / 1MB, 2)) MB"
    Write-Host "Status: $StatusPath"
} finally {
    if ($containerDumpCopied) {
        try {
            & docker exec $LocalDbContainer rm -f $ContainerDumpPath 2>$null | Out-Null
        } catch {}
    }

    if (-not $syncSucceeded -and $validationDatabaseCreated) {
        try {
            & docker exec $LocalDbContainer dropdb -U $LocalDbUser --if-exists $ValidationDatabase 2>$null | Out-Null
        } catch {}
    }

    if (Test-Path -LiteralPath $WorkDir) {
        Remove-Item -LiteralPath $WorkDir -Recurse -Force
    }

    Remove-Item Env:X3_DEPLOY_PASSWORD -ErrorAction SilentlyContinue
}
