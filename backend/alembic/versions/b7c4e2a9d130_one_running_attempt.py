"""one running attempt, numbered once

Two "Start" requests at once could each create attempt #1. This clears the
twins that race left behind, then makes the database refuse another: at most
one attempt in progress per student per assignment (or practice set), and
attempt numbers unique.

Of a pair of twins, the one kept is the finished one, else the one with more
answers, else the older. The twin removed is the half-empty copy nobody was
looking at.

Revision ID: b7c4e2a9d130
Revises: a074e2dcde74
Create Date: 2026-09-25 11:30:00
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "b7c4e2a9d130"
down_revision: str | None = "a074e2dcde74"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# Which attempts belong together: class attempts per assignment, practice per set.
_GROUP = "student_id, (assignment_id IS NULL), COALESCE(assignment_id, set_id)"
_KEEP_ORDER = """
    (status = 'completed') DESC,
    (SELECT count(*) FROM attempt_answers x WHERE x.attempt_id = attempts.id) DESC,
    started_at
"""


def _drop_duplicates(partition: str, where: str = "TRUE") -> None:
    op.execute(
        sa.text(
            f"""
            DELETE FROM attempts USING (
                SELECT id, row_number() OVER (PARTITION BY {partition} ORDER BY {_KEEP_ORDER}) AS n
                FROM attempts WHERE {where}
            ) AS ranked
            WHERE attempts.id = ranked.id AND ranked.n > 1
            """  # noqa: S608 — fixed fragments above, no input
        )
    )


def upgrade() -> None:
    _drop_duplicates(f"{_GROUP}, number")
    _drop_duplicates(_GROUP, "status = 'in_progress'")

    op.create_index(
        "uq_attempts_running_assignment",
        "attempts",
        ["student_id", "assignment_id"],
        unique=True,
        postgresql_where=sa.text("status = 'in_progress' AND assignment_id IS NOT NULL"),
    )
    op.create_index(
        "uq_attempts_running_practice",
        "attempts",
        ["student_id", "set_id"],
        unique=True,
        postgresql_where=sa.text("status = 'in_progress' AND assignment_id IS NULL"),
    )
    op.create_index(
        "uq_attempts_number_assignment",
        "attempts",
        ["student_id", "assignment_id", "number"],
        unique=True,
        postgresql_where=sa.text("assignment_id IS NOT NULL"),
    )
    op.create_index(
        "uq_attempts_number_practice",
        "attempts",
        ["student_id", "set_id", "number"],
        unique=True,
        postgresql_where=sa.text("assignment_id IS NULL"),
    )


def downgrade() -> None:
    op.drop_index("uq_attempts_number_practice", table_name="attempts")
    op.drop_index("uq_attempts_number_assignment", table_name="attempts")
    op.drop_index("uq_attempts_running_practice", table_name="attempts")
    op.drop_index("uq_attempts_running_assignment", table_name="attempts")
