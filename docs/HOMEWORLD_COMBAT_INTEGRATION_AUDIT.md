# Homeworld combat integration audit

Read-only architecture audit, 9 September 2026. The contract is [Homeworld rules](HOMEWORLD_RULES.md), with transport/occupation boundaries in [invasion rules](HOMEWORLD_INVASION_RULES.md). This document identifies adapters required for actual combat; it does not enable Homeworlds or certify complete games. Line numbers below identify the inspected worktree and may shift during concurrent implementation; function names are the durable anchors.

## Current boundary

Native and visitor inventory already has an independent representation: `homeworldForceGroups` and `quoteHomeworldCustody` in [homeworld-custody.ts](../game/homeworld-custody.ts) return exact `{normal, elite}` groups and detached transactions. Native primary counts derive from player reserve totals; Salusa is an allocation inside Emperor's total. Visitor groups are separate and never belong in `Player.forces`. `homeworldPopulations` supplies the printed card, native owner, current side and bonus, but deliberately does not resolve occupation entitlements.

The concurrently added [homeworld-battle-rules.ts](../game/homeworld-battle-rules.ts) and Homeworld branch of [battle-resolution-quote.ts](../game/battle-resolution-quote.ts) already accept an explicit native/card/side/army contract. At inspection, the pure result can add native strength, restrict traitor callers and return typed native explosion losses. **The live engine does not yet supply this contract or consume the explosion result.** A calculator result is not evidence of live battle support.

Keep `gameTerritories`, `validLocation`, `splitLocation`, storm geometry, territory occupancy and stronghold control restricted to their existing Arrakis/HMS domain. Do not add a fabricated `homeworld:…:0` force key or append Homeworld cards to `TERRITORIES` to make existing validators pass.

## Minimum adapter contracts

Introduce one explicit combat-location resolver used by discovery, plans, resolution, aftermath, bots and controls. A discriminated location `{kind:'territory', id}` or `{kind:'homeworld', id}` can coexist with legacy saved `Battle.territory` strings through a strict decoder. The resolver must reject unseated worlds and Basic Salusa. It should supply:

- A stable canonical identity and display name; territory geometry only for the territory variant.
- Current physical armies by seated player, with native versus visitor provenance on Homeworlds. Public presence must not inspect concealed No-Field values.
- For a Homeworld, its native owner, card, applicable side and printed native bonus; use this only for that native faction's score. Preserve occupation as a separate input once its lifecycle is settled.
- Legal combatant pairs, current attacker order, entitled traitor callers, and eligible Face Dancer owner.
- A detached casualty transaction and receipt that binds exact source pool, normal/elite losses, Tanks deltas and resulting custody. This must also serve replacement/return effects without conflating them with deaths.

Do not require the native to be one of the two combatants: multiple visitors can fight each other. There is no Homeworld stronghold-capacity rule. Use the ordinary opposing-faction and turn-order rules for discovery without inventing native-first ordering. Allied noncombatants remain relevant to an explosion even when they do not fight each other.

## Live function map

| Boundary | Inspected code | Required adaptation |
| --- | --- | --- |
| Battle frontier | `quoteBattleBoard`, [board-resolution-quote.ts](../game/board-resolution-quote.ts):93; `battles`, [engine.ts](../game/engine.ts):8650 | Retain the planet quote, then compose a separate Homeworld conflict quote from custody and current order. No `gameDistance`, storm sector, advisor merge, Polar Sink exclusion or stronghold capacity applies to a world. Preserve the original advisor-release operations for planet battles. |
| Phase progress | `quoteBattleBoardContinuation`:364; `currentBattleAftermathQuote`, `finishBattle`; phase-6 initialization and automatic response normalization | Every test for “no remaining battles” must use the same combined frontier. Updating only `chooseBattle` would allow automatic advance to Collection while a Homeworld conflict remains. Preserve aid refunds and the existing CHOAM/Ix opening boundaries. |
| Choice and opening | `chooseBattle` action, `engine.ts`:17398; `Battle` type:480; `beginStrongholdBattle`, `beginBattlePowers` | Validate the selected canonical location/pair against that frontier; persist its identity in the battle event. Use normal sealed preparation. Stronghold copy/effects remain unavailable on Homeworlds; ordinary Voice, Prescience and other faction powers retain their independent scope. Do not add Homeworld bonus cancellation windows. |
| Force commitment | `combatForces`:3453; `validatePlan`:9972; `feasiblePrescience`:10912; `prescienceAnswer`; plan completion/truth helpers | Replace the board-force reduction with the exact location army. Continue to reuse `CombatForces`, `casualtyOptions`, leader/card legality and aid pricing. Basic dial parsing in `prescienceAnswer` currently caps against `at(p,b.territory)` and also needs this adapter. Audit plan-completion simulations, not just final plan submission. |
| Final pure input | `currentBattleResolutionQuote`:11160 | Supply `homeworld` from authoritative custody and current applicable face. Keep stronghold benefits null. Bind the actual native army, including when it is a noncombatant; do not infer it from a visitor's counters. Keep private hands and traitor identities server-only. |
| Removal preflight | [force-loss-preflight.ts](../game/force-loss-preflight.ts) `validateBattleForceLoss`; `currentBattleResolutionQuote` | The existing validator checks canonical sector keys only. Add Homeworld pool preflight through the custody quote, including aggregate reserve and Tanks consistency. Do not relax board-key checks. |
| Removal commit | `kill`:3402; `killTerritory`:3431; `takeBattleLosses`:3490; `resolveBattle`:11228; `settleWinnerCasualties`:11460 | Dispatch by location. Native deaths withdraw from the exact primary/Salusa pool and increment Tanks; visitor deaths withdraw from visitors and increment that faction's Tanks. Update elite Tanks and battle-loss counts exactly once. Ordinary deaths must not become reserve returns. |
| Delayed choices | `continueResolvedBattle`, `battleLosses`, `settleWinnerCasualties`, `pendingIxSubstitution`, `ixSubstitution` decision/response | Reuse owned casualty choices and automatic singleton handling, but bind them to a typed Homeworld pool. Ix substitution currently stores sector-key loss/source/recovery maps and directly reads board forces: it needs location-aware records and a real survivor/cyborg exchange. |
| Aftermath | `currentBattleAftermathQuote`:11500; [battle-aftermath-quote.ts](../game/battle-aftermath-quote.ts); `battleCleanupInput`:11762; [karama-battle-preflight.ts](../game/karama-battle-preflight.ts) | Replace the `territoryIds = gameTerritories(...)` validation boundary with explicit valid combat locations. Carry identical location identity through capture, Auditor, card retention, tech transfer and Face Dance. Keep their established sequencing and ownership; accepting a Homeworld identity must not grant territory-specific effects. |

`offerMoritaniDuke` is another consumer of `battles(g)`: it currently calls `territory(battle.territory).type`. Once the combined frontier is returned, filter the territory variant before the stronghold predicate. Homeworld combat does not qualify as a stronghold battle for this power.

## Strength and casualty details that need explicit handling

`CombatForces.freeSupport` is currently one boolean for the entire army. The Salusa high face gives **Sardaukar** free support, including when normal forces have been transferred there. Setting the existing boolean would accidentally make normal forces free too. Extend the shared arithmetic to represent per-type free support, then use it in `casualtyOptions`, plan validation, pure support payment, saved casualty validation, bots and the plan wheel. Preserve Basic strength-one starred counters, Ix fixed-half Suboids and the independent Emperor-versus-Fremen exception. Salusa occupation's loss of Sardaukar advantage is a separate printed modifier; it cannot be implemented as ordinary Karama cancellation.

The native printed bonus is a score addition, not additional physical counters, a larger dial, a spice-support charge or ordinary winner casualties. The source's “current” bonus should be supplied by the authoritative resolution adapter. Do not silently lock a high face for the whole battle merely because its opening was saved; conversely, once a resolution is committed, its receipt must retain the accepted effective facts while delayed casualties change population.

For Lasgun/Shield, `resolveBattle` currently loops through all players and calls `killTerritory(...,Infinity,true)`; it ignores the new pure `homeworldExplosion` result. The Homeworld branch must destroy actual foreign armies and commit only the native printed casualty count, capped by available natives. When multiple normal/elite allocations exist, create a native-owned casualty choice with a saved event; when only one exists, apply it automatically. Both combatants still lose and leaders die according to the explosion result. Preserve surviving natives and recalculate population after actual losses. Do not carry this named exception into Stone Burner, mutual Traitors, ordinary losses or arbitrary board destruction.

The exploding native may be a noncombatant. Test this explicitly: using the winner's ordinary casualty continuation alone cannot represent the choice because an explosion has no winner. An empty native army must not create a meaningless confirmation. Resolve the native choice before any successor consumes the final custody/occupation state.

## Traitors and Face Dancers

`traitorVoters` currently returns both combatants and sometimes a remote Harkonnen ally. On a Homeworld return only the native if it is a combatant. A native who is not fighting cannot become a remote traitor beneficiary; two visitors fighting therefore have no traitor voters. The same helper feeds `traitorCall`, automatic decline/resolution, cancellation preflight and projected `traitorVoters`; change them together to avoid an invisible waiting decision. Preserve revealed-card reactions, including Stone Burner and Poison Tooth, before automatic zero-voter resolution.

`resolveBattle` currently creates `pendingFaceDance` for any Tleilaxu seat when somebody else wins. On a Homeworld, only native Tleilaxu may receive that opportunity. A remote Tleilaxu cannot call on another faction's world, even for an ally. The occupied Tleilax immunity for an occupier/ally is a separate condition to compose when the occupation contract is available.

The `faceDance` decision (`engine.ts`:15526) currently requires a sector and uses `at(winner, territory)`, board source keys, direct reserve decrements, direct winner reserve returns and `place`. The Homeworld branch must instead quote the remaining winning foreign army, selected permitted Tleilaxu replacement sources, and a destination deposit into native Tleilax custody. Return the actual winner's normal/elite pieces through the native-return adapter, preserving Emperor's distinct pools and any unresolved return-routing interpretation. Preserve leader death, shared Cheap Hero identity, revealed-dancer custody and deck refresh. Source scope of replacement sources must be audited explicitly; the old `reserves`/sector parser does not authorize arbitrary foreign garrisons.

## Recovery boundaries

The mandatory battle-discard validator (`engine.ts`:3080–3252) both requires `gameTerritories(...).some(...)` and rechecks winner casualties by reducing `winner.forces`. It will reject an otherwise valid Homeworld battle even after the live resolver is adapted. Carry explicit combat identity and exact pool snapshots into `battleResolved`, `battleCleanup`, `lastBattleContext`, casualty choices and any new explosion continuation. Revalidate nested saved parents before read/action/normalization effects, including Nullentropy or other interruptions of those decisions.

Receipts must distinguish “resolution committed, typed losses pending” from “losses already committed, cleanup pending.” Do not rederive a completed native bonus after casualties flip its card or rerun support payment, bounty, leader death, card discard, tech transfer or capture on refresh. Same-total Salusa/native/visitor reallocations must invalidate a receipt bound to a different pool. Existing territory-only saves should continue through their current decoder and checks.

Atreides high reinforcement belongs after the appropriate completed winner/casualty sequence and requires a surviving own force at that combat location. It needs an owned optional reserve-transfer action, not a new ordinary shipment. Do not fold occupation rewards into generic battle victory: presence changes and qualification events need their own event-bound settlement, and the unresolved occupation cases remain documented in the source contract.

## Bots and controls

`viewGame` already projects owner-only `battle.ownForces`, sealed own plans, revealed plans and entitled prescience separately. Reuse that privacy boundary and add public combat location/name, native bonus and public opponent army counts. Do not expose a server-side `ResolutionCombatant` object; it contains private cards.

[bot-battle-choices.ts](../game/bot-battle-choices.ts) independently reconstructs only planetary battles. Replace that duplication with shared legal combat choices. In [bots.ts](../game/bots.ts), `plans` already prefers `b.ownForces`, but its opponent estimate uses `presenceAt(other,b.territory)` and would see zero defenders on a Homeworld. Update both legal candidates and strength estimates with the public adapter; add native bonus to evaluation, not dial. Face Dance strategy currently selects board sectors; Ix substitution and explosion choices also need exact legal descriptors for all four difficulty levels.

[game-table.tsx](../components/game-table.tsx) prefers `ownForces` but still uses `territory(g.battle.territory).name` in the battle heading and multiple cleanup/replacement labels. Use the combat display adapter; no sector selector should appear for a Homeworld-only target. Show the native bonus separately from the dial, per-type support costs, exact casualty pools and clear decision ownership. Mandatory single-option effects remain automatic with existing animation notices; optional replacement/casualty choices stay actionable after reload.

## Evidence required before enabling

Use actual dispatcher paths from a conserved invasion fixture through battle choice, sealed plans, reveal, owned casualties, card disposal and aftermath. Cover native/visitor and visitor/visitor pairs, ordinary turn order, allied third-party explosion losses, zero-voter automatic progress, remote Harkonnen/Tleilaxu rejection, Basic starred identity, mixed Salusa forces, population crossings, ordinary traitor losses and the explosion exception. Check typed Ix substitution and native Tleilax Face Dance without creating counters.

Test JSON and in-memory D1 recovery before/after each committed stage, concurrent final plans, duplicate casualty submissions and corrupted exact-pool receipts. Demonstrate all four bots can finish these paths without secret information. Browser-check Homeworld battle selection, sealed plan controls, native bonus, typed support/casualty choices, Face Dance, labels and refresh on desktop/mobile. Broader setup-to-endgame and every-faction/module evidence remains necessary for the full release gate.

This audit changed only this document and ran no game, test suite, server or saved-room operation. Current pure-calculator edits were observed, not independently certified. Occupation lifecycle and other existing source ambiguities remain unresolved here.
