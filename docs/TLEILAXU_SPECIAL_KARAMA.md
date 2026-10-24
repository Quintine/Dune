# Tleilaxu Special Karama during Revival

## Source and selected scope — 24 October 2026

Status: **Prototyped / Partial**. The supplied authorized Advanced rulebook’s
physical38 H permits a Karama during Revival to prevent any one player from
reviving forces or leaders. It imposes no pending-request, unused-allowance,
Tanks-count or opponent-only prerequisite. The native Advanced owner can now
declare at a quiet phase4 boundary, including after a prior return or after the
target marks ready. Self and ally selection remain legal. The original normal
revivalStop decision is retained and binds only its pending recipient.

Physical16/39 says Karama cannot stop a Special Karama Power. Emperor’s native
special revival (physical31 D) therefore remains immune. Physical39’s Ghola
erratum allows free immediate own-leader or up-to-five-force returns regardless
of normal leader eligibility and without using normal revival allowance; it
does not expressly confer prevention immunity.

The 14 October choose-recommended authority selects this **provisional textual
composition**: prevention includes Ghola Treachery during the remainder of the
affected Revival Phase and expires outside that phase. Ghola during Shipment
and Movement or Battle stays legal. This replaces the earlier provisional Ghola
bypass; it is not a direct combined GF9 FAQ ruling. No already completed return,
payment, income or allowance is undone. Low-population Homeworld overlap remains
guarded under its existing unresolved contract. Wider combinations and complete
rules/mode acceptance remain unfinished.

## Connected implementation

- [Shared quote](../game/tleilaxu-special-karama.ts) takes current spendable
  physical cards, seated identities, enclosing priorities and target blocks.
  Readiness, public Tanks and hidden leader eligibility do not gate selection.
- [Engine](../game/engine.ts) supplies the owner-only native Advanced phase4
  projection and revalidates the same quote before spending. Quiet intents carry
  no pending revival; interrupted intents bind the complete original request.
  A newly pending request cannot replace a quiet intent before execution.
- [Controls](../components/tleilaxu-special-karama.tsx) expose actual card/target
  actions in the quiet window and the existing pending decision. Pending decline
  remains separate. The guide persists with the normal table; it adds no
  confirmation, automatic delay or turn advancement.
- [Ordinary card availability](../game/card-availability.ts) and the engine’s
  shared Ghola executor both apply the current-phase prevention receipt. The
  existing [revival clock](../game/revival.ts) retains phase/turn/recipient scope.
- [Minimal bots](../game/bots.ts) reuse their original public-Tanks thresholds
  and pending-decision preference through the same projection. This supplies
  legal participation, without strategy refinement or difficulty calibration.

The original card is discarded once and the game-long special-use receipt is
spent once. A stopped pending request returns no pieces and consumes no payment,
normal allowance, elite quota or Emperor extra quota. Prior completed income and
returns remain recorded. No room, save, schema, start-mode or release gate changes.

## Bounded verification

[Native fixture](../tests/fixture-tleilaxu-special-karama.ts) starts an actual
public Advanced Tleilaxu/Atreides/Emperor preview with the Ix deck. Only unopened
original Treachery/Spice ordering and scalar shuffle order are selected. Native
setup deals the original Karama and Ghola. Paid one-force Tleilaxu and two-force
Atreides shipments put twelve Atreides counters into Arrakeen. An actual unarmed
Hidar4/Yueh1 battle sends those twelve counters to Tanks, then original phases
reach turn2 Revival. No phase, hand, wallet, casualty or played army is installed.
An optional branch actually completes a free return before declaration.

[Native window regressions](../tests/tleilaxu-special-karama-window.test.ts) cover
quiet, self/ready, completed paid/free return, original interruption, stale quiet
intent, actual phase expiry and the four existing profiles.
[Quote cases](../tests/tleilaxu-special-karama-quote.test.ts) cover ownership,
window, priority and independent target blocks.
[Control cases](../tests/tleilaxu-special-karama-controls.test.tsx) invoke the
actual callbacks and verify readable restrictions.
[Existing special cases](../tests/tleilaxu-special.test.ts) retain negotiated,
KH, elite, Emperor and pending source coverage, with the Ghola expectation cut
over explicitly.

Frozen related union: **14 files148/148**, types/lint and production build pass.
Six actual component-callback/engine/GameTable SSR journeys cover quiet, pending,
prior-free, prior-paid, ready and self choices, each continuing through actual
phase5 Ghola. Four existing profiles submit accepted proactive prevention and
continue without strategic tuning. Native source takes111 actions; prior-free
source takes113. Initial feedback repairs two stale Ghola-bypass expectations,
a quota-exhaustion assertion and one const lint issue. A private smoke-driver
correction leaves application bytes unchanged; the final runtime-only proof
explicitly reuses the passed source-identical union/types/lint/build.

Private reports, rendered HTML and hashes:
`/home/quintine/.local/share/dune/checkpoints/20261024-tleilaxu-special-karama/`.
`frozen-integrated-4/report.json` records reused checks from frozen-integrated-3
and the passing repaired runtime; source fingerprint is
`ea3f7b9de32d42208ea12cdafa5f581a2de0fee3638e307adade21591e6bbf7a`
on base `6ea691255af68003b900a490256b3d2381b32322`. Prose/reference evidence is
reviewed and hashed separately after verification.

These are focused prototype proofs. Comprehensive rules, combinations,
save/recovery/privacy/custody assurance, browser/mobile and deployed acceptance
remain due after all rules. No existing saved game is reset or deleted.
