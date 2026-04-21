@echo off
REM ============================================
REM DnD Full Auto-DM - Start Script
REM ============================================

echo ============================================
echo DnD Full Auto-DM Server
echo ============================================
echo.

REM Check if .env exists
if not exist ".env" (
    echo WARNING: .env file not found!
    echo Please copy .env.example to .env and configure your LLM API.
    echo.
    pause
    exit /b 1
)

echo Starting server...
echo.

REM Build first
echo Building backend...
call npm run build:backend
if %errorlevel% neq 0 (
    echo ERROR: Backend build failed!
    pause
    exit /b 1
)

echo Building frontend...
call npm run build:frontend
if %errorlevel% neq 0 (
    echo ERROR: Frontend build failed!
    pause
    exit /b 1
)

echo.
echo Starting production server...
echo Press Ctrl+C to stop
echo.

REM Start server
call npm start
