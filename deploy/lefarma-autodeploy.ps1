# lefarma-autodeploy.ps1 — vive en el servidor 192.168.4.2.
# Scheduled Task cada 5 min: busca pre-releases nuevos en GitHub y publica en staging.
#   pre-release (v*-rc.*)  -> carpeta staging
#   # release   (v*)       -> produccion: DESHABILITADO por ahora (bloques comentados abajo)
# Sin logica de versiones: tag distinto al ultimo desplegado -> desplegar.

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"  # sin consola (ssh/task) el progress bar de IWR muere con 0x5
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12  # PS 5.1
Import-Module WebAdministration  # Stop/Start-WebAppPool para soltar locks de DLLs (app_offline.htm no alcanzaba)

# ============ CONFIG (llenar) ============
$Owner     = "GrupoLefarma2025"
$Repo      = "01-lefarma-project"
$BaseDir   = "C:\LefarmaDeploy"
$TokenFile = "$BaseDir\.token"        # contiene el PAT; solo Administradores lo leen
$Targets = @{
    qa   = "D:\DevApps\DevLefarma"   # sitio IIS "Development", pool Dev-Lefarma, :5073
    # prod = ""  # PRODUCCION deshabilitado: descomentar y llenar path cuando se active
}
$AppPools = @{
    qa   = "Dev-Lefarma"
    # prod = ""
}
# =========================================

$StateDir = "$BaseDir\state"
$WorkDir  = "$BaseDir\work"
$LogFile  = "$BaseDir\autodeploy.log"

# Fuente propia en el Visor de Eventos (Windows > Aplicacion). Se registra una sola vez; requiere ser Admin.
$EventSource = "LefarmaAutoDeploy"
try {
    if (-not [System.Diagnostics.EventLog]::SourceExists($EventSource)) {
        [System.Diagnostics.EventLog]::CreateEventSource($EventSource, "Application")
    }
} catch { }  # sin permisos de Admin: sigue funcionando con archivo + consola

function Log($msg, $level = "Information") {
    $line = "{0} | {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $msg
    Add-Content -LiteralPath $LogFile -Value $line
    Write-Output $line  # visible en corrida manual; Write-Host muere sin consola (ssh/task sin sesion)
    try {
        $type = switch ($level) {
            "Error"       { [System.Diagnostics.EventLogEntryType]::Error }
            "Warning"     { [System.Diagnostics.EventLogEntryType]::Warning }
            default       { [System.Diagnostics.EventLogEntryType]::Information }
        }
        Write-EventLog -LogName Application -Source $EventSource -EventId 1000 -EntryType $type -Message $line
    } catch { }
}

function Get-LatestRelease([bool]$Pre) {
    $list = Invoke-RestMethod -Uri "https://api.github.com/repos/$Owner/$Repo/releases?per_page=20" `
            -Headers @{ Authorization = "Bearer $token"; Accept = "application/vnd.github+json" }
    $list | Where-Object { $_.prerelease -eq $Pre -and -not $_.draft } | Select-Object -First 1
}

function Deploy($rel, $target, $pool, $stateFile) {
    $last = if (Test-Path $stateFile) { (Get-Content $stateFile -Raw).Trim() } else { "" }
    if ($rel.tag_name -eq $last) { return }

    $asset = $rel.assets | Select-Object -First 1
    if (-not $asset) { Log "WARN $($rel.tag_name) sin zip, saltando" "Warning"; return }

    Log "NUEVO $($rel.tag_name) -> $target"
    $zip = Join-Path $WorkDir $asset.name
    Invoke-WebRequest -Uri $asset.browser_download_url -Headers @{ Authorization = "Bearer $token" } -OutFile $zip

    $tmp = Join-Path $WorkDir ("x-" + [guid]::NewGuid().ToString("N"))
    Expand-Archive -LiteralPath $zip -DestinationPath $tmp -Force

    # Detener el App Pool suelta los locks de DLLs (w3wp.exe muere). app_offline.htm no era confiable.
    if ($pool) {
        Stop-WebAppPool -Name $pool
        # esperar a que el pool quede realmente detenido (hasta 5s)
        for ($i = 0; $i -lt 10; $i++) {
            if ((Get-WebAppPoolState -Name $pool) -eq 'Stopped') { break }
            Start-Sleep -Milliseconds 500
        }
        Start-Sleep -Seconds 1  # margen para que w3wp.exe libere los locks de DLLs
    }

    # /E sobreescribe sin borrar archivos extra del destino; /XF protege configs por doble seguro
    # ponytail: quedan DLLs huerfanos de versiones previas; si estorba, /MIR + /XF de estas mismas exclusiones
    robocopy $tmp $target /E /XF appsettings*.json web.config app_offline.htm /R:1 /W:1 /NFL /NDL /NJH /NJS | Out-Null
    if ($LASTEXITCODE -ge 8) { throw "robocopy fallo ($LASTEXITCODE)" }

    if ($pool) { Start-WebAppPool -Name $pool }  # la app levanta al primer request

    Set-Content -LiteralPath $stateFile -Value $rel.tag_name
    Remove-Item $zip, $tmp -Recurse -Force -ErrorAction SilentlyContinue
    Log "OK $($rel.tag_name) desplegado"
}

# ---- main ----
foreach ($d in @($StateDir, $WorkDir)) { New-Item -ItemType Directory -Path $d -Force | Out-Null }
if (-not (Test-Path $TokenFile)) { Log "ERROR: falta $TokenFile" "Error"; exit 1 }
$token = (Get-Content $TokenFile -Raw).Trim()

try {
    $qa = Get-LatestRelease $true
    if ($qa -and $Targets.qa) { Deploy $qa $Targets.qa $AppPools.qa "$StateDir\last-qa.txt" }
} catch { Log "ERROR qa: $_" "Error" }

# ---- PRODUCCION deshabilitado por ahora ----
# try {
#     $prod = Get-LatestRelease $false
#     if ($prod -and $Targets.prod) { Deploy $prod $Targets.prod $AppPools.prod "$StateDir\last-prod.txt" }
# } catch { Log "ERROR prod: $_" }
