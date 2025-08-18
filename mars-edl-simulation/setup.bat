@echo off
echo ========================================
echo   Mars EDL Simulation - Setup Script
echo ========================================
echo.

REM Check for Node.js
echo Checking for Node.js installation...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed!
    echo Please install Node.js from https://nodejs.org/
    echo Minimum required version: 18.0.0
    pause
    exit /b 1
)

echo Node.js found: 
node --version
echo.

REM Check for npm
echo Checking for npm...
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] npm is not installed!
    echo Please install npm or reinstall Node.js
    pause
    exit /b 1
)

echo npm found: 
npm --version
echo.

REM Create necessary directories
echo Creating project directories...
if not exist "logs" mkdir logs
if not exist "uploads" mkdir uploads
if not exist "client\assets\data" mkdir client\assets\data
if not exist "client\assets\models" mkdir client\assets\models
if not exist "client\assets\textures" mkdir client\assets\textures
echo Directories created successfully!
echo.

REM Install dependencies
echo Installing project dependencies...
echo This may take a few minutes...
call npm install

if %errorlevel% neq 0 (
    echo [ERROR] Failed to install dependencies!
    echo Please check your internet connection and try again
    pause
    exit /b 1
)

echo.
echo ========================================
echo   Verifying installation...
echo ========================================
echo.

REM Check for critical dependencies
echo Checking Three.js...
if not exist "node_modules\three" (
    echo [WARNING] Three.js not found, installing...
    call npm install three
)

echo Checking Express...
if not exist "node_modules\express" (
    echo [WARNING] Express not found, installing...
    call npm install express
)

echo Checking CORS...
if not exist "node_modules\cors" (
    echo [WARNING] CORS not found, installing...
    call npm install cors
)

echo.
echo ========================================
echo   Checking data files...
echo ========================================
echo.

REM Check for critical data files
if not exist "client\assets\data\MSL_position_J2000.csv" (
    echo [WARNING] MSL trajectory data not found!
    echo Please ensure MSL_position_J2000.csv is in client\assets\data\
)

if not exist "client\assets\textures\starfield.png" (
    echo [WARNING] Starfield texture not found!
    echo Please ensure texture files are in client\assets\textures\
)

echo.
echo ========================================
echo   Setup Complete!
echo ========================================
echo.
echo To start the application, run:
echo   start.bat
echo.
echo Or manually start with:
echo   npm start
echo.
echo The application will be available at:
echo   http://localhost:3001
echo.
echo ========================================
echo.
pause