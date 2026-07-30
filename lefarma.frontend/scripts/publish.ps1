#requires -Version 7
<#
  Publish the frontend build to the remote IIS wwwroot.

  Flow:
    1. npm run build            -> dist/
    2. remote backup of wwwroot -> backups/wwwroot-backup-{ts}.zip (downloaded locally)
    3. package dist/            -> upload zip -> expand on server

  Safe by default: OVERWRITES only, never deletes from wwwroot.
  Use -CleanRemote to wipe wwwroot first (preserves web.config).

  Examples:
    npm run publish
    pwsh scripts/publish.ps1 -SkipBuild
    pwsh scripts/publish.ps1 -CleanRemote
    pwsh scripts/publish.ps1 -SkipBackup -SkipBuild
#>
[CmdletBinding()]
param(
    [string]$RemoteUser   = 'artricenter\carlos.guzman@192.168.4.2',
    [string]$RemoteWwwroot = 'D:\InepubPruebas\Control-de-Gastos-Prod\wwwroot',
    [string]$RemoteWork    = 'C:\Temp\lefarma-deploy',
    [string[]]$Preserve    = @('media'),
    [switch]$SkipBuild,
    [switch]$SkipBackup,
    [switch]$CleanRemote
)

$ErrorActionPreference = 'Stop'
$root      = Split-Path -Parent $PSScriptRoot      # lefarma.frontend/
$dist      = Join-Path $root 'dist'
$backups   = Join-Path $root 'backups'
$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'

function Step($m)  { Write-Host "`n=== $m ===" -ForegroundColor Cyan }
function Ok($m)    { Write-Host $m -ForegroundColor Green }
function Warn($m)  { Write-Host $m -ForegroundColor Yellow }

# --- 0. Pre-checks -----------------------------------------------------------
foreach ($t in 'ssh','scp') {
    if (-not (Get-Command $t -ErrorAction SilentlyContinue)) {
        throw " '$t' no encontrado. Instala el cliente OpenSSH o ajusta el PATH."
    }
}

# Ensure the remote work dir exists BEFORE any scp: Win32-OpenSSH scp refuses to
# upload into a missing destination folder ("dest open ...: No such file or directory").
& ssh $RemoteUser "cmd /c mkdir $RemoteWork 2>nul & exit /b 0"

# --- 1. Build ----------------------------------------------------------------
if (-not $SkipBuild) {
    Step 'Build (npm run build)'
    # npm.cmd (not `npm`) — inside a non-interactive `pwsh -File`, `& npm`
    # resolves to the buggy npm.ps1 shim and mangles args ("Unknown command: pm").
    & npm.cmd run build
    if ($LASTEXITCODE -ne 0) { throw 'Build fallido (npm run build).' }
} else {
    Warn 'Build omitido (-SkipBuild).'
}
if (-not (Test-Path $dist)) { throw "No existe '$dist'. Corre el build primero." }

# --- helpers: run a remote .ps1 from a here-string ---------------------------
function Invoke-RemoteScript {
    param([string]$Body, [string]$RemoteName)
    $local = Join-Path $env:TEMP "lefarma-$RemoteName-$timestamp.ps1"
    $Body | Set-Content -Path $local -Encoding UTF8
    & scp -q $local "${RemoteUser}:$RemoteWork/$RemoteName.ps1"
    if ($LASTEXITCODE -ne 0) { throw "No se pudo subir el script '$RemoteName' al servidor." }
    & ssh $RemoteUser "powershell -ExecutionPolicy Bypass -File `"$RemoteWork\$RemoteName.ps1`""
    if ($LASTEXITCODE -ne 0) { throw "Ejecucion remota de '$RemoteName' fallida." }
    Remove-Item $local -Force -ErrorAction SilentlyContinue
}

# --- 2. Remote backup --------------------------------------------------------
if (-not $SkipBackup) {
    Step 'Backup remoto de wwwroot'
    New-Item -ItemType Directory -Force -Path $backups | Out-Null

    $backupZip = "wwwroot-backup-$timestamp.zip"
    $body = @"
`$ErrorActionPreference = 'Stop'
`$ProgressPreference = 'SilentlyContinue'
if (-not (Test-Path '$RemoteWork')) { New-Item -ItemType Directory -Force -Path '$RemoteWork' | Out-Null }
if (Test-Path '$RemoteWork\$backupZip') { Remove-Item '$RemoteWork\$backupZip' -Force }
Compress-Archive -Path '$RemoteWwwroot\*' -DestinationPath '$RemoteWork\$backupZip' -Force
"@
    Invoke-RemoteScript -Body $body -RemoteName 'backup'

    & scp -q "${RemoteUser}:$RemoteWork/$backupZip" (Join-Path $backups $backupZip)
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo descargar el backup.' }
    # limpiar el zip temporal remoto una vez descargado
    & ssh $RemoteUser "powershell -Command `"Remove-Item '$RemoteWork\$backupZip' -Force -ErrorAction SilentlyContinue`""
    Ok "Backup: $backups\$backupZip"
} else {
    Warn 'Backup omitido (-SkipBackup).'
}

# --- 3. Package dist ---------------------------------------------------------
Step 'Empaquetando dist'
$distZip     = "dist-$timestamp.zip"
$distZipLocal = Join-Path $env:TEMP $distZip
if (Test-Path $distZipLocal) { Remove-Item $distZipLocal -Force }
Compress-Archive -Path "$dist\*" -DestinationPath $distZipLocal -Force

# --- 4. Publish --------------------------------------------------------------
Step 'Publicando dist a wwwroot'
& scp -q $distZipLocal "${RemoteUser}:$RemoteWork/$distZip"
if ($LASTEXITCODE -ne 0) { throw 'No se pudo subir el zip de dist.' }

$preserveList = ($Preserve | ForEach-Object { "'$_'" }) -join ','
$cleanBlock = if ($CleanRemote) {
    @"
`$preserve = @($preserveList)
Get-ChildItem -Path '$RemoteWwwroot' -Force -ErrorAction SilentlyContinue |
    Where-Object { `$_.Name -notin `$preserve } |
    Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
"@
} else { '' }

$body = @"
`$ErrorActionPreference = 'Stop'
`$ProgressPreference = 'SilentlyContinue'
if (-not (Test-Path '$RemoteWwwroot')) { New-Item -ItemType Directory -Force -Path '$RemoteWwwroot' | Out-Null }
$cleanBlock
Expand-Archive -Path '$RemoteWork\$distZip' -DestinationPath '$RemoteWwwroot' -Force
Remove-Item '$RemoteWork\$distZip' -Force -ErrorAction SilentlyContinue
Remove-Item '$RemoteWork\publish.ps1' -Force -ErrorAction SilentlyContinue
"@
Invoke-RemoteScript -Body $body -RemoteName 'publish'

# --- 5. Cleanup --------------------------------------------------------------
Step 'Limpieza'
Remove-Item $distZipLocal -Force -ErrorAction SilentlyContinue
& ssh $RemoteUser "powershell -Command `"Remove-Item '$RemoteWork\backup.ps1' -Force -ErrorAction SilentlyContinue`"" 2>$null

Step 'Deploy completado'
Ok "Backup : $backups\$backupZip"
Ok "Publicado en: $RemoteWwwroot"
