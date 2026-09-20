# Permission to start another player's AI

An owning human can authorize one named human player in the same started room to
enable a chosen AI difficulty once, within 24 hours. This is optional operational
consent. It does not change board-game rules, transfer ownership or disclose the
owner's private view. It can be used while the owner is online; no inactivity
detector or host privilege substitutes for consent.

## Connected behavior

Below the table, **Let a player start AI for your seat** offers a named player and
Easy, Medium, Hard or Brutal. The owner can replace or revoke an unused grant.
The delegate sees its fixed difficulty and expiry and can activate it once.
Both retain their existing credentials, recovery kits and private views. Public
history names the activating delegate. The owner uses the existing **Take back
control** button; completed AI decisions remain in the game.

The normal `setAutopilot` control branch preserves gameplay and sealed choices.
Activation queues the existing persisted, 1.5-second AI continuation and does not
implement new AI strategy. Setup/playing human seats are supported. Lobby,
finished, permanent-bot and already-controlled owner seats reject new consent or
activation. A delegate must be a different authenticated human in the room.

## Consent and saved continuation

Migration `0006_thick_imperial_guard.sql` adds a separate consent table. Each grant
binds its identifier, owner, delegate, chosen difficulty and expiry to both exact
current seat-session hashes. Only the owner and delegate receive its public
metadata, through the same SQL read that authenticates the viewer and loads the
room. Neither hash is projected. Recovering or transferring either seat makes
old consent unusable; a new owner or delegate must establish fresh consent.

Creation, replacement, revocation and activation use room-version and credential
predicates. A D1 transaction consumes the grant only after its exact versioned
room update succeeds. Taking back or changing one's own AI control invalidates
unused consent in the same transaction. A losing concurrent action cannot leave
the grant consumed without activation, or reactivate a seat after takeback.

Grant identifiers remain durable receipts. Retrying creation can report its
original result but never renews or rearms a used, expired, revoked or replaced
grant. Retrying activation reports prior use without repeating control changes.
Replacement hides older grants from the current permission list while retaining
their receipts. Expiry is enforced by server time.

The browser saves the exact operation, grant identifier and original version in
tab storage before dispatch. An uncertain result offers an explicit exact retry;
refresh restores it. Retry never substitutes a newer version or a new grant.
Clearly rejected operations release the retry record. Explicit abandonment
explains that discarding local details cannot cancel a committed request. No
cookie, recovery secret or private hand is stored in this record.

## Verification and remaining work

`seat-ai-delegation-recovery.test.ts` exercises real SQLite migrations and the
production store, including one-use custody, both session fences, rejected-action
immutability, races and restored continuations. The client tests verify exact
retry storage and target/profile injection rejection. HTTP tests cover session,
origin, private projection, fixed-profile activation, background work and
takeback. Independent review, browser evidence and final check/build/HTTP results
belong to the private source-bound checkpoint and Git message.

This is a bounded prototype of preauthorized absence handling. An unprepared lost
seat still cannot be commandeered by a host. Full network-failure acceptance and
durable unattended scheduling remain unfinished. No mode or publication gate is
opened, and strategic AI work remains deferred until non-AI feature completion.
