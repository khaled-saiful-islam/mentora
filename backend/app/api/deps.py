"""FastAPI dependencies.

This is the seam between HTTP and logic. Everything below it takes plain
arguments and knows nothing about requests.
"""

from __future__ import annotations

from collections.abc import AsyncIterator, Awaitable, Callable
from typing import Annotated

from fastapi import Cookie, Depends, Header, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.context.persona import persona_for
from app.context.registry import build_contributors
from app.core.config import Settings, get_settings
from app.core.errors import AuthError, ForbiddenError
from app.core.roles import Role
from app.core.security import decode_access_token
from app.db.models.user import User
from app.db.repositories.users import SqlUserRepository
from app.db.session import SessionFactory, session_scope
from app.guards.registry import build_guards
from app.learning.factory import build_generator
from app.learning.registry import build_learning_kinds
from app.moderation.registry import build_gate
from app.policies.capabilities import Capabilities, capabilities_for
from app.providers.base import TokenBudget
from app.providers.registry import build_provider
from app.services.accounting_service import Pricing
from app.services.auth_service import AuthService
from app.services.cancellation import registry as cancellation_registry
from app.services.chat_service import ChatService, TurnSettings
from app.services.generation_service import GenerationService
from app.services.quota import TokenQuota
from app.services.rate_limit import Limit, RateLimiter
from app.tools.registry import build_tools


async def get_session() -> AsyncIterator[AsyncSession]:
    """One transaction per request: commit on success, roll back on failure."""
    session = SessionFactory()
    try:
        yield session
        await session.commit()
    except Exception:
        await session.rollback()
        raise
    finally:
        await session.close()


SessionDep = Annotated[AsyncSession, Depends(get_session)]
SettingsDep = Annotated[Settings, Depends(get_settings)]


def get_auth_service(session: SessionDep) -> AuthService:
    return AuthService(SqlUserRepository(session))


AuthServiceDep = Annotated[AuthService, Depends(get_auth_service)]


def _token_from(cookie: str | None, authorization: str | None) -> str:
    """Cookie first, bearer header second.

    The browser uses an httpOnly cookie so a successful XSS cannot read the
    token. The header is there for curl, scripts and API clients, which have no
    cookie jar and no XSS surface.
    """
    if cookie:
        return cookie
    if authorization and authorization.lower().startswith("bearer "):
        return authorization[7:].strip()
    raise AuthError("Not signed in.")


async def current_user(
    auth: AuthServiceDep,
    mentora_session: Annotated[str | None, Cookie()] = None,
    authorization: Annotated[str | None, Header()] = None,
) -> User:
    user_id = decode_access_token(_token_from(mentora_session, authorization))
    return await auth.get_user(user_id)


CurrentUser = Annotated[User, Depends(current_user)]


async def user_for_stream(
    mentora_session: Annotated[str | None, Cookie()] = None,
    authorization: Annotated[str | None, Header()] = None,
) -> User:
    """Who is opening a long-lived stream, checked with a session that closes
    straight away.

    `CurrentUser` borrows the request's database session, and a stream that
    stays open for hours would hold that connection the whole time — thirty
    open tabs would empty the pool. This one returns the connection before the
    first event is sent.
    """
    user_id = decode_access_token(_token_from(mentora_session, authorization))
    async with session_scope() as session:
        return await AuthService(SqlUserRepository(session)).get_user(user_id)


StreamUser = Annotated[User, Depends(user_for_stream)]


# --- roles and capabilities --------------------------------------------
#
# Dependencies rather than checks inside each handler: a check you have to
# remember is a check someone forgets on the one route that matters. What each
# role may do is decided in `app.policies.capabilities`; these only enforce it.

_ROLE_REFUSALS: dict[frozenset[Role], str] = {
    frozenset({Role.ADMIN}): "This needs an administrator account.",
    frozenset({Role.ADMIN, Role.TEACHER}): "This is for teachers.",
    frozenset({Role.STUDENT}): "This is for students.",
}

# Said when a capability is missing, in words the person refused will follow.
_CAPABILITY_REFUSALS: dict[str, str] = {
    "studio_artifacts": "Posters, slides, games, websites and apps are for teachers.",
    "share_conversations": "Share links are for teachers.",
    "manage_classes": "Classes are run by teachers.",
    "share_learning_sets": "Sharing quizzes and flashcards is for teachers.",
    "join_classes": "Only students join classes.",
    "take_assignments": "Only students take assignments.",
    "make_practice_sets": "Practice sets are for students.",
    "moderate": "This needs an administrator account.",
    "manage_users": "This needs an administrator account.",
}


def require_roles(*roles: Role) -> Callable[[User], Awaitable[User]]:
    allowed = frozenset(roles)
    refusal = _ROLE_REFUSALS.get(allowed, "Your account cannot do that.")

    async def dependency(user: CurrentUser) -> User:
        if user.role not in allowed:
            raise ForbiddenError(refusal)
        return user

    return dependency


def require_capability(name: str) -> Callable[[User], Awaitable[User]]:
    if name not in Capabilities.__dataclass_fields__:
        raise ValueError(f"unknown capability {name!r}")  # a typo, caught at import
    refusal = _CAPABILITY_REFUSALS.get(name, "Your account cannot do that.")

    async def dependency(user: CurrentUser) -> User:
        if not getattr(capabilities_for(user.role), name):
            raise ForbiddenError(refusal)
        return user

    return dependency


def require_any_capability(*names: str) -> Callable[[User], Awaitable[User]]:
    """Any one of these will do — making sets is for teachers (to share) and
    students (to practise), and each gets their own kind of set."""
    for name in names:
        if name not in Capabilities.__dataclass_fields__:
            raise ValueError(f"unknown capability {name!r}")

    async def dependency(user: CurrentUser) -> User:
        caps = capabilities_for(user.role)
        if not any(getattr(caps, name) for name in names):
            raise ForbiddenError("Your account cannot do that.")
        return user

    return dependency


current_admin = require_roles(Role.ADMIN)
AdminUser = Annotated[User, Depends(current_admin)]
StaffUser = Annotated[User, Depends(require_roles(Role.ADMIN, Role.TEACHER))]
StudentUser = Annotated[User, Depends(require_roles(Role.STUDENT))]


def get_chat_service(settings: SettingsDep, user: CurrentUser) -> ChatService:
    """Built per request, but cheap: the provider holds no connection pool,
    contributors are stateless, and tools are thin wrappers.

    The tools, the persona and the safety gate depend on who is asking. A
    student's turn is built without the studio artifact tools at all, so no
    prompt can talk the model into making a poster: the tool it would call
    does not exist on that turn. It is also the only turn that is screened.
    """
    studio = capabilities_for(user.role).studio_artifacts
    provider = build_provider(settings)
    persona = persona_for(user.role, grade_level=user.grade_level, buddy=user.buddy)
    return ChatService(
        session_maker=session_scope,
        provider=provider,
        contributor_factory=lambda memories: build_contributors(
            settings, memories=memories, persona=persona
        ),
        cancellation=cancellation_registry,
        tools=build_tools(settings, studio=studio),
        guards=build_guards(settings),
        gate=build_gate(
            settings, role=user.role, grade_level=user.grade_level, provider=provider
        ),
        settings=TurnSettings(
            budget=TokenBudget(
                memory=settings.memory_token_budget,
                tools=settings.tools_token_budget,
                history=settings.history_token_budget,
            ),
            pricing=Pricing.from_settings(settings),
            max_tokens=settings.llm_max_tokens,
            temperature=settings.llm_temperature,
            supported_languages=tuple(settings.supported_language_list),
            default_language=settings.default_language,
            suggestions_enabled=settings.suggestions_enabled,
            suggestions_count=settings.suggestions_count,
            memory_auto_extract=settings.memory_auto_extract,
            memory_max_per_user=settings.memory_max_per_user,
            document_max_bytes=settings.document_max_bytes,
            document_max_per_conversation=settings.document_max_per_conversation,
            tool_calling_enabled=settings.tool_calling_enabled,
            tool_max_iterations=settings.tool_max_iterations,
            default_timezone=settings.default_timezone,
        ),
    )


ChatServiceDep = Annotated[ChatService, Depends(get_chat_service)]


# --- rate limiting ------------------------------------------------------


def client_address(request: Request, settings: Settings) -> str:
    """The caller's address, as well as it can be known.

    nginx sets `X-Forwarded-For $proxy_add_x_forwarded_for`, which *appends* the
    real peer to whatever the client sent. So the last entry is the one the
    proxy added and the only one worth believing — reading the first would let
    anyone reset their own limit by sending a header.

    With `trust_proxy_headers=false` the header is ignored entirely, which is
    the right posture when the API is exposed without a proxy in front.
    """
    if settings.trust_proxy_headers:
        forwarded = request.headers.get("x-forwarded-for", "")
        hops = [hop.strip() for hop in forwarded.split(",") if hop.strip()]
        if hops:
            return hops[-1][:128]
    return (request.client.host if request.client else "unknown")[:128]


async def limit_chat(session: SessionDep, settings: SettingsDep, user: CurrentUser) -> None:
    """The expensive one: every request here can become several model calls.

    Two different controls, in order of cost to evaluate: how often this account
    may ask, then how much it may spend. Both run before the turn, so a refusal
    costs a query rather than a model call.
    """
    await RateLimiter(session, enabled=settings.rate_limit_enabled).check(
        "chat", str(user.id), Limit(settings.rate_limit_chat_per_minute)
    )
    await TokenQuota(session).check(user.id, user.daily_token_limit)


async def limit_upload(session: SessionDep, settings: SettingsDep, user: CurrentUser) -> None:
    await RateLimiter(session, enabled=settings.rate_limit_enabled).check(
        "upload", str(user.id), Limit(settings.rate_limit_upload_per_minute)
    )


async def limit_share(request: Request, session: SessionDep, settings: SettingsDep) -> None:
    """Per address, because nobody is signed in — this is the open endpoint.

    Its own bucket rather than sharing `auth`: a popular shared link should not
    be able to lock its readers out of signing in.
    """
    await RateLimiter(session, enabled=settings.rate_limit_enabled).check(
        "share", client_address(request, settings), Limit(settings.rate_limit_share_per_minute)
    )


async def limit_invite(request: Request, session: SessionDep, settings: SettingsDep) -> None:
    """Per address. A class code is six characters: the limit, not the code
    length, is what makes guessing one impractical."""
    await RateLimiter(session, enabled=settings.rate_limit_enabled).check(
        "invite", client_address(request, settings), Limit(settings.rate_limit_invite_per_minute)
    )


async def limit_generate(session: SessionDep, settings: SettingsDep, user: CurrentUser) -> None:
    """A build is a dozen model calls and several searches, so it is limited
    per person per minute and counted against their token allowance."""
    await RateLimiter(session, enabled=settings.rate_limit_enabled).check(
        "generate", str(user.id), Limit(settings.rate_limit_generate_per_minute)
    )
    await TokenQuota(session).check(user.id, user.daily_token_limit)


def get_generation_service(settings: SettingsDep) -> GenerationService:
    return GenerationService(
        kinds=build_learning_kinds(),
        settings=settings,
        session_maker=session_scope,
        generator_factory=lambda kind, meter: build_generator(settings, kind, meter),
    )


GenerationServiceDep = Annotated[GenerationService, Depends(get_generation_service)]


async def limit_auth(request: Request, session: SessionDep, settings: SettingsDep) -> None:
    """Per address, because these are the endpoints reached before anyone is
    signed in — and the ones worth guessing passwords at."""
    await RateLimiter(session, enabled=settings.rate_limit_enabled).check(
        "auth", client_address(request, settings), Limit(settings.rate_limit_auth_per_minute)
    )
