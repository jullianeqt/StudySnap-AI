@echo off
title StudySnap AI - Launcher
echo ===================================================
echo            Welcome to StudySnap AI!
echo   High-Yield Exam & Quiz Reviewer Generator
echo ===================================================
echo.

set PATH=%LOCALAPPDATA%\Programs\nodejs;C:\Users\ASUS\AppData\Local\Python\pythoncore-3.14-64;C:\Users\ASUS\AppData\Local\Python\pythoncore-3.14-64\Scripts;%PATH%

echo [1/2] Starting Python Flask Backend on port 5001...
start "StudySnap AI - Backend API" cmd /k "cd /d %~dp0backend && python app.py"

timeout /t 2 /nobreak >nul

echo [2/2] Starting React + Vite Frontend on port 5173...
start "StudySnap AI - Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo Both servers are launching!
echo App will be accessible at: http://localhost:5173
echo.
timeout /t 3 /nobreak >nul
start http://localhost:5173
pause

