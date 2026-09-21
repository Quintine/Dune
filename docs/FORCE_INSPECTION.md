# Public force counter inspection

21 September 2026. Each live player summary now opens **Inspect forces**.
The enlarged diagrams and public location list work during other players’
decisions without submitting an action. The internal reference has a faction
selector covering all twelve sets, including special and advisor faces.

The [inventory projection](../game/force-inventory.ts) consumes public player
force fields and the existing public Homeworld table. Reserves, Tanks, nonzero
board groups and foreign Homeworld deployments count physical counters. Elites
are subsets, never additional counters; native Homeworld groups subdivide the
reserve pool. Emperor’s two worlds remain separate in that breakdown. The
existing [Homeworld custody](../game/homeworld-custody.ts) and
[public table](../game/homeworld-game.ts) define those identities.

Ixian ordinary forces are Suboids; special names reuse
[the combat registry](../game/combat.ts). Physical special identity comes from
the public elite pools, including Basic Homeworld games. Ordinary Basic tables
that combine Emperor/Fremen counts do not fabricate a starred distribution.
Bene Gesserit [advisor stance](../game/advisors.ts) applies across a territory’s
sectors and does not create an extra counter. Reserves and Tanks have no deployed
stance. Temporary Sardaukar powers, support, leaders and Kwisatz do not change
this physical inventory.

The projection iterates actual force locations, including the unplaced Mobile
Stronghold during genuine Ix setup and named Discovery locations. It does not
filter away pieces because their location is outside the current map. Native
worlds stay separate from board location keys. Invalid counts or unreconciled
native reserves show a refresh notice instead of invented totals.

A deployed [No-Field](../game/richese-no-field.ts) contributes only a separate
concealed marker and its public location. No hidden face, inventory, last-used
value or future force quantity is read or inferred. Revelation draws from the
reserves available then; it does not reserve particular counters. Effective
presence helpers are deliberately excluded from physical counting.

Focused tests cover twelve faction identities, mixed pools, multi-sector
advisors, native and foreign Homeworlds, actual Basic Homeworld projections,
genuine Ix setup before HMS placement, a controlled Discovery location, identical
0/3/5 concealed-marker results, immutable input and JSON continuation. Rendering
tests cover named live triggers, the reference gallery, readable details and
invalid-state feedback. This is read-only inspection, so no AI action or strategy
was added. Existing legal participation and saves remain authoritative.

Source-bound checks, independent review, browser observations, preservation and
Git delivery are recorded in the private checkpoint. These are original
diagrammatic faces, not certification of the manufactured components’ layout.
Full visual/accessibility acceptance and combined-game verification remain open;
mode and publication gates are unchanged.
