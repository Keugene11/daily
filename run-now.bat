@echo off
set PATH=%PATH%;C:\Program Files\nodejs

echo Killing old servers...
FOR /F "tokens=5" %%P IN ('netstat -ano ^| findstr :8080 ^| findstr LISTENING') DO taskkill /F /PID %%P 2>nul
FOR /F "tokens=5" %%P IN ('netstat -ano ^| findstr :8081 ^| findstr LISTENING') DO taskkill /F /PID %%P 2>nul
timeout /t 2 /nobreak > nul

echo Starting backend on port 8080...
start "BACKEND" /D "%~dp0backend" cmd /k "set PATH=%PATH%;C:\Program Files\nodejs && npm run dev"
timeout /t 5 /nobreak > nul

echo Starting frontend on port 8081...
start "FRONTEND" /D "%~dp0frontend" cmd /k "set PATH=%PATH%;C:\Program Files\nodejs && npm run dev"

echo.
echo ========================================
echo Servers starting! Open http://localhost:8081
echo ========================================
pause
