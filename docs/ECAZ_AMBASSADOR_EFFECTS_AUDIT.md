# Ecaz Ambassador effects: implementation audit

Audited 2026-09-06. This document changes no runtime. **Verified** means publisher text was retrieved; **composition** means an application of those rules to another existing rule; **policy/unresolved** means no decisive combined ruling was found. Existing source audits and reference strings were navigation aids, not authority.

## Primary sources and limits

- **E3:** [GF9 Ecaz & Moritani rules](https://www.gf9games.com/dune/wp-content/uploads/EcazMoritani-Rulebook-LOWRES.pdf), printed pp.7–8 effects, p.9 Duke, pp.14–15 FAQ, p.16 Karama. Official indexed pp.7, 8, 15 and 16 were retrieved in this pass. Direct PDF access returned 403. The existing publisher-authored `/tmp/dune-rules/ecaz-mirror.pdf` and `/tmp/dune-rules/ecaz-audit.txt` provide readable pages. Their mirror provenance is [Gamers HQ's publisher PDF](https://gamers-hq.de/media/pdf/0f/7a/86/Dune_EcazMoritani_Rulebook_EN.pdf). The known Occupy rounding discrepancy between copies does not change any Ambassador effect inspected here.
- **B:** [GF9 base rules](https://www.gf9games.com/dunegame/wp-content/uploads/Dune-Rulebook.pdf), pp.9–10 movement/revival, p.12 secrecy, p.14 Guild special Karama, p.17 Harkonnen acquisition, p.18 BG arrivals. Local publisher text: `/tmp/dune-rules/base.txt`.
- **E1:** [GF9 Ixians & Tleilaxu rules](https://www.gf9games.com/dunegame/wp-content/uploads/2020/09/IxianAndTleilaxuRulebook.pdf), p.6 technology income, p.7 Tleilaxu revival and physical Face Dancer cards. Official indexed p.7 was retrieved; local text `/tmp/dune-rules/ix-official-mirror.txt`.
- **F20:** [GF9 November 2020 FAQ](https://www.gf9games.com/dune/wp-content/uploads/2020/11/Dune-FAQ-Nov-2020.pdf), p.6 leader-revival clarifications. Retrieved indexed text. It predates E3 and is not an Ambassador FAQ.
- The [designer's expansion page](https://futurepastimes.com/dune-ecaz-moritani) still links the rules and Ecaz explanation video; its rules/FAQ shortlinks returned 403. No newly retrieved designer statement settles the combined issues below. The earlier recorded face-up-placement comment is not treated as newly verified here. No fan compilation or tournament amendment was used.

## Verified core, compactly

Ecaz optionally triggers on another faction's stronghold entry, excluding its ally, advisors and the matching faction. Ecaz can designate its ally beneficiary. Triggered tokens leave the map; Ecaz returns, BG is removed, other cohort members wait for five-member recycling. Destruction returns tokens to supply. [E3 pp.7–8](https://www.gf9games.com/dune/wp-content/uploads/EcazMoritani-Rulebook-LOWRES.pdf#page=7)

| Effect        | Verified operation                                                                                                               | Page |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------- | ---- |
| Ecaz          | Acquire eligible Vidal until battle use; alternatively consensual alliance if both unallied, with optional same-turn Vidal loan. | 7    |
| Atreides      | Inspect entrant's hand.                                                                                                          | 7    |
| Bene Gesserit | Copy outside-supply effect; permanently remove BG.                                                                               | 7    |
| CHOAM         | Discard chosen own cards; receive three bank spice each.                                                                         | 8    |
| Emperor       | Receive five bank spice.                                                                                                         | 8    |
| Fremen        | Relocate one board group; storm/occupancy restrictions remain.                                                                   | 8    |
| Harkonnen     | Inspect one random entrant Traitor Card.                                                                                         | 8    |
| Ixian         | Discard one own card, then draw replacement.                                                                                     | 8    |
| Richese       | Pay bank three; draw top card if hand has room.                                                                                  | 8    |
| Guild         | Send up to four reserves free outside storm.                                                                                     | 8    |
| Tleilaxu      | Revive one own leader or up to four forces free.                                                                                 | 8    |

The FAQ makes effects interrupt the entrant's remaining action and permits BG-copy Harkonnen inspection against Harkonnen. Karama's Ambassador row prevents placement for the turn. Duke revival remains Ecaz-only. [E3 pp.9,15–16](https://www.gf9games.com/dune/wp-content/uploads/EcazMoritani-Rulebook-LOWRES.pdf#page=15)

## Recommended command boundary

The following is an original software design, not additional printed rules. A command must identify one pending event, and the server must bind its actor to that stage. Do not derive the actor from `g.active`, because an Ambassador interrupts someone else's action.

```ts
type AmbassadorCommand =
  | { kind: 'trigger'; event: string; trigger: false }
  | { kind: 'trigger'; event: string; trigger: true; beneficiary: string }
  | { kind: 'copy'; event: string; effect: AmbassadorEffect }
  | { kind: 'ecaz'; event: string; choice: 'duke' | 'alliance' }
  | { kind: 'allianceReply'; event: string; accept: boolean }
  | { kind: 'loanDuke'; event: string; lend: boolean }
  | { kind: 'discard'; event: string; cards: string[] }
  | {
      kind: 'move';
      event: string;
      forces: Record<string, number>;
      elites: Record<string, number>;
      territory: string;
      sector: number;
    }
  | {
      kind: 'ship';
      event: string;
      amount: number;
      elite: number;
      territory: string;
      sector: number;
    }
  | { kind: 'revive'; event: string; leader: string }
  | { kind: 'revive'; event: string; amount: number; elite: number };
```

Inspection, fixed bank grants and already-authorized fixed-price purchases need no second Allow action. The trigger declaration can include a choice when no further private selection is necessary. Inspection results should persist as private knowledge; a dismissible inspector should not suspend the game solely to acknowledge seeing a card. Ecaz chooses whether to invoke and whom to benefit; the beneficiary supplies choices concerning its own cards, units or leaders. Entrant alone answers an alliance proposal.

Suggested persistent frame:

```ts
type AmbassadorFrame = {
  id: string;
  owner: string;
  entrant: string;
  beneficiary: string;
  token: string;
  originalEffect: AmbassadorEffect;
  effectiveEffect: AmbassadorEffect;
  cohortAtTrigger: string[];
  territory: string;
  sector: number;
  arrivalId: string;
  stage: 'offer' | 'copy' | 'effect' | 'allianceReply' | 'loan' | 'children';
  effectCommitted: boolean;
  tokenCommitted: boolean;
  continuation: EntryContinuation;
  // Inspection snapshots belong in recipient-indexed private state, not here publicly.
};
```

Separate token commitment from effect preparation and post-effect recycling. Mark a token as being resolved so a nested entry cannot trigger the same physical token twice; do not draw the next cohort until the full effect and its dependent responses settle. Retries, views, reconnects and invalid inputs must never consume RNG. Avoid using an unstructured callback as continuation state: a persisted typed frame must survive JSON serialization.

## Per-effect implementation contracts

| Effect    | Concrete implementation recommendation                                                                                                                                                                                                | Composition or remaining boundary                                                                                                                                                                                                                                                                                                                                                                |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Ecaz      | Use the shared Duke disc and explicit controller/loan state. Validate both alliance slots again on acceptance; bind the entrant, not an arbitrary target. Never clone Duke into another roster or create a traitor.                   | Reject dead/captured/ghola acquisition through this effect. Existing-ally benefit versus the specific newly-formed-alliance loan clause needs a documented policy; see below.                                                                                                                                                                                                                    |
| Atreides  | Snapshot every current physical card in entrant's hand at commitment; grant inspection only to beneficiary. Keep card identities out of logs, other views and action results.                                                         | This permits seeing, not transferring, discarding or permanently tracking future hand changes. Already-public cards may remain in the inspected hand.                                                                                                                                                                                                                                            |
| BG        | Freeze copy candidates from the triggering cohort, choose the effective effect, then run the same typed effect handler. Consume only BG; do not consume a copied token or mark that other token triggered.                            | Setup defines supply as Ecaz plus five random tokens. The past-tense wording strongly supports excluding those six original identities, even when some now occupy `placed`/`used` zones. Current `zone === 'supply'` filtering is unsuitable. This is textual composition, not a separate FAQ.                                                                                                   |
| CHOAM     | Distinct owned card IDs, revalidated at commit; discard all selected cards and pay once in one working-clone mutation. Empty array can represent zero chosen cards if zero-effect invocation is accepted.                             | Check pending pledges, battle promises, sealed selections and the Moritani retention reservation. Do not silently let a generic `discard` bypass existing binding-card constraints.                                                                                                                                                                                                              |
| Emperor   | Credit beneficiary once; issue one public successful-effect event.                                                                                                                                                                    | This is a bank grant, not charity, an Emperor auction payment, or a CHOAM charity expense.                                                                                                                                                                                                                                                                                                       |
| Fremen    | Reuse `forceGroup`/typed elite custody, with a source restricted to one territory. Prepare destination and applicable storm/occupancy validation; commit removal and placement together; generate a nested arrival.                   | An explicit remote-destination move supersedes ordinary adjacency. Whether a clear physical route is required through intervening blocked territory is not spelled out. Recommend treating this as relocation with source/destination storm checks, flagged as interpretation. Do not call ordinary `completeMove` unchanged: it increments `moved`, sets `shipped`, and clears Karama shipping. |
| Harkonnen | Construct the actual held physical Traitor Card pool, draw one ID server-side once, and persist recipient-only knowledge. Target does not select the card.                                                                            | Tleilaxu keeps Face Dancers in a separate engine field; do not accidentally inspect an empty `traitors` array. Printed Face Dancers are Traitor Cards (E1 p.7). Account for cards already revealed but still held, and exclude returned/replaced cards. Exact random eligibility of set-aside revealed cards should follow their actual physical custody.                                        |
| Ixian     | Require exactly one currently spendable owned card, discard, then draw; fail before mutation if no discard candidate. Deck refill must occur after the discard.                                                                       | Empty deck plus this new discard can legitimately replenish the draw pool under ordinary deck recycling; do not pre-test only `deck.length`. Replacement is not itself a purchase.                                                                                                                                                                                                               |
| Richese   | Revalidate recipient's current hand limit and three available spice, debit the bank payment and acquire one actual deck card atomically.                                                                                              | Do not route payment to Emperor merely because a card is acquired. Whether a Harkonnen beneficiary's paid draw counts as buying for its bonus, and whether an Ixian ally may replace it, need explicit acquisition classification; no Ambassador-specific answer was retrieved.                                                                                                                  |
| Guild     | Build a special reserve-entry order with zero payment and independent usage bookkeeping. Revalidate reserves/elites/sector/occupancy; prepare Guild prevention before successful arrival; settle BG and nested entry hooks afterward. | The p.15 example identifies this as shipping. Applying broad Guild off-planet prevention and BG shipping hooks is ordinary composition, not an Ambassador exception. Do not route through unchanged `commitShipment`, which consumes ordinary shipment usage and may overwrite an unrelated continuation.                                                                                        |
| Tleilaxu  | Separate special revival selection from normal paid revival quotes. Use an explicit maximum-four force intent or one eligible owned leader intent; track elite custody; credit reserves, not an arbitrary board destination.          | Four exceeds the base ordinary cap, so blindly calling normal `revive` is wrong. Further quota/leader-cycle and free-revival semantics require the policy decisions below. Never grant another faction revival of Duke.                                                                                                                                                                          |

## Entry, interruption and privacy composition

1. **Commit the original entry exactly once.** A failed movement, canceled off-planet shipment or merely placing an Ambassador is not an arrival. Keep `arrivalId`, entrant, destination, advisor status and cause. Reinforcement of an already occupied stronghold is still an entry; no first-occupation-only condition is printed. Same-territory sector transfers should not emit another territory-entry event.
2. **Keep explicit exclusions separate from power recipients.** Qualifying entrant checks compare against Ecaz and its current ally, then the physical marker's identity. BG copying applies matching immunity to the BG marker at entry, not to the subsequently selected effect. Benefiting an ally does not re-target inspection away from the original entrant or change the marker's faction.
3. **Resolve before the entrant's remaining ordinary work.** The FAQ's Guild example requires a real saved interruption before that entrant moves. Extra forces can change occupancy and therefore the legality of the resumed move. Resume by revalidation, not blindly replaying the original request or charging it again.
4. **Use a stack/queue of entry obligations.** Current `openTerrorEntry` rejects another pending Terror frame. `intrusion` writes `g.decision`; `completeMove` and `commitShipment` then create Terror obligations. Inserting Ambassador movement directly into these functions can clobber the original BG/Terror decision or encounter that singleton guard. A common entry scheduler should own both the parent and child frames.
5. **Apply storm checks before a legal effect, and destruction hooks when the map changes.** Map destruction must call the Ambassador return-to-supply operation, not the triggered-token disposal operation. If another reaction destroys a token before its offered effect commits, the continuation must explicitly resolve that invalidation rather than apply an effect from a missing token.
6. **Persist private knowledge separately.** A recipient-only inspection record can contain `{event, viewer, target, kind, cards}`. Public state needs only that inspection occurred. Preserve the same drawn Traitor after reconnect, but never expose the random index or candidate pool. Voluntary player communication of knowledge is distinct from broadcasting it automatically.

For BG advisors, normal source/destination stance rules still apply. The E3 FAQ explicitly preserves spiritual-advisor and Intrusion interactions even between Ecaz and its BG ally; an alliance shortcut must not suppress those hooks. An advisor's own arrival is excluded from Ambassador triggering, unlike Terror. Changing existing advisors to fighters is not a newly committed territorial entry by itself. [B p.18](https://www.gf9games.com/dunegame/wp-content/uploads/Dune-Rulebook.pdf#page=18)

## Material policy decisions; no new universal exceptions established

These are the remaining consequential combinations, not reasons to ask the user the same pending questions again. The implementation owner should retain a named policy and regression for any selected interpretation.

- **Simultaneous Terror/Ambassador/BG reactions:** E3 establishes interruption, but no retrieved passage totally orders competing entry effects. Order matters when Terror removes forces/cards, forms an alliance, or destroys the Ambassador, and when BG changes occupancy. Do not present the current engine's call order as a publisher ruling. A pending entry frame can store ordered remaining obligations and revalidate each after prior effects.
- **No-Field, Face Dancer, worm and moving mobile stronghold:** the p.14 explicit No-Field/Face Dancer FAQ is about Terror. It is not an Ambassador FAQ. Ordinary committed force movement is supported by the broad entry trigger; a zero-force No-Field placement and a moving stronghold carrying forces need cause-specific classification. Record the actual arrival type rather than globally equating all `place()` calls with entry.
- **Tleilaxu Ambassador revival accounting:** the effect supplies its own free amount/leader alternative, but does not expressly say whether prior normal revivals reduce it, whether it consumes subsequent ordinary quota/free allowance, whether dead-twice cycle prerequisites are waived, or whether the leader must satisfy normal revival eligibility. A Ghola card handler hardcodes a different force quantity and income classification and cannot settle those questions. Recruits doubles the current normal free rate; do not automatically double the Ambassador's printed four. Duke's Ecaz-only restriction is explicit; an ally benefit is not an exception.
- **Independent free revival versus blocked faction advantages:** E1's Tleilaxu payment sentence and technology token rules need their own event classification. `collectRevivalIncome(..., free=true)` currently awards at most once per faction/turn; `ghola=true` awards per use. An Ambassador is not a Ghola card, so choosing that boolean solely to obtain a payout invents a rule. `techIncome` is phase-scoped and once-per-turn; an Ambassador revival during Shipment and Movement must not manufacture Axlotl income outside its printed phase. La La La/free-revival prevention and the Tleilaxu special prevention must be checked by their own wording, not inherited from normal quote plumbing. No specific E3 combination answer was found. [E1 pp.6–7](https://www.gf9games.com/dunegame/wp-content/uploads/2020/09/IxianAndTleilaxuRulebook.pdf#page=6)
- **Ecaz effect assigned to an existing ally:** the general benefit-sharing sentence and the specific new-alliance Duke loan can be read differently for direct acquisition by an already allied faction. The existing same-turn-loan state must not be reused silently for every shared effect. New-alliance rejection/no-eligible-Duke, and an impossible effect invoked only to recycle a token, also require an explicit no-op consumption policy.
- **Post-trigger cancellation:** the p.16 entry is placement-specific. Do not add a compulsory generic `ecazAmbassadorEffect` Karama response for all eleven effects. A separately invoked native advantage, such as Harkonnen's additional card or BG's advisor, can still have its own existing cancellation window. Such child windows must return to the Ambassador continuation.

## Acceptance cases for a complete slice

- Each of the eleven handlers: Ecaz self benefit and a different allied beneficiary where meaningful; actor forgery, stale event ID, exact-once commitment and JSON restoration.
- Trigger/decline; same-faction marker immunity; BG copying that faction anyway; advisor exclusion; matching ally; reinforcement versus same-territory transfer.
- BG cohort members placed, used and returned by destruction all remain excluded from copy candidates; fifth-trigger BG removal cannot return BG to the pool or recycle before its copied child effect completes.
- Atreides inspects the whole current hand privately; Harkonnen samples once from the correct current physical pool, including a Tleilaxu target. Every other player's view/log lacks the revealed IDs.
- CHOAM zero/multiple/disallowed/duplicate card selection; Ixian empty hand and deck-refill-after-discard; Richese full hand, insufficient funds and selected Harkonnen/Ixian acquisition policy.
- Fremen one source territory with multiple sectors, mixed elite groups, stormed source/destination, distant destination, occupancy changed by a child effect; ordinary movement counters unchanged.
- Guild zero/one/four/insufficient reserve choices, separate ordinary shipment still available, Guild cancellation before arrival, BG follow-up, same-turn nested Terror/Ambassador entry, phase/turn preserved.
- Revival after earlier normal force/elite/leader revival, before a later normal revival, outside Revival phase, no available units, face-down leader, Duke owned by Ecaz versus ally, Recruits/free-block/prevention, and independently classified Tleilaxu/technology income.
- Placement cancellation does not remove already settled map tokens; destruction is not a trigger; no unchosen effect or hidden inspection triggers an automatic notice.

No runtime tests were run for this source-only task. Code anchors were inspected with `rg`/`sed`; primary text was compared at the printed page boundaries. Source availability and the named material decisions above remain limits on a claim of complete rules compliance.
