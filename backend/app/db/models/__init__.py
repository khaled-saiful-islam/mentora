"""Model registry.

Every model must be imported here so Alembic autogenerate can see it. A model
that is not listed produces a migration that silently drops its table.
"""

from __future__ import annotations

from app.db.models.artifact import Artifact, ArtifactVersion
from app.db.models.artifact_share import ArtifactShare
from app.db.models.artifact_state import ArtifactState
from app.db.models.attempt import Attempt, AttemptAnswer, StudentBadge
from app.db.models.classroom import (
    ClassGroup,
    ClassInvite,
    ClassMembership,
    Classroom,
    GroupMember,
)
from app.db.models.conversation import Conversation, Message
from app.db.models.document import Document
from app.db.models.feedback import MessageFeedback
from app.db.models.learning import (
    Assignment,
    AssignmentGroup,
    AutoPractice,
    LearningSet,
    LearningSetVersion,
)
from app.db.models.live import (
    LiveCheckinAnswer,
    LiveHand,
    LiveParticipant,
    LiveSegment,
    LiveSession,
    LiveSessionDocument,
    LiveSessionTemplate,
    LiveTranscriptLine,
)
from app.db.models.memory import Memory
from app.db.models.moderation import ModerationEvent
from app.db.models.notification import Notification
from app.db.models.rate_limit import RateLimitHit
from app.db.models.share import ConversationShare
from app.db.models.source import MessageSource
from app.db.models.user import User

__all__ = [
    "Artifact",
    "ArtifactShare",
    "Assignment",
    "Attempt",
    "AttemptAnswer",
    "AssignmentGroup",
    "AutoPractice",
    "ArtifactState",
    "ArtifactVersion",
    "ClassGroup",
    "ClassInvite",
    "ClassMembership",
    "Classroom",
    "Conversation",
    "ConversationShare",
    "Document",
    "GroupMember",
    "LearningSet",
    "LearningSetVersion",
    "LiveCheckinAnswer",
    "LiveHand",
    "LiveParticipant",
    "LiveSegment",
    "LiveSession",
    "LiveSessionDocument",
    "LiveSessionTemplate",
    "LiveTranscriptLine",
    "Memory",
    "ModerationEvent",
    "Message",
    "MessageFeedback",
    "MessageSource",
    "Notification",
    "RateLimitHit",
    "StudentBadge",
    "User",
]
