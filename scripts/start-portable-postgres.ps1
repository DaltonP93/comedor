# Inicia el Postgres incluido en .postgres-portable (puerto 55432, auth trust localhost).
$ErrorActionPreference = 'Stop'
$base = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$data = Join-Path $base '.pgdata'
$pgCtl = Join-Path $base '.postgres-portable\pgsql\bin\pg_ctl.exe'
if (-not (Test-Path $pgCtl)) {
  Write-Error 'Falta .postgres-portable. Descarga el zip binaries desde EnterpriseDB y descomprimelo ahí, o usa Docker Compose postgres.'
}
& $pgCtl -D $data status 2>$null | Out-Null
if ($LASTEXITCODE -eq 0) {
  Write-Host 'PostgreSQL ya está en ejecución.'
  exit 0
}
& $pgCtl -D $data -l (Join-Path $data 'log.txt') -o '-p 55432' start
Write-Host 'PostgreSQL iniciado en 127.0.0.1:55432'
