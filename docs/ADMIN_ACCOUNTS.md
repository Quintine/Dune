# Administrator account management

Open **Administration → Accounts** as an enabled owner. Operators, viewers and room hosts cannot list or change administrator accounts. The directory shows account names, roles, enabled status and timestamps in pages of 25. It never returns access keys, their hashes or administrator sessions.

## Provision and protect a key

Choose a name, owner/operator/viewer role and operational reason, then review the exact account ID, name, role and reason before confirming. The browser generates a new UUID and 256-bit personal access key with Web Crypto. It saves the exact request in this tab before sending it. The server stores only its SHA-256 hash and returns account metadata, **not the key**. After confirmation, save the one-time displayed key privately and explicitly clear its tab record. Refresh restores an unconfirmed request or the confirmed key until it is cleared. If the response is uncertain, retry the same saved request; do not generate a replacement request or discard the only key copy. Do not place keys in reasons, screenshots, issue reports or shared logs.

## Change roles, disable access or rotate a key

Choose another account and review its exact name, ID, current role and
enabled state, target action, account timestamp and operational reason.
Role changes and disabling require an enabled target. A stale target is
rejected and must be reviewed again. Disabling blocks the existing access
key and permanently invalidates current sessions. Another owner must
perform a self-demotion or self-disable. The database refuses to remove the
final enabled owner. Existing game rooms, seats and recovery kits are not
modified.

**Rotate key** works for another enabled or disabled account. The browser
generates a fresh target-bound 256-bit key, saves the exact request in this
tab, and asks for confirmation of the target and session impact. Rotation
replaces the old hash, increments the session generation, revokes existing
sessions and enables the account while retaining its name and role. A
disabled account is re-enabled **only with the new key**. Previously
retired key hashes are kept privately so later A→B→A rotations cannot
revive an old credential. Never use manual SQL to re-enable an account
without rotating its key. Rotation of your own account is unavailable.
On success, save the one-time displayed key privately before clearing its
tab record. The server never returns the key. An uncertain response must
be retried with the same saved request; discarding it may lose the only
copy. A retry confirms a historical operation, not that its key still
works: another owner may have rotated or disabled the account afterward.
The page compares the latest visible directory row with the saved
operation and warns when it changed or is not on the current page.
Even matching metadata is only a last-read observation; verify sign-in
before distributing a key.

Each operation has an exact saved identifier and request fingerprint.
Concurrent or repeated identical requests resolve to one account change
and one actor-attributed audit record; a different request cannot reuse
that identifier. Live owner role, session expiry/generation and target
version are rechecked at the database write, not inferred from the
rendered page. An uncertain response can be retried from this tab; a
conflicting or revoked request remains blocked for review. Tab records
are scoped to the original owner account.

Action history shows successful account operations with safe role/enabled
changes and an operational reason for authorized readers. External CLI
provisioning or revocation may still have no human actor attribution.
Rejected attempts are not yet part of that history. No browser account
operation grants access to a playing seat or reveals saved game data.

## Verification and remaining work

Implementation: [account query and transactions](../db/admin-accounts.ts), [request contract](../lib/admin-accounts.ts), [route](../app/api/admin/accounts/route.ts), [page](../app/admin/accounts/page.tsx), [original receipt](../drizzle/0019_admin_accounts.sql) and [additive rotation receipt/key history](../drizzle/0020_admin_key_rotation.sql). Keep the original owner-protection and session-revocation triggers in migration `0008`.

```sh
npm test -- admin-accounts admin-audit
npm run test:integration -- admin-boundary
```

The source-bound local checkpoint passes 5,780 offline tests, 55 HTTP
integration tests, the app build and Drizzle migration check. An isolated
Request/Response route-handler smoke exercised owner provisioning, exact
replay, directory read and foreign-origin denial; it did not use a network
server or persistent administrator account. Browser owner fixtures blocked
or intercepted POSTs and verified one-time key recovery and mobile disable
confirmation. Independent security and persistence reviews resolved
unchanged-role audit no-ops, missing point-of-risk copy and a logout-all
timestamp rollback.

The rotation follow-up passes typecheck, lint and 5,787/5,787 offline
cases, the app build, Drizzle migration check and 55/55 HTTP tests against
the supported local development server. An isolated built-worker D1 store
with its own disposable owner/target completed authenticated **network**
provision, rotation, exact replay, disable, fresh-key re-enable, old
key/session rejection, A→B→A refusal, safe audit and foreign-origin
denial. No production account, room or credential was changed.
An actual phone-width owner page exposed the enabled-target review and
confirmation with no key before submission; a separate local-only
completed-record fixture showed the superseded-key warning without
sending a mutation. Independent security review found the historical
replay presentation risk, now corrected by last-read directory
comparison; persistence review reported no scoped finding.

The full 55-case suite against `wrangler dev` of the production build did
**not** pass: the local workerd process intermittently returned 503
mid-request under that suite. A single oversized request returned 413
and later requests succeeded after draining its body, but that does not
resolve the broader worker-restart observation. Development-server
success and focused built-worker mutations are not deployed acceptance.

Use an isolated owner and disposable target for authenticated end-to-end
account changes; never use a person's normal owner key in a destructive QA
flow. Client/browser fixtures alone do not prove a signed-in **network**
HTTP mutation or production deployment. Failed-attempt audit, complete
administration and live acceptance remain unfinished.
