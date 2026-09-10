# Harkonnen Nexus exchange checkpoint

10 September 2026. Harkonnen Cunning and absent-faction Secret Ally now use the physical Traitor Deck, an owned draw-first return choice, saved continuation evidence and private controls. This extends the [common Nexus lifecycle](NEXUS_CARD_RUNTIME.md) and [Atreides inspections](NEXUS_ATREIDES_RUNTIME.md). [NEXUS_HARKONNEN_RULES.md](NEXUS_HARKONNEN_RULES.md) records the printed sources, composed interactions and unresolved timing. Betrayal, other unfinished effects and complete module games remain gated; this checkpoint does not open public Nexus or expansion starts.

## Physical exchange

Cunning draws one card into Harkonnen's hand before the owner chooses one held identity to return. Secret Ally requires Harkonnen absent and Mentat Pause, draws two first, and then returns exactly two distinct held identities. Newly drawn identities can be returned. The Nexus card is spent when the draw commits; the Traitor Deck is shuffled only when the return commits. The completed exchange restores the original hand size.

The exchange uses the saved reserve order. It does not rebuild the deck from living leader discs, captured leaders or current hands. The printed participating-faction inventory includes the Advanced CHOAM Auditor and the expansion's shared Cheap Hero identity when applicable. Setup returns remain at the bottom; Tleilaxu's separately sourced setup shuffle remains in its own setup path. There is no corrective reshuffle migration or invented empty-deck fallback.

For Tleilaxu, Secret Ally draws Face Dancers. Existing revealed dancers retain their identities and revealed flags and cannot be selected for this return. Existing unrevealed and newly drawn dancers are eligible; retained new dancers begin unrevealed. This protection composes the specific Face Dancer rules and related FAQ evidence described in the source audit. It is not a claim that the Harkonnen card itself explicitly discusses previously revealed dancers.

## Interrupted actions and declarations

Cunning can start off turn and across a pending response or owned decision. The engine preserves the preceding response, decision, phase opening, Karama/discard context and battle rather than resolving them to make room. While the exchange is pending, ordinary actions and automatic advancement wait for its exact event-bound return. Live Truthtrance takes priority; it does not release existing promises. Closing common Nexus draws and another exchange also prevent starting a new exchange.

The saved exchange history, pending marker and parent signature must agree on the owner, turn, phase, physical source and suspended control context. A reload projects the existing choice without redrawing or reshuffling. These canonical signatures detect inconsistent saved fields; they are not cryptographic authentication against a deliberately rewritten save.

A traitor declaration binds the original voter, beneficiary, target, revealed leader and physical traitor identity independently of later custody. Returning an already declared identity through Cunning does not cancel its call. Conversely, an earlier declined call remains false even if the exchange draws the matching identity. Allied Harkonnen declarations distinguish caller from beneficiary, and Cheap Hero declarations retain the actual sealed card and shared traitor identity. This exchange is not Betrayal's explicit cancellation effect.

## Private controls and bots

The holder sees actual eligible identities, names, factions, strengths, newly drawn status and enlarged Traitor or Face Dancer inspection. No return is preselected: the owner chooses the exact required count and submits once. Observers receive only pending owner/mode/count metadata and a waiting notice; no draw, return or reserve identities are projected or logged publicly.

All four bot profiles consume the same private offer and return choices. The return policy prefers own-faction, dead or lower-strength identities and preserves a matching publicly revealed opposing leader when possible. Optional Cunning is used before an unanswered public traitor call or during Mentat; Secret Ally follows its Mentat restriction. This is a legal policy, not new strategy calibration. Pending exchange handling overrides old automatic flags. Its defensive Truthtrance policy takes precedence over a preserved decision. The existing paid Nullentropy search restriction on new Treachery effects remains in force; this checkpoint does not open Truthtrance inside that search.

## Verified checkpoint

- The new controls/bot suites passed **8/8** cases. They include actual Cunning and Tleilaxu exchanges for all four profiles with physical inventory checks, exact selection, observer getter traps and the Truthtrance/Nullentropy priority regression.
- A combined run of those suites, existing Atreides inspection controls/bots and full-plan regressions passed **33/33** cases. Owned-file type-aware lint passed. Existing full-table SSR tests emit the preexisting React SVG title-array warning; the standalone exchange controls do not.
- **All 3,885 offline cases, types, lint, production build and 40 HTTP/session cases pass.** This checkpoint adds 46 cases: 10 pure exchange, 9 declaration, 12 engine, 8 controls/bots, 4 continuation and 3 production in-memory SQLite recovery cases. Independent review found and fixed an unbound preceding decision and the paid Nullentropy early-action gate.
- SQLite checks preserve exact private custody after lost draw/return responses, accept only one competing return/shuffle and reject damaged parent evidence before writes. Unrelated rooms remain unchanged.
- Browser acceptance used two isolated three-seat rooms: Cunning preserved and restored a live Prescience cancellation response; Tleilaxu Secret Ally exposed four eligible choices while protecting one revealed Face Dancer. Explicit one/two-card selection, phone layout, desktop/phone enlarged inspection and six authenticated seat restorations passed with no page errors. The inspection script initially used an incorrect accessible button name; it resumed the existing pending choice after correction without repeating the draw.
- All **3,295** preexisting room versions and state hashes remained unchanged. The HTTP suite added 30 isolated rooms and browser acceptance added two. The existing server was reused; no hourly restart was due during this checkpoint and no automation was recreated.

Implementation: [exchange module](../game/nexus-traitor-exchange.ts), [declaration module](../game/traitor-declarations.ts), [shared options](../game/nexus-traitor-options.ts), [controls](../components/nexus-traitors.tsx), [engine](../game/engine.ts). Tests: [pure exchange](../tests/nexus-traitor-exchange.test.ts), [declarations](../tests/traitor-declarations.test.ts), [engine](../tests/nexus-traitor-engine.test.ts), [controls](../tests/nexus-traitor-controls.test.ts), [bots](../tests/nexus-traitor-bots.test.ts), [SQLite recovery](../tests/nexus-traitor-recovery.test.ts), [continuations](../tests/nexus-traitor-continuations.test.ts).

Betrayal remains blocked pending the existing private response timing decision. Its cancellation and delayed Mentat replacement are not implemented by this exchange. No arbitrary priority between its future replacement and other deck consumers has been adopted. Complete Nexus games and full expansion combinations remain separate release requirements.
