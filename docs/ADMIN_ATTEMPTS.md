# Administrator failed-attempt history

Added 7 October 2026 as owner-only, read-only administration scope. It records
rejected administrator authentication and authorization attempts in a durable,
secret-free form so an operator can notice repeated failures without learning
anything private about the person who made them.

## What is recorded

| Kind | Reason | When |
| --- | --- | --- |
| `login` | `invalid_key_format` | The presented key is not a string or does not match the printed key shape. |
| `login` | `unknown_or_disabled_key` | No enabled account matches the key hash, or the credential changed between the read and the session write. |
| `session` | `missing_session` | No session cookie, or a token that is not 64 hex characters. |
| `session` | `unknown_or_expired_session` | The session is unknown, revoked, expired, generation-stale or belongs to a disabled account. |
| `role` | `role_denied` | A live session whose role is not in the requested set. |

The unknown/disabled distinction is deliberately collapsed into one reason: the
lookup cannot separate them without becoming an account-enumeration oracle.

Only the reason, the kind, the attempted role and an already-known account id
are stored. **No key, key hash, session token, session hash, request body,
origin, address or user agent is written.** A successful sign-in and a
successful privileged request record nothing.

## Reading it

`GET /api/admin/operations?attempts=1` requires a live owner session, checks the
`X-Dune-Admin-Id` header against that session, and answers `no-store`. Any other
query combination is rejected with `400`, and an anonymous or non-owner request
is rejected with `401`/`403` before any row is read. The same request without a
query returns the aggregate sample, `?integrity=1` runs the manual SQLite check
and `?stalled=1` samples stalled rooms.

The response carries the sample time, the seven-day reporting window, the total
inside that window, per-reason counters and at most `ADMIN_ATTEMPT_LIMIT`
(twenty) of the most recent attempts, newest first. The operations page renders
both, truncating each account id to eight characters.

## Privacy and safety

Recording is **best-effort**: `recordAdminAttempt` swallows its own failure, so
a rejected request keeps its original answer even when the attempts table is
unavailable. The write happens inside the same rejection path that already
decided the outcome, so it cannot turn a rejection into an approval, and the
read path repeats live owner authority inside its own batch.

The history is diagnostic only. Nothing in it locks out an account, disables a
key, revokes a session or repairs a room automatically; those stay explicit
owner actions with their own audit. It also does not rate-limit or block
requests — it reports them.
