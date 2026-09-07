# Richese Ambassador implementation checkpoint

7 September 2026. The Richese Ambassador now resolves its paid card acquisition for Ecaz or any of its eleven possible allied factions. The same effect can be copied through a legal Bene Gesserit Ambassador choice. Full Ecaz and expansion starts remain gated: this checkpoint verifies one effect and its supported interactions, not complete expansion games.

## Rules and behavior

[Primary-source review](RICHESE_AMBASSADOR_RULES.md) records source precedence and composition. A fixed three-spice deck acquisition counts as a purchase for Harkonnen's extra card and Emperor's substitution for the bank. Ixian allied replacement expressly requires Bidding, so it does not apply to the implemented movement, shipment or worm entries. No artificial auction or allied shipment funding is created.

Ecaz chooses whether to trigger and who receives the effect. That choice commits the token and automatically pays/draws; there is no additional beneficiary consent or result confirmation. The chosen beneficiary's current personal spice and actual hand limit apply. If payment, hand capacity or a drawable card is unavailable, the effect completes without payment or acquisition and the token remains committed. This unavailable-effect behavior is a documented interpretation of conditional resolution, rather than a specific publisher failed-cost ruling. Public eligibility and failure wording do not disclose an ally's private balance or fullness.

The standard draw primitive recycles the discard pile when needed. The primary card and payment commit once before any income/bonus opportunity. A server-only receipt retains the original entry, beneficiary, paid card identity, fixed price and child stage. Emperor income, when applicable, precedes Harkonnen's bonus. Cancellation affects only the selected benefit; the original payment/card persist. Both child responses finish through the original Ambassador continuation, never an auction continuation. The original movement is not replayed; a pending worm queue resumes once. The five-token cohort replenishes only after all child effects finish, preserving a permanently removed BG token.

A receipt is historical evidence, not a reservation on the purchased card. Legal transfers and paid Box searches can occur during a response. BG conversion preserves the exact original source through these interruptions. The existing automatic-response mechanism skips confirmation when nobody can cancel. The response panel explains the completed purchase instead of showing its internal event identifier.

## Controls, AI and evidence

The entry panel explains the three-spice consequence before the trigger. The recipient sees the acquired card through the normal private hand and inspector. All four AI profiles handle the effect from their own projections: they consider their own affordability, avoid unusable copied purchases when another useful effect exists, and do not inspect an ally's private resources.

New focused coverage comprises 13 purchase tests, 13 bot tests, five interruption tests and two production-room SQLite recovery tests. These cover all twelve beneficiary factions, hand caps, Emperor absent/self/canceled, Harkonnen bonus allowed/canceled/full/empty, real recycling, private inability, fifth-token BG-copy worm resumption, stale receipts and commands, nested Box/BG decisions, transferred purchased cards and a hand filled during a pending bonus. Exhausted-pile fixtures explicitly use bounded inventories; they do not claim a fully played deck-exhaustion journey. SQLite tests execute production room code against an in-memory database, authenticate again after module restart, race requests through the real version fence and verify one persisted charge/draw/discard.

The browser QA table exercised a real Emperor move into Arrakeen, Ecaz's Richese trigger, immediate three-spice payment and Crysknife draw, refresh during Emperor income, then Karama cancellation and resumed entrant control. It ended at version101 with Ecaz's seven spice and Crysknife retained, Emperor still at ten spice, and the original move counted once. All 2,406 pre-existing non-QA rooms retained their versions and exact state hashes. This was desktop inspection; mobile, keyboard and transient-animation duration were not measured in this checkpoint.

Twenty fresh Basic games completed 12,218 accepted actions, 544 JSON continuations and zero rejected actions, stalls or invariant failures across all four difficulties and two through six players. The runner exited1 solely because a rules-reference evidence path changed during execution; every other tracked source remained unchanged. This is Basic regression evidence, not full expansion acceptance or calibrated strength ranking.

Validation logs use `/tmp/dune-richese-ambassador-`: `rules-final.log`, `multiplayer-final.log`, `focused-final.log`, `type-final.log`, `lint-final.log`, `build-final.log` and `fullgames-evidence.json`. Final clean totals are 2,548 rules/client/component tests and 228 multiplayer tests (2,776 total), all passing. Typecheck, lint and production build passed.

## Remaining work

Fremen, Guild and Tleilaxu Ambassador effects; Ecaz alliance/loan options and Occupy; competing arrival ordering; exceptional Duke custody/revival; complete Advanced/expansion/module games; component and mobile acceptance; and AI strength calibration remain unfinished. The Duke revival custody question remains pending. The removed automation stays removed.
