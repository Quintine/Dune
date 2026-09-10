# Ixian Nexus Secret Ally: purchased-card replacement

Source audit: 2026-09-10. This is a source contract and proposed implementation boundary, not a runtime or expansion-completion claim. Existing [Nexus release gates](NEXUS_CARD_RUNTIME.md) remain in force.

## Primary evidence

- **Face:** [photograph of the twelve original GF9 Nexus Cards](https://boardgamegeek.com/image/7767032/dune-ecaz-and-moritani), independently inspected again at `/tmp/dune-nexus-cards.jpg`. The photographed publisher text is the authority, not commentary by its uploader.
- **E3:** [GF9 Ecaz & Moritani rules, pp.11,16](https://www.gf9games.com/dune/wp-content/uploads/EcazMoritani-Rulebook-LOWRES.pdf#page=11), indexed publisher text and the previously retrieved [publisher-authored mirror](https://gamers-hq.de/media/pdf/0f/7a/86/Dune_EcazMoritani_Rulebook_EN.pdf), `/tmp/dune-e3-nexus-rules.pdf` and `.txt`.
- **Base:** [GF9 base rules, pp.6,8,17](https://www.gf9games.com/dunegame/wp-content/uploads/Dune-Rulebook.pdf#page=6), freshly retrieved publisher-indexed setup, bidding and Harkonnen text.
- **E1:** [GF9 Ixian & Tleilaxu rules, p.9](https://www.gf9games.com/dunegame/wp-content/uploads/2020/09/IxianAndTleilaxuRulebook.pdf#page=9), freshly retrieved publisher-indexed alliance paragraph.
- **FAQ:** [GF9 November 2020 FAQ, pp.6–7](https://www.gf9games.com/dune/wp-content/uploads/2020/11/Dune-FAQ-Nov-2020.pdf#page=6), freshly retrieved publisher-indexed inspection and Karama rulings.
- **E2:** [GF9 CHOAM & Richese rules, pp.4,10–11](https://www.gf9games.com/dune/wp-content/uploads/2021/11/CHOAM-Rulebook-low-res.pdf#page=10), freshly retrieved publisher-indexed discard secrecy and purchase FAQ.

Direct official PDF retrieval returned 403. Several older temporary `.pdf` paths contain HTML error pages; they were not treated as readable PDFs. No tournament rewrite or community compilation supplies a ruling here.

## Printed operation

The face permits the holder, when Ixians are absent, to discard the Treachery Card just purchased during Bidding and then draw the top Treachery Deck card. This identifies one particular purchase, not an arbitrary held card. The replacement is optional, but playing it spends the Nexus Card. No spice refund, extra payment, free choice from the deck, or second replacement is printed. The panel has no Advanced-only qualification. [Face](https://boardgamegeek.com/image/7767032/dune-ecaz-and-moritani)

Common Nexus rules require an unallied holder; joining an alliance discards the held Nexus Card. Secret Ally applies when the represented faction is absent, distinct from native Cunning or Betrayal. The E3 FAQ contains no Ixian replacement clarification. [E3](https://www.gf9games.com/dune/wp-content/uploads/EcazMoritani-Rulebook-LOWRES.pdf#page=11)

The buyer takes the purchased card after payment. The native Ixian allied replacement explicitly occurs immediately after purchasing; November's FAQ permits viewing that purchased card before choosing. Applying the same inspection entitlement to this independently printed just-purchased replacement is ordinary composition, not a Nexus-specific FAQ. [Base p.8](https://www.gf9games.com/dunegame/wp-content/uploads/Dune-Rulebook.pdf#page=8), [E1 p.9](https://www.gf9games.com/dunegame/wp-content/uploads/2020/09/IxianAndTleilaxuRulebook.pdf#page=9), [FAQ p.6](https://www.gf9games.com/dune/wp-content/uploads/2020/11/Dune-FAQ-Nov-2020.pdf#page=6)

## Custody, deck and purchase consequences

- Discard first, then draw. A full but legal hand is supported: the discard opens the slot before replacement; neither transient overcapacity nor a full-hand exception is needed.
- Base setup requires discard reshuffling to replenish an exhausted Treachery Deck. Therefore an empty deck is not a reason to disallow this effect: its own preceding discard supplies a card. That physical identity can be drawn again. Do not exclude it or promise a different card.
- The already dealt auction row is distinct from the remaining deck. Draw the actual deck top, not the next unsold auction lot. Do not rebuild the auction pool.
- Harkonnen retains the bonus earned by the original purchase, subject to its ordinary hand cap and cancellation. Replacement is a draw, not another purchase, so it earns no second bonus. At seven cards before purchase, the purchase fills the eighth slot; a one-for-one replacement does not create bonus capacity.

These are compositions of the printed discard-then-draw operation with [base pp.6,8,17](https://www.gf9games.com/dunegame/wp-content/uploads/Dune-Rulebook.pdf#page=17). Preserve the original paid price and recipient exactly once; this card contains no reversal instruction.

An ordinary Karama acquisition is described by November's FAQ as purchasing without spice, so zero payment alone does not exclude a genuine Bidding purchase. Gifts, bonus draws, Ambassador draws, Nullentropy retrieval and Technology swaps are not purchases merely because they occur in Bidding. [FAQ p.7](https://www.gf9games.com/dune/wp-content/uploads/2020/11/Dune-FAQ-Nov-2020.pdf#page=7)

## Richese and cancellation: distinguish source scope

E2 explicitly excludes a direct Richese cache purchase from the **Ixian ally** replacement, while allowing Black Market purchases, including a Richese-family card. It also awards Harkonnen's normal bonus for both sale kinds. The restriction follows purchase origin, not card family. [E2 pp.10–11](https://www.gf9games.com/dune/wp-content/uploads/2021/11/CHOAM-Rulebook-low-res.pdf#page=10)

That question names an ally of Ixians. The later Nexus face independently grants the operation when Ixians are absent and does not name the native alliance advantage or repeat the cache exclusion. The literal independent-grant reading includes genuine cache purchases during Bidding. Extending the older exception to the new card is an alternative interpretation; no retrieved primary clarification selects it. Do not silently reuse an existing native `ixAllyCard` origin filter as though it settled this distinction. The same analysis matters for Richese's genuine special-Karama cache purchase during Bidding; its other timing and hand-cap boundaries remain in the [acquisition audit](RICHESE_ACQUISITION_RULES.md).

November's Karama table expressly permits stopping the native Ixian ally from discarding a purchased card. For this separately worded Nexus grant, Ixians are absent and the holder is not using a present faction's native or actual alliance advantage. Treating it as a direct card effect without that native cancellation window is the supported category composition used for Atreides Secret Ally; it is not an express general Nexus-immunity ruling. Unlike Bene Gesserit Secret Ally, this face does not say to use a named faction advantage. [FAQ p.7](https://www.gf9games.com/dune/wp-content/uploads/2020/11/Dune-FAQ-Nov-2020.pdf#page=7), [Face](https://boardgamegeek.com/image/7767032/dune-ecaz-and-moritani)

## Ordering and unresolved boundaries

**Harkonnen draw order:** the purchase earns its bonus, and Nexus applies to the just-purchased card. Neither inspected paragraph explicitly orders these two post-purchase draws. Choosing replacement after viewing the bonus can change the informed decision; bonus cancellation can also affect the deck. Preserve separate purchased, replacement and bonus identities and report the priority gap before selecting a fixed order. Owner-selected ordering is a possible implementation proposal, not a retrieved official ruling. The free bonus itself is never an eligible purchased target.

**Other immediate disposal effects:** use the ordinary physical-discard pipeline. Applicable Ecaz poison income and Semuta reactions must neither duplicate the discarded card nor cause a second replacement. Precise competing immediate-effect priority is not supplied by this Nexus face. Existing Semuta and occupation source gaps remain separate.

**Nullentropy and custody interruptions:** a paid Box search freezes the searched pile in the existing subsystem. The replacement cannot draw or reshuffle that pile while browsing. Conversely, playing or transferring the just-purchased card cannot leave a live replacement offer pointing at custody it no longer owns. Preserve or settle the exact purchase continuation; do not reopen an expired purchase from an arbitrary historical card ID. Whether a player can interleave a particular anytime power before exercising an immediate purchase right needs an explicit sequencing policy, not an invisible loss of the right. See the [Box audit](NULLENTROPY_BOX_ENGINE_AUDIT.md).

**Private opportunity timing:** a pause offered only to the holder may reveal possession of a specific secret Nexus identity. Reuse the project's existing unresolved private-response timing policy rather than inventing compulsory confirmations or claiming every buyer has an actual choice. No duplicate user question was sent by this audit.

## Proposed pure and engine contract

The following is an implementation design, not additional rule text. It deliberately keeps purchase eligibility separate from physical replacement so unresolved origin or ordering policy does not contaminate custody.

1. Create an immutable purchase receipt from the real completed acquisition: version, event, buyer, turn, phase, sale origin, sale event/lot, purchased physical ID, original paid amount and contribution/recipient evidence. Record the original Harkonnen-bonus entitlement separately. Never reconstruct the target from the last card in the current hand.
2. A pure replacement helper accepts an already authorized receipt, exact canonical hand/deck/discard, the exact purchased ID and a shuffle function. Reject duplicate physical custody and wrong target before RNG. Remove that held card, append its discard, recycle only if necessary, transfer exactly the top card, and return immutable resulting custody plus a private outcome receipt. If discard reactions suspend the operation, split disposal and draw with an independently bound pending stage.
3. The engine owns common Nexus eligibility, sale-origin policy, immediate opportunity lifetime, response/decision preservation, Nexus-card disposal, normal discard hooks, bonus ordering and payment continuation. A declined opportunity closes for that purchase without spending the Nexus card. An accepted play cannot reopen after receipt deletion, replay, a later purchase or JSON reload.
4. Bind latest progress independently of the detailed receipt. Historical outcomes must survive later transfers and deck recycling without requiring the old card to remain in discard. Signatures are consistency evidence, not cryptographic protection against arbitrary rewritten saves.
5. Project the purchased face and replacement result only to entitled owners. A public discarded identity does not authorize exporting replacement identity, deck order, private receipt signatures or old hand contents. Other seats may receive ordinary counts and a played-Nexus event. Do not grant Atreides automatic inspection of a card drawn outside its auction inspection opportunity.

Meaningful verification should include genuine ordinary and Karama purchases, both source-supported Richese origins once policy is settled, Harkonnen bonus/cancellation/cap sequencing, empty deck with same-card redraw, canonical expansion cards, poison discard hooks, reserved-card interruption, all-seat privacy, replay/stale rejection without mutation, JSON recovery and production SQLite races. This audit implements none of those paths and does not certify their integration.
