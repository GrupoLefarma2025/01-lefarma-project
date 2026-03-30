Add-Type -AssemblyName System.DirectoryServices.Protocols

$server = '192.168.4.2'
$port = 389
$username = 'carlos.guzman'
$password = '3A4a6P6m'
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
