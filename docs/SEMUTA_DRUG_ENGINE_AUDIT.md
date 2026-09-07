# Semuta Drug: discard interception audit

Audited 6 September 2026. This document originally proposed an implementation contract. The 7 September [discard continuation checkpoint](TREACHERY_DISCARD_CONTINUATIONS.md) now implements isolated claim rules and three saved exchange stages. Semuta activation remains unavailable and expansion starts remain gated.

## Printed effect and primary evidence

I visually reread the physical face at `/tmp/dune-rules/choam-semuta-reading.png`, from the [component photograph](https://cdn.anyfinder.eu/assets/QsUJtVktEC87xwK08oLlwnKyaozUWfuaLzG0LFEn67ENEEVgNrDGoITy3608Dqe7) recorded in `RICHESE_COMPONENTS.md`. Its publisher text is readable; photographer, upload date and full printing history remain unverified. The canonical identity is `richese-semuta-drug`, Special, one physical card.

Semuta takes **one Treachery Card immediately after another player discards it** and adds that card to its user's hand. When several cards are discarded together, its user chooses one. Semuta is discarded after use. There is no force or leader-disc target, poison attack, battle modifier, consent request, alliance requirement or spice payment. Cheap Hero is a Treachery card and can be recovered; an actual leader disc, Face Dancer, Traitor, Nexus card, Spice card, force or token cannot.

The [CHOAM/Richese rulebook p4](https://www.gf9games.com/dune/wp-content/uploads/2021/11/CHOAM-Rulebook-low-res.pdf) says the discard pile is private and cannot be searched without permission from an effect. Pages5–6 route discarded Richese-family cards to the ordinary Treachery discard. The publisher-authored mirror `/tmp/dune-rules/choam-lelekan-mirror.pdf` and `.txt` was read and fresh official indexed results corroborated these passages. Bounded official-domain Semuta searches found no Semuta-specific FAQ. The [base rules p8](https://www.gf9games.com/dunegame/wp-content/uploads/Dune-Rulebook.pdf) provide the general hand limit, but not Semuta's intermediate-capacity sequencing.

## Defensible gameplay contract

1. Any faction actually holding the canonical Semuta may use it. The other player whose card left hand is the **discarding owner**, even when a third player or a faction effect forced that discard. Do not confuse that owner with the request actor.
2. The target must belong to the fresh logical discard event. An older discard does not become eligible because it is still on top, visible in a log, reshuffled, or remembered. Taking a card later from a deck is not this effect.
3. A simultaneous group grants one selection across its eligible cards. If a group includes cards from the Semuta holder, exclude those cards. Do not invent one claim per discarded card or per other player in that batch.
4. Resolve the original discard's earned benefit and Semuta's transfer exactly once. Semuta does not undo a CHOAM sale, an activated Karama, a battle outcome or a spent movement card. A retained battle card is not yet discarded and cannot be claimed.
5. Move the selected exact physical card out of discard into the user's hand, then place the spent Semuta in the normal discard. Other cards retain their existing relative order. There is no purchase, Emperor income, Harkonnen bonus, Ixian purchase replacement or transfer fee from Semuta itself.
6. The claim is optional; taking no action consumes nothing. Once a player commits the card and privately inspects a previously unknown batch, selection must complete without a free cancel. A sole candidate can transfer immediately, with no extra acknowledgement.
7. Its printed effect has no phase restriction, including no Distrans-style ban during bidding. Support fresh discards wherever they occur; apply necessary atomic continuation/custody rules rather than declaring an entire phase unavailable.

There is no printed target exclusion for a freshly discarded Nullentropy Box, a used Tooth/Artillery, a Worthless card, Karama or any other Treachery family. The Box's prohibition on recovering a Box applies to **Box's own search**, not to Semuta. Recovering a used card does not retroactively keep it in the just-resolved battle or undo its original effect.

## Emit semantic discard batches, not an array diff

The current `discard(g,p,id)` pushes into `g.discard` and removes from hand, without event metadata. Several effects write the pile directly. Recording the last card after `applyAction` is insufficient: a following draw can already have shuffled it into the deck or someone else's hand. Conversely, all discards in one HTTP action are not necessarily simultaneous.

Suggested persisted record:

```ts
type DiscardBatch = {
  event: string;
  turn: number;
  phase: number;
  cause: string;
  entries: { card: Card; discardedBy: string; publicFace: boolean }[];
};
```

Use exact physical IDs and immutable face snapshots for validation. Snapshot is evidence, not a second physical copy. A committed claim also stores claimant, activating Semuta ID, selected ID when known, stage, and a discriminated engine continuation. Do not serialize function closures or restore a whole stale `Game` after intervening effects.

Every real discard producer should emit a batch after deciding all cards belonging to that simultaneous event. Park its continuation before the next operation that could draw, reshuffle, remove or reassign those cards. Revalidate the event, activation custody, selected card's actual discard custody, capacity and committed incoming slots before completing a claim. Exact retry/reload must neither discard Semuta twice nor award the original effect again.

| Current path                                                                | Needed boundary                                                                                                                                                                                                                                           |
| --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `discard`, `draw`                                                           | Central semantic batch support. A pending eligible fresh discard cannot be swept into a refill before the reaction is resolved. Empty-deck behavior needs a continuation, not an end-of-action observer.                                                  |
| `resolveBattle` and `canRetainBattleCard`                                   | Collect cards genuinely discarded together, retaining each former owner. Do not intercept cards reserved for Moritani retention. Snapshot battle identities before any hand transfer; never rerun deaths, KH, spice bounty or force losses after a claim. |
| Winner `battleDiscard` decision                                             | The selected subset is its own batch. It occurs after the winner chooses what to keep, not automatically together with every earlier losing-card discard.                                                                                                 |
| `finishMoritaniRetention`                                                   | Only actually discarded unkept cards create a later batch. The kept card is not a Semuta target. Resume remaining battle cleanup without repeating the ally benefit.                                                                                      |
| Sabotage and forced hand-limit discards                                     | Record the victim as discarder. Preserve the random selected face/event before presenting Semuta; retries must not reroll. Do not expose the rest of the victim's hand.                                                                                   |
| CHOAM sale, CHOAM special Karama, CHOAM Ambassador                          | Preserve earned spice. Group a single simultaneous selected-card discard, while distinguishing an activating Karama discarded as a separate earlier cost from the cards later discarded by its power.                                                     |
| Ixian ally replacement and Ix Ambassador                                    | Both currently discard and then `draw(g)` in the same control path. Stop before that draw/refill and resume once. Ixian Technology's hand/auction-pool substitution is an **exchange**, not a discard, so it does not trigger Semuta.                     |
| Distrans                                                                    | Direct `g.discard.push(result.discarded)` needs an event for the used Distrans only. Its secretly transferred card is not a discard or a Semuta target.                                                                                                   |
| Nullentropy Box completion                                                  | Its final newly played Box is a fresh discard. The shuffled old pile and the selected recovered card are not new discards. Preserve the paid search's selected result/order and resume the original interaction once.                                     |
| Ornithopter completion                                                      | The card comes from owned effect escrow, not the current hand. Tag its user as discarder when `finishOrnithopter` pushes it into discard. Movement is already earned/completed and must not replay.                                                       |
| Generic card use, Karama cancellation/conversion, phase-opening cards       | Add the correct event after the intended cost/effect boundary. Some current handlers discard before continuing a power; retain that continuation rather than lose the pending response or cancel the original card's effect.                              |
| Gifts, Black Market purchase, cache removal, hand exchanges, draw/reshuffle | Transfers, sales and removal from game are not discards. Do not infer a Semuta target from disappearance from a hand or from any newly appended array item in another zone.                                                                               |

## Hidden information and controls

No whole discard array, old discard history, opponent hand, leader pool or future deck order should be projected for this feature. Once Semuta's user is committed to a claim, authorize inspection of only the other-player cards in that batch. Already public played faces can remain public; a forced private discard must not be silently broadcast to every seat by a new event logger.

A conservative UI contract is a neutral fresh-discard opportunity, private held-card control, and a committed owner-only selection view. If the fresh faces were not already public, do not reveal them merely because a player secretly holds Semuta and can then decline. The effect permits selecting/taking a new discard; it does not grant repeatable free private inspection. This access design needs no new broad discard-search rule.

Example actions: begin `{type:'card',card:semutaId,event:discardEvent}`, then choose `{type:'decision',event:claimEvent,card:targetId}`. A direct one-step selection is safe when its permitted target was already disclosed. Show an enlarged inspector for the player's Semuta and any entitled candidate. Explicit decline closes only the current opportunity. After completion, the resulting hand is private under normal projections; old event faces must not become a permanent search tool.

Opportunity timing must not reveal Semuta's hidden owner by publicly opening a named window only when that owner holds it. Use the same neutral timing boundary for public configurations in which this card can exist; private pass state and automatic eligibility checks must not publish skipped players or their hand contents. Persist the boundary through room reload, worker continuation and AI pacing. A notification toast cannot replace the interaction window.

## Real unresolved boundaries versus implementation work

- **Full hand:** the face orders taking/adding the card before its final discard instruction, without explicitly stating a capacity exception. A completed exchange has no net hand growth, but the base maximum applies at all times. No retrieved Semuta FAQ resolves the intermediate state. Obtain a ruling before claiming full-hand activation; a pre-existing-space guard, if used, must be labeled an unresolved implementation boundary rather than printed card text. Do not borrow the [Harkonnen exchange FAQ's express capacity exception](https://www.gf9games.com/dune/wp-content/uploads/2020/11/Dune-FAQ-Nov-2020.pdf), which concerns a different power.
- **Provisional Guild shipping-Karama refund:** the current engine may recover a previously discarded shipping Karama when Guild stops that shipment. Claiming that physical card with Semuta would conflict with this provisional return. Resolve the underlying refund rule or fence that exact reserved target; no general prohibition on Semuta during Shipment and Movement follows.
- **Logical batches and nested continuations:** these are mainly engineering work, not grounds to invent a rule that only ordinary battle discards qualify. The card explicitly includes simultaneous discards. Classify each producer and implement its pause before later draws. If a particular effect's physical ordering is genuinely not specified, isolate that composition instead of disabling all reactions.

Ordinary targets, different-player ownership, one-card choice, no fee, immediate timing and no leader/force effect need no additional ruling. A second simultaneous physical Semuta is not a legal state in the verified singleton inventory. Future variants adding copies or other claim powers would require a separate conflict protocol; do not add speculative priority rules now.

## Focused validation and coverage

Pure tests: exact canonical activation; one fresh target from another owner; reject own/old/non-Treachery/duplicate/replayed IDs; simultaneous mixed-owner filtering; preserved pile order and conservation; caller immutability; fresh Box/Hero/Worthless/used weapon targets; no accidental second physical copy. Capacity tests must encode the selected explicit policy and reserved incoming slots.

Engine tests: single/multiple ordinary discards; forced Sabotage RNG once; battle loser, winner and Moritani cleanup boundaries; CHOAM benefit once; empty-deck Ix replacement paused before refill; paid Box completion and later resume; escrowed Ornithopter discard; Karama responses preserved; no target on exchange/gift/removal; stale/disconnected claim; private views identical outside authorized event information. Include Harkonnen compulsory incoming exchanges and auction commitments in capacity checks.

AI should use only entitled fresh faces, resolve a committed selection at every difficulty, and never get stuck on a sole candidate. Optional activation before unknown private faces should use ordinary budget/hand-space policy without hidden discard lookahead. Browser verification must show the actual fresh event, one-card choice, clear decline/commit distinction, readable inspection and refresh recovery.

Five facets remain partial: canonical card prose and this audit exist; the discard-event foundation, authoritative claims, player controls, AI and end-to-end verification are not implemented by this document. No full Semuta or expansion compliance claim is made.
