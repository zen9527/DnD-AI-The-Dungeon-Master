@echo off
REM ============================================
REM DnD Full Auto-DM - Unified Control Script
REM Usage: dnd.bat <command>
REM   Commands: start | stop | restart | status
REM ============================================

set PORT=3000
set SCRIPT_DIR=%~dp0

if "%~1"=="" goto :usage
if /i "%~1"=="start"   goto :cmd_start
if /i "%~1"=="stop"    goto :cmd_stop
if /i "%~1"=="restart" goto :cmd_restart
if /i "%~1"=="status"  goto :cmd_status

echo ERROR: Unknown command '%~1'
echo.
goto :usage

:usage
echo ============================================
echo DnD Full Auto-DM - Server Control
echo ============================================
echo.
echo Usage: dnd.bat ^<command^>
echo.
echo   Commands:
echo     start     Build and start the server
echo     stop      Stop the running server
echo     restart   Stop and start the server
echo     status    Check if server is running
echo.
echo   Aliases:
echo     start.bat  -^> dnd.bat start
echo     stop.bat   -^> dnd.bat stop
echo.
exit /b 1

:cmd_start
echo ============================================
echo DnD Full Auto-DM - Start
echo ============================================
echo.

REM Check if .env exists
if not exist "%SCRIPT_DIR%.env" (
    echo ERROR: .env file not found!
    echo Please copy .env.example to .env and configure your LLM API.
    echo.
    pause
    exit /b 1
)

REM Check if port is already in use
set ALREADY_RUNNING=0
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :%PORT% ^| findstr LISTENING') do (
    set ALREADY_RUNNING=1
)
if "%ALREADY_RUNNING%"=="1" (
    echo WARNING: Port %PORT% is already in use.
    echo Use "dnd.bat stop" first, or specify a different port.
    echo.
    pause
    exit /b 1
)

echo Building backend...
call npm run build:backend
if %errorlevel% neq 0 (
    echo ERROR: Backend build failed!
    echo.
    pause
    exit /b 1
)

echo Building frontend...
call npm run build:frontend
if %errorlevel% neq 0 (
    echo ERROR: Frontend build failed!
    echo.
    pause
    exit /b 1
)

echo.
echo ============================================
echo Server starting on http://localhost:%PORT%
echo Press Ctrl+C to stop
echo ============================================
echo.

REM Start server (blocking - Ctrl+C stops it)
call node dist/src/server.js
exit /b %errorlevel%

:cmd_stop
echo ============================================
echo DnD Full Auto-DM - Stop
echo ============================================
echo.

set PID=
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :%PORT% ^| findstr LISTENING') do (
    set PID=%%a
)

if "%PID%"=="" (
    echo No server running on port %PORT%.
    echo.
    exit /b 0
)

echo Found server process: PID %PID%
echo Stopping...
echo.

taskkill /F /PID %PID%
if %errorlevel% equ 0 (
    echo Server stopped successfully.
    echo.
) else (
    echo ERROR: Failed to stop server.
    echo Try running as Administrator.
    echo.
    exit /b 1
)
exit /b 0

:cmd_restart
echo ============================================
echo DnD Full Auto-DM - Restart
echo ============================================
echo.

call :cmd_stop
if %errorlevel% neq 0 (
    echo Restart failed (stop returned error).
    exit /b 1
)

echo.
call :cmd_start
exit /b %errorlevel%

:cmd_status
echo ============================================
echo DnD Full Auto-DM - Status
echo ============================================
echo.

set PID=
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :%PORT% ^| findstr LISTENING') do (
    set PID=%%a
)

if "%PID%"=="" (
    echo Server is NOT running on port %PORT%.
    echo.
    echo Use "dnd.bat start" to start the server.
    exit /b 1
)

echo Server is RUNNING on port %PORT%
echo Process PID: %PID%
echo.
echo Use "dnd.bat stop" to stop the server.
exit /b 0
