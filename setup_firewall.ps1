$rule = Get-NetFirewallRule -DisplayName "INTELASIST Backend" -ErrorAction SilentlyContinue

if ($rule) {
    Write-Host "✓ Regla ya existe"
    Get-NetFirewallRule -DisplayName "INTELASIST Backend" | Format-List DisplayName, Enabled, Direction, Action
} else {
    Write-Host "Creando regla de firewall..."
    New-NetFirewallRule -DisplayName "INTELASIST Backend" `
        -Direction Inbound `
        -Action Allow `
        -Protocol TCP `
        -LocalPort 3000 `
        -Description "Permitir acceso al backend de INTELASIST" | Out-Null
    
    Write-Host "✓ Regla creada exitosamente"
    Get-NetFirewallRule -DisplayName "INTELASIST Backend" | Format-List DisplayName, Enabled, Direction, Action
}
