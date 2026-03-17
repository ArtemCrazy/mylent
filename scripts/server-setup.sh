#!/bin/bash
# Полная установка MyLent на чистый Ubuntu 24.04 (VPS)
# Запуск на сервере: скопировать весь скрипт в терминал или:
#   curl -sSL https://raw.githubusercontent.com/ArtemCrazy/mylent/main/scripts/server-setup.sh | bash
# Либо скопировать содержимое файла и вставить в SSH-сессию.

set -e
export DEBIAN_FRONTEND=noninteractive

echo "=== MyLent: установка на VPS ==="

# 1. Docker
if ! command -v docker &>/dev/null; then
  echo "[1/5] Установка Docker..."
  apt-get -qq update
  apt-get -qq install -y ca-certificates curl
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
  apt-get -qq update
  apt-get -qq install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  systemctl enable docker
  systemctl start docker
else
  echo "[1/5] Docker уже установлен."
fi

# 2. Git и клонирование
WORKDIR="/root/mylent"
if ! command -v git &>/dev/null; then
  apt-get -qq update && apt-get -qq install -y git
fi
echo "[2/5] Клонирование репозитория в $WORKDIR ..."
if [ -d "$WORKDIR" ]; then
  cd "$WORKDIR"
  git pull --quiet 2>/dev/null || true
else
  git clone --depth 1 https://github.com/ArtemCrazy/mylent.git "$WORKDIR"
  cd "$WORKDIR"
fi

# 3. .env
echo "[3/5] Настройка .env ..."
if [ ! -f "$WORKDIR/.env" ]; then
  cat > "$WORKDIR/.env" << 'ENVFILE'
SECRET_KEY=change-me-min-32-chars-mylent-prod-key
NEXT_PUBLIC_API_URL=http://155.212.219.106:8001
CORS_ORIGINS=http://155.212.219.106:3001,http://155.212.219.106
TELEGRAM_API_ID=
TELEGRAM_API_HASH=
ADMIN_LOGIN=
ADMIN_PASSWORD=
TELEGRAM_CHANNELS=
ENVFILE
  echo "    Создан .env. Заполните TELEGRAM_*, SECRET_KEY и при желании ADMIN_LOGIN, ADMIN_PASSWORD, TELEGRAM_CHANNELS (каналы через запятую)."
else
  echo "    .env уже есть."
fi

# 4. Сборка и запуск
echo "[4/5] Сборка и запуск контейнеров..."
cd "$WORKDIR/docker"
docker compose build --quiet 2>/dev/null || docker compose build
docker compose up -d

# 5. Ждём запуска backend
echo "[5/5] Ожидание запуска сервисов..."
sleep 10
for i in 1 2 3 4 5 6 7 8 9 10; do
  if curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8001/health 2>/dev/null | grep -q 200; then
    break
  fi
  sleep 2
done

echo ""
echo "=============================================="
echo "  MyLent развёрнут."
echo "  Сайт:    http://155.212.219.106:3001"
echo "  API:     http://155.212.219.106:8001"
echo "=============================================="
echo ""
echo "Дальше выполните на сервере (по очереди):"
echo ""
echo "  1) Создать пользователя для входа:"
echo "     cd /root/mylent/docker && docker compose exec backend python -m scripts.create_user"
echo ""
echo "  2) Один раз войти в Telegram (импорт каналов):"
echo "     docker compose exec -it backend python -m scripts.telegram_sync"
echo ""
echo "  3) Включить подтягивание постов раз в 10 мин:"
echo "     docker compose exec -d backend python -m scripts.telegram_sync_loop"
echo ""
echo "Рекомендуется сменить пароль root и в .env задать SECRET_KEY и TELEGRAM_*."
echo ""
