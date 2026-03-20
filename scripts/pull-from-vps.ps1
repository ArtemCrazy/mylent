$ErrorActionPreference = "Stop"
$Server = "root@155.212.219.106"
$root = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
$repoRoot = (Get-Item $root).Parent.FullName
Set-Location $repoRoot

Write-Host "=== Шаг 1: Создание коммита на сервере (если есть новые изменения)... ==="
$remoteCmd = "cd /root/mylent && git add -A && git commit -m 'Updates from VPS server' 2>/dev/null; exit 0"
ssh $Server $remoteCmd

Write-Host ""
Write-Host "=== Шаг 2: Скачивание изменений напрямую с сервера по SSH... ==="
git pull root@155.212.219.106:/root/mylent main

Write-Host ""
Write-Host "=== Шаг 3: Отправка скачанных обновлений на GitHub... ==="
git push origin main

Write-Host "Синхронизация полностью завершена! Сервер, ваш компьютер и GitHub теперь идентичны."
