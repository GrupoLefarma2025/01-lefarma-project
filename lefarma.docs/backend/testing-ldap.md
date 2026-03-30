# Testing de Autenticación LDAP

Guía para probar la conexión LDAP contra el Active Directory del dominio Artricenter.

## Prerequisitos

- Windows con PowerShell 5.1+
- Acceso de red al servidor LDAP (`192.168.4.2:389`)
- Credenciales de un usuario del dominio

## Script de Testing

El script prueba 3 formatos de autenticación contra el servidor LDAP:

```powershell
Add-Type -AssemblyName System.DirectoryServices.Protocols

$server = '192.168.4.2'
$port = 389
$username = 'carlos.guzman'
$password = 'TU_PASSWORD'
$domain = 'Artricenter'

Write-Host '=== LDAP Authentication Test ===' -ForegroundColor Cyan
Write-Host "Server: $server`:$port"
Write-Host "Domain: $domain"
Write-Host "User: $username"
Write-Host ""

# Test 1: DOMAIN\username format
Write-Host 'Test 1: DOMAIN\username format' -ForegroundColor Yellow
try {
    $identifier = New-Object System.DirectoryServices.Protocols.LdapDirectoryIdentifier($server, $port)
    $connection = New-Object System.DirectoryServices.Protocols.LdapConnection($identifier)
    $connection.SessionOptions.ProtocolVersion = 3
    $connection.AuthType = [System.DirectoryServices.Protocols.AuthType]::Basic
    $connection.Timeout = [TimeSpan]::FromSeconds(10)
    
    $domainUser = "$domain\$username"
    Write-Host "  Trying: $domainUser"
    $cred = New-Object System.Net.NetworkCredential($domainUser, $password)
    $connection.Bind($cred)
    Write-Host "  SUCCESS!" -ForegroundColor Green
    $connection.Dispose()
} catch {
    Write-Host "  FAILED: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""

# Test 2: UPN format (username@domain.com.mx)
Write-Host 'Test 2: UPN format (username@domain.com.mx)' -ForegroundColor Yellow
try {
    $identifier = New-Object System.DirectoryServices.Protocols.LdapDirectoryIdentifier($server, $port)
    $connection = New-Object System.DirectoryServices.Protocols.LdapConnection($identifier)
    $connection.SessionOptions.ProtocolVersion = 3
    $connection.AuthType = [System.DirectoryServices.Protocols.AuthType]::Basic
    $connection.Timeout = [TimeSpan]::FromSeconds(10)
    
    $upn = "$username@$domain.com.mx"
    Write-Host "  Trying: $upn"
    $cred = New-Object System.Net.NetworkCredential($upn, $password)
    $connection.Bind($cred)
    Write-Host "  SUCCESS!" -ForegroundColor Green
    $connection.Dispose()
} catch {
    Write-Host "  FAILED: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""

# Test 3: Simple username
Write-Host 'Test 3: Simple username (no domain prefix)' -ForegroundColor Yellow
try {
    $identifier = New-Object System.DirectoryServices.Protocols.LdapDirectoryIdentifier($server, $port)
    $connection = New-Object System.DirectoryServices.Protocols.LdapConnection($identifier)
    $connection.SessionOptions.ProtocolVersion = 3
    $connection.AuthType = [System.DirectoryServices.Protocols.AuthType]::Basic
    $connection.Timeout = [TimeSpan]::FromSeconds(10)
    
    Write-Host "  Trying: $username"
    $cred = New-Object System.Net.NetworkCredential($username, $password)
    $connection.Bind($cred)
    Write-Host "  SUCCESS!" -ForegroundColor Green
    $connection.Dispose()
} catch {
    Write-Host "  FAILED: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host '=== Test Complete ===' -ForegroundColor Cyan
```

## Cómo Usar

1. Copiar el script a un archivo `.ps1` (ej: `test-ldap.ps1`)
2. Actualizar las variables `$username`, `$password` y `$domain` según corresponda
3. Ejecutar desde PowerShell:
   ```powershell
   .\test-ldap.ps1
   ```

## Formatos Probados

| # | Formato | Ejemplo | Descripción |
|---|---------|---------|-------------|
| 1 | `DOMAIN\username` | `Artricenter\carlos.guzman` | NetBIOS con dominio |
| 2 | `username@domain.com.mx` | `carlos.guzman@Artricenter.com.mx` | User Principal Name (UPN) |
| 3 | `username` | `carlos.guzman` | Username simple sin prefijo |

## Configuración Utilizada

- **Protocolo**: LDAP v3
- **AuthType**: Basic
- **Timeout**: 10 segundos
- **Librería**: `System.DirectoryServices.Protocols` (nativa de .NET)

## Notas

- El formato que funcione es el que debe configurarse en `appsettings.json` del backend para el servicio de autenticación LDAP.
- Si todos los tests fallan, verificar conectividad de red al servidor y que las credenciales sean correctas.
- El puerto `389` es LDAP estándar (sin encriptar). Para LDAPS usar puerto `636`.
