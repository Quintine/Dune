# Emperor Nexus: battle strength, purchase and revival

Primary-source audit, 10 September 2026, with bounded purchase/revival runtime amendments through 14 October. The source contract does not certify the full mode. The [common Nexus rules](NEXUS_CARD_RULES.md) and release gates remain; recommended compositions are not publisher clarification or separately answered numerical rulings.

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

Richese cache and Advanced Black Market use the recommended **seller-unpaid**
composition below. Original Richese Ambassador purchases now have their own
source-bound continuation; do not broaden a generic acquisition hook.

### Bounded bank-auction purchase prototype (27 September 2026)

The initial 27 September prototype admitted Basic/Advanced classic Nexus games.
The 14 October native cutover below now extends that public bank context. The
unallied holder can spend the physical card at a normal Bidding winner-payment
window. The full positive final bid must be affordable from the buyer's own
spice without ally contribution. The bank receives no spice; the winner keeps
that balance, receives the one purchased physical Treachery Card and continues
through normal auction follow-ups. One private signed receipt records the
original lot, final price and unchanged buyer balance across JSON/SQLite
recovery in the initial classic scope. Bank purchase remains distinct from
Richese seller/direct acquisition sources; no allied split is inferred.

Every winner in this bounded public auction context receives the same payment
confirmation, even without the card or Karama. Otherwise a pause only for the
concealed holder would disclose Nexus ownership. This is a **provisional
privacy-preserving product choice**, not a printed timing rule or a user ruling;
the recommendation is selected under the user's 14 October decision priority.
The normal spice and Karama payment choices remain available where legal.


### Original native bank-auction admission — 14 October 2026

The same printed purchase now applies in existing original native Nexus
roster/module envelopes: single/paired/mixed E1/E2 and standalone/paired/mixed
E3, including each canonical predicate's own Skills/Discovery/Homeworld/Tech/
Stronghold composition. This removes a prototype classic-only fence, not a
new operation, timing ruling or permission to create an unsupported packet.
No native Emperor may be seated; actual holder must be unallied, hold the full
positive price personally, and meet original source/hand-capacity rules.

Uniform public winner payment remains independent of concealed face. Original
normal bank lot, paid/Karama choices, one physical acquisition, Harkonnen bonus
and next-lot Atreides inspection continue; the bank receives nothing on Use.
Native Richese's ordinary pool is not its cache/Black Market; no seller income
or extra source is created. Existing bank receipt/event/signature stays unchanged.
The old classic predicate is explicitly retained/reused for prior admission
parity and strict **legacy physical revival** evidence. No legacy force replay
or native return-history broadening follows the new bank admission.

Affected16-file union217/217, types/lint/build and thirty-six actual native API
profiles pass. Every six expansion natives has Basic/Advanced Pay/Use and
Advanced Homeworld/Tech Pay/Use, preserving actual wallets/card/module inventory
and next-lot inspection. Four actual390px surfaces prove Richese5→5 and
Ecaz12→12 with original Homeworld/Tech unchanged, Basic Tleilaxu5→5, and
irrelevant-card CHOAM Pay14→12 with Guild Nexus retained. One original card,
actual Nexus cost and index0→1 remain; Atreides sees the actual next card.
No overflow/browser errors; no saved/deployed room touched. Full combinations,
assurance and publication/deployed gates remain.

Fixture-only assumptions requiring a response when nobody can cancel, or a
universal five-disc CHOAM roster excluding Auditor, are deleted rather than
re-pinned. Native automatic inspection/bonus remains original. QA now serves
the existing public asset root; this is not complete artwork acceptance.

### Recommended Richese seller-unpaid purchase — 14 October 2026

Original positive Richese cache acquisitions and other-buyer Advanced Black
Market sales offer each winning buyer the same Pay confirmation, independently of hidden Nexus
face. Only an actual unallied Emperor-card holder, with native Emperor absent
and the full price personally affordable, can retain that price. Basic cache
and legally offered self-cache are included. Already-held Black Market paid
retention supplies no acquisition/free-seller source, so its native price is
paid without inventing this confirmation or spending a Nexus. Allied funding
and ordinary bank-purchase admission remain unchanged.

**Provisional recommendation: the seller is unpaid.** The printed card tells
the buyer to keep spice and prints no bank reimbursement. Do not invent seller
income, bank subsidy, payer, refund or paid-income cancellation when no payment
occurred. This is conservative source composition selected under the user's
decision priority, not publisher clarification or a numerical user ruling.

Original Richese Betrayal completes first. Self-purchase forced discard leaves
no acquisition and no Emperor Nexus spend. A diverted/all-pass sold source then
offers original Pay or Nexus Use: diversion still records its bank destination,
but a retained-price purchase transfers no spice to it. Version-two signed
receipts bind original seller, source, round, lot, physical card, price and
unchanged buyer wallet without comparing historical snapshots to future hands.
Original source removal, hand limits, Harkonnen bonus and round successor run
once; Truthtrance's actual discard restores the same buyer decision.

Affected ten-file union108/108 and types/lint/build pass. Actual390px cache,
Black Market, self-cache and bank-diverted cache Use keep original wallets,
deliver one actual card and continue original native bonus/round controls.
No overflow/browser errors; no saved/deployed rooms touched. API proof and
phone receipts remain outside Git. The distinct Ambassador composition follows
below; full combinations, assurance and publication acceptance remain open.

### Recommended original Ambassador purchase — 14 October 2026

The [existing source classification](RICHESE_AMBASSADOR_RULES.md#classification-and-beneficiary-coverage)
treats the fixed-three Richese Ambassador draw as a purchase. The Emperor Nexus
purchase panel has no Bidding qualifier. Recommended provisional composition
therefore applies its retained-price benefit to this original purchase, without
creating an auction, seller reimbursement or income when no spice is paid.
Ecaz's trigger remains the optional commitment; there is no new beneficiary veto.

Every committed Richese effect in the supported public native-Ecaz Nexus envelope
now offers the beneficiary original Pay, regardless private card face, hand room
or funds. Only the actual unallied Emperor holder, with native Emperor absent,
three own spice, room and drawable stock, can Use. The original conditional
unavailable Pay still completes without payment/draw and keeps the token spent.
An allied beneficiary cannot Use. A legal removed BG-copy token uses the same
source proof; no new placement, copied effect or phase is invented.

Actual draw/recycling happens once at commit, not at offer. Version-three
receipts bind original entry, token, entrant, buyer, actual phase, card and
unchanged price. Live source uses original Ambassador phase/resume authority,
including separately source-bound Homeworld arrivals; historical evidence does
not demand future wallets/hands equal old snapshots. Malformed source throws;
private unavailability only disables Use. Original entrant control, physical
arrival, native bonus and movement/worm suffix remain original.

Affected13-file union111/111 and types/lint/build pass. Eight Basic/Advanced
shipment/worm API profiles prove Pay3 versus Use0 and native suffix without
another draw. Actual390px Basic Use11→11, Advanced Pay11→8, irrelevant-card Pay,
and Advanced phase-one worm Use11→11 deliver one original card, preserve native
arrival and resume real movement/spice controls without overflow/browser errors.
Native allied Harkonnen Pay draws the actual bonus once; its automatic response
does not manufacture a confirmation when nobody can cancel. Original forming
alliance disposal is retained. Full combination/assurance/deployed gates stay shut.

CHOAM's original closing market only sells to the bank or trades held cards;
it is not a missing direct purchase producer. Do not invent an Emperor Nexus
purchase there. Other real purchase sources retain their separate contracts.

### Recommended joint Richese special purchase — 14 October 2026

The [original special Karama source](RICHESE_ACQUISITION_RULES.md#1-advanced-special-karama-purchase)
explicitly purchases one secretly chosen cache card for three own spice.
The Emperor Nexus purchase panel has no Bidding qualifier. Recommended
provisional composition therefore lets the actual unallied Emperor holder,
with native Emperor absent, retain those three personally affordable,
uncommitted spice on this original Advanced Richese purchase.

This is an owner-initiated joint option, not a new public automatic pause.
The original held Karama and Emperor Nexus both spend at the actual purchase
commit, the native once-per-game flag sets once, and one exact unreserved cache
card enters Richese's hand. Original capacity/full-hand exchange, final-cache
exhaustion, enclosing controls and source phase remain. No bank payment,
reimbursement, Harkonnen ally bonus, Ixian replacement or fake auction is made.
Ordinary paid special purchase remains unchanged. No Nexus cost is committed
merely by projecting/preparing the option.

Normalized intent carries the exact original Nexus event through native
special-intent handling. Version-four receipts bind activation/acquired physical
IDs, actual phase, price and unchanged wallet without comparing later snapshots
to future hands. Joint flags/event/coercion and stale/foreign selections reject
before either cost. Native Kull with Richese is not an admitted original producer;
this cutover does not invent that profile or certify its combinations.

Affected13-file union112/112 and types/lint/build pass. Twelve original API
profiles cover phases2/4/5, Pay3/retain3, genuine full hand, final cache and their
intersection; depleted cache reaches ordinary Bidding without a compulsory
empty lot. Four actual390px surfaces prove retained5→5, full-hand4→4 at spice3,
final-cache1→0 at turn9 and ordinary paid5→2 with the irrelevant Nexus held.
Both actual costs, one acquired card and native once-use remain; no overflow/
browser errors. Easy's unchanged six-spice budget is met by one real seller
income, not fixture money or strategy changes. Broad combinations, assurance
and deployed/publication acceptance remain open; no saved/deployed rooms touched.

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
