# Physical cards and effective battle weapons

## Basic explosion and prior leaders — 27 October 2026

**Prototyped / Partial.** Under the standing selected-interpretation authority,
apply the same prior-leader Arrakis explosion handling to Basic. The [GF9 base
rulebook, p11](https://www.gf9games.com/dunegame/wp-content/uploads/Dune-Rulebook.pdf)
places surviving leaders in their territory until battles finish. A
[separately indexed transcription](https://boardgamegeek.com/thread/2542307/lasgun-shield-explosion-do-leaders-who-previously)
attributes destruction of all leaders in the battle territory to the 2019
physical Lasgun card, but its actual face was not independently inspected.
This Basic composition is provisional and is not an official clarification.
Current and earlier leaders die once; a successful Traitor prevents the explosion
and no leader bounty is awarded. Existing custody exclusions remain.

The supplied Advanced source physical30/printed28 returns a surviving
Ambassador Duke next to the board after his battle, so his `usedAt` stamp alone
does not locate that shared disc in a later explosion. The Advanced Kwisatz
`usedAt` marker establishes a per-turn territory limit, but no retrieved primary
source establishes where the separate marker stays after its battle. Its
current-plan explosion behavior remains; a later explosion is not inferred from
the stamp. Homeworld and exceptional custody boundaries remain open.

A native public Basic game uses actual entry, two battles and both previous
surviving discs; its unopened card/Spice order and scalar lotteries are selected.
The Duke supplement earns his original acquisition but explicitly stages later
battle state and conserved cards. These checks do not establish broad custody,
full-mode or deployed acceptance.
Eleven related files pass 173/173 with type checking and lint; the first
verification attempt caught an unused import before the full passing rerun.

## Earlier leaders in an Advanced explosion — 27 October 2026

**Prototyped / Partial.** The user-authorized revised rulebook physical p11 /
printed p9 leaves surviving leader discs in their battle territory and makes
them subject to later territory-wide effects, explicitly including a
Lasgun–Shield explosion. In an Advanced Arrakis battle that actually explodes,
living prior-used player leaders at that territory die once alongside the two
current plan leaders, including prior losing leaders. Prior-used native and
foreign-ghola roster discs follow the same location marker; captive or concealed
discs are excluded because their earlier stamp alone does not establish current
physical presence. No bounty is added. Actual Traitor outcomes retain precedence
and do not explode. Existing dead-leader Skill cleanup runs normally.

The separate shared Duke and Kwisatz marker, Homeworld explosions, and
exceptional custody interactions remain outside that slice; the later provisional
Basic policy is recorded above. This does not certify complete modes.

The focused native regression uses an original Advanced Emperor/Atreides/Guild
setup, paid shipments and movement to earn two successive Imperial Basin battles.
The prior winner's and loser's surviving discs are checked before the second
explosion. Additional controlled staged histories cover other territories,
already-dead leaders, current-leader deduplication, mutual Traitors and a
concealed captive. Neither fixture establishes full mode or deployed acceptance.
Eight related files pass 162/162, with type checking and lint. One older
controlled Ghola test clears the phase-owned Revival frame before its direct
Mentat jump; it retains its original elite-limit assertions.

The 7 September foundation now feeds a bounded, playable Mirror Weapon battle path (28 September 2026). The historical focused test counts below predate that integration.

## Contract and integration

`game/effective-weapons.ts` resolves the two selected, revealed weapon roles into independent descriptors. Each keeps its physical card ID, copied-from ID, effective attack kind and optional revealed choice. Canonical Mirror can copy an actual opposing weapon; empty slots, Worthless placeholders and non-weapon special cards supply no attack. Chemistry requires the original owner's complementary defense, but copying its legal weapon role does not require a second card from the Mirror owner. Neither physical card is rewritten or duplicated.

Tooth and Stone copies each receive their own choice, with the copy before its source. This pure dependency list does not replace the engine's ordinary revealed-choice order. Malformed Mirror identities and duplicate Mirror custody in the supplied slots return an explicit error; the helper does not inspect hidden hands or certify whole-game inventory.

`game/battle-cards.ts` consumes the descriptors for ordinary attacks, self-attacks, Artillery suppression/no-bounty behavior and a shared Lasgun explosion predicate. The authoritative engine and AI's fully known battle calculations use that predicate. Single-card knowledge remains single-card knowledge; no new hidden-hand access was added to AI evaluation. Actual Shield and Shield Snooper trigger explosions; defensive Weirding Way and Portable Snooper do not.

Physical plan IDs, Atreides inspection, Truthtrance commitments, custody, winning card retention and Moritani retention remain physical. Canonical Mirror supports CHOAM/Richese-deck classic/CHOAM/Richese Basic/Advanced rosters and source-clear Advanced native Ecaz/Moritani composition without optional overlays. It rejects unsupported setups before commitment. Original and copied Stone compare native physical undialed counters, including the separate fixed Ecaz remainder; public hypothetical No-Field pools never become the actual secret denomination. Ix Stone/Tooth timing and genuinely winner-changing typed allocations remain guarded.

## Evidence and boundaries

The [Mirror audit](MIRROR_WEAPON_ENGINE_AUDIT.md#user-selected-cleanup-interpretation-28-september-2026) records the user's explicit choice: a victorious physical Mirror may be retained even after copying activated Tooth or Artillery. The November FAQ names the original Tooth/Artillery cards, but no publisher passage was found assigning their disposal to Mirror. This is a product interpretation, not a GF9 ruling. The revealed decision queue binds copied Tooth/Stone choices to the physical Mirror, copied source and battle event, presents the copy before its original, and saves each owner's independent answer across reload.

Portable Snooper and Stone Burner now have runtime foundations that were absent when the original audit was written. Their current event, defense, casualty-feasibility and public configuration restrictions remain in force. In particular, introducing a copy must not bypass the original Stone player's precommit feasibility guard or choose a hidden-plan-dependent acceptance boundary.

Combined expansion modules, leader skills, alternate card-role changes, complete Richese starts and full-mode release acceptance remain gated. The bounded path has human selectors, copy/retention guidance and legal AI plans/choices, without reading sealed opposing cards.

## Verification

`tests/effective-weapons.test.ts` exercises the pure physical/effective role matrix; `tests/effective-battle-effects.test.ts`, `tests/battle-resolution-quote.test.ts` and `tests/mirror-weapon-engine.test.ts` cover copied defenses, Carthag's effective poison, Stone outcomes, copy-first post-reveal ownership, JSON continuation, stale events, physical disposal and four-profile Basic/Advanced AI admission. Historical foundation counts below remain archived rather than substituted for end-to-end evidence.

The earlier focused 53-test combat run passed before engine admission: `/tmp/dune-effective-weapons-target.log`. Its type, lint and build records (`/tmp/dune-effective-weapons-{type,lint,build}.log`) establish only the earlier foundation. Current integration checks belong to the newer checkpoint in `IMPLEMENTATION_STATUS.md`.

Full registered suites pass: **1,500 rules/client/component tests and 129 persistence/API tests**, 1,629 total. Logs: `/tmp/dune-effective-weapons-full.log` (67.15 seconds) and `/tmp/dune-effective-weapons-multiplayer.log` (18.64 seconds). The historical 648-game calibration was not rerun.

An independent differential script, `/tmp/dune-effective-comparison.ts`, compares the previous evaluator against the saved implementation using 57 canonical cards and 494 legal same-side pairs. All 865,580 effect comparisons, 216,395 explosion comparisons and 3,364 single-weapon comparisons agree. This is regression evidence for existing legal behavior, not independent proof of complete printed rules. Root reviewed the new helper, tests and integration; the independent review also checked that AI receives no new hidden-hand inputs.

Malformed Mirror-marked saved cards fail closed in the pure evaluator; authoritative saved-battle integrity now also validates canonical physical Mirror custody and copied-choice source/event. The full historical-save compatibility audit remains final polish, not a claim made by this bounded runtime.
