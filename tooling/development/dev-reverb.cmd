@echo off
setlocal EnableExtensions

set "REPO_ROOT=%~dp0..\.."
set "BACKEND_ROOT=%REPO_ROOT%\apps\backend"
set "PHP=%PHP_PATH%"
if "%PHP%"=="" set "PHP=D:\laragon\bin\php\php-8.4.4\php.exe"

if not exist "%PHP%" (
  echo [dev:reverb] PHP not found: %PHP%
  exit /b 1
)

cd /d "%BACKEND_ROOT%"
set "CACHE_STORE=file"
echo [dev:reverb] Starting WebSocket server on ws://127.0.0.1:8080
"%PHP%" -d extension=pdo_pgsql -d extension=pgsql artisan reverb:start --host=0.0.0.0 --port=8080
