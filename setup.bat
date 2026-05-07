@echo off
REM ============================================================
REM  Hypersonic Flight Simulator — one-click installer + launcher
REM  Windows version (batch file)
REM
REM  This script is the single entry point for non-technical users.
REM  Double-click it (or run from cmd / PowerShell) and it will:
REM    1. Verify Node.js is installed (gives download link if not).
REM    2. Verify Python 3.12+ is installed (gives download link if not).
REM    3. Run setup.js  -> installs npm + Python deps.
REM    4. Run start.js  -> launches both servers and opens browser.
REM ============================================================

setlocal enabledelayedexpansion
cd /d "%~dp0"

echo.
echo ============================================================
echo  Hypersonic Flight Simulator
echo ============================================================
echo.

REM --- Check Node.js ---
where node >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Node.js is not installed or not on PATH.
    echo.
    echo   Please install the LTS version from:
    echo     https://nodejs.org/
    echo.
    echo   After installing, close this window and double-click
    echo   setup.bat again.
    echo.
    pause
    exit /b 1
)

REM --- Check Python (try py launcher first, then python) ---
set "PYTHON_OK="
where py >nul 2>nul
if not errorlevel 1 (
    py -3 -c "import sys; sys.exit(0 if sys.version_info >= (3, 12) else 1)" >nul 2>nul
    if not errorlevel 1 set "PYTHON_OK=1"
)
if not defined PYTHON_OK (
    where python >nul 2>nul
    if not errorlevel 1 (
        python -c "import sys; sys.exit(0 if sys.version_info >= (3, 12) else 1)" >nul 2>nul
        if not errorlevel 1 set "PYTHON_OK=1"
    )
)
if not defined PYTHON_OK (
    echo [ERROR] Python 3.12 or newer is required but was not found.
    echo.
    echo   Please install Python from:
    echo     https://www.python.org/downloads/
    echo.
    echo   IMPORTANT: Tick "Add Python to PATH" on the first install
    echo   screen, otherwise this script will not detect it.
    echo.
    echo   After installing, close this window and double-click
    echo   setup.bat again.
    echo.
    pause
    exit /b 1
)

REM --- Run the cross-platform Node setup script ---
echo Running setup ...
node setup.js
if errorlevel 1 (
    echo.
    echo [ERROR] Setup failed. See messages above.
    pause
    exit /b 1
)

REM --- Launch the simulator ---
echo.
echo Starting servers and opening the simulator in your browser ...
echo (Close this window or press Ctrl+C to stop the simulator.)
echo.
node start.js

endlocal
