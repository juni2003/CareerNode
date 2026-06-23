@echo off
title CareerNode
color 0A
echo.
echo  =====================================
echo   CareerNode — Starting Services...
echo  =====================================
echo.

:: Start MongoDB
echo [1/3] Starting MongoDB...
start "MongoDB" "C:\Program Files\MongoDB\Server\8.0\bin\mongod.exe" --dbpath "%USERPROFILE%\data\db" --quiet
timeout /t 2 /nobreak >nul

:: Start Python Backend
echo [2/3] Starting FastAPI Backend...
cd /d "%~dp0backend"
call venv\Scripts\activate.bat
start "CareerNode Backend" cmd /k "uvicorn main:app --host 0.0.0.0 --port 8000 --reload"
timeout /t 3 /nobreak >nul

:: Start Next.js Frontend
echo [3/3] Starting Next.js Frontend...
cd /d "%~dp0frontend"
start "CareerNode Frontend" cmd /k "npm run dev"
timeout /t 5 /nobreak >nul

:: Open browser
echo.
echo  =====================================
echo   CareerNode is running!
echo   Frontend: http://localhost:3000
echo   API Docs: http://localhost:8000/docs
echo  =====================================
echo.
start http://localhost:3000
pause
