# Tupile low-population intelligence source contract

Runtime follow-up, 10 September 2026: [private disclosure, durable occupation evidence and verification](HOMEWORLD_TUPILE_INTELLIGENCE_RUNTIME.md) now document the integrated implementation. The source checkpoint below is retained as historical evidence; its future-integration statements describe that earlier inspection.

Audited 10 September 2026; category source follow-up added during the next runtime checkpoint. The original checkpoint implemented a public eligibility quote only. This document supplies the counting contract; it does not certify a disclosure handler, occupation lifecycle or complete Homeworld play. Existing release gates remain.

## Primary evidence

The [Future Pastimes designer page](https://futurepastimes.com/dune-ecaz-moritani) links [Jack Reda’s component presentation](https://www.youtube.com/watch?v=4KZKz13wf9c). Fresh inspection of its public storyboard images showed the readable Tupile low face around 2:15 and occupied instructions around 4:20. This audit reads the printed component; no spoken clarification was obtained. The low face specifies 0–10 native CHOAM reserves and begins “Once per faction”. It permits CHOAM to obtain that faction’s spice balance and its weapon **or** defense count when CHOAM is on the faction’s Homeworld or that faction is on Tupile. The occupied instructions explicitly remove CHOAM’s low-threshold advantage.

The [official Ecaz & Moritani rulebook](https://www.gf9games.com/dune/wp-content/uploads/EcazMoritani-Rulebook-LOWRES.pdf), printed pp9–10, supplies continuous population thresholds and the Homeworld occupation framework. Page10 distinguishes the usual low-population penalties from CHOAM’s low-population advantage, establishes the Emperor’s two native Homeworlds in Advanced play, and exempts Homeworld advantages and penalties from Karama cancellation. The general retention of low **penalties** under occupation does not override Tupile’s explicit loss of its low **advantage**.

The [official November 2020 FAQ](https://www.gf9games.com/dune/wp-content/uploads/2020/11/Dune-FAQ-Nov-2020.pdf), printed p8, permits a Truthtrance question asking whether someone holds a weapon and a defense. It does not provide a held-card category-count algorithm. Its p3 Weirding Way/Chemistry answers describe their conditional roles in a committed battle plan. Those battle roles should not be mistaken for evidence that every card playable in a slot counts in that held-card category.

The fresh category follow-up retrieved **FAQ p5**, which explicitly establishes Weirding Way's default as a projectile weapon and Chemistry's default as a poison defense. Its Voice discussion distinguishes those defaults from optional alternate uses. The original E1 faces were also freshly inspected in [physical component photograph 5495302](https://boardgamegeek.com/image/5495302/dune-ixians-and-tleilaxu), locally `/tmp/dune-ix-cards.jpg`. Weirding Way's printed category lists weapon, defense and special; Chemistry lists defense, weapon and special. Their instructions make the alternate role conditional on playing a complementary card. Therefore the table below is supported by an express publisher default, not merely card color or the order of words in the header.

## Executable public eligibility

- The native CHOAM player has 0–10 native reserves at the request. Foreign visitors do not contribute to this threshold.
- Tupile’s advantage is available only with an authoritative **unoccupied** status. An unresolved occupation status blocks the request. The helper does not infer an occupation’s qualification or expiry from current visitors; those unresolved lifecycle questions are tracked in [HOMEWORLD_OCCUPATION_RULES.md](HOMEWORLD_OCCUPATION_RULES.md).
- Positive physical CHOAM forces on any Homeworld native to the target establish outbound contact. Positive physical target forces on Tupile establish inbound contact. Contact does not require sole presence, occupation, an alliance, or CHOAM forces beside an inbound visitor. Two visitors sharing a third faction’s Homeworld do not establish contact with each other.
- Either Kaitain or Salusa Secundus supplies contact with the Emperor in Advanced play. The entitlement belongs to the faction, so contact with both worlds still supplies only one use against the Emperor.
- The printed frequency has no turn, phase, visit, world or category reset. Its direct reading is one successful request per opposing faction for the game. Leaving, returning, changing the contact direction or choosing the other category cannot restore that use.
- The card describes current presence rather than an arrival-only trigger and prints no phase restriction. A future engine action must fit its existing legal action/continuation boundaries without silently limiting the ability to Shipment and Movement. This audit does not establish special priority over an already unresolved action.

Usage is consumed by a successful disclosure, not by opening controls, asking for a quote or rejecting a stale request. The pure helper accepts externally supplied game-long usage and never mutates it.

## Private answer and held-card classification

The answer consists of the target’s current spice and **one** selected count: weapons or defenses. The recipient named by the component is CHOAM. A server can calculate this truthful snapshot without requiring a redundant opponent confirmation. Future integration must atomically validate contact, population, occupation and unused entitlement, calculate the answer, record use and store one private CHOAM receipt. Other players must not receive the balance, category count, hand identities or a private receipt through logs, controls, exports or recovery views. A saved answer is a historical observation, not a live view of subsequent changes.

Eligibility is independent of the answer. An empty hand, zero spice, a hybrid card, a skill or an unfinished card effect must not change the public action’s availability and thereby reveal hidden information.

The appropriate classification composition is physical held cards by their printed primary category, with conditional battle roles applied only when resolving a battle. Each qualifying physical card counts once; an attack effective against two defense types is still one card. Worthless cards and leader-replacement cards are not weapons or defenses merely because battle slots accept them. Leader skills are not additional held Treachery cards. The E3 rulebook, printed p11, explicitly treats Reinforcements and Harass & Withdraw as neither weapons nor defenses despite allowing their use in those slots.

Canonical printed identity matters for Richese cards: Stone Burner and Mirror Weapon are printed weapons, Portable Snooper a defense, and Residual Poison a Special card. A transport value such as `kind: special` is insufficient to determine this count. Physical component evidence is recorded in [RICHESE_COMPONENTS.md](RICHESE_COMPONENTS.md).

The following exact table applies to unplayed cards currently held in hand. `1 / 0` means one weapon and zero defenses **per physical card**, not one per distinct printed name. The canonical identity must match its registered ID, name, kind and effect; a similarly named or effect-tagged fabricated card is not an additional canonical identity.

| Physical cards / canonical classification | Weapon / defense count | Inventory coverage |
| --- | --- | --- |
| Crysknife, Maula Pistol, Slip Tip, Stunner; Ix Hunter Seeker (`projectile`) | 1 / 0 | Four base identities; one Ix identity |
| Chaumas, Chaumurky, Gom Jabbar, Ellaca Drug; Ix Basilia Weapon (`poison`) | 1 / 0 | Four base identities; one Ix identity |
| Lasgun (`lasgun`) | 1 / 0 | One base identity |
| Poison Blade (`poisonBlade`) | 1 / 0 | One Ix identity; two attack types still count as one card |
| Poison Tooth and Artillery Strike (`poisonTooth`, `artillery`) | 1 / 0 | One canonical identity each; E2 replacement faces do not add another physical copy |
| Weirding Way (`weirdingWay`) | 1 / 0 | One Ix identity; publisher default role |
| Shield (`shield`) | 0 / 1 | Four base copies and one Ix copy; count every held copy |
| Snooper (`snooper`) | 0 / 1 | Four base copies and one Ix copy; count every held copy |
| Shield Snooper (`shieldSnooper`) | 0 / 1 | One Ix identity; two defense types still count as one card |
| Chemistry (`chemistry`) | 0 / 1 | One Ix identity; publisher default role |
| Canonical Richese Stone Burner and Mirror Weapon | 1 / 0 | One each; printed weapon category despite saved `kind: special` |
| Canonical Richese Portable Snooper | 0 / 1 | One; printed defense category despite saved `kind: special` |
| All Worthless cards, Cheap Hero and Cheap Heroine | 0 / 0 | Five base Worthless, Ix Kull Wahad, two base leader replacements |
| Other base/Ix Special cards | 0 / 0 | Family Atomics, Weather Control, Hajr, Tleilaxu Ghola, Harvester, Karama, Truthtrance, Thumper and Amal; all their canonical copies |
| Other Richese Special cards | 0 / 0 | Ornithopter, Residual Poison, Semuta Drug, Distrans, Karama, Juice of Sapho, Nullentropy Box |
| All three E3 Treachery cards | 0 / 0 | Recruits, Reinforcements, Harass & Withdraw |

Implementation inventory cross-check: the current factories contain 33 base, 14 Ix, ten Richese and three E3 identities. The table accounts for 17 weapon, 13 defense and 30 other identities across that 60-card catalog. These are software catalog totals, **not** a certified combined draw-deck recipe: Richese begins in a separate cache, replacements replace existing cards, and inactive expansion setup remains gated. Sandtrout, Nexus, skill, traitor and other non-Treachery cards are outside this catalog and do not enter the count. The existing [component inventory](COMPONENT_INVENTORY.md) preserves replacement/setup limitations.

The Richese classifications rely on the previously inspected original physical faces documented in [RICHESE_COMPONENTS.md](RICHESE_COMPONENTS.md); this follow-up could not re-fetch that photograph and does not claim a new inspection. Fresh E3 publisher p11 again explicitly excludes Reinforcements and Harass & Withdraw from both categories. Neither category changes because a faction can use a Worthless card as Karama, a skill modifies battle, a hand lacks a complementary card, or an effect is currently disabled in development.

Applying the publisher defaults to Tupile is a source composition, not a Tupile-specific FAQ answer. If a request is admitted after a hybrid has actually been played in a battle, its conditional role is a separate timing context. This audit does not establish whether Tupile then asks for its active battle role or its ordinary held identity. A bounded runtime can exclude the unresolved battle interval through a **public timing rule**, independent of any target's hidden cards. It must not inspect a sealed plan, double-count both possible roles, or disable the action only when a hidden hybrid is present. A retained card returns to its ordinary held default after its battle role ends.

Do not reuse permissive `isWeaponCard`/`isDefenseCard` slot predicates: they admit Worthless cards and alternate roles. The existing [Truthtrance card-count implementation](TRUTHTRANCE_CARD_COUNT.md) counts named physical identities rather than these categories and is not a substitute. Count only the target's actual current hand, excluding caches, draws awaiting assignment, discarded cards and other escrow zones; no future opponent response or subsequent balance change may update a recorded snapshot.

## Establishing unoccupied Tupile without inventing expiry

At this follow-up's code inspection, `Game.homeworlds` is validated as a custody-only object. `homeworldForceGroups` supplies current physical armies; neither it nor `homeworldPopulations` stores prior occupation qualification. There is no current occupation-history record that certifies the absence of an earlier occupier. Logs and an empty current visitor map are not a substitute for that missing lifecycle evidence.

A sole foreign army with no natives is positive current qualification evidence. Current natives beside a visitor do not prove absence of an earlier same-turn qualification; current emptiness likewise cannot settle whether a departed occupier's specific effect persists. The unresolved cases and existing user question remain in [HOMEWORLD_OCCUPATION_RULES.md](HOMEWORLD_OCCUPATION_RULES.md). No duplicate question is introduced here.

A trusted new-setup baseline can establish that no foreign occupation has occurred yet. Future runtime evidence can preserve a conservative no-qualification invariant while all relevant semantic transfers and turn boundaries are observed, then mark it unknown when that invariant can no longer be proved. This is implementation evidence, not a new occupation expiry rule. Any such tracker needs the mutation coverage documented in [HOMEWORLD_OCCUPATION_LIFECYCLE_AUDIT.md](HOMEWORLD_OCCUPATION_LIFECYCLE_AUDIT.md), including intermediate ordered battle losses. Legacy custody lacking the baseline/history must remain unknown; do not initialize it as unoccupied merely because the current board looks clear. The existing pure helper already accepts explicit `unoccupied`, `occupied` or `unknown` from its caller.

## Current code boundary and verification

[tupile-intelligence.ts](../game/tupile-intelligence.ts) exports `tupileIntelligenceTargets(context, custody, owner, usedFactions, occupation)` and `quoteTupileIntelligenceRequest(context, custody, owner, usedFactions, occupation, target, category)`. Occupation is explicitly `unoccupied`, `occupied` or `unknown`. The first returns public target/contact/blocking information; the second returns a validated request without an answer or a usage mutation. Neither accepts private hand or balance fields as part of its contract.

[tupile-intelligence.test.ts](../tests/tupile-intelligence.test.ts) covers both contact directions, irrelevant co-visitors, zero forces, both Emperor worlds sharing one lifetime use, threshold boundaries, occupation blocks, malformed inputs, immutable queries, saved usage and getter traps proving that private hands, balances, plans and other hidden fields are not read. Engine actions, signed receipts, player projection, bots, UI and production SQLite disclosure recovery remain future integration work.
