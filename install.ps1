Write-Host "Installing Report Tool..." -ForegroundColor Cyan

# Ensure git is available
if (!(Get-Command "git" -ErrorAction SilentlyContinue)) {
    Write-Host "Error: Git is not installed." -ForegroundColor Red
    exit 1
}

if ((Split-Path $PWD -Leaf) -ieq "Report-Tool") {
    $repoDir = $PWD.Path
} else {
    $repoDir = Join-Path $PWD "Report-Tool"
}

if (!(Test-Path $repoDir)) {
    if (!$token) {
        Write-Host "Please paste your GitHub Personal Access Token (the same one starting with ghp_) to clone the private repository:" -ForegroundColor Yellow
        $token = Read-Host "Token"
    }
    
    Write-Host "Cloning repository..."
    git clone "https://${token}@github.com/JoshiAO/Report-Tool.git" $repoDir
    
    if (!(Test-Path (Join-Path $repoDir ".git"))) {
        Write-Host "Failed to clone repository. Check your token." -ForegroundColor Red
        exit 1
    }
} elseif (!(Test-Path (Join-Path $repoDir ".git"))) {
    Write-Host "Repairing incomplete Report-Tool folder..." -ForegroundColor Yellow
    if (!$token) {
        Write-Host "Please paste your GitHub Personal Access Token (the same one starting with ghp_) to repair the repository:" -ForegroundColor Yellow
        $token = Read-Host "Token"
    }

    Push-Location $repoDir
    try {
        # Remove stray root files created by a previous failed install (preserving settings.json)
        if ((Test-Path "venv") -and !(Test-Path "backend")) {
            Remove-Item -Path "venv" -Recurse -Force -ErrorAction SilentlyContinue
        }
        if ((Test-Path "package-lock.json") -and !(Test-Path "frontend")) {
            Remove-Item -Path "package-lock.json" -Force -ErrorAction SilentlyContinue
        }

        git init
        if (git remote | Where-Object { $_ -eq "origin" }) {
            git remote set-url origin "https://${token}@github.com/JoshiAO/Report-Tool.git"
        } else {
            git remote add origin "https://${token}@github.com/JoshiAO/Report-Tool.git"
        }
        git fetch origin master
        git checkout -f -B master origin/master
    } finally {
        Pop-Location
    }

    if (!(Test-Path (Join-Path $repoDir "backend"))) {
        Write-Host "Failed to repair repository. Check your token or delete the Report-Tool folder and try again." -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "Updating existing repository..."
    Push-Location $repoDir
    try {
        if ($token) {
            git remote set-url origin "https://${token}@github.com/JoshiAO/Report-Tool.git"
        }
        git fetch origin master
        git reset --hard origin/master
    } finally {
        Pop-Location
    }
}

Push-Location $repoDir

# Check Python
if (!(Get-Command "python" -ErrorAction SilentlyContinue)) {
    Write-Host "Error: Python is not installed or not in PATH." -ForegroundColor Red
    Pop-Location
    exit 1
}

# Check NPM
if (!(Get-Command "npm" -ErrorAction SilentlyContinue)) {
    Write-Host "Error: Node.js (npm) is not installed or not in PATH." -ForegroundColor Red
    Pop-Location
    exit 1
}

# Backend Setup
Write-Host "`nSetting up Python Backend..." -ForegroundColor Yellow
$backendDir = Join-Path $repoDir "backend"
if (!(Test-Path $backendDir)) {
    Write-Host "Error: backend directory not found at $backendDir" -ForegroundColor Red
    Pop-Location
    exit 1
}
Push-Location $backendDir
try {
    if (!(Test-Path "venv")) {
        Write-Host "Creating Virtual Environment..."
        python -m venv venv
    }
    Write-Host "Installing Python requirements..."
    & ".\venv\Scripts\python.exe" -m pip install -r requirements.txt
} finally {
    Pop-Location
}

# Frontend Setup
Write-Host "`nSetting up Node.js Frontend..." -ForegroundColor Yellow
$frontendDir = Join-Path $repoDir "frontend"
if (!(Test-Path $frontendDir)) {
    Write-Host "Error: frontend directory not found at $frontendDir" -ForegroundColor Red
    Pop-Location
    exit 1
}
Push-Location $frontendDir
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
