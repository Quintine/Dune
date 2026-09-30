# Kull Wahad: source limits and Karama interruption design

Source audit: 2026-09-06; opt-in preview contract updated 30 September 2026. This is an engineering and product-policy record, not a rules-completion claim. The source audit in [CHOAM_REMAINING_RULES.md](CHOAM_REMAINING_RULES.md) remains applicable. The user-approved counter and BG choices supersede the original proposal; publisher-source uncertainty and full expansion gates remain.

## Authoritative boundary

[GF9 CHOAM & Richese rulebook](https://www.gf9games.com/dune/wp-content/uploads/2021/11/CHOAM-Rulebook-low-res.pdf), printed p. 7: Kull reacts to an attempted Karama play and prevents that player from playing Karama for the phase. Printed p. 12 permits Karama to prevent CHOAM's special-effect discard of a Worthless card during that phase. These clauses establish both directions of interaction, but do not specify a nested-response protocol.

The [November 2020 official FAQ](https://www.gf9games.com/dune/wp-content/uploads/2020/11/Dune-FAQ-Nov-2020.pdf), printed p. 7, says ordinary Karama stops one use of an eligible ability; it can affect alliance powers. A Bene Gesserit Worthless card is discarded if its conversion is stopped. This FAQ predates Kull's CHOAM ability and does not resolve its timing. The later expansion's specific rules take precedence over generic assumptions where they differ.

Evidence is indexed official publisher text retrieved in the preceding audit. Direct PDF access was unavailable: HTTP 403 through web retrieval, HTML through a local fetch. No inaccessible card face, tournament amendment, or community ruling is promoted to authority. No later official clarification settling the questions below was located.

## Selected policy and remaining source limits

The user selected **Different Karama**: bind and reserve the interrupted physical card, allow a distinct eligible counter before Kull's restriction becomes active, and never let the original pay for both purposes. They selected **Before conversion** for advanced BG substitutions: successful Kull retains the still-unplayed Worthless card. A prevented original special activation leaves its once-per-game use and additional costs unspent. These are explicit product interpretations, not located publisher rulings; see [the recorded selection](CHOAM_KULL_SOURCE_UPDATE.md#user-selected-preview-timing--30-september-2026).

The user selected **Defer interaction** for a winning overbid whose sole Karama payment becomes unplayable. A late payment guard accepted an unfunded bid and then could not settle it, so the preview now privately refuses non-CHOAM unfunded Karama-dependent bids before commitment, independently of hidden Kull custody. Existing unfunded winning activations also remain guarded. CHOAM self-activations are outside interception and retain their ordinary payment behavior; non-preview bidding is unchanged. This is an explicit unfinished-composition fence, not a printed bidding prohibition, numeric UI cap, auction restart, free award, invented funding or approval of an auction recovery.

The wider publisher cancellation scope across other physical copies or Worthless names remains unclarified. Preserve existing exact-cost phase prevention rather than silently widening it. Combined modules, simultaneous-power ordering beyond supported continuations and complete CHOAM games remain acceptance boundaries, not a reason to call approved counter/BG choices unanswered.

## Opt-in development scope

The explicit `kull` development profile admits Basic or Advanced CHOAM with classic factions, the physical CHOAM and Ix Treachery decks, and **no optional modules**. It does not introduce Ixian/Tleilaxu factions merely because their physical deck is present. Basic uses ordinary printed Karama; Advanced additionally admits BG substitutions and the existing legal special powers of that roster. `initializeKullGameForAudit` opts the newly initialized Game into `kullPreview`; older saved games and ordinary public starts are not retrofitted.

The visible preview warning and closed expansion/module gates remain mandatory. Printed Kull's preview is not Nexus Cunning Kull, complete CHOAM, full expansion certification or deployed evidence. Checkpoint verification belongs to the integration owner, not this source/guidance update.

Ordinary cancellation with a live Truthtrance battle or shipment promise must pass the existing pure `assertKaramaPromiseFeasibility` post-cost proof. An unsupported/unprovable suffix is rejected actor-privately before a Kull offer or cost. Proven supported Voice, Prescience, elite, support and aid cancellation paths remain interruptible; no-obligation paths remain unaffected. This is an incomplete preview composition, **not** a publisher prohibition. Do not publicize an unvalidated attempt, release its promise or speculatively execute random effects merely to prove feasibility.


Real Karama used for cancellation, shipment, purchase/payment, or a special faction power all fit the general attempted-play wording. Applying Kull to each is a strong textual inference, not an individually enumerated official ruling. Merely acquiring, holding, trading, selling, or discarding a card without activating Karama is not established as a trigger. Do not invent a phase-long ban on card ownership.

## Pre-interception activation inventory

The following inventory records the original immediate-mutation hazards in `game/engine.ts`, before Kull interception. Symbol names are stable references because concurrent development changes line numbers. The preview must intercept the validated intent ahead of these effects.

| Entry | Present execution | Required interception boundary |
| --- | --- | --- |
| `g.response` plus `card/mode: cancel` | `karamaCard()` -> `spendKarama()` -> `completeKarama()` -> `finishResponse(..., true)` | Before discard or consuming the original response; retain that response's owner, kind, and passes |
| `card/mode: shipment` | Checks phase/recipient and rate availability, then `spendKarama()` | Before discard and assigning `karamaShipping`; actor is the card owner, recipient is a separate identity |
| `card/mode: purchase` | Checks bidding eligibility, then `spendKarama()`; settlement changes bidder and transfers card | Before changing bidder, hand contents, or auction index |
| `decision: auctionPayment`, `karama: true` | Clears `g.decision`, selects card, calls `spendKarama()` | Preserve the payment decision before the generic decision dispatcher clears it |
| Bene Gesserit ordinary Karama substitution | `spendKarama()` discards Worthless, writes `pendingKarama`, replaces response with `worthlessKarama` | Add an explicit conversion stage; never reuse the existing `pendingKarama` slot for a different nested owner |
| All special powers | `specialKarama()` handles the action directly | Validate and intercept the entire special intent before entering any effect mutation |

Special branches bypassing `spendKarama()`:

| Faction | Immediate mutation to postpone until approved continuation |
| --- | --- |
| CHOAM | Activating Karama discard, selected cash-in discards, spice gain, `specialKaramaUsed` |
| Ixians | Card/once-use consumption, mobile stronghold relocation and collection |
| Tleilaxu | Card/once-use consumption, revival-prevention flag, deletion of pending revival and its decision/request |
| Fremen | Card/once-use consumption, `summonedWorm.resume`, clearing response/decision/conversion/spice state, beginning worm resolution |
| Atreides | Card/once-use consumption, full-plan request, clearing `fullPlanOffer` |
| Guild | Card/once-use consumption, marking shipper shipped, optional rate-card return, clearing shipment/decision |
| Emperor | **Leader/force revival and tech income occur before the current discard call**; a hook placed only at discard is too late |
| Harkonnen | Card/once-use consumption, random hand transfer, `pendingExchange`, replacing response/decision |

`applyActionInner()` deliberately permits CHOAM special cash-in before ordinary response/decision gating, and dispatches other special modes before `g.response`. Intercepting only the ordinary response handler leaves those paths uncovered. Adding a blanket denial of every special while a decision exists would remove already supported gameplay and is not justified by this task.

## State and API responsibilities

The pure [Kull module](../game/choam-kull.ts) owns `KullPhaseRestriction`, `activeKullRestrictions`, `kullBlocksKarama`, restriction/attempt-stamp validation, `distinctKullCounter`, `kullNativeCostCards` and `kullCounterCards`. It validates stamped phase policy and conserved canonical physical-card binding without mutating a Game. The engine remains authoritative for live custody, validated ordinary uses, prepared `SpecialKaramaIntent`, response ownership and once-only continuation. A saved attempt must not contain an arbitrary client `Action`, function closure, cyclic state or whole-Game rollback snapshot.

The original and counter cards have different obligations. The original stays reserved until Kull settles; ordinary counter eligibility excludes that exact physical ID. A different printed Karama or eligible BG substitution may counter while Kull is pending. A BG counter's own conversion response must not overwrite the original intent or its suspended response.

The consumer interface is `GameView.kullReaction`: `null` or `{ event, player, target, intent, cards, canDecline, blocked }`. It is present during the offer stage; the counter stage uses existing `responseControls`. `player` is the public CHOAM reactor, `target` the attempted activating player, and `intent` the ordinary purpose kind or the generic `special` label, never a special selection. All viewers see the same event/actors/intent; only CHOAM sees actual legal `cards` and `canDecline: true`. The current offer uses `blocked: null`, including no-card offers that CHOAM can decline. Countering reuses ordinary `card/mode: cancel` or `passResponse` actions. Never project raw special choices, saved response secrets, signatures, funding or either hidden hand.

`GameView.kullCounterEvent` is `null` or the same opaque public attempt event while the distinct-counter stage owns control, including a BG `worthlessKarama` overlay. Controls and bots use it only for precedence; legal physical choices still come from native `responseControls`. It reveals no original card, Kull cost or saved response payload. `GameView.karamaBlocked` is the current viewer's stamped activation-block reason or `null`, separate from a pending declaration; `kullPreview` supplies the visible opt-in warning.

CHOAM submits `{ type: 'kullDecision', event, decline: true }` or `{ type: 'kullDecision', event, card }`. Bind event and actor before costs. The declared Kull is a real held printed card, not a manufactured card or a free power. Nexus Cunning is not admitted by this preview.

## Settlement flow and cancellation

1. Validate an actual activation before discard, payment, physical movement, once-use flags or random effects. Reject an already effective stamped phase restriction before costs. Invalid plays create no public offer and reveal no private payload.
2. Save the exact typed intent and its parent ownership. Offer the same neutral CHOAM opportunity whether Kull is held or absent. Mere holding, transfer or nonactivation discard is not an attempted play.
3. Declining resumes the original intent once, without another offer for that same attempt. Declaring Kull opens the ordinary CHOAM-effect response; **pending is not active**.
4. Resolve legal distinct counters using existing response ownership. The reserved original cannot cancel Kull. A valid counter follows its own ordinary consumption/conversion rules; it does not consume the original card as payment for the counter.
5. On successful Kull, discard the exact Kull cost once, retain the original unplayed printed/BG card, leave the original special once-use unspent, and abort its effect. Restrict the **activating player**, not an allied shipment recipient, for the current turn/phase.
6. If Kull is prevented, retain its cost and prevent that physical cost's effect for the phase under existing native CHOAM semantics. Resume the original attempt once. Recheck custody rather than substituting another same-name card.
7. Stamp comparison expires the effective restriction on phase/turn change, not a temporary response, market or worm substep. It blocks Karama activations including substitutes, not ownership, trades or otherwise legal nonactivation discards.

This is the approved development interpretation, not an official nested-priority clarification. JSON continuation must preserve the same ownership and exact physical cards without a second random draw, payment or replayed effect.

## Bene Gesserit conversion

Kull intercepts **before** the original Worthless conversion or discard. Success therefore retains the original Worthless card and stops its attempted Karama use. If CHOAM declines or Kull is countered, the saved original proceeds to the established ordinary conversion stage.

Ordinary conversion behavior remains different: `spendKarama()` discards the BG Worthless card before opening `worthlessKarama`; preventing that conversion leaves the card discarded. Kull's pre-conversion custody selection does not rewrite that FAQ-based consequence. A distinct BG Worthless counter likewise has its own ordinary conversion response, while the original remains reserved.

## Existing continuation and feasibility hazards

| Integration point | Required design check |
| --- | --- |
| `recoverAuctionPayment()` | A held-but-blocked Karama must not keep returning an impossible payment decision. Its existing auction-restart fallback is provisional and is not the selected Kull remedy. Preflight the deferred sole-Karama winning-overbid composition instead of reaching an unfinishable settlement. |
| Bid validation | `karamaCard()` currently removes the normal maximum bid. Separate held-card classification from activation eligibility; do not accidentally disclose whether CHOAM holds Kull during bidding. |
| `findReachableBattlePlan()` / `cashInPreparationActions()` | These call `specialKarama()` on cloned trial state, then clear response/conversion fields. A new asynchronous gate would otherwise enqueue unchanged trials or treat pending cash-in as paid income. Provide a pure allowed-branch simulation or an explicit internal trial executor; an already effective Kull restriction must still apply. |
| `pendingBattleRevivalIncome()` | Currently searches only the live response or `pendingKarama.use.response`. It must find the suspended relevant income through any new Kull frames without counting it as already received. |
| `reconcileBattlePromises()` | Runs after every action. Do not release a Truthtrance promise merely because an undecided Kull interruption temporarily hides its still-possible preparation; re-evaluate after a settled restriction. Do not permit an actor to voluntarily evade a promise through the new path. |
| Fremen `summonedWorm.resume` / `afterWorm()` | Present snapshot includes `pendingKarama` and multiple phase fields. New frames must survive a legitimate nested summon, without a resumed snapshot resurrecting a completed attempt or erasing a phase block. |
| Harkonnen `pendingExchange` / `handExchange` | Present snapshot owns only response/decision. Preserve any surrounding attempt chain separately. A stolen or returned pending card requires custody revalidation; never substitute another card with the same name. |
| Guild special canceled shipment | Current rate-card refund is already provisional. If Kull prevents the Guild special before commitment, no shipment/rate-card refund mutation may have occurred yet. |
| CHOAM cash-in before response gating | Continue to allow already authorized paths where legal. Recheck pending-card custody; preserve CHOAM's exact declared Worthless ID in bot policy, including while hidden beneath a BG response. |
| `phaseOpening` and phase-end markets | Existing dispatch order gives these their own windows. Avoid offering Kull on a not-yet-legal special attempt; do not clear phase restrictions during a temporary market or response substep. |

## Projection, UI, and AI

- Public attempted-play metadata can include actor, purpose category, public recipient, and attempt ID. Do not expose raw continuation frames: they can contain private plans, hidden hand choices, revival terms, or future card transfers.
- The CHOAM opportunity must not depend on its hand containing `ix-kull-wahad`; otherwise the presence of a prompt leaks possession. Its available reaction card and exact pending CHOAM card ID belong only in its private projection. Existing public `g.decision` projection must be reviewed before placing private fields in a new decision variant.
- Kull's settled target and stamped phase expiry are public. Selecting another player's shipment beneficiary must not change which player is restricted. Do not silently extend CHOAM's powers to an ally.
- Bots must handle offer/decline, distinct counters, restored underlying decisions and blocked-activation filters. A card remaining physically in hand is not evidence the bot can play it. Prevent repeated invalid-action generation from proactive special and ordinary cancellation branches.
- Preserve `choamWorthless.pending` during pending Kull and nested responses, just as with Jubba; an AI should not cash in the card it is currently using as protection/prevention unless it deliberately chooses to abandon that effect.
- Human controls describe the attempted purpose and distinguish pending Kull from a successful active restriction. The opt-in preview warning must remain visible; approved timing is product policy, not official completeness. Card inspection must not expose unplayed opponents' hands.

## Minimum validation plan

1. Conservation and no premature mutation for all four ordinary purposes and all eight existing special branches; validate Emperor revival and random Harkonnen transfer specifically.
2. Direct cancellation nested under Kull, permitted counter-to-Kull, third-party counter, BG original conversion and BG counter-conversion; exact card IDs, one discard, once-use flag, response owner/passes and continuation preserved through JSON reconnect.
3. Successful block rejects a second activation in the same phase and permits one next phase; distinguish actor/beneficiary. Verify unsupported acquisition/holding restrictions were not added accidentally.
4. Payment with enough spice, alternate usable Karama, blocked held Karama, stale funding, hand-limit changes and losing card custody. Confirm the deferred winning-overbid guard rejects before costs with the same private result whether hidden Kull is held or absent; no auction remedy is certified.
5. Pending CHOAM cash-in, Fremen summon, Harkonnen exchange, revival-income preparation and Truthtrance feasibility; assert no response overwrite, false promise release, clone-search loop, duplicate random draw, or deadlock.
6. Compare two states differing only in CHOAM's private Kull possession: rival/public opportunity shape must match. Check private selected special payloads and suspended contexts never appear in rival or spectator views.
7. All four AI difficulties must complete each new continuation, including no-Kull/blocked-Kull decline and a response resumed after cancellation. Browser-check the new decision and its pending/canceled state after reconnect.

The original 6 September pass was a source/engine and document audit, not runtime verification. Its unanswered counter/BG proposals are superseded by the explicit 30 September selections above. The minimum validation plan remains a coverage contract, not a claim that every combination is verified.


## Implemented prerequisite: prepared special intents

The engine exports `prepareSpecialKaramaIntent` and `executeSpecialKaramaIntent`. The intent union represents all eight implemented factions, with separate Emperor force/leader branches. It copies normalized selections, binds the original turn and phase plus relevant current battle/shipment/revival declaration, and contains no random Harkonnen hand selection. The executor re-prepares and compares the intent before consuming the exact physical card or applying effects. The original prerequisite called these synchronously; the Kull preview pauses the prepared intent before execution.

Preparation includes public-dispatcher timing gates, with CHOAM's existing phase-opening/market/revival exceptions retained and all special activations blocked during unresolved Truthtrance. Feasibility clears Truthtrance only on its hypothetical future-state clone and retains binding battle promises. The executor mutates a disposable working Game; it is not independently transactional. Any future paused caller must restore its owned decision context, run on a clone, and publish only on success. Public `applyAction` remains the input-isolation boundary.

Ten regression cases in `tests/karama-intents.test.ts` cover all variants, serialization, preparation purity/no random draw, stale timing/custody/resources, copied CHOAM selection, exact declaration binding, deferred Harkonnen randomness, injected execution failure isolation, dispatcher parity and preserved CHOAM exceptions. The full 728-case unit suite and 33 persisted/database cases pass.

The prerequisite alone did not add a pending Kull frame or phase restriction. The later opt-in preview composes these prepared intents with the selected distinct-card/pre-conversion protocol. Full-game, combined-module, deployment and unpayable winning-overbid recovery acceptance are separate; the preview does not reopen public starts.
