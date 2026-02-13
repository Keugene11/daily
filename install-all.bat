@echo off
echo ========================================
echo Installing All Dependencies
echo ========================================
echo.

REM Add Node.js to PATH for this session
set PATH=%PATH%;C:\Program Files\nodejs

echo Checking Node.js installation...
node --version
npm --version
echo.

echo [1/2] Installing backend dependencies...
cd backend
call npm install
if errorlevel 1 (
    echo ERROR: Backend installation failed
    pause
    exit /b 1
)
echo.

echo [2/2] Installing frontend dependencies...
cd ..\frontend
call npm install
if errorlevel 1 (
    echo ERROR: Frontend installation failed
    pause
    exit /b 1
)
echo.

cd ..

echo ========================================
echo ✓ All dependencies installed!
echo ========================================
echo.
echo To start the app, run: npm run dev
echo.
pause
