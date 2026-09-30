# Kull Wahad: official-source update

Checked 2026-09-07 for classic GF9 Dune and CHOAM & Richese; preview policy and source-aware Nexus cost boundary updated 30 September 2026. This supplements [CHOAM_KULL_DESIGN.md](CHOAM_KULL_DESIGN.md), [native CHOAM Cunning](NEXUS_CHOAM_RULES.md) and the Kull section of [CHOAM_REMAINING_RULES.md](CHOAM_REMAINING_RULES.md). The source audit itself did not change runtime behavior; later opt-in development implementations follow the explicit selections below. This update does not claim a newly fetched publisher ruling.

## User-selected preview timing — 30 September 2026

The user selected **Different Karama**: reserve the interrupted
physical card; a distinct eligible Karama may counter Kull before
the phase restriction takes effect. The interrupted card cannot
serve both the original attempt and its counter. They selected
**Before conversion** for Bene Gesserit's Worthless-as-Karama:
intercept while the card is still held; a successful Kull retains
the unplayed card. They selected **Defer interaction** for a winning
overbid made unpayable by loss of its only Karama payment. That
composition must remain guarded, not restart bidding, cap hidden
reaction-dependent bids, grant a free card or fabricate funding.

These are explicit provisional product interpretations, not a
publisher clarification. They supersede the older unanswered
counter/BG proposals below; full CHOAM starts remain gated.

## Source-aware Cunning composition — 30 September 2026

The [CHOAM Nexus face](NEXUS_CHOAM_RULES.md#authority-and-printed-scope) says **“Discard any Treachery Card to obtain a Worthless Card special effect of your choice.”** This is the source for allowing any actual Treachery fuel, not for inventing a nested priority. Kull's [printed CHOAM rule](https://www.gf9games.com/dune/wp-content/uploads/2021/11/CHOAM-Rulebook-low-res.pdf#page=7) supplies the attempted-Karama timing and phase restriction; [E3 p.11](https://www.gf9games.com/dune/wp-content/uploads/EcazMoritani-Rulebook-LOWRES.pdf#page=11) supplies native/unallied Nexus conditions and disposal of a played Nexus. None is presented as an official resolution of the counter/BG/overbid questions below.

The older `kull` profile stays printed-only without optional modules or Nexus. Only a fresh explicit `nexus-kull` profile adds this bounded interaction: two to six ready Basic/Advanced seats, native CHOAM and otherwise classic factions, exactly physical CHOAM/Ix Treachery decks and Nexus alone. Older games and other Nexus previews are not retrofitted; other expansion factions/modules, Semuta, Richese Betrayal, complete games and public/deployed release remain outside scope.

Every Use now names its source: `{ type: 'kullDecision', event, source: 'printed' | 'nexus', card }`. Decline is `{ type: 'kullDecision', event, decline: true }`. The private `kullReaction.plays` replaces `cards` and distinguishes real fuel from the effect. Printed source spends only a real held Kull on success. Nexus source requires actual unallied native CHOAM Nexus custody and uniquely held canonical Treachery fuel compatible with reservations and binding own promises. No omitted-source fallback or proactive generic Nexus Kull is admitted.

The **application transaction convention** is the existing Cunning one: accepted declaration spends the physical Nexus once immediately, retains fuel while the response is pending, and discards fuel once only if the effect succeeds. Prevention retains fuel but does not refund Nexus. This is distinct from the source-supported requirement to discard a played Nexus and is not attributed to a publisher Kull priority ruling.

The same **user-selected** distinct-counter, BG-before-conversion and deferred-overbid policies apply to both sources. The original stays reserved and cannot be its own counter; success retains its unplayed card/special once-use and stamps the activating player's turn/phase ban. Decline or prevention resumes the exact original once. The public offer is independent of Nexus identity and fuel eligibility; only CHOAM receives its private source choices. That neutral timing is application privacy policy, not publisher-prescribed acknowledgement.

New Nexus Kull is **verified locally within its boundary**, with broader verification **Partial**. Frozen types/lint/6,022 offline tests/build, authenticated SQLite ownership/races and actual Basic/Advanced CLI/runtime/phone Use, distinct prevention and refresh are recorded in the [runtime checkpoint](NEXUS_CHOAM_RUNTIME.md#bounded-nexus-kull-profile). Prior printed-Kull, five-effect Cunning and Richese evidence remains scoped. Local HTTP is 49/55 with four POST 503s and two timeouts; proxy-free CI/live deployment, wider cancellation scope, combined modules, unpayable-auction recovery and full-family acceptance remain separate.


## Result and provenance

No additional verified publisher or designer ruling was located that settles Kull counter priority, Bene Gesserit conversion timing, interrupted-card custody, or an unfunded winning overbid. This is a bounded retrieval result, not proof that no clarification exists.

The [CHOAM & Richese rulebook, printed p. 7](https://www.gf9games.com/dune/wp-content/uploads/2021/11/CHOAM-Rulebook-low-res.pdf#page=7) states:

> Prevent a player from playing a Karama card this phase as they attempt to do so.

The surrounding rule makes Kull a CHOAM Worthless-card special discard. Printed p. 12 separately permits Karama prevention of CHOAM's special-effect Worthless discard during that phase. Together these establish a reaction, a restriction on the attempting player, and a possible counter-interaction; they do not specify its sequence. Publisher-indexed text was retrieved again and agrees with the publisher-authored PDF mirrored locally at `/tmp/dune-rules/choam-lelekan-mirror.pdf` and its extracted text. The mirror is supplementary access, not a separate authority.

The [November 2020 FAQ, printed p. 7](https://www.gf9games.com/dune/wp-content/uploads/2020/11/Dune-FAQ-Nov-2020.pdf#page=7) remains the latest applicable general FAQ successfully verified in this search. It establishes ordinary one-use cancellation, cancellation of alliance abilities, and discard of a BG Worthless card when its Karama substitution is prevented. It also permits overbidding based on holding Karama, without requiring that card to be spent if another player wins. It predates CHOAM and does not discuss a held card made unplayable by Kull. Do not extend its ordinary cancellation duration over Kull's later, specific phase restriction.

The current [Future Pastimes Dune page](https://futurepastimes.com/dune-launch) offers a [FAQ download](https://bit.ly/DuneFAQ). Following that link on this date resolves specifically to GF9's **April 2020** FAQ URL, then to a general Battlefront Group page which returns a challenge. A current designer webpage therefore does not establish a current FAQ revision. It does not supersede November's later general rulings. The designer's [expansion overview](https://futurepastimes.com/dune-expansion-sets) and [CHOAM/Richese page](https://futurepastimes.com/dune-exp2-shop) supplied no additional Kull ruling.

Targeted official-domain and named-designer searches also surfaced a BGG discussion about whether Kull discards the interrupted Karama. Only its listing was accessible; no author-verified ruling was retrieved. Its title is not evidence of an answer. Tournament rules, fan compilations and rules from the distinct 2021 movie game were excluded.

## Implementable scope and remaining interpretation

| Area | Publisher-supported scope | Selected preview policy and remaining source limit |
| --- | --- | --- |
| Trigger and expiry | React to an attempted Karama play; restrict that player for the current phase. The text does not ban ownership, transfers or a non-activation discard. | Applying the broad trigger to ordinary and implemented special activations is a textual inference, not a new enumerated FAQ ruling. Restrict the card's activating player, not a shipment beneficiary. |
| Counter priority | The expansion explicitly makes CHOAM's Worthless effect preventable, but supplies no nested response order. | **Different Karama** is selected: reserve the original physical card; resolve an eligible distinct counter before the phase ban becomes active. The original cannot pay twice. Existing response ownership governs other eligible responders; this is product policy, not newly located publisher authority. |
| BG substitution and custody | Ordinary prevention of BG conversion discards the Worthless card. The [base rulebook, printed p. 14](https://www.gf9games.com/dunegame/wp-content/uploads/Dune-Rulebook.pdf#page=14) discards a Karama after play. | **Before conversion** is selected: successful Kull retains the still-unplayed printed Karama or BG Worthless card and leaves an attempted special once-use unspent. If Kull is declined or countered, the original attempt resumes, including the separate ordinary BG conversion/discard rules. |
| Blocked overbids | Holding permission and actual Karama play are distinct in the FAQ. | **Defer interaction** is selected for a winning overbid whose only Karama payment would become unplayable. Preflight the unsupported composition before costs or an unfinishable transaction. Do not restart the auction, award a free card, invent funding or add a hidden-Kull-dependent bid cap. |
| Countered CHOAM discard | The expansion supplies a phase-scoped prevention provision. | Preserve native prevention-of-discard semantics: retain the selected Kull cost and phase-block its effect. The wider official scope across different physical copies or Worthless names remains unclarified; the preview does not resolve it. |
| Nexus source cost | CHOAM's Cunning allows any Treachery Card for a selected Worthless effect; E3 requires native unallied use and disposal of a played Nexus. | The new explicit profile uses real fuel plus the physical CHOAM Nexus, spent at accepted declaration even if prevented; fuel remains held until success. This transaction boundary reuses existing application convention, not an official nested Kull ruling. The printed-only profile is unchanged in scope. |

The counter/BG choices are no longer unanswered user questions. They are approved preview policy with an unresolved **publisher-source** distinction. Unfunded-auction recovery was deliberately not selected. Full CHOAM, combined-module and publication acceptance therefore remain gated; an opt-in Kull preview is not official rules certification.

Validated intents, actor/phase restrictions, exact physical-card binding, safe continuation storage, private projections and duplicate-action protection must preserve that selected interpretation. A pending Kull declaration does not itself activate the phase restriction: only a successfully settled effect does. Decline or prevention resumes the reserved original intent once, not by replaying a public client action or restoring a whole Game snapshot.

An additional engineering admission boundary is the existing pure post-cost feasibility proof for ordinary cancellation under a live Truthtrance battle/shipment promise. An unprovable suffix is refused privately before the offer or cost, while proven supported cancellations remain available. This bounded preview exclusion does not establish a publisher prohibition or settle additional rule interpretation.

The runtime fence is before bid commitment, not only before payment:
non-CHOAM unfunded Karama-dependent bids are privately unavailable in
both explicit Kull profiles. The former late guard accepted such a bid and
then could not settle it. The fence is independent of hidden Kull,
does not change numeric UI bid limits or non-preview rules, and
does not select an auction recovery. CHOAM self-activation stays
outside interception and can use its ordinary Karama payment.
Kull costs also receive a cloned post-cost own-promise check; counters
are projected only when their same authoritative proof is available.


Historical source validation reviewed publisher text, prior documents and a local rulebook extract, repeated focused official searches and checked the designer FAQ redirect. That documentation-only update ran no gameplay tests. The 1 October runtime integration adds the separately recorded frozen checks, actual CLI/source/phone evidence and independent review repairs; it claims no fresh publisher priority clarification or full-mode/deployed acceptance.
