# Semuta Drug source update and implementation boundary

7 September 2026. Read `docs/SEMUTA_DRUG_ENGINE_AUDIT.md` in full, inspected the physical card again, checked current capacity/recovery code, and freshly searched publisher sources. No project runtime edits.

## User-selected full-hand exchange — 30 September 2026

The user selected **Allow exchange**: treat the acquisition and
Semuta disposal as one allowed atomic exchange, accepting its
temporary take-before-discard order at the faction hand limit.
The completed hand has the same count. This applies to ordinary
and Harkonnen limits; reserved mandatory incoming cards still
consume capacity, and an already overfull hand cannot claim.
This is a product ruling, not a newly found publisher FAQ. It
supersedes the earlier unanswered full-hand question and
provisional free-slot guard. Box and special Richese purchase
capacity are separate, unchanged boundaries.


## What is actually confirmed

The readable publisher card face at `/tmp/dune-rules/choam-semuta-reading.png` says to take a Treachery Card immediately after another player discards it, add it to hand, choose one when multiple cards are discarded together, and discard Semuta after use. Canonical card: `richese-semuta-drug`, Special. The [photographed component](https://cdn.anyfinder.eu/assets/QsUJtVktEC87xwK08oLlwnKyaozUWfuaLzG0LFEn67ENEEVgNrDGoITy3608Dqe7) and provenance limits are recorded in `docs/RICHESE_COMPONENTS.md`; this is visible publisher-authored text on an externally hosted photograph, not a newly located official FAQ or verified printing history.

Fresh official search retrieved [CHOAM/Richese p4](https://www.gf9games.com/dune/wp-content/uploads/2021/11/CHOAM-Rulebook-low-res.pdf): discard contents are private, and inspection requires permission from an effect. Local publisher-authored mirror text agrees. Fresh official search also retrieved [base p8](https://www.gf9games.com/dunegame/wp-content/uploads/Dune-Rulebook.pdf): ordinary maximum four cards applies at any time, while hand counts are public during Bidding. Harkonnen's faction limit still applies normally to that faction; Semuta does not itself print a new limit.

Direct official CHOAM PDF and [November 2020 FAQ](https://www.gf9games.com/dune/wp-content/uploads/2020/11/Dune-FAQ-Nov-2020.pdf) opens returned HTTP 403. Indexed publisher search furnished the two passages above. Searches for Semuta, Semuta Drug, full-hand, discard and relevant FAQ terms found no Semuta-specific publisher answer. Some broad searches returned other GF9 games, including the separate movie Dune game; these were excluded. Local Ecaz/Ix text searches found no Semuta reference. I could not freshly retrieve the historical audit's Harkonnen-exchange FAQ passage, and do not promote that earlier citation into independently reverified Semuta evidence.

**No newly found primary source resolves full-hand take-before-discard.** The user-selected atomic exchange above resolves the product policy, not publisher provenance. This is distinct from Sapho: Sapho is discarded before its holder later buys an auction card, whereas Semuta's face places acquisition before its disposal instruction.

## Target and effect contract

- Claim exactly one physical Treachery card from the fresh discard event. Ordinary, expansion, Worthless, Cheap Hero, used weapons, Karama and a newly discarded Box have no printed categorical exclusion. Leader discs, forces, tokens, Traitor/Face Dancer/Spice/Nexus cards are not Treachery cards.
- The discarded card must come from another player. For a forced discard, assigning `discardedBy` to the victim/former card controller rather than the HTTP actor is the natural composition of the rules; no new forced-discard-specific FAQ was found. Effect escrow such as an already played Ornithopter should retain its user's ownership metadata.
- For simultaneous multiple discards, choose one from that event, excluding the claimant's own contributions. Sequential discards do not become one batch merely because one server request produced them. Conversely iterating a simultaneous selected list does not create several independent claims.
- Taking the card does not undo the original effect: no refund of CHOAM sale earnings, reversal of battle losses, replay of a movement, un-cancellation of a power, or second purchase bonus. Keep original rewards and costs exactly once.
- Semuta is optional. Once legally used, transfer the selected exact discarded card to the holder, then discard Semuta. Keep other physical cards and their relative discard order. One singleton Semuta does not need a multiple-Semuta priority system.
- There is no printed phase limitation, alliance or consent requirement, spice cost, poison attack, or battle-only restriction. An unsupported producer is implementation coverage to finish, not a new prohibition on an entire phase.

These points follow the face and ordinary physical-card mechanics; they should not be labeled additional official FAQ answers.

## Timing and continuation requirements

Emit each semantic batch where the discard actually happens and before any subsequent draw/refill/removal can make it unavailable. Preserve exact card IDs, original owner IDs, permitted face visibility, event identity and a discriminated continuation. A discard-array diff at request completion is too late for discard-then-draw producers and misclassifies simultaneous versus successive events.

Battle cleanup must wait until retention decisions establish which cards were actually discarded. Winner-selected discards and later Moritani retention disposal can be separate fresh events; previously retained cards are not targets. A cached battle summary or old discard inspection is not a new opportunity. Used cards remaining physically reserved for another continuation are not yet freely claimable merely because a pointer also appears in `discard`.

The original effect's post-discard work must resume once after Semuta resolves or is declined, including empty-deck refills, paid Box completion, bonus draws, response cancellation and terminal phase transitions. A closure or full old `Game` snapshot is unsafe to replay because it can overwrite the newly claimed card or duplicate original rewards. An immutable event snapshot is evidence, not another physical copy. Refresh/retry/CAS must never reroll forced discard, re-pay, re-discard Semuta or award two targets.

“Immediately” requires a genuine opportunity before the continuation takes the card elsewhere. A nonblocking toast while the engine already draws/shuffles does not implement that timing. Conversely Semuta does not authorize suspending a transaction at an unrelated earlier stage or searching the entire pile.

## Privacy and automatic no-choice behavior

Before activation, show a neutral fresh-discard opportunity with only information already public about that event. The Semuta button and capacity explanation belong to its actual holder. Do not reveal hidden discarded faces, old discard contents, skipped player IDs, hand sizes outside existing rules, or a public label naming a secret holder. A holder must not receive repeated free previews of unknown fresh faces and then decline without using Semuta; commit first, then authorize only that batch's eligible faces. This is a privacy-preserving implementation of limited selection permission, not a claimed explicit FAQ about preview timing.

Once the card has been publicly committed, exactly one eligible candidate means automatic selection and completion. Multiple candidates are a real owner-only choice. An empty candidate set or stale/foreign card must reject before spending/inspection; corruption discovered after a persisted commitment must fail safely, not fabricate an alternative top-deck draw or silently erase the event.

**Pre-activation automatic absence is different.** If two otherwise identical public states differ only in who secretly holds Semuta or whether that hidden holder has space, making one pause and the other automatically advance discloses that hidden condition. Omitting a claimant name from the window does not fix this timing leak. Current `viewGame` exposes foreign hand count only in phase3; privately knowing the server's actual count does not authorize broadcasting eligibility by continuation timing.

Therefore:

1. Auto-close immediately only when impossibility is established by information public to all affected observers, or by explicit already-public activation/decline. Examples can include a module configuration where Semuta cannot exist or a verified public card-custody state establishing it is not in any hand; do not assume hidden cache/deck ownership is public.
2. Otherwise use the same neutral reaction-boundary lifecycle in paired hidden states, including automatic workers. Any timeout/continuation protocol must be driven by public event conditions and give a real opportunity to intervene. It must not wait only for a discovered holder or end early because that holder is ineligible.
3. Do not add a manual “confirm the only card” step after commitment. Do not claim an unrestricted hidden-hand-based auto-normalizer is privacy-neutral just because current Karama responses have existing automatic checks.

There is a genuine product/architecture tradeoff between guaranteeing an immediate reaction, having no public hand-dependent timing, and never presenting neutral waits when no hidden player can act. It cannot be solved by renaming a holder-dependent modal. This requires one consistent reaction protocol, not a rules question for every discard producer or a fabricated printed time limit.

Useful acceptance test: hold public state and clock/event progression fixed; replace the hidden Semuta with another hidden card, move it between hidden hands, and vary private free capacity. Until a real use is declared, unauthorized views and public auto-advance behavior must match. Test separately that a committed sole target finishes through normalizer/recovery with no owner acknowledgement.

## Smallest unresolved ruling set

The earlier full-hand question is now answered by the user-selected exchange above. Normal and Harkonnen completed hands must still fit their limits after accounting for reserved compulsory incoming cards.

The existing unresolved **Guild-stopped shipping-Karama refund** also constrains claiming that exact provisionally refundable card. Do not ask it again as a new Semuta question. Fence its competing custody or resolve the existing underlying ruling; this does not prohibit every shipment-phase Semuta event. Current Box guard in `game/engine.ts` near `:1209` already identifies this composition.

Do not ask again about normal targets, forced-discard owner bookkeeping, simultaneous selection, zero fee, automatic singleton selection or semantic batch implementation. Do not repeat the three pending Sapho questions. No new authoritative capacity/priority ruling was obtained by this review.

## 30 September 2026 — bounded clean-discard runtime

The explicit `semuta` development profile starts a fresh Richese roster
with CHOAM & Richese and optionally the physical Ix deck, or the bounded Basic
native Moritani entry described below, without opening public expansion starts.
It interrupts **clean public
ordinary-card, paid Box, retired Ornithopter, used Distrans, final
Truthtrance, four bounded Sapho scopes, pre-leader Residual Poison,
printed Karama canceling clean CHOAM Charity, Inflation or Bene
Gesserit Charity or settling a clean normal-auction lot, a completed
CHOAM sale or clean Kulon/proactive La La La/Baliset/ordinary
Trip to Gamont Worthless discard, accepted moving-storm Jubba
Cloak, battle and Ix-deck Thumper/Amal discards**, plus
a clean **private** normal-auction or Black Market Ixian ally replacement discard
before its draw, or native Sabotage/Robbery overflow after a clean ordinary
shipment/movement arrival in the Basic Richese/Moritani entry. Other
than the one explicitly suspended charity/Inflation response, the
parent transaction has no competing response. Every seat sees the
same neutral fresh-discard opportunity
regardless of hidden Semuta custody.

The Ixian ally discard belongs to the original buyer, not the Ixians.
Every seat sees the neutral offer without its face or a named claimant;
only a committed eligible holder takes the exact fresh card. A claim
removes it before the saved single replacement draw and subsequent
normal or Black Market settlement. The original buyer pays once, Richese receives
its original Black Market income once, and the sold card stays private until
an entitled committed claim. The native cache exclusion remains: the Richese
FAQ prohibits Ixian allied replacement of a cache purchase. Competing parents
and other private producers remain separate.

**11 October 2026 — Black Market composition.** The existing typed
`ixAllyCard` receipt now admits the clean Black Market Semuta offer before
replacement draw. Claim or all-seat decline completes one original replacement
and resumes Richese Declaration without replaying the sale. The focused
regression fails before and passes after; types/lint and 63 affected cases pass.
Twelve isolated engine scenarios cover all three auction methods, claim/pass,
four legal AI profiles, empty-deck refill and a full-hand exchange. At 390px,
the real private Commit control claims Hajr, gives the buyer one replacement
and restores Declaration; an uncommitted ally sees only the neutral Continue.
This is local changed-path evidence, not complete Semuta or deployed acceptance.

A clean CHOAM card sale commits its one named public discard and the
quoted two- or three-spice bank payment before the neutral offer.
Canceled or invalid sales leave the card in hand and have no fresh
batch. The saved receipt binds the exact sold card, optional duplicate
witness, earned spice and still-open market; claim or decline resumes
the market once without paying or discarding again. Nested card
responses and other sale families retain their previous paths.

A clean accepted Kulon Worthless response now places its named public
card in discard before the neutral offer. No movement bonus accrues
until claim or decline retires that event; the saved receipt binds
the original active mover, prior turn bonus, card and hand custody.
The same one-range effect then applies exactly once. Fixed-range
Ornithopter combinations, reactive movement parents and other
Worthless powers retain their original automatic paths.

A clean proactive or reactive La La La response also pauses after its named
public Worthless card cost but before blocking the selected
target's remaining free force revival. The saved receipt binds the
target and old Revival rules; claim or decline installs the block
once without replaying the response. Paid revival remains legal. A reactive
free-revival request is already stopped without revival or payment. Nexus
conversion and other Worthless contexts retain their automatic paths.

A clean proactive or reactive Baliset response pauses after its public
Worthless card cost but before restricting the selected player
from moving into the CHOAM-occupied territory. The saved
receipt binds that target, territory, current CHOAM occupancy
and existing restrictions. Claim or decline installs one
restriction without replaying the response. Shipment remains
legal. A clean ordinary declared move is already stopped without spending a
movement. Movement-card/Ambassador parents, Nexus conversion and competing
arrivals retain their original automatic paths.

A clean proactive ordinary Trip to Gamont response pauses after
its named public card cost but before moving one selected force
from a player's board sector to reserves. The saved receipt binds
the target, location and pre-return force custody; a claim or
decline returns that one force and reconciles occupation once.
Elite, concealed No-Field, closing Mentat, Nexus and competing
parents retain their prior automatic paths.

An accepted printed Jubba Cloak response pauses after its
public Worthless card cost but before the chosen CHOAM territory
is protected. The saved receipt binds the storm traversal,
territory and CHOAM forces. A claim or decline applies that
protection once and resumes the same storm casualty and
spice-clearance sequence. Canceled Jubba, Nexus conversion
and competing parents retain their original direct paths.

An early-ended Ornithopter advances the saved queue; a completed
flight may resume native Bene Gesserit Intrusion; Ecaz and Moritani entry
reactions remain separate. Distrans's gift remains private with its
recipient; Truthtrance answer/history and Sapho first/last order are
already bound. A clean Once Around Sapho discard commits its public
finite bidder order, retains prior bids/funding and frees the holder's
hand slot before the offer; the saved lot resumes without another
reorder. If Semuta itself is reserved as an offered Black Market card,
its owner cannot Commit, while every seat still sees the neutral offer.
A clean between-battles Sapho discard commits its finite chooser
priority after a resolved battle; claim or decline restores the same
unselected battle board without repeating that order change.
A clean pre-plan Sapho aggressor choice commits its
ordinary tie priority and physical card before the Semuta offer; the
unsealed battle's shared readiness then resumes without another
aggressor change.
A clean uninspected Residual Poison death with neither combatant ready
has already chosen one random physical victim and discarded the used
card before the offer. Claim or decline resumes the same pre-leader
preparation once; an inspected or partly ready battle retains the
automatic death path without this preview interruption.

For clean printed Karama cancellation of CHOAM Charity, Inflation or
Bene Gesserit Charity, the spent public card reaches the pile before
its accepted cancellation runs. The sole suspended response is bound
to the saved receipt; claim or decline resumes the same cancellation
once. CHOAM income or BG's extra allowance is withheld, while
Inflation retains its spent placement attempt without a token.
Worthless conversion, other cancellations, shipping and nested
Karama responses retain their separate automatic paths.

A clean printed Karama purchase of an unresolved normal auction lot
or free payment of an already won bid pauses after its public card
cost. The lot, bidder, bid, Richese round, deck and seating order
remain bound while every seat sees the neutral offer. Claim or decline
settles that same free transaction once; no second bid, spice payment
or draw precedes the offer. Richese lots and other Karama forms remain
unchanged.

For a genuine Ix-deck Thumper, its played physical card reaches
the discard before an injected worm or actual spice-card draw.
Semuta claim or all-seat decline resumes the one saved Spice Blow;
it neither injects a second worm nor replays any earlier effect.
Thumper without the Ix deck is not a physical card in this profile.

An Ix-deck Amal is already publicly discarded after halving every
personal spice amount and resetting previous phase-opening passes.
Semuta claim or all-seat decline restores that exact opening; no
auction pool, phase income or other opening work runs ahead or twice.

The first battle mandatory batch may contain public cards belonging
to both combatants. Its accepted result and card custody precede
the neutral offer; casualty allocation and winner cleanup still
follow it once. Mandatory winning-card cleanup, if present, is a
separate later batch; optional winner-selected disposal is later
again. No Semuta claim replays combat or combines these events.

Each seat can Continue; a canonical holder at or below the faction
hand limit with capacity for incoming reservations and a card
discarded by another player can commit. A sole eligible fresh card
transfers automatically in that same action.
Multiple eligible public battle cards open a committed, owner-only
inspection and exact one-card selection; the other cards remain in
the pile and Semuta is discarded once. The saved ordinary effect or
Box parent resumes once. No undisclosed face is projected before
commitment. Other simultaneous discard producers remain unfinished.

This neutral all-seat acknowledgement is a conservative **application
policy**, not a newly discovered publisher timing rule. Full-hand
Semuta uses the explicit user-approved atomic exchange; its completed
hand count is unchanged. Pending gifts, competing responses,
completed Ornithopter arrivals with Ecaz Ambassador or Moritani Terror,
pending battle rewards other than native Harkonnen capture and other typed
producers retain their automatic continuation; Semuta cannot claim those events
yet.
The completed Box's selected
search card stays private and its paid shuffle is not repeated
when another seat takes the used Box. No source ruling is inferred
from this omission. The
separate [reaction privacy audit](SEMUTA_PRIVACY_REVIEW.md) explains why
auto-closing only when nobody secretly holds the card would leak
possession. The main game and public expansion gates remain closed.

**11 October 2026 — reactive Baliset and La La La.** Accepted native
declarations now offer their used public card in the clean reactive paths too.
After the cost, the uncommitted ordinary move or force-revival request is
detached as already stopped; the existing typed receipt carries only
`stoppedMovement` or `stoppedRevival`, not a request to execute. Claim or all-seat
decline installs the original restriction and stopped-request notice once.
No forces, movement allowance, revival usage or spice payment were consumed by
the denied request. Another legal move or a paid revival remains available.
When another parent prevents the offer, the temporary pointer is restored and
the original automatic handler runs. Proactive receipts retain their existing
signature when the new optional marker is absent.

Both permanent regressions fail before and pass after, covering claim/pass,
unchanged request resources, retained restrictions, a legal alternate move or
paid two-force revival and retired-event rejection. Twenty-four isolated
runtime scenarios cover both effects, Basic/Advanced, claim/pass and four legal
AI profiles. Four additional printed-Karama cancellations retain the Worthless
and Semuta, open no Worthless discard reaction, and complete the original move
or free revival. The first cancel probe pinned absent-versus-null internal state;
its corrected assertion observes the actual public reaction instead.

Real GameTable at 390px uses Prevent movement, Commit Semuta, the unchanged
Imperial Basin source and the visible Carthag restriction, then moves one force
legally to Arrakeen and ends the turn with one movement. A second memory-only
case uses La La La, commits Semuta, displays zero free allowance and the actual
four-spice quote, then revives two paid forces to reserves19/Tanks1/spice6.
Neither surface overflows horizontally. The isolated Vite dependency reload
caused one browser-open timeout; the optimized server opened successfully
without restarting any existing service. Temporary scripts/server/browser are
removed or stopped; no saved store or deployed game was targeted.
Types/lint and 130 affected unit cases across seven files pass.

Nexus, movement-card/Ambassador and other competing parents remain separate.
This is bounded reaction coverage, not a new publisher cancellation/timing
ruling, complete CHOAM/Semuta or deployed acceptance.

**11 October 2026 — clean battle Distrans.** A completed clean private
Distrans transfer now offers its public used card during battle. Only the
battle-presence guard gained that existing receipt exception; transfer legality,
sealed plans and competing-parent exclusions are unchanged. The privately given
card is already held by the recipient and never becomes a fresh discard target.
A recipient holding Semuta may claim the used Distrans while keeping the gift.

The original permanent case fails before and passes after; the final regression
also covers the claimant being the recipient. Claim/pass preserves the single
gift, card conservation and original sealed opposing plan. Retired reaction and
original transfer replays reject; the recipient combatant may use the given
weapon in its next legal plan. Twenty-four isolated engine scenarios cover
Basic/Advanced, a separate recipient or the Semuta holder, claim/pass and all
four legal AI profiles. Each resumes legal planning with the same original
opposing plan and one exact gift. Temporary scripts are removed; no saved store
or deployed game was targeted. Existing human transfer, Semuta and planning
controls are reused; no new browser evidence is claimed here.
Types/lint and 69 affected unit cases across seven files pass.

**11 October 2026 — native Basic Terror discards.** The same local `semuta`
entry additionally admits fresh Basic native Richese/Moritani with classic
opponents, exactly CHOAM/Ecaz decks and no optional modules. Native setup remains
genuine; a persistent table warning explicitly qualifies Semuta and the Basic
Moritani arrival scope. Existing CHOAM/optional-Ix entries are unchanged.
Advanced Moritani, native Ecaz and Ix/E3 mixtures remain outside this entry.

Private Sabotage and Robbery-overflow `terrorDiscard` receipts now offer Semuta
after clean ordinary shipment/movement arrivals. The random victim or original
Robbery draw, removed token, payment and physical arrival already commit. Every
seat sees the same neutral response; no candidate face is shown before commitment.
Claim or all-seat decline restores the original optional Sabotage gift or closes
the existing Robbery overflow, never rerolling, drawing or arriving again.
Worm, Ambassador, advisor/Guild-transport, active Ornithopter and overlap parents
retain their automatic paths; this is implementation coverage, not a printed ban.
The existing Semuta printed face/FAQ source has no forced-discard or phase
exclusion; no new publisher timing or capacity ruling is asserted.

Two permanent native regressions fail at the old entry guard and pass after,
covering the private receipt, claim/pass, original gift/draw and token, conserved
cards and arrival resources, and retired-event/second-shipment rejection.
Thirty-six isolated engine scenarios cover both producers and shipment/movement,
claim/pass and all four legal AI profiles, with Sabotage gift acceptance/decline.
Each finishes the original turn with Carthag11 forces2/reserves18 and the original
movement count. Four rejected fresh-lobby probes cover Advanced, native Ecaz,
missing Moritani and an extra Ix family without mutating their inputs.

Real production GameTable at 390px displays the persistent preview qualification
and no candidate face, claims the private Stunner, restores Moritani's optional
Shield gift, then finishes the original Atreides turn to Richese with exactly two
Carthag forces and eighteen reserves. There is no horizontal overflow. The QA
adapter only switches seats around the real controls in memory; no saved store
or deployed game was targeted. Temporary scripts/server/browser are removed or
stopped. These are bounded prototype proofs, not complete Semuta/Moritani or
deployed acceptance.
Types/lint and 80 affected unit cases across eight files pass; actual CLI help
prints the entry without store access.

**11 October 2026 — paid battle Box.** A completed paid Nullentropy Box
search now offers the used Box during battle. Only the battle-presence guard
gained that receipt exception; payment, private acquisition, shuffled pile and
original battle already commit and remain unchanged. Claim or all-seat decline
restores clean planning without another search, shuffle or payment. Competing
parents retain their existing exclusions.

The permanent regression fails before and passes after, covering claim/pass,
exact two-spice payment, one recovered weapon, unchanged opposing sealed plan,
discard order, card conservation and retired-reaction/search replay rejection.
Twenty-four isolated engine scenarios cover Basic/Advanced, automatic sole-target
or explicit multiple-target selection, claim/pass and all four legal AI profiles.
Each commits the recovered weapon in the next legal plan while preserving the
original opposing plan and exactly one payment. Temporary scripts are removed;
no saved store or deployed game was targeted. Existing human search, Semuta and
plan panels are reused; no new browser evidence is claimed at this checkpoint.
Types/lint and 72 affected unit cases across seven files pass.

**11 October 2026 — ordinary battle Ghola.** The consumed Ghola now receives
the same Semuta offer during battle after its revival commits. Only the
battle-presence guard gained the completed ordinary Ghola exception; revival,
plan legality and existing competing-parent exclusions are unchanged. The
receipt already binds revived pieces and the original battle. Claim or all-seat
decline cannot revive again or change a sealed opposing plan.

The permanent regression fails before and passes after, covering a returned
leader, claim/pass, unchanged opposing plan, card conservation and rejected
retired-event/original-card replay. Twenty-four isolated engine scenarios cover
Basic and Advanced, leader or three-force revival, claim/pass and all four legal
AI profiles. Each resumes legal planning with the same opposing plan and
exactly the committed revival; force revival leaves Tanks0/reserves16. The
Advanced probe first needed the existing full-plan inspection declined before
readiness; no preparation bypass was added. No saved store or deployed game was
targeted. Human controls reuse the existing Ghola, Semuta and battle-plan panels;
this checkpoint's changed-path proof is engine runtime, not new browser evidence.
Types/lint and 101 affected unit cases across seven files pass.

**11 October 2026 — native Harkonnen capture suffix.** Mandatory and winner
battle discard batches now offer Semuta while the original Advanced Harkonnen
capture remains pending. Only the capture exclusion changed; the battle receipt
already validates that the winning Harkonnen, loser and territory match. Claim
or decline resumes original winner casualties and card cleanup before the same
capture offer. No captive is sampled until the original capture response ends.
Other pending battle rewards retain their separate exclusions.

The permanent regression fails before the guard change and passes after,
covering both discard producers, unchanged capture/cleanup order, settled
resources, card custody, retired-event rejection and one retained captive.
An isolated engine smoke covers both producers with claim, all-seat pass and
four legal AI profiles, then capture decline, retention and execution (36
scenarios). Execution adds exactly two spice compared with the same completed
decline path, without counting automatic Collection income as capture income.
Real GameTable controls at 390px claim the winner's Stunner, resume Capture a
leader, inspect the captive and retain exactly one before Collection; no
horizontal overflow. No saved store or deployed game was targeted.
Types/lint and the affected 97-case union across eight files pass.

**11 October 2026 — ordinary battle answer.** Ordinary definite Truthtrance
answers now offer the consumed card during battle. This includes unsubmitted
battle-plan promises, questions about submitted/revealed plans and fact questions.
Only the promise-kind admission and battle-presence exemption changed; promise
legality enforcement is untouched. A submitted or revealed plan binds no new
promise, but its consumed Truthtrance still receives the offer. Claim or all-seat
decline preserves the same plans, history and any binding promise.

The permanent promise regression fails before and passes after; the affected
union passes 126 cases and typecheck/lint pass. An isolated engine smoke covers
all four question/plan states with claim, all-seat pass and four legal AI profiles
(24 scenarios). It observes unchanged battle/history, retired-event rejection,
illegal-dial rejection and legal commitment after a bound promise, and subsequent
plan submission after the submitted-plan and fact answers. This is local
changed-path evidence, not complete Semuta or deployed acceptance.

**11 October 2026 — shipment-promise answer.** A classic payer's ordinary
Truthtrance shipment answer in the Richese Semuta profile now offers the consumed
card. The binding promise, public history and enforcement are unchanged; claim or
all-seat decline leaves the same obligation enforceable. To admit it, the
structured shipment-question scope gained the Richese Semuta profile for a
non-Richese active payer; the availability boundary is now server-projected
(`truthShipmentSupported`) so human controls and validation share it. Native
Richese/No-Field shipment questions and other module combinations remain outside
this admitted question scope.

The permanent regressions fail before and pass after. The affected union passes
125 cases and typecheck/lint pass. Eight isolated CLI scenarios cover both answers
across four legal AI profiles, plus a real 390px control check that the shipment
question is selectable for the active classic payer and refused for a non-active
Richese target. That control check does not independently prove an active Richese
boundary. This is local changed-path evidence, not complete Semuta or deployed
acceptance.

**11 October 2026 — queued Truthtrance answer.** An ordinary definite answer now
offers its consumed card while another question remains reserved. Only the
`remaining === null` software restriction changed. Promise-bound shipment and
battle answers still continued automatically at that checkpoint; the later
checkpoints above admit them. Shrine-source answers remain automatic. Claim or
all-seat decline restores the same remaining queue at `ask` once with history,
card custody and priority intact.

The permanent regression fails before and passes after. The affected union
passes 97 cases and typecheck/lint pass. Seven isolated CLI scenarios cover
claim/pass, four legal AI profiles and a rejected retired-event replay. This is
local changed-path evidence, not complete Semuta or deployed acceptance.

**11 October 2026 — native Intrusion suffix.** Final Ornithopter movement now
offers the retired public card to Semuta before native Bene Gesserit Intrusion.
Physical movement and counters have already committed; claim or decline resumes
the same arrival and optional fighter-to-advisor choice once. Basic still has
no Advanced Intrusion. Range3 and final two-group completion work; other entry
families and overlap guards are unchanged. This is the existing typed
discard-before-arrival composition, not a new publisher priority ruling.
Ten isolated engine scenarios prove claim/pass in both modes, Intrusion decline,
two-group completion and four legal bots. Real GameTable at 390px proves Commit,
the original Become advisors control and Finish shipment & movement advancing
to the next seat with unchanged force counts. Public/full-mode gates stay closed.
TypeScript/lint pass; the final affected union passes 113 cases. The regression
checks actual fighter counts rather than the incidental advisor marker shape.
