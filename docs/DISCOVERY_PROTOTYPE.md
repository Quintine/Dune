# Discovery functional prototype

13 September 2026. The first connected Discovery batch is **Prototyped**, with
partial rules coverage. It connects physical components, real actions, private
controls, AI choices and saved continuation. Normal public Discovery and
Advanced start gates, and the publication gate, remain closed.

## Source and setup boundary

The [component acquisition record](DISCOVERY_COMPONENTS.md) identifies the
publisher-authored *Ecaz & Moritani* rulebook, pages 12–13, and the physical card
scan used for all six placements. Its verified inventory is seven Spice Cards
(six Discovery territory cards and Great Maker) and eight tokens. This prototype
uses those identities and effects; it does not treat test outcomes as rulings.

`initializeDiscoveryGameForAudit` enters the real staged setup with two through
six ready base factions, in Basic or Advanced, with Discoveries enabled before
components are dealt. It adds the seven cards to the ordinary Spice Deck and
creates one of each token behind shuffled, opaque physical identities. It rejects
redealing a started or nonempty game. Other expansion decks and optional modules
are outside this initializer. No ordinary player action or room endpoint can
bypass the normal start gate through it. The existing backed-up local starter
accepts `--profile discovery` for a fresh ready base-faction lobby:

```sh
node --import tsx tools/start-prototype.ts --profile discovery --db PATH --room CODE --version NUMBER --out /private/new-directory
```

It preserves all seats and other rooms, requires the current version and refuses
to redeal a started game. The default `ix` profile remains available.

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
- **Cistern:** during Collection, a sole occupant receives two bank spice. If two
  factions occupy Cistern, the unresolved benefit is withheld without blocking
  Collection; this boundary does not decide which occupant should receive it.

Great Maker vote/ride, Discovery token/discard, next-turn entry and carried
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
the contested bonus. Orgiz remains disabled because the source also does not
settle whether a stacked board deposit represents one or several collected
spice blows; contested occupancy and unresolved Ecaz shared collection add
further unanswered cases.

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
ordering. Required broad checkpoint checks are pending for this expanded batch.

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

1. Connect the four remaining special location benefits: Jacurutu battle income,
   Ecological Testing Station storm adjustment, Shrine card conversion and Orgiz
   collection transfer. Ordinary Jacurutu victory counting does not implement its
   battle income; Orgiz awaits the collected-pile ruling above.
2. Resolve contested Cistern ownership, then integrate combined modules and
   complete games before refining or opening gates.
3. Run the required broad checkpoint, browser and saved-room verification for
   this expanded prototype. Focused evidence does not open normal public starts.
