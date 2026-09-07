# Kull Wahad: source limits and Karama interruption design

Audit date: 2026-09-06. This is a proposed implementation design, not a rules completion claim. Only this document was changed. The source audit in [CHOAM_REMAINING_RULES.md](CHOAM_REMAINING_RULES.md) remains applicable.

## Authoritative boundary

[GF9 CHOAM & Richese rulebook](https://www.gf9games.com/dune/wp-content/uploads/2021/11/CHOAM-Rulebook-low-res.pdf), printed p. 7: Kull reacts to an attempted Karama play and prevents that player from playing Karama for the phase. Printed p. 12 permits Karama to prevent CHOAM's special-effect discard of a Worthless card during that phase. These clauses establish both directions of interaction, but do not specify a nested-response protocol.

The [November 2020 official FAQ](https://www.gf9games.com/dune/wp-content/uploads/2020/11/Dune-FAQ-Nov-2020.pdf), printed p. 7, says ordinary Karama stops one use of an eligible ability; it can affect alliance powers. A Bene Gesserit Worthless card is discarded if its conversion is stopped. This FAQ predates Kull's CHOAM ability and does not resolve its timing. The later expansion's specific rules take precedence over generic assumptions where they differ.

Evidence is indexed official publisher text retrieved in the preceding audit. Direct PDF access was unavailable: HTTP 403 through web retrieval, HTML through a local fetch. No inaccessible card face, tournament amendment, or community ruling is promoted to authority. No later official clarification settling the questions below was located.

Unresolved rulings that must remain visible:

1. Whether the same Karama that Kull interrupts can instead cancel Kull, whether a second Karama by that target may do so, and how third-party responses are ordered.
2. Whether Kull intercepts a Bene Gesserit Worthless conversion before discard, or only after conversion has succeeded; the resulting card custody in each case.
3. Whether an already prevented player may still overbid using a held Karama, and the required recovery when an accepted winning bid becomes unpayable.
4. Exact cancellation scope for CHOAM's prevented Worthless effect across other physical copies or another Worthless name.
5. Self-targeting, simultaneous attempts, and phase-end abilities that may exchange a card while another declaration is unresolved.

Real Karama used for cancellation, shipment, purchase/payment, or a special faction power all fit the general attempted-play wording. Applying Kull to each is a strong textual inference, not an individually enumerated official ruling. Merely acquiring, holding, trading, selling, or discarding a card without activating Karama is not established as a trigger. Do not invent a phase-long ban on card ownership.

## Current activation inventory

The following paths were inspected in `game/engine.ts`; symbol names are the stable references because concurrent development changes line numbers.

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

## Proposed state and API responsibilities

Names below are illustrative; this document does not add these types to the engine.

```ts
type KaramaBlock = { turn: number; phase: number; player: string };

type PendingKaramaIntent = {
  id: string;                    // Stable server-issued attempt identity.
  owner: string;                 // Player activating the card, not its recipient.
  card: string;                  // Exact physical identity; no later auto-selection.
  turn: number;
  phase: number;
  form: 'printed' | 'bg-conversion';
  purpose: ValidatedOrdinaryOrSpecialIntent;
  stage: 'offer-kull' | 'resolve-kull' | 'convert-bg' | 'commit';
  offeredToChoam: boolean;
  suspended: KaramaContinuation;
};
```

`ValidatedOrdinaryOrSpecialIntent` should be a discriminated union, with only the fields needed for each use: shipment recipient; auction identity/index and payer; cancellation response identity; special target/leader/count/elite/route or selected cash-in IDs. Do not retain an arbitrary client `Action` object and replay it through the public dispatcher.

`KaramaContinuation` must describe which suspended operation resumes or aborts, and own its response/decision data. Maintain explicit nesting frames or an equivalent bounded continuation structure; the present single `pendingKarama` field cannot represent both a suspended BG conversion and a new Karama counter-response. A numeric nesting limit, if needed as a defensive assertion, is not a game rule and must not reject a reachable legal sequence arbitrarily.

Recommended helper responsibilities:

- Keep `canUseAsKarama()` as the physical/type classifier. Add a stateful activatability predicate that considers Kull's turn/phase restriction, custody, committed cards, and purpose. Distinguish this from hand valuation and any separately resolved overbid permission.
- `validateKaramaIntent()` performs the same preconditions as the current branch without mutation or random draws. Invalid attempts must not open a public Kull window or reveal a private card.
- `beginKaramaIntent()` saves the exact continuation, then offers CHOAM a decision based on the public attempt, regardless of whether its private hand contains Kull. The action must not yet change game resources or reveal future random results.
- `commitKaramaIntent()` is an internal, once-only executor. It revalidates relevant live state, consumes the exact card once, applies the effect, and resumes the proper continuation. The already-offered attempt cannot reopen its own Kull opportunity.
- `abortKaramaIntent()` restores or completes the underlying opportunity without applying the prevented effect. It must not restore a whole saved `Game`: doing so would undo legitimate intervening cash-ins, card custody changes, or unrelated response outcomes.

Persist attempt IDs, stages, and continuation ownership through JSON saves. Missing new fields in legacy rooms should normalize to no pending attempt/no block. A frame must not contain a function closure or cyclic object. Prevent two frames from independently owning the same original response or physical-card consumption.

## State-machine flow and cancellation

This is an implementation skeleton. It does **not** choose an answer to the unresolved nested-priority questions above.

1. Receive a legal attempted activation; reject an already active phase restriction before costs. Capture its continuation and announce the minimum public intent.
2. Offer CHOAM the reaction. Declining resumes this attempt exactly once. Declaring Kull stores its exact card ID as `pendingChoamWorthless`, its target actor, and the attempt ID; consume neither side until its appropriate stage.
3. Resolve whichever counters the eventual authoritative timing interpretation permits. Save the interrupted Kull frame and original attempt when another card is activated; never overwrite them with the top-level `g.response`.
4. If Kull settles successfully, establish the actor's turn/phase restriction and abort the interrupted activation. Proposed pre-play custody behavior is to retain the prevented Karama and leave once-per-game power use unspent. This is a reasonable implementation choice, but the retrieved text does not explicitly state its discard treatment.
5. If Kull is prevented, use the existing CHOAM prevention-of-discard contract, then resume the saved activation once. If Kull was sold, exchanged, or otherwise lost, grant no restriction; revalidate the interrupted activation instead of assuming its card is still owned.
6. A new phase clears the effective restriction by stamp comparison. A temporary worm-resolution suspension in the same phase does not. Do not permit ordinary phase advance while an unresolved frame owns its continuation.

Do not silently install any of these as an official priority rule: target always wins the counter, CHOAM always wins the counter, same card may answer twice, same card can never answer, no counter is possible, or everyone gets an unlimited replacement response. The final engine may need a documented provisional policy under the existing expansion gate until primary clarification is available.

## Bene Gesserit conversion

Current behavior intentionally differs from CHOAM Worthless cancellation: `spendKarama()` has already discarded BG's Worthless card when it exposes `worthlessKarama`. `finishResponse()` clears the conversion pending record; allowing calls `completeKarama()`, canceling a cancellation restores the original response, and canceling auction payment invokes recovery.

Preserve that established ordinary-cancellation behavior. Two possible Kull placements require a ruling:

- **Before conversion:** Kull stops an attempted use-as-Karama while its physical Worthless card is still in hand. This needs an explicit custody policy and cannot reuse the existing post-discard conversion cancellation result blindly.
- **After conversion:** normal BG conversion responses occur first; an allowed conversion then reaches Kull. This requires retaining the discarded card's identity and a suspended original intent, and clarifying whether/when that card returns if Kull succeeds.

Whichever placement is eventually selected, a printed Karama canceling BG's conversion is itself an activation path. Test Kull on that counter as well as on the original substituted use. A successful Kull block must prevent the target bypassing it by choosing a different physical Worthless card on the next action, if substituted activation is included in the ruled scope.

## Existing continuation and feasibility hazards

| Integration point | Required design check |
| --- | --- |
| `recoverAuctionPayment()` | A held-but-blocked Karama must not keep returning an impossible payment decision. Its auction-restart fallback is already documented as provisional; Kull does not certify that fallback. Preserve card secrecy and actual funding while deciding recovery. |
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
- Kull's settled target and expiry are public. Selecting another player's Karama beneficiary must not change which player is restricted. Whether the actor may target itself remains a ruling gap, not a reason to silently extend ally benefits.
- Bots must handle offer/decline, counters if permitted, restored underlying decisions, and all blocked-activation filters. A card remaining physically in hand is not evidence the bot can play it. Prevent repeated invalid-action generation from both proactive special branches and ordinary cancellation branches.
- Preserve `choamWorthless.pending` during pending Kull and nested responses, just as with Jubba; an AI should not cash in the card it is currently using as protection/prevention unless it deliberately chooses to abandon that effect.
- Human controls should describe the actual attempted use and phase restriction. Keep unconfirmed timing explanations out of claims of official completeness. Full card inspection must remain available without exposing unplayed opponents' hands.

## Minimum validation plan

1. Conservation and no premature mutation for all four ordinary purposes and all eight existing special branches; validate Emperor revival and random Harkonnen transfer specifically.
2. Direct cancellation nested under Kull, permitted counter-to-Kull, third-party counter, BG original conversion and BG counter-conversion; exact card IDs, one discard, once-use flag, response owner/passes and continuation preserved through JSON reconnect.
3. Successful block rejects a second activation in the same phase and permits one next phase; distinguish actor/beneficiary. Verify unsupported acquisition/holding restrictions were not added accidentally.
4. Payment with enough spice, alternate usable Karama, blocked held Karama, stale funding, hand-limit changes, and losing card custody. Mark auction recovery scenarios provisional where source interpretation is unresolved.
5. Pending CHOAM cash-in, Fremen summon, Harkonnen exchange, revival-income preparation and Truthtrance feasibility; assert no response overwrite, false promise release, clone-search loop, duplicate random draw, or deadlock.
6. Compare two states differing only in CHOAM's private Kull possession: rival/public opportunity shape must match. Check private selected special payloads and suspended contexts never appear in rival or spectator views.
7. All four AI difficulties must complete each new continuation, including no-Kull/blocked-Kull decline and a response resumed after cancellation. Browser-check the new decision and its pending/canceled state after reconnect.

This pass inspected the source paths above and validated document structure. It did not edit the engine, UI, bots, or tests, and did not run tests for behavior that remains unimplemented. Exact nested priority and BG placement remain source questions; the state design deliberately exposes those decisions instead of turning them into hidden house rules.


## Implemented prerequisite: prepared special intents

The engine now exports `prepareSpecialKaramaIntent` and `executeSpecialKaramaIntent`. The intent union represents all eight implemented factions, with separate Emperor force/leader branches. It copies normalized selections, binds the original turn and phase plus relevant current battle/shipment/revival declaration, and contains no random Harkonnen hand selection. The executor re-prepares and compares the intent before consuming the exact physical card or applying effects. Existing public special actions still call preparation and execution synchronously.

Preparation includes public-dispatcher timing gates, with CHOAM's existing phase-opening/market/revival exceptions retained and all special activations blocked during unresolved Truthtrance. Feasibility clears Truthtrance only on its hypothetical future-state clone and retains binding battle promises. The executor mutates a disposable working Game; it is not independently transactional. Any future paused caller must restore its owned decision context, run on a clone, and publish only on success. Public `applyAction` remains the input-isolation boundary.

Ten regression cases in `tests/karama-intents.test.ts` cover all variants, serialization, preparation purity/no random draw, stale timing/custody/resources, copied CHOAM selection, exact declaration binding, deferred Harkonnen randomness, injected execution failure isolation, dispatcher parity and preserved CHOAM exceptions. The full 728-case unit suite and 33 persisted/database cases pass.

This prerequisite does not add a pending Kull frame, a phase restriction, or any counter-priority interpretation. The user has been asked whether to use a documented provisional policy (reserve the attempted card, allow a different Karama to counter Kull before its ban, intercept BG before conversion/discard) while CHOAM stays gated. No answer has been received at this checkpoint, so dependent timing implementation remains pending.
