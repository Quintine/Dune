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

The target paths are ordinary paid auctions, Guild shipment income, direct
Richese auction proceeds and actual bribe transfers in the existing base or
CHOAM-only skill profile. Other optional modules retain their existing gates.
Tleilaxu revival, other expansion payment sources and direct gifts remain outside
this connected batch. Their absence does not establish a rule prohibition.

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

The user has been asked whether to retain this boundary or apply Bureaucrat
with only the qualifying threshold public. No answer is assumed. Gifts remain
outside the connected Bureaucrat payment paths while independent ordinary
[bribe controls](BRIBE_CONTROLS.md) proceed.

For native income, the prototype resolves the existing Karama income window
first, then offers Bureaucrat before crediting the eligible recipient and
continuing the original auction or shipment. A canceled income payment goes to
the Bank, so creates no player-directed trigger. This is an outcome-based
composition inference. The rulebook's skill-before-faction sentence occurs in
its battle paragraph and does not expressly order this economic reaction.
The implementation does not settle Bureaucrat-before-Karama consumption.

Qualifying single-payer payments have a public amount. Qualifying allied funding,
including an aggregate such as three plus three and a payment funded entirely by
the ally, is guarded before costs or commitment. It needs separate payment-unit
and privacy work, as does split-recipient Homeworld income. Independent Karama
shipments paid entirely to the Bank bypass this player-income guard. Do not infer
eligibility from an aggregate that silently combines payers or reveals concealed
funding. A successful use is retained for the physical
card's turn and phase, including a same-phase ownership change. That physical
card accounting is an explicit implementation inference.

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
