"""
Периодический импорт постов (альтернатива реал-тайму): раз в N минут запускаются
telegram_sync и rss_sync. Раз в час запускается очистка старых постов.

Запуск из папки backend:
  .\.venv\Scripts\python.exe -m scripts.telegram_sync_loop

Интервал по умолчанию — 10 минут. Переменная окружения SYNC_INTERVAL_MINUTES (число).
"""
from __future__ import annotations

import logging
import os
import subprocess
import sys
import time

# корень backend (родитель scripts)
_backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

_CLEANUP_EVERY_N_CYCLES = 60
_TELEGRAM_SYNC_TIMEOUT_SECONDS = 15 * 60
_RSS_SYNC_TIMEOUT_SECONDS = 5 * 60
_CLEANUP_TIMEOUT_SECONDS = 10 * 60

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger(__name__)


def _interval_minutes() -> int:
    try:
        return max(1, int(os.environ.get("SYNC_INTERVAL_MINUTES", "10").strip()))
    except ValueError:
        return 10


def _timeout_seconds(name: str, default: int) -> int:
    try:
        value = int(os.environ.get(name, str(default)).strip())
    except ValueError:
        return default
    return max(30, value)


def _run_step(python: str, module: str, timeout_seconds: int) -> None:
    try:
        logger.info("Starting %s with timeout %ss", module, timeout_seconds)
        subprocess.run(
            [python, "-m", module],
            cwd=_backend_dir,
            check=False,
            timeout=timeout_seconds,
        )
        logger.info("Finished %s", module)
    except subprocess.TimeoutExpired:
        logger.error(
            "%s exceeded timeout (%ss). Skipping it and continuing next cycle.",
            module,
            timeout_seconds,
        )
    except KeyboardInterrupt:
        raise
    except Exception as exc:
        logger.exception("Unexpected error while running %s: %s", module, exc)


def main() -> None:
    interval = _interval_minutes()
    telegram_timeout = _timeout_seconds("TELEGRAM_SYNC_TIMEOUT_SECONDS", _TELEGRAM_SYNC_TIMEOUT_SECONDS)
    rss_timeout = _timeout_seconds("RSS_SYNC_TIMEOUT_SECONDS", _RSS_SYNC_TIMEOUT_SECONDS)
    cleanup_timeout = _timeout_seconds("CLEANUP_TIMEOUT_SECONDS", _CLEANUP_TIMEOUT_SECONDS)

    python = os.path.join(_backend_dir, ".venv", "Scripts", "python.exe")
    if not os.path.isfile(python):
        python = sys.executable

    print(
        f"Периодический импорт каждые {interval} мин. "
        f"Очистка старых постов каждые {_CLEANUP_EVERY_N_CYCLES} циклов. Ctrl+C — выход.\n"
    )

    cycle = 0
    while True:
        try:
            _run_step(python, "scripts.telegram_sync", telegram_timeout)
            _run_step(python, "scripts.rss_sync", rss_timeout)
        except KeyboardInterrupt:
            break

        cycle += 1
        if cycle >= _CLEANUP_EVERY_N_CYCLES:
            cycle = 0
            try:
                _run_step(python, "scripts.cleanup_old_posts", cleanup_timeout)
            except KeyboardInterrupt:
                break

        print(f"Следующий запуск через {interval} мин…")
        try:
            time.sleep(interval * 60)
        except KeyboardInterrupt:
            break


if __name__ == "__main__":
    main()
