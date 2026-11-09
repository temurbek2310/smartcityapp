@echo off
setlocal
cd /d "%~dp0"

echo.
echo ==============================
echo        SmartCity MVP v1.0
echo ==============================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed or not available in PATH.
  echo Install Node.js 20.9 or newer, then run this file again.
  pause
  exit /b 1
)

where pnpm >nul 2>nul
if errorlevel 1 (
  echo pnpm was not found.
  echo Run this command once in Git Bash or PowerShell:
  echo npm install -g pnpm@10
  echo.
  pause
  exit /b 1
)

if not exist node_modules (
  echo Installing dependencies...
  call pnpm install
  if errorlevel 1 (
    echo Dependency installation failed.
    pause
    exit /b 1
  )
)

echo.
echo Starting SmartCity at http://localhost:3000
echo Keep this window open while using the app.
echo.
call pnpm dev
