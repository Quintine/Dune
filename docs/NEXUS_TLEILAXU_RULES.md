# Tleilaxu Nexus: primary-source contract

Source audit, 10 September 2026. This document does not certify runtime support or open expansion release gates. The [common Nexus rules](NEXUS_CARD_RULES.md) apply. Betrayal's existing unanswered reaction-privacy question remains separate.

## Sources

- The Tleilaxu face in the [original printed-component photograph](https://boardgamegeek.com/image/7767032/dune-ecaz-and-moritani), freshly inspected at `/tmp/dune-nexus-cards.jpg`. The authority is the photographed GF9 card text.
- [GF9 Ecaz & Moritani, pp.9,11,16](https://www.gf9games.com/dune/wp-content/uploads/EcazMoritani-Rulebook-LOWRES.pdf#page=11): common mode and disposal rules, Duke restrictions, Homeworld and Nexus FAQ. The previously acquired publisher-authored PDF mirror at `/tmp/dune-e3-nexus-rules.pdf` and its extracted text were reread; fresh publisher-indexed excerpts were retrieved. Direct official PDF access remains unavailable.
- [GF9 Ixians & Tleilaxu, pp.6–7,9 and Karama table](https://www.gf9games.com/dunegame/wp-content/uploads/2020/09/IxianAndTleilaxuRulebook.pdf#page=7): ordinary Face Dancer cycle, native revival powers, typed Ixian forces and cancellation boundaries.
- [GF9 base rulebook, pp.9,13,16–19,22](https://www.gf9games.com/dunegame/wp-content/uploads/Dune-Rulebook.pdf#page=9), and [November 2020 FAQ, pp.2,5–9](https://www.gf9games.com/dune/wp-content/uploads/2020/11/Dune-FAQ-Nov-2020.pdf#page=2): ordinary revival, repeated deaths, special forces, Kwisatz, Ghola and special revival permissions. Fresh official indexed excerpts were inspected. Existing Ghola implementation is not substitute authority for this Nexus effect.

## Cunning: complete physical operation

Native Tleilaxu sets aside every revealed Face Dancer, privately draws the same number of replacements, and only then shuffles the set-aside identities into the Traitor Deck. Unrevealed dancers remain held. The panel has no phase restriction, no subset choice and no second choice after drawing. [Printed Tleilaxu face](https://boardgamegeek.com/image/7767032/dune-ecaz-and-moritani)

Implementation composition:

1. Bind the native owner, currently held Tleilaxu Nexus card, event, turn/phase, complete original Face Dancer group and original reserve order.
2. Take the entire revealed group out of held custody. Draw exactly its size from the original reserve. New dancers are unrevealed; retained dancers keep their identities/statuses.
3. Shuffle the removed identities into the remaining reserve, spend the physical Nexus card and commit one receipt. The removed identities cannot be among this action's replacement draws. No player acknowledgement is needed after this automatic operation.
4. Return only public owner/count/effect information to other seats. New identities, reserve order and historical private snapshots stay server/owner-only. Reads and retries cannot repeat the draw, shuffle or reset.
5. Use the shared physical census from [Harkonnen Nexus](NEXUS_HARKONNEN_RULES.md); do not recreate cards from current leaders or borrow held identities when a malformed reserve is short.

E1's native third-reveal cycle is different: after all three reveal, return all three, shuffle, then draw three. Its ordinary Mentat action replaces one unrevealed dancer, also shuffling before drawing. Preserve both operations and their original usage counters. Cunning does not consume ordinary Mentat replacement or grant a second such replacement. In a stable ordinary game the third reveal already completes native cycling, so Cunning normally sees one or two revealed dancers. Do not manufacture an interruption before that mandatory reset or trigger another reset after Cunning. [E1 pp.6–7](https://www.gf9games.com/dunegame/wp-content/uploads/2020/09/IxianAndTleilaxuRulebook.pdf#page=7)

With zero revealed dancers there is no replacement group. No retrieved source grants a free zero-card reshuffle. A nonempty-group runtime prerequisite is the supported useful action boundary; this audit does not establish a general rule permitting voluntary no-effect Nexus disposal. The native Karama table stops ordinary Mentat replacement but excludes other Face Dancer effects, supporting treatment of this distinct refresh without that ordinary cancellation window. This is source composition, not blanket Nexus immunity.

Recommended pure API: `refreshRevealedFaceDancers(snapshot, universe, {event, owner, turn, phase}, random) -> {state, receipt}`. It should require no selected IDs and return a completed operation. Engine timing must preserve any pending native reveal/cycle transaction instead of replacing that transaction's reserved dancer underneath it.

## Secret Ally: established facts

Only an unallied holder in a game without Tleilaxu can use this mode. During Revival the panel grants one own leader for free **and** up to five own forces at one spice each. The five forces are not free; zero forces is permitted by the quantity wording. This is neither the Ghola card's alternative choice nor an acquisition of foreign leaders. [Printed Tleilaxu face](https://boardgamegeek.com/image/7767032/dune-ecaz-and-moritani)

The amount and price override normal values for the granted return. A native faction's free rate does not automatically make these specified paid counters free. Recruits doubles ordinary free rates; it does not say to double this fixed five. Preserve exact normal/starred counters and actual bank payment, never battle strength as a counter count. Returned forces ordinarily enter reserves. [Base p.9](https://www.gf9games.com/dunegame/wp-content/uploads/Dune-Rulebook.pdf#page=9), [E3 p.11](https://www.gf9games.com/dune/wp-content/uploads/EcazMoritani-Rulebook-LOWRES.pdf#page=11)

Important compositions and exclusions:

- Tleilaxu is absent, so no native Tleilaxu revival income, negotiated service or special Karama can apply. Secret Ally does not import the faction's entire ability sheet. At the time of playing it, the holder also has no formal Emperor ally; do not offer Emperor-funded extras as part of this transaction. A later alliance/ordinary action has its own rules.
- A Cheap Hero is a Treachery Card, not a dead leader disc, and is not revivable. Neither a living captured leader nor an opponent's dead leader becomes eligible through this grant.
- Advanced Fedaykin/Sardaukar share the one-per-turn revival limit across producers. The November FAQ preserves that limit through Ghola, Emperor extras and Tleilaxu. Basic stars retain physical identity without importing the Advanced cap. Ixian Cyborgs have no matching one-per-turn restriction. [November FAQ p.2](https://www.gf9games.com/dune/wp-content/uploads/2020/11/Dune-FAQ-Nov-2020.pdf#page=2), [E1 p.9](https://www.gf9games.com/dunegame/wp-content/uploads/2020/09/IxianAndTleilaxuRulebook.pdf#page=9)
- The one-spice force price expressly applies to this card's force group, including permitted typed counters. Do not call ordinary Fremen paid-revival validation and silently reject the explicit card grant, or charge Ixian Cyborgs their ordinary three-spice price.
- Kwisatz is revived like a leader, supporting its own Atreides identity as a candidate once accounting is resolved. Auditor is CHOAM's own leader, with existing special revival/slot rules. Duke may only be revived by Ecaz, including through Ghola; its destination/cycle questions remain pending. These exceptional identities cannot resolve the general leader-accounting question. [Base p.17](https://www.gf9games.com/dunegame/wp-content/uploads/Dune-Rulebook.pdf#page=17), [CHOAM & Richese p.8](https://www.gf9games.com/dune/wp-content/uploads/2021/11/CHOAM-Rulebook-low-res.pdf#page=8), [Ecaz revival audit](ECAZ_REVIVAL_RULES.md)
- Southern Hemisphere applies to newly revived starred Fedaykin and therefore needs this producer's exact earned group, subject to the existing threshold/splitting/arrival boundaries. Tleilax's own Homeworld cannot confer a native benefit when Tleilaxu is absent. High Ix's paid-Cyborg trigger may apply to an actual positive payment here; its existing bonus quota/shortage questions remain unresolved. Preserve both [deployment](HOMEWORLD_REVIVAL_DEPLOYMENT_RULES.md) and [Ix benefit](HOMEWORLD_BENEFITS_RULES.md) gates.

## Secret Ally questions that still affect implementation

The inspected E3 FAQ does not answer these. Keep Secret Ally gated rather than implementing a smaller interpretation disguised as the complete effect.

| Issue | Concrete interpretations requiring a ruling |
| --- | --- |
| Ordinary force accounting | Is this an independent five-counter return in addition to normal revival, or a replacement/expanded normal allowance? For example, may a player take normal three and then five with this card, and does the card spend subsequent free allowance? |
| Leader slot and eligibility | Does the free leader use the ordinary one-leader slot, or grant an additional revival? Does its unqualified permission waive the all-leaders-unavailable condition and the distinct face-down/repeated-death restriction? |
| Partial combined benefit | Can a holder play only the paid-force portion when no eligible dead leader exists, or decline an available leader while taking forces? The panel joins one leader and the force allowance with “and,” unlike an explicitly optional leader clause. |

Normal leader revival has an unavailable-roster trigger and a separate repeated-death cycle. E1 expressly permits face-down leaders for its negotiated service, and the FAQ separately discusses native foreign-ghola revival. Neither automatically grants those permissions to an absent-faction Nexus effect. Similarly, the FAQ's Emperor extras are explicitly additional, while this panel does not settle its ordinary counter debit. [Base p.9](https://www.gf9games.com/dunegame/wp-content/uploads/Dune-Rulebook.pdf#page=9), [E1 p.7](https://www.gf9games.com/dunegame/wp-content/uploads/2020/09/IxianAndTleilaxuRulebook.pdf#page=7), [November FAQ p.6](https://www.gf9games.com/dune/wp-content/uploads/2020/11/Dune-FAQ-Nov-2020.pdf#page=6)

Coordinator question recommendation: ask explicitly about independent versus ordinary force/leader allowance, waived leader prerequisites, and whether the leader portion is optional. The related [Ambassador accounting questions](TLEILAXU_AMBASSADOR_RULES.md) are already pending; do not duplicate those or assume an answer covers differently worded Nexus text. No user question was sent by this audit.

Future revival quote inputs should retain source `nexusTleilaxuSecretAlly`, chosen leader/Kwisatz identity, exact normal/starred force counts, payment and existing usage histories. Require a resolved accounting policy before mutating ordinary counters. A receipt must preserve original revival, subsequent Homeworld deployment and phase continuation once; no card/force/spice effect should be inferred afresh from a restored hand or current Tanks.
