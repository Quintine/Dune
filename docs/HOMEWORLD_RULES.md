# Homeworlds: publisher rules and implementation contract

Source audit, 9 September 2026. No runtime activation. The primary module source is the [GF9 Ecaz & Moritani rulebook](https://www.gf9games.com/dune/wp-content/uploads/EcazMoritani-Rulebook-LOWRES.pdf), especially printed pp.4, 9–10 and the Homeworld FAQ on pp.15–16. The local publisher-text transcription is `/tmp/dune-rules/ecaz-audit.txt`; fresh official indexed pp.9, 10 and 15 were checked against it. Direct PDF retrieval currently returns HTTP 403. Physical card faces are separately audited in [Homeworld component audit](HOMEWORLD_COMPONENT_AUDIT.md); a rulebook statement and a card-face statement are not interchangeable evidence.

## Live World Sandtrout — 26 October 2026

An actual original Sandtrout draw exposed a context error in clean World/Tech:
the pending printed Spice Card was treated as an unrelated module, causing
occupation validation to reject the draw. Clean World and World/all14 profiles
now retain their original capability while the canonical boolean card flag is
pending. Original World Nexus/Discovery profiles retain the same live behavior;
malformed non-boolean effect flags are rejected. Fresh setup still requires
unused gameplay state, so no pre-existing effect can be installed at Start.

The [existing original Spice contract](IX_PROTOTYPE.md#original-spice-cards-and-selected-policy--24-october-2026)
remains authoritative: break alliances, hold the card across turns, preserve
the provisional first-turn ignoring priority, suppress the next active worm,
and double only its immediate territory replacement. No numerical, timing,
roster, role or module selection is changed by this fix. Existing World/Skill
benefits and original minimal participation remain available while it waits.

Frozen integration passes **11 files,70/70**, types/lint/build and three native
runtime paths with19 GameTable SSR renders. Original public A/E/Ix +Ix World/
Tech starts retain47 Treachery and22 Spice; Advanced adds original14 training
and Strongholds. Basic and first-turn ignored-worm paths use25+66 actions;
Advanced uses30+71. Only original unopened lotteries are selected.

Actual A2 Caladan→Broken Land shipment pays4 and supplies a real later worm
victim. Waiting Sandtrout spans Collection/Mentat/Storm; its later suppression
preserves both that army and its ground spice, grants no Nexus/ride, and doubles
only immediate Hagga. Advanced's next ordinary blow remains undoubled. Ix's
Heighliners1 pays at phase end; E Banker1 waits for Mentat, beside earned first
end-Mentat Strongholds. Four minimal policies each submit a legal next action
per source. No played card, force, wallet, effect flag, occupation or clock is
installed. All original Spice cards remain, including the one set aside while
pending and the same physical discard after suppression.

Actual table SSR retains the existing waiting notice at the source, Collection,
Mentat and next Storm, then clears it after suppression. Report/source manifest:
`/home/quintine/.local/share/dune/checkpoints/20261026-world-sandtrout-proof-v1/`;
journeys/HTML: adjacent `20261026-world-sandtrout-runtime/`.
No saved-room/D1/server, reset/restart, deployment or separate assurance campaign.
SSR/public actions leave broader combinations, browser/mobile/deployed and
complete-mode acceptance open.

## Original World Nexus and Discovery occupation — 26 October 2026

Every original admitted fresh World setup now initializes occupation benefit
state in the shared setup path, including its existing Nexus and/or Discovery
envelopes, with optional Skills and original phase modules. Entry predicates
remain authoritative for selected families, roles, physical components and
module prerequisites. This supplies omitted printed World behavior without
opening any new start permission. Legacy Semuta retains its separate scope.

Native locations, original qualification history, occupied Collection and
percentage ledgers, native Tupile and Ecaz World victory initialize together.
Fresh setup rejects existing occupation resources or history rather than
overwriting them; played games gain no stamp. Original nested Discovery entry,
Nexus custody/reactions and Skill training remain in their existing handlers.
The live occupied-income context uses the same original module predicates,
including their actual initialized reaction/native flags.

Authority remains the audited World/occupied components below and the supplied
Advanced physical21/printed19 variant independence. Occupied bank Collection,
ordinary territory Collection, other-payer Banker at Mentat, token payout and
earned Stronghold/Nexus cards keep their original events and arithmetic.
There is no new numeric ruling or retrospective income grant.

Frozen root integration passes **19 files,105/105**, types/lint/build and three
native runtime paths with19 GameTable SSR renders. Public original A/E/F base33
starts use36/40/46 actions for Basic Nexus/Tech, Basic Discovery/Skills and
Advanced Nexus/Discovery/Skills/Tech/Strongholds;7/10/10 continuation actions
retain actual Bank10 evacuation, Bank1 entry, sole Caladan qualification,
Collection2 and optional Banker1 deferred until Mentat. Native phase-token and
ordinary Collection rewards, plus earned first end-Mentat cards, stay separate.
Four minimal policies each submit a legal next action per source.

Discovery selects only the original unopened Hagga card and Cistern supply
lottery. Actual city-range3 movement earns Collection inspection/reveal and
next-Storm free entry. A further17 Basic Nexus actions select an unopened
ordinary worm, form an actual A/F alliance and let unallied Emperor draw its
physical Nexus at the real close. Original33 cards, optional14 Skills/12 Nexus,
seven Discovery Spice cards and eight tokens remain; no played card, force,
wallet, skill, qualification, phase, owner or receipt is installed.

Feedback keeps the Emperor native-withdrawal quote but omits its empty Salusa
group from a cross-World shipment, matching the existing human selector. Two
old tests await actual Advanced Revival actors. An older CHOAM World battle now
requires its newly earned sole Junction qualification and settled printed2
receipt before adding that award to the original support/Collection balance.
This corrects an omitted benefit, not support pricing or held-card locality.

Report/source manifest:
`/home/quintine/.local/share/dune/checkpoints/20261026-world-module-occupation-proof-v2/`;
journeys/HTML: adjacent `20261026-world-module-occupation-runtime/`.
No saved-room/D1/server, reset/restart, deployment or separate assurance campaign.
SSR/public actions leave broader combinations, browser/mobile/deployed and
complete-mode acceptance open.

## Registered World Skills occupation — 26 October 2026

Fresh World/all14 Skills starts now initialize the existing occupation benefit
state whenever the unchanged registered World/Skills admission accepts that
clean context. Original selected families, native role exclusions, Tech3+ and
Advanced Strongholds2+ remain; optional independent cards remain optional.
This introduces no new start permission. Nexus/Discovery/Semuta and other
reaction contexts retain their own existing scopes. Pending printed Sandtrout
uses the [live-state clarification](#live-world-sandtrout--26-october-2026) above.

Shared fresh state includes qualification history, occupied Collection and
percentage ledgers, native CHOAM Tupile and native Ecaz World victory. Skills
training remains original fourteen-card offers and actual eligible leader
choices. Existing normal Banker state is retained; the legacy explicit
classic occupation-Skills wrapper does not initialize occupation twice.
Native actions, printed incomes, skill posture, physical forces and private
choices continue through existing handlers. Played games receive no new stamp.

Authority is the same audited Homeworld/occupied components below and supplied
Advanced physical21/printed19 variant/Skill independence. Banker observes an
eligible payment by another faction; the trainer cannot earn from its own
payment. Its earned bank spice waits for actual Mentat, separately from current
occupied Collection, ordinary Collection and phase-token payout. This is
existing arithmetic/order, not a new combined ruling or retrospective refund.

Frozen integration passes **21 files,158/158**, types/lint/build and six native
runtime paths with18 GameTable SSR renders. Bare mixed/classic original starts
use25/13 actions,47/33 cards. All-six Basic/Advanced World Skills programmes use
257/274 actions,57/60 cards, actual Storm/free-return/token/card outcomes and
four accepted minimal-policy actions each. Every original Skill Card remains
in its physical deck, offer or trained slot.

Actual A/Ecaz/Ix all3 World/card50 sources use61/66 actions plus20 continuations:
Atreides pays Bank10 to empty Caladan, earning Ecaz Banker deferred1. Ecaz then
pays1 for sole Caladan entry. Actual occupied Collection2, Heighliners1 and
Advanced ordinary Arrakeen2 retain distinct receipts; Banker1 waits until actual
Mentat, followed by earned first end-Mentat cards. No played-state skill, card,
army, wallet, qualification, phase, owner or receipt is installed. Related old
Banker/Tleilaxu fixtures now follow current Advanced Revival actors/beneficiaries
and original lobby-circle sequencing without changing economic assertions.

Report/source manifest:
`/home/quintine/.local/share/dune/checkpoints/20261026-world-skills-occupation-proof-v3/`;
journeys/HTML: adjacent `20261026-world-skills-occupation-runtime/`.
No saved-room/D1/server, reset/restart, deployment or separate assurance campaign.
SSR/public actions do not certify browser/mobile/deployed acceptance, wider
module combinations or complete modes; those remain open.

## Clean Homeworlds and phase modules — 26 October 2026

Fresh clean Homeworld starts now use registered classic or selected-family
rosters, including paired/mixed/all-three native families and unused decks,
without incidental Skills, Nexus or independent-card requirements. Every native
needs its family selected; classic empty-deck selection is valid. Optional
independent cards retain36/38/50 and any separate Richese cache. Optional Tech
requires3–6 Basic/Advanced seats; Strongholds requires2–6 Advanced, or3–6 beside
Tech. Skills/Nexus/Discovery/Sandtrout and explicit Semuta keep separate profiles.

The existing genuine occupation entry supplies the shared fresh state: original
qualification history, occupied Collection/percentage ledgers, native CHOAM
Tupile leases and native Ecaz World-victory marker. Normal clean World and
independent-card World starts now initialize those printed benefits as well as
native locations. Original advanced Moritani assassination and Arrakis Ecaz
coalition/arrival rules compose the same public profile. Existing games receive
no added stamp, ownership assignment, module retrofit or reset.

Authority remains the audited E3 pp9–10/15–16 and physical occupied faces below,
with the user-authorized Advanced physical21/printed19 variant independence and
existing Advanced qualification cutover. No new income amount, expiry policy,
occupation share, tariff or victory interpretation is introduced. Original
Tupile, auction-controller, percentage and Duke contracts remain. Tech accrues
and pays at its matching phase; held Stronghold cards are earned only at actual
end-Mentat. A World is not a seventh Stronghold Card or ordinary Arrakis site.

Public-profile, native phase/control and native occupation lanes plus root
integration pass16 files,115/115, types/lint/build and six native runtime paths,
18 GameTable SSR renders. Bare mixed Basic starts in21 actions/card47 and classic
no-deck in10/card33. All-six Basic World/Tech and Advanced World/independent/Tech/
Strongholds use250/267 actions/card57/60, with actual native source allocations,
matching delayed income, native free return and earned cards. Four minimal
policies each submit legal next actions from both phase-five boundaries.

Actual A/Ecaz/Ix all3-deck World/independent50 sources use57 Basic /62 Advanced
actions. Atreides pays10 to ship its10 native Caladan reserves to already-held
Arrakeen; Ecaz pays1 to ship1 original native reserve to empty Caladan. The
accepted sole arrival creates the real qualification and printed bank2
entitlement. Twenty continuation actions complete actual End Movement, pay
Heighliners1 once, credit the unallied Caladan2 automatically, and reach the
actual first END-Mentat claims. Advanced ordinary Arrakeen Collection2 remains
separate; no seventh card or early held ownership appears. No played force,
wallet, phase, qualifier, receipt or ownership is installed; no controlled
positioning supplements are needed for this proof.

Feedback corrects the Advanced ordinary-income expectation and test type
narrowing. Related old World/Recruits sources now finish actual preceding
Advanced owners, retain the current owner's opportunity across requests, keep
Basic ready/reopen and choose original legal lobby circles for later actors.
Existing High-Ix paid-Cyborg bonus2 moves real additional Suboids; payments,
ordinary/free limits, Banker and delayed Axlotl remain distinct. An explicit
legacy occupation-Skills entry still cannot inherit this clean phase scope.
Report/manifest: `/home/quintine/.local/share/dune/checkpoints/20261026-homeworld-phase-proof-v3/`;
journeys/HTML: adjacent `20261026-homeworld-phase-runtime/`.
No saved-room/D1/server/reset/restart/deployment or separate assurance campaign.
This is Prototyped / Partial; complete combinations, browser/mobile/deployed
and release acceptance remain open.

## High Richese mixed shipment prototype — 25 October 2026

**Prototyped / Partial.** Native Richese at High may select actual paid reserve
forces alongside its ordinary concealed No-Field shipment. The marker keeps its
original token/event and one-force identity; `noFieldReserves` names only the
additional paid physical counters. No hidden 0/3/5 denomination is withdrawn or
added to that invoice. The reserve group enters now, while a later reveal draws
only the physical reserves still available then. No-field amount stays 1 for old
and new actions; omitting the new field preserves ordinary marker-only behavior.

The inspected High component grants accompaniment without specifying a free
price or a special numerical cap. The user-authorized revised PDF's physical
page 36 Richese B prices the marker as one force; physical page 22 supplies current
population eligibility. Under the user's 14 October instruction to choose
recommended interpretations, this prototype provisionally combines one marker
plus paid counters into **one ordinary invoice**, with Guild rounding once on
the whole priced group. Observe High before the accepted group, allow that
group to cross Low, and apply the resulting Low movement penalty to subsequent
actions. Combined pricing and grouped threshold timing are application
composition, not a located printed worked example.

Select at most actual native reserves. The independent Smuggler force, if
eligible and selected, reserves one additional real counter and stays free;
it never substitutes for a paid count or comes from the marker denomination.
The private original declaration proof binds the new count through the ordinary
No-Field cancellation, Advanced Guild shipment stop and separate Guild rate
response. An allowed shipment withdraws the full actual companion group once,
pays the original approved split and keeps the marker concealed. Preventing
No-Field cancels the entire group without payment, force transfer or shipment
use; the native token-use denial still applies and normal replacement remains.
Native Guild interception retains its separate existing outcomes. No new
Karama response can cancel only the High card's permission.

Arrival/entry counts include one effective marker plus the actual companions.
Physical shipment commitments count only the companions. The persistent private
selector explains current stock, costs and immediate versus concealed forces.
Existing minimal policies offer one affordable paid companion and retain the
ordinary marker fallback; no strategic tuning is performed. The two-token
[Richese Nexus Cunning composition](NEXUS_RICHESE_RULES.md#high-homeworld-cunning-accompaniment--25-october-2026)
now explicitly carries the selected paid group in its own original receipt,
prices the tokens as one plus those counters and reserves paid stock before
immediate faceup materialization. Its allocation/timing remains provisional;
other specialized routes/modules and comprehensive acceptance remain unfinished.

Evidence paths: [shared quote](../game/richese-homeworld-shipment.ts),
[selector](../components/richese-homeworld-forces.tsx),
[native chronology](../tests/fixture-richese-homeworld-shipment.ts),
[native rules](../tests/richese-homeworld-shipment-runtime.test.ts),
[actual purchased-rate pricing](../tests/richese-homeworld-shipment-price.test.ts),
[quote tests](../tests/richese-homeworld-shipment.test.ts) and
[control callbacks](../tests/richese-homeworld-forces-controls.test.ts).
Frozen evidence covers 15 related files, 123 cases: 122 originally passed, with
only an old orphaned-pair assertion expecting obsolete text. Both message checks
now match the unchanged guard; its full 6/6 file and final types/lint/build pass.
Exact hashes preserve the other 2,800 source files. Five native runtime/SSR
journeys pass: Basic 56, Advanced 60, actual capped-reveal 85, original opposing
Karama cancellation 56 and actual purchased-rate 27 source actions. Funding uses
real bribes/Mentat and Charity; no played resource, hand, phase or custody is
installed. The selector callback, original responses and physical deposits are
executed. A separate projected ally/rate UI case is explicitly controlled.
Private source-bound proof/HTML is retained in
`/home/quintine/.local/share/dune/checkpoints/20261025-richese-homeworld-shipment/`.
This is a first usable card-effect implementation, not full Homeworld/module
certification, saved-game assurance or deployed acceptance.

### Stable occupation runtime follow-up — 5 October 2026

Original fresh `homeworld-occupation` connects bank Collection/immediate sharing,
Kaitain/Junction/Richese percentage receipts, the completed total Southern
Collection, original Caladan/Ix/Richese/Giedi Bidding ownership and printed
Wallach/Tleilax/Grumman/Salusa protections. Advanced follows the authorized supplied
rulebook p22: qualify alone, retain until the last occupying force leaves.
Basic still guards its publisher-source lifecycle questions. Original history,
native population, invoices and private audiences remain separate.
[Fresh occupied Tupile capacity/cleanup](HOMEWORLD_TUPILE_INTELLIGENCE_RUNTIME.md#occupied-tupile-slots-and-original-cleanup--5-october-2026)
uses its own source lease; exceptional Duke, other modules, normal starts and full acceptance stay open.
See the [source cutover and original consumers](HOMEWORLD_OCCUPATION_RULES.md#occupied-economics-bidding-and-advanced-source-cutover--5-october-2026).

## Module scope and component inventory

There are **13 double-sided Homeworld cards and 13 corresponding planet discs for twelve factions**, not twelve of each. Emperor uses Kaitain and, in Advanced, Salusa Secundus. Only the seated factions' components enter the game. E3 permits the module independently of the selected factions and independently of Nexus cards, Discovery tokens and new Treachery cards. It does not require either Ecaz or Moritani to be seated, or all expansion factions to be present. [E3 pp.4, 9–10](https://www.gf9games.com/dune/wp-content/uploads/EcazMoritani-Rulebook-LOWRES.pdf#page=9)

Both Basic and Advanced are supported by the printed module. In particular, the FAQ explicitly permits the Fremen Homeworld in Basic, using its physical starred tokens without granting Advanced double battle strength. The module does not grant extra player seats: retain the underlying two-to-six-player game and its low-player-count rules. Twelve selectable factions does not mean twelve simultaneous players. [Base setup, p.6](https://www.gf9games.com/dunegame/wp-content/uploads/Dune-Rulebook.pdf#page=6), [designer expansion page](https://futurepastimes.com/dune-ecaz-moritani)

### Verified high faces

The photographed physical components in [BGG image 7767034](https://boardgamegeek.com/image/7767034) were inspected directly, independently of the rulebook prose (`/tmp/dune-rules/homeworld-bgg-high.jpg`). These are primary component artifacts hosted by a community site, not a publisher errata page. Full image provenance belongs to the component audit. The bonus column is both native battle addition and the printed native Lasgun/Shield casualty count.

| Faction / Homeworld          | High population            | Bonus | Verified high effect and real integration point                                                                                                                                                             |
| ---------------------------- | -------------------------- | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Atreides / Caladan           | 6–20 reserves              | 2     | Optional one-force reserve reinforcement after winning a battle, to that battle's territory or Homeworld, provided an own force survives there. Post-battle transfer, not an extra ordinary shipment.       |
| Bene Gesserit / Wallach IX   | 11–20 reserves             | 3     | May send two spiritual advisors instead of one when accompanying another faction's shipment **to Polar Sink**. This does not allow advisors on Homeworlds.                                                  |
| Emperor / Kaitain            | 5–20 reserves              | 2     | At Bidding end, may pay two spice per discarded hand Treachery card. Explicit optional paid discard window.                                                                                                 |
| Emperor / Salusa Secundus    | 2–5 **Sardaukar** reserves | 3     | Sardaukar need no spice support for full battle strength. Count the named type, not normal forces transferred to Salusa.                                                                                    |
| Fremen / Southern Hemisphere | 3–20 reserves              | 2     | Revived starred forces may be placed directly in a territory already containing own forces. Preserve actual starred identity in Basic too.                                                                  |
| Harkonnen / Giedi Prime      | 7–20 reserves              | 2     | Two bank spice when qualifying desert or Homeworld spice is collected that Collection phase. FAQ caps this at one two-spice award per phase.                                                                |
| Guild / Junction             | 5–20 reserves              | 2     | May offer other factions cross-shipping at half or full price during their shipping action, including to/from Homeworlds and to their own. Sponsor consent, payment and source pools must be explicit.      |
| Ixians / Ix                  | 5–20 reserves              | 2     | Paying to revive a Cyborg also grants two free Suboids. This is a typed revival modifier, not two manufactured counters.                                                                                    |
| Tleilaxu / Tleilax           | 9–20 reserves              | 2     | Free-revived forces may immediately ship free to one territory or Homeworld, subject to storm and occupancy. The revived group must remain identifiable through its owned destination choice.               |
| CHOAM / Tupile               | 11–20 reserves             | 2     | Cannot discard Worthless for spice except through Advanced Karama. This is not a prohibition on every Worthless special effect.                                                                             |
| Richese / Richese            | 10–20 reserves             | 2     | May ship physical reserve forces together with a No-Field. This is an explicit mixed-shipment modifier and needs concealed/physical custody handling.                                                       |
| Ecaz / Ecaz                  | 7–20 reserves              | 2     | Three bank spice per discarded poison weapon; also an alliance victory combining at least one jointly occupied stronghold with occupation of two other factions' Homeworlds.                                |
| Moritani / Grumman           | 8–20 reserves              | 2     | During Collection, may add Terror to a stronghold already containing Terror or remove a board Terror token, then gain four bank spice. This is a Collection decision, not an unrestricted placement change. |

**Caladan numeric precedence:** E3 p.10 directs the native battle addition to the value on the Homeworld card, then gives a parenthetical Caladan example using three. The inspected card prints two for both relevant numbers. Use the card's two because the operative rule explicitly delegates that value to the component; annotate the inconsistent example. This is not an invented balance ruling or a reason to block every Homeworld pending clarification. No verified subsequent erratum overriding the face was retrieved.

### Verified low and occupied faces

The reverse galleries were also inspected directly (`/tmp/dune-rules/homeworld-reddit-face1.png` and `homeworld-reddit-face3.png`; from [Every Homeworld cards](https://www.reddit.com/r/DuneBoardGame/comments/16w27x0/every_homeworld_cards/), 30 September 2023; detailed provenance is retained in the component audit). These are photographs of the actual components, not rulings by the uploader. Except Salusa, every reverse prints the global +1 free revival and +1 bank charity. The bank column below counts the gold spice symbols in the Occupied panel: E3 p.10 identifies that panel's indicated income as bank-paid during Collection, even in Basic. It is additional to the panel's separately described conditional payments.

| Homeworld           | Low population / native battle bonus | Low effect                                                                                                                                                    | Occupied effect / occupier bank income                                                                                                          |
| ------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Caladan             | 0–5 / 2                              | No movement-spent peek at the next Spice Blow.                                                                                                                | Occupier shares Atreides' Bidding advantage. **2 bank.**                                                                                        |
| Wallach IX          | 0–10 / 2                             | No spiritual-advisor shipment.                                                                                                                                | Occupier and its ally are immune to Voice. **1 bank.**                                                                                          |
| Kaitain             | 0–4 / 3                              | Emperor receives only the rounded-up half of Treachery payments.                                                                                              | Occupier receives the rounded-down remainder, as clarified by the five-spice FAQ example. **2 bank.**                                           |
| Salusa Secundus     | Printed 0–2 / 2                      | No free Sardaukar revival. Neither generic low bonus is printed/granted.                                                                                      | Sardaukar lose their Sardaukar advantage. **0 bank.**                                                                                           |
| Southern Hemisphere | 0–2 / 2                              | No additional penalty.                                                                                                                                        | Occupier receives the rounded-down half of all spice the native Fremen collect during Collection. **2 bank.**                                   |
| Giedi Prime         | 0–6 / 2                              | No additional penalty.                                                                                                                                        | When Harkonnen buys a Treachery card, occupier or its ally gains the extra free card if its receiving hand has room. **2 bank.**                |
| Junction            | 0–4 / 2                              | Guild receives only the rounded-up half of shipping payments.                                                                                                 | Occupier receives the rounded-down half of other players' shipping payments. **2 bank.**                                                        |
| Ix                  | 0–4 / 2                              | Cannot move the Hidden Mobile Stronghold.                                                                                                                     | Occupier takes control of Ixian Bidding, rather than merely observing a copy of the private selection. **2 bank.**                              |
| Tleilax             | 0–8 / 2                              | Starting Revival low prevents income when another faction takes free revival. This condition is phase-start-specific.                                         | No Face Dancer reveal against occupier or its ally. **2 bank.**                                                                                 |
| Tupile              | 0–10 / 2                             | Once per faction, CHOAM can force disclosure of spice and either weapon or defense count when it is on that faction's Homeworld or that faction is on Tupile. | Occupier and ally gain one hand slot; discard to normal limit when no longer occupying. CHOAM loses its low advantage. **2 bank.**              |
| Richese             | 0–9 / 2                              | Cannot move a No-Field.                                                                                                                                       | Occupier selects the Richese Treachery card sold during bidding and receives the rounded-down half of the payment Richese receives. **1 bank.** |
| Ecaz                | 0–6 / 2                              | With Ecaz and ally both in a battle, their opponent selects the participating allied faction.                                                                 | Occupier or its ally gains Duke, including permission to revive him, overriding the two native Duke advantages. **2 bank.**                     |
| Grumman             | 0–7 / 2                              | Revealing Terror requires entry by at least three forces.                                                                                                     | Terror cannot be revealed against occupier or its ally entering its location. **2 bank.**                                                       |

**Salusa endpoint discrepancy:** high prints 2–5 Sardaukar while low prints 0–2. E3's operative rule keeps a card high while its minimum is maintained and flips it only below that minimum. That supports high at two and low below two; annotate the conflicting reverse endpoint instead of inventing a player-chosen side or hysteresis. The population domain remains Sardaukar regardless of regular troops transferred there.

These faces require actual rule integrations, not a generic faction-disabled flag. Tleilax's phase-start condition, Tupile's once-per-faction private question and hand-limit cleanup, Grumman's reveal immunity, split income and displaced Bidding/bonus ownership have different lifecycles. Occupied Ecaz is an explicit additional Duke authority and revival permission; it does not by itself answer every existing loan-expiry, revival-custody or death-cycle question.

## Low Ecaz battle lead — 25 October 2026

The printed Low Ecaz penalty now owns the original combined-battle choice:
its opposing faction chooses Ecaz or the ally as lead at native population
zero through six. High at seven and games without Homeworlds retain Ecaz's
ordinary choice. Both rules bands use the same public identities and original
plan/physical-army/payment rules. Existing opened choices retain their owner;
Karama against Occupy afterward keeps the selected lead. No new coalition,
profile or occupation-retention rule is introduced.
[Canonical contract and focused evidence](ECAZ_OCCUPY_RULES.md#low-ecaz-opponent-owned-lead-choice--25-october-2026).

## Native custody and population

The planet disc holds that faction's native reserve forces. A Homeworld is a distinct off-planet location, not an Arrakis territory, additional stronghold, private hand zone or a new supply of pieces. Invaders retain their own faction and physical force types; native reserves and foreign garrisons must be distinguishable. Total faction inventory continues to include forces on Arrakis, on every Homeworld, and in the Tanks.

Start with the illustrated high-threshold face. Each card supplies its own population boundary. While native reserves meet that boundary, apply its high effect; falling below it switches to the low effect. Recompute after actual custody changes, not merely at phase boundaries. Restoring sufficient population restores the corresponding high condition. The rulebook names reserves as the population measure; an invader cannot inflate the native population or count as an extra native reserve. These are direct compositions of the continuously conditional threshold rule. [E3 p.9](https://www.gf9games.com/dune/wp-content/uploads/EcazMoritani-Rulebook-LOWRES.pdf#page=9)

Low population adds one to the native faction's free-revival rate and adds one bank-paid spice when that faction collects CHOAM Charity. The extra charity is not charged to CHOAM. Salusa supplies neither bonus. Tupile reverses the usual desirable-high/undesirable-low card effects; do not implement that reversal by globally exchanging all high/low mechanics. Recruits doubles the **current** free-revival rate, subject to its printed limit: the FAQ's low-population Fremen example is four doubled but capped at seven. This does not settle unrelated existing Recruits/unlimited-revival questions. [E3 pp.9–10, 16](https://www.gf9games.com/dune/wp-content/uploads/EcazMoritani-Rulebook-LOWRES.pdf#page=10)

Advanced Emperor starts with Sardaukar on Salusa and normal reserves on Kaitain. Revival returns these types to their respective native locations. During Shipment and Movement, Emperor can spend its movement transferring forces between the two. One outbound shipment can combine forces from both Homeworlds. The initial/revival placement restriction is not a permanent ban on the other type arriving through that expressly permitted transfer. Salusa's printed threshold nevertheless counts Sardaukar, so transferred normal defenders do not substitute for them. Basic uses only Kaitain and treats Sardaukar as ordinary battle forces. [E3 p.10](https://www.gf9games.com/dune/wp-content/uploads/EcazMoritani-Rulebook-LOWRES.pdf#page=10)

## Transport and arrival

| Route or effect                      | Source contract                                                                                                                                                                                                               |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Native reserves to Arrakis           | Existing faction shipment rules apply unless the actual Homeworld face modifies them. Keep free Fremen placement, Guild rates and ordinary restrictions distinct.                                                             |
| Homeworld to another Homeworld       | Permitted; printed price is one spice per physical force, half price for Guild. Check owner/ally restrictions and the particular card's transport advantage.                                                                  |
| Arrakis to a Homeworld               | Guild cross-shipment only, except a permission actually conferred by the Guild Homeworld face. Do not infer permission from ordinary allied discounts.                                                                        |
| Adding forces to one's own Homeworld | Revival is the general route; Guild/cross-shipping exceptions are explicit. No generic free board-to-reserve return follows merely from introducing the module. Specific existing card returns require their own composition. |
| Emperor inter-Homeworld transfer     | Uses movement, not another ordinary shipment. Preserve typed quantities and the combined-shipment exception.                                                                                                                  |
| Allied Homeworld                     | Shipping there and occupying it are forbidden, including for the Ecaz pair.                                                                                                                                                   |
| BG                                   | No spiritual advisors may be sent to Homeworlds. BG fighters on a foreign Homeworld cannot flip to advisors.                                                                                                                  |

Homeworld shipment triggers the Heighliner Tech Token, explicitly confirmed by the E3 FAQ. Price payment, ordinary shipment allowance and token ownership remain separate effects; an incoming shipment is not an Arrakis movement and has no sector, storm path, ornithopter access or sandworm route. No Ambassador or Terror placement follows: Homeworlds are not territories, and the FAQ expressly forbids Terror there. [E3 pp.10, 15–16](https://www.gf9games.com/dune/wp-content/uploads/EcazMoritani-Rulebook-LOWRES.pdf#page=15)

The new route must preserve the actual source location. Do not let a foreign garrison become an indistinguishable part of the owner's native `reserves`, or silently ship pieces out of an occupied native location twice. No-Field transport, concealed population and reveal causes need explicit integration with their physical marker rules; the module text alone does not establish those combinations.

## Occupier lifecycle and benefits

The rulebook defines an **Occupier** by events: foreign forces present at the start or end of a turn qualify; a faction alone on the foreign Homeworld at any instant qualifies immediately for that turn. Thus a simple current sole-controller lookup is insufficient. Save which faction qualified, on which Homeworld and turn, separately from the present native/foreign armies. Native low penalties remain in force while occupied. [E3 pp.9–10](https://www.gf9games.com/dune/wp-content/uploads/EcazMoritani-Rulebook-LOWRES.pdf#page=9)

An Occupied face can grant an ability and/or bank income during Spice Collection, including in Basic. The occupier may immediately share that income with its ally; this is a specific immediate-sharing permission, not ordinary deferred bribery or Ecaz desert-allocation negotiation. The face determines the amount and any event-specific restrictions. Do not mint the income when occupation first occurs or again when refreshing a saved state.

Kaitain's FAQ supplies a concrete payment split: a five-spice Treachery payment yields three to Emperor and two to the occupier, even when that occupier bought the card. The payment is not charged again. Giedi Prime's high benefit is a total two-spice award per Collection phase if either listed reason occurs, not two per individual collection. These FAQ facts constrain the corresponding card implementations but are not substitutes for the full faces. [E3 p.15](https://www.gf9games.com/dune/wp-content/uploads/EcazMoritani-Rulebook-LOWRES.pdf#page=15)

Do not form an alliance if either prospective partner occupies the other's Homeworld. Apply this to Nexus, Ecaz Ambassador consent and Moritani alliance formation, not only to ordinary alliance buttons. An alliance cannot legalize an already forbidden allied garrison. This restriction uses actual force occupation; do not substitute a private card condition or an unrelated remembered payment benefit. [E3 p.10](https://www.gf9games.com/dune/wp-content/uploads/EcazMoritani-Rulebook-LOWRES.pdf#page=10)

## Combat and victory

Homeworld invasion attacks the actual native reserve army, with normal battle sequencing unless a face says otherwise. Add the native Homeworld's current printed battle-strength bonus to its dialed result. Do not transfer that native bonus to an invader. The module gives no permission to merge Ecaz/ally armies there. It also does not define a two-faction stronghold capacity for these non-territory locations. Preserve the ordinary combat rules rather than silently applying every Arrakis stronghold predicate. [E3 p.10](https://www.gf9games.com/dune/wp-content/uploads/EcazMoritani-Rulebook-LOWRES.pdf#page=10)

Only the native faction may call Traitors or Face Dancers in a Homeworld battle. This restriction is on the caller, so an otherwise valid remote Harkonnen ally is not exempt merely because the beneficiary is defending its native Homeworld. For Lasgun/Shield explosion, native casualties are limited to the printed Homeworld battle strength, regardless of dial; surviving natives stay there. Both sides still lose and leaders die normally. The ordinary explosion removes the invading army. This named exception is not evidence for changing Stone Burner or other destruction effects. Physical type allocation, revived arrivals and threshold changes must be evaluated against the actual battle snapshot, without replaying outcomes on restore.

**There is no blanket Homeworld stronghold or victory point in the global rules.** Any occupied card face that explicitly counts as a stronghold must be represented as its own source-specific victory contribution. It must not become an Arrakis territory, a six-card Stronghold Card control site, a location for Ecaz joint-three occupation, or a location satisfying Moritani's battle-in-strongholds Duke condition by accidental shared IDs. Actual card wording must decide its limited contribution and any occupied-native victory restriction. Ordinary and special wins, alliances and BG prediction retain their existing priority unless a verified face expressly changes them.

Ecaz's verified high face supplies a separate actual win predicate: its alliance jointly occupies at least one stronghold and occupies Homeworlds belonging to two **other factions**. Two Emperor Homeworlds do not supply two different native factions. Implement this as a Homeworld-card condition while Ecaz's high advantage applies; do not add all foreign Homeworlds to ordinary stronghold progress. The sentence's alliance subject supports combining the two members' qualifying foreign occupations, while its explicit co-occupation requirement applies to the stronghold. Exact interaction with a transient turn-bound Occupier receipt must use the finalized occupation semantics rather than silently replacing actual occupation with an income entitlement.

### Printed high Ecaz alliance victory — 5 October 2026

The unused `homeworld-occupation` entry with native Ecaz now separately marks
`homeworldEcazVictoryPreview`. The original card’s condition is a conjunction:
current native Ecaz population7+, a reciprocal alliance jointly holding at least
one actual uncontested stronghold, and proved current alliance holdings of worlds
belonging to two other native factions. Original `strongholdProgress` owns joint
site legality; public advisors/No-Field/HMS and storm semantics are not duplicated.
Kaitain plus Salusa still counts only Emperor; own/ally-native worlds are excluded.

The focused [public quote](../game/ecaz-homeworld-victory.ts) uses actual typed
reserve/custody/history and the shared supported occupation authority, with
current physical holder presence. It never turns an income entitlement or a
departed garrison into ordinary points. Basic unresolved potential holdings remain
source-blocked. Unmarked board-only quotes read no new reserve or Homeworld data.
The native high condition is current population; occupation does not invent a
global suppression of that high advantage.

This qualifying alliance joins the original ordinary winner union before a
correct BG prediction; final-turn Fremen/Guild fallback still occurs only when
no earlier source wins. The returned qualifying source prevents an Ecaz/Fremen
alliance win from being described as a Fremen fallback. No special win button,
card/spice award, altered Tech/Stronghold ownership or Duke permission is added.
The explicit only-Ecaz Duke revival ruling and exceptional custody guards remain.

Source34/related119 cases including guidance, types/lint/build and original native programs pass.
The actual Movement→Collection→Mentat program wins with population7, onlyone
joint site and two other native factions; ordinary1/4 and Ecaz1/3 remainfalse.
All4 policies can finish original legal Collection readiness; BG prediction and
simultaneous ordinary-winner union retain precedence. A separate original clock
program reaches turn10 through734 legal actions before a labelled conserved
Ecaz/Fremen endgame quote proves printed-source precedence over fallback.

Original CLI **S8N26ADW v18/setup** preserves deck/actors/starting choices.
Real turn-two Nexus earns Ecaz/Guild alliance before a labelled surviving-counter
position; original storm7 remains unchanged. Phone390px prospective progress shows
native7/7, joint Habbanya Sietch1/1 and distinct Emperor/BG2/2, with Ecaz holding
Kaitain and Guild Wallach. Original ready actions then reach **v25/Mentat/finished**
with both alliance members as winners, despite unchanged ordinary1/4/Ecaz1/3.
Refresh preserves this win with no root overflow. One rejected driver closing
action was repaired using canonical eligibility; no rule guard was weakened.
Private proof stays outside Git. Full Homeworlds, overlays, pending Basic/CHOAM/
Duke and deployed acceptance remain open.

Five genuine six-seat Advanced continuations all finish4,339 accepted/
4,358 attempts/114 JSON on unchanged tree
`b0ebb815c973197ca3e3148c4ad447ddc11dba1489f72911de2cd341cafd2f08`.
The19 rejected candidates remain recorded. Winner faction alone does not identify
the new source; specific new-route proof is the original native program/human
Mentat win above, not a claim that every natural sample triggered this condition.



## Karama and other optional systems

Karama cannot cancel Homeworld advantages **or** penalties. This includes a BG Worthless card converted into Karama. Do not generate response windows for threshold flips, Homeworld strength or occupied-face awards. However, this immunity is not a blanket ban on playing Karama during a Homeworld shipment/battle: an independently cancelable ordinary faction advantage still has its own source and timing. Distinguish printed Homeworld transport permission from a faction ability and from the generic paid card effect. [E3 p.10](https://www.gf9games.com/dune/wp-content/uploads/EcazMoritani-Rulebook-LOWRES.pdf#page=10)

Homeworlds do not enable the other optional modules. Leader Skills, Stronghold Cards, Discovery sites and Nexus cards retain their existing activation boundaries. E3 Harass & Withdraw specifically excludes one's own Homeworld; foreign Homeworld use follows the card's actual return rule. New off-planet locations must be audited at every effect currently phrased as territory, Arrakis, reserves, own Homeworld or any forces; these are different predicates.

## Evidence gaps and implementation sequence

The component audit retains provenance for the thirteen names, thresholds, battle bonuses and high/low/occupied face effects summarized above. All thirteen front and reverse faces have now been visually inspected; there is no remaining absent-face placeholder in this contract. The [designer's expansion page](https://futurepastimes.com/dune-ecaz-moritani) embeds [Homeworlds Revealed](https://www.youtube.com/watch?v=4KZKz13wf9c); its presence is verified, but no spoken ruling is attributed here without an inspected passage. Community-hosted component photographs establish their visible printed text, not any additional explanation by the uploader.

Global text leaves a material occupation-lifecycle edge: it awards status for a turn but does not fully specify simultaneous qualifying foreigners, expiry after leaving, or replacement if multiple factions qualify successively. Native repopulation may also restore a high threshold while a prior invader has a turn-qualified entitlement. The state model should retain population, actual presence and event evidence separately rather than pick an arbitrary exclusive controller or three-state enum; resolve an actual conflicting benefit case against the card face and any verified designer clarification. Tupile's explicit loss-of-occupation discard is a concrete expiry obligation even though not every other reward names the same endpoint. Other potential interactions—No-Field hidden population, card returns to an occupied native location, and threshold-sensitive mid-revival entitlements—require targeted source composition before those paths are enabled. Missing implementation is not itself an ambiguous rule; neither is a missing scan evidence for a house rule.

Recommended full-module implementation order:

1. Install verified immutable face data and an explicit module setting; create native Homeworld locations during real setup with conserved typed forces, including Basic Fremen and Advanced Emperor's second disc.
2. Introduce a shared location/custody model, dynamic population quote and event-bound occupation state. Make UI, bots, battle eligibility, reserve selection and persistence use those same public or owner-private descriptors.
3. Implement actual shipment, Emperor transfer and revival routes, including payment/income/Heighliner transitions and alliance restrictions. Every action must reject atomically and survive JSON/CAS continuation.
4. Extend actual combat and aftermath to off-planet locations, native strength, Traitor/Face Dancer restrictions and explosion casualties; preserve physical force and leader custody.
5. Integrate every verified face into its real phase/card/faction effect, bank/occupier income and source-specific victory contribution. Add occupation turnover, threshold-crossing and canceled ordinary-advantage tests.
6. Exercise all twelve faction profiles in complete games with this module, plus real multiplayer recovery and UI inspection. Until those contracts and material source cases are resolved, retaining the module gate is accurate; a pure population helper alone does not constitute Homeworld support.
