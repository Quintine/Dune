# Richese Ornithopter: movement integration audit

Audit: 2026-09-06. Document-only source and engine review. The canonical component is `richese-ornithopter`; this is distinct from ordinary Arrakeen/Carthag ornithopter access and the later Ecaz discovery token. No runtime effect or complete expansion compliance is claimed here.

## Authority

The photographed GF9 card face was independently inspected at `/tmp/dune-rules/choam-ornithopter-reading.png`, derived from the publisher components shown in [the product gallery](https://www.tabletopfinder.eu/en/boardgame/32692/dune-choam-richese). Full photo provenance and limits are recorded in [RICHESE_ACQUISITION_RULES.md](RICHESE_ACQUISITION_RULES.md) and [RICHESE_COMPONENTS.md](RICHESE_COMPONENTS.md). It is a Special / Movement card. During the holder's movement, it offers either one group moving up to three territories or two different groups using normal movement. It is discarded after use. No spice payment, faction restriction, alliance transfer of the effect, reserve shipment or Karama cancellation is printed.

Relevant publisher rules:

- [Base rulebook p9](https://www.gf9games.com/dunegame/wp-content/uploads/Dune-Rulebook.pdf): an ordinary group comes from one territory; each normal movement has one destination. Ordinary ornithopter access is checked at the start of a force move and gives a maximum three-territory route when the player has forces in Arrakeen or Carthag. It can move forces elsewhere on the map. The card's first mode independently supplies its stated range; it does not require those strongholds.
- Base pp9–10: sectors do not count as extra territories, but the storm and blocked stronghold rules constrain routes and destinations. Base p22 confirms groups spanning sectors in one territory can move together and confirms that forces just shipped to Arrakeen/Carthag can enable ordinary access immediately. Base p23 retains storm restrictions even when the enabling stronghold is storm-covered. Fresh official indexed search verified that p23 passage and [November 2020 FAQ p9](https://www.gf9games.com/dune/wp-content/uploads/2020/11/Dune-FAQ-Nov-2020.pdf)'s immediate-access clarification.
- [R2 pp5–6](https://www.gf9games.com/dune/wp-content/uploads/2021/11/CHOAM-Rulebook-low-res.pdf): Richese-family cards go to normal Treachery discard when discarded; No-Field tokens move as forces while concealed. R2 p7 defines Kulon as one extra territory during CHOAM's movement turn. The readable publisher-authored copy is `/tmp/dune-rules/choam-lelekan-mirror.pdf` and `.txt`.
- [Ixian rulebook p6](https://www.gf9games.com/dunegame/wp-content/uploads/2020/09/IxianAndTleilaxuRulebook.pdf): cyborgs normally move two territories; the printed Karama table cancels that faction movement advantage. The Mobile Stronghold rules give its own entry/exit geography. Local source: `/tmp/dune-rules/ix-official-mirror.txt`.
- Base advanced Bene Gesserit rules p16 say advisors cannot use ornithopters. That passage predates this separately named card and does not expressly distinguish its two modes. Apply the ordinary fighter/advisor rules without silently declaring a new card-specific FAQ interpretation.

Bounded official-domain searches for the Richese card with Hajr, different groups, Karama, advisors and Kulon found no card-specific answer. Results about the Ecaz discovery token, Dune: A Game of Conquest and Diplomacy, or Dune Betrayal are not authority for this card. In particular, [E3 p13](https://www.gf9games.com/dune/wp-content/uploads/EcazMoritani-Rulebook-LOWRES.pdf)'s disposable discovery Ornithopter gives one later three-movement action and is a different physical item.

## Confirmed effect and boundaries

The holder chooses one of two modes, not both. One mode supplies a maximum of three territories for one group; it does not add three to the existing range, create permanent stronghold access, or change collection/victory rules that depend on actual occupancy. The other authorizes two **different groups**, each using normal movement. The face does not authorize moving the same forces twice under that option. No extra shipment is created, and the move cannot be assigned to an ally.

This is an ordinary card effect. Do not create a generic faction-power Karama response merely because Ornithopter is played. Independent eligible faction powers and entry reactions remain: Ixian extended normal movement may be canceled; CHOAM may use Baliset; BG intrusion or flipping and supported Terror/Ambassador entries still resolve normally. A fixed three-territory card move does not depend on the Ixian cyborg advantage merely because it contains cyborgs. Canceling that unrelated advantage must not cancel the card's range.

The card changes movement allowance, not geography. Keep storm paths, stronghold occupancy, ally exclusion, destination sector, advisor/fighter status, unit custody, optional elite composition and supported HMS geometry. No-Field movement has direct general support as force movement; use a marker as one concealed group member and preserve its event without reading its hidden value. A marker moved by the first group cannot also be moved by the second group. This does not resolve currently guarded mixed battle, Homeworld or combined arrival cases.

Genuine source interactions not settled by retrieved card-specific authority:

1. **Hajr and prior moves:** does the two-group option replace a normal movement action, increase the turn total to two, or compose into three/four moves with Hajr? Can an earlier completed move be counted retroactively as the first group? Existing Hajr implementation alone is not evidence. A bounded initial adapter may require an unused ordinary move and exclude concurrent Hajr with an explicit unfinished-combination reason, but cannot label that an official prohibition.
2. **Kulon:** its additive territory text and this card's explicit maximum three need a deliberate composition decision. Existing code adds Kulon to ordinary stronghold access. That does not itself prove a fixed-card range becomes four, or how a turn-scoped Kulon interacts with both normal-mode groups. No retrieved specific answer settles it.
3. **Advisors:** the printed general prohibition on using ornithopters must not be ignored, but whether the two-normal-group card option is also covered is not expressly resolved. Keep this named boundary rather than silently treating the advisor path flag as permission.
   The following are primarily implementation work, not missing rulings. “Different groups” does not say “different territories”: distinct subsets may share an origin, but no physical unit can be counted in both. A distinct-origin-only shortcut would be an incomplete implementation, not a rule. The same accounting prevents the first group's arrivals from being moved again after merging with another stack. Base rules check stronghold access at the start of a force move, so normal-mode range should be recomputed for each accepted group; freezing both at declaration is not required. The player may end optional movement without a separate acknowledgement; after any actual card use, closing that use discards the card once. An uncommitted illegal route spends no movement. Interruption handling must preserve completed movements and remaining distinct-group custody rather than inventing a rollback. Exact provenance through complicated simultaneous force-removal effects can remain a named implementation limitation without asking for a new rule.

A safe initial supported boundary is both printed modes for ordinary physical fighter groups, an available ordinary move, no concurrent Hajr or Kulon, and current supported terrain/arrival combinations. The three-range mode works without stronghold occupation; the two-group mode uses ordinary per-group range and disjoint physical subsets. Both same-origin subsets and different-origin groups can be modeled from the text. Preserve existing supported arrival reactions and implement their resumptions; do not classify that technical work itself as a source ambiguity. No-Field marker support also has a general force-movement basis, but its cohort/event integration needs focused tests before inclusion. Explicitly guarded advanced advisor/stacking/optional-module contexts do not justify leaving either ordinary mode absent. These are bounds on certification, not reasons to leave the unambiguous modes unimplemented. No additional user question was sent during this audit.

## Current engine hooks and concrete risks

| Existing symbol                 | Relevant behavior                                                                                                       | Required integration                                                                                                                                                            |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `movementRange`                 | Recomputes normal range from Arrakeen/Carthag, Fremen, Ixian selected elites and Kulon.                                 | Separate normal range from a per-order fixed-card range. Do not mutate occupation or set a permanent speed flag.                                                                |
| `forceGroup`                    | Validates one-origin physical groups across sectors and optional concealed marker; returns typed units and source keys. | Reuse for each group. Add provenance so a second group cannot reuse first-group forces after merging.                                                                           |
| `t === 'move'`                  | Checks active phase5, `p.moved < (hajr ? 2 : 1)`, route/entry and advisor state.                                        | Replace duplicated allowance tests with one movement entitlement helper. Validate the card and chosen mode before effects.                                                      |
| `MovementOrder`                 | Stores exact physical group/elite counts, origin/destination and marker event through reactions.                        | Add explicit card-event/mode/group identity and the range basis. Avoid storing an arbitrary `Action`.                                                                           |
| `resumeChoamMovement`           | Revalidates stale orders using the Hajr count and current normal `movementRange`.                                       | It must preserve card entitlement/range and reserved group identity; otherwise a valid three-range card move can fail after Baliset is declined.                                |
| `ixMovement` response           | Cancellation stamps the current move index and leaves a one-territory move available.                                   | Trigger only for actual reliance on the Ixian normal-range advantage. Cancellation does not spend a card-derived movement or accidentally clear its remaining group.            |
| `completeMove`                  | Moves physical/marker custody, sets shipped, increments `p.moved`, then runs intrusion and entry.                       | Count each accepted group once. Advance the card continuation only after the group's arrival reactions finish. Do not recurse immediately into group two.                       |
| `endMovement` / phase start     | Ends the active player's turn; phase initialization resets Hajr/movement state.                                         | Close/expire any used card entitlement deterministically. Never carry an unbound second group into a later turn.                                                                |
| `viewGame`, bots and game-table | Repeated `movesAllowed = hajr ? 2 : 1`; UI/bot paths independently choose sources and ranges.                           | Project authoritative card options, remaining groups and restricted source/marker custody. Updating only engine permission leaves legal controls disabled or causes AI retries. |

The current `g.hajr` flag is inadequate for the two-group mode: ordinary extra moves allow the same group to move again, contain no distinct-group provenance, and share no card-discard continuation. A simple increment of `p.moved` allowance would violate the explicit distinction. It would also leave `resumeChoamMovement` and Kulon availability using inconsistent limits.

The earlier held-in-hand reservation proposal is superseded: move the played card into one public active-effect custody zone on validated declaration, then discard it once when use ends. Keeping it in the hand would incorrectly let Sabotage select it, or make a reservation block that legal hand-discard effect. Check all existing hand commitments before declaration; afterward gift, Distrans, cash-in and random extraction operate on the remaining actual hand. The active-effect card is neither a hand card nor a discard card and must not be duplicated in either. Extend physical-custody validation to include that zone. A paid Nullentropy search keeps its existing central lock. An active Truthtrance question is answered first. This movement card is not an anytime hand-transfer effect, so it should not start in the middle of an unrelated pending decision merely to overwrite it.

## Proposed minimal state/action contract

Keep card choice and each force movement reviewable, but omit acknowledgements for automatic bookkeeping:

```ts
ornithopter?: {
  event: string;
  player: string;
  card: string;
  turn: number;
  mode: 'range3' | 'twoGroups';
  startingMove: number;
  completed: number;
  movedCohorts: /* typed physical counts and marker identity */;
} | null;

// Bind a declared card move to the existing validated move request.
{ type: 'move', card: ornithopterId,
  ornithopter: 'range3' | 'twoGroups',
  forces, eliteForces, territory, sector, noField?, event? }
// Later card-group request references the server-issued Ornithopter event.
{ type: 'move', ornithopterEvent, forces, eliteForces,
  territory, sector, noField?, event? }
```

Prefer a clear actual API field name such as `movementCard` if `card` is overloaded elsewhere. Do not reuse the No-Field `event` field for the card event. The root adapter can choose a separate declaration action if needed, but must avoid a mandatory confirm step merely to begin an already specified valid first move.

For the range3 mode, validate the complete first movement before reserving the card; carry its bound range through response continuations; discard exactly once after the use. Invalid initial selection leaves the card and board unchanged. For twoGroups, commit each legal group once and persist remaining entitlement across every arrival interruption. Do not preempt genuine reactions or change their ownership. A second selection should use current legal state and constrained distinct-group custody; predeclaring both complete destinations changes information/timing and is not required by the face.

For fungible tokens, a source-quota/cohort model must distinguish ordinary and elite units, multi-sector source locations, first-group arrivals and the concealed marker. It may permit residual units in the same original location, while excluding the transported cohort at its new location. Arrival casualties, force returns and other relocation effects can make cohort assignment ambiguous; preserve the existing combined-effect guards unless those transitions also update provenance. Do not use secret No-Field value to compute the cohort quota.

Owner projection should contain the held canonical card, legal mode options with explicit reasons, event/remaining-group information when active, and authorized source quotas. Other players may see that a card was declared/used and its public movement, but not unchosen planned second destinations or hidden marker identity/value. An enlarged card inspector should explain the two alternatives and unresolved combination guard without presenting it as a printed ban.

Required tests before enabling the adapter: three-range route with no stronghold; unchanged storm/stronghold exclusion; normal two-group base/Fremen/Ixian ranges; no same-unit second movement including first-arrival merging; typed units and separate No-Field event; multi-sector groups; cancellation/decline and stale CHOAM continuation; independent Ixian response versus card-derived range; gift/Distrans/cash-in reservation; JSON/CAS duplicate first and second groups; single discard; end-turn closure; private projection and four AI profiles. Full optional-module and expansion starts remain gated until the wider acceptance requirements are met.

## Played-card custody correction and cohort helper checkpoint

The held-in-hand model above was an implementation proposal, never a printed requirement. The [November 2020 FAQ p8](https://www.gf9games.com/dune/wp-content/uploads/2020/11/Dune-FAQ-Nov-2020.pdf) confirms normal disposal after play and separately states the battle-winner retention exception. Base p10 distinguishes played battle cards held against a wheel. Neither requires this movement card to stay in hand throughout its effect. A separate played-card zone is consistent general-rule composition; no Ornithopter-specific FAQ is asserted. Root has adopted it so legitimate Sabotage can still randomly discard an entrant's remaining hand. Future Semuta reacts to the eventual discard event, not initial placement in the active-effect zone.

The pure `game/ornithopter.ts` helper and eight focused tests now track original unmoved ordinary/elite quotas and an exact optional marker identity/event/location. Same-origin residual subsets are permitted; first-group arrivals never increase quota. The engine remains responsible for phase/range/route rules, actual current marker custody and provenance changes after any intervening losses or relocations. A restored two-group effect with one completed move must require its recorded cohort, never reconstruct it from merged current forces. These pure tests do not certify the whole movement adapter.


## Integrated checkpoint — 2026-09-06

The authoritative engine now supports both movement modes, uses a public played-card zone, and persists typed original-group quotas for the second move. The mode/event travels through CHOAM and Ixian reactions. Concealed markers retain separate physical identities and events; revealing an unmoved marker converts its entitlement to its actual placed forces, while revealing a moved marker cannot grant reuse. Both ordinary subsets from one source and original forces at a first-group destination remain selectable. Independent review found and verified the repair of a missing-quota restore defect: second-group movement and normalization now reject corrupted missing provenance rather than reconstructing it from merged counts.

Eight pure-model, eight root engine, six independent review and six AI cases are registered and pass; four production-persistence cases cover both move commits and recovery. The complete registered checkpoint passes **1,305 rules/client/component tests and 104 persisted/API tests**. Final type checking, lint and production build pass. This is development-fixture support; unresolved named source combinations and expansion start gates remain in place.

Browser QA used only synthetic room QPNV5XJJ. A first two-force move from Red Chasm7 to Pasty Mesa5 advanced version23→24, put the played card outside the hand, and retained exactly three original forces for the second group. Selecting the first group's new stack disabled the second-move control. A fresh invitation restored exact version24, its event and its remaining original quota. Moving the remaining three advanced version24→25, left five forces at Pasty Mesa5, retained eight spice and fifteen reserves, and discarded Ornithopter exactly once. All other1,114 saved rooms retained their prior version/state hashes. Snapshots: `/tmp/dune-ornithopter-browser-pending-v24.json` and `/tmp/dune-ornithopter-browser-complete-v25.json`.

The browser check caught an initial parent/component wiring error: an unavailability message was passed even for valid drafts, disabling the card button. That prop is no longer passed unconditionally; the corrected real browser flow completed both moves. Remaining-group rejection copy now explains that the first group cannot move again. Full mobile and complete Richese-game acceptance remain unfinished.
