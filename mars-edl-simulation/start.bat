@echo off
echo Starting HSV Simulation...
echo.

echo Installing dependencies...
npm install

echo.
echo Starting development servers...
echo Server will run on http://localhost:3001
echo Client will run on http://localhost:3000
echo.

start cmd /k "npm run server"
timeout /t 3
start cmd /k "npm run client"

echo.
echo Opening browser...
timeout /t 5
start http://localhost:3000

echo.
echo Mars 2020 EDL Simulation is starting up!
echo Press any key to exit this launcher...
pause > nul