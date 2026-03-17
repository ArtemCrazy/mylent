# Push all changes to GitHub. Run from repo root: .\scripts\push.ps1
$ErrorActionPreference = "Stop"
$root = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
$repoRoot = (Get-Item $root).Parent.FullName
Set-Location $repoRoot

$status = git status --short 2>$null
if (-not $status) {
  Write-Host "No changes to commit."
  exit 0
}

Write-Host "Changes:"
git status --short
Write-Host ""
git add -A
git commit -m "Updates from editor"
git push
Write-Host "Done: pushed to GitHub (main)."
