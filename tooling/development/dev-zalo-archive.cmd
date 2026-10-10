@echo off
setlocal EnableExtensions
set "REPO_ROOT=%~dp0..\.."
set "PHP=%PHP_PATH%"
if "%PHP%"=="" set "PHP=D:\laragon\bin\php\php-8.4.4\php.exe"
cd /d "%REPO_ROOT%\apps\backend"
"%PHP%" -d extension=pdo_pgsql artisan zalo-team:archive --watch
