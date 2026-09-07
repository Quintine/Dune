# Battle aftermath and Karama commitment checks — 7 September 2026

This is a partial implementation checkpoint. It does not enable Advanced or expansion starts or certify complete rules compliance. The maintenance automation remains removed.

## Shared calculations and execution

`game/battle-aftermath-quote.ts` follows the current cleanup order: Moritani retention, CHOAM battle income, technology transfer, Harkonnen capture, Auditor, Face Dance, then the remaining board. A sole technology token transfers automatically; multiple tokens stop at a real choice. An empty audit clears automatically. The engine consumes the same ordered steps and next decision. Quote evaluation does not capture leaders, sample cards, transfer tokens, allocate events, initialize phases, or run an effectful trial game.

Modern saved cleanup binds its completed battle receipt. Legacy saves bind only independently available combatants, territory and winner; they do not invent missing receipt facts. Canceled capture, income and Auditor validate the current response before omitting its effect in the quote. The actual post-cost branch repeats the relevant validation. Leader identities survive legitimate custody changes; canceled capture does not require a randomly selectable candidate.

Before a card is spent, the aftermath quote also considers the owner's hand after that card leaves it. Global physical custody stays unchanged because the card moves to discard. This matters when canceling CHOAM income spends the last eligible Auditor card: the now-empty audit exposes later cleanup that must be checked before beginning a BG conversion. The focused regression first reproduced acceptance of this malformed continuation and now protects that boundary.

`game/board-resolution-quote.ts` shares actual battle geometry and spice collection with pure preflight. It returns automatic advisor releases rather than applying effects to a speculative game. Force locations with zero pieces no longer create a spurious battle path across the storm. Collection preserves current storm order, city collection rates, Ixian cyborg rates, concealed marker presence and Advanced stronghold income.

When no battle remains, a seated CHOAM opens its real market before phase completion. Otherwise aid refunds are calculated before collection, including overflow checks. Ix's real phase opening stops the preview before collection. Actual Battle-phase advancement checks the same refund/collection boundary. No future choice is silently accepted.

## Movement and promises

`game/karama-movement-cancellation.ts` covers canceled Guild timing, Ixian cyborg movement, Fremen movement, mobile stronghold movement and bounded advisor continuations. The engine uses its current owner, queue, declaration and move-index evidence before spending and when committing cancellation. It preserves the original Fremen custody/route validator. Canceled Ix movement does not require its uncommitted forces to retain a usable route. Mobile cancellation does not sample a missing future storm card or relocate the stronghold.

Advisor worm rides and empty-queue phase-ending chains explicitly return no bounded proof. They retain the existing atomic action behavior. No new Sapho-versus-Guild interpretation is introduced.

The engine's owner-promise check projects supported intended Karama changes before testing canonical battle or shipment feasibility. Own shipment installs the intended rate before searching; Voice cancellation removes the restriction before checking a promised Shield. A promised sole Worthless card cannot be voluntarily consumed when doing so makes the battle promise impossible. Only the original owner's live promises are checked. Later opponent interference retains the existing involuntary-release rules.

Unsupported promise suffixes return an explicit incomplete-proof result and continue to rely on the existing atomic public wrapper. No durable Karama cost/discard frame is implemented by this checkpoint. Full cancellation coverage, all future automatic chains, Semuta timing/capacity, remaining discard producers and complete Advanced/expansion acceptance remain unfinished.

## Verification scope

New tests are registered in `package.json`: board/refund/collection, aftermath quotes, movement cancellation, owner promises and SQL aftermath recovery. Genuine game actions produce battle plans, cleanup responses and cancellations. SQL tests exercise concurrent submissions, process-module reloads, private seat projection, stale actions and exactly-once refunds/collection. Corrupt immediate suffixes reject with no database writes before either new card costs or a previously paid BG allowance.

Historical fixtures were corrected without weakening gameplay assertions: the newly seated Tleilaxu participant joins the player order; Rock Outcroppings uses sector 13; an Ix casualty recovery uses Imperial Basin sector 10; Tuek's Sietch uses sector 5. These locations follow the bundled board data. The capture cancellation fixture also uses the existing physical-card placement helper so its Karama exists exactly once.

Browser QA uses the existing isolated table with its authenticated seats retained. A real battle produced Harkonnen capture; the browser spent Baliset as Karama, and the other controlled QA seat allowed conversion through the engine. No leader was captured. Collection left two spice at Arrakeen and the winner at 22 spice, with the Baliset discarded once. Refresh recovery and private hand rendering passed separately from the SQL concurrency tests. The table is saved at version 66. All 2,105 older non-QA rooms from the last maintenance backup retain their exact saved versions and hashes. No hourly restart was due during this checkpoint; the prior controlled restart was at approximately 06:50 UTC.

Final aggregate verification is recorded in `IMPLEMENTATION_STATUS.md`. The unchanged-source Basic matrix completed 20/20 games, 11,550 accepted actions, zero rejected candidates/stalls and 521 JSON round trips in 108.475 seconds (`/tmp/dune-aftermath-fullgames-final.json`). Its source fingerprint is `edfc01375318dfa2e0fd88c082ef7696393a3e3356be2229e8baa6e2c49000e7`. Complete Basic AI regression games do not establish Advanced/expansion readiness or relative AI strength calibration.

Final registered suites: **2,044/2,044 rules/client/component** (`/tmp/dune-aftermath-rules-final2.log`, 51.588 seconds) and **201/201 multiplayer** (`/tmp/dune-aftermath-multiplayer-final.log`, 19.231 seconds), **2,245 total**, including 87 new tests. TypeScript and lint pass in the `-final2` logs; production build passes in `/tmp/dune-aftermath-build-final.log`. Earlier full runs exposed only fixture inconsistencies described above; final suites pass without weakening the rules.
