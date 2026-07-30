# lefarma.ps1 — Unified project CLI
# Usage: .\lefarma.ps1 <command>
#   dev        Start backend (5174) + frontend (5173) with hot reload
#   stop       Kill dev processes on 5174 + 5173
#   restart    Stop + start dev
#   install    Install all dependencies
#   build      Production deploy zip (build + publish Release, 5-step)
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

function Invoke-DeployBuild([string]$NpmScript, [string]$ZipName) {
    $PublishDir = Join-Path $Backend "bin\Release\net10.0\publish"
    $DistDir = Join-Path $Frontend "dist"
    $OutDir = Join-Path $Root "publish"

    Write-Host "[1/5] dotnet publish -c Release" -ForegroundColor Cyan
    Push-Location $Backend
    dotnet publish -c Release
    if ($LASTEXITCODE -ne 0) { Pop-Location; throw "Backend publish failed" }
    Pop-Location

    Write-Host "[2/5] Cleaning publish dir (locales, runtimes, configs, wwwroot)" -ForegroundColor Cyan
    Get-ChildItem -LiteralPath $PublishDir -Directory | Remove-Item -Recurse -Force
    foreach ($f in @("appsettings.json", "appsettings.Development.json", "web.config")) {
        Remove-Item -LiteralPath (Join-Path $PublishDir $f) -ErrorAction SilentlyContinue
    }
    New-Item -ItemType Directory -Path (Join-Path $PublishDir "wwwroot") -Force | Out-Null

    Write-Host "[3/5] npm run $NpmScript" -ForegroundColor Cyan
    Push-Location $Frontend
    npm run $NpmScript
    if ($LASTEXITCODE -ne 0) { Pop-Location; throw "Frontend $NpmScript failed" }
    Pop-Location

    Write-Host "[4/5] Copying dist -> publish\wwwroot" -ForegroundColor Cyan
    Copy-Item -Path (Join-Path $DistDir "*") -Destination (Join-Path $PublishDir "wwwroot") -Recurse -Force

    Write-Host "[5/5] Zipping publish -> publish\" -ForegroundColor Cyan
    New-Item -ItemType Directory -Path $OutDir -Force | Out-Null
    $zip = Join-Path $OutDir $ZipName
    if (Test-Path -LiteralPath $zip) { Remove-Item -LiteralPath $zip -Force }
    Compress-Archive -Path (Join-Path $PublishDir "*") -DestinationPath $zip -Force
    Write-Host "Done -> $zip" -ForegroundColor Green
}

switch ($Command) {
    "dev" {
        Write-Host "Lefarma dev — backend :5174 | frontend :5173" -ForegroundColor Cyan
        Stop-PortProcess 5174
        Stop-PortProcess 5173

        $bat = Join-Path $env:TEMP "lefarma-dev.bat"
        $batch = @"
@echo off
start "Lefarma Backend" cmd /k "cd /d "$Backend" && title Lefarma Backend :5174 && dotnet watch run --launch-profile http"
timeout /t 2 /nobreak >nul
start "Lefarma Frontend" cmd /k "cd /d "$Frontend" && title Lefarma Frontend :5173 && npm run dev"
"@
        $batch | Out-File $bat -Encoding ASCII
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
        $batch = @"
@echo off
start "Lefarma Backend" cmd /k "cd /d "$Backend" && title Lefarma Backend :5174 && dotnet watch run --launch-profile http"
timeout /t 2 /nobreak >nul
start "Lefarma Frontend" cmd /k "cd /d "$Frontend" && title Lefarma Frontend :5173 && npm run dev"
"@
        $batch | Out-File $bat -Encoding ASCII
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

    "build:dev" {
        Write-Host "Frontend: npm run build:dev" -ForegroundColor Cyan
        Push-Location $Frontend
        npm run build:dev
        if ($LASTEXITCODE -ne 0) { Pop-Location; throw "Frontend build failed" }
        Pop-Location

        Write-Host "Backend: dotnet publish -c Debug -> release/" -ForegroundColor Cyan
        Push-Location $Backend
        dotnet publish -c Debug -o $ReleaseDir
        if ($LASTEXITCODE -ne 0) { Pop-Location; throw "Backend publish failed" }
        Pop-Location
        Write-Host "Published to release/" -ForegroundColor Green
    }

    "build"    { Invoke-DeployBuild "build"    "lefarma-prod.zip" }
    "build:qa" { Invoke-DeployBuild "build:qa" "lefarma-qa.zip" }
}
