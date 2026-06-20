Write-Host "Installing Report Tool..." -ForegroundColor Cyan

# Ensure git is available
if (!(Get-Command "git" -ErrorAction SilentlyContinue)) {
    Write-Host "Error: Git is not installed." -ForegroundColor Red
    exit 1
}

$repoDir = Join-Path $PWD "Report-Tool"

if (!(Test-Path $repoDir)) {
    if (!$token) {
        Write-Host "Please paste your GitHub Personal Access Token (the same one starting with ghp_) to clone the private repository:" -ForegroundColor Yellow
        $token = Read-Host "Token"
    }
    
    Write-Host "Cloning repository..."
    git clone "https://${token}@github.com/JoshiAO/Report-Tool.git"
    
    if (!(Test-Path $repoDir)) {
        Write-Host "Failed to clone repository. Check your token." -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "Updating existing repository..."
    cd $repoDir
    git pull
    cd ..
}

cd $repoDir

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
cd backend
if (!(Test-Path "venv")) {
    Write-Host "Creating Virtual Environment..."
    python -m venv venv
}
.\venv\Scripts\Activate.ps1
Write-Host "Installing Python requirements..."
pip install -r requirements.txt
cd ..

# Frontend Setup
Write-Host "`nSetting up Node.js Frontend..." -ForegroundColor Yellow
cd frontend
Write-Host "Installing NPM packages..."
npm install
Write-Host "Building React app..."
npm run build
cd ..

Write-Host "`nInstallation Complete! Launching Report Tool..." -ForegroundColor Green
cd $repoDir
.\run_tool.ps1
