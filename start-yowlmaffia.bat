@echo off
setlocal

cd /d "%~dp0"
set "APP_EXE=%~dp0release\win-unpacked\YOWLMAFFIA.exe"
set "INSTALLER_EXE=%~dp0release\YOWLMAFFIA.exe"

if exist "%APP_EXE%" (
  start "" "%APP_EXE%"
  exit /b 0
)

if exist "%INSTALLER_EXE%" (
  start "" "%INSTALLER_EXE%"
  exit /b 0
)

echo YOWLMAFFIA is nog niet gebouwd.
echo Run eerst: npm run build
pause
exit /b 1

endlocal
