# Emperor Nexus: battle strength, purchase and revival

Primary-source audit, 10 September 2026, with a bounded purchase-runtime note added 27 September. The source contract does not certify the full mode. The [common Nexus rules](NEXUS_CARD_RULES.md) and current release gates remain in force; no new user ruling is assumed.

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

The selected implementation composition treats a Cunning declaration as the new advantage use: allowing it grants the temporary role; canceling it prevents that role entirely. Those ordinary counters consequently gain neither doubled strength nor Salusa's support exemption. This differs from canceling the strength of actual starred Sardaukar, whose physical identity survives that cancellation. Keep the new use and its response separate from the earlier native starred-force response; one Karama must not consume two independently declared uses.

Salusa high names Sardaukar, without limiting support relief to starred tokens. Applying that relief to counters currently counted as Sardaukar is supported composition. Salusa population still uses its physical native starred pool; Cunning cannot raise its threshold. Preserve the existing [mid-battle Salusa threshold guard](HOMEWORLD_BENEFITS_RULES.md). Occupation effects remain subject to their unresolved lifecycle. [Homeworld components](HOMEWORLD_COMPONENT_AUDIT.md)

## Secret Ally: retain the actual purchase price

Use the final ordinary purchase price and verify the holder's spendable spice before accepting this effect. The card expressly requires possession; it cannot support bidding beyond one's means like Karama. The holder is unallied and Emperor is absent, so there is no formal ally contribution or Emperor income in this purchase. Retain the holder's balance rather than subtracting and later refunding it. Ordinary card custody, hand limit and purchased-card follow-ups still need a real completed sale.

For an ordinary bank-paid auction, the practical result is one purchased card, unchanged buyer spice and a spent Nexus card. No bank-funded replacement payment is printed. The public proof need establish only that the price is held, not disclose excess private spice. These are implementation consequences of the component, not an extra auction rule.

Special seller payments require a separate ruling: if Richese or another faction would receive that price, is the seller unpaid or paid by the bank? The text only tells the buyer to keep spice. Likewise, it does not expressly decide purchases outside Bidding, such as a card acquisition from an Ambassador. Do not silently route income or broaden a generic purchase hook to those sources.

### Bounded bank-auction purchase prototype (27 September 2026)

In Basic/Advanced classic-faction Nexus-only games with Emperor absent, the
unallied holder can spend the physical card at a normal Bidding winner-payment
window. The full positive final bid must be affordable from the buyer's own
spice without ally contribution. The bank receives no spice; the winner keeps
that balance, receives the one purchased physical Treachery Card and continues
through normal auction follow-ups. One private signed receipt records the
original lot, final price and unchanged buyer balance across JSON/SQLite
recovery. No Richese/CHOAM seller payment, allied split, expansion, special
purchase or generic card-acquisition hook is inferred from this path.

Every winner in this bounded public auction context receives the same payment
confirmation, even without the card or Karama. Otherwise a pause only for the
concealed holder would disclose Nexus ownership. This is a **provisional
privacy-preserving product choice**, not a printed timing rule or a user ruling;
the previously asked confirmation-versus-gate question remains open.
The normal spice and Karama payment choices remain available where legal.

## Secret Ally: three additional free revivals

The express additional/beyond-limits wording supplies a separate force allowance rather than spending the holder's ordinary three-force quota. It revives forces, not a leader or Cheap Hero. Recruits doubles free rates and changes the normal limit; it does not double a fixed three-counter card grant. [Printed card](https://boardgamegeek.com/image/7767032/dune-ecaz-and-moritani), [E3, p.11](https://www.gf9games.com/dune/wp-content/uploads/EcazMoritani-Rulebook-LOWRES.pdf#page=11)

The FAQ retains the one-per-turn Sardaukar/Fedaykin revival cap even through Ghola, Emperor alliance extras and Tleilaxu. Applying that distinction here preserves the special-type cap while extending total quantity. Emperor is absent, so an eligible native holder cannot actually be reviving Emperor Sardaukar. Free Cyborgs trigger no paid-Cyborg Ix bonus. Southern Hemisphere deployment still applies to eligible returned Fedaykin through the existing [deployment contract](HOMEWORLD_REVIVAL_DEPLOYMENT_RULES.md). [November FAQ, p.2](https://www.gf9games.com/dune/wp-content/uploads/2020/11/Dune-FAQ-Nov-2020.pdf#page=2)

### Recommended independent extra return — 14 October 2026

The fixed extra-three declaration now enters original pending revival instead
of transferring counters directly. `nexusEmperorRevive` still selects exactly
three actual normal/starred counters and spends one physical Nexus. A signed
version-two source receipt is **requested** before any return, then **returned**
only at native physical settlement, or **denied** by original Tleilaxu prevention.
Strict old completed receipts remain historical evidence; no counters replay.

The visible provisional composition retains native Tleilaxu prevention and
once-only free-return income. Ordinary free-rate blocking, expanded limits,
higher free rates and Recruits do not reprice/double this independent fixed
grant. It consumes neither ordinary total/free ledgers nor native Emperor's
allied-extra ledger. No missing-native-Emperor payer, extra Karama response,
leader grant or refund is invented. Denial leaves Nexus and native Karama spent
without forces, payment, revival income or Axlotl activity. This is source
composition, not publisher clarification or a separately answered numerical ruling.

Existing native Nexus roster/module predicates supply revival admission
independently of unchanged bank-purchase guards. Original native Tleilaxu
Allow/Prevent and income, typed reserve deposit, Axlotl activity and Homeworld
return/deployment continue. Actual free Cyborgs retain uncapped native typed
eligibility but do not gain the paid-Cyborg bonus. Newly returned Fedaykin use
the original Southern Hemisphere placement. Tleilax still requires ordinary
Free Revival for its own deployment: a zero-cost extra source is not relabelled
normal. Current higher/low Homeworld pricing for later ordinary requests remains
native; a deposit may change that later rate without repricing this grant.

Genuine Basic/Advanced classic, native Tleilaxu and Ix histories use real setup,
paid shipments, native battles, later worm/pact/closing draw and Revival.
Fourteen actual API profiles include native Homeworld deposits and Basic/
Advanced Fedaykin placement, all continuing to Movement. The Fremen source uses
legal Sietch Tabr reinforcement and native zero-support plans; an initial
Arrakeen/out-of-range and paid-support assumption was corrected in the fixture,
never by relaxing the engine. Postbattle Collection is not falsely pinned as
only battle expenditure. Native Ix follow-on chooses an affordable original
return rather than minting spice.

Actual390px Tleilaxu Allow returns three (Tanks8→5/reserves10→13),
ordinary/free usage stays0, native free income1 and Axlotl1 accrue once.
Original ordinary three then costs2, leaves Tanks2/reserves16/ordinary3/free2,
and pays native Tleilaxu2 without repeating the bank/Tech bonus. Prevent spends
both physical cards, keeps original pools/wallets/Tech and commits denied.
The native owner's control explicitly labels the provisional extra source.
Actual390px newly returned Fedaykin placement moves only that star to Sietch
Tabr14, leaves normal/free ledgers0 and spice3, and resumes native income1.
No horizontal overflow or browser errors. Full combinations, source review,
private/recovery assurance and deployed acceptance remain open.
The frozen16-file union passes266/266; types/lint/build pass with existing
route-classification/chunk-size warnings. Proof receipts are outside Git.
Owned QA host/tab/scaffolding is removed; proof receipts remain outside Git.

The separate fresh classic `leader-skills --nexus-cards` composition additionally
admits the original extra-three return and normal bank purchase with all14
Skills but no Tech/Strongholds or other overlays. Exact-three/elite caps,
independent ordinary ledger and physical skill custody remain. Bank purchase
creates no actual bank payment or Banker award. Actual Cunning with normal or
selected trained Suk retains the original typed casualty receipt while rescue
is pending, completing only after physical settlement; its temporary Sardaukar
stay ordinary counters and original support is paid once. [Bounded scope and
evidence](NEXUS_CARD_RULES.md#classic-nexus-and-leader-skills-composition--4-october-2026)
remains separate from the connected independent return above and the original
compulsory funding below. Seller-paid Secret Ally purchase remains unfinished.


## Betrayal and remaining decisions

Normal Emperor-funded auction help goes to the ally and is paid back to Emperor, according to November's FAQ. Therefore forcing its contribution cannot automatically be implemented as transferring its spice to the bank. Bind the actual allied purchase and its original price/contributions. [November FAQ, p.2](https://www.gf9games.com/dune/wp-content/uploads/2020/11/Dune-FAQ-Nov-2020.pdf#page=2)

### Implemented battle alternative (bounded)

In an Advanced battle against a non-Fremen faction with actual Emperor Sardaukar,
the existing `eliteStrength` response now remains open for every seat when Nexus
cards are enabled, even if no player holds a canceling card. This prevents the
response's presence or duration from identifying a hidden Emperor Nexus holder.
An unallied non-Emperor holder may spend the card during that response, before
plans are submitted, to suppress the Emperor's Sardaukar strength for this
battle. The normal combat response quote rechecks legal plans and preserves
physical starred counters and their casualty custody. Seats without a card
explicitly pass; bots do so too. Truthtrance temporarily hides and blocks the
card reaction until its priority and question resolve. The spent card, battle
receipt, suppression and seat-private offer survive JSON and room restart;
replay cannot spend it twice. Karama remains an independent alternative in
the same window.

The normal-auction forced-purchase alternative is now connected below.
Secret Ally bank-auction purchase and Cunning retain their separate producers.
One unique Emperor Nexus cannot pay for two alternatives. The wider module
remains gated.

### Recommended original full-price funding — 14 October 2026

The original printed photograph was reread: force Emperor to pay for their
ally's Treachery Card during Bidding, **at least as much spice as necessary**.
The content-first conservative recommendation covers exactly the original full
positive normal-auction price, not merely the buyer's shortfall. Reuse matching
already-prepaid aid first; debit only missing credit from Emperor's own spice.
No arbitrary excess gift, bank-created subsidy, prospective-income borrowing,
new bid or refund is inferred. Fully prepaid or underfunded opportunities keep
the card and permit Pass. This is a visible provisional interpretation, not
publisher clarification or a separately answered numerical user ruling.

Before original winner payment/recovery, publicly possible unallied held-Nexus
rivals acknowledge in original storm order regardless of secret face. Current
neutral Continue retains all wallets/cards/bids; only the current actual Emperor
holder receives the private Use offer. Truthtrance and private Traitor returns
retain priority. Its original discard restores the same acknowledgement/event;
native Semuta continuation remains before that restoration if selected.

`game/nexus-emperor-payment.ts` binds the original physical lot/index, winner,
price, mutual alliance, declared funding, prepaid escrow, native wallet and
frozen public roster. Event-bound Use spends one physical Nexus, completes the
original full-price ally credit, and calls original `settleAuction`. The buyer
keeps their own spice and gets one original card. Native Emperor income still
opens its original allow/Karama window; cancellation does not refund the funded
purchase. All-pass restores original winner payment without changing the bid.
Completed history does not demand later wallets or holdings equal old snapshots.

Genuine four-seat Basic/Advanced setup/deal, original first turn, real turn-two
worm/Emperor–Guild alliance, physical closing draws and paid-price-two winning
bid produce the source. Fifteen pure boundaries and native runtime consumers
are included in the affected10-file union155/155. The original receipt whitelist
omission and premature discard fence were repaired; regressions now accept
native funding and restore the original Truthtrance suffix. Wording,
action-copy and fixture-provenance pins were deleted, not re-pinned.
Types/lint/build pass; four actual API profiles restore next-lot Atreides
inspection with allow/cancel and prior credit. Actual390px neutral Continue,
holder Use and native income allow/cancel preserve buyer6, reuse prepaid1,
add only missing1, give one card and spend one Nexus. Emperor10→9→8→10
when allowed, or stays8 when income is canceled. No overflow/browser errors.
Original paid purchase advances to lot1 once, without refund. Full combinations,
special seller lots, assurance and deployed acceptance remain separate.
Owned QA host/tab/scaffolding is removed; API and phone proofs remain outside Git.
The final build retains existing route-classification/chunk-size warnings.

The following material cases remain unresolved; no new question was sent:

- **Short groups:** may Cunning operate with fewer than five eligible ordinary counters, or Secret Ally revive fewer than three when Tanks/typed limits cannot supply three? Neither panel says up to. Do not disguise the question as a silently truncated count.
- **Wider forced payment:** the normal-auction prototype chooses the full original obligation and refuses missing own funding or an already fully prepaid price. Arbitrary larger transfers and special seller-lot composition remain unimplemented; the printed text is not claimed to answer them.
- **Special purchases and revival suppression/income:** resolve the concrete boundaries above before connecting broad existing payment/free-revival adapters.

The existing private reaction-policy question still covers other hidden Betrayal timing. This battle path uses a uniform native response rather than an identity-dependent private pause. A native holder and a Betrayal holder cannot possess the same unique Emperor card simultaneously, so do not manufacture Betrayal-versus-Cunning tests with duplicate physical copies.

Suggested first package: one-battle Cunning with five available normal counters, genuine no-Sardaukar eligibility, native cancellation, physical casualty mapping, current Salusa support and prior commitments. Verify ordinary victories, traitors, explosions, Fremen, later battles, JSON response recovery, corruption, all-seat privacy and all bot profiles before claiming that bounded package. No runtime or tests were changed by this audit.
