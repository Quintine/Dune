# Current development status

Updated 13 September 2026. **The full twelve-faction goal is unfinished. Basic
is playable; public Advanced and unfinished expansion/module starts remain
gated.** Prototypes do not open completion or publication gates.

## Current checkpoint and work

Latest verified checkpoint: `903d861`, deferred movement arrival safety.
Types, lint, **4,583 offline tests**, build and **43 HTTP tests** passed.
All **632 opening games** and original seat/recovery records were preserved
(665 after HTTP checks). The healthy server was reused; both existing Ecaz and
Ixian browser QA seats restored their private hands and pending decisions.

[Deferred movement](DEFERRED_MOVEMENT_ARRIVAL.md) now rejects unsupported arrivals
before prevention windows or new card commitment. A legacy CHOAM decline returns
an uncommitted move for another choice while preserving reserved Ornithopter
custody. All six genuine faction sample games finish; combined Advanced completes
1,303 actions and 35 JSON restorations. Guarded arrival candidates still occur.
The exact prior failed save also finishes. Simultaneous Ambassador/Terror priority
remains unresolved, so these paths do not prove complete combined rules support.

The [Mentat question preview](MENTAT_QUESTION.md) now connects private naming and
card disclosure before leader posture and faction powers, with human controls,
all four AI profiles and saved continuation. Independent review and 22 focused
tests pass; two controlled-shuffle genuine-setup samples finish. Ordinary games
remain unactivated while the uniform private response UX question is pending.
Final broad results and Git delivery are recorded with the verified checkpoint.

After the latest power failure, all 665 opening rooms and original seat/recovery
records matched the backup; the new Mentat QA room brings the total to 666 before
HTTP checks. Database integrity and foreign keys passed. The existing server
responds at localhost:3000 and is reused; its lock prevented a duplicate start.
The Mentat browser seat restored its private history and pending leader choice.

## Authoritative navigation

- [Rules checklist](../game/reference.ts), topic `implementation-checklist` and
  each feature's entries: track implementation, controls, AI, documentation and
  verification, plus Missing, Prototyped, Integrated, Verified and Polished stages.
- [Rule decision index](RULE_DECISIONS.md): settled contracts, source precedence
  and pending material interpretations. Consult it before reopening research.
- [Development guide](DEVELOPMENT.md) and [verification tools](VERIFICATION_WORKFLOW.md):
  architecture, focused checks, source-bound reports, reusable faction samples,
  private backup and saved-seat restoration.
- [Implementation history](IMPLEMENTATION_STATUS.md): newest first. Historical
  evidence and outage records stay there and in feature documents; read bounded
  relevant sections and verify old absence claims against current code/tests.
- [Efficiency pilot](EFFICIENCY_PILOT.md): the first three milestones are pushed;
  measurement limits remain explicit. Reuse tools and checks, without promising
  an unmeasured savings percentage.

## Connected development capabilities

These links define bounded working behavior, not complete module certification.

| Area | Current connected work and evidence |
| --- | --- |
| Base/Advanced setup | [Genuine setup](ADVANCED_SETUP_TEST_SEAM.md), [Advanced study](AI_ADVANCED_SETUP_CALIBRATION_20260907.md), [Fremen cancellation](FREMEN_MOVEMENT_KARAMA_RULES.md), [Atreides full-plan audit](ATREIDES_FULL_PLAN_TIMING.md). Earlier Basic-then-flip fixtures do not establish current setup coverage. |
| Expansion factions | [Ixians/Tleilaxu](IX_PROTOTYPE.md) and [all seven faction selections](EXPANSION_FACTIONS_PROTOTYPE.md): genuine setup, Ecaz six-force placement, separate optional card variants, private controls and saved per-lot Ixian/Richese decline. Actual special-lot exchange remains pending. |
| Leader Skills | [Common lifecycle](LEADER_SKILLS_RUNTIME.md), [known skilled capture](LEADER_SKILLS_CAPTURE.md), [Mentat question preview](MENTAT_QUESTION.md), five battle disciplines, [Planetologist](PLANETOLOGIST_RULES.md), [Suk Graduate](SUK_GRADUATE_RULES.md), [Rihani and other battle effects](LEADER_BATTLE_EFFECTS.md), [Smuggler shipment](SMUGGLER_SHIPMENT.md) and [No-Field](SMUGGLER_NO_FIELD.md), [Sandmaster routes](SANDMASTER_MOVEMENT.md), [Banker spending](SPICE_BANKER_RUNTIME.md), [Diplomat defense](DIPLOMAT_DEFENSE.md). Remaining bands and combinations are explicit in those contracts. |
| Discoveries | [Prototype](DISCOVERY_PROTOTYPE.md): genuine setup, Great Maker, seven cards/eight tokens, inspection and stash rewards, nested sites, signed later free entry, carried Ornithopter, sole Cistern, bounded Jacurutu income, Testing Station and Shrine. Orgiz and contested/mixed cases remain pending. |
| Nexus/Homeworlds | [Decision index](RULE_DECISIONS.md) links each integrated faction family, native/borrowed effects, physical custody, private choices, payments and transport. [CHOAM Collection trade](NEXUS_CHOAM_SECRET_ALLY.md) is connected; its after-victory inspection remains pending. A source audit or helper alone is not a completed effect. |
| Truthtrance | [Spice facts](TRUTHTRANCE_SPICE_FACTS.md), [card counts](TRUTHTRANCE_CARD_COUNT.md), [hand inventory](TRUTHTRANCE_HAND_INVENTORY.md), and [Basic/no-Guild Advanced reserve-shipment promises](TRUTHTRANCE_SHIPMENT_PROMISES.md) use authoritative private state. Earlier readiness audits do not supersede these follow-ups. |
| Other cards | [Sapho runtime](JUICE_OF_SAPHO_RUNTIME.md) includes first among remaining unstarted movement turns after Advanced Guild has finished. Richese card contracts and the checklist identify the other connected effects and explicit gaps. |
| Multiplayer | Saved rooms/seats, [recovery](../README.md#saved-seats-and-reconnecting), uncertain-request retry, [own-seat AI](AUTOPILOT.md), and [voluntary seat handover](SEAT_HANDOVER.md) have connected controls and recovery evidence. |

## Remaining readiness

| Area | Remaining gate |
| --- | --- |
| Basic core | Ordinary Guild repricing/transport settlement, broader truthful commitments, unresolved special timing and integrated rules/human/AI acceptance. |
| Six-faction Advanced | Base gaps, provisional special-Karama outcomes, remaining timing audits and authentic multiplayer/browser acceptance. Setup matrices and complete samples do not open public starts. |
| Twelve factions and all optional modules | Every missing effect, remaining skill bands, Ecaz card variant, Kull Wahad, unfinished Richese cards, Terror effects, occupation entitlement, Nexus interactions, contested Discoveries and complete games across valid combinations. Detailed boundaries remain in the checklist/decision index. |
| AI | Legal continuation for every supported function and distinct Easy/Medium/Hard/Brutal strategy; consistent upper-level strength ordering remains unproven. Defer broad calibration until functional coverage warrants it. |
| Multiplayer | Broader disconnected/abandoned-seat recovery, unattended continuation and network-failure acceptance, while preserving authoritative versioning, custody, privacy and saves. |
| Components and experience | Full component inventory/text verification, all readable inspectors, original artwork, animation/sound/accessibility/mobile polish, complete internal guidance and end-to-end human play. |

[AI calibration](AI_CALIBRATION.md), [multiplayer audit](MULTIPLAYER_AUDIT.md),
[component inventory](COMPONENT_INVENTORY.md) and [visual playtest](VISUAL_PLAYTEST.md)
record their measured scope. [README](../README.md) retains publication gates.

## Working sequence and preservation

Prototype every remaining function in dependency order, using existing controls,
legal AI and the saved-state model. Continue independent functions while material
rulings are pending. Then run integrated games, repair failures, deepen combination
and recovery coverage, calibrate AI and polish. Keep focused checks for crashes,
deadlocks, legality, custody and privacy; complete required broad checkpoint checks.
Use selective subagents and independent review for complex rules/privacy/persistence.
Commit and push verified checkpoints under **“Push all from now on”**, verify push
success, and stop pursuit at **80% weekly usage consumed** with the goal unfinished.

The user-authorized 13 September reset happened once; preserve all games created
since it. Keep `.wrangler/state`, credentials and private backup artifacts out of
Git. Reuse a healthy server; restart only for a relevant change or observed problem,
with a fresh backup, safe human-play boundary and verified restoration. No hourly
restart or recurring maintenance automation is installed; do not recreate one.
