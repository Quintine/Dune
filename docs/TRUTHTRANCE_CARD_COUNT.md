# Truthtrance current named-card counts

Implemented 7 September 2026 local date. This closes a bounded base-game question gap: a player can now ask whether another player currently holds exactly, at least, or at most a specified number of cards with one canonical printed name. Previously the structured hand fact checked existence only; asking an AI the knowable equivalent in freeform produced unknown.

## Source and interpretation

The [official November 2020 GF9 FAQ, printed p.8](https://www.gf9games.com/dune/wp-content/uploads/2020/11/Dune-FAQ-Nov-2020.pdf) permits game-related yes/no questions and combinations with AND/OR. Its separate future-action discussion limits commitments to the current turn. The official PDF's indexed page text was retrieved again during this implementation; a newly downloaded local PDF is not claimed. The [earlier nonbattle audit](TRUTHTRANCE_NONBATTLE_READINESS_20260907.md) records the same authority and remaining promise work.

Applying that general permission to a question such as whether the respondent holds two Shields is an implementation inference, not an additional printed card-count rule. It concerns known present custody and needs no disputed future-action or expansion ruling. Counting cards does not promise that the respondent will keep them after answering.

## Contract and behavior

The new leaf inside the existing fact question is:

```ts
{ kind: 'handCount', name: string, compare: 'eq' | 'gte' | 'lte', value: number }
```

`value` must be a nonnegative safe integer. Thresholds are not artificially limited by a current hand limit or battle dial. Names use the same exact canonical `TRUTH_CARD_NAMES` membership as existing hand facts. Case variants and unknown names are rejected; no new alias or combat-role inference is introduced. Shield Snooper and Portable Snooper do not count as Shield or Snooper.

`game/truthtrance-card-count.ts` provides the pure parser, matcher and sentence formatter. The engine adapter catches parser failures as `TruthError`, preserving the existing rejected-action path. It evaluates physical entries in the respondent's actual current hand when answering. A used card retained in hand counts; cards already in a deck, discard or on-table effect do not. The helper relies on the engine's physical inventory contract rather than deduplicating or repairing corrupted hands.

The shared Truthtrance engine handles priority, ownership, answer validation, exact single discard, history and interrupted-state continuation. A dishonest or unknown answer to this knowable leaf is rejected. In composed expressions, existing three-valued AND/OR rules still apply when another clause is unknown. Only the aggregate expected answer is projected to the target; other seats get no matching-card IDs, counts or per-clause answers. The published question and answer intentionally reveal their logical consequence.

All four AI profiles consume the existing target-only expected-answer projection. Their proactive question selection is unchanged. Root integration adds the named-count selector and fields in the existing Truthtrance controls and a rules-reference entry. No shared bot privilege or public mode gate was changed by this helper.

## Focused verification

`tests/truthtrance-card-count.test.ts` contains eight tests:

- Four pure-helper tests cover all exact physical Shield multiplicities, 120 comparator combinations including zero and MAX_SAFE_INTEGER thresholds, exact-name exclusions, malformed input, normalized records, no input mutation and question text.
- Seventy-five real declaration/priority/question/answer cases cover zero through four held Shields and threshold/comparator boundaries. They check target-only expected answers, dishonest/unknown/wrong-actor rejection, JSON continuation, exact single discard, unchanged hand and physical deck inventory, and duplicate-answer rejection.
- Malformed nested clauses reject atomically even if another OR clause would determine the answer.
- Mixed current-count/spice/legacy-unknown-traitor clauses preserve aggregate disclosure and unknown semantics.
- Sixteen all-profile cases produce legal answers, preserve input projections, exclude other actors and remain unchanged after unrelated private opponent-hand/balance perturbations.

Final focused run: **8/8 pass**, 389.668139ms. The two initial failures were test expectations using undefined instead of the established public null answer projection; no runtime defect was found. Formatting and targeted lint pass. Broader suite and browser results belong to the coordinator's integrated checkpoint, not this focused report.

## Integrated checkpoint evidence

The coordinator reviewed the helper, adapter and all eight tests, integrated the accessible card-name/comparison/count form and rules topic, and read the two additional production-SQLite tests in `tests/truthtrance-spice-recovery.test.ts`. Those cover restored comparisons, target-only answers, unchanged hidden hands/auction, rejected false/unknown/wrong-owner answers, and concurrent answers committing one discard/history record through the production CAS.

Final registered suites: **1,577/1,577 rules/client/component tests** in `/tmp/dune-market-truth-final-full.log` (58.53s) and **143/143 multiplayer/API tests** in `/tmp/dune-market-truth-final-multiplayer.log` (21.18s). Final typecheck, lint and production build pass: `/tmp/dune-market-truth-final-type.log`, `/tmp/dune-market-truth-final-lint.log`, `/tmp/dune-market-truth-build.log`. All processes were polled to terminal success. The first broad run used an earlier, subsequently rejected all-phase market implementation and two outdated count-test null expectations; it is retained at `/tmp/dune-market-truth-full.log` and is not the final result.

Browser QA reused only the explicitly isolated room `8S3MRDEK`, preserving its old snapshot before staging with `/tmp/dune-stage-market-count.ts count`. The new scenario holds one Truthtrance for the human and two real Shields for a Hard Emperor AI. The human declared the card, selected Number of a named card, verified a negative count disabled Ask publicly, restored count two and inspected the full desktop and 390×844 mobile form. The mobile button asked whether the AI held at least two Shields. Its actual paced response was Yes; the game resumed Revival, the human hand became empty, the opponent retained both Shields and one Truthtrance entered discard. History and state remained after refresh. Final snapshot `/tmp/dune-count-qa-final.json`, version16. Temporary viewport sizing was reset. This is a staged journey check, not a full-game compliance claim.

## Remaining limits

This is one current-fact class. It does not implement arbitrary prose interpretation, category counts, future custody promises, nonbattle action commitments, or complete Truthtrance compliance. It does not certify Advanced availability, full expansion support, or complete multiplayer/browser acceptance. Those boundaries remain in the reference and ongoing implementation ledger.
