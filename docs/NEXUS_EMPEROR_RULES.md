# Emperor Nexus: battle strength, purchase and revival

Primary-source audit, 10 September 2026. This is a contract for future implementation, not a runtime-completion claim. The [common Nexus rules](NEXUS_CARD_RULES.md) and current release gates remain in force. No new user question was sent.

## Authority

- [Photograph of the original twelve GF9 Nexus cards](https://boardgamegeek.com/image/7767032/dune-ecaz-and-moritani), freshly reinspected at `/tmp/dune-nexus-cards.jpg`.
- [GF9 base rulebook, pp.13 and 19](https://www.gf9games.com/dunegame/wp-content/uploads/Dune-Rulebook.pdf#page=13), freshly retrieved publisher-indexed text: Advanced support, casualty allocation, Sardaukar and Emperor payments.
- [GF9 November FAQ, pp.2–3 and 7](https://www.gf9games.com/dune/wp-content/uploads/2020/11/Dune-FAQ-Nov-2020.pdf#page=2), freshly retrieved publisher-indexed text: special-force revival cap, ally payments, losses and Karama.
- [GF9 E3 rulebook, pp.9–11 and 16](https://www.gf9games.com/dune/wp-content/uploads/EcazMoritani-Rulebook-LOWRES.pdf#page=11), publisher-indexed text and the previously acquired publisher-authored [mirror](https://gamers-hq.de/media/pdf/0f/7a/86/Dune_EcazMoritani_Rulebook_EN.pdf): modes, Homeworlds, Recruits and FAQ.
- [GF9 E1, p.7](https://www.gf9games.com/dunegame/wp-content/uploads/2020/09/IxianAndTleilaxuRulebook.pdf#page=7) and [E2, p.7](https://www.gf9games.com/dune/wp-content/uploads/2021/11/CHOAM-Rulebook-low-res.pdf#page=7): free-revival income and La La La. The Salusa high face was visually reinspected in the component image at `/tmp/dune-card-economy-homeworlds.jpg`; provenance is retained in the [Homeworld component audit](HOMEWORLD_COMPONENT_AUDIT.md).

No Emperor-specific Nexus FAQ or authenticated designer clarification resolving the combinations below was retrieved. Tournament compilations and older Avalon Hill rules are not substituted for GF9 authority.

## The three printed panels

| Mode | Condition | Printed operation, paraphrased |
| --- | --- | --- |
| Cunning | Native Emperor holder | Before formulating its Battle Plan, count five of its forces as Sardaukar if it has no Sardaukar in that battle. |
| Secret Ally: purchase | Emperor absent | When buying a Treachery Card, keep the buyer's spice, after showing possession of the amount otherwise payable. |
| Secret Ally: revival | Emperor absent | During Revival, revive three additional forces free beyond revival limits. This is an alternative to the purchase effect. |
| Betrayal: purchase | Emperor controlled by another player | During Bidding, force Emperor to pay for its ally's Treachery Card, covering at least the necessary amount. |
| Betrayal: battle | Emperor controlled by another player | While Battle Plans are being made, prevent Emperor's Sardaukar advantage. This is an alternative to the purchase reaction. |

One card use buys one selected effect. The Cunning panel names five, without an up-to qualifier; its duration is this battle, unlike Ixian Cunning's express turn-wide duration. [Printed Emperor card](https://boardgamegeek.com/image/7767032/dune-ecaz-and-moritani)

## Cunning: effective roles over conserved physical forces

Native Sardaukar are an Advanced advantage. They have full strength two, except against Fremen where it is one. Ordinary Advanced support costs one spice per participating counter; unsupported counters contribute half their full strength. The winner may choose any losses consistent with dial and support. [Base, pp.13,19](https://www.gf9games.com/dunegame/wp-content/uploads/Dune-Rulebook.pdf#page=19)

Supported composition:

1. Require an owned native card, an owned current battle, no actual Sardaukar in its eligible battle army, and an unsubmitted plan. A Sardaukar whose advantage was canceled is still physically Sardaukar; cancellation does not satisfy the absence condition.
2. Treat five existing ordinary counters as effective Sardaukar for that battle. Do not create forces, transfer starred pieces, alter elite reserves/Tanks or mark these counters as starred on the board. Clear their temporary role after the battle.
3. Keep two accounting layers: effective normal/temporary-Sardaukar strength for plans and losses, and actual normal/starred custody for removal. Losing three temporary Sardaukar sends three ordinary counters to Tanks. Losing the battle or an explosion removes actual counters through the ordinary physical path.
4. Against non-Fremen, a temporary Sardaukar contributes two supported or one unsupported. Against Fremen it contributes one supported or one-half unsupported. Do not import Fremen's free support. Basic has no useful Sardaukar enhancement; enabling doubled Basic strength would invent an Advanced advantage. E3 explicitly acknowledges Advanced-only Cunning effects.
5. Bind the battle/event, original eligible normal pool and temporary count. Do not enlarge a Homeworld's eligible defense army, count unrelated reserves or confer the benefit on allied forces. Preserve prior Truthtrance/Prescience commitments; include an owned future activation in legal-completion searches without actually spending the card.

Karama can suppress Emperor's Sardaukar advantage before plan revelation. Cunning enhances that native advantage, so suppression applies to its temporary Sardaukar too; it does not destroy or move counters. The card supplies no general Karama immunity. [November FAQ, p.7](https://www.gf9games.com/dune/wp-content/uploads/2020/11/Dune-FAQ-Nov-2020.pdf#page=7)

Salusa high names Sardaukar, without limiting support relief to starred tokens. Applying that relief to counters currently counted as Sardaukar is supported composition. Salusa population still uses its physical native starred pool; Cunning cannot raise its threshold. Preserve the existing [mid-battle Salusa threshold guard](HOMEWORLD_BENEFITS_RULES.md). Occupation effects remain subject to their unresolved lifecycle. [Homeworld components](HOMEWORLD_COMPONENT_AUDIT.md)

## Secret Ally: retain the actual purchase price

Use the final ordinary purchase price and verify the holder's spendable spice before accepting this effect. The card expressly requires possession; it cannot support bidding beyond one's means like Karama. The holder is unallied and Emperor is absent, so there is no formal ally contribution or Emperor income in this purchase. Retain the holder's balance rather than subtracting and later refunding it. Ordinary card custody, hand limit and purchased-card follow-ups still need a real completed sale.

For an ordinary bank-paid auction, the practical result is one purchased card, unchanged buyer spice and a spent Nexus card. No bank-funded replacement payment is printed. The public proof need establish only that the price is held, not disclose excess private spice. These are implementation consequences of the component, not an extra auction rule.

Special seller payments require a separate ruling: if Richese or another faction would receive that price, is the seller unpaid or paid by the bank? The text only tells the buyer to keep spice. Likewise, it does not expressly decide purchases outside Bidding, such as a card acquisition from an Ambassador. Do not silently route income or broaden a generic purchase hook to those sources.

## Secret Ally: three additional free revivals

The express additional/beyond-limits wording supplies a separate force allowance rather than spending the holder's ordinary three-force quota. It revives forces, not a leader or Cheap Hero. Recruits doubles free rates and changes the normal limit; it does not double a fixed three-counter card grant. [Printed card](https://boardgamegeek.com/image/7767032/dune-ecaz-and-moritani), [E3, p.11](https://www.gf9games.com/dune/wp-content/uploads/EcazMoritani-Rulebook-LOWRES.pdf#page=11)

The FAQ retains the one-per-turn Sardaukar/Fedaykin revival cap even through Ghola, Emperor alliance extras and Tleilaxu. Applying that distinction here preserves the special-type cap while extending total quantity. Emperor is absent, so an eligible native holder cannot actually be reviving Emperor Sardaukar. Free Cyborgs trigger no paid-Cyborg Ix bonus. Southern Hemisphere deployment still applies to eligible returned Fedaykin through the existing [deployment contract](HOMEWORLD_REVIVAL_DEPLOYMENT_RULES.md). [November FAQ, p.2](https://www.gf9games.com/dune/wp-content/uploads/2020/11/Dune-FAQ-Nov-2020.pdf#page=2)

E1 pays Tleilaxu for factions using free revival or Ghola; E2's La La La prevents Free Revival during Revival. Their texts do not expressly distinguish this new Nexus return from the ordinary free-revival event. Preserve the already-pending [income accounting boundary](TLEILAXU_AMBASSADOR_RULES.md) rather than minting another payment or assuming immunity. No source gives this card a special exception to Tleilaxu's revival prohibition. [E1, p.7](https://www.gf9games.com/dunegame/wp-content/uploads/2020/09/IxianAndTleilaxuRulebook.pdf#page=7), [E2, p.7](https://www.gf9games.com/dune/wp-content/uploads/2021/11/CHOAM-Rulebook-low-res.pdf#page=7)

## Betrayal and remaining decisions

Normal Emperor-funded auction help goes to the ally and is paid back to Emperor, according to November's FAQ. Therefore forcing its contribution cannot automatically be implemented as transferring its spice to the bank. Bind the actual allied purchase and its original price/contributions. [November FAQ, p.2](https://www.gf9games.com/dune/wp-content/uploads/2020/11/Dune-FAQ-Nov-2020.pdf#page=2)

The following material cases remain unresolved; no new question was sent:

- **Short groups:** may Cunning operate with fewer than five eligible ordinary counters, or Secret Ally revive fewer than three when Tanks/typed limits cannot supply three? Neither panel says up to. Do not disguise the question as a silently truncated count.
- **Forced payment:** who chooses Emperor's compulsory contribution, what is the minimum when its ally already holds the full price, and what occurs if Emperor cannot cover the requested amount? The panel's necessary-amount wording does not settle the complete digital transaction.
- **Special purchases and revival suppression/income:** resolve the concrete boundaries above before connecting broad existing payment/free-revival adapters.

The existing private reaction-policy question already covers Betrayal timing; do not duplicate it. A native holder and a Betrayal holder cannot possess the same unique Emperor card simultaneously, so do not manufacture Betrayal-versus-Cunning tests with duplicate physical copies.

Suggested first package: one-battle Cunning with five available normal counters, genuine no-Sardaukar eligibility, native cancellation, physical casualty mapping, current Salusa support and prior commitments. Verify ordinary victories, traitors, explosions, Fremen, later battles, JSON response recovery, corruption, all-seat privacy and all bot profiles before claiming that bounded package. No runtime or tests were changed by this audit.
