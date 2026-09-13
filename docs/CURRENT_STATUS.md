# Current development status

Updated 13 September 2026. This is the short navigation dashboard; detailed evidence remains in the linked records. **The complete twelve-faction goal is unfinished. Basic is playable; Advanced and unfinished expansion starts remain gated.** No completion or publication gate is opened by this document.

## Evidence and source of truth

- [Leader battle effects](LEADER_BATTLE_EFFECTS.md) now connect both Rihani bands
  and lower Mentat, Bureaucrat and Sandmaster effects. Private controls, all four
  AI profiles, JSON/SQLite continuation and concurrent exchanges are covered.
  A new browser room exercised separate inspection, draw, public return and refresh.
  Three normal bands and Spice Banker, Diplomat and Smuggler remain missing.
  The server responded after the outage; a fresh backup captured 393 rooms.
  Broad check results and final preservation are recorded in the checkpoint commit.

- [Suk Graduate](SUK_GRADUATE_RULES.md) now connects both casualty-rescue bands,
  ordinary/elite counter routing, player controls, all four AI profiles and saved
  continuation. Targeted browser rescue and refresh preserved two board forces,
  seventeen reserves, one Tank and the private hand. Two Basic/Advanced samples
  finished but did not encounter an eligible rescue; targeted tests cover that
  effect. Advanced Atreides selection remains unavailable pending the recorded
  Kwisatz Haderach question. After the latest reported outage, the server was
  healthy and all 360 rooms were backed up; the 359 opening rooms and their seat
  records were unchanged. Checkpoint-wide results are in the commit.
- [Planetologist](PLANETOLOGIST_RULES.md) now has bounded movement and Special-card
  battle prototypes. Independent review and **84 focused tests** pass. Two genuine
  four-profile Basic/Advanced samples finished with saved continuations and no
  rejected actions; the Basic sample used both movement alternatives. Browser
  gather, Special substitution and refresh were exercised in a new isolated room.
  All 325 opening games remain preserved. The existing server was healthy after
  the outage report, so it was reused. Broad results are in the checkpoint commit.
- [Juice of Sapho](JUICE_OF_SAPHO_RUNTIME.md#13-september-first-at-a-later-clean-movement-boundary)
  now connects first among remaining unstarted movement turns after earlier
  turns finish, including after Advanced Guild completes its turn. Existing
  private controls, all four AI profiles and saved continuation use the same
  server option. Other Sapho timing questions remain pending. Independent
  review and focused checks pass; broad results are in the checkpoint commit.
- The [first Leader Skills prototype](LEADER_SKILLS_RUNTIME.md) connects all
  fourteen physical cards, private setup, five battle disciplines, skilled capture,
  death and own revival through controls, legal AI and saved choices. The [Planetologist follow-up](PLANETOLOGIST_RULES.md) adds movement and
  Special-card battle controls, and Suk Graduate adds casualty rescue. The
  battle-effects follow-up adds Rihani and three lower bands; remaining work is
  listed in its contract. The user-requested [capture search](LEADER_SKILLS_CAPTURE.md)
  resolves publicity through the known physical card; captured replacement and
  broader combinations remain pending. No mode gate is opened.
- Following the reported power outage, the existing server responded normally,
  the database integrity check passed with 291 rooms, and all 218 rooms in the
  preceding handover baseline were unchanged. The saved QA seat restored its
  same private hand and pending Storm decision after refresh. A new private
  backup protects all 291 rooms. No server restart or database reset was needed.
- A second reported outage later stopped the server. All 292 rooms survived
  integrity and preservation checks. A fresh backup preceded the necessary
  server start; the Leader Skills QA seat restored its same private hand,
  assignments and pending Storm choice. No database reset was performed.
- The current [Discovery prototype](DISCOVERY_PROTOTYPE.md) adds unambiguous
  Jacurutu battle income, sole-occupant Ecological Testing Station adjustment and
  Shrine card conversion. They connect engine effects, private controls, legal
  AI and saved continuation. Orgiz, mixed-force Jacurutu payouts and contested
  Cistern/Testing Station benefits remain pending. Required broad checkpoint
  results are recorded in the commit; this is **Prototyped**, not full compliance.
- Discovery checkpoint `ab0ab52` added signed next-turn entry, sole-occupant
  Cistern income and later-turn carried Ornithopter movement. It passed **4,313
  offline tests**, build and **40 HTTP tests**, preserving all 156 opening rooms
  (187 after QA/checks). Browser room `CA782FQE` exercised free entry and carried
  flight; refresh and recovery from a user-confirmed power outage retained the
  private hand, forces, spice and spent token. Those were targeted scenarios.
- [First Discovery prototype](DISCOVERY_PROTOTYPE.md): genuine base-faction
  Basic/Advanced setup, seven Spice Cards, eight tokens, Great Maker, Collection
  inspection/rewards and revealed nested locations are connected. Checkpoint
  `f0256c1` passed 4,264 offline tests, build and 40 HTTP tests; two seeded games
  finished and the Fremen browser view restored its private token face. All 125
  opening saved rooms remained unchanged. That checkpoint predates the current
  free-entry, Cistern and carried-Ornithopter additions.
- Ix prototype checkpoint `5a76ae0`: types, lint, **4,211 offline tests**, build and **40 HTTP tests** passed. Genuine Basic/Advanced setup and two seeded complete simulations were exercised; a short browser game finished with private hand restoration. All 64 opening saved rooms were preserved; 31 QA rooms were added. This is bounded prototype evidence, not complete Ix compliance.

- [Rules implementation checklist](../game/reference.ts): `RULE_TOPICS`, topic `implementation-checklist`, and each feature's implementation, controls, AI, documentation and verification entries. Coverage is per stated boundary, not an implicit whole-game certificate.
- [Latest verified gameplay checkpoint](IMPLEMENTATION_STATUS.md): Truthtrance hand inventory, 13 September 2026 (`7454456`): types, lint, **4,200 offline tests**, production build and **40 HTTP tests** passed, with a phone/browser refresh journey and preserved saved games. These are recorded results, not checks rerun for this dashboard.
- Latest verification checkpoint `4a0b1ee`: genuine Advanced full-plan interaction tests; types, lint and **4,205 offline tests** passed. Private inspection restored after restart, with desktop/phone checks and all 64 saved games unchanged. No runtime change; prior build/HTTP evidence applies.
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
| Twelve factions and optional modules | Many bounded faction, card, Homeworld and Nexus slices have controls, bots and recovery evidence; Discovery includes free entry, Cistern, carried flight and bounded Jacurutu, Testing Station and Shrine effects. | Every unfinished effect and interaction, occupation entitlement, Orgiz, mixed physical dial allocation and contested Discovery benefits and complete combined games. Inventory or fixture coverage does not enable a module. |
| AI difficulty | Four profiles consume private legal views; recorded Basic and Advanced studies complete. | Demonstrate a consistent Medium → Hard → Brutal strength ordering, improve strategic gaps, and repeat targeted studies after relevant policy/rule changes. |
| Multiplayer | Versioned writes, saved seats, owner recovery kits, uncertain-request retry, voluntary own-seat AI control and a [voluntary seat handover prototype](SEAT_HANDOVER.md). | Broader handover/disconnection acceptance, unprepared abandoned-seat recovery, unattended continuation and remaining network-failure acceptance. Preserve privacy and existing games. |
| Player experience | Internal component inspectors and many desktop/phone feature journeys verified. | Complete end-to-end games, accessible controls, responsive layout, clear rules/errors and recovery across all supported combinations. |

The [base/Advanced audit](BASE_ADVANCED_READINESS_20260907.md) includes historical missing-feature rows. Its follow-ups supersede the Fremen cancellation and BG setup findings; [genuine setup](ADVANCED_SETUP_TEST_SEAM.md) and the [Advanced study](AI_ADVANCED_SETUP_CALIBRATION_20260907.md) supersede the old Basic-then-flip testing concern. They do not settle the remaining rules.

Likewise, the [Truthtrance readiness audit](TRUTHTRANCE_NONBATTLE_READINESS_20260907.md) predates [spice facts](TRUTHTRANCE_SPICE_FACTS.md), [card-count facts](TRUTHTRANCE_CARD_COUNT.md) and [Basic shipment promises](TRUTHTRANCE_SHIPMENT_PROMISES.md). Current `TruthFact` already includes these facts; do not rebuild them. Typed preparation and BG conversion now support the active reserve-shipment scope in base Advanced without Guild or optional modules. Broader facts, earlier-phase promises, remaining Advanced/expansion commitment scope and freeform interpretation remain incomplete.

The voluntary [seat handover prototype](SEAT_HANDOVER.md) connects private one-time offers, recipient controls, exact saved retry proof and active-token custody fencing. It preserves existing game state and revokes previous owner recovery authority. Full disconnected-seat acceptance remains open. CHOAM Nexus after-victory inspection awaits the [private-window decision](NEXUS_CHOAM_SECRET_ALLY.md#after-victory-inspection-audit); development continues independently.

## Next milestone: rapid functional coverage

The first connected batch is the [Ixians & Tleilaxu prototype](IX_PROTOTYPE.md):
genuine setup, both expansion factions, full Ix deck and Sandtrout, shared human/AI
controls and saved continuation. The checklist now distinguishes its Prototyped
development stage from Partial rules coverage. The next connected action is the [CHOAM Nexus Collection trade](NEXUS_CHOAM_SECRET_ALLY.md),
with private controls, all four AI profiles and a saved payment/discard continuation.
Its after-victory inspection remains missing. The [first Discovery batch](DISCOVERY_PROTOTYPE.md)
now connects the [sourced components](DISCOVERY_COMPONENTS.md) to Great Maker,
destructive Discovery blows, private inspection/reveal, stash rewards, carried
Ornithopter custody and later-turn movement, five revealed nested locations,
signed free entry on the following turn and sole-occupant Cistern income. Only
Jacurutu counts toward stronghold victory. Jacurutu income, Testing Station and Shrine now have bounded connected
prototypes. Next dependencies are Orgiz and the unresolved contested benefits,
physical dial allocation and collected-spice-blow interpretations. Complete variant acceptance
and normal public starts remain gated.

The user changed the development order on 13 September: get working prototypes
of all remaining functions into the game, then use integration and play to find
issues and refine them. Complete core certification no longer precedes independent
expansion prototyping. Final rules compliance and release requirements still apply.

1. Reconcile the existing checklist with current helpers, controls, AI and saved-state paths. Mark remaining work as missing, prototyped, integrated, verified or polished; retain explicit blockers and reuse completed features.
2. Implement the next connected batch across Basic, Advanced, factions or modules according to dependencies. Include real actions, usable controls, a legal AI path and saved continuation. Keep fast checks for crashes, deadlocks, legality, custody, privacy and save integrity; avoid exhaustive refinement of each small feature before broad coverage exists.
3. Continue independent functions while [material rulings](RULE_DECISIONS.md) are pending. Ordinary Guild repricing/settlement and special Karama interpretations remain unresolved; do not invent their outcomes to fill the inventory.
4. Integrate prototypes and play complete games to discover issues, then deepen combination coverage, multiplayer recovery, AI calibration and visual polish. Required checkpoint checks, reviewed Git pushes, selective subagents and the 80%-used weekly stop remain in force. Keep unfinished modes and publication gated until acceptance.

Consult [AI calibration](AI_CALIBRATION.md), [multiplayer audit](MULTIPLAYER_AUDIT.md), [autopilot](AUTOPILOT.md), [component inventory](COMPONENT_INVENTORY.md) and [visual playtest](VISUAL_PLAYTEST.md) for their measured scope and follow-ups. Use current code and later checkpoints to interpret historical results. Publication still requires the completion and integrated verification gates in [README](../README.md).
