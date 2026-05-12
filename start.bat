@echo off
echo ==========================================
echo   HOSTEL MANAGER v10 - Starting...
echo ==========================================
echo.
echo [1/3] Installing server dependencies...
cd server && npm install && cd ..
echo.
echo [2/3] Installing client dependencies...
cd client && npm install && cd ..
echo.
echo [3/3] Starting servers...
echo   Backend:  http://localhost:5000
echo   Frontend: http://localhost:3000
echo.
echo Make sure MongoDB is running!
echo.
start cmd /k "cd server && npm start"
timeout /t 3 /nobreak > nul
start cmd /k "cd client && npm start"
