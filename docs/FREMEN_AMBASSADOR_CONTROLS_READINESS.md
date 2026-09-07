# Fremen Ambassador controls and AI readiness

Historical design review. The implemented contract and final validation supersede the proposals below: [FREMEN_AMBASSADOR_IMPLEMENTATION.md](FREMEN_AMBASSADOR_IMPLEMENTATION.md).

Reviewed 2026-09-07. This document specifies a bounded control contract; it does not enable gameplay or change rules. Root owns the engine and the parallel primary-source reviewer owns the final rules compositions.

## Confirmed direction and remaining source limits

The source reviewer confirms a group of the beneficiary's forces from one territory, including a positive selection across that territory's sectors, relocating directly to a legal territory. Source and destination sectors must be clear of storm. Same-territory redistribution can combine sectors but may not be an unchanged-location identity action. Ordinary ground adjacency and range do not constrain this effect. Ecaz's initial trigger is optional; no second optional decline after triggering is printed. Preserve ordinary shipment, movement, Hajr and Ornithopter bookkeeping.

The underlying authority is the Fremen entry on printed p.8 of the [GF9 Ecaz & Moritani rulebook](https://www.gf9games.com/dune/wp-content/uploads/EcazMoritani-Rulebook-LOWRES.pdf#page=8), with entry interruption and BG interactions in its FAQ. See [ECAZ_AMBASSADOR_EFFECTS_AUDIT.md](ECAZ_AMBASSADOR_EFFECTS_AUDIT.md) for the earlier source record. The source reviewer supports same-territory sector redistribution as a composition: the November 2020 FAQ p.2 calls sector-to-sector relocation movement, and the Ambassador says any territory rather than a different territory. Require actual location change; do not emit a new territory-arrival event for it. There is no support here for an empty move without a marker or a post-trigger stay/decline action; do not copy those controls from the worm-ride UI.

The source reviewer recommends a consumed trigger with no legal effect as the same unavailable-effect interpretation used in the preceding Richese slice. No printed general failed-effect clause was found, so this is a documented composition, not a new quoted Fremen FAQ. When adopted, it moves no forces and changes no movement counters. An automatic no-choice result must be derived from the actual legal move set, not from the bot failing to find a candidate.

## Current reusable pieces

| Source                                                   | Useful existing behavior                                                                                 | Do not inherit unchanged                                                                                           |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `components/game-table.tsx:610` destination controls     | `gameTerritories(g)` and each territory's real sectors, including placed mobile stronghold and sector 0. | The parent's selected destination and source may belong to the entrant's unrelated ordinary move.                  |
| `components/game-table.tsx:3450` physical movement draft | One source territory, per-sector physical counts and per-sector elite counts.                            | Reserve shipment, paid Guild quotes, ordinary move counters, No-Field checkbox without a new binding contract.     |
| `components/game-table.tsx:2713` worm ride               | A compact special-movement panel with multiple source sectors.                                           | Fremen-only labels, fixed worm origin, `accept:false`, or “Stay in this territory”; those belong to the worm rule. |
| `components/ornithopter-movement.tsx:16`                 | Separate component owns its draft and explains unavailable selections.                                   | Card escrow/cohort, range mode, old advisor limitation, or consuming the flight.                                   |
| `game/engine.ts:5696` `forceGroup` / `eliteChoice`       | Physical quantities, one-territory grouping and selected elite minimum/maximum.                          | Flat No-Field event field conflicts with the Ambassador event; see below.                                          |
| `game/bot-mobility.ts` `botEntryAllowed`                 | Public storm, occupancy and advisor-aware destination checks.                                            | Treating it as a complete authoritative special-effect quote; it omits future entry reactions.                     |
| `game/board.ts:24` `gameTerritories` / `validLocation`   | Current board shape and sector validation.                                                               | A fabricated map, hardcoded 18 destinations, or unplaced mobile stronghold.                                        |

Line numbers locate the reviewed snapshot; named functions are stable anchors. `guildTransportQuote` also contains correct physical/elite count arithmetic, but its paid-shipment availability, active-seat requirement, reserve transport and funding fields are inappropriate here. `botGroundMoveAllowed` imposes ground distance and Baliset routing and cannot be the Fremen relocation filter.

## Smallest matching saved and projected contract

Add `stage: 'move'` to the existing Ambassador entry and set its decision owner to the beneficiary, not `g.active`. Keep the same event, original owner/entrant/token/territory, frozen BG-copy cohort and original `resume` continuation. These fields represent the already committed arrival and token; moving the beneficiary must never replay them.

Expose a beneficiary-only descriptor under `ambassadorEntry`:

```ts
movement: {
  sources: {
    territory: string;
    sectors: { key: string; forces: number; elites: number }[];
    marker: { tokenId: string; event: string; sector: number } | null;
    destinations: { territory: string; sector: number }[];
  }[];
} | null;
```

This is a proposed API, not an existing field. The server's special relocation helper should produce this finite domain. Each source lists available physical sectors, any controller-owned eligible concealed marker, and its source-sensitive legal destination sectors. The marker receipt never includes denomination. If a supported choice changes destination legality, such as advisor stance or a No-Field, represent that explicitly rather than claiming one destination list is valid for every variant. Quantities remain chosen by the beneficiary; the descriptor need not enumerate all possible force subsets.

A compact command reuses familiar physical payload fields:

```ts
{
  type: 'decision', event,
  forces: { 'source-territory:sector': count },
  eliteForces: { 'source-territory:sector': eliteCount },
  noField: { tokenId, event }, // optional, separately bound from entry event
  territory: destinationTerritory, sector: destinationSector
}
```

Validate positive physical total or a selected concealed marker, safe integral quantities, current physical/marker custody, source territory and sectors, typed allocation and destination again at commit. Use each sector's elite bounds: minimum `max(0, selected - (available - eliteAvailable))`, maximum `min(selected, eliteAvailable)`. Elite values are part of the total, not additional forces. Do not assume a zero-elite selection is legal when all selected forces must include elites.

The descriptor should be null for every other seat, including Ecaz when the ally is resolving. Source forces, advisor stance and ordinary elite counts are already public, but the descriptor still belongs to the actual chooser and should not become a future private-state oracle. Ecaz's initial ally options must not depend on a private marker value, card availability or hidden promise. No deck, hand, pending private answer or automatic suggested command is projected.

## UI behavior

Use a dedicated movement branch inside `EcazEntry` or a small child keyed by `entry.event`. Explicitly allow the new stage through the current component's offer/copy/cards guard; otherwise it will be hidden. Keep income/bonus response stages excluded.

1. Select one source territory from the authoritative descriptor. Show each eligible sector's available physical and elite forces.
2. Enter physical counts with bounded elite controls. Display the combined physical total. Reset or clamp stale counts when source/event changes; never carry an unrelated ordinary movement draft into this decision.
3. Select an allowed destination territory, then one of its permitted sectors. Use canonical names and map data. A clear sector of a partly storm-covered territory must remain selectable; sector 0 is not a storm sector. For a non-Ixian beneficiary entering the mobile stronghold, the source must be the territory it points to, as confirmed by the source reviewer from Ixians/Tleilaxu p.9. An Ixian may enter its own stronghold; moving forces never moves the stronghold marker itself.
4. Provide “Relocate selected forces” with at least 44-pixel target size, busy disabling and an accessible reason for incomplete or stale selection. Do not provide payment, reserve, movement-card, Hajr, route-length or post-trigger decline controls.

A map click can update the destination but cannot submit automatically. Keyboard-select controls remain available, and an impossible map selection should give a clear explanation. Reuse card/token inspectors and show that this special relocation leaves the ordinary movement allowance unchanged. The UI should not itself auto-submit a no-choice result; normalizer/engine continuation owns any agreed automatic completion.

## Advisors, elites and concealed No-Fields

Typed forces can use the ordinary physical-count schema for every faction, not only Fedaykin. The server must preserve exact selected normal/elite counts and board conservation. Ordinary Fremen two-territory speed and Ixian cyborg speed do not alter this direct relocation.

For BG, reuse the source/destination stance semantics of `arrivalAsAdvisor`, `isAdvisor`, locked-turn restrictions and `settleAdvisors`. A destination with advisors can differ from one with fighters; a UI filter must not blindly apply the three-faction fighter cap to advisors. Do not add an optional fighter-flip checkbox until its timing is included in the server contract. A flip, intrusion or other reaction requires an explicit child continuation; it must not overwrite the suspended Ambassador frame.

A concealed No-Field is one effective presence but is not a physical force: `presenceAt` and `presenceByLocation` deliberately differ from `p.forces`. Do not manufacture a physical quantity from the marker's presence or reveal its hidden value. The source reviewer verified that a No-Field moves like a force (CHOAM/Richese p.6), including a zero-valued marker that counts as one presence (p.10). Support controller-selected marker-only and mixed physical/marker groups; display physical count and marker separately. Do not gate eligibility using its hidden denomination.

Use a separate nested marker receipt such as `{tokenId, event}`. The current ordinary `forceGroup` interprets flat `action.event` as No-Field custody, but the Ambassador command already uses that field for its own entry event. Reusing it unchanged would reject valid movement or bind the wrong event. Zero physical count plus a selected marker is a valid marker-only selection; neither selected is an empty move. Preserve the marker's hidden value and ordinary allowance and project marker identity/custody only to its controller.

## AI and zero-choice behavior

Add an explicit `entry.stage === 'move'` branch before the current card-selection tail. All four profiles consume the same beneficiary-only domain. Filter legal destinations before truncating candidates, choose quantities with valid elite minima, and choose no source outside the authoritative source list. The worm fallback's Fremen-only source and final `accept:false` must not be copied.

For a bounded initial policy, consider one or more complete physical groups from each legal source and rank destinations by public stronghold occupancy, visible opposing fighters, accessible spice and the bot's own remaining position. Preserve valuable source occupation rather than invariably abandoning a winning stronghold. Easy may use deterministic variation among legal candidates; stronger levels can compare public outcomes. None should read another player's hidden hand or leader commitments, a No-Field value, or trial arbitrary rejected moves through the engine.

If there are no actual legal moves, do not invent an empty movement or decline action. The engine must apply the separately agreed no-effect continuation, or report an explicit unsupported boundary before enabling this effect. Public-only physical source/destination checks can support a privacy-safe automatic no-choice result. Hidden card, marker-value or private-promise-dependent suppression needs separate review; merely opening or skipping a public window can leak those facts. A legal move hidden by a truncated AI search is never an engine no-choice case.

## Mandatory integration boundaries and focused evidence

`completeMove` cannot be called unchanged: it finishes shipment promises, sets `shipped`, increments `moved`, mutates an active Ornithopter cohort and may consume its escrow card. The special effect needs only the shared validated board relocation and its appropriate arrival consequences. Preserve the suspended ordinary move/shipment, Hajr, Guild/Sapho order and any active flight state.

Arrival to BG or Terror must follow the existing entry scheduler or remain explicitly gated before mutation. The source reviewer notes that a second Ecaz Ambassador cannot trigger on this relocation: the mover is Ecaz or its ally, both excluded by that Ambassador entry predicate. Do not build an unnecessary second-Ambassador choice. BG advisors remain excluded from Ambassador triggers but can trigger Terror. `intrusion` writes `g.decision`, so preserve the suspended parent when creating actual child reactions. No new board shape or generic reaction suppression should be introduced to make the interface work.

Required focused coverage: real entry and BG-copy selection; owner/ally chooser authorization; multi-sector partial selection; elite-minimum allocation; storm source/destination and sector-0 immunity; source-sensitive advisor occupancy; unplaced/placed mobile destination and non-Ixian pointing access; marker-only including zero denomination and mixed groups without private-value disclosure; unchanged ordinary counters/flight escrow; physically conserved special move; nested-arrival recovery or preserved explicit gate; no-legal-move continuation under the agreed policy; all four profiles and paired private-state perturbations. JSON reconnect, stale event and duplicate CAS must relocate exactly once and resume the original entrant once.

No runtime, test or package files were changed by this review.
