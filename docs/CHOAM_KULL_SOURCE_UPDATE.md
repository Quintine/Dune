# Kull Wahad: official-source update

Checked 2026-09-07 for classic GF9 Dune and CHOAM & Richese. This supplements [CHOAM_KULL_DESIGN.md](CHOAM_KULL_DESIGN.md) and the Kull section of [CHOAM_REMAINING_RULES.md](CHOAM_REMAINING_RULES.md). No runtime behavior changes in this audit.

## Result and provenance

No additional verified publisher or designer ruling was located that settles Kull counter priority, Bene Gesserit conversion timing, interrupted-card custody, or an unfunded winning overbid. This is a bounded retrieval result, not proof that no clarification exists.

The [CHOAM & Richese rulebook, printed p. 7](https://www.gf9games.com/dune/wp-content/uploads/2021/11/CHOAM-Rulebook-low-res.pdf#page=7) states:

> Prevent a player from playing a Karama card this phase as they attempt to do so.

The surrounding rule makes Kull a CHOAM Worthless-card special discard. Printed p. 12 separately permits Karama prevention of CHOAM's special-effect Worthless discard during that phase. Together these establish a reaction, a restriction on the attempting player, and a possible counter-interaction; they do not specify its sequence. Publisher-indexed text was retrieved again and agrees with the publisher-authored PDF mirrored locally at `/tmp/dune-rules/choam-lelekan-mirror.pdf` and its extracted text. The mirror is supplementary access, not a separate authority.

The [November 2020 FAQ, printed p. 7](https://www.gf9games.com/dune/wp-content/uploads/2020/11/Dune-FAQ-Nov-2020.pdf#page=7) remains the latest applicable general FAQ successfully verified in this search. It establishes ordinary one-use cancellation, cancellation of alliance abilities, and discard of a BG Worthless card when its Karama substitution is prevented. It also permits overbidding based on holding Karama, without requiring that card to be spent if another player wins. It predates CHOAM and does not discuss a held card made unplayable by Kull. Do not extend its ordinary cancellation duration over Kull's later, specific phase restriction.

The current [Future Pastimes Dune page](https://futurepastimes.com/dune-launch) offers a [FAQ download](https://bit.ly/DuneFAQ). Following that link on this date resolves specifically to GF9's **April 2020** FAQ URL, then to a general Battlefront Group page which returns a challenge. A current designer webpage therefore does not establish a current FAQ revision. It does not supersede November's later general rulings. The designer's [expansion overview](https://futurepastimes.com/dune-expansion-sets) and [CHOAM/Richese page](https://futurepastimes.com/dune-exp2-shop) supplied no additional Kull ruling.

Targeted official-domain and named-designer searches also surfaced a BGG discussion about whether Kull discards the interrupted Karama. Only its listing was accessible; no author-verified ruling was retrieved. Its title is not evidence of an answer. Tournament rules, fan compilations and rules from the distinct 2021 movie game were excluded.

## Implementable scope and remaining interpretation

| Area | Supported scope | Remaining material choice |
| --- | --- | --- |
| Trigger and expiry | React to an attempted Karama play; restrict that player for the current phase. The text does not ban ownership, transfers or a non-activation discard. | Applying the broad trigger to every ordinary and special activation is a strong textual inference, not a new enumerated FAQ ruling. |
| Counter priority | The expansion explicitly makes CHOAM's Worthless effect preventable. | Whether the original attempted card can be redirected against Kull; whether a different card can counter before the restriction applies; and priority for a third party. No retrieved source supplies this response order. |
| BG substitution and custody | Ordinary prevention of BG conversion discards the Worthless card. The [base rulebook, printed p. 14](https://www.gf9games.com/dunegame/wp-content/uploads/Dune-Rulebook.pdf#page=14) discards a Karama after play. | Neither establishes whether Kull interrupts before or after BG conversion, or orders discard of a printed Karama whose play is prevented. Retaining the latter as unplayed is a reasonable implementation inference; applying BG's ordinary cancellation discard automatically to Kull is not an explicit ruling. |
| Blocked overbids | Holding permission and actual Karama play are distinct in the FAQ. | Whether the permission persists after Kull, and how to settle a winning bid when Kull removes its only payment method. A bid cap, free award, forced alternative funding or auction restart would each add a policy absent from the retrieved Kull text. |
| Countered CHOAM discard | The expansion supplies a phase-scoped prevention provision. | How that restriction applies to another physical copy or a different Worthless effect is not clarified here. This is shared CHOAM behavior, not a newly discovered Kull-only blocker. |

The first three unresolved interaction clusters—counter sequence, BG/custody sequence, and unfunded-auction recovery—need an explicit interpretation if those outcomes are shipped before further primary clarification. The existing design's provisional sequence remains a proposal; this audit neither endorses it as official nor records new user approval.

These limits do not prevent implementation of validated intents, actor/phase restrictions, exact physical-card binding, safe continuation storage, private projections, or duplicate-action protection. Those are engineering responsibilities. They must preserve the selected rule interpretation without silently choosing a counter order or auction remedy. The older design's wider list of speculative edge cases is not evidence that every such case independently requires a user ruling.

Validation: reviewed both prior documents, publisher text and the local rulebook extract; repeated focused official searches; verified the designer FAQ redirect. No gameplay tests were run for this documentation-only update.
