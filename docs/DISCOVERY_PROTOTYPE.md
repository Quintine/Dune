# Discovery functional prototype

13 September 2026. The connected Discovery batches are **Prototyped**, with
partial rules coverage. It connects physical components, real actions, private
controls, AI choices and saved continuation. Normal public Discovery and
Advanced start gates, and the publication gate, remain closed.

## Source and setup boundary

The [component acquisition record](DISCOVERY_COMPONENTS.md) identifies the
publisher-authored *Ecaz & Moritani* rulebook, pages 12–13, and the physical card
scan used for all six placements. Its verified inventory is seven Spice Cards
(six Discovery territory cards and Great Maker) and eight tokens. This prototype
uses those identities and effects; it does not treat test outcomes as rulings.

`initializeDiscoveryGameForAudit` enters real staged setup with two through six
ready seats in Basic or Advanced. Fresh classic, selected E1/E2 native families,
and standalone Ecaz **or** Moritani with classic opponents use their original
decks and native setup. Canonical unused Tech Tokens may be preserved at three
through six seats. Advanced Moritani retains its non-Harkonnen assassination
profile; paired/mixed E3, Skills, Strongholds, Homeworlds, Nexus and unrelated
previews stay outside this entry.

Discoveries are enabled before components are dealt. The initializer adds the
seven cards to the selected original Spice Deck, retaining Ix Sandtrout, and
creates each token behind shuffled opaque physical identities. Started games,
nonempty native inventories and already-used Tech Tokens cannot be redealt.
No ordinary player action or room endpoint bypasses the normal start gate.
The existing local starter accepts `--profile discovery` for these fresh lobbies:

```sh
node --import tsx tools/start-prototype.ts --profile discovery --db PATH --room CODE --version NUMBER --out /private/new-directory
```

It preserves all seats and other rooms, requires the current version and refuses
to redeal a started game. The default `ix` profile remains available.

## Classic Nexus composition — 5 October 2026

Fresh local `nexus --discoveries` composes classic/base33/all12 Nexus with the
original Discovery seven Spice Cards/eight tokens, Basic/Advanced two through
six seats. Original unused Tech requires three seats; Strongholds requires
Advanced. No Skills, native families, Homeworlds, independent card variants,
unrelated previews, public start or played-game conversion is admitted.

```sh
node --import tsx tools/start-prototype.ts --profile nexus --discoveries --db PATH --room CODE --version NUMBER --out /private/new-directory
node --import tsx tools/faction-games.ts --profile discovery-nexus-stronghold-tech --rules advanced --players 6 --out /private/new-directory
```

The game runner also offers `discovery-nexus`, `discovery-nexus-tech` and
`discovery-nexus-stronghold`, without changing earlier defaults or seeds.
Original setup and inventories remain authoritative. End-Mentat settles held
Strongholds; next-turn free entry precedes Storm. Great Maker finishes ordinary
worm losses, then its storm-order vote and physical reserve ride, including
typed Fremen and revealed nested destinations. It does not itself deal cards.
The original closing Nexus choice occurs only at the end of the entire Spice
Blow phase, after both Advanced piles, when a Nexus occurred and an alliance
exists. Joining an alliance forfeits a held card; unallied players retain the
original keep/draw/replacement and own-faction redraw choices.

Source-clear Emperor extra-three and absent-Fremen ordinary-three revival
retain distinct quota/free ledgers and actual Axlotl activity. Absent-Guild
borrowed tariffs preserve native identity, physical nested shipment and one
card cost; original nested battle retains winner cards and mandatory Tech
reward. Existing unresolved mixed-module Fremen Betrayal and other effects
remain gated; no universal Great Maker interruption priority is invented.

Affected64, types/lint/build and original runtime programmes pass. Two genuine
six-seat Basic Tech / Advanced Tech+Stronghold games finish1,150 accepted
actions/1,150 attempts/31 JSON continuations on unchanged tree
`761f5ca592af1bd3be766dd0e5654ed18528809855f6139436552428389f5b00`.
These totals do not claim natural use of every effect.

Actual isolated QA room **3D7SAG45** preserves authenticated seats and original
CLI setupv8. Explicit unplayed Spice order/token lottery and43 original actions
reach next-turn entryv9. Human Guild enters one Cistern counterv10 without
money/reserve/movement cost. Six original actions open Great Makerv11 after
actual Emperor losses. Human votesv12–14 create a Nexus; Fremen's actual typed
two-counter ridev15 includes one Fedaykin, costs no spice and leaves Guild's
protected nested counter intact. Human Advanced blow/alliance controlsv16–26
form Emperor/Fremen's alliance and open Guild's real closing draw.
Human drawv27 delivers Richese, decrements the original twelve-card deck to
eleven and releases Charity. Refresh fits390px. This is controlled source
exercise, not unstaged card history or production verification.

Code checkpoint **a2a92bb40881e6b517e618a5ffd6b3389c960a3d** is pushed.
[Exact container job](https://github.com/Quintine/Dune/actions/runs/37296234655/job/111717999496)
completed/success: isolated storage/HTTP step7 succeeded before verified-image
publication step9. Final reference10 and types/lint pass; exact pushed build
passes. Preserved3D7SAG45v27/Charity retains physical Richese/deck11 and shows
the **a2a92bb** local marker at390px after the isolated QA worker reload.
Tab released. Publication is not protected NAS deployment or live acceptance.

## Native setup and original consumers — 5 October 2026

Original Ixian setup keeps the six-counter HMS garrison and seven physical
Cyborgs; Tleilaxu keeps its actual private Face Dancers. Next-turn free entry
quotes physical normal/elite groups, including Cyborgs and starred Fremen,
separately from the HMS and concealed marker presence. Paid shipment, movement,
stash and Face Dance retain original force, payment and winner-reward handlers.
CHOAM's real five-card hand may draw a sixth from Card Stash before its owned
choice discards any held card back to five.

No-Field custody now recognizes the five known nested Discovery IDs at sector
zero. This does not open an unrevealed location: declaration/commitment and
materialization require the current revealed board. A concealed token is still
one effective presence, not physical reserves or a source for free entry.
Its original value-zero/three/five reveal materializes only current reserve
forces, once. The shipment controls label nested sector zero as inside the
location rather than Polar Sink.

Standalone Advanced Moritani retains its original assassination state in the
Discovery profile. An actual nested-site battle retains that revealed location
in the original opportunity/history, with the same different-opposing-leader
restriction, physical Traitor cost and printed bounty. Basic is not converted
to the Advanced ability. Ecaz retains its existing Occupy preview and Basic
odd-force boundary.

The existing genuine game runner now selects `--profile discovery` or
`--profile discovery-tech`, with `--rules both|basic|advanced` and
`--players all|2|3|4|5|6`; Tech requires at least three seats. These profiles use
classic, paired E1/E2 and standalone E3 original sample rosters with new
2700/2800 ordinal bands. Earlier profiles, defaults and seeds are unchanged.

```sh
node --import tsx tools/faction-games.ts --profile discovery-tech --rules advanced --players 6 --out /private/new-directory
```

Focused native cases are in `tests/discovery-module-profile.test.ts`,
`tests/discovery-native-typed-runtime.test.ts`,
`tests/discovery-native-marker-runtime.test.ts` and
`tests/discovery-native-e3-runtime.test.ts`. Fixtures explicitly label controlled
unplayed Spice order, placement lottery and conserved counter/card/identity
positions; clocks, choices and outcomes use original producers. This does not
resolve contested Cistern/Testing Station/Orgiz, shared-payer theft, mixed-dial
Jacurutu, complete module strategy or public-start/deployed acceptance.

### Bounded runtime evidence

The frozen affected rule union passes **71 tests**; final reference checks add
**10 passing cases**. TypeScript/lint and the actual rule build pass. Original
programs prove Ixian free entry of three physical
counters, including one Cyborg, without a wallet/reserve debit; Richese pays one
spice for a Cistern marker and later materializes three actual reserves. Fresh
Ecaz and Moritani original setup both complete with eight tokens and all four
minimal legal policies. The actual nested Moritani battle exposed and repaired
the static-territory history rejection; its different Guild Traitor pays the
printed three-spice bounty.

Four genuine six-seat Advanced Tech samples finish on initial tree
`6d6c1849d6da9b1e5c2af04e07303f9bec49ec9dac2d8089ae58c77795f48e57`.
The original Moritani setup capture then finishes at effective seed **20263765**
on corrected tree
`fe22922e7acdea8aea64b75af8ba29247e37b63a63f461efa930f1a8cd2c049c`.
Across those completed paths: **1,940 accepted / 1,940 attempted actions and 49
JSON continuations**. This is a repaired/resumed study, not five games on one
unchanged tree or natural activation of every new effect.

Dedicated actual QA room **Q3AWYZWC** retains its original ready lobby, actor
identities and private setup. Original 45-action program stops at Collection;
only four unplayed Spice Card ordering and the token lottery are controlled.
Guild's phone inspection/reveal reaches **v8/v9**. Original 44-action
continuation reaches turn-two Richese movement at **v10**. Its real human
five-value marker declaration reaches **v11**; original Guild **Allow shipment**
settles **v12**, spice **5→4**, reserves **20** and one concealed Cistern presence.
Human reveal reaches **v13**, reserves **20→15**, five Cistern counters and no
second price. Refresh retains v13 and the phone fits **390px**.

The first UI attempt reached the old running QA worker's static No-Field
validator and rejected without mutation. Reloading only that isolated worker
loaded the corrected build. The fresh sector selector now says **Inside location
· sector 0**, not Polar Sink. The managed tab was released. Other games were
not written; no reset, public activation, save conversion or deployed claim.



## Classic Leader Skills and Advanced Orgiz — 5 October 2026

An explicit fresh `leader-skills --discoveries` entry composes classic factions,
the original base 33-card deck, all fourteen physical Leader Skills, seven
Discovery Spice Cards and eight tokens. Basic/Advanced supports two through six
seats; optional unused original Tech requires at least three. The existing
skill-first choices, trained-disc posture and original faction setup remain.
Native families, Nexus, Strongholds, Homeworlds and separate Banker/Mentat
previews are not admitted by this particular entry. It does not redeal a
previously initialized Discovery or upgrade a played game.

```sh
node --import tsx tools/start-prototype.ts --profile leader-skills --discoveries --db PATH --room CODE --version NUMBER --out /private/new-directory
node --import tsx tools/faction-games.ts --profile discovery-skills-tech --rules both --players 6 --out /private/new-directory
```

Physical next-turn entry spends neither the ordinary movement allowance nor
spice and does not change the trained disc. Paid nested shipment retains its
original invoice. Planetologist movement and the carried Discovery Ornithopter
are separate alternatives: the latter replaces one movement with fixed range
three rather than adding a skill modifier or action. Original Harkonnen
eight-card capacity, owner-selected stash discard, normal/skilled Suk rescue
and subsequent original Tech reward use existing producers. A distinct
Bureaucrat holder may divert the printed two spice from an eligible five-spice
single-payer shipment without changing the payer's invoice or physical arrival.
Existing modified-defense, Atreides Suk/KH and private split-source guards remain.

### Authorized Advanced Collection wording

The supplied `UNOFFICIAL_Revised_Dune_Rulebook_v.2.3_web.pdf`, **physical page 24**,
says Orgiz steals one collected spice **each time collection occurs in a
territory containing spice**, rather than the publisher's older per-blow text.
For Advanced, the quote maps an original territory's positive Collection to
one transfer, even when multiple collected source keys identify the same
unique rival payer. A different, missing, contested or shared payer withholds
that territory's transfer; other territories and ordinary Collection proceed.
An owner's own Collection is not theft. This is the explicit application of
the authorized Advanced trigger, not a newly discovered publisher ruling on
contested ownership or shared allocation.

Basic retains its recorded provisional one-transfer-per-positive-deposit
interpretation. The context requires its existing public `advanced` boolean:
missing mode is not silently treated as either source. Effect `location`
remains one actual deterministic collected key; Advanced notices name the
territory. Original collected/desert facts, remaining map spice, bank-income
prefix and already-paid phase continuations are not rewritten or replayed.

Original programs with explicitly controlled, conserved counter/spice positions
show one rival collecting five spice across three deposits in two territories:
**Advanced transfers two; Basic transfers three**. These are controlled board
positions, not naturally produced card history. The trained programme moves
three actual Guild counters into Cistern free, then ships one additional
reserve there for one spice, reaching four physical counters.

Two genuine six-seat Basic/Advanced Skills+Discovery+Tech games finish
**1,578 accepted / 1,578 attempted / 42 JSON continuations** on unchanged tree
`946335ef77745f086cd9bd07bfa405c46c06785a3aae7a684a8e244ce2da4ee5`.
That proves original continuation, not natural activation of every new effect,
complete Skills/Discovery combinations or strategic calibration. Focused
consumers live in `tests/discovery-orgiz-advanced-runtime.test.ts` and
`tests/discovery-classic-skills-runtime.test.ts`; source cases remain in
`tests/discovery-collection.test.ts`.

### Actual human controls and targeted checks

The frozen affected rule/control/reference union passes **75 cases**, with
TypeScript/lint and the actual build. Named owner-defined quote/driver contracts
replace newly encountered concrete-function return-type coupling.

Actual fresh **PCDX5J8M v6** starts through the existing backed-up
`leader-skills --discoveries` CLI at **v7/setup**. Guild's natural physical
offers are Warmaster and Prana Bindu Adept; human assignment chooses Warmaster
on Staban Tuek at **v8**. The subsequent original programme retains those
already-dealt choices, controlling only four unplayed Spice Cards and the
actual token lottery. Human Cistern inspection/reveal reaches **v10/v11** while
the location remains empty.

Six original phase actions expose turn-two entry at **v12**, before the storm.
Human **Move 3 forces inside** reaches **v13**, preserves spice3/reserves12,
movement0 and the existing shipment flag, and keeps Warmaster. Twenty-two
original controls reach movement at **v14**: the three Cistern counters survive
the storm and ordinary shipment is available. Human reserve shipment plus
original Guild **Allow shipment** reach **v16**, spice **3→2**, reserves
**12→11**, four Cistern counters and unchanged training. Refresh fits **390px**.

Actual **FCVCEA3R v6** retains its authenticated Atreides/Guild/Fremen identities.
Original setup/inspection/reveal and phase controls plus explicitly conserved
counter/spice positions stop before the final movement ending at **v7**.
Human **Finish shipment & movement** opens automatic Collection at **v8**:
Guild's ordinary five collected spice remain factual; Atreides receives
**11→13** and Guild's own view shows **10→8**, with two territory-labelled Orgiz
notices. Ordinary Fremen stronghold income is still logged. Rival budgets remain
masked in other seats; each balance was read from its own controlled QA seat.
The expanded rule panel and footer show Advanced territory counting and pending
mixed/contested limits. Refresh retains v8 at390px. Managed tabs released.

Only these dedicated QA records were written. The failed throwaway attempt to
wait in an empty Battle phase was corrected to stop before the original final
movement ending: ordinary automation skips empty battles rather than adding a
new confirmation. No clock, wallet, paid quote, public gate or existing-game
conversion was fabricated.

## Connected behavior

- **Great Maker:** ordinary worm consequences resolve first. Every faction then
  votes in storm order; a strict majority creates a Nexus and a tie does not.
  A previous Nexus in the phase is retained. Fremen may then move any legal
  number of actual reserve forces to one allowed destination without spending
  spice, shipment or normal movement. Typed Fedaykin custody and storm/occupancy
  restrictions apply. Canceling protection of Fremen already in the affected
  territory does not cancel the separate reserve ride.
- **Discovery blows:** each of the six cards destroys existing forces and spice
  in its printed blow territory, including Fremen forces, before placing six
  spice subject to the ordinary storm exclusion. A random available token of
  the printed type is placed face down at the card's separate token destination.
- **Inspection and reveal:** Fremen privately see placed Hiereg faces; Guild
  privately sees placed Smuggler faces. During Collection, non-advisor forces in
  a token's surrounding territory may inspect it and then choose whether to
  reveal it. Other seats do not receive that private knowledge or the token's
  hidden supply order. An inspected token may remain face down.
- **Immediate rewards:** Spice Stash pays seven bank spice once. Treachery Card
  Stash draws one private card before checking the hand limit. Overflow requires
  an owned discard choice, including the new card; its saved draw/discard receipt
  prevents replay. Both stashes then retain removed physical custody.
- **Carried token:** revealing Ornithopter records its owner and acquisition
  turn. On a later turn, its owner may spend it on one ordinary movement action
  to give the selected group a fixed range of three. It grants no extra action
  or shipment. The physical token remains carried through pending movement and
  arrival interactions, then leaves play once the selected movement commits.
- **Nested locations:** the five revealed location tokens become separate,
  initially empty board territories inside their printed surroundings. Public
  reveal controls admission; a private peek alone cannot create a destination.
  Ordinary movement uses the parent territory, shipment uses stronghold prices,
  no more than two factions enter, and occupants are protected from storm and
  sandworms. Only Jacurutu Sietch contributes a stronghold toward victory.
- **Next-turn free entry:** before the next Storm phase and Ixian Hidden Mobile
  Stronghold movement, each eligible faction receives an optional signed choice
  for a location revealed on the prior turn. It may move any positive subset of
  ordinary and elite non-advisor forces across eligible sectors of the enclosing
  territory into sector zero of that location. This spends no spice, shipment or
  normal movement. Empty, storm-blocked and occupancy-blocked offers skip without
  holding up the turn. Accepted groups and arrival reactions survive restoration.
- **Cistern:** during Collection, a sole fighter occupant receives two bank
  spice after ordinary advisor releases. If two fighters occupy Cistern, the
  unresolved benefit is withheld without blocking Collection; this boundary
  does not decide which occupant should receive it.
- **Orgiz:** during Collection, a sole fighter occupant takes one spice from
  the unique rival collector of each positive board deposit after ordinary
  advisor releases. One collected pile is one observable blow even if previous
  blows stacked there. The transfer occurs after ordinary collection, conserves
  player spice, appears in the public log, and resumes from saved state without
  another payment. Unresolved Ecaz shared lots and contested Orgiz occupation
  withhold their uncertain transfers, not the ordinary Collection phase.

- **Jacurutu:** winning a battle here automatically grants one bank spice per
  opposing undialed physical force sent to the Tanks. Winner casualties and
  pre-existing Tanks do not count. Ordinary and unambiguous Advanced plans are
  playable. Mixed normal/elite plans with different possible physical counts
  leave an explicit unpaid gap pending the allocation ruling below.
- **Ecological Testing Station:** a sole non-advisor occupant receives an owned
  decrease/keep/increase choice after the ordinary storm-card window closes,
  before traversal and CHOAM/Fremen protection. The original natural dial/card
  source, turn, physical station and chosen distance remain bound through saved
  protection and typed loss continuations. Weather Control bypasses the station.
- **Shrine:** current non-advisor occupation of the publicly revealed location
  authorizes Truthtrance as Karama or Karama as Truthtrance in the existing effect
  paths. Cards retain their physical identity and custody. A committed converted
  Truthtrance retains its use receipt through departure, answering and discard.
  This does not implement missing special powers or resolve their pending rules.

Great Maker vote/ride, Discovery token/discard, next-turn entry, station and carried
Ornithopter controls use the same private legal choices as the four AI profiles.
Token backs expose only permitted information; authorized faces have readable
explanations of all eight effects. Busy and autopilot states disable human
actions. Those explanations include remaining printed effects and explicitly
distinguish them from available play.

## Interpretations retained for refinement

The Great Maker text instructs players to treat it as Shai-Hulud with listed
exceptions. The prototype consequently applies ordinary first-turn worm skipping
and Sandtrout suppression before opening its special vote and ride. Those two
interactions are **source inferences**, not separately confirmed publisher
answers or newly approved table rulings. The Discovery-only setup does not itself
enable a combined Ix/Sandtrout game.

If the required token type has no physical supply remaining, the blow continues
without creating another token. This preserves the eight-token inventory; the
empty-supply resolution remains an implementation interpretation to refine,
rather than a certified additional rule. Existing unrelated pending rulings in
the [decision index](RULE_DECISIONS.md) remain pending.

The printed next-turn entry text specifies neither an order among simultaneous
locations and factions nor whether the ordinary source-sector storm restriction
applies to this exceptional movement. Processing tokens in reveal order and
factions in storm order, while excluding source groups in storm, are **source
inferences** retained for deterministic legal play. They are not publisher
answers or newly approved table rulings.

The printed Cistern text names an occupant but permits two factions to occupy a
revealed location. The prototype pays an ordinary sole occupant and withholds
the contested bonus. The publisher's [Ecaz & Moritani rulebook, page 13](https://gamers-hq.de/media/pdf/0f/7a/86/Dune_EcazMoritani_Rulebook_EN.pdf)
says an Orgiz occupant steals one spice of each collected blow. Its bundled
Q&A does not define a stacked pile as one or several blows; searches of the
publisher/designer and community rules pages found no explicit clarification.
Basic's bounded implementation treats each positive board deposit as one
observable blow, transfers one spice from its unique collector and does not
take spice from the occupant itself. That remains an inference, not an official
ruling. Advanced now follows the supplied rulebook's territory-Collection
trigger described above. Two fighters occupying Orgiz still withhold theft.
An Ecaz shared lot or inconsistent collected payers withholds that territory's
transfer; independent territories and ordinary Collection proceed.

The Testing Station's two-occupant case leaves ordering and cumulative adjustment
unresolved. The prototype opens only the sole-occupant path and continues an
ordinary storm without that contested benefit. Choosing after the ordinary
storm-card window is an implementation timing interpretation: the printed
source specifies the Storm phase and excludes Weather Control, but does not
supply a separate station/card priority order. A legacy pending storm without
new source metadata keeps its existing movement; a subsequent naturally
produced storm can use the station. No source is inferred from display logs.

Jacurutu's text says opposing **undialed forces**, not a numeric wheel difference.
Advanced combat permits different physical allocations: an Emperor with one
ordinary force and one Sardaukar, dial two and one paid support, can dial the
supported Sardaukar alone or the supported ordinary plus unsupported Sardaukar.
Those choices leave one or zero undialed counters. The existing loser resolution
has no physical allocation choice. The user question asks whether the defeated
player should select those counters; it remains pending. The prototype records
the unpaid gap instead of silently choosing a reward. Source: publisher-authored
Ecaz & Moritani rulebook p13, with no clarification in its bundled Q&A.

## Evidence and next dependencies

Focused suites cover component inventory and private projection
(`tests/discoveries.test.ts`), genuine setup and Collection effects
(`tests/discovery-runtime.test.ts`), ordered Great Maker continuations
(`tests/great-maker.test.ts`), nested board and admission rules
(`tests/discovery-board.test.ts`, `tests/discovery-admission.test.ts`), and private
human/AI controls (`tests/discovery-controls.test.ts`). Signed free entry and its
engine, saved interaction and human/AI paths are covered by
`tests/discovery-entry.test.ts`, `tests/discovery-entry-runtime.test.ts` and
`tests/discovery-entry-controls.test.ts`. Cistern composition is covered by
`tests/discovery-collection.test.ts`; carried token selection, delayed spending
and disposal are covered by `tests/discovery-flight.test.ts`. They exercise
immutable rejections, physical custody, hidden information and JSON restoration.
They do not certify a complete module, all combined routes or difficulty strength
ordering. The free-entry/flight checkpoint `ab0ab52` passed 4,313 offline tests,
build and 40 HTTP tests, preserving all 156 opening rooms (187 after checks).

Browser room `CA782FQE` began through the genuine Discovery setup with one human
and two AI seats, then used a targeted QA state to reach the new controls without
playing a full game. It verified a partial one-force free entry into Cistern with
no spice or movement cost and a later three-territory Ornithopter move that spent
the carried token once. This is targeted browser evidence; it does not represent
an unmodified complete-game journey. Refresh restored the same forces, private
hand, ten spice, one spent movement and removed token. All 156 opening saved
rooms remain part of the preservation baseline. A user-confirmed power outage
subsequently stopped the server and verification process. After backing up all
157 current rooms, restarting the absent server restored the same browser seat,
forces, private Stunner, spice and spent token. All 157 saved rooms were unchanged.
Required broad results are recorded in the checkpoint commit.

SQLite recovery tests (`tests/discovery-recovery.test.ts`) verify competing
reveals pay only once, the private overflow choice survives restoration, and an
already committed discard resumes without another card or reward. Independent
review regressions bind worm/protection/arrival controls to their original
encounter and enforce the stash's mandatory overflow discard. Two deterministic
complete-game smoke tests (`tests/discovery-playthrough.test.ts`, seeds
2026091303 Basic and 2026091304 Advanced) preserve all components through JSON
reloads with four AI profiles. These games exercise the current prototype and
do not certify its explicitly missing effects.

Browser room `3RJBH26Y` completed genuine human Fremen setup. Reordering one
existing physical Discovery card to the front of this new QA room's deck let
normal Storm and Spice Blow actions draw Hagga Basin and place a Hiereg token
at Gara Kulon 8. The owning Fremen view privately identified Shrine, retained it
face down, and displayed readable enlarged token and full Spice Card guidance.
The room is paused at acceptance of that blow. No other saved room was changed
and no server restart was needed. Required broad verification results and the
source-bound report are recorded in the checkpoint commit.

The location-effects batch adds focused Jacurutu engine/SQLite tests, Testing
Station Basic/Advanced producers, Weather exclusion, saved Fremen losses,
private controls, all four AI paths and concurrent SQLite choices. Shrine tests
cover ordinary/special card substitution, reserved-card rejection, individual
physical-card controls and committed JSON/SQLite continuation. Concurrent
declarations preserve one exact physical discard and resume the prior effect. Independent
reviews check all three effects and required broad results are recorded in the
checkpoint commit and its source-bound report.

Browser room `A5EJQ2W4` began as a fresh three-player lobby through the backed-up
Discovery starter, then used real setup, reveal and free-entry actions in a
focused QA scenario. Its human Atreides occupant chose to increase an ordinary
two-sector storm to three; the storm moved from sector six to nine and proceeded
to Spice Blow. Refresh restored the same station forces and private Snooper.
This is targeted control/recovery evidence, not an unmodified complete game.
The 187 opening saved rooms remain preserved; no server restart was needed.

1. Resolve contested Cistern/Orgiz/Testing Station benefits, Ecaz shared-lot
   Orgiz allocation and Jacurutu's mixed physical dial allocation; complete
   remaining controls and effects when settled. Basic's per-collected-deposit
   Orgiz interpretation remains provisional; the Advanced count is source-cut over.
2. Integrate combined modules and complete games, then refine interaction,
   strategy and presentation coverage before opening normal start gates.
3. Use the existing prototype starter and saved-room verification for further
   batches. Focused evidence does not establish complete module compliance.
