# Physical shipment continuation integrity

Checkpoint: 7 September 2026. This change repairs persisted ordinary shipment validation; it does not settle unresolved Guild cancellation or allied transit rules.

## Runtime contract

`game/engine.ts` now checks an ordinary physical shipment at declaration and immediately before commitment. Guild allowance and special-stop responses also bind their public decision to the stored declaration before any payment, force transfer or card disposal. New declarations carry their turn. Older declarations without that field remain accepted when every other current-state check succeeds.

Checks cover playing status, Shipment and Movement phase, active player, unused shipment opportunity, declared turn, physical and elite reserve custody, arrival stance, destination and sector legality, current price, personal funds, exact contribution and eligible pledge. A positive contribution requires a reciprocal alliance. The Guild window must identify the current Guild, unused special power, shipper, destination, sector and public quantity.

Invalid continuations throw before committing state. The engine operates on a clone; the production room layer therefore makes no compare-and-swap write for these rejected actions. The change does not repair corrupted saves automatically, reprice declarations, refund payments, choose substitute forces or discard a response card on failure.

Concealed and allied No-Fields retain their specialized contracts and are excluded from this ordinary physical-custody validator. Their complete corruption matrix is not certified by this change. Optional turn metadata cannot detect a cross-turn legacy declaration that otherwise exactly matches current state.

## Verification

- `tests/pending-shipment-integrity.test.ts`: ten cases covering malformed/stale state, public binding, privacy, typed reserves, advisor stance, mutual funding, canonical Karama rates and stamped/legacy JSON continuations. Both allowance and special stop reject invalid declarations atomically. Valid continuations preserve the established outcomes and component inventories.
- `tests/pending-shipment-integrity-recovery.test.ts`: three tests execute the production room module and SQL against isolated SQLite. Twenty-four corrupted declarations are checked for allowance and again for special stop. No invalid attempt reaches a room write. Concurrent duplicate valid allowances produce one successful compare-and-swap, one payment and one arrival; duplicate stops spend one physical card. Fresh module instances and automatic continuation preserve legitimate waiting state.
- Full registered suites pass: **1,484 rules/client/component tests and 129 persistence/API tests**, 1,613 total. Logs: `/tmp/dune-pending-shipment-full.log` (61.96 seconds), `/tmp/dune-pending-shipment-multiplayer.log` (16.80 seconds).
- Type checking and lint pass: `/tmp/dune-pending-shipment-final-type.log`, `/tmp/dune-pending-shipment-final-lint.log`.
- Production build passes: `/tmp/dune-pending-shipment-final-build.log`.

Browser inspection recovered the existing Guild QA table with the same private hand, 20 reserves, two spice and a legitimate movement wait. The internal phase guide displays both the new recovery explanation and the outstanding allied-entry limitation. Search, expanded text and a fresh direct phase-link reload worked. Root inspected the full-page desktop screenshot: text and related-topic controls were readable without clipping. The first pre-hydration snapshot appeared collapsed; a fresh loaded page confirmed that the existing phase link works, so no link modification was made. This is focused guidance/recovery inspection, not mobile or full-game acceptance.

Root reviewed the runtime and both independently written test files. An independent test caught a missing reciprocal-donor check during development; the final guard and full suites include that correction. Historical 648-game calibration was not rerun for this change. Focused recovery tests do not establish full Advanced or expansion compliance.

## Remaining rules work

Shared shipment declarations, ordinary Guild rate/permission cancellation and current-turn Truthtrance promises remain incomplete. The applicable November FAQ permits shipping into allied territory followed by departure; the current table still blocks ordinary allied destination entry. The source audit and unresolved post-entry no-exit outcome are recorded in [ALLIED_TRANSIT_RULES.md](ALLIED_TRANSIT_RULES.md). No new settlement policy was inferred. Advanced and expansion starts remain gated.
