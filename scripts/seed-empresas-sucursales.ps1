# Script para poblar catálogos de Empresas y Sucursales
$ErrorActionPreference = "Stop"

$ApiUrl = "http://localhost:5000/api"

# Primero obtener token de autenticación
Write-Host "Autenticando..." -ForegroundColor Cyan

$loginBody = @{
    username = "admin@asokam.com"
    password = "tt01tt"
    selectedEmpresaId = 1
    selectedSucursalId = 101
} | ConvertTo-Json

try {
    $loginResponse = Invoke-RestMethod -Uri "$ApiUrl/auth/login" -Method Post -Body $loginBody -ContentType "application/json"
    $token = $loginResponse.data.token
    Write-Host "✓ Autenticación exitosa" -ForegroundColor Green
}
catch {
    Write-Host "✗ Error de autenticación: $_" -ForegroundColor Red
    exit 1
}

$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type" = "application/json"
}

# Obtener empresas existentes
Write-Host "`nObteniendo empresas existentes..." -ForegroundColor Cyan
$empresasResponse = Invoke-RestMethod -Uri "$ApiUrl/catalogos/empresas" -Method Get -Headers $headers
$empresasExistentes = $empresasResponse.data
$empresaMap = @{}

foreach ($emp in $empresasExistentes) {
    $empresaMap[$emp.nombre] = $emp.idEmpresa
    Write-Host "  - $($emp.nombre) (ID: $($emp.idEmpresa), Clave: $($emp.clave))" -ForegroundColor Gray
}

# Función para crear empresa si no existe
function Get-OrCreate-Empresa {
    param(
        [string]$Nombre,
        [string]$Clave,
        [string]$Descripcion = ""
    )

    if ($empresaMap.ContainsKey($Nombre)) {
        Write-Host "✓ Empresa existente: $Nombre (ID: $($empresaMap[$Nombre]))" -ForegroundColor Yellow
        return $empresaMap[$Nombre]
    }

    $body = @{
        nombre = $Nombre
        clave = $Clave
        descripcion = $Descripcion
        activo = $true
    } | ConvertTo-Json

    try {
        $response = Invoke-RestMethod -Uri "$ApiUrl/catalogos/empresas" -Method Post -Body $body -Headers $headers
        Write-Host "✓ Empresa creada: $Nombre (ID: $($response.data.idEmpresa))" -ForegroundColor Green
        $empresaMap[$Nombre] = $response.data.idEmpresa
        return $response.data.idEmpresa
    }
    catch {
        Write-Host "✗ Error creando empresa $Nombre`: $_" -ForegroundColor Red
        return $null
    }
}

# Obtener sucursales existentes
Write-Host "`nObteniendo sucursales existentes..." -ForegroundColor Cyan
$sucursalesResponse = Invoke-RestMethod -Uri "$ApiUrl/catalogos/sucursales" -Method Get -Headers $headers
$sucursalesExistentes = $sucursalesResponse.data
$sucursalMap = @{}

foreach ($suc in $sucursalesExistentes) {
    $key = "$($suc.idEmpresa)-$($suc.nombre)"
    $sucursalMap[$key] = $suc.idSucursal
    Write-Host "  - $($suc.nombre) (Empresa: $($suc.idEmpresa), ID: $($suc.idSucursal))" -ForegroundColor Gray
}

# Función para crear sucursal si no existe
function Get-OrCreate-Sucursal {
    param(
        [int]$IdEmpresa,
        [string]$Nombre,
        [string]$Clave
    )

    $key = "$IdEmpresa-$Nombre"
    if ($sucursalMap.ContainsKey($key)) {
        Write-Host "  ✓ Sucursal existente: $Nombre (ID: $($sucursalMap[$key]))" -ForegroundColor DarkYellow
        return $sucursalMap[$key]
    }

    $body = @{
        idEmpresa = $IdEmpresa
        nombre = $Nombre
        clave = $Clave
        latitud = 0
        longitud = 0
        activo = $true
    } | ConvertTo-Json

    try {
        $response = Invoke-RestMethod -Uri "$ApiUrl/catalogos/sucursales" -Method Post -Body $body -Headers $headers
        Write-Host "  ✓ Sucursal creada: $Nombre (ID: $($response.data.idSucursal))" -ForegroundColor Green
        return $response.data.idSucursal
    }
    catch {
        Write-Host "  ✗ Error creando sucursal $Nombre`: $_" -ForegroundColor Red
        return $null
    }
}

Write-Host "`n=== Procesando Empresas ===" -ForegroundColor Cyan

# Asegurar que todas las empresas existan
$idAsokam = Get-OrCreate-Empresa -Nombre "Asokam" -Clave "ASK" -Descripcion "Asokam S.A. de C.V."
$idLefarma = Get-OrCreate-Empresa -Nombre "Lefarma" -Clave "LEF" -Descripcion "Lefarma S.A. de C.V."
$idArtricenter = Get-OrCreate-Empresa -Nombre "Artricenter" -Clave "ATC" -Descripcion "Artricenter S.A. de C.V."
$idConstrumedika = Get-OrCreate-Empresa -Nombre "Construmedika" -Clave "CON" -Descripcion "Construmedika S.A. de C.V."
$idGrupoLefarma = Get-OrCreate-Empresa -Nombre "GrupoLefarma" -Clave "GRP" -Descripcion "Grupo Lefarma Corporativo"

Write-Host "`n=== Procesando Sucursales ===" -ForegroundColor Cyan

# Sucursales de Asokam
if ($idAsokam) {
    Write-Host "`nSucursales de Asokam (ID: $idAsokam):" -ForegroundColor Yellow
    Get-OrCreate-Sucursal -IdEmpresa $idAsokam -Nombre "Antonio Maura" -Clave "101"
    Get-OrCreate-Sucursal -IdEmpresa $idAsokam -Nombre "Guadalajara" -Clave "102"
    Get-OrCreate-Sucursal -IdEmpresa $idAsokam -Nombre "Cedis" -Clave "103"
}

# Sucursales de Lefarma
if ($idLefarma) {
    Write-Host "`nSucursales de Lefarma (ID: $idLefarma):" -ForegroundColor Yellow
    Get-OrCreate-Sucursal -IdEmpresa $idLefarma -Nombre "Planta" -Clave "101"
    Get-OrCreate-Sucursal -IdEmpresa $idLefarma -Nombre "Mancera" -Clave "102"
}

# Sucursales de Artricenter
if ($idArtricenter) {
    Write-Host "`nSucursales de Artricenter (ID: $idArtricenter):" -ForegroundColor Yellow
    Get-OrCreate-Sucursal -IdEmpresa $idArtricenter -Nombre "Viaducto" -Clave "101"
    Get-OrCreate-Sucursal -IdEmpresa $idArtricenter -Nombre "La Raza" -Clave "102"
    Get-OrCreate-Sucursal -IdEmpresa $idArtricenter -Nombre "Atizapan" -Clave "103"
}

# Sucursales de Construmedika
if ($idConstrumedika) {
    Write-Host "`nSucursales de Construmedika (ID: $idConstrumedika):" -ForegroundColor Yellow
    Get-OrCreate-Sucursal -IdEmpresa $idConstrumedika -Nombre "Unica" -Clave "001"
}

# Sucursales de Grupo Lefarma
if ($idGrupoLefarma) {
    Write-Host "`nSucursales de Grupo Lefarma (ID: $idGrupoLefarma):" -ForegroundColor Yellow
    Get-OrCreate-Sucursal -IdEmpresa $idGrupoLefarma -Nombre "Oficinas centrales" -Clave "001"
}

Write-Host "`n✓ Proceso completado" -ForegroundColor Green
Write-Host "`nResumen esperado:" -ForegroundColor Cyan
Write-Host "- 5 Empresas (Asokam, Lefarma, Artricenter, Construmedika, GrupoLefarma)" -ForegroundColor White
Write-Host "- 12 Sucursales totales" -ForegroundColor White
Write-Host "  * Asokam: 3 sucursales (Antonio Maura, Guadalajara, Cedis)" -ForegroundColor White
Write-Host "  * Lefarma: 2 sucursales (Planta, Mancera)" -ForegroundColor White
Write-Host "  * Artricenter: 3 sucursales (Viaducto, La Raza, Atizapan)" -ForegroundColor White
Write-Host "  * Construmedika: 1 sucursal (Unica)" -ForegroundColor White
Write-Host "  * GrupoLefarma: 1 sucursal (Oficinas centrales)" -ForegroundColor White
