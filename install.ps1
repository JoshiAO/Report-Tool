Write-Host "Installing Report Tool..." -ForegroundColor Cyan

# Check Python
if (!(Get-Command "python" -ErrorAction SilentlyContinue)) {
    Write-Host "Error: Python is not installed or not in PATH." -ForegroundColor Red
    exit 1
}

# Check NPM
if (!(Get-Command "npm" -ErrorAction SilentlyContinue)) {
    Write-Host "Error: Node.js (npm) is not installed or not in PATH." -ForegroundColor Red
    exit 1
}

# Backend Setup
Write-Host "`nSetting up Python Backend..." -ForegroundColor Yellow
cd "$PSScriptRoot\backend"
if (!(Test-Path "venv")) {
    Write-Host "Creating Virtual Environment..."
    python -m venv venv
}
.\venv\Scripts\Activate.ps1
Write-Host "Installing Python requirements..."
pip install -r requirements.txt
cd "$PSScriptRoot"

# Frontend Setup
Write-Host "`nSetting up Node.js Frontend..." -ForegroundColor Yellow
cd "$PSScriptRoot\frontend"
Write-Host "Installing NPM packages..."
npm install
Write-Host "Building React app..."
npm run build
cd "$PSScriptRoot"

Write-Host "`nInstallation Complete!" -ForegroundColor Green
Write-Host "Run .\run_tool.ps1 to start the tool." -ForegroundColor Cyan
