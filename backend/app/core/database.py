from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from app.core.config import get_settings

settings = get_settings()
# SQLite требует connect_args для aiosqlite
connect_args = {}
if "sqlite" in settings.database_url:
    connect_args["check_same_thread"] = False
engine = create_async_engine(
    settings.database_url,
    echo=settings.debug,
    connect_args=connect_args if connect_args else {},
)
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


class Base(DeclarativeBase):
    pass


async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
