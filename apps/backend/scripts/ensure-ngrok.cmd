@echo off
setlocal

set "ROOT=%~dp0.."

if not "%NGROK_PATH%"=="" (
  if exist "%NGROK_PATH%" (
    echo %NGROK_PATH%
    exit /b 0
  )
)

set "TOOLS_DIR=%ROOT%\.tools\ngrok"
set "NGROK_EXE=%TOOLS_DIR%\ngrok.exe"
set "NGROK_ZIP=%TOOLS_DIR%\ngrok.zip"
set "NGROK_DOWNLOAD_URL=https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-windows-amd64.zip"

if exist "%NGROK_EXE%" (
  echo %NGROK_EXE%
  exit /b 0
)

if not exist "%TOOLS_DIR%" mkdir "%TOOLS_DIR%"

echo [ngrok] ngrok.exe not found. Downloading ngrok...
curl.exe -L "%NGROK_DOWNLOAD_URL%" -o "%NGROK_ZIP%"
if errorlevel 1 (
  echo [ngrok] Failed to download ngrok.
  exit /b 1
)

powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "Expand-Archive -LiteralPath '%NGROK_ZIP%' -DestinationPath '%TOOLS_DIR%' -Force"
if errorlevel 1 (
  echo [ngrok] Failed to extract ngrok.
  exit /b 1
)

if not exist "%NGROK_EXE%" (
  echo [ngrok] ngrok.exe was not found after extraction.
  exit /b 1
)

echo %NGROK_EXE%
