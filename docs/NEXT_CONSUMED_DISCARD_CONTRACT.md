# Next consumed-card discard continuations

Read-only bounded implementation contract, 2026-09-07. Current source inspected: `game/engine.ts`, `game/card-availability.ts`, Ghola preparation searches, existing Karama/Distrans/ordinary-card tests, and `docs/SEMUTA_DISCARD_CONTINUATIONS.md`. No production or test files changed; no tests executed for this contract-only audit. Source anchors below are approximate and function names are authoritative navigation points.

## Recommendation

Implement the live ordinary-card **post-effect** tail first: Hajr, Weather Control, Harvester and Family Atomics (`applyActionInner`, approximately 14394–14426). Their complete effects already occur before the common discard. Ghola shares this tail, but including it requires both preservation of its `revivalIncome` response and explicit handling of shipment-search simulations that call the inner dispatcher. Otherwise keep Ghola separate rather than introducing a paused hypothetical preparation or losing its income continuation.

Do not combine this with Karama. `spendKarama` is a **pre-effect** discard boundary whose suffix can cancel a power, settle an auction, draw/refill and produce another discard frame. That is a materially larger caller/validation problem.

Distrans is an independent small follow-up candidate: the pure transfer result is committed before its direct discard, so its continuation only restores controls/finalization. It has private transfer receipt requirements, however, and need not be included in the first ordinary-card slice.

## First slice: ordinary post-effect cards

Existing timing/selection validation remains at the start of the live public branch. Do not validate the used card as still held or rerun availability after consumption: for example, Hajr has already changed its movement allowance, Atomics has already destroyed the Wall, and Harvester has already changed its window.

| Effect and source | Prefix already performed before common discard | Required saved outcome / suffix |
| --- | --- | --- |
| Hajr, `applyActionInner` ~14394 | Existing ordinary timing and Ornithopter incompatibility checked; owner appended to `g.hajr`. | Bind owner/current movement and resulting allowance. Never append twice. Existing log and finalization only. Do not change current prior-move or Hajr/Ornithopter ruling gates. |
| Harvester, ~14402 | If the blow is outside storm, add the old blow amount to that location's spice; then double `spiceWindow.amount`, mark harvested, increment harvesters and clear ready seats. In-storm blow still updates the window but does not create ground spice. | Bind current blow location/sector and resulting window/ground spice/ready state. Never multiply or add again. Retain repeated legal Harvester semantics and existing closed-window guards. |
| Weather Control, ~14412 | Exact validated integer selection (including zero) assigned to stormPending; ready seats cleared. | Bind selected/resulting storm distance and current storm stage. Do not reset/re-run dialing or initialize storm. Existing log/finalization only. |
| Family Atomics, ~14416 | shieldWallDestroyed set; every faction's forces on Shield Wall killed through existing `killTerritory`; ready seats cleared. | Bind destroyed flag and resulting typed force/tank state. Never kill again or re-evaluate adjacency after the user's qualifying Wall forces may already have died. |
| Ghola, `applyGholaEffect` ~7384–7420, called ~14400 | Revive selected leader, KH or 1–5 typed forces under existing rules; update relevant death/cycle/elite counts; accrue Axlotl technology; open Tleilaxu revivalIncome when appropriate. | Bind actual selected outcome and already-earned technology plus original income response. Do not revive again, increment cycle again or accrue/pay income twice. Restore income for normal cancellation/automatic allowance after frame retirement. |

All five then call `discard(g,p,c.id)` and `log(g, player + ' played ' + card.name)`. Recommended boundary: effect and physical discard are committed prefix; the public played-card log may also be committed prefix, leaving a minimal suffix that restores the four controls and returns to existing finalization. Alternatively retain that one log in the suffix, with exactly one chosen convention. Do not apply any original effect from the suffix.

A bounded variant can be `{kind:'ordinaryCardDiscard', owner, effect, committedOutcome, resume, signature}`. Require an explicit supported-effect discriminant, exactly one public receipt for the owner/card/effect, and current phase/turn/global discard sequence. Do not reuse a generic “card” continuation that permits arbitrary unsupported effects.

Current ordinaryCardAvailability handles the four non-Ghola effects and returns null for other card effects; it is not a Ghola legality validator. Preserve that distinction. The enclosing ordinary branch already blocks setup/lobby/finished and active Truthtrance/response/decision/opening. Ghola may itself create a response after passing those guards. Suspend that newly-created response before staging; do not reject it with the generic frame's direct-response exclusion.

### Recovery and privacy invariants

- Validate the exact used physical card once in discard and absent from all real hand/deck/cache/removed/current-pool/played-escrow zones; receipt aliases are not duplicate custody.
- Bind the completed outcome and suspended controls against current state. Store private or detailed effect evidence only internally; public batch visibility is the already-played card face, not a dump of `action`, leader pools or private hand data.
- Use the existing pure suspended-control validation and add any necessary source-specific outcome checks. Retire the frame before restoring controls and ordinary finalization. Do not restore a whole old Game or recompute earned effects from current resources.
- Run post-action promise reconciliation only after context restoration. A Ghola frame temporarily hides income controls; do not let feasibility searches release a battle commitment because that income temporarily vanished from the direct response.
- Frame recovery should allow seat autopilot changes but reject gameplay until retirement. A new automatic response can then resolve, or pause for an actual Karama holder, exactly as before.
- Unsupported choices must reject before a durable prefix is exposed. The current public wrapper already uses a clone; preserve all-or-nothing behavior for failed availability, invalid Ghola custody and promise violations.

### Keep simulation helpers free of live frames

The two searches use different execution paths. `findReachableBattlePlan` (~7556 onward) calls `applyGholaEffect` and then `discard` directly on cloned trial states and accounts for possible pending revival income. **`findShipmentCompletion` calls `applyActionInner` for every preparation** (~7795–7802), including Ghola, shipping Karama and escrow withdrawal; it also calls the inner dispatcher to validate final candidate shipments. The earlier claim that both searches call the effect helper directly was incorrect.

Therefore, staging only at the ordinary tail of `applyActionInner` is **not sufficient** to keep shipment simulation free of paused frames. A Ghola trial would return a pending discard and enqueue that intermediate state as though its preparation were finished. Later cost frames would cause the same problem for shipping Karama. The four non-Ghola post-effect cards remain the lowest-risk first slice; including Ghola requires an explicit simulation accommodation in the same change.

Use an internal, non-user-selectable execution mode or preparation helper that performs the existing deterministic effect and exact physical discard accounting without creating live opportunities in a hypothetical trial. Alternatively, drain only the known deterministic committed trial continuation before enqueuing the next search node, with no human/AI decision, general automatic settlement, random draw, or opportunity creation. Do not solve this by calling the public action wrapper or general normalizer recursively: those can reconcile shipment promises and re-enter feasibility search, or advance unrelated parents. The simulation result must represent the completed preparation, preserve its remaining cards/rate/reserve/escrow state, and leave the authoritative input unchanged. Keep battle-search direct helpers unframed as well; wrapping generic `discard` would affect both search families. No public reaction or RNG may be introduced by read-only availability enumeration.

## Separate next slice: printed/BG ordinary Karama cost

`spendKarama` (~4486) validates spending custody, discards the activating card, records its physical ID into shipment use when applicable, then either opens BG Worthless conversion or calls `completeKarama`. Its callers are explicit response cancellation (~11719), selected auctionPayment (~12603), ordinary shipment-rate use (~14335), and immediate purchase (~14346).

A suitable distinct intent is `{kind:'karamaCostDiscard', owner, form:'printed'|'worthless', use:KaramaUse, resume, originalOpportunityBinding}`. This records the validated accepted use, not an action to replay. Prefix is exactly the activating discard and any chosen public cost log. Suffix:

- Printed `cancel`: restore the exact target response from `use.response`, call its existing canceled continuation once, then original cancellation log. The target response owner differs from the paying owner; preserve original passed/intent and every associated pending record.
- Printed `shipment`: install the already-accepted recipient/owner/activating-card rate record once. Original caller requires active unused recipient and no existing rate. No force shipment or spice payment has yet occurred.
- Printed `purchase`: set the current original auction bidder to the paying owner, then settle that original lot free once. Preserve exact lot/index/card and its capacity/eligibility commitment; do not reselect a new current auction.
- Printed `auctionPayment`: settle the existing winning bidder's original lot free once; do not change its bidder or repeat prior bidding/payment selection.
- BG Worthless: install the typed `pendingKarama` and conversion response once, with the original use retained. Do not perform the underlying use before conversion is allowed. If conversion is canceled, the current resolver restores the original response for cancel-use, reopens payment selection for auctionPayment, or leaves other original effects unperformed. The Worthless cost stays discarded; cancellation does not create a second cost batch.

`completeKarama` can invoke `finishResponse`, `settleAuction`, `continueAuctionSale`, Harkonnen bonus, next auction and refill indirectly. Cost frame retirement must precede all of those. An Ixian replacement or later mandatory discard may create its own successor frame. Do not allow caller code after `spendKarama` to keep advancing while the new cost frame is live.

### Why Karama is not the lowest-risk first slice

The cost is discarded **before** effect validation in some called continuations. Existing unsupported cancellation branches, such as the unresolved Richese auction-count cancellation, can throw from `finishResponse`. A paused frame must not persist an activating cost whose mandatory suffix can never run. Extract/preserve pure accepted-use validation where needed; do not run a full cancellation as a preflight because it can consume RNG or perform a multi-effect chain. `responseCancelCards` explicitly avoids simulating cancellation for this reason.

Nested BG conversion is an additional binding layer. A printed card can cancel a Worthless conversion that itself attempts to cancel an older response. Preserve the original `pendingKarama`, its parent use and both response identities. Never overwrite that record with discard metadata. The saved cost's owner/form must satisfy the original faction/mode rules without requiring the now-discarded card to remain held.

Shipping Karama contains an existing provisional Guild refund claim. The suspended `use.kind:'shipment'` must retain `use.card` even before `karamaShipping` exists; later rate-return logic may refer to it. This audit does not settle who can claim that discarded card, refund settlement, or Semuta full-hand ordering. Keep the existing unsupported/held-reservation gates and leave Semuta activation unavailable.

Special Karama powers use `executeSpecialKaramaIntent`, not this ordinary `spendKarama` path. Their faction-specific activator, selected-discard, random-take and movement/revival suffixes remain separate future producers. Do not capture them accidentally by wrapping generic discard.

## Optional independent follow-up: Distrans

At `applyActionInner` ~11590–11614, `validateDistrans` produces pure owner/recipient hands; both are assigned and only `result.discarded` is pushed to the pile. The privately gifted card is a transfer, not a second discard. A minimal post-transfer frame can commit the public log with the prefix and restore its original four controls after retirement. Bind recipient and transferred-card custody internally without exposing `action.give`. Preserve existing gift/exchange/auction capacity and promise checks performed before assignment. This is smaller than Karama but should have its own source-specific physical transfer proof.

Amal and Thumper are not members of the recommended five-card post-effect tail. Amal currently discards before halving spice/resetting opening passes; Thumper discards before `blowSpice`, which draws and can initiate worms/Nexus. Each needs its own original-effect versus suffix contract rather than automatic inclusion by effect keyword.

## Bounded test needs

For ordinary cards, actual play → observed pre-drain frame → JSON/CAS recovery must show exactly one physical discard/log and no repeated effect. Cover Hajr allowance without a second movement grant; Weather zero and post-dial usage; one and successive Harvester plays, existing spice versus new blow, storm and closed windows; Atomics with the qualifying force killed and typed casualty conservation; Ghola ordinary/elite forces, leader/KH/foreign controlled leader, Axlotl accrual and Tleilaxu response allow/cancel. Repeat invalid selections/promise violations with exact input preservation. Verify read-only battle and shipment Ghola preparation still returns real legal witnesses without mutating state or leaving a pending frame. Specifically exercise a shipment feasible only after Ghola, Ghola plus retained shipping Karama, and Ghola plus escrow withdrawal; ensure every returned witness can be executed through real actions and that neither recursive promise reconciliation nor RNG occurs during search.

Existing anchors: `tests/card-availability.test.ts`, ordinary-card cases in `tests/engine.test.ts`, `tests/foreign-gholas.test.ts`, revival/technology tests, `tests/shipment-promises.test.ts`, and battle-promise preparation tests. Audit fixture physical sourcing when strict receipt custody reveals directly assigned catalog cards still duplicated in a deck; fix the fixture, not runtime validation.

For later Karama: printed and BG forms across all four uses; canceled conversion preserving each original outcome; printed cancellation of a nested conversion; unsupported canceled target rejects without spent card/CAS; exact auction card acquired once with empty-deck bonus/replacement chains; shipment rate owner/recipient/card binding without selecting a new refund rule; stale event/lot/response/custody corruption and duplicate-worker recovery. Existing anchors include `tests/bg-karama.test.ts`, `tests/karama-intents.test.ts`, `tests/combat-karama.test.ts`, faction movement Karama suites and auction recovery tests.

All proposed frames must maintain only the generic public automatic marker, source-appropriate already-public face/log, and owner-only underlying private controls/witnesses. Source signatures are consistency bindings, not authentication against wholesale manual JSON rewriting. This report recommends implementation boundaries only.
