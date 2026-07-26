@echo off
setlocal

set "REPO_ROOT=%~dp0..\.."
set "BACKEND_ROOT=%REPO_ROOT%\apps\backend"
set "PHP=%PHP_PATH%"
if "%PHP%"=="" set "PHP=D:\laragon\bin\php\php-8.4.4\php.exe"

cd /d "%BACKEND_ROOT%"
"%PHP%" -d extension=pdo_pgsql -d extension=pgsql artisan migrate --seed --force
