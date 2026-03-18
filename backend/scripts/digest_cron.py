"""
Scheduled digest generation — iterates over active DigestConfig records
and generates digests based on their schedule settings.
"""
import asyncio
import logging
import os
import sys
from datetime import datetime, timezone

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.config import get_settings
from app.core.database import AsyncSessionLocal
from app.models.digest import DigestConfig, DigestConfigSource
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

    logger.info("Digest cron started. Checking active configs every 5 minutes.")

    # Track what we've generated today: {config_id: set(hours)}
    generated_today: dict[int, set[int]] = {}
    last_date: str = ""

    while True:
        now = datetime.now(timezone.utc)
        today = now.strftime("%Y-%m-%d")

        # Reset on new day
        if today != last_date:
            generated_today.clear()
            last_date = today

        current_hour = now.hour
        current_weekday = now.weekday()  # 0 = Monday

        try:
            async with AsyncSessionLocal() as db:
                # Fetch active scheduled configs
                result = await db.execute(
                    select(DigestConfig)
                    .where(
                        DigestConfig.is_active == True,
                        DigestConfig.schedule_type != "manual",
                    )
                    .options(
                        selectinload(DigestConfig.sources).selectinload(DigestConfigSource.source)
                    )
                )
                configs = list(result.scalars().all())

                for cfg in configs:
                    # Parse schedule hours
                    if not cfg.schedule_hours:
                        continue
                    schedule_hours = [int(h.strip()) for h in cfg.schedule_hours.split(",") if h.strip()]
                    if current_hour not in schedule_hours:
                        continue

                    # Check if already generated this hour
                    if cfg.id not in generated_today:
                        generated_today[cfg.id] = set()
                    if current_hour in generated_today[cfg.id]:
                        continue

                    # Weekly: only on Monday
                    if cfg.schedule_type == "weekly" and current_weekday != 0:
                        continue

                    logger.info(f"Generating digest for config '{cfg.name}' (id={cfg.id}, hour={current_hour})")
                    try:
                        digest = await generate_digest(db=db, config=cfg)
                        await db.commit()
                        generated_today[cfg.id].add(current_hour)
                        logger.info(f"Digest #{digest.id} for '{cfg.name}' generated successfully")
                    except Exception as e:
                        await db.rollback()
                        logger.exception(f"Failed to generate digest for config '{cfg.name}': {e}")

                if not configs:
                    logger.debug("No active scheduled configs found")

        except Exception as e:
            logger.exception(f"Digest cron cycle error: {e}")

        # Check every 5 minutes
        await asyncio.sleep(300)


def main():
    asyncio.run(run_digest_loop())


if __name__ == "__main__":
    main()
