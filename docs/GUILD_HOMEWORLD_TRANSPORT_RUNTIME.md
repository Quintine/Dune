# Guild transport from Arrakis to Homeworlds

9 September 2026. [Source contract](GUILD_HOMEWORLD_TRANSPORT_RULES.md). This extends the existing [world-to-world shipment runtime](HOMEWORLD_SHIPMENT_RUNTIME.md); Homeworld starts remain disabled pending the complete module.

## Implemented behavior

Guild can ship physical forces from one Arrakis territory to a foreign Homeworld or return them to Junction. Several sectors of that same territory may contribute. The quote rejects mixed territories, invented sector spellings, unavailable counters, storm-covered source sectors, non-Guild users and allied Homeworld destinations. The Hidden Mobile Stronghold has its existing protected interior; its ordinary board pointer does not turn its forces into an exposed storm sector.

The tariff is one spice per two physical counters, rounded up. Native returns credit Junction's reserves; invasions create an explicit foreign pool. Both remove exactly the selected Arrakis counters and preserve the other groups, Tanks and physical special-force inventory. No Homeworld receives a fake sector, board geometry or territorial arrival effect.

The route consumes shipment and retains movement. Guild's printed Heighliner exception remains in force. A non-Guild ally's pledged contribution follows the existing November funding rule, separately from the Guild shipper's bank payment; no receipt can fund its own shipment.

The same event-bound declaration and Guild special-interception machinery serves both interplanetary routes. The new route explicitly freezes the shipper's board pools, storm and active mobile pointer as well as world custody, alliances, turn, cost and funding. The optional self-interception follows the source's unrestricted player predicate. With no legal stop it continues automatically. A real choice remains actionable, including after a paid Box interruption. The previously documented provisional stopped-shipment settlement and ordinary cancellation questions remain unresolved.

The existing `guildShip` return-to-reserves API and its Homeworld destination form now pass through this same declaration when Homeworlds are active. They cannot bypass the new custody, funding, interception or source validation. Other modes retain their prior route handling.

## Controls, AI and verification

The Guild's table has a separate Arrakis-source transport panel with explicit accessible names, sector quantities, storm guidance, Junction/foreign destinations and a shared payment quote. All four AI profiles use that quote through their own public view, consider native defense and existing invasions, retain useful defenders/collectors and preserve normal movement alternatives. Rival private resources and concealed counters do not enter this adapter.

Pure, actual-engine, all-profile, rendering and production SQLite tests cover route legality, costs, source custody, genuine setup, old API parity, interruptions, competing requests, corrupt saved receipts and private projection. Source staging used by special tests is identified in the tests; it does not substitute for complete module games.

Final `npm run check` passes types, lint and all **3,340 offline cases**, including 36 new Guild transport regressions; the production build and **40 HTTP cases** also pass. Independent review found no further defects. An isolated browser QA room used genuine Advanced setup with a staged shipment opportunity: desktop controls rejected six forces from a five-force source, quoted five forces at three spice, and submitted the declaration by keyboard. At 390×844, both owned Guild interception choices remained actionable after refresh; keyboard allowance and another refresh preserved five Guild invaders on Caladan, fifteen native reserves, two spice, zero Tanks, the unspent Karama and the remaining movement. No page errors or horizontal page overflow occurred. The completed phone table was visually inspected. All **2,771** pre-existing rooms retain their exact versions and state hashes, with none missing; the existing server was reused.

Junction-sponsored transport, other factions' Arrakis permissions, unsponsored foreign departures to Arrakis, concealed No-Field transport, ordinary Guild rate/permission cancellation timing, the generic purchased Karama destination scope, occupation, remaining faces and complete Homeworld games remain unfinished. No game-start or publication gate is opened, saved games are preserved, and maintenance automation remains removed.
