# Техническая архитектура MyLent

## Стек
- **Frontend:** Next.js 14+, TypeScript, Tailwind CSS, shadcn/ui, React Query
- **Backend:** FastAPI, Python 3.11+
- **БД:** PostgreSQL
- **Импорт Telegram:** Python worker (Telethon)
- **AI:** OpenAI API
- **Очереди/фоновые задачи:** Redis + RQ/Celery или cron на MVP
- **Инфра:** Docker, Nginx, env для секретов

## Структура репозитория

```
mylent/
├── backend/                 # FastAPI
│   ├── app/
│   │   ├── api/             # роуты (sources, posts, search, digests, settings)
│   │   ├── core/            # config, security, db
│   │   ├── models/          # SQLAlchemy
│   │   ├── schemas/         # Pydantic
│   │   ├── services/        # бизнес-логика
│   │   └── main.py
│   ├── alembic/             # миграции
│   └── requirements.txt
├── frontend/                # Next.js
│   ├── src/
│   │   ├── app/             # App Router: feed, post, sources, digests, saved, settings
│   │   ├── components/
│   │   ├── lib/             # api client, utils
│   │   └── styles/
│   └── package.json
├── workers/
│   ├── telegram_ingest/     # Telethon, синхронизация каналов
│   └── ai_processor/        # OpenAI pipeline (summary, tags, scores)
├── docker/
│   ├── docker-compose.yml
│   └── .env.example
├── docs/
│   ├── PRD.md
│   ├── ARCHITECTURE.md
│   └── UI_SPEC.md (позже)
└── README.md
```

## Компоненты системы
1. **Frontend** — SPA/SSR, лента, карточки, поиск, фильтры, настройки
2. **Backend API** — REST, авторизация, CRUD источников/постов, поиск, дайджесты, настройки
3. **Telegram ingestion** — периодический забор сообщений, дедупликация, запись в БД
4. **AI processing** — очередь постов → OpenAI → summary/tags/topic/scores → запись в БД
5. **Scheduler/worker** — запуск синхронизации и AI pipeline по расписанию или по событию
6. **PostgreSQL** — основные данные, full-text search
7. **Auth** — JWT или session, один пользователь на MVP
8. **Logging** — файловые логи, ошибки импорта и AI без утечки секретов

## Сущности БД (кратко)
- **users** — id, email, password_hash, settings_json, created_at, updated_at
- **sources** — id, type, title, slug, url, is_active, priority, config_json, last_synced_at, ...
- **posts** — id, source_id, external_id, title, raw_text, cleaned_text, preview_text, original_url, published_at, media_json, read_status, is_favorite, is_hidden, is_archived, ...
- **ai_analyses** — id, post_id, summary, main_topic, tags_json, importance_score, business_relevance_score, reason_for_relevance, digest_candidate, processed_at
- **digests** — id, type, title, period_start, period_end, summary, items_json, created_at
- **user_actions** — id, user_id, post_id, action_type, created_at

## API (основные группы)
- **Sources:** GET/POST /sources, PATCH/DELETE /sources/{id}
- **Posts:** GET /posts, GET/PATCH /posts/{id}, POST /posts/{id}/favorite|hide|archive|read
- **Search:** GET /search?q=...
- **Digests:** GET /digests, POST /digests/generate
- **AI:** POST /posts/{id}/reanalyze, POST /posts/bulk-analyze
- **Settings:** GET/PATCH /settings
- **Auth:** POST /auth/login, logout, текущий пользователь

## Безопасность
- Telegram session и ключи только в env, не в коде
- Session-файл вне публичной директории, по возможности изолированно/зашифрованно
- Закрытая авторизация, защита админ-функций
