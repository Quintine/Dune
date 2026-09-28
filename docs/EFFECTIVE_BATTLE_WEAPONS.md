# Physical cards and effective battle weapons

The 7 September foundation now feeds a bounded, playable Mirror Weapon battle path (28 September 2026). The historical focused test counts below predate that integration.

## Contract and integration

`game/effective-weapons.ts` resolves the two selected, revealed weapon roles into independent descriptors. Each keeps its physical card ID, copied-from ID, effective attack kind and optional revealed choice. Canonical Mirror can copy an actual opposing weapon; empty slots, Worthless placeholders and non-weapon special cards supply no attack. Chemistry requires the original owner's complementary defense, but copying its legal weapon role does not require a second card from the Mirror owner. Neither physical card is rewritten or duplicated.

Tooth and Stone copies each receive their own choice, with the copy before its source. This pure dependency list does not replace the engine's ordinary revealed-choice order. Malformed Mirror identities and duplicate Mirror custody in the supplied slots return an explicit error; the helper does not inspect hidden hands or certify whole-game inventory.

`game/battle-cards.ts` consumes the descriptors for ordinary attacks, self-attacks, Artillery suppression/no-bounty behavior and a shared Lasgun explosion predicate. The authoritative engine and AI's fully known battle calculations use that predicate. Single-card knowledge remains single-card knowledge; no new hidden-hand access was added to AI evaluation. Actual Shield and Shield Snooper trigger explosions; defensive Weirding Way and Portable Snooper do not.

Physical plan IDs, Atreides inspection, Truthtrance commitments, custody, winning card retention and Moritani retention remain physical. The engine admits canonical Mirror only for CHOAM/Richese-deck classic/CHOAM/Richese rosters without combined optional modules; it rejects unsupported setups before commitment. It validates the original and copied Stone casualty possibilities using public force pools and checks reserved physical Mirror custody across saved zones.

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
