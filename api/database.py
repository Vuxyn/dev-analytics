import asyncpg
import os
from contextlib import asynccontextmanager

DATABASE_URL = os.getenv("DATABASE_URL")

_pool: asyncpg.Pool | None = None

async def connect():
    global _pool
    _pool = await asyncpg.create_pool(
        dsn=DATABASE_URL,
        min_size=2,
        max_size=10,
    )

async def disconnect():
    global _pool
    if _pool:
        await _pool.close()
        _pool = None

def get_pool() -> asyncpg.Pool:
    if _pool is None:
        raise RuntimeError("Database pool belum diisialisasi")
    return _pool

@asynccontextmanager
async def get_conn():
    async with get_pool().acquire() as conn:
        yield conn
