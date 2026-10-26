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

Juice of Sapho first/last composition for this newly ordered phase remains
missing and is recorded for the later interaction pass. This version does not
pretend an unavailable card interaction is complete.

## Focused evidence

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
This is local native/SSR/callback evidence. Sapho, full modes, wider interactions,
final rules/recovery/privacy and deployed acceptance remain due.
