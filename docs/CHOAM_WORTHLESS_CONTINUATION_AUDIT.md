# CHOAM Worthless cancellation continuations

Implementation follow-up: [CHOAM_WORTHLESS_CANCELLATION_RECOVERY.md](CHOAM_WORTHLESS_CANCELLATION_RECOVERY.md) records the completed shared checks and verification. The following is the original pre-implementation audit snapshot.

Independent developer audit, 7 September 2026. Scope: current non-Baliset cancellation suffixes, particularly reactive La La La, Jubba and Mentat restoration. No runtime or test files changed. A temporary in-memory dispatcher probe used actual declarations and then explicitly corrupted copied saves; it did not write any database. This is a bounded next-work contract, not a full CHOAM compliance claim.

## Priority and reproduced defects

Implement a typed **denied Worthless declaration plus exact resume branch** first, then share the unchanged revival continuation checks with `offerRevivalStop` / `finishRevival`. Reactive La La La is the highest-priority suffix: preventing CHOAM's denial can immediately revive the originally requested forces. Checking CHOAM's owner alone is insufficient before a new Karama cost.

The probe at `/tmp/dune-choam-worthless-audit-probe.ts` builds a genuine Advanced CHOAM/Emperor/BG position with physically sourced cards, calls Emperor `revive(3)`, then CHOAM's actual La La La declaration. The pending quote has amount3, free1, cost4, checks[]. Only after that production declaration does each case alter the save. Results are recorded in `/tmp/dune-choam-worthless-audit-probe.log`:

| Copied-save corruption | Current printed cancellation | Current new BG conversion |
| --- | --- | --- |
| `pendingRevival.amount = 99`, with only6 forces in Tanks | Accepted: returns Emperor tanks−93, reserves113 and spends Karama. | Accepts and spends Worthless, leaving conversion pending. |
| `pendingRevival.checks = null` | Throws when `finishRevival` calls `shift`; public action remains atomic and rejects. | Accepts and spends Worthless before the later invalid suffix. |
| Add `pendingChoamWorthless.mentat = true` to the same phase4 La La La | Accepted: performs revival and opens a phase4 `choamMentat` decision. Its normal completion requires phase8, so that saved branch is invalid. | Accepts and spends Worthless with contradictory resume flags. |

These are **malformed-save defects**, not established legal-action exploits. An attempted Ghola interruption at this response was rejected by the existing response gate. No legitimate negative-custody path or valid-state deadlock was established in this audit. The first malformed case is stronger than a mere delayed exception: the public dispatcher returns an invalid force state. The existing public atomic wrapper protects the second printed case, but cannot substitute for pre-cost validation of a separately saved BG declaration.

Review snapshot: `game/engine.ts` SHA-256 `acd951aea03ab4f644c6da5e288eea2b45ec7307c5229b4da3dee128fa8e052a`; `game/revival-cancellation.ts` `b33b91f13cb47b33a27c326a8da3e2564f17b9edb9c415129ba6a0553d43415f`; `game/disaster-preflight.ts` `7858d08906b556af1e4e1c48621d145b2241b0c7caeb1201a8ca3a390d721ae1`. Line anchors are approximate; other families were being edited concurrently.

## Existing rules evidence and implemented behavior

This audit uses the publisher-authored CHOAM/Richese text already verified in the repository, including `/tmp/dune-rules/choam-lelekan-mirror.txt`, printed pp.7 and12. Source access and limits are documented in [CHOAM_REMAINING_RULES.md](CHOAM_REMAINING_RULES.md) and the later [CHOAM_KULL_SOURCE_UPDATE.md](CHOAM_KULL_SOURCE_UPDATE.md). The original publisher source is the [CHOAM & Richese rulebook](https://www.gf9games.com/dune/wp-content/uploads/2021/11/CHOAM-Rulebook-low-res.pdf). No fresh external search or new ruling is claimed here.

The rules identify movement-turn Kulon, moving-storm Jubba protection in one territory, Revival-phase free-revival prevention, and Mentat Gamont returning one opposing force. The expansion's Karama table permits prevention of the special-effect Worthless discard during that phase. Current runtime keeps the declared Worthless card on cancellation and records its physical ID in `{turn,phase,cards}`. This audit preserves that implementation; it does not resolve whether the printed restriction should extend across other copies/effects.

Jubba is already implemented and tested, including its public threat-based opportunity, one selected territory, multiple crossed sectors, other factions' casualties, cancellation, and moved/cashed-in card fizzle. The older source audit contains historical proposals and unresolved questions; it should not be read as a claim that all Jubba runtime remains absent. Kull still has separate source/priority/custody questions and is outside this continuation slice. Auditor has its own completed runtime/docs and is unrelated to this work.

## Current control flow

`playChoamWorthless` (~11298) permits only a clear ordinary context or a CHOAM-owned Storm, FreeRevival, Movement or Mentat decision. It captures four booleans from that original decision, clears the decision, resets ready, saves the declared identity/effect/target/location, and opens `choamWorthless`. `karama-context.ts` binds the pending declaration and only the selected movement/revival/storm parent; it does not prove those parents semantically valid.

`validateKaramaUse` (~5259) currently verifies pending owner is the actual CHOAM response owner. Its additional Baliset path validates the retained move or a legitimate fizzle and checks arrival. There is no equivalent non-Baliset resume validation.

`finishResponse` (~10254) clears the Worthless pending record, records the phase block when canceled, and then independently executes every truthy suffix flag:

1. `storm && stormResolution` → `offerChoamStorm`.
2. `revival && pendingRevival` → `offerRevivalStop`.
3. `movement && pendingChoamMove` → `resumeChoamMovement`.
4. `mentat` → overwrite decision with `choamMentat`.

Missing parents can silently suppress a required continuation. Contradictory flags can run multiple suffixes and overwrite a real decision. This is a concrete reason to replace independent booleans at the validation boundary with one discriminated resume result, while preserving legacy absent/false optional fields.

## Proposed pure declaration/resume contract

Return an immutable quote containing exact current block receipt, cleared pending record, and one of `none`, `stormOffer`, `revivalResume`, `movementResume`, `mentatDecision`. Do not apply the denied effect or manufacture a future player's answer. Use the same quote before initial cost and immediately before real cancellation settlement; preserve the atomic wrapper for later automatic work.

Minimum common checks:

- Playing status, valid turn and phase; seated CHOAM owner equal to response owner; `choamWorthless` response; supported effect and nonempty declared physical ID; effect/printed-name/response intent correspondence; target/location/elite binding where produced.
- Validate the phase-local blocked record only when reading/extending it: array of distinct valid IDs, matching stamps, and safe append without replaying an already completed cancellation. Do not discard or transfer CHOAM's declared card.
- Resolve exactly one original context. Optional absent flags mean false. Every flag must be boolean if present; at most one is true. `revival` is currently always emitted as a boolean. Preserve legitimate proactive declarations with all flags false.
- Do not demand that the declared card remains held, that the denied target still has forces, or that the denied ability remains useful. Existing tests permit CHOAM cash-in to remove a pending Worthless card and then resume its parent. Use stable declared identity, not a new custody requirement for an effect cancellation will skip.
- Bind enough source to validate the stored continuation, without freezing unrelated hands, balances, passes, logs, private inspections or nested gift/Box controls. BG signatures remain identity evidence; semantic validation is separate.

| Effect/context actually produced | Deterministic denied result and needed source | Avoid imposing |
| --- | --- | --- |
| Kulon, phase5, all flags false | Exact blocked receipt; no movement bonus and no immediate move. Original owner is the active CHOAM movement player. | Requiring a useful remaining route, current Ornithopter compatibility, or executing a movement. Those are conditions for the denied effect. |
| Proactive La La La, phase4, no flags | Block receipt only; no free-revival restriction and no pending revival. Target must be a seated player. | A free-force entitlement, Tanks availability, or target distinct from CHOAM; the proactive producer does not forbid self-targeting. |
| Reactive La La La, phase4, `revival=true` only | Original free-force request exists, belongs to declared target, targets someone other than CHOAM, has free>0 and is not Emperor extra revival. Resume the **unchanged** original quote through Tleilaxu stop decision or remaining checks/current settlement. | Treating this as cancellation of `choamRevival` or `revivalDiscount`; no benefit is being removed from the original quote. |
| Jubba, phase0, `storm=true` only | Existing untraversed storm and selected territory/CHOAM target bound; retain all prior protections; recompute public threat offer from current state or proceed to Fremen protection/traversal. | Requiring current threatened forces in the selected territory or current ownership of Jubba. Cancellation does not protect that territory. |
| Gamont, phase8, flags false | Block receipt only; no force return, marker reveal or reserve change. | Current target force/No-Field availability. That is checked only when allowing Gamont. |
| Gamont, phase8, `mentat=true` only | Same no-effect block, then exact CHOAM Mentat decision with `choamMentatPending` true and CHOAM owner. | Calling victory, settling Stronghold ownership, advancing phase, or choosing done on the player's behalf. |

Baliset can retain its current proven movement helper; apply the common discriminated envelope without changing its fizzle rules. A Kulon declaration cannot legitimately borrow the reactive Baliset flag merely because both occur in phase5.

## Shared unchanged revival continuation

`beginRevival` (~9932) offers the CHOAM decision before `offerRevivalStop`; the latter (~9955) stops at a real Advanced Tleilaxu special-Karama decision even without inspecting its private hand. Otherwise `finishRevival` (~9852) shifts the first check, opens its response, or performs current payment/custody/counter updates and possible income.

Extract a pure `quoteRevivalResume` from the reusable pieces of `game/revival-cancellation.ts`, and call it from the actual resume path as well. Do **not** forge a canceled benefit to reuse `quoteRevivalCancellation`: that helper reprices/changes rules and assumes it is already after an initial benefit response. In particular, its current `checks.length<=1` / remaining-discount restriction does not cover the untouched initial queue, which may contain `revivalLimit` followed by `revivalDiscount`.

The shared resume quote should validate declared kind, positive amount, exact ordinary/elite typing, free/cost/normalCost relationships, payer, target, recognized ordered check queue and required faction owners. For an immediate successful force revival, use the existing custody and safe counter additions (Tanks/reserves/revived/free usage/elite revival, Emperor-extra when that broader helper is reused). Validate tech-token income prerequisites where free revival queues tech income, and the subsequent Tleilaxu income receipt as a separate immediate boundary.

Preserve existing no-effect outcomes: a currently unfunded request or Fremen-limit failure is abandoned without moving forces or charging. Do not turn those intended fizzles into a new mandatory payment. A future Tleilaxu decision does not authorize its choice; a benefit/income response may auto-allow when no cancellation card remains, so the original atomic wrapper still matters. The quote neither draws RNG nor repeats `beginRevival` and reopens the CHOAM interception.

## Jubba and Mentat boundaries

Reuse `validateStormTraversal` for the actual pending disaster's typed forces, Tanks, No-Field materialization prerequisites and finite distance. Keep support for initial storm origin0 and total distance up to40. A Jubba offer precedes traversal, so require traversed0 and no queued mid-traversal loss group. Also validate `choamProtected` as readable territory identities before `includes`, and bind source ownership; do not rotate the storm or sample a new card.

Share a pure threat/next-offer calculation with `choamStormOptions` / `offerChoamStorm` (~3578–3624). Return a CHOAM choice while any unprotected public threat remains. If none remains, the next branch may be an Advanced Fremen response or actual storm traversal; report that boundary explicitly. Never infer an empty threat offer from whether a private hand contains another Jubba. After cancellation, the current runtime can offer CHOAM the same threatened territory again even though the specific card is blocked; decline remains legal and another permitted card/copy remains a separate rules question.

Mentat is the smallest return-only branch. Require phase8 and its pending opportunity before restoring the decision. No board/victory quote is necessary until the user chooses completion. This directly prevents the reproduced phase4 orphaned Mentat decision.

## Minimum implementation verification

1. Preserve the three reproduced corrupted-source cases for printed, initial BG and final allowed BG paths. Assert no new cost or SQL write on malformed pending parents; distinguish existing atomic printed exceptions from invalid returned states.
2. Actual reactive La La La with free-only and mixed free/paid revival, typed elites, Tleilaxu stop decision, two remaining benefit checks, insufficient funding/faction-limit fizzle, and later income/tech continuation. No duplicate force movement or payment after JSON/CAS recovery.
3. Jubba with remaining public threat, empty current threat, prior protected territory, initial origin0/distance40, typed pending loss corruption, and no hidden-card-dependent choice. Pure checks use no UUID or RNG.
4. Proactive versus reactive Gamont; canceled concealed marker remains concealed; only genuine Mentat-origin declaration restores `choamMentat`.
5. Existing CHOAM cash-in removing the pending physical Worthless card must still permit cancellation/fizzle and correct parent restoration. No new hand-custody policy or Kull activation is introduced.

Validation for this audit: read current producers/consumers and existing relevant tests; inspected existing publisher-text evidence; ran the temporary dispatcher probe described above. No full suite or new permanent tests were run. The proposed shared quote is not implemented by this document. No new rule interpretation, full expansion enablement, Semuta reaction policy, or durable general Karama cost frame is authorized or claimed here.
