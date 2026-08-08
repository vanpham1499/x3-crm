@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0sync-production-to-local.ps1" %*
exit /b %errorlevel%
