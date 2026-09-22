# Administrative close and reopen

Owners and operators can choose **Close or reopen** beside a room in
Administration. Closing requires a reason, the exact room code and confirmation
that active players have been warned. Reopening requires a reason and review of
the retained pause setting. Viewer accounts can inspect availability only.
Notices stay visible; the operation does not depend on a short timer.

Closing ends further play administratively. It preserves the exact game state,
pending decisions, official outcome and all seats. It does not invent a winner
or replace the engine's game status. Existing authenticated players can still
read their own table and discussion history. New joins, game decisions, AI,
automatic continuation, messages and seat security changes stop. The closed
notice is separate from the saved pause and joining settings, including for
rooms that have never been paused.

Reopening retains those pause/join settings and existing access revocations.
An unpaused started game with AI resumes with a fresh 1.5-second pacing deadline;
a paused room remains paused. No credential is restored, rotated or extended.
Existing physical pieces, cards and sealed commitments remain in the saved game.

## Retries and concurrency

The tab saves the exact account/room operation before sending it. An uncertain
response offers **Retry saved request**, including after refresh and reopening
the controls. Its receipt confirms the original operation and reports current
availability; replaying an old close after a later reopen cannot close it again.
An unreadable local record requires deliberate local discard after inspecting
the room. Discarding a retry cannot undo a server change.

The server checks current owner/operator authority and both the room version and
closure revision. The audit receipt, version fence and closure metadata commit
atomically. Concurrent identical requests create one record. A stale or competing
new request cannot change the room. Failed actions preserve their game, credential
and receipt records. Privacy-safe audit metadata contains operational flags and
timestamps, with no private hands, messages or keys.

Already-completed entry, message, recovery, handover and AI-permission requests
may still confirm their exact receipts while closed, provided their credentials
remain valid. They cannot repeat a mutation, extend permission expiry or revive
revoked access. Keep unconfirmed requests and private kits. A new key/transfer
cannot be enabled until reopening. Local drafts and readable inspectors remain
available while the table's mutation controls are disabled.

## Other administrator controls

Closed rooms remain in the default directory and can be filtered with
**Availability → Closed**. **Running** excludes closed rooms. New pause/join and
lobby configuration changes require reopening; prior exact receipts still work.

[Recoverable removal](ADMIN_ROOM_REMOVAL.md) can also hide a closed room.
Restoring it retains its closure and does not wake its AI. A removed room must be
restored before a new close/reopen transition. Old closure receipts remain
available to authorized administrators while it is removed.

Apply additive migration `0013_admin_room_closure.sql` before this revision.
`room_closures` stores current availability independently of pause and removal;
`admin_room_closures` stores durable audit receipts. No existing game or credential
rows are migrated or deleted. Archive, permanent deletion, bulk actions,
participant support and backup/restore tools remain unfinished.

## Verification

Focused database/runtime tests exercise live roles and revocation, rollback,
concurrent/stale writes, all player mutation commit fences, AI before/after sleep,
automatic normalization, private views, exact receipts, database reopen and
removed-plus-closed restoration. Route tests check that closed reads and exact
AI-permission receipts do not schedule workers. Recovery rendering is checked
without browser globals.

The reusable administrator HTTP verifier creates its own QA room, checks closure
access and disabled operations, and reopens it with its complete saved table,
discussion and current seats intact. Browser checks cover lost successful
responses, refresh/retry, persistent notices, retained local drafts and mobile
controls. Source-bound checkpoint checks and saved-record comparisons are
recorded outside the checkout. Deployed acceptance must match the pushed revision;
local checks alone do not establish production behavior. See
[verification workflow](VERIFICATION_WORKFLOW.md).
