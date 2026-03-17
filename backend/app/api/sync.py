"""Ручной запуск синхронизации через API — для дебага без SSH."""
import asyncio
import io
import sys
from fastapi import APIRouter
from app.api.deps import CurrentUser

router = APIRouter(prefix="/sync", tags=["sync"])


@router.post("/now")
async def sync_now(current_user: CurrentUser):
    """Запускает telegram_sync один раз и возвращает лог."""
    buf = io.StringIO()
    old_stdout = sys.stdout
    sys.stdout = buf
    result = {"ok": False, "log": ""}
    try:
        # Import here to avoid circular imports
        from app.core.config import get_settings
        from app.core.database import AsyncSessionLocal
        from telethon import TelegramClient
        import os

        settings = get_settings()
        api_id = (settings.telegram_api_id or "").strip()
        api_hash = (settings.telegram_api_hash or "").strip()

        if not api_id or not api_hash:
            sys.stdout = old_stdout
            return {"ok": False, "log": "TELEGRAM_API_ID или TELEGRAM_API_HASH не заданы"}

        session_path = settings.telegram_session_path or "./data/telegram_session"
        session_file = session_path + ".session"

        if not os.path.exists(session_file):
            sys.stdout = old_stdout
            return {"ok": False, "log": f"Файл сессии не найден: {session_file}"}

        print(f"Сессия: {session_file} ({os.path.getsize(session_file)} байт)")
        print(f"API ID: {api_id[:4]}***")

        client = TelegramClient(session_path, int(api_id), api_hash)
        await client.connect()
        authorized = await client.is_user_authorized()
        print(f"Авторизован: {authorized}")

        if not authorized:
            await client.disconnect()
            sys.stdout = old_stdout
            buf_val = buf.getvalue()
            return {"ok": False, "log": buf_val + "\nСессия не авторизована. Войди через Settings → Telegram."}

        me = await client.get_me()
        print(f"Аккаунт: {me.first_name} {me.last_name or ''} (@{me.username or 'нет'})")

        from scripts.telegram_sync import fetch_and_save
        async with AsyncSessionLocal() as db:
            added = await fetch_and_save(client, db)
            await db.commit()
            print(f"Готово. Добавлено постов: {added}")

        await client.disconnect()
        result["ok"] = True
    except Exception as e:
        import traceback
        print(f"Ошибка: {e}")
        traceback.print_exc(file=sys.stdout)
    finally:
        sys.stdout = old_stdout
        result["log"] = buf.getvalue()

    return result
