<#
.SYNOPSIS
Runs the Report Tool application.
#>

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host " Report Tool - Startup" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan

# 1. Set working directory to script location
Set-Location $PSScriptRoot

# 2. Check Python
if (-not (Get-Command "python" -ErrorAction SilentlyContinue)) {
    Write-Host "Error: Python is not installed. Please install Python 3.10+ and add it to your PATH." -ForegroundColor Red
    exit 1
}

# 3. Setup Python Virtual Environment
Write-Host "Setting up Python Virtual Environment..." -ForegroundColor Yellow
if (-not (Test-Path "backend\venv")) {
    python -m venv backend\venv
}

# 4. Install backend requirements
Write-Host "Installing backend dependencies..." -ForegroundColor Yellow
& "backend\venv\Scripts\python.exe" -m pip install -r backend\requirements.txt

# 4b. Build frontend if dist is missing and npm is available
if (-not (Test-Path "frontend\dist\index.html") -and (Get-Command "npm" -ErrorAction SilentlyContinue)) {
    Write-Host "Building frontend assets..." -ForegroundColor Yellow
    Push-Location "frontend"
    try {
        npm install
        npm run build
    } finally {
        Pop-Location
    }
}

# 5. Free port 8392 if an older Report Tool server is still running in the background
$existingConn = Get-NetTCPConnection -LocalPort 8392 -State Listen -ErrorAction SilentlyContinue
if ($existingConn) {
    Write-Host "Stopping previous server instance on port 8392..." -ForegroundColor Yellow
    foreach ($procId in ($existingConn.OwningProcess | Select-Object -Unique)) {
        if ($procId -gt 0) {
            Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
        }
    }
    Start-Sleep -Milliseconds 500
}

# 6. Start the server
Write-Host "Starting the server at http://localhost:8392" -ForegroundColor Green
Write-Host "Keep this window open while using the tool." -ForegroundColor Gray

# Local GitHub/script runs must never use EXE activation logic.
$env:REPORT_TOOL_LOCAL_DEV = "1"

# Run Uvicorn
& "backend\venv\Scripts\python.exe" backend\main.py


Read-Host 'Press Enter to continue...'
