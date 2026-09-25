"""Role gates, checked against every route rather than a sample of them.

Hiding a tile is not a control. These tests sign in as each role and walk the
registered routes, so an endpoint added later under a gated router is covered
without anyone remembering to write a test for it.
"""

from __future__ import annotations

import re
from uuid import uuid4

import httpx
import pytest

from app.api.deps import current_user, get_session, limit_chat
from app.core.roles import Role
from app.main import create_app
from app.tools.registry import build_tools
from tests.fakes import make_user

STUDIO_PREFIXES = ("/api/artifacts", "/api/conversations/{conversation_id}/artifacts")
SHARE_OWNER_PREFIX = "/api/conversations/{conversation_id}/share"
ADMIN_PREFIX = "/api/admin"


def _concrete(path: str) -> str:
    return re.sub(r"\{[^}]+\}", lambda _: str(uuid4()), path)


def _routes(app, prefixes: tuple[str, ...]) -> list[tuple[str, str]]:
    """Every (method, path) under the prefixes, from the OpenAPI schema.

    The schema rather than `app.routes`: included routers are mounted lazily
    and do not appear there flattened, while the schema lists every operation
    the app will actually serve.
    """
    found = [
        (method.upper(), path)
        for path, operations in app.openapi()["paths"].items()
        if path.startswith(prefixes)
        for method in operations
    ]
    assert found, f"no routes under {prefixes} — the walk would pass vacuously"
    return found


async def _no_session():
    yield None


async def _no_limit() -> None:
    return None


def _client_as(role: Role) -> tuple[httpx.AsyncClient, object]:
    app = create_app()
    user = make_user(role=role.value, username=f"{role.value}-x", email=None)
    app.dependency_overrides[current_user] = lambda: user
    app.dependency_overrides[get_session] = _no_session
    # Counting needs a database; the limit has its own tests.
    app.dependency_overrides[limit_chat] = _no_limit
    client = httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test")
    return client, app


async def _walk(role: Role, prefixes: tuple[str, ...]) -> dict[tuple[str, str], int]:
    client, app = _client_as(role)
    statuses: dict[tuple[str, str], int] = {}
    async with client as c:
        for method, path in _routes(app, prefixes):
            response = await c.request(method, _concrete(path), json={})
            statuses[(method, path)] = response.status_code
    return statuses


async def test_a_student_is_refused_every_studio_artifact_route() -> None:
    statuses = await _walk(Role.STUDENT, STUDIO_PREFIXES)
    refused = {key: code for key, code in statuses.items() if code != 403}
    assert refused == {}, f"student reached: {refused}"


async def test_a_student_cannot_manage_conversation_share_links() -> None:
    statuses = await _walk(Role.STUDENT, (SHARE_OWNER_PREFIX,))
    assert set(statuses.values()) == {403}


@pytest.mark.parametrize("role", [Role.STUDENT, Role.TEACHER])
async def test_only_an_admin_reaches_admin_routes(role: Role) -> None:
    statuses = await _walk(role, (ADMIN_PREFIX,))
    assert set(statuses.values()) == {403}


async def test_a_refusal_uses_the_error_envelope_and_says_why() -> None:
    client, _ = _client_as(Role.STUDENT)
    async with client as c:
        response = await c.get(f"/api/artifacts/{uuid4()}")
    assert response.status_code == 403
    body = response.json()
    assert body["error"]["code"] == "forbidden"
    assert "teacher" in body["error"]["message"].lower()


async def test_a_student_cannot_open_an_artifact_through_the_chat() -> None:
    """The chat route takes an artifact id too; that door is gated as well."""
    client, _ = _client_as(Role.STUDENT)
    async with client as c:
        response = await c.post(
            "/api/chat/stream",
            json={"content": "make it blue", "artifact_id": str(uuid4())},
        )
    assert response.status_code == 403


# --- the tool path ----------------------------------------------------------


def test_without_the_studio_the_model_is_never_offered_an_artifact_tool(monkeypatch) -> None:
    """The last line: even a turn that got past every route has no tool to call."""
    from app.core.config import get_settings

    settings = get_settings().model_copy(update={"artifacts_enabled": True})
    names = set(build_tools(settings, studio=False))
    assert "create_artifact" not in names
    assert "edit_artifact" not in names


def test_with_the_studio_the_artifact_tools_are_there() -> None:
    from app.core.config import get_settings

    settings = get_settings()
    if not settings.artifacts_available:
        pytest.skip("no artifact model configured in this environment")
    names = set(build_tools(settings, studio=True))
    assert {"create_artifact", "edit_artifact"} <= names
