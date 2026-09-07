# Tleilaxu Ambassador runtime readiness

Read-only architecture audit, 2026-09-07. This document proposes an independent revival source within the existing Ambassador continuation. It does not activate the effect, choose unresolved rules, or claim new test coverage. Guild Ambassador source was left unchanged.

## Source boundary

The existing [Ambassador rules audit](ECAZ_AMBASSADORS_RULES.md) records the printed grant: revive one own leader or up to four forces free. [The effects audit](ECAZ_AMBASSADOR_EFFECTS_AUDIT.md) separates that grant from unresolved ordinary quotas, elite limits, leader-cycle eligibility, foreign control, special prevention and income classification. The source reviewer is investigating those questions independently; the implementation should consume the resulting policy explicitly. Similarities to Ghola are insufficient to establish its exceptions.

Existing physical Ambassador entries occur in phases 1 and 5, including a Guild accompaniment that transfers its original worm continuation to another Ambassador. Nothing here opens an artificial Revival phase. Complete Advanced/expansion start gates and exceptional shared-leader gates remain independent.

## Existing reusable code and hazards

Line numbers refer to the reviewed snapshot below and may move.

| Existing code                                                                           | Useful contract                                                                                | Why the complete handler cannot be borrowed                                                                                                                                                                             |
| --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `game/revival.ts`, `forceRevivalRemaining`, `forceRevivalQuote`, `freeRevivalRemaining` | Existing ordinary pricing and allowance policy                                                 | Ordinary maximum, faction exceptions, Fremen payment permission and `p.revived` determine these results. They do not define an independent maximum-four free grant.                                                     |
| `game/revival.ts`, `eliteRevivalRemaining`                                              | Current per-turn elite remainder; Ixian cyborg exception                                       | Applying this to the Ambassador is a source decision. Ordinary and elite units must always remain physically distinct regardless of that decision.                                                                      |
| `game/revival-cancellation.ts:62`, `continuationCustody`                                | Safe typed Tanks/reserve counts and overflow checks; unique native leader matching             | It also validates ordinary usage, Emperor extras, normal leader frequency and a particular KH cycle. Extract or parameterize physical checks rather than inventing a fake `PendingRevival`.                             |
| `game/revival-resume.ts:60`, `quoteRevivalResume`                                       | Pure next-decision/response/commit receipt pattern                                             | Requires phase 4, frozen ordinary prices and benefit queues; computes ordinary free-income and technology receipts. A phase-1/5 Ambassador cannot call it unchanged.                                                    |
| `game/engine.ts:11172`, `finishRevival`                                                 | Atomic physical force/leader update and response installation pattern                          | Charges a payer, increments ordinary force/free/leader usage, changes foreign-ghola markers and deletes negotiated requests. None follows automatically from this new source.                                           |
| `game/engine.ts:11261`, `beginRevival` / `offerRevivalStop`                             | Existing normal CHOAM free-revival choice followed by Tleilaxu special prevention              | These are semantic normal-revival branches. They install `pendingRevival`, whose global gates block other actions. Do not inherit them merely to obtain a cancellation window.                                          |
| `game/engine.ts:9527`, `gholaLeaders` / `gholaOptions`                                  | Current control lookup, dead/captured filtering and private option pattern                     | Requires an actual available Ghola card, includes controlled foreign leaders, uses maximum five, and treats KH independently. The Ambassador has no card cost or card-discard continuation.                             |
| `game/engine.ts:9595`, `applyGholaEffect`                                               | Transfers typed forces; preserves death history; clears a revived leader's old `usedAt` marker | Hardcodes five forces and Ghola-specific leader/KH exceptions, elite usage and per-use income. Its outcome does not contain an Ambassador parent return.                                                                |
| `game/ecaz-duke-revival.ts`, `resolveEcazDukeRevival`                                   | Pure canonical shared-disc identity/custody and Ecaz-only right                                | Does not select future controller, authorize timing, waive frequency, or implement a return. Its five-spice paid quote is irrelevant to the printed free amount. Existing Advanced Harkonnen custody remains gated.     |
| `game/engine.ts:11142`, `collectRevivalIncome`                                          | Installs a cancellable Tleilaxu response after a committed revival                             | `free=true` marks once-per-turn normal free income; `ghola=true` rewards each use. Neither Boolean names the Ambassador classification. Calling it overwrites the current response.                                     |
| `game/engine.ts:8687`, `techIncome`                                                     | Existing phase, excluded faction and once-per-turn accrual checks                              | Axlotl is phase 4. An Ambassador in phase 1/5 must not receive a phase-4 quote by temporarily altering `g.phase`.                                                                                                       |
| `game/engine.ts:12013`, `finishResponse(revivalIncome)`                                 | Credits or cancels the already-earned income                                                   | Has no Ambassador successor. A source-aware branch must finish the parent after either outcome.                                                                                                                         |
| `game/terminal-cancellation.ts:163`, `game/karama-context.ts:185`                       | Existing terminal revival-income owner/amount/recipient validation, including outside phase 4  | The selector currently has no source parent. New source-tagged income must bind its Ambassador receipt before native or converted Karama cost and final settlement. Legacy ordinary/Ghola income must remain unchanged. |

Ordinary force/free/leader ledgers (`revived`, `freeForcesRevived`, `leaderRevived`) reset when phase 4 begins. Elite `revived` resets in `beginStormTurn`. This distinction matters for a phase-1 revival followed by normal Revival and a phase-5 revival after it. Do not reset or increment either family merely to make a reused function accept the request. Likewise preserve `revivalCycle`, `freeRevival`, `revivalRules`, `revivalFreeIncome`, `revivalPrevention`, `emperorExtra`, negotiated `revivalRequests`, and faction special-use stamps unless an individually sourced rule requires a change. Recruits/free-rate arithmetic cannot silently enlarge the printed four.

## Proposed independent selection and quote

Keep ownership inside `pendingAmbassador`, following the already implemented `move` and `ship` source patterns. A proposed `stage:'revive'` belongs to `entry.beneficiary`; action JSON carries the exact `entry.event` and a discriminated selection, for example:

```ts
{ type:'decision', event, revival:{kind:'forces', amount, elite} }
{ type:'decision', event, revival:{kind:'leader', leader} }
```

This shape is a design proposal. Include KH only if its treatment under “leader” is resolved. An optional pass/zero choice and automatic no-eligible-piece completion likewise need the source review; do not invent either from UI convenience.

A pure `quoteTleilaxuAmbassadorRevival(g, beneficiary, event, selection)` should validate:

- Current playing phase 1/5, turn, exact nonempty parent event, selected beneficiary and selection-stage controller. Before commitment retain current Ecaz-self or reciprocal ally eligibility.
- One valid canonical Ambassador inventory: physical Tleilaxu token already used, or the removed BG token with a valid recorded Tleilaxu copy outside the cohort. Validate original entrant/territory/sector and `validAmbassadorResume`, including an inherited Guild advisor origin and original worm rider.
- Exactly one alternative. For forces, safe nonnegative physical counts, selected amount within the source-defined range and Tanks, ordinary selected count `amount-elite` within ordinary Tanks, elite selected count within elite Tanks, and safe resulting reserve/counter values. Tanks contain total forces including elites; never subtract the elite amount twice.
- For a leader, exact single physical identity across rosters and the shared Duke zone, dead status, death history, and applicable current custody. Distinguish native identity from temporary controller. A captured leader, a foreign ghola, the Auditor, Duke and KH each require the applicable explicit eligibility contract; do not let a generic fallback pick one.
- Exact deterministic result and any policy-authorized ledger changes. Compute without RNG, private opponent hands, normalizer execution, card spending or parent completion.

Return an explicit effect receipt, not a modified whole Game. A force receipt can contain `{player,kind:'forces',amount,elite,cost:0}` plus the finite before/after custody and permitted usage deltas. A leader receipt should identify original roster owner or `source:'sharedDuke'`, exact leader ID/death count, original controller metadata and the authorized restored state. This prevents changing a selected native revival into another controller's disc during recovery.

## Commitment, income and parent continuation

If the source review finds no pre-revival intervention, selection can validate and transfer the pieces atomically in the existing public action. No separate durable pre-effect frame is necessary. A committed effect only needs a saved receipt if a real subsequent response suspends completion.

If Tleilaxu income applies, use an explicit source-tagged response, for example `kind:'revivalIncome', source:'ambassador', intent:entry.event, owner, recipient:beneficiary, amount`, backed by `entry.revivalReceipt` and an income stage. Do not masquerade as a Ghola card or stamp its physical discard sequence. The receipt must record the already-completed return and exact unpaid income, distinguishing a canceled income reward from a canceled revival.

Both allowed and canceled income follow `finishAmbassador` exactly once. The physical return remains committed; neither path calls the revival quote against now-empty Tanks, repeats the transfer, increments a quota again, pays twice, or reruns token replenishment. Final cleanup preserves the existing outer `none`/`wormRide` return, `wormRider`, and `guildAdvisorOrigin`. It must not call `nextPhase`, `finishMovementTurn`, normal Revival setup, or ordinary battle cleanup.

If an authoritative pre-effect faction power is applicable, add its own typed intent and source-aware validator before opening it. The canceled receipt must describe only the actual denied branch. Do not price an unmade free revival, consume normal allowance, or require pieces to be revived merely to cancel income. Existing phase-4 special-prevention code cannot be broadened to all revivals without resolving its printed timing.

For persisted income, validate source event/turn/phase, exact seated Tleilaxu owner and beneficiary, parent/token provenance, positive safe amount, stage, and response binding in live or suspended controls. Include saved BG conversion, exchange, gift, Box, summoned-worm and discard-resume contexts already supported by the engine. Source signatures should bind the relevant receipt, not hands, spice, response passes or a whole Game. Once pieces have returned, unrelated permitted effects can alter their current position or custody; requiring the entire post-return board forever would reject legitimate interruptions. Conversely, an orphaned income response or orphaned parent must fail before view, automatic recovery and actions.

The Guild review found and fixed precisely this missing-parent/control class at its pre-shipment stage; the new revival source should include these checks from the start.

## Projection and tests

Expose only the beneficiary's legal revival choices within `ambassadorEntry`, gated by the actual selection stage and suspended controls. Other seats receive public stage, beneficiary and any already-public result, never another hand or unfiltered controlled-leader pool. Exceptional custody errors should use the established generic Duke/Auditor unavailable explanations where disclosure matters. Repeated view and option enumeration must leave RNG, death history and every ledger unchanged. UI/AI should use the same public option contract; neither should manufacture a normal `revive` or Ghola-card action.

Minimum real-action coverage after the source contract is settled:

1. Enemy entry → actual token trigger/copy → beneficiary revival, across phases 1 and 5, Ecaz self and each supported allied typed pool. Verify maximum four, mixed ordinary/elite conservation, exact cost zero and individually specified ordinary/elite ledgers.
2. Native leader battle death followed by this actual selection; same physical identity, death history and authorized reuse timing. Separately test Auditor, KH, controlled foreign ghola and Duke allowed/gated cases rather than treating one leader fixture as all of them.
3. Real income allowance, printed Karama and BG conversion/counter-cancellation, if applicable. All must retain one committed return and resume the original entrant or worm queue once. Include a paid Box or gift interruption without freezing unrelated private state.
4. Fresh production room/auth/SQLite recovery at selection and earned-income boundaries; two final requests from the same version produce one CAS write, transfer, income and cohort transition. Wrong actor, stale event, changed token/source, duplicate/missing disc, impossible typed Tanks and malformed receipt reject before writes.
5. No eligible forces/leader, prior normal revival, prior elite revival, later normal Revival, empty resources, and phase changes according to the source-resolved semantics. The tests must not define those semantics through expected values before the source decision.

No new runtime defect in existing revival was reproduced by this audit. Identified issues above are integration requirements for an effect that is not yet active. No tests or full-game runs were performed; verification totals remain pending implementation and root integration.

## Reviewed snapshot

Historical hashes for this read-only review, not a future release fingerprint:

- `game/engine.ts`: `3f7e0eca9b595ef06799388ecaf6b61ce702c85c57cfbe015a0dd589437eaad0`
- `game/revival.ts`: `679a33b68d6eac4a419bded2f3e506b466a68c337413a1798f2999f234b50c3c`
- `game/revival-resume.ts`: `cf31770745b2a32e498feef936f8f177d2e54624cbe546af912efe241356946f`
- `game/revival-cancellation.ts`: `374fe003aae4c27b5e5c70ed97f448f012e5a36dc5b8d0945aef790e96ed9a65`
- `game/ecaz-duke-revival.ts`: `1d16fb1fd5ba43d77282da603d468a449beb767c6aabd4e77229e572f36952d7`
