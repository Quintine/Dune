# Current development status

Updated 29 September 2026. **The full twelve-faction goal is unfinished. Basic
is playable and the six classic factions have a user-authorized Advanced preview.
Expansion starts and full rules/publication acceptance remain gated.**

## Current checkpoint and work

A five-seat Advanced combined Homeworld/Nexus/expansion sample exposed two
known-unsupported Ecaz Ambassador/Moritani Terror shipment candidates from
Tleilaxu's own Homeworld. [AI arrival preflight](BOT_ARRIVAL_PREFLIGHT.md#29-september-homeworld-sourced-shipment-overlap)
now excludes them using only public entry reactions. The same genuine game
completed with 786/786 legal attempts and 21 JSON continuations; this is a
candidate-legality repair, not support for the combined arrival or a public
expansion start. The source is not in the last verified live image.

Six fixed paired-expansion Basic/Advanced [game samples](IMPLEMENTATION_STATUS.md#29-september-2026--paired-expansion-game-samples)
at `b9c8b74` completed with 4,641 legal actions and 122 JSON continuations.
They do not establish complete faction effects, module combinations or
release readiness.

Five Basic Moritani plus Leader Skills [game samples](IMPLEMENTATION_STATUS.md#29-september-2026--moritani-leader-skills-samples)
across two through six seats at `29aedf1` completed with 2,013 legal actions
and 53 JSON continuations. This is sampled playable coverage, not complete
skills, Advanced or optional-module acceptance.

A bounded [Ecaz Ambassador/Moritani Terror same-entry continuation](MORITANI_ENTRY_TIMING.md#selected-bounded-overlap-order--29-september-2026)
now snapshots both original optional triggers and offers their owners sequential
choices in current storm order on classic plus Ecaz/Moritani Basic/Advanced
tables. This order is a conservative provisional table interpretation, not
a publisher ruling. The original shipment, move or Fremen worm ride transfers
forces only once; JSON/SQLite recovery keeps token custody private and proceeds
to the second owner even after the first declines or resolves a supported effect.
A summoned worm during the overlap retains its Nexus before the queued ride;
Robbery overflow and Sabotage discards preserve physical custody. The table
shows public owner order without disclosing the hidden Terror face; existing
owned controls and minimal legal AI remain usable. Competing BG Intrusion,
Fremen/Guild Ambassador child arrivals and optional-module combinations remain
gated, as do normal public expansion starts. The bounded Atomics path below
does not open these overlap combinations. This source is not in the last
verified live image.

A bounded [Guild native rate Karama path](GUILD_RATE_KARAMA_RULES.md#native-transport-extension--29-september-2026)
now interrupts classic Guild/reciprocal-ally ordinary reserve shipments and
eligible cross-planet transport before payment, including Guild's own return
to abstract reserves and allied Fremen southern-reserve transport. Canceling
the rate charges normal destination price for the **exact saved force group**
and original approved funding split; return costs one spice per force under
the documented conservative doubled-tariff interpretation. If the group or
split cannot complete, Karama is spent but the declaration returns unused and
a replacement uses full price this turn. Saved typed custody, a legal AI path,
SQLite CAS recovery and local read-only browser previews of the cancel control
and replacement quote are connected. Guild income, transport permission and
independently purchased Karama rates remain separate. Optional-module and
Homeworld rate cancellation remain gated; this code is not in the verified
live image below.

Moritani Extortion now has a bounded local reveal-to-Mentat continuation:
five bank spice stays reserved until Moritani finishes normal Terror placement
and any Karama response; then non-Moritani seats in storm order may pay three
once or decline. Payment removes the revealed token; all declines rotate it
back into hidden supply. The [placement-first order](MORITANI_EXTORTION_RULES.md)
was selected by the user, not sourced as a publisher priority ruling. Public
notices hide the current payer's affordability from other seats. Owner controls,
legal AI, JSON/SQLite CAS, nested Box/gift interruptions and a genuine late
Mentat Ambassador entry have focused coverage; each still settles before the
turn ends. A separate bounded classic-plus-Moritani Atomics path now records
public Aftermath with permanent shipment prohibition and a one-card hand-limit
reduction for Moritani and its ally at activation; later alliance changes are
gated pending a ruling. Complete expansion starts stay gated. These local
changes are not in the last verified live image below.

The live NAS Apps `dune` image is the immutable
`ghcr.io/quintine/dune:sha-c9a3625ff2a9ddafdbc08e64de809eca6029db85`
from successful container workflow `36358270534`. The public footer's title and
accessibility name show that full revision; visible text shows `c9a3625`.
After the update, owner sign-in succeeded and nine existing rooms remained,
including a playing room at version 54. A fresh 0600 online SQLite backup in
the persistent app volume passed `PRAGMA quick_check` before the update. The
earlier temporary remote plaintext owner key and provisioning SQL were removed.
Private saved-seat reconnection, complete historical-data comparison and live
Diplomat retreat gameplay were not exercised; its local behavior is verified,
not production gameplay-proven.

The bounded Discovery Orgiz Collection transfer is connected in current local
source for Basic/Advanced, with an automatic public log and saved continuation.
It treats each positive collected board deposit as one observable blow, a source
inference pending a publisher clarification. A focused engine/browser/SQLite
checkpoint is in [Discovery prototype](DISCOVERY_PROTOTYPE.md); this code is
not yet in the live `c9a3625` image. Contested/shared transfers and full
Discovery release acceptance remain gated.

Checkpoint `209fb18` was pushed and its matching container workflow
`36359970371` completed successfully. The dedicated deployment agent could not
enter TrueNAS Apps because the host desktop was OS-locked; it made no NAS change,
backup or post-rollout claim. Production remains at the last verified `c9a3625`
image until the Apps session is unlocked and this exact image is deployed.

An owner-only [room-backup prototype](ADMIN_BACKUPS.md) now captures, lists and
downloads immutable private snapshots with live authorization, unchanged room
versions and append-only capture/export receipts. The per-room size/storage
limits, missing import/restore and absent unified action-history entries keep
the saved-game operations gate open. Local isolated capture/export and a
signed-out browser denial passed; this is not deployed evidence.

The owner-only [read-only operations sample](ADMIN_PANEL.md) now exposes the
build revision, saved-room and active-seat counts, lifecycle flags, invalid
JSON room counts, latest room write and backup/export usage. Live SQL owner
authorization and desktop/mobile local UI checks passed. It does not inspect
SQLite integrity, disk space, stalled turns or restore safety; no live NAS
deployment or production administrator acceptance is claimed.

Current work adds [action history](ADMIN_ACTION_HISTORY.md): a searchable,
paginated view of nine durable admin receipt sources with public before/after
settings. Owners/operators receive operational reasons; viewers do not. Queries
preserve live authority and reject private or malformed metadata from search.
Failed-attempt coverage, operational health and the remaining full admin scope
are still unfinished.

Discussion checkpoint `160fdc1` is pushed. Types/lint, 5,431 offline tests,
52 HTTP tests, build, twenty-four administrator HTTP groups and desktop/mobile
browser checks passed; all 2,230 baseline games and 4,746 seats were preserved.
Its container workflow `36218058095` succeeded; the later NAS Apps deployment
and current live revision are recorded above.

The bounded [Fremen Nexus Cunning](NEXUS_FREMEN_RULES.md#connected-native-cunning-path)
prototype connects an initially empty worm's public offer, one spent private
card, a Karama response, a typed remote ride after the Nexus, human controls
and minimal legal AI in classic-faction Nexus-only games. Basic/Advanced
natural continuation, an additional-worm placement and an actual Advanced
special-Karama summon retain their physical parent, response and native-then-
remote ride order across JSON/isolated SQLite recovery and duplicate CAS.
Natural and summoned offer/ride browser surfaces were exercised. Review found
and fixed an inherited-key force-custody bypass. A second Cunning offer
inside an interrupted control, Great Maker, combined modules, Secret Ally
protection and complete Nexus games remain gated. The bounded Atomics reveal
is a separate classic-plus-Moritani path, not a playable Nexus Terror effect;
its later-alliance hand-limit policy is unresolved.

The bounded [Fremen Nexus Betrayal alternatives](NEXUS_FREMEN_RULES.md#bounded-betrayal-movement-and-worm-riding)
let an unallied holder spend the physical card either before the first Spice
Blow to prevent Fremen worm rides for that turn, or before Fremen move in
Shipment and Movement to suppress their native two-territory advantage.
Worm destruction/protection and Nexus still resolve; independent movement
bonuses remain available. One saved card cannot use both modes, even if
recycled later that turn. Owner controls, prioritized legal bot play,
Basic/Advanced JSON and authenticated concurrent SQLite continuation are
connected. Post-appearance Betrayal timing and combined modules remain gated;
no public Nexus gate changes.

The bounded [Ecaz Nexus Betrayal](NEXUS_ECAZ_RULES.md#bounded-betrayal-runtime)
path lets a card holder select one public territory shared by Ecaz and its
ally before the first Shipment and Movement turn advances. One spent card,
a provisional Karama response and exact typed ally-force return are wired
through human controls, legal bot action, JSON and in-memory SQL continuation,
and focused gameplay, race and restart tests. A local browser fixture rendered
the holder-only offer and rival Karama notice without writing a room. The
Secret Ally inquiry has a bounded private prototype; its native-leader
scope/answer audience and combined modes remain release gates.

The bounded [native Ecaz Nexus Cunning](NEXUS_ECAZ_RULES.md#bounded-native-cunning-duke-vidal)
prototype spends the one card to take the existing living Duke from Moritani
at a quiet Battle boundary in paired Ecaz/Moritani Nexus games. Owner controls,
legal AI, ordinary battle selection, temporary end-turn custody and signed
saved continuation are connected in Basic/Advanced outside Advanced Harkonnen
tables, where the battle path cannot select Duke. Captured, dead and Ghola
destinations and all combined modules remain gated. The Battle-only timing
is a documented product boundary rather than printed phase text. This code
is not yet in the live image.

The bounded [Ecaz-only Duke revival](ECAZ_REVIVAL_RULES.md#selected-product-interpretation-28-september-2026)
returns the existing dead shared disc alive and set aside after ordinary paid
revival or a Ghola card. The user selected this custody interpretation; it is
not a publisher clarification. Five spice (three with the existing Tleilaxu
alliance discount), stop/cancellation windows, first five-in-Tanks cohort,
owner choices, legal AI and JSON/SQLite continuation are connected. Further
six-disc native cycles, exceptional custody and Advanced Harkonnen remain
guarded; no complete Ecaz start is certified.

The bounded [Mirror Weapon battle path](MIRROR_WEAPON_ENGINE_AUDIT.md#user-selected-cleanup-interpretation-28-september-2026)
admits the canonical physical card in CHOAM/Richese-deck Basic/Advanced
classic/CHOAM/Richese battles without combined optional modules. Effective
copied attacks, copy-first Tooth/Stone choices, public Stone feasibility,
saved custody, human controls and legal AI are connected. A victorious
physical Mirror can be kept even after a copied activated Tooth or Artillery
attack under the user's interpretation, not a GF9 clarification. Combined
modes and full Richese starts remain gated. Neither new path is in the
verified live `c9a3625` image.

The bounded [Bureaucrat/Tleilaxu revival payment](BUREAUCRAT_PAYMENTS.md)
path adds the Basic Tleilaxu/Leader Skills profile's actual single-payer
revival prices to the skill's post-Karama redirection. Paid custody, separate
free-revival income, private negotiated amounts, owner controls, four legal
AI policies and concurrent SQLite continuation are connected. Other expansion
payment families, gifts and combined modules remain gated; this is not a
complete Leader Skills or Tleilaxu certification.

The main page
labels its build's Git commit in the lobby and active-table masthead; local
Git HEAD does not represent uncommitted work. The main-branch container
workflow publishes an image but does not deploy the live site automatically.

Current work adds [discussion moderation](ADMIN_DISCUSSION.md): owners/operators
can mute or unmute new public/private messages from a human seat. History,
incoming messages, game state and credentials remain saved; the setting follows
recovery/handover. Atomic authority/version fences, durable audit and exact
admin/message retries are connected. This is partial participant support;
access revocation, participant removal, assisted recovery, permanent deletion,
bulk actions and backup/operations tools remain unfinished.

[Participant AI](ADMIN_PARTICIPANT_AI.md) checkpoint `2cddf03` is pushed. Types/lint,

Earlier [complete-game integration samples](IMPLEMENTATION_STATUS.md)
finished 62 genuine games: Basic Leader Skills with Tleilaxu, Moritani,
Ixians or CHOAM; Basic/Advanced classic Homeworld + Nexus; all three paired
faction-expansion + Nexus profiles across two through six seats; and two
six-seat all-expansion games. All 29,333 actions were accepted, with 765
JSON/private-view restorations and unchanged source fingerprints. Rare effects
not encountered naturally and all public release gates remain unverified.

Four further [all-expansion Nexus samples](IMPLEMENTATION_STATUS.md)
completed genuine five/six-seat Basic and Advanced games: 4,098 accepted
actions, 109 JSON/private-view restorations, unchanged source fingerprints
and five Nexus Card draw/keep decisions in the five-seat games. No Nexus
effect was played in those samples; card-specific combinations and public
expansion/Nexus starts remain gated.

Four more [all-expansion Homeworld/Nexus samples](IMPLEMENTATION_STATUS.md)
completed five/six-seat Basic and Advanced games with 2,800 accepted
actions, 74 JSON/private-view restores and unchanged source fingerprints.
Five-seat tables drew/kept three Nexus Cards and used real Homeworld
deployment decisions. Eight proposed entries were rejected by the existing
Ecaz Ambassador/Moritani Terror overlap gate; bots found alternate actions
and completed. Their unresolved priority and all public mode gates remain.

The bounded [native Richese Nexus Cunning shipment](NEXUS_RICHESE_RULES.md#bounded-native-cunning-prototype-27-september-2026) now uses two distinct physical No-Field tokens in one priced shipment in genuine Richese/CHOAM paired Nexus games. One token immediately reveals a reserve-capped public force group; the other remains concealed. Owner-only controls, four legal AI profiles, Karama/Guild responses, signed saved receipts and concurrent in-memory SQLite settlement are connected in Basic/Advanced. A read-only local browser fixture displayed the owner selector and no rival private panel. Same-shipment nonrepeat is a documented product interpretation; faceup-component artwork, combined modules, Betrayal and full Nexus acceptance remain gated. This code is local and not in the last verified production image.

The independent [Reinforcements Battle Plan prototype](REINFORCEMENTS_RUNTIME.md)
connects its physical card in either slot for Basic/Advanced classic-faction
games without other optional modules. Three own reserve counters enter the
Tanks, +2 affects normal battle score only, and the card is discarded on all
revealed outcomes. Owner-only availability, controls, legal AI, private
inspection and saved continuation are connected. Traitor/explosion payment,
normal-first elite selection and battle-loss accounting remain explicitly
provisional interpretations, not a publisher or user ruling; full variant and
public mode gates remain closed. This source is not in the live image.

The bounded [Emperor Nexus Secret Ally bank-auction purchase](NEXUS_EMPEROR_SECRET_ALLY_RUNTIME.md#bank-auction-purchase-alternative)
connects the separate retained-price alternative in Basic/Advanced
classic-faction Nexus-only games. An unallied winner proves the final bid from
their own spice, keeps it, takes the physical Treachery lot and spends the
Nexus; owner controls, legal AI, signed history and saved SQLite continuation
are wired. Every eligible winner receives the same payment confirmation
regardless of hidden card custody; this privacy-preserving timing is
**provisional**, with the prior user question still pending. Seller payments,
allied splits, non-Bidding sources, Betrayal and complete Nexus remain gated.
This source is not in the live image.

5,408 offline tests, 52 HTTP tests, build, twenty-two administrator HTTP groups
and desktop/mobile browser acceptance passed. Deployment delivery was
unconfirmed at that checkpoint; the current production revision is recorded
above. No strategic AI refinement was added.

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

Remaining native Ecaz/Moritani effects, repeated six-disc Duke cycles and Richese
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
Burner timing question is pending; no user answer is assumed. The separate
Reinforcements prototype has its own provisional timing and cost boundary.
Neither prototype opens variant, mode or publication gates.

The preceding [early Sapho aggressor](SAPHO_AGGRESSOR.md) connects the
printed battle-priority effect during the existing shared pre-plan opportunity.
Physical attacker/defender/chooser stay stable; Habbanya takes precedence in either
slot. Shared priority feeds Stone admission, ordinary/Stone resolution, public
controls and all four AI profiles. Battle-bound history survives private saved
continuation. Later intervention remains unfinished; no new ruling is assumed.
Final checks, samples, browser evidence and delivery belong to the source-bound
private report and Git message.

The earlier [Mirror admission review](MIRROR_WEAPON_ENGINE_AUDIT.md) flagged
copied-attack choice and physical-card cleanup gaps in genuine Richese decks.
The user subsequently chose ordinary winner retention for the physical Mirror,
and the bounded Basic/Advanced battle path above now handles copy-first choices.
Full Richese starts and combined-module play remain gated; the former blanket
admission block does not apply to the connected profile.

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
| Leader Skills | [Common lifecycle](LEADER_SKILLS_RUNTIME.md), [known skilled capture](LEADER_SKILLS_CAPTURE.md), [Mentat question preview](MENTAT_QUESTION.md), [Bureaucrat payments](BUREAUCRAT_PAYMENTS.md), five battle disciplines, [Planetologist](PLANETOLOGIST_RULES.md), [Suk Graduate](SUK_GRADUATE_RULES.md), [Rihani and other battle effects](LEADER_BATTLE_EFFECTS.md), [Smuggler shipment](SMUGGLER_SHIPMENT.md), [No-Field](SMUGGLER_NO_FIELD.md) and [battle collection](SMUGGLER_BATTLE.md), [Sandmaster routes](SANDMASTER_MOVEMENT.md) and [worm rides](SANDMASTER_WORM.md), [Banker spending](SPICE_BANKER_RUNTIME.md), [Diplomat defense](DIPLOMAT_DEFENSE.md) and [bounded retreat](LEADER_SKILLS_RULES.md#bounded-diplomat-retreat-interpretation). Remaining bands and combinations are explicit in those contracts. |
| Discoveries | [Prototype](DISCOVERY_PROTOTYPE.md): genuine setup, Great Maker, seven cards/eight tokens, inspection and stash rewards, nested sites, signed later free entry, carried Ornithopter, sole Cistern, bounded Orgiz transfers, Jacurutu income, Testing Station and Shrine. Orgiz's per-deposit interpretation, contested/shared benefits and mixed physical allocation remain provisional or pending. The Orgiz path in current source is not yet deployed. |
| Nexus/Homeworlds | [Decision index](RULE_DECISIONS.md) links each integrated faction family, native/borrowed effects, physical custody, private choices, payments and transport. [CHOAM Secret Ally trade and bounded after-victory inspection](NEXUS_CHOAM_SECRET_ALLY.md), [Moritani Secret Ally losing-card retention](NEXUS_MORITANI_RULES.md#secret-ally-losing-card-retention-prototype), [Ecaz private yes/no traitor inquiry](NEXUS_ECAZ_RULES.md#bounded-secret-ally-traitor-inquiry-runtime) and [Emperor extra revival](NEXUS_EMPEROR_SECRET_ALLY_RUNTIME.md) are connected. Uniform CHOAM winner/Moritani loser windows and Ecaz inquiry scope/audience are explicit product inferences, not publisher rulings; Emperor purchase remains pending. A source audit or helper alone is not a completed effect. |
| Truthtrance | [Spice facts](TRUTHTRANCE_SPICE_FACTS.md), [card counts](TRUTHTRANCE_CARD_COUNT.md), [hand inventory](TRUTHTRANCE_HAND_INVENTORY.md), [recorded knowledge](TRUTHTRANCE_KNOWLEDGE.md), and [Basic/no-Guild Advanced reserve-shipment promises](TRUTHTRANCE_SHIPMENT_PROMISES.md) use authoritative private state. Earlier readiness audits do not supersede these follow-ups. |
| Other cards | [Sapho runtime](JUICE_OF_SAPHO_RUNTIME.md) includes first among remaining unstarted movement turns after Advanced Guild has finished. [Recruits](RECRUITS_RUNTIME.md) connects clean Revival play; [Harass & Withdraw](HARASS_WITHDRAW_RUNTIME.md) and [Reinforcements](REINFORCEMENTS_RUNTIME.md) connect bounded battle effects in the same independent three-card preview. Richese card contracts and the checklist identify other connected effects and explicit gaps. |
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
