# Ecaz shared spice collection

Verified development checkpoint, 9 September 2026. This completes the bounded
shared-collection flow; complete Ecaz, Advanced and expansion starts remain gated.
The [source contract](ECAZ_COLLECTION_RULES.md) records publisher precedence and
sector-capacity interpretation. The earlier
[runtime readiness review](ECAZ_COLLECTION_RUNTIME_READINESS.md) is a design
proposal; the implemented commitment order below supersedes its deferred-payment
proposal.

## Implemented behavior

The engine computes each collecting faction’s eligible sector capacity before
extracting spice. When both Ecaz and its reciprocal ally collect from the same
desert territory, their combined extraction becomes one shared pool. The board
loses that spice once. Ordinary collection and bank income settle automatically;
shared spice is held outside both players’ balances until allocated.

Ecaz proposes first as an interface convention. The other ally can accept or
counter. Either current decision owner can use the equal split, with odd spice
going to the ally. Each settled territory has one persisted receipt. Unaccepted
proposals are visible only to the pair; the chronicle records final allocations
and their reason. Empty pools create no confirmation.

Advanced co-occupied Arrakeen, Carthag and Tuek’s Sietch pay both allies their
normal bank income. A meaningful Karama window precedes that commitment.
Cancellation removes only Ecaz’s income from those shared strongholds. Printed
Karama and Bene Gesserit Worthless conversion preserve the same source and effect.
No available blocker means automatic continuation.

Pending events bind their turn, public collecting forces, original deposits,
allocation index and settled receipts. Actions, player views and automatic
recovery reject missing or falsely completed collection parents, including
controls suspended by Nullentropy Box and Karama conversion. Legitimate card
income during allocation is retained: settlement adds to the current balance.
Room version checks prevent simultaneous or stale acceptance from paying twice.

## Coverage checklist

| Area | Verified boundary | Evidence |
| --- | --- | --- |
| Implementation | Sector capacities, one pool per desert, ordinary/bank commitment, bilateral allocation, scoped cancellation, recovery integrity | `game/board-resolution-quote.ts`, `game/ecaz-spice-allocation.ts`, `game/engine.ts` |
| Player controls | Private proposal/counteroffer/acceptance, equal fallback, decision ownership, mobile controls, keyboard completion, refresh | `components/ecaz-spice.tsx`, `components/game-table.tsx` |
| AI | All four profiles use the equal fallback or accept a fair offer without consulting rival balances | `game/bots.ts`, `tests/ecaz-collection-engine.test.ts` |
| Documentation | Internal phase and faction guidance, source precedence, commitment order and explicit release limits | `game/reference.ts`, this document and the linked source contract |
| Verification | Pure, engine, interruption, privacy and SQLite concurrency/recovery cases; real browser allocation | Four collection test files listed below |

## Verification

`npm run check` passed typecheck, lint and **3,028 offline tests**, including the
user’s test-discovery and failure-propagation self-tests. `npm run build` passed.
`npm run test:integration` passed **40 tests** against the local development
server. These suites have different scopes; historical counts used the previous
manual test registration and are not directly comparable.

The focused collection coverage is **60 tests**:

- `tests/ecaz-collection-quote.test.ts`: 20 capacity and income cases.
- `tests/ecaz-spice-allocation.test.ts`: 11 protocol cases.
- `tests/ecaz-collection-engine.test.ts`: 26 actual transition, privacy, AI,
  cancellation and suspended-parent recovery cases.
- `tests/ecaz-collection-recovery.test.ts`: 3 SQLite scenarios, including racing
  proposals/acceptance, printed and converted cancellation, reconnect and secrecy.

The browser resumed the isolated three-seat QA room `8S3MRDEK`. Actual last
movement entered Advanced collection, paid bank income automatically and opened
the five-spice Hagga Basin allocation. The Medium AI ally accepted the 2/3 split.
Refresh restored the six-spice Wind Pass choice; keyboard navigation and Enter
selected its 3/3 equal split. At a 390×844 viewport, controls were readable,
44 pixels tall, visibly focused and free of horizontal overflow. The normal
viewport was restored afterward. Room version 126 retained two receipts, one
spice on Wind Pass and total balance changes of +7 Ecaz, +8 ally and zero rival.
All **2,556** pre-existing non-QA room versions and state hashes were unchanged.
This staged position verifies the interaction, not a complete expansion game.

Twenty ordinary production-AI Basic games, spanning two through six players and
all four levels, completed **10,206 accepted actions** and **465 JSON round trips**
with zero rejected candidates, stalls or invariant failures. Seed: `20261024`.
Source fingerprints stayed unchanged during the run. These games cannot exercise
Ecaz because expansion starts remain gated, and homogeneous-level games do not
measure the relative strength of the levels.

Local logs: `/tmp/dune-collection-sep09-check-verified.log`,
`/tmp/dune-collection-sep09-build-final.log`,
`/tmp/dune-collection-sep09-http.log`,
`/tmp/dune-collection-sep09-fullgames.json`, and
`/tmp/dune-collection-sep09-browser-evidence.json`.

## Remaining release gates

Combined Occupy combat and its source discrepancy, Fremen’s Ecaz endgame
exception, Tleilaxu Ambassador runtime, remaining Duke interactions, complete
Advanced/expansion/module games and broader presentation acceptance remain
unfinished. This checkpoint enables none of those modes. The maintenance
automation remains removed.
