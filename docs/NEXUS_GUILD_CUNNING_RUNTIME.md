# Guild Nexus Cunning runtime

This checkpoint follows the [Guild source contract](NEXUS_GUILD_RULES.md): native Guild can spend Cunning when finishing its ordinary Shipment and Movement turn to obtain one second shipment. It preserves one combined turn and the actual history of the first shipment and movement. It does not implement Guild Secret Ally, Betrayal or complete Nexus play.

## Opportunity and controls

The [shared consumer helper](../game/nexus-guild-cunning-options.ts) binds the private native holder, unallied card, current turn, actor and projected event. The [table](../components/game-table.tsx) offers an explicit “Finish ordinary turn and declare Guild Cunning” action alongside ordinary finishing. It spends the card and opens the existing Karama response mechanism. A cancellation ends the original turn without undoing its committed shipment or movement; allowance offers the separate shipment.

The original player's `shipped` flag remains unchanged. Source-aware availability recognizes only the current signed second-shipment stage, and the existing [reserve](../game/homeworld-shipment-options.ts), [Guild Homeworld](../game/guild-homeworld-shipment-options.ts) and [cross-shipment](../game/transport-quote.ts) consumer quotes use that shared availability. They retain their physical source, price, typed-counter, storm and destination checks. The native cross-shipment validator and preview now also reject returning to the same territory, a pre-existing mismatch that bots already avoided. The extra shipment uses ordinary action fields; the engine associates them with the durable grant. No consumer clears flags or invents custody.

The player can skip only the second shipment and retain the separate unused Hajr choice, or decline the shipment and finish the whole turn. Existing responses and decisions block a new shipment even while its original stage remains active for restoration. Opponents receive no private offer or actionable owner descriptor. Public entry, payment and cancellation controls preserve their existing information boundaries.

## Saved state and authoritative settlement

A signed original receipt records the native owner, turn, roster and first shipment/movement/Hajr status. A separate lifecycle record keeps the original combined-turn queue, stage, consumed extra movement, and exact second-shipment frame. The latest-outcome marker prevents partial deletion from reopening a used grant. These are consistency checks, not cryptographic authentication of arbitrary replacement saves.

The original counters remain history. A shared server shipment-opportunity helper allows only the signed second-shipment stage; the normal reserve, cross/return and typed Homeworld adapters still perform custody, legality and payment. Pending reserve or Homeworld shipment binds its actual Guild interception decision. Completing or stopping that shipment reaches the Hajr step without restoring another shipping right. Declining only the second shipment records a distinct nonphysical outcome and preserves the original counters.

Being unallied is required when declaring Cunning. An alliance legally formed by a later shipment-entry effect does not revoke the played card’s remaining continuation. A real Moritani placement, next-turn second shipment, saved alliance reply and subsequent Hajr movement verify that distinction.

A completed lifecycle no longer pins later funds, forces, alliances or turn order. A live lifecycle retains the exact original owner and combined-turn queue, including Advanced out-of-order Guild timing. Printed Karama cancellation and paid BG Worthless conversion both preserve this source; countering the conversion restores the original Cunning response.

Truthtrance questions and fulfillment searches recognize the second shipment as the current unused opportunity. A previously fulfilled first-shipment answer remains fulfilled. A new accepted answer binds the actual second shipment and cannot be evaded by skipping it or moving first. Private completion witnesses reach only the respondent and support all four bot profiles.

## Hajr and bot policy

No ordinary movement follows the extra shipment. Only an unused Hajr move is available, and a Hajr move already consumed cannot create a third move. The source's exception retains the same active Guild player through the optional extra move. Native city ornithopter range still applies normally; combining this with the separate physical Ornithopter Treachery Card remains unavailable.

The server supplies `hajrAvailable` independently of the displayed movement ceiling. [Ordinary card availability](../game/card-availability.ts) uses this permission during the Cunning continuation, avoiding a false second Hajr offer when a derived ceiling happens to equal one. Controls disable movement during the second-shipment step and explain the remaining Hajr allowance afterward.

All four [bot profiles](../game/bots.ts) keep their existing first-shipment and movement candidates, then consider declaring Cunning at the turn's end. They use the shared second-shipment availability and may play an owned Hajr only when the explicit extra-move permission allows it. This extends legal policy; it does not certify complete Guild strategy or calibration.

## Verification

Nine new cases in [controls](../tests/nexus-guild-cunning-controls.test.ts) and [bots](../tests/nexus-guild-cunning-bots.test.ts) use the [genuine setup and first-turn fixture](../tests/fixture-nexus-guild-cunning.ts). Coverage includes Basic/Advanced declaration, owner/stale/privacy fences, unchanged first-turn flags, second cross-shipment and Homeworld routes, no ordinary movement, Hajr availability and all four profiles. The deliberate card alias in one consumer-only Hajr check is labeled and is never submitted to the engine.

Focused verification passed **9/9 new consumer cases**. Existing shipment-budget, promise, Homeworld-control, Nexus, reference and ordinary-card compatibility passed **60/60 cases**. Type-aware lint passed. The final focused run includes immutable same-territory transport rejection in ordinary and Cunning routes, a new second-shipment Truthtrance promise, and a pending-response rendering check that excludes the internal event ID. Additional coverage includes seven pure receipt/movement cases, eleven authoritative engine cases, eight production SQLite recovery cases and two genuine nested cancellation cases: 37 new cases in total. The engine and recovery cases include competing replies, exact pending shipment custody, independent terminal markers and a later Moritani alliance. Existing native rate/route cancellation gaps and unsupported arrival combinations remain explicit; this addition does not claim to resolve them.

Final `npm run check` passed types, lint and **4,136/4,136 offline cases** with no skipped tests after the response-text correction. The final production build also passed. These subsystem results do not certify complete Guild, Nexus, expansion or rules-mode play.

## Isolated browser acceptance

Two fresh three-human-seat rooms used actual session IDs before genuine fixture initialization and exact state/version staging. No existing game was staged or reset. In SUVRJJFK, Advanced Guild with Homeworlds shipped five forces to Arrakeen, moved them to Hagga Basin, declared Cunning, and received an actual opponent allowance. During the second-shipment step, ordinary movement was disabled and both reserve and cross/return choices remained visible despite the original shipment already being used. The player cross-shipped five forces to Carthag for three spice, played its held Hajr, moved two to Arrakeen and finished at version 11. Fifteen reserves and fourteen spice remained; only two movements had occurred in total.

In T3YXXLKB, the Guild completed the same original shipment and movement. An opponent used the actual Karama cancellation button on Cunning. Version 7 retained the five forces at Hagga Basin, fifteen reserves and seventeen spice, and advanced to the next player's turn without an extra shipment. The Nexus remained spent.

Desktop 1440-pixel and phone 390-pixel captures were visually inspected, including second-shipment quotes, separate skip/finish buttons, Hajr and cancellation controls. Phone views had no horizontal overflow. All six private sessions refreshed with no page errors; opponent views omitted private hand, traitors and spice and all views omitted internal grant history. The read-only restoration script is `/tmp/dune-guild-cunning-restore.cjs`. Exact staging preserved 3,580 and 3,581 other rooms respectively; the final preservation audit confirmed all 3,580 original room hashes and versions unchanged.

Visual inspection found that the generic response notice exposed its internal event text. The current component replaces that text with the meaning of allowance/cancellation. The final pending-state rendering regression passed after the correction; the earlier live pending screenshots precede that small text change. The completed HTTP/session suite passed all 40 cases and added thirty isolated rooms. A subsequent read-only audit preserved all 3,580 opening room versions and state hashes; the database contains 3,612 rooms, including the two new browser rooms. All six Guild QA seats restored again at versions 11 and 7 without errors. The existing development server was reused; no hourly restart was due and no recurring automation was created.
