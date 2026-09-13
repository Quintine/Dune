# Current development status

Updated 13 September 2026. This is the short navigation dashboard; detailed evidence remains in the linked records. **The complete twelve-faction goal is unfinished. Basic is playable; Advanced and unfinished expansion starts remain gated.** No completion or publication gate is opened by this document.

## Evidence and source of truth

- [Rules implementation checklist](../game/reference.ts): `RULE_TOPICS`, topic `implementation-checklist`, and each feature's implementation, controls, AI, documentation and verification entries. Coverage is per stated boundary, not an implicit whole-game certificate.
- [Latest verified gameplay checkpoint](IMPLEMENTATION_STATUS.md): Truthtrance hand inventory, 13 September 2026 (`7454456`): types, lint, **4,200 offline tests**, production build and **40 HTTP tests** passed, with a phone/browser refresh journey and preserved saved games. These are recorded results, not checks rerun for this dashboard.
- [Development guide](DEVELOPMENT.md) defines focused verification; [rule decisions](RULE_DECISIONS.md) locates settled contracts and pending interpretations. Read the newest checkpoint and relevant feature document before consulting older log entries.

The user authorized a one-time local reset on 13 September: the 3,644 historical
rooms were archived privately and cleared. [Fresh checkpoint and preservation
policy](VERIFICATION_WORKFLOW.md#authorized-reset-13-september-2026) now apply to
new games; historical room IDs are no longer active local fixtures.

The first three efficiency milestones are pushed: tooling `6e26ba5`, typed
Advanced shipment commitments `32791ed`, and [hand inventory facts](TRUTHTRANCE_HAND_INVENTORY.md)
`7454456`. See [pilot measurements](EFFICIENCY_PILOT.md).

The current [Atreides full-plan audit](ATREIDES_FULL_PLAN_TIMING.md) verifies
Truthtrance/Voice/Prescience/Ghola interactions from genuine Advanced setup,
replacing the old Basic-then-flip test fixture. These existing paths pass without
a runtime change. Exact special-offer timing and target-first ordering remain
source interpretations; they are not settled by test results.

The development server is reused until a change or observed condition warrants
a restart. The user removed hourly restarts; preserve saved games and verify
restoration after necessary restarts. No recurring automation is installed.

## Remaining readiness

| Area | Established evidence | Remaining gate |
| --- | --- | --- |
| Basic core | Playable loop; shared setup, Fremen movement cancellation, structured Truthtrance facts and bounded Basic/no-Guild Advanced reserve-shipment promises. | Ordinary Guild rate/transport cancellation; wider truthful questions/action commitments; integrated rules and human/AI acceptance. |
| Six-faction Advanced | Genuine offline setup across 456 configurations; four-profile full-game simulations and JSON continuations. | Base gaps plus provisional special-Karama outcomes, remaining timing audits and authentic multiplayer/browser acceptance. Public starts remain disabled. |
| Twelve factions and optional modules | Many bounded faction, card, Homeworld and Nexus slices have controls, bots and recovery evidence. | Every unfinished effect and interaction, occupation entitlement, Discoveries and complete combined games. Inventory or fixture coverage does not enable a module. |
| AI difficulty | Four profiles consume private legal views; recorded Basic and Advanced studies complete. | Demonstrate a consistent Medium → Hard → Brutal strength ordering, improve strategic gaps, and repeat targeted studies after relevant policy/rule changes. |
| Multiplayer | Versioned writes, saved seats, owner recovery kits, uncertain-request retry and voluntary own-seat AI control. | Intentional transfer, unprepared abandoned-seat recovery, unattended continuation and remaining network-failure acceptance. Preserve privacy and existing games. |
| Player experience | Internal component inspectors and many desktop/phone feature journeys verified. | Complete end-to-end games, accessible controls, responsive layout, clear rules/errors and recovery across all supported combinations. |

The [base/Advanced audit](BASE_ADVANCED_READINESS_20260907.md) includes historical missing-feature rows. Its follow-ups supersede the Fremen cancellation and BG setup findings; [genuine setup](ADVANCED_SETUP_TEST_SEAM.md) and the [Advanced study](AI_ADVANCED_SETUP_CALIBRATION_20260907.md) supersede the old Basic-then-flip testing concern. They do not settle the remaining rules.

Likewise, the [Truthtrance readiness audit](TRUTHTRANCE_NONBATTLE_READINESS_20260907.md) predates [spice facts](TRUTHTRANCE_SPICE_FACTS.md), [card-count facts](TRUTHTRANCE_CARD_COUNT.md) and [Basic shipment promises](TRUTHTRANCE_SHIPMENT_PROMISES.md). Current `TruthFact` already includes these facts; do not rebuild them. Typed preparation and BG conversion now support the active reserve-shipment scope in base Advanced without Guild or optional modules. Broader facts, earlier-phase promises, remaining Advanced/expansion commitment scope and freeform interpretation remain incomplete.

## Next milestone: core readiness

1. Reconcile the remaining base-only gaps against current helpers, consumers and tests, using the existing [Guild cancellation contract](GUILD_RATE_KARAMA_RULES.md) and [special-Karama findings](BASE_ADVANCED_READINESS_20260907.md#explicit-unresolved-base-interpretations). Keep already-asked interpretations pending; tests are not rulings.
2. Ordinary Guild cancellation remains the next dependent gameplay batch around an exact saved shipment intent. Keep discount, cross/return permission and income separate; preserve contributors, independent Karama rates and original typed forces. Establish the unresolved affordability/settlement contract before implementing those outcomes. Verify sufficient-funds paths, nested responses, rejected-action immutability, private controls, all four bots and saved continuations together.
3. Continue remaining core Truthtrance and Advanced timing gaps. The [full-plan interaction audit](ATREIDES_FULL_PLAN_TIMING.md) closes the named native card-interaction evidence gap while preserving unresolved timing interpretations. Run genuine Basic/Advanced setup-to-finish multiplayer and browser acceptance before reconsidering mode gates. Expansion completion remains a subsequent part of the same overall goal.

Consult [AI calibration](AI_CALIBRATION.md), [multiplayer audit](MULTIPLAYER_AUDIT.md), [autopilot](AUTOPILOT.md), [component inventory](COMPONENT_INVENTORY.md) and [visual playtest](VISUAL_PLAYTEST.md) for their measured scope and follow-ups. Use current code and later checkpoints to interpret historical results. Publication still requires the completion and integrated verification gates in [README](../README.md).
