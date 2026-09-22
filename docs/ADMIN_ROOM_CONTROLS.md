# Administrator pause and joining locks

The directory now offers **Room controls** and an **Availability** filter. Owners
and operators can pause/resume a selected room and lock/unlock new joins; viewers
can inspect its flags. This is a reversible lifecycle prototype. Closing,
archiving, removal, participant support and backups remain unfinished in
[the panel checklist](ADMIN_PANEL.md).

Identify the room, provide a short operational reason, warn active players if
necessary, and explicitly confirm the displayed scope before applying settings.
Reasons belong to the private audit and must not contain credentials or private
game information. Players see only public availability flags.

## Paused behavior

| Operation | While paused |
| --- | --- |
| Game decisions, lobby changes and new joins | Rejected without changing the game |
| Automatic normalization and native/human-owned AI | Stop before work and are fenced again at the database write, including sleeping workers |
| Reading, refresh, discussion and component inspection | Remain available |
| Seat protection, recovery and voluntary handover | Remain available with existing ownership/revocation safeguards |
| Taking back control and revoking AI permission | Remain available |
| New AI permission or activation | Rejected; completed saved requests can still be confirmed |

A joining lock alone prevents new seats. Existing seats can reconnect, recover
or confirm an already completed join. Neither flag removes players, cards,
forces or pending choices. Resume preserves the game and gives existing AI seats
a fresh 1.5-second pacing deadline; it does not settle a player's decision.

## Persistence, authority and retries

The additive [migration](../drizzle/0009_admin_room_controls.sql) stores flags in
`room_controls`, separate from game JSON. A control change, room-version fence
and durable `admin_room_audit` receipt commit together. The audit records actor,
room, time, reason, expected revision and previous/new flags; it contains no
cards, credentials or raw game state. Audit browsing remains unfinished.

Untouched rooms retain their existing player-view shape; an absent control field
means running with joins open. After the first control change, player views keep
the public flags and revision, including after resume. Administrator reads always
return explicit defaults. Operational settings never enter saved game JSON.

The [HTTP endpoint](../app/api/admin/rooms/[code]/control/route.ts) requires the
configured origin, administrator authentication and owner/operator permissions
for writes. `X-Dune-Admin-Id` binds a write to the displayed account, preventing
an old tab from applying that account's saved intent after another account signs
in. SQL rechecks live session, role and generation within the transaction.

Each request has an operation ID, expected control revision, desired flags and
reason. Exact retries confirm the receipt and return current settings without
reapplying old flags. Conflicting revisions or reused IDs cannot overwrite a
later change. The [client](../components/admin-room-controls.tsx) saves the exact
request in account/room-scoped tab storage before sending. Uncertain responses
keep explicit retry controls across refresh. Authentication failures retain the
original account's pending request for confirmation after sign-in. There is no
automatic mutation retry. Deliberately discarding an unreadable local record
does not cancel a server change.

## Verification and remaining gates

Focused in-memory tests execute production SQL for roles, revoked sessions,
stale/conflicting requests, replay, rollback, joined-seat receipts, worker/action
races, pause during AI sleep, recovery/handover and resume pacing. UI tests cover
pause guidance, disabled AI-start controls, available takeback, account-scoped
retry storage and directory filters.

Authenticated local HTTP acceptance uses dedicated QA rooms. A temporary local
transport loses one successful control response: the browser reads the paused
state, refresh keeps the exact request, and explicit retry confirms one audit
row. Player controls disable on pause and return on resume. Mobile controls were
inspected at 390 pixels with 16-pixel labels and a 44-pixel apply button. Existing
games were not reset or used for these operations.

`tools/verify-admin.mjs` creates one room for access checks. A dedicated operator
or owner QA key also creates one room for account binding, joining locks,
pause/takeback/resume and saved-seat checks. Cleanup restores that QA room's flags
and stops its owning human's autopilot. Original failures and cleanup failures
are recorded separately. Never pass a human operator's key. The isolated container
verifier provisions its own QA operator and runs this flow.

Source checks, container checks and deployed acceptance are separate evidence.
Production administrator provisioning still needs explicit access confirmation;
local success does not close that deployed gate.
