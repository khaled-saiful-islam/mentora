"""Who may do what.

`capabilities` answers questions about a *kind* of account. Questions about a
particular resource — may this teacher see this class? — live beside it in
`access`, as they are added. Neither imports FastAPI: the HTTP layer turns a
refusal into a 403, and the same rules are usable from a script or a test.
"""
