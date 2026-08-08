@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "REPO_ROOT=%~dp0..\.."
set "BACKEND_ROOT=%REPO_ROOT%\apps\backend"
set "TOOLING_ROOT=%REPO_ROOT%\tooling"
set "PRODUCTION_SYNC_MARKER=%TOOLING_ROOT%\backups\last-production-sync.json"
set "PHP=%PHP_PATH%"
if "%PHP%"=="" set "PHP=D:\laragon\bin\php\php-8.4.4\php.exe"

set "COMPOSER_PHAR=%COMPOSER_PHAR%"
if "%COMPOSER_PHAR%"=="" set "COMPOSER_PHAR=D:\laragon\bin\composer\composer.phar"

set "PORT=%PORT%"
if "%PORT%"=="" set "PORT=4000"

set "START_NGROK=%START_NGROK%"
if "%START_NGROK%"=="" set "START_NGROK=1"

set "NGROK_URL=%NGROK_URL%"

if not exist "%PHP%" (
  echo [dev:backend] PHP not found: %PHP%
  echo [dev:backend] Set PHP_PATH to your php.exe path, or install PHP in Laragon.
  exit /b 1
)

cd /d "%BACKEND_ROOT%"

set "ACTIVE_DB_PROFILE=%DB_PROFILE%"
if "!ACTIVE_DB_PROFILE!"=="" (
  for /f "tokens=1,* delims==" %%A in ('findstr /B "DB_PROFILE=" ".env" 2^>nul') do set "ACTIVE_DB_PROFILE=%%B"
)
if "!ACTIVE_DB_PROFILE!"=="" set "ACTIVE_DB_PROFILE=default"

if not exist "vendor\autoload.php" (
  if not exist "%COMPOSER_PHAR%" (
    echo [dev:backend] Composer not found: %COMPOSER_PHAR%
    echo [dev:backend] Set COMPOSER_PHAR to composer.phar path, or install Composer in Laragon.
    exit /b 1
  )

  echo [dev:backend] vendor/autoload.php missing. Running composer install...
  "%PHP%" "%COMPOSER_PHAR%" install
  if errorlevel 1 exit /b %errorlevel%
)

if not "%SKIP_DB_SETUP%"=="1" (
  if /I "!ACTIVE_DB_PROFILE!"=="server" (
    echo [dev:backend] DB_PROFILE=server - skipping automatic migrations and seeders.
  ) else (
    echo [dev:backend] Running migrations on !ACTIVE_DB_PROFILE! database...
    "%PHP%" -d extension=pdo_pgsql -d extension=pgsql artisan migrate --force
    if errorlevel 1 exit /b %errorlevel%

    if "!FORCE_LOCAL_SEED!"=="1" (
      echo [dev:backend] FORCE_LOCAL_SEED=1 - running seeders explicitly...
      "%PHP%" -d extension=pdo_pgsql -d extension=pgsql artisan db:seed --force
      if errorlevel 1 exit /b %errorlevel%
    ) else if exist "!PRODUCTION_SYNC_MARKER!" (
      echo [dev:backend] Production snapshot detected - skipping sample seeders.
    ) else (
      echo [dev:backend] Running seeders on local development database...
      "%PHP%" -d extension=pdo_pgsql -d extension=pgsql artisan db:seed --force
      if errorlevel 1 exit /b %errorlevel%
    )
  )
)

if not "%START_NGROK%"=="0" (
  set "NGROK_EXE=%NGROK_PATH%"
  if "!NGROK_EXE!"=="" set "NGROK_EXE=%TOOLING_ROOT%\binaries\ngrok\ngrok.exe"

  if not exist "!NGROK_EXE!" (
    call "%~dp0ensure-ngrok.cmd"
    if errorlevel 1 exit /b %errorlevel%
  )

  if not exist "!NGROK_EXE!" (
    echo [dev:backend] ngrok not found: !NGROK_EXE!
    exit /b 1
  )

  if not "%NGROK_AUTHTOKEN%"=="" (
    echo [dev:backend] Updating ngrok authtoken...
    "!NGROK_EXE!" config add-authtoken "%NGROK_AUTHTOKEN%" >nul
  )

  if "%NGROK_URL%"=="" (
    echo [dev:backend] Starting ngrok tunnel with a random ngrok URL.
    echo [dev:backend] Set NGROK_URL=despitefully-ahungered-anh.ngrok-free.dev to use the fixed ngrok dev domain.
    set "NGROK_ARGS=http %PORT%"
  ) else (
    echo [dev:backend] Starting ngrok tunnel: https://%NGROK_URL%/api/payments/webhook
    set "NGROK_ARGS=http --url=%NGROK_URL% %PORT%"
  )

  echo [dev:backend] ngrok inspect: http://127.0.0.1:4040
  start "x3sales-ngrok" /min cmd /k ""!NGROK_EXE!" !NGROK_ARGS!"
)

echo [dev:backend] Starting API on http://127.0.0.1:%PORT%/api
"%PHP%" -d extension=pdo_pgsql -d extension=pgsql -S 0.0.0.0:%PORT% -t public public/index.php
