# Advanced Revival player order

26 October 2026. **Prototyped / Partial.** This is one core source cutover,
not complete Advanced or optional-module certification.

## Source and interpretation

The user-authorized `UNOFFICIAL_Revised_Dune_Rulebook_v.2.3_web.pdf`,
physical9/printed7, expressly starts **Force Revival** with the First Player
and proceeds counterclockwise. It is the supplied unofficial Advanced authority
bound by the [source amendment](RULE_DECISIONS.md#authorized-source-amendment--1-october-2026),
not a newly located publisher ruling. Reproduce the bounded read with:

```sh
pdftotext -f 9 -l 9 -layout UNOFFICIAL_Revised_Dune_Rulebook_v.2.3_web.pdf -
```

The adjacent Leader Revival paragraph says leader returns are in addition to
force revival. This preview explicitly composes native force and leader/KH/
foreign-Ghola choices into one participant opportunity. The source does not
independently print a separate leader queue. Basic's publisher text supplies
no matching Force Revival sequence, so Basic keeps concurrent readiness.

## Connected behavior

- A new Advanced Revival opens a version1 public order using the actual
  First Player order already determined by Storm. Only its first remaining
  participant can make ordinary self returns, negotiate/request/accept a native
  leader return, or explicitly finish. Accepted native requests mark that
  opportunity started; subsequent requests retain it.
- Tleilaxu may quote or decline the current request and offer native limit/
  discount grants outside its own opportunity. Fremen grants remain separate.
  Emperor can pay for extra allied forces during the beneficiary's current
  opportunity. The response remains owned by its original authorized actor.
- A committed return and all required payment, income, card, placement and
  arrival decisions finish before ordinary Finish. Answering a response does
  not advance or consume the responder's own opportunity.
- Finish withdraws any outstanding unaccepted own leader negotiation, adds
  exactly that participant to the completed prefix and advances once. Completed
  native turns cannot reopen through another return, Finish or an early
  Truthtrance shipment/movement commitment.
- Card effects, Nexus and special Karama retain their separate existing timing.
  The guard targets native self actions rather than all actions in the phase.
  Private future-shipment witnesses may still consider a later owned Revival
  preparation; their policy waits for the real opportunity before proposing it.
- Closing decisions retain the completed frame until the phase actually ends.
  The next phase removes it. A phase already opened without the frame retains
  its legacy readiness semantics; projection never manufactures a queue midway.

`game/revival-order.ts` owns the immutable order calculation and validation;
the engine owns phase lifecycle, transactions and projection. Controls use
`components/revival-turn.tsx`, the existing native return buttons and commerce
controls. Minimal AI follows the same projected availability. No action kind,
database migration or saved-game conversion is added.

## Sapho first/last — 26 October 2026

The printed card permits first/last in a phase/action taken in player order;
the [existing source review](JUICE_OF_SAPHO_SOURCE_UPDATE.md) records that face.
The new Advanced Revival qualifies through supplied physical9/printed7. Basic
and already-opened unstamped Revival remain concurrent and receive no fabricated
first/last opportunity.

At a clean boundary, an owned physical Sapho changes an unfinished opportunity
to first or last. Existing completed participants, requests, quotas and physical
First Player order stay. The standing choose-recommended instruction selects
the same provisional started-tail protocol as movement: a current participant
who has made a native request finishes unchanged, while another unstarted holder
may go first behind it or last. Splitting the holder's own started opportunity
and consuming the card for an unchanged position are rejected.

Actual use upgrades only that phase frame to version2. Public use history binds
the original turn/order, completed prefix, current remaining queue, started
participant and revision. Replay advances exact completed opportunities and
never unlocks a started participant before completion. Native start/finish retain
that history. Original version1 creation and bytes remain unchanged; no phase
is converted merely by viewing it. Real recovered-card reuse is allowed when
the new position changes; no once-per-phase limit is invented.

The engine discards once and updates the current player from the changed queue.
The new `saphoRevivalDiscard` continuation permits existing opted-in Semuta
claim/pass before play resumes. Its original current/remaining/completed state,
requests, allowances and native resources are bound across the discard. Semuta
may move the used card; it cannot replay the queue change or turn completion.
The human action uses only existing card/scope/event/mode fields. Optional
`afterCurrent` is display guidance, not submitted authority. Existing minimal
policies already consume the shared server-derived Sapho options.

Focused evidence uses `tests/sapho-revival-order.test.ts`,
`tests/fixture-sapho-revival-order.ts`,
`tests/sapho-revival-order-engine.test.ts` and
`tests/sapho-revival-order-controls.test.tsx`.

Frozen **16 files,211/211**, types/lint/build and **ten runtime paths** pass,
with18 GameTable SSR renders and actual selected-props Sapho/Finish callbacks.
Eight paths are native: original public R/A/E/G +choam setup and paid cache1
acquisition use44 source actions. Actual normal1 shipment2 into the next Storm
sector, later card1 death and a free1 return use101. Clean/started first/last
retain the current return, original quotas, physical order and45 Treachery
identities; four minimal profiles each use one card plus four Finish actions.
Two controlled conserved-card Semuta supplements execute actual discard pass/
claim and continuation, without a played acquisition claim.

Original legal first-Storm dials keep Richese First Player through the next
card1; no phase, queue or physical force is installed to earn the native start.
Related feedback completes Basic's existing Semuta window before Extortion
payer answers, fixes empty name selections and narrows control-test types.
Report/manifest:
`/home/quintine/.local/share/dune/checkpoints/20261026-sapho-revival-order-proof-v3/`;
journeys/HTML: adjacent `20261026-sapho-revival-order-runtime/`. No saved-room/
D1/server, reset/restart, deployment or recovery operation. This is engine/SSR/
callback evidence; browser/mobile/deployed, combinations and complete-mode
acceptance remain open.

## Evidence and remaining scope

Focused cases are `tests/revival-order.test.ts`,
`tests/advanced-revival-order-engine.test.ts` and
`tests/advanced-revival-order-controls.test.tsx`. Their native source is
`tests/fixture-advanced-revival-order.ts`: public E/A/T plus the original Ix
deck, actual setup and first Revival; the return variant additionally earns
Tanks through paid shipment and a later actual Storm. Controlled old-envelope
and prior leader-death supplements are labelled separately.

Frozen proof passes **12 files,105/105**, types/lint/build and **nine runtime/
control paths** with13 GameTable SSR renders. Seven paths are native: first
ordered Revival (41 source actions), played normal1 shipment for2 and actual
later card-Storm casualty/free revival (99), Basic readiness (38), and four
minimal policies with5 further actions each. Native47 Treachery identities,
the returned ordinary counter and separate Tleilaxu bank1 remain. The other two
paths are explicitly controlled old-envelope and leader-death supplements.

Source-driver readiness and a stale Hajr test now use actual current Revival
and immediate post-movement controls. Feedback also removes false later-Storm
dials and mandatory uncontested-income acknowledgements, uses semantic status
markup and narrows an optional test ledger. Application source is unchanged
between successful `proof-v5` tests/types/lint/build and `proof-v6` runtime;
only the private SSR loader needed its existing Vinext aliases/CSS mapping.
Combined report and source manifest are in
`/home/quintine/.local/share/dune/checkpoints/20261026-advanced-revival-order-proof-v6/`;
journeys/HTML are adjacent `20261026-advanced-revival-order-runtime/`.
This is SSR/selected-props callback evidence. No saved-room/D1/server, reset,
restart, deployment or recovery operation occurs.

Broader Sapho and module combinations, full rules review,
save/recovery/privacy/custody assurance, browser/mobile and exact-revision
deployed acceptance remain due. Existing games, the local PDF and hosting
configuration are preserved. No mode/publication gate opens.
