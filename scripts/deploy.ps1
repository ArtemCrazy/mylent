# Push to GitHub and update the server. Run from repo root: .\scripts\deploy.ps1
# The script fails fast on untracked files and local build errors so deployment
# problems are caught before anything reaches the VPS.

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$Server = "root@155.212.219.106"
$CommitMessage = "Updates from editor"

function Test-NonEmptyList {
  param([string[]]$Items)

  return @($Items | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }).Count -gt 0
}

function Get-OutputLines {
  param([scriptblock]$Script)

  $lines = & $Script
  if ($LASTEXITCODE -ne 0) {
    throw "Command failed with exit code $LASTEXITCODE."
  }

  return @($lines | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
}

function Invoke-FrontendBuild {
  $frontendDir = Join-Path $repoRoot "frontend"
  if (-not (Test-Path $frontendDir)) {
    return
  }

  Push-Location $frontendDir
  try {
    if (-not (Test-Path ".\node_modules\.bin\next.cmd")) {
      Write-Host "Installing frontend dependencies..."
      npm ci
      if ($LASTEXITCODE -ne 0) {
        throw "npm ci failed."
      }
    }

    Write-Host "Running local frontend build..."
    npm run build
    if ($LASTEXITCODE -ne 0) {
      throw "npm run build failed."
    }
  }
  finally {
    Pop-Location
  }
}

$root = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
$repoRoot = (Get-Item $root).Parent.FullName
Set-Location $repoRoot

$env:GIT_TERMINAL_PROMPT = "0"

$untracked = Get-OutputLines { git ls-files --others --exclude-standard }
if (Test-NonEmptyList $untracked) {
  Write-Host "Untracked files found. Commit or ignore them explicitly before deploy:" -ForegroundColor Yellow
  $untracked | ForEach-Object { Write-Host "  $_" -ForegroundColor Yellow }
  throw "Deployment stopped to avoid accidentally committing unrelated files."
}

$status = Get-OutputLines { git status --short }
if (Test-NonEmptyList $status) {
  Write-Host "Tracked changes detected:"
  $status | ForEach-Object { Write-Host "  $_" }

  Invoke-FrontendBuild

  Write-Host "Staging tracked changes..."
  git add -u
  if ($LASTEXITCODE -ne 0) {
    throw "git add -u failed."
  }

  $staged = Get-OutputLines { git diff --cached --name-only }
  if (-not (Test-NonEmptyList $staged)) {
    throw "There are changes in the working tree, but nothing is staged for commit."
  }

  Write-Host "Committing changes..."
  git commit -m $CommitMessage
  if ($LASTEXITCODE -ne 0) {
    throw "git commit failed."
  }

  Write-Host "Pushing to GitHub..."
  git push origin main
  if ($LASTEXITCODE -ne 0) {
    throw "git push failed."
  }

  Write-Host "GitHub push completed."
}
else {
  Write-Host "No local tracked changes. Deploying current origin/main state."
}

Write-Host "Updating server and rebuilding containers..."
$remoteCmd = "set -e; cd /root/mylent; git fetch origin; git reset --hard origin/main; sed -i 's/service_healthy_only/service_healthy/g' docker/docker-compose.yml 2>/dev/null || true; cd docker; docker compose up -d --build backend sync realtime digest frontend; docker compose ps"
ssh -o BatchMode=yes -o ConnectTimeout=15 $Server $remoteCmd
if ($LASTEXITCODE -ne 0) {
  throw "Remote deployment failed."
}

Write-Host "Deployment finished."
Write-Host "Site: http://155.212.219.106:3001"
