@echo off
setlocal EnableExtensions

set "REPO_ROOT=%~dp0..\.."
set "BACKEND_ROOT=%REPO_ROOT%\apps\backend"
set "PHP=%PHP_PATH%"
if "%PHP%"=="" set "PHP=D:\laragon\bin\php\php-8.4.4\php.exe"

if not exist "%PHP%" (
  echo [dev:scheduler] PHP not found: %PHP%
  exit /b 1
)

cd /d "%BACKEND_ROOT%"
echo [dev:scheduler] Running Laravel scheduler
"%PHP%" -d extension=pdo_pgsql -d extension=pgsql artisan schedule:work
