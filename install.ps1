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
    Push-Location $repoDir
    try {
        git pull
    } finally {
        Pop-Location
    }
}

Push-Location $repoDir

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
Push-Location backend
try {
    if (!(Test-Path "venv")) {
        Write-Host "Creating Virtual Environment..."
        python -m venv venv
    }
    .\venv\Scripts\Activate.ps1
    Write-Host "Installing Python requirements..."
    pip install -r requirements.txt
} finally {
    Pop-Location
}

# Frontend Setup
Write-Host "`nSetting up Node.js Frontend..." -ForegroundColor Yellow
Push-Location frontend
try {
    Write-Host "Installing NPM packages..."
    npm install
    Write-Host "Building React app..."
    npm run build
} finally {
    Pop-Location
}

Write-Host "`nInstallation Complete! Launching Report Tool..." -ForegroundColor Green
if (Test-Path ".\run_tool.ps1") {
    $env:REPORT_TOOL_LOCAL_DEV = "1"
    .\run_tool.ps1
} elseif (Test-Path "$repoDir\run_tool.ps1") {
    Push-Location $repoDir
    try {
        $env:REPORT_TOOL_LOCAL_DEV = "1"
        .\run_tool.ps1
    } finally {
        Pop-Location
    }
} else {
    Write-Host "Could not find run_tool.ps1. Please launch it manually." -ForegroundColor Yellow
}


Read-Host 'Press Enter to exit...'
