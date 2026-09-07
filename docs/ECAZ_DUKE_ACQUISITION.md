# Ecaz Ambassador: direct Duke acquisition

Integrated 7 September 2026. Ecaz can now choose **Acquire Duke Vidal for Ecaz** when an eligible entrant reaches its reusable Ambassador in supported development games. The server transfers the existing shared disc, returns the token to supply and resumes the entrant’s remaining actions. There is no additional confirmation or new generic Ambassador cancellation response.

The direct acquisition and tenure follow the publisher’s [Ecaz & Moritani rules, pp.7–9](https://www.gf9games.com/dune/wp-content/uploads/EcazMoritani-Rulebook-LOWRES.pdf). Fresh indexed publisher retrieval rechecked eligibility outside Tanks, captured or ghola custody. The prior [Duke source audit](DUKE_VIDAL_RULES.md) and [remaining effects readiness review](ECAZ_REMAINING_EFFECTS_READINESS.md) record the separate unresolved combinations. This implements the direct self-acquisition choice; it does not certify the token’s alliance and loan alternatives, full Ecaz or a complete expansion game.

## Rules and authoritative execution

`game/ecaz-duke-acquisition.ts` quotes a detached next `DukeState` using the existing custody helper. It requires a current seated Ecaz owner and the existing canonical shared disc. It preserves identity, death history and `usedAt`; it never appends a leader to a native roster, adds a Traitor card, manufactures a replacement disc, samples randomness or grants new battle-use permissions. Starting-force initialization remains the normal disc-creation boundary.

The actual entry event, turn/phase, decision owner, physical placed Ecaz token, entrant eligibility and explicit `choice:'duke'`/self-beneficiary are checked before the token commits. Current native-roster duplication rejects through the same availability descriptor. An existing ally does not prevent Ecaz from acquiring for itself. An eligible Duke controlled by Moritani transfers as the same physical disc. The controller/source/turn update and token return occur in one authoritative action, followed by the existing Ambassador suffix.

The reusable token does not belong to the five-token random cohort. Its trigger leaves that cohort unchanged and never replenishes it. The chronicle distinguishes reusable return from ordinary set-aside tokens and records previous Duke control, the new tenure and resumption of the entrant’s actions. Successful acquisition emits an automatic notice using Ecaz’s faction color and the existing configurable 1.5-second notice queue.

The existing leader lifecycle supplies Duke to Ecaz’s battle-plan options and consumes temporary custody after battle use. Death retains the same disc in Tanks. Unused source-Ecaz control persists across turns, while a later qualifying Moritani acquisition still takes the same disc. Existing Advanced-Harkonnen and exceptional custody limits remain in force; this feature does not order the unresolved capture/return combination.

Already controlling Duke, acquisition for an ally, alliance formation and loans remain explicitly unfinished. The same-owner restriction is a development boundary, not an asserted printed prohibition on a no-op trigger. Unsupported or unavailable commands preserve the placed token; declining the opportunity also preserves Duke and resumes the entrant.

## Controls, privacy and AI

Only the actual owner’s Ecaz-token offer contains the `dukeAcquisition` descriptor. The entry panel renders its explicit acquisition button, current availability reason, portrait inspector and leave-in-place alternative. Other seats cannot submit the choice. Exceptional or concealed custody yields a generic unavailable reason rather than exposing a captor/ghola identity; concealed-state private variants cannot vary the availability descriptor. Advanced-Harkonnen configurations are uniformly unavailable before inspecting that custody.

All four AI profiles use the owner’s projected descriptor to acquire or decline. They do not inspect raw Duke custody, foreign hands, spice or Traitor cards. Enabling the Ecaz handler does not add Ecaz to BG’s random-token copy choices.

The complete Ambassador gameplay explanation remains readable in the token inspector, including printed alternatives that are not implemented yet. Separate coverage copy identifies those limits. Duke’s shared inspector and internal reference now distinguish unused Ecaz tenure from Moritani end-turn expiry. The public Ambassador inventory is collapsed by default behind a native keyboard-accessible summary showing supply/placed counts; expanding it retains every zone and inspector. Actual entry and placement choices remain open.

## Traceable coverage

| Facet | Evidence | Remaining |
| --- | --- | --- |
| Implementation | Shared acquisition quote, atomic real entry, token return, original movement/worm suffix, same-disc battle/turn lifecycle | Alliance/loan alternatives, same-owner no-op, Duke revival/capture and full Occupy |
| Player controls | Explicit action, availability text, complete token guide, Duke portrait, private-owner descriptor, compact inventory | Mobile viewport acceptance of this new panel and broader faction journeys |
| AI | Eleven tests cover all four policies in Basic/Advanced, with/without ally, unavailable choices and privacy | Strength calibration and full expansion games |
| Documentation | Internal Ecaz/Duke topics, five-facet checklist, Ambassador guide and shared-disc support metadata updated | Complete expansion reference and component inventory |
| Verification | Thirteen pure/engine, eleven AI and four production-room SQLite tests; actual browser acquisition and subsequent battle | Every legal expansion/module combination and all nested arrival interactions |

## Validation results

**2,474 rules/client/component +224 multiplayer tests pass: 2,698 total.** The new slice adds 24 rules/AI and four persistence tests. Full logs: `/tmp/dune-ecaz-duke-rules-final.log` (74.44 seconds), `/tmp/dune-ecaz-duke-multiplayer-final.log` (24.74 seconds). Final typecheck, lint and production build pass in `/tmp/dune-ecaz-duke-{type,lint,build}-final.log`. A final build followed the dedicated Duke inspector’s support-text correction.

New tests cover actual paid shipment and movement entry; Ecaz with an existing ally; transfer from Moritani; source/event/choice restrictions; missing/dead/captured/ghola/concealed or duplicate disc; exact reusable token/cohort behavior; foreign-hand independence; a real worm ride interruption and remaining ride; following battle use/death; actual next-turn tenure; and later end-of-movement Moritani takeover. The worm test begins from a staged worm decision and exercises the real ride and continuation; it is not a complete spice-deck journey. The no-replenishment case explicitly stages a completed cohort to verify Ecaz’s independent token semantics.

Production SQL tests reauthenticate through freshly loaded room code, race two identical acquisition submissions and observe one successful compare-and-swap. They preserve private cards/resources, the exact shared disc, counters and cohort. Stale/wrong-owner/unsupported commands and unavailable custody reject without writes. Actual subsequent entrant movement succeeds after both acquisition and decline. The staged prior Moritani control is a fixture, not a claim that its earlier acquisition was played in the same test.

The unchanged `/tmp/dune-sapho-base-fullgames.ts` public-start Basic runner completed **20/20 games**, counts 2–6 and all four homogeneous difficulty levels, seed 20261017: **10,450 accepted actions, zero rejected candidates/stalls and 476 JSON round trips**, 65.48 seconds. `/tmp/dune-ecaz-duke-fullgames-final.json` records unchanged game-source hashes during and after execution; combined fingerprint `1c5199b54891e91ac7fbcdbd71a18c545c2bc45a10b67cfa9a777278266ae93c`. This is a shared-engine/AI regression sample, not coverage of the gated Ecaz feature in full games.

## Browser playtest and preservation

Existing isolated QA room `8S3MRDEK` was backed up at v86, preserving both authenticated seat IDs. A conserved Advanced Ecaz/Moritani position stages an already Moritani-controlled Duke, a placed reusable Ecaz Ambassador and Ecaz forces in Arrakeen. The actual Moritani shipment of two forces creates the Ecaz offer at v87. Browser acquisition reaches v88 with the same disc now controlled by Ecaz, the token in supply, five random companions unchanged and the entrant’s paid shipment/counters intact. Refresh preserves the result.

The browser opened the Duke portrait and full Ambassador inspector, then expanded and collapsed the inventory. A controlled actual Moritani movement completion reached v89; browser Ecaz movement completion and battle choice followed. The battle-plan selector included Duke Prad Vidal at strength 6, and the browser sealed him at v92. Controlled Moritani defense/traitor actions reached v93, then browser resolution reached v94: Ecaz won, Duke is set aside alive with his Arrakeen `usedAt`, Moritani’s two forces are in Tanks, and collection credited Ecaz once. Ecaz retains three forces, 17 reserves, 12 spice and its private Shield; Moritani retains 18 reserves and 8 spice. No second acquisition or arrival was logged.

Private snapshots `/tmp/dune-ecaz-duke-qa-{before,staged,acquired,resumed,sealed,defended,final}.json` have mode 0600. Controlled scripts are `/tmp/dune-stage-ecaz-duke-qa.ts`, `/tmp/dune-resume-ecaz-duke-qa.ts` and `/tmp/dune-defend-ecaz-duke-qa.ts`. The starting position and controlled other-seat actions are explicit QA setup; the acquisition, inspection, main-player movement, battle selection, Duke plan and resolution were exercised through the browser. This is a targeted playtest, not a complete expansion game. Desktop readability was inspected; mobile-specific acceptance remains pending.

All 2,286 older non-QA room versions and state hashes still match the 08:50 UTC maintenance checkpoint; the database now contains 2,377 rooms after test fixtures. Development server session 88643 remains the controlled launch, with the next hourly maintenance check due 09:50 UTC during active work and subject to human-play safety. The removed automation was not recreated.

The full goal remains active. No Advanced/expansion start gate was opened, and complete rules, all optional modules, component inventory, calibration and broader user journeys remain unfinished.
