@echo off
echo ========================================
echo Starting "What Should I Do Today?" App
echo ========================================
echo.
echo Using ports: 8080 (backend) and 8081 (frontend)
echo.

REM Add Node.js to PATH
set PATH=%PATH%;C:\Program Files\nodejs

echo [1/2] Starting Backend Server on port 8080...
start "Backend Server (8080)" cmd /k "cd /d %~dp0backend && npm run dev"

timeout /t 3 /nobreak > nul

echo [2/2] Starting Frontend Server on port 8081...
start "Frontend Server (8081)" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo ========================================
echo ✓ Both servers are starting!
echo ========================================
echo.
echo Backend:  http://localhost:8080
echo Frontend: http://localhost:8081
echo.
echo Wait ~10 seconds, then open your browser to:
echo.
echo    http://localhost:8081
echo.
echo (Two new terminal windows should open)
echo.
pause
