"""How long an MP3 clip is, read from its frames.

The server owns a live lesson's timeline, so it must know exactly when each
clip ends — to start the next one on time for everyone, and to finish the
sentence being said before calling on a raised hand. The voice returns plain
MPEG audio; its frame headers say the sample rate and each frame is a fixed
number of samples, so counting frames gives the length without decoding.
"""

from __future__ import annotations

# MPEG-1 Layer III bitrates (kbps) and sample rates, by header index; MPEG-2
# and 2.5 (lower sample rates) share the second table.
_BITRATES_V1 = (0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0)
_BITRATES_V2 = (0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0)
_RATES = {3: (44100, 48000, 32000), 2: (22050, 24000, 16000), 0: (11025, 12000, 8000)}


def duration(data: bytes) -> float:
    """Seconds of audio in an MP3, or an estimate if its frames can't be read."""
    at = _skip_id3(data)
    seconds = 0.0
    frames = 0
    while at + 4 <= len(data):
        header = int.from_bytes(data[at : at + 4], "big")
        frame = _frame(header)
        if frame is None:
            # Not a frame here: a stray byte or trailing tag. Resync forward.
            at += 1
            continue
        length, samples, rate = frame
        seconds += samples / rate
        frames += 1
        at += length
    if frames == 0:
        # 128 kbps is what the voice sends; better an estimate than nothing.
        return max(0.0, (len(data) - _skip_id3(data)) * 8 / 128_000)
    return round(seconds, 3)


def _frame(header: int) -> tuple[int, int, int] | None:
    if (header >> 21) & 0x7FF != 0x7FF:
        return None
    version = (header >> 19) & 0b11  # 3 = MPEG-1, 2 = MPEG-2, 0 = MPEG-2.5
    layer = (header >> 17) & 0b11  # 1 = Layer III
    bitrate_index = (header >> 12) & 0b1111
    rate_index = (header >> 10) & 0b11
    padding = (header >> 9) & 0b1
    if version == 1 or layer != 1 or rate_index == 3 or bitrate_index in (0, 15):
        return None
    rate = _RATES[version][rate_index]
    bitrates = _BITRATES_V1 if version == 3 else _BITRATES_V2
    bitrate = bitrates[bitrate_index] * 1000
    samples = 1152 if version == 3 else 576
    length = samples // 8 * bitrate // rate + padding
    if length < 4:
        return None
    return length, samples, rate


def _skip_id3(data: bytes) -> int:
    if len(data) >= 10 and data[:3] == b"ID3":
        size = 0
        for byte in data[6:10]:
            size = (size << 7) | (byte & 0x7F)
        return 10 + size
    return 0
