@echo off
REM ============================================================
REM  SoftVerse IT Admin Panel - One-time Setup (Run as Admin)
REM  করো: File-এ right-click -> Run as administrator
REM  এটি করবে:
REM    1) pm2 দিয়ে Node server চালু + permanent save
REM    2) (ঐচ্ছিক) প্রথম admin সিড করবে
REM ============================================================
setlocal

echo.
echo ============================================
echo  SoftVerse IT - Setup Script (Admin)
echo ============================================
echo.

REM --- 0) Working dir = admin-panel ---
cd /d "%~dp0"
if exist server.js goto :okdir
cd /d "C:\Users\SILICON TECH\Downloads\softverse-It-main\softverse-It-main\admin-panel"
:okdir

echo [1/2] pm2 দিয়ে server চালানো হচ্ছে (permanent)...
call pm2 delete softverse-it >nul 2>&1
call pm2 start server.js --name softverse-it
call pm2 save

echo.
echo [2/2] প্রথম admin account (if none) সিড হচ্ছে...
call npm run seed

echo.
echo ============================================
echo  সম্পন্ন! ওয়েবসাইট: http://localhost:5000
echo  Admin Login : http://localhost:5000/admin/login.html
echo ============================================
echo  দ্রষ্টব্য: Windows boot-এ auto-start করতে
echo  "pm2 startup" এর নির্দেশনা অনুসরণ করুন (Admin).
echo ============================================
pause
endlocal
