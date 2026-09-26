"""What a parent sees of one child that the child's own pages do not
already build (PLAN.md §20.3): their practice with its best scores, which
live lessons they came to, and the brief the parent's chat helper reads
(§20.6).

Everything else a parent sees is the child's own services — home, results,
schedule — called for the child's id. The family gate (`FamilyService.child`)
is the caller's job, so this never decides who may look.
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.context.persona import ChildBrief
from app.core.grades import grade_label
from app.db.models.attempt import Attempt
from app.db.models.learning import AutoPractice
from app.db.models.live import LiveParticipant
from app.db.models.user import User
from app.events.bus import EventBus
from app.services.family_service import FamilyService, first_name
from app.services.family_share_service import FamilyShareService
from app.services.learning_set_service import LearningSetService, SetView
from app.services.results_service import ResultsService
from app.services.student_home_service import StudentHomeService

PRACTICE_SHOWN = 60
# Skills named in a brief, each way — enough to talk about, never a report.
BRIEF_SKILLS = 3


@dataclass(frozen=True, slots=True)
class PracticeRow:
    view: SetView
    best: float | None
    tries: int
    made_for_you: bool


class ChildViewService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def practice(self, child_id: UUID) -> list[PracticeRow]:
        """The sets the child made, and those made for them, newest first."""
        views, _ = await LearningSetService(self._session).page(child_id, limit=PRACTICE_SHOWN)
        ids = [v.learning_set.id for v in views]
        scores = await self._scores(child_id, ids)
        made_for = await self._made_for(child_id, ids)
        return [
            PracticeRow(
                view=v,
                best=scores.get(v.learning_set.id, (None, 0))[0],
                tries=scores.get(v.learning_set.id, (None, 0))[1],
                made_for_you=v.learning_set.id in made_for,
            )
            for v in views
        ]

    async def briefs(self, parent_id: UUID, now: datetime) -> tuple[ChildBrief, ...]:
        """Each of this parent's children, as their chat helper should know
        them: a first name, a year, skills by name and work by count."""
        children = await FamilyService(self._session).children(parent_id)
        return tuple([await self._brief(view.student, now) for view in children])

    async def _brief(self, child: User, now: datetime) -> ChildBrief:
        insights = await ResultsService(self._session, EventBus()).insights(child.id)
        cards = await StudentHomeService(self._session).assignments(child)
        dues = [c.assignment.due_at for c in cards if c.status in ("todo", "in_progress")]
        home = await FamilyShareService(self._session).for_student(child.id)
        dues += [w.share.due_at for w in home if w.status != "done"]
        return ChildBrief(
            first_name=first_name(child),
            grade_label=grade_label(child.grade_level),
            strong=tuple(s["label"] for s in insights["strengths"][:BRIEF_SKILLS]),
            practise=tuple(s["label"] for s in insights["practise"][:BRIEF_SKILLS]),
            waiting=len(dues),
            late=sum(1 for due in dues if due is not None and due < now),
        )

    async def attended(self, child_id: UUID, session_ids: Sequence[UUID]) -> set[UUID]:
        """Which of these live lessons the child was in the room for."""
        if not session_ids:
            return set()
        rows = await self._session.scalars(
            select(LiveParticipant.session_id).where(
                LiveParticipant.student_id == child_id,
                LiveParticipant.session_id.in_(list(session_ids)),
            )
        )
        return set(rows.all())

    async def _scores(
        self, child_id: UUID, set_ids: list[UUID]
    ) -> dict[UUID, tuple[float | None, int]]:
        if not set_ids:
            return {}
        rows = await self._session.execute(
            select(Attempt.set_id, func.max(Attempt.percent), func.count())
            .where(
                Attempt.student_id == child_id,
                Attempt.set_id.in_(set_ids),
                Attempt.status == "completed",
            )
            .group_by(Attempt.set_id)
        )
        return {set_id: (float(best), int(n)) for set_id, best, n in rows.all()}

    async def _made_for(self, child_id: UUID, set_ids: list[UUID]) -> set[UUID]:
        if not set_ids:
            return set()
        rows = await self._session.scalars(
            select(AutoPractice.set_id).where(
                AutoPractice.student_id == child_id, AutoPractice.set_id.in_(set_ids)
            )
        )
        return {s for s in rows.all() if s is not None}
