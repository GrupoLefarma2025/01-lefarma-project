# Lefarma Project Installation Script
# Installs all dependencies required to run the project
# mini cambio para validar y probar ramas
$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$BackendPath = Join-Path $ProjectRoot "lefarma.backend\src\Lefarma.API"
$FrontendPath = Join-Path $ProjectRoot "lefarma.frontend"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Lefarma Project - Installation" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check Node.js
Write-Host "Checking Node.js..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version
    Write-Host "  Node.js: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "  Node.js NOT FOUND. Please install Node.js 18+ from https://nodejs.org" -ForegroundColor Red
    exit 1
}

# Check npm
Write-Host "Checking npm..." -ForegroundColor Yellow
try {
    $npmVersion = npm --version
    Write-Host "  npm: $npmVersion" -ForegroundColor Green
} catch {
    Write-Host "  npm NOT FOUND" -ForegroundColor Red
    exit 1
}

# Check .NET
Write-Host "Checking .NET SDK..." -ForegroundColor Yellow
try {
    $dotnetVersion = dotnet --version
    Write-Host "  .NET SDK: $dotnetVersion" -ForegroundColor Green
} catch {
    Write-Host "  .NET SDK NOT FOUND. Please install .NET 10 SDK from https://dotnet.microsoft.com/download" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Installing Dependencies" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Install Frontend dependencies
Write-Host "[1/2] Installing Frontend dependencies..." -ForegroundColor Yellow
Set-Location $FrontendPath
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "  Frontend installation failed!" -ForegroundColor Red
    exit 1
}
Write-Host "  Frontend dependencies installed" -ForegroundColor Green

# Restore Backend dependencies
Write-Host "[2/2] Restoring Backend dependencies..." -ForegroundColor Yellow
Set-Location $BackendPath
dotnet restore
if ($LASTEXITCODE -ne 0) {
    Write-Host "  Backend restore failed!" -ForegroundColor Red
    exit 1
}
Write-Host "  Backend dependencies restored" -ForegroundColor Green

Set-Location $ProjectRoot

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Installation Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Run the following to start the project:" -ForegroundColor White
Write-Host "  .\init.ps1" -ForegroundColor Cyan
Write-Host ""
