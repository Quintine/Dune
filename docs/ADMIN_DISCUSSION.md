# Administrative discussion controls

**Discussion controls** in the administration directory lets an owner or operator
mute or unmute new public and private messages from one human seat. Viewers can
inspect the public roster and discussion settings. A muted player can still read
history, receive messages and play the game. This prototype does not revoke seat
access, remove a participant or permit administrators to read private messages.

## Use and recovery

Select the human participant, enter a short operational reason, type the room
code and acknowledge that the setting follows the seat. **Mute discussion** or
**Unmute discussion** applies the change. Human seats using AI remain eligible;
permanent AI seats do not send messages. Closed and archived rooms permit settings
for reopening; a removed room must first be restored. Closing a room still blocks
all new sends independently of its seat settings.

The player sees a persistent explanation when muted, with **Refresh discussion
availability** for checking an unmute while browsing older history. Only the
caller's mute status is returned with their message page. Other players receive
no mute indicator or private discussion activity. Incoming history remains under
the existing sender/recipient privacy rules. Recovery and voluntary handover
inherit the logical seat's setting; revoked credentials remain invalid.

The exact admin operation, room version, seat-setting revision, target, setting
and reason are saved in account/room-scoped tab storage before sending. The first
request shows concise progress. Uncertain requests retain explicit retry controls
across refresh; success text stays until a deliberate action. Retrying an old
mute after a later unmute confirms the old receipt without muting again. Existing
committed message requests can likewise be confirmed while muted; altered or
new requests cannot bypass the restriction. A new owner cannot replay the former
credential's message receipt.

## Persistence and authority

Additive migration [0016](../drizzle/0016_seat_discussion_controls.sql) stores
seat settings separately from game JSON. The action leaves room versions, game
change timestamps, private custody, credentials, readiness and AI pacing intact.
It requires the current room version and a separate seat-setting revision. Live
admin authority, human membership, room availability and both versions are fenced
at commit. The setting and audit receipt commit together or roll back together.
Message insertion independently checks the live mute setting in SQL, preventing
a stale browser from sending. A message committed before a later mute still
returns its successful receipt.

Controls: [admin panel](../components/admin-discussion.tsx),
[player discussion](../components/table-talk.tsx),
[client retry](../lib/admin-discussion-client.ts).
Server: [route](../app/api/admin/rooms/[code]/discussion/route.ts),
[admin transaction](../db/admin-discussion.ts), [message store](../db/table-talk.ts).

```sh
npm test -- admin-discussion table-talk
npm run test:integration -- admin-boundary table-talk
```

Focused regressions cover rollback, concurrent/conflicting operations, live
role/session/membership/version changes, stale revisions after unmute, receipt
replay, own-only status, incoming messages, mute/send ordering and seat rotation.
The dedicated admin HTTP verifier creates a new QA room for deny/mute/read/retry/
unmute flows and preserves both seats. Independent SQL/privacy and UI source
reviews found no blocking defects. Browser, checkpoint and preservation evidence
are recorded separately; deployed acceptance must match the running revision.

Access revocation, disruptive participant removal, administrator-assisted recovery,
backup/restore and operational audit browsing remain unfinished. Discussion
moderation is a partial participant-support prototype, not full admin acceptance.
