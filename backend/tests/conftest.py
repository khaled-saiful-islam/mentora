"""Shared fixtures.

The database fixture wraps each test in a transaction and rolls it back, so
integration tests share one schema without leaking rows into each other or into
the development data. No test needs to remember to clean up.
"""

from __future__ import annotations

from collections.abc import AsyncIterator, Awaitable, Callable
from uuid import uuid4

import httpx
import pytest
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import get_settings
from app.core.security import hash_password
from app.db.models.user import User
from app.services.cancellation import CancellationRegistry


@pytest.fixture(scope="session")
def database_url() -> str:
    return get_settings().database_url


@pytest.fixture
async def session(database_url: str) -> AsyncIterator[AsyncSession]:
    """A session whose work is always rolled back.

    The outer transaction is never committed, so `session.commit()` inside the
    code under test commits only to a nested savepoint and the whole thing
    disappears when the test ends.
    """
    engine = create_async_engine(database_url, poolclass=None)
    connection = await engine.connect()
    transaction = await connection.begin()
    maker = async_sessionmaker(
        bind=connection,
        expire_on_commit=False,
        join_transaction_mode="create_savepoint",
    )
    db = maker()
    try:
        yield db
    finally:
        await db.close()
        await transaction.rollback()
        await connection.close()
        await engine.dispose()


@pytest.fixture
async def db_user(session: AsyncSession) -> User:
    user = User(
        username="tester",
        email="tester@example.com",
        password_hash=hash_password("hunter2hunter2"),
        display_name="Tester",
        is_admin=False,
        is_active=True,
    )
    session.add(user)
    await session.flush()
    return user


AccountFactory = Callable[..., Awaitable[User]]


@pytest.fixture
def account(session: AsyncSession) -> AccountFactory:
    """Make an account of any role: `await account("student", "Adam")`.

    Teachers get an email and no username, students a username and a grade and
    no email — the shapes signup produces, so tests meet the real thing.
    """
    counter = iter(range(1, 10_000))

    async def make(role: str = "teacher", name: str | None = None, **extra: object) -> User:
        n = next(counter)
        label = name or f"{role.title()} {n}"
        slug = f"{role}{n}-{uuid4().hex[:6]}"
        user = User(
            username=slug if role == "student" else None,
            email=None if role == "student" else f"{slug}@school.test",
            password_hash="x",  # noqa: S106
            display_name=label,
            role=role,
            grade_level="year_4" if role == "student" else None,
            preferences={},
            is_active=True,
            **extra,
        )
        session.add(user)
        await session.flush()
        return user

    return make


@pytest.fixture
async def teacher(account: AccountFactory) -> User:
    return await account("teacher", "Cikgu Aisyah")


@pytest.fixture
async def student(account: AccountFactory) -> User:
    return await account("student", "Adam")


ClientFactory = Callable[..., httpx.AsyncClient]


@pytest.fixture
def client(session: AsyncSession) -> ClientFactory:
    """The app on this test's rolled-back session: `client(teacher)` is signed
    in as `teacher`; `client()` is signed out and uses real cookies."""
    from app.api.deps import current_user, get_session
    from app.main import create_app

    def make(user: User | None = None) -> httpx.AsyncClient:
        app = create_app()

        async def _session() -> AsyncIterator[AsyncSession]:
            yield session

        app.dependency_overrides[get_session] = _session
        if user is not None:
            app.dependency_overrides[current_user] = lambda: user
        return httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test")

    return make


@pytest.fixture
def registry() -> CancellationRegistry:
    """A fresh cancellation registry per test, so one turn cannot cancel another."""
    return CancellationRegistry()
