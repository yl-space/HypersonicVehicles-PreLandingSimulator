@echo off
echo ========================================
echo   Mars EDL Simulation - Launcher
echo ========================================
echo.

REM Check if node_modules exists
if not exist "node_modules" (
    echo [WARNING] Dependencies not installed!
    echo Running setup first...
    echo.
    call setup.bat
    if %errorlevel% neq 0 (
        echo [ERROR] Setup failed!
        pause
        exit /b 1
    )
)

REM Check if port 3001 is already in use
netstat -ano | findstr :3001 >nul 2>&1
if %errorlevel% equ 0 (
    echo [INFO] Port 3001 is already in use
    echo.
    choice /C YN /M "Do you want to open the existing instance in browser"
    if errorlevel 2 goto END
    if errorlevel 1 goto OPEN_BROWSER
) else (
    goto START_SERVER
)

:START_SERVER
echo Starting Mars EDL Simulation Server...
echo.
echo Server will run on: http://localhost:3001
echo.

REM Start the server in background
start /B cmd /c "npm start 2>logs\error.log"

echo Waiting for server to start...
timeout /t 3 /nobreak >nul

REM Check if server started successfully
netstat -ano | findstr :3001 >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Failed to start server!
    echo Check logs\error.log for details
    pause
    exit /b 1
)

:OPEN_BROWSER
echo.
echo Opening browser...
timeout /t 2 /nobreak >nul
start http://localhost:3001

echo.
echo ========================================
echo   Mars EDL Simulation is running!
echo ========================================
echo.
echo Server: http://localhost:3001
echo.
echo Controls:
echo   Space     - Play/Pause
echo   1-4       - Camera modes
echo   Arrow keys - Navigate/Zoom
echo   R         - Restart
echo.
echo To stop the server, close this window or press Ctrl+C
echo ========================================
echo.

REM Keep the window open and monitor the server
:MONITOR
timeout /t 5 /nobreak >nul
netstat -ano | findstr :3001 >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo [WARNING] Server stopped unexpectedly!
    pause
    exit /b 1
)
goto MONITOR

:END
exit /b 0