# Fremen Ambassador implementation checkpoint

7 September 2026. The Fremen Ambassador now supports independent board relocation for Ecaz or its ally, including a legally copied Bene Gesserit effect. This is the seventh implemented ordinary Ambassador effect. Full Ecaz, Advanced and expansion starts remain gated; this checkpoint does not establish full expansion compliance.

## Rules and bounded behavior

The source analysis is in [FREMEN_AMBASSADOR_RULES.md](FREMEN_AMBASSADOR_RULES.md). A beneficiary selects physical forces from one board territory, optionally from several clear sectors, and a destination territory/sector. Typed elite counts remain part of those physical counts. The unrestricted destination grant does not consume ordinary range, movement counters, shipment costs, turn queues or the original entrant's played Ornithopter cohort. Same-territory sector redistribution must actually move the selected pieces and does not create an arrival reaction.

The pure quote checks storm sectors, physical/elite custody, legal board locations, advisor stance and locks, stronghold occupancy and Ecaz reciprocal co-occupation. A placed Hidden Mobile Stronghold uses its real pointing sector key; non-Ixians may enter only from that containing territory. Its interior is sector zero. No-Field custody now accepts that interior, retaining token history, concealed denomination and reserves. A Richese marker can move alone or with physical forces, and its private event is separate from the Ambassador event. Homeworlds and reserves are excluded from this board-territory move.

The beneficiary alone receives the group/destination descriptor. It contains public board constraints and their own marker receipt, never opposing hands, private balances or concealed denominations. All four AI profiles consume that projection, select legal typed quantities and filter blocked destinations before ranking. The human form has per-sector quantities, elite minima/maxima, optional marker selection, destination sector and an eligible advisor-to-fighter choice. Drafts belong to the Ambassador event. Existing destination-sector pieces are excluded from the selection.

CHOAM may react with Baliset during Shipment and Movement. Allowing a block keeps the Ambassador committed and offers another legal relocation; canceling the block resumes the exact original declaration. There is no second optional decline after triggering. If no legal group remains, the effect completes without moving pieces under the documented unavailable-effect interpretation; the token stays consumed. An implementation-blocked arrival is not treated as an impossible legal move.

A completed relocation can hold the original Ambassador while a voluntary BG flip, Intrusion, or separate Moritani Terror resolves. The receipt records the original actor, group, location, event and next reaction. Historical checks do not require casualties or later alliance/marker changes to be reversed. Native and converted Karama bind the same parent. Sabotage's discard/gift continuation retains it. A summoned worm can remove the last group and finish the impossible move, then open its Nexus before remaining rides. The fifth-token cohort replenishes only after the effect and its children finish.

## Remaining boundaries

The user question about simultaneous Intrusion and Terror ordering remains unanswered. Those destinations have a visible implementation block and reject before moving pieces; neither ability is silently skipped. Ecaz combined battle/victory behavior, remaining Ambassador effects, exceptional Duke custody, Discovery locations and complete optional-module combinations remain unfinished. Ordinary Ecaz/BG co-occupation outside this bounded relocation still needs the larger Occupy integration. The source-version conflict about rounding Ecaz's combat contribution is recorded in the source analysis and was not decided here.

## Validation

Final total: **2,613 rules/client/component tests +233 multiplayer tests =2,846 passing tests**. Typecheck, lint and production build pass. The first broad run found three obsolete assertions that still expected Fremen to be unavailable. Updated tests retain committed Ixian card reservations and now prove a not-yet-selected BG copy may spend its last Ixian discard when a legal Fremen alternative remains. The repeated full rules run passes.

New coverage consists of 27 quote tests, 13 engine journeys, 16 bot tests, eight cancellation tests, five production-room SQLite tests and one additional shared No-Field test. Tests cover typed/multiple-sector groups, distant destinations, storm/HMS identity, private marker values, locks/Occupy, BG copies, Baliset cancellation and re-selection, Intrusion, Terror/Sabotage, original Ornithopter cohorts, summoned worms, vanished groups, stale events, malformed saved receipts and competing CAS requests. The room worker now schedules Ecaz Ambassador decisions for authoritative automatic recovery without advancing a legitimate remaining choice.

- Rules: `/tmp/dune-fremen-ambassador-rules-verified.log` (2,613; 57.92 seconds).
- Multiplayer: `/tmp/dune-fremen-ambassador-multiplayer-final.log` (233; 30.54 seconds).
- Production checks: `/tmp/dune-fremen-ambassador-{type,lint,build}-final.log`; final test-only checks: `/tmp/dune-fremen-final-test-{format,type,lint}.log`.
- Twenty Basic full games: `/tmp/dune-fremen-ambassador-fullgames-final.json` and matching `.log`, seed 20261020, two through six players and all four homogeneous AI difficulties. All completed: 12,252 accepted actions, zero rejected candidates/stalls, 547 JSON round trips, 55.17 seconds. Source fingerprints stayed unchanged. This sample checks Basic regressions; it is not an expansion full-game test or relative AI-strength calibration.

Root integrated and reviewed the pure quote, UI/AI, child validators, engine/room adapters and agent test contributions. Review caught and fixed the real HMS pointer representation, retained parent during Sabotage disposal, incomplete saved-child binding and omitted room-worker scheduling.

## Browser and maintenance

A controlled restart at approximately 10:51 UTC backed up and preserved all 2,437 saved rooms. The existing QA seat reconnected with the same private hand and resources. Backup and verification: `/tmp/dune-maintenance-20260907T1051/`.

Only QA room `8S3MRDEK` was then restaged, after a backup and exact version/name checks. A real Emperor entry produced the Fremen offer at v102. Browser triggering reached v103; refreshing preserved the consumed token and pending choice. The desktop form and a 390×844 phone viewport showed readable controls. Selecting two forces from Wind Pass sector14 and one from sector15, then Carthag11, enabled the three-force action. Keyboard Tab reached the visible focused submit button; Return committed v104. The Ecaz action notice appeared, the chronicle explained the move, and the original Emperor entrant resumed. The viewport override was reset.

The final database check confirms Wind Pass retains two forces in each source sector, Carthag has three, Ecaz retains ten spice and its previous one ordinary move, and the Ambassador is finished. All 2,436 older non-QA rooms retained identical JSON hashes and versions; newly created regression rooms are separate. The known human room remains v14. The animation was observed but its duration was not instrumented. Broader mobile/component acceptance remains open.

The hourly automation remains removed by user instruction. The full goal stays active.
