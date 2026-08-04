@echo off
setlocal EnableExtensions

set "REPO_ROOT=%~dp0..\.."
set "BACKEND_ROOT=%REPO_ROOT%\apps\backend"
set "PHP=%PHP_PATH%"
if "%PHP%"=="" set "PHP=D:\laragon\bin\php\php-8.4.4\php.exe"

if not exist "%PHP%" (
  echo [dev:queue] PHP not found: %PHP%
  exit /b 1
)

cd /d "%BACKEND_ROOT%"
set "CACHE_STORE=file"
echo [dev:queue] Processing realtime and default database queues
:start_worker
"%PHP%" -d extension=pdo_pgsql -d extension=pgsql artisan queue:work database --queue=realtime,default --sleep=1 --tries=3 --timeout=60
if errorlevel 1 (
  echo [dev:queue] Database may still be starting or migrating. Retrying in 2 seconds...
  timeout /t 2 /nobreak >nul
  goto start_worker
)
