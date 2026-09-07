# Battle, revival and disaster cancellation prerequisites

Later work: [Battle aftermath, movement cancellation and owner promises](BATTLE_AFTERMATH_PREFLIGHT.md). This document records the earlier checkpoint.

7 September 2026. This checkpoint extends [cancellation source binding](KARAMA_CANCELLATION_CONTEXTS.md). The full game goal remains active. Public Advanced/expansion start gates are unchanged.

## Shared battle calculation

`game/battle-resolution-quote.ts` computes the revealed battle outcome from normalized current combatants, controlled leaders, physical card custody, effective forces, Stronghold benefits, traitor voters and available support escrow. Both the live resolver and cancellation of a final allied Harkonnen traitor call use this calculation. When other traitor votes are still pending, cancellation removes the allied call and leaves those votes available.

The quote preserves Stone Burner mode/casualty prerequisites before traitor precedence, actual matching traitor identities and Kwisatz protection, sequential support payments, CHOAM and Stronghold income, leader deaths/bounty, explosion/traitor outcomes, typed winner losses, mandatory played-card disposal, Moritani retention and an event-free Auditor seed. Used card identities include the original defense, late Portable Snooper and Cheap Hero/Heroines. Knowledge and historical receipts are excluded from physical custody. Only the actual resolver pays resources, changes pieces, reveals identities, allocates events and stages the completed discard.

The engine additionally checks affected per-location ordinary/elite forces and safe tank/battle-casualty counters using `game/force-loss-preflight.ts`. Aggregate battle strength alone cannot detect a malformed individual location. Concealed No-Fields are rejected where the existing battle removal has no authorized reveal cause.

This is not a complete quote for later capture, Face Dance, technology transfer, Duke or phase continuations. Their remaining prerequisites must be addressed before an interruptible pre-effect Karama cost frame is introduced.

## Revival cancellation

`game/revival-cancellation.ts` produces detached updated rules and the pending request for CHOAM revival, Tleilaxu expanded limits, discounts, early native revival and foreign gholas. The actual canceled branch consumes that same quote and calls the existing revival continuation once.

Checks bind phase/owner/recipient/request kind and remaining checks, preserve negotiated native leader prices and the original Ixian free-elite allocation, and validate continuing physical piece custody and arithmetic. Canceling a discount may leave the request unaffordable; that remains an accepted cancellation with no revival or payment. A changed Fremen allowance likewise abandons the request without spending its revival resources. Remaining benefit responses occur before final affordability, preserving the existing sequence. Abandoned early/foreign requests apply their appropriate block without reviving anything.

## Storm and worm cancellation

`game/disaster-preflight.ts` checks finite storm traversal, typed exposed forces, protected shipment cohorts, affected No-Field materialization and required natural/summoned worm continuations before initial cost and final BG allowance. The live storm and devouring routines share the custody checks. No quote draws cards, chooses losses, reveals a marker, changes resources or allocates an event.

Valid initial storm position zero, two 20-sector first-storm dials, repeated circuits, pending same-sector typed loss groups, and earlier occupants of a storm shipment are preserved. Natural worms may follow printed spice cards in rock territories; selected additional worms retain their existing sand requirement. A pre-blow summoned worm genuinely has null natural sequence/resolution and restores its saved parent. Canceled allied protection and canceled placement retain their distinct survival-response and continuing-spice outcomes.

[Independent disaster review](STORM_WORM_PREFLIGHT_REVIEW.md) records the reproduced late failures, corrected restrictions and coverage limits. This work preserves existing component behavior; it adds no tournament rule or new ruling.

## Verification

**1,961 rules/client/component +197 multiplayer tests pass (2,158 total).** The 114 new tests comprise 22 battle quotes and real allied-traitor cancellation sequences, 79 revival quote/action scenarios, 10 storm/worm scenarios and three production SQLite recovery/concurrency scenarios. Corruption loops include per-location loss maps, played-card custody, funding, pre-existing Auditor/retention receipts, overflow and malformed deferred continuation fields. Rejections preserve the input; RNG/UUID probes verify pure battle and revival checks. Source-level review confirms disaster checks perform no random operation or actual marker reveal.

The SQLite tests use production migrations, room code, authentication and optimistic writes. Concurrent final allowances yield one committed effect and one conflict. Module reload, duplicate automatic recovery and stale requests do not repeat the cost, repricing or typed losses. Eight malformed revival/storm states reject before or after durable conversion with zero writes. Private source signatures, hands and balances remain absent from other seats' projections.

Root reviewed every new source/test file and the integrated resolver changes. The full rules suite passed in 71.089 seconds (`/tmp/dune-disaster-battle-final-rules.log`), multiplayer in 19.417 seconds (`/tmp/dune-disaster-battle-final-multiplayer.log`). After a final coverage-only guide edit, all 12 reference tests pass and the production build was repeated successfully (`/tmp/dune-disaster-battle-final-build2.log`). Final type/lint results are recorded with the final source manifest. Earlier broad runs exposed overly restrictive storm zero/rock-worm guards, which were corrected, and invalid old fixtures with duplicated physical poison cards or a nonexistent Great Flat sector, whose setup was corrected without weakening gameplay assertions.

Browser QA restaged only the explicitly named test room `8S3MRDEK`, preserving its authenticated seat identities and backing up the previous state. A genuine storm protection response at version 62 offered Baliset as Karama. The actual browser click consumed one card and saved version 63 with the pending BG conversion, two-card private hand, 20 spice and the original Fremen forces. Refresh after the controlled restart restored the same visible waiting response and private hand. The other manual QA seat still legitimately owns the response; SQL tests independently exercise completion. This is a staged desktop playtest, not a complete browser game or phone acceptance.

The controlled restart at approximately 06:50 UTC backed up all 2,106 rooms. Final read-only verification found all those room versions and JSON hashes unchanged, including the version-63 QA response and known human room version 14. The multiplayer HTTP suite created 30 new test rooms, yielding 2,136 total. Backup `/tmp/dune-maintenance-20260907T0650/database.sqlite` and QA snapshots have private permissions. The restarted server responds successfully on port 3000. No maintenance automation was recreated.

The final unchanged-source public-start Basic sample completed **20/20 games**, two through six players at all four homogeneous AI profiles: **12,430 accepted actions, zero rejected candidates or stalls, 554 JSON round trips**, in 111.935 seconds. Seed 20261010; output `/tmp/dune-disaster-battle-fullgames-final.json`. Every recorded source hash still matches. Fingerprint `f9f4e1f11db71642b137a80a7cf5ae32cee8e52687b9860c465a828376510206`; engine `547543ad733ecad1531de6b32377939d168ebb0605f9538eaa3f1230a00c941e`. This Basic sample is regression evidence, not complete Advanced/expansion acceptance or relative difficulty calibration. An earlier partial run was deliberately stopped to include the final in-game checklist update.

Final TypeScript and lint checks pass (`/tmp/dune-disaster-battle-final-type2.log`, `/tmp/dune-disaster-battle-final-lint2.log`). Final source/verification manifest: `/tmp/dune-disaster-battle-final-hashes.json`.

## Remaining work

Exhaustive canceled-response semantics, later battle aftermath and future random continuations, original actor post-cost/intended-use promise feasibility, successor discard handling and remaining ordinary/special Karama producers are still unfinished. Semuta questions, full Advanced/expansion/module acceptance, calibrated AI strength, component inspection and presentation work remain part of the active goal. The user-removed maintenance automation stays removed.
