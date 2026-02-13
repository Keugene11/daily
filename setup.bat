@echo off
echo ========================================
echo Installing What Should I Do Today? App
echo ========================================
echo.

echo [1/3] Installing root dependencies...
call npm install
if errorlevel 1 (
    echo ERROR: Failed to install root dependencies
    echo Make sure Node.js is installed: https://nodejs.org
    pause
    exit /b 1
)

echo.
echo [2/3] Installing backend dependencies...
cd backend
call npm install
if errorlevel 1 (
    echo ERROR: Failed to install backend dependencies
    cd ..
    pause
    exit /b 1
)

echo.
echo [3/3] Installing frontend dependencies...
cd ..\frontend
call npm install
if errorlevel 1 (
    echo ERROR: Failed to install frontend dependencies
    cd ..
    pause
    exit /b 1
)

cd ..

echo.
echo ========================================
echo ✓ Installation complete!
echo ========================================
echo.
echo Next steps:
echo 1. Configure your API keys in backend\.env
echo 2. Run 'npm run dev' to start both servers
echo 3. Open http://localhost:5173 in your browser
echo.
pause
