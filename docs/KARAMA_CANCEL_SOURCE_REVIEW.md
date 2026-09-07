# BG Karama cancellation opportunity review — 2026-09-07

## Result

New cancellation declarations can be bound to their original source without freezing legal interruptions. The reviewed implementation signs the original response, conversion owner, turn, phase, playing/Advanced context, source owner/recipient faction identities, and an exhaustive response-specific source selection. Existing metadata-free saves remain compatible. This is stale-state/custody protection, not a ruling that every cancellation continuation or expansion is complete.

One reachable regression was reproduced and fixed by the runtime owner: signing the worm ride queue made an original cancellation unusable after a separately summoned worm added a legitimate ride. The final selector excludes rides and Nexus while retaining the original spice resolution/sequence and the summoned territory identity. No project runtime was edited by this reviewer.

## Narrow binding and permitted changes

- `game/engine.ts:4716` enumerates live and explicitly suspended conversion/control pairs: Richese gift, Box, Richese purchase income, summoned worm, discard continuation; an exchange may own the saved response while the conversion remains direct.
- `game/engine.ts:4752` traverses explicit control-parent links for the summoned worm; `karamaSourceGame` evaluates an old conversion against its original saved spice context rather than the temporary new worm. It must not infer that every active overlay is the original conversion's parent.
- `game/engine.ts:4786` signs the original use and source, not all of Game. `karamaConversionIntegrity` checks matching conversion wrapper and signature before apply/view/automatic continuation, including suspended contexts.
- `game/karama-context.ts:37` selects each response's own pending record or specific battle/auction/movement/aftermath parent. The exhaustive typed mapping avoids silently accepting a newly introduced response without a source policy.
- Hands, spice, discard/deck arrangement, logs, AI controls, current response passes, and unrelated overlays must remain outside this signature. They can legally change through Distrans, Truthtrance, Box, special Harkonnen exchange, Richese special purchase, and gift resolution. Other custody, capacity and Truthtrance validators still apply independently.
- The original canceled response is immutable receipt data. Its saved passes may remain signed; only the currently answering conversion wrapper's passes advance. A source pending record may include its own fixed resume controls, but it should not pull in unrelated temporary controls.
- Portable Snooper is not an actual interruption of an active conversion: its validator requires no response/decision. No test or claim relies on that unsupported path.

## Confirmed source-context edge

Actual production declarations in the fifth new test:

1. Phase-1 ready actions draw Shai-Hulud after The Great Flat's prior spice card, producing Fremen `wormSurvival`.
2. BG spends a physical Worthless to cancel that response.
3. Fremen spends a different physical Karama to summon a worm in Red Chasm. Original conversion and spice context are saved in `summonedWorm.resume`.
4. Players pass the summoned worm's survival response. `afterWorm` restores the original conversion and appends Red Chasm to the ride queue.
5. Before the fix, public projection rejected the restored conversion because its old signature contained `rides:[]`. After removing mutable rides/Nexus from worm source identity, projection, JSON reload, cancellation, force losses, and the added ride all work.

The proposed Atreides-spice → summon example is not a genuine action path: Atreides spice response is produced at phase 5; Fremen special summon requires phase 1. The real worm path above supplies the equivalent saved-parent regression.

A global ban on another Worthless conversion while any conversion is suspended would also change existing legal behavior. The sixth test preserves a distinct real response: original Emperor-gift cancellation → Richese special purchase → Emperor purchase-income response → second BG cancellation → original cancellation restored. Both physical costs are consumed once, the special purchase remains acquired/paid, and both canceled Emperor effects remain unpaid. The runtime retains its existing direct-conversion fence instead of adopting a global ban.

## Durable independent coverage

Owned file: `tests/bg-karama-cancel-context.test.ts` (6 tests).

- Actual Emperor gift cancellation with a response pass, Distrans hand transfer, Truthtrance answer/history, and paid Box selection. All seat projections hide other hands/spice/traitors and conversion metadata; original payment never occurs.
- Actual Richese gift cancellation, suspended within Box, retaining the original card-transfer intent and giving no canceled gift.
- Actual paid normal auction → income cancellation → Harkonnen exchange → Box inside exchange → hand return. Purchase, sampled hand transfer, Box fee, and inventory each occur once; Emperor income is canceled.
- 32 corrupt/stale variants across actual gift, normal paid auction, Richese gift, and battle elite-strength responses: changed turn/phase/owner/wrapper/signature/source recipient or amount; changed lot/index/sale recipient; changed gift event/card; changed battle event/combatant. Every seat view, normalization and action rejects without mutating its input. Four valid legacy metadata-free conversions still resume.
- Genuine summoned-worm source restoration, as above.
- Genuine second cancellation of independently nested Richese purchase income, as above.

All cards are physically moved from component inventories; unused fixture cards return to the deck before actions that require a free hand slot. Component positions are explicit isolated setups, while responses, stamps, purchases, exchanges, transfers, worm draw, summons, cancellations and Box/Truthtrance decisions are genuine production actions. No engine-private test export or fabricated stamped conversion is used.

## Validation and limits

- Named new suite: 6/6 pass.
- Named combined regression: 40/40 pass (`bg-karama-cancel-context`, existing `bg-karama-opportunity`, `bg-karama-nested-controls`, `karama-preflight`), including legacy unsupported Richese-count conversion counter-cancellation coverage in the existing suite.
- New file formatted and linted. Full TypeScript check passed.
- Logs: `/tmp/dune-bg-karama-cancel-context.log`, `/tmp/dune-bg-karama-cancel-context-regression.log`, `/tmp/dune-bg-karama-cancel-context-tsc.log`.
- Reviewed runtime hashes at this checkpoint: engine `fec7d29db12e60d3dd276dee681afed531554deed05eba3fdcdd2b996af758d6`; context `1fc8da8fd1a5e869d7ea83b9201e49852437ce611182d8576dca2075674ea124`. These are historical review hashes, not a claim about later edits.

This suite is engine/JSON/projection coverage, not production SQLite CAS coverage. It does not exhaustively execute every expansion response suffix or prove all mandatory continuations affordable. It does not adopt new rulings about unsupported Richese count auctions, Semuta reaction policy, or full-hand Box behavior. No additional concrete live-action source-binding failure remained in the tested paths at release.
