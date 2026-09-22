# Administrative archive and unarchive

Owners and operators can choose **Archive or unarchive** beside a room in
Administration. First close the room through [Close or reopen](ADMIN_ROOM_CLOSURE.md).
Archiving requires an operational reason, the exact room code and confirmation.
Unarchiving requires a reason and acknowledgment that play stays closed. Viewers
can inspect archive status. Instructions and outcome notices remain readable
until another deliberate action changes the panel.

Archive organizes closed rooms in the administrator directory. It preserves the
entire saved game, game-change timestamp, winner, pending decisions, physical
pieces, seats, revoked access, discussion and AI deadlines. Existing players can
still read their own closed table and history. It does not independently pause,
end or resume the rules engine. **Unarchive leaves the room closed**; an
administrator must separately reopen it when play should resume.

## Directory and other controls

The **Archive** filter defaults to **Unarchived rooms**; choose **Archived rooms**
or **All rooms** to find an archived game. This filter is independent of
**Directory → Active / Removed / All rooms** and the availability filter.
To find a room that is both removed and archived, choose **All rooms** in both
Directory and Archive. Searches still inspect only codes and public player names.

Archived rooms cannot be reopened until unarchived. Recoverable removal can hide
an archived room; restoration preserves its archive and closure and does not wake
its AI. Restore a removed room before changing its archive status. An exact
previous receipt can still be confirmed while a room is removed or after another
administrator has changed its availability.

## Saved retries and preservation

Before sending, the browser saves the exact account/room operation, requested
state, reason and two version counters in tab-scoped storage. A lost response or
refresh offers **Retry saved request** when the controls reopen. The server
confirms the original operation without repeating it, and reports the room's
current status. Keep the tab open until resolved. Discarding an unreadable local
record cannot undo a server change.

Live owner/operator authority, room version, archive revision, closed status and
removal status are fenced inside the write transaction. Audit receipt, room
version increment and archive metadata commit together. Rejected or competing
requests cannot partially change the room; identical concurrent requests commit
once. Admin responses and audit metadata contain operational flags and timestamps,
without hands, messages, seat credentials or raw saved state. These operations
never parse or repair the saved game, including an unreadable save.

Apply additive migration `0014_admin_room_archive.sql` before using this revision.
`room_archives` holds current directory status; `admin_room_archives` holds durable
audit receipts. Existing records are not rewritten or deleted. Permanent deletion,
bulk operations, participant support and backup/restore tools remain unfinished.

## Verification

Focused tests cover live authorization changes, exact receipts, concurrent
reopening/removal, transaction rollback, database reopen, AI deadline and credential
preservation, strict client projections and combined directory pagination/search.
The administrator HTTP verifier creates dedicated rooms for archive/unarchive,
closure/removal composition and unchanged saved player views/history. Browser
acceptance exercises actual confirmations, a lost successful response followed by
refresh and exact retry, persistent notices, mobile controls and saved-seat reads.

Keep source-bound checks, saved-record comparisons and deployed acceptance separate.
Local checks do not establish authenticated production acceptance; that remains
pending authorized QA operator access. See [verification workflow](VERIFICATION_WORKFLOW.md).
