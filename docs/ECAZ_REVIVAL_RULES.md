# Ecaz revival and Duke Vidal

Bounded primary-source review, 2026-09-06. This document supplements `DUKE_VIDAL_RULES.md` and separates the ordinary arithmetic and eligibility rules from unresolved shared-disc custody and cycle questions. No runtime edits were made.

## Explicit expansion rules

Ecaz may revive Duke for **5 spice regardless of how many leaders are dead**. Its ordinary leaders become revivable with **five leaders in the Tanks, including Duke**. The clarification expressly permits this while Ecaz still holds one living leader, regardless of which leader that is. Only Ecaz may revive Duke, including through the Ghola Treachery Card. [GF9 Ecaz & Moritani, printed pp. 8–9](https://www.gf9games.com/dune/wp-content/uploads/EcazMoritani-Rulebook-LOWRES.pdf)

Straightforward first-cycle examples are four dead ordinary Ecaz leaders plus dead Duke with the fifth ordinary leader alive, or five dead ordinary leaders with Duke alive. Duke’s **strength remains 6**; five is his special normal revival price, not a replacement battle value. These rules do not authorize Moritani or Tleilaxu foreign-ghola revival of the disc.

## Who controls Duke after revival?

The same p. 9 clarification restricts Ecaz’s acquisition of Duke to its Ambassador, then separately makes Ecaz his exclusive reviver. It does **not explicitly state** whether revival grants active Ecaz control or puts the living disc aside for later acquisition. [GF9 Ecaz & Moritani, printed p. 9](https://www.gf9games.com/dune/wp-content/uploads/EcazMoritani-Rulebook-LOWRES.pdf#page=9)

The ordinary base rule makes a revived leader playable. Applying that ordinary result to the special Ecaz-only revival strongly supports active Ecaz custody, treating the Ambassador sentence as acquisition of a living shared disc. The competing literal reading revives Duke to the shared set-aside area so that Ambassador-only acquisition remains universal. The retrieved expansion does not expressly choose between those readings. The Ghola FAQ permits a revived leader to fight in the same Battle phase, but does not specifically resolve Duke’s custody. [GF9 base rules, printed pp. 9, 22](https://www.gf9games.com/dunegame/wp-content/uploads/Dune-Rulebook.pdf)

**Implementation boundary:** do not certify either controller assignment as an explicit Duke FAQ result. Obtain a supported interpretation before activating revival, especially Ghola during Battle. Persisting `dead=false` while silently choosing `controller=null` or Ecaz changes whether the paid card/action is useful immediately. If Ecaz control is selected, it must be explicit shared custody rather than inserting Duke into the native five-leader array.

## Frequency, prices and Tleilaxu

Normal leader revival remains **one per Revival phase per faction**, including Tleilaxu’s early-revival service. The official FAQ expressly says that service changes when revival is available, not how many leaders another faction may revive. Tleilaxu cannot pay for its ally’s revival. [GF9 November 2020 FAQ, printed p. 6](https://www.gf9games.com/dune/wp-content/uploads/2020/11/Dune-FAQ-Nov-2020.pdf#page=6)

Ecaz’s special price and threshold state no additional normal-leader slot. Duke revival should consume that ordinary slot, alongside an ordinary Ecaz leader, absent a separate effect granting an extra revival. A Ghola card is a separate card effect; do not infer its accounting from the ordinary paid request.

Tleilaxu’s alliance discounts force and leader revival by half, rounded up. Applying that independent discount to Duke’s printed five-spice cost gives **3 spice**. Canceling the discount restores **5**, not 6. Normal paid revival payments go to Tleilaxu when that income advantage applies; otherwise to the bank. These are direct arithmetic compositions, not a retrieved Duke-specific pricing example. [GF9 Ixians & Tleilaxu, printed p. 7](https://www.gf9games.com/dunegame/wp-content/uploads/2020/09/IxianAndTleilaxuRulebook.pdf#page=7)

The Tleilaxu early-price service is normally for factions with fewer than five leaders in the Tanks; at normal eligibility, ordinary revival applies. Duke already has a special permission independent of the dead-leader threshold. Do not accidentally require Tleilaxu permission or classify every Duke request as Tleilaxu early revival merely because fewer than five ordinary Ecaz leaders are dead. The optional negotiated alternative and exotic face-down cases have no retrieved Duke-specific clarification.

## Threshold versus revival cycles

Base revival begins once the prerequisite is met and continues one leader per turn until the eligible leaders have been revived. A revived leader killed again remains unavailable for another ordinary revival until the other revivable leaders complete their corresponding cycle. Thus Ecaz’s raw five-dead count is an **opening threshold**, not a condition to recheck after every first-cycle return and not permission to ignore face-down death sequencing. [GF9 base rulebook, printed p. 9](https://www.gf9games.com/dunegame/wp-content/uploads/Dune-Rulebook.pdf#page=9)

Current `normalRevivalCycle` examines only the native roster; unchanged, it misses four native deaths plus Duke opening Ecaz’s cycle. Merely appending Duke to that roster introduces other errors: sixth-leader inventory, default control, and a requirement that all six become unavailable. A separate shared-disc eligibility input or cohort is required.

The expansion does not detail every subsequent cycle across six identities when Duke can be revived early, die repeatedly, remain aside, or be controlled elsewhere. Preserve individual death history and the opened normal cycle. Do not label an unverified minimum/maximum of death counters as a publisher ruling. Captured ordinary leaders also retain the base FAQ’s no-native-leader-available exception; that is distinct from counting an unavailable shared disc as actually dead. [GF9 base rulebook, printed p. 22](https://www.gf9games.com/dunegame/wp-content/uploads/Dune-Rulebook.pdf#page=22)

A concrete algorithm hazard from the parallel review: the sixth survivor could remain alive through multiple five-disc cohorts and then die for the first time. Requiring its first death count to equal a globally advanced `revivalCycle` would incorrectly treat that face-up first-death disc like an already-revived, face-down disc. Duke’s independent repeated revivals can likewise skew a minimum-death calculation. This supports explicit cycle/cohort bookkeeping, but the exact transition policy still needs to be resolved rather than inferred from numerical convenience.

## Karama boundary

The E3 Ecaz table lists Ambassador, Occupy, Loyalty and Collection; it contains **no dedicated Ecaz Revival row**. Omission is not an explicit immunity ruling. The Tleilaxu table specifies cancellation of discounts, early revival and income; its advanced special Karama can prevent a faction’s ordinary revivals for the turn. Keep those existing response scopes distinct from whether Ecaz’s own five-spice/threshold advantage is independently cancelable. No retrieved Ecaz-specific answer resolves that last issue. [GF9 E3, p. 16](https://www.gf9games.com/dune/wp-content/uploads/EcazMoritani-Rulebook-LOWRES.pdf#page=16), [GF9 Ixians & Tleilaxu, pp. 5, 13](https://www.gf9games.com/dunegame/wp-content/uploads/2020/09/IxianAndTleilaxuRulebook.pdf)

## Verification boundary

Checked official indexed GF9 p. 8/9 passages, the base revival text, Ixian/Tleilaxu alliance and early-revival text, and the November 2020 FAQ p. 6 against existing publisher-authored local extracts. Targeted official GF9 and designer-site searches returned no written Duke-after-revival or six-disc repeated-cycle example. This records a retrieval limit, not proof that no clarification exists. Existing direct publisher download restrictions and crawler dates were not treated as evidence of a new edition. Runtime integration, custody decisions and regression tests remain with the parent task.
