# Guild Nexus Secret Ally runtime

The [source contract](NEXUS_GUILD_SECRET_ALLY_RULES.md) distinguishes printed Guild shipping rates and routes from a real alliance or native Guild faction powers. This checkpoint implements the absent-Guild holder's explicit use for one ordinary shipment. It does not certify complete Guild, Nexus, Homeworld or expansion play.

## Authoritative shipment and custody

An unallied holder chooses the card for an unused Shipment and Movement shipment. Merely holding it does not change prices or legal destinations. An ordinary reserve shipment costs the Guild tariff: round half a spice per physical force upward for a stronghold, and one spice per force elsewhere. Native Homeworld reserves retain their exact ordinary/special source allocation. Native Ixian access to the mobile stronghold remains separate.

The same grant permits one-territory cross-shipment or a return to abstract reserves. Actual multi-sector ordinary and special counters are selected and transferred; a destination cannot be the origin territory. The action uses the normal shipment opportunity and leaves the holder's ordinary movement available. The grant conveys neither flexible Guild turn order nor collection of another player's shipping payment.

Fremen can retain their ordinary free reinforcement option. Choosing the Nexus instead pays Guild rates and allows destinations beyond the free Great Flat range, with the paid route's storm exclusion. The existing reserve withdrawal pipeline preserves typed Homeworld custody. These on-planet southern reinforcements do not become off-planet shipping for advisor accompaniment or Heighliner income.

For an independently legal world-to-world shipment, the Nexus changes only the price to half a spice per force, rounded upward. Actual foreign/native source custody, special counters, own-world return restriction and ally-world prohibition remain authoritative. The card does not grant arbitrary Arrakis-to-foreign-Homeworld transport or high-Junction sponsorship.

The material interaction between the card's return to reserves and the Homeworld native-Guild route restriction has been asked of the user. Until resolved, returning to Homeworld reserves with this grant is unavailable. Concealed No-Field transport retains its existing separate implementation boundary.

## Payment, arrival and saved history

Guild is absent from the seated faction roster, so the card does not invent a native Guild interception, discount cancellation or income recipient. A valid use immediately discards the physical Nexus and commits the shipment and bank payment. Other factions' genuine arrival decisions still occur normally. A later alliance formed by a valid entry effect does not invalidate the already completed shipment.

The [pure receipt](../game/nexus-guild-secret-ally.ts) records the absent-Guild roster, original owner and turn. The engine adds the exact committed reserve, cross or Homeworld declaration and a separate latest-outcome marker. These consistency checks preserve historical evidence without freezing later movement, resources, alliances or card custody. They are not cryptographic authentication of arbitrary replacement saves. A Secret Ally shipment cannot retain a fabricated native Guild interception.

A binding Truthtrance shipment answer can use this explicitly selected discounted source. The completion search preserves the actual typed withdrawal and returns the matching card-use action only to the entitled respondent. Ordinary shipment or movement cannot evade an accepted promise.

## Verification and remaining work

Focused verification passes **26 new cases**: six pure receipt/tariff cases, seven authoritative engine cases, four production SQLite recovery cases, and nine controls/all-profile bot cases. Actual paths include typed Emperor cross/return and world-to-world shipment, Fremen paid versus free reinforcement, native Ixian HMS access, an affordable-only-through-Nexus Truthtrance witness, and real Moritani placement, later arrival alliance and ordinary movement. SQLite checks cover competing shipment requests, lost acknowledgment, exact source/price corruption, private views, unrelated-room preservation and reconnecting before an actual alliance reply. The production build also passes; full repository and live HTTP/browser evidence are recorded separately below. The remaining Homeworld-return interpretation, concealed transport, Guild Betrayal, other native cancellation interactions and complete expansion games retain their release gates.

## Player controls and bot evidence

The [source-aware options](../game/nexus-guild-secret-ally-options.ts) require the owned current offer, held Guild Nexus, absent native Guild and ordinary unused shipment. The main shipment selector is explicitly unchecked by default; a separate checkbox in the [Homeworld panel](../components/homeworld-shipment.tsx) applies the same card only to that independently legal route. Prices describe the selected source. Fremen retain their free native choice and see why the selected paid route permits destinations beyond its range while excluding storm. A selected card does not silently attach itself to an ordinary movement.

The [transport preview](../game/transport-quote.ts) keeps physical groups, elite allocations, same-territory exclusion and native permission checks. It adds the exact card permission for cross-shipment and abstract reserve return, with explicit guidance for unsupported Homeworld return and paid Fremen reserve entry through the normal reserve selector. The [Homeworld quote](../game/homeworld-shipment-options.ts) validates source and destination custody before applying the chosen tariff. Native Guild Homeworld transport remains its own route.

All four bot profiles generate Guild-priced reserve groups before filtering by ordinary affordability, consider paid Fremen destinations beyond the free range and use the explicit source for eligible cross/return candidates. Ordinary free or equally priced routes preserve the card. Homeworld candidates use the discounted budget only with a current legal offer. The shared payment filter recognizes Guild and Richese sources separately; existing shipment-promise filtering consumes the physical action and the server's current source-specific completion witness. This is legal-policy coverage, without additional AI calibration claims.

Nine new consumer tests passed: six [controls cases](../tests/nexus-guild-secret-ally-controls.test.ts) and three [all-profile bot cases](../tests/nexus-guild-secret-ally-bots.test.ts). They cover Basic/Advanced explicit selection, odd/even prices, Fremen free versus paid and storm behavior, typed cross/return, combined Emperor Homeworld custody, native Ixian HMS access, private/stale/blocked source fences and affordability. Sixty-eight existing shipment, Homeworld, Richese, promise and reference regressions passed in a separate compatibility run. Owned-file lint passed. The cross-shipment tests document their conserved pre-declaration Arrakis staging; module setup, card ownership and actual submitted shipment effects use the engine.

## Browser checkpoint

Two fresh three-human rooms used final session IDs before genuine fixture initialization, then an exact lobby state/version compare-and-swap. No existing room was staged. In `SE4XQL2Y`, the Fremen player selected the paid card route for five forces to Arrakeen at three spice, then moved those five normally to Hagga Basin. The final version is 4, with 17 spice and 15 reserves. In `WBW3Q5B4`, the Emperor selected three ordinary Kaitain forces and two Salusa Sardaukar for a Guild-priced invasion of Giedi Prime. Five typed forces arrived at three spice; version 3 retains 15 native reserves, three reserve Sardaukar and zero spice, with ordinary movement unused.

Desktop 1440px and phone 390px screenshots were captured and visually inspected. Both checkbox defaults, selected prices and physical source inputs were exercised through the real browser controls. The final Homeworld explanation displays the selected Guild tariff. No horizontal overflow or page errors occurred. All six private sessions were refreshed and restored with unchanged completed versions, no hidden opponent hand/traitor/spice disclosure and no internal shipment/history fields in the player view.

The read-only `/tmp/dune-guild-secret-restore.cjs` verifies the six sessions; `/tmp/dune-guild-secret-preserve.cjs` compares the opening room baseline. All 3,612 original room state hashes and versions remained unchanged. Screenshots are `/tmp/dune-guild-secret-fremen-desktop.png`, `/tmp/dune-guild-secret-fremen-phone.png`, `/tmp/dune-guild-secret-emperor-desktop.png`, `/tmp/dune-guild-secret-emperor-phone.png` and `/tmp/dune-guild-secret-emperor-phone-sources.png`. Browser cross/abstract-return interactions were not separately exercised in these two rooms; their actual actions are covered by engine and consumer regressions. Full-check, build and HTTP totals are recorded by the final project checkpoint.

## Integration verification

The first broad check found one older Guild Cunning SQL fixture failure: a real intervening auction could distribute all Karama copies before an unnecessary acquisition from the draw pile. The fixture now removes that acquisition, reserves one existing physical Hajr before the intervening phases, and reuses an already-held matching card. It does not duplicate a card or take one from an opposing hand. Ten independent repeated runs passed the eleven Cunning engine and eight SQL cases each, 190 case executions in total.

The live HTTP/session suite passes **40/40** cases. The controlled **03:46 UTC** restart backed up and preserved all **3,612** opening saved-game versions and state hashes. Twelve earlier private Guild Cunning/Richese seats restored without errors. After the two new browser rooms and thirty HTTP rooms, all opening games remain unchanged and the database contains **3,644** rooms. The current server remains running and no recurring automation was created.

Final `npm run check` passes types, lint and **4,162/4,162 offline tests** with no skipped cases after both the fixture correction and selected-tariff display fix. The final production build also passes. These checks establish this recorded subsystem scope, not complete expansion or rules-mode acceptance.
