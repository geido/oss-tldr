"""Database connection setup and session management."""
from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import declarative_base

from config import DATABASE_URL, DB_POOL_SIZE, DB_MAX_OVERFLOW, DB_POOL_TIMEOUT

# Create async engine
engine = create_async_engine(
    DATABASE_URL,
    pool_size=DB_POOL_SIZE,
    max_overflow=DB_MAX_OVERFLOW,
    pool_timeout=DB_POOL_TIMEOUT,
    echo=False,  # Set to True for SQL query logging
    future=True,
)

# Create session factory
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)

# Base class for ORM models
Base = declarative_base()


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    Dependency injection function to get database session.

    Usage in FastAPI:
        @app.get("/endpoint")
        async def endpoint(db: AsyncSession = Depends(get_db)):
            # Use db session
            pass
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def init_db() -> None:
    """Initialize database (create tables if they don't exist) and seed data."""
    # Import models to ensure they're registered with Base.metadata
    from database.models import (  # noqa: F401
        User,
        Repository,
        Report,
        UserRepository,
        UserReportAccess,
        Group,
        GroupRepository,
    )

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Seed system groups from YAML files
    from utils.group_config import seed_system_groups

    async with AsyncSessionLocal() as session:
        try:
            await seed_system_groups(session)
        except Exception as e:
            print(f"⚠️ Failed to seed system groups: {e}")
            await session.rollback()


async def close_db() -> None:
    """Close database connection pool."""
    await engine.dispose()
