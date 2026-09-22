# Administration panel requirements

Added to the goal on 22 September 2026 at the user's request. This is required
product scope. The first access and directory prototype is available at `/admin`;
the remaining room operations are unfinished. Reuse the existing room, session,
recovery and persistence systems where suitable.

## Required capabilities

| Area | Required behavior | Stage |
| --- | --- | --- |
| Administrator access | Personal access keys, server-enforced owner/operator/viewer roles, persistent eight-hour sessions, individual/all-session sign-out and operator provisioning/revocation. A room host is not a site administrator. Account-management UI and further operational permissions remain. | Prototyped |
| Room directory | Search room codes/public player names, filter status/rules/availability, sort and paginate; show host, roster, modules, game change time, pause/join flags and bounded decision ownership. Detailed setup/shared-window ownership remains. | Prototyped |
| Create and configure | [Create a lobby](ADMIN_ROOM_CREATION.md) with an explicitly owned new host seat, Basic/Advanced preview and initial AI configuration; invite humans and use ordinary lobby controls/voluntary host-seat handover. [Neutral lobby configuration](ADMIN_LOBBY_CONFIGURATION.md) adds rules/modules, AI seats and host assignment to an existing human without private access. Reserved human seats remain. | Prototyped, partial |
| Lifecycle and removal | [Pause/resume and joining locks](ADMIN_ROOM_CONTROLS.md), plus [recoverable removal/restoration](ADMIN_ROOM_REMOVAL.md), have controls, durable audit, exact retries and player/AI enforcement. Close/end, archive, permanent deletion and bulk actions remain missing. | Prototyped, partial |
| Participant support | Remove disruptive participants or revoke access, manage appropriate restrictions, assist saved-seat recovery and host reassignment, and use supported AI takeover/replacement without losing forces, cards or decisions. | Missing |
| Saved-game operations | Create/list/download backups, validate imports, restore a selected checkpoint safely, and diagnose or resume interrupted automatic work through authoritative game actions. | Missing |
| Operations and audit | Show server/build/storage health, room/player counts and actionable errors; provide maintenance controls and a searchable record of administrator actions. | Missing |

Track each area through Missing, Prototyped, Integrated, Verified and Polished.
As implementation begins, link its controls, server actions, persistence,
documentation and evidence. A working directory alone is not a full admin panel.

## Access and directory prototype

Use **Administration** in the home-page footer or visit `/admin`. Every directory
request checks a separate administrator session; seat cookies and forwarded
identity headers cannot grant access. The standalone NAS runtime has no trusted
Sites identity dispatcher, so this panel uses separately provisioned personal
keys. Each key contains a random 256-bit secret. Only its SHA-256 hash is stored;
sign-in issues a separate random, hashed session with an eight-hour absolute
expiry. HTTPS uses Secure, HttpOnly, SameSite=Strict cookies scoped to the admin
API. Mutations require the exact configured origin and bounded JSON requests.

All three roles may read the current directory and sign out their own sessions.
Owners/operators may pause/resume rooms and lock/unlock new joins through
[Room controls](ADMIN_ROOM_CONTROLS.md). The role is checked from the live
account, never accepted from a client.
Owners/operators can also [create a configured lobby](ADMIN_ROOM_CREATION.md),
with explicit new-host ownership and saved exact retries.
[Configure lobby](ADMIN_LOBBY_CONFIGURATION.md) changes supported rules, AI seats
and the host without granting private seat access.
[Remove or restore](ADMIN_ROOM_REMOVAL.md) blocks ordinary room access while
preserving the game, seats and access revocations. Use the Directory filter to
find removed rooms; restoration retains prior pause and joining settings.
Disabling an account invalidates its sessions; later re-enabling it cannot restore
them. The database refuses to disable, demote or delete the final enabled owner.
No default key, public account creation or host-to-administrator promotion exists.

The directory uses an explicit field allowlist, independent of any player view.
It never returns hands, Traitors, predictions, plans, private messages, recovery
records or raw saved state. Searches inspect only codes and public player names.
Each page is limited to 25 rooms and repeats authorization in its read transaction
so concurrent revocation cannot expose a later directory snapshot. Malformed
saves are marked unreadable without leaking their contents or breaking searches.
Last game change refers to the room's saved-state timestamp, not private messages.
Shared windows and setup currently use broad pending labels; these labels do not
assert that a human is stalled or identify hidden-card-dependent eligibility.

Implementation: [panel](../app/admin/page.tsx), [access](../db/admin-access.ts),
[directory](../db/admin-directory.ts), [HTTP boundary](../lib/admin-http.ts),
[additive migration](../drizzle/0008_admin_access.sql), and
[operator CLI](../tools/admin-access.mjs). The migration's explicit SQLite triggers
enforce final-owner protection and account revocation/provisioning audit; retain
them when generating future schema changes. Audit browsing is still pending.

### Initial owner and access recovery

From the development checkout, apply additive migrations, then create a personal
owner key in a new private directory outside the checkout:

```sh
npm run db:local
node tools/admin-access.mjs --name 'Owner' --role owner --out /private/dune-owner
npx wrangler d1 execute DB --local --config tools/wrangler.local.json --persist-to .wrangler/state --file /private/dune-owner/provision.sql
```

The parent directory must already exist. Output files are mode 0600 in a new
mode-0700 directory. `access-key.txt` contains the sign-in key; `provision.sql`
contains only its hash. Keep the key in a private password manager or protected
file, outside Git, logs and chat. The command never connects to a database or
prints the key. Apply the SQL only to the intended instance. Do not upload a
development key to production; provision separate accounts there.

For the container, run the bundled CLI inside the existing `dune` container
(using its actual container ID/name), with output such as `/data/admin-owner`.
Apply the generated SQL using `node node_modules/wrangler/bin/wrangler.js d1
execute DB --local --config tools/wrangler.local.json --persist-to /data --file
/data/admin-owner/provision.sql`. A protected volume snapshot should precede
operational changes. Retrieve the key through an authorized private channel and
retain the account ID shown by the CLI. No application restart is needed.

To revoke an account, generate a new private output directory with
`node tools/admin-access.mjs --revoke ACCOUNT_UUID --out /private/dune-revoke`
and apply its `revoke.sql` using the same instance-specific command. To replace
a lost/compromised owner key, provision a replacement owner first, verify access,
then revoke the previous account. Existing games and seats are unchanged.
**Sign out everywhere** revokes browser sessions but keeps the personal key valid.

### Focused verification

```sh
npm test -- admin-access admin-directory admin-http
npm run test:integration -- admin-boundary
node tools/verify-admin.mjs --url http://localhost:3000 --key-file /private/dune-qa/access-key.txt --qa-account ACCOUNT_UUID --out /private/dune-admin-report
```

The HTTP verifier requires a **dedicated QA administrator account** and explicitly
checks its ID before proceeding: it creates a named QA room and signs out all
sessions of that QA account. Never supply a human operator's normal key. It checks
authentication, cookie properties, ordinary-host denial, directory privacy,
session revocation and unchanged game/seat continuation. Operator/owner QA keys
also create dedicated rooms for joining locks, pause/takeback/resume,
administrator creation, invitations, voluntary host handover and neutral lobby
configuration with existing-human host assignment and a real game start. They
also remove/restore a separate QA game, preserving its paused state, discussion,
saved seats and revoked credentials. Private reports retain
room IDs and safe outcomes, never keys/cookies. The container verifier provisions
its own disposable QA account and checks admin-session continuity across restart
and replacement, followed by the HTTP flow and HTTPS-proxy cookie behavior.

Local browser checks cover sign-in, directory filters, refresh restoration and
mobile layout. Final source-bound checks and separately recorded deployed
acceptance accompany each checkpoint; a local pass is not production evidence.

## Behavior and safeguards

Every privileged endpoint must authenticate and authorize its caller. Support
least-privilege roles, secure initial provisioning, safe credential/session
management, and accessible desktop/mobile controls. Do not ship default shared
credentials or expose administrator capabilities through ordinary room cookies.

Default views must preserve hands, Traitors, predictions, sealed plans, private
discussion and recovery credentials. Any necessary private support access must
be separately authorized and audited; it must not reveal information to other
players or feed an administrator's playing seat or AI strategy. Redact secrets
and private card contents from routine logs and reports. Backup access needs
equivalent protection, since backups can contain private state.

Pausing must stop human mutations and automatic/AI continuation consistently
without losing pending decisions. Resuming restores the same turn and pacing.
Seat removal or reassignment must explain the effect on an active game and
preserve a legal continuation; do not simply delete a faction's physical pieces.
Existing consent/recovery boundaries remain applicable to seat access.

Use authoritative rules and the existing concurrency model. Reject stale or
duplicate destructive actions safely. Imports and restoration must validate
schema, custody, private-information boundaries and session ownership; capture
a recovery checkpoint before replacing current progress. Never restore old
credentials in a way that silently reauthorizes a revoked participant.

Room removal should be reversible by default. Permanent deletion and bulk
operations must identify the selected rooms and dependent records, explain
irreversibility, require deliberate confirmation and retain appropriate audit
evidence without keeping purged secrets. Protect unrelated games. The existing
saved-game preservation rules still govern development and maintenance; they
do not preclude intentional room deletion through the authorized product workflow.

Record who acted, when, the affected room/seat, operation, reason, outcome and
safe before/after metadata. Maintenance controls must warn about interruptions
to active games and preserve restoration. Do not recreate recurring restarts or
cleanup schedules. Do not add an arbitrary game-state editor that bypasses rules,
silently changes outcomes or makes unfinished modes appear complete.

## Development order and acceptance

Prototype permissions and the room directory first, then room creation and
reversible lifecycle operations, participant support, backup/restore and
operational tools. Include functional server actions and saved continuation in
each slice; continue independent game features in parallel where useful.
Administration is part of the non-AI completion gate in the
[AI development plan](AI_DEVELOPMENT_PLAN.md).

Acceptance requires working controls and documented setup/recovery procedures,
with authenticated HTTP and persistence tests for authorization, privacy,
concurrent actions, exact retries, related-record handling and safe restoration.
Verify pause/resume with both humans and AI, archive/delete/restore with saved
rooms, and denied admin actions by ordinary players. Exercise desktop/mobile
flows and server restart recovery. Use dedicated test rooms and preserve all
unrelated saved games; complete independent security/privacy/persistence review.
Verify the panel's relevant deployed flows at
**https://dune.procrastination.games**, including denied access by ordinary
players, using the [production verification workflow](VERIFICATION_WORKFLOW.md#verify-the-deployed-application).
The full goal remains unfinished until this scope and the other completion
criteria are satisfied.
