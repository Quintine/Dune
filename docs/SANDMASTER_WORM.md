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

A shared public quote validates the player, destination, skill and single positive
pile. The checkbox defaults to collection but permits declining it. An empty or
ambiguous pile suppresses collection without blocking ordinary riding. Legacy
saved actions without the new field retain their original behavior. No invented
intermediate route or extra normal movement is consumed. Multi-sector and typed
elite selections transfer one spice total, not one per force or source sector.

The engine validates every force before moving spice from the board to the
player, logs the automatic effect and then opens any Bene Gesserit arrival choice.
Existing versioned room writes commit that transfer once. A saved pending arrival
resumes only the remaining reaction and ride queue; no new receipt is needed.
All four AI profiles attach the optional collection flag to the existing legal
ride candidates. Destination policy and strength tuning are unchanged.

## Verification and remaining work

Focused engine, controls and SQLite checks cover Basic/Advanced force custody,
source exclusion, decline, omitted legacy fields, empty and ambiguous piles,
illegal requests without mutation, native trainer ownership/visibility, public
mode guards, private views, duplicate concurrent requests and restart during a
Bene Gesserit reaction. Separate queued rides and a real special-Karama worm
through Nexus exercise the production continuation. The fixture preserves the
Fremen three-elite total rather than assuming the Emperor five-elite total.
Independent source and implementation review found no material defect in this
bounded contract. Final check/build/HTTP results, targeted browser continuation,
sample games, saved-game preservation and Git delivery belong to the private
source-bound checkpoint and commit message.

Other expansion factions/modules, the Ecaz card variant and multiple positive
piles remain guarded. Other special relocation, full Leader Skills integration,
complete human games and final presentation remain unfinished. Strategy refinement
waits for the [AI feature-completion gate](AI_DEVELOPMENT_PLAN.md).
