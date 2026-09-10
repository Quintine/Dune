# Fremen Nexus: worm and revival contract

Primary-source and integration audit, 10 September 2026. This document does not implement an effect or open a release gate. The [common Nexus rules](NEXUS_CARD_RULES.md) apply. No new user question was sent.

## Evidence

The Fremen panel was freshly read from the [photograph of the printed GF9 cards](https://boardgamegeek.com/image/7767032/dune-ecaz-and-moritani), cached as `/tmp/dune-nexus-cards.jpg`. Cunning permits a remote ride when a sandworm appears in a territory containing no forces: the player may take forces from one desert territory to a destination respecting storm and occupancy rules. Secret Ally offers either protection against a sandworm or a total of three free force revivals during Revival. The latter does **not** use Emperor's additional/beyond-limits wording. Neither option grants the absent faction's other advantages.

The [base Fremen sheet, printed p.16](https://www.gf9games.com/dunegame/wp-content/uploads/Dune-Rulebook.pdf#page=16) supplies ordinary riding after the Nexus, from some or all forces at the worm's territory, and Advanced placement of additional worms in sand. The [base Spice Blow rules, p.8](https://www.gf9games.com/dunegame/wp-content/uploads/Dune-Rulebook.pdf#page=8) ignore first-turn worm cards and associate later natural worms with the applicable discard territory. These are separate from a worm's destination after riding.

The [November 2020 FAQ, pp.2–3](https://www.gf9games.com/dune/wp-content/uploads/2020/11/Dune-FAQ-Nov-2020.pdf#page=3) preserves the one-per-turn Advanced Fedaykin/Sardaukar revival cap through other revival producers. It also expressly makes the Fremen special Karama summon a Spice Blow/Nexus event with a Nexus and normal destruction/ride consequences. This supersedes the older contradictory no-Nexus answer in the base book. Publisher-indexed text was retrieved; direct PDF access returned 403, and two older locally named base/FAQ PDFs proved to be HTML rather than readable PDFs.

The [E1 FAQ, p.11](https://www.gf9games.com/dunegame/wp-content/uploads/2020/09/IxianAndTleilaxuRulebook.pdf#page=11) describes Sandtrout's anti-Nexus and immediate replacement-card behavior. Its Karama table distinguishes destroying Fremen at a worm from stopping additional-worm placement. The [E3 rules, pp.11–12 and 16](https://www.gf9games.com/dune/wp-content/uploads/EcazMoritani-Rulebook-LOWRES.pdf#page=12), reread in the cached publisher-authored PDF text and fresh publisher-indexed excerpts, give common Nexus timing and distinguish Great Maker's reserve ride from ordinary board-origin riding. Great Maker remains a separate integration boundary.

## Cunning: source-backed scope and implementation composition

The following are implementation consequences of the inspected text, not additional quoted rules:

- **Empty means no faction's forces, at the actual appearance.** Capture this fact before `devour`; a worm that eliminates an enemy army must not retroactively qualify. Count all sectors, normal/starred counters, BG advisors, and a public No-Field marker as one. Use `presenceAt` from `game/force-presence.ts`; never inspect its hidden denomination or infer emptiness from the forces left after destruction. Spice, Terror and Ambassador tokens alone are not forces.
- **Only the source must be desert.** Use board territory type `sand` for one chosen source; allow a subset and multiple sectors within that single territory, retaining exact starred counts. Strongholds, rock, Polar Sink, native reserves and Homeworlds are not desert source groups. Natural worm appearances can follow a printed spice card in rock territory: do not incorrectly require every triggering territory to be sand. Existing `disaster-preflight.ts` deliberately supports that distinction.
- **Destinations reuse ordinary riding.** This is not a two-territory move or a reserve shipment. Reuse valid Arrakis locations, storm exclusion, ally/stronghold capacity, sector checks and typed removal. Do not impose the source's desert restriction on destinations. Keep the existing Homeworld/discovery/HMS boundaries unless their own adapters explicitly support the move.
- **One use must bind one actual appearance.** Both Advanced spice piles and allowed additional-worm placements can produce separate events. A second-pile event must not borrow the first pile's discard territory, and identical territories do not identify identical worms. First-turn ignored cards and the current Sandtrout-suppressed branch do not call `beginWorm`; creating Cunning merely when a worm-shaped card is drawn would bypass those existing rules.
- **Special summons are real worm appearances.** The later FAQ supports applying the trigger to an empty-territory summon. Preserve its separately saved parent and after-blow Nexus ordering. A player cannot manufacture the trigger by choosing a source group first and treating that group as already at the empty worm territory.

Great Maker expressly replaces normal board-origin riding with reserve riding. Do not automatically add another board ride or allow Cunning to choose between both sources. This combination needs a separate resolution when Discovery is implemented. Likewise, Sandtrout handling should remain at the existing appearance boundary; this audit does not independently change its suppression algorithm.

## Engine contract and timing hazards

`beginWorm` → `wormSurvival` → `devour` → `afterWorm`/`continueSpice` is the current resolution path. `devour` only pushes a territory into `wormRides` when Fremen already occupy it. `nextWormRide` additionally requires surviving Fremen there. Therefore adding the empty territory to that string queue cannot implement Cunning: it will be discarded, or will incorrectly demand a source at the empty location.

Recommended focused contracts:

1. Create an immutable worm occurrence before destruction, recording event, turn, phase, source (`natural`, `additional`, `summoned`), target, applicable pile/parent identity and original public force presence. Only accepted additional placement creates an occurrence. Never regenerate the original emptiness fact from current forces on read.
2. Quote Cunning from that occurrence and public board groups, plus the owner's actual card entitlement. Return eligible single-desert sources with typed per-sector counts and ordinary destination legality. Validate the selected subset again when committing; no hidden opponent hand or marker size enters the quote.
3. Spend the unique Nexus card once and persist a signed result/ride obligation bound to the occurrence. Keep its source selection separate from the worm's appearance territory. Preserve the existing post-Nexus ride scheduling, including further summoned worms and both spice piles. Record progress independently enough to reject deleted decisions, source edits and replayed completed rides.
4. On movement, reuse the existing worm-ride arrival chain: `intrusion` and `openTerritoryEntry(..., 'wormRide', 'wormRide')`, followed by `nextWormRide` only after all Ambassador/Terror/BG children finish. Do not rerun devouring, spice draws, negotiations, shipment, or normal movement usage.

Two interactions need a concrete decision before treating this as a complete feature. The card triggers at appearance while ordinary riding follows negotiations: a just-drawn card must not automatically buy a retrospective ride for an earlier empty worm. Also, ordinary Karama's printed Shai-Hulud result destroys forces at the worm, whereas the remote source is elsewhere. Do not destroy that remote source, or invent a global loss of all riding, as a shortcut for cancellation. A bounded enhanced-native cancellation policy must preserve the original empty occurrence and unrelated rides.

## Secret Ally protection

With Fremen absent, `wormSurvival` currently proceeds directly to destruction. The protection must be committed before that destruction; it cannot revive already devoured troops, prevent removal of spice, or grant a ride. Bind it to one worm occurrence and the holder's affected physical group, including the existing No-Field reveal/capped-materialization path. Other factions remain vulnerable.

A pause offered only when the threatened player secretly holds this card would disclose possession. Do not add a holder-dependent automatic stop or an unsolicited confirmation for every victim. This intersects the existing unanswered reaction/automatic-pass policy. A saved public occurrence may support a future permitted response design, but it is not authorization to pick that design here. No source found gives the absent-faction card blanket Karama susceptibility; do not reuse a native Fremen cancellation response without establishing its classification.

## Secret Ally revival

The card's total-of-three wording and the native alliance's ordinary free-three benefit support a **free-rate interpretation within ordinary revival accounting**, rather than three additional counters beyond the usual allowance. This is source composition, not an explicit Nexus FAQ. Preserve it as the proposed contract; do not silently apply Emperor's separate extra-return producer.

`game/revival.ts` already computes free rate/remaining from `p.revived`, typed prices and ordinary limits. Engine `beginRevival`/`finishRevival` retains pending requests and Tleilaxu prevention/income continuations. The likely narrow adapter is an explicit source-labelled, phase-bound free-rate entitlement consumed by an actual normal revival request, retaining previous returns and exact free/paid normal/starred allocation. Never refund earlier paid revivals or reset `revived`/elite counters on card play or reload.

Keep these questions visible: how the three-total interacts with a higher native free rate, prior paid/free returns, low-Homeworld bonus and Recruits; whether a partial group below three is permitted when Tanks cannot supply three; and whether the benefit survives La La La or Tleilaxu prevention. The [existing revival audit](FREMEN_REVIVAL_AUDIT.md) and [Homeworld benefit audit](HOMEWORLD_BENEFITS_RULES.md) do not by themselves answer differently worded Nexus composition.

Tleilaxu may be present even though Fremen is absent. `collectRevivalIncome` uses a per-player/turn free-income marker and a separate Ghola path; do not create another payment merely because a Nexus card was played. Axlotl activation and any eligible Homeworld deployment must follow the actual returned batch. Preserve the existing [revival-accounting questions](TLEILAXU_AMBASSADOR_RULES.md), exact typed caps, and signed return/arrival continuations. No leader, Cheap Hero or foreign leader revival is printed here.

## Verification required for the next package

Start with genuine unallied Fremen Cunning and natural empty appearances in both modes: compare initially empty against enemies devoured to empty, BG advisors, hidden zero/three/five markers, and multi-sector source groups. Verify rock-spice triggering territories, storm-blocked sources/destinations, occupied strongholds, typed movement and no normal movement charge. Extend to both Advanced piles, additional placement, summoned-parent recovery, canceled appearances, Sandtrout suppression, post-Nexus timing and nested arrival effects. Compare every seat's view and prove lost acknowledgments and concurrent requests cannot duplicate a ride. Secret Ally protection and revival require the specific policy/accounting boundaries above before broader integration is certified.
