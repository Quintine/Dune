# Public deal records

## Structured payments due in a later turn — 28 October 2026

**Prototyped / Partial.** A structured payment may name its offer turn or a
later turn as its deadline. The parties must all accept by that deadline. The
payer can make the exact native bribe early or during its due turn; separate
agreements require separate payments. Unanimous release cancels an unpaid term.

Future payments do not reserve today's spice or rely on imagined future income.
When the deadline arrives, the existing supported current-turn payment and
feasibility policy applies. Unpaid terms expire when the deadline passes or the
game ends. Autopilot waits until the due turn before paying. An early payment
must respect obligations already due. These deadline and feasibility policies
are provisional implementations of public agreements, not publisher rulings.
Broader combinations, free-text enforcement, browser and deployed acceptance
remain open.

## Structured payment due this turn — 28 October 2026

**Prototyped / Partial.** A public offer may name a payer, recipient and exact
gross bribe due by the end of its current turn. Everyone sees the immutable
term and every signatory must accept; final acceptance creates a pending
obligation without transferring spice. The payer's persistent deal panel
offers a dedicated payment action. That action settles exactly one agreement
through the normal bribe path, including the deferred Mentat receipt and any
Bureaucrat diversion. An unrelated bribe does not silently settle the deal.
Two independent agreements require two transfers, even to the same recipient.

The acceptance and subsequent voluntary-action quote considers the payer's
actual uncommitted funds, supported existing commitments, possible native
Charity/CHOAM income and already-earned incoming bribes. Exact payments may
occur on either side of an eligible Charity claim. The bounded planner tries
whole-payment orders and up to 2,048 candidate states; unavailable or more
complex combinations can be rejected rather than treated as proven impossible.
The quote never creates funds. A binding deal and a compatible Truthtrance
minimum can both be satisfied by the same actual deal payment, but independent
deals cannot share it. A payer may not voluntarily spend or close the payment
window while an achievable obligation remains.

Unanimous release cancels the unpaid term and does not refund a completed
payment. A temporary decision, funding shortage or alliance does not by itself
void the deal. In a quiet, supported Basic Mentat, a term individually larger
than the payer's remaining funds is void; after an external shortfall leaving
several individually payable terms, the payer can choose which to settle.
Unpaid terms also become void when their turn actually ends or the game ends.
The selection/feasibility policy is provisional. It does not yet decide all
impossibility, optional-module or cross-turn cases, interpret free text, or
enable AI negotiation. An already-offered immediate payment remains unreserved;
its final acceptance can fail if it would undercut an active obligation.

The publisher's rulebook permits legal public deals and voids impossible parts;
this explicit receipt and deadline are an online representation, not a new
printed restriction. Twenty-one related offline files pass 129 cases, including
native consent, each separate payment, release, Charity, earned income,
Truthtrance, autopilot and selected external-loss cases. One isolated
authenticated HTTP case verifies consent, payer authority, deferred receipt and
replay rejection on a separate test database. Broader combinations, free-form
enforcement, browser and deployed acceptance remain open. Type checking, lint
and the production build pass for this checkpoint.

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
In Advanced play, the automatic payment triggered by another seat's final
acceptance does not close the payer's immediate-after-movement Hajr opportunity.
If the payer makes the final acceptance, or directly pays a bribe, that payer's
own voluntary action closes the opportunity. This is a provisional online
timing interpretation of the supplied revision, physical p. 39 (printed p. 37).
Seven related unit files pass 46 cases, including genuine Advanced movement and
Hajr play after another seat's deal acceptance; only payment funding was staged.
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
Automatic interpretation and full enforcement and impossibility handling,
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
