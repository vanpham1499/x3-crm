[CmdletBinding()]
param(
    [string]$Server = '45.252.251.120',
    [string]$SshUser = 'root',
    [string]$RemoteDir = '/opt/x3crm',
    [string]$PublicUrl = 'https://crm.x3sales.com',
    [string]$SshKey = ''
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$BackendRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$RepoRoot = [IO.Path]::GetFullPath((Join-Path $BackendRoot '..\..'))
$FrontendRoot = [IO.Path]::GetFullPath((Join-Path $RepoRoot 'apps\frontend'))
$DeployRoot = [IO.Path]::GetFullPath((Join-Path $BackendRoot '.deploy\production'))
$WorkRoot = [IO.Path]::GetFullPath((Join-Path $BackendRoot '.deploy'))
$FrontendContext = [IO.Path]::GetFullPath((Join-Path $WorkRoot 'frontend-context'))
$ArtifactDir = [IO.Path]::GetFullPath((Join-Path $WorkRoot 'artifacts'))
$SshExe = 'C:\Windows\System32\OpenSSH\ssh.exe'
$ScpExe = 'C:\Windows\System32\OpenSSH\scp.exe'
$AskPassExe = Join-Path $PSScriptRoot 'ssh-askpass.cmd'
$Target = "$SshUser@$Server"
$SshOptions = @('-o', 'StrictHostKeyChecking=yes')
$PublicUrl = $PublicUrl.TrimEnd('/')
$PublicUri = $null

if (-not [Uri]::TryCreate($PublicUrl, [UriKind]::Absolute, [ref]$PublicUri) -or $PublicUri.Scheme -ne 'https') {
    throw "PublicUrl must be an absolute HTTPS URL. [$PublicUrl] given."
}

function Write-Step([string]$Message) {
    Write-Host "`n==> $Message" -ForegroundColor Cyan
}

function Assert-LastExitCode([string]$Action) {
    if ($LASTEXITCODE -ne 0) {
        throw "$Action failed with exit code $LASTEXITCODE."
    }
}

function Assert-ChildPath([string]$Path, [string]$Parent) {
    $resolvedPath = [IO.Path]::GetFullPath($Path).TrimEnd('\')
    $resolvedParent = [IO.Path]::GetFullPath($Parent).TrimEnd('\') + '\'
    if (-not $resolvedPath.StartsWith($resolvedParent, [StringComparison]::OrdinalIgnoreCase)) {
        throw "Unsafe path outside expected workspace: $resolvedPath"
    }
}

function Invoke-Remote([string]$Script) {
    $encoded = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($Script))
    & $SshExe @SshOptions $Target "echo $encoded | base64 -d | bash"
    Assert-LastExitCode 'Remote command'
}

foreach ($required in @($SshExe, $ScpExe, $FrontendRoot, $DeployRoot)) {
    if (-not (Test-Path -LiteralPath $required)) {
        throw "Required path not found: $required"
    }
}

if ($SshKey) {
    if (-not (Test-Path -LiteralPath $SshKey)) {
        throw "SSH key not found: $SshKey"
    }
    $SshOptions += @('-i', $SshKey, '-o', 'BatchMode=yes')
} else {
    if (-not (Test-Path -LiteralPath $AskPassExe)) {
        throw "SSH askpass helper not found: $AskPassExe"
    }
    if (-not $env:X3_DEPLOY_PASSWORD) {
        $securePassword = Read-Host "SSH password for $Target" -AsSecureString
        $passwordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
        try {
            $env:X3_DEPLOY_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPointer)
        } finally {
            [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer)
        }
    }
    $env:SSH_ASKPASS = $AskPassExe
    $env:SSH_ASKPASS_REQUIRE = 'force'
    $env:DISPLAY = 'x3crm-deploy'
    $SshOptions += @('-o', 'PubkeyAuthentication=no')
}

Push-Location $BackendRoot
try {
    $commit = (& git -C $RepoRoot rev-parse --short HEAD).Trim()
    Assert-LastExitCode 'Read git commit'
    $timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
    $release = "$timestamp-$commit"
    $backendTar = Join-Path $ArtifactDir "x3crm-backend-$release.tar"
    $frontendTar = Join-Path $ArtifactDir "x3crm-frontend-$release.tar"

    Write-Host "Deploy release: $release" -ForegroundColor Green

    $status = & git -C $RepoRoot status --short
    if ($status) {
        Write-Warning 'Working tree has local changes; the current filesystem state will be deployed.'
    }

    Write-Step 'Checking Docker and SSH access'
    & docker version --format '{{.Server.Version}}' | Out-Host
    Assert-LastExitCode 'Docker check'
    & $SshExe @SshOptions $Target 'echo SSH_OK'
    Assert-LastExitCode 'SSH check'

    Write-Step 'Preparing clean frontend build context'
    Assert-ChildPath $FrontendContext $WorkRoot
    Assert-ChildPath $ArtifactDir $WorkRoot
    if (Test-Path -LiteralPath $FrontendContext) {
        Remove-Item -LiteralPath $FrontendContext -Recurse -Force
    }
    New-Item -ItemType Directory -Path $FrontendContext -Force | Out-Null
    New-Item -ItemType Directory -Path $ArtifactDir -Force | Out-Null

    & robocopy $FrontendRoot $FrontendContext /E /XD node_modules .next .git /XF '*.tsbuildinfo' | Out-Host
    if ($LASTEXITCODE -gt 7) {
        throw "Frontend staging failed with robocopy exit code $LASTEXITCODE."
    }
    Copy-Item -LiteralPath (Join-Path $DeployRoot 'frontend.Dockerfile') -Destination (Join-Path $FrontendContext 'Dockerfile') -Force
    Copy-Item -LiteralPath (Join-Path $DeployRoot 'next.config.production.js') -Destination (Join-Path $FrontendContext 'next.config.production.js') -Force

    Write-Step 'Building backend image'
    & docker build --platform linux/amd64 -f (Join-Path $DeployRoot 'backend.Dockerfile') -t x3crm-backend:deploy $BackendRoot
    Assert-LastExitCode 'Backend image build'

    Write-Step 'Building frontend image'
    & docker build --platform linux/amd64 `
        --build-arg "NEXT_PUBLIC_API_URL=$PublicUrl/api" `
        --build-arg "NEXT_PUBLIC_MEDIA_URL=$PublicUrl" `
        -t x3crm-frontend:deploy $FrontendContext
    Assert-LastExitCode 'Frontend image build'

    Write-Step 'Saving Docker images'
    & docker save -o $backendTar x3crm-backend:deploy
    Assert-LastExitCode 'Save backend image'
    & docker save -o $frontendTar x3crm-frontend:deploy
    Assert-LastExitCode 'Save frontend image'

    Write-Step 'Backing up server database before migrations'
    Invoke-Remote @"
set -euo pipefail
cd '$RemoteDir'
grep -Eq '^PAYMENT_WEBHOOK_SECRET=.+$' .env || {
  echo 'PAYMENT_WEBHOOK_SECRET is missing in $RemoteDir/.env' >&2
  exit 1
}
mkdir -p backups
docker compose exec -T db pg_dump -U x3crm -d x3crm -Fc -f /tmp/pre-deploy-$release.dump
docker cp x3crm-db-1:/tmp/pre-deploy-$release.dump '$RemoteDir/backups/pre-deploy-$release.dump'
ls -lh '$RemoteDir/backups/pre-deploy-$release.dump'
"@

    Write-Step 'Uploading images and deployment configuration'
    & $ScpExe @SshOptions $backendTar "${Target}:${RemoteDir}/x3crm-backend-$release.tar"
    Assert-LastExitCode 'Upload backend image'
    & $ScpExe @SshOptions $frontendTar "${Target}:${RemoteDir}/x3crm-frontend-$release.tar"
    Assert-LastExitCode 'Upload frontend image'
    & $ScpExe @SshOptions (Join-Path $DeployRoot 'compose.yml') "${Target}:${RemoteDir}/compose.yml"
    Assert-LastExitCode 'Upload compose.yml'
    & $ScpExe @SshOptions (Join-Path $DeployRoot 'nginx.conf') "${Target}:${RemoteDir}/nginx.conf"
    Assert-LastExitCode 'Upload nginx.conf'

    Write-Step 'Loading images and restarting application'
    Invoke-Remote @"
set -euo pipefail
cd '$RemoteDir'
docker image inspect x3crm-backend:deploy >/dev/null 2>&1 && docker tag x3crm-backend:deploy x3crm-backend:rollback-$release || true
docker image inspect x3crm-frontend:deploy >/dev/null 2>&1 && docker tag x3crm-frontend:deploy x3crm-frontend:rollback-$release || true
docker image rm x3crm-backend:deploy >/dev/null 2>&1 || true
docker image rm x3crm-frontend:deploy >/dev/null 2>&1 || true
docker load -i 'x3crm-backend-$release.tar'
docker load -i 'x3crm-frontend-$release.tar'
docker compose config -q
docker compose up -d --no-deps db
docker compose up -d --force-recreate backend frontend nginx
rm -f 'x3crm-backend-$release.tar' 'x3crm-frontend-$release.tar'
docker compose ps
"@

    Write-Step 'Waiting for HTTP health check'
    $healthUrls = @("$PublicUrl/", "$PublicUrl/api/")
    $healthy = $false
    for ($attempt = 1; $attempt -le 30; $attempt++) {
        try {
            $statuses = foreach ($healthUrl in $healthUrls) {
                (Invoke-WebRequest -Uri $healthUrl -UseBasicParsing -TimeoutSec 10).StatusCode
            }
            if (($statuses | Where-Object { $_ -ne 200 }).Count -eq 0) {
                $healthy = $true
                break
            }
        } catch {
            Start-Sleep -Seconds 2
        }
    }
    if (-not $healthy) {
        throw "Deployment did not become healthy at $($healthUrls -join ', '). Rollback images are tagged with release $release."
    }

    Write-Step 'Verifying containers and migrations'
    Invoke-Remote @"
set -euo pipefail
cd '$RemoteDir'
docker compose ps
docker compose exec -T backend php artisan migrate:status --no-ansi | tail -n 12
"@

    Write-Host "`nDEPLOY SUCCESS: $PublicUrl" -ForegroundColor Green
    Write-Host "Release: $release"
    Write-Host "Database backup: $RemoteDir/backups/pre-deploy-$release.dump"
    Remove-Item -LiteralPath $backendTar, $frontendTar -Force -ErrorAction SilentlyContinue
} finally {
    Pop-Location
    if (Test-Path -LiteralPath $FrontendContext) {
        Assert-ChildPath $FrontendContext $WorkRoot
        Remove-Item -LiteralPath $FrontendContext -Recurse -Force
    }
    if (-not $SshKey) {
        Remove-Item Env:X3_DEPLOY_PASSWORD -ErrorAction SilentlyContinue
        Remove-Item Env:SSH_ASKPASS -ErrorAction SilentlyContinue
        Remove-Item Env:SSH_ASKPASS_REQUIRE -ErrorAction SilentlyContinue
        Remove-Item Env:DISPLAY -ErrorAction SilentlyContinue
    }
}
