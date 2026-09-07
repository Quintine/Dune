# Moritani ally: retaining a battle card

Bounded source and implementation audit, 2026-09-06. No runtime edits or live-room actions were performed.

## Explicit effect and eligible outcomes

When Moritani’s ally loses a battle that has a winner, **the ally** may retain **one of its played Treachery cards**, provided it could have retained that card as the winner. This is optional, does not benefit Moritani itself, and does not retrieve arbitrary unplayed hand cards or the opponent’s cards. The paragraph is the ordinary Alliance ability, not the advanced Assassinate Leaders ability. [GF9 Ecaz & Moritani, printed p. 6](https://www.gf9games.com/dune/wp-content/uploads/EcazMoritani-Rulebook-LOWRES.pdf#page=6)

| Battle outcome                                                           | Retention opportunity                                                                                     |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| Ordinary loss, including an aggressor winning a tied strength total      | Yes, if the loser is Moritani’s ally and played an eligible card.                                         |
| Both leaders die to ordinary weapons but one side wins by force strength | Yes; leader death does not itself imply a mutual loss.                                                    |
| A single successful traitor call defeats Moritani’s ally                 | Yes. There is an actual winner; E3 supplies no traitor exclusion.                                         |
| Both sides successfully call traitors                                    | No winner, so no retention.                                                                               |
| Lasgun/Shield explosion actually resolves                                | No winner, so no retention.                                                                               |
| Lasgun and Shield appear, but a single traitor call wins first           | Treat the actual traitor result as having a winner; do not use raw card presence to disqualify retention. |

These distinctions compose E3’s winner condition with the base battle outcomes. The base rules give the single traitor caller the victory despite a revealed explosion, while double traitors destroy both sides. [GF9 base rulebook, printed p. 11](https://www.gf9games.com/dunegame/wp-content/uploads/Dune-Rulebook.pdf#page=11)

## Which played card may be retained?

Use exact physical card IDs committed in the loser’s resolved Battle Plan, filtered by the same **winner-retention rules** used for the actual winner. Ordinary weapons, defenses and played Worthless cards qualify. A leader disc is not a Treachery card. Cheap Hero/Heroine is always discarded. A Poison Tooth actually used cannot be retained; one merely played without use can be kept by a winner and therefore qualifies for the ally. [GF9 November 2020 FAQ, printed p. 8](https://www.gf9games.com/dune/wp-content/uploads/2020/11/Dune-FAQ-Nov-2020.pdf#page=8)

Do not admit a mandatory-discard card merely because the general winner rule allows keeping cards. Current runtime makes Artillery Strike mandatory-discard in a resolved ordinary battle, and used Poison Tooth likewise. The CHOAM expansion supplies revised versions of those cards, so their implemented card-version rules must remain authoritative for this filter. [GF9 CHOAM & Richese, printed p. 4](https://www.gf9games.com/dune/wp-content/uploads/2021/11/CHOAM-Rulebook-low-res.pdf#page=4)

The current winner cleanup suppresses Artillery/Tooth effect-discard when a traitor decides the battle, but still discards Cheap Hero. Reusing that predicate for the loser avoids contradictory card semantics. No retrieved Moritani-specific FAQ spells out the counterfactual Artillery/Tooth case after a traitor loss; retain this evidence limit rather than claiming a dedicated clarification or silently changing the ordinary card rules.

## Karama and timing limits

**Correction after verifying the November 2020 FAQ p. 7:** the publisher explicitly confirms that Karama can stop an alliance ability. Moritani’s card-retention power is therefore cancelable under a directly confirmed category, despite lacking an individual row in the E3 table. The earlier classification as merely a plausible generic cancellation was too weak and is superseded. [GF9 November 2020 FAQ, p. 7](https://www.gf9games.com/dune/wp-content/uploads/2020/11/Dune-FAQ-Nov-2020.pdf#page=7)

The FAQ does not specify Moritani retention’s exact declaration timing or whether cancellation precedes disclosure of the selected card. The current ally-selects-card → response → final-disposal sequence remains an implementation of the general power window, not a specialized timing ruling. Distinguish Moritani as the power owner from the defeated ally as the card-choice owner. Do not manufacture an extra Moritani approval requirement: the printed retention choice belongs to the ally. [GF9 E3, pp. 6, 16](https://www.gf9games.com/dune/wp-content/uploads/EcazMoritani-Rulebook-LOWRES.pdf)

Retention belongs to battle-card cleanup after the winner is known. There is no retrieved combined priority ruling against Harkonnen capture, CHOAM income, technology transfer or Face Dancers. Capture changes leader custody, not which Treachery cards were played; it does not independently suppress this ability. A narrow implementation can serialize the retention choice before those existing continuations, but should not claim that ordering as an explicit expansion FAQ. Preserve the resolved battle outcome through subsequent replacement effects rather than rerunning battle resolution.

## Required change to current cleanup

`resolveBattle` currently discards every loser card in its `used(p, plan)` loop, then sets `g.battle=null` and proceeds through casualty selection, winner card cleanup and `finishBattle`. Implementing retention by taking a card back from `g.discard` would lose exact custody and expose it to deck/recycling effects. Determine retention candidates **before** the discard loop. For a simple exact-custody implementation, reserve all of this loser’s played cards while the choice is pending; only the filtered eligible subset may be retained. Other players’ cleanup can remain on its existing continuation.

A narrow persistent record could be:

```ts
type PendingMoritaniRetention = {
  owner: string; // Moritani, the power owner
  player: string; // the defeated ally, who chooses
  winner: string;
  territory: string;
  turn: number;
  played: string[];
  eligible: string[];
  stage: 'response' | 'choose';
};
```

This is a proposed software contract, not printed rules. Keep the existing settled-battle continuation separately; no arbitrary stored Action is needed. Finish leader deaths, force/payment results and bounty once. On choose, require zero or one exact eligible card still in this hand; discard all remaining pending played cards once. On decline or canceled use, discard all. Resume the preexisting casualty/winner-card/postbattle chain without recalculating outcomes, random capture selection or payments.

**Reservation matters:** holding pending cards in the ally’s hand after clearing `g.battle` otherwise permits CHOAM cash-in or Bene Gesserit Worthless-as-Karama to spend cards still committed to cleanup. Shared reservation checks must cover these IDs through nested responses and JSON reloads. Public data can show the already-revealed played cards and which player must decide; it must not expose unrelated cards from the ally’s hand. Stale choices must fail without acquiring a replacement card or duplicating a discard.

## Focused validation suggested

Test an ordinary loser choosing either eligible card or none; reject an unplayed card, opposing card and two-card selection. Cover Cheap Hero, used/unused Tooth and Artillery under the actual winner predicate. Cover single/double traitors, actual explosion and traitor-preempted explosion. Verify Moritani itself gets no benefit, ownership belongs to the ally, and absent alliance gives no decision. Serialize before selection and through any Karama conversion; verify exact card conservation and no CHOAM/BG spending of reserved IDs. Resume Advanced casualty choice, Harkonnen capture and Face Dancer continuation without repeating payment, RNG or loss effects.

Official indexed E3, base and November 2020 FAQ passages were compared with the existing local publisher-authored extracts. Targeted primary-source searches found no dedicated retention FAQ. Search results from older editions, tournament variations and community discussions were not used to supply missing rules.

## Independent alternate-spending audit

Reviewed the proposed retention state against the current dispatcher. The reservation must start when the battle outcome is committed, covering the winner’s casualty/card-cleanup decisions as well as the later ally selection and Karama response. Checking only the currently visible `moritaniRetention` decision would leave earlier and nested windows exposed. The two currently reachable alternate spend paths are CHOAM’s special cash-in and `spendKarama` for Bene Gesserit Worthless conversion; both need the exact pending played-card reservation.

No additional currently reachable spender was found in the bounded review. Truthtrance only spends cards with its own special effect, which cannot be legal weapon/defense/hero commitments, and its overlay preserves pending state. Harkonnen’s exchange requires Bidding; Fremen, Emperor and Tleilaxu specials require other phases. Ixian movement needs phase 5 with no pending decision/response. Atreides special prescience needs an existing battle and its preparation offer. CHOAM’s Worthless effects reject the relevant decisions and response windows, and their implemented phase timings exclude Battle. Ordinary play/discard/exchange handlers run after the pending-state gates. Existing winner-card cleanup accepts only its own decision’s card IDs.

Private projection may expose the defeated player’s reserved IDs for client-side availability, or the already revealed played identities publicly, but must not include the rest of that player’s hand. A shared client helper must receive enough authorized reservation data to agree with the server. Truthtrance fact answers may still correctly regard reserved cards as in the hand; asking about a battle plan after `g.battle` has cleared is rejected. These findings describe current reachable paths and should be revisited when new phase-independent card effects are enabled.

## Integrated implementation checkpoint

The engine now implements this flow with `moritaniRetention` and the shared `canRetainBattleCard` predicate in `game/moritani-retention.ts`. Reservations begin before discards. Winner casualty/card cleanup completes first; `finishBattle` then offers the defeated ally its choice before CHOAM income, tech transfer, capture and Face Dancer continuations. The ally may decline without a response or declare one card; declaration opens the ordinary Karama window owned by Moritani. Final settlement checks exact custody, discards all other played IDs once and resumes the existing continuation. This chosen software serialization and generic Karama composition remain the interpretation described above, not a newly located dedicated FAQ.

`spendKarama` and `cashInCards` reject reserved cards, including during winner cleanup and nested Worthless conversion. The interface and bot response choices also honor the reservation. A public declared-card projection enables response-stage inspection without exposing unrelated hand contents. The linked internal reference and general battle-card guide now explain the exception.

Eighteen focused real-battle/server tests and five AI tests cover the integrated ability. The full suite reached935 passes;45 persisted multiplayer checks, TypeScript, lint and build passed. Independent review additionally exercised both nested Worthless cancellation and counter-cancellation through JSON reloads. Desktop browser QA completed declaration, response refresh and final exact-card settlement in S85SLVRR. Complete Moritani/expansion acceptance remains unfinished and faction starts remain gated.
