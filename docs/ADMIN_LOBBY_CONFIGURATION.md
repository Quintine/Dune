# Configuring lobbies from Administration

Choose **Configure lobby** in the administrator room directory. All administrator
roles can inspect the current public roster, rules, AI difficulties, circles and
readiness. Owners and operators can change Basic/Advanced preview, Tech Tokens,
Stronghold Cards, add/remove/configure AI players and assign the host to an
existing human participant with active saved-seat access.

These controls grant no player seat. The previous host keeps their credentials
and pieces after reassignment; every human must ready again. Host assignment
changes lobby permissions, not private ownership. Reserved human seats, support
for started-game host changes and full participant administration remain pending.

Configuration supports genuine unused lobbies of the six classic factions and
the existing optional Tech Tokens/Stronghold Cards. A paused room must be resumed
first. A joining lock does not prevent configuration. Advanced remains explicitly
unfinished and requires the ordinary preview-start acknowledgement. Tech Tokens
require three players at start; Stronghold Cards require Advanced rules. Changing
to Basic clears unused Stronghold Cards. Normal readiness, player-count and
expansion gates still apply; this is not a general saved-state editor.

## Confirmation and recovery

Every change shows its scope and requires an operational reason and confirmation.
Messages remain visible while the user reads them. The exact operation, version,
action and reason are saved in this tab before sending, scoped to the signed-in
administrator and room. Unknown responses keep **Retry saved lobby request**;
refresh and reopen that room's configuration to confirm the same request.
No new request overwrites an unresolved one.

An exact retry returns the original applied version and current public settings.
It does not reapply an older setting, reset readiness or undo later play. This
also works after a completed request's room starts, pauses or becomes unavailable.
A stale first request fails and requires a refreshed explicit choice. An expired
or switched administrator session retains the original account's retry record.
Corrupt local records require deliberate discard after inspecting current settings;
discarding local data does not undo any change saved on the server.

## Authority, preservation and privacy

The [endpoint](../app/api/admin/rooms/[code]/lobby/route.ts) requires a live
administrator session. Writes additionally require owner/operator authority,
the configured origin, bounded strict input and the displayed administrator ID.
The [database transaction](../db/admin-lobby-configuration.ts) repeats live
authorization, the saved game version, lobby status and pause checks at commit.
Host reassignment also fences the target's current seat access. Concurrent player
actions, starts, joins or support operations cannot be overwritten.

The [focused game adapter](../game/admin-lobby-configuration.ts) checks the entire
unused runtime and physical player pieces against genuine setup. Malformed,
unsupported or mismatched room saves are read-only with generic diagnostics.
Saved-state version metadata may legitimately lag its authoritative database
version after seat or lifecycle operations; the latter controls concurrency.
Existing engine actions calculate rules/modules/AI changes. New public history
uses generic administrator attribution; actual actor and reason stay in audit.

The additive [migration](../drizzle/0011_admin_lobby_configuration.sql) records
the operation, actor, room, request hash, versions, reason and public before/after
configuration atomically with the game update. Exact requests are bound to their
original actor and intent. Game and seat records are never deleted or reset.
Responses use an explicit public projection, independent of GameView, with no
private cards, choices, credentials or cookies. Read/replay remains available
independently of permission to make a new lobby change.

## Verification

Focused regressions cover all supported actions, genuine starts, readiness and
piece preservation, malformed saves, private projection, exact concurrent retries,
transaction rollback, live authority and races with starts, pause, joins and seat
revocation. Client regressions cover strict matching confirmation, account/room
isolation, corrupt storage and replay after play has begun.

`tools/verify-admin.mjs` uses a dedicated QA operator and creates one additional
two-human lobby for neutral configuration. It exercises all seven action families,
both unchanged seat cookies, new-host readiness/start and exact saved retry after
start. Every QA room remains saved. All eleven authenticated HTTP groups passed.
Local browser acceptance confirmed one AI seat and one audit record after losing
a successful response, refreshing and retrying. Rules and AI faction/difficulty/
circle changes survived another refresh. Desktop (1280px) and mobile (390px)
controls had 16px form text, 44px action buttons and no horizontal overflow.
No browser console errors were recorded. Source-bound checks and independent
review accompany the checkpoint. Container and actual deployed checks
are separate; positive production administrator acceptance requires explicitly
authorized QA operator access and remains open until recorded.
