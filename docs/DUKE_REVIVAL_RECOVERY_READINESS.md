# Paid Duke revival: continuation and recovery readiness

Read-only implementation audit, 2026-09-07. This document describes the bounded paid-revival integration; it does not implement it or choose the pending active-Ecaz versus set-aside restoration interpretation. No runtime/test edits, live-room writes or new tests were performed for this audit.

## Supported rule facts and independent boundary

The existing [Duke source audit](DUKE_VIDAL_RULES.md) records the publisher's explicit exception: only Ecaz may revive Duke, including with the Ghola Treachery Card; ordinary revival costs **five spice**, despite his battle strength of six, without requiring the other leaders to be dead. This is independent of the separate Ecaz ordinary-leader rule counting five dead leaders including Duke. Implementing the former does not implement the latter's six-disc cycles. [GF9 Ecaz & Moritani, printed pp. 8–9](https://www.gf9games.com/dune/wp-content/uploads/EcazMoritani-Rulebook-LOWRES.pdf#page=8)

The prior source audit finds no exemption from ordinary one-leader frequency, Tleilaxu prevention or applicable discounts. Retain those existing rules: five-spice base price, three after the existing upward-rounded half-price discount, ordinary revival prevention, and Tleilaxu income from the price actually paid. Neither force allowance nor a CHOAM free-force benefit applies.

The post-revival destination is explicitly awaiting the user's interpretation. Keep that decision separate from identifying, paying for and restoring the same dead disc. Do not infer active Ecaz custody merely from native identity, and do not silently implement set-aside custody through a generic `consumeDuke` call. Ghola-card revival and foreign/captured combinations remain outside this paid slice unless separately implemented and verified.

## Current code and exact integration points

Line numbers reference the snapshot at the end of this document.

| Code | Existing behavior and required Duke extension |
| --- | --- |
| `game/revival.ts:117`, `leaderRevivalOptions` | Computes native roster cycles using `normalRevivalCycle`, native strength prices, and one-leader eligibility. It deliberately excludes shared discs. Add a separate Duke option/quote; do not append him to `p.leaders` or use his exception to advance `p.revivalCycle`. |
| `game/engine.ts:14586`, `reviveLeader` / `reviveKwisatz` | Updates the native cycle before native lookup and uses `l.strength` as normal price. Branch on the explicit shared Duke ID/source before those operations. Authenticate Ecaz, ordinary frequency and prevention first; use frozen price 5. |
| `game/revival.ts:173`, `PendingRevival` | Existing kinds are forces, leader, kwisatz, foreignGhola. Prefer a distinct `duke` kind (or equally explicit discriminated shared source) so native negotiation, ghola ownership and cycles cannot accidentally apply. |
| `game/engine.ts:9940`, `beginRevival` | Installs the pending record, rejects existing prevention, and offers CHOAM only when `free>0`. Duke has `free:0`, so goes directly to the existing stop opportunity. |
| `game/revival-resume.ts:60`, `quoteRevivalResume` | Revalidates phase/current player, frozen cost shape, ordered checks, custody, funding, optional stop, and income. Native leader lookup only scans `players[].leaders`; this needs a separate shared-disc path. |
| `game/engine.ts:9962`, `offerRevivalStop` | Existing Advanced Tleilaxu prevention decision precedes benefit checks and payment. Reuse it for Duke; quote remains noncommitting. |
| `game/engine.ts:13354`, `revivalStop` decision | Actual decline calls `finishRevival`; the latter requotes current pending state before paying. Tleilaxu special Karama uses the same decision and snapshots the entire pending revival. |
| `game/engine.ts:9851`, `finishRevival` | Shifts one benefit check only when opening that response. Final payment occurs once; native lookup restores a roster leader and sets `leaderRevived`. Add explicit shared restoration before the roster branch, preserving death history and native counters. |
| `game/revival-cancellation.ts:175`, `quoteRevivalCancellation` | Validates current response owner/recipient, supported kind, remaining checks and native physical pool; then cancels discounts/early permission and requotes custody. Needs Duke kind/identity/frozen-price support and `dukeVidal` in its context. |
| `game/revival-cancellation.ts:66`, `continuationCustody` | Forces and KH have special paths; all other kinds use native rosters. Add shared Duke custody and owner-frequency validation without native pool/cycle assumptions. |
| `game/engine.ts:10648`, revival response settlement | A canceled discount installs quoted rules/pending and calls `finishRevival`; an allowed response also finishes. Both must preserve the Duke source and restoration choice. |
| `game/karama-context.ts:154` | Revival discount opportunity signatures already include the whole pending revival. A new source/death receipt inside it is naturally bound through a BG conversion, while hands/spice remain outside the signature. |
| `game/engine.ts:15906`, revival projection | Owner-relative options and a public pending Boolean; do not expose the raw pending object, negotiated requests or other hands to add Duke UI availability. |

Current exclusion is an unfinished feature, not a new regression: ordinary revival cannot find the shared disc; resume/cancellation similarly cannot find it in native inventories. Changing only the UI or native option list would therefore reject later, or dereference a missing native leader during settlement.

## Narrow saved source contract

A Duke pending record should identify the Ecaz requester, shared leader ID, current turn and expected death history independently of native revival cycles. For example, add a `duke` discriminant with a receipt `{leader:'duke-vidal', deaths, turn}` alongside `normalCost:5`, `cost:5|3`, `free:0`, and ordered `checks:[]|['revivalDiscount']`. The exact shape is an implementation choice, not a printed component rule. Include or otherwise bind the selected restoration policy once the user supplies it; one pending request must not change destination during recovery.

For a modern Duke source, validate before declaration, pending projection/recovery, benefit settlement and final commitment:

- Exactly one canonical shared disc exists at `g.dukeVidal`; ID `duke-vidal`, Ecaz identity, strength 6, valid dead/death history, and the expected death receipt. No player roster may also contain that ID. Absence rejects; never call `createDukeVidal` to replace a missing dead disc during revival.
- Requester is the seated Ecaz player; paid payer is that same player. Forbid Emperor-extra funding, force amount/elite fields, free-force counts and foreign-ghola kind/source.
- Disc remains dead and outside captured/ghola custody, with coherent existing shared controller/source fields. Actual normal battle death consumes temporary custody and leaves null controller/source/acquisition turn. Do not erase exceptional markers to make a request eligible.
- `normalCost` is exactly 5 and `cost` exactly the frozen supported price 5 or 3. A canceled discount restores 5, never strength 6. Native negotiated prices remain separate; do not impose Duke's fixed-price validation on their existing arbitrary agreed amounts.
- `checks` contains only the still-unanswered discount check, at most once. No early-revival or foreign-ghola response is valid for the ordinary Duke exception. Already shifted checks stay shifted after JSON recovery.
- Ordinary one-leader usage and the relevant prevention state remain enforced. Successful paid Duke revival sets `leaderRevived`; it does not advance native `revivalCycle`, `revived`, free-force or elite counters. The five-native-plus-Duke cycle for reviving other Ecaz leaders remains separately unfinished.

Existing native pending saves should retain their current interpretation. A distinct new kind needs no invented legacy Duke record: none was previously produced. Missing/duplicated Duke data must not fall back to the native branch.

Keep valid unfunded completion semantics: after an independently canceled discount, Ecaz with only three or four spice cannot pay five. The existing continuation clears the uncompleted request without charge or resurrection. Do not require payment capacity just to cancel the benefit. Source/schema validation must still distinguish a legitimate unfunded request from a forged Duke identity or price.

## Responses, interruptions and exact-once effects

The intended chain is `reviveLeader(Duke)` → optional actual Tleilaxu `revivalStop` → optional `revivalDiscount` response → paid restoration → `revivalIncome`. Each arrow either uses the current finite quote or stops at a real player decision/response. There is no new faction-power cancellation window for the ordinary Duke revival itself.

Tleilaxu prevention commits its printed Karama, marks the once-per-game special used, installs the turn-specific prevention and clears the pending request/decision. It must leave the dead Duke and Ecaz's spice unchanged. Its existing special intent includes the full pending record; extending that record must preserve the comparison at final settlement.

With the allied discount, produce `normalCost:5,cost:3,checks:['revivalDiscount']` from the actual Tleilaxu grant. Allowance pays three; printed or BG cancellation changes the charge to five. `finishRevival` shifts checks before saving the response, so final discount settlement sees an empty queue. The BG source signature must keep the same shared death receipt through reload and nested gift/Box/Truthtrance controls; do not freeze unrelated hands/resources or response pass sets.

Paid leader revival has no Axlotl free-force accrual and no free-revival bonus. Tleilaxu receives three or five through the existing `revivalIncome {owner,recipient,amount}` response. Its cancellation suppresses income only: the Duke is already alive and the payer already charged. Neither a repeated allowance nor a restarted worker may revive or pay again. Current terminal income validation can remain generic; the previous paid Duke receipt need not be replayed to credit it.

The actual mutation belongs in one explicit `finishRevival` branch: subtract the quoted price once, restore the existing leader's `dead` state while preserving accumulated deaths, apply the chosen shared-custody result, set ordinary leader usage, clear the pending source, and open income if applicable. Preserve the exact leader object data rather than constructing a new disc or using ordinary Ghola restoration. Prior battle bounty remains six and is never recomputed at the five-spice revival price.

## Production SQLite fixture and focused tests

Reuse `tests/ecaz-duke-recovery.test.ts` for actual room creation, fresh seat authentication, isolated SQLite migrations and CAS instrumentation. Reuse the genuine death journey in `tests/ecaz-duke-acquisition.test.ts:393`: placed reusable token → enemy paid shipment into Arrakeen → explicit Ecaz acquisition → actual remaining movement completion → actual battle with Duke versus Poison → both traitor declines → same Duke dead with `deaths:1` and no controller. It deliberately leaves all five native Ecaz leaders alive, proving the Duke exception independently of native cycles.

For persisted tests, execute those actions through the production room API, including cleanup decisions. Use Ecaz, entrant, Tleilaxu and BG seats, physically draw Poison and printed/Worthless costs from one inventory, and make Ecaz/Tleilaxu allied only for the discount variant. Do not put a new dead disc directly into a native roster.

Advance to the next Revival phase through actual readiness/storm/auction decisions where bounded. If that would broaden the fixture into a full-game simulation, explicitly stage **only** the later phase/turn and reset normal per-turn fields after saving the actual battle-death result. Preserve the exact dead Duke, leader history, hands/deck, force losses, bounty, and credentials; label this test seam rather than claiming the intervening game was played.

Recommended bounded cases:

1. Full-price declaration with living native leaders → actual Tleilaxu decline → pending income. Race two API workers on the same decline version: exactly one CAS commit, one five-spice payment, one resurrection/history log, unchanged death count/native cycle/forces and no native-roster insertion. Fresh auth and views preserve private hands. Later actual income allowance credits once; replay/stale action rejects.
2. Actual allied-discount grant → stop decline → discount response → BG cancellation → refreshed final allowance raced across two modules. Assert already-paid Worthless not discarded twice, base cost restored to five, exact income and selected custody. The corresponding allowed-discount control pays three; an unaffordable canceled discount leaves Duke dead and charges zero.
3. Actual stop → Tleilaxu special prevention raced once. Duke remains dead, no spice changes, special card/prevention record exactly once, subsequent normal Duke request denied for that turn.
4. Labelled copied-save mutations at the unpaid stop and paid BG window: missing disc, duplicate native copy, changed death receipt, wrong requesting faction/foreign kind, strength-derived or arbitrary price, forbidden early check and stale turn. Require zero SQL writes/card spends on rejection. Keep valid unmodified controls to distinguish schema hardening from unavailable features.

Foreign `reviveForeignGhola` and negotiated `requestLeaderRevival` must reject Duke; the ordinary Ghola card should remain explicitly unavailable in this paid-only release. Tests must not turn that remaining printed feature into a claim of permanent rules prohibition.

## Remaining interpretation and verification limits

The active-Ecaz versus set-aside result is the one user interpretation intentionally left open here. Either result can preserve payment, shared identity, prevention, discount and CAS contracts. The choice must be explicit before shipping the successful restoration branch and its UI description.

Full six-disc native cycle behavior, ordinary Ghola integration, exotic captured/foreign custody, Ecaz loan/Occupy rules and complete expansion setup/game acceptance remain separate. This audit reports a concrete integration contract, not implemented runtime or passing new tests.

Historical reviewed hashes:

- `game/engine.ts`: `d98727b2e1682fa5d0128436fa83ef339e231a45c414a4e63c3bb233b9c7ff10`
- `game/revival.ts`: `679a33b68d6eac4a419bded2f3e506b466a68c337413a1798f2999f234b50c3c`
- `game/revival-resume.ts`: `cf31770745b2a32e498feef936f8f177d2e54624cbe546af912efe241356946f`
- `game/revival-cancellation.ts`: `374fe003aae4c27b5e5c70ed97f448f012e5a36dc5b8d0945aef790e96ed9a65`
