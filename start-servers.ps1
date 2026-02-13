# Start "What Should I Do Today?" App
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Starting 'What Should I Do Today?' App" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Backend Port: 8080" -ForegroundColor Yellow
Write-Host "Frontend Port: 8081" -ForegroundColor Yellow
Write-Host ""

# Start Backend
Write-Host "[1/2] Starting Backend Server..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\backend'; npm run dev"

# Wait a bit
Start-Sleep -Seconds 3

# Start Frontend
Write-Host "[2/2] Starting Frontend Server..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\frontend'; npm run dev"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "✓ Both servers are starting!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Two PowerShell windows should open:" -ForegroundColor White
Write-Host "  - Backend:  http://localhost:8080" -ForegroundColor White
Write-Host "  - Frontend: http://localhost:8081" -ForegroundColor White
Write-Host ""
Write-Host "Wait ~10 seconds, then open your browser to:" -ForegroundColor Yellow
Write-Host ""
Write-Host "    http://localhost:8081" -ForegroundColor Cyan -BackgroundColor Black
Write-Host ""
Write-Host "Press any key to exit..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
