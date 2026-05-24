$ErrorActionPreference = "Continue"

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $projectRoot

Get-CimInstance Win32_Process |
  Where-Object {
    $_.CommandLine -like "*$projectRoot*" -and
    ($_.Name -eq "node.exe" -or $_.Name -eq "cmd.exe")
  } |
  ForEach-Object {
    Stop-Process -Id $_.ProcessId -Force
  }

npx prisma dev stop alexfrut | Out-Null

Write-Host "Local app and Prisma Dev server stopped." -ForegroundColor Green
