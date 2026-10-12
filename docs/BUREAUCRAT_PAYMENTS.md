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

The connected paths are ordinary paid auctions, Guild shipment income, direct
Richese auction proceeds and actual bribe transfers in the base or CHOAM-only
skill profile. Basic Tleilaxu with Leader Skills and base opponents additionally
supports a single payer's actual paid revival price to Tleilaxu. Other expansion
payment sources remain outside this batch. Emperor gifts are excluded because
the user ruled on 11 October that gifts are not payments.


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

For native income, the prototype resolves the existing Karama income window
first, then offers Bureaucrat before crediting the eligible recipient and
continuing the original auction or shipment. A canceled income payment goes to
the Bank, so creates no player-directed trigger. This is an outcome-based
composition inference. The rulebook's skill-before-faction sentence occurs in
its battle paragraph and does not expressly order this economic reaction.
The implementation does not settle Bureaucrat-before-Karama consumption.

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
In supported classic profiles without Homeworlds, individually qualifying
allied-funded auction and shipment receipts now offer one optional redirection:
five-plus-three, three-plus-five, five-plus-five and fully ally-funded five.
The receipt loses exactly two, never two per contributing payer. A share paid
by the trainer or recipient cannot qualify, but does not mask a different
eligible payer. Qualifying expansion-faction funding and split-recipient
Homeworld income retain their separate integration guards.
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
