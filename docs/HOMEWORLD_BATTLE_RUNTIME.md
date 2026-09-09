# Homeworld battle runtime

9 September 2026. This connects the [combat foundation](HOMEWORLD_COMBAT_IMPLEMENTATION.md) to real engine actions and recovery. Homeworld starts remain disabled: invasion transport, occupation, remaining face effects and complete module games are unfinished.

## Connected behavior

One combat-location adapter supplies public names, exact native/visiting armies and the combined ordered battle frontier. Arrakis geometry remains unchanged. Phase continuations see remaining Homeworld conflicts before advancing to Collection. Native reserves and foreign garrisons retain separate physical custody; no fake sector keys enter the board.

Live battle preparation, sealed plans, resolution, mandatory card disposal and winner cleanup now use that location. Printed native strength affects the score, not dial losses. Only a native combatant can call a Traitor. Battles between visitors have no traitor voters and continue automatically, preserving Poison Tooth, Stone Burner and eligible late Portable Snooper decisions. An invading owner with a legal late defense gets an event-bound use/decline choice rather than a fictional traitor vote.

Lasgun/Shield destroys visiting armies but removes only the printed number of native physical counters, capped by actual population. Multiple typed allocations belong to the native player, even when two visitors fought and the native was not a combatant. A sole allocation resolves automatically. Native leaders outside the two plans remain unaffected.

Pending typed casualties bind the exact native/visitor pool, resolved event and committed arithmetic. Mandatory disposal, JSON restoration and later owned choices do not replay payment, leader death or prior losses. Same-total reallocations between Kaitain and Salusa cannot redirect a saved choice.

Ixian winners may exchange surviving Suboids for Cyborgs lost at that same Homeworld. The saved declaration binds survivors, typed Tanks and battle-loss history; Karama cancellation leaves the original losses unchanged. Native Tleilaxu Face Dance returns the foreign winner’s army and relocates selected own Arrakis forces into native custody. Existing native reserves remain physically in place, including a redundant same-source selection; zero external replacements are allowed. All four AI profiles and controls use the public location and exact quantities.

## Explicit unfinished interactions

The [replacement source audit](HOMEWORLD_REPLACEMENT_RULES.md) does not resolve the Advanced Emperor’s returned-army allocation between Kaitain and Salusa. That Face Dance return is gated with the same server, AI and interface reason; declining remains available. The existing Salusa Ghola support-timing question also remains gated. These restrictions are development boundaries, not official prohibitions. Other Homeworld face effects, occupation rights and full interaction coverage are still required.

## Evidence

Focused engine cases cover native and visitor combat, zero-voter restoration, native and noncombatant-native explosions, late defense, mandatory disposal, physical conservation and all four AI profiles. Replacement regressions cover Basic/Advanced native/visitor Ixian wins, declared Karama cancellation, corrupt receipts, native noncombatant Face Dance and unchanged private projections.

Production SQLite tests verify competing native casualty submissions, duplicate rejection, exact-pool corruption without writes and concurrent automatic recovery. They exposed a missing room recovery scheduling hint; the engine’s actual continuation remains authoritative. Static rendering tests check world labels, sector-free replacement controls and accessible restricted choices.

Final `npm run check` passes typechecking, lint and **3,264 offline cases** across 314 files (84.55 seconds for the tests); production build passes. The HTTP suite passed **40 cases** before the final saved-decision validation and board-selection fixes. Four additional recovery regressions cover live and Box-suspended late defense, stale event ownership, missing casualty receipts and altered loss options; rejected reads, actions and normalization preserve state.

Actual desktop and 390×844 browser checks in an isolated QA room exercised sealed native plans, the native-only traitor decision, Lasgun/Shield disposal and the three legal native casualty allocations. The pending choice survived refresh. Keyboard selection of one normal counter and one Sardaukar advanced to Collection; refresh restored 18 native reserves (14 normal, four Sardaukar), two native Tanks (one Sardaukar), five invader Tanks and exactly one discarded Lasgun and Shield. No page errors or horizontal page overflow were observed. Visual inspection covered the phone casualty controls and settled desktop result. This used genuine audit setup followed by conserved staged invaders; it does not demonstrate invasion transport or a complete Homeworld game. Browser testing exposed and fixed a world ID incorrectly passed to the Arrakis territory selector.

The controlled 10:30 UTC restart preserved all 2,709 saved room versions and state hashes; the authenticated earlier QA room restored through its invitation. A final read-only comparison after browser settlement found all 2,709 baseline rooms unchanged, with 2,740 rooms now stored including new test rooms. The recurring automation remains removed and user workflow optimizations remain in use.
