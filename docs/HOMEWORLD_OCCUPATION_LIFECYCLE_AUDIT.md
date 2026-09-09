# Homeworld occupation lifecycle integration audit

Read-only code audit, 9 September 2026. This document maps implementation boundaries; it does not settle the occupation interpretations still identified in [the invasion source audit](HOMEWORLD_INVASION_RULES.md#verification-handoff). Root source work must define retention after departure, contested qualification, native high/low coexistence and unique rewards before those consumers are implemented. No runtime, database or deployment changes were made by this audit.

## Observe semantic force changes, not just actions

The engine can perform several ordered physical changes inside one accepted action or one automatic recovery. An observation only at the end of `applyAction` or `finishActionContinuations` misses a foreign winner becoming alone after native loser removal, then losing its final force to its own dial before the wrapper returns. Losing-card disposal can also occur during that interval, so occupation-dependent card effects must see the correctly observed state before the discard is processed.

Conversely, observing every counter assignment or every `killTerritory` call can invent intermediate occupation. `resolveBattle` implements double-traitor destruction with two sequential army removals, and explosions iterate `quote.destroyedArmies`. Those loops are implementation details of one destruction result. Subject to the source ruling about simultaneous losses, observe the completed destruction group, rather than granting the second army an entitlement merely because its array entry was processed last.

Use a focused, pure occupation reducer over public typed force groups, with an explicit observation cause and event identity. The engine should call it at **completed semantic mutation boundaries**. Preserve already recorded qualification separately from the current occupants; the eventual rules may give these different consumers. Source-dependent rewards should run only after this observation and through their own durable continuation if a player choice is required. A final wrapper check is useful as an invariant, but does not replace the intermediate observations.

## Mutation sites

All engine names below refer to [game/engine.ts](../game/engine.ts). Homeworld groups come from [homeworld-custody.ts](../game/homeworld-custody.ts), where primary native counts derive from player reserve totals, foreign visitors are explicit, and Salusa is a separate allocation within the Emperor's totals. Consequently, changing native reserves can change occupation without changing `custody.visitors`.

| Boundary | Existing code path | Observation placement and constraint |
| --- | --- | --- |
| Ordinary reserve departure | `withdrawNativeReserves`, called by ordinary shipment and Spiritual Advisor arrivals | Observe after the matching board placement and complete typed reserve update, before arrival/income consequences that consume occupation. Do not invoke full force-conservation validation halfway between withdrawal and placement. |
| Revival or Ghola return | `addRevivedReserves`, called by normal revival, Ghola and revival effects | Observe after reserve deposit and the caller's Tanks/elite updates. Native revival can end present sole foreign occupancy and change population while a remembered entitlement remains a separate question. |
| Homeworld shipment | `commitHomeworldShipment` | Observe after `quote.state`, every quoted player reserve total, and any Arrakis source map are installed; before shipment income or subsequent powers. A declaration or a Guild stop does not move forces and must not qualify anyone. |
| Junction transport | `performJunctionTransport` | Observe once after all source withdrawals, destination deposits and any Arrakis placement. Include every affected origin and destination, including both Emperor native origins. The pure quote's internal withdrawal/deposit order is not a sequence of independent events. |
| Emperor inter-world movement | `emperorHomeworldMove` action branch | The quote replaces the Salusa allocation while aggregate reserves stay unchanged. Observe both native worlds after the complete quote is installed. A reserve-total-only watcher misses this path. |
| Homeworld combat loss | `commitHomeworldLoss` → `commitHomeworldResources`, reached by `killTerritory` and `takeBattleLosses` | The resource helper applies custody and all reserve/Tanks counts atomically. The caller must distinguish an independently ordered loser or winner loss from one member of a simultaneous destruction group. |
| Native explosion allocation | `settleHomeworldExplosion` | Observe after the exact selected native casualty group is committed, before `finishBattle`. Earlier invading-army destruction and later native allocation have distinct saved stages; preserve the source-defined ordering. |
| Homeworld Ix substitution | `finishResponse` branch `ixSubstitution` → `commitHomeworldResources` | Observe after the whole substitution quote, before `finishWinner` processes mandatory winner discards. Exchanging Suboids and Cyborgs is one operation; do not manufacture a temporary empty army between its component writes. A canceled substitution has no physical transition. |
| Homeworld Face Dancer replacement | `decision.kind === 'faceDance'` replacement code using `quoteHomeworldCustody` | Observe after winner return, selected external-source removal and replacement deposit are all committed. Include the returned winner's native world as well as the battle world. Do not observe the pure quote's component changes separately. |
| Setup | `initializeStartingForces`, later faction placements and `finishSetup` | Initialize the new-game tracking baseline after physical custody exists, with setup provenance. Setup allocation is not a retrospective invasion history. |

Several active paths still change reserves directly. A hook only inside the two native-reserve helpers will miss them: `revealPlayerNoField`, `commitAmbassadorShipment`, Moritani Sneak Attack, Trip to Gamont, board Face Dancer replacement, and the legacy `guildShip` branch. Some combinations have their own gates or are redirected to existing Homeworld transport, but each admitted path needs either an explicit observation after its completed transfer or a proved no-Homeworld precondition. Audit source guards before claiming complete coverage. Initial Moritani, Bene Gesserit and Fremen placement also use direct reserve writes and belong to the setup baseline, not occupation rewards.

## Battle order that must survive recovery

The current normal Homeworld battle flow is:

1. `resolveBattle` removes the loser army. Record any source-authorized new sole-foreign qualification here before processing the losing cards.
2. Losing cards enter the `battle:mandatory` discard batch; `battleResolved` retains winner casualty commitments. Winner mandatory cards remain physically held in `pendingWinnerDiscards`, independently backed by `lastBattleContext.winnerDiscards`.
3. `continueResolvedBattle` commits the winner's automatic casualties or offers the owned allocation. Observe the completed group even if it removes the final winning force.
4. Ix substitution, when applicable, runs before `finishWinner`. Its allowed physical change receives its own observation; cancellation does not replay casualties.
5. `finishWinner` commits the separate `battle:winnerMandatory` card batch. Optional winner card disposal and later cleanup follow.

`finishActionContinuations` can drain multiple discard batches in a loop, and `settleAutomaticContinuations` can allow responses without a new human action. Every one of these paths must use the same physical observation hooks. Recording only the final board cannot reconstruct stage 1 after stage 3 removed the last foreign force. An occupation receipt associated with the battle must remain independent of nullable pending queues, following the existing mandatory-winner obligation safeguard.

## Turn and income boundaries

`completePhase` is the explicit turn rollover: after phase 8 work, it increments phase, expires Duke state, increments `g.turn`, assigns phase 0 and calls `openPhase`. Place the end-turn occupation observation before changing the turn number; then apply the defined expiry and start-turn observation with the new turn, before `openPhase` exposes any new phase powers. Use separate identities for the old turn's end and the new turn's start, even if the physical board is unchanged.

Do not put turn-boundary logic in `beginStormTurn` alone: Ix phase opening and mobile-stronghold opportunities can intervene before that function. `beginPhase` invokes `collect` in phase 7; occupation income needs a once-per-applicable-turn/recipient receipt at its authoritative payment point. Do not infer that ordinary occupation observation itself pays Collection income. The source audit must define which start/end qualifiers and retained receipts are eligible for each payment or unique advantage.

## Durable state and legacy saves

[homeworldGameIntegrity](../game/homeworld-game.ts) currently accepts exactly `{ custody }` for the Homeworld module. Adding a sibling ledger inside that object requires updating the explicit shape contract and its malformed-save tests; silently adding a field currently rejects existing code paths. A separately versioned top-level ledger is another implementation option. In either design, distinguish an absent legacy field from an explicitly malformed, deleted or inconsistent initialized record.

[db/rooms.ts](../db/rooms.ts) parses saved JSON in `readRoom` and `readSeatView`; it does not migrate or persist reads. Accepted actions and `continueRoomAutomatic` persist complete JSON with SQL version comparison. A ledger stored in the JSON does not inherently require a D1 table migration, but its initialization and every qualification/reward must use this existing compare-and-swap boundary. Reconnects, duplicate workers and repeated normalization must not create extra awards or change source state during a private view.

For new games, initialize a versioned ledger from the genuine setup baseline and observe all subsequent semantic transitions. For old games, present force locations do **not** prove earlier sole occupation, a completed boundary check, Collection payment, discarded cards or prior unique-reward ownership. Do not reconstruct these from aggregate reserves, the public chronicle or a default empty receipt list interpreted as complete history.

A compatible adoption design should explicitly mark the first supported observation and incomplete earlier coverage, persist that adoption once, and record only facts actually established from then onward. Present sole occupancy can be observed at adoption if the approved rule grants an immediate current qualification; that still does not prove a past payment or departed occupier. An older save already inside a battle/discard continuation especially cannot recover a sole-presence interval that ended before the saved snapshot. Leave that limitation explicit instead of inventing entitlement. Whether adoption can grant current benefits or must wait for a specified boundary is a rules/product decision, not a database default.

If adoption is an automatic continuation, extend the scheduler hint deliberately: `needsAutomaticRoomRecovery` currently wakes known pending interactions, not an otherwise idle game merely missing a new ledger. Preserve original phase, pending event IDs, credentials, force/card custody and all other saved rooms. Do not reset or bulk rewrite the live database to install this feature.

## Required regressions

- Loser elimination creates an observed sole foreign interval; winner dial then empties it within one public action and within one resumed SQL continuation.
- Losing poison disposal and later mandatory winner disposal consume the occupation state appropriate to their actual stage; Ix allowance/cancellation and casualty choices restore without repeating qualification.
- Simultaneous double-traitor/explosion groups do not gain array-order-dependent qualifiers; native explosion survivors and multi-invader cases follow the approved source rule.
- Multi-origin transport, Salusa movement, native revival and Face Dancing observe complete transfers without temporary invalid custody or artificial empty intervals.
- End/start boundaries and Collection receipts remain exactly once under two SQL workers, with private views unchanged and malformed/deleted initialized obligations rejected.
- A legacy mid-turn and a legacy mid-battle save preserve all physical state and explicitly incomplete history; adoption never fabricates earlier rewards or departed occupiers.

This is an integration map, not evidence that occupation or any occupied-card benefit is implemented. The retained-low, contested entitlement and unique-reward source questions remain prerequisites for their respective consumers.
