@echo off
setlocal
rem X3 CRM production deployment entry point.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0deploy-production.ps1" %*
exit /b %errorlevel%
