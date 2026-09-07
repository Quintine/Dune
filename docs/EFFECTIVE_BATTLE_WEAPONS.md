# Physical cards and effective battle weapons

7 September 2026. This is a shared combat foundation for Mirror Weapon, not activation of its complete gameplay.

## Contract and integration

`game/effective-weapons.ts` resolves the two selected, revealed weapon roles into independent descriptors. Each keeps its physical card ID, copied-from ID, effective attack kind and optional revealed choice. Canonical Mirror can copy an actual opposing weapon; empty slots, Worthless placeholders and non-weapon special cards supply no attack. Chemistry requires the original owner's complementary defense, but copying its legal weapon role does not require a second card from the Mirror owner. Neither physical card is rewritten or duplicated.

Tooth and Stone copies each receive their own choice, with the copy before its source. This pure dependency list does not replace the engine's ordinary revealed-choice order. Malformed Mirror identities and duplicate Mirror custody in the supplied slots return an explicit error; the helper does not inspect hidden hands or certify whole-game inventory.

`game/battle-cards.ts` consumes the descriptors for ordinary attacks, self-attacks, Artillery suppression/no-bounty behavior and a shared Lasgun explosion predicate. The authoritative engine and AI's fully known battle calculations use that predicate. Single-card knowledge remains single-card knowledge; no new hidden-hand access was added to AI evaluation. Actual Shield and Shield Snooper trigger explosions; defensive Weirding Way and Portable Snooper do not.

Physical plan IDs, Atreides inspection, Truthtrance commitments, custody, winning card retention and Moritani retention are unchanged. The engine still rejects Mirror as a Battle Plan weapon. Copy arithmetic must not be confused with completed controls, persisted copied choices, Stone outcome integration or cleanup.

## Evidence and boundaries

The current review in [MIRROR_WEAPON_ENGINE_AUDIT.md](MIRROR_WEAPON_ENGINE_AUDIT.md) remains the source contract. A fresh bounded publisher search again found the November FAQ's general winner-retention rule and named Tooth/Artillery exceptions, but no explicit ruling about the physical Mirror copying those exceptions. The earlier user clarification remains unanswered. The CHOAM package itself supplies Tooth and Artillery; excluding only Ix would not isolate this uncertainty. No source absence or elapsed silence was treated as an adjudication.

Portable Snooper and Stone Burner now have runtime foundations that were absent when the original audit was written. Their current event, defense, casualty-feasibility and public configuration restrictions remain in force. In particular, introducing a copy must not bypass the original Stone player's precommit feasibility guard or choose a hidden-plan-dependent acceptance boundary.

Remaining work includes canonical Mirror plan admission and named Voice role; physical prescience and promise checks; event-bound copy/source choice ownership and ordering; Stone's effective outcome; settled cleanup rules; controls, AI choice handling and persisted full battles. General expansion/module and Advanced acceptance remain incomplete.

## Verification

`tests/effective-weapons.test.ts` contains ten independent helper tests: both orientations, all actual ordinary/Ix attack roles, canonical Stone, no-copy roles, original-versus-copied Chemistry, independent choice order, malformed/duplicate Mirror and frozen inputs. `tests/effective-battle-effects.test.ts` contains six integration tests using an explicit printed defense matrix, all Tooth activation pairs, Artillery defenses, Lasgun shield combinations, no-attack/Stone boundaries and continued blocked Mirror admission.

The focused 53-test combat run passes, including existing authoritative Ix, Tooth/Artillery, Portable and Stone cases: `/tmp/dune-effective-weapons-target.log`. Type checking, lint and production build pass: `/tmp/dune-effective-weapons-type.log`, `/tmp/dune-effective-weapons-lint.log`, `/tmp/dune-effective-weapons-build.log`. No Mirror full-game or card-completion claim follows from these arithmetic tests.

Full registered suites pass: **1,500 rules/client/component tests and 129 persistence/API tests**, 1,629 total. Logs: `/tmp/dune-effective-weapons-full.log` (67.15 seconds) and `/tmp/dune-effective-weapons-multiplayer.log` (18.64 seconds). The historical 648-game calibration was not rerun.

An independent differential script, `/tmp/dune-effective-comparison.ts`, compares the previous evaluator against the saved implementation using 57 canonical cards and 494 legal same-side pairs. All 865,580 effect comparisons, 216,395 explosion comparisons and 3,364 single-weapon comparisons agree. This is regression evidence for existing legal behavior, not independent proof of complete printed rules. Root reviewed the new helper, tests and integration; the independent review also checked that AI receives no new hidden-hand inputs.

Malformed Mirror-marked saved cards fail closed with a plain error from the pure evaluator; that can surface as a generic API failure rather than a recoverable rules message. Valid physical inventory does not produce this path. Complete corrupted battle recovery, including event/source validation for existing Poison Tooth answers, remains follow-up work and is not certified by this foundation.
