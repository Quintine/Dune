# CHOAM Nexus Secret Ally prototype

27 September 2026. The Spice Collection trade and a bounded after-victory
inspection are **Prototyped** in the development Nexus module. This checkpoint
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

The battle engine records the opposing used-card IDs with the resolved battle
event before mandatory loser disposal. The existing Auditor exclusion contract
is reused for physical IDs, but the Secret Ally has its own one-card sampler
and receipt. It does not borrow Auditor survival, payment or cancellation.
Winning normally or by a single traitor qualifies; no-winner explosion and
mutual-traitor outcomes do not. The physical CHOAM Nexus card is spent once.
Only the holder sees the sampled card snapshot. The public chronicle names the
use and opponent without naming the face.

After compulsory and optional card cleanup, battle income, technology, capture,
Auditor, Face Dance and Caladan reinforcement, the final `finishBattle` board
boundary opens the same use-or-continue window for **every winner** when Nexus
is enabled and CHOAM is absent. This is a privacy-preserving product
interpretation, not a printed requirement: nonholders and ineligible allied
holders continue without use. Opening only for a secret holder would expose
card custody; precommitting before the result would remove the printed
after-victory choice. All four AI levels use the same private offer and can
legally continue. Legacy battle cleanup saves without a physical used-card
receipt do not infer one and continue through their existing path.
The saved winner choice survives a paid Nullentropy Box search or another
interruption without exposing the held Nexus card. Only the active decision
projects its private offer; suspended frames retain their signed battle receipt.
The private sampled-card snapshot expires at the next battle or Storm.

The retrieved Nexus sources neither establish an ordinary Karama response to
this Secret Ally play nor grant blanket Nexus immunity. The current inspection
is direct, as with the Collection trade. Cancellation remains an explicit
later source-audit boundary rather than an invented prototype rule.

## Focused evidence and remaining scope

Run `npm test -- nexus-choam-trade`. Focused cases cover Basic/Advanced payment,
physical custody, all four AI profiles, private rendered controls, wrong-mode and
stale action rejection, Truthtrance locking, damaged saved receipts and JSON
continuation. Production SQLite tests exercise competing trades, seat restoration,
replay rejection and an already-paid discard resume.

Run `npm test -- nexus-choam-inspection` for real Basic/Advanced battles,
private controls, physical used-card exclusion, JSON continuation, paid-search
interruption, snapshot expiry and competing in-memory SQLite cases. The
Collection trade retains its separate focused and production SQLite evidence
above. Complete Nexus games, broader Homeworld interactions, strategic choice
between the two Secret Ally uses and visual acceptance of the full family remain
unfinished. Prototype evidence is deliberately narrower than complete compliance.
