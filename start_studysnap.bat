@echo off
title StudySnap AI - Launcher
echo ===================================================
echo            Welcome to StudySnap AI!
echo   High-Yield Exam & Quiz Reviewer Generator
echo ===================================================
echo.

set "PATH=%LOCALAPPDATA%\Programs\nodejs;%PATH%"
cd /d "%~dp0"
if not exist ".venv\Scripts\python.exe" (
    python -m venv .venv
    if errorlevel 1 goto setup_failed
)
".venv\Scripts\python.exe" -c "import flask, flask_cors, dotenv, reportlab, pypdf, pptx, PIL; from google import genai" >nul 2>&1
if errorlevel 1 (
    echo Installing missing backend dependencies...
    ".venv\Scripts\python.exe" -m pip install -r backend\requirements.txt
    if errorlevel 1 goto setup_failed
)

echo [1/2] Starting Python Flask Backend on port 5001...
start "StudySnap AI - Backend API" /d "%~dp0backend" cmd /k ""%~dp0.venv\Scripts\python.exe" app.py"

powershell -NoProfile -Command "$ready = $false; for ($attempt = 0; $attempt -lt 20; $attempt++) { try { $health = Invoke-RestMethod 'http://localhost:5001/api/health' -TimeoutSec 2; if ($health.app -eq 'StudySnap AI Backend') { $ready = $true; break } } catch {}; Start-Sleep -Seconds 1 }; if (-not $ready) { exit 1 }"
if errorlevel 1 goto backend_failed

echo [2/2] Starting React + Vite Frontend on port 5173...
start "StudySnap AI - Frontend" /d "%~dp0frontend" cmd /k "npm run dev"

echo.
echo Both servers are launching!
echo App will be accessible at: http://localhost:5173
echo.
timeout /t 3 /nobreak >nul
start http://localhost:5173
pause
exit /b 0

:setup_failed
echo Backend setup failed. Check Python installation and the dependency errors above.
pause
exit /b 1

:backend_failed
echo Backend did not become healthy on port 5001. Check the Backend API window for the error.
pause
exit /b 1

