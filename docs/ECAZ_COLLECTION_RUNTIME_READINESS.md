# Ecaz shared collection runtime readiness

Read-only architecture audit, 7 September 2026. No production code, tests, saves or mode settings were changed. This proposes the next bounded feature after territorial co-occupation and joint victory; it does not certify combined Occupy combat or shared collection as implemented.

## Existing quote and commit boundary

`game/board-resolution-quote.ts:142`, `quoteSpiceCollection`, computes collection against a detached spice map in storm order. It settles lone advisors, derives each faction's rate from its own fighting presence in Arrakeen/Carthag, adds Advanced bank income for its own occupied Arrakeen/Carthag/Tuek, then drains each occupied sector independently. Storm sectors and advisors cannot collect. Ix cyborgs collect three each; other forces use their faction's rate. `presenceByLocation` already counts a concealed No-Field as one public force, regardless of denomination.

Receipts currently contain `{player, strongholds, collected, balance}`. `engine.ts:8978`, `collect`, commits the detached map, advisor releases and absolute balances, then logs bank income and desert collection separately. It is called by phase-seven initialization at `beginPhase`, not by each player's Ready action.

The missing behavior is concrete: with Ecaz and its ally each having two ordinary forces in the same clear spice sector, rate two and a five-spice pile, current storm-order draining gives the first player four and the second one. The source default would divide the jointly collected five as two to Ecaz and three to its ally. This is a direct consequence of the inspected loop and consistent with the earlier controlled collection probe in [the pre-integration Occupy runtime audit](ECAZ_OCCUPY_RUNTIME_READINESS.md); no new probe was run for this document.

Advanced bank income already happens to pay both fighting occupiers in a jointly occupied income stronghold. It has no distinct Ecaz Collection cancellation window. A shared-desert implementation must not accidentally double that existing bank payment or make the bank advantage available in Basic play.

## Source boundary for a pure plan

The source reviewer confirmed E3 p.8 permits any agreed split and otherwise an equal split with the odd spice going to Ecaz's ally. E3 p.15 confirms the shared Arrakeen collection rate. E3 p.16 cancels **Ecaz's bank income from jointly occupied Arrakeen, Carthag and Tuek only**; the ally still receives its normal income. This is separate from desert allocation and from pre-battle Occupy cancellation. See [the existing source audit](ECAZ_OCCUPY_RULES.md) and [the collection-specific source review](ECAZ_COLLECTION_RULES.md).

The reviewer additionally checked November FAQ p.2: collection requires the same territory **and sector** as the spice. Its recommended composition is to calculate capped capacity at each sector, then aggregate the pair's shared collected amount for the territory. Both members must have positive eligible collection capacity against spice there; a partner present only in a spice-free or storm sector is not automatically entitled to share. This eligibility/aggregation is a labelled composition of the texts, not a retrieved worked publisher example. Do not move unused capacity between sectors. Determine shared eligibility before one member's sequential turn drains the pile, or the first-player bias would survive under a different name.

A minimal pure `quoteCollectionPlan` should return:

- Advisor releases and the public collection basis: storm, board/stance, reciprocal pair, marker locations, relevant typed capacities and pile quantities.
- Per-sector depletion receipts and per-territory shared pools, each with Ecaz ID, ally ID, total, and default Ecaz/ally amounts.
- Independent ordinary desert income and bank-income deltas, identifying the cancelable Ecaz co-occupation portion separately from Ecaz's sole-occupied stronghold income.
- The exact set of meaningful choices/responses still required, without selecting them or applying resources.

An allocation then changes only who receives a fixed shared pool. Validate nonnegative safe integers summing exactly to that pool; do not limit a recipient's agreed award to its own collection capacity after the pool has been calculated. That would contradict the permission to agree a split. Use the ordinary quote's single drain of each physical pile, not separate Ecaz and ally deductions.

## Prequoted successors that must stop at this new opportunity

| Current call                                                 | Integration requirement                                                                                                                                                                                                                                 |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `quoteBattlePhaseAdvance` in `board-resolution-quote.ts:205` | Refunds phase-six aid and currently prequotes collection unless the Ix phase opening intervenes. Return a typed collection-opportunity frontier when choices remain; do not preaccept the default split as a final receipt.                             |
| `quoteBattleBoardContinuation`, same file near line 234      | Stops at a remaining battle or CHOAM Market. Retain those earlier boundaries before considering the new collection opportunity.                                                                                                                         |
| `engine.ts:8788`, `advancePhase`                             | Validates the battle-phase successor before resource settlement, then commits phase resources and advances. Its future-collection validation must accept a valid pending choice, without drawing, mutating or opening a live response during the quote. |
| `engine.ts:10867`, current aftermath quote                   | Used by cancellation preflight when the next step is the board. It must validate only the actual compulsory prefix through the next response/decision, not a hypothetical negotiated split.                                                             |
| `engine.ts:11449`, denied Moritani Duke placement successor  | A no-battle path can immediately cross into collection. Compose the same pending frontier rather than duplicating a default collector in this cancellation path.                                                                                        |
| `engine.ts:8848`, `openPhase`                                | Ix tables have a public phase opening before automatic collection. Preserve it; collection planning happens after the actual opening resolves.                                                                                                          |

`quotePhaseResources` / `commitPhaseResources` already settle ordered Tech Token payments and phase-three/five/six aid refunds. Those are an earlier committed prefix, not part of a shared desert allocation. Collection continuation must never call that prefix again. Preserve the existing Ix opening's `initialize` distinction so restoring a collection decision cannot re-enter `beginPhase` and collect twice.

## Proposed response and decision lifecycle

Create a single phase-seven collection event at actual initialization, with a discriminated pending stage and explicit completion identity. Keep the board spice map and all collection credits uncommitted while its meaningful allocation choices remain.

1. Compute the pure plan after earlier Market/phase-opening work. If Advanced Ecaz has positive cancelable co-occupation bank income, offer a source-bound `ecazCollection` response owned by Ecaz. It uses the existing printed/BG Worthless cancellation machinery. No Ecaz “claim income” confirmation is needed. If no cancellation is possible, the existing automatic response settler continues it.
2. Record allowed/canceled bank treatment without paying it. The canceled branch removes only the quoted Ecaz co-occupation bank delta; it cannot remove shared desert income or the ally's bank income. Continue to allocation or final commit.
3. For each positive shared territory pool, permit a meaningful allocation choice. A bounded client protocol is: Ecaz proposes an integer split or chooses the published default; its ally accepts a non-default proposal or chooses the default. An explicit rejection resolves to the published default. The assigned proposer is an interface convention, **not a publisher-mandated priority**. Counteroffers are optional future UI, not necessary to implement an agreed allocation. Do not invent a real-time deadline, automatic acceptance or a new right to decline collection.
4. Auto-skip empty pools. If there is no non-default proposal to accept, do not create an ally confirmation merely to repeat the default. Once all actual choices resolve, validate and commit one final set of map-depletion and player-credit receipts, clear the pending event and leave the normal phase-seven Ready controls available.

A positive pool has multiple legal allocations even if it contains one spice; its proposal/default choice is meaningful. No shared pool means ordinary collection remains automatic. This lifecycle avoids both prematurely paying a default before negotiation and adding a generic “Confirm automatic collection” button.

Suggested persisted identity is `{event, turn, phase:7, ecaz, ally, stage, planBasis, resolvedAllocations, proposal?}`. Responses/decisions carry that same event; each decision has an explicit player and current territory/pool identity. Bind source ownership, reciprocal alliance, current collection basis and stage in pure integrity checks at action, normalization and paid cancellation recovery. Do not treat a matching serialized signature as sufficient validation of malformed quantities or wrong beneficiaries.

## Resource and interruption safety

Current receipts use absolute balances because calculation and commit are synchronous. Do not persist those balances across a new negotiation window and later overwrite intervening legitimate income/spending. Prefer frozen collection **deltas**, revalidate current safe balances at final commit, and quote the compulsory suffix before accepting a Karama cost. Pre-cost validation should not demand an unaccepted future split. Validate all admitted allocations against arithmetic bounds, or leave the future decision explicitly unaccepted at that frontier.

Review the existing early dispatcher exceptions before adopting a blanket action lock: Truthtrance, Nullentropy Box, gifts and CHOAM card uses can suspend some existing decisions before the generic decision gate at `engine.ts:14165`. A collection parent needs the same legitimate saved-control binding and exact restoration; it must not disappear when a nested discard frame drains. A voluntary change to the **public collection basis** needs a deliberate policy: re-quote before any agreement is accepted, or reject the specific basis-invalidating action while the commitment exists. Do not bind unrelated private spice balances or hands and reject otherwise legal card actions merely because they changed.

The current normalizer runs integrity checks before cloning and continuation settlement (`engine.ts:13824`). Add the new receipt check there and in action validation. Automatic pending-response recovery must use the existing room CAS worker (`db/rooms.ts:401`) and drain only a genuinely automatic stage. A proposal awaiting an ally is a human/AI decision, not an automatic worker job. Stale event, duplicate acceptance, reconnect and simultaneous final allowance must each leave at most one depletion and one payment.

## Adjacent effects and public controls

| Interaction               | Preserve                                                                                                                                                                                                                                                                             |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Harvester                 | `engine.ts:16873` changes the fresh Spice Blow pile at its earlier window. The collection plan sees that final pile; Harvester is not a collection-rate multiplier and cannot be introduced as a phase-seven rescue.                                                                 |
| Terror                    | Existing entry effects change forces, spice or cards before collection. Extortion's five-spice Mentat award and recovery payment are separate timing; do not include them in a desert pool. Gated Aftermath/Homeworld/Discovery effects are not enabled by this work.                |
| BG                        | Reuse `settledBoard`; accompanied advisors do not contribute capacity or shared eligibility. A lone advisor released to a fighter must match actual collection.                                                                                                                      |
| No-Field                  | Use the public one-force marker presence, including hidden zero, without revealing or reading denomination. Collection does not materialize reserves or consume the marker.                                                                                                          |
| Ix                        | Preserve each cyborg's three-spice capacity and normal suboid rate per sector. HMS route harvesting at `engine.ts:12744` is a separate Storm movement effect; do not route it through the phase-seven shared-allocation lifecycle.                                                   |
| Ordinary rival collectors | Preserve existing sector/storm-order rules outside the pair. A coalition implementation must not let its later member jump ahead of an unrelated collector without a source-supported ordering contract. This mixed eligible-collector case deserves a focused source/fixture check. |

Project only public pool size, territory, default, current decision owner and source status to the table. Give the two allies their proposal controls; keep an unaccepted proposal private to them if adopting private negotiation. This privacy choice is interface design, not proof that final collected amounts are secret. Existing collection logs already disclose actual gains. Do not expose rival balances or hand structure to justify a response or suggest a split.

Existing event-keyed Ambassador controls illustrate owned decisions and accessible integer inputs; Richese sealed-auction projections illustrate separating public progress from private choices. Existing bribes and `pledgeAid` are not reusable payment mechanics: bribes prohibit allies and settle at Mentat, while aid belongs to separate escrow phases. A shared allocation assigns the same collected spice directly; it is neither a bribe nor a second transfer.

Bots need only the owned pool descriptor and own balance. All profiles can choose the published default and accept a beneficial/equal proposal, with any later own-spice preference remaining local. No negotiation loop or private ally balance inference is necessary. Preserve mandatory response/decision ordering and skip no-choice stages automatically.

## Bounded next implementation and proof

First agree the source-labelled sector/territory and mixed-rival ordering composition with the coordinator. Then extract a pure collection plan and final receipt commit, add the source-bound bank response and bounded allocation decision, and update only their actual continuation consumers. Keep complete expansion mode gates unchanged.

Tests should cover odd/even scarce piles, both storm orders, independent sectors without capacity transfer, an ineligible partner, rate-two/rate-three and Ix mixed types, advisor release, No-Field values 0/3/5, Basic versus Advanced bank income, canceling only Ecaz's shared bank part, sole-held bank income, accepted/default allocations, nested printed/BG response restoration, zero-pool automatic completion, Ix/CHOAM earlier boundaries, and genuine SQL CAS/reconnect with no duplicate depletion or payment. This report is an implementation contract; no new collection behavior or test pass count is claimed.
