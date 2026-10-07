# Stalled-decision diagnosis

Added 7 October 2026 as owner-only, read-only administration scope. It samples
rooms that are waiting on a public interaction and have not been written for a
while, so an operator can find a table that stopped moving without opening
anyone's private state. It changes nothing and repairs nothing.

## Contract

`GET /api/admin/operations?stalled=1` requires a live owner session, checks the
`X-Dune-Admin-Id` header against the session, and answers `no-store`. Any other
query combination is rejected with `400`; an anonymous or non-owner request is
rejected with `401`/`403` before any room is read. The same request without a
query returns the aggregate sample, and `?integrity=1` keeps its manual SQLite
check.

A room is included only when **all** of these hold:

- its saved state is readable JSON (`json_valid(state)=1`);
- `status` is `playing`;
- it has a pending public interaction: `decision`, `response`, `truthtrance`
  or `phaseOpening`;
- it is not paused, closed, removed or archived;
- its last room write is older than `ADMIN_STALL_MS` (six hours).

The sample returns at most `ADMIN_STALL_LIMIT` (ten) rooms, oldest first, with
the room code, the idle duration, the pending interaction kind and the saved
turn and phase. The aggregate operations sample adds `stalledRooms` and
`oldestStalledChange` for the same predicate.

## Privacy and safety

Only public coordination facts leave the database: a room code is an
invitation, and a pending interaction kind, turn and phase are already visible
to the players at that table. Hands, spice, orders, private decisions, seat
credentials and recovery material are never selected, so the sample cannot
leak them. The route is read-only: it runs no repair, no automatic close, no
retry and no migration. Pausing, resuming, closing, removing or archiving a
room still happens only through its own audited control.

## Limits

A stall is inferred from the room write time, so a genuinely slow human turn, a
long offline pause that was never flagged, or an idle-but-live table all count.
The sample does not diagnose *why* a decision is stuck, does not check disk
capacity or backup recoverability, and does not verify rule-level save validity.
It complements, and does not replace, the manual integrity check and the
[action history](ADMIN_ACTION_HISTORY.md).
