# Table discussion and private seat messages

The table now has an expandable **Table discussion** panel beneath the game.
Humans can speak publicly or choose a named human seat for a private conversation,
in the lobby, during any pending decision and after the game. A human using AI
control can still talk. Permanent AI opponents do not read or answer messages;
AI negotiation remains deferred until non-AI feature completion.

## Message delivery and audience

Each message is plain text, limited to 1,000 characters. HTML and URLs remain
literal text, with no executable markup or external links. The server supplies
the sender's identity. A public message is visible to all present and future
seats in that room; a direct message is visible only to its sender and recipient.
Private messages belong to those game seats: recovery or voluntary handover gives
the new controller access to their history, and revokes the old credential's
access. The panel explains that boundary before sending.

Discussion does not spend spice, change alliances, seal a plan, evaluate prose
promises or execute game actions. Use the existing authoritative game controls
to carry out an agreement. This is communication infrastructure, not a new ruling
about binding deals or a completed negotiation/AI strategy system.

The latest 50 messages in the selected conversation load on opening and refresh
serially every five seconds, with bounded requests. **Load older messages** pauses
live replacement while browsing saved history; **Return to latest messages**
resumes updates. Channel changes discard obsolete read results. There are no
public direct-message counts, typing indicators or global sequence numbers.
Messages are stored durably; pagination does not delete old history.

## Saved retries and state isolation

The browser saves an exact message UUID, recipient and body in tab storage before
sending. An uncertain response keeps the input locked for **Retry exact message**;
refresh restores that same request. Exact repeats save once, and conflicting
UUID reuse never returns another message's body. An already uncertain retry is
not discarded just because a later request fails. Explicitly discarding retry
details cannot undo an already committed send. Unsent drafts are local inputs;
only pending sends have refresh recovery. No credentials enter this storage.

A late response from an unmounted panel cannot erase a newer pending send.
Successful writes return their own receipt even if the seat subsequently rotates.
Replaying under a different seat session cannot reactivate the earlier operation;
the current owner can inspect the conversation and discard obsolete retry details.

Additive migration `0007_clammy_sprite.sql` creates `room_messages` and its indexes.
Every SQL read and insert checks the exact active seat token, room membership and
human status; inserts check recipient membership at commit. The internal sequence
is used only for ordering. Cursor lookups apply the same audience filter as the
message page, so an unknown or hidden UUID does not expose message metadata.
One new message per sender per second bounds accidental rapid submission; exact
retries do not consume another slot. There is no game-version conflict to refresh:
message operations never write game JSON, reset readiness, advance bots or enter
a gameplay continuation. Existing saved games and schema history are preserved.

## Evidence and remaining work

`table-talk-recovery.test.ts` exercises production SQL against the real migrations:
private/public projection, hidden cursors, pagination, exact concurrent retries,
changed payloads, active-token and membership fences, rotation during a write,
store recreation, human AI control and unchanged game rows. The HTTP tests use
real authenticated rooms and sealed setup choices, verify origin/error handling,
exact retries and actual saved-kit recovery. Client tests cover input/receipt
validation, identity-scoped storage and late-completion cleanup.

Independent review found two retry races during implementation; both have been
fixed and regression tested. Browser observations, the final check/build/HTTP
report and saved-row comparison are source-bound private checkpoint artifacts.
This prototype does not certify complete network-failure browser behavior,
notification/unread design, full accessibility/visual acceptance, complete
negotiation rules or any AI strength target. Existing release gates remain closed.
