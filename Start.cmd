@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Install Node.js 24 or newer from https://nodejs.org and try again.
  pause
  exit /b 1
)
if not exist node_modules (
  call npm install
  if errorlevel 1 exit /b 1
)
echo Open http://127.0.0.1:8765 in your browser.
node server.mjs
pause
