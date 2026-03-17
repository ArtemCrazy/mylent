"""
Периодический импорт постов (альтернатива реал-тайму): раз в N минут запускается telegram_sync.
Удобно, если не хотите держать telegram_realtime включённым.

Запуск из папки backend:
  .\.venv\Scripts\python.exe -m scripts.telegram_sync_loop

Интервал по умолчанию — 10 минут. Переменная окружения SYNC_INTERVAL_MINUTES (число).
"""
from __future__ import annotations

import os
import subprocess
import sys
import time

# корень backend (родитель scripts)
_backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def _interval_minutes() -> int:
    try:
        return max(1, int(os.environ.get("SYNC_INTERVAL_MINUTES", "10").strip()))
    except ValueError:
        return 10


def main() -> None:
    interval = _interval_minutes()
    python = os.path.join(_backend_dir, ".venv", "Scripts", "python.exe")
    if not os.path.isfile(python):
        python = sys.executable
    print(f"Периодический импорт каждые {interval} мин. Ctrl+C — выход.\n")
    while True:
        try:
            subprocess.run(
                [python, "-m", "scripts.telegram_sync"],
                cwd=_backend_dir,
                check=False,
            )
        except KeyboardInterrupt:
            break
        print(f"Следующий запуск через {interval} мин…")
        try:
            time.sleep(interval * 60)
        except KeyboardInterrupt:
            break


if __name__ == "__main__":
    main()
