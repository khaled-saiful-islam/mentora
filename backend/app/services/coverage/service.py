"""A class's coverage: its syllabus, where everything taught sits on it, how
the class (or one student) did, what to teach next, and reports home."""

from __future__ import annotations

import logging
import secrets
from collections.abc import Sequence
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.clock import Clock, utc_now
from app.core.errors import NotFoundError, ValidationError
from app.core.grades import grade_for, grade_label
from app.db.models.attempt import Attempt
from app.db.models.classroom import ClassMembership, Classroom
from app.db.models.coverage import ClassSyllabus, CoverageLink, ProgressReport
from app.db.models.learning import Assignment, LearningSet
from app.db.models.live import LiveSession
from app.db.models.user import User
from app.learning.model import JsonModel
from app.services.coverage import prompts
from app.services.coverage.matrix import Taught, build, months_for
from app.services.coverage.syllabus import areas_from, outline, topic_ids

logger = logging.getLogger(__name__)

SORT_BATCH = 30
MAX_STEPS = 6
STEP_KINDS = ("quiz", "flashcard", "study_guide", "live")
# Live lessons that count: given, happening, or on the calendar.
LIVE_SHOWN = ("scheduled", "lobby", "live", "ended")
PLANNED = ("scheduled", "lobby")
TOKEN_BYTES = 24
# The school year ends with November's exams; December is the holiday.
YEAR_ENDS_MONTH = 11


class CoverageService:
    def __init__(
        self, session: AsyncSession, *, model: JsonModel | None = None, clock: Clock = utc_now
    ) -> None:
        self._session = session
        self._model = model
        self._clock = clock

    # --- the syllabus -------------------------------------------------------

    async def syllabus(self, class_id: UUID) -> ClassSyllabus | None:
        return await self._session.get(ClassSyllabus, class_id)

    async def draft(self, classroom: Classroom) -> list[dict[str, Any]]:
        """A syllabus to start from, drafted from the class's subject and grade."""
        if self._model is None:
            raise ValidationError("Drafting needs a model, and none is set up.")
        system, user = prompts.draft(
            classroom.subject or classroom.name, grade_for(classroom.grade_level), classroom.name
        )
        reply = await self._model.ask(
            "coverage.draft", system, user, temperature=0.3, max_tokens=900
        )
        areas = areas_from(reply.get("areas"))
        if not areas:
            raise ValidationError(
                "A syllabus couldn't be drafted just now. Try again, or write your own."
            )
        return await self._store(classroom.id, areas, made_by="ai")

    async def save(self, classroom: Classroom, raw: Any) -> list[dict[str, Any]]:
        areas = areas_from(raw)
        if not areas:
            raise ValidationError("A syllabus needs at least one area with a name.")
        return await self._store(classroom.id, areas, made_by="teacher")

    async def _store(
        self, class_id: UUID, areas: list[dict[str, Any]], *, made_by: str
    ) -> list[dict[str, Any]]:
        row = await self._session.get(ClassSyllabus, class_id)
        if row is None:
            row = ClassSyllabus(class_id=class_id)
            self._session.add(row)
        row.areas, row.made_by = areas, made_by
        # A topic that went away takes its sorting with it; those are sorted again.
        await self._session.execute(
            delete(CoverageLink).where(
                CoverageLink.class_id == class_id,
                CoverageLink.topic_id.is_not(None),
                CoverageLink.topic_id.not_in(topic_ids(areas) or {""}),
            )
        )
        await self._session.flush()
        return areas

    # --- the map --------------------------------------------------------------

    async def coverage(
        self, classroom: Classroom, *, student_id: UUID | None = None, sort: bool = True
    ) -> dict[str, Any]:
        """The map for a class, or for one student in it. `sort` lets a model
        place what is new — never from a public page."""
        row = await self.syllabus(classroom.id)
        areas = row.areas if row else []
        items = await self._taught(classroom.id)
        links = await self._links(classroom.id, items, areas, sort=sort)
        mastery = await self._mastery(links, student_id)
        months = months_for(items, classroom.created_at, self._clock())
        shaped = build(areas, items, links, mastery, months)
        return {
            **shaped,
            "syllabus": {"areas": areas, "made_by": row.made_by if row else None},
            "now": self._clock().isoformat(),
        }

    async def plan(self, classroom: Classroom) -> list[dict[str, Any]]:
        """What to teach next, suggested from where the class is."""
        if self._model is None:
            raise ValidationError("Planning needs a model, and none is set up.")
        shaped = await self.coverage(classroom)
        topics = {t["id"]: (a, t) for a in shaped["areas"] for t in a["topics"]}
        if not topics:
            raise ValidationError("Add a syllabus first, then Mentora can plan the rest.")
        status = "\n".join(
            f"[{t['id']}] {a['title']} — {t['title']}: {_said(t)}" for a, t in topics.values()
        )
        now = self._clock()
        system, user = prompts.plan(
            grade_for(classroom.grade_level),
            status,
            now.strftime("%d %B %Y"),
            _weeks_left(now),
            classroom.subject or classroom.name,
        )
        reply = await self._model.ask(
            "coverage.plan", system, user, temperature=0.4, max_tokens=900
        )
        return _steps(reply.get("steps"), topics)

    # --- reports home -------------------------------------------------------

    async def create_report(
        self, teacher_id: UUID, classroom: Classroom, student_id: UUID | None
    ) -> ProgressReport:
        if student_id is not None and not await self._member(classroom.id, student_id):
            raise NotFoundError("No such student in this class.")
        report = ProgressReport(
            token=secrets.token_urlsafe(TOKEN_BYTES),
            class_id=classroom.id,
            student_id=student_id,
            created_by=teacher_id,
        )
        self._session.add(report)
        await self._session.flush()
        return report

    async def reports(self, class_id: UUID) -> list[ProgressReport]:
        rows = await self._session.scalars(
            select(ProgressReport)
            .where(ProgressReport.class_id == class_id, ProgressReport.revoked_at.is_(None))
            .order_by(ProgressReport.created_at.desc())
        )
        return list(rows.all())

    async def revoke(self, class_id: UUID, report_id: UUID) -> None:
        report = await self._session.get(ProgressReport, report_id)
        if report is None or report.class_id != class_id:
            raise NotFoundError("No such report.")
        report.revoked_at = datetime.now(UTC)
        await self._session.flush()

    async def public(self, token: str) -> dict[str, Any]:
        """What a parent sees. Built from an allow-list, so nothing added to
        the map later can reach a stranger by accident."""
        report = await self._session.scalar(
            select(ProgressReport).where(
                ProgressReport.token == token, ProgressReport.revoked_at.is_(None)
            )
        )
        classroom = await self._session.get(Classroom, report.class_id) if report else None
        if report is None or classroom is None:
            raise NotFoundError("This report link isn't working. Ask the teacher for a new one.")
        teacher = await self._session.get(User, classroom.teacher_id)
        student = await self._session.get(User, report.student_id) if report.student_id else None
        shaped = await self.coverage(classroom, student_id=report.student_id, sort=False)
        return {
            "class_name": classroom.name,
            "subject": classroom.subject,
            "grade_label": grade_label(classroom.grade_level),
            "teacher_name": (teacher.display_name or teacher.sign_in_name) if teacher else "",
            "student_name": (student.display_name or student.sign_in_name) if student else None,
            "made_at": self._clock().isoformat(),
            "months": shaped["months"],
            "summary": shaped["summary"],
            "areas": [_public_area(a) for a in shaped["areas"]],
        }

    # --- what was taught, and where it sits --------------------------------

    async def _taught(self, class_id: UUID) -> list[Taught]:
        rows = await self._session.execute(
            select(Assignment, LearningSet.topic)
            .join(LearningSet, LearningSet.id == Assignment.set_id)
            .where(Assignment.class_id == class_id)
        )
        items = [
            Taught("assignment", a.id, a.kind, a.title, topic or a.title, a.created_at)
            for a, topic in rows.all()
        ]
        lives = await self._session.scalars(
            select(LiveSession).where(
                LiveSession.class_id == class_id, LiveSession.status.in_(LIVE_SHOWN)
            )
        )
        for live in lives.all():
            when = live.started_at or live.scheduled_at or live.created_at
            topic = str((live.settings or {}).get("topic") or live.title)
            items.append(
                Taught("live", live.id, "live", live.title, topic, when, live.status in PLANNED)
            )
        return items

    async def _links(
        self, class_id: UUID, items: list[Taught], areas: list[dict[str, Any]], *, sort: bool
    ) -> dict[tuple[str, UUID], str | None]:
        rows = await self._session.scalars(
            select(CoverageLink).where(CoverageLink.class_id == class_id)
        )
        links = {(r.kind, r.item_id): r.topic_id for r in rows.all()}
        missing = [i for i in items if i.key not in links]
        if not (sort and missing and areas and self._model is not None):
            return links
        for start in range(0, len(missing), SORT_BATCH):
            batch = missing[start : start + SORT_BATCH]
            placed = await self._sort(batch, areas)
            for item in batch:
                if item.key in placed:
                    links[item.key] = placed[item.key]
                    self._session.add(
                        CoverageLink(
                            class_id=class_id,
                            kind=item.source,
                            item_id=item.id,
                            topic_id=placed[item.key],
                        )
                    )
        await self._session.flush()
        return links

    async def _sort(
        self, items: Sequence[Taught], areas: list[dict[str, Any]]
    ) -> dict[tuple[str, UUID], str | None]:
        """Each item's topic, by a model. Items it could not place are left
        out, so they are tried again next time rather than filed wrong."""
        system, user = prompts.sort(outline(areas), [i.describe() for i in items])
        try:
            reply = await self._model.ask(  # type: ignore[union-attr]
                "coverage.sort", system, user, temperature=0.0, max_tokens=60 * len(items) + 100
            )
        except Exception:  # noqa: BLE001 — unsorted things wait for the next look
            logger.warning("coverage sort failed", exc_info=True)
            return {}
        known = topic_ids(areas)
        placed: dict[tuple[str, UUID], str | None] = {}
        for link in reply.get("links") or []:
            if not isinstance(link, dict) or not isinstance(link.get("item"), int):
                continue
            n = link["item"] - 1
            if 0 <= n < len(items):
                topic = link.get("topic")
                placed[items[n].key] = topic if topic in known else None
        return placed

    async def _mastery(
        self, links: dict[tuple[str, UUID], str | None], student_id: UUID | None
    ) -> dict[str, float]:
        """Per topic: the class's first-try scores, or one student's best."""
        topic_of = {i: t for (src, i), t in links.items() if src == "assignment" and t}
        if not topic_of:
            return {}
        query = select(Attempt.assignment_id, Attempt.percent).where(
            Attempt.assignment_id.in_(list(topic_of)), Attempt.status == "completed"
        )
        query = (
            query.where(Attempt.student_id == student_id)
            if student_id
            else query.where(Attempt.number == 1)
        )
        best: dict[UUID, list[float]] = {}
        for assignment_id, percent in (await self._session.execute(query)).all():
            best.setdefault(assignment_id, []).append(float(percent))
        per_topic: dict[str, list[float]] = {}
        for assignment_id, scores in best.items():
            score = max(scores) if student_id else sum(scores) / len(scores)
            per_topic.setdefault(topic_of[assignment_id], []).append(score)
        return {t: round(sum(s) / len(s), 1) for t, s in per_topic.items()}

    async def _member(self, class_id: UUID, student_id: UUID) -> bool:
        found = await self._session.scalar(
            select(ClassMembership.id).where(
                ClassMembership.class_id == class_id,
                ClassMembership.student_id == student_id,
                ClassMembership.status == "approved",
            )
        )
        return found is not None


def _said(topic: dict[str, Any]) -> str:
    status = topic["status"].replace("_", " ")
    return (
        f"{status}, class scored {topic['mastery']:.0f}%"
        if topic["mastery"] is not None
        else status
    )


def _weeks_left(now: datetime) -> int:
    end = datetime(now.year, YEAR_ENDS_MONTH, 30, tzinfo=now.tzinfo or UTC)
    return max(1, (end - now).days // 7)


def _steps(
    raw: Any, topics: dict[str, tuple[dict[str, Any], dict[str, Any]]]
) -> list[dict[str, Any]]:
    steps: list[dict[str, Any]] = []
    for step in raw if isinstance(raw, list) else []:
        if not isinstance(step, dict) or step.get("topic") not in topics:
            continue
        kind = step.get("kind") if step.get("kind") in STEP_KINDS else "quiz"
        area, topic = topics[step["topic"]]
        title = " ".join(str(step.get("title") or topic["title"]).split())[:80]
        steps.append(
            {
                "topic_id": topic["id"],
                "topic": topic["title"],
                "area": area["title"],
                "kind": kind,
                "title": title,
                "when": " ".join(str(step.get("when") or "").split())[:30],
                "why": " ".join(str(step.get("why") or "").split())[:160],
            }
        )
    return steps[:MAX_STEPS]


def _public_area(area: dict[str, Any]) -> dict[str, Any]:
    return {
        "title": area["title"],
        "status": area["status"],
        "mastery": area["mastery"],
        "topics": [
            {
                "title": t["title"],
                "status": t["status"],
                "mastery": t["mastery"],
                "items": [
                    {
                        "kind": i["kind"],
                        "title": i["title"],
                        "month": i["month"],
                        "planned": i["planned"],
                    }
                    for i in t["items"]
                ],
            }
            for t in area["topics"]
        ],
    }
