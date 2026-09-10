# Richese Nexus Secret Ally runtime

This checkpoint adds the [source-audited Secret Ally](NEXUS_RICHESE_RULES.md) to an unallied holder's unused ordinary reserve shipment when Richese is absent. Choose one to five actual forces and price the group as one force. The physical force count, starred identity, destination and arrival restrictions remain ordinary shipment rules. It creates no concealed No-Field and no second shipment.

## Price and physical custody

The shared [source quote](../game/nexus-richese.ts) separates `physicalAmount` from `pricedAmount: 1`. The whole group costs one spice to a stronghold or two elsewhere; native Guild and an active ordinary Karama rate keep their existing half-price rounding. Karama bank routing remains separate from the Nexus source. Fremen retain free reinforcement and their Great Flat range; this is retained-native-rules composition, not a named faction-specific FAQ ruling.

Native Homeworld reserve pools remain usable through the existing typed withdrawal selection. Native Ixians retain their ordinary right to ship into the present Hidden Mobile Stronghold; the card does not grant that destination to other factions. A foreign Homeworld destination, board cross-shipment, return to reserves or physical No-Field is not offered by this adapter. These routes must not be fabricated through the Arrakis selector. The actual force amount governs withdrawal, board placement, Terror and other arrival callbacks. Only the price basis becomes one.

The existing shipment consumes the Nexus when declared. Advanced Guild prevention retains its independent response; the stopped shipment uses the shipment allowance without moving forces or charging shipping spice, while the Nexus remains spent. Ordinary allowance uses the reduced actual payment for Guild income and preserves existing technology, BG and territory-entry rules. Unsupported competing arrival combinations retain their existing gates.

## Saved declaration and binding promises

The server binds the source to the original owner, turn, faction roster and exact shipment fields. The pending record includes the actual typed force allocation, selected native reserve pools, destination, sector, cost and arrival stance. Its separate latest-outcome marker prevents a deleted or reopened pending record from silently reverting to an ordinary shipment. These consistency signatures detect partial corruption; they are not cryptographic authentication of arbitrary replacement saves.

The card is discarded when the validated declaration is made. A saved Guild interception keeps that same record and the actual force count until allowance or special prevention. Terminal records retain history without locking the player's later forces or resources. Ordinary shipment validation still checks current physical custody, geography and payment before commitment.

A binding shipment answer searches the discounted shipment as a legal completion candidate. This matters when a player can afford five physical forces only by spending the held Nexus. The owner receives a concrete private completion action; the other seats do not receive the source offer or receipt. All four bot levels can use that action to honor an accepted Yes.

## Controls and bots

The [shipment panel](../components/game-table.tsx) starts with an unchecked “Use Richese Nexus Secret Ally” option. Selecting it limits the shipment group to five, displays the actual group separately from the one charged force, and uses the shared price for funding. It preserves the normal destination, typed-force and native Homeworld source controls. Server blocking reasons and transport-busy state remain visible.

The [shared consumer helper](../game/nexus-richese-options.ts) fences the private held card, absent native faction, current owner, unused shipment, event and interruptions. Opponents receive no private offer. The action retains the ordinary `ship` fields and adds the current Nexus event; a marker, cross-shipment or foreign Homeworld cannot masquerade as this source.

All four [bot profiles](../game/bots.ts) generate discounted candidates independently of ordinary shipment affordability, including five forces when the player can only afford the one-force price. They retain ordinary candidates and avoid spending the card when it saves no spice, including native Fremen free reinforcement. The [Homeworld payment filter](../game/homeworld-payment-options.ts) recognizes the actual source price before checking low-Junction contributor rounding. This establishes legal candidates, not separately calibrated Nexus strategy.

## Verification and remaining boundaries

Six new cases in [controls](../tests/nexus-richese-controls.test.ts) and [bots](../tests/nexus-richese-bots.test.ts) use the [genuine setup fixture](../tests/fixture-nexus-richese.ts). They exercise Basic/Advanced actual shipment, distinct price and physical count, unchecked controls, stale and unauthorized sources, observer privacy, native faction prices, affordable five-force candidates, ordinary fallback and the source-aware payment filter. The low-Junction consumer case explicitly stages a public projection only; it does not claim a new engine custody transition. Interactive checkbox verification is recorded below separately from server rendering and helper/action checks.

The checkpoint adds **30 passing cases**: six pure source/receipt tests, six consumer cases, twelve engine cases, five production SQLite cases and one binding-promise regression. Engine coverage includes actual Truthtrance interruption, real next-turn movement/shipment continuity, native Ixian HMS entry, and genuine prior Mentat Terror placement followed by a five-force arrival under low Grumman. SQLite covers competing declarations, uncertain-response recovery, Guild prevention, original typed sources and malformed history with zero writes.

Focused verification passed **6/6 new consumer cases**. A separate compatibility run passed **52/52 cases** covering shipment budgets and promises, native/Guild Homeworld controls, Nexus controls and reference checks. Type-aware lint passed for the changed consumer and test files. **Types, lint, all 4,099 offline tests, production build and 40 live HTTP tests passed.** Native Richese Cunning, Betrayal, the foreign-Homeworld tariff adapter and complete Nexus/module play remain unfinished.

## Isolated browser acceptance

Two fresh three-human-seat rooms used final session IDs before genuine fixture setup and exact state/version staging. MGJ3WQ6Y advanced from version 2 to 3: the unchecked ordinary five-force quote cost five spice and was unaffordable; selecting Secret Ally changed the maximum to five and the price to one. Emperor shipped three normal forces from Kaitain and two Sardaukar from Salusa, leaving fifteen reserves, three reserve Sardaukar, zero spice and movement available.

In 3C2N43XF, the five-force declaration reached the Guild at version 3. The Guild used its actual special Karama control; version 4 retained all twenty shipper reserves and its one spice, consumed the shipment, and left the Nexus spent. No phantom physical marker appeared.

Desktop 1440-pixel and phone 390-pixel screenshots were captured and visually inspected, including the typed source selection, price breakdown and Guild stop controls. Phone checks found no horizontal overflow. All six private sessions refreshed successfully with no page errors; opponents lacked the shipper's private hand, traitors and spice, and no internal shipment/history record was projected. The read-only restoration script is `/tmp/dune-richese-nexus-restore.cjs`. Staging the first room preserved all 3,548 other room states and versions; staging the second preserved all 3,549 other rooms. Final comparison after both browser rooms and thirty isolated HTTP rooms retained every version/hash of all 3,548 opening rooms; 3,580 rooms now persist. The 02:48 UTC controlled restart used a database backup, preserved all opening games and restored twelve earlier Moritani/CHOAM private sessions. Six new Richese private sessions subsequently restored. No publication or full module gate opened; the maintenance automation remains removed.
