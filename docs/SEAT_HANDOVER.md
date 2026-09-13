# Voluntary seat handover prototype

13 September 2026. This is an operational multiplayer feature, independent of
board-game rules and mode gates. The current human owner can hand their own seat
to another browser with a private one-time kit. No host takeover, inactivity
inference or delegation by another player is authorized by this feature.

## Player flow

- In the table, **Pass your seat to another player** creates a private offer.
  Share its complete kit only with the intended recipient. It expires 24 hours
  after server creation. Ordinary play can continue until acceptance.
- **Cancel handover** invalidates the current offer. A confirmed replacement
  invalidates an older kit. If an owner operation is uncertain, retry it exactly;
  replacing uncertain work requires an explicit acknowledgement.
- The recipient chooses **Accept a seat handover** on the home page, reads the
  kit and confirms the target room and seat. An active cookie for another seat
  in that room is rejected; use a separate browser profile.
- Acceptance preserves the player ID, faction, name, cards, resources, private
  commitments, AI-control setting and game history. It revokes all previous
  browser sessions and recovery authority for that seat. The new owner should
  create their own recovery kit after acceptance.

Offers and exact recipient retry proof remain in private tab-scoped browser
storage across refresh. Claim proof is written and read back before any request
is sent. A dedicated screen retains it while the outcome is unknown and excludes
competing create/join/recovery controls. An exact receipt response and a matching
cookie-authorized read must both confirm the seat. The room URL is anchored before
the proof is removed. Closing the tab or clearing its storage can lose this proof;
explicit abandonment explains that it cannot undo a completed claim.

## Server boundary

The existing `/api/rooms/:code/control` endpoint supports `createSeatHandover`,
`revokeSeatHandover` and `claimSeatHandover`. Only an authenticated seat may issue
or revoke its own offer. The server uses 256-bit client secrets, hashed storage,
a server expiry and room-version comparisons with active-session checks inside
the atomic write. Recovery invalidates an unclaimed offer by revoking its issuing
session. Plaintext secrets never enter game JSON, projected views, URLs or history.

The additive offer and receipt tables preserve existing games and credentials.
The second additive migration also copies existing claimed-offer receipts without changing game or seat authority. Claims alter custody and room version while keeping stored game JSON byte-identical.
Exact claim retries reissue the same session; creating a later offer does not
consume that receipt. A later successful claim or recovery revokes the session
and prevents replay. Invalid proofs reveal no private view. Transport retains
origin checks, bounded bodies, no-store and room-scoped HttpOnly cookies.

## Evidence and remaining acceptance

`tests/seat-handover-client.test.ts` covers kit/proof validation, refresh identity,
storage failures and receipt/read confirmation. `tests/seat-handover-store.test.ts`
executes production SQL against in-memory SQLite for custody, private saved state,
rollback and concurrent ownership changes. `tests/seat-handover-http.test.ts`
exercises the real HTTP boundary, exact retries, revoked cookies/recovery,
cross-origin rejection and competing-seat protection.

Required checkpoint results belong in the verified commit and compact report.
Browser QA in new room `2EMYG4CY` confirmed offer restoration, acceptance with the same four private traitor choices, refresh, and continued play through starting placement and the initial card deal. The recipient reached Storm with Crysknife, Lady Jessica, ten forces in Arrakeen and ten spice. A follow-up created a recovery key and new offer, recovered the same seat, and verified that the invalidated offer was removed from the owner controls while cards, forces and spice stayed intact. This was a bounded desktop journey; existing human game authority was not used. All 218 opening rooms and their 456 seat, 49 recovery-key, 56 recovery-receipt and 106 entry-receipt records remained unchanged after migration and targeted QA.
Full disconnection acceptance across all decisions, unattended continuation,
unprepared abandoned-seat recovery and comprehensive hosted acceptance remain
unfinished. The historical generation/delegation design in
[MULTIPLAYER_AUDIT](MULTIPLAYER_AUDIT.md) remains a broader proposal; current
handover uses exact active-token fencing instead of a separate generation field.
