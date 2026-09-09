@echo off
chcp 65001 >nul
title SoftVerse IT - Content Push (GitHub)
echo ==============================================
echo  SoftVerse IT - saved content GitHub-e push
echo ==============================================
echo.
cd /d "%~dp0"

git add -A
git commit -m "content-vault update: home page content + gallery + latest changes"
git push

echo.
echo ==============================================
echo  Done! Content GitHub-e push hoyeche.
echo  Ebar Render-e redeploy korlei notun content
echo  sobai dekhte parbe (permanent).
echo ==============================================
pause