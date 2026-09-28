"""coverage ready sets: a set made for a class's year, not shared yet, can be
sorted onto its syllabus too

Revision ID: f4c9a2d7e815
Revises: e2b8f5a1c603
Create Date: 2026-09-28 16:00:00.000000
"""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op

revision: str = "f4c9a2d7e815"
down_revision: str | None = "e2b8f5a1c603"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_constraint("ck_coverage_link_kind", "coverage_links", type_="check")
    op.create_check_constraint(
        "ck_coverage_link_kind", "coverage_links", "kind IN ('assignment', 'live', 'set')"
    )


def downgrade() -> None:
    op.execute("DELETE FROM coverage_links WHERE kind = 'set'")
    op.drop_constraint("ck_coverage_link_kind", "coverage_links", type_="check")
    op.create_check_constraint(
        "ck_coverage_link_kind", "coverage_links", "kind IN ('assignment', 'live')"
    )
