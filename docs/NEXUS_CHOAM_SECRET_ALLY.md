# CHOAM Nexus Secret Ally prototype

13 September 2026. The Spice Collection trade is **Prototyped** in the development
Nexus module. Its battle inspection alternative is still missing. This checkpoint
does not enable normal Nexus starts, certify the full card family, or open a
publication gate.

## Source and behavior

The printed CHOAM card's Secret Ally panel allows a Worthless card to be discarded
during Spice Collection for two spice, or a random unused opposing hand card to
be inspected after a victory. The [common source contract](NEXUS_CARD_RULES.md)
records the [photographed publisher component](https://boardgamegeek.com/image/7767032/dune-ecaz-and-moritani)
and publisher lifecycle rules. [Native Cunning](NEXUS_CHOAM_RULES.md) has different
costs and effects and is not reused as a substitute for this panel.

Only an unallied holder with CHOAM absent may use this trade, in Basic or Advanced.
The server quotes the holder's actual Worthless cards. The player selects one;
its printed identity and physical discard custody remain intact. Both that card
and the CHOAM Nexus card are spent, and two spice are paid from the bank exactly
once. No native faction identity, market sale, Cunning conversion, or Auditor
payment is introduced. No blanket Nexus Karama immunity is inferred: this trade
uses the absent-faction panel rather than a native CHOAM advantage.

Collection readiness remains optional; continuing without trading keeps the
cards. The action cannot interrupt a decision, Truthtrance, committed discard,
exchange, or queued automatic Collection choice. It may still be used while its
owner is ready if Collection has not ended. Exhaustive simultaneous Collection
combinations remain part of the later integration pass.

## Connected paths

- `game/nexus-choam-trade.ts` provides the private quote and saved receipt checks.
  `game/engine.ts` applies payment, Nexus/card custody and the semantic fresh
  discard continuation. The completed history remains private server evidence.
- `game/nexus-choam-trade-options.ts` supplies the shared human/AI action.
  `components/nexus-choam-trade.tsx` provides a card picker, inspector, costs and
  availability reasons at the table. All four AI profiles use eligible trades.
- The existing JSON room state stores the receipt. No database migration or
  server restart is required. Recovery validates the already-paid outcome and
  retires the discard; it never credits spice a second time.

## After-victory inspection audit

The other printed Secret Ally choice applies only after its holder wins a
battle. It inspects exactly one random Treachery Card held by the opposing
combatant that the opponent did not use in that battle. Normal and traitor
wins qualify. Mutual-traitor and Lasgun-shield explosion results have no winner
and do not. “Used” is the physical set already produced by the battle quote for
the opponent, including a Cheap Hero, cards played in weapon or defense slots
and a late Portable Snooper. A used card remains excluded if another effect
later retains it. The effect neither transfers nor discards the inspected card.

The battle engine must preserve the opposing used-card IDs with the resolved
battle event before mandatory loser disposal. The existing Auditor candidate
filter is reusable because it removes exact physical used IDs from the current
opposing hand. The Nexus effect still needs its own one-card sampler and receipt;
it must not borrow Auditor survival, payment or cancellation behavior. A
successful use discards the held CHOAM Nexus card once, records the sampled
snapshot once and projects the face only to its holder. The public chronicle may
name the use, winner and opponent, but not the inspected face.

The safe continuation point is the existing final `finishBattle` board boundary:
after mandatory and optional battle-card cleanup, Moritani retention, battle
income, technology, capture, Auditor, Face Dance and Caladan reinforcement, and
before another battle or phase begins. No existing choice occurs at that point
for every possible winner. Opening a pause only when the winner secretly holds
the CHOAM Nexus card would reveal that hidden identity. Precommitting a
conditional use before the result would remove the printed after-victory choice.
A universal use-or-pass window would preserve secrecy and the full choice, but
would also ask winners without the card to pass. The user has been asked which
product exception to adopt; no timing policy is implemented while that answer
is pending.

The retrieved Nexus sources neither establish an ordinary Karama response to
this Secret Ally play nor grant blanket Nexus immunity. The Collection trade is
currently direct and this inspection must not inherit the native Auditor's
Karama/payment window by analogy. Cancellation remains an explicit later audit
boundary rather than an invented prototype rule.

## Focused evidence and remaining scope

Run `npm test -- nexus-choam-trade`. Focused cases cover Basic/Advanced payment,
physical custody, all four AI profiles, private rendered controls, wrong-mode and
stale action rejection, Truthtrance locking, damaged saved receipts and JSON
continuation. Production SQLite tests exercise competing trades, seat restoration,
replay rejection and an already-paid discard resume.

The after-victory inspection still needs an original battle receipt, exclusion of
the opponent's used cards, a private one-card sample and composition with winner
cleanup. Complete Nexus games, broader Homeworld interactions, strategic choice
between the two Secret Ally uses and visual acceptance of that full family remain
unfinished. Prototype evidence is deliberately narrower than complete compliance.
