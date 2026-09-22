# Recoverable room removal

In **Administration**, owners and operators can choose **Remove or restore**
for a room. Removal requires an operational reason, the exact room code and
confirmation that active players have been warned. It immediately blocks
ordinary private access, invitations, player actions, AI continuation, seat
security operations and discussion. The saved game, seats, messages, pending
choices and existing credential revocations remain stored.

The directory defaults to active rooms. Choose **Removed rooms** or **All rooms**
to find a removed room and restore it. Restoration retains the previous pause
and joining-lock settings. Running AI resumes at the existing pace; a paused
room stays paused. Removed rooms remain readable through the administrator's
strict public metadata view, without granting private-seat access.

## Uncertain responses and player notices

Each removal/restoration saves an account- and room-bound request in this tab
before submission. If its response is lost, **Retry saved request** confirms the
same operation. After refresh, find the room using **All rooms** and reopen its
controls. A replay never applies an old removal again after later restoration.
Success and recovery text remain visible until the operator takes another action.

Players see a persistent removal notice with **Check for restoration** and
**Return home**. Polling and automatic requests stop after removal is observed;
the table and discussion are hidden. Keep the tab open for any unconfirmed room,
recovery, handover or permission request. Its exact proof is retained. Existing
seat controllers remain mounted but hidden/disabled so an in-memory recovery
draft is not discarded. This is not a claim to erase data already delivered to
a browser. A successful explicit restoration check restores the same saved seat.
An invitation without a saved seat returns to joining once restoration is confirmed.

An administrator's unconfirmed creation receipt also preserves its private retry
proof while the room is removed. Temporary inaccessibility must not discard the
only proof needed to reclaim the newly created host seat after restoration.

## Authority and storage

Migration [0012](../drizzle/0012_admin_room_removal.sql) adds room availability
metadata and durable administrator removal receipts; it does not delete or
replace existing saved records. Live authorization, expected room version and
removal revision guard an atomic transition and its audit. Both removal and
restoration advance the room version, rejecting stale in-flight actions.
Ordinary state reads/writes and AI work check availability, including after
asynchronous work. Player endpoints return `ROOM_REMOVED`/410 without a cookie
or private state. Restoring never revives a revoked credential.

See [backend](../db/admin-removal.ts), [controls](../components/admin-room-removal.tsx),
[client proof validation](../lib/admin-removal-client.ts) and
[HTTP boundary](../app/api/admin/rooms/[code]/removal/route.ts).

## Evidence and remaining scope

Focused tests cover live permission changes, stale/concurrent transitions,
exact receipts, physical-state and related-record preservation, player/AI/seat
and message fences, strict public projections, and temporary-removal proof
retention. The dedicated administrator HTTP verifier exercises a real paused
game with two human seats, an AI and a revoked old host cookie, then restores it
and compares the full private game view and discussion. It creates its own room
and restores its flags afterward. Independent review and source-bound checks
accompany the checkpoint; browser and deployed results are recorded separately.

These checks also exposed a lobby readiness bug: a joining human or human
faction change could clear AI readiness and block start. Those changes now clear
only human readiness; focused JSON continuation tests and the HTTP start cover it.

[Close/reopen](ADMIN_ROOM_CLOSURE.md) and [archive/unarchive](ADMIN_ROOM_ARCHIVE.md)
are separate reversible controls. Permanent deletion, bulk operations, participant support and
backup/import workflows remain unfinished. Recoverable removal does not satisfy
those separate [administration requirements](ADMIN_PANEL.md). No existing human
room is used for removal tests, and no database reset is authorized.

Restoring an archived room preserves both archive and closure. Use All rooms in
both Directory and Archive filters to find a room with both flags.
