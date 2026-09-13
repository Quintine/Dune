# Harass & Withdraw development prototype

Updated 14 September 2026. This connects the physical card to battle plans,
private inspections, force returns, controls, AI and saved continuation. It does
not complete the independent three-card variant or open public mode gates.

## Authority and interpretation

The [Ecaz card audit](ECAZ_TREACHERY_RULES.md) records the inspected physical face,
designer walkthrough and publisher rules. The [GF9 Ecaz & Moritani
rulebook](https://www.gf9games.com/dune/wp-content/uploads/EcazMoritani-Rulebook-LOWRES.pdf),
printed pp. 11 and 16, establishes the slot/category distinction, mandatory
after-use disposal and the restriction to the card user's undialed forces.
The [designer walkthrough at 9:11](https://www.youtube.com/watch?v=iF5E3-LOfhY&t=551s)
and [physical close-up at 4:28](https://www.youtube.com/watch?v=P9ZTV1uZqsM&t=268s)
establish reveal timing, opponent-Traitor cancellation, ordinary leader death,
Face Dancer protection for returned forces and the own-Homeworld prohibition.

Two implementation inferences are explicit:

- Withdrawal precedes weapon/explosion losses because it acts during wheel
  reveal. Execution waits atomically for Traitor declarations so a successful
  opposing call cancels the return without reversing a previous resource change.
  No retrieved publisher FAQ directly answers the explosion combination.
- Discard the card after use even when its owner wins through a Traitor call.
  The later card-specific instruction overrides ordinary winner retention,
  using the same recorded precedence as [Planetologist](PLANETOLOGIST_RULES.md#mandatory-discard).
  This is a specificity inference, not a dedicated Harass FAQ.

Planetologist's existing inspection answers remain unchanged. Ecaz's explicit
instruction to report no weapon/defense is not silently extended to other
slot substitutions.

## Connected behavior

Use the existing independent Ecaz card development setup. All three cards enter
the physical deck before genuine Basic or Advanced setup; selecting Ecaz alone
does not enable this variant. The owner may place Harass in either card slot.
It supplies no weapon attack or defense, cannot occupy both slots, and cannot
supply the actual opposite category needed by Chemistry or Weirding Way's
alternate role. Ordinary leader and Voice requirements remain in force.

Atreides receives a category-null answer without learning the physical card's
identity. The owner can retain a slot-only card after that answer. The sealed
plan still contains its exact ID. Complete-plan inspection reveals the actual
physical plan; Truthtrance's existing literal slot-occupancy promises keep their
meaning. An empty-category answer is not a promise that the physical slot is empty.

The shared physical quote derives dialed counters from `casualtyOptions`, then
returns the undialed normal and elite counters to their owner's reserves. The
leader resolves normally. An opponent's successful Traitor call, including mutual
calls, cancels withdrawal. Returned reserves are outside subsequent board losses
and Face Dancer replacement. Harass is discarded once and excluded from ordinary
winner retention and Moritani ally retention.

Both selectors enforce the complete pair in either selection order. The private
guide shows the exact return and a reason for an unsupported choice. All four AI
profiles use the same physical quote and category-aware inspection comparison;
the card adds no fictitious weapon or defense value. Stronger profiles value
saved forces when expecting defeat and discourage use when expecting to win.
This is a legal strategy path, not strength calibration.

## Current boundaries

- Basic and Advanced physical allocations must identify one normal/elite
  commitment and one return allocation among sectors. Zero/all returns and
  unique typed allocations are supported. Ambiguous allocations reject before
  sealing; explicit private allocation controls remain unfinished.
- Additional optional modules remain gated, including Homeworlds, Nexus,
  Leader Skills, Tech Tokens, Stronghold Cards and Discoveries. This includes
  the printed own-Homeworld prohibition without claiming other Homeworld
  battles are already implemented for this card.
- Richese card-family configurations remain gated because Stone Burner may
  compare original or post-withdrawal undialed forces, which can reverse the
  winner. A user question has been sent; no answer is assumed. The guard uses
  public configuration, never Stone Burner's hidden custody. CHOAM without
  Richese remains eligible. This is a development boundary, not a printed ban.
- Co-present reciprocal Ecaz allied armies on either side reject before
  sealing; other faction integration gates remain in force. This prototype does not settle Ecaz's undialed allied support allocation.
- Reinforcements remains unavailable pending its separate cost and outcome
  accounting. Neither slot recognition nor card text proves its effect complete.

## Verification and preservation

Focused rules, controls, AI and authenticated recovery suites record the exact
supported paths. Fixtures explicitly distinguish genuine variant setup from
later conserved battle staging. Independent review precedes final complete-game
samples and browser checks. Final commands and source fingerprints are retained
in the private checkpoint report and Git message; a sample does not certify
every faction or expansion combination.

The opening baseline contains 936 rooms and 1,959 seats. Every room and original
seat/recovery/entry/handover record survived the reported outage unchanged;
SQLite integrity and foreign-key checks passed. Browser refresh restored the
existing test seat. The server was reused without a reset or scheduled restart.

The isolated browser room used a genuine three-seat Emperor/Atreides/Tleilaxu
setup, followed by an explicitly conserved battle fixture. Actual controls
verified full-card inspection, the category-None answer, Defense-first selection
without a duplicate Harass or alternate Chemistry weapon, a one-force plan,
public reveal and the owner’s traitor decline. Four forces returned; one went to
the Tanks and the leader died. Opposing decisions completed through the engine,
including a genuine Face Dancer replacement of the other army. Refresh restored
the collection-phase state, exact private views and the single discarded Harass.
The private script’s first comparison failed only because its expected version
omitted the HTTP layer’s increment; the preserved failure was corrected without
changing production code or overwriting a game.
