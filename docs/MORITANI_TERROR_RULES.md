# Moritani terror rules and components

Audit: 2026-09-06. Scope: the six Terror tokens, setup, placement, entry reactions and continuing effects. Initial audit made no runtime edits; see the implementation checkpoint below. This is an implementation contract with explicit evidence limits, not certification that the faction is playable.

## Evidence and revision boundary

- **E3:** [GF9 Ecaz & Moritani rulebook](https://www.gf9games.com/dune/wp-content/uploads/EcazMoritani-Rulebook-LOWRES.pdf), printed pp. 3–6, 14, 16. Publisher-indexed text verified setup/placement/Assassination/Atomics on p. 5 and the official built-in FAQ/Karama answers on pp. 14 and 16. Direct download currently returns 403.
- **E3-M:** [Readable publisher-authored rulebook mirror](https://gamers-hq.de/media/pdf/0f/7a/86/Dune_EcazMoritani_Rulebook_EN.pdf), same printed anchors. The existing local PDF was extracted and its printed pp. 3 and 6 rendered and visually inspected. This supplies the full p. 6 effects and printed disc evidence. It is primary publisher-authored content hosted by a retailer, not retailer-written rules.

E3 and E3-M agree on the Moritani passages compared in this pass. A known Ecaz Occupy example differs between these files, so this audit does not assume identical revisions globally. No fan amendments, video reconstructions or purported extra FAQ rulings were used. Page anchors below refer to printed pages.

## Setup and inventory

Moritani sets up after all other factions: place 6 forces in an unoccupied territory, keep 14 in reserves, start with 12 spice and 2 free force revivals. Keep all 6 Terror tokens hidden initially; none is prescribed on the map at setup. [E3, p. 5](https://www.gf9games.com/dune/wp-content/uploads/EcazMoritani-Rulebook-LOWRES.pdf#page=5)

The component list specifies 5 ordinary leader discs, 20 forces, 6 Terror tokens and 1 Atomics Aftermath token for Moritani. Six distinct named effects and token illustrations appear on pp. 5–6: **Assassination, Atomics, Extortion, Robbery, Sabotage, Sneak Attack**. Six total plus those six illustrated identities supports one of each; no separate punchboard was inspected to certify physical backs or printing layout. Duke Prad Vidal is a separate additional disc, not a sixth ordinary Moritani leader. [E3-M, pp. 3–6](https://gamers-hq.de/media/pdf/0f/7a/86/Dune_EcazMoritani_Rulebook_EN.pdf#page=4)

## Placement and entry lifecycle

During Mentat Pause, Moritani may place one hidden token from supply **or** relocate one already placed. The destination must be a stronghold without a Terror token; storm is permitted. The Hidden Mobile Stronghold is excluded. Homeworlds are explicitly excluded by the p. 16 FAQ. No spice cost is stated. The singular place-or-move opportunity does not authorize repeatedly deploying the whole supply in one phase. [E3, pp. 5, 16](https://www.gf9games.com/dune/wp-content/uploads/EcazMoritani-Rulebook-LOWRES.pdf#page=5)

When another faction enters that stronghold by shipment or movement, Moritani may reveal and resolve the token against the entrant. An ally does not qualify; Bene Gesserit advisors do. Ordinary revelation removes the token from the game, with Extortion's express recovery exception below. Declining the optional trigger does not reveal or spend it. Existing occupation alone is not an entry event. [E3-M, pp. 5–6](https://gamers-hq.de/media/pdf/0f/7a/86/Dune_EcazMoritani_Rulebook_EN.pdf#page=5)

The built-in FAQ gives three concrete event distinctions: Terror tokens survive storm and Lasgun/Shield explosions; placing a Richese No-Field can trigger one, including a zero token; revealing a No-Field or replacing forces with Face Dancers does not trigger one. Keep placement and revelation separate in any eventual No-Field implementation. [E3, p. 14](https://www.gf9games.com/dune/wp-content/uploads/EcazMoritani-Rulebook-LOWRES.pdf#page=14)

### Enemy of My Enemy

Before revealing a would-trigger token, Moritani can instead offer an alliance to the entrant, except Ecaz. Acceptance breaks both parties' existing alliances, forms the new one, and returns the token to supply without revealing it. Refusal **requires** revelation: do not offer and then silently fall back to declining the trigger. This is a special alliance opportunity, independent of a Nexus. [E3-M, p. 6](https://gamers-hq.de/media/pdf/0f/7a/86/Dune_EcazMoritani_Rulebook_EN.pdf#page=6)

The Karama table specifically prevents placing/moving a Terror token; it does not list cancellation of its revelation/effect. Separately, Karama can prevent Enemy of My Enemy from forming an alliance, while leaving token revelation available. Do not apply a generic faction response indiscriminately to every Terror effect. [E3, p. 16](https://www.gf9games.com/dune/wp-content/uploads/EcazMoritani-Rulebook-LOWRES.pdf#page=16)

## Effect contracts

The following paraphrases preserve the mechanically necessary conditions from the publisher-authored text and token illustrations. [E3-M, pp. 5–6](https://gamers-hq.de/media/pdf/0f/7a/86/Dune_EcazMoritani_Rulebook_EN.pdf#page=5)

| Token         | Resolution and continuing state                                                                                                                                                                                                                                                                                                                        |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Assassination | Randomly select an entrant's leader, send it to the Tanks, and award Moritani spice for its value; Zoal pays 3. This is not a player-selected victim. The exact exceptional custody pool is not specified here; see gaps.                                                                                                                              |
| Atomics       | Send **all** forces in the territory to the Tanks. Place Aftermath there, permanently prohibiting shipment into that territory, expressly including Fremen. Starting this turn, Moritani's hand limit and its ally's are each reduced by 1; an excessive hand loses a random card. The passage does not prohibit ordinary movement into the territory. |
| Extortion     | Set aside 5 bank spice in front of Moritani's shield, to collect during Mentat Pause. Then return Extortion to supply unless one player, approached in storm order, pays Moritani 3 spice. A payment prevents recovery; it does not replace or cancel the bank's 5. Treat the deferred 5 separately from currently spendable spice.                    |
| Robbery       | Moritani chooses either half the entrant's spice, rounded up, or the top Treachery card. For the card option, draw first; if over the hand limit, Moritani chooses a card to discard. The printed option is not restricted to a non-full hand.                                                                                                         |
| Sabotage      | Randomly draw and discard a Treachery card from the entrant if possible. Afterward Moritani may give that entrant a chosen card from its own hand. The giveaway is optional, not an exchange or payment requirement.                                                                                                                                   |
| Sneak Attack  | Bring up to 5 Moritani reserve forces into that territory for free, respecting storm and occupancy. This explicitly works despite Aftermath. It grants this reserve entry, not a second ordinary movement or a global shipment exemption.                                                                                                              |

Terror Assassination and advanced **Assassinate Leaders** are different abilities. The latter depends on a lost battle, a different traitor identity and per-faction usage; it must not supply the Terror token's random-selection rules. The Karama table saying Assassinate Leaders has no effect refers to that named advanced ability. [E3-M, pp. 6, 16](https://gamers-hq.de/media/pdf/0f/7a/86/Dune_EcazMoritani_Rulebook_EN.pdf#page=6)

## Direct printed leader evidence

All five Moritani discs are readable in the **p. 3 leader illustration** of [E3-M](https://gamers-hq.de/media/pdf/0f/7a/86/Dune_EcazMoritani_Rulebook_EN.pdf#page=3). The adjacent Viscount portrait is the faction portrait, not another valued leader disc.

| Printed name                           | Strength |
| -------------------------------------- | -------: |
| Lupino Ord                             |        5 |
| Grieu Kronos                           |        4 |
| Hiih Resser                            |        4 |
| Trin Kronos                            |        2 |
| Vando Terboli                          |        1 |
| Duke Prad Vidal — separate shared disc |        6 |

The same page explicitly gives Duke Vidal no traitor card. His acquisition, revival and end-turn custody require the separate pp. 6, 8–9 rules before enabling him; printing strength 6 alone does not implement that lifecycle. Local inspection artifact: `/tmp/dune-rules/ecaz-p3-audit.png`, rendered from `/tmp/dune-rules/ecaz-mirror.pdf`. No inferred names or values were substituted.

## Concrete integration boundary

At the initial audit, Moritani had catalog metadata but no Terror state or effects. The subsequent checkpoints below record implemented slices. Keep expansion starts gated until the complete faction and its interactions are verified.

- Persist physical token custody: private supply, hidden map placement, revealed/removed, and Extortion awaiting Mentat resolution. Public map projection needs presence and location, not the unrevealed identity. Stable public tokens should not encode their secret effect in IDs.
- Add an explicit Mentat opportunity and once-per-phase placement marker before advancing. Coordinate with `advancePhase`, `completePhase` and existing CHOAM Mentat handling; reloading must not offer another placement or collect Extortion twice.
- Capture entry cause, actual entrant, territory, original action and suspended follow-ups. `completeMove` and `commitShipment` already invoke Intrusion/advisor and income/storm responses. A new Terror response must suspend these safely rather than overwrite `g.response` or `g.decision`. Include future No-Field placement, not its reveal, and exclude Face Dancer replacement.
- Resolve effect choices and random results transactionally. Retrying an accepted action must not reroll a victim/card. Use the engine's supplied random-selection facility and private card projection; a public opportunity must not reveal the hidden token merely by its response kind or available choices.
- Aftermath requires territory-level shipment validation and a hand-limit function that can see continuing game state. Current `handLimit(p)` only derives the faction's fixed limit, so acquisition, auctions and private `handLimit` projection must share the new modifier.
- Use the existing force-to-Tanks accounting for Atomics, preserving elite/advisor counts, and separate Extortion's bank award from any player's payment. Enemy of My Enemy needs an atomic symmetric alliance change, clearing former partners without losing suspended entry custody.

These are software integration recommendations, not newly asserted publisher timing rules.

## Material gaps and ordinary compositions

| Question                                                                                                      | Status and implementation consequence                                                                                                                                                                                                                                           |
| ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Terror vs. Intrusion, spiritual advisors, ambassadors, Guild income or storm casualties from the same arrival | No complete priority table retrieved. Entry creates the opportunity, but the exact ordering of simultaneous reactions remains material. Do not claim the Ecaz-only interruption FAQ settles every Terror interaction.                                                           |
| Assassination victim pool                                                                                     | Ordinary live owned leaders are the straightforward case. The short paragraph does not resolve captured leaders, foreign Gholas, Duke Vidal custody or unavailable/already-dead discs. Do not silently pool every printed leader identity.                                      |
| Atomics and future allies                                                                                     | The lasting reduction is explicit. Whether it follows Moritani's current ally, permanently marks the ally at detonation, or both after alliance changes is not specified by the retrieved passage. Persist enough history to implement the chosen authoritative clarification.  |
| Extortion and other Mentat events                                                                             | Collection precedes recovery/payment by the printed sequence. Relative order against the turn's placement opportunity and other factions' Mentat effects is not explicit. Returning Extortion and immediately placing it again must not emerge accidentally from handler order. |
| Sabotage recipient hand overflow                                                                              | The normal case frees a slot before the gift. If there was no discardable card or another exceptional capacity change, this paragraph supplies no additional forced-discard procedure.                                                                                          |
| One placement; unrevealed token retained on decline; no normal movement ban from Aftermath                    | Ordinary composition of the singular option, optional trigger and shipment-specific prohibition. These do not need invented restrictions or a hypothetical FAQ before implementation.                                                                                           |

Verification commands: `pdftotext -layout /tmp/dune-rules/ecaz-mirror.pdf /tmp/dune-rules/ecaz-audit.txt`; `pdftoppm -f 3 -singlefile -scale-to 2400 -png /tmp/dune-rules/ecaz-mirror.pdf /tmp/dune-rules/ecaz-p3-audit`; equivalent p. 6 render; `node_modules/.bin/oxfmt --check docs/MORITANI_TERROR_RULES.md`. Source inspection and document formatting only; no runtime behavior tests or live-room actions were performed.

## Additional visual verification: Ecaz native leader discs

On 2026-09-06, a second implementation pass directly inspected the complete rendered printed p. 3 at `/tmp/dune-rules/ecaz-p3-audit.png`, from the same [publisher-authored E3-M rulebook](https://gamers-hq.de/media/pdf/0f/7a/86/Dune_EcazMoritani_Rulebook_EN.pdf#page=3). Both the Moritani discs above and the five Ecaz discs below the Duke Vidal paragraph are legible. This independently confirms the five Moritani names/values recorded above and supplies the following Ecaz native roster:

| Printed name   | Strength | Stable application ID |
| -------------- | -------: | --------------------- |
| Sanya Ecaz     |        4 | `ecaz-0`              |
| Whitmore Bludd |        4 | `ecaz-1`              |
| Ilesa Ecaz     |        3 | `ecaz-2`              |
| Rivvy Dinari   |        3 | `ecaz-3`              |
| Bindikk Narvi  |        2 | `ecaz-4`              |

The adjacent Archduke Armand Ecaz image is the faction portrait, not an additional valued native disc. The separate Duke Prad Vidal disc is strength 6 and the same page explicitly excludes him from traitor cards. He remains outside both generic five-leader rosters until his separate custody/revival lifecycle is implemented. Stable application IDs in this table are implementation identifiers, not printed component text.

`game/cards.ts` now contains the five verified native discs for each faction. Focused roster tests cover names, values, fresh state, stable IDs, selected-faction traitor inventories and Duke Vidal exclusion; the existing base/Ix roster regression remains separate. This component addition does not implement either faction's setup or powers and does not enable expansion starts.

## Setup and placement implementation checkpoint

The engine now initializes six hidden tokens, waits until other setup choices finish and then lets Moritani deploy six forces to a legal unoccupied printed territory. During Mentat it opens one optional placement/relocation decision, preserving the existing bribe/inflation initialization and deferring the no-CHOAM victory check until the opportunity resolves. This ordering is an isolated placement contract; it does not settle the unresolved Extortion/combined-event questions above.

An accepted private declaration opens a generic Karama window. The pending token/destination are server-only, and the public state remains identical for different secret declarations. Allowing commits custody once; cancellation leaves custody unchanged and consumes this turn’s placement opportunity; decline also consumes the opportunity. Ordinary strongholds in storm remain valid targets. Engine and pure-model tests cover JSON restoration, private projections, stale/invalid actions, setup conservation, CHOAM continuation and all four bot profiles.

No entry hook, reveal effect, Enemy of My Enemy, Aftermath or Extortion recovery transition is active. Future entry coverage must include Guild transport, worm rides and spiritual-advisor arrivals as well as ordinary shipment/movement; generic force placement must not trigger Terror. Continuations must reconcile surviving entrant forces before restoring storm casualty obligations after destructive effects. Previously revealed Extortion must receive a fresh public identity when returning to hidden supply, so redeployment does not expose its face through a remembered ID.

## Entry/effect implementation checkpoint

The earlier no-entry checkpoint is superseded by persistent hooks for ordinary shipment/movement, Guild transport, spiritual advisors and worm rides. Optional decline preserves the placed face. Robbery and Sabotage can now reveal, leave the board, resolve their choices and resume the committed arrival without a second payment or transfer. Turn/phase stamps reject stale requests; public opportunities do not identify an unrevealed face. Three overlay regressions verify that a Fremen summoned worm preserves the Nexus owed before later rides, including a Truthtrance that clears a Robbery overflow.

Competing arrival reactions remain deliberately unsupported: the entire attempted entry rejects atomically, instead of choosing an unverified order or overwriting a pending obligation. A concise user clarification is pending after the bounded source review in `MORITANI_ENTRY_TIMING.md`. The other four effects, Enemy of My Enemy, Aftermath and actual Extortion settlement remain unimplemented. The pure return helper now rotates and shuffles all available supply IDs; it has not been activated as a game effect.

## Additional effect checkpoint — 2026-09-06

Ordinary native Assassination and bounded Sneak Attack now join Robbery and Sabotage as partial runtime effects. See `MORITANI_ASSASSINATION_SNEAK.md` for precise leader-pool and shipment-classification boundaries, pre-reveal disclosure, independent review and verification. Atomics/Aftermath, Extortion and Enemy of My Enemy remain unimplemented; no full expansion start was enabled.

## Enemy of My Enemy integration checkpoint

Acceptance/refusal, cancellation, hidden return custody, former-alliance cleanup, unused escrow refunds and AI/UI decisions are now implemented in an isolated draft. Mandatory unsupported effects still prevent an offer before announcement. `MORITANI_ENEMY_ALLIANCE.md` records source precedence and the pending clarification of Karama-before-reply timing. Full expansion starts remain disabled. The added alliance-formation turn also corrects the base next-turn departure deadline for newly allied co-occupants. Complete validation now includes873 unit and45 persisted/API tests.
