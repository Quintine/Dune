# Forced Terror discard frame review

Read-only current-source audit, 7 September 2026. References are `game/engine.ts` unless otherwise stated; line numbers reflect the source read for this report. Read the full producer inventory in `docs/SEMUTA_DISCARD_CONTINUATIONS.md`. This proposal preserves current automatic behavior and selects no Semuta activation, reaction timing, or hand-capacity policy.

Implementation and final verification now appear in [TERROR_DISCARD_CONTINUATIONS.md](TERROR_DISCARD_CONTINUATIONS.md). The actual zero-valued No-Field regression records a one-marker arrival (amount 1), not a zero receipt amount. The runtime accepts nonnegative receipt counts; no claim is made that requiring positive receipt counts would reject that tested route.

## Actual producer boundaries

| Producer | Committed prefix | Fresh discard | Exact remaining work |
| --- | --- | --- | --- |
| Sabotage, `decideTerror`, lines 5226–5268 | Original arrival paid/placed before `openTerrorEntry` (4983–5033); Terror token revealed and permanently marked removed; reveal log; `shuffle(entrant.hand)[0]` samples the victim once. An Enemy of My Enemy refusal may have logged and recursively entered this same reveal branch (5189–5197). | If a card exists, remove that exact card from **entrant**, append it to discard, record one private receipt and generic Sabotage discard log. Moritani is the action actor, not the former owner. | If Moritani currently has a hand card, set entry stage `gift` and create its Moritani-owned decision; otherwise `finishTerrorEntry`. Never repeat random selection, reveal, alliance refusal, original shipment/move or their costs. |
| Robbery overflow, `decideTerror`, lines 5329–5338 | Terror token already removed. Prior `robbery` decision at 5299–5328 already selected card rather than spice, called `draw(g)` once, possibly refilled the deck, appended the card and logged the draw. Stage `discard` exists because Moritani's resulting hand exceeded its limit. | Remove the one owned card selected by this overflow decision, append it to discard, record one private receipt from **Moritani**, and the generic overflow-discard log. | Reopen `discard` only if current hand still exceeds the limit; otherwise finish entry. No second draw, refill, robbery choice, spice theft or token reveal. |

Sabotage with an empty victim hand creates no batch. Its optional gift can still exist if Moritani has cards. Robbery with no card left to draw creates no discard unless an already exceptional overflow actually requires cleanup; keep the existing behavior. Each explicit overflow selection is a separate one-card batch, not a retroactive batch of all previous hand reduction.

## Proposed typed continuation

Add one discriminant, with a small branch-specific payload:

```ts
{
  kind: 'terrorDiscard';
  source: 'sabotage' | 'robberyOverflow';
  owner: string; // seated Moritani
  entry: NonNullable<Game['pendingTerrorEntry']>;
  discardedHandSize: number; // former owner's size BEFORE this one discard
}
```

The existing `FreshDiscardBatch` already contains the exact selected card, former owner, turn/phase and stable sequence event. Do not duplicate the card as another custody object or store an RNG seed to reroll it. `discardedHandSize` supplies an explicit producer-stage check for an overflow receipt; it is an internal committed fact, not a public field. Its post-discard relationship can be checked while this automatic-only frame has no active reaction. Future reactions that intentionally change hands will need their own validated stage and must not silently reuse an unchanged-hand validator.

A new optional stable `pendingTerrorEntry.event` would improve binding across live stages; current entry type at 708–730 has no event. If introduced, create it when the arrival opportunity opens and preserve it through offer/reply/reveal/overflow/gift. Legacy no-event entries need a deliberate one-time allocation when committing the new frame, not a random event generated independently by each recovery worker. The global discard sequence already binds one committed discard, but token/turn alone is weaker parent identity than an explicit entry event.

At commitment, capture the consumed entry and selected card receipt, then clear `g.pendingTerrorEntry`; direct decision is already consumed by the decision dispatcher. Stage the frame only after the token and discard are coherent. Its suffix retires the frame first, restores the entry and only runs a dedicated remainder:

- Sabotage: conditionally reopen `gift`; otherwise finish.
- Robbery: conditionally reopen `discard`; otherwise finish.

Use an explicit `finishTerrorDiscard` or equivalent small helper. Do not call `decideTerror` with the old action: Sabotage's saved entry was at `offer`, which would attempt to reveal/remove the already removed token and randomize again. `finishTerrorEntry` (5034–5038) assumes a live entry, clears it, then calls `nextWormRide` only for `resume: 'wormRide'`.

## Receipt and saved-parent validation

Reuse existing discard-frame sequence retirement, exact physical card-face equality, uniqueness and outside-zone custody checks. Add:

1. Playing status, current entry turn/phase, exact batch turn/phase/event, nonempty batch with **exactly one** entry, and a recognized cause such as `terror:sabotage` / `terror:robberyOverflow`. All these receipts have `publicFace: false`.
2. `owner` identifies the seated Moritani; `entry.entrant` is seated and distinct from Moritani. Validate the recorded entry territory/sector, legal cause/resume values, and safe integer amount/elite with `0 <= elite <= amount` and positive arrival amount. The original actor need not equal the discarded player.
3. Exactly one matching physical Terror token exists, its actual kind matches source and its status is `removed` with null location. A placed token, another removed kind, or missing token cannot authorize a new draw/discard suffix. The stored territory is the entry receipt: the removed token itself no longer stores its former location (`revealTerror`, `game/moritani-terror.ts:154–176`).
4. Sabotage snapshot stage is the accepted `offer`; receipt former owner is entrant; pre-discard hand size is positive and matches current entrant hand plus one. Robbery snapshot stage is `discard`; former owner is Moritani; pre-discard size exceeds `handLimit(owner)` and matches current hand plus one. Do **not** require the post-discard hand still to exceed the limit: ordinary five-to-four is precisely a valid frame.
5. No concurrent live `pendingTerrorEntry`, direct response/decision, Truthtrance, paid Box, gift or Karama wrapper owns this consumed stage. No batch card remains in a hand, deck, cache, removed-card supply or escrow. An original victim card cannot be inserted again by restoring the old hand.
6. Validate the full entry receipt without rerunning entry legality or requiring its forces still to occupy the recorded sector. Existing legal intervening summoned-worm actions can change board presence while preserving the original Terror opportunity; it remains an already-committed arrival. Do not impose an unverified current-ally or current-force requirement in place of its historical receipt.

If the entry event is added, bind the saved original event rather than merely accepting a nonempty string. Retirement rejects an old frame reinserted into current sequence state. It does not claim to authenticate wholesale forged database history where an operator rewrites every matching receipt and counter.

## Interactions and projection

- The Sabotage gift at 5338–5357 is a transfer, **not a discard**. Keep the selected gift private and preserve the existing recipient hand-limit check and optional decline. The frame must not preselect a gift, transfer it, or emit another discard for it.
- Robbery's draw happens before overflow. The current hand temporarily may contain five cards. Do not introduce a general hand-limit assertion that rejects this already-supported state. Empty-deck refill randomness is already committed; save the current deck exactly.
- `finishActionContinuations` at 10613–10625 resolves an existing Robbery overflow once another legal effect has brought Moritani to its hand limit. In particular, resolved Truthtrance may discard itself and complete the Terror entry. Preserve this behavior; it creates no additional Robbery discard or repeated draw. Existing coverage: `tests/moritani-entry.test.ts:435` and `tests/moritani-entry-overlays.test.ts:108`.
- A worm-ride entry may have `summonedNexusBeforeRides`, a remaining `wormRides` queue, `nexus`, and `ready` state. These remain untouched by the discard prefix. `finishTerrorEntry` must resume `nextWormRide` exactly once so the deferred Nexus opens before the remaining ride or phase advance. `afterWorm` at 2952–2994 currently recognizes the live Terror entry when restoring a summoned context. Current pending-frame action fencing prevents a new summon during this automatic frame; future reaction nesting must explicitly account for a detached entry rather than assuming that top-level lookup still finds it.
- Existing `terrorEntry` projection (13820–13858) exposes entrant, location, cause and stage, but token kind details only to Moritani before reveal. Revealed removed token kind is publicly visible via `projectTerror`. Preserve that token visibility while keeping the fresh card face private from **all** unentitled seats, including Moritani for Sabotage. Neither random seed nor selected card ID belongs in public event/cause/log text.
- A detached entry can project as null during this automatically scheduled frame; `automaticContinuationPending: true` is enough to schedule recovery. Do not spread the stored continuation into the public view. Private hands should reveal only their usual owner's cards. Changing only the selected private face must not change an unentitled rival's projection.

## Bounded verification contract

1. Observe actual Sabotage reveal immediately after its one random discard. JSON reload and two production CAS recovery workers preserve exactly that victim, one reveal/discard log, removed token and original arrival resources. Test both gift and no-gift suffixes; zero victim cards creates no frame.
2. Observe actual full-hand Robbery draw, then one selected overflow discard. Persist only after the discard. Two workers neither redraw/refill nor steal spice; the selected original hand card or newly drawn card can be discarded. Post-discard four-card hand is accepted and finishes once.
3. Read each frame from entrant, Moritani and a third seat: public scheduling boolean true, hidden frame fields absent, unrelated hands hidden, private face absent from rival projections. Swap hidden identities while preserving public counts to confirm projection equivalence.
4. Corrupt source/token kind/status/owner/entrant/stage/count/event/physical custody; read, action and automatic normalization reject before SQL writes. Reinsert a retired frame and verify no repeat suffix.
5. Preserve genuine Truthtrance-resolves-overflow and summoned-Nexus-before-remaining-ride tests. Their continuation must occur once with unchanged draw count and original force movement; there must be no phantom extra discard event.

No production or test edits and no test execution were performed for this audit. These are concrete continuation requirements, not new rulings about Semuta's unresolved activation or hand-capacity behavior.
