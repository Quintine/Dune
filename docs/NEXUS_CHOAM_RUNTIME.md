# CHOAM Nexus Cunning runtime

The historical checkpoint below integrated native CHOAM Cunning with five Worthless effects in Basic and Advanced. The separately verified 1 October 2026 `nexus-kull` profile adds bounded source-aware Kull, with broader verification **Partial**. The [source contract](NEXUS_CHOAM_RULES.md) lists all six printed effects, not a full-family release. The older [printed Kull profile](CHOAM_KULL_DESIGN.md) still excludes Nexus; other Nexus previews still reject Kull. CHOAM Secret Ally and Betrayal retain separate contracts. No profile silently enables new choices in older games or certifies complete CHOAM, Nexus or expansions.

## Physical cost and timing

An unallied CHOAM player holding the CHOAM Nexus chooses one actual held Treachery Card and one supported effect. The card need not have the corresponding Worthless name. The engine preserves its original identity, ownership and any reservations; it does not manufacture a named Worthless card or grant a turn-long conversion ability.

The existing timing and target controls remain authoritative:

- Jubba Cloak protects CHOAM forces in one threatened territory during its moving-storm response.
- La La La prevents a selected player's free force revival, including the existing response before a mixed free/paid revival commits.
- Baliset prevents movement into a CHOAM-occupied territory, including the existing declared-movement response. It does not prevent shipment.
- Kulon adds one territory of range before an available CHOAM move, without granting another movement action. The fixed Ornithopter-range combination retains its existing ruling boundary.
- Trip to Gamont returns one selected opposing physical force during Mentat. Existing typed-counter, No-Field and deferred-victory behavior remains in force.

Playing Cunning spends its physical Nexus card and opens one ordinary CHOAM-effect Karama response. Cancellation leaves the selected Treachery Card held and the Nexus spent. Allowance discards the actual selected card once and applies the chosen effect. Its real discard category governs other consequences, including applicable private Ecaz income; the selected Worthless effect does not change that category.

## Controls, policy and private information

The engine's owner-only `choamWorthless.plays` separates `source`, `effect`, the actual `card`, an optional Nexus `event`, and a blocking reason. The original printed-card descriptor remains available. [Shared options](../game/choam-power-options.ts) construct ordinary card actions unchanged and add the explicit effect/event only for a Nexus use. They fence stale events, actor identity and current interruptions, and use the server's source-specific blocking reason.

The [cost selector](../components/choam-power-cost.tsx) is reused by the existing [storm](../components/choam-storm.tsx), [revival/range](../components/choam-worthless.tsx), [movement prevention](../components/choam-baliset.tsx) and [force return](../components/choam-gamont.tsx) panels. It names and inspects the real cost card separately from the effect, supports transport-busy state, and exposes blocked choices without offering an illegal action. The new Kull panel uses this source-aware convention only in its explicitly enabled reaction profile; generic proactive Nexus Kull remains unavailable. Public reaction windows and controls disclose neither hidden Nexus ownership nor CHOAM's private cost list.

All four bot profiles use the same projected plays. They preserve printed effects first, then prefer lower-value legal Nexus fuel, retaining their existing public-target policies. Easy's existing policy of allowing free revival remains unchanged. The ordinary Trip to Gamont preservation policy still reserves that printed card during a closing market or cash-in even though playing it must wait for the next legal window. These are legal policy extensions, not a new AI calibration claim.

Existing reactive windows depend on public circumstances rather than whether CHOAM holds a matching card. Cunning uses those same windows, so holding a private Nexus card does not introduce an identifying public wait. Opponents receive no private cost list. Saved engine receipts, cancellation and physical disposal are handled by the engine; consumer code does not reconstruct an opportunity from card names or old saves. Later bounded Semuta integration does not establish every Cunning fresh-discard composition. Native Cunning remains subject to its ordinary Karama response; neither this checkpoint nor the separate printed-Kull preview grants blanket Nexus immunity.

## Bounded Nexus Kull profile

Create a fresh local `nexus-kull` room through genuine setup with two to six ready seats, native CHOAM plus classic factions, Basic or Advanced, exactly the CHOAM/Ix Treachery decks and Nexus alone. `initializeNexusKullGameForAudit` identifies this capability with `nexusKullPreview` and the shared `kullPreview`. No optional module beyond Nexus, other expansion faction, Semuta or Richese Betrayal is admitted. The `kull` profile remains printed-only; existing saves and other Nexus previews do not inherit the new choice. The visible warning and closed public expansion start gate remain.

At the canonical validated Karama opportunity, CHOAM's private `kullReaction.plays` contains `{ source, effect: 'kull', card, event, blocked }` choices. The old `cards` field is removed. Printed source requires actual held Kull Wahad; Nexus source requires unallied native CHOAM's physical CHOAM Nexus and any eligible actual Treachery fuel. Canonical unique custody, reservation exclusion and source-specific own-promise feasibility apply before acceptance. A Karama fuel discard does not also activate Karama. Other viewers get empty plays and identical public event/actors/purpose regardless of secret Nexus identity or fuel; controls never infer an offer from the hand.

Use submits `{ type: 'kullDecision', event, source: 'printed' | 'nexus', card }`, with **source required** even for printed Kull. Decline submits `{ type: 'kullDecision', event, decline: true }`. There is no old omitted-source fallback, extra client-selected effect/target/price/Nexus ID or proactive any-time Kull action. The event is the pending attempted-play event, not a guessed generic Cunning receipt.

| Outcome | Physical Nexus | Selected fuel | Interrupted original |
| --- | --- | --- | --- |
| Decline | Retained | Retained | Resume exactly once with normal costs. |
| Accepted Nexus declaration, response pending | Spent once immediately | Held/reserved pending success | Held/reserved; a distinct eligible counter may act before the ban. |
| Kull prevented | Remains spent; no refund | Retained under existing exact-cost phase prevention | Resume exactly once; no Kull activation ban. |
| Kull succeeds | Remains spent | Discarded exactly once | Retained unplayed; effect/additional costs and special once-use unspent; activating player phase-blocked. |

Printed declarations spend no Nexus and retain their existing printed-card settlement. The original attempted card cannot serve as its own counter. Advanced BG originals are intercepted before conversion/discard; decline or prevention resumes their separate ordinary conversion, while success keeps the original Worthless card. A distinct BG counter has its own conversion ownership. The successful ban is stamped to turn/phase and applies to activations, not holding, trades or nonactivation disposal.

Distinct-counter priority, pre-conversion custody and deferred unpayable-overbid recovery are the user's selected policies. The neutral offer and Nexus-spent-at-accepted-declaration boundary are existing application conventions, not a located publisher response-order ruling. The private non-CHOAM unfunded Karama-dependent bid fence remains **before commitment**, independent of hidden Kull/Nexus ownership; no restart, free lot, funding remedy or numeric UI cap is introduced. Live original/fuel/counter promises must remain satisfiable; unsupported continuations are guarded before offering rather than releasing a promise.

The saved pending Kull and existing Cunning receipt/history must bind chosen source/fuel, accepted Nexus spend and the exact original typed continuation, including suspended BG or Karama parents. Refresh must not replay raw actions, double-discard, refund Nexus or restore a mutable whole-Game snapshot. Stale, foreign, malformed, deleted or orphaned source/receipt/history/original ownership must fail before view/normalization/action/SQL writes. Completed historical receipts do not require old spent cards to remain forever in discard.

### Five-part status for the new interaction

| Area | Status | Bounded claim |
| --- | --- | --- |
| Implementation | Partial | Explicit source-aware interception and fresh-profile boundary; wider faction/module continuations and complete games remain outside scope. |
| Player controls | Partial | Actual private fuel selection and fuel/Nexus inspectors, source-required Use, distinct counter/allow and Basic/Advanced phone refresh pass; wider accessibility/presentation acceptance remains open. |
| AI | Partial | Four profiles use private canonical legal plays and existing counters; no full strategy/calibration claim. |
| Documentation | Partial | Source/effect, real fuel, spend timing, user policies, privacy protocol and old/new profile boundaries are recorded; publisher clarification/full-family acceptance remain open. |
| Verification | Partial | Types, lint, 6,022 offline tests and build pass, with actual fresh CLI entry, source runtime, Basic/Advanced phone success/prevention and saved physical-cost proof. Local HTTP is 49/55, not green; wider/deployed acceptance remains open. |

The frozen suites cover non-Worthless/printed fuel, successful phase ban, distinct prevention/original resumption, BG preconversion, decline and identity-neutral offers, physical conservation, reservations/promises, four legal bots and authenticated SQLite restart/races/immutable malformed or orphan rejection. Independent review repaired canonical descriptor trust, suspended native Nexus parents, nested parent-cost counters and CHOAM winning-payment coverage, including retained ordinary Karama with a canceled Cunning-effect block. Fresh setup excludes physical Sandtrout. Verified old printed-only counter saves receive a bounded immutable selection-binding migration; new Nexus-profile missing selections still reject. No source-omitting action shim or new-choice retrofit is introduced.

Actual `nexus-kull` CLI continued four owned fresh QA rooms from version 5 to setup 6. Genuine setup/Storm/Spice completed before conserved pre-action resources were arranged. Standalone runtime and 390-pixel controls prove Basic/Advanced weapon fuel Use followed by success or a distinct printed counter: Nexus spends once on declaration, success discards fuel/retains original/bans the actor; prevention retains fuel/leaves Nexus spent/resumes the original once. BG success keeps Baliset before conversion; prevention resumes its normal conversion. Refresh and direct saved-state checks preserve exact inventory, source history and unchanged spice. Fuel and CHOAM Nexus inspectors show their distinct actual components; rival views expose no private fuel inspector.

Local built-worker HTTP passes 49/55: four POST 503s and two timeouts retain the known Wrangler-dev limitation. Proxy-free container CI and live deployment are recorded separately after the checkpoint push. Full optional-module/faction modes, calibrated AI, complete games and deployed acceptance remain separate gates.

## Historical five-effect recovery evidence

The saved receipt binds the physical card, selected effect, original phase and owner, declared target and the specific suspended movement, revival, storm or Mentat context. Independent review reproduced legal-looking replacements of a pending movement quantity, revival quantity/price and storm distance. Those edits now reject before reads, automatic normalization or either outcome can write state. Historical completed records do not freeze unrelated future resources.

Actual paid Nullentropy searches can suspend and restore the response. If CHOAM legitimately consumes the selected card in an intervening cash-in, Cunning fizzles with its Nexus still spent and resumes the original operation once. Cancellation retains the card and applies the existing phase block. Production SQLite tests cover private refresh and simultaneous cancellation versus the final pass; exactly one version wins.

## Historical five-effect verification

Five consumer regressions at that checkpoint were in [controls](../tests/nexus-choam-controls.test.ts) and [bots](../tests/nexus-choam-bots.test.ts). They exercised actual fixture-generated windows for all five supported effects, submitted source actions, the real cost-card inspector, Kull unavailable outside the new profile and reserved cards, stale events, actor/interrupt fences, private-field traps, all four policies, and unchanged printed actions. The combined consumer, existing Worthless/storm/movement/Gamont, Nexus guidance and reference selection passed **150/150** tests. Type-aware lint passed for owned code/tests at that checkpoint; its then-existing nine local links resolved. The log is `/tmp/dune-choam-consumer-tests.log`. This is preserved historical evidence, not a fresh check of the new Kull interaction.

That checkpoint's integrated checks passed: **types, lint, all 4,042 offline tests, production build and 40 HTTP/session tests**. Thirty new cases covered the pure receipt, engine, consumers, independent saved-parent review and production SQLite matrices. Logs are `/tmp/dune-choam-{check,build,http}.log`. These results are not rerun totals or proof for the later Nexus Kull profile.

Two isolated three-seat browser rooms passed actual phone declarations, desktop/phone response inspection and all six private refreshes. `GDP8NNRE` version 4 allowed Baliset: the pending two-force movement was prevented, the three original source forces remained and the real Stunner payment was discarded. `WJTUH62T` version 5 canceled Jubba Cloak: Slip Tip stayed held, the Nexus stayed spent, and continuing the original storm removed four CHOAM and three opposing forces. No phone overflow or page errors were observed. `/tmp/dune-choam-restore.cjs` performs read-only private restoration checks.

The opening backup and final comparison at that checkpoint preserved all **3,484** older room versions and state hashes. Only two browser rooms and thirty HTTP-test rooms were added, for 3,516 total. The existing server was reused; no hourly restart was due. Automation remained removed. Those historical checks did not certify a complete six-effect CHOAM advantage or full module play, and the later new-profile contract does not expand their evidence.
