# lefarma.ps1 — Unified project CLI
# Usage: .\lefarma.ps1 <command>
#   dev        Start backend (5174) + frontend (5173) with hot reload
#   stop       Kill dev processes on 5174 + 5173
#   restart    Stop + start dev
#   install    Install all dependencies
#   build      Frontend build + backend publish (Release)
#   build:qa   Frontend build:qa + backend publish (Release)
#   build:dev  Frontend build:dev + backend publish (Debug)

param(
    [Parameter(Position = 0)]
    [ValidateSet("dev", "stop", "restart", "install", "build", "build:qa", "build:dev")]
    [string]$Command = "dev"
)

$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot
$Backend = Join-Path $Root "lefarma.backend\src\Lefarma.API"
$Frontend = Join-Path $Root "lefarma.frontend"
$ReleaseDir = Join-Path $Root "release"

function Stop-PortProcess([int]$Port) {
    $conn = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($conn) {
        Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 1
    }
}

switch ($Command) {
    "dev" {
        Write-Host "Lefarma dev — backend :5174 | frontend :5173" -ForegroundColor Cyan
        Stop-PortProcess 5174
        Stop-PortProcess 5173

        $bat = Join-Path $env:TEMP "lefarma-dev.bat"
        @"
@echo off
start "Lefarma Backend" cmd /k "cd /d "$Backend" && title Lefarma Backend :5174 && dotnet watch run --launch-profile http"
timeout /t 2 /nobreak >nul
start "Lefarma Frontend" cmd /k "cd /d "$Frontend" && title Lefarma Frontend :5173 && npm run dev"
"@ | Out-File $bat -Encoding ASCII
        & $bat
        Remove-Item $bat -ErrorAction SilentlyContinue
        Write-Host "Started. Close the terminal windows to stop." -ForegroundColor Green
    }

    "stop" {
        Write-Host "Stopping dev processes..." -ForegroundColor Yellow
        Stop-PortProcess 5174
        Stop-PortProcess 5173
        Write-Host "Stopped." -ForegroundColor Green
    }

    "restart" {
        Stop-PortProcess 5174
        Stop-PortProcess 5173
        Write-Host "Restarting dev — backend :5174 | frontend :5173" -ForegroundColor Cyan

        $bat = Join-Path $env:TEMP "lefarma-dev.bat"
        @"
@echo off
start "Lefarma Backend" cmd /k "cd /d "$Backend" && title Lefarma Backend :5174 && dotnet watch run --launch-profile http"
timeout /t 2 /nobreak >nul
start "Lefarma Frontend" cmd /k "cd /d "$Frontend" && title Lefarma Frontend :5173 && npm run dev"
"@ | Out-File $bat -Encoding ASCII
        & $bat
        Remove-Item $bat -ErrorAction SilentlyContinue
        Write-Host "Restarted." -ForegroundColor Green
    }

    "install" {
        Write-Host "Installing dependencies..." -ForegroundColor Cyan
        Push-Location $Frontend
        npm install
        if ($LASTEXITCODE -ne 0) { Pop-Location; throw "npm install failed" }
        Pop-Location

        Push-Location $Backend
        dotnet restore
        if ($LASTEXITCODE -ne 0) { Pop-Location; throw "dotnet restore failed" }
        Pop-Location
        Write-Host "Done." -ForegroundColor Green
    }

    { $_ -in "build", "build:qa", "build:dev" } {
        $npmScript = if ($Command -eq "build") { "build" } else { $Command }
        $config = if ($Command -eq "build:dev") { "Debug" } else { "Release" }

        Write-Host "Frontend: npm run $npmScript" -ForegroundColor Cyan
        Push-Location $Frontend
        npm run $npmScript
        if ($LASTEXITCODE -ne 0) { Pop-Location; throw "Frontend build failed" }
        Pop-Location

        Write-Host "Backend: dotnet publish -c $config -> release/" -ForegroundColor Cyan
        Push-Location $Backend
        dotnet publish -c $config -o $ReleaseDir
        if ($LASTEXITCODE -ne 0) { Pop-Location; throw "Backend publish failed" }
        Pop-Location
        Write-Host "Published to release/" -ForegroundColor Green
    }
}
