@echo off
setlocal EnableExtensions
set "PHP=%PHP_PATH%"
if "%PHP%"=="" set "PHP=D:\laragon\bin\php\php-8.4.4\php.exe"
if not exist "%PHP%" exit /b 1
cd /d "%~dp0..\..\apps\backend"
"%PHP%" -d extension=pdo_pgsql -d extension=pgsql artisan zalo-team:work-reminders --watch
