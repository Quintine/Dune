# Duke Prad Vidal lifecycle

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
| Moritani acquisition from captured or ghola custody | Ecaz’s Ambassador explicitly excludes both; Moritani’s acquisition excludes only Tanks and says to take Duke from any controller. Do not silently copy the Ecaz exclusions as a confirmed Moritani rule. The interaction with concealed capture and the apparent ghola restriction needs an explicit supported policy. |
| Duke used in a lost battle against Harkonnen        | One-battle tenure and postbattle capture both apply. No retrieved Duke-specific text orders release versus selection into the capture pool. Removing him first changes the random pool; keeping him first can change custody. Gate this combination until resolved rather than choosing by handler order.              |
| Returning a captured Duke                           | Native identity is Ecaz, but temporary prior custody may be Moritani or a loaned ally. Base capture return plus Duke’s special acquisition restrictions do not explicitly settle active-control versus set-aside destination in every combination. Preserve prior custody rather than discarding that information.     |
| Loan to the new Ecaz ally                           | The printed loan lasts this turn. No retrieved passage resolves unused-loan return destination, an alliance breaking mid-loan, or one-battle tenure for a non-Moritani/non-Ecaz recipient. Preserve owner/controller/loan expiry separately and gate unresolved combinations.                                          |
| Ecaz co-occupied battles                            | Ecaz’s Occupy rules distinguish participating forces from the faction chosen to fight. Duke eligibility excludes battles involving Ecaz, but no direct combined example decides every Ecaz-ally designation case. Ordinary faction-pair battle lists alone do not certify the full Occupy interaction.                 |
| Revival alternatives                                | Ecaz’s Tleilaxu Ambassador effect and sharing an Ambassador benefit may interact with the absolute Ecaz-only restriction. No retrieved specific exception permits another faction to revive Duke. Keep that restriction unless a primary clarification establishes otherwise.                                          |

## Concrete current engine implications

- Use one persistent disc with explicit native identity, active controller or set-aside state, death history, battle-use/turn tenure, and capture/loan metadata. Merely appending an Ecaz-identity leader to a roster grants unintended default control through `controlsLeader`.
- `projectLeader` currently assumes the native faction has a seated player. Moritani-only tables still need Duke without an Ecaz seat; projection must not dereference a missing owner.
- `battles(g)` currently calls mutating `settleAdvisors(g)`. Do not use it directly from a pure availability helper or private-view projection. Snapshot after resolved movement/advisor obligations or extract a pure calculation.
- End-movement acquisition must happen once before battle preparation, with a persisted Karama response. It must not run per player’s movement completion or again after reload.
- Battle settlement, capture selection, Ghola effects, normal revival, foreign-ghola actions, native-leader counts and turn-end cleanup all currently operate on ordinary rosters. Audit each entry point; one new leader record or UI option does not implement the lifecycle.
- Keep current exceptional Assassination-pool gates: adding Duke changes a random leader pool and must not silently pass the ordinary five-native-leader validator.

No source edits to runtime or live-room mutations were performed. Targeted official GF9 and [designer-site](https://futurepastimes.com/dune-ecaz-moritani) searches did not yield written answers resolving the combinations above. Direct publisher download has previously returned 403; indexed crawler dates are not treated as rule revision dates. Parent owns runtime integration and behavioral validation.

## Moritani integration checkpoint

The subsequent bounded runtime slice implements a separate `dukeVidal` disc, end-of-movement acquisition response, a per-turn acquisition marker, ordinary battle use/death, and end-turn release. `projectLeader` now tolerates an absent Ecaz seat, and the temporary controller is explicit in the projected leader. Native rosters and traitor inventories remain unchanged. New-storm initialization clears the disc’s prior `usedAt`, while consuming Duke preserves death history. Advanced Harkonnen configurations and exceptional captured/ghola custody remain uniformly gated; Ecaz Ambassador and revival integration are not certified by this slice.

`tests/duke-vidal-engine.test.ts` passed 10 focused cases: completed movement timing and JSON restoration; public/own projection and inventory conservation; excluded battles and distinct-stronghold counting; Hidden Mobile Stronghold; Karama cancellation; full Basic living/dead battle outcomes with six-spice death bounty; Advanced casualty resumption after reload; turn expiry and later reacquisition; the capture configuration gate; and legal Duke plan candidates from all four AI profiles. Tests used isolated in-memory games, not persisted human rooms. Independent read-only review found no additional material lifecycle defect; a separate agent owns the identified Truthtrance identity-parser integration and its regression.

## Final integration verification

The integrated896-unit suite,45 persisted/API tests, typecheck, lint and build pass. Four additional Duke/Truthtrance regressions verify that actual battle-plan questions and their logs recognize the shared disc, while traitor facts and absent-disc claims reject it. The public identity catalog includes Duke; native roster/traitor inventories remain unchanged. The custody helper preserves unresolved allied loans at expiry rather than choosing a return destination. Desktop browser QA verifies actual acquisition, full readable inspection, one-battle use, set-aside status and refreshed later battle options. Full expansion starts remain disabled.


## Direct Ecaz acquisition follow-up

The direct self-acquisition feature was subsequently implemented and verified. See [Ecaz Duke acquisition](ECAZ_DUKE_ACQUISITION.md) for the integrated controls, AI, persistence and actual battle playtest. Alliance/loan alternatives, revival and exceptional capture remain separate unfinished work. Earlier readiness and integration statements above are historical.
