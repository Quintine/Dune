# Homeworld card economy: source contract

Audit: 9 September 2026. Scope: high Kaitain's paid disposal and high Tupile's
Worthless-sale restriction. This document does not certify runtime integration.

## Authority and access

- The original high faces were freshly retrieved and visually inspected in
  [BGG photograph 7767034](https://boardgamegeek.com/image/7767034/dune-ecaz-and-moritani).
  Public metadata identifies a 3024×4032 photograph posted on 2 October 2023;
  the local inspection copy is `/tmp/dune-card-economy-homeworlds.jpg`.
  Its Kaitain and Tupile text agrees with the prior
  [component audit](HOMEWORLD_COMPONENT_AUDIT.md). The photograph depicts
  publisher components; uploader commentary supplies no rules authority.
- [GF9 E3, pp.9–10,15](https://www.gf9games.com/dune/wp-content/uploads/EcazMoritani-Rulebook-LOWRES.pdf)
  was rechecked through publisher-indexed text. Population changes continuously;
  Homeworld advantages and penalties are immune to Karama. The book expressly
  identifies Tupile's high side as a penalty and its low side as an advantage.
- [GF9 E2, pp.4,7–8](https://www.gf9games.com/dune/wp-content/uploads/2021/11/CHOAM-Rulebook-low-res.pdf)
  was likewise checked through publisher-indexed text. Ordinary CHOAM sales
  occur at phase end: exact duplicate surplus pays three spice, Worthless cards
  two. Its reciprocal allied card trade is once per game turn at phase end.
  Special CHOAM Karama pays three per selected Treachery card at any time,
  including Worthless cards. Special Worthless effects retain their own timing;
  Gamont belongs to Mentat Pause. The discard pile is not freely searchable.

Direct GF9 PDF requests currently redirect or return 403; the former
`/tmp/dune-rules` cache is absent. This audit does not claim a fresh full-PDF
download. No retrieved official amendment changes either inspected high face.
Tournament compilations surfaced in search but were excluded.

## Kaitain implementation contract

At Bidding's end, an Emperor with high Kaitain may choose held Treachery cards
and pay two spice per card to discard them. The face gives neither a one-card
limit nor a forced discard. Declining is legal. Weapons, defenses, Worthless
cards and Karama are all Treachery cards. Paying to discard a Karama does not
activate its printed effect or spend the once-per-game special power.

Treat the selected group atomically: unique currently held physical IDs, enough
available spice for the whole group, exact cost, and exactly one discard per
selected card. A stale or invalid selection must spend nothing. The batch is an
implementation transaction, not a new printed once-only restriction. No extra
auction begins because disposal opened a hand slot after auctions ended.

The payment is disposal expenditure, not a card purchase, shipment or battle
support payment. No retrieved rule names a faction recipient: bank payment with
no commercial-income response is the implementation inference. Separate
discard-triggered effects still apply: the inspected high Ecaz face rewards
poison-weapon discards. Reuse physical discard handling and preserve private
selection information until the normal discard visibility rules permit it.

Do not offer a Karama response against Kaitain itself. Recheck current native
population at execution, including after a legally played Ghola; do not freeze
high eligibility at the beginning of Bidding. Foreign visitors do not supply
native population.

## Shared end-of-Bidding timing

Kaitain and CHOAM's market share a phase-end boundary. No retrieved primary rule
orders one before the other. The
[November FAQ, p.8](https://www.gf9games.com/dune/wp-content/uploads/2020/11/Dune-FAQ-Nov-2020.pdf#page=8)
uses storm order for simultaneous Truthtrance plays; it does not explicitly
establish a universal order for these later expansion abilities.

Consequently, do not describe a fixed CHOAM-before-Kaitain sequence, its reverse,
or a storm-order queue as a verified official requirement. Keep both legal
opportunities available until the shared boundary closes. In particular, do not
discard an Emperor's opportunity merely because its original hand was empty
before a legal allied trade or another permitted card acquisition. New cards
and current funds must be considered when quoting a later disposal. Preserve
any pending trade, response or post-auction continuation; disposal does not
authorize resolving another player's decision.

## Tupile implementation contract

While Tupile is high, CHOAM cannot discard Worthless cards for spice except
through Advanced Karama. The prohibition names the card and outcome, so both a
two-spice Worthless sale and a three-spice duplicate-Worthless sale are blocked.
An exact-name witness does not change the sold card's kind. Non-Worthless
duplicate sales, reciprocal trades, battle discards and special Worthless
effects are outside this prohibition. This is direct application of the face's
scope, not a new restriction on all CHOAM card handling.

The same block applies when native CHOAM benefits from the CHOAM Ambassador:
that effect exchanges selected cards for bank spice, and Ecaz may designate
its ally as beneficiary. Neither changes the card into Advanced Karama. Check
the actual beneficiary's Tupile, not the token name or Ecaz's population.
The Ixian Ambassador's discard-and-draw exchange remains outside this block.
[E3, p.8](https://www.gf9games.com/dune/wp-content/uploads/EcazMoritani-Rulebook-LOWRES.pdf#page=8)
This composition follows the named outcome and sole printed exception; no
dedicated worked Ambassador/Tupile example was retrieved.

The Advanced Karama exception is specific to CHOAM's cash-in power. It neither
removes the high penalty generally nor creates a Basic-game exception. Preserve
the existing separate activating-Karama cost, once-per-game use, eligible
uncommitted card selection and three-spice return. Ordinary Karama cannot
cancel Tupile's restriction. At low population, this particular sale block is
absent; do not accidentally suppress the low-side information ability or
redefine its occupied-face interaction here.

Revalidate high/low status when an interrupted sale actually settles. Test a
real Ghola transition from low to high while a Worthless sale is pending:
stale permission must not remove the card or pay income. Keep the market and
its parent continuation recoverable. This requirement is independent of the
older unresolved Kull and Worthless-cancellation interpretation questions.

## Deferred payment splitting

E3 p.15 explicitly splits a five-spice Treachery payment into three for Emperor
and two for Kaitain's occupier, even if that occupier bought the card. It does
not give an allied-contribution example. The inspected reverse-face record
assigns rounded-up half of shipment receipts to low Junction. Neither evidence
establishes separate rounding per contributor versus once per purchase or
shipment. Preserve payment identity, actual payer contributions and income
source separately before integrating those effects; do not infer an answer
from existing integer arithmetic. Occupation lifecycle questions remain in
[Homeworld rules](HOMEWORLD_RULES.md).

Runtime verification should cover Basic/Advanced and module-off parity,
threshold transitions, exact card custody, private view/AI boundaries,
rejected-action immutability and saved parent recovery. Those are engineering
requirements for these rules, not evidence that the entire module is complete.
