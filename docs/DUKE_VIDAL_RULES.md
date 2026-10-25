# Duke Prad Vidal lifecycle

## Occupied Ecaz grant — 26 October 2026

The occupied Homeworld now connects its living shared-Duke recipient choice,
automatic sole recipient, occupied priority and visibly provisional one-battle/
turn-end lifecycle. The user's Ecaz-only revival rule remains. Captive/Ghola
transfer, wider combinations and final acceptance are separate.
[Current source and native proof](HOMEWORLD_ECAZ_DUKE.md).

Primary-source audit, 2026-09-06. Scope: the separate leader disc and its acquisition, use, capture and revival. This is a bounded implementation contract; unresolved combinations below remain distinct from verified ordinary behavior.

## Sources and identity

The [GF9 Ecaz & Moritani rulebook](https://www.gf9games.com/dune/wp-content/uploads/EcazMoritani-Rulebook-LOWRES.pdf), printed pp. 3, 6–9 and 16, is the principal source. Relevant official indexed passages were checked against the existing local publisher-authored extract `/tmp/dune-rules/ecaz-audit.txt`. The previously inspected p. 3 leader illustration establishes strength **6**. Duke is an **Ecaz** leader with no Traitor card, separate from each faction’s five ordinary discs. Do not add a sixth traitor or change his native identity when control moves. [E3, pp. 3–4](https://www.gf9games.com/dune/wp-content/uploads/EcazMoritani-Rulebook-LOWRES.pdf#page=3)

Neither faction starts with him by an explicit setup grant. The acquisition conditions support initially setting the separate disc aside. This is ordinary composition of the component/setup and acquisition passages, not an additional printed setup sentence.

## Acquisition and tenure

Moritani checks eligibility at the **end of Shipment and Movement**. Page 9 clarifies page 6’s shorter wording: qualifying battles must involve **at least two distinct strongholds**, excluding battles involving Ecaz. Duke must not be dead. Page 6 permits taking him from a faction currently controlling him. Page 9 limits Moritani’s tenure to **one battle**, and permits reacquisition on a subsequent qualifying turn. An unused living, uncaptured Duke is set aside at turn end. [E3, pp. 6, 9](https://www.gf9games.com/dune/wp-content/uploads/EcazMoritani-Rulebook-LOWRES.pdf#page=6)

This is a prospective battle check after everyone’s movement, not two historical battle results or two opponents in one stronghold. Ordinary battle eligibility excludes allies and advisor-only occupation. Storm-separated forces that cannot battle do not qualify. Homeworlds are not strongholds; no ordinary-territory count should substitute for the specified type. The Hidden Mobile Stronghold is a stronghold; unlike Terror placement, Duke’s condition contains no explicit exclusion for it. These are compositions with ordinary battle and territory rules.

Ecaz’s own Ambassador can acquire Duke when he is not in the Tanks, captured or a ghola. Ecaz retains acquired Duke until battle use or Moritani takes him. The Ambassador also has an alliance option, after which Duke may be given to that newly allied faction for the turn. The passage’s availability and choice structure must be preserved; it does not grant arbitrary standing transfers to any ally. [E3, pp. 7, 9](https://www.gf9games.com/dune/wp-content/uploads/EcazMoritani-Rulebook-LOWRES.pdf#page=7)

For ordinary use, surviving Duke leaves temporary active custody after his one battle; death places the same disc in the Tanks. Do not automatically hand him to the opposing faction or reset his death history. The rules do not authorize another Moritani acquisition in the same turn merely because battle use released him.

## Karama, death and revival

Karama may prevent **Moritani acquiring** Duke; it has no effect if Moritani already holds him. Resolve a declaration/response before changing custody. Cancellation must leave the existing holder and disc state intact. This row does not authorize canceling battle use or stripping already-held Duke. [E3, p. 16](https://www.gf9games.com/dune/wp-content/uploads/EcazMoritani-Rulebook-LOWRES.pdf#page=16)

Only **Ecaz** may revive Duke, explicitly including revival with the Ghola Treachery Card. Ecaz’s printed normal price is **5 spice**, despite strength 6, with no prerequisite number of dead leaders. Ecaz may also revive its other leaders normally once five leaders are in the Tanks, counting Duke, even if it still holds one living leader. The statement that Ecaz gains Duke through its Ambassador cannot erase this expressly stated revival exception. [E3, pp. 8–9](https://www.gf9games.com/dune/wp-content/uploads/EcazMoritani-Rulebook-LOWRES.pdf#page=8)

Consequently, a Moritani holder cannot revive Duke with its own Ghola, and Tleilaxu’s ordinary foreign-ghola machinery must not revive him. Do not equate the printed five-spice price with strength for battle, assassination bounty or other effects. The cited paragraphs do not supply special exemptions from ordinary one-leader revival frequency, prevention or independent discounts; do not invent such exemptions from “always” alone. Combined discount/prevention behavior should be tested against those powers’ existing rules.

The [base Harkonnen capture rules, p. 17](https://www.gf9games.com/dunegame/wp-content/uploads/Dune-Rulebook.pdf#page=17) permit a surviving losing leader, including the battle’s leader, to be captured unless already used elsewhere. A captive may be executed or used once, then returned if alive; captives also return when all native Harkonnen leaders die. Dead captives return to native-faction revival custody. Duke’s p. 6 wording explicitly recognizes that he may be captured, so blanket permanent immunity is unsupported.

## Material unresolved combinations

| Combination                                         | Evidence boundary and safe implementation scope                                                                                                                                                                                                                                                                        |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Moritani acquisition from captured or ghola custody | The 15 October no-Skills native Nexus follow-up below connects living Harkonnen captivity under an explicit provisional takeover policy. Public qualification uses the public snapshot; actual resolution never revives an executed disc. Foreign-Ghola Duke remains forbidden by Ecaz-only revival. |
| Duke used in a lost battle against Harkonnen | Original no-Skills E3 Nexus retains the eligible surviving disc in the real capture pool through a validated release witness. This capture-before-final-return composition is provisional; see the dated follow-ups below. |
| Returning a captured Duke | The provisional native return policy restores an unused valid prior tenure on native early return; used/dead/expired tenure is set aside. Nexus liberation and qualifying Moritani acquisition permanently clear captivity, never saving a captor to restore later. |
| Loan to the new Ecaz ally | Basic has an optional same-disc first version after accepted Ambassador alliance consent. The authorized supplied Advanced PDF, physical p30 Ecaz A, instead adds an available Duke automatically after consent and sets an unused disc aside at turn end; that path is now connected without another acknowledgement. One-battle release is still provisional. Capture and alliance-break interactions remain for refinement. |
| Ecaz co-occupied battles                            | Ecaz’s Occupy rules distinguish participating forces from the faction chosen to fight. Duke eligibility excludes battles involving Ecaz, but no direct combined example decides every Ecaz-ally designation case. Ordinary faction-pair battle lists alone do not certify the full Occupy interaction.                 |
| Revival alternatives                                | Ecaz’s Tleilaxu Ambassador effect and sharing an Ambassador benefit may interact with the absolute Ecaz-only restriction. No retrieved specific exception permits another faction to revive Duke. Keep that restriction unless a primary clarification establishes otherwise.                                          |

## Concrete current engine implications

- Use one persistent disc with explicit native identity, active controller or set-aside state, death history, battle-use/turn tenure, and capture/loan metadata. Merely appending an Ecaz-identity leader to a roster grants unintended default control through `controlsLeader`.
- `projectLeader` currently assumes the native faction has a seated player. Moritani-only tables still need Duke without an Ecaz seat; projection must not dereference a missing owner.
- `battles(g)` currently calls mutating `settleAdvisors(g)`. Do not use it directly from a pure availability helper or private-view projection. Snapshot after resolved movement/advisor obligations or extract a pure calculation.
- End-movement acquisition must happen once before battle preparation, with a persisted Karama response. It must not run per player’s movement completion or again after reload.
- Battle settlement, capture selection, Ghola effects, normal revival, foreign-ghola actions, native-leader counts and turn-end cleanup all currently operate on ordinary rosters. Audit each entry point; one new leader record or UI option does not implement the lifecycle.
- Terror Assassination now uses its explicit provisional effective-control pool, not the old ordinary-five-disc gate; see [the pool contract](MORITANI_ASSASSINATION_SNEAK.md#assassination-pool-adopted-provisional-composition-15-october-2026).

No source edits to runtime or live-room mutations were performed. Targeted official GF9 and [designer-site](https://futurepastimes.com/dune-ecaz-moritani) searches did not yield written answers resolving the combinations above. Direct publisher download has previously returned 403; indexed crawler dates are not treated as rule revision dates. Parent owns runtime integration and behavioral validation.

## Moritani integration checkpoint

The subsequent bounded runtime slice implements a separate `dukeVidal` disc, end-of-movement acquisition response, a per-turn acquisition marker, ordinary battle use/death, and end-turn release. `projectLeader` now tolerates an absent Ecaz seat, and the temporary controller is explicit in the projected leader. Native rosters and traitor inventories remain unchanged. New-storm initialization clears the disc’s prior `usedAt`, while consuming Duke preserves death history. Advanced Harkonnen configurations and exceptional captured/ghola custody remain uniformly gated; Ecaz Ambassador and revival integration are not certified by this slice.

`tests/duke-vidal-engine.test.ts` passed 10 focused cases: completed movement timing and JSON restoration; public/own projection and inventory conservation; excluded battles and distinct-stronghold counting; Hidden Mobile Stronghold; Karama cancellation; full Basic living/dead battle outcomes with six-spice death bounty; Advanced casualty resumption after reload; turn expiry and later reacquisition; the capture configuration gate; and legal Duke plan candidates from all four AI profiles. Tests used isolated in-memory games, not persisted human rooms. Independent read-only review found no additional material lifecycle defect; a separate agent owns the identified Truthtrance identity-parser integration and its regression.

## Final integration verification

The integrated896-unit suite,45 persisted/API tests, typecheck, lint and build pass. Four additional Duke/Truthtrance regressions verify that actual battle-plan questions and their logs recognize the shared disc, while traitor facts and absent-disc claims reject it. The public identity catalog includes Duke; native roster/traitor inventories remain unchanged. The custody helper preserves unresolved allied loans at expiry rather than choosing a return destination. Desktop browser QA verifies actual acquisition, full readable inspection, one-battle use, set-aside status and refreshed later battle options. Full expansion starts remain disabled.


## Direct Ecaz acquisition follow-up

The direct self-acquisition feature was subsequently implemented and verified. See [Ecaz Duke acquisition](ECAZ_DUKE_ACQUISITION.md) for the integrated controls, AI, persistence and actual battle playtest. Alliance/loan alternatives, revival and exceptional capture remain separate unfinished work. Earlier readiness and integration statements above are historical.

## Ecaz revival follow-up (28 September 2026)

Ecaz alone can revive the canonical dead shared disc through ordinary paid
revival or a real Ghola card. The user selected the living **set-aside** result
after either return: no automatic Ecaz controller, source or acquisition turn.
This is a product interpretation, **not** a published Duke-specific ruling.
The printed five-spice normal price, existing allied discount/stop/payment
accounting, ordinary slot and one physical death history remain separate from
the Ghola card's free return. Native first-cohort five-in-Tanks eligibility is
supported; repeated six-disc cycles and exceptional custody stay guarded.
See [Ecaz revival](ECAZ_REVIVAL_RULES.md#selected-product-interpretation-28-september-2026).

## Original capture and legal Ghola composition — 14 October 2026

The standalone Ecaz/classic Nexus envelope without Skills now includes
original Advanced Harkonnen capture, Keep/Execute, captive battle use and
all-native-Harkonnen-dead return for the separate disc. This supersedes the
historical blanket exclusion above only within that already admitted profile.
The original Ambassador acquisition and Ecaz-only revival use the same scope;
paired Moritani/Harkonnen, shared-disc training and unrelated combinations
are not opened.

The original capture pool retains a surviving just-used losing Duke through
a validated battle-release witness. Prior tenure is retained underneath
captivity; private selection/execution remains concealed from unrelated seats.
Execution pays two spice, records at least two deaths and returns the dead
disc to Ecaz's Tanks. A real public use/return, Nexus liberation or revival
clears the private snapshot rather than exposing server-only custody fields.

The selected **provisional** native return policy restores only unused,
unexpired prior control; otherwise the disc is set aside. Actual Nexus
liberation removes captivity permanently and ends after one battle or the
turn, never returning Duke to the old captor. This is a recommended product
composition, not an inspected publisher priority/return ruling.

Ecaz's actual Ghola returns Duke alive and set aside, without ordinary slot
use; separate Cunning can then acquire him. Only Ecaz revives him: no
Tleilaxu-owned foreign Ghola is manufactured. Native identity, strength6,
five-disc faction rosters, absent Traitor card and death history remain.
[Current controls, verification and remaining gates](NEXUS_ECAZ_RULES.md#original-captured-duke-and-ecaz-ghola-composition--14-october-2026).

## Native repeated revival cohorts — 14 October 2026

Ecaz's normal native returns no longer stop merely because any shared or
native disc has died more than once. A provisional identity-tracked cohort
preserves five-Tanks opening, native unavailable-roster exceptions and
remaining ordinary returns without equating Duke's independent death history
to the native cohort number. Duke remains separate, costs5 normally and
returns set aside; he neither becomes a sixth native leader nor a foreign
Ghola. Actual ordinary/Ghola returns, native controls and four legal profiles
are connected. The old repeated-cycle guard above is historical.
[Current policy, original native proof and remaining gates](ECAZ_REVIVAL_RULES.md#identity-tracked-repeated-cohorts--14-october-2026).

## Native Moritani acquisition from captivity — 15 October 2026

Original standalone, paired and mixed-family **no-Skills E3 Nexus** predicates
now admit Advanced Harkonnen, retaining their existing optional-module
envelopes. Skills/Harkonnen, shared-Duke training and unrelated non-Nexus
guards remain. Ecaz's Ambassador still cannot acquire a captured/dead/Ghola
disc; only Ecaz may revive Duke. No foreign-Ghola Duke source is introduced.

Under the selected **provisional takeover composition**, qualifying native
Moritani takes the actual living captive from its current Harkonnen controller.
Clear captivity and its private snapshot permanently; preserve death and
battle-use history, native Ecaz identity and the original one-battle/current-turn
tenure. Use or unused expiry never restores the old captor. This composes the
printed take-from-current-controller grant; it is not a retrieved capture-priority
or return FAQ. Ecaz Occupy participation/designation remains a separate boundary.

**Public availability composition:** qualification uses the public shared-disc
snapshot, not concealed execution status. A privately executed disc therefore
does not remove or identify the public qualifying response window. Original
Karama cancellation preserves the capture and private snapshot. If allowed,
the public acquisition resolves actual availability: a dead executed Duke stays
dead in Ecaz's Tanks, without a Moritani resurrection, and its unavailable state
becomes public. This disclosure-at-resolution policy is provisional, distinct
from promising permanent secrecy for an execution after a public custody effect.

Original native three-seat play supplies the real capture lottery, Keep/Execute,
two later distinct stronghold battles, original Karama, actual battle use and
unused expiry. The actual styled390px table completes movement, shows Duke6
Ready in Moritani's leaders, then removes him after original battle use.
Another actual Harkonnen win uses captive Duke6 before the existing Moritani
private ability kills **native Harkonnen** Beast Rabban4 and replaces its
physical card at Mentat. Random Terror can kill the captive Duke for six.
See [Assassinate identity](MORITANI_ASSASSINATE_LEADERS.md#native-harkonnen-battle-identity--15-october-2026)
and [Terror policy/evidence](MORITANI_ASSASSINATION_SNEAK.md#assassination-pool-adopted-provisional-composition-15-october-2026).
This is local changed-path proof, not saved-room, deployed or complete-mode acceptance.

## Native Moritani loss to Ecaz's shared disc — 15 October 2026

An actual original Ecaz Ambassador acquisition and surviving Duke6 win now open
Moritani's distinct Advanced native-Ecaz Traitor choice. Actual Sanya Ecaz4
pays four, not Duke's six; Duke stays alive, used and set aside, with no new
Traitor or native-roster copy. Original Guild-paid arrival now settles income
before the queued Ambassador rather than being rejected by a prospective
busy-control prediction. Native counts, exclusive Ecaz revival, original
tenure and all remaining custody/source gates stay separate.
[Canonical played-disc/target distinction, original controls and evidence](MORITANI_ASSASSINATE_LEADERS.md#canonical-winning-discs-and-native-targets--15-october-2026).

