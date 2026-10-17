# Smuggler battle collection

Updated 17 October 2026. **Prototyped, with Partial rules coverage.** Supported
Basic/Advanced Leader Skills tables include the provisional modifier policy below.
Public module, mode and publication gates remain closed.

## Native Discovery legal participation — 6 October 2026

Three genuine native Skills/Discovery/Tech captures had legal hidden-trainer
plans but no bot candidate: the policy recomputed full-state module admission
against a player view that intentionally lacks private/internal configuration.
The engine now projects `smugglerCollectionSupported` beside the existing
saved battle format flag; bots use that authoritative rule result rather than
reconstructing the module profile. Modified-strength and multiple-positive-pile
guards applied to each actual plan at that checkpoint; the 9 October allocation
policy below replaces only the latter. No public mode or strategy tuning is added.
All three original captures finish without rejection. Source trees/counts and
limits are in the [native Discovery evidence](DISCOVERY_PROTOTYPE.md#native-skill-runtime-evidence).

## Rule and timing contract

The [source follow-up](LEADER_SKILLS_RULES.md#20-september-smuggler-follow-up)
combines the printed reveal-time collection with the common requirement that the
selected skilled leader survive. The card does not require winning or retaining
forces. A captured skilled leader grants its lower effect to its controller.

At public plan reveal the server records the battle, controller, selected leader,
plans, skill posture and territory's existing positive spice piles. The amount
is the smaller of their aggregate total and the reveal-time leader-strength cap.
This pending amount is not personal spice and cannot fund a sealed plan or another
payment. After survival is known, the server transfers it once, including for a
surviving loser, before Sandmaster adds any after-victory spice. A pile drained
to zero cannot receive Sandmaster's addition. This deferred settlement and
ordering remain explicit timing inferences, not a newly discovered publisher ruling.

### Provisional modifier policy — 17 October 2026

Under the standing choose-recommended instruction, include the copied/printed
disc value, existing declared Leader Skill bonuses and declared Kwisatz +2 in
the cap. This is an explicit first-version interpretation, not a publisher FAQ
or an answer to the older numerical question. The authorized Advanced source's
physical p21 supplies general skill survival/card-role rules, not this cap ruling.
Printed disc value and bounty do not change. Later actions cannot enlarge the
recorded piles or spend the pending collection.

An actual resolved zero-strength weapon effect voids collection even when the
leader survives; it opens no sector-allocation choice and transfers no spice.
The existing resolver assigns that effect to **Artillery Strike**, not the base
projectile **Stunner**. A sole own Traitor bypasses weapon effects and therefore
does not zero collection; opposing/mutual Traitors retain their survival rules.
The receipt retains its original reveal-time cap and records `void` when zeroed.


A weapon death, opposing or mutual Traitor, or Lasgun–Shield explosion voids the
collection. A successful sole own Traitor call can leave the Smuggler alive and
eligible. A void receipt changes no pile; it cannot restore spice destroyed by an
explosion. Capture return/death cleanup follows settlement without paying the
original owner. This board transfer is neither bank income nor another player's
payment, so it does not invoke Banker or Bureaucrat payment handling.

## Connected behavior

- A shared admission quote serves the server, player controls and four AI
  profiles. Public mode flags and the player's own chosen plan determine the
  guard; an opponent's concealed cards do not control eligibility.
- Guidance explains the pending amount, survival and spending restriction.
  Single-pile collection remains automatic with no acknowledgement. Partial
  multi-pile collection asks only the surviving controller to choose concrete
  sectors; collecting all or none remains automatic. The choice has no decline.
- AI candidates and player controls admit legal declared Kwisatz and trainer
  bonuses through the shared plan guard. The table and bots use the server's
  projected module admission rather than reconstructing private configuration.
  Native face-up skilled discs still cannot be selected without concealment;
  captives and mandatory preparation retain their original paths.
- Existing single-pile signed receipts have JSON/SQLite continuation evidence.
  Multi-pile choices retain the same battle binding and have changed-path JSON
  and real-engine control smoke; comprehensive persistence assurance remains
  deferred until all rules are implemented.
  Reads/actions reject changed plans, receipts, pile or identity. Public views
  expose the selected leader, controller and pending amount only after reveal;
  the internal binding frame is never projected. Concurrent final votes use the
  existing versioned room write to prevent duplicate collection.
- Battles already saved without the new version keep their original behavior.
  Subsequent battles use the new flow. There is no database migration or reset.

## Multi-pile allocation policy and pure API — 9 October 2026

The collection amount applies to aggregate existing spice, capped by the
recorded strength policy above. The available source does not
specify which sectors supply a partial multi-pile collection. **Owner-selectable
sectors are a provisional prototype allocation policy, not a publisher ruling.**
The owner controls only distribution, never the mandatory amount. Controls appear
after revealed outcome establishes survival and before physical settlement,
preceding any Sandmaster placement choice. Inputs start with a legal deterministic
fill and require the exact total within each revealed pile's capacity.

`game/smuggler-battle.ts` preserves legacy receipt fields and signatures:

- `SmugglerBattleReceipt` retains `key`, `before`, `amount`, `stage`, and its
  original battle binding. Multi-pile receipts add
  `piles?: Record<string, number>`, use `key: null`, and set `before` to the
  aggregate total. Signed owner choices add
  `allocations?: Record<string, number>`. Single-pile and empty receipts retain
  their original shape.
- `smugglerBattleAllocationRequired(receipt, eligible): boolean` reports a
  missing choice only for an eligible pending receipt with at least two positive
  piles and `0 < amount < before`. All/none, death and actual zeroing need no choice.
- `chooseSmugglerBattleAllocation(receipt, allocations): SmugglerBattleReceipt`
  verifies the pending signature, accepts only reveal-time positive keys and
  nonnegative safe integers within their recorded capacities, requires a total
  exactly equal to `amount`, omits zero entries, and returns a new signed receipt
  without mutating its input.
- `settleSmugglerBattle(receipt, eligible, spice)` verifies the signed receipt
  and unchanged reveal-time positive piles, requires any eligible ambiguous
  choice, debits those concrete sectors, and returns `{ receipt, amount, spice }`.
  Death or actual zeroing returns a signed `void` with zero transfer; forced all/none
  collection is automatic. A settled receipt cannot be settled twice.
- `SmugglerBattleCollectionOffer` is the owner-only public shape
  `{ event: string, player: string, territory: string, amount: number,
  piles: Record<string, number> }`.
  `SmugglerBattleCollection({ offer, busy, act })` inspects only those public
  piles and submits `{ type: 'decision', event, allocations }`; noninteger,
  over-limit and incorrect-total selections cannot be submitted.

Focused pure regressions cover differing valid sector debits, immutable
allocation rejection, omitted zeroes, same-total reveal-pile redistribution,
choice-signature corruption, death/all/none automation and legacy single-pile
settlement. These regressions specify prototype allocation boundaries, not new
printed rulings.

## Boundaries and evidence

The old modifier question received no numerical answer; the visibly provisional
17 October policy above supplies usable behavior under the standing instruction.
It does not settle every exceptional skill interaction. The independent Ecaz
card variant and unrelated optional-module envelopes retain their admission
guards. These restrictions are not printed prohibitions. Existing revealed
weapon/Stone/Mirror profiles and original settlement order remain separate.

Focused engine tests cover winners/losers in both modes, empty/short piles,
zero surviving forces, death and Traitor outcomes, explosion, capture custody,
Sandmaster order, corruption, immutable rejection, legacy continuation and all
four bot profiles. SQLite tests cover authenticated restart, private projection,
concurrent final votes and replay rejection. Browser and full-game sample scope,
required check/build/HTTP results, preservation and verified Git delivery are
recorded in the private source-bound checkpoint and commit message. This does
not certify every Leader Skill or combined-module interaction.

## Modified-strength runtime proof — 17 October 2026

Actual old raw KH/trainer plans reject unchanged before the cutover. The new
focused23 cases and related9-file union86/86 pass, as do types/lint and build
with existing warnings. New source-bound cases:
`tests/smuggler-kwisatz-journey.test.ts`,
`tests/fixture-smuggler-kwisatz-journey.ts`,
`tests/smuggler-artillery-journey.test.ts` and
`tests/fixture-smuggler-artillery-journey.ts`.

Seven actual supported casualties unlock KH; real next-turn6/8-spice blows
yield cap7 collections6/7, with no reveal-time credit. Actual paid shipments
and movement precede shielded Artillery0, sole own-Traitor bypass6 and ordinary
shielded Stunner6. Original winner cleanup exposes payout before separate
Collection. Unopened deck/card/identity staging is explicit; no live force,
wallet, phase, order, loss count, KH or receipt is assigned.

Four390px control journeys/32 actions and eight four-policy programmes/64
actions reach original Collection. The table and bots use the original server
admission projection. Other exceptional skill/mode compositions, full strategy,
comprehensive assurance and deployed acceptance remain open. No real room,
database, human server or deployment was changed.

