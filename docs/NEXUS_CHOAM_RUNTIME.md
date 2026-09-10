# CHOAM Nexus Cunning runtime

This checkpoint integrates native CHOAM Cunning with five existing Worthless effects, in Basic and Advanced. It does not complete CHOAM, Nexus or the expansions. The [source contract](NEXUS_CHOAM_RULES.md) lists **six** effects: Kull Wahad's Karama-prevention reaction remains explicitly unavailable. CHOAM Secret Ally and Betrayal remain outside this implementation.

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

The [cost selector](../components/choam-power-cost.tsx) is reused by the existing [storm](../components/choam-storm.tsx), [revival/range](../components/choam-worthless.tsx), [movement prevention](../components/choam-baliset.tsx) and [force return](../components/choam-gamont.tsx) panels. It names and inspects the real cost card separately from the effect, supports transport-busy state, and exposes blocked choices without offering an illegal action. Kull Wahad has a visible unavailable explanation. Public response text identifies the chosen effect rather than disclosing the private cost card's name.

All four bot profiles use the same projected plays. They preserve printed effects first, then prefer lower-value legal Nexus fuel, retaining their existing public-target policies. Easy's existing policy of allowing free revival remains unchanged. The ordinary Trip to Gamont preservation policy still reserves that printed card during a closing market or cash-in even though playing it must wait for the next legal window. These are legal policy extensions, not a new AI calibration claim.

Existing reactive windows depend on public circumstances rather than whether CHOAM holds a matching card. Cunning uses those same windows, so holding a private Nexus card does not introduce an identifying public wait. Opponents receive no private cost list. Saved engine receipts, cancellation and physical disposal are handled by the engine; consumer code does not reconstruct an opportunity from card names or old saves. The existing fresh-discard/Semuta priority remains unfinished and gated; this checkpoint does not implement a Semuta interruption for these effects.

## Recovery evidence

The saved receipt binds the physical card, selected effect, original phase and owner, declared target and the specific suspended movement, revival, storm or Mentat context. Independent review reproduced legal-looking replacements of a pending movement quantity, revival quantity/price and storm distance. Those edits now reject before reads, automatic normalization or either outcome can write state. Historical completed records do not freeze unrelated future resources.

Actual paid Nullentropy searches can suspend and restore the response. If CHOAM legitimately consumes the selected card in an intervening cash-in, Cunning fizzles with its Nexus still spent and resumes the original operation once. Cancellation retains the card and applies the existing phase block. Production SQLite tests cover private refresh and simultaneous cancellation versus the final pass; exactly one version wins.

## Verification

Five new consumer regressions are in [controls](../tests/nexus-choam-controls.test.ts) and [bots](../tests/nexus-choam-bots.test.ts). They exercise actual fixture-generated windows for all five supported effects, submitted source actions, the real cost-card inspector, blocked Kull and reserved cards, stale events, actor/interrupt fences, private-field traps, all four policies, and unchanged printed actions. The combined consumer, existing Worthless/storm/movement/Gamont, Nexus guidance and reference selection passed **150/150** tests. Type-aware lint passed for all owned code and tests; all nine local links in this document resolve. The log is `/tmp/dune-choam-consumer-tests.log`.

Final integrated checks pass: **types, lint, all 4,042 offline tests, production build and 40 HTTP/session tests**. Thirty new cases cover the pure receipt, engine, consumers, independent saved-parent review and production SQLite matrices. Logs are `/tmp/dune-choam-{check,build,http}.log`.

Two isolated three-seat browser rooms passed actual phone declarations, desktop/phone response inspection and all six private refreshes. `GDP8NNRE` version 4 allowed Baliset: the pending two-force movement was prevented, the three original source forces remained and the real Stunner payment was discarded. `WJTUH62T` version 5 canceled Jubba Cloak: Slip Tip stayed held, the Nexus stayed spent, and continuing the original storm removed four CHOAM and three opposing forces. No phone overflow or page errors were observed. `/tmp/dune-choam-restore.cjs` performs read-only private restoration checks.

The opening backup and final comparison preserve all **3,484** older room versions and state hashes. Only two browser rooms and thirty HTTP-test rooms were added, for 3,516 total. The existing server was reused; no hourly restart was due. Automation remains removed. These checks do not certify a complete six-effect CHOAM advantage or full module play.
