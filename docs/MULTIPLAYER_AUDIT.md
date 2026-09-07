# Multiplayer persistence and recovery audit

Independent audit performed during active development on 2026-09-06 against `http://localhost:3000`. The audit used fresh rooms created through the public API. It did not inspect or change human playtest room `EN4L8NTV`, restart the server, modify existing test fixtures, or perform browser interaction.

## Integration follow-up

The findings below describe the earlier audited snapshot. Bounded request recovery is now implemented and independently reviewed:15-second deadlines, GET-only reconciliation, serial polling, stale-context rejection, explicit retry after transient invite failures and uncertain408/5xx handling. The browser exercised restoration after a server error and after a controlled restart; a deliberately hung browser POST remains unverified.

Owner-proved lost-cookie recovery is now implemented with private saved kits, hashed keys, exact retry receipts and old-token write/read fencing. It preserves sealed game state. **20/20 persisted/database tests pass**, including13 seat-recovery tests and7 earlier multiplayer/concurrency scenarios. Independent review reproduced and then permanently tested rollback, proof/receipt/key replacement interleavings and competing distinct claims. Both additive migrations are applied locally. See [implementation status](IMPLEMENTATION_STATUS.md) and [visual playtest](VISUAL_PLAYTEST.md).

The abandoned-seat finding is only partly resolved: recovery requires a previously saved kit. Initial create/join receipts and voluntary own-seat AI delegation have since been implemented. Intentional transfer to another person, unprepared abandoned-seat recovery and durable unattended scheduling remain incomplete. The design below is historical for features now covered in `AUTOPILOT.md` and the current implementation ledger.

## Executed validation

| Check                                | Result   | Evidence                                                                                                       |
| ------------------------------------ | -------- | -------------------------------------------------------------------------------------------------------------- |
| Existing persisted multiplayer suite | 4/4 pass | `npm run test:multiplayer`; `/tmp/dune-agent-multiplayer.log`; terminal exit 0                                 |
| Additional recovery regressions      | 3/3 pass | `node --import tsx --test tests/multiplayer-recovery.test.ts`; `/tmp/dune-agent-recovery.log`; terminal exit 0 |
| New regression file formatting       | Pass     | `oxfmt --check tests/multiplayer-recovery.test.ts`                                                             |
| New regression file lint             | Pass     | `oxlint tests/multiplayer-recovery.test.ts`                                                                    |

The restricted sandbox blocked the first test launches. Approved escalation allowed the test runner to use local IPC/network access. These launch failures were environmental and did not exercise the application.

The existing suite verified independent cookies, private hands/spice/traitors, concurrent optimistic updates, restored setup and battle decisions, and a shared six-seat Bene Gesserit response. It also completed two persisted games containing one human-controlled policy seat and five AI seats spanning Easy, Medium, Hard and Brutal: one base game and one with tech tokens. Both final results were reread from the API. This is limited complete-game evidence; it does not establish AI strength calibration or coverage of the unfinished expansion combinations.

The new `tests/multiplayer-recovery.test.ts` adds three distinct regressions:

1. A readiness action is accepted, then its exact original payload is replayed three times as if its first response was uncertain. Every replay returns 409. A fresh read exactly matches the accepted result, and a subsequent action at the new version remains possible. This tests a non-idempotent action: a duplicate would otherwise toggle readiness back.
2. Two unauthenticated requests race to claim the same faction. Exactly one creates a seat, the losing response issues no cookie, and the room version increases once. The loser can retry with another faction. An authenticated rejoin with different submitted name/faction restores the original seat without changing version, player count or identity.
3. A valid token from one room is placed in a cookie named for another room. Both read and action requests are rejected, return only an error, and leave the target room unchanged.

## Persistence and concurrency review

`db/rooms.ts` stores the complete state as JSON alongside an authoritative version. Actions first check the submitted version, calculate the next state in memory, and update with `WHERE code = ? AND version = ?`. A losing concurrent writer returns a conflict instead of overwriting the winning state. Invalid engine actions never reach the write. Bots run within this candidate transition and are committed with the same version check.

Room creation batches the room and first credential. Joining batches the conditional room update with a conditional credential insert. The executed race confirmed a single surviving faction claim. Seat authentication hashes the bearer token and matches both its hash and the room code. The API returns `viewGame`, not stored state, and marks responses as non-cacheable. Tokens use HttpOnly, SameSite=Strict, room-scoped cookies; HTTPS additionally sets Secure.

Duplicate actions have at-most-once state effects when the original version is retained. There is no replay receipt: clients receive 409 and must read the current state to learn the outcome. The current UI refreshes after an HTTP error. This is different from transparent idempotent replay, but the tested state protection works.

## Concrete remaining recovery gaps

### P2: an unresolved network action can indefinitely disable controls

`app/page.tsx:112` awaits fetch and response JSON without an abort signal or timeout. `busy` is cleared only after those awaits settle (`app/page.tsx:129`). If the transport remains pending, the action controls remain disabled even if subsequent polling succeeds. Refresh polling at `app/page.tsx:31` also has no timeout and can accumulate overlapping pending requests.

This was a source-level finding against the audited snapshot; a hanging transport was not injected in the browser during this audit. The coordinating agent has assigned the request-timeout and refresh-lifecycle fix to the component agent; this report does not claim that fix has been independently revalidated. Add a bounded request lifecycle, prevent overlapping polling, and on uncertain action completion reread server state before offering a retry. Do not automatically repeat a non-idempotent action with a newer version. Validate an accepted-but-response-lost request, a request that never settles, recovery after timeout, and removal of obsolete pending polls on room exit.

### P2: an abandoned human seat has no recovery or replacement path

Authentication requires the room cookie (`db/rooms.ts:71`). Rejoining with a valid cookie works, but a player whose cookie is lost cannot reclaim an occupied faction. The lobby management branch at `game/engine.ts:5292` manages AI seats only, and there is no playing-game human handoff, replacement, or negotiated abandonment flow. An absent human who owns a mandatory decision can therefore prevent completion indefinitely.

Normal waiting for a temporarily disconnected player is legitimate; it should not trigger an automatic forfeiture. Add an explicit, authorized seat-recovery or handoff policy with clear ownership and private-information boundaries. Validate that reconnecting with the retained credential resumes the decision, that unrelated players cannot take the seat, and that any replacement mechanism invalidates obsolete credentials atomically. A lost initial join response before delivery of its credential needs an explicit recovery policy as well.

## Limits and acceptance gates

- No restart was performed by this agent. Reading the game after an ordinary request does not demonstrate restoration across a process restart. The coordinating agent owns controlled restart verification.
- No network disconnection, hung-browser request, or mobile/visual test was executed here. Another agent owns browser playtesting.
- These tests do not enable advanced or incomplete faction/expansion starts. `docs/IMPLEMENTATION_STATUS.md` remains the source of implementation gates.
- Seven passing persisted tests cover the scenarios above, not all valid player counts, official module combinations, every sealed interaction, or full release readiness.
- No server, engine, or existing test file was modified during this audit. The new test must be included in the coordinating agent's multiplayer test command.

## Proposed disconnected-seat contract (design only)

This proposal changes operational control of a seat, not board-game rules. It is not implemented or included in the passing test count. Preserve the same player ID, faction, resources, hand, traitors, promises, submitted plans, decision ownership and history throughout every transition. Never restart setup or reveal a sealed plan merely because its controller changes.

### Distinguish three cases

- **Temporary disconnect:** retain ownership and wait. A last-seen timestamp is a connectivity hint, not proof of abandonment or permission to take private information. A working room cookie resumes immediately without a game mutation.
- **Forgotten/lost cookie:** the same owner proves possession of a separate private recovery key. Rotate the browser credential, fence the old session and return that owner's existing view. The room code, display name and selected faction are not sufficient proof.
- **Intentional transfer or abandonment:** an authenticated owner may transfer control, or a delegate may request only the substitution powers that the owner explicitly authorized beforehand. Host status alone never grants access to another human's hidden hand.

### Persistence and authentication

Add a `seat_controls` row keyed by `(room_code, player_id)` with `generation`, `controller_kind` (`human`/`bot`), `recovery_hash`, nullable `delegate_player_id`, `delegate_ai_allowed`, and timestamps. Existing seats migrate as human-controlled generation 0 with no recovery/delegate authorization. Associate every `seats` token row with a generation. Recovery/transfer endpoints should also work for legacy rooms after the authenticated owner sets up recovery.

Add hashed, expiring grants in `seat_transfer_grants`: grant ID, room, target player, expected generation, grant-secret hash, expiration, revoked/claimed state and claim receipt hash. Public `GameView` must not include any grant secret, recovery hash, credential hash or receipt secret. Tokens must use cryptographic randomness with at least 256 bits of entropy, be sent only in POST bodies or HttpOnly cookies, and never appear in URLs, game history or diagnostic logs.

Return an authentication context containing player ID, token hash and generation instead of only player ID. Every game-state write must atomically require the current credential and control generation in addition to the existing room-version comparison. A rotation must increment both the control generation and room version in the same transaction that revokes old credentials and issues the replacement. Otherwise an old request that authenticated just before revocation could still modify the game afterward. Joining, control changes and game actions must share the same version fence. Failed compare-and-swap operations must not partially consume grants or issue active credentials.

Reads must load authentication and room state consistently. A response authorized before revocation cannot be pulled back once transmitted, but a request authenticated after revocation must not read the seat. All new endpoints keep the existing origin checks, bounded request bodies, no-store responses and cookie protections. Apply bounded rate limits to unauthenticated recovery and grant-claim attempts without leaking whether a player ID or key exists.

### API and UI contract

Use dedicated management endpoints under `/api/rooms/:code/control`; do not smuggle these operations through ordinary phase actions. All authenticated mutations include `version` and an operation ID. Return stable machine-readable conflict codes alongside player-facing text so clients can distinguish stale state, revoked credentials and expired grants.

| Operation                  | Required authority and request                                                            | Result                                                                                                                                                                                                                                              |
| -------------------------- | ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST .../recovery-key`    | Current seat cookie, version, new client-generated private recovery secret                | Store its hash; replace any previous recovery key. Return no gameplay changes besides management/version metadata. UI tells the owner to save the key privately and never share it as an invitation.                                                |
| `POST .../recover`         | Player ID, recovery secret, operation ID and new client-generated session secret          | Atomically revoke prior sessions, advance generation, install the new credential and return the same seat's private view with Set-Cookie. No host approval is needed because the recovery key proves control.                                       |
| `POST .../transfer`        | Current seat cookie, version and operation ID                                             | Create one short-lived, single-use grant bound to this generation; return its secret once to the owner. UI explicitly says the recipient will control this faction and see its existing private information. Creating a grant does not freeze play. |
| `POST .../transfer/claim`  | Grant ID/secret, operation ID and new client-generated session secret                     | Atomically consume the grant, advance generation, revoke all old seat credentials and recovery keys, install the recipient credential, and return the latest private view. A same-request authenticated cookie for a different seat is rejected.    |
| `POST .../transfer/revoke` | Current seat cookie, version and grant ID                                                 | Invalidate an unclaimed grant. Expired or consumed grants cannot be revived.                                                                                                                                                                        |
| `POST .../delegate`        | Current owner cookie and version; delegate player ID and explicit AI-substitution consent | Persist the owner's narrow permission. Show it to the table and reset lobby readiness when the table's operational policy changes.                                                                                                                  |
| `POST .../substitute-ai`   | Authorized delegate cookie and version; target player ID and difficulty                   | Execute only the previously granted AI substitution. Preserve seat identity/game state, fence former human credentials, clear active grants, and set the existing AI difficulty field for that player. No human receives the target's private view. |

For recovery/claim retry safety, generate the new session secret on the receiving client before submitting. Keep it temporarily until Set-Cookie and a follow-up authenticated read succeed. Persist a hashed operation receipt bound to that same secret and the resulting generation. Retrying the exact operation with proof of the resulting session can reissue the same cookie without a second rotation. After a later generation change, that receipt must stop working. This avoids consuming a one-use grant and then stranding its recipient if the successful response is lost. It also avoids storing plaintext session credentials. Clear temporary secrets after confirmation; never automatically retry with a new secret or operation ID following an uncertain outcome.

The same principle should cover initial create/join: send a client-generated request/session proof and provide an idempotent receipt so a lost first response does not create an inaccessible occupied seat. This needs a separate migration/API implementation; the current create/join endpoints do not support it.

A current owner can revoke delegate permission until a substitution commits. An authorized replacement requires a clear confirmation naming the target faction and the AI difficulty. Use a courtesy grace period and a visible pending notice to allow a returning owner to cancel. The grace period is product behavior, not a GF9 rule and not authorization by itself. Persist deadlines on the server so refresh/restart neither skips nor restarts them. Recheck permission, generation and explicit cancellation at commit time. A takeover proposal must not itself block ordinary gameplay or extend its own deadline.

Do not silently enable delegated substitution in existing rooms. For new rooms, offer it in the lobby with separate explicit consent from each affected human. Without prior delegation, only that seat's owner/recovery proof can transfer it; show “Waiting for [name]” rather than claiming a stall has been fixed. If the absent seat is the host, a separately nominated table co-host may manage nonsecret lobby operations; neither co-host nor remaining-player votes imply ownership of the absent seat's secrets.

Transferred credentials establish possession, not real-world identity. Anonymous rooms cannot prove that a recipient is a different person or prevent someone from using a second browser. Do not claim identity guarantees that the current account-free design cannot provide.

### Required acceptance tests before enabling control transfer

1. Rotate ownership during an existing sealed battle, prescience answer, Truthtrance question and faction decision; preserve all submitted commitments and expose only the target seat's entitled view.
2. Race an old-token action against recovery/claim. Either the action commits first and the recipient inherits it, or transfer wins and the old action cannot commit. Never permit a stale-generation action afterward.
3. Race two claims, revocation versus claim, owner cancellation versus delegated substitution, and room-version updates versus management actions. Exactly one valid transition commits with no orphan credential or consumed-but-unissued grant.
4. Lose the successful recovery/claim/create/join response. Retry the exact receipt proof and recover the same credential without a second seat, state mutation or additional rotation. Reject altered operation IDs, secrets, rooms and later-invalidated generations.
5. Demonstrate that room codes, names, host cookies, other-seat cookies, expired grants and revoked recovery keys cannot acquire the target seat. Confirm errors reveal no hand, traitor, plan, or credential information.
6. Reconnect normally without changing generation; ensure recent presence alone neither authorizes nor triggers substitution. Verify absent owners with no delegated consent are never silently replaced.
7. Preserve and restore pending grants, grace deadlines, consumed receipts and control generations across a controlled server restart. Keep secrets out of logs, GET URLs, browser-visible room state and public history.
8. Complete a persisted game after consensual AI substitution at each difficulty, retaining already sealed plans and preventing the old cookie from continuing to act.

## Voluntary autopilot follow-up

Current integration adds separate human `autopilot` identity, self-only control actions, preserved private credentials/recovery, gameplay locking while delegated and version-fenced server continuation. Seven engine tests, five SQLite batch/race tests and six HTTP authentication/recovery/completion tests were added. The complete persisted/API suite now passes45 tests; see `AUTOPILOT.md` for contracts and limits. No host takeover or inactivity-based delegation was added. `waitUntil` completion is bounded; durable rescheduling after a server interruption remains unfinished.
