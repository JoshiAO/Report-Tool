<#
.SYNOPSIS
Installs and runs the Report Tool application.
#>

$repoUrl = "https://github.com/YourUsername/Report-Tool/archive/refs/heads/main.zip"
$extractPath = "$env:USERPROFILE\Desktop\Report-Tool"

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host " Report Tool - Installation & Startup" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan

# 1. Check Python
if (-not (Get-Command "python" -ErrorAction SilentlyContinue)) {
    Write-Host "Error: Python is not installed. Please install Python 3.10+ and add it to your PATH." -ForegroundColor Red
    exit 1
}

# 2. Download and Extract (Simulated for this local version, normally it downloads ZIP)
# Note: For the actual GitHub version, uncomment the lines below:
# Write-Host "Downloading latest version..."
# Invoke-WebRequest -Uri $repoUrl -OutFile "$env:TEMP\report-tool.zip"
# Expand-Archive -Path "$env:TEMP\report-tool.zip" -DestinationPath "$env:USERPROFILE\Desktop" -Force
# Move-Item "$env:USERPROFILE\Desktop\Report-Tool-main" $extractPath -Force

# For this local generation, we use the current script's path
$extractPath = $PSScriptRoot
Set-Location $extractPath

# 3. Setup Python Virtual Environment
Write-Host "Setting up Python Virtual Environment..." -ForegroundColor Yellow
if (-not (Test-Path "backend\venv")) {
    python -m venv backend\venv
}

# 4. Install backend requirements
Write-Host "Installing backend dependencies..." -ForegroundColor Yellow
& "backend\venv\Scripts\python.exe" -m pip install -r backend\requirements.txt

# 5. Start the server
Write-Host "Starting the server at http://localhost:8000" -ForegroundColor Green
Write-Host "Keep this window open while using the tool." -ForegroundColor Gray

# Run Uvicorn
& "backend\venv\Scripts\python.exe" backend\main.py


Read-Host 'Press Enter to continue...'
