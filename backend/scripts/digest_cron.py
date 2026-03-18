"""
Scheduled digest generation — runs in a loop checking if it's time to generate.
Configurable via DIGEST_SCHEDULE_HOURS env var (comma-separated UTC hours).
"""
import asyncio
import logging
import os
import sys
from datetime import datetime, timedelta, timezone

# Ensure app modules are importable
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.core.config import get_settings
from app.core.database import AsyncSessionLocal
from app.services.digest_generator import generate_digest

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [digest] %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)


async def run_digest_loop():
    settings = get_settings()

    if not settings.deepseek_api_key:
        logger.error("DEEPSEEK_API_KEY не задан. Дайджест-сервис остановлен.")
        return

    schedule_hours = [int(h.strip()) for h in settings.digest_schedule_hours.split(",") if h.strip()]
    if not schedule_hours:
        schedule_hours = [8, 14, 20]

    logger.info(f"Digest cron started. Schedule hours (UTC): {schedule_hours}")

    generated_today: set[int] = set()
    last_date: str = ""

    while True:
        now = datetime.now(timezone.utc)
        today = now.strftime("%Y-%m-%d")

        # Reset generated set on new day
        if today != last_date:
            generated_today.clear()
            last_date = today

        current_hour = now.hour

        if current_hour in schedule_hours and current_hour not in generated_today:
            logger.info(f"Generating digest for hour {current_hour}:00 UTC")
            try:
                async with AsyncSessionLocal() as db:
                    try:
                        # Period = last 8 hours
                        period_end = now
                        period_start = now - timedelta(hours=8)
                        digest = await generate_digest(
                            db=db,
                            period_start=period_start,
                            period_end=period_end,
                            digest_type="daily",
                        )
                        await db.commit()
                        logger.info(f"Digest #{digest.id} generated successfully")
                        generated_today.add(current_hour)
                    except Exception:
                        await db.rollback()
                        raise
            except Exception as e:
                logger.exception(f"Failed to generate digest: {e}")

        # Check every 5 minutes
        await asyncio.sleep(300)


def main():
    asyncio.run(run_digest_loop())


if __name__ == "__main__":
    main()
