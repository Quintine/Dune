# Smuggler battle collection

20 September 2026. **Prototyped, with Partial rules coverage.** New battles in
the base-faction Leader Skills preview connect the lower Smuggler effect in Basic
and Advanced games. Public module, mode and publication gates remain closed.

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
is the smaller of their aggregate total and the unmodified disc strength. This
pending amount is not personal spice and cannot fund a sealed plan or another
payment. After survival is known, the server transfers it once, including for a
surviving loser, before Sandmaster adds any after-victory spice. A pile drained
to zero cannot receive Sandmaster's addition. This deferred settlement and
ordering remain explicit timing inferences, not a newly discovered publisher ruling.

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
- AI candidates omit optional Kwisatz when selecting Smuggler and reject other
  unsupported modified plans. Native face-up skilled discs remain unavailable
  to battle selection; captives and existing mandatory concealment retain their
  legal paths. UI availability and the submitted Kwisatz value share one check.
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

The printed collection amount applies to the territory's aggregate existing
spice, capped by the unmodified leader strength. The available source does not
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
- `smugglerBattleAllocationRequired(receipt, survives): boolean` reports a
  missing choice only for a surviving pending receipt with at least two positive
  piles and `0 < amount < before`. All/none collection and death need no choice.
- `chooseSmugglerBattleAllocation(receipt, allocations): SmugglerBattleReceipt`
  verifies the pending signature, accepts only reveal-time positive keys and
  nonnegative safe integers within their recorded capacities, requires a total
  exactly equal to `amount`, omits zero entries, and returns a new signed receipt
  without mutating its input.
- `settleSmugglerBattle(receipt, survives, spice)` verifies the signed receipt
  and unchanged reveal-time positive piles, requires the surviving ambiguous
  choice, debits those concrete sectors, and returns `{ receipt, amount, spice }`.
  Death returns a signed `void` receipt with zero transfer; forced all/none
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

Kwisatz, separate trainer bonuses and Stunner still await the existing modifier
question; no user answer is assumed. Expansion rosters/cards, the independent
Ecaz card variant and other optional modules remain guarded before the Smuggler
plan seals. These development restrictions are not rules that forbid those
combinations in the physical game. Stone Burner and other expansion combinations
therefore have no connected acceptance claim here.

Focused engine tests cover winners/losers in both modes, empty/short piles,
zero surviving forces, death and Traitor outcomes, explosion, capture custody,
Sandmaster order, corruption, immutable rejection, legacy continuation and all
four bot profiles. SQLite tests cover authenticated restart, private projection,
concurrent final votes and replay rejection. Browser and full-game sample scope,
required check/build/HTTP results, preservation and verified Git delivery are
recorded in the private source-bound checkpoint and commit message. This does
not certify every Leader Skill or combined-module interaction.
