@echo off
REM ============================================
REM DnD Full Auto-DM - Stop Script
REM ============================================

echo ============================================
echo DnD Full Auto-DM Server
echo ============================================
echo.

REM Find process using port 3000
echo Checking for running server...
echo.

set PORT=3000
set PID=

for /f "tokens=5" %%a in ('netstat -ano ^| findstr :%PORT% ^| findstr LISTENING') do (
    set PID=%%a
)

if "%PID%"=="" (
    echo No server running on port %PORT%.
    echo.
    pause
    exit /b 0
)

echo Found server process: PID %PID%
echo Stopping...
echo.

taskkill /F /PID %PID%
if %errorlevel% equ 0 (
    echo Server stopped successfully.
) else (
    echo ERROR: Failed to stop server.
    echo Try running as Administrator.
)

echo.
pause
