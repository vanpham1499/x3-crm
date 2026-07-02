@echo off
setlocal

set "ROOT=%~dp0.."
set "PHP=%PHP_PATH%"
if "%PHP%"=="" set "PHP=D:\laragon\bin\php\php-8.4.4\php.exe"

cd /d "%ROOT%"
"%PHP%" -d extension=pdo_pgsql -d extension=pgsql artisan migrate --seed --force
