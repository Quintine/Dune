# Guild shipment payments and transport previews

Integrated checkpoint, 2026-09-07 local date. This closes the contributor-routing defect and adds transport price controls; ordinary rate/permission Karama cancellation and nonbattle Truthtrance commitments remain incomplete.

## Publisher contract and precedence

The November 2020 FAQ, printed page 2, directs an ally's shipment contribution to the Guild (bank if absent) and sends the Guild's own contribution to the bank. This replaces April's instruction to transfer funding to the shipper first. The implementation therefore routes payment by contributor identity, including a non-Guild ally funding Guild's own shipment. The Guild's personal share still goes to the bank. The FAQ supplies a general funding rule, not an explicit Guild-as-shipper worked example; this application of the later funding-specific wording is the coordinating review's source adjudication. No old-edition or tournament rule was adopted. [November FAQ](https://www.gf9games.com/dune/wp-content/uploads/2020/11/Dune-FAQ-Nov-2020.pdf#page=2), [superseded April FAQ](https://www.gf9games.com/dune/wp-content/uploads/2020/04/Dune-FAQ.pdf#page=1).

Root independently retrieved the official indexed November page and compared its full funding answer to April. This is not evidence of a newly downloaded PDF binary. Rate and transport-cancellation source boundaries remain in [GUILD_RATE_KARAMA_RULES.md](GUILD_RATE_KARAMA_RULES.md).

## Implementation

`guildShipmentIncome` computes both contributors' destinations once, shared by ordinary `commitShipment` and direct `guildShip`. Previously both paths suppressed all income when Guild was the shipper, losing the non-Guild ally contribution. Independent Karama still routes all payment to the bank. Guild-funded allied shipment still sends Guild's contribution to the bank. The current income response can cancel the receipt without refunding payment or undoing force arrival. A new automatic chronicle event explains receipt or prevention. Existing distinct shipment settlement paths, No-Field restrictions, special-stop policy and mode gates are retained.

`guildShipmentCost` centralizes the rounded transport tariff used by the authoritative engine and bot mobility helper. Shared contribution bounds retain the default minimum required pledge and explicit escrow limit. Funding is checked before income; future Guild receipts cannot finance the same payment.

`guildTransportQuote` consumes only the personalized view. It previews the submitted single or combined source group, selected regular/elite counts, destination, own spice and authorized pledge. Combined-sector counts override the unrelated scalar amount exactly as on the server. The UI displays selected physical forces, price and both shares; invalid or unfunded choices have linked reasons and disabled buttons. Cross-planet, southern reserves and returns each have their own quote. A blocked or expensive board destination does not disable a legal cheaper return. All submissions remain authoritatively revalidated; this helper is neither future-action feasibility nor a persisted shipment-intent model.

## Verification

- Nine payment-routing tests cover both donor directions, zero/partial/full/default shares, reserve/cross/return, missing Guild, cancellation, independent rate card, JSON continuation and atomic invalid action rejection.
- Ten quote tests compare enabled choices with actual engine acceptance and debit, including combined groups, paid Fremen reserves, elite defaults, storm/entry/advisor restrictions, invalid inputs and private-state perturbations. Independent review additionally compared 10,320 synthetic settled-state selections without a quote/server mismatch. A malformed destination initially defaulted to return; root fixed it and the regression now passes.
- Three production-room SQLite tests cover both reserve and cross routes with restart, duplicate same-version CAS, pending income allowance/cancellation, exact payment/arrival/card/log counts, wrong actors, stale requests and private projections.
- Full registered suites: **1,474/1,474 rules/client/component tests and 126/126 persisted/API tests pass**. Logs: `/tmp/dune-guild-full.log` and `/tmp/dune-guild-multiplayer.log`. TypeScript and lint pass: `/tmp/dune-guild-final-type.log`, `/tmp/dune-guild-final-lint.log`. Production build passes: `/tmp/dune-guild-final-build.log`. The earlier 648-game calibration was not rerun for this payment change.

## Browser and restart evidence

At 23:45 UTC, all 1,502 rooms were backed up using SQLite's backup API to `/tmp/dune-maintenance-20260906T2345/database.sqlite`. Following the controlled restart, every room's exact JSON hash/version matched and HTTP returned 200. PRAVNYBG restored the private human seat and legitimate Storm wait. The first sandboxed restart failed before serving because local network-interface access was denied; the authorized development-server launch with required access succeeded. No database restoration or repair was needed. The removed automation was not recreated.

Created separate room **6XMTUD6U** through browser lobby/setup: human Guild and Hard Emperor/Atreides. At v10, only this QA room was staged to Shipment with five Guild forces split across Wind Pass sectors 14/15, personal spice 1 and Emperor escrow 2. All physical force totals and card identities were preserved. The staging and original state are recorded in `/tmp/dune-guild-browser-original.json` and `-staged.json`; this is a focused fixture, not a full-game claim.

Actual controls priced a 1+2 combined group at two spice despite scalar amount 19. Increasing the group to five made Red Chasm transport cost five and unavailable, while a three-spice return remained enabled. The real return button moved all five into reserves, spent personal 1 plus escrow 2, and credited Guild the donor's 2. Final v13 has 20 reserves, no on-board Guild forces, spice 2, pledge 0, shipped true and movement unspent. Original card and traitor remain private. Root inspected a full-page desktop screenshot; quote labels, counts, costs and controls were readable without clipping. Final state: `/tmp/dune-guild-browser-finished.json`. A fresh invitation restored that private seat, 20 reserves, spice 2, no repeat shipment control, and the still-available Finish action. Mobile and full-game acceptance are not claimed by this slice.

## Remaining boundaries

The pending ordinary shipment audit found stored-intent validation gaps under manually corrupted or stale state (cost, contribution, forces and context). Fresh actions rejected those invalid inputs; no valid-action remote exploit was demonstrated. The subsequent [physical shipment integrity change](PENDING_SHIPMENT_INTEGRITY.md) now revalidates ordinary custody, context, current price and authorized contributions before continuation or special-stop card disposal. Concealed No-Field contracts, shared normalized intents, ordinary Guild rate/permission responses and current-turn Truthtrance commitments remain separate work. No unaffordable-cancellation policy was introduced. Full expansion/module and Advanced acceptance remain unfinished.
