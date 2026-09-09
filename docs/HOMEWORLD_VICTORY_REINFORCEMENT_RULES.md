# Caladan victory reinforcement contract

Source review, 10 September 2026. The original high Caladan face grants an
optional transfer of one reserve force to the location of a victorious battle,
provided Atreides still has a force there. The printed high range is six through
twenty native forces. Territory and Homeworld destinations are both named.
The [component audit](HOMEWORLD_COMPONENT_AUDIT.md) records the original physical
face; its text was visually checked again using the retained component image.
The linked [designer presentation](https://www.youtube.com/watch?v=4KZKz13wf9c)
corroborates the visible component. No unheard narration supplies a ruling.

[E3 pp.9–10](https://www.gf9games.com/dune/wp-content/uploads/EcazMoritani-Rulebook-LOWRES.pdf#page=9)
make native population thresholds continuous and Homeworld effects immune to
Karama. The implementation checks the current threshold after winner casualties
and again when the optional transfer is selected. A legal transfer from six
reserves to five is not retroactively invalidated. Foreign visitors do not raise
native population. Basic and Advanced use the same optional physical transfer;
it does not revive a counter, charge spice or spend ordinary shipment/movement.

The original winner is the beneficiary, including a traitor victory. Loss,
mutual-traitor destruction and explosion do not create a winning Atreides
beneficiary. No surviving Atreides force means no destination. Fighting on
native Caladan cannot create an additional counter: those reserve forces are
already present in the native battle pool. That source/destination coincidence
has zero net transfer, consistent with the physical-custody treatment in the
[replacement contract](HOMEWORLD_REPLACEMENT_RULES.md).

The transfer must stay at the original battle location. A foreign Homeworld
receives one actual ordinary counter withdrawn from Caladan. Arrakis uses an
explicit sector choice within the battle territory. Occupancy constraints and
the allied-Homeworld prohibition remain in force. Arrival at an Ambassador
stronghold uses the existing entry predicate and a source-bound continuation;
it does not create a second battle victory.

## Unresolved ordering and entry combinations

The E1 Face Dancer sequence preserves the original winner and its ordinary
battle consequences before replacing surviving forces. No retrieved official
example orders that replacement against the later Caladan Homeworld card.
The coordinator asked the user whether reinforcement precedes or follows Face
Dance; the answer remains pending. The engine displays that boundary when the
two opportunities overlap. It supports an explicit decline without choosing
the disputed placement order; this does not certify the combined interaction.

Storm-sector placement, Hidden Mobile Stronghold classification, and otherwise
relevant Intrusion/Terror reactions remain explicit source boundaries.
Destination guards use public physical presence and token placement, never a
secret Terror identity. Low Grumman's entering-force minimum still determines
whether its Terror reaction would be relevant to the one arriving counter.

The [integration audit](HOMEWORLD_VICTORY_REINFORCEMENT_INTEGRATION.md) maps
battle cleanup and persistence. The
[runtime checkpoint](HOMEWORLD_VICTORY_REINFORCEMENT_RUNTIME.md) records the
implemented flow and verification. No complete Homeworld, Advanced or expansion
release is claimed.
