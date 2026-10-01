# Nexus cards: primary-source contract

Original source audit, 10 September 2026, with dated bounded runtime follow-ups below. This document establishes the printed component inventory, source protocol and implementation boundaries; none lifts expansion release gates. The ordinary worm-triggered alliance Nexus already in the engine is distinct from this optional card module.

## Authority and acquisition

- [GF9 Ecaz & Moritani rulebook](https://www.gf9games.com/dune/wp-content/uploads/EcazMoritani-Rulebook-LOWRES.pdf), printed pp.4, 9, 11 and 16: component count, independent variants, common lifecycle, Atreides example and two Nexus FAQ answers. Official-domain indexed text was inspected, but direct retrieval returned 403 during this audit. The coordinator successfully fetched the [publisher-authored PDF mirror](https://gamers-hq.de/media/pdf/0f/7a/86/Dune_EcazMoritani_Rulebook_EN.pdf) to `/tmp/dune-e3-nexus-rules.pdf` and `.txt`. This is a mirror of the publisher's rules, not a separate rules authority.
- [Photograph of all twelve printed Nexus cards](https://boardgamegeek.com/image/7767032/dune-ecaz-and-moritani), uploaded by Jaakko / zaksalo on 2 October 2023. The original 3024×4032 photograph was downloaded and visually inspected, including all three panels on every card. The authority is the photographed publisher-authored component text, not the uploader's commentary. [Original image](https://cf.geekdo-images.com/zYJXVuckZugNx0kwjdcUAQ__original/img/pRh3dPJSueYj0aLYTbYidMxVXaQ=/0x0/filters:format(jpeg)/pic7767032.jpg); temporary inspection copy `/tmp/dune-nexus-cards.jpg`.
- Atreides' physical face independently matches the example on printed p.11. All twelve faces carry the 2022 Legendary notice and the E3 expansion mark. This is the original E3 module, not a later edition or fan revision.

Search also encountered tournament compilations that change the draw procedure and add effects. They were not used as authority. The former `dunecards.com` reference currently resolves to an unrelated collectibles storefront and is not a usable component source.

## Publisher's common rules

The module contains twelve cards and can accompany any faction selection, independently of the other variants. At the end of Spice Blow and Nexus, if a Nexus happened and an alliance exists, unallied players may draw, or replace their held card. Draws follow alliance negotiations. Cards stay secret until use and are discarded afterward; joining an alliance also requires discarding the held card. Exhaustion recycles shuffled discards. Drawing one's own faction allows an immediate optional replacement in Basic and Advanced.

Each card has mutually exclusive modes: **Cunning** for its native player, **Betrayal** when another player controls that faction, and **Secret Ally** when the faction is absent. The printed FAQ requires Bene Gesserit Secret Ally before Prescience; cards retained by Tleilaxu through Harkonnen Secret Ally are Face Dancers. [GF9, pp.4, 9, 11, 16](https://www.gf9games.com/dune/wp-content/uploads/EcazMoritani-Rulebook-LOWRES.pdf#page=11)

## Executable lifecycle composition

These are implementation consequences of the common rule, rather than additional quotations:

1. Keep a separate twelve-identity deck, discard and at-most-one held card per player. This is not a Treachery Card: no Treachery hand-limit slot, auction, ordinary discard hook, CHOAM sale, or Ecaz poison receipt follows from holding or discarding one.
2. Initialize only when this variant is selected. Include cards for absent factions; removing them would eliminate Secret Ally. No initial deal is prescribed. Use the twelve photographed factions exactly: Atreides, Bene Gesserit, Emperor, Fremen, Harkonnen, Spacing Guild, Ixians, Tleilaxu, CHOAM, Richese, Ecaz, Moritani.
3. Preserve a phase-level `nexusOccurred` fact separately from the transient negotiation flag. The explicit draw trigger is the end of the whole phase. Advanced blow A alone must not issue a draw, and blow B must not erase an earlier qualifying Nexus. Evaluate the final alliances when opening the opportunity.
4. A player with no card can draw or decline; one with a card can keep it or discard-and-replace. These are one opportunity, not repeated replacements. The printed own-faction redraw permission is implemented by a private preference selected **before** the draw: keep any card, redraw one's faction once, or redraw whenever one's faction appears. The server performs that policy atomically without a later confirmation. This automation prevents a public waiting state from identifying an own-faction draw. It is not an anytime exchange of a previously kept card, and it does not filter that faction out of the physical deck.
5. One event must survive the complete draw policy, reload and uncertain responses. Store the actual final card and physical intermediate discards before projecting the result. Randomness is not rerun when reading, normalizing, reconnecting or retrying the same committed action. Own-faction and other-faction draws complete the same public opportunity; no private redraw decision remains to reveal the drawn identity through public phase progress.
6. All actual alliance producers must discard both incoming partners' held cards as part of the accepted alliance transaction: ordinary Nexus, Ecaz Ambassador and Moritani's alliance offer. An offer, refusal or canceled formation does not discard. Leaving an alliance does not independently generate a draw.
7. Secret Ally selects the card's effect; it does not create a real allied player, change the stronghold victory target, unlock generic ally transfers or provide every ability of the absent faction.
8. Native roster identity determines the mode. A stolen leader, alliance benefit, Ghola or temporary battle controller does not change one's faction.
9. Public views may expose the module's inventory and readable reference for all twelve faces. Held identities, own-faction redraw eligibility and source deck order remain private. A public action list must not reveal which opponents hold a relevant Betrayal. Card play and its ensuing action need a saved original-effect commitment so a discarded card is not consumed twice.

The text does not specify a Nexus-dealing seat order. A deterministic storm-order serializer can be documented as implementation ordering under the game's general precedence convention, not attributed to a special Nexus instruction. It must not replace secret dealing with publicly revealed batches.

## All twelve printed effect contracts

Every row below is a semantic transcription of the photographed face, not a reproduction of its prose. Alternative effects within a panel consume the same single Nexus card. Timings below come from that panel; where a panel does not state an explicit phase, do not invent one from a similarly named faction ability.

| Card | Betrayal: opposing native faction seated | Cunning: native player | Secret Ally: faction absent |
| --- | --- | --- | --- |
| **Atreides** | Stop Atreides' attempt to inspect one battle-plan element. | Obtain a second element from the battle opponent. | In one's battle, choose one opposing plan element to inspect: leader, weapon, defense or dial. |
| **Bene Gesserit** | Stop Voice. | During one's Shipment and Movement action, convert any selected advisor groups to fighters; each territory must finish with a single stance. | Use Voice against one's battle opponent. The official FAQ places this before Prescience. |
| **Emperor** | During Bidding, require Emperor to cover the ally's purchase, at least the necessary spice; alternatively suppress Sardaukar while battle plans are being made. | Before making a battle plan, treat five own forces as Sardaukar when that battle contains none. | On a Treachery purchase, retain the spice after demonstrating the required funds; alternatively revive three extra forces free beyond the normal limit during Revival. |
| **Fremen** | Suppress worm riding for this turn, or suppress the two-territory movement advantage during Shipment and Movement. | A worm appearing in a territory without forces permits a group from one desert territory to ride elsewhere, respecting storm and occupancy. | Protect one's forces from a worm, or revive three forces free during Revival. |
| **Harkonnen** | Cancel a revealed Harkonnen traitor, shuffle that identity into the Traitor Deck, and give Harkonnen a replacement draw during Mentat Pause. | At any time, draw a Traitor Card into the hand, then choose one held Traitor Card to shuffle back. | During Mentat Pause draw two Traitor Cards, then choose two held cards to shuffle back. Tleilaxu's retained card is a Face Dancer under the official FAQ. |
| **Spacing Guild** | Take one entire shipment payment otherwise owed to Guild or bank, including one's own payment. The face expressly overrides income for occupying Junction. | Immediately after one's Shipment and Movement, make a second shipment. That group cannot move unless Hajr permits it. | Use Guild shipping prices; cross-shipping or returning to reserves is allowed as the shipping action. |
| **Ixians** | Prevent either the Bidding advantage or Technology advantage; one card cannot cancel both. | Before making one's battle plan, give every Suboid full unsupported strength in all battles for the remainder of this turn. | Discard a just-purchased Bidding Treachery Card and take the next Treachery deck card. |
| **Tleilaxu** | Cancel a revealed Face Dancer. It stays revealed until all Face Dancers have been revealed. | Set all revealed Face Dancers aside, secretly replace them, then shuffle the set-aside identities into the Traitor Deck. | During Revival, revive an own leader free and up to five forces at one spice each. |
| **CHOAM** | Make CHOAM discard a random held card without earning spice for that discard. | Spend any Treachery Card to obtain a selected Worthless special effect. | During Collection, trade a Worthless card for two spice; alternatively after winning a battle privately inspect a random opposing held card that was not used in that battle. |
| **Richese** | Stop a Richese self-purchase by discarding its intended Richese card without payment; alternatively divert payment for a Richese sale to the bank. | Combine two No-Fields in one shipment, still priced as one force; reveal one immediately and put it in front of the shield. | Replace normal shipping with a reserve shipment of up to five forces priced as one. |
| **Ecaz** | Before Shipment and Movement, where Ecaz and ally share a territory, make the ally return its forces from one such territory to reserves. | Take Duke Vidal for the current turn even from capture, Tanks or Ghola custody, overriding Moritani; set him aside at turn end. | Make one player disclose whether any of one's leaders are among their traitors, without identifying those leaders. |
| **Moritani** | Return a board Terror token to Moritani without revealing it. | When placing a Terror token, permit any Arrakis territory, including an existing Terror location. | After losing a battle with a winner, retain one played Treachery Card that could have been retained after winning. |

Source for the entire table: [the twelve original printed components](https://boardgamegeek.com/image/7767032/dune-ecaz-and-moritani). All card identities appear once; the photograph is arranged Moritani/Tleilaxu/Richese/Ixians, Atreides/Bene Gesserit/CHOAM/Emperor, Guild/Ecaz/Harkonnen/Fremen.

## Bounded Ixian Betrayal source protocol — 1 October 2026

**Both printed alternatives are connected in the fresh local `ixian-betrayal`
prototype:** prevent the native Ixian Bidding advantage, or prevent the native
Advanced Technology advantage. This is an original-attempt interception, not
just an inspectable catalog entry. Verification is **Partial**, with development
stage **Verified** for genuine native, private, recovery, CLI and phone proof;
it does not certify complete Ixian/Nexus play or deployment.
The [runtime contract](NEXUS_CARD_RUNTIME.md#bounded-ixian-betrayal-local-runtime--1-october-2026)
and internal `nexus-ixian-betrayal` topic describe the usable controls.

### Source order and authority

- **Face:** the [photographed publisher-authored Ixian Nexus face](https://boardgamegeek.com/image/7767032/dune-ecaz-and-moritani)
  grants either prevention alternative and expressly says one card cannot
  prevent both. The photograph, not uploader commentary, supplies this panel.
- **E3:** [Ecaz & Moritani rules, printed pp.11,16](https://www.gf9games.com/dune/wp-content/uploads/EcazMoritani-Rulebook-LOWRES.pdf#page=11)
  supply the separate physical Nexus inventory, unallied custody, opposing
  native faction mode, discard-on-use and qualifying closing-phase draw.
- **E1:** [Ixians & Tleilaxu rules, printed pp.8–9,12](https://www.gf9games.com/dunegame/wp-content/uploads/2020/09/IxianAndTleilaxuRulebook.pdf#page=8)
  supply native auction preparation, the extra inspection card and return,
  Advanced Technology before bidding and Atreides inspection, and native
  cancellation. The [existing auction audit](RICHESE_AUCTION_RULES.md#evidence-and-limits)
  records the retrieved publisher text and its limits.
- **FAQ:** [November 2020 FAQ, printed pp.6–7](https://www.gf9games.com/dune/wp-content/uploads/2020/11/Dune-FAQ-Nov-2020.pdf#page=6)
  distinguishes cancelable native Ixian advantages from other acquisition
  effects. **E2**, [CHOAM & Richese rules, printed pp.10–11](https://www.gf9games.com/dune/wp-content/uploads/2021/11/CHOAM-Rulebook-low-res.pdf#page=10),
  does not settle Technology's substituted cache/Black Market custody;
  its Ixian ally replacement answer is not a Technology prohibition.

The adopted user-owned `UNOFFICIAL_Revised_Dune_Rulebook_v.2.3_web.pdf` remains
the source for relevant Advanced core defaults, not this Nexus face. It supplies
no Ixian Nexus alternative, duration or response-priority ruling and is not
republished. Read the face with the native attempt's own source, rather than
borrowing another Nexus family's ban, response or cost.

### One current native attempt, one physical cost

Use requires the actual unallied non-Ixian holder of the singleton Ixian Nexus
while another seat is native Ixians. It discards that Nexus exactly once,
spending no Treachery Card, Karama, activation spice or force. Pass retains the
Nexus. The source fixes which alternative applies: the holder cannot choose
another attempt, draw count, hand card, lot, price or provider.

For **Bidding**, prevention takes the original native denied path before any
auction draw: draw exactly the normal allocated pool count, without the extra
inspection card, Ixian private inspection or return selector. All-pass takes
the original allowed path, including the real extra draw, private return and
normal auction continuation. Physical deck depletion remains the native
allocation's responsibility; this adapter does not manufacture cards.

For **Advanced Technology**, prevention occurs after the actual accepted native
declaration but before its swap or Atreides peek. Keep the selected Ixian hand
card and unseen lot in their original custody, preserve the declaration's
already-spent once-per-turn attempt, then resume the normal Atreides/auction
continuation once. All-pass performs the real declared exchange and its normal
continuation once. Declining the native Technology offer before declaration
still saves that option. Basic offers only the Bidding alternative.

Neither alternative undoes completed draws, selections, exchanges, peeks or
purchases, revokes other Ixian powers, or establishes a whole-phase ban.
Later legally available native attempts can create new events, including after
later physical Nexus recycling. General duration over other multiple-lot or
combined-module situations remains unresolved outside this current-attempt
profile; the word “advantage” is not an entire-phase ruling.

### Native counters first, then neutral acknowledgement

Resolve the existing native Karama window first, including its legal Advanced
Bene Gesserit substitution protocol. A successful native counter completes
the native denied transition once, with **no Nexus gate or Nexus cost**.
Only after all native counter passes, before draw/exchange/Atreides peek,
do publicly possible unallied non-Ixian seats with public held-Nexus presence
receive a uniform neutral acknowledgement. Irrelevant concealed faces also
receive Pass; only the canonical eligible owner's private view permits Use.
No publicly possible seat means immediate native allowance. All required
passes allow the original attempt once; accepted Use denies it once.

**Native-counter-first and uniform acknowledgement are explicit bounded
privacy/ordering inferences for this prototype, not publisher-prescribed
universal priority or resolution of other pending stacks.** No additional
Karama counter to the direct Nexus prevention is invented, and no blanket
Nexus-immunity rule follows. The native counter's cost and the independent
physical Nexus cost remain distinct.

The public event names only the original publicly announced kind and native
provider. It reveals no selected hand card, unseen lot, extra inspection
faces, deck order, private source receipt, rival Nexus identity or private
eligibility reason. Existing inspection of one's own actually held Nexus
remains authorized; a neutral prompt grants no new inspection entitlement.

## Bounded CHOAM Betrayal runtime

The unallied holder of the CHOAM Nexus card may use its Betrayal panel when CHOAM is seated and holds at least one Treachery Card. The printed panel names no phase, so the current prototype offers it at a clean playing boundary, not during another decision, response or automatic continuation. The server samples one card uniformly from CHOAM's actual hand; neither the holder nor the bot chooses its identity. The physical Nexus card and sampled Treachery Card are discarded once. CHOAM receives no spice, and this panel does not create an additional Karama reaction. The ordinary fresh-discard continuation handles any applicable discard consequence.

The private holder offer contains CHOAM's name; it includes the hand count only during Bidding, when the base rules make that count public. Outside Bidding neither the count nor empty-hand availability is passively exposed. An attempted use against an empty hand rejects without consuming the Nexus card; bots act only with the public Bidding count to avoid blind invalid actions. Other seats do not receive the offer, and the public action log does not name the sampled card. An integrity receipt records the original card ID, owner, target, turn, phase and pending discard stage; its deterministic signature is not a cryptographic authentication of a saved game. JSON restore finishes the already-committed discard once without drawing new randomness or repaying the cost. A later same-turn Nexus recycle may move the spent card from discard without invalidating the completed use. Basic and Advanced use the same bounded path. This is not certification of CHOAM Cunning, its second Secret Ally effect, any other Nexus panel or combined-module play.

## Effect integration boundaries

Later focused source contracts cover [Emperor strength, purchases and revival](NEXUS_EMPEROR_RULES.md), [Ixian purchased-card replacement](NEXUS_IXIAN_REPLACEMENT_RULES.md), [Fremen worm and revival effects](NEXUS_FREMEN_RULES.md), and [Richese's separate shipment and auction panels](NEXUS_RICHESE_RULES.md). These audits distinguish implemented work from remaining source/timing questions; current runtime evidence is tracked in [implementation status](IMPLEMENTATION_STATUS.md). Bounded Richese auction and Guild shipment Betrayal checkpoints have their own direct local verification below; neither inherits certification of its complete faction, Nexus family or live deployment from earlier evidence.

The [bounded Ixian Secret Ally replacement integration](NEXUS_IXIAN_REPLACEMENT_RULES.md#bounded-local-runtime-contract) now connects genuine normal paid and printed Karama-paid purchases in a fresh classic/base-deck/Nexus-only local profile. It replaces exactly the purchased physical card, keeps the original settlement once and permits full-hand and genuinely depleted-deck same-card redraw. Harkonnen buyers, cache/Black Market/special origins and combined modules remain guarded. Neutral buyer acknowledgement is an inferred development privacy convention, not publisher policy. Bounded native, private, authenticated recovery, CLI and phone verification is Partial; full-module and deployed acceptance remain open. The adopted unofficial Advanced core PDF contains no Nexus face and settles none of these pending Nexus boundaries.

**Atreides is the first complete effect family to implement.** It has independent rulebook and physical-face evidence, and the engine already has private plan-element inspection. The Nexus effect needs its own cause and receipt rather than temporarily changing the inspecting faction. The second element must differ from the already inspected element. Preserve the original disclosed value if an allowed later battle edit occurs; follow the existing plan commitment rules instead of refreshing an old observation. The card specifies an element, not the entire hand or battle plan. A weapon/defense request uses actual played-card classification, including the published Reinforcements/Harass exclusions, rather than leaking a card merely because it occupies that slot.

**Cancellation needs the original attempted effect.** Betrayal is not a blanket Karama flag. For Atreides, identify the inspection attempt being prevented; for Voice, the command; for a traitor/Face Dancer, the actual revealed identity; for economy, the original invoice and settlement. Do not refund or replay a completed payment merely because the next input happens to be a Nexus play. Effects with no printed phase still need a safe explicit action boundary and cannot bypass another player's committed private choice.

**Physical custody remains authoritative.** Replacement Traitor Cards, Face Dancers, discarded Treachery Cards, reserve groups and Duke Vidal are existing components. Draw first then return cards in the order stated; do not shuffle a just-set-aside Face Dancer early enough to redraw it as its own replacement. The Nexus card does not generate an additional Duke disc or additional physical Sardaukar. Virtual Sardaukar strength belongs to battle modifiers, not a change to elite counter custody. A canceled Harkonnen traitor owes a later replacement even after the original battle is finished.

**Delayed effects outlive card custody.** Turn-long Suboid strength, Fremen riding prevention, Harkonnen's Mentat replacement, Guild's extra shipment and Ecaz's temporary Duke claim need saved receipts. Discarding the Nexus card cannot erase those commitments, and drawing another cannot replay them. Moritani retention must join the existing winner/loser card-retention sequence without retaining mandatory-discard Tooth or Artillery merely because a weapon slot was used.

**Existing unresolved rules stay local.** Guild Betrayal's explicit Junction override is not a ruling for ordinary low-Junction contribution rounding. Moritani Betrayal's explicit return-to-supply instruction is not evidence that high-Grumman's differently worded removal returns a token. Free Nexus revival effects need source identity and original newly revived groups for Homeworld interactions; they are not ordinary free revival by default. Do not silently resolve the pending Southern Hemisphere threshold/splitting questions or Ix revival shortage question through a Nexus adapter.

## Remaining source questions and release boundaries

- The common trigger is the end of the full Spice Blow and Nexus phase. The later shorthand about the next Nexus is read with that opening condition; it does not establish an extra draw after each Advanced blow. Keep that implementation decision explicit in runtime documentation.
- No retrieved card or E3 FAQ gives a general rule that every Nexus effect is Karama-immune, or that playing one suspends all ordinary responses. Homeworld immunity on the preceding page is limited to Homeworld advantages/penalties. Audit cancellation of an underlying native advantage separately from cancellation of the Nexus card before enabling each family.
- Duration is explicit for several panels but not all. Ixian Betrayal's scope over multiple auction lots, the optional continuation after canceling native Prescience, and exact multi-party cancellation priority require the corresponding existing faction timing contract. Do not make an entire-phase cancellation merely from the word “advantage.”
- Emperor forced ally payment needs a precise invoice allocation when the ally has some funds and Emperor is short. Its own purchase-refund alternative also needs original payer contributions. Tleilaxu's combined leader/force revival requires an audit of partial selection and interaction with ordinary free rates; the card does not say that all five force revivals are free.
- Richese's two-No-Field effect has a bounded native Cunning shipment follow-up, but wider marker/module compositions remain separate. Its [bounded Betrayal auction contract](NEXUS_RICHESE_RULES.md#bounded-betrayal-auction-contract--30-september-2026) connects public self-cache veto and other-buyer sale diversion, not normal-deck hidden-family self-purchases or private special-Karama acquisition. Ecaz's Duke override needs explicit restoration/end-turn handling across capture, death and Ghola records. These are material implementation tasks, not reasons to invent substitute effects.
- A complete twelve-card reference/inventory and common lifecycle are substantial first work, but do not alone make all thirty-six panels playable. Keep the public module release gated until every face's supported timing, secrecy, custody, bots, UI, rejection, multiplayer CAS and saved continuation paths are verified. If development supports only Atreides' family first, other faces must remain accurately represented and explicitly unavailable in the audit mode; they must not silently act as blanks in a released module.

No user question was sent during this audit. No tournament rule, fan effect, public predeal reveal, extra Nexus identity or Discoveries prerequisite has been adopted.

## Moritani Secret Ally retention timing

27 September follow-up. The printed card permits retaining one otherwise
retainable played Treachery Card after losing a battle with a winner; mandatory
discards stay excluded. The connected prototype opens the same after-loss choice
for every loser in a Nexus game without Moritani **when a publicly revealed
played card is eligible**. With no eligible card the opportunity is impossible
from public information, so no prompt appears regardless of concealed custody.

An unallied holder can then spend the physical Moritani Nexus card to retain
one such played card; nonholders continue without retaining one. The loser’s
other played cards use the existing saved battle-discard continuation. This
uniform prompt is a privacy-preserving product interpretation, not printed
timing text. A holder-only pause would expose card custody; an earlier
precommitment would remove the printed after-loss choice. The sources do not
establish a generic Karama response to this borrowed Secret Ally effect, so
none is invented. The native Moritani alliance retention response remains a
separate power.

## Richese Betrayal prepayment protocol

The [printed Richese panel and bounded auction contract](NEXUS_RICHESE_RULES.md#bounded-betrayal-auction-contract--30-september-2026) distinguish two outcomes, not two costs. An unallied non-Richese holder spends the actual singleton Richese Nexus card while native Richese is seated. No Treachery slot/card or extra activation spice is spent.

The public-cache self-purchase alternative discards the exact intended card **before** payment/delivery: nobody pays and no purchase bonus is fabricated. The other-buyer cache or Black Market sale alternative changes only the original positive invoice's recipient from Richese to bank: the original price/contributions, delivery and earned Harkonnen consequence remain once. Passing keeps the Nexus card; all required passes settle the unchanged original purchase once. Neither alternative refunds a completed sale or replays a raw purchase Action.

To avoid identifying a secret card through timing, every unallied non-Richese seat with publicly held-Nexus presence acknowledges the same before-payment boundary. Required/pass membership derives from public roster/alliance/presence only. Only each privately eligible holder sees Use or its own blocked reason; irrelevant hidden identities do not change public event/auction fields. With no publicly possible responder, continuation is automatic. This is an **explicit application protocol**, not publisher timing authority or blanket Karama immunity.

The reaction projects only public target/buyer/source/price/event plus own pass/use eligibility. Existing public cache inspection does not entitle anyone to the concealed Black Market face or to the Richese-family identity of a normal hidden lot; claims and printed catalog faces are not custody disclosures. Normal-deck self-purchases, special-Karama veto, unsupported counter/any-time overlays and broader modules remain outside this connected boundary. The private receipt owns exact source, invoice and continuation; independent pending/completed cursor evidence must reject missing/orphaned frames before read or SQL rather than auto-settling.

The profile is explicit, fresh Basic/Advanced CHOAM/Richese plus classic seats, Nexus and the physical CHOAM deck only; it does not upgrade earlier games or open ordinary expansion starts. The dedicated internal `nexus-richese-betrayal` checklist records bounded engine, authenticated SQLite, bot, real controls and refreshed phone-browser evidence, with broader verification **Partial**. Shipment Cunning, ordinary auction, native special-Karama and a complete twelve-face catalog are not substitute verification. Full-family, combined-module and deployed acceptance remain open.

## Guild Betrayal funded-payment protocol

The [printed Guild face and bounded contract](NEXUS_GUILD_RULES.md#nexus-guild-betrayal) take one **full original positive shipment payment**, including the holder's own payment, and expressly override occupied Junction income. Use requires the actual singleton Guild Nexus held by an unallied non-Guild seat while native Guild is seated. The physical Nexus is the only activation cost: no Treachery slot/card or extra spice is spent.

Redirect the already quoted fee once, not reduced Guild income or an additional bank award. Preserve the original payer, own remainder and authorized donor escrow; `pledgeAid` has already debited the donor, so settlement consumes escrow rather than debiting it again. Own-payment use must be fully funded before the later refund. Zero/free, declined or stopped shipments create no fee to take and keep Nexus held. Native applicable stop/rate responses precede this bounded payment gate; no new universal priority or immunity follows.

The original `reserve`, `guildTransport`, `homeworld` or `junction` continuation preserves physical force/source/destination custody, tariff, shipment-used state and applicable native response/arrival suffixes once. Full occupied-Junction replacement suppresses the ordinary Guild/bank/occupier receipt for that invoice; it does not resolve ordinary contribution rounding or occupation entitlement/expiry. No extra shipment, movement, route or sponsor is granted.

All publicly possible unallied non-Guild held-Nexus seats acknowledge the same event and shipper, even with irrelevant hidden faces; only canonical private eligibility exposes Use or an own blocked reason. Pass keeps the card; all required passes settle the original payment unchanged once. Projection is exactly `{event, shipper, canPass, hasPassed, canUse, blocked}` and Pass/Use actions carry event only. Unlike the public auction fields in the Richese protocol, this gate adds no fee, source/family/world, destination, forces, donor, resources or saved-receipt disclosure. Neutral acknowledgement adds no secret-price/source log or new inspection entitlement. This is an application privacy protocol, not publisher-prescribed timing.

The fresh `guild-betrayal` profile is classic Basic/Advanced with native Guild, physical base decks and Nexus, optionally with genuinely seeded Homeworlds. Wider overlays and in-play retrofit are excluded. Typed producer/invoice ownership and independent pending/completed cursor evidence preserve authenticated restart and reject stale, foreign, malformed or orphaned continuations without a repeat payment, donor debit, force move or card spend. The dedicated internal `nexus-guild-betrayal` guide now records bounded local verification: 147 selected cases, 6,114 offline checks, build, actual backed-up CLI/phone actions and exact saved custody. Local HTTP 48/55 retains five 503s and two timeouts. Broad faction/module/full-game, calibrated AI, public-start and live-release gates remain closed; container publication and live deployment require separate current-revision evidence.

This profile admits original native shipment producers, not Guild Cunning's second shipment or Richese Secret Ally's discounted shipment: both offers are blocked before Nexus spending or a native parent is committed, while those effects outside this profile remain unchanged. Guild Secret Ally is unavailable under the existing native-Guild-seated mode test; no new printed-effect restriction is inferred.
