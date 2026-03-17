"""
Создание первого пользователя для MVP.
Запуск из корня backend: python -m scripts.create_user
Требует синхронный DATABASE_URL (postgresql://, не asyncpg).
"""
import asyncio
import os
import sys

# Добавляем родительскую директорию в path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from app.core.config import get_settings
from app.core.security import get_password_hash
from app.models.user import User

def main():
    settings = get_settings()
    # Синхронный URL для скрипта
    sync_url = settings.database_url_sync or settings.database_url.replace("+asyncpg", "")
    engine = create_engine(sync_url)
    Session = sessionmaker(bind=engine)
    session = Session()
    email = input("Email: ").strip()
    password = input("Password: ").strip()
    if not email or not password:
        print("Email and password required")
        sys.exit(1)
    existing = session.execute(select(User).where(User.email == email)).scalar_one_or_none()
    if existing:
        print("User already exists")
        session.close()
        sys.exit(0)
    user = User(
        email=email,
        password_hash=get_password_hash(password),
    )
    session.add(user)
    session.commit()
    print(f"User created: {email}")
    session.close()

if __name__ == "__main__":
    main()
