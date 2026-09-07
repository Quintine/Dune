# Truthtrance nonbattle readiness and first implementation slice

**Later implementation:** the Basic active-opportunity reserve-shipment slice is now implemented and verified. See [TRUTHTRANCE_SHIPMENT_PROMISES.md](TRUTHTRANCE_SHIPMENT_PROMISES.md) for its exact scope, owned Ghola/Karama/escrow feasibility, Guild-allied Fremen reserve transport, persistence, controls and full-game evidence. The design below remains a historical audit; its statements that no nonbattle promise store exists are superseded by that follow-up. Broader future-action and expansion timing work remains unfinished.

Read-only design audit, 7 September 2026. Only this document is added. Runtime, controls, tests, calibration tools, live rooms and mode gates are unchanged. References identify the inspected implementation by symbol; line numbers can move during coordinator integration.

**Recommended first slice: structured current-spice comparisons**, using the existing fact question, target-only answer projection, authoritative truthful-answer check and all-four-profile answer path. This closes one concrete knowable-AI-answer gap without inventing future-action semantics. The next actual commitment slice should be the publisher's shipment destination/count example, with the enforcement sites and unresolved feasibility boundaries below. Do not represent new fact support as enforcement of nonbattle promises or arbitrary prose.

## Implemented follow-up

The current-spice slice described below is now integrated in `game/truthtrance.ts`, the question controls and the internal reference. Exactly/at-least/at-most comparisons use current personal spice and preserve the existing target-only answer projection and truthful-answer validation. New independent verification passes nine rules/AI tests (including 105 comparator lifecycle cases) and four production-room SQLite recovery/concurrency tests. Full released-source verification passes 1,455 rules/client/component tests and 123 persisted/API tests. The original design and remaining shipment enforcement requirements below are retained as the audit snapshot. See [TRUTHTRANCE_SPICE_FACTS.md](TRUTHTRANCE_SPICE_FACTS.md) for the implementation and browser evidence. No nonbattle future-action promise is implemented by this follow-up.

## Source basis

The official November2020 FAQ p8 allows game-related yes/no questions, current-turn action commitments, and AND/OR questions. Its shipment example requires an Emperor who answers Yes to send at least six forces to Carthag if able; No leaves other shipment choices available, including fewer forces or no shipment. The example releases compliance when enemy occupancy or allied forces make that shipment impossible. An outcome beyond the player's ability to decide may receive unknown, after which the holder can change the question or save the card. Simultaneous Truthtrances follow storm order. These are publisher instructions, not an application rule granting AI different obligations. [GF9 November2020 FAQ, p8](https://www.gf9games.com/dune/wp-content/uploads/2020/11/Dune-FAQ-Nov-2020.pdf)

The local publisher base extract `/tmp/dune-rules/base.txt`, printed p23, separately confirms that Truthtrance can intervene in Voice/Prescience preparation and leaves unaffected plan elements changeable. This supports preserving the existing battle integration; it does not enumerate nonbattle predicates or settle every shipment interruption. [GF9 base rulebook, p23](https://www.gf9games.com/dunegame/wp-content/uploads/Dune-Rulebook.pdf)

This audit read that local base extract and retrieved official-domain indexed text for November2020 FAQ p8. No local FAQ text file was present under `/tmp/dune-rules` in the inspected inventory. The November source, rather than the earlier April answer, supplies the nonbattle contract. No community, tournament or other-edition rule was adopted. The precise definitions and API shapes proposed below are engineering scope choices, not additional published restrictions on what a human may ask.

## Current implemented questions and disclosures

| Topic                             | Runtime support                                                          | Boundary or missing behavior                                                                                                                                                                                                                                                |
| --------------------------------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Named treachery currently held    | `TruthFact {kind:'hand', name}`; `truthFactAnswer` tests actual `p.hand` | Exact known name, not physical card ID, count or weapon/defense category. A held reserved card still counts as held. A card already moved to an on-table effect does not.                                                                                                   |
| Selected traitor                  | `{kind:'traitor', leader}` checks selected `p.traitors`                  | Returns unknown while choices remain unresolved. Native participating leader IDs and Cheap Hero are supported; shared Duke is not added to the traitor inventory. This asks current custody, not whether the player will reveal a traitor later.                            |
| Combined facts                    | AND/OR, two–eight children, sixteen total clauses and depth four         | Three-valued evaluation can resolve AND false or OR true despite an unknown sibling. Only the combined answer is exposed, not the matching clause.                                                                                                                          |
| Current spice                     | Absent                                                                   | Exact own `p.spice` is stored and projected only to its owner. A freeform question about it still forces an AI to answer unknown. This is the most useful small missing private fact.                                                                                       |
| Current hand count                | Absent as a predicate                                                    | The hand is owner-private; `handCount` is public only in Bidding, or to its owner. A structured comparison could later disclose only one boolean outside Bidding.                                                                                                           |
| Current forces/reserves/Tanks     | Absent as predicates                                                     | Physical counts are already public in `viewGame`. Numeric fact questions would be answerable, but add less private information than spice. Define physical tokens and exact location; do not silently count hidden No-Field denominations or doubled elite combat strength. |
| Weapon/defense category or counts | Absent                                                                   | The FAQ's category wording is broader than exact names. Alternate battle roles, special cards and effective abilities require a precise category model. Do not treat every card legal in a weapon slot as an ordinary weapon or infer role from translated prose.           |
| Current battle plan               | `TruthQuestion.kind='battlePlan'` plus `PlanClaim`                       | Dial/support comparisons, named weapon/defense slots, leader/Hero, KH, AND/OR. This is a current battle model, not an arbitrary turn-wide plan language.                                                                                                                    |
| Other current facts               | Freeform only                                                            | Prediction, forecast, selected dials, future-deck information, allies, leader custody and event history have no dedicated typed question here. Some are public or deterministically knowable; some require careful entitlement and temporal semantics.                      |
| Nonbattle future actions          | Freeform record only                                                     | Shipment, movement, bidding, revival, card play, bribe and alliance commitments have no persisted enforceable claim object.                                                                                                                                                 |

`parseQuestion` requires another seated target. Freeform text is length-limited with `scope:'fact'|'currentTurn'`; the parser cannot verify that natural-language text actually matches that declared scope. Human Yes/No/unknown is recorded without checking its semantic truth. AI freeform responses are explicitly restricted to unknown by `resolveTruthAction`, even for knowable questions. This is an implementation limitation, not complete compliance.

The Truthtrance overlay retains the interrupted response, decision, auction and battle in place. `resolveTruthAction` runs near the top of `applyActionInner`; while its window is active, unrelated normal actions are rejected. `truthHistory` publicly records question, answer, asker, phase and turn. Before publication, `viewGame.truthAnswer` exists only for the targeted fact respondent; `truthBattleAnswers` similarly exists only for the targeted combatant. Queued physical Truthtrance cards are reserved, definite answers discard once, and unknown leaves the holder's retry/save flow intact.

## Where promises currently bind actions

Only `Battle.truthPromises` contains enforceable Truthtrance obligations. `battle-promises.ts` parses/evaluates claims and permits partial plan components to remain undecided. It stores claimant, target, boolean answer and release state; the current battle itself supplies lifetime/context.

`battleTruthAnswers` tries both booleans against `findReachableBattlePlan`, including supported Ghola/preparation paths. `bindBattleTruth` adds a commitment only before a target seals and before reveal. `validatePlan` rejects conflicting final plans; `feasiblePrescience` incorporates existing promises. `reconcileBattlePromises` runs after ordinary action continuations and again after automatic/opposing continuations. It defers release during a pending Voice response. The explicit voluntary-impossibility rejection checks the promised player's `card`, `bribe`, `pledgeAid` and `richeseGift` actions; it is not a universal check of every conceivable future action category.

No equivalent turn-level nonbattle promise store, shipment matcher, movement/end-turn guard or nonbattle release routine exists. The ordinary `bribe` handler's own message says spice was promised, but its prepaid Mentat settlement is a separate mechanic; it does not enforce Truthtrance prose. Likewise, historical `truthHistory` records do not become constraints merely because their scope is `currentTurn`.

## First slice: a current-spice fact

Extend `TruthFact` with exactly:

```ts
{
  kind: 'spice';
  compare: 'eq' | 'gte' | 'lte';
  value: number;
}
```

Semantics: the respondent's currently held personal spice, exactly `p.spice`, at the answer action. It excludes separate pledged aid, incoming Mentat bribes, future income and estimates of spendable spice. The UI should say “Do you currently hold at least 6 spice?” rather than “Can you afford …?” The latter requires transaction-specific legal-payment and future-action reasoning.

Reuse the existing `kind:'fact'` envelope, clause limits, question text renderer, public question/history and target-only `truthAnswer`. Validate a nonnegative safe integer and the three exact comparators; do not inherit the battle claim's forty-point limit, since a personal spice balance is not a battle dial. No stored commitment or expiry is needed: a true answer about current holdings does not promise that those holdings will remain unchanged later.

`truthFactAnswer` will need the respondent's spice in its input contract. Evaluate the new leaf against authoritative state on `truthAnswer`, rejecting both dishonesty and unknown when the count is known. The existing bots already consume the projected expected answer, so all four levels can answer this fact without receiving any opponent's raw spice. Their initial question-selection strategy can remain unchanged; a human can now ask an AI a knowable spice question through a verified control. Keep arbitrary freeform interpretation explicitly partial.

Add the fact selector and comparator/value fields in `components/truthtrance.tsx`; keep AND/OR support and use the same generated sentence in controls and logs. No auto-answer on behalf of a human, exact-balance tooltip, matching-disjunct disclosure or extra public inventory field is needed.

Required focused tests should exercise actual declare/priority/ask/answer actions, all comparators including zero, bad numeric values, wrong actor, dishonest/unknown rejection and input immutability. Verify all four AI profiles answer the projected result; changing unrelated rival spice/cards cannot alter it. Combine the leaf with private card and unknown traitor leaves, checking only the aggregate boolean is projected. JSON/room restart and duplicate stale answer must preserve overlay and discard exactly once. Finally, after a true current-spice answer, a later otherwise legal spend must remain legal: this prevents accidentally turning a fact into a promise.

Current hand-count and physical-force predicates can follow using the same mechanism, but are not required to complete this first slice. Broader category facts should wait for agreed category semantics rather than duplicate battle-role code hastily.

## Next commitment slice: destination and minimum ordinary shipment

The publisher's concrete example is the strongest next target. A prospective API could use a separate question kind carrying a printed destination and minimum physical count; the server records current turn and the target's unspent ordinary shipment opportunity. The claim should refer to an actual shipment event, not later force presence at the destination. Movement, existing garrisons, free BG accompaniment and worm rides must not accidentally satisfy it.

For a bounded initial implementation, first support questions during Shipment & Movement when the target is the active player, has not used its ordinary shipment, and no unrelated pending shipment/response/decision is being interpreted. That is a transparent supported-software boundary, not a claim that the published card forbids earlier questions. Earlier-phase and cross-transport questions remain incomplete until their feasibility is implemented; do not turn parser rejection into a rules prohibition or silently return unknown for a knowable supported question.

A Yes commitment must retain every legal shipment satisfying destination/count, not force one exact amount, sector or payment split. A No commitment must forbid only matching shipments, leaving smaller, different-destination and skipped shipment choices available. Once the relevant shipment opportunity resolves, preserve an outcome record and close that obligation; expire remaining turn-specific records at the turn boundary. Opposing effects that make a positive obligation impossible need an explicit public release with no hidden resource disclosure. A voluntarily chosen spend must not serve as the excuse for evasion.

Enforcement must cover all relevant routes together:

- Ordinary `ship` validates entry, reserves, typed allocation, actual rate and contributor split, then uses `offerShipment`/`commitShipment`. Check at declaration and again when pending effects settle; a canceled declaration is not a completed matching shipment.
- `guildShip` directly pays/removes/places and marks `p.shipped`. It is an alternate shipment path, not harmless ground movement. Either include its exact declared semantics in the slice or visibly retain the unsupported boundary without letting it evade a supported obligation.
- `completeMove` marks `p.shipped=true`, so a target can foreclose ordinary shipment by moving first. `endMovement` advances the player without needing that flag. Both require an unsatisfied-positive-commitment check while a compliant shipment remains possible.
- `card`, `bribe` and `pledgeAid` can alter the ability to pay or legally enter before shipping; rate-card activation and cancellation, existing commitments and voluntary versus opposing transitions must use the same feasibility result.
- `commitShipment`, special Guild shipment-stop settlement and ordinary/faction response continuation must update or release obligations exactly once. `p.shipped` alone cannot distinguish a successful shipment from movement-first, skip or stopped opportunity.

Do not use the bot's top candidates as authoritative proof of impossibility: it truncates and scores legal options. Do not search only current cash if a legal retained Karama route or pledged payment can still fulfill the answer. Existing unresolved Guild repricing/permission cancellation and stopped-shipment settlement are material here; they cannot be settled by a new Truthtrance test declaring one outcome correct.

The FAQ does not supply an exhaustive algorithm for future acquired resources, arbitrary compound action plans, already-made shipments, temporary blockages that the player can remove, or all paid/canceled transport interactions. Resolve those through existing rules and explicit bounded implementation contracts before claiming full current-turn shipment support. In particular, a negative shipment answer is easy to police, but implementing only negative answers or forcing No to avoid positive feasibility would alter the offered decision.

When that slice is ready, independent tests should reproduce the publisher's Yes/No example with legal sector/count alternatives, two-faction and allied occupancy changes, voluntary spending, shipment skip via move/endMovement, actual cancellation and restored pending intent. Run all four profiles through obligation-preserving replacements and verify that private feasible amounts/payment cards do not leak through observer views or errors. Facts can ship first without waiting for this larger cross-action work.

## Integration recommendation

Implement and review only the current-spice fact first, with its precise truthful-answer and privacy tests. Keep the reference's nonbattle commitment limitation. Then coordinate the structured shipment work with the existing Guild cancellation audit so both use one authoritative shipment intent/feasibility model. Neither slice substitutes for complete natural-language Truthtrance, all current-turn obligations, Advanced/expansion integration, or the wider user's rules-compliance goal.
