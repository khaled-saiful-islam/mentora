"""Speaking instead of typing: a short recording in, its words out.

For any signed-in person — a student saying a question, a topic to practise,
a question for the next live lesson. The words come back to the box they
were said into, to read and change before sending. The clip itself is heard
and dropped; nothing here keeps anyone's voice.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, File, UploadFile

from app.api.deps import CurrentUser, SessionDep, SettingsDep, TranscriberDep
from app.core.errors import ValidationError
from app.providers.speech import SpeechError
from app.services.rate_limit import Limit, RateLimiter

router = APIRouter(prefix="/voice", tags=["voice"])

# Half a minute of 16 kHz mono WAV is under a megabyte.
MAX_CLIP_BYTES = 1_200_000


async def limit_listening(session: SessionDep, settings: SettingsDep, user: CurrentUser) -> None:
    await RateLimiter(session, enabled=settings.rate_limit_enabled).check(
        "transcribe", str(user.id), Limit(settings.rate_limit_transcribe_per_minute)
    )


@router.post("/transcribe", dependencies=[Depends(limit_listening)])
async def transcribe(
    user: CurrentUser, transcriber: TranscriberDep, clip: UploadFile = File(...)
) -> dict[str, str]:
    audio = await clip.read(MAX_CLIP_BYTES + 1)
    if not audio:
        raise ValidationError("Nothing was recorded. Hold the mic a little longer.")
    if len(audio) > MAX_CLIP_BYTES:
        raise ValidationError("That recording is too long. Keep it under half a minute.")
    try:
        text = await transcriber.transcribe(
            audio, filename=clip.filename or "speech.wav", mime=clip.content_type or "audio/wav"
        )
    except SpeechError as exc:
        raise ValidationError(str(exc)) from exc
    finally:
        del audio
    text = " ".join(text.split())
    if len(text) < 2:
        raise ValidationError("That wasn't clear enough to hear. Try again, a little closer.")
    return {"text": text[:600]}
