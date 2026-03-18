"""
Периодический импорт постов (альтернатива реал-тайму): раз в N минут запускается telegram_sync.
Раз в час запускается очистка старых постов (не в избранном, старше 10 дней).

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

_CLEANUP_EVERY_N_CYCLES = 60  # run cleanup every N sync cycles


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
    print(f"Периодический импорт каждые {interval} мин. Очистка старых постов каждые {_CLEANUP_EVERY_N_CYCLES} циклов. Ctrl+C — выход.\n")
    cycle = 0
    while True:
        try:
            subprocess.run(
                [python, "-m", "scripts.telegram_sync"],
                cwd=_backend_dir,
                check=False,
            )
        except KeyboardInterrupt:
            break

        cycle += 1
        if cycle >= _CLEANUP_EVERY_N_CYCLES:
            cycle = 0
            try:
                subprocess.run(
                    [python, "-m", "scripts.cleanup_old_posts"],
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
