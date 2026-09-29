# Administrative action history

Open **Administration → Action history** to review recorded operations. The
read-only page unifies the nine existing durable receipt sources: administrator
access, pause/join controls, room creation, lobby configuration, removal,
close/reopen, archive, participant AI and discussion moderation. It does not
create another audit store or change saved games.

Search room/seat/account identifiers or current acting/affected administrator
names. Filter by action group and inclusive UTC calendar dates, then browse
25 records per page. Events sort newest first with deterministic source/receipt
ordering for matching timestamps. New operations can move records between pages;
refresh to fetch current history. Filters and page number live in the URL and
survive refresh and browser navigation. No credentials or reasons enter that URL.

Each record identifies the action, time, room/seat/account where recorded, actor,
operational reason when permitted, and bounded before/after settings. Expand
**Recorded settings** for the public configuration, lifecycle flags, revisions,
AI difficulty or changed player circle. Names come from current administrator
accounts; deleted accounts retain their recorded identifiers. Web-managed
provisioning, role changes and disabling identify the acting owner and record
the supplied reason. External CLI provisioning/revocation may lack human
actor attribution, and the page says so. A **Recorded** outcome means the
operation was applied; a
room-control operation may successfully save identical settings, and later
operations may supersede it. It does not assert the room's current state.

## Access and privacy

All administrator roles may read the safe event envelope and public operational
settings. Only a live owner/operator receives reasons; viewers receive null.
Reasons are excluded from search for every role, preventing a hidden-reason
match/count oracle. Search uses the same validated identifiers and names that
can be displayed, rather than raw historical JSON. Unknown actions and malformed
metadata retain a generic record with unavailable details.

Count and page reads repeat live session, enabled-account, generation, expiry and
role checks inside one database transaction. Reason visibility derives from that
live role, not the role captured during earlier authentication. The browser binds
its read to the signed-in account, clears old results on refresh/error, and
revalidates when focus/visibility or page restoration returns. Already disclosed
information cannot be withdrawn from a browser or copied records.

The query reads durable receipts directly and joins only current administrator
names. It does not join saved games, messages or player credentials. Hashes,
access/session/recovery secrets, session IDs, game state, cards and private
messages are excluded. Raw metadata never reaches the response. Ordinary room
hosts and unauthenticated callers receive no audit history. The route is GET-only
and uses the existing no-store, cookie-varying administration boundary.

## Evidence and remaining scope

Implementation: [query/projection](../db/admin-audit.ts),
[response contract](../lib/admin-audit.ts),
[route](../app/api/admin/audit/route.ts), [page](../app/admin/audit/page.tsx).
The original nine-source read needed no migration. Owner account management
adds a safe `reason` field and durable retry receipts in additive
[migration 0019](../drizzle/0019_admin_accounts.sql); it does not add a
new raw game or message source.

```sh
npm test -- admin-audit
npm run test:integration -- admin-boundary
```

Focused checks cover nine sources, shared operation IDs, deleted targets,
malformed/secret-shaped metadata, reason visibility and search exclusion,
commit-time demotion/revocation/expiry, UTC dates, deterministic pagination and
strict client allowlists. A real room-creation/configuration transaction verifies
the one-based player-circle display. The dedicated operator HTTP verifier reads
its own newly created moderation receipts and checks account binding.
Independent review corrected malformed role coercion, rejected-field search
(including embedded NULs), affected-account name lookup and position-only
configuration evidence. An isolated workerd/D1 regression exercises all nine
sources under its five-term compound-query limit, with live role demotion and
filtered reads. Materialized groups keep the unified query within that limit.

Existing records cover successful operations only. Failed/rejected attempts,
key rotation and re-enable, full operational health/diagnostics,
backup/import/restore and the remaining participant support are still required.
Local/browser/source-bound evidence is separate from deployed acceptance, which
must identify the actual running revision and use authorized QA access.
