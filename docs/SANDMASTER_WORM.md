# Sandmaster worm-ride collection

20 September 2026. **Prototyped**, with **Partial** rules coverage. Native
Fremen worm rides connect optional destination collection in Basic/Advanced
Leader Skills development games. Public module and publication gates stay closed.

## Source contract

The [existing Sandmaster contract](SANDMASTER_MOVEMENT.md#source-contract),
checked physical card and designer walkthrough allow one spice when forces move
into or through a territory containing spice. The [GF9 core rulebook, Shai-Hulud
and Fremen sections](https://www.gf9games.com/dunegame/wp-content/uploads/Dune-Rulebook.pdf)
calls riding a move of some or all forces to a destination after Nexus, subject
to storm and occupancy. The archived core text is identified in the
[source archive](LEADER_SKILLS_RULES.md#sources-and-local-evidence).

Applying that movement wording gives one optional spice at the destination;
a worm ride specifies no traversed route. The source earns nothing. Separate
rides are distinct movements under the existing explicit per-movement inference.
This composes the printed rules; it is not a newly located combined-effect FAQ.
The native trainer must be alive, uncaptured and available for its normal band.
Collection follows legal placement and precedes faction arrival reactions under
the common skill-before-faction order. Subsequent arrival effects do not undo it.

## Connected behavior

A shared public quote validates the player, destination, skill and all positive
destination piles. Collection remains optional and capped at one spice for the
entire ride. With several valid piles, the owner chooses the exact sector supplying
that spice; placement of the riding forces does not constrain the chosen pile.
This allocation policy is **provisional**, not a publisher sector-allocation ruling.
It does not invent a pile, an intermediate route or extra normal movement.
Multi-sector and typed elite selections still transfer one spice total, not one
per force, source sector or destination pile.

The checkbox defaults to collection but permits declining it. A multi-pile
selector is controlled by the parent's selected quote key and shows each sector's
before → before − 1 quantity. A single pile needs no selector; an empty destination
or unsupported quote has no collection checkbox. None of these cases prevents
ordinary riding without collection, and there is no extra confirmation.

`sandmasterWormCollection(game, player, destination, sector, decision = game.decision,
selectedPile?: string)` retains its native Fremen, phase, decision, leader and
configuration guards. Its quote includes `piles: Array<{ key: string; before: number }>`,
the selected `key` and `before`, and any `blocked` reason. Without `selectedPile`,
the quote offers the first legal pile; this UI default is not action authorization.
An invalid selected key blocks the quote, and blocked quotes expose `piles: []`.

An accepted worm-ride action may set `sandmasterCollect: true` and
`sandmasterPile: "territory:sector"`. Collection from multiple positive destination
piles requires that explicit key; omitting it rejects the action without mutation.
Single-pile collection still accepts the legacy boolean-only action. Send the pile
field only when collecting. Declining collection or omitting both fields preserves
ordinary riding and leaves board/player spice unchanged.

`SandmasterWormChoice` receives `quote`, `collect`, `onChange(collect)` and the
required `onPileChange(key)` callback. The parent owns selection state, requotes
that exact key and includes it in the collecting action.

The engine validates every force before moving spice from the board to the
player, logs the automatic effect and then opens any Bene Gesserit arrival choice.
Existing versioned room writes commit that transfer once. A saved pending arrival
resumes only the remaining reaction and ride queue; no new receipt is needed.
All four AI profiles attach the optional collection flag and exact quoted pile key
to the existing legal ride candidates. Destination policy and strength tuning are
unchanged.

## Verification and remaining work

The focused suites include Basic/Advanced force custody, source exclusion, decline,
omitted legacy fields, empty destinations, explicit allocation between two positive
piles, ambiguous or invalid requests without mutation, native trainer
ownership/visibility, public mode guards, private views and JSON restoration during
a Bene Gesserit reaction. The selected pile loses only one spice, other piles remain
unchanged, and a pending arrival cannot collect a second time. Separate queued rides
and a real special-Karama worm through Nexus exercise the production continuation.
The fixture preserves the Fremen three-elite total rather than assuming the Emperor
five-elite total. Controls retain eligible-owner and blocked-state coverage rather
than pinning selector wording, HTML order or callback echoes.

Integrated native smoke in both modes collects exactly one from selected
Pasty Mesa6 (3→2), leaves Mesa5 at2 and lands four forces in Mesa5 without
changing normal movement. An isolated 390px production control selects
Mesa6 and observes the same live-engine result, personal spice5→6.
All four existing policies retain legal continuation; collecting declarations
carry explicit pile keys without changing destination strategy.

Other expansion factions/modules and the Ecaz card variant remain guarded.
Other special relocation, full Leader Skills integration,
complete human games and final presentation remain unfinished. Strategy refinement
waits for the [AI feature-completion gate](AI_DEVELOPMENT_PLAN.md).
