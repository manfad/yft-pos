@echo off
setlocal

rem One-command Windows updater/build for use over SSH.
rem Always run from this file's repository, regardless of the SSH start folder.
cd /d "%~dp0"

where git >nul 2>nul
if errorlevel 1 (
  echo ERROR: Git is not installed or is not on PATH.
  exit /b 1
)

where pnpm >nul 2>nul
if errorlevel 1 (
  echo ERROR: pnpm is not installed or is not on PATH.
  echo Install it once with: corepack enable
  exit /b 1
)

echo [1/5] Pulling latest main branch...
git pull --ff-only
if errorlevel 1 exit /b 1

echo [2/5] Installing locked dependencies...
call pnpm install --frozen-lockfile
if errorlevel 1 exit /b 1

echo [3/5] Running tests...
call pnpm test
if errorlevel 1 exit /b 1

echo [4/5] Checking TypeScript and Vue...
call pnpm typecheck
if errorlevel 1 exit /b 1

echo [5/5] Building Windows installer and portable app...
call pnpm --filter @yf/pos dist:win
if errorlevel 1 exit /b 1

echo.
echo BUILD COMPLETE
echo Output: %~dp0apps\pos\release
exit /b 0
