# Current development status

Updated 21 September 2026. **The full twelve-faction goal is unfinished. Basic
is playable; public Advanced and unfinished expansion/module starts remain
gated.** Prototypes do not open completion or publication gates.

## Current checkpoint and work

Latest delivered checkpoint: `de26aaf`, [Ecaz Loyalty](ECAZ_LOYALTY.md).
Types, lint, **5,012 offline tests**, production build and **49 HTTP tests** passed.
Six genuine faction-game samples completed with no rejected actions. A fresh
Advanced Ecaz/Harkonnen browser setup preserved the public set-aside card through
Traitor/force choices and refresh. All 1,539 opening rooms, 3,259 human seats and
auxiliary rows stayed unchanged; isolated QA/HTTP fixtures brought the baseline
to 1,579 rooms and 3,347 human seats. Screenshot capture timed out. The healthy
server was reused. Earlier checkpoints include `c2f24fc` for public faction sheets
and `e3cfd82` for private-hand browsing.

Current work: [revealed battle components](REVEALED_BATTLE_COMPONENTS.md) adds
public dials, leader portraits and readable used-card faces in one shared area,
with direct inspectors and navigation to pending decisions. Sealed plans and
private hands stay separate. Focused checks, independent review, browser QA and
final check/build/saved-preservation evidence accompany this presentation work.
The separate Bureaucrat/Emperor gift question is pending.
The `8f7a62c` policy checkpoint removed usage checks/cutoffs and deferred AI
refinement until feature completion, followed by three adjacent 75% targets.

The next concrete gameplay milestone is **Basic Moritani plus Leader Skills**
with base opponents and no other optional modules. A bounded current-code review
found no new Moritani-specific ruling, but widening setup alone is insufficient:
coordinate Banker, Diplomat, Sandmaster, Smuggler, Bureaucrat, Planetologist and
battle/victory public-profile guards, keep the full fourteen-card deck, and test
Terror leader death, skill return and revival through real continuations. Do not
hide unsupported cards after a random deal or claim complete combination support.
This provides a concrete dependency-ordered integration target for the next pass.

The reviewed remaining native Ecaz/Moritani effects, Duke revival and Richese
empty-cache auction arithmetic still cross recorded source questions; Loyalty is
now connected. For later Tleilaxu/Skills integration, create replacement offers
at successful native revival commitment: the current automatic response loop can
revive after the outer custody observer. This is a confirmed dependency in the
currently gated roster, not a demonstrated supported-profile defect; no synthetic
profile was enabled or labeled verified in this pass.

The [platform audit](AUTOPILOT.md#platform-audit-20-september-2026) found no supported
Sites scheduler or Durable Object provisioning contract. Durable unattended bot
resumption remains blocked on that capability; request/reconnect continuation
does not establish it. Preserve pending rules questions and mode gates.

The connected [Harass & Withdraw prototype](HARASS_WITHDRAW_RUNTIME.md) supports either
battle-card slot, private category inspections, exact undialed normal/elite
returns, opponent-Traitor cancellation, mandatory disposal, controls and all
four AI profiles. New battles also have [revealed physical allocation](HARASS_ALLOCATION.md) for
ordinary/elite mixtures and multi-sector returns. Richese card combinations
and additional optional modules stay gated. Withdrawal before explosion and
card-specific discard precedence are explicitly labeled inferences. The Stone
Burner timing question is pending; no user answer is assumed. Reinforcements
remains unfinished. This does not open variant, mode or publication gates.

The preceding [early Sapho aggressor](SAPHO_AGGRESSOR.md) connects the
printed battle-priority effect during the existing shared pre-plan opportunity.
Physical attacker/defender/chooser stay stable; Habbanya takes precedence in either
slot. Shared priority feeds Stone admission, ordinary/Stone resolution, public
controls and all four AI profiles. Battle-bound history survives private saved
continuation. Later intervention remains unfinished; no new ruling is assumed.
Final checks, samples, browser evidence and delivery belong to the source-bound
private report and Git message.

The [Mirror admission review](MIRROR_WEAPON_ENGINE_AUDIT.md) found that every genuine
Richese setup contains the unresolved copied weapons. Ordinary-only activation
cannot safely depend on hidden custody or alter the printed deck. Mirror remains
gated pending the existing disposal ruling and copied-choice work. Continue with
independent missing faction/card functions, then integrated play and refinement.

The Smuggler follow-up review supports a saved reveal-time receipt with settlement
only on leader survival, but located no official ruling on modified leader
strength. The user has been asked about Kwisatz/trainer/Stunner composition; no
answer is assumed. See the [source follow-up](LEADER_SKILLS_RULES.md#20-september-smuggler-follow-up).

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
| Expansion factions | [Ixians/Tleilaxu](IX_PROTOTYPE.md) and [all seven faction selections](EXPANSION_FACTIONS_PROTOTYPE.md): genuine setup, Ecaz six-force placement and [Advanced Loyalty](ECAZ_LOYALTY.md), separate optional card variants, private controls and saved per-lot Ixian/Richese decline. Actual special-lot exchange remains pending. |
| Leader Skills | [Common lifecycle](LEADER_SKILLS_RUNTIME.md), [known skilled capture](LEADER_SKILLS_CAPTURE.md), [Mentat question preview](MENTAT_QUESTION.md), [Bureaucrat payments](BUREAUCRAT_PAYMENTS.md), five battle disciplines, [Planetologist](PLANETOLOGIST_RULES.md), [Suk Graduate](SUK_GRADUATE_RULES.md), [Rihani and other battle effects](LEADER_BATTLE_EFFECTS.md), [Smuggler shipment](SMUGGLER_SHIPMENT.md), [No-Field](SMUGGLER_NO_FIELD.md) and [battle collection](SMUGGLER_BATTLE.md), [Sandmaster routes](SANDMASTER_MOVEMENT.md) and [worm rides](SANDMASTER_WORM.md), [Banker spending](SPICE_BANKER_RUNTIME.md), [Diplomat defense](DIPLOMAT_DEFENSE.md). Remaining bands and combinations are explicit in those contracts. |
| Discoveries | [Prototype](DISCOVERY_PROTOTYPE.md): genuine setup, Great Maker, seven cards/eight tokens, inspection and stash rewards, nested sites, signed later free entry, carried Ornithopter, sole Cistern, bounded Jacurutu income, Testing Station and Shrine. Orgiz and contested/mixed cases remain pending. |
| Nexus/Homeworlds | [Decision index](RULE_DECISIONS.md) links each integrated faction family, native/borrowed effects, physical custody, private choices, payments and transport. [CHOAM Collection trade](NEXUS_CHOAM_SECRET_ALLY.md) and [Emperor extra revival](NEXUS_EMPEROR_SECRET_ALLY_RUNTIME.md) are connected; CHOAM inspection and Emperor purchase remain pending. A source audit or helper alone is not a completed effect. |
| Truthtrance | [Spice facts](TRUTHTRANCE_SPICE_FACTS.md), [card counts](TRUTHTRANCE_CARD_COUNT.md), [hand inventory](TRUTHTRANCE_HAND_INVENTORY.md), [recorded knowledge](TRUTHTRANCE_KNOWLEDGE.md), and [Basic/no-Guild Advanced reserve-shipment promises](TRUTHTRANCE_SHIPMENT_PROMISES.md) use authoritative private state. Earlier readiness audits do not supersede these follow-ups. |
| Other cards | [Sapho runtime](JUICE_OF_SAPHO_RUNTIME.md) includes first among remaining unstarted movement turns after Advanced Guild has finished. [Recruits](RECRUITS_RUNTIME.md) connects clean Revival play; [Harass & Withdraw](HARASS_WITHDRAW_RUNTIME.md) connects the bounded battle return in the same independent three-card preview. Richese card contracts and the checklist identify other connected effects and explicit gaps. |
| Multiplayer | [Public and private discussion](TABLE_DISCUSSION.md), saved rooms/seats, [recovery](../README.md#saved-seats-and-reconnecting), uncertain-request retry, [own-seat AI](AUTOPILOT.md), [named-player AI permission](SEAT_AI_PERMISSION.md) and [voluntary seat handover](SEAT_HANDOVER.md) have connected controls and recovery evidence. |

## Remaining readiness

| Area | Remaining gate |
| --- | --- |
| Basic core | Ordinary Guild repricing/transport settlement, broader truthful commitments, unresolved special timing and integrated rules/human/AI acceptance. |
| Six-faction Advanced | Base gaps, provisional special-Karama outcomes, remaining timing audits and authentic multiplayer/browser acceptance. Setup matrices and complete samples do not open public starts. |
| Twelve factions and all optional modules | Every missing effect, remaining skill bands, Ecaz card variant, Kull Wahad, unfinished Richese cards, Terror effects, occupation entitlement, Nexus interactions, contested Discoveries and complete games across valid combinations. Detailed boundaries remain in the checklist/decision index. |
| AI | Maintain minimal legal participation and critical correctness fixes while game features are unfinished. Full implementation, strategy refinement and calibration wait until all non-AI features are complete; then target approximately 75% higher-tier wins for Medium/Easy, Hard/Medium and Brutal/Hard. See the [AI development plan](AI_DEVELOPMENT_PLAN.md). These targets remain unverified. |
| Multiplayer | Broader disconnected/abandoned-seat recovery, unattended continuation and network-failure acceptance, while preserving authoritative versioning, custody, privacy and saves. |
| Components and experience | Full component inventory/text verification, all readable inspectors, original artwork, animation/sound/accessibility/mobile polish, complete internal guidance and end-to-end human play. |

[AI calibration](AI_CALIBRATION.md), [multiplayer audit](MULTIPLAYER_AUDIT.md),
[component inventory](COMPONENT_INVENTORY.md) and [visual playtest](VISUAL_PLAYTEST.md)
record their measured scope. [README](../README.md) retains publication gates.

## Working sequence and preservation

Prototype every remaining function in dependency order, using existing controls,
legal AI and the saved-state model. Continue independent functions while material
rulings are pending. Then run integrated games, repair failures, deepen combination
and recovery coverage, and complete all non-AI features. Only then fully implement
and refine AI strategy and calibrate the adjacent difficulty pairs. Keep focused
checks for crashes, deadlocks, legality, custody and privacy; complete required
broad checkpoint checks.
Use selective subagents and independent review for complex rules/privacy/persistence.
Commit and push verified checkpoints under **“Push all from now on”**, verify push
success. The user removed the usage cutoff and routine account-usage checks;
efficient work, Git delivery and selective subagents remain required.

The user-authorized 13 September reset happened once; preserve all games created
since it. Keep `.wrangler/state`, credentials and private backup artifacts out of
Git. Reuse a healthy server; restart only for a relevant change or observed problem,
with a fresh backup, safe human-play boundary and verified restoration. No hourly
restart or recurring maintenance automation is installed; do not recreate one.
