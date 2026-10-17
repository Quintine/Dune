# Bureaucrat payment redirection

14 September 2026. This connected development prototype extends the existing
Bureaucrat battle penalty with optional payment redirection. Leader Skills,
expansion combinations and public starts remain partially implemented. This is
not complete economic-rule acceptance.

## Source and payment identity

The physical card permits one use per phase when another player pays at least
five spice to a player other than the skill owner. Exactly two spice from that
payment go to the Bank if the owner elects to use the skill. The payer's cost
stays the same; the recipient receives two less. Declining leaves the opportunity
available for a later qualifying payment in the same phase.
[Physical card](https://cdn.anyfinder.eu/assets/NQOmfvkJitFsQncGJ73kLzv7aC1w7Jp1kQAyy5CJ0pOoj8RlSEN3veAO6wBnw8wV?height=768)

The designer names Emperor, Guild and Tleilaxu receipts as intended targets.
[Jack Reda, 15:01–15:28](https://www.youtube.com/watch?v=XT_azRVLq_0&t=901s)
A payment made by the owner, made to the owner, or made to the Bank fails the
printed third-party condition. Evaluate the actual amount paid rather than a
nominal price or free acquisition. Use the native living face-up assignment;
a captured card supplies only its battle band.
[GF9 CHOAM & Richese, pp. 9 and 12](https://www.gf9games.com/dune/wp-content/uploads/2021/11/CHOAM-Rulebook-low-res.pdf)

Actual bribe transfers qualify: the official FAQs describe spice paid as bribes
being placed before the recipient's shield. Spendability waits until the next
Mentat Pause, but the payment occurs when those counters transfer. Bureaucrat
therefore diverts two from the transfer and leaves the remainder in bribe escrow.
Collecting that escrow later is not another payment and must not trigger again.
A verbal promise alone transfers no spice.
[April FAQ, p. 1](https://www.gf9games.com/dune/wp-content/uploads/2020/04/Dune-FAQ.pdf#page=1),
[November FAQ, p. 9](https://www.gf9games.com/dune/wp-content/uploads/2020/11/Dune-FAQ-Nov-2020.pdf#page=9)

## Connected boundary and explicit interpretations

The connected sources are ordinary paid auctions, native Emperor/Guild and
Richese seller receipts, actual bribe transfers and the original paid Tleilaxu
revival price in admitted Leader Skills compositions. A separate free-revival
award is not part of that price. Registered all14 setups use the same receipt
capability for single and allied payers; optional-module and Advanced role
admission remains separate. Emperor gifts are excluded because the user ruled
on 11 October that gifts are not payments.


### User ruling — 11 October 2026

**Gifts are not payments.** Emperor-to-ally gifts do not qualify for
Bureaucrat, consume its once-per-phase use or create a qualifying-threshold
prompt. Gift amounts remain private to giver and recipient. Ordinary paid
auctions, shipments, revival and bribes keep their existing eligible paths.
This explicit user classification resolves the earlier gift question; it
does not change any gift transfer cost or disclose more information.

### 21 September gift classification review

A bounded primary-source review did not resolve whether Emperor gifts count as
the card's "payment." The [November FAQ, p. 5](https://www.gf9games.com/dune/wp-content/uploads/2020/11/Dune-FAQ-Nov-2020.pdf#page=5)
describes Emperor giving/sharing spice with allies separately from the ally's
later auction payment. The designer's examples name income recipients, not
outgoing gifts. The [base secrecy rule, p. 12](https://www.gf9games.com/dunegame/wp-content/uploads/Dune-Rulebook.pdf#page=12)
does not settle gift-amount disclosure for this combination. Current gift
amounts are projected only to Emperor and recipient. Even a threshold-only
Bureaucrat prompt would reveal that the gift qualifies; the existing exact-amount
payment projection must not be applied blindly.

The earlier question is now resolved by the 11 October ruling above.
Gift classification stays separate from the connected ordinary
[bribe controls](BRIBE_CONTROLS.md).

For native income windows, the prototype resolves the existing Karama response
first, then offers Bureaucrat before crediting the eligible recipient and
continuing the original auction or shipment. A canceled income payment goes to
the Bank, so creates no player-directed trigger. This is an outcome-based
composition inference. The rulebook's skill-before-faction sentence occurs in
its battle paragraph and does not expressly order this economic reaction.
The implementation does not settle Bureaucrat-before-Karama consumption.
Richese-directed auction proceeds use their original seller-credit callback;
no additional Richese-income Karama window is invented.

In the Basic Tleilaxu skill profile, a paid revival first commits its force or
leader custody and deducts the actual price. Its native income response still
allows Karama cancellation. Only an allowed, single-payer payment of at least
five spice then offers Bureaucrat before Tleilaxu receives that price. A separate
one-spice free-revival award is not a payment and cannot make a smaller price
qualify; if both occur, the award stays with Tleilaxu after any redirection.
The signed response and saved Bureaucrat choice retain the original payer and
price through JSON/SQLite continuation, while unrelated observers do not see
the private negotiated amount. The trainer's declined opportunity remains
available for a later qualifying payment in that phase.

Existing auction, shipment and bribe paths have public payment amounts; the
negotiated revival price remains limited to the participating seats and trainer.
Allied funding is evaluated per actual payer, not by adding different payers'
shares to create the five-spice trigger. A three-plus-three payment, or
four-plus-three, has no eligible payer and proceeds through original funding,
payment, card/force commitment and recipient income without a Bureaucrat offer.
In admitted classic and native E1/E2/E3 Skills compositions, individually
qualifying allied-funded auction and shipment receipts offer one optional
redirection: five-plus-three, three-plus-five, five-plus-five and fully
ally-funded five. This does not require incidental Nexus Cards or one exact
selected family. Original World and phase-module receipts retain their native
allocation and callbacks.
The receipt loses exactly two, never two per contributing payer. A share paid
by the trainer or recipient cannot qualify, but does not mask a different
eligible payer. Homeworld allied and split-recipient income is connected under
the ruled gross-first ordering below.

### User rulings — 13 October 2026

**Homeworld split-recipient ordering.** When a qualifying payment's recipient
income is partly diverted to Homeworld occupiers, Bureaucrat's two spice comes
off the **gross before** the occupation percentage split. Occupier shares are
computed from gross−2; the recipient keeps the remainder of gross−2. The payer
still pays in full. This resolves the previously silent question (the authorized
Advanced source, physical p.22, does not address Bureaucrat); the earlier
runtime behavior was the same ordering but had been recorded only as an
implementation choice.

The original occupied-percentage preview now composes with all fourteen Leader
Skills in fresh classic Homeworld games. Use `--profile homeworld-occupation
--leader-skills`; the original setup, occupation history and allocation ledger
remain authoritative. Expansions, Nexus Cards, Tech, Strongholds, Discovery and
other overlays remain outside this new entry. Existing games are not converted.

Actual Guild and Emperor receipts demonstrate gross8 → Bureaucrat Bank2 +
native3 + occupied3. The new receipt records `bankDiversion:2` while retaining
original `payment.paid:8` and each full actual payer contribution; its allocatable
`source.amount` is6. Decline splits8 into4+4. Karama before Bureaucrat instead
banks the native4, preserves the occupied4 and spends no Bureaucrat use.
The 14 October user ruling supersedes the former two-odd fence: low native income
rounds the whole remaining eligible invoice once. Both5+3 and3+5 are admitted.
The internal diversion payer is the first individually eligible contribution:
declared payer first, ally second, never pooled. Final Bank parts of that same
payer/invoice combine for Banker; no funding or eligibility identity is disclosed.
Fresh classic `homeworld-occupation --leader-skills` retains these original
receipts and now includes mandatory normal Banker income automatically.
See [current activation, accounting and proof](SPICE_BANKER_RUNTIME.md#mandatory-ordinary-skills-default--17-october-2026).

The new consumers are `tests/bureaucrat-occupied-guild.test.ts` and
`tests/bureaucrat-occupied-emperor.test.ts`, with original-army fixtures of the
same family names. The native Guild path uses paid Emperor shipping to fund
the Guild emptying Junction, then a real Harkonnen invasion. The Emperor path
uses an actual paid auction to fund the original twenty-counter departure,
then a real Guild invasion of empty Kaitain. No force, cash or occupation
history is assigned. Basic current-sole and Advanced retained-qualification
receipts are exercised, not full-game or complete-module certification.

Advanced Emperor departure explicitly selects all native Homeworld groups:
fifteen normal Kaitain counters and five Salusa elites. The original twenty-
counter payment and typed delivery remain. Advanced Guild uses native
Harkonnen preparation and a fifth BG occupier. Flexible Guild timing postpones
the invasion to turn2; the funded receipt waits for the actual next worm and
alliance on turn3 rather than chasing an already-past turn2 Spice phase.
Both actual Advanced gross8 programs settle native3/occupied3/Bank2 with original
paid8/shares intact; four meaningful allowance/diversion cases and the previous
Basic consumers pass21/21 across both files, with types/lint.

Actual390px controls redirect the Emperor invoice, then the Guild occupier
keeps3 through the original allocation control, then the original Harkonnen
bonus allowance advances to lot1. E5→8/H5→0/G16→13→16, one use, original
paid8 and5+3 evidence intact. Artifact: `/tmp/dune-occupied-bureaucrat-3231.json`.
Fresh AX observation failed after a Seat selection; fresh state confirmed the
selection and no gameplay action was replayed. Recorded browser errors are empty.
The caption now says the remainder follows the original Homeworld allocation,
rather than falsely claiming it all reaches the native recipient.

**Guild Nexus Betrayal receipt.** Betrayal redirects the full original charged
shipment fee to the Nexus holder, while Bureaucrat says the recipient receives
two less. The user ruled that **Bureaucrat applies**: the holder receives
price−2 and exactly two goes to the Bank. Neither printed card addresses the
other, so this is an explicit user ruling, not a source derivation. It is now
connected through a bounded classic Nexus + Leader Skills Betrayal composition
(`initializeGuildBetrayalLeaderSkillsGameForAudit`): the accepted Use completes
the original native shipment and records the full-fee receipt unchanged, then
offers Bureaucrat from the invoice's own payment legs with the holder as payee.
A redirect subtracts exactly two from the holder's receipt; a decline leaves the
full fee. The offer is skipped when the holder is the shipper, no individual leg
reaches five, or the skill was already used this phase. No other Betrayal or
preview composition is admitted.

### Payment families deliberately left unconnected — 13 October 2026

A bounded sweep of every player-to-player spice transfer found no other
qualifying gap:

- **Below threshold, no work due.** Richese Ambassador purchase income is exactly
  three; CHOAM Auditor charges at most two; Moritani Extortion is a fixed three.
  The stamp helper already declines amounts below five, so none can qualify.
- **Not player-to-player payments.** Bank/board income families (Moritani terror
  bounty, CHOAM battle force-income share, Smuggler collection, Spice Banker
  deferred income, Guild Secret Ally's bank tariff) have no seated third-party
  payer and correctly carry no stamp. Moritani Robbery is theft, not a payment.
- **Emperor gifts** remain excluded by the explicit 11 October ruling.
- **Guild Nexus Betrayal full-fee receipt** is ruled to carry Bureaucrat (holder
  receives price−2; see the 13 October ruling above) and is now connected
  through the bounded classic Nexus + Leader Skills Betrayal composition.
- **Homeworld allied/split-recipient income** is now connected under the ruled
  gross-first ordering above. Only the ruling makes the ordering authoritative;
  it must not be attributed to the printed source, which is silent.

Independent Karama shipments paid entirely to the Bank bypass player-income
guards. A successful use remains tied to the physical card's turn and phase,
including same-phase ownership changes; that accounting is an implementation
inference.

## Individual allied-payer threshold — 13 October 2026

The shared contributor check previously aggregated all payer shares and
rejected three-plus-three before commitment. The card's threshold names
one paying player; separate below-threshold costs are not one six-spice
payment by that player. The check now preserves that individual threshold
without opening the unresolved qualifying split-payment reaction.

The former threshold fixture used real skill training, turn-two worm and
mutual Harkonnen/Fremen alliance, but folded original board armies into
reserves. Its below-five checks and obsolete qualifying-guard assertions are
now replaced by the original-army fixtures below; it is not current native-army
evidence. Before the threshold fix, both shipment programs rejected valid
three-plus-three. Afterward, the six-spice debit and full Guild/Emperor receipt
continued without an offer.
The actual390px Basic controls pledge Fremen's three,
ship six counters into Habbanya Sietch17 for three personal plus three allied,
credit Guild5→11 and finish the original Movement turn. Initial Vite optimizer
request aborts and cosmetic action notices are recorded; this is local proof,
not deployed or full-family acceptance.

## Qualifying classic allied receipts — 13 October 2026

`tests/fixture-bureaucrat-qualifying-split.ts` retains original setup armies,
wallets and phase progression. A real first-turn three-spice bribe is collected
at the original Mentat Pause; the actual next worm and mutual alliance precede
the turn-two pledge. Only unplayed physical card ordering/custody is staged.
All six Basic/Advanced qualifying shipment and all six auction before programs
rejected immutably after the real pledge at the old integration guard.

The signed internal receipt retains each positive actual payer share. Existing
single-payer receipts gain no new signature fields. The public prompt retains
the already public gross price and recipient, but its payer is null for allied
funding: no exact shares, selected qualifying identity or internal source is
projected. Controls explain unchanged full contributor costs and gross-minus-two
recipient income. This conservative prompt-composition policy reveals that an
eligible share exists, not which private contribution meets the threshold.

Original Karama income cancellation still precedes Bureaucrat. Cancellation
banks the entire gross receipt and creates no offer/use; allowance keeps original
purchase/force commitment and asks the native trainer before credit. Decline
preserves later use; a five-plus-five receipt still consumes at most one use.
Actual native owner/payee funding and real phase-boundary cases are covered.
The existing bot payee/alliance choice needs no private contributor identity.

Four parent actual programs additionally exercise entirely Fremen-funded five
in both payment families and modes. Harkonnen pays zero, Fremen6→1, Guild
receives three after redirection or Emperor10→13; the original five shipped
reserves or purchased card and one legal Harkonnen bonus remain committed.
Two actual390px GameTable flows use original Karama allowance then the new
choice: Basic five-plus-three redirects two, Guild5→11/H2/F3/B10 and original
Finish hands Movement to Fremen; Advanced three-plus-five allows all eight,
Emperor10→18/H6/F1/B12, one purchased card plus one bonus, then original next-lot
inspection allowance returns native Bidding at index1. Artifact outside Git:
`/tmp/dune-native-bureaucrat-3225.json`.

The isolated host initially failed virtual React-refresh module resolution;
its resolver was corrected. The actual built app stylesheet supplied native
styling. A stale accessibility-node failure followed an already accepted
income allowance; authoritative state was inspected and no action replayed.
The generic network-idle wait timed out against the live dev host; direct
controls and fresh state/visual observations supplied the evidence instead.
This is local rule/control proof, not production, recovery or full-mode proof.
The native fixtures and consumer cases are
`tests/fixture-bureaucrat-qualifying-shipment.ts`,
`tests/bureaucrat-qualifying-shipment.test.ts`,
`tests/fixture-bureaucrat-qualifying-auction.ts` and
`tests/bureaucrat-qualifying-auction.test.ts`.

## Native paired E2 receipts — 13 October 2026

`tests/fixture-bureaucrat-paired-funding.ts` uses original six-seat
CHOAM/Richese/Harkonnen/Fremen/Emperor/Guild setup with fourteen skills and
Nexus. CHOAM actually trains Bureaucrat. Real first-turn bribe3, Mentat
Fremen3→6, next worm and mutual alliance retain every original army/wallet.
Before pledges: C26/R5/H7 Basic or9 Advanced/F6/E10/G5 Basic or6 Advanced.
Two before shipment programs and five original auction branches (ordinary/cache
both modes, Advanced Black Market) rejected immutably at the earlier Bureaucrat
module guard after actual F pledge5. The original paired E2 Nexus profile is
now admitted without Homeworlds; allied support is centralized and preserves
the other profile and printed-price constraints.

Ordinary auctions retain Emperor income cancellation; canceled gross goes to
Bank with no offer/use. Richese cache and Advanced Black Market retain their
actual seller-credit and bonus/closing callbacks, not an invented cancellation
response. Basic still has no Black Market, and free Karama purchases remain
normal-only. Owner/payee exclusion, donor-only five, sub-five nonpooling and
sealed-bid privacy use the same private receipt policy as classic funding.

The actual Advanced five-plus-five Guild after program retains interception,
original Karama allowance, H4/F1/C26/R5/E10/G6 before credit, then G14 on
redirect with one use and ten original reserves deployed beside Carthag10.
Its original Finish advances to Fremen. The actual Advanced five-plus-five
cache after program credits R5→13, H4/F1, one Residual Poison purchase and
one native bonus, then the original five-card normal pool at index0.
Four parent actual programs also cover Basic ordinary and cache payments,
Advanced wholly donor-funded Black Market and an actual trainer-funded
nonqualifying cache payment. Two actual cache-last programs retain the pending
CHOAM market, then original Done reaches Revival without another debit,
purchase or use.

Three actual390px GameTable flows retain C26 and original forces: Advanced
three-plus-five Guild redirects2, G6→12/H6/F1, Finish→Fremen; Basic five-plus-three
cache allows8, R5→13/H2/F3, one purchase/bonus and original normal lot0; Advanced
fully F-funded Black Market redirects2, R5→8/H9/F1, one transferred original
card/bonus and original Richese declaration. Its actual cache-first control
reaches original cache selection without another cost. Browser errors are empty.
Artifact outside Git: `/tmp/dune-paired-bureaucrat-3226.json`.

The frozen consumer union157/157 across eight files passes. Initial feedback
removed an incorrect direct-to-Revival pin and replaced it with actual original
closing progression. An exact sealed-log comparison wrongly coupled independent
public Storm bidder order; that incidental pin is removed, not re-pinned.
Private receipt fields and actual payment/acquisition outcomes remain checked.
One fixture event narrowing is repaired. A bare-not-throw/shared-gate echo
case is removed from the affected CHOAM integration file. No source rule,
strategy, Homeworld funding, public-start, save/deployed or complete-mode claim
is changed by this bounded proof.

## Native paired E3 receipts — 13 October 2026

`tests/fixture-bureaucrat-e3-funding.ts` uses the original paired E3 roster
Ecaz/Moritani/Guild/Atreides/Emperor with skills. Atreides genuinely trains
Bureaucrat; a real turn-two Great Maker worm forms the actual Ecaz/Moritani
alliance. Real armies, wallets, phase and assignment come from native setup;
only original unplayed Spice ordering and, for the cancellation case, one
unplayed card in a real hand are controlled.

Unlike E2, the paired E3 profile was already admitted to Bureaucrat mode
support, so the funded five-plus-five was never rejected by a module guard: it
rejected at the allied-funding guard
('Bureaucrat on allied funding or multiple payer contributions in this module
composition is awaiting integration.') for both families and modes, byte-identical
after a real Moritani→Ecaz pledge5. Boundary wallets Basic:
Ecaz12/Moritani12/Guild5/Atreides10/Emperor10; Advanced differs only at Guild6
and Atreides12.

The gate now admits no-Homeworlds single-Ecaz paired E3 while preserving every
prior admission (empty-expansion classic/nexus, single-CHOAM plain or paired).
Ix paired, Discovery, Tech, Stronghold, multi-expansion and Homeworld allied
funding stay excluded. Ix paired is deliberately deferred: enabling it would
newly admit the existing revival payment stamp in an Ixian-native Tleilaxu
composition whose Bureaucrat handling is not yet source-reviewed.

Ordinary auctions pay Emperor and retain original Emperor-income cancellation
(banked gross, no offer/use); Guild shipments retain their original interception,
income and Movement continuation. Forty-six consumer cases cover both families
and modes, 5+3/3+5/5+5/fully donor-funded five, decline/redirect, sub-five
nonpooling, trainer and payee exclusion without masking an eligible payer,
public gross/payee with payer null and no shares, stale/cross-actor rejection,
four minimal bots, and a real bribe-to-Mentat phase refresh. Guild-as-ally makes
a Guild-payee exclusion shipment free by native rule, so payee exclusion is
covered through the Emperor auction payee instead; that is a native rule, not
a gap.

Two actual390px GameTable flows use the genuine paid snapshots: Basic allied
auction5+3 redirects2 (Emperor10→16, Ecaz12→7, Moritani12→9, one use, next lot
at Guild) and Advanced allied shipment3+5 redirects2 (Guild6→12, Ecaz12→9 with
eight reserves committed at Habbanya17 beside Imperial Basin6, Moritani12→7,
Atreides12 unchanged, one use). Browser errors are empty. Artifact outside Git:
`/tmp/dune-e3-bureaucrat-3227.json`. Local rule/control proof only; no
deployed, recovery or full-mode claim.

## Native paired E1 receipts — 13 October 2026

`tests/fixture-bureaucrat-e1-funding.ts` uses the original paired E1 roster
Ixians/Tleilaxu + classics with skills; a classic seat (Atreides, or Harkonnen
in the five-seat revival roster) genuinely trains Bureaucrat. Real Storm,
Mentat, conserved worm, real alliance and real closing draws are reused from the
existing paired Ix fixture; only the native all14 shuffle order and original
unplayed card custody are scoped.

Before this slice paired E1 was absent from Bureaucrat mode support, so a funded
auction or shipment rejected at the mode guard
('Bureaucrat with other optional modules is still being integrated.'),
byte-identical after a real pledge. A paid revival produced no offer and no
error: `stampBureaucratPayment` early-returns when mode support is false, and
the revival path never calls the contributor check. Both gates now admit the
no-Homeworlds paired E1 Nexus profile and nothing broader: single-native E1,
preview overlays, multi-expansion and Homeworld allied funding stay excluded.

Paid Tleilaxu revival is a genuine qualifying source: the source is stamped from
the payer's actual `revival.cost` (not the combined receipt), so a separate
one-spice free-revival award is excluded. Source kind is `revival`, phase 4,
single payer, seated Tleilaxu payee. Axlotl accrual is a separate deferred token;
Face Dance has no player-to-player payment; foreign-ghola acquisition is
Tleilaxu-paid and yields no payer income. None of these are new blockers.

Forty-nine consumer cases cover both modes: auction and shipment 5+3/3+5/5+5/
fully donor-funded five, decline/redirect, sub-five nonpooling, owner/payee
exclusion without masking an eligible payer, public gross/payee with payer null
and no shares, stale/cross-actor rejection, four minimal bots, one physical use
per phase, a single-payer bribe regression, and the revival cases above
(qualifying price, below-five no-offer, Karama-canceled no-offer). The Guild's
genuine Nexus Guild Cunning card is exercised: a Guild-authored shipment costs
the bank and has no third-party payer, so it yields no receipt; Guild Secret Ally
is unreachable because that offer requires a game without a Guild faction.
Recorded, not fabricated.

Two actual390px GameTable flows: Basic allied shipment5+3 redirects2 (Guild5→11,
Harkonnen10→5 with eight reserves at Habbanya17, Ixians10→7, one use) and Basic
paid revival (Atreides10→4 for cost6, Tleilaxu5→10 = paid6 + separate free award1
− 2, one use). The private revival prompt shows the payer only to the owner.
Browser errors are empty apart from the known Vite optimizer abort for
`next_image.js`. Artifact outside Git: `/tmp/dune-e1-bureaucrat-3228.json`.
Local rule/control proof only; no deployed, recovery or full-mode claim.

## Saved choices and verification

Only the skill owner may redirect or allow the current payment. The saved event
binds the payer, payee, amount, skill, phase and original continuation. It must
retain any prior decision and response without showing their private contents.
The payer is charged once; the original purchase, shipment or bribe remains
intact. Decline restores the full recipient share without consuming the skill.

Controls explain both possible recipient amounts and the deferred nature of
bribes. AI uses public payment and alliance information. Focused checks cover
ownership, successful-use limits, custody, private projection, stale requests,
JSON/SQLite restoration and competing writes. Final evidence and limitations
are recorded with the verified checkpoint; narrow prototype paths do not open
mode or publication gates.

Four source-stable genuine-setup samples completed with all four AI profiles,
full physical Treachery/force/skill custody checks and periodic JSON/private-view
restoration. The initial skill shuffle deliberately offered Bureaucrat, which the
Atreides AI selected. No hands, forces or phases were staged in these samples.

| Profile | Seed | Actions | JSON restores | Finish turn |
| --- | --- | --- | --- | --- |
| Base Basic | 20260940 | 718 | 20 | 9 |
| Base Advanced | 20260941 | 551 | 15 | 6 |
| CHOAM/Richese Basic | 20260942 | 681 | 19 | 8 |
| CHOAM/Richese Advanced | 20260943 | 174 | 5 | 2 |

All four had zero rejected candidates, but none reached a Bureaucrat payment
decision. They establish regression continuation for these paths, not natural
full-game redirection coverage. Focused tests and the targeted browser exercise
cover the payment choices directly; broader integrated acceptance remains open.

The separate browser QA uses a conserved staged shipment-phase position after
genuine skill setup. It allows one actual five-spice bribe, then redirects two
from a second actual five-spice bribe in the same phase. The second choice and
its resolved movement controls survive refresh. The payer spends ten total,
the recipient retains eight in deferred bribe escrow, physical custody stays
unchanged, and only the redirection consumes the skill. This is explicitly staged
UI evidence. After the reported outage, all 699 opening rooms and their original
seat/recovery records matched the private backup; database integrity and foreign
keys passed. The healthy server was reused.

## Registered native allied receipts — 18 October 2026

The ordinary Skills receipt capability now governs both single and allied
funding. The separate allied-only classifier is removed, not aliased. Registered
selected-family all14 tables no longer need incidental Nexus Cards or one exact
family to use an otherwise supported auction or shipment receipt. Original
World/phase allocation, module admission and Advanced role limits stay separate.
This supersedes the narrower **dated 13 October scope bounds** above, not the
printed card, explicit user rulings or original economic callbacks.

Before repair, a genuine Basic Ecaz/Moritani/Guild/Atreides/Emperor plain-Skills
table formed a real turn-two worm alliance. Moritani pledged five from twelve;
Ecaz's five-force nonstronghold shipment cost ten, paid five plus that escrow.
The extra allied guard rejected it byte-identically. After repair, Ecaz and
Moritani retain seven each, five forces arrive once, Ecaz reserves are nine,
and the escrow is consumed once. Redirecting gives Guild eight, from five to
thirteen; the Atreides trainer gains nothing and original Movement resumes.

The shared individual-payer threshold, trainer/payee exclusions, private
contribution legs, two-spice Bank diversion and once-per-phase use are unchanged.
Native income cancellation still resolves first and creates no Bureaucrat
offer/use. Declining keeps the later phase opportunity. No revival price,
free-revival award, Banker invoice, gift classification or occupied split changes.

The new E1 plain producer retains actual starting armies before funding:
HMS six, Carthag ten, Arrakeen ten and Tuek's five. Its older Nexus battle
producer's conserved board-return staging is retained only in that legacy path;
it is not claimed as natural native movement. A real Advanced no-Nexus shipment
still opens native Guild interception. An eight-force shipment paid three plus
Ixian escrow five leaves Harkonnen nine spice/two reserves with Carthag ten
untouched, and Ixians five spice/HMS six untouched. All four legal policies
redirect the eligible receipt, give Guild six (six to twelve), and resume the
next real movement seat.

Three actual390px GameTable flows use isolated memory-only original producers:
Basic cost-ten/five-force shipment passes native Karama allowance and redirects
two, then reaches Collection; Advanced extra-selected-CHOAM auction three-plus-five
allows the full eight (Emperor ten to eighteen, no use, original next lot at
Guild); a fresh original counter branch cancels that income (Emperor stays ten,
no offer/use, original next lot, original Karama consumed). Prompts show gross,
recipient and payer-null without contribution legs. Browser errors and horizontal
overflow are absent. Temporary routes were removed and their memory released204;
no stored room, dev-server restart, deployment or assurance campaign is involved.

Frozen17-file **442/442**, focused original nonstronghold1/1 and parent-owned
types/lint/build pass. New consumer boundaries live in
`tests/bureaucrat-e1-funding.test.ts` and `tests/bureaucrat-e3-funding.test.ts`;
default Nexus, classic/World/occupied/Betrayal and original phase payment
consumers remain in that union. Earlier fixture/helper/profile-only pins are
deleted rather than repinned. This is scoped local rule/control proof, not
complete Skills, module-combination, save/recovery or deployed acceptance.
