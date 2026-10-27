# Advanced Charity player order

27 October 2026. **Prototyped / Partial.** This is a core source correction;
complete Advanced, optional combinations and final acceptance remain open.

## Source and cutover

The user-authorized `UNOFFICIAL_Revised_Dune_Rulebook_v.2.3_web.pdf`,
physical8/printed6, starts Charity with the First Player and proceeds
counterclockwise. This is the supplied Advanced authority bound by the
[source amendment](RULE_DECISIONS.md#authorized-source-amendment--1-october-2026),
not a newly located publisher ruling. The bounded source read is:

```sh
pdftotext -f 8 -l 8 -layout UNOFFICIAL_Revised_Dune_Rulebook_v.2.3_web.pdf -
```

New Advanced Charity phases retain the actual First Player order established
by Storm. Basic and already-opened unstamped Advanced phases keep concurrent
readiness; viewing or claiming does not manufacture a new order midway.

## Connected behavior

- A version1 public `charityOrder` retains the original turn, full order and
  remaining suffix. Only its current seat may make an ordinary Charity claim
  or use **Finish Charity turn**. Claiming is optional; finishing without a
  claim passes that opportunity. Wealth and entitlement remain private.
- CHOAM opening income resolves before any claim or finish. A wealthy Advanced
  Bene Gesserit claim retains its native Karama response. Neither the claim nor
  a response advances the player order; required interactions finish first.
- Finish consumes one opportunity and records its completed prefix. Closing
  market/Nexus decisions retain the frame until the phase actually ends.
  No second claim, replayed Finish or new Truthtrance answer reopens a completed
  ordered turn. Existing Basic/unstamped readiness reopening remains.
- Detached Truthtrance witnesses may quote one remaining owned future Charity
  preparation. They neither claim early at the real table nor replay a closed
  opportunity. Guidance and minimal AI wait for the actual current seat.
- Inflation, Homeworld additions, Production and the existing provisional
  [CHOAM shortfall funding](CHOAM_CHARITY_FUNDING.md) retain their calculations.
  Other cards and faction responses keep their own timing and authorized actor.

`game/charity-order.ts` owns the immutable order calculation. The engine owns
phase lifecycle, claims and projection; `components/charity-claim.tsx` supplies
persistent current/wait/completed guidance and the existing `charity`/`ready`
packets. No database migration or saved-game conversion is added.

## Juice of Sapho — 27 October 2026

The printed [Sapho first/last alternative](JUICE_OF_SAPHO_SOURCE_UPDATE.md)
applies to a player-ordered phase. An unreserved owned physical card now takes
its holder first or last among the remaining Charity turns and is discarded
once. The original physical First Player order stays unchanged. No extra claim,
repeated completed turn, refund or reset is granted. Basic and already-opened
unstamped concurrent Charity phases have no fabricated ordered scope.

Only an actual accepted `scope: charity` use creates version2 `charityOrder`
with original order, actual remaining/completed opportunities, current-start
state and public use history. Untouched version1 frames retain their stored
shape; native `charityTurn` receipts establish whether the current turn started.
Once a native claim has been accepted, including a later canceled wealthy BG
claim, that current player finishes unchanged. Under the standing recommended
interpretation authority, a different unstarted holder may reorder the later
tail; first then means first after the started actor. The holder cannot split
its own started turn. This queued timing is **provisional software composition**,
not a newly found publisher answer.

The persistent panel names the protected actor, explains the later queue and
keeps one claim per player. Its normal card/scope/event/mode packet carries no
display-only `afterCurrent` metadata. Current/wait/completed claim and Finish
controls follow both frame versions. Existing minimal legal policies use the
same projected options; no strategic AI tuning is added. If the optional Semuta
preview offers the real used card, the queue is committed before that separate
discard reaction and resumes once, retaining the claim receipts and turn.

Broader optional-module interactions, full-mode and final acceptance remain.


## Initial ordered-phase evidence

Frozen **15 files, 147/147**, types/lint/build and four native start programmes
pass. Three explicit Advanced previews exercise allowed income, original Karama
cancellation of income or wealthy BG; Basic uses two concurrent low claimants.
Actual pre-Charity bribes create poverty and defer incoming money normally.
Runtime records 11 GameTable SSR, 26 claim-panel renders, 8 actual claim
callbacks and 9 actual Finish callbacks, with source/further action arrays
101/30 across programmes. Native response/cancellation/closing actions are
applied directly; browser callbacks for those separate controls were not operated.

Nineteen new pure/native/control/Truth cases cover order, optional claims,
responses, Basic/labelled unstamped compatibility, legal policies and future or
completed Charity entitlement. A genuine final-owner case caught commitment
evasion when Finish immediately opened a later phase; preflight now checks the
closed opportunity before its voluntary actor can disappear behind that opening.
Older payment, Production and Inflation sources finish preceding native turns.
The cancelled-income smoke correctly accepts automatic wealthy BG settlement
once the sole original Karama is spent. No game money, phase or queue is installed.

Proof: `/home/quintine/.local/share/dune/checkpoints/20261027-advanced-charity-order-proof-v4/`;
HTML/journeys: adjacent `20261027-advanced-charity-order-runtime/run-v2/`.
Tests/types/lint carry from v3 under exactly the same source snapshot; only the
private smoke harness changed. The existing server returned HTTP200 unchanged.
This is the earlier local native/SSR/callback evidence. The Sapho follow-up above
adds its own bounded proof; full modes, wider interactions,
final rules/recovery/privacy and deployed acceptance remain due.

## Sapho focused evidence

Sapho now takes its holder first/last among remaining Advanced Charity turns.
Actual use creates version2 order history; untouched version1 frames retain
original bytes. An accepted current native claim provisionally protects that
actor before another holder reorders the later tail. Completed turns, one claim
per player and physical First Player order remain. Own started turns cannot
split. Basic/old unstamped concurrent phases have no manufactured scope. The
persistent controls name the protected actor, and native claims/Finish follow
the changed queue. This is provisional retained-current timing, not a new
publisher ruling. [Source and contract](ADVANCED_CHARITY_ORDER.md#juice-of-sapho--27-october-2026).

Frozen **12-file union, 108/108**, types/lint/build and four original-game
Advanced preview programmes pass. Actual original cache auction bid1 buys
Sapho; the native first turn continues through Storm2 to Charity2. Clean and
actually claimed current turns exercise both first/last. Runtime records
12 GameTable SSR, 4 Sapho panels, 8 Charity panels, 4 actual SaphoOrderButton,
2 claim and 4 Finish callbacks. Source/further action arrays total320/24.
Actual bribes create poverty; no played hand/purse/phase/queue/claim is installed.
Other native controls are applied directly, without a clicked-control claim.
Browser hydration/navigation and deployed acceptance were not operated.

Eighteen new helper/native/control cases pass, including all four minimal
profiles and Semuta claim/pass. The two Semuta cases inherit an explicitly
controlled conserved physical-card acquisition, advance forward from actual
Revival2 to Charity3, then exercise the real disposal continuation. They are
supplemental composition evidence, not original acquisition proof. The committed
queue resumes once without another claim or order application. AI strategy and
calibration stay deferred.

Proof: `/home/quintine/.local/share/dune/checkpoints/20261027-sapho-charity-order-proof-v1/`;
journeys/HTML: adjacent `20261027-sapho-charity-order-runtime/run-v1/`.
All checks use the same frozen source; the final evidence prose is a separately
recorded three-document overlay. The existing server returned HTTP200 without
restart. No saved-game/database operation. Wider interactions, complete modes
and final rules/recovery/privacy/browser/deployed acceptance remain.
