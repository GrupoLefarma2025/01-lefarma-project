# lefarma.ps1 — Unified project CLI
# Usage: .\lefarma.ps1 <command> [args]
#   dev        Start backend (5174) + frontend (5173) with hot reload
#   stop       Kill dev processes on 5174 + 5173
#   restart    Stop + start dev
#   install    Install all dependencies
#   build      Production deploy zip (build + publish Release, 5-step)
#   build:qa   Frontend build:qa + backend publish (Release)
#   build:dev  Frontend build:dev + backend publish (Debug)
#   publish:qa Build qa + deploy por SSH a staging (detiene app con app_offline.htm)
#   publish    Build prod + deploy por SSH a produccion (pendiente de configurar)
#   sql        Migraciones de BD con DbUp. Sub-comandos:
#                .\lefarma.ps1 sql <status|apply|apply-one|diff|list|tui> <env> [opts]
#              Ver `sql help` para detalle.

param(
    [Parameter(Position = 0)]
    [ValidateSet("dev", "stop", "restart", "install", "build", "build:qa", "build:dev", "publish", "publish:qa", "sql")]
    [string]$Command = "dev",

    # Args extra passthrough (para `sql` que necesita sub-comando + flags).
    [Parameter(Position = 1, ValueFromRemainingArguments = $true)]
    [string[]]$SqlArgs = @()
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
    qa   = "D:\DevApps\DevLefarma"   # sitio IIS "Development", pool Dev-Lefarma, :5073
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

    "sql" {
        # Sub-comandos DbUp. Construye el migrador una vez, ejecuta según sub.
        $Sub = if ($SqlArgs.Count -gt 0) { $SqlArgs[0] } else { "help" }
        $MigratorProj = Join-Path $Backend "..\..\src\Lefarma.Migrations\Lefarma.Migrations.csproj"
        # Resolver a path absoluto
        $MigratorProj = [System.IO.Path]::GetFullPath($MigratorProj)

        if (-not (Test-Path -LiteralPath $MigratorProj)) {
            throw "No se encontró el proyecto migrador: $MigratorProj"
        }

        function Invoke-Migrator([string[]]$RunArgs) {
            & dotnet run --project $MigratorProj --no-build -- @RunArgs
            if ($LASTEXITCODE -ne 0) {
                throw "Migrador falló (exit $LASTEXITCODE). Args: $RunArgs"
            }
        }

        # Build silencioso en éxito; muestra TODO el output real si falla (errores visibles).
        function Build-Migrator {
            $out = & dotnet build $MigratorProj --nologo -v minimal 2>&1
            if ($LASTEXITCODE -ne 0) {
                $out | ForEach-Object { Write-Host $_ }
                throw "Build del migrador falló (ver salida arriba)"
            }
        }

        # Visor de contenido SQL de una migración (F8). Usa la pantalla alterna
        # y re-dibuja; ↑/↓ scroll, q para volver al picker.
        function Show-SqlViewer {
            param($Item, [string]$ScriptsRoot)
            $esc = [char]27

            # Ubicar el archivo: <ScriptsRoot>/<app>/<id>.<sufijo...>.sql
            $script = Get-ChildItem -LiteralPath $ScriptsRoot -Recurse -Filter "*.sql" -ErrorAction SilentlyContinue |
                Where-Object { $_.DirectoryName.EndsWith("\$($Item.app)", [System.StringComparison]::OrdinalIgnoreCase) -and
                               $_.BaseName -like "$($Item.id).*" } |
                Select-Object -First 1

            [Console]::Write($esc + "[?1049h")
            [Console]::CursorVisible = $false
            try {
                if ($null -eq $script) {
                    [Console]::ResetColor()
                    [Console]::ForegroundColor = [ConsoleColor]::Red
                    [Console]::WriteLine("No se encontró el archivo para: $($Item.id)")
                    [Console]::ResetColor()
                    [Console]::WriteLine("Pulse cualquier tecla para volver...")
                    [void][Console]::ReadKey($true)
                    return
                }
                $lines = @(Get-Content -LiteralPath $script.FullName)
                $top = 0
                while ($true) {
                    $h = [Console]::WindowHeight
                    $w = [Console]::WindowWidth
                    $avail = $h - 3
                    if ($top -gt $lines.Count - $avail) { $top = [Math]::Max(0, $lines.Count - $avail) }
                    [Console]::SetCursorPosition(0, 0)
                    [Console]::ResetColor()
                    [Console]::ForegroundColor = [ConsoleColor]::Cyan
                    [Console]::WriteLine("  $($script.Name)  — líneas $($lines.Count)  (↑/↓ scroll, q volver)")
                    [Console]::ResetColor()
                    for ($i = $top; $i -lt [Math]::Min($lines.Count, $top + $avail); $i++) {
                        $line = $lines[$i]
                        if ($line.Length -gt $w - 1) { $line = $line.Substring(0, $w - 1) }
                        [Console]::WriteLine($line)
                    }
                    [Console]::SetCursorPosition(0, [Math]::Min($h - 1, 2 + $avail))
                    [Console]::Write($esc + "[0J")
                    $k = [Console]::ReadKey($true)
                    if ($k.Key -eq [ConsoleKey]::UpArrow) { $top--; if ($top -lt 0) { $top = 0 } }
                    elseif ($k.Key -eq [ConsoleKey]::DownArrow) { $top++ }
                    elseif ($k.Key -eq [ConsoleKey]::PageUp) { $top -= $avail; if ($top -lt 0) { $top = 0 } }
                    elseif ($k.Key -eq [ConsoleKey]::PageDown) { $top += $avail }
                    elseif ($k.KeyChar -eq 'q' -or $k.KeyChar -eq 'Q' -or $k.Key -eq [ConsoleKey]::Escape) { break }
                }
            } finally {
                [Console]::CursorVisible = $true
                [Console]::ResetColor()
                [Console]::Write($esc + "[?1049l")
            }
        }

        # TUI propia (ANSI), sin dependencias. Multi-select de migraciones.
        # F6 = solo pendientes · F7 = todos · F9 = solo aplicados · F8 = ver SQL · q = salir.
        # Devuelve los items seleccionados (solo pendientes); $null si se cancela.
        function Show-MigrationPicker {
            param([array]$Pending, [string]$EnvName, [string]$ScriptsRoot)

            $esc = [char]27
            $viewMode = 'pending'   # pending | all | applied

            # ---- modelo base: todos los items (con applied + env) ----
            $allItems = New-Object System.Collections.ArrayList
            foreach ($p in $Pending) {
                [void]$allItems.Add([PSCustomObject]@{
                    db = $p.db; id = $p.id; app = $p.app; tipo = $p.tipo; env = $p.env
                    applied = [bool]$p.applied; selected = $false
                })
            }
            if ($allItems.Count -eq 0) { return @() }

            $rows = New-Object System.Collections.ArrayList
            $items = New-Object System.Collections.ArrayList
            $firstItemRow = -1

            # Reconstruye la vista según $viewMode (agrupa por DB preservando orden).
            function Rebuild-Model {
                $rows.Clear(); $items.Clear()
                $visible = @($allItems | Where-Object {
                    if ($viewMode -eq 'pending')  { -not $_.applied }
                    elseif ($viewMode -eq 'applied') { $_.applied }
                    else { $true }
                })
                $dbsOrdered = @(); $byDb = @{}
                foreach ($p in $visible) {
                    if (-not $byDb.ContainsKey($p.db)) { $byDb[$p.db] = @(); $dbsOrdered += $p.db }
                    $byDb[$p.db] += , $p
                }
                foreach ($db in $dbsOrdered) {
                    [void]$rows.Add(@{ kind = 'header'; db = $db; count = @($byDb[$db]).Count })
                    foreach ($p in $byDb[$db]) { [void]$items.Add($p); [void]$rows.Add(@{ kind = 'item'; item = $p }) }
                }
                $firstItemRow = -1
                for ($i = 0; $i -lt $rows.Count; $i++) { if ($rows[$i].kind -eq 'item') { $firstItemRow = $i; break } }
            }
            Rebuild-Model
            $curRow = $firstItemRow

            # ---- paleta ----
            $cBorder = [ConsoleColor]::DarkGray
            $cTitle  = [ConsoleColor]::Cyan
            $cDb     = [ConsoleColor]::Yellow
            $cId     = [ConsoleColor]::Gray
            $cMeta   = [ConsoleColor]::DarkGray
            $cOn     = [ConsoleColor]::Green
            $cOff    = [ConsoleColor]::DarkGray
            $cDone   = [ConsoleColor]::DarkGreen   # aplicado
            $cCurBg  = [ConsoleColor]::DarkBlue
            $cCurFg  = [ConsoleColor]::White
            $cHelp   = [ConsoleColor]::DarkGray
            $cCount  = [ConsoleColor]::Green

            # ---- navegación ----
            $firstItemRow = -1
            for ($i = 0; $i -lt $rows.Count; $i++) { if ($rows[$i].kind -eq 'item') { $firstItemRow = $i; break } }
            $curRow = $firstItemRow
            function Find-NextItem([int]$r) { for ($i = $r + 1; $i -lt $rows.Count; $i++) { if ($rows[$i].kind -eq 'item') { return $i } }; return -1 }
            function Find-PrevItem([int]$r) { for ($i = $r - 1; $i -ge 0; $i--) { if ($rows[$i].kind -eq 'item') { return $i } }; return -1 }

            # ---- pantalla alterna ----
            [Console]::Write($esc + "[?1049h")
            [Console]::Write($esc + "[2J" + $esc + "[H")
            [Console]::CursorVisible = $false

            # Dibuja una fila con bordes. segments = lista de @(fg, bg|null, texto).
            # bg=$null -> fondo por defecto de la terminal (ResetColor), no un color fijo.
            function Draw-Row([array]$segments, [int]$inner, [ConsoleColor]$border, $padBg) {
                [Console]::ResetColor()
                [Console]::ForegroundColor = $border
                [Console]::Write("│")
                $used = 0
                foreach ($seg in $segments) {
                    if ($null -ne $seg[1]) { [Console]::BackgroundColor = $seg[1] } else { [Console]::ResetColor() }
                    [Console]::ForegroundColor = $seg[0]
                    [Console]::Write($seg[2])
                    $used += $seg[2].Length
                }
                $pad = $inner - $used
                if ($pad -gt 0) {
                    if ($null -ne $padBg) { [Console]::BackgroundColor = $padBg } else { [Console]::ResetColor() }
                    [Console]::Write(" " * $pad)
                }
                [Console]::ResetColor()
                [Console]::ForegroundColor = $border
                [Console]::Write("│")
            }

            $result = @()
            $cancelled = $false
            try {
                $top = 0
                while ($true) {
                    $w = [Console]::WindowWidth
                    $h = [Console]::WindowHeight
                    if ($w -lt 60) { $w = 60 }
                    $inner = $w - 2
                    $avail = $h - 6
                    if ($avail -lt 3) { $avail = 3 }

                    if ($curRow -lt $top) { $top = $curRow }
                    if ($curRow -ge $top + $avail) { $top = $curRow - $avail + 1 }
                    if ($top -lt 0) { $top = 0 }

                    $row = 0
                    # borde superior + título
                    [Console]::SetCursorPosition(0, $row)
                    $title = " SQL Migraciones · $EnvName · $($items.Count) pendientes "
                    $modeTag = if ($viewMode -eq 'all') { "· TODOS" } elseif ($viewMode -eq 'applied') { "· APLICADOS" } else { "" }
                    $title = " SQL Migraciones · $EnvName$modeTag · $($items.Count) "
                    if ($title.Length -gt $w - 4) { $title = $title.Substring(0, $w - 4) }
                    [Console]::ResetColor(); [Console]::ForegroundColor = $cBorder
                    [Console]::Write("╭─")
                    [Console]::ForegroundColor = $cTitle
                    [Console]::Write($title)
                    $fillc = $w - 2 - $title.Length - 1
                    if ($fillc -lt 0) { $fillc = 0 }
                    [Console]::ForegroundColor = $cBorder
                    [Console]::Write(("─" * $fillc) + "╮")
                    $row++

                    # contenido (ventana de scroll)
                    $end = $top + $avail - 1
                    if ($end -ge $rows.Count) { $end = $rows.Count - 1 }
                    for ($idx = $top; $idx -le $end; $idx++) {
                        [Console]::SetCursorPosition(0, $row)
                        $r = $rows[$idx]
                        if ($r.kind -eq 'header') {
                            $segs = @(
                                , @($cDb, $null, "  ▸ $($r.db)")
                                , @($cMeta, $null, "   ($($r.count))")
                            )
                            Draw-Row $segs $inner $cBorder $null
                        } else {
                            $it = $r.item
                            $isCur = ($idx -eq $curRow)
                            $cb = if ($it.selected) { "[x]" } else { "[ ]" }
                            $idFg = if ($isCur) { $cCurFg } elseif ($it.applied) { $cDone } else { $cId }
                            $cbFg = if ($it.selected) { $cOn } elseif ($isCur) { $cCurFg } else { $cOff }
                            $meta = "$($it.app)/$($it.tipo)"
                            if ($it.applied) { $meta += " · aplicado" }
                            $fixed = 2 + 3 + 1 + 1 + $meta.Length
                            $idMax = $inner - $fixed
                            if ($idMax -lt 5) { $idMax = 5 }
                            $idDisp = $it.id
                            if ($idDisp.Length -gt $idMax) { $idDisp = $idDisp.Substring(0, $idMax - 1) + "…" }
                            $gap = $inner - (2 + 3 + 1 + $idDisp.Length + $meta.Length)
                            if ($gap -lt 1) { $gap = 1 }
                            $bg = if ($isCur) { $cCurBg } else { $null }
                            $metaFg = if ($isCur) { [ConsoleColor]::Gray } else { $cMeta }
                            $segs = @(
                                , @($idFg, $bg, "  ")
                                , @($cbFg, $bg, $cb)
                                , @($idFg, $bg, " ")
                                , @($idFg, $bg, $idDisp)
                                , @($metaFg, $bg, (" " * $gap))
                                , @($metaFg, $bg, $meta)
                            )
                            Draw-Row $segs $inner $cBorder $bg
                        }
                        $row++
                    }

                    # separador + contador + ayuda + borde inferior
                    [Console]::SetCursorPosition(0, $row)
                    [Console]::ResetColor(); [Console]::ForegroundColor = $cBorder
                    [Console]::Write("├" + ("─" * $inner) + "┤")
                    $row++

                    [Console]::SetCursorPosition(0, $row)
                    $selCount = @($items | Where-Object selected).Count
                    $countSegs = @(
                        , @($cCount, $null, "  Seleccionados: $selCount")
                        , @($cMeta, $null, "  de $($items.Count)")
                    )
                    Draw-Row $countSegs $inner $cBorder $null
                    $row++

                    [Console]::SetCursorPosition(0, $row)
                    $help = "↑↓ nav · esp sel · a todas · n ninguna · F6 pend. · F7 todos · F9 aplic. · F8 ver SQL · enter aplicar · q salir"
                    if ($help.Length -gt $inner) { $help = $help.Substring(0, $inner) }
                    $helpSegs = @(
                        , @($cHelp, $null, $help)
                    )
                    Draw-Row $helpSegs $inner $cBorder $null
                    $row++

                    [Console]::SetCursorPosition(0, $row)
                    [Console]::ResetColor(); [Console]::ForegroundColor = $cBorder
                    [Console]::Write("╰" + ("─" * $inner) + "╯")
                    $row++

                    [Console]::SetCursorPosition(0, $row)
                    [Console]::Write($esc + "[0J")   # limpia sobrante debajo

                    # ---- input ----
                    $k = [Console]::ReadKey($true)
                    $done = $false
                    switch ($k.Key) {
                        ([ConsoleKey]::UpArrow)   { $n = Find-PrevItem $curRow; if ($n -ge 0) { $curRow = $n } }
                        ([ConsoleKey]::DownArrow) { $n = Find-NextItem $curRow; if ($n -ge 0) { $curRow = $n } }
                        ([ConsoleKey]::Home)      { $curRow = $firstItemRow }
                        ([ConsoleKey]::End)       { for ($i = $rows.Count - 1; $i -ge 0; $i--) { if ($rows[$i].kind -eq 'item') { $curRow = $i; break } } }
                        ([ConsoleKey]::Spacebar)  { $rows[$curRow].item.selected = -not $rows[$curRow].item.selected }
                        ([ConsoleKey]::Enter)     { $result = @($items | Where-Object selected); $done = $true }
                        ([ConsoleKey]::Escape)    { $cancelled = $true; $done = $true }
                        ([ConsoleKey]::F6)        { $viewMode = 'pending'; Rebuild-Model; $curRow = $firstItemRow }
                        ([ConsoleKey]::F7)        { $viewMode = 'all'; Rebuild-Model; $curRow = $firstItemRow }
                        ([ConsoleKey]::F9)        { $viewMode = 'applied'; Rebuild-Model; $curRow = $firstItemRow }
                        ([ConsoleKey]::F8)        { Show-SqlViewer -Item $rows[$curRow].item -ScriptsRoot $ScriptsRoot }
                        default {
                            $ch = $k.KeyChar
                            if ($ch -eq 'a' -or $ch -eq 'A') { foreach ($it in $items) { if (-not $it.applied) { $it.selected = $true } } }
                            elseif ($ch -eq 'n' -or $ch -eq 'N') { foreach ($it in $items) { $it.selected = $false } }
                            elseif ($ch -eq 'q' -or $ch -eq 'Q') { $cancelled = $true; $done = $true }
                        }
                    }
                    if ($done) { break }
                }
            } finally {
                [Console]::CursorVisible = $true
                [Console]::ResetColor()
                [Console]::Write($esc + "[?1049l")   # vuelve a la pantalla original
            }
            if ($cancelled) { return $null }
            return $result
        }

        switch ($Sub) {
            "help" {
                Write-Host "Uso: .\multiappcli.ps1 sql <sub> <env> [opts]" -ForegroundColor Cyan
                Write-Host ""
                Write-Host "Sub-comandos:"
                Write-Host "  status      <env>            Lista pendientes en el ambiente"
                Write-Host "  apply       <env>            Aplica TODO lo pendiente en el ambiente"
                Write-Host "  apply-one   <env> --id ID    Aplica solo un script por id"
                Write-Host "  diff        <fromEnv> <toEnv>  Lista lo que tiene fromEnv pero falta en toEnv"
                Write-Host "  list        <env>            Lista lo ya aplicado en el ambiente"
                Write-Host "  tui         <env>            Menú interactivo para elegir y aplicar"
                Write-Host ""
                Write-Host "Opciones (para status/apply/apply-one):"
                Write-Host "  --app X       Filtra por app (educacion-medica, rh, _shared, ...)"
                Write-Host "  --tipo Y      Filtra por tipo (schema, alter, data)"
                Write-Host "  --id ID       Aplica solo un script (apply-one)"
                Write-Host ""
                Write-Host "Ambientes: dev | qa | prod"
                Write-Host ""
                Write-Host "Ejemplos:"
                Write-Host "  .\multiappcli.ps1 sql status dev"
                Write-Host "  .\multiappcli.ps1 sql apply dev --app educacion-medica"
                Write-Host "  .\multiappcli.ps1 sql apply-one dev --id 20260805-0935-create-educacion-medica"
                Write-Host "  .\multiappcli.ps1 sql diff qa prod"
                Write-Host "  .\multiappcli.ps1 sql tui dev"
            }

            "status" {
                $env_ = if ($SqlArgs.Count -gt 1) { $SqlArgs[1] } else { "all" }
                $rest = $SqlArgs | Select-Object -Skip 2
                # Build silently si hace falta, luego corre
                Build-Migrator
                Invoke-Migrator -RunArgs (@("status", $env_) + $rest)
            }

            "list" {
                $env_ = if ($SqlArgs.Count -gt 1) { $SqlArgs[1] } else { "dev" }
                Build-Migrator
                Invoke-Migrator -RunArgs (@("list", $env_))
            }

            "apply" {
                $env_ = if ($SqlArgs.Count -gt 1) { $SqlArgs[1] } else { "dev" }
                $rest = $SqlArgs | Select-Object -Skip 2

                if ($env_ -eq "prod") {
                    Write-Host "VA A APLICAR MIGRACIONES A PRODUCCIÓN ($env_)." -ForegroundColor Red
                    $confirm = Read-Host "Escribe 'PROD' para confirmar"
                    if ($confirm -ne "PROD") {
                        Write-Host "Abortado." -ForegroundColor Yellow
                        return
                    }
                }

                Build-Migrator
                Invoke-Migrator -RunArgs (@("apply", $env_) + $rest)
            }

            "apply-one" {
                $env_ = if ($SqlArgs.Count -gt 1) { $SqlArgs[1] } else { "dev" }
                $id = ($SqlArgs | Where-Object { $_ -like "--id=*" }).Split('=')[1]
                if (-not $id) {
                    # buscar --id ID
                    $idx = [Array]::IndexOf($SqlArgs, "--id")
                    if ($idx -ge 0 -and $idx + 1 -lt $SqlArgs.Count) { $id = $SqlArgs[$idx + 1] }
                }
                if (-not $id) { throw "Falta --id ID. Ej: sql apply-one dev --id 20260805-0935-create-talleres" }

                if ($env_ -eq "prod") {
                    Write-Host "VA A APLICAR $id A PRODUCCIÓN ($env_)." -ForegroundColor Red
                    $confirm = Read-Host "Escribe 'PROD' para confirmar"
                    if ($confirm -ne "PROD") {
                        Write-Host "Abortado." -ForegroundColor Yellow
                        return
                    }
                }

                Build-Migrator
                Invoke-Migrator -RunArgs (@("apply", $env_, "--id", $id))
            }

            "diff" {
                if ($SqlArgs.Count -lt 3) {
                    throw "Uso: sql diff <fromEnv> <toEnv>"
                }
                Build-Migrator
                Invoke-Migrator -RunArgs (@("diff", $SqlArgs[1], $SqlArgs[2]))
            }

            "tui" {
                $env_ = if ($SqlArgs.Count -gt 1) { $SqlArgs[1] } else { "all" }

                Build-Migrator

                # Obtener pendientes + aplicados como JSON (stdout limpio, sin logs DbUp).
                # El servidor SQL viejo puede emitir un "Security Warning: TLS..." por stdout;
                # nos quedamos solo con la última línea que empieza con '[' (el JSON).
                $jsonLine = & dotnet run --project $MigratorProj --no-build -- status $env_ --json --applied |
                    Where-Object { $_ -match '^\[' } | Select-Object -Last 1
                $pending = @($jsonLine | ConvertFrom-Json)

                if ($pending.Count -eq 0) {
                    Write-Host "Sin migraciones en $env_." -ForegroundColor Green
                    return
                }

                $scriptsRoot = Join-Path $PSScriptRoot "lefarma.database"
                $seleccion = Show-MigrationPicker -Pending $pending -EnvName $env_ -ScriptsRoot $scriptsRoot

                if ($null -eq $seleccion) {
                    Write-Host "Cancelado." -ForegroundColor Yellow
                    return
                }
                $seleccion = @($seleccion)
                if ($seleccion.Count -eq 0) {
                    Write-Host "Nada seleccionado. Abortado." -ForegroundColor Yellow
                    return
                }

                foreach ($g in ($seleccion | Group-Object env)) {
                    $envSel = $g.Name
                    Write-Host "Aplicando $($g.Count) script(s) en $envSel..." -ForegroundColor Cyan
                    foreach ($s in $g.Group) {
                        Write-Host "  → [$($s.db)] $($s.id)$(if ($s.applied) { ' (re-ejecutar --force)' })" -ForegroundColor Cyan
                        $runArgs = @("apply", $envSel, "--id", $s.id)
                        if ($s.applied) { $runArgs += "--force" }
                        Invoke-Migrator -RunArgs $runArgs
                    }
                }
                Write-Host "Listo." -ForegroundColor Green
            }

            default {
                Write-Host "Sub-comando sql desconocido: $Sub" -ForegroundColor Red
                Write-Host "Ver: .\multiappcli.ps1 sql help" -ForegroundColor Yellow
            }
        }
    }
}
