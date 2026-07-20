@echo off
setlocal

set "SSH_EXE=C:\Windows\System32\OpenSSH\ssh.exe"
set "SERVER=root@45.252.251.120"
set "LOCAL_PORT=5434"

if not exist "%SSH_EXE%" (
    echo [ERROR] Khong tim thay OpenSSH tai %SSH_EXE%
    exit /b 1
)

echo Dang mo SSH tunnel toi database VPS...
echo Backend local se ket noi database server qua 127.0.0.1:%LOCAL_PORT%
echo Giu cua so nay mo trong khi su dung DB_PROFILE=server.
echo.

"%SSH_EXE%" ^
    -o ExitOnForwardFailure=yes ^
    -o ServerAliveInterval=30 ^
    -o ServerAliveCountMax=3 ^
    -N ^
    -L 127.0.0.1:%LOCAL_PORT%:127.0.0.1:5432 ^
    %SERVER%

if errorlevel 1 (
    echo.
    echo [ERROR] SSH tunnel da dung hoac khong the ket noi.
    exit /b 1
)
