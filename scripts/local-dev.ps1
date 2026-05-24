$ErrorActionPreference = "Stop"

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $projectRoot

& (Join-Path $PSScriptRoot "local-bootstrap.ps1")

Write-Host ""
Write-Host "Starting Next.js dev server on http://127.0.0.1:3000" -ForegroundColor Green
npm run dev -- --hostname 127.0.0.1 --port 3000
