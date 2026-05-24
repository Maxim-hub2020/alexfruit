$ErrorActionPreference = "Stop"

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $projectRoot

Write-Host "Starting Prisma Dev server..." -ForegroundColor Green
npx prisma dev -d -n alexfrut | Out-Null

$serverFile = Join-Path $env:LOCALAPPDATA "prisma-dev-nodejs\Data\alexfrut\server.json"
$deadline = (Get-Date).AddSeconds(20)

while (-not (Test-Path $serverFile)) {
  if ((Get-Date) -gt $deadline) {
    throw "Prisma Dev server info was not created in time."
  }

  Start-Sleep -Seconds 1
}

$server = Get-Content $serverFile | ConvertFrom-Json
$databaseUrl = $server.exports.database.prismaORMConnectionString

$envContent = @"
DATABASE_URL=$databaseUrl
JWT_SECRET=local-dev-secret-change-me
APP_URL=http://127.0.0.1:3000
YANDEX_MAPS_API_KEY=
STORAGE_ACCESS_KEY=
STORAGE_SECRET_KEY=
STORAGE_BUCKET=
STORAGE_ENDPOINT=
DEFAULT_ADMIN_EMAIL=admin@alexfrut.local
DEFAULT_ADMIN_PASSWORD=admin12345
DEFAULT_COURIER_EMAIL=courier@alexfrut.local
DEFAULT_COURIER_PASSWORD=courier12345
DEFAULT_CUSTOMER_EMAIL=customer@alexfrut.local
DEFAULT_CUSTOMER_PASSWORD=customer12345
"@

Set-Content -Path ".env.local" -Value $envContent -Encoding utf8

$env:DATABASE_URL = $databaseUrl
$env:JWT_SECRET = "local-dev-secret-change-me"
$env:APP_URL = "http://127.0.0.1:3000"
$env:DEFAULT_ADMIN_EMAIL = "admin@alexfrut.local"
$env:DEFAULT_ADMIN_PASSWORD = "admin12345"
$env:DEFAULT_COURIER_EMAIL = "courier@alexfrut.local"
$env:DEFAULT_COURIER_PASSWORD = "courier12345"
$env:DEFAULT_CUSTOMER_EMAIL = "customer@alexfrut.local"
$env:DEFAULT_CUSTOMER_PASSWORD = "customer12345"

Write-Host "Generating Prisma client..." -ForegroundColor Green
npm run db:generate

Write-Host "Applying migrations..." -ForegroundColor Green
npx prisma migrate deploy

Write-Host "Seeding demo data..." -ForegroundColor Green
npm run db:seed

Write-Host ""
Write-Host "Local environment is ready." -ForegroundColor Green
Write-Host "Database URL is written to .env.local" -ForegroundColor DarkGreen
