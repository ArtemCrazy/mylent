"""One-time: set user credentials to crazy/crazy. Safe to run multiple times."""
import os
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from app.core.security import get_password_hash
from app.models.user import User

url = os.environ.get("DATABASE_URL_SYNC") or os.environ.get("DATABASE_URL", "").replace("+asyncpg", "")
s = sessionmaker(bind=create_engine(url))()
user = s.execute(select(User)).scalars().first()
if user:
    user.email = "crazy@mylent.local"
    user.password_hash = get_password_hash("crazy")
    s.commit()
    print("Password reset OK:", user.email)
else:
    print("NO USER FOUND")
s.close()
