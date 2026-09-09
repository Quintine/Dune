# Tupile private intelligence and occupation evidence

Runtime checkpoint, 10 September 2026. Native CHOAM can now request and retain a private Tupile intelligence observation in a game with proven setup history. This implements the bounded disclosure described in the [source contract](HOMEWORLD_TUPILE_INTELLIGENCE_RULES.md); occupation entitlement, expiry and occupied income remain unresolved. Advanced and unfinished expansion starts, publication and complete-rules release retain the gates in [README](../README.md).

## Request and historical answer

The engine accepts `{ type: 'tupileIntelligence', target, category }`, where `target` identifies a seated opposing faction and `category` is `weapons` or `defenses`. The server validates current eligibility before reading the answer or consuming use:

- CHOAM has at most ten native reserves on Tupile and occupation evidence proves that Tupile has never qualified an occupier since setup.
- CHOAM has positive physical forces on a Homeworld native to the target, or that target has positive physical forces on Tupile. Contact can be contested. Sharing a third faction's world does not qualify either visitor as the other's target.
- The faction has not already answered a successful Tupile request during this game. Another category, turn, contact direction, departure or reentry does not renew its use. Either Emperor world supplies contact with the same single faction allowance.
- The game is playing and the current response or committed action permits the request. Pending decisions, responses, Truthtrance, phase openings, supported nested card operations and revealed battles block it. The request does not require CHOAM's ordinary movement turn and creates no opponent confirmation or Karama response.

One accepted action records the target's current spice and the selected held-card count, then consumes that faction's allowance. It does not spend spice, discard a card or move a force. Rejected actions reveal no answer and consume no use. The server's current target projection supplies availability to both the component and bot policy.

Only CHOAM receives the observation. The public chronicle identifies use against a faction without exposing the chosen category, answer, hand identities or private receipt. Other sessions receive no Tupile panel data. The stored answer is historical: a later expenditure or hand change does not update it. A blocked new request, including one blocked by occupation uncertainty, does not hide an already obtained answer.

The [answer helper](../game/tupile-intelligence-answer.ts) counts canonical physical cards in the current hand by printed primary category. Multiple held copies count separately; duplicate physical IDs or malformed identities reject. Caches, discard piles, escrowed cards, leader skills and cards merely compatible with a battle slot are excluded. Richese cards use their verified printed categories despite their transport representation as Special cards. Weirding Way counts as a weapon and Chemistry as a defense using the publisher's default-role FAQ. Applying those defaults to this held-card question is a documented composition, rather than a Tupile-specific FAQ ruling. The unresolved revealed-battle interval is blocked using public timing, independently of anyone's hidden hand. The complete category table and source limitations remain in the [source contract](HOMEWORLD_TUPILE_INTELLIGENCE_RULES.md#private-answer-and-held-card-classification).

## Durable evidence and legacy saves

Genuine completed Homeworld setup creates a paired initialization record:

| Saved field | Purpose |
| --- | --- |
| `homeworlds.historyVersion` | Marks the initialized occupation-history format. |
| `homeworldOccupationHistory` | Binds the setup roster, physical source snapshots, accepted source events and confirmed qualifications. |
| `tupileIntelligence` when CHOAM is seated | Binds lifetime faction usage and private historical observations. |

The engine requires the marker and history together, and requires the CHOAM ledger for an initialized CHOAM game. Deleting an individual initialized field, removing used receipts, changing an answer or altering the bound occupation evidence rejects views, normalization and actions. Original physical contact, turn, phase, faction and event remain part of each intelligence receipt. Historical validation does not compare an old answer with today's hand or spice.

The signatures are canonical consistency data, **not cryptographic authentication**. Independent source receipts let the history validator recompute its qualification records; the outer signature binds their membership and order. They detect the tested inconsistent edits, not an attacker rewriting every field and every matching signature. A wholly absent legacy marker/history/intelligence set remains distinguishable from a partially deleted initialized record only to the extent that those saved fields provide evidence.

Legacy saves without these initialization fields remain readable, with occupation unknown and new Tupile requests blocked. Reads and automatic normalization never adopt the current board as a proven setup, reconstruct departed occupiers, restore a lifetime use or invent an earlier answer. Existing D1 rooms retain their original state; no database reset or bulk history migration installs this feature. Accepted actions use the existing room-version compare-and-swap write, so simultaneous weapon/defense requests against one faction can persist only one answer.

## Occupation observation boundaries

The [occupation-history module](../game/homeworld-occupation-history.ts) records facts rather than choosing a current controller. A sole positive foreign army with no native or other foreign army qualifies immediately. At the end and start of the full game turn, every positive foreign presence gets its own boundary evidence, including contested worlds. Kaitain and Salusa are separate physical locations. Qualification at another Homeworld does not itself remove Tupile's low advantage.

The pure reducer interns public typed-force snapshots, binds each recorded source to its event, turn and cause, and retains the first qualification for each world/player/turn/cause. Replaying a known event with different source facts rejects. A same-turn change call with unchanged physical facts returns unchanged data without appending another empty observation. Returned ledgers are detached from their inputs.

Engine change-event identities derive deterministically from the original setup event and current source-record position. Resolving an action directly or restoring the same committed inner continuation therefore produces the same occupation evidence. Turn-start/end identities derive from their turn and boundary cause. Concurrent branches may propose the same next identity, but the room-version write persists only the winning branch; the reducer still rejects reuse of a recorded identity with different physical facts. Generating a new random change identity during recovery would incorrectly make otherwise identical saved continuations diverge.

The integrated hooks preserve the semantic order of physical changes:

| Boundary | Observation order |
| --- | --- |
| Genuine setup | Seed the visitor-free baseline before the first phase opens. |
| Normal or single-traitor battle | Observe loser elimination before losing-card disposal and separately observe winner casualties. A sole foreign interval remains recorded even if the winner subsequently loses its last force. |
| Mutual traitor or explosion | Observe the completed simultaneous army-destruction group, avoiding array-order qualifications. A later owned native explosion allocation has its own committed boundary. |
| Winner aftermath | Observe complete Ix substitution and Face Dancer replacement before later cleanup. |
| Native departure and revival | Observe after the helper installs all native totals, elite totals and Homeworld custody. The ledger reads only those world groups, so later Arrakis placement or Tanks bookkeeping cannot create an artificial Homeworld interval. |
| Other transfers | Observe complete Homeworld shipment, Junction transport, Emperor inter-world movement, Ambassador shipment, Sneak Attack, Guild transport, revival deployment and Caladan reinforcement before dependent arrival effects. |
| No-Field and Trip to Gamont | Observe the real reveal/departure and the later return separately; a single outer-action scan would miss a transient sole occupation between them. |
| Full-turn rollover | Record the old turn's end before incrementing the turn; record the new turn's start before opening Storm opportunities. |

Action/continuation observation also provides a final check of physical changes. It does not replace the internal battle and transfer hooks. The earlier [lifecycle audit](HOMEWORLD_OCCUPATION_LIFECYCLE_AUDIT.md) remains the historical integration analysis; this checkpoint refines its placement recommendation for helpers that read only complete Homeworld groups.

No history observation grants occupied income, shares spice, awards a unique power or implements expiry. A history complete from setup with no Tupile qualification supplies `unoccupied`; any recorded Tupile qualification supplies `unknown` until the [pending entitlement ruling](HOMEWORLD_OCCUPATION_RULES.md#questions-the-retrieved-sources-do-not-settle) resolves departure, replacement and contested benefits. Departure and native revival preserve that uncertainty rather than declaring a permanent current occupier or silently resetting the advantage. Mere invasion alongside natives does not qualify immediately and is not a blanket block on intelligence before a qualifying boundary.

## Client, bot and verification scope

[Tupile controls](../components/tupile-intelligence.tsx) provide explicit opponent and category selection, one request button, the current blocking reason and private historical observations. Busy and ineligible controls cannot submit. The empty-target explanation distinguishes lack of contact from already-used factions. No opponent hand or balance is read to determine eligibility.

[Shared options](../game/tupile-intelligence-options.ts) supply all four bot profiles with the first currently eligible weapon-count request and stop requesting a used faction. This demonstrates a legal common policy. It does not claim that profiles strategically exploit intelligence differently or add AI strength calibration.

The focused evidence is split across [public eligibility](../tests/tupile-intelligence.test.ts), [canonical counts](../tests/tupile-intelligence-answer.test.ts), [private durable state](../tests/tupile-intelligence-state.test.ts), [occupation history](../tests/homeworld-occupation-history.test.ts), [controls](../tests/tupile-intelligence-controls.test.ts), [actual engine flows](../tests/tupile-intelligence-engine.test.ts) and [production SQLite recovery](../tests/tupile-intelligence-recovery.test.ts). The recovery suite uses real session authentication, production room code and all migrations in disposable in-memory databases. It covers concurrent categories, lost-response rereads, private serialized views and logs, unchanged unrelated rooms, corrupt-record rejection without writes, legacy uncertainty and actual occupation/departure. Conserved staged positions and later private-hand fixtures are documented in the tests; they do not fabricate successful disclosures or qualification receipts.

Commands for the integrated verification are:

```sh
npm test -- tupile-intelligence homeworld-occupation-history
npm run check
npm run build
npm run test:integration
```

Final verification: **`npm run check` passes types, lint and all 3,755 offline tests** (98.8 seconds for the tests). The change adds 41 cases across new test files and two real-battle cases in [Homeworld battle tests](../tests/homeworld-battle-engine.test.ts), with an existing typed-explosion case also strengthened. **The production build and all 40 HTTP/session integration checks pass.** Existing fixture families now bind their final factions and authenticated seat IDs before genuine setup, preserving roster and history validation. Explicitly staged Basic counter positions record their completed public position before testing normalization purity. The existing Ghola direct-action/inner-continuation comparison verifies the new deterministic observation identity.

The coordinating browser pass used three human sessions in room `ZMA84DY8`, through version 7. Keyboard controls shipped one CHOAM force to Caladan, changing native reserves from ten to nine, then disclosed the target's **17 spice and one weapon only to CHOAM**. A later Atreides shipment reduced its current spice to 16 while the saved observation remained 17. Refreshing all three sessions preserved privacy with no page errors. Desktop 1440-pixel and phone 390-pixel layouts were inspected. After improving the no-eligible-target explanation, the final read-only three-session restoration and phone review passed: Atreides is clearly marked used, Harkonnen lacks contact, and the historical 17-spice/one-weapon answer remains visible to CHOAM. The coordinating inspection artifact is `/tmp/dune-tupile-final-phone.png`; this temporary image is not a committed dependency.

The coordinated 22:42 development-server restart preserved all **3,112** baseline rooms. After the browser work and final HTTP checks, every one of those room versions and state hashes still matches. The database now contains 3,173 rooms: the baseline, this isolated browser room and 60 rooms created by the two integration runs. Read-only restoration also passed for earlier Grumman `HU6YUC7Z` (version 10), Caladan `LV2TNQ88` (version 5), and revival `463GUCY3` (version 7), with all three private seats in each. No saved game was reset or rewritten to install the feature.

Final logs: `/tmp/dune-tupile-verified-check.log`, `/tmp/dune-tupile-verified-build.log`, `/tmp/dune-tupile-verified-http.log`. The browser screenshots and private session files remain outside version control. No goal completion or expansion release is claimed by this checkpoint.
