@echo off
setlocal EnableExtensions
cd /d "%~dp0"
set "PATH=%PATH%;%ProgramFiles%\nodejs;%LOCALAPPDATA%\Microsoft\WinGet\Links"
call :ensure node OpenJS.NodeJS.LTS
if errorlevel 1 goto failed
call :ensure mkcert FiloSottile.mkcert
if errorlevel 1 goto failed
call :ensure obs OBSProject.OBSStudio
if errorlevel 1 goto failed
node setup.js
if errorlevel 1 goto failed
exit /b 0

:ensure
call :check_%1
if not errorlevel 1 (
  echo [Ready] %1
  exit /b 0
)
echo [Needs installation or update] %1
where winget.exe >nul 2>nul
if errorlevel 1 (
  echo Install Windows App Installer or install %2 manually and run setup again.
  exit /b 1
)
winget install --id %2 --exact
call :check_%1
if errorlevel 1 (
  echo [Failed] %1 is unavailable or incompatible. Check the installer output and PATH, then run setup again.
  exit /b 1
)
echo [Verified] %1
exit /b 0

:check_node
node -e "process.exit(Number(process.versions.node.split('.')[0]) >= 18 ? 0 : 1)" >nul 2>nul
exit /b %errorlevel%

:check_mkcert
mkcert -version >nul 2>nul
exit /b %errorlevel%

:check_obs
where obs64.exe >nul 2>nul && exit /b 0
if exist "%ProgramFiles%\obs-studio\bin\64bit\obs64.exe" exit /b 0
if exist "%LOCALAPPDATA%\Programs\obs-studio\bin\64bit\obs64.exe" exit /b 0
for /f "tokens=2,*" %%A in ('reg query "HKLM\SOFTWARE\OBS Studio" /ve 2^>nul') do if exist "%%B\bin\64bit\obs64.exe" exit /b 0
exit /b 1

:failed
echo Setup stopped. Review the message above.
pause
exit /b 1
