# MyLent — персональная AI-лента

Веб-сервис для агрегации публикаций из Telegram-каналов (и в перспективе RSS, сайтов и др.) в единую ленту с AI-обработкой: summary, теги, важность, дайджесты.

## Стек

- **Frontend:** Next.js 14, TypeScript, Tailwind CSS
- **Backend:** FastAPI, Python 3.11+
- **БД:** PostgreSQL
- **Импорт:** Python worker (Telethon) — в разработке
- **AI:** OpenAI API — в разработке

## Структура проекта

```
mylent/
├── backend/          # FastAPI API
├── frontend/         # Next.js SPA
├── workers/          # Telegram ingest + AI pipeline (позже)
├── docker/           # Docker Compose и Dockerfile
└── docs/             # PRD, архитектура
```

## Быстрый старт

**Всё уже установлено:** зависимости backend и frontend, SQLite по умолчанию (PostgreSQL не нужен для разработки), создан пользователь **admin@mylent.local** / **admin**.

### Один скрипт установки (если с нуля)

```powershell
.\scripts\setup.ps1
```

Скрипт создаёт venv, ставит зависимости, создаёт `.env` и пользователя по умолчанию.

### Запуск

**Backend** (из папки `backend`):

```powershell
.\.venv\Scripts\Activate.ps1
uvicorn app.main:app --reload --port 8000
```

**Frontend** (из папки `frontend`):

```powershell
npm run dev
```

Откройте **http://localhost:3000** → «Вход» → **admin@mylent.local** / **admin**.

### Импорт постов из Telegram

Чтобы посты из добавленных каналов появились в ленте:

1. Получи **API ID** и **API Hash** на [my.telegram.org](https://my.telegram.org) (раздел «API development tools»).
2. В `backend/.env` добавь:
   ```
   TELEGRAM_API_ID=твой_api_id
   TELEGRAM_API_HASH=твой_api_hash
   ```
3. Из папки `backend` запусти:
   ```powershell
   .\.venv\Scripts\Activate.ps1
   python -m scripts.telegram_sync
   ```
   При первом запуске скрипт попросит номер телефона и код из Telegram — после этого сессия сохранится в `data/telegram_session.session`.
4. Лента в браузере обновляется автоматически каждые 45 секунд — посты появятся без перезагрузки страницы.

**Как подтягивать новые посты (выбери один вариант):**

- **Реал-тайм** — новые посты попадают в ленту сразу после публикации. Запусти и оставь работать в отдельном терминале:
  ```powershell
  cd backend
  .\.venv\Scripts\python.exe -m scripts.telegram_realtime
  ```
  Список каналов перечитывается из БД каждые 90 секунд — только что добавленные источники подхватываются без перезапуска.

- **Периодический импорт** — раз в 10 минут запускается полный sync (без постоянного подключения к Telegram):
  ```powershell
  cd backend
  .\.venv\Scripts\python.exe -m scripts.telegram_sync_loop
  ```
  Интервал задаётся переменной `SYNC_INTERVAL_MINUTES` (по умолчанию 10).

- **По расписанию (cron / Планировщик заданий):** добавь задачу, которая раз в N минут запускает `python -m scripts.telegram_sync` из папки `backend`.

### База данных

- По умолчанию используется **SQLite** (`backend/mylent.db`) — ничего дополнительно ставить не нужно.
- Для **PostgreSQL** задайте в `backend/.env`:
  - `DATABASE_URL=postgresql+asyncpg://mylent:mylent@localhost:5432/mylent`
  - `DATABASE_URL_SYNC=postgresql://mylent:mylent@localhost:5432/mylent`
  и поднимите PostgreSQL (Docker или локально).

## API (основное)

- `POST /api/auth/login` — вход (email, password)
- `GET /api/auth/me` — текущий пользователь (Bearer token)
- `GET /api/sources` — список источников
- `POST /api/sources` — добавить источник
- `GET /api/posts` — лента (query: source_id, only_favorites, only_unread, only_for_studio, sort, limit, offset)
- `GET /api/posts/{id}` — один пост
- `POST /api/posts/{id}/favorite` — в избранное / убрать
- `GET /api/search?q=...` — поиск
- `GET /api/digests` — список дайджестов
- `GET /api/settings`, `PATCH /api/settings` — настройки

## Документация

- [PRD](docs/PRD.md) — продукт и цели
- [Архитектура](docs/ARCHITECTURE.md) — компоненты, БД, API

## Дальнейшие шаги (по ТЗ)

1. **Этап 2:** Telegram ingestion — worker на Telethon, синхронизация каналов, дедупликация.
2. **Этап 4:** AI-слой — summary, теги, тема, важность (OpenAI), сохранение в `ai_analyses`.
3. **Этап 5:** Генерация дайджестов по расписанию или по кнопке.
4. **Этап 6:** Полировка UI, пустые состояния, полнотекстовый поиск (PostgreSQL FTS).

ТЗ заложено в структуру проекта и сущности; детали — в `docs/`.
