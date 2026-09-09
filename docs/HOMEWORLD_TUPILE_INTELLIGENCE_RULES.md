# Tupile low-population intelligence source contract

Audited 10 September 2026. This checkpoint implements a public eligibility quote only. It does not activate an intelligence action, disclose private information, establish occupation lifecycle rules, or certify Homeworld play. Existing release gates remain.

## Primary evidence

The [Future Pastimes designer page](https://futurepastimes.com/dune-ecaz-moritani) links [Jack Reda’s component presentation](https://www.youtube.com/watch?v=4KZKz13wf9c). Fresh inspection of its public storyboard images showed the readable Tupile low face around 2:15 and occupied instructions around 4:20. This audit reads the printed component; no spoken clarification was obtained. The low face specifies 0–10 native CHOAM reserves and begins “Once per faction”. It permits CHOAM to obtain that faction’s spice balance and its weapon **or** defense count when CHOAM is on the faction’s Homeworld or that faction is on Tupile. The occupied instructions explicitly remove CHOAM’s low-threshold advantage.

The [official Ecaz & Moritani rulebook](https://www.gf9games.com/dune/wp-content/uploads/EcazMoritani-Rulebook-LOWRES.pdf), printed pp9–10, supplies continuous population thresholds and the Homeworld occupation framework. Page10 distinguishes the usual low-population penalties from CHOAM’s low-population advantage, establishes the Emperor’s two native Homeworlds in Advanced play, and exempts Homeworld advantages and penalties from Karama cancellation. The general retention of low **penalties** under occupation does not override Tupile’s explicit loss of its low **advantage**.

The [official November 2020 FAQ](https://www.gf9games.com/dune/wp-content/uploads/2020/11/Dune-FAQ-Nov-2020.pdf), printed p8, permits a Truthtrance question asking whether someone holds a weapon and a defense. It does not provide a held-card category-count algorithm. Its p3 Weirding Way/Chemistry answers describe their conditional roles in a committed battle plan. Those battle roles should not be mistaken for evidence that every card playable in a slot counts in that held-card category.

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

For Weirding Way and Chemistry, the existing canonical presentation/default battle-role convention is respectively weapon and defense. The official FAQ supports distinguishing the default role from a conditional alternate battle role, but does not expressly answer Tupile held-card counting. This is a documented source composition, not a claimed Tupile-specific FAQ ruling. No category-count function is introduced by this checkpoint. Before a disclosure handler is activated, its canonical category table must be checked against the printed component inventory, including expansion cards; reusing the permissive `isWeaponCard`/`isDefenseCard` slot predicates would incorrectly include Worthless cards and alternate roles. The existing [Truthtrance card-count implementation](TRUTHTRANCE_CARD_COUNT.md) counts named physical identities rather than these categories and is not a substitute.

## Current code boundary and verification

[tupile-intelligence.ts](../game/tupile-intelligence.ts) exports `tupileIntelligenceTargets(context, custody, owner, usedFactions, occupation)` and `quoteTupileIntelligenceRequest(context, custody, owner, usedFactions, occupation, target, category)`. Occupation is explicitly `unoccupied`, `occupied` or `unknown`. The first returns public target/contact/blocking information; the second returns a validated request without an answer or a usage mutation. Neither accepts private hand or balance fields as part of its contract.

[tupile-intelligence.test.ts](../tests/tupile-intelligence.test.ts) covers both contact directions, irrelevant co-visitors, zero forces, both Emperor worlds sharing one lifetime use, threshold boundaries, occupation blocks, malformed inputs, immutable queries, saved usage and getter traps proving that private hands, balances, plans and other hidden fields are not read. Engine actions, signed receipts, player projection, bots, UI and production SQLite disclosure recovery remain future integration work.
