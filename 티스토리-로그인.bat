@echo off
chcp 65001 >nul
cd /d "C:\Users\NT960XGK\ai-monetization-pipeline"
echo 티스토리 자동화 로그인 창을 엽니다...
node openLogin.js
echo.
echo 로그인이 끝나면 이 창은 닫으셔도 됩니다.
pause
