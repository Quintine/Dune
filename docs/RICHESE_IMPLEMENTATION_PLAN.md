# Richese implementation plan

Audit date: 2026-09-06. Scope: classic GF9 2019 Dune with CHOAM & Richese, including relevant official clarifications and later-expansion interactions. This is a developer plan. It does not certify the faction, its component inventory, or any currently gated game mode. Only this document is changed by this audit.

## Authority and retrieval

- **R2:** [Publisher CHOAM & Richese rulebook](https://www.gf9games.com/dune/wp-content/uploads/2021/11/CHOAM-Rulebook-low-res.pdf): printed p.4 setup/replacements/special Karama; p.5 Richese setup and auctions; p.6 No-Field/alliance/advanced powers; pp.10–11 built-in FAQ; p.12 cancellation table. Targeted searches retrieved the publisher's indexed page text. Direct opening returned HTTP 403. The existing `/tmp/dune-rules/choam-primary.pdf` is an HTML failure, not a verified PDF. No card-face or leader-disc reading is claimed.
- **F20:** [Publisher November 2020 FAQ](https://www.gf9games.com/dune/wp-content/uploads/2020/11/Dune-FAQ-Nov-2020.pdf), especially p.3 advanced Karama. It predates Richese and supplies general rules, not authority for novel Richese exceptions. Earlier April 2020 answers are superseded where November revises them.
- **B19:** [Publisher classic rulebook](https://www.gf9games.com/dunegame/wp-content/uploads/Dune-Rulebook.pdf), especially p.14 advanced Karama. Use ordinary rules where the expansion supplies no exception.
- **R3:** [Publisher Ecaz & Moritani rulebook](https://www.gf9games.com/dune/wp-content/uploads/EcazMoritani-Rulebook-LOWRES.pdf), printed p.14 No-Field/Terror questions and p.10 homeworld framework. Retrieved indexed publisher text. Its specific combined-expansion rulings apply when the corresponding module is enabled.
- The [designer's expansion page](https://futurepastimes.com/dune-choam-richese) identifies the relevant product and links its rules. Its rules/FAQ shortlinks returned 403 during this audit. No newer standalone official Richese errata was verified; that is a retrieval limitation, not proof none exists. Search-engine publication timestamps do not establish the rulebook printing date.

Precedence: explicit applicable official correction/FAQ, then the applicable expansion instruction, then the ordinary classic rule. Record a conflict rather than silently choosing a tournament amendment. Search results included rewritten community and tournament Richese variants; these are excluded. In particular, do not import extra No-Field denominations, extra starting board pieces, expanded cache inventories, or replacement faction powers from them.

## Compact rule anchor

R2 pp.4–6,10–12 establish: setup uses 20 reserves, 5 spice, 2 free revivals, 10 cached cards outside the hand, and No-Fields 0/3/5. Cache auctions replace a normal lot; first/last is declared before Ixians. Once-around allows one ascending bid per participant; Silent uses sealed bids with storm-order ties. Zero bidding offers keep/remove. Sales route income by seller/buyer; Karama acquisition is excluded. Advanced Black Market sells a concealed hand card before declaration. Allied benefits include immediate-reveal No-Field shipment and hand-card gifts. Special Karama privately purchases cache technology for 3 spice. No-Fields cost a one-force shipment, count as one before revelation, cannot coexist or repeat consecutively, and materialize from reserves. Battle revelation constrains prescience; storm/worm exposure reveals them. Cancellation covers cache auction, No-Field shipment and Black Market. FAQ checkpoints cover Harkonnen bonuses, Ixian replacement provenance, reserve-limited dials, zero-token battles/collection, allied shipping payments, tech income, Gamont, Smuggler, Juice of Sapho and Nullentropy. Richese occupation affects Fremen's final victory. Complete face text remains unverified. [R2](https://www.gf9games.com/dune/wp-content/uploads/2021/11/CHOAM-Rulebook-low-res.pdf)

The special-power wrapper consumes a Karama and is once per game in advanced play. Its faction-specific acquisition is distinct from ordinary Karama auction acquisition. [B19 p.14](https://www.gf9games.com/dunegame/wp-content/uploads/Dune-Rulebook.pdf), [F20 p.3](https://www.gf9games.com/dune/wp-content/uploads/2020/11/Dune-FAQ-Nov-2020.pdf)

No-Field entry can trigger Moritani Terror, including the zero token; revealing already-present forces does not itself constitute new entry. Homeworlds require their own location semantics rather than assuming every destination is a territory. [R3 pp.10,14](https://www.gf9games.com/dune/wp-content/uploads/EcazMoritani-Rulebook-LOWRES.pdf)

## Repository baseline

Inspected `game/catalog.ts`, `game/cards.ts`, `game/engine.ts`, `game/bots.ts`, `game/karama.ts`, `game/faction-reference.ts`, `game/reference.ts`, and existing component/status ledgers.

| System | Current evidence | Required work |
|---|---|---|
| Catalog/setup | Richese has a catalog entry with spice 5 and revival 2; `newPlayer` creates ordinary reserves. | Add a complete faction setup contract and validated component instances. Catalog metadata is not implemented faction support. |
| Leaders/traitors | `leaders('richese')` has no roster and therefore supplies no discs. | Five verified named discs, strengths, matching traitor identities and setup filtering. |
| Treachery | `Card` lacks an edition/cache-origin model; `treacheryDeck` rejects later expansion decks. | Richese inventory and transitions between cache, auction, hand, discard and removal. |
| Auctions | `Auction` has a single ordinary bid/opener/pass model. `setAuction` immediately computes the normal/Ixian pool. | A phase-level schedule above individual lots and independent auction modes. |
| Purchase completion | `settleAuction`, `continueAuctionSale`, `auctionBonus`, `nextAuction` assume standard-lot continuations. | Explicit provenance, income recipient, replacement eligibility, bonus and resume policies. |
| Board state | `forces` is a public physical-count map; movement, `fighterCount`, collection and victory consume it. | A separate concealed component and shared queries; do not represent a hidden marker as an ordinary force. |
| Battles | Plans use ordinary physical force availability and standard prescience fields. | A pre-reveal availability adapter and atomic marker/plan revelation. |
| Victory | Fremen's Tuek filter currently names Atreides/Harkonnen/Emperor only. | Audit this filter alongside concealed occupation and all expansion additions. |
| Controls/reference/AI | No Richese-specific engine branch, faction-reference entry or bot decision implementation found. | All six columns of the coverage ledger: rule, engine, control, projection, AI, verification. |
| Availability | Full expansion starts remain gated. | Preserve the gate until full inventories, interactions and complete-game acceptance pass. |

## Component acquisition checklist

Do not create placeholder gameplay cards or guessed leader strengths to make a room start.

| Inventory | Verified extent | Still needed |
|---|---|---|
| Leader discs | Faction-set count established; no legible complete roster acquired. | Five slots remain **name unverified / strength unverified**. The introductory mention of Count Ilban Richese is not sufficient evidence for a printed disc. |
| Technology cache | Aggregate count and separate location established; FAQ names are evidence for specific components. | All faces, physical quantities, faction/expansion marks, complete gameplay wording and official corrections. |
| FAQ-named technology | Juice of Sapho, Nullentropy Box, Portable Snooper appear in retrieved publisher questions. | Their complete printed effects and quantities remain unverified. A question about an interaction is not the full card definition. |
| Other cache entries | No complete primary-source face inventory retrieved. | Acquire and identify remaining faces before assigning stable IDs; do not fill the list from fan implementations. |
| No-Field pieces | Denominations established in the rule anchor. | Front/back visual inspection, original artwork, and verified replacement/retirement state. |
| Prediction/traitor additions | Expansion-family inventory exists in the component ledger. | Map every physical target and absence rule to validated faction rosters. |

Developer inventory records should carry `physicalId`, `faceId`, `edition`, `expansion`, `sourcePageOrFace`, `verificationStatus`, and corrected-effect provenance. These are content-production fields, not information automatically sent to players. The player card inspector must receive only authorized component faces.

## Proposed architecture and staged delivery

The contracts below are software proposals derived from the current engine's gaps. They are not additional tabletop rules. Numeric eligibility, payment and timing policies must be bound to the indicated source checkpoints and resolved questions before their corresponding mode is enabled.

### 1. Auction schedule and card custody

Add a `BiddingSchedule` above `Auction` with a persistent queue and cursor. Each lot needs a unique ID, `origin: normalDeck | richeseCache | richeseHand`, seller, public/private face policy, auction method, eligibility snapshot policy, payment policy and exact continuation. Distinguish a card's printed family from the transaction that is selling it. A later sale of a formerly cached card cannot be identified from `Card.kind` alone.

Proposed checkpoints are `richeseBlackMarketOffer`, `richeseAuctionDeclaration`, `richeseCacheSelection`, `richeseAuctionMethod`, `richeseZeroBidDisposition`, `normalPoolPreparation`, and ordinary lot settlement. Save a typed continuation instead of using `nextPhase()` as the fallback for all empty or canceled lots. Freeze only the information a rule actually commits; do not accidentally expose a future cache selection through the public schedule.

Refactor `setAuction` into schedule construction and normal-pool preparation. Keep the existing Ixian inspection/substitution implementation as a subordinate continuation. Before drawing anything, establish which normal-pool cardinality the schedule requires. After a lot settles, run the applicable replacement, income and Harkonnen continuations exactly once, then resume the scheduled next checkpoint. An all-pass result for one origin must not use the ordinary-deck return path for another origin.

A canceled declaration must leave card custody, money and schedule accounting consistent. Store proposed card/payment changes in pending intent; revalidate ownership, hand capacity, alliance and affordability after interruptions. Reuse current optimistic persistence rather than maintaining a second auction state outside `Game`.

### 2. Auction modes and sealed offers

Use a discriminated `Auction` union. The ordinary mode retains its existing opener/pass cycle. A directional mode needs an immutable participant order, position and completed-participant set. A simultaneous mode needs a server-only map of sealed offers, commitment status, offer funding and one atomic reveal/settlement transition. These need dedicated validators; changing an ordinary auction's `active` field is insufficient.

Only the submitter receives its unresolved offer. Other views expose readiness, not bid values, budget limits, missing-card eligibility explanations or AI candidate scores. Reserve required resources without making hidden offers inferable through otherwise public counters. Reconcile interruptions with a deliberate policy; never silently lower a sealed bid after an economic change.

UI should distinguish lot origin, face visibility, decision owner, bidding method, payment recipient and whether a bid is final. Preserve free-text sales claims as player statements, separate from server-verified card identity. Any optional claim text must remain untrusted content. The ordinary minimum-bid control must not be reused for a sealed offer without its own zero/maximum handling.

### 3. No-Field representation

Proposed state: an opaque component ID, controller, selected denomination in server/private state, board location, last-used denomination and pending reveal cause. Do not subtract and then invent replacement forces solely to satisfy existing `forces`-map consumers. Keep physical-piece conservation independent of effective board presence.

Introduce a shared board-presence interface rather than scattering Richese conditions through `at`, `fighterCount`, `collect`, victory, transport, storm and worm handlers. Queries should separately answer occupancy, entry blocking, collection capacity, currently materialized forces, selectable movement objects, legal battle participation and reveal requirements. Review every direct `Object.entries(player.forces)` consumer.

A public projection may expose an opaque hidden-marker identity and its location without encoding its denomination in the ID, ordering, DOM attributes or error text. The owner receives legal private choices. Do not expose an unplayed secret through a public reserves preview, battle dial maximum, path-cost estimate or the bot's search result.

All reveal causes should enter one materialization function with a typed cause and resume target. That function must settle the token, reserve transfer, casualty/return calculation and visibility once, then continue the interrupted phase. Persist the continuation before asking for any other faction's response. Test a reload at every suspension point.

### 4. Battle integration

Add an availability adapter consumed by both `validatePlan` and the private plan generator. It must distinguish board presence from physical forces committed, and preserve legal leader/card plans even when an ordinary `count > 0` shortcut would reject the combatant. Audit advanced spice support, traitor branches, explosions, captured leaders, Face Dancers and legal-plan promises through this adapter.

Model the marker reveal as part of the proper battle-reveal checkpoint, not as a private client-side animation. Both sealed plans and the reveal must be resolved from the same committed server version. Atreides prescience, full-plan special Karama and Truthtrance require an explicit information policy; the ordinary UI must not offer a field the server will refuse to reveal.

### 5. Alliance, special Karama and cancellation continuations

Use explicit owner decisions for permissions; an ally must not be able to choose or consume another player's secret token or cache card without authorization. For a gift, stage donor/recipient/card intent, check hand capacity and exact custody at settlement, then invalidate only affected private hand selections. Existing battle commitments and interrupted Truthtrance must remain enforceable.

Represent the special purchase as a card-acquisition transaction with private selected identity, payment intent, Karama custody and once-per-game usage. Use the existing `specialKaramaUsed` discipline, but keep normal auction acquisition and special purchase as separate action variants. Test full hand, empty cache, unavailable payment and an interrupted selected card without charging partial costs.

Proposed response IDs are `richeseAuction`, `richeseNoField`, `richeseBlackMarket` and separately named allied benefits if the governing general cancellation rule permits them. A response stores its exact resumption checkpoint and cancellation scope. It must not cancel previously completed effects, disclose a concealed selection, or call `nextPhase` merely because an optional transaction was prevented.

### 6. AI and internal reference

Every new decision gets explicit Easy/Medium/Hard/Brutal handling through the authorized `GameView`, including pass/decline and zero-result disposition. No bot may read the server cache, unrevealed offers, another owner's marker value or future deck order. Give all levels legal fallbacks; vary strategic choice only after basic legality and full-game completion are demonstrated.

Add internal topics for auction methods, each verified cache face, marker inspection/revelation, allied permissions and cancellation. Present the same original gameplay text at ordinary and enlarged card sizes. Link internally to timing and interaction explanations. Developer provenance belongs in this document and the component ledger, not in external player-facing links.

## Source checkpoints that still need exact policy decisions

| Checkpoint | Question to settle before coding that interaction | Source target |
|---|---|---|
| Empty cache / no eligible buyer | What happens to pool accounting and declaration when no valid cache lot or buyer remains? | R2 p.5; primary clarification still needed. |
| Sealed-offer accounting | Exactly when are resources locked/released; how do simultaneous affordability changes and ally funding interact? | R2 p.5 plus ordinary bidding/alliance rules. Do not introduce an all-pay auction. |
| Full-hand seller / zero result | Is acquisition available, or only removal, when the seller cannot legally add a card? | R2 p.5 and normal hand limits. |
| Declaration versus reveal | Which fields commit before normal-pool preparation, especially for a later cache lot? | R2 pp.5,11. |
| Black Market self-purchase | Can seller bid on its own lot, and how do payment and zero-result policies differ from a cache lot? | R2 p.6; do not infer from a tournament rewrite. |
| Canceled lot count | Does prevention restore a normal lot, and which prior count commitments remain fixed? | R2 pp.5,6,11,12. |
| Income cancellation | Is sale income a separate cancelable advantage, or only sale declaration? | R2 p.12 plus general Karama rules. |
| Reserve shortage at destruction | How does a forced reveal with insufficient reserves calculate losses and subsequent effects? | R2 p.6; distinguish ordinary battle capacity from destruction. |
| Voluntary revelation timing | Does the phrase bounding voluntary revelation exclude all Battle substeps outside the mandatory reveal? | R2 p.6. |
| Additional forces with a marker | How do mixed ordinary forces, movement groups, existing occupancy and zero materialization interact? | R2 pp.6,10–12, including the Smuggler question. |
| Information overrides | Does full-plan special Karama override the specific dial restriction? What can a structured Truthtrance legally ask? | R2 p.6; B19/F20 prescience and special Karama. |
| Acquisition promises | Can a card acquired by a special purchase or ally gift satisfy an already binding battle answer? | Existing `battle-promises` feasibility search plus relevant card timing; unresolved. |
| Zero marker interactions | Enumerate collection, occupation, battle, Gamont and later Terror separately; do not treat “zero” as an absent component. | R2 pp.10–11; R3 p.14. |
| Cache face effects | Acquisition/discard exceptions, timing, targeting, retention and stacking for every physical card. | Printed faces still missing. |
| Optional modules | Leader skills, strongholds, homeworlds, Nexus and discoveries must not inherit territory assumptions accidentally. | R2 pp.9–12; R3 relevant module and FAQ pages. |

## Verification and acceptance

| Suite | Minimum meaningful checks |
|---|---|
| Setup/inventory | Exact physical identities and quantities; no cache duplication into opening hands/deck; absent-faction filtering; saved-state round-trip. |
| Bidding schedule | Every method and position; cache versus hand origin; full/empty/short pools; canceled optional/mandatory transactions; normal-pool cursor restoration. |
| Payments | Balance and escrow conservation; seller/recipient routing; self-purchase; explicit payment interruption; no unauthorized Karama acquisition. |
| Private offers | Two independent player views before/after commitment and reveal; no leaked bid values or indirect budget evidence. |
| Acquisitions | Ixian replacement and Harkonnen bonus tested by transaction origin, including a later sale of a cache-family card. |
| Marker movement | Legal/illegal destinations, token reuse, simultaneous presence limits, mixed groups, ally consent/payment, storm and interruption recovery. |
| Materialization | Force conservation across all reveal causes, limited reserves, zero component, linked casualties/returns and replayed requests. |
| Combat | Sealed plans, information restrictions, zero-force participation, support, traitors, explosions, battle aftermath and promises. |
| Combined expansions | Explicit R2 FAQ cases; R3 Terror entry/reveal distinction; skills/homeworlds and shared continuation ordering. |
| Persistence/AI | Optimistic conflicts and exact JSON restoration at every decision; all four levels finish representative full games using private views only. |
| Presentation | Inspect every entitled component at normal/enlarged size; concealed backs remain concealed; mobile/keyboard/reduced-motion controls; no external links. |

Suggested delivery order: component/leader verification; lot-origin model and purchase continuations; auction schedule and modes; No-Field representation with shared board queries; reveal/combat and alliance/special-power support; individual technology faces; optional-module interactions; complete-game and visual acceptance. Keep independently tested internal slices gated until their aggregate requirements are complete.

Validation for this audit: read-only source/code inspection and primary-source lookup. No engine, UI, AI, test behavior, game state or mode availability was changed. No complete Richese game is claimed.
