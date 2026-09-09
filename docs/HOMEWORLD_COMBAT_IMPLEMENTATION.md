# Homeworld combat foundation and Salusa support

9 September 2026. This extends the native-reserve runtime. Homeworld invasion and live off-planet battle actions remain unavailable; no start gate is opened.

## Connected Salusa behavior

In Advanced Homeworld development games, maintaining at least two Sardaukar on Salusa grants free support to the Emperor’s Sardaukar wherever they fight. Normal forces retain their ordinary support costs. The shared combat calculation uses a separate optional elite-support flag, so ordinary Sardaukar Karama can reduce their strength without canceling the Homeworld benefit. Shipping a fourth Sardaukar away from the initial five leaves Salusa low and removes free elite support. Normal reserves transferred there do not replace the named population threshold.

Server plans, typed casualty options, Stone Burner comparisons, the private player view, all four AI policies and the table’s support maximum share this calculation. Saved casualty decisions preserve the relevant force snapshot. Legacy snapshots without the optional flag retain their existing behavior. Salusa’s low free-revival prohibition and occupation penalty remain unfinished.

## Off-planet foundation

`game/homeworld-combat.ts` reads exact native and visiting typed custody into detached public armies and non-allied battle pairs. It validates player order and reciprocal alliances without adding fictional sectors or strongholds to Arrakis.

The pure battle-resolution quote accepts an explicit native card, face and physical army. It adds the printed native strength without increasing dial casualties, restricts traitor callers to the native combatant, and quotes native Lasgun/Shield losses separately from invading army destruction. Two visitors can fight with no traitor voters; a noncombatant native still retains the explosion protection. Basic Homeworld outcomes preserve typed physical losses.

These quotes are not yet wired into live off-planet battle discovery, aftermath, force removal, Face Dancers or occupation. The engine must consume the separate native explosion choice before transport opens. See the [integration audit](HOMEWORLD_COMBAT_INTEGRATION_AUDIT.md) and [invasion source audit](HOMEWORLD_INVASION_RULES.md). Current invasion/occupation interpretation questions remain pending.

## Verification

Focused checks pass 62 combat/Stone Burner cases, 29 battle-resolution cases, nine Homeworld army/discovery cases and eight Salusa engine cases. These groups overlap existing regression coverage and are not a combined full-suite count. The Salusa cases use genuine Advanced setup, typed shipments and actual battle preparation, sealed plans, traitor actions and casualty settlement. They cover high/low transitions, normal support costs, ordinary Karama, JSON restoration, opponent privacy, physical conservation and legal decisions from every AI level.

The first integrated pass passed **3,218 offline cases**, typecheck, lint, production build and **40 HTTP cases**. Independent review then reproduced a Ghola deadlock: raising Salusa from one to two Sardaukar during combat could invalidate an already sealed paid-support plan. A temporary explicit release boundary now blocks only that population-changing Sardaukar Ghola return during the Emperor’s battle, before any card or force moves. Regressions cover both a sealed plan and a binding prescience dial before either full plan, JSON rejection without mutation, subsequent battle completion and the later legal Sardaukar return. The player view, AI allowance and controls expose the same restriction; ordinary force and leader targets remain available. This is an unfinished interaction, not an official prohibition. The final check after the guard passes **3,221 offline cases**, typecheck and lint; the final production build passes. The 40 HTTP cases passed before the guard; the guard’s new coverage executes production engine actions with JSON restoration. All **2,648** earlier baseline rooms retain their versions and state hashes. No new browser acceptance was performed for this slice. No live Homeworld invasion, complete Homeworld game, full module combination or browser acceptance is claimed by this checkpoint. The recurring automation remains removed.
