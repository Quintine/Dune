# Nullentropy Box: paid search and engine continuation audit

Audit: 2026-09-06. This document proposes an implementation contract; it does not activate the card or certify complete Richese support. Read with [the acquisition audit](RICHESE_ACQUISITION_RULES.md). The user has already been asked about full-hand activation; that answer is pending and this audit does not ask again.

## Verified authority and remaining boundaries

The publisher's physical card face was independently read again from `/tmp/dune-rules/choam-box-reading.png`, enlarged from the photographed components linked by [the product gallery](https://www.tabletopfinder.eu/en/boardgame/32692/dune-choam-richese). The full photograph and provenance limits are recorded in the acquisition audit. It gives this sequence:

1. At any time, pay two spice explicitly to the Spice Bank.
2. Secretly search the Treachery discard pile and add one card other than a Nullentropy Box to the user's hand.
3. Shuffle the remaining discard pile and return it face up.
4. Discard the played Box on top.

[GF9 R2 p4](https://www.gf9games.com/dune/wp-content/uploads/2021/11/CHOAM-Rulebook-low-res.pdf) explicitly makes discard inspection private unless an effect authorizes it; fresh official indexed search returned that passage. R2 p11 directly forbids Box retrieving Box. The readable publisher-authored local copy is `/tmp/dune-rules/choam-lelekan-mirror.pdf` and `.txt`; its provenance/hash is in the acquisition audit. Bounded official-domain searches for Box plus full hand, Semuta and empty pile returned no additional ruling. The card photograph supplies the detailed sequence; do not attribute that whole sequence to the short p4 secrecy paragraph.

This is an ordinary card effect: no generic faction/alliance Karama cancellation, no recipient consent, no Emperor purchase income, Harkonnen bonus or Ixian purchase replacement. The bank is explicit, even with Emperor in the game. No bidding exclusion is printed on Box; Distrans's separate unresolved-bid guard is not transferable to this card.

Unresolved full-hand activation remains a development guard: adding the retrieved card precedes discarding Box in the literal sequence, and no retrieved authority resolves a temporary full hand. An empty pile or a pile containing only Boxes has no legal result. Reject before payment under an explicit unsupported-empty-search policy; there is no authorized deck fallback or printed permission to waste the fee deliberately. Exclude every Box, not only the activating physical ID. Variant/legacy extra Boxes require semantic Box exclusion as well as strict canonical activation validation.

A further boundary comes from an existing provisional engine policy, not the Box source. `executeSpecialKaramaIntent` for Guild may refund `g.karamaShipping.card` by taking that exact previously discarded Karama back into its original owner's hand. Box could first recover that same card. Pausing the pile during search does not resolve the later conflicting claim. Do not silently blacklist an otherwise legal non-Box search card as an official rule. Until the provisional refund policy is resolved, guard that particular pending-refund context before payment and label the reason accurately. No broader ban on Box during Shipment is justified.

## Proposed persisted contract

Use one authoritative pending search, not a public discard browser or generic Karama response:

```ts
pendingNullentropy?: {
  event: string;
  player: string;
  box: string;
  turn: number;
  phase: number;
  discardIds: string[];
  resume: {
    response: Game['response'];
    decision: Game['decision'];
    pendingKarama: Game['pendingKarama'];
    phaseOpening: Game['phaseOpening'];
  };
} | null;
```

`discardIds` is private internal custody/version evidence, never another physical card collection. Keep the cards physically in `g.discard` throughout the search; keep the played Box physically in its owner's hand and reserve it. Saved parent records are continuations, not alternative inventories. If a semantic normalized discard signature is preferred to IDs, validate canonical card identities before signing it. Do not trust client-submitted inventory snapshots.

- Begin: `{type:'card', card:boxId}`. Validate canonical owned Box, playing status, active Truthtrance answer-first priority, own uncommitted spice >=2, current capacity policy, eligible search existence, exact commitments and possible completion before any charge. Deduct two once; save the exact parent and private search evidence; replace the live decision with `{kind:'nullentropy', player}` and clear suspended response/pendingKarama/phaseOpening. Generate the event server-side. No selection or RNG shuffle yet.
- Select: `{type:'decision', event, card:selectedDiscardId}`. Require the search owner, matching event/turn/phase, unchanged Box custody, unchanged authorized discard inventory and an eligible exact physical card. Validate prospective completion before mutation. Remove precisely that card into the hand, shuffle the remaining discard once with server randomness, then remove/discard the played Box onto the array's top convention (currently `push`, so top is final element). Clear the search, restore the exact parent and run existing continuations. Do not charge, choose or shuffle on GET/reload.
- There is no additional confirm-after-selection or free cancel-after-inspection in the face. The paid search decision is a real private choice. A lost connection preserves it; owner authentication/recovery and voluntary autopilot control continue normally. A duplicate select uses room CAS/event/custody fences, never re-executes the effect.

The two mutations are separately durable: successful begin records payment and inspection authority; successful select records final custody and shuffled order. Invalid begin returns no paid view, no fee and no RNG draw. Invalid selection retains the already-paid search without a second fee. A malformed restored search must fail closed without revealing candidates or silently rebuilding a different search. Failures need an actionable recovery diagnosis; an arbitrary fee refund does not reverse already acquired private information.

## A real search lock is necessary

The owner has physically taken the discard pile to inspect it. Serializing this sub-action is a narrow custody lock, not a new ban on otherwise legal anytime cards. While it remains pending, allow only its bound selection and existing non-gameplay seat-control/recovery operations. In particular:

- The lock must be tested before `resolveTruthAction`, CHOAM's early special dispatch, Richese gift and synchronous Distrans branches. A generic decision lock later in `applyActionInner` misses these paths. Starting a fresh Truthtrance queue would also discard its activation and require another continuation stack. Preserve the earlier Truthtrance answer-first rule at begin rather than suspending an unanswered question.
- `normalizeAutomaticGame`, `settleAutomaticContinuations`, and ordinary post-action draining must stop before parent gameplay advances while a search is open. Do not rely only on the decision kind: the engine can have independent response, automatic phase and board-continuation work. Restore/drain only after selection.
- Central `discard` and `draw` should assert the custody lock as defense in depth, permitting only the explicit Box settlement path. This prevents future early branches from silently invalidating the search. An outer unchanged-pile/held-Box invariant gives another independent check. Trusted pure validators and hypothetical feasibility clones must not mutate the authoritative pile or run real shuffle.
- `setAutopilot` is intentionally handled before gameplay locks and must remain available. It must not charge, select, shuffle or discard. A bot may choose only from its authenticated owner projection and should perform one bound selection at normal server pacing.

Suspending a genuine response does not cancel it, erase its explicit passes, or convert the search into a new response. A recovered Karama may be available for the restored window, subject to its existing late-cancel rules. A resumed auto-allow window may now remain open because the search supplied a legal blocker; that is normal current-hand eligibility. No other player receives an eligibility snapshot from the search itself.

## Concrete current mutation paths to cover

In `game/engine.ts`:

| Path                                                                          | Risk during private search                                                                       | Required treatment                                                                                            |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| `draw`                                                                        | When deck is empty it shuffles all of `g.discard` into the deck and empties the pile.            | Prevent during search, including automatic callers. Selection never calls `draw`.                             |
| `discard`                                                                     | Ordinary card play, Karama, battle cleanup, CHOAM, Terror and Ambassador exchanges append cards. | Lock or reserve through the explicit settlement path.                                                         |
| Distrans early branch                                                         | Assigns both hands and appends its discarded activation directly, bypassing `discard`.           | Central pending-search lock before this branch; protect the played Box in transfer validation too.            |
| Guild special Karama                                                          | Directly splices its refundable shipping Karama out of discard.                                  | Lock while browsing; resolve the pre-existing future-refund claim before allowing search, as described above. |
| CHOAM cash-in / special                                                       | Early dispatch can discard many cards without the ordinary decision branch.                      | Lock before early dispatch; do not let a cash-in remove the reserved Box.                                     |
| Ixian replacement / technology, Harkonnen bonus, auction/setup dealing        | Draws may recycle the searched pile; accepted replacements also discard.                         | Preserve their parent state and prevent completion until search settles.                                      |
| Battle winner cards / Moritani retention / Terror discard / Ecaz Ixian effect | Finalizers append cards and then continue into other effects.                                    | Suspend the exact decision; do not replay or pre-finish its disposal.                                         |
| Public or private historical plan/sale snapshots                              | May still name a card now in discard, but are not physical custody.                              | Do not add snapshot copies to search, rewrite old plans, or make retrieved cards retroactively played.        |

`g.discard` currently stores physical cards; public `viewGame` does not expose an unrestricted discard array. `db/rooms.ts` stores current game JSON and projects authenticated views. Keep full search evidence out of the ordinary public view, error payloads and public action log. Existing action history in the browser or a player's memory cannot be revoked by later shuffling; the rule changes future pile order, not past knowledge. Do not retain the paid candidate list in a new global history or permanently visible inspector after settlement.

## Commitments and private projection

Reuse the shared `transferCardBlock` checks for the played Box: pending Richese gift, accepted Ix replacement in live/saved responses, unsold Black Market offer, committed battle/full-plan/prescience cards, retained loser cards and queued Truthtrance cards. The Box remains reserved until final discard, including through its own saved parent. A parent gift of a different card may resume normally; a gift of the Box itself cannot also activate it.

Validate the two-spice debit against existing spice reservations and the owner's Truthtrance promises before exposing any private search data. The current outer `reconcileBattlePromises` treats `type:'card'` as voluntary, but relying solely on post-begin validation is safe only if the failed action cannot emit a view first. `viewGame` must use pure validation; never call begin on a trial that returns a private pile as an availability probe.

The Box is eventually exchanged for one card, so the owner's final hand count is unchanged. This does not erase intermediate capacity policy or mandatory card obligations. Preserve Harkonnen forced-return counts and future incoming target slots, exact accepted Ix replacement identity, and committed Ambassador finishability. On selection use the explicit final hands for the existing commitment validators; avoid introducing a synthetic new acquisition that earns any purchase benefits. Pending paid auction commitments remain reserved and may constrain activation; this is resource accounting, not a blanket bidding-phase prohibition.

Suggested `GameView` projection:

```ts
nullentropy: null | {
  card: Card;                    // only its current owner sees this control
  blocked: string | null;       // generic pre-payment availability
  search: null | {
    event: string;
    cards: Card[];              // owner only, after persisted payment
  };
};
```

Others receive only the public pending decision owner and a generic paid-search event. They do not receive eligible identities, all-discard order, excluded Box identities, search signatures, selection identity or private card-dependent rejection details. Pre-payment controls must not accept a proposed discard ID, list names, count classes, or vary their reason based on an opponent's hidden card. The minimal empty/no-eligible availability boolean is the explicit conservative policy, not a grant to enumerate the discard. After payment, presenting eligible cards in a stable display order avoids unnecessarily exposing the old physical ordering; source authority already permits the owner to inspect the pile. End the projection entitlement when the search ends. The final Box discard can be announced publicly; the retrieved card remains private.

## Semuta and required verification

Semuta's printed reaction is to another player's discard. The relevant new event is the final Box discard; selecting a card from discard is not a new discard and shuffling is not a series of discard events. Future Semuta implementation must react to the completed Box disposal before advancing past any required immediate reaction, using one event-bound physical Box. It must not rerun the paid search or reclaim the selected card as though that card was discarded. Precise concurrent Semuta priority and full-hand timing remain outside the verified Box contract; do not claim an invented FAQ order.

Required focused cases: one fee/one shuffle/exact top Box; every non-Box family selectable; every Box excluded; empty/full/funding/commitment failures immutable before inspection; all viewers before/after payment and after expiry; queued Truthtrance and early CHOAM/Distrans blocked while browsing; parent response/decision/opening preserved; deck-empty bonus cannot recycle the pile during search; future Guild refund guard; promise-preserving fee; reserved gift/accepted Ix Box cannot activate; JSON reload and duplicate begin/select CAS; no-op authenticated GET and automatic workers; private AI selection on all profiles. No such runtime tests were executed for this document-only audit.

## Pure custody helper checkpoint

`game/nullentropy-box.ts` now provides permission-neutral candidate filtering and exact result custody. It excludes every Box by effect or name, validates a canonical held activation and unique physical IDs, requires the caller's remaining order to be an exact permutation, transfers the selected card and places the played Box last/top. Returned hands, pile and receipt are independent clones. Seven focused pure tests pass, covering limits4/5/8, alternate Box identities, malformed order/custody, JSON replay and conservation. This helper performs no payment, RNG, authorization, pending-state lock, projection or engine activation. Those are the next integration work; the full-hand guard remains explicitly unresolved.


## Runtime integration checkpoint — 2026-09-06

The proposed contract above is now integrated into the authoritative engine, private projections, player controls and all four AI profiles. Begin validates custody, commitments, funding and the explicit unresolved-context guards before charging two spice once. The paid event holds its exact discard evidence and interrupted continuation; only its owner receives candidate faces. One eligible candidate resolves automatically. Selection validates before shuffling, persists one committed remainder order, puts the played Box on top, and restores the interrupted context. Competing uncommitted CAS candidates may calculate separate shuffles; only one result commits.

Seventeen new named engine/review/AI tests and four production-persistence tests pass. The registered checkpoint passed 1,275 rules/client/component tests and 100 multiplayer tests; subsequent reference additions, presentation guidance and the extended Ixian portrait roster pass all 22 targeted cases. Type checking, lint and production build pass. These results do not certify complete Richese or combined expansion games. Seven other Richese card effects and the existing mode gates remain unfinished.

A real browser paid-search recovery check used synthetic room QPNV5XJJ. All 1,115 saved room versions and exact state hashes matched the backup after the controlled server restart and fresh invitation reconnect. The owner selected Maula Pistol at version21→22, retained eight spice without a second fee, recovered the selected physical card, and discarded the Box once on top. The exact interrupted Richese gift response resumed. All other 1,114 rooms remained unchanged; a subsequent reconnect preserved version22 and its exact saved state. Backup: `/tmp/dune-maintenance-20260906T1011/`; completed synthetic snapshot: `/tmp/dune-box-browser-complete-v22.json`. The hourly automation remains removed at the user's request.

The browser review also identified that viewport-based two-column search cards were cramped inside the desktop decision sidebar. Candidate layout now responds to its available container width, retaining one readable column in narrow sidebars and adding columns only where each card has room. The final reference/layout TypeScript and targeted lint checks pass.
