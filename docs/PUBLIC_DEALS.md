# Public deal records

## Source and prototype scope — 28 October 2026

**Prototyped / Partial.** The [publisher's 2019 rulebook](https://www.gf9games.com/dunegame/wp-content/uploads/Dune-Rulebook.pdf)
permits public deals between nonallied players, requires legal terms to be
honored, voids impossible parts and permits release by agreement. Its bribery
rules prohibit transfers of cards, leaders, forces and faction powers and
terms that contradict the rules. The user-supplied revised rulebook, physical
p. 16 (printed p. 14), records the same principles. This implementation does
not interpret written terms or decide whether they are legal or impossible.

Two human seats that are not allied with each other can record public written
terms during play, including while a game decision is open. The recipient may
accept or decline and the proposer may withdraw an unanswered offer. Both
participants can vote to release an accepted deal; either may withdraw a
pending release request. Once both agree, the record is released. Existing
agreements can be released if participants subsequently become allies. Records
remain visible and active until both release them, even after the players
consider the terms fulfilled. Their text is public to the whole table.

The record itself moves no spice and creates no automatically enforced game
action. Players remain responsible for honoring valid terms, and an impossible
part is void under the rules. Existing [bribe controls](BRIBE_CONTROLS.md)
make actual eligible payments into the recipient's deferred Mentat supply.
Automatic interpretation, enforcement and impossibility handling, more than
two parties, AI negotiation and complete multiplayer/deployed acceptance remain
open. The text interface is an online convention, not a publisher ruling.

The action uses the normal seat authentication and room version fence. Game
state carries an additive public ledger; it does not replace the native phase,
decision, private information or physical components.

Seven related unit files pass 43 cases, including a native Truthtrance response
continuation; an isolated authenticated HTTP case covers three public views,
seat-authorized consent, release and subsequent play. The UI tests cover
proposer and recipient controls and a persistent action-needed notice. This
evidence does not certify arbitrary written terms or complete game modes.
An isolated browser room exercised offer, acceptance and mutual release between
two controlled faction seats, including the automatic response notice, distinct
faction labels and a result that remains visible until the player closes it.
