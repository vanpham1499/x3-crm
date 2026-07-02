@echo off
setlocal

set "ROOT=%~dp0.."
set "PHP=%PHP_PATH%"
if "%PHP%"=="" set "PHP=D:\laragon\bin\php\php-8.4.4\php.exe"

set "COMPOSER_PHAR=%COMPOSER_PHAR%"
if "%COMPOSER_PHAR%"=="" set "COMPOSER_PHAR=D:\laragon\bin\composer\composer.phar"

set "PORT=%PORT%"
if "%PORT%"=="" set "PORT=4000"

if not exist "%PHP%" (
  echo [dev:backend] PHP not found: %PHP%
  echo [dev:backend] Set PHP_PATH to your php.exe path, or install PHP in Laragon.
  exit /b 1
)

cd /d "%ROOT%"

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
  echo [dev:backend] Running migrations and seeders...
  "%PHP%" -d extension=pdo_pgsql -d extension=pgsql artisan migrate --seed --force
  if errorlevel 1 exit /b %errorlevel%
)

echo [dev:backend] Starting API on http://127.0.0.1:%PORT%/api
"%PHP%" -d extension=pdo_pgsql -d extension=pgsql -S 0.0.0.0:%PORT% -t public public/index.php
