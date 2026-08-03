# lefarma.ps1 — Unified project CLI
# Usage: .\lefarma.ps1 <command>
#   dev        Start backend (5174) + frontend (5173) with hot reload
#   stop       Kill dev processes on 5174 + 5173
#   restart    Stop + start dev
#   install    Install all dependencies
#   build      Production deploy zip (build + publish Release, 5-step)
#   build:qa   Frontend build:qa + backend publish (Release)
#   build:dev  Frontend build:dev + backend publish (Debug)
#   publish:qa Build qa + deploy por SSH a staging (detiene app con app_offline.htm)
#   publish    Build prod + deploy por SSH a produccion (pendiente de configurar)

param(
    [Parameter(Position = 0)]
    [ValidateSet("dev", "stop", "restart", "install", "build", "build:qa", "build:dev", "publish", "publish:qa")]
    [string]$Command = "dev"
)

$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot
$Backend = Join-Path $Root "lefarma.backend\src\Lefarma.API"
$Frontend = Join-Path $Root "lefarma.frontend"
$ReleaseDir = Join-Path $Root "release"

# Deploy por SSH (publish / publish:qa)
$SshUser = "artricenter\carlos.guzman"
$SshHost = "192.168.4.2"
$PublishTargets = @{
    qa   = "D:\Desarrollo-pruebas-base"
    prod = ""   # pendiente: path de produccion (lo pasa el usuario)
}

function Stop-PortProcess([int]$Port) {
    $conn = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($conn) {
        Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 1
    }
}

function Invoke-DeployBuild([string]$NpmScript, [string]$ZipName, [string]$VersionFile) {
    $PublishDir = Join-Path $Backend "bin\Release\net10.0\publish"
    $DistDir = Join-Path $Frontend "dist"
    $OutDir = Join-Path $Root "publish"
    $AppVersion = (Get-Content (Join-Path $Root $VersionFile) -Raw).Trim()

    Write-Host "[1/5] dotnet publish -c Release (AppVersion=$AppVersion)" -ForegroundColor Cyan
    Push-Location $Backend
    dotnet publish -c Release -p:AppVersion=$AppVersion
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

function Invoke-RemotePublish([string]$ZipPath, [string]$RemoteTarget) {
    if (-not $RemoteTarget) { throw "Target de produccion sin configurar: falta path/app (pendiente de datos del usuario)" }

    Write-Host "[1/3] SCP zip -> $SshHost" -ForegroundColor Cyan
    ssh "$SshUser@$SshHost" "if not exist C:\LefarmaDeploy mkdir C:\LefarmaDeploy"
    scp $ZipPath "${SshUser}@${SshHost}:C:/LefarmaDeploy/incoming.zip"
    if ($LASTEXITCODE -ne 0) { throw "scp failed" }

    Write-Host "[2/3] Subir helper remoto" -ForegroundColor Cyan
    $helper = Join-Path $env:TEMP "lefarma-remote-deploy.ps1"
    @'
param($zip, $target)
$ErrorActionPreference = "Stop"
$offline = Join-Path $target "app_offline.htm"
Set-Content -LiteralPath $offline "<html><body>deploy en curso</body></html>"
Start-Sleep -Seconds 3
$tmp = Join-Path $env:TEMP ("x-" + [guid]::NewGuid().ToString("N"))
Expand-Archive -LiteralPath $zip -DestinationPath $tmp -Force
robocopy $tmp $target /E /XF appsettings*.json web.config app_offline.htm /R:1 /W:1 /NFL /NDL /NJH /NJS | Out-Null
if ($LASTEXITCODE -ge 8) { throw "robocopy fallo ($LASTEXITCODE)" }
Remove-Item -LiteralPath $offline -Force -ErrorAction SilentlyContinue
$wc = Join-Path $target "web.config"
if (Test-Path $wc) { (Get-Item $wc).LastWriteTime = Get-Date }
Remove-Item $zip, $tmp -Recurse -Force -ErrorAction SilentlyContinue
Write-Host "Deploy OK -> $target"
'@ | Out-File $helper -Encoding UTF8
    scp $helper "${SshUser}@${SshHost}:C:/LefarmaDeploy/remote-deploy.ps1"
    if ($LASTEXITCODE -ne 0) { throw "scp helper failed" }

    Write-Host "[3/3] Deploy remoto (app_offline + robocopy + recycle)" -ForegroundColor Cyan
    ssh "$SshUser@$SshHost" "powershell -NoProfile -ExecutionPolicy Bypass -File C:\LefarmaDeploy\remote-deploy.ps1 -zip C:\LefarmaDeploy\incoming.zip -target `"$RemoteTarget`""
    if ($LASTEXITCODE -ne 0) { throw "remote deploy failed" }
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

    "build"    { Invoke-DeployBuild "build"    "lefarma-prod.zip" "VERSION" }
    "build:qa" { Invoke-DeployBuild "build:qa" "lefarma-qa.zip"  "VERSION-STAGING" }

    "publish:qa" {
        Invoke-DeployBuild "build:qa" "lefarma-qa.zip"
        Invoke-RemotePublish (Join-Path $Root "publish\lefarma-qa.zip") $PublishTargets.qa
    }
    "publish" {
        Invoke-DeployBuild "build" "lefarma-prod.zip"
        Invoke-RemotePublish (Join-Path $Root "publish\lefarma-prod.zip") $PublishTargets.prod
    }
}
