# Push tracked changes to GitHub. Run from repo root: .\scripts\push.ps1

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
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

$root = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
$repoRoot = (Get-Item $root).Parent.FullName
Set-Location $repoRoot

$env:GIT_TERMINAL_PROMPT = "0"

$untracked = Get-OutputLines { git ls-files --others --exclude-standard }
if (Test-NonEmptyList $untracked) {
  Write-Host "Untracked files found. Commit or ignore them explicitly before push:" -ForegroundColor Yellow
  $untracked | ForEach-Object { Write-Host "  $_" -ForegroundColor Yellow }
  throw "Push stopped to avoid accidentally committing unrelated files."
}

$status = Get-OutputLines { git status --short }
if (-not (Test-NonEmptyList $status)) {
  Write-Host "No tracked changes to push."
  exit 0
}

Write-Host "Tracked changes detected:"
$status | ForEach-Object { Write-Host "  $_" }

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

Write-Host "Done: pushed to GitHub (main)."
