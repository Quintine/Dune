# Administrative participant AI

The **Participant AI** action in the administration directory enables an existing
AI difficulty for an absent human in a paused, started game. This is a bounded
participant-support prototype. It does not revoke access, remove a faction,
replace a permanent AI player, or give an administrator a private seat.

## Use

1. Find the room and use **Room controls** to pause it at an appropriate point.
2. Open **Participant AI**. Select an eligible human, choose Easy, Medium, Hard or
   Brutal, and enter a short operational reason without private information.
3. Type the room code, acknowledge that the player keeps their seat and can take
   back control, then choose **Enable participant AI**.
4. The room stays paused. Resume it separately through **Room controls** when
   everyone is ready. The existing 1.5-second AI continuation delay starts then.

Owners and operators may apply the action; viewers may inspect public participant
availability. The room must be in setup or play, paused, open, unarchived and not
removed. The target needs a current human seat credential and no existing AI
controller. Use existing lobby configuration for permanent AI seats before play.

The human can use **Take back control** even while paused. Their forces, cards,
resources, sealed choices, host assignment, credentials, recovery kits, handovers
and discussion remain saved. Unused permissions that this participant gave
others to start AI are revoked atomically; permissions merely delegated to them
are unchanged. The public chronicle truthfully identifies an administrator's
controller change without exposing the administrator's identity or audit reason.

## Saved requests and authority

The exact operation identifier, room and pause versions, participant, difficulty
and reason are saved in account/room-scoped session storage before sending.
First submission shows concise progress. Uncertain responses retain explicit
retry controls, including after refresh. A different unresolved request cannot
overwrite the saved proof. Success text persists until another deliberate action.

**Retry saved request** confirms the original result even after the player takes
back control, the room resumes, or an administrator removes it. It never enables
AI again. After signing in again, use All rooms in both directory filters to
find later removed/archived rooms and reopen these controls. An unreadable local
record requires explicit acknowledgment before discarding it; that does not undo
any server operation.

The server repeats live session/role, room version, pause revision, lifecycle and
target-seat checks inside the transaction. Game write, audit receipt and unused
outgoing permission revocation commit together. A rejected/racing request cannot
partially change the game. Replayed operations remain bound to their original
administrator, room and payload. Administrative reads return an explicit public
roster; they do not use a private player view or return credentials.

Saved games pass a bounded core/continuation shape check before this controller
change. The ordinary authoritative engine still applies module integrity checks;
the operation also verifies that only the chosen controller and one chronicle
event changed. This is not a general import validator or complete rules
certification. Unreadable saves are preserved for inspection rather than repaired
by the administration action. No worker or bot action is scheduled while paused.

## Implementation and verification

Controls: [panel](../components/admin-seat-ai.tsx), [client retry](../lib/admin-seat-ai-client.ts).
Authority and persistence: [route](../app/api/admin/rooms/[code]/seat-ai/route.ts),
[transaction](../db/admin-seat-ai.ts), [engine adapter](../game/admin-seat-ai.ts),
[additive migration](../drizzle/0015_admin_seat_ai.sql).

```sh
npm test -- admin-seat-ai
npm run test:integration -- admin-boundary
```

The dedicated administrator verifier also exercises enable, frozen polling,
private-seat continuity, takeback and replay after resume in a new QA room.
Unit/recovery checks cover JSON-restored Basic/Advanced setup, malformed core,
precise mutation scope, concurrent duplicate/conflicting requests, commit-time
authority and seat revocation, rollback and the existing resume deadline.
Independent review, browser acceptance, preservation and full checkpoint checks
are recorded separately. Positive deployed administrator acceptance still needs
explicitly authorized production QA access; local passes do not establish it.

Participant restrictions/removal, administrator-assisted recovery, further
replacement workflows and the rest of the complete admin panel remain unfinished.
This work does not refine AI strategy or open expansion/publication gates.
