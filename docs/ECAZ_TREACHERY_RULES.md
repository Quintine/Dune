# Ecaz expansion Treachery Cards: primary-source audit

Audit: 2026-09-06. Scope: Reinforcements, Recruits, and Harass & Withdraw. This document records component evidence and implementation boundaries; it does not certify an implemented expansion. No runtime files were changed.

## Sources and reproducible visual anchors

- **E3:** [GF9 Ecaz & Moritani rulebook](https://www.gf9games.com/dune/wp-content/uploads/EcazMoritani-Rulebook-LOWRES.pdf), printed pp. 4, 9, 11, 16. Publisher-indexed text was retrieved. Printed pp. 4 and 11 were also visually inspected in the [publisher-authored PDF mirror](https://gamers-hq.de/media/pdf/0f/7a/86/Dune_EcazMoritani_Rulebook_EN.pdf). The mirror is not assumed to resolve revision conflicts elsewhere in this expansion.
- **F:** [Future Pastimes expansion gallery](https://futurepastimes.com/dune-expansion-sets), figure caption naming the three new Treachery Cards. [Exact original figure](https://images.squarespace-cdn.com/content/v1/5627edd5e4b0e42d8c948a6a/1697055394182-97KD40K94W1GMCCIS1LU/Dune%2Bexp%2B3%2Bcomponents2.png). This 453-by-719 image was successfully inspected in a browser after the web fetch tool could not display it. Harass & Withdraw is fully visible; Recruits and Reinforcements overlap. Do not reconstruct covered text from this figure alone.
- **J:** [Jack Reda / Future Pastimes Games, designer unboxing](https://www.youtube.com/watch?v=iF5E3-LOfhY&t=486s), 8:06-9:45. The [designer's expansion page](https://futurepastimes.com/dune-ecaz-moritani) embeds this video. Its author identifies himself as the expansion designer. Auto-generated captions were inspected as a navigation aid and cross-checked with printed components where possible. At 8:06-8:15 he identifies three additions and a 50-card combined deck including expansion 1. At 8:25-8:48 he explains Recruits; at 8:55-9:05 Reinforcements; at 9:11-9:29 Harass & Withdraw.
- **A:** [Solveig Reda, expansion artist's unboxing](https://www.youtube.com/watch?v=P9ZTV1uZqsM&t=258s), linked directly in J's description. Printed card close-ups: Recruits at 4:21, **Reinforcements at 4:24**, Harass & Withdraw at 4:28. These were visually inspected through the browser, not inferred from captions. The Reinforcements face is unobstructed at 4:24 and legible enough to verify every gameplay sentence. A documents manufactured components; its commentary is not used to invent rules.

The temporary mirror PDF is `/tmp/dune-rules/ecaz-mirror.pdf`. Browser-exported navigation transcripts are `/tmp/browser-use/exports/youtube-iF5E3-LOfhY-cb81ab2f-9773-4bb4-9632-c8956d6c680c.txt` and `/tmp/browser-use/exports/youtube-P9ZTV1uZqsM-88890134-d427-47a5-b6e7-6cd0f812b33c.txt`. Public URLs and timestamps above remain the durable provenance; no copyrighted image was added to the application.

Use a specific official FAQ over a general paragraph where applicable. No fan rewrite, tournament amendment, or unverified transcription is authority here. No material conflict among the inspected Treachery Card passages was found; unresolved interactions below remain unresolved.

## Verified rules

**Shared rules (E3 pp. 4, 9, 11):** There are three physical additions, shuffled into the Treachery Deck. The variant can be used independently of faction selection and other variants. All are discarded after use. Reinforcements and Harass & Withdraw occupy either weapon or defense slot but are neither category. Prescience requesting that category receives a declaration of no such card, without exposing the special card's identity.

**Reinforcements (A 4:24; J 8:55-9:05):** Commit in a Battle Plan in either slot. Increase the dialed number by 2, then transfer 3 own reserve forces to the Tanks. Holding at least 3 reserve forces is a prerequisite. The face states no spice payment. Discard after use.

**Recruits (E3 pp. 11, 16; A 4:21; J 8:25-8:48):** Play during Revival. For this turn, double every faction's current free-revival rate and raise the ordinary force-revival limit to 7. The FAQ's low-threshold Fremen example doubles 4 but caps the result at 7. No separate spice cost is stated; paid revivals are not made free by the card. Discard after use.

**Harass & Withdraw (F; A 4:28; J 9:11-9:29):** Commit in a Battle Plan in either slot. When revealed, return own undialed forces to reserves; leader death still operates normally. An opponent's Traitor call cancels this effect. A Face Dancer affecting the card user's leader does not affect the returned undialed forces. The card cannot be used on the user's own Homeworld. No spice charge is printed. Discard after use. E3 p. 16 clarifies that, with Ecaz and an ally co-present, only the card user's undialed forces return; the other ally resolves normally.

| Component         | Quantity confidence                                                                       | Gameplay definition confidence                             |
| ----------------- | ----------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Reinforcements    | One: three total additions, three distinct printed identities shown in F/A and named by J | Full face inspected; battle interactions below remain open |
| Recruits          | One, same evidence                                                                        | Official text/FAQ plus card close-up                       |
| Harass & Withdraw | One, same evidence                                                                        | Full face inspected plus official ally clarification       |

These are special cards, not additional Worthless identities. The combined base 33 + Ix 14 + these 3 inventory is 50 physical Treachery Cards, independently corroborated by J 8:06-8:15. This does not add Richese's separate ten-card cache to the ordinary deck.

## Engine contracts supported by this evidence

The following are implementation recommendations, not extra tabletop rules. Existing functions were inspected only to identify integration points.

### Shared battle-card representation

`validatePlan`, `findReachableBattlePlan`, `prescienceAnswer`, and the stored `b.prescience` currently bind weapon/defense fields to physical card IDs. Merely adding these cards to `WEAPON_KINDS` and `DEFENSE_KINDS` would leak identities and could make a truthful answer of no weapon incompatible with a legal plan.

Represent **slot occupancy** separately from **effective card category**. Keep the actual committed ID private until reveal; use a category-aware projection for Prescience and its later equality/feasibility checks. Do not globally equate a null weapon answer with an empty slot. Audit `truthtrance.ts` and battle-promise evaluation, Voice matching, special Prescience, and hand-exchange locks through the same distinction. A generic weapon/defense Voice cannot silently make these into weapons/defenses.

Validate ownership, a single physical card per slot, the ordinary plan prerequisites and any special-card prerequisites before locking. Preserve the exact committed card across JSON recovery and future reactions. Disposal must have an explicit automatic-use path in `resolveBattle`; leaving it in the winner's optional `battleCards` decision would allow unintended retention after a successfully resolved use.

### Reinforcements

Keep a distinct declared card effect and a proposed reserve-casualty selection. Revalidate available reserves at commitment; neither UI nor bots may conjure three off-board units. The effect transfers real reserve units to Tanks and does not place extra units in the battle territory. Preserve regular/elite inventory counts and Atreides battle-loss bookkeeping according to the eventual cost-timing ruling.

A normal, non-Traitor, non-explosion Basic fixture can verify the modifier and reserve transfer. Do not claim its advanced casualties are certified merely by adding 2 to `Plan.dial`: that field also controls physical casualty enumeration and spice support in the current engine. The distinction between the submitted force commitment and the card-adjusted battle number needs an explicit contract before enabling advanced combinations.

### Recruits

Use an authoritative turn-scoped effect, e.g. a stamp keyed by `g.turn`, and a shared effective-rate calculation. `forceRevivalLimit`, `freeRevivalRemaining`, `forceRevivalQuote`, `PendingRevival`, and the CHOAM/Tleilaxu exception checks must consult the same result. Reset by phase/turn lifecycle; do not permanently mutate faction metadata.

The card is global: changing only the player's next quote is insufficient. Preserve previous revivals and recompute remaining allowance from the effective total; do not blindly grant seven additional forces. Reprice/revalidate a pending revival only under an explicit timing decision, rather than changing an already accepted payment after the fact. No source here authorizes consuming the card through an unresolved revival-response window.

### Harass & Withdraw

Retain the physical force commitment needed to distinguish dialed and undialed units. With advanced half-strength/double-strength units, subtracting the numeric dial from territory count is invalid. The existing `casualtyOptions` mechanism can contribute physical choices but currently chooses losses only for a winner; withdrawal can matter to either participant.

A persistent battle-resolution continuation should preserve withdrawal intent through the Traitor decision. Do not move forces irreversibly to reserves and then let a successful Traitor call overlook them. Conversely, `pendingFaceDance` must not treat returned reserves as still in the battle territory. The ally's force collection must stay separate even when Ecaz contributes strength.

## Unresolved interactions: do not introduce house rules

| Issue                                      | What is known / remaining question                                                                                                                                                                                                                                                                                                                   |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Reinforcements and a Traitor outcome       | Its face states modifier, reserve cost and disposal; it does not state whether the reserve cost is paid when the Battle Plan is defeated/canceled by a Traitor, or when its user wins by calling one. Reconcile the normal traitor rule with the special's use timing before enabling this combination.                                              |
| Reinforcements and advanced accounting     | The modifier targets the dialed number, but no inspected passage says whether those 2 require spice support or add on-board casualties. Likewise, the eligible regular/elite reserve mix and treatment as battle losses need explicit adjudication. Preserve separate fields rather than making this hard to correct later.                          |
| Reinforcements and explosions              | No inspected passage gives the reserve-cost ordering versus Lasgun/Shield or another instant battle outcome.                                                                                                                                                                                                                                         |
| Harass & Withdraw and explosions           | The designer says withdrawal occurs on reveal and the face explicitly names a Traitor cancellation, but no retrieved official FAQ directly states the Lasgun/Shield ordering. Record the distinction between an inference from reveal timing and a verified combined ruling.                                                                         |
| Harass & Withdraw with unusual commitments | Advanced unit selection, Ecaz's undialed support units, zero dial, and multiple-sector participation need exact physical accounting. The p. 16 FAQ settles whose forces return, not every casualty-selection detail.                                                                                                                                 |
| Recruits played after earlier revival      | The printed timing says during Revival; it does not settle refunds for previously paid revivals, reopening a completed player opportunity, or replacement of a pending transaction. Do not quietly restrict it to phase opening and call that printed timing.                                                                                        |
| Recruits and exceptions                    | J calls 7 the normal limit and compares it with Tleilaxu's 5 permission. Do not silently reduce CHOAM/Tleilaxu's unlimited advantage to 7. Combined interactions with Karama limits, La La La/free-revival prevention, Fremen ally grants, special units, and changing Homeworld thresholds were not fully audited here.                             |
| Cancellation/disposal generally            | These are card effects, not faction advantages; the inspected E3 Karama table does not give a generic direct counter to them. Preserve applicable Voice/traitor rules, but do not invent a new Karama cancel menu. The Harass traitor-cancellation sentence does not alone settle whether a canceled special was used for winner-retention purposes. |

## Meaningful validation for the later implementation

- Count 50 physical cards with unique IDs when base, expansion 1 cards and these additions are combined; check name/category/disposal consistency and independent variant selection.
- Exercise each legal slot and dual-card combination; verify neither category leaks through normal Prescience, special Prescience, Truthtrance or Voice feasibility checks. Test all private views before and after reveal.
- Reinforcements: 2 versus 3 reserves, exact reserve-to-Tanks conservation, no phantom on-board arrivals, repeated request/recovery, and approved traitor/explosion/advanced interpretations.
- Recruits: all factions' quotes, partial prior revival, current rather than printed free rate,7-force cap, reset next turn, cancellation/phase continuation and pending-quote custody.
- Harass & Withdraw: winner and loser, zero dial, Traitor cancellation, returned reserves versus Face Dancer replacement, independent ally groups and prohibited own-Homeworld use.

No runtime tests were added or claimed for this source task. At this source audit’s initial snapshot the repository had no factory entries for these names. The subsequent isolated definitions and inspector guides in `game/ecaz-cards.ts` are now tracked in `CARD_INVENTORY.md`; they do not activate the variant. Existing revival and battle helpers remain integration foundations, not evidence of complete card effects.

## 14 September runtime follow-up

[Recruits](RECRUITS_RUNTIME.md) and [Harass & Withdraw](HARASS_WITHDRAW_RUNTIME.md)
now have connected development prototypes. The linked contracts supersede the
historical runtime-absence statements above within their explicit boundaries.
Reinforcements and complete combined-module acceptance remain unfinished.

## 14 September Reinforcements cost review

The printed close-up at [4:24](https://www.youtube.com/watch?v=P9ZTV1uZqsM&t=264s)
and designer explanation at [8:55](https://www.youtube.com/watch?v=iF5E3-LOfhY&t=535s)
place its effect during Revealing Wheels: increase the calculated dial by two,
then place three reserve forces in the Tanks. A separate score modifier, without
extra support or on-board casualties, is the strongest implementation inference.
Three physical counters pay the cost; an available ordinary/elite mix needs its
owner's explicit choice.

The [base Traitor outcome](https://www.gf9games.com/dunegame/wp-content/uploads/Dune-Rulebook.pdf#page=10)
can reasonably be read to waive the sole caller's reserve cost. The later card's
mandatory transfer can also reasonably override that general protection, using
the same specificity argument as mandatory after-use card disposal. Neither
reading is an authoritative Reinforcements ruling. Opposing/mutual Traitors and
explosions have no directly retrieved combined clarification either. The card
remains disabled: an eligibility gate based on concealed matching Traitors would
expose private information or fail after plans were sealed.

The user has been asked whether to retain that gate, always charge three on all
outcomes, or waive only the sole traitor-call winner's cost. No answer is assumed.
Separately, the sources do not establish whether these reserve counters count
toward the Advanced Atreides seven-loss threshold, or the relative order when
the same plan also plays Harass & Withdraw. Those combinations remain explicit
boundaries rather than inferred rules. No disconnected quote is recorded as a
completed card effect.

## 27 September bounded Reinforcements prototype

The earlier cost review remains an unresolved source question, not a user
ruling. [The connected runtime](REINFORCEMENTS_RUNTIME.md) uses the printed
three-reserve transfer and +2 modifier in classic-faction Basic/Advanced games
with the independent three-card variant and no other optional modules. The
normal score is separate from physical dial/support/casualties; three ordinary
reserves are used first, with elite reserves supplying any shortfall. The
transfer counts as battle losses and applies even to a sole successful Traitor
caller, an opposing/mutual Traitor outcome or an explosion, before board
casualties. Those choices are **provisional product interpretations**, not
publisher adjudications or an answer to the pending user question. The card
cannot share a plan with Harass & Withdraw or Stone Burner until those
combinations are resolved. The earlier “remains disabled” statement describes
the 14 September snapshot rather than this bounded current prototype.

## 29 September paired-faction extension

The independent card variant now permits the same bounded Reinforcements
Battle Plan in clean Ecaz/Moritani expansion games with classic opponents,
in Basic and Advanced. It reuses the physical reserve cost and score-only
modifier; the earlier provisional outcome/type/Atreides-loss interpretation
is unchanged and does not become a publisher ruling by applying to another
faction. Co-present Ecaz allied armies, Richese, Ixians/Tleilaxu and other
optional modules remain gated. The [runtime boundary](REINFORCEMENTS_RUNTIME.md)
and [checkpoint](IMPLEMENTATION_STATUS.md#29-september-2026--reinforcements-in-paired-ecazmoritani-battles)
record the exact evidence; the 27 September classic-only statement above is
historical.

## Original phase-module composition — 16 October 2026

The printed shared rule above permits the independent cards with other variants.
The fresh `ecaz-treachery` entry now retains original unused Tech Tokens at3–6
Basic/Advanced seats and/or Stronghold Cards at2–6 Advanced seats, with clean
classic or selected Ix/CHOAM native/base rosters. Both modules requires3–6
Advanced. Base33, CHOAM35 or Ix/union47 gains exactly three physical cards;
the original Richese cache remains separate.

Use original setup and native ownership: remaining Tech after first Storm,
Stronghold Cards only at actual end-Mentat. No owned module receipt, bank spice,
forces, phase or history is injected. Classic and selected native Homeworlds
compose the same original phase modules in the contracts below. Nexus, Skills,
Discovery, Sandtrout, mixed E3 and unrelated previews, played-game conversion and
public starts stay gated. Stone/Mirror retains its separate selected-family contract.

Recruits changes current free rates/ordinary allowance, not the original Axlotl
once-per-phase trigger or delayed income. Eligible actual free revival triggers
that token once; Harass reserve deposits and the Reinforcements fee are not
free revival or off-planet shipment. Original Heighliners payment stays at
Shipment/Movement end, never available as anticipated spending money.

An earned held Stronghold still affects its original holder's actual plan.
Arrakeen pays up to two actual support from the bank, not two personal spice
or support for the score-only bonus. Tabr uses the actual opposing dial.
Reinforcements keeps the existing provisional normal-first/all-outcome fee
before Harass returns; typed fee and board casualties remain separate.
Original winner cleanup/Tech reward and native aftercare keep their order.
These inherited payment/order interpretations do not become publisher rulings.

Accepted runtime evidence and limits are recorded in the
[current checkpoint](CURRENT_STATUS.md#current-checkpoint-and-work); detailed
[Revival](RECRUITS_RUNTIME.md), [withdrawal](HARASS_WITHDRAW_RUNTIME.md) and
[reserve-fee](REINFORCEMENTS_RUNTIME.md) contracts remain applicable.

Bounded local proof: nine new behavioral cases and the frozen related30-file
union pass325/325; types/lint, build and actual prototype help pass. Five mobile
journeys/35 actions cover original Storm/HMS, earned Arrakeen bank2/personal1,
native Tabr fee/return and two doubled-rate Revivals with one delayed Axlotl
payment. Four policies complete20 battles/52 continuations/9564 R-or-H proposals,
16 useful Recruits programmes/120 actions, and four additional mandatory
two-token selections. No Face Dance route, new elite revival, complete mode,
calibration, broad assurance or deployed acceptance is claimed.

## Classic World phase-module composition — 16 October 2026

The fresh classic independent36-card Homeworld entry now retains original unused
Tech3–6 Basic/Advanced and/or Strongholds2–6 Advanced; both requires Advanced3–6.
This composes the existing native-pool and phase-module handlers, not new printed
cost/rate arithmetic or a new public start. Selected native Worlds follow the
later composition below; Skills, Nexus, Discovery, Sandtrout and other overlays stay separate.

Original setup creates native typed custody; first Storm assigns remaining Tech
and actual end-Mentat earns held cards. Axlotl/Heighliners retain once-per-phase
triggers and delayed income. A reserve fee or Harass deposit is not a free
revival/shipment. Earned Arrakeen funds actual support only, not +2 R or personal
cash. Original reward/cleanup and native optional aftercare retain their queues.

Keep the existing provisional current native rate on each separate accepted
Revival request, prior free/paid classification and special-force/total caps.
Keep exact normal-first source-bearing R fees, original traits/printed face,
own-World fee/dial disjointness and fee-before-Harass. Native typed returns go
through their original destinations; Harass remains forbidden on every own
World, including both Emperor Worlds. No visitor/ally/future return funds R.

Bounded World proof: related20-file union192/192 and final12 focused cases pass;
types/lint, build and actual prototype help pass with existing build warnings.
Three verified390px journeys/17 actions exercise prior-paid reopening, one typed
Fremen return plus five normals, one delayed Axlotl payout, earned bank2/personal1
support, exact split fee and typed visitor return. Original next Guild timing/
second paid conflict/Collection remain usable. Four policies finish24 World
Revivals/156 actions and24 battle/native-aftercare programmes/48 continuations,
validating7609 R-or-H proposals. Useful policy card holders are explicit conserved
staging. These are not complete modes, calibration, broad assurance or deployment.

## Native selected-family World composition — 17 October 2026

Clean selected Ix and/or CHOAM native/base Basic/Advanced2–6 Worlds now compose
the independent cards before original setup: selected38/50, with Richese's
ten-card cache separate when present. Original HMS/seven Cyborgs, Face Dancers,
Auditor, marker identities and native typed custody remain. Original Tech3+
and Advanced Strongholds2+ follow the later native phase contract below.
Skills, Nexus, Discovery, Sandtrout, E3 and other previews remain gated.
Public starts and played-game conversion stay gated.

One shared selected-family roster rule replaces duplicate checks. The renamed
private World profile retains no classic-name alias. Use original current native
revival rates/bonuses, special-force caps and unlimited Tleilaxu/CHOAM allowance;
Recruits does not reduce an unlimited allowance to seven. Native/foreign World
R fees remain normal-first, source-bearing and disjoint from own-World physical
dials, with original traits/printed face. H remains forbidden on every own World
and returns actual normal/elite counters through native original custody.

Richese forecasts its own No-Field before R funding, not before physical reveal.
An actual native marker3/reserves5 position displayed a blocked2-reserve owner
preview but accepted the raw first plan after profile admission. The central
native-cost check now rejects the same position unchanged and permits H alone.
Actual reveal later debits ordinary primary-World reserves once; no early
counter move, source/marker/history reset or new saved field is introduced.
Future H returns cannot fund that fee. Existing provisional all-outcome payment,
current-rate request timing and aftercare/retention interpretations are inherited,
not new publisher rulings; other card-specific profile guards stay.

Bounded proof: frozen related21-file union251/251, types/lint, build and actual
prototype help pass. Five390px journeys/42 actions exercise native typed fees,
board-only Cyborg exchange/Face Dance, marker fallback, unlimited revival and
Auditor inspection. Direct marker3/reserves5 execution rejects unchanged while
H-only seals. Four-policy programmes retain useful conserved-card staging,
not strategy/calibration. Existing build warnings, complete modes and deployed
acceptance remain open; no saved-game/database assurance campaign was run.

## Native World phase modules — 17 October 2026

The selected Ix/CHOAM native/base World independent-card entry now retains
original unused Tech Tokens3–6 Basic/Advanced and/or Stronghold Cards2–6
Advanced; both requires Advanced3–6. This removes the remaining composition
barrier, not a new rate, payment or card-effect ruling. Original38/50 inventory,
Richese cache, HMS/Cyborgs, native-only World declarations and custody stay.
Keep exact source-bearing normal-first fees, own-World fee/dial disjointness,
printed traits/face, fee-before-Harass and every own-World Harass prohibition.
Richese must still fund R after projected original marker materialization.

First Storm assigns remaining tokens; actual end-Mentat earns held cards.
Axlotl keeps its once-per-phase trigger and delayed income. Recruits does not
refund accepted paid returns or reduce native unlimited allowances. Harass
deposits and reserve fees are neither free revival nor off-planet shipment.
Held Arrakeen funds only actual support in Arrakeen, never a foreign World,
personal spice or the score-only +2. A real Arrakeen plan may still pay its
reserve fee from native Ix. Original winner cleanup/rewards and aftercare remain.
Skills, Nexus, Discovery, Sandtrout, E3, unrelated previews, public starts and
played-save conversion remain guarded.

Bounded proof:15 fresh native module setups and three390px journeys/23 actions.
Ix pays3/0/5 across prior-paid reopening, current population threshold and native
Cyborg deposits; native CHOAM returns12 without imposing seven, finishes its own
market and then original Guild timing. Axlotl accrues once and pays only when
Revival really ends. Real first-turn paid3N3E Arrakeen placement earns its card
at actual end-Mentat; next-turn support3 costs bank2/personal1. Native fee3N
precedes Harass3N; three board Cyborgs die separately. An original conserved
Face Dancer offers its real continuation before Collection can mask the invoice.
Its decline reaches Collection without changing initiative or freezing later
Storms. Original own-World fee/dial/H restrictions, mixed fees/typed aftercare
and marker-short rejection/H fallback also compose.

Behavioral evidence: `tests/native-world-phase-recruits.test.ts`,
`tests/native-world-phase-battle.test.ts`, `tests/native-world-phase-marker.test.ts`,
`tests/fixture-native-world-phase-battle.ts` and the extended canonical native
fixtures. Four policies finish16 useful Revival programmes/112 actions and12
native battle programmes/82 actions, not strategic calibration. Related18-file
union225/225, types/lint, build and actual prototype help pass with existing
warnings. No full-mode, deployed, HTTP/database or broad assurance claim.


## Native E1/E2 Leader Skills composition — 17 October 2026

The independent three-card variant now composes fresh classic or selected
Ix/CHOAM native/base all-fourteen Skills in Basic/Advanced2–6. Original ordinary
inventories are36/38/50 cards; a seated Richese retains its separate cache.
This follows the printed faction-independent variant permission above and
reuses the existing native setup, not an extra physical card or faction power.

The shared `independentTreacheryLeaderSkillsProfile` replaces the old
classic-only predicate. Its selected-family native form feeds
`nativeExpansionLeaderSkillsProfile`, so No-Field shipment, Planetologist,
Smuggler, Suk, Rihani and Sandmaster consumers use one coherent capability
instead of local bypasses. Recruits and Bureaucrat use the same admission.
Original home/foreign custody, printed free rates, Cyborg prices and native
unlimited revival exceptions remain; no revival recipient is reassigned.

An actual Ix/Cyborg/Suboid programme pays the three normal-first reserve fee,
returns the typed undialed army, then applies trained Suk only to committed
casualties. The next real Revival counts a prior free return: Recruits leaves
one extra free Suboid and a three-counter request costs5 (paid Suboid2 plus
paid Cyborg3), reaching Tleilaxu. Fee counters are not rescued. Sandmaster's
ordinary worm destination pickup also remains available with this independent
variant: one spice from the actual destination, not another move or source gain.

Existing fee-before-return, native reserve-capped No-Field materialization,
green Planetologist substitution and after-use disposal interpretations remain.
Worlds, Nexus, Discovery, Tech/Strongholds, E3 natives and unrelated previews
stay outside this fresh Skills/independent envelope. No played-save conversion,
new numerical ruling, complete-mode or publication certification follows.

Evidence: `tests/ix-independent-skills-runtime.test.ts`,
`tests/fixture-ix-independent-skills.ts`,
`tests/choam-independent-skills-runtime.test.ts` and
`tests/fixture-choam-independent-skills.ts`. Original native card timing and
funding controls were exercised directly, including marker5 capped to3 with
zero reserves left for the fee: the refused seal changes no state; legal Harass
returns one and loses two committed counters. Funded Basic/Advanced marker3
plans win by one with the trained Mentat bonus, not an invented support bonus.
The existing conserved post-Nexus Sandmaster fixture with the independent
variant transfers exactly one destination spice and preserves movement allowance.

Frozen22-file223/223, types/lint/build and actual prototype help pass. Six
bounded native/mixed-family games reach turn3 or an earlier win. Real390px
normal-lobby native Ix starting-card choice precedes its actual skill offer,
with no app errors or root overflow. Ix/CHOAM setup entropy and conserved
physical card staging are explicit; their armies, paid receipts and phases
follow native actions. This does not certify all combinations, strategic AI,
persistence/privacy assurance or a deployed revision.

## Standalone E3 Leader Skills composition — 17 October 2026

The same printed independent-variant permission now composes original Ecaz OR
Moritani/classic all14 Skills, Basic/Advanced2–6, exact ecaz36, without other
modules. Native offers/assignment, Loyalty, Traitors, starting forces and card
custody stay source-ordered. Advanced Harkonnen, E3 native pairs/mixed families,
shared-Duke training and other module combinations retain their Skills guards.

Fresh plain/card Ecaz starts mark native coalition participation in Basic as
well as Advanced. Basic no longer rejects Occupy merely because cards were
selected. Native fixed Ecaz and variable allied armies remain separate: the
chosen plan user supplies the three-reserve fee and only that user's undialed
counters return through Harass. Suk rescues actual committed losses, not that
reserve fee. Existing Basic rounding and all-outcome fee/return interpretations
remain provisional, not new user or publisher rulings.

Fresh supported native Advanced Moritani starts initialize printed
Assassinate Leaders, including cards with/without Skills; Basic does not gain
it. Normal-call game-long forfeiture, skill-first winner continuation, unused
opposing disc, printed bounty, mandatory card disposal and one actual Mentat
replacement retain their original handlers. No played save is retrofitted.

Bare independent-card rosters also use every actual selected known family
even without Ecaz seated. A conserved Mori/Richese before-plan preview was
blocked before this roster repair and is now available. Actual Basic/Advanced
Ix/Guild with all three selected families reaches Collection: nine paid
Suboids leave one Suboid/two Cyborgs to fund the fee; +2 adds no physical
arrival or support. World and phase-module E3 boundaries are not widened.

Evidence: `tests/fixture-ecaz-independent-skills.ts`,
`tests/ecaz-independent-skills-runtime.test.ts`,
`tests/fixture-moritani-independent-skills.ts`,
`tests/moritani-independent-skills-runtime.test.ts` and
`tests/mentat-question.test.ts`. Native fixtures label scoped entropy and
conserved physical cards/Traitors; armies, payments and phases follow native
actions. The Mori/Richese preview above is a reduced conserved before-plan probe,
not a natural phase trajectory.

Frozen25-file274/274, types/lint and build pass. Actual Basic/Advanced Ecaz
fee/Harass/Suk programmes reach Collection with fee-only3 Tanks, one rescued
counter kept and separate allied2 losses. Four policies select legal leads in
both modes; four native Moritani policies reveal Master Bewt3 and reach one
actual Mentat replacement. Plain no-card/no-Skills Harkonnen gives printed4
assassination and one native captive. Four bounded all14/card tables reach
turn3 or an earlier win, but targeted programmes—not those natural games—prove
assassination. Actual390px normal Moritani entry reaches Storm through genuine
training, Traitor choice and native6 setup without browser errors/root overflow.

The discovered Mentat legal-hand rejection is fixed through explicit selected
inventory in every current/history/reveal consumer. All three Specials remain
private fallback cards, not named weapons. Both normal/trained postures preserve
the hand and seal a legal plan in declared conserved positions. See the
[inventory contract](MENTAT_QUESTION.md#selected-independent-card-inventory--17-october-2026).
No deployed, full-module, strategic calibration or deferred assurance claim follows.
