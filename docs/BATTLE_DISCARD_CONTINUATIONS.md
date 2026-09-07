# Battle discard recovery checkpoint

7 September 2026. Battle settlement now records coherent saved steps at mandatory card disposal, the winner's optional disposal and Moritani alliance cleanup. This extends the [exchange foundation](TREACHERY_DISCARD_CONTINUATIONS.md); it does not activate Semuta or change its unresolved reaction/capacity rules. No mode gate has been opened.

## Implementation and ordering

Mandatory battle disposal is one mixed-owner batch containing the cards actually discarded by both combatants. Revealed card faces are public; retained winner cards and Moritani reservations are excluded. Original support payments, defeated forces, leader deaths, bounty and completed battle bookkeeping commit before the pause. A resolved-battle receipt binds event, turn, territory, combatants, winner and outcome. The active battle is cleared before the saved step becomes visible.

Normal Advanced/Ixian winner casualties retain the effective force strengths, free support, committed dial/support and exact legal allocations from the original battle. These values are captured before temporary Karama cancellation flags disappear. Recovery applies a sole allocation automatically or presents the original multiple choices. It cannot restore a canceled Fremen support or elite advantage by recomputing from the post-battle player.

The remaining order is winner casualties, applicable Ixian substitution, optional winner cards, Moritani cleanup, CHOAM support income, tech transfer, Harkonnen capture, Auditor, Face Dance and the next battle/phase. Winner and Moritani discards are distinct later batches. Empty batches create no event. Moritani's consumed retention receipt preserves played and kept identities without requiring discarded cards to remain in hand. Older cleanup decisions without a resolved receipt can establish one from their existing authenticated parent; a mismatching existing receipt is rejected.

Sequence retirement precedes the remaining work. Ordinary public actions still drain these saved steps automatically. Test-only observation of unchanged private production dispatch captures real intermediate frames; this is not a public Semuta reaction window.

## Integrity, privacy and multiplayer

Frame validation checks current context, exact physical custody, owner/public-face metadata, complete cleanup membership, retained-card custody, legal frozen casualties and remaining battle obligations. Auditor validation runs before projection as well as action/normalization: an added regression exposed and fixed a view path that previously accepted a corrupted Auditor owner. This was persisted-state validation evidence, not a demonstrated client exploit.

The public view exposes only the existing automatic-work marker, not the receipt or hidden unrelated hands. AI waits during that saved step; automatic recovery uses the production room compare-and-swap. The table says “Completing the card action” while work is pending. Tests exercise genuine authenticated room credentials and migrated SQLite, then stage bounded Advanced battles; they do not claim an entire public expansion game.

Ten older battle test files used duplicate physical card IDs or incomplete synthetic cleanup context. Their fixtures now draw exact cards from the deck, return prior starting hands before replacement, and supply the actual resolved combatant pair. Existing behavioral assertions remain intact. Ix expansion battle cards are introduced only in fixtures already testing them.

## Verification

Permanent tests cover mandatory mixed-owner disposal, hero/defense disposal, exact casualties, four actual Karama cancellation combinations, winner/Moritani cleanup, empty batches, simultaneous tech/capture/Auditor/Face Dance/income obligations, private views and malformed receipts. SQL tests cover all three frame producers, fresh module/seat reads, competing recovery workers, stale submissions, zero writes on corrupt state and retired-frame replay. Concurrent valid recovery yields exactly one successful state write.

**Final verification: 1,673 rules/client/component tests and 161 multiplayer persistence/API tests pass (1,834 total).** Twenty new rules tests and five SQL recovery tests are registered across `battle-discard-continuations.test.ts`, `battle-context-lifecycle.test.ts` and `battle-discard-recovery.test.ts`. Lifecycle coverage includes legacy cleanup migration, a genuine second battle in the same phase, actual Collection/Mentat turn advancement followed by a staged later battle, and rejection of mismatching receipts. The coordinating agent read every new test and all ten modified fixture diffs, integrated the runtime changes, and reviewed both independent contract reports.

- Rules: `/tmp/dune-battle-frame-final-rules.log`, 53.28 seconds, exit 0.
- Multiplayer: `/tmp/dune-battle-frame-final-multiplayer.log`, 17.84 seconds, exit 0.
- TypeScript: `/tmp/dune-battle-frame-final-type.log`, exit 0.
- Lint: `/tmp/dune-battle-frame-final-lint.log`, exit 0.
- Production build: `/tmp/dune-battle-frame-final-build.log`, exit 0.
- Final source fingerprints: `/tmp/dune-battle-frame-final-fingerprints.json`.

The current-source Basic sample completed **20/20 games** (two through six players, each of four homogeneous AI difficulties), with 12,114 accepted actions, zero rejected candidates/stalls/checked invariant failures, and 540 JSON round trips. It uses public production setup and ordinary AI proposals without resource/card injection. Runner: `/tmp/dune-sapho-base-fullgames.ts`; trace/results: `/tmp/dune-battle-frame-base-fullgames-final.json`; seed 20261002. Source fingerprints remained unchanged during the run. The same seed had already passed before the final Auditor guard; these are one repeated sample, not 40 independent games. This Basic sample cannot exercise Semuta or the expansion-only recovery branches and does not establish comparative AI strength. No full Advanced/expansion compliance follows from these checks.

Manual maintenance at 03:48 UTC saved 1,806 rooms in `/tmp/dune-maintenance-20260907T0348/database.sqlite`; all saved JSON hashes and versions matched after restart. The known human room was idle at version 14. Browser restoration retained the QA room at version 47, turn 2 Spice Collection, the same human Emperor seat, 20 spice, 20 reserves, empty hand and Ready control. Desktop layout was visually inspected. The development server remains running; the removed automation remains removed.

## Remaining work

Semuta still needs the pending reaction timing and full-hand choices, remaining discard producers, authenticated commitment/selection, private candidate controls, AI claim decisions and complete combination/recovery verification. Battle frames currently require fresh cards to remain in discard; a future claimed stage must define and validate its different custody. Mirror Weapon, other Sapho timing modes and broad Advanced/faction/module acceptance remain unfinished.

The next bounded producer contract is recorded in [FORCED_DISCARD_FRAME_REVIEW.md](FORCED_DISCARD_FRAME_REVIEW.md): Sabotage must retain its already sampled victim and Robbery must retain its already drawn card without rerunning either source action.
