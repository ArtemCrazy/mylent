#!/bin/bash
# Развёртывание MyLent на VPS (Ubuntu/Debian)
# Запуск: bash deploy-vps.sh
# Перед запуском задайте в .env на сервере: SECRET_KEY, NEXT_PUBLIC_API_URL, CORS_ORIGINS, TELEGRAM_*

set -e
echo "=== MyLent: установка зависимостей и запуск ==="

# Установка Docker, если ещё нет
if ! command -v docker &>/dev/null; then
  echo "Устанавливаю Docker..."
  curl -fsSL https://get.docker.com | sh
  systemctl enable docker
  systemctl start docker
fi
if ! command -v docker compose &>/dev/null && ! docker compose version &>/dev/null 2>&1; then
  echo "Устанавливаю Docker Compose plugin..."
  apt-get update -qq && apt-get install -y -qq docker-compose-plugin 2>/dev/null || true
fi

# Переход в каталог проекта (скрипт лежит в mylent/scripts/)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_DIR"

if [ ! -f "docker/docker-compose.yml" ]; then
  echo "Ошибка: запустите скрипт из репозитория mylent (в папке должен быть docker/docker-compose.yml)"
  exit 1
fi

# Создание .env из примера, если нет
if [ ! -f ".env" ]; then
  echo "Создаю .env из примера. Обязательно отредактируйте .env: SECRET_KEY, NEXT_PUBLIC_API_URL, CORS_ORIGINS"
  cp backend/.env.example .env 2>/dev/null || true
  [ -f .env ] || touch .env
fi

echo "Сборка и запуск контейнеров..."
cd docker
docker compose build --quiet
docker compose up -d

echo ""
echo "Готово. Сервисы:"
echo "  - Backend (API):  http://155.212.219.106:8000"
echo "  - Frontend:       http://155.212.219.106:3000"
echo ""
echo "Дальше:"
echo "  1. Создайте пользователя: docker compose exec backend python -m scripts.create_user"
echo "  2. Один раз войдите в Telegram: docker compose exec -it backend python -m scripts.telegram_sync"
echo "  3. Запустите периодический импорт: docker compose exec -d backend python -m scripts.telegram_sync_loop"
echo ""
echo "Чтобы подставить свой домен и HTTPS — настройте Nginx и задайте в .env NEXT_PUBLIC_API_URL и CORS_ORIGINS."
