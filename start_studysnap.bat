@echo off
setlocal
title StudySnap AI - Launcher
set "ROOT=%~dp0"
echo ===================================================
echo            Welcome to StudySnap AI!
echo   High-Yield Exam ^& Quiz Reviewer Generator
echo ===================================================
echo.

set "PYTHON_CMD=%ROOT%.venv\Scripts\python.exe"
if not exist "%PYTHON_CMD%" (
	set "PYTHON_CMD=python"
	where python >nul 2>&1
	if errorlevel 1 (
		echo Python was not found. Install Python or create the project .venv first.
		pause
		exit /b 1
	)
)

where npm >nul 2>&1
if errorlevel 1 (
	echo npm was not found. Install Node.js first.
	pause
	exit /b 1
)

if not exist "%ROOT%frontend\node_modules" (
	echo Installing frontend dependencies...
	pushd "%ROOT%frontend"
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
start "StudySnap AI - Backend API" /D "%ROOT%backend" cmd /k ""%PYTHON_CMD%" app.py"

timeout /t 1 /nobreak >nul

echo [2/2] Starting React + Vite Frontend on port 5173...
start "StudySnap AI - Frontend" /D "%ROOT%frontend" cmd /k "npm run dev -- --host localhost"

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

