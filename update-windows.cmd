@echo off
setlocal

rem One-command updater for the installed kiosk app (C:\Program Files\Yun Fook POS).
rem Builds first (pull + locked install + tests + typecheck + installer) and only
rem touches the installed app when all of that passes — a broken build can never
rem take the till down mid-trial.
rem
rem   update-windows.cmd          build + reinstall + relaunch (run at the machine)
rem   update-windows.cmd /reboot  build + reinstall + reboot (for SSH updates: the
rem                               app auto-starts into kiosk mode on boot)
cd /d "%~dp0"

call build-windows.cmd
if errorlevel 1 (
  echo UPDATE ABORTED: build failed, the installed app was left untouched.
  exit /b 1
)

rem The NSIS installer is "<product>-<version>-x64.exe"; the portable build has
rem its own -portable suffix, so this wildcard only ever matches the installer.
set "INSTALLER="
for %%f in ("%~dp0apps\pos\release\Yun Fook POS-*-x64.exe") do set "INSTALLER=%%~ff"
if not defined INSTALLER (
  echo ERROR: no installer found in apps\pos\release.
  exit /b 1
)

echo Closing the running app...
taskkill /F /T /IM "Yun Fook POS.exe" >nul 2>nul

echo Installing %INSTALLER% ...
"%INSTALLER%" /S
if errorlevel 1 (
  echo ERROR: installer failed.
  exit /b 1
)

if /I "%~1"=="/reboot" (
  echo UPDATE COMPLETE - rebooting into the kiosk...
  shutdown /r /t 5
  exit /b 0
)

echo UPDATE COMPLETE - starting the app...
start "" "C:\Program Files\Yun Fook POS\Yun Fook POS.exe"
exit /b 0
