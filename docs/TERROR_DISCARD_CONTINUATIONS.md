# Forced Terror discard continuation checkpoint

7 September 2026. Sabotage and Robbery overflow now preserve their committed discard as a recoverable step. The original arrival, revealed token, random victim or deck draw cannot be replayed by resuming that step. This extends the [exchange](TREACHERY_DISCARD_CONTINUATIONS.md) and [battle](BATTLE_DISCARD_CONTINUATIONS.md) infrastructure. Semuta remains inactive and its pending reaction-timing/capacity questions remain unanswered. No start gate changed.

## Committed effects and remaining choices

Sabotage records the exact randomly discarded entrant card after removing the Terror token and logging the effect. Its private receipt identifies the entrant as former owner, even though Moritani made the reveal decision. Recovery only opens Moritani's optional gift, or finishes when Moritani has no hand cards. An empty victim hand emits no discard event; the optional gift still remains available. A subsequent gift transfers a card and creates no extra discard.

Robbery draws before its hand-limit decision, including an already completed empty-deck refill. An explicit overflow discard saves that one selected Moritani card. Recovery finishes a five-to-four hand reduction or reopens the next discard if an exceptional larger overflow remains. It never draws, refills, steals spice or reveals the token again. Successive explicit choices create separate batches. A legal intervening Truthtrance that itself reduces the hand still resolves the original overflow without inventing a Robbery discard.

The saved `terrorDiscard` continuation contains source, Moritani owner, detached consumed arrival and former hand size. There is no callback, whole-game rollback snapshot, reroll seed or replayed client action. The unique removed physical token and current turn/phase identify the consumed opportunity; the existing monotonic discard sequence prevents reuse. No independent entry-event field was introduced.

The suffix retires the discard sequence before restoring the arrival. Worm-ride completion continues through the existing `finishTerrorEntry`/`nextWormRide` path. A Nexus deferred by an intervening summoned worm still opens before the next ride or phase advancement.

## Validation and privacy

Read, action and automatic recovery all verify one private fresh card receipt, exact custody, current turn/phase, matching removed token and source, seated former owner and Moritani, stronghold/sector, typed arrival counts, pre-discard hand size and the appropriate consumed stage. Robbery validates that the hand exceeded its limit before the discard; four cards afterward is valid.

Independent review prompted additional rejection of conflicting hand-exchange/summoned-worm contexts and a bidirectional worm cause/resume binding to the Fremen entrant in Spice Blow. The historical arrival does not recheck current occupation or alliance, which can legitimately have changed during an intervening effect. This is bounded saved-state validation, not cryptographic authentication of arbitrary wholesale database edits.

A zero-valued Richese No-Field shipment is tested through real actions: it counts as one marker in the arrival receipt, costs one spice in the tested stronghold, and moves no physical reserves. The validator permits nonnegative receipt amounts, but the actual zero-marker test records amount one. Earlier review wording claiming that a positive receipt check would reject this route was corrected.

Private discard faces and continuation fields do not appear in any seat view. Swapping a hidden discarded identity with an unseen deck identity leaves every tested projection unchanged. The public automatic-work marker schedules authenticated recovery; every AI level waits on that marker. The existing table work indicator remains sufficient because these frames still complete automatically. No new human Semuta controls or claim policy was introduced.

## Verification

Registered coverage is twelve engine/AI continuation tests and four production-room SQLite tests. They include real paid shipment, reveal/draw/discard, optional gift/no-gift, zero victim hand, old/new overflow selection, empty-deck refill, repeated overflow, physical conservation, 78 targeted malformed-state mutations, private projection equivalence, all profiles, deferred Nexus and Truthtrance. The SQL tests use actual credentials and migrations, then documented bounded expansion fixtures. Competing workers commit one state update; stale, corrupt and retired submissions cannot repeat the effect. The coordinating agent read both complete contributed test files and the independent runtime review.

**Final verification: 1,685 rules/client/component tests and 165 multiplayer persistence/API tests pass (1,850 total).** All final command handles reached terminal success:

- Rules: `/tmp/dune-terror-frame-final-rules.log`, 54.83 seconds, exit 0.
- Multiplayer: `/tmp/dune-terror-frame-final-multiplayer.log`, 19.30 seconds, exit 0.
- TypeScript: `/tmp/dune-terror-frame-final-type2.log`, exit 0.
- Lint: `/tmp/dune-terror-frame-final-lint.log`, exit 0; the extended test file also passes named type-aware lint.
- Production build: `/tmp/dune-terror-frame-final-build.log`, exit 0.
- Final source fingerprints: `/tmp/dune-terror-frame-final-fingerprints.json`.

This evidence does not establish complete Moritani games or full expansion compliance.

A current-source sample completed 20/20 Basic games across two through six players and four homogeneous AI difficulties: 11,332 accepted actions, zero rejected candidates/stalls/checked invariant failures and 509 JSON round trips. Seed 20261003; results and complete traces `/tmp/dune-terror-frame-base-fullgames.json`, runner `/tmp/dune-sapho-base-fullgames.ts`. Source fingerprints stayed unchanged. Setup and actions are public production operations with ordinary AI, without injected resources or inventory. This Basic sample does not contain Terror or Semuta and does not calibrate relative AI strength.

Browser inspection verified the table-to-rules link, search, direct Semuta topic link and readable updated five-area checklist. The existing QA seat remained at turn 2 Spice Collection with 20 spice, 20 reserves and an empty hand; no gameplay action or staged Terror UI interaction was performed. Last manual restart remains 03:48 UTC, with 1,806 saved rooms restored unchanged. The server remains running and the removed automation remains removed.

## Remaining work

Other discard producers still need their precise saved suffixes: Box's selected transfer/shuffle, Ornithopter escrow, Truthtrance's consumed queue head, ordinary cards and the distinct Karama activation/effect batches. Semuta additionally requires the unresolved reaction timing and full-hand decisions, authenticated commitment, entitled private candidate selection, human/AI controls and full combination/recovery games. Wider faction/module scope, Mirror Weapon and remaining Sapho timings are unfinished.

Contract: [FORCED_DISCARD_FRAME_REVIEW.md](FORCED_DISCARD_FRAME_REVIEW.md). Runtime review: [TERROR_DISCARD_RUNTIME_REVIEW.md](TERROR_DISCARD_RUNTIME_REVIEW.md).
