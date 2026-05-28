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
$databaseUrl = $server.exports.database.connectionString -replace "localhost", "127.0.0.1"

function Get-ExistingEnvValue {
  param([string]$Name)

  if (-not (Test-Path ".env.local")) {
    return ""
  }

  $line = Get-Content ".env.local" | Where-Object { $_ -like "$Name=*" } | Select-Object -First 1

  if (-not $line) {
    return ""
  }

  return $line.Substring($Name.Length + 1)
}

$dadataApiKey = Get-ExistingEnvValue "DADATA_API_KEY"
$webPushPublicKey = Get-ExistingEnvValue "NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY"
$webPushPrivateKey = Get-ExistingEnvValue "WEB_PUSH_PRIVATE_KEY"
$webPushSubject = Get-ExistingEnvValue "WEB_PUSH_SUBJECT"

if (-not $webPushSubject -or $webPushSubject -like "*serveousercontent.com*") {
  $webPushSubject = "mailto:admin@alexfrut.local"
}

$envContent = @"
DATABASE_URL=$databaseUrl
DATABASE_POOL_MAX=1
JWT_SECRET=local-dev-secret-change-me
APP_URL=http://127.0.0.1:3000
YANDEX_MAPS_API_KEY=
DADATA_API_KEY=$dadataApiKey
NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY=$webPushPublicKey
WEB_PUSH_PRIVATE_KEY=$webPushPrivateKey
WEB_PUSH_SUBJECT=$webPushSubject
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
$env:DATABASE_POOL_MAX = "1"
$env:JWT_SECRET = "local-dev-secret-change-me"
$env:APP_URL = "http://127.0.0.1:3000"
$env:DADATA_API_KEY = $dadataApiKey
$env:NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY = $webPushPublicKey
$env:WEB_PUSH_PRIVATE_KEY = $webPushPrivateKey
$env:WEB_PUSH_SUBJECT = $webPushSubject
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
