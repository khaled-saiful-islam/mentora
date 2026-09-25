"""Learning sets: quizzes, flashcards, and whatever kind comes next.

A *kind* owns what one of its items is, what a student may see of it before
answering, and how an answer is marked. The generator, the editor, sharing,
taking and results never branch on a kind's name — they ask the kind.
Adding a worksheet is `worksheet.py` plus one line in `registry.py`.
"""
