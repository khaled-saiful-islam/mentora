"""Say It (§28.3.5): a child's reading of one line of a game, heard and
dropped; only the words heard come back, and are kept on the attempt."""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, UploadFile

from app.api.deps import CurrentUser, SessionDep, TranscriberDep, require_capability
from app.api.routes.voice import MAX_CLIP_BYTES, limit_listening
from app.core.errors import ValidationError
from app.services.say_it import hear

router = APIRouter(
    prefix="/me/attempts/{attempt_id}/items/{item_id}",
    tags=["play"],
    dependencies=[Depends(require_capability("take_assignments")), Depends(limit_listening)],
)


@router.post("/hear")
async def hear_line(
    attempt_id: UUID,
    item_id: str,
    user: CurrentUser,
    session: SessionDep,
    transcriber: TranscriberDep,
    line: int = Form(..., ge=0, le=9),
    clip: UploadFile = File(...),
) -> dict[str, str]:
    audio = await clip.read(MAX_CLIP_BYTES + 1)
    if not audio:
        raise ValidationError("Nothing was recorded. Hold the mic a little longer.")
    if len(audio) > MAX_CLIP_BYTES:
        raise ValidationError("That recording is too long. Keep it under half a minute.")
    try:
        heard = await hear(
            session,
            transcriber,
            student_id=user.id,
            attempt_id=attempt_id,
            item_id=item_id[:40],
            line=line,
            audio=audio,
            mime=clip.content_type or "audio/wav",
        )
    finally:
        del audio
    return {"text": heard}
