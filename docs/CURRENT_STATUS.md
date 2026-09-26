# Current development status

Updated 26 September 2026. **The full twelve-faction goal is unfinished. Basic
is playable and the six classic factions have a user-authorized Advanced preview.
Expansion starts and full rules/publication acceptance remain gated.**

## Current checkpoint and work

Current work adds [participant AI support](ADMIN_PARTICIPANT_AI.md): a live
owner/operator can enable an existing AI difficulty for an eligible human in a
paused, started game. Saved custody and seat access remain; the human can take
back control, and resume is separate. Atomic audit, exact saved retries and
commit-time room/seat/authority checks are connected. Participant restrictions,
access revocation, assisted recovery, permanent deletion, bulk actions and
backup/operations tools remain unfinished. This adds no strategic AI refinement.

Readable-notice checkpoint `137f922` is pushed. Types/lint, 5,381 offline tests,
52 HTTP tests, build and delayed-response desktop/mobile browser QA passed.
Its new-revision deployment handoff is pending confirmation.

The [readable-notice follow-up](READABLE_NOTICES.md) extends first-request progress
to admin operations, AI permissions and seat handovers, preventing recovery
instructions from flashing before a successful response. Seat recovery/handover
confirmations remain above the table until Continue. Existing retry proofs and
rules/AI pacing are unchanged. New-revision deployed acceptance remains separate
from local checks; positive production admin testing still needs authorized access.

The connected [administrative archive/unarchive](ADMIN_ROOM_ARCHIVE.md) prototype lets
closed rooms leave the default directory without changing saved games,
credentials, discussion or AI deadlines. Unarchiving leaves play closed;
reopening requires unarchiving first. Exact saved retries and combined archive /
removal filters preserve recovery. Permanent deletion, bulk actions and full
participant/backup support remain unfinished.

Checkpoint `98b1b32` added [close/reopen](ADMIN_ROOM_CLOSURE.md) and passed types/lint,
5,356 offline tests, 52 HTTP tests and build, with seventeen administrator HTTP
groups and lost-response desktop/mobile browser QA. It is deployed on the NAS:
container verification passed, migration 0013 applied, all eight prior rooms and
ten seats were preserved, and public HTTPS/browser saved-seat restoration passed.
Anonymous admin routes remain denied. Positive production administrator acceptance
still awaits authorized QA access. Archive checkpoint `e918e2e` is also deployed:
migration 0014, integrity and public HTTPS/browser saved-seat restoration passed;
all eight prior rooms and ten seats were preserved. Its positive production
administrator acceptance remains pending the same authorization.

Checkpoint `238de38` added [recoverable removal/restoration](ADMIN_ROOM_REMOVAL.md)
and passed types/lint, 5,314 offline tests, 52 HTTP tests and build, with fourteen
administrator HTTP groups and lost-response desktop/mobile browser QA. It is
deployed on the NAS: container verification passed, migration 0012 applied,
all eight prior rooms and ten seats were preserved, and public HTTPS/browser
saved-seat restoration passed. Anonymous removal and other admin routes remain
denied. Positive production administrator acceptance remains pending authorized
QA operator access.

Checkpoint `c0cc4de` added [neutral administrator lobby configuration](ADMIN_LOBBY_CONFIGURATION.md)
and passed types/lint, 5,260 offline tests, 52 HTTP tests and build, with eleven
dedicated administrator HTTP groups and lost-response desktop/mobile browser QA.
It is deployed on the NAS: container verification passed, migration 0011 applied,
all eight prior rooms and ten seats were preserved, and public HTTPS/browser
saved-seat restoration passed. Anonymous creation, control and configuration
requests remain denied. Positive production administrator acceptance remains
pending authorized QA operator access.

Checkpoint `e7d4efc` added [administrator room creation](ADMIN_ROOM_CREATION.md)
and passed types/lint, 5,240 offline tests, 52 HTTP tests and build, with independent
review and eight dedicated administrator HTTP groups. It is deployed on the NAS:
container verification passed, migration 0010 applied, all eight prior rooms and
ten seats were preserved, and a saved seat restored through public HTTPS and the
browser. Anonymous administrator creation remains denied. Positive production
administrator acceptance still requires explicitly authorized QA operator access.

Checkpoint `8c922b4` added [pause/resume and joining locks](ADMIN_ROOM_CONTROLS.md)
and passed types/lint, 5,223 offline tests, 52 HTTP tests and build, with independent
review and dedicated local administrator/browser checks. It is deployed on the
NAS: container verification passed, migration 0009 applied, all eight prior rooms
and ten seats were preserved, and a saved seat restored through public HTTPS.
Anonymous administrator requests remain denied. Authenticated production admin
acceptance still requires the pending QA-access confirmation.

Checkpoint `f29d056` was pushed and deployed to the NAS instance. Readable
create/join progress and Continue notices passed actual HTTPS browser acceptance,
including mobile and saved-seat refresh; existing production records survived
the update. Administrator sign-in renders closed by default. Authenticated admin
production checks remain pending provisioning approval.

The [readable-notice fix](READABLE_NOTICES.md) replaces the flashing recovery
screen during ordinary room creation/join with concise progress. Actual recovery
instructions stay until resolved, and completed-action text waits for a local
Continue control. It does not add confirmation steps to game rules or AI turns.

Administrator access/directory checkpoint `c2d392e` passed types, lint, 5,196
offline tests, 52 HTTP tests and build, plus focused authenticated/browser checks.
Its authenticated production acceptance remains pending; the current deployment
preserves saved games and full administration gates.

The user added a complete [administration panel](ADMIN_PANEL.md) to the goal on
22 September: secure admin access, room creation/removal and lifecycle controls,
participant support, backup/restore, operational views and audited actions.
The first prototype now connects separate administrator sign-in, persistent
sessions/revocation and a searchable, filtered, paginated room directory at
`/admin`. Private game contents remain excluded. Operator provisioning and
recovery instructions are in the admin guide. Room creation, lifecycle/removal,
participant support, backups and operational controls remain unfinished; these
belong before full AI refinement/calibration. Existing rules, Git, subagent and
preservation requirements remain in force.

The goal also requires testing the deployed application at
**https://dune.procrastination.games**. Match the running revision, exercise
relevant real player/admin flows in dedicated QA rooms, and record deployed
results separately from local checks. See [production verification](VERIFICATION_WORKFLOW.md#verify-the-deployed-application).
This requirements update does not claim a new deployed test result.

Earlier completed rules checkpoint: `0f79f28`, [forced Harkonnen exchange return](HARKONNEN_EXCHANGE.md).
Types, lint, **5,150 offline tests**, **49 HTTP tests** and the production build
passed. One complete Advanced sample had no rejected actions across 158 actions
and four JSON restores. Browser inspection and exact refresh were checked;
full visual acceptance remains open. All 1,586 prior rooms and 3,354 human seats
were preserved; new QA/HTTP rooms brought the baseline to 1,626 rooms and 3,442 seats.

Current work exposes [Advanced preview](ADVANCED_PREVIEW.md) through normal room
creation and host lobby controls. It uses genuine setup, explicit unfinished-mode
start, renewed human readiness after mode changes, private seat restoration and
saved continuation. Six classic factions, existing Tech Tokens (3+ players) and
Stronghold Cards are admitted; expansion/module gates and pending rulings remain.
Focused engine, controls, retry and concurrent recovery checks are connected;
final independent review, browser, sample-game and required checks accompany the
Git checkpoint. Preview access does not certify complete rules compliance.

The [Sandmaster/HMS source comparison](SANDMASTER_MOVEMENT.md#21-september-native-hms-relocation-eligibility)
found no official clarification that passengers remaining in the interior
trigger collection from outside territories during native relocation. A ruling
question was sent; ordinary HMS relocation and force entry/exit remain working.
No extra collection is silently applied. The Bureaucrat/Emperor gift question
and the other recorded skill boundaries remain pending.

The reviewed remaining native Ecaz/Moritani effects, Duke revival and Richese
empty-cache auction arithmetic still cross recorded source questions. Native
Tleilaxu revival now creates its skill offer at successful commitment, including
automatic response chains; the former dependency is resolved in its Basic profile.
The `8f7a62c` policy checkpoint removed usage checks/cutoffs and deferred full AI
work until feature completion, followed by three adjacent 75% targets.

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
| Base/Advanced setup | [Normal Advanced preview](ADVANCED_PREVIEW.md), [genuine setup](ADVANCED_SETUP_TEST_SEAM.md), [Advanced study](AI_ADVANCED_SETUP_CALIBRATION_20260907.md), [Fremen cancellation](FREMEN_MOVEMENT_KARAMA_RULES.md), [Atreides full-plan audit](ATREIDES_FULL_PLAN_TIMING.md). Earlier Basic-then-flip fixtures do not establish current setup coverage. |
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
| Six-faction Advanced | Base gaps, provisional special-Karama outcomes, remaining timing audits and authentic multiplayer/browser acceptance. The user-authorized unfinished preview is available; setup matrices and complete samples do not certify full compliance. |
| Twelve factions and all optional modules | Every missing effect, remaining skill bands, Ecaz card variant, Kull Wahad, unfinished Richese cards, Terror effects, occupation entitlement, Nexus interactions, contested Discoveries and complete games across valid combinations. Detailed boundaries remain in the checklist/decision index. |
| AI | Maintain minimal legal participation and critical correctness fixes while game features are unfinished. Full implementation, strategy refinement and calibration wait until all non-AI features are complete; then target approximately 75% higher-tier wins for Medium/Easy, Hard/Medium and Brutal/Hard. See the [AI development plan](AI_DEVELOPMENT_PLAN.md). These targets remain unverified. |
| Multiplayer | Broader disconnected/abandoned-seat recovery, unattended continuation and network-failure acceptance, while preserving authoritative versioning, custody, privacy and saves. |
| Administration | Complete the [admin panel](ADMIN_PANEL.md): permissions, room directory and creation/removal, lifecycle controls, participant support, backup/restore and operational audit tools. Required before full AI refinement. |
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
