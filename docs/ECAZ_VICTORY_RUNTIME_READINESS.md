# Ecaz victory runtime and public progress readiness

Read-only architecture audit, 7 September 2026. This is a proposal against the current implementation, not evidence that the special victory rule has shipped. No runtime, tests, room state or mode gates were changed. Rule authority and open interpretations remain in [Ecaz Occupy rules](ECAZ_OCCUPY_RULES.md); the earlier [runtime audit](ECAZ_OCCUPY_RUNTIME_READINESS.md) is a pre-movement-integration snapshot.

## Current behavior and concrete gap

`game/victory-quote.ts:153` counts distinct strongholds occupied by any member of an allied pair and by no opposing fighters. It excludes a storm-contested stronghold even when the opposing groups cannot currently battle. `settledBoard` (`game/board-resolution-quote.ts:38`) first releases eligible lone BG advisors, so a new progress calculation must use that same effective board when describing the eventual check.

The normal threshold at `victory-quote.ts:168` is three for a solo faction, four for an alliance or a two-player game. One member holding all three Tech Tokens contributes one ordinary stronghold equivalent; split token ownership does not. There is no separate test for Ecaz and its ally jointly occupying three actual strongholds. The controlled three-joint-stronghold probe recorded in the earlier runtime audit therefore returns no winner. This is a missing expansion feature in development positions, not a regression in a publicly enabled Ecaz game.

The turn-ten Fremen condition at `victory-quote.ts:181` rejects any other faction's fighters in Sietch Tabr or Habbanya Ridge Sietch. It consequently lacks the source-confirmed Ecaz/Fremen **co-occupied Sietch Tabr** exception. Do not extend that exception to Ecaz alone in Sietch Tabr, or to another stronghold, without the pending source decision. The coordinator subsequently confirmed the source-reviewed composition: the concealed No-Field counts as one public force for joint occupation, including value zero. The separate pending Guild Ambassador No-Field substitution question does not gate this victory condition.

`quoteVictory` is deliberately internal: it receives and validates BG's private prediction and may replace normal winners with BG. Its returned winner is therefore unsuitable as a public progress oracle, even though it does not return the prediction field itself.

## Actual check and commit surfaces

| Surface                                                   | Required preservation                                                                                                                                                  |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `engine.ts:8992`, `victory(g, quote)`                     | Consumes the exact quote, applies advisor releases, sets winner/status, logs the result and settles final Stronghold Cards. Keep this one commit path.                 |
| `engine.ts:8917`, phase-eight initialization              | Updates Inflation, releases bribes, offers due Moritani placement, otherwise checks victory when CHOAM is absent. Public progress must not advance this sequence.      |
| `engine.ts:3628`, `finishMoritaniPlacement`               | Checks victory when CHOAM is absent after the placement opportunity resolves.                                                                                          |
| `engine.ts:11405–11430`, current victory/placement quotes | Denied Moritani placement preflights and later consumes the same victory result. The new condition must reach this path as well as ordinary completion.                |
| `engine.ts:14456`, `choamMentat`                          | Requires the actual pending Mentat decision, checks victory, then completes the phase only if still playing. Retain intervening Gamont/response/Market timing.         |
| `victory-quote.ts:176–235`                                | Preserve simultaneous normal qualifiers, private BG override, then turn-ten Fremen/Guild fallback order and the existing no-Guild/no-Fremen individual-count fallback. |
| `victory-quote.ts:237`                                    | Final Stronghold Card settlement uses actual board control and skips already claimed turns. Held cards are not a proxy for victory occupation.                         |

There is no separate `checkWin` function to update. Actual calls converge on `currentVictoryQuote`/`victory`. Add the new board condition there, not as an extra UI-driven check or an early movement-phase victory.

## Minimal shared public contract

Extract a pure public board-progress calculation, consumed by the internal victory quote and projected once in `viewGame`. Give it a bounded structural input: seated identities and reciprocal alliances, force locations, advisor stances, public deployed marker **location**, board availability, public Tech Token owners, and the rule/player-count context. Reuse `settledBoard` rather than copying its advisor-release rules. No hands, balances, leader custody, private marker value/token inventory, BG prediction or hidden commitments are required.

A compact result can contain one row per canonical allied side (including ordinary alliances, which must not be grouped using the movement-only Ecaz occupancy identity):

```ts
type SideVictoryProgress = {
  members: string[];
  ordinary: {
    strongholds: string[]; // distinct, uncontested map locations
    techBonus: 0 | 1; // one member owns all three
    target: 3 | 4;
    qualifies: boolean;
  };
  ecaz: null | {
    jointlyHeld: string[];
    target: 3;
    qualifies: boolean;
  };
};
```

The special list requires both actual member factions to be qualifying fighting occupiers of each stronghold, with no outside fighter. It cannot infer two occupiers from a merged coalition key. A physical Tech Token equivalent cannot supply the missing third jointly occupied territory. Use `gameTerritories` to retain existing placed-HMS availability; do not introduce Homeworlds or gated Discovery locations into this slice.

The concealed marker contributes its public one-force presence, never its hidden denomination. Public results must therefore be identical for values 0, 3 and 5 when all other public facts match. The approved implementation API is `strongholdProgress(g)` returning `{released, progress}` with per-player rows `{player, members, strongholds, techStronghold, target, jointlyOccupied, occupyTarget, qualifies}`; the row duplication lets each consumer look up its own seat, while `members` identifies the shared side. This differs only in presentation from the grouped sketch above.

Expose Fremen's board condition separately, with its qualifying status and public blocking territories/seats, rather than folding it into the ordinary count. Apply only the confirmed co-occupied Sietch Tabr exception. If the Ecaz-alone case affects the result, retain an explicit unresolved boundary. This descriptor describes a **turn-ten fallback condition**, not an unconditional win: normal victory precedes it, and the existing Guild/absence fallbacks still apply.

The internal quote should consume these board results, collect the appropriate qualifying sides, then retain private prediction handling and final-turn resolution in their existing order. The coordinator has confirmed BG prediction overrides this Ecaz stronghold victory; retain the separate existing unpredictable Fremen/Guild fallback behavior. Return only board progress to other players. Final `g.winner` remains public after the actual check.

## Player controls and guidance

`components/game-table.tsx:728` renders final `g.winner` faction names; it has no live victory-progress panel. Its Tech Token decision near line 2341 correctly states the ordinary equivalent but does not explain the separate physical joint requirement. `components/choam-gamont.tsx` already explains deferred victory timing and exposes “Finish and check victory.”

A small public panel can show each side's distinct normal strongholds plus token bonus against the ordinary target, and a separate Ecaz joint count with named locations. Use wording such as “Current board: 2 of 3 jointly held strongholds,” not a prediction that the side will win. Explain that the result is checked at the actual Mentat opportunity; it can change before then. Preserve the current final-winner banner. No additional confirmation or gameplay action is needed.

Update `game/reference.ts` victory topic near line 2492 and Ecaz coverage entries together when implementation lands. The current topic describes only normal three/four thresholds and calls other expansion victory additions unfinished. Its unqualified “when Mentat begins” sentence should also reflect existing Moritani/CHOAM deferrals, rather than advertising an earlier check than the engine performs. Retain complete-Ecaz/mode gates for unrelated unfinished features.

## AI consumers

| Current heuristic                                        | Limitation and smallest useful replacement                                                                                                                                                                                                                                                             |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `bots.ts:167`, `destinations`                            | Enemy threat counts one chosen rival's individual stronghold presences, including contested locations, plus its tokens; Brutal uses a fixed two-hold warning. Look up that rival's canonical side and both ordinary/joint progress.                                                                    |
| `bots.ts:876`, `gamontAction`                            | Already computes an allied, uncontested distinct union, but still uses a fixed `holds >= 2` threat threshold and omits joint occupation and tech equivalents. Reuse the same side progress and recognize removal of the last required joint occupant.                                                  |
| `bots.ts:2102`, `guildTiming`                            | Urgency uses individual raw two-stronghold presence. Reuse public side distance to each supported condition without consulting prediction.                                                                                                                                                             |
| Fremen/Guild Ambassador and ordinary destination scoring | Existing stronghold/source-preservation heuristics do not specifically complete the third joint location. Reward a legal join and avoid vacating the last own force from an already joint location when another useful group is available. Keep legal destination filtering before ranking/truncation. |

Do not replace established legal action enumeration with hypothetical effectful games. The first policy change can compare destination/source territory membership in the shared result; a later pure public-board delta helper can score more complex moves. Easy can retain its varied preference while all four profiles share correct public facts. No strength-monotonicity claim follows from these changes.

## Bounded implementation and evidence plan

1. Extract and test ordinary public progress with unchanged existing victory outcomes; prove that private prediction and No-Field denomination changes cannot affect its serialized public result.
2. Add source-confirmed physical Ecaz joint-three and the narrow Fremen co-occupied Sietch exception. Preserve ordinary four, tech ownership, contested storm locations, lone-advisor release and final Stronghold Card settlement. Keep unresolved cases explicit rather than guessing.
3. Consume the helper in actual victory and denied-placement paths, then add the public projection/panel and the three identified AI threat consumers.

Meaningful integration cases are three joint versus a two-and-one distribution; ordinary four without three joint; two joint plus all tokens; both allied orientations; advisor-only second presence; placed versus absent HMS; simultaneous qualifying sides and BG's private final override; turn-ten Fremen co-occupation versus the unresolved Ecaz-alone boundary; and deferred Moritani/CHOAM completion including saved cancellation. Public results must remain identical for private prediction changes and marker values 0/3/5 where the board projection is otherwise the same. No new tests or full-game calibration were run for this read-only proposal.
