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
Original unused Tech Tokens may also remain in the CHOAM/optional-Ix entry at
three through six seats, Basic or Advanced, under its existing native roster
prerequisites. Genuine setup and printed/first-Storm ownership remain native.
This does not add Tech to the separate Basic CHOAM/Ecaz Moritani entry or admit
other overlays, played-game conversion or public starts. Original Leader Skills
require the explicit option described below; the default entry is unchanged.

Advanced additionally preserves original unused Stronghold Cards at two
through six seats in the same CHOAM/optional-Ix entry. Combining original Tech
requires three through six. The existing native Stronghold initializer and
its shared roster predicate supply genuine setup; original first-Storm Tech
and final-Mentat Stronghold custody remain native. The six separate public
module cards never become Treachery discard candidates.

`--profile semuta --leader-skills` (or the initializer's explicit second
argument) composes original all14 training in native Basic Richese/CHOAM with
exact CHOAM, or Advanced E1/E2 with native Richese and selected CHOAM/optional
Ix decks. Original Tech/Advanced Stronghold prerequisites remain. This does not
open Basic Ix mixtures without their original Nexus envelope, E3,
Homeworld/Discovery/Banker, unapproved empty-hand/Moritani Mentat steps or public starts.

**Original Nexus composition — 11 October 2026.**

`--profile semuta --nexus-cards` delegates the original unused native Nexus
initializer; adding `--leader-skills` delegates its original all14 training.
Single or paired CHOAM and both selected E1/E2 native-family envelopes retain
their original roster, two-through-six-seat and component prerequisites.
Original Tech requires three or more seats; Strongholds requires Advanced.
No starting Nexus hand is added. Actual setup and first Storm precede a
qualifying Nexus, settled alliance and unallied closing draw.
Homeworlds, Discovery, E3, played-save conversion and public starts stay excluded.

CHOAM Secret Ally trade remains available only with CHOAM absent and the
holder unallied during Spice Collection. It spends the printed Nexus and
selected actual Worthless, paying two bank spice before the public fresh
discard. Semuta claim/pass completes that same receipt without paying again.

With native CHOAM seated, Betrayal spends an unallied rival's actual CHOAM
Nexus and commits one uniformly server-sampled held CHOAM Treachery Card.
The neutral Semuta opportunity retains its private fresh face until commitment;
the former CHOAM controller remains the discarder, even when a different
player invoked Betrayal. Claim/pass completes the same sampled receipt.
CHOAM receives no compensation and the random sample is never repeated.
Nexus cards are separate components and never become Treachery targets.

The five original native CHOAM Cunning effects also offer their exact arbitrary
Treachery fuel after allowance: Kulon, Gamont, Baliset, La La La and Jubba.
The original Nexus receipt has already completed, but the selected effect
and its original parent wait behind the fresh discard. An optional native
event binds owner/card/effect/targets without changing old printed receipts.
Fuel keeps its canonical category and private face; Commit does not transform
a projectile, defense or Special into a named Worthless. Claim/pass grants
one range bonus, one typed return/original closing owner, the stopped ordinary
move/free-revival restriction, or one native storm protection and suffix.
Jubba protects forces, not spice; original unprotected own/opposing losses remain.
Cancellation retains that fuel and leaves the played Nexus spent. Kull and
other competing parents remain separate. See
[five-effect evidence](NEXUS_CHOAM_RUNTIME.md#original-five-effect-semuta-composition--11-october-2026).

Printed Karama canceling one of the five ordinary native CHOAM printed or
Cunning powers also offers that distinct public cancellation cost before the
original denial completes. The declared CHOAM card remains held throughout,
and a played Nexus stays spent. Claim/pass restores the saved response,
cancels the effect once and completes its original ordinary movement,
free-revival, storm or closing-Mentat suffix. Taking Karama neither claims
CHOAM's retained fuel nor restores the denied effect.

A printed Karama canceling the Emperor's shared gift or extra allied revival
also offers that public cost before the denial completes. The canceled share
moves no spice, forces or revival; the ally link and extra-revival ledger stay
unchanged. Claim/pass restores the saved response and finishes one original
cancellation. The retired Karama is a genuine Semuta candidate for any other
player, is discarded once and is never replayed.






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

A clean proactive or final-Mentat Trip to Gamont pauses after its public card cost,
before returning the selected ordinary/elite physical force or performing the
native concealed No-Field reveal and capped recall. The receipt binds target,
location, exact counter type or marker event and pre-return custody. Claim or
decline applies the original selection once; a zero marker reveals without
inventing a force. Final Mentat restores the same owner decision before victory;
Nexus and competing parents remain automatic.

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
pending battle rewards other than native capture, Face Dance, quoted CHOAM
income or Auditor and other typed producers retain automatic continuation;
Semuta cannot claim those events yet.
The completed Box's selected
search card stays private and its paid shuffle is not repeated
when another seat takes the used Box. No source ruling is inferred
from this omission. The
separate [reaction privacy audit](SEMUTA_PRIVACY_REVIEW.md) explains why
auto-closing only when nobody secretly holds the card would leak
possession. The main game and public expansion gates remain closed.

**11 October 2026 — native Auditor/current-hand suffix.** Mandatory and
winner discard batches now offer Semuta with an original native audit pending.
Only its reward exclusion changed; frozen survival, opponent-used IDs,
calculation and private snapshot rules are untouched. Claim/pass restores
original cleanup/income ordering before the owner offer, then the current hand
supplies eligibility and the full payment price.

The available authorized supplied PDF, physical **p29 CHOAM E**, excludes cards
that the audited opponent used. The quote already records only those IDs; a
proposed broader all-combatant exclusion would have been wrong. A defense the
target acquires from the other combatant can remain eligible while its own
retained weapon is excluded. The original publisher URL now redirects and the
old temporary mirror is absent, so this check claims the authorized local text,
not a fresh publisher fetch.

Both permanent regressions fail before and pass after. Twenty-four isolated
runtime cases cover target/third-party Semuta holders at mandatory/winner
producers, claim/pass, all four legal Semuta AI profiles and pay/inspect.
The killed Auditor's actual one-card quote charges one or inspects the exact
current singleton; payment changes only the two balances, inspection preserves
hands and is visible only to CHOAM. Retired reactions/audit payments reject,
and the original market completes to phase7 without another payment or sample.

Real GameTable at 390px claims Snooper, retains the target's Crysknife, declares
the original audit and displays Pay1/Allow. Allow privately inspects only the
newly held Snooper; target/observer insight remains null, both held cards stay
intact, and the actual private inspector is readable. The original market
finishes with that snapshot intact at phase7's Ix opening, without horizontal
overflow. Temporary scripts/server/browser are removed or stopped; no saved
store or deployed game was targeted. Tech and other parents remain separate;
no complete CHOAM/Semuta or deployed acceptance is claimed.
Types/lint and 152 affected unit cases across twelve files pass.

**11 October 2026 — quoted CHOAM force-payment income.** Mandatory and
winner discard batches now offer Semuta while the native Advanced income quote
remains pending. Only that reward exclusion changed. The existing receipt
validates the original owner and positive amount; costs and income calculation
are untouched. Claim/pass leaves it unpaid through casualties and winner cleanup,
then restores the original allow/Karama response. Allow pays once; cancellation
sends that income to bank without refunding the original force payments.

The regression fails before and passes after, covering both producers,
claim/pass, preserved quote, allow/cancel, payer/casualty/card conservation and
retired-event rejection. The original quote rounds down half of each eligible
payment: this fixture's two paid support spice yield one income, not two.
Twenty-four runtime scenarios cover both producers, claim/pass and four legal
Semuta AI profiles followed by both allowance and printed-Karama cancellation.
The already-settled payer balance stays12 in both branches. The native phase6
CHOAM market finishes afterward; no second credit occurs before phase7's Ix
opening.

Real GameTable at 390px claims Crysknife, shows the actual one-spice unpaid
income with Allow/Cancel controls, allows it once (CHOAM spice2→3), then finishes
the original market and reaches the phase7 opening with spice still3. Claimed
card custody persists; there is no horizontal overflow. Temporary scripts,
isolated server and browser are removed/stopped; no saved store or deployed
game was targeted. Auditor remained separate at this checkpoint; the later
audit continuation above admits it. Tech and other rewards remain separate. This is
bounded income continuation proof, not complete CHOAM/Semuta or deployed
acceptance.
Types/lint and 119 affected unit cases across eight files pass.

**11 October 2026 — native Face Dance suffix.** Mandatory and winner
battle discard batches now offer Semuta with native Tleilaxu Face Dance pending.
Only that reward exclusion changed. The existing battle receipt already binds
the pending native owner, original winner and territory. Claim/pass preserves
casualties and winner-card cleanup before the same private opportunity; it
cannot replace an army early, repeat replacement or move the claimed card back.
CHOAM income was separate at this checkpoint; its later continuation above now
admits it. The later audit continuation above also admits Auditor; tech and
other reward exclusions remain separate.

The permanent regression fails before and passes after, covering both discard
producers, claim/pass, one replacement, original leader death, force and card
custody, and retired reaction/Face Dance replay rejection. Genuine mixed
CHOAM/Ix setup supplies the physical cards; a conserved traitor/Face Dancer
identity swap stages the matching winner without inventing a second card.

Twenty-four isolated runtime scenarios cover both producers, Basic/Advanced,
claim/pass and four legal Semuta AI profiles, then one native replacement.
Eight further native Face Dance AI cases cover all four profiles in both modes:
each uses its own matching card and legally replaces three survivors. The old
winner ends with reserves18/Tanks2 and no board group; Tleilaxu has board3,
reserves12/Tanks5, and the winning leader has one death.

Real GameTable at 390px claims the winner's Hunter Seeker before restoring
Tleilaxu's actual reserves/sector selector. Reveal Face Dancer replaces three
in Arrakeen10 and keeps Hunter Seeker in Richese's hand. Phase7's original Ix
opening remains; no premature collection settlement is claimed. No horizontal
overflow. Temporary scripts/server/browser are removed or stopped; no saved
store or deployed game was targeted. This is bounded continuation coverage,
not complete Semuta/Tleilaxu or deployed acceptance.
Types/lint and 117 affected unit cases across eight files pass.

**11 October 2026 — original final-Mentat continuation.** Gamont disposal
inside CHOAM's final opportunity now offers Semuta too. The receipt signs an
optional `mentat` marker and the still-pending native opportunity. Claim or
all-seat decline performs the original selected return, then restores
`choamMentat` for the same CHOAM owner. It never checks victory or advances the
turn itself; the original owner still chooses Finish and check victory.
Proactive receipt signatures are unchanged when this marker is absent.

The regression fails before and passes after. Genuine native Collection/Mentat
market, readiness and done actions create the final window. Without Gamont,
the same closing board gives Atreides a three-stronghold victory. With the
return and claim/pass, one force leaves Arrakeen, the same owner window remains
on turn2/Mentat, wrong-owner completion and retired reaction reject, and only
CHOAM's Done advances to turn3/Storm with no winner. The fixture first placed
its phase assertion before the market completion and used the wrong Tabr
sector; corrected actual progression and canonical sector14 require no rule
change.

Twelve isolated runtime scenarios cover Basic/Advanced, claim/pass and all four
legal AI profiles; the four profiles also complete the restored owner window.
Real GameTable at 390px uses Return this force, Commit Semuta, the restored
Finish and check victory control and actual turn3/Storm continuation. The game
stays playing and has no horizontal overflow. Temporary scripts/server/browser
are removed or stopped; no saved store or deployed game was targeted.
Types/lint and 82 affected unit cases across six files pass.
Nexus and competing parents remain separate; no complete or deployed acceptance
is claimed.

**11 October 2026 — elite and concealed Gamont targets.** The existing
receipt already signed target elite and No-Field custody, but stored neither
selection and resumed with a literal ordinary-force argument. It now carries
the selected elite flag or native marker event, validates the original
selection and resumes `completeChoamGamont` with those exact values. The native
return/reveal rules are unchanged; ordinary receipts keep their omitted defaults.

All three permanent regressions fail before and pass after. An Advanced mixed
Emperor stack loses only its selected elite: one normal remains, aggregate
reserves19 include all five elites, and revival usage is unchanged. Native
zero/three markers are deployed through actual shipment before the staged
Mentat case. They remain concealed during the offer; claim/pass performs one
native reveal and reserve-capped recall. With reserves2/Tanks18, zero returns
nothing and keeps reserves2; three materializes two, recalls one and leaves
board1/reserves1. Card custody and retired-event rejection remain checked.

Thirty isolated runtime scenarios cover Advanced elite and Basic/Advanced
zero/three targets, claim/pass and all four legal AI profiles. Real GameTable at
390px commits Semuta in all three target cases. The public force inspector shows
20 counters after the capped three reveal: board1/reserves1/Tanks18. Zero has no
board force and reserves2; elite leaves one normal on board and elite reserves5.
No surface overflows horizontally. The QA cases stage actual completed native
actions in memory; no saved store or deployed game was targeted. Temporary
scripts/server/browser are removed or stopped.
Types/lint and 163 affected unit cases across nine files pass.

Optional signature fields now serialize directly, and reactive stopped markers
are assigned without temporary spread objects. Absent optional fields are
omitted by JSON, preserving the prior ordinary/proactive signature shape.
Closing Mentat remained separate at this counter-selection checkpoint; the
later continuation above admits it. Nexus and competing parents remain separate.
This is bounded coverage, not complete Semuta/CHOAM or deployed acceptance.

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

**11 October 2026 — original native Tech reward.** Mandatory and winner battle
card discards now offer Semuta before the original winner takes one loser-owned
Tech Token. Every token and income ledger remains in place across the reaction.
Claim or all-seat decline completes original casualties/card cleanup, then
restores the same token choice before native Face Dance. The card claimant does
not inherit the award. No token is a Treachery discard target.

Eight isolated genuine lobby/setup/first-Storm scenarios cover both modes and
three through six seats. Twenty-four battle runtime scenarios cover both
producers, claim/pass and four legal AI profiles; sixteen also use the original
winner's legal Tech AI choice. Physical Treachery custody, casualties and one
award survive the native Face Dance decline suffix. Real GameTable at 390px
claims Hunter Seeker, offers Axlotl Tanks/Heighliners to Atreides, takes only
Heighliners, then restores Tleilaxu's Decline Face Dancer control. Phase7 original
Ix opening retains the card and all three owners with no horizontal overflow.
This is local changed-path evidence, not complete Semuta or deployed acceptance.

**11 October 2026 — native casualties and allied retention.** A completed
mandatory loser-card batch may now offer Semuta with the original compulsory
winning-card queue still reserved. Native Ixian casualty settlement and
one-for-one substitution keep their original position before the winning used
Tooth is physically discarded. That later Tooth is a separate fresh opportunity
before optional Shield cleanup, not an early target at the first reaction.
The pending Ixian-substitution guard remains: no actual discard was moved into
that active decision. Forty-eight runtime scenarios cover both modes, both
discard boundaries, claim/pass/four legal profiles and substitution/decline;
four more preserve the native rival Karama cancellation instead of substituting.
Actual 390px GameTable claims Snooper, confirms1/1, allows the original power,
retires the later Tooth offer and keeps Shield. The force inspector proves
Arrakeen1Suboid+1Cyborg, Tanks1Suboid, reserves17, with the claimed Snooper still
held at phase7 original Ix opening and no horizontal overflow.

The Basic native Moritani entry now offers its completed unkept-card batch,
plus preceding compulsory/optional winner batches while the original native
choose-stage retention remains pending. Existing canonical aftermath validation
and reciprocal alliance checks preserve the original choice. Kept/unrelated
cards and a newly Semuta-acquired winner card cannot enter its original pool.
Native Karama still finishes first; taking one fresh card cannot repeat the
choice, combat or bounty. `battleResolved` with pending retention, Advanced
native Moritani and Nexus retention remain separate. Thirty-four runtime cases
cover keep either/none, claim/pass/four legal profiles, both preceding winner
frames and original enemy/ally Karama allowance/cancellation. Real390px table
declines native retention, commits and privately selects Maula Pistol from the
two fresh cards, then reaches phase7 without re-offering retention or overflow.
These are local bounded continuation proofs, not complete Semuta/mode acceptance.

**11 October 2026 — printed native battle-cancellation costs.** The shared
response-discard pipeline now admits one `karamaBattleDiscard` receipt for
printed Karama canceling native Harkonnen capture, CHOAM Auditor or quoted
battle income, Ixian casualty substitution, or Basic native Moritani retention.
Only the activating physical Karama is fresh. Its accepted cancellation,
original response and pending native facts remain suspended until claim/pass;
retirement restores the saved controls and calls the original cancellation
once. Acquiring that cost cannot restore capture, inspection/payment, income,
the declared exchange or the proposed kept card.

The original native quotes still validate the pending opportunity. Signature
binding preserves its response, battle facts, physical counters, leaders,
wallets and hand custody; old charity/Inflation signature shapes are unchanged.
Auditor validation now recognizes the saved response inside this receipt,
rather than requiring the detached live window. No Skills, Nexus, Homeworld,
Worthless conversion, optional-module composition or public start is opened.

Forty-eight isolated runtime cases cover all five native families, both Ix
modes, enemy/ally retention cancelers, distinct and full-hand defeated holders,
claim/pass and four legal AI profiles. The cost is spent once, later native
Tooth/Shield or allied-card batches finish, inventories remain physical and
original costs/casualties stay committed. Canceled income remains unpaid;
Auditor cancellation samples nothing. Its original income precedes the audit
and already paid1 remains. Native capture cancellation reaches ordinary
Arrakeen Collection13→15, not a second capture/bounty.

Actual styled GameTable at390px completes all five Cancel with Karama →
Commit paths and original markets/cleanup. CHOAM wallets11/10 distinguish
already allowed pre-Auditor income from canceled income. Actual Ix inspection
shows board2Suboids, Tanks1Cyborg, reserves17 after the canceled exchange.
A Guild4/4 holder claims the cost and ends with only its original Worthless
and Karama2/4 after both played cards discard; retention is not re-offered.
The updated Semuta inspector is readable. The first isolated harness lacked
the app's Tailwind PostCSS plugin; that was corrected from `vite.config.ts`,
and all five styled paths were repeated. Earlier unstyled screenshots do not
certify styled presentation. No production dialog patch was needed.
These are local changed-path proofs, not complete mode or deployed acceptance.

**11 October 2026 — original Advanced Stronghold composition.** The fresh
Semuta entry now dispatches selected unused Strongholds through the original
native initializer, retaining optional original Tech. Original E1/E2 roster
eligibility is extracted once and reused by that initializer and Semuta
validation; no second profile, redeal, played-save retrofit or public start
is introduced. Skills, Homeworlds, Nexus, Discovery and the separate Basic
CHOAM/Ecaz Moritani entry remain outside this composition.

Nine genuine Advanced lobby/setup/first-Storm cases cover Strongholds2–6 and
both modules3–6. Twelve closing runtime cases cover Strongholds alone/both,
claim/pass and four legal Semuta profiles. Gamont returns the sole Carthag
counter, then Semuta retires before the original CHOAM finish. All six cards
remain unclaimed until that actual END Mentat action; only Arrakeen is awarded
to Atreides from the changed board, with Carthag unclaimed. Tech owners/ledgers
and physical Treachery remain unchanged, next turn is3Storm, and retired use
rejects. Both permanent cases fail before entry admission and pass after.
Styled real GameTable at390px completes Return this force→Commit→original
Finish and check victory in both configurations. Public cards show last
claim2, Arrakeen held by Atreides and Carthag unclaimed, with no overflow.
The combo's original Tech owners remain visible; source/reference/help and
persistent warning match the boundary. Full mode/deployment acceptance is
not certified by these local changed-path proofs.

**11 October 2026 — explicit original Leader Skills.** The opt-in delegates
original native setup before marking Semuta. Three existing profile gates
recognize only explicit native-Richese context; original roster/module
predicates still govern legality. Ordinary/native-Tech skill consumers retain
their eligibility after Semuta. Suk and Rihani handlers, receipt signatures
and effect ordering need no separate rewrite.

Four genuine native starts include Basic/Advanced Emperor and CHOAM, with the
Auditor excluded from training. Thirty-six private-question runtime cases
cover all six supported module configurations, claim/pass/four legal profiles:
Hajr resumes its original Movement owner before native Mentat naming/showing.
Hands/cards remain physical; the target still explicitly shows an exact
Crysknife or chooses its fallback card. Forty-eight aftermath cases cover both
skills and original module profiles. Typed Suk saves one ordinary in its pool
and returns two to reserves; Rihani performs its original normal private peek
and optional exchange before compulsory winning Artillery disposal. Traitor
movement is not a Treachery event and no effect repeats.

A real memory-only prototype-room dispatch saves the explicit skill setup at
version1 with original offers; CLI help parses the new flag without store
access. Styled390px GameTable completes Hajr→Commit→native question/show/posture,
Suk→original card cleanup→Collection, and Rihani draw→keep/reveal→Artillery
acknowledgements→Shield cleanup→Collection. Native CHOAM's five eligible normal
discs exclude Auditor; human training in all three seats reaches real Traitors.
Observed stale skill guidance was corrected and its actual surface reinspected.
This is bounded local evidence, not full skill/mode or deployed certification.

**11 October 2026 — trained Ixian saved response.** Actual skill-trained
substitution cost views previously threw a lost-choice error because
`ixSubstitutionIntegrity` ignored the detached response in `karamaBattleDiscard`.
Recognizing that exact saved Ixian response retains its declared sources and
recovery while Semuta owns controls. Original quote/signature/physical checks
and one cancellation stay authoritative. Claim/pass do not resurrect the
exchange; used Tooth and optional Shield cleanup still follow.
Both regressions fail before and pass after; six runtime cases cover all
views, claim/pass/four legal profiles and native remainder. Styled390px
controls finish with board2Suboids/Tanks1Cyborg/reserves17 and Richese's acquired
Karama, with no overflow. No additional skill/module or mode gate opens.

**11 October 2026 — Emperor-share cancellation qualification.** Printed Karama
canceling the Emperor's gift or extra allied revival pauses on its actual
public discard before the native denial. The original response is retained;
claim/pass does not transfer spice, revive a force or consume extra-revival
allowance. The private claimant action belongs to the actual Semuta holder.

The initial tests/UI assigned phases, alliance and wallets directly and did
not establish native qualification. The replacement fixture completes the
original setup, first turn and real turn-two worm alliance, then reaches
actual Charity or Revival through native actions. Four runtime claim/pass
scenarios retain all45 original Treachery identities and20 faction counters;
the native Emperor has ten spice and the ally retains three Tanks. Six
consumer cases pass on that genuine setup. Later held cards/Tanks use
conserved transfers, not replacement decks or minted forces. No new ruling,
module entry, public gate or complete-mode certification follows.

**13 October 2026 — original Homeworld public battle disposal.**
`battleResolved`, `winnerMandatoryDiscard` and winner `battleCleanup` now
offer their existing fresh events in this profile. The first losing batch,
later mandatory winning card and optional selected winner cards stay separate.
At most one other player's exact fresh card is acquired; retained winner cards
are not candidates. Original paid deployments, result, casualties, leader deaths
and reward order remain committed. No new timing or combat ruling follows.

Six genuine Basic/Advanced before programs disposed without an offer.
Fourteen parent after programs exercise both losing-card choices/pass and
mandatory/selected winner claim/pass. Three actual390px flows recover Maula
Pistol, Cheap Hero or selected Crysknife at4/4 through original owner controls
to Collection. Four further programs verify a real eight-spice native blow,
three survivors collecting six once and original six-spice killed-leader income:
CHOAM8→14 Basic/7→13 Advanced. The initial constant-balance proof failed because
it omitted legitimate Collection; production income was not changed.
Artifact: `/tmp/dune-homeworld-native-battle-3220.json`.
Temporary hosting404/image/environment errors, optimizer aborts and a fresh
DOM-observation failure are recorded in implementation evidence. No accepted
action was replayed; no saved/deployed/full-mode claim is made.

**13 October 2026 — original Homeworld carried-flight and finite-order costs.**
The existing profile now admits final `ornithopterDiscard`, clean
`saphoAuctionDiscard` and `saphoMovementDiscard`. Native range, cohort,
funding, queue and event rules are unchanged. Active Homeworld transfers,
Hajr/prior moves, advanced advisor flight and unresolved cyclic/partial/Guild/
late-Sapho timing remain guarded.

Six real flight before programs and eight real finite-order before programs
disposed their cards without offers. Twelve parent flight claim/pass programs
now preserve one/two completed original counters and original turn advancement.
Sixteen parent Sapho claim/pass programs preserve the earlier one-spice cache
bid/purchase/income or one original paid shipment and ground move through the
reordered queue. No global storm-order rewrite or repeated opportunity.

Three actual390px flight controls use range-three, final second group and
empty-cohort early end; recovery at4/4 leaves moved1/2/1, paid reserves19/18/19
and the same next actor. Four actual390px Sapho first/last controls preserve
the original finite lot invoice (Emperor10→9, Richese5→6) or unchanged physical
order while remaining combined turns reorder. A first Movement turn makes one
real paid shipment10→8/reserves20→19 and one ground move; last ordering ends
original r/c/a/e turns to Collection. Scope artifacts outside Git:
`/tmp/dune-homeworld-native-flight-3218.json`,
`/tmp/dune-homeworld-native-sapho-3219.json`.
Cosmetic notices required local acknowledgement; an observed transient DOM
failure was followed by fresh actual state, not a repeated accepted action.
Initial optimizer aborts remain recorded. No deployed/save/full-mode claim.

**13 October 2026 — completed native Homeworld CHOAM market disposal.**
`choamSaleDiscard` is now admitted in the existing Homeworld envelope. The
original sale still commits its physical discard and two/three-spice credit
before the Semuta offer; claim/pass restores the same market, not the sale.
High Tupile still prohibits Worthless sales, including Worthless duplicates.
A real ten-force native shipment into Habbanya Sietch17 lowers Tupile20→10
and pays the original ten-spice fee before the legal Worthless cashout.
Ordinary same-name Shield duplicates remain legal at high Tupile.

Four actual Basic/Advanced before programs paid/discarded without an offer.
Eight after claim/pass programs keep the original credit, paid counter group
and retained duplicate witness. Two actual390px controls sell Baliset for
two at low Tupile and a surplus Shield for three at high Tupile, pass native
Karama and exchange Semuta at4/4. Credit stays C0→2 or C2→5; Shield witness
stays held. The original market closes to Battle or Spice as before.
`/tmp/dune-homeworld-native-sale-3217.json` retains accepted actions/state
outside Git. No bank-income interpretation, profile or public gate changes.
The initial fixture incorrectly selected Stunner (a projectile); canonical
category inspection corrected the sale card to actual Worthless Baliset.
No production rule was changed for that fixture error.

**13 October 2026 — Homeworld Jubba and native Worthless cancellation.**
The same envelope now admits `choamJubbaDiscard` and
`karamaChoamWorthlessDiscard`. The existing native cancellation predicate
still excludes Kull, battle/Ornithopter and ecological/arrival-overlap parents;
no Nexus or new producer profile is opened.

Original paid CHOAM shipment supplies one normal Red Chasm7 counter. The
first-turn native suffix reaches turn2 Storm; actual Weather Control by
Atreides moves the recorded storm from1 by6, with the ordinary Weather
Semuta receipt passed by all original seats. Jubba then disposes its exact
card before protection. Claim/pass preserves the original counter, moves
storm1→7 once and resumes the same CHOAM market/Spice opening. Real Karama
cancellation instead retains Jubba and offers only its spent Karama; the
original protection decision reopens, and declining loses the one threatened
counter to Tanks while the same storm/Spice suffix completes.

Native printed Karama cancellation of Kulon, Baliset, La La La and Gamont
likewise offers only the public spent Karama before the original denial.
Their retained Worthless fuel is never claimable. Canceled Baliset commits
its original declared Atreides move once; canceled Kulon gives no bonus,
canceled La La La keeps free allowance and canceled Gamont returns no force
before restoring its original CHOAM close. Parent runtime covers16 such
claim/pass cases plus8 Jubba/protection-counter cases in both modes.

Four actual390px cancellation flows and two actual390px storm flows preserve
those original controls, including full4/4 exchanges for movement/Jubba.
`/tmp/dune-homeworld-native-counter-3215.json` and
`/tmp/dune-homeworld-native-storm-3216.json` retain accepted actions and actual
state outside Git. Initial optimizer request aborts are recorded; this is
local fixture proof, not deployed, saved-room or complete-mode acceptance.

**13 October 2026 — native CHOAM Homeworld Worthless costs.** The existing
Homeworld envelope now admits the printed Kulon, Baliset, La La La and Trip
to Gamont discard continuations. Their original native rules are unchanged;
the authorized supplied Advanced rulebook physical p29 lists the same four
powers, and Semuta has no printed Homeworld exclusion. No Nexus fuel, Jubba,
Kull counter or unrelated producer is added.

Original CHOAM/Richese/Emperor/Atreides Homeworld setup and real phase controls
produce these costs. Native reserve shipment supplies CHOAM's movement group;
a real declared Atreides move supplies reactive Baliset. La La La removes the
original free allowance without fabricated Tanks, and closing Gamont returns
one original Atreides board counter to Caladan rather than reviving it.
Eight actual before programs discarded the printed cost without an offer.
Sixteen parent claim/pass programs after admission retain paid prefixes and
complete the original movement, Revival or closing-Mentat suffix once.

Four actual390px owned controls declare the powers, pass native Karama,
recover the used cost and resume original controls. Kulon/Baliset exchange
at Richese's full4/4 hand; Kulon moves the paid CHOAM counter at range two,
Baliset leaves the original ten Atreides counters uncommitted before one
alternate move, La La La leaves forces and wallets unchanged, and Gamont
returns board10→9/reserves10→11/Tanks0 before CHOAM's original closing choice.
`/tmp/dune-homeworld-native-powers-3214.json` records accepted actions and
observed state outside Git. Local staged-card proof is not deployed, saved-room
or complete-mode acceptance.

**11 October 2026 — Homeworld ordinary-card reaction.** The bounded Homeworld
entry now also offers Semuta for an ordinary used special card played in its
roster, a clean Distrans transfer, a definite Truthtrance answer and the used
card of a completed paid Nullentropy Box search, not only paid Kaitain
disposal, Tupile cleanup and printed Karama canceling income. The used card is the same public fresh batch; claim recovers it and
pass leaves it discarded, with Homeworld custody, occupation history, the
percentage ledger, wallets, the two-spice Box payment and the card's own
committed effect unchanged. The shared parent-signature augmentation was
unnecessary for this admission and changed other Homeworld receipt bytes;
the correction removes it. The Hajr before program printed no offer then
failed an incidental null/undefined assertion. Box, Distrans and Truthtrance
had post-cutover programs but no observed pre-cutover run. Other Homeworld
producers remain guarded, not prohibited by a newly found printed rule.

**11 October 2026 — native paid-income cancellation costs.** Printed Karama
canceling original Guild shipment income, non-Ambassador Emperor auction
income or Advanced Richese special-purchase income offers that public
singleton before the original denial. Claim/pass restores its existing
response once. Canceling income does not cancel or refund the paid shipment
or acquisition; the next native Movement, auction or saved Richese control
still owns the suffix. A purchased Karama may itself pay for canceling its
auction income; its new Semuta custody does not reverse the bid.

Five genuine before programs lacked the offer; ten source-action replay and
claim/pass programs now retain original prices, forces and cards. Sixteen
consumer cases cover full hands, foreign ownership, neutral passes and legal
bots. Styled390px actual controls complete all three costs; original
Movement and restored Richese declaration/cache choice are usable. Guild
rate cancellation, Homeworld/Ambassador payments and unsupported overlapping
parents remain distinct coverage; no printed prohibition or module gate is
invented to describe those limits.

**11 October 2026 — separate original Homeworld composition.**
`--profile semuta --homeworlds` reuses original fresh Homeworld occupation
setup for Richese/CHOAM and classics, exact CHOAM, Basic/Advanced2–6, without
Nexus, Skills, Tech, Strongholds, Discovery or Ix/E3 mixing. Only the two
following source-qualified producers offer Semuta here; other Homeworld
producers are not thereby certified or made illegal by printed rules.

High Kaitain's original closing-Bidding discard pays two spice per selected
physical card before its private fresh batch. A group requires commitment
and one private selection; disposal never plays Karama or Poison Tooth.
Claim/pass keeps the payment and original Emperor/CHOAM closing owners.
The original paid action clears earlier readiness, so both owners acknowledge
the changed window before Revival. Original CHOAM duplicate sale can coexist.

Proved occupied Tupile loss privately discards each old holder's exact excess
before its own fresh event. The original cleanup ledger and source opening
finish once after Semuta; the next old holder remains queued. Taking the card
does not restore the lost slot or repeat Guild's actual paid departure.
Basic unresolved epochs retain their original guard.

Four native Kaitain before cases and real two-holder Tupile cleanup lacked
Semuta; the original ready Homeworld lobby was rejected. Eleven post-cutover
native programs pass, plus two real memory-only prototype dispatches through
original setup; the CLI flag parses without store access. Twenty consumer
cases cover private choice, full hands, old-holder ordering, readiness and
legal bots. Styled390px humans pay4, select Poison Tooth, retain Emperor6
spice and finish both closing owners; separate Guild/Atreides costs restore
normal4 limits and original Movement. No public gate or full-mode acceptance.

**11 October 2026 — original Homeworld income costs and printed share.**
The separate Homeworld entry now also offers the existing printed Karama
cost for original Guild income, non-Ambassador Emperor auction income and
Advanced Richese purchase income. Original paid transaction, native low
rounding and occupation source are signed through the pause. No additional
module or economic authority is introduced.

Claim/pass completes the native denial once, with credit0 rather than the
allowed ceiling3 from5 or2 from3. The printed occupied floor2/1 remains
uncancelable and follows its original controller/reciprocal ally allocation
before original Movement, next auction or saved purchase controls resume.
This reuses the existing [occupied-income source contract](HOMEWORLD_OCCUPATION_RULES.md#occupied-economics-bidding-and-advanced-source-cutover--5-october-2026),
not a newly located FAQ.

Seven before programs lacked the offer; fourteen source-action replay and
claim/pass programs now retain original payment, acquisition/forces and
printed allocation. Styled390px humans prove all three source families:
Junction2 to Richese, Kaitain2/1 to the real Atreides ally, and the next native
Movement or Richese cache controls. A just-purchased Karama keeps its paid
identity through the exchange. Basic low staging moves its included elite
subset from Kaitain; Advanced retains its original Salusa subset. Other
Homeworld producers, unresolved Basic epochs and module mixtures stay separate.
