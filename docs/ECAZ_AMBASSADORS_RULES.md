# Ecaz ambassadors: rules and implementation checkpoint

Audit: 2026-09-06. Scope: ambassador inventory, setup, placement, triggering, effects, and necessary continuation boundaries. This is a developer audit, not complete Ecaz support. Only this document was written.

## Primary evidence and precedence

- **E3:** [GF9 Ecaz & Moritani rulebook](https://www.gf9games.com/dune/wp-content/uploads/EcazMoritani-Rulebook-LOWRES.pdf), printed p.4 components; pp.7–8 Ecaz; p.9 Duke Vidal; p.15 built-in Ecaz FAQ; p.16 Karama table. Targeted searches retrieved the publisher's indexed text.
- **E3-M:** [Accessible copy of the publisher-authored PDF](https://gamers-hq.de/media/pdf/0f/7a/86/Dune_EcazMoritani_Rulebook_EN.pdf), 16 pages, with GF9/Future Pastimes credits. This is a mirror of primary authored material, not a retailer's rewritten rules. It supplies readable page text but is not assumed to be the same revision as E3: a material difference is recorded below.
- **Designer clarification:** Jack Reda (@The Warp), 26 August 2023, on his [Ecaz and Moritani rulebook upload](https://boardgamegeek.com/filepage/263742/ecaz-and-moritani-rules), explicitly confirms Ambassador placement face up. This is the designer speaking directly, not a community interpretation. The publisher-indexed file-page comment was verified in the follow-up audit below.
- No community amendment, fan implementation, or tournament rule was used. No separately dated official ambassador errata resolving the remaining open questions was found in this bounded pass. Use applicable official corrections/FAQ over general text; record conflicts rather than silently resolving them.

## Compact authoritative rule map

**Inventory/setup (E3 pp.4,7):** 11 ambassadors. Ecaz takes its token plus five random others. Start: six forces in Imperial Basin, 14 reserves, 12 spice; two free revivals.

**Lifecycle (E3 p.7):** Revival-end placement costs 1,2,3… spice per token that turn; choose an ambassador-free stronghold outside storm. Opponent entry permits triggering, excluding allies, advisors, and matching factions. Triggered tokens are set aside. Recycle after all five random tokens trigger; exclude removed Bene Gesserit. Storm/explosion losses return to supply.

| Identity      | Effect anchor, E3 pp.7–8                                                                                                                                         |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ecaz          | Acquire Vidal if neither dead, captured nor a ghola, until battle use; or consensually ally if both unallied, optionally lending Vidal that turn. Token returns. |
| Atreides      | Inspect entrant's hand.                                                                                                                                          |
| Bene Gesserit | Copy an outside-supply ambassador; remove this token.                                                                                                            |
| CHOAM         | Discard own cards: 3 bank spice each.                                                                                                                            |
| Emperor       | Gain 5 bank spice.                                                                                                                                               |
| Fremen        | Relocate a board group; storm/occupancy apply.                                                                                                                   |
| Harkonnen     | Inspect one random entrant traitor.                                                                                                                              |
| Ixian         | Discard one card; draw one.                                                                                                                                      |
| Richese       | Pay bank 3; draw if below hand limit.                                                                                                                            |
| Spacing Guild | Up to four reserves arrive free outside storm.                                                                                                                   |
| Tleilaxu      | Revive one own leader or up to four forces free.                                                                                                                 |

**Alliance/FAQ (E3 pp.8,15–16):** Ecaz may designate its ally beneficiary. Triggers interrupt actions; Guild arrival precedes entrant's subsequent movement. BG-copy bypasses matching-faction immunity. Karama prevents ambassador placement this turn.

All mechanics in this compact map are anchored to the [publisher rulebook](https://www.gf9games.com/dune/wp-content/uploads/EcazMoritani-Rulebook-LOWRES.pdf). The fuller wording should be consulted at the listed pages when implementing an effect; the map deliberately does not invent missing timing rules.

## Inventory confidence and component ownership

The **aggregate eleven-token count** and **eleven effect identities above** are explicit rule evidence. One token for each listed identity is the natural inventory interpretation, but this pass did not inspect a complete punchboard face/back image to independently certify per-face quantities, symbols, or orientation. There is no Moritani entry in the ambassador effects list; do not generate an additional token merely because Moritani appears in `FACTIONS`.

For implementation, keep these distinctions explicit:

- `physicalId`: a proposed software identity for one component, not a new printed name.
- `effect`: the rule identity, mapped to the existing canonical faction IDs where appropriate (`guild`, `ixians`, `beneGesserit`).
- `zone`: unused pool, available supply, placed stronghold, triggered/set-aside, or removed.
- `cohort`: the original five randomly drawn components for the current cycle, tracked independently of where they currently sit.
- `placedThisTurn` and any placement-prevention stamp: phase/turn bookkeeping, not extra physical tokens.

Do not reuse the traitor deck's participating-faction filter for this pool: the ambassador setup instruction does not specify that filter. Keep the special Ecaz component separate from the five-token draw/recycling counter. A permanently removed component must not reappear through reshuffling, JSON normalization, or setup reuse. Destroyed and triggered components require different destination zones.

A complete official punchboard/proof image remains useful to certify the one-per-identity interpretation and establish how unplaced supply is displayed. **Placed Ambassadors are face up**, according to the direct designer clarification above. The earlier audit's placed-orientation uncertainty is superseded; unplaced supply visibility remains a separate question.

## Recommended next slice

These are software recommendations derived from the inspected engine, not additional tabletop rules. Keep the full Ecaz start gate until the leader inventory, Occupy, ambassador effects, and remaining faction interactions are complete.

1. **Pure inventory and placement first.** Add a bounded component collection with stable physical IDs, explicit zones and a cohort. Randomize only during setup or a settled recycling transition. Add private/public projections according to a documented visibility policy; do not infer visibility from whether a player can currently choose a token.
2. **An end-of-Revival continuation.** `nextPhase`, `openChoamMarket`, `advancePhase`, and `completePhase` currently own phase departure. Insert a persistent Ecaz placement checkpoint rather than placing ambassadors in `beginPhase(5)`, which would move the opportunity into Shipment and Movement. Do not overwrite the CHOAM end-of-phase market or allow either checkpoint to reopen repeatedly on resume.
3. **Separate placement intent from placement commitment.** Validate component zone, destination, available spice, current per-turn counter, and prevention status. Give the cancellation mechanism an exact pending placement/window. Revalidate before spending spice or moving the token. A canceled intent must not leave an incremented counter or orphaned component.
4. **A shared entry-event continuation.** Introduce an explicit arrival event containing entrant, destination, advisor status, origin/cause, and the saved next action. Derive it from successful entry, not merely a requested shipment that Guild might still prevent. `commitShipment`, `completeMove`, `resumeChoamMovement`, and the advisor/intrusion continuations are the main existing integration points.
5. **Implement a simple benefit end to end.** The Emperor effect is a useful initial fixture: placement → qualifying entry → Ecaz trigger/decline → beneficiary selection where relevant → committed effect → token disposal → exact caller resume. Validate private projections and saved-state round-trips before adding more complicated effects. This is an internal partial slice, not permission to omit official effects in an enabled full game.
6. **Reuse capability validators, not whole ordinary turns.** Fremen/Guild effects need their own authorized movement/arrival intents; forcing an out-of-turn beneficiary through the public `ship` or `move` action would impose unrelated turn ownership and cost rules. Card inspection, draw/discard, revival and leader custody likewise need explicit effect context.

## Timing and interruption checks

The p.15 FAQ establishes an interruption, rather than a bonus deferred to the end of the current player's turn. Its example supports pausing between an arrival and the entrant's later movement. It does not enumerate every ordering combination. The implementation should therefore distinguish these checkpoints instead of flattening them:

```text
validate attempted entry
→ settle pre-entry prevention/payment
→ record actual arrival
→ resolve entry reactions in the chosen documented order
→ resume the original caller's remaining work
```

The skeleton above is an integration proposal. Before enabling combinations, settle the relative order of ambassador reactions, Moritani Terror, Bene Gesserit Intrusion/spiritual advisors, and other entry-triggered effects from sufficient authority. Keep pending actor, beneficiary and original entrant distinct; none can be inferred from `g.active` during a nested effect.

Recommended safeguards:

- Do not trigger on an entry that was prevented, on a same-location bookkeeping update, or simply because the stronghold already contains an opposing force when a token is placed. Treat these as event-model decisions requiring explicit tests.
- An Ecaz choice to decline must not automatically run the token's disposal path. Separate attempted reaction, committed effect, and disposal.
- Nested movement/shipment must not overwrite `pendingShipment`, `pendingChoamMove`, an advisor follow-up, or the original response. Save typed continuations and revalidate the resumed action against intervening occupancy/custody changes.
- Inspection data belongs only to the effect's authorized beneficiary. Public logs should not contain card identities, traitor draws, hidden supply choices, or future draw order.
- Capture the random choice once at effect commitment. Reopening a dialog, refreshing the room, or retrying a persisted action must not reroll it.
- Use a shared token-disposition function in storm/destruction handling, rather than equating all removal with permanent loss. Audit `continueStorm` and battle explosion paths independently.

## Unresolved facts and implementation boundaries

| Question                      | Current evidence / required decision                                                                                                                                                                                                                                                  |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Token/supply visibility       | Placed identities are public: direct designer clarification specifies face up. The retrieved sentence does not explicitly establish unplaced supply visibility. Do not claim hidden supply, or full public supply, as a dedicated official ruling.                                    |
| BG copy pool                  | Clarify whether “supply” means the original cohort or only currently available tokens. Tracking the original cohort preserves the information needed to implement either ruling and prevents discarded/placed tokens from silently changing eligibility.                              |
| Placement/cancellation timing | The cancellation table addresses placement for the turn. It does not explicitly define refund timing, retroactive removal, or cancellation of an already triggered effect. Do not infer all those behaviors from the generic Karama response system.                                  |
| Multiple entry reactions      | The FAQ confirms interruption but does not give a full priority order for Terror, advisors, ambassadors and nested arrivals. Keep combined-module cases gated or explicitly provisional until resolved.                                                                               |
| No-Field/Face Dancer entry    | The adjacent p.14 questions address **Terror**. Do not automatically label their exact answers as ambassador FAQ rulings. Model causes separately so an applicable later ruling can be implemented cleanly.                                                                           |
| Unavailable effect            | Empty inspected hands, no revivable components, an empty draw supply, and other impossible selections need a consistent trigger/disposal policy. The retrieved text does not explicitly settle every no-op case.                                                                      |
| Tleilaxu effect               | Determine applicable elite limits, ordinary revival-cycle restrictions and other factions' revival income/prevention before reusing `beginRevival` or `applyGholaEffect`. Similar numbers do not establish identical timing or exceptions.                                            |
| Guild/Fremen effect details   | Validate occupancy and force conservation; determine interactions with normal shipment limits, special units and existing movement prevention from their applicable rules. The effect is not automatically the faction's ordinary shipment/movement action.                           |
| Duke Vidal                    | Use E3 pp.7–9 for acquisition, control duration, transfer, revival and absence of a traitor card. No printed strength was verified in this ambassador audit. The special Ecaz effect must not fabricate a leader or a matching traitor.                                               |
| Alliance formation            | Consent and current alliance state must be revalidated. Homeworld/Nexus-card modules impose additional rules; this audit does not certify them. Existing `allowedEntry` rejects allied occupation, so ambassador-created alliances must not imply that Occupy is already implemented. |

## Material adjacent source discrepancy: Occupy

The official indexed **E3 p.15** example describes five Ecaz forces contributing **two**, with rounding down. **E3-M p.15** instead describes the same five forces contributing **three**, with rounding up. Both retrieved **p.8 general paragraphs** use rounding up; the example's survivor/loss accounting also needs reconciliation with that paragraph. This is a concrete version/text conflict, not a proposed amendment.

Do not certify Occupy combat rounding from the older mirror or silently alter it while implementing ambassadors. Preserve the exact publisher URL/page and acquire the applicable correction/printing clarification. The ambassador interruption and BG-copy FAQ answers agreed across the retrieved versions and can be used independently. [Publisher E3](https://www.gf9games.com/dune/wp-content/uploads/EcazMoritani-Rulebook-LOWRES.pdf), [E3-M](https://gamers-hq.de/media/pdf/0f/7a/86/Dune_EcazMoritani_Rulebook_EN.pdf)

## Verification plan and current limits

Meaningful internal fixtures should cover: inventory conservation over two recycling cycles; distinct destruction/trigger/removal destinations; placement costs and per-turn reset; decline versus trigger; ally/advisor/matching-faction exclusions; BG-copy matching-faction example; cancellation and resumption; interrupted shipment followed by movement; ally beneficiary privacy; and JSON recovery at every pending decision. Test each effect through server-derived private views for every bot level once controls exist.

Inspected `game/catalog.ts`, `game/cards.ts`, and the phase, entry, advisor, storm, revival and victory integration points in `game/engine.ts`. No ambassador runtime representation or action branch exists in the inspected baseline. Existing faction metadata and broad subsystem helpers do not count as an implemented ambassador inventory. Validation for this task is source comparison and document formatting only; no gameplay test or complete Ecaz game is claimed.

## Follow-up: inventory, visibility and recycling contract

Follow-up audit on 2026-09-06; no runtime edits and no Occupy re-audit. The developer-linked [Future Pastimes expansion page](https://futurepastimes.com/dune-ecaz-moritani) identifies the designer's [House Ecaz faction reveal](https://www.youtube.com/watch?v=XfmxCvCEUhQ). Its public metadata identifies Jack Reda / Future Pastimes Games, but the caption endpoint returned no text; no video statement is claimed here. The separate designer-authored rulebook comment supplies the decisive placed-orientation clarification: “Ecaz Ambassadors are placed face up.” [Jack Reda, 26 August 2023](https://boardgamegeek.com/filepage/263742/ecaz-and-moritani-rules)

### Source-supported state transitions

The following is a normalized implementation interpretation of the printed lifecycle, preserving all its distinctions. The table uses zone names for software; they are not additional tabletop components.

| Event                                | Required custody and bookkeeping                                                                                                                                                                                                                                       |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Setup                                | Ecaz component available separately; choose five distinct random non-Ecaz components without replacement from the remaining ten. Persist those five as the cohort. Do not filter by participating factions. Other components remain unused.                            |
| Successful placement                 | Available component → placed stronghold, with its identity public. Increment the turn's committed placement count and pay its new value. Costs for three placements are 1, then 2, then 3 (total 6), not three payments of 3.                                          |
| Declined trigger                     | Keep the placed component and cohort unchanged.                                                                                                                                                                                                                        |
| Ordinary committed trigger           | Placed component → set aside; mark this exact cohort component triggered once.                                                                                                                                                                                         |
| Ecaz committed trigger               | Return the special Ecaz component to available supply; do not increment the random cohort's completion count.                                                                                                                                                          |
| Bene Gesserit committed trigger      | Mark the BG cohort component triggered, then permanently remove it. Its removal cannot make the cohort impossible to complete. Copying an effect does not transfer the copied component or count that component as triggered.                                          |
| Storm/explosion removal              | Placed component → available supply. Do not count this as a trigger or put it in the unused draw pool. It remains part of the same cohort and can be placed again.                                                                                                     |
| All five cohort components triggered | Return reusable set-aside cohort components to the unused pool; permanently removed BG stays removed. Draw five distinct components from the resulting unused pool, replace the cohort, and reset its trigger history. Ecaz remains separate wherever it currently is. |

The completion condition is **all five original random components**, not five available components, an empty hand, five placements, or five effect invocations. With BG removed, the next draw still contains five from the nine remaining non-Ecaz components. Recycling happens after the fifth effect settles; a nested effect must not see its copying/trigger record replaced prematurely. Random sampling belongs only to setup and that committed recycle transition, never a view, preview or failed action.

These requirements follow the publisher's separate supply, set-aside, return, and permanent-removal instructions. [GF9 E3, p. 7](https://www.gf9games.com/dune/wp-content/uploads/EcazMoritani-Rulebook-LOWRES.pdf#page=7) A strict original-cohort interpretation of BG's outside-supply copy pool is supported by the past-tense setup reference, but the precise copy eligibility remains separately flagged above; inventory should preserve both cohort and current zones rather than prematurely choose that effect policy.

### Placement/projection boundaries for the next slice

Placement requires an available component, an ambassador-free stronghold outside storm, sufficient Ecaz spice, and the end-of-Revival opportunity. The printed rule does not require Ecaz forces there or an empty stronghold, and it does not grant relocation of a placed token. Other-player forces alone therefore do not invalidate placement. A stronghold with any Ambassador already there remains ineligible. Return from destruction does not refund the old fee or undo this turn's placement count.

The Karama table prevents further Ambassador placement for the turn; it does not authorize removing previously settled tokens. Preserve the phase-scoped prevention stamp through reload, and leave a prevented pending placement's token and spice uncommitted. The exact reaction-before-payment serialization is the proposed software mechanism, not a separate printed announcement-timing clarification. [GF9 E3, p. 16](https://www.gf9games.com/dune/wp-content/uploads/EcazMoritani-Rulebook-LOWRES.pdf#page=16)

**Projection contract now justified:** every viewer can see each placed token's location and faction/effect identity. Ecaz can inspect its own available supply and choose a component. This audit found no authoritative secrecy instruction for unplaced supply, but the face-up-placement sentence alone does not settle that zone. A partial internal model can expose public placed identities and keep the remaining state policy explicit; do not certify hidden supply as printed compliance or activate a full game on that unresolved assumption. If unused/drawn identities are withheld, stable IDs must not leak them through previous-cycle IDs, draw order, or public previews.

Tests should distinguish BG removal as the first versus fifth trigger, destroyed/replaced members, repeated Ecaz triggers, fifth-trigger JSON replay, absent factions in the initial pool, an Ecaz token still on the map during recycling, zero RNG on invalid placement/read, and public placed identity versus any explicitly selected supply policy. Scope gates remain intact.

### Remaining supply visibility and closing-market order

The bounded follow-up found no designer sentence specifically addressing the unplaced six-token supply. A **public available supply** is a reasonable default-open interpretation: base secrecy identifies cards, spice and traitors, while E3 expressly calls Terror hidden and the designer expressly makes placed Ambassadors face up. That is an inference from the absence of an Ambassador secrecy rule, not the same evidence as an explicit supply instruction. Concealing the supply is not established either. Do not conflate unused-pool orientation during random selection with the selected supply's visibility. [Base rules, p. 12](https://www.gf9games.com/dunegame/wp-content/uploads/Dune-Rulebook.pdf#page=12), [designer clarification](https://boardgamegeek.com/filepage/263742/ecaz-and-moritani-rules)

No retrieved primary rule orders Ecaz's end-of-Revival placements relative to CHOAM's phase-end card liquidation. **No direct Ecaz funding or placement-price discrepancy was found in the current market implementation:** liquidation pays CHOAM itself, not Ecaz; the ally exchange swaps cards, not spice. Ordinary shipment/bidding aid is not permission to finance Ambassador placement. Thus do not manufacture a material Ecaz-spice dependency from a supposed sale of Ecaz's cards to CHOAM. [CHOAM rulebook, p. 7](https://www.gf9games.com/dune/wp-content/uploads/2021/11/CHOAM-Rulebook-low-res.pdf#page=7)

The existing market's card exchange can nevertheless change access to a Karama or Worthless-as-Karama before a placement response. Consequently the chosen closing-window order should be documented and preserved through continuations, without claiming an explicit combined FAQ priority. It must not reset `placedThisTurn` or reopen an already completed placement opportunity. No new funding exception or phase transition is justified by this audit.

### Implemented projection and closing order: clarification

The current `viewGame().ambassadors` projection exposes all eleven tokens with their effect and zone. Placed-face visibility is supported by Jack Reda's direct 26 August 2023 clarification on the rulebook upload. Visibility of available supply and unused pool is the explicitly selected **default-open implementation policy**, inferred from the absence of an Ambassador secrecy rule; it is not an additional official supply FAQ. The in-app `ecaz-ambassadors` topic now states that distinction. [Designer clarification](https://boardgamegeek.com/filepage/263742/ecaz-and-moritani-rules), [base secrecy, p. 12](https://www.gf9games.com/dunegame/wp-content/uploads/Dune-Rulebook.pdf#page=12)

The implemented phase departure is `nextPhase` → CHOAM market when present → `advancePhase` / `settleTechIncome` → Ecaz placement → `completePhase`. This is a software composition of end-of-phase obligations, **not a combined publisher FAQ priority**. Ambassador placement is anchored at the end of Revival, while the market has its phase-end timing. Neither retrieved passage explicitly orders the two or their relationship to deferred technology income. [Ecaz placement, E3 p. 7](https://www.gf9games.com/dune/wp-content/uploads/EcazMoritani-Rulebook-LOWRES.pdf#page=7), [CHOAM market, p. 7](https://www.gf9games.com/dune/wp-content/uploads/2021/11/CHOAM-Rulebook-low-res.pdf#page=7)

Deferred technology income is a real funding distinction from the market discussion above: an Ecaz player who owns an income-bearing Axlotl token can receive that deferred spice before paying for an Ambassador in the current sequence. The market itself still does not purchase Ecaz's cards or directly transfer CHOAM liquidation revenue to Ecaz. The rule topic explicitly says that collected income can fund placement without presenting the combined priority as settled source law.

`tests/ecaz-placement.test.ts` verifies the market-before-placement continuation and once-only placement payment. That proves the implemented sequence, not official ordering precedence. Existing source gaps and full-start gates remain; this clarification neither activates Ambassador effects nor certifies destruction hooks, Occupy, or the complete expansion.

## Entry implementation checkpoint (2026-09-06)

The earlier placement-only checkpoints above are historical. The current engine/UI/AI implements Emperor, Atreides, Harkonnen, CHOAM and Ixian effects plus BG copies to those effects. Private inspection snapshots have no blocking acknowledgement; ally card choices belong to the beneficiary. Five-token replenishment occurs only after the last effect settles. Exposed city storm and actual Lasgun–shield explosion return tokens without triggering them. See ECAZ_AMBASSADOR_EFFECTS_AUDIT.md for source precedence, exact supported contracts and unresolved combinations.

Tests: ecaz-entry (13), ecaz-entry-continuations (5), ecaz-entry-bots (6) and persisted ecaz-entry-recovery (6), in addition to inventory/placement tests. No full Ecaz game is enabled or certified.
