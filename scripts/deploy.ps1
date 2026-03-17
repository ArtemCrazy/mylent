# Push to GitHub and update the server. Run from repo root: .\scripts\deploy.ps1
# One-time: set up SSH key so you are not asked for password (see docs/DEPLOY-AUTO.md)

$ErrorActionPreference = "Stop"
$Server = "root@155.212.219.106"
$root = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
$repoRoot = (Get-Item $root).Parent.FullName
Set-Location $repoRoot

# 1. Push to GitHub (if there are changes)
$status = git status --short 2>$null
if ($status) {
  Write-Host "Pushing changes to GitHub..."
  git add -A
  git commit -m "Updates from editor"
  git push
  Write-Host "Pushed."
} else {
  Write-Host "No local changes. Updating server from current GitHub state."
}

# 2. On server: fetch, reset to main, fix compose if needed, build and run
Write-Host "Updating server and rebuilding..."
$remoteCmd = "cd /root/mylent && git fetch origin && git reset --hard origin/main && sed -i 's/service_healthy_only/service_healthy/g' docker/docker-compose.yml 2>/dev/null; cd docker && docker compose build --no-cache frontend && docker compose up -d"
ssh $Server $remoteCmd
Write-Host "Done. Site: http://155.212.219.106:3001"