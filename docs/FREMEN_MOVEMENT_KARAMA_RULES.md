# Fremen movement Karama: source and integration audit

Independent audit, 7 September 2026 local date. Documentation only; runtime changes and verification remain coordinator-owned. The narrow subject is cancellation of Fremen's ordinary two-territory movement advantage, including its separate legal uses. This does not establish completion of other Fremen or expansion powers.

## Source precedence

The [GF9 November 2020 FAQ, printed p.7](https://www.gf9games.com/dune/wp-content/uploads/2020/11/Dune-FAQ-Nov-2020.pdf) is decisive: a Karama cancels one use of a faction advantage, rather than the entire phase. Its Fremen entry reduces ordinary range from two territories to one and expressly leaves reserve shipment unaffected. Its Ixian entry separately preserves ornithopter movement. Its p.8 makes Hajr subject to normal movement rules and the player's own turn.

This supersedes the contrary whole-phase answer in the [April 2020 FAQ, printed p.1](https://www.gf9games.com/dune/wp-content/uploads/2020/04/Dune-FAQ.pdf). Do not revive that earlier duration rule through a phase-wide boolean. The [Ixian/Tleilaxu rulebook, printed p.12](https://www.gf9games.com/dunegame/wp-content/uploads/2020/09/IxianAndTleilaxuRulebook.pdf) confirms the separate movement/shipment treatment.

The [base rulebook, printed pp.9 and 16](https://www.gf9games.com/dunegame/wp-content/uploads/Dune-Rulebook.pdf) supplies ordinary movement, city ornithopters and the Fremen power. City access is evaluated at the start of each move and grants range three, including moves by forces elsewhere. The November FAQ p.9 confirms immediate access after shipping into a city. Fremen's alliance paragraph grants no ordinary ground-range benefit to an ally.

Direct opening of the November PDF returned HTTP403 during this audit. Nevertheless, the publisher-indexed full printed p.7 was independently retrieved using official-domain search, including the one-use answer and Fremen/Ixian entries; p.8 and p.9 were likewise retrieved. Local publisher-authored sources read were `/tmp/dune-rules/base.txt` and `/tmp/dune-rules/ix-official-mirror.txt`. The older and newer FAQ answers were compared explicitly, not inferred from a search result's crawl date.

Tournament pages surfaced during searching but were excluded as rules authority. In particular, their explicit wording permitting a replacement movement is not being represented as a quotation or special GF9 FAQ ruling.

## Range sources and extra movements

The following conclusions compose the rules above; they are not separately named card-combination FAQ answers.

| Situation | Correct cancellation boundary |
| --- | --- |
| Ordinary Fremen group needs two territories and has no independent range source | Offer cancellation before physical movement; successful cancellation removes the second territory for that movement use |
| Selected route already fits one territory | No actual use of the extra range needs a cancellation response |
| Fremen has Arrakeen/Carthag ornithopter access | The general city range is independent of the Fremen advantage; this cancellation must not reduce it |
| Hajr supplies a later movement | Its normal range is evaluated afresh; cancellation on the preceding movement is not a phase-wide restriction |
| Richese Ornithopter, fixed-three mode | The printed card supplies the range; do not cancel it as a Fremen faction advantage |
| Richese Ornithopter, two-normal-groups mode | Each different group uses current normal range. One group's Fremen range use can be canceled without canceling the card or the other group's later use |
| Fremen reinforcements from reserves | This is the protected shipment operation, not ground movement; do not alter range, price or reserve placement with this cancellation |
| Fremen uses an allied Guild shipment | Do not apply the ground-range cancellation to a shipment; Guild-specific powers and cancellation are separate |
| An allied faction makes its own ordinary ground move | No Fremen ground-speed benefit is printed for allies; do not give or cancel an invented one |

The Richese card face was independently inspected at `/tmp/dune-rules/choam-ornithopter-reading.png`. Its two modes distinguish a fixed three-territory group from two different groups using normal movement. Full component provenance and the existing combined-card boundaries are recorded in [RICHESE_ORNITHOPTER_ENGINE_AUDIT.md](RICHESE_ORNITHOPTER_ENGINE_AUDIT.md). The effect is available to its holder, including Fremen; canceling an independent faction advantage does not discard that movement card early.

Hajr plus the Richese card still has its separate unresolved **number/order of total moves** question in that prior audit. This audit does not resolve that combination by assigning three or four movements. It does resolve the cancellation scope for each independently supported ordinary or card-normal movement. Similarly, fixed-card Kulon and advanced advisor questions remain separate and do not block Fremen's normal cancellation.

## Concrete engine contract

The inspected preexisting Ixian design uses `pendingIxMove`, an `ixMovement` response and a `{turn, move}` restriction keyed to the player's current `p.moved`. On cancellation it leaves forces and movement count unchanged; a legal movement remains available. On allowance it forwards the stored movement through the regular CHOAM/entry continuation. This is a useful implementation pattern, not an independent rules source.

Root's new Fremen implementation was read in `game/engine.ts` after it was saved. It uses:

- `pendingFremenMove: {turn, move, order}` for the particular validated request;
- response kind `fremenMovement`, with public owner, destination and amount;
- `fremenMovementBlocked: {turn, move}` for the current movement use;
- a range calculation that preserves city and fixed-card sources;
- `pendingFremenMovement` and shared `validateMovementOrder` revalidation before the pending response is resolved;
- public current-move restriction projection consumed by bot range calculations.

The trigger checks a selected non-fixed-card Fremen route whose normal range is two and which actually needs more than one territory. It does not create a response for shipment, a one-territory ground move, a city-ornithopter move or a fixed-three card move. This relies only on public physical route/range facts, not a hidden future destination or opposing hand.

The response is offered after a complete valid declaration and before moving forces. This is **application scheduling** that makes the printed cancellation useful and reviewable. The inspected publisher sources do not require completing a movement, undoing board changes, and then replaying it.

After cancellation, the original out-of-range request cannot be automatically truncated: the player has a real choice of group and destination. Leave the original forces and counters in place and allow a currently legal replacement or the existing end-movement action. Keep the restriction attached to the same movement index so that simply resubmitting the same two-territory request does not evade it. The ordinary movement is still available because the canceled advantage did not say to forfeit it. This is composition with normal movement permission, not an imported tournament exception.

Only a successfully completed group advances `p.moved`. An invalid retry, card cancellation, response pass, refresh or reconnect must not advance it. Once an actual group completes, a later allowed Hajr move or second distinct card group has a new movement index and a fresh faction-range use. Ending the turn removes the practical entitlement; the turn key prevents restriction leakage into a future game turn.

For Richese two-group movement, maintain its separate card escrow and cohort accounting across the cancellation. If no group has moved, do not manufacture a completed group or discard the card as if it had. If group one already moved, never roll it back when group two is canceled. A replacement for group two still cannot reuse transported group-one units. Current ordinary city access is recomputed for each group and may independently grant three territories.

The allowed pending order must still pass current force, range, geography, alliance, stronghold and card-event validation before it commits. Passing the Fremen response forwards it to existing Baliset/intrusion/entry machinery; it is not permission to bypass those later effects. Nested Karama conversion must restore the exact pending order, and stale requests must fail before any card, force or movement counter changes.

## Verification boundary and acceptance cases

This source audit found no material unresolved ruling that blocks the proposed ordinary movement cancellation. Replacement-selection UI and per-move persistence are implementation work; a lack of printed UI timing does not itself require a user question. The already recorded Hajr/Richese total-move ambiguity remains outside the supported combined configuration.

Required coordinator verification:

1. Ordinary distance-two Fremen declaration, pass and cancel in Basic and Advanced; one-territory selection opens no unnecessary response.
2. Cancellation preserves exact force counts, selected units, spice, `p.moved`, shipment state and any movement-card escrow/cohort; only the actual Karama is spent.
3. Same-index retry remains range one, while a legal replacement commits once; invalid/stale/duplicate replies do not spend movement or cards again.
4. Both enabling cities preserve independent range three, including when the moving army starts elsewhere or city access was gained by shipment that turn.
5. Hajr's later move and Richese normal group's later move have fresh range and their own cancellation opportunity. Fixed-three mode does not expose this response.
6. Normal reserves, allied Guild transport, worm ride and allied non-Fremen movement remain in their own rule paths.
7. Baliset, other arrival decisions and supported card-event continuations preserve the parent order and unit custody; no automatic acknowledgement is required where no legal blocker exists.
8. All four AI levels and UI range controls consume the same current restriction; every proposed replacement is validated through the engine. Private hands and unchosen movement intentions stay private.
9. Persist/reload at the genuine pending response and at the replacement-choice state; check response ownership, exact-once cancellation and restoration after server restart.

No runtime or test file was changed by this audit, and no gameplay acceptance test was run by this agent. The source comparison and read-only contract review support implementation; they do not certify its completed behavior or enable unfinished expansion starts.
