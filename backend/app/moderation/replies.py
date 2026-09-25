"""What a student sees instead of an answer, in their own language.

Kind before anything: a refusal never scolds, and a child who says they are
at risk is thanked for saying so and pointed at people who can help. The
helplines are Malaysian and free.
"""

from __future__ import annotations

from app.moderation.base import Category, Decision, Screening

_HELP_EN = """**Please talk to someone who can help, right now:**
- a trusted adult — a parent, your teacher or your school counsellor
- **Talian Kasih 15999** (free, 24 hours), or WhatsApp **019-261 5999**
- **Befrienders KL 03-7627 2929** (24 hours)
- if you are in danger right now, call **999**"""

_HELP_MS = """**Sila bercakap dengan seseorang yang boleh membantu, sekarang juga:**
- orang dewasa yang awak percaya — ibu bapa, cikgu atau kaunselor sekolah
- **Talian Kasih 15999** (percuma, 24 jam), atau WhatsApp **019-261 5999**
- **Befrienders KL 03-7627 2929** (24 jam)
- jika awak dalam bahaya sekarang, hubungi **999**"""

_SUPPORT = {
    "en": {
        Category.SELF_HARM: "I'm really glad you told me. What you're feeling matters, and you "
        "don't have to handle it on your own.",
        Category.ABUSE: "Thank you for telling me — that was brave. Nobody is allowed to hurt "
        "you, and it is not your fault.",
        Category.BULLYING: "I'm sorry this is happening to you. Being bullied is never your "
        "fault, and you deserve to feel safe at school.",
    },
    "ms": {
        Category.SELF_HARM: "Terima kasih kerana memberitahu saya. Perasaan awak penting, dan "
        "awak tidak perlu menghadapinya seorang diri.",
        Category.ABUSE: "Terima kasih kerana memberitahu saya — awak sangat berani. Tiada sesiapa "
        "boleh menyakiti awak, dan ia bukan salah awak.",
        Category.BULLYING: "Saya sedih ini berlaku kepada awak. Dibuli bukan salah awak, dan awak "
        "berhak rasa selamat di sekolah.",
    },
}

_CLOSE = {
    "en": "I'm here to help with your learning whenever you're ready.",
    "ms": "Saya sentiasa ada untuk membantu awak belajar, bila-bila masa awak sedia.",
}

_BLOCK = {
    "en": {
        Category.PROFANITY: "Let's keep our words kind! What would you like to learn about today?",
        Category.WEAPONS: "I can't help with that, because it could hurt someone. If anyone is in "
        "danger, please tell a trusted adult or call 999. Shall we learn something else?",
        None: "That's not something I can help with here. I'm your study buddy, so let's stick "
        "to learning! Ask me about science, maths, history, languages — or anything you're "
        "curious about at school.",
    },
    "ms": {
        Category.PROFANITY: "Jom guna kata-kata yang baik! Apa yang awak mahu belajar hari ini?",
        Category.WEAPONS: "Saya tidak boleh membantu dengan itu, kerana ia boleh mencederakan "
        "orang. Jika ada sesiapa dalam bahaya, beritahu orang dewasa atau hubungi 999. Jom "
        "belajar perkara lain?",
        None: "Itu bukan sesuatu yang saya boleh bantu di sini. Saya rakan belajar awak, jadi jom "
        "fokus belajar! Tanya saya tentang sains, matematik, sejarah, bahasa — atau apa sahaja "
        "yang awak ingin tahu di sekolah.",
    },
}
_BLOCK["en"][Category.VIOLENCE] = _BLOCK["en"][Category.WEAPONS]
_BLOCK["ms"][Category.VIOLENCE] = _BLOCK["ms"][Category.WEAPONS]

_RETRACTED = {
    "en": "Oops — I started to say something that isn't right for here, so I've taken it back. "
    "Let's try a different question!",
    "ms": "Alamak — saya hampir berkata sesuatu yang tidak sesuai di sini, jadi saya tarik balik. "
    "Jom cuba soalan lain!",
}

_REDACTED = {
    "en": "I took out personal details (like a phone number) to keep you safe. Please don't share "
    "those here.",
    "ms": "Saya buang maklumat peribadi (seperti nombor telefon) untuk keselamatan awak. Jangan "
    "kongsi maklumat itu di sini ya.",
}


def _lang(language: str | None) -> str:
    return "ms" if language == "ms" else "en"


def reply_for(screening: Screening, language: str | None) -> str:
    """The whole reply to a held message."""
    lang = _lang(language)
    if screening.decision is Decision.SUPPORT:
        opening = _SUPPORT[lang].get(screening.category, _SUPPORT[lang][Category.SELF_HARM])
        help_ = _HELP_MS if lang == "ms" else _HELP_EN
        return f"{opening}\n\n{help_}\n\n{_CLOSE[lang]}"
    return _BLOCK[lang].get(screening.category) or _BLOCK[lang][None]


def retracted(language: str | None) -> str:
    return _RETRACTED[_lang(language)]


def redacted_note(language: str | None) -> str:
    return _REDACTED[_lang(language)]
