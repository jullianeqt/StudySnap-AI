@echo off
setlocal
title StudySnap AI - Launcher
set "ROOT=%~dp0"
echo ===================================================
echo            Welcome to StudySnap AI!
echo   High-Yield Exam ^& Quiz Reviewer Generator
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

where npm >nul 2>&1
if errorlevel 1 (
    echo npm was not found. Install Node.js first.
    pause
    exit /b 1
)

if not exist "%~dp0frontend\node_modules" (
    echo Installing frontend dependencies...
    pushd "%~dp0frontend"
    call npm install
    if errorlevel 1 (
        popd
        echo Frontend dependency installation failed.
        pause
        exit /b 1
    )
    popd
)

echo [1/2] Starting Python Flask Backend on port 5001...
start "StudySnap AI - Backend API" /d "%~dp0backend" cmd /k ""%~dp0.venv\Scripts\python.exe" app.py"

powershell -NoProfile -Command "$ready = $false; for ($attempt = 0; $attempt -lt 20; $attempt++) { try { $health = Invoke-RestMethod 'http://localhost:5001/api/health' -TimeoutSec 2; if ($health.app -eq 'StudySnap AI Backend') { $ready = $true; break } } catch {}; Start-Sleep -Seconds 1 }; if (-not $ready) { exit 1 }"
if errorlevel 1 goto backend_failed

echo [2/2] Starting React + Vite Frontend on port 5173...
start "StudySnap AI - Frontend" /d "%~dp0frontend" cmd /k "npm run dev"

echo.
echo Waiting for the frontend to become available...
for /l %%A in (1,1,20) do (
	powershell -NoProfile -Command "try { Invoke-WebRequest -UseBasicParsing -TimeoutSec 1 http://localhost:5173/ ^| Out-Null; exit 0 } catch { exit 1 }" >nul 2>&1
	if not errorlevel 1 goto frontend_ready
	timeout /t 1 /nobreak >nul
)
echo The frontend did not start within 20 seconds. Check the frontend window for errors.
pause
exit /b 1

:frontend_ready
echo StudySnap is ready at: http://localhost:5173
echo.
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

