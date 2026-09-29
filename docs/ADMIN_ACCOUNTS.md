# Administrator account management

Open **Administration → Accounts** as an enabled owner. Operators, viewers and room hosts cannot list or change administrator accounts. The directory shows account names, roles, enabled status and timestamps in pages of 25. It never returns access keys, their hashes or administrator sessions.

## Provision and protect a key

Choose a name, owner/operator/viewer role and operational reason, then review the exact account ID, name, role and reason before confirming. The browser generates a new UUID and 256-bit personal access key with Web Crypto. It saves the exact request in this tab before sending it. The server stores only its SHA-256 hash and returns account metadata, **not the key**. After confirmation, save the one-time displayed key privately and explicitly clear its tab record. Refresh restores an unconfirmed request or the confirmed key until it is cleared. If the response is uncertain, retry the same saved request; do not generate a replacement request or discard the only key copy. Do not place keys in reasons, screenshots, issue reports or shared logs.

## Change or disable access

Choose an enabled account other than your own. Review its exact name, ID,
current role, requested new role or disable, and operational reason before
sending. A role change uses the current account timestamp; a stale target
is rejected and must be reviewed again. Disabling blocks the key and
permanently invalidates current sessions; this page cannot re-enable the
account. **Do not manually re-enable its database row:** without a separate
key rotation, its old access key would become usable again. Provision a new
account instead. Another owner must perform a self-demotion or self-disable.
The database refuses to remove the final enabled owner. Existing game rooms,
seats and recovery kits are not modified.

Each operation has an exact saved identifier and request fingerprint. Concurrent or repeated identical requests resolve to one account change and one actor-attributed audit record; a different request cannot reuse that identifier. Live owner role, session expiry/generation and target version are rechecked at the database write, not inferred from the rendered page. An uncertain role or disable response can be retried from this tab; a conflicting or revoked request remains blocked for review. Tab records are scoped to the original owner account.

Action history shows successful account operations with safe role changes and an operational reason for authorized readers. External CLI provisioning or revocation may still have no human actor attribution. Rejected attempts are not yet part of that history. No browser account operation grants access to a playing seat or reveals saved game data.

## Verification and remaining work

Implementation: [account query and transactions](../db/admin-accounts.ts), [request contract](../lib/admin-accounts.ts), [route](../app/api/admin/accounts/route.ts), [page](../app/admin/accounts/page.tsx) and [additive operation receipt](../drizzle/0019_admin_accounts.sql). Keep the original owner-protection and session-revocation triggers in migration `0008`.

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

Use an isolated owner and disposable target for authenticated end-to-end
account changes; never use a person's normal owner key in a destructive QA
flow. Client/browser fixtures alone do not prove a signed-in **network**
HTTP mutation or production deployment. Key rotation, re-enabling a
disabled account, failed-attempt audit, complete administration and live
acceptance remain unfinished.
