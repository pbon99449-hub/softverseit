@echo off
title SoftVerse IT - Server (ei window ta bondho korben na)
cd /d "%~dp0admin-panel"

echo.
echo  ============================================
echo   SoftVerse IT Server shuru hocche...
echo   Website:      http://localhost:5000
echo   Admin Panel:  http://localhost:5000/admin
echo.
echo   EI WINDOW TA BONDHO KORBEN NA!
echo   (bondho korle website kaj korbe na)
echo  ============================================
echo.

rem ── Node.js installed? ──
where node >nul 2>nul
if errorlevel 1 (
  echo  [ERROR] Node.js paoa jay nai!
  echo  https://nodejs.org theke Node.js install korun, tarpor abar try korun.
  pause
  exit /b 1
)

rem ── Dependencies installed? (prothom bar chalale npm install hobe) ──
if not exist "node_modules" (
  echo  Prothom bar chalu hocche — dependencies install hocche (ektu somoy lagbe)...
  call npm install
  if errorlevel 1 (
    echo  [ERROR] npm install fail korlo. Internet connection check korun.
    pause
    exit /b 1
  )
)

rem ── Server already running on port 5000? → NOTUN CODE load korte restart ──
netstat -ano | findstr ":5000 " | findstr "LISTENING" >nul 2>nul
if not errorlevel 1 (
  echo Ager server paoa geche. Notun code load korate server restart hocche...
  for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5000 " ^| findstr "LISTENING"') do taskkill /F /PID %%a >nul 2>&1
  timeout /t 2 >nul
)

node server.js

echo.
echo  Server bondho hoye geche! Abir a shuru korte
echo  ei file abar double click korun.
pause