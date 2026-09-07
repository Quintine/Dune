# Restored cancellation controls — 7 September 2026

This is a partial reliability checkpoint for the complete Dune implementation. Advanced and expansion starts remain gated. It does not settle pending rules interpretations or prove every future automatic continuation. The removed maintenance automation remains removed.

## Richese gifts and purchase income

`game/richese-cancellation.ts` returns the exact canceled gift record and restored controls, or the restored controls following canceled Emperor purchase income. It validates the actual Richese/Emperor owner, current turn and phase, canonical gift identity, gift event and recipient, current blocked-card list, and three-spice income declaration. It does not require the denied gift to remain transferable, the recipient to have spare capacity or a current alliance, or the completed purchase to be affordable again.

Gift cancellation restores the original response, decision, pending Karama and phase opening. Purchase income restores its original three controls while preserving the live phase opening. The existing income receipt contains no acquired-card/buyer stamp; this work does not invent historical facts that were never saved. A completed special purchase retains its card, paid spice and used special power even when the Emperor's income is canceled.

Saved control envelopes use exhaustive typed discriminator lists. Actual gift, purchase-income and Harkonnen exchange parent links are checked for recursive or cleared parents. Nested gift/income receipts must retain their own owner, phase and declaration. Optional legacy fields remain optional. No restored control is interpreted as permission to make a future choice.

The engine constructs the exact restored context without executing it, then runs existing suspended-control integrity checks and source selection. Integration tests exposed a gap in source selection: an older Emperor gift could have the wrong faction owner or a negative amount while retaining a recognized response name. The adapter now also uses the shared terminal declaration and combat-response validators for those restored families. Their result is not applied; no income, cancellation outcome, draw, decision answer or random event occurs during validation. These checks run before a new Karama cost and again when a saved BG conversion is allowed.

## Moritani and Ixian continuations

`game/moritani-alliance-cancellation.ts` validates Enemy of My Enemy's original entrant, Moritani owner, stronghold sector, declared counts, turn/phase, entry cause and continuation, and the unique hidden token still at that territory. Cancellation returns the existing token offer to Moritani with alliance formation blocked for that opportunity. Entry, shipment price, worm queue and token custody remain unchanged. It neither requires nor performs a future reveal, alliance acceptance, assassination, robbery or force placement. The quote does not expose the token face. Actual shipment, movement, Guild transport, accompanying advisor and Fremen worm-ride producers are covered, including Basic availability.

`game/ix-substitution-cancellation.ts` binds the completed battle and the declared casualty/exchange sectors. It deliberately does not require the surviving suboids, cyborg Tanks or spice for an exchange that is denied. The winner's retained battle cards must still have unique physical custody because their next actual cleanup choice needs them. The canceled branch consumes the quoted card decision. When no cards remain to choose, preflight validates the immediate aftermath with the canceler's post-cost hand, and actual cancellation continues through the same battle cleanup once. A new chronicle message explains that original cyborg casualties remain in the Tanks and no suboids were exchanged. Legacy battle context is checked without allocating a replacement event during the quote.

## Verification and browser evidence

This checkpoint adds **88 rule tests and four SQLite recovery tests**, bringing registered coverage to **2,250 rules/client/component +208 multiplayer, 2,458 total**. The full suites pass: `/tmp/dune-restored-rules-final.log` (70.067 seconds) and `/tmp/dune-restored-multiplayer-final2.log` (20.715 seconds). TypeScript, lint and production build pass in `/tmp/dune-restored-{type,lint,build}-final.log`.

Focused coverage includes 180 real gift declarations across ten canonical cards, nine phases and Basic/Advanced modes; nested BG conversions; real Harkonnen hand exchange and cross-receipt restoration; malformed source rejection without RNG; private gift/acquisition identities; five Moritani entry routes; and Ixian cancellation with or without a subsequent card choice. Independent Ixian review found no concrete valid-state regression. All agent production and test contributions were read and integrated by the coordinating agent.

SQLite tests use real room credentials and production actions to create the gifts, battles and cancellations. Concurrent final allowances commit once. Fresh module loading and seat authentication preserve private state. Twelve malformed-source attempts across initial and already-paid cancellations write nothing. A restored Emperor gift subsequently transfers spice once; an actual Ixian winner-card discard reaches collection without replaying casualties or bounty.

Two historical fixtures were corrected without weakening assertions. The Ixian cancellation fixture now moves its printed Karama out of the shuffled supply before placing it in hand. A persisted paused Guild-income fixture now belongs to Guild in Shipment & Movement instead of Emperor in Bidding. The first full multiplayer run exposed that inconsistency; the final full run passes.

The unchanged-source public Basic matrix completed **20/20 games**, two through six seats and all four homogeneous AI profiles: **11,657 accepted actions, zero rejected candidates/stalls, and 522 JSON round trips**, in 127.060 seconds. Seed: 20261013. Full traces: `/tmp/dune-restored-fullgames-final.json`; source fingerprint `8a846a7f05e669e21e1a88cc886f36dd858739e56fbccf06e7368edf92184afd`. Every recorded file hash matched afterward. This regression sample does not establish relative AI strength or full expansion acceptance.

The existing isolated QA room retained both authenticated seats. A real Richese shipment opened the BG advisor choice, then a real allied Portable Snooper gift interrupted it. The browser canceled the gift with Baliset and displayed the saved BG conversion. The other controlled QA seat allowed it through the production engine. The gift stayed with Richese; both hands, forces, reserves and spice matched the pre-allowance state. Reload restored the exact advisor choice and correct BG ownership banner. The browser then declined that shipment opportunity and continued to Richese's movement, reaching room version 73. Saved QA snapshots are `/tmp/dune-richese-response-qa-{before,staged,pending,final,resumed}.json`, restricted to the local user.

All 2,196 older non-QA rooms from the 07:50 UTC backup retain their exact versions and state hashes. No further hourly restart was due; the controlled server session remains 90387, with next maintenance about 08:50 UTC if active development and human play permit.

## Remaining work

[Auction cancellation contract](AUCTION_CANCELLATION_CONTRACT.md) records the next engineering slice: denied Ixian Technology, then shared paid-sale and next-lot checks. It distinguishes actual draw/refill, post-cost hand eligibility, legacy sale receipts and phase-ending obligations. No new rules ruling or valid-state deadlock was claimed by that read-only audit.

Full automatic-response closure, original-actor promise feasibility, durable Karama cost/discard frames, CHOAM Worthless continuations, faction placement transitions and wider auction chains remain incomplete. Full Advanced and expansion/module games, complete component acceptance, AI strength calibration and other goal requirements still require work. The overall goal remains active.
