# Public deal records

## Source and prototype scope — 28 October 2026

**Prototyped / Partial.** The [publisher's 2019 rulebook](https://www.gf9games.com/dunegame/wp-content/uploads/Dune-Rulebook.pdf)
permits public deals between nonallied players, requires legal terms to be
honored, voids impossible parts and permits release by agreement. Its bribery
rules prohibit transfers of cards, leaders, forces and faction powers and
terms that contradict the rules. The user-supplied revised rulebook, physical
p. 16 (printed p. 14), records the same principles. This implementation does
not interpret written terms or decide whether they are legal or impossible.

Two to six human seats can record public written terms during play, including
while a game decision is open. Every pair must be nonallied when the offer is
made and when each acceptance is recorded. This pairwise interpretation of a
multi-party offer is provisional; the printed rules do not settle its exact
online form. The proposer is implicitly in agreement. All recipients must
accept for the record to become active; any may decline while it remains open,
and the proposer may withdraw it. Each participant can request or withdraw a
release; all must agree before release. Existing agreements can still be
released if participants subsequently become allies. Records remain active
until unanimously released, even after the players consider terms fulfilled.
Their text is public to the whole table.

An optional structured immediate bribe names a payer, recipient and gross spice
amount, all visible before anyone consents. Both must be distinct signatories.
On the final acceptance the engine invokes the ordinary bribe action as the
already-consenting payer, atomically with that acceptance. The payer loses the
gross amount immediately; a Bureaucrat may divert two spice before the
recipient's remaining share reaches deferred Mentat supply. No funds are
reserved during an offer. If timing, available funds, another binding rule or
the payer's AI control makes payment unavailable, final acceptance fails without
recording that vote or debiting spice. A pending native Bureaucrat decision
continues normally; later release of the deal does not reverse a paid bribe.
Nine related unit files pass 71 cases, including a native Bureaucrat diversion
and unavailable-payment rollback. Three isolated HTTP cases include an earlier
consenting payer, final approval by another participant and replay rejection.
An isolated browser room also exercised a two-spice offer and acceptance,
showing the payer's debit and recipient's deferred balance. Its roster did not
include a Bureaucrat.

Free-text terms alone move no spice and create no automatically enforced game
action. Players remain responsible for honoring valid terms, and an impossible
part is void under the rules. Existing [bribe controls](BRIBE_CONTROLS.md)
also make actual eligible payments into the recipient's deferred Mentat supply.
Automatic interpretation, enforcement and impossibility handling,
AI negotiation and complete multiplayer/deployed acceptance remain
open. The text interface is an online convention, not a publisher ruling.

The action uses the normal seat authentication and room version fence. Older
two-party records retain their original serialized form and actions. Game
state carries an additive public ledger; it does not replace the native phase,
decision, private information or physical components.

The multiparty follow-up passes 28 cases in four related unit files and two
isolated authenticated HTTP cases, including three signatories across separately
authenticated faction seats. This does not certify all game combinations.
An isolated browser room exercised three-party acceptance and unanimous release
across four human faction seats. The subsequent allied-acceptance control was
verified by a focused component test rather than that browser run.

Seven related unit files pass 43 cases, including a native Truthtrance response
continuation; an isolated authenticated HTTP case covers three public views,
seat-authorized consent, release and subsequent play. The UI tests cover
proposer and recipient controls and a persistent action-needed notice. This
evidence does not certify arbitrary written terms or complete game modes.
An isolated browser room exercised offer, acceptance and mutual release between
two controlled faction seats, including the automatic response notice, distinct
faction labels and a result that remains visible until the player closes it.
