# Creating rooms from Administration

Owners and operators can choose **Create a room** in the administrator directory.
Select a host name/faction, Basic or Advanced preview, optional Tech Tokens and
Stronghold Cards, and zero to five AI players with individual difficulties.
Other human players join through the ordinary invitation. The new human host
stays unready; nothing starts automatically. Tech Tokens still require three
players at start, and Stronghold Cards require Advanced rules. Expansion starts
and complete-mode acceptance remain gated.

Creation explicitly gives this browser the **new** host seat. Open it to change
lobby settings, configure player circles, invite humans and start normally. To
set up for another person, use the existing **Pass your seat to another player**
flow in that lobby; the host player identity and room progress survive transfer.
This workflow grants no access to any existing participant's seat.

Use [Configure lobby](ADMIN_LOBBY_CONFIGURATION.md) to manage rules and AI seats
or assign another existing human as host without a playing seat. Reserved human
seats and remaining administration still belong to
[the full panel requirements](ADMIN_PANEL.md).

## Saved confirmation

Before sending, the client saves one account-scoped creation request privately
in this tab. It contains the exact setup, operation identifier and a new host
session proof. Keep this tab and its storage until confirmation. A timeout or
lost response leaves **Retry saved room creation**; after refresh, reopen
**Create a room** to confirm that same request. It never automatically submits a
second creation. Expired or switched administrator access retains the original
account's pending record for later sign-in.

A matching response replaces the private retry proof with a safe room receipt.
The result stays visible until closed or **Create another room** is selected.
Invitation codes are public to intended players; the private session proof must
never be placed in a URL, log or shared invitation. This temporary retry record
does not replace the host's long-term saved-seat recovery kit.

An exact server retry returns the original room without resetting its lobby,
readiness or later game progress. If the original host session was revoked or
transferred, the receipt reports that access is unavailable and sends no seat
cookie. A stale creation retry cannot recover a transferred seat or overwrite
the recipient's credentials.

## Authority and persistence

The [creation endpoint](../app/api/admin/rooms/route.ts) requires the configured
origin, an administrator session, an owner/operator role and the displayed
account identifier. Ordinary room hosts and viewer administrators cannot use it.
The [database operation](../db/admin-room-creation.ts) rechecks the live account,
role, session generation and expiry inside its atomic write transaction.

Existing engine actions construct the configured lobby in memory. The room,
hashed host session and durable creation receipt/audit commit together or roll
back together. The receipt binds the actor, ordered setup, reason and private
session hash. Reusing an operation for different input or another account fails;
reusing a session proof already recorded in any seat also fails. Random invitation
collisions retry a bounded number of times without replacing another room.

The additive [migration](../drizzle/0010_admin_room_creation.sql) stores safe
configuration, actor, reason, time and hashed receipt identifiers. It does not
copy private game contents or plaintext credentials into the audit. Administrator
responses contain only the room/host identifiers and confirmation flags. Private
gameplay is loaded through the normal authenticated room route.

## Verification

Focused tests cover supported setup and start gates, ordered AI seats, exact
concurrent retries, transaction rollback, live authority, credential reuse,
restart recovery and transfers. Client tests check account-scoped private proof,
storage failure and replacing it only with a matching safe receipt.

The dedicated-operator HTTP verifier creates one extra lobby for this flow,
checks invitation joining and performs a voluntary transfer within that QA room.
It confirms that subsequent creation retries do not revive the former host's
access. The lobby remains saved and does not start AI play. No existing human
room is used. The expanded authenticated HTTP verifier passed all eight groups.

Local browser QA lost one successful creation response, refreshed, reopened the
saved request and confirmed exactly one room and receipt. Its configured host
seat opened through the ordinary route; readiness survived another refresh, and
the QA lobby was left unready. The completed receipt also survived refresh.
At a reported 390-pixel viewport, the form used 16-pixel text and a 44-pixel create
button without horizontal overflow. A requested 1280-pixel override continued to
report 390 pixels, so this run does not establish desktop layout acceptance.

Source, browser, container and deployed acceptance are separate
evidence; authenticated production checks still require explicitly authorized QA
administrator access.
