# Выкладка MyLent в онлайн

Доступ к хостингу никому передавать не нужно — всё можно залить самому по этой инструкции.

## Что нужно для полной версии

| Часть | Где крутить | Зачем |
|-------|-------------|--------|
| **Фронт** (сайт) | Vercel (бесплатно) или тот же сервер | Лента, источники, настройки |
| **Бэкенд** (API) | VPS или Railway/Render | Логин, посты, БД |
| **БД** | На том же VPS или в облаке | PostgreSQL (или SQLite на одном сервере) |
| **Импорт из Telegram** | Тот же сервер, что и бэкенд | Скрипт `telegram_sync_loop` или `telegram_realtime` |

**Итог:** достаточно **одного VPS** (или одного аккаунта на Railway/Render), плюс при желании фронт на Vercel.

---

## Вариант A: Всё на одном VPS (Docker)

Подойдёт любой VPS с Docker и Docker Compose (Ubuntu 22.04, Debian, и т.п.).

### 1. Подготовка сервера

```bash
# Установка Docker и Docker Compose (если ещё нет)
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# выйти и зайти снова или: newgrp docker
```

### 2. Клонирование и настройка

```bash
git clone https://github.com/ArtemCrazy/mylent.git
cd mylent
```

Создайте файл `.env` в корне проекта (рядом с `docker-compose.yml`):

```env
# Обязательно смените на случайную длинную строку (32+ символов)
SECRET_KEY=ваш-секретный-ключ-минимум-32-символа

# URL, по которому пользователи заходят на сайт (без слэша в конце)
PUBLIC_URL=https://ваш-домен.ru

# Для импорта из Telegram (получить на https://my.telegram.org)
TELEGRAM_API_ID=
TELEGRAM_API_HASH=
```

В корне проекта создайте или дополните `.env` (для Docker Compose):

```env
# URL фронта, по которому пользователи заходят (для CORS и для переменной фронта)
PUBLIC_URL=https://ваш-домен.ru

# Фронт будет слать запросы сюда (если API за Nginx на том же домене — оставьте так)
NEXT_PUBLIC_API_URL=https://ваш-домен.ru/api

# Бэкенд: разрешить запросы с фронта (тот же домен или Vercel)
CORS_ORIGINS=https://ваш-домен.ru
```

Если фронт на Vercel, а API на отдельном домене (например `api.ваш-домен.ru`), то на Vercel задайте `NEXT_PUBLIC_API_URL=https://api.ваш-домен.ru`, а в `.env` бэкенда: `CORS_ORIGINS=https://ваш-проект.vercel.app`.

### 3. Запуск

```bash
cd mylent/docker
docker compose build
docker compose up -d
```

После этого:
- **Бэкенд** — порт 8000
- **Фронт** — порт 3000
- **PostgreSQL** — порт 5432 (внутри сети)

Настройте Nginx (или другой прокси) на домен: проксировать на `localhost:3000` (фронт) и, например, `/api` → `localhost:8000` (бэкенд). Либо отдавайте только фронт с 3000, а API — с 8000 по поддомену (api.ваш-домен.ru).

### 4. Первый пользователь и Telegram

На сервере один раз создайте пользователя и сессию Telegram:

```bash
cd mylent/backend
# лучше делать в venv на хосте или зайти в контейнер backend
docker compose -f docker/docker-compose.yml exec backend python -m scripts.create_user
# Логин и пароль введите свои

# Сессия Telegram (интерактивно: номер телефона, код)
docker compose exec backend python -m scripts.telegram_sync
```

После этого импорт можно держать включённым через цикл (раз в N минут):

```bash
docker compose exec -d backend python -m scripts.telegram_sync_loop
```

или настроить cron на хосте, который раз в 10–15 минут вызывает `docker compose exec backend python -m scripts.telegram_sync`.

### 5. Чек-лист перед выкладкой

- [ ] В `.env` задан **SECRET_KEY** (длинная случайная строка).
- [ ] В `.env` заданы **NEXT_PUBLIC_API_URL** и **CORS_ORIGINS** под ваш домен (или Vercel).
- [ ] Прокси (Nginx) отдаёт фронт и проксирует `/api` на бэкенд (или настроены два домена).
- [ ] Один раз выполнены `create_user` и `telegram_sync` для создания пользователя и сессии Telegram.
- [ ] Импорт из Telegram запущен: либо `telegram_sync_loop` в фоне, либо cron с `telegram_sync`.

---

## Вариант B: Фронт на Vercel, бэкенд на VPS/Railway

- **Фронт:** репозиторий на GitHub → [Vercel](https://vercel.com) → Import Project → указать `frontend` как root (или корень, если фронт в корне). В настройках проекта задать **Environment Variable**: `NEXT_PUBLIC_API_URL` = `https://ваш-api.домен.ru` (или `https://ваш-проект.railway.app`).
- **Бэкенд + БД + воркер:** как в варианте A на VPS (Docker) или один проект на [Railway](https://railway.app) / [Render](https://render.com): сервис API, PostgreSQL, и отдельно запуск `telegram_sync_loop` (через worker/background process, если хостинг это поддерживает).

Так вы не отдаёте никому доступ к хостингу: выкладываете код, настраиваете переменные и запускаете контейнеры/сервисы по инструкции выше.

---

## Нужен ли именно VPS?

| Вариант | Плюсы | Минусы |
|---------|--------|--------|
| **VPS** (Timeweb, Selectel, DigitalOcean, и т.д.) | Полный контроль, Docker, можно крутить realtime и cron | Нужно самому ставить Docker, Nginx, SSL |
| **Railway / Render** | Проще поднять бэкенд и БД по кнопке, привязать репо | Ограничения по фоновым процессам (realtime/loop), часто платно при росте нагрузки |

Для старта можно: **фронт на Vercel**, **бэкенд + БД на Railway** (или одном недорогом VPS). Доступ к хостингу давать не нужно — достаточно подготовить проект (как в варианте A) и залить по шагам из этой инструкции.
