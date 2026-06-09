$rule = Get-NetFirewallRule -DisplayName "INTELASIST Backend" -ErrorAction SilentlyContinue

if ($rule) {
    Write-Host "Regla ya existe"
} else {
    Write-Host "Creando regla de firewall..."
    New-NetFirewallRule -DisplayName "INTELASIST Backend" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 3000 -Description "Backend INTELASIST"
    Write-Host "Regla creada"
}

Get-NetFirewallRule -DisplayName "INTELASIST Backend" -ErrorAction SilentlyContinue | Select-Object DisplayName, Enabled, Direction, Action
