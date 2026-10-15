# Harass & Withdraw development prototype

Updated 16 October 2026. This connects the physical card to battle plans,
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

## Provisional Stone Burner timing — 16 October 2026

The standing 14 October choose-recommended instruction selects the
post-withdrawal comparison for the development prototype. The earlier question
remains unanswered; this is an implementation interpretation, not a new
publisher ruling or a user answer. The Harass face/designer reveal timing above
and [Stone's physical undialed-token instruction](STONE_BURNER_ENGINE_AUDIT.md#primary-evidence-and-exact-effect)
support treating returned reserves as no longer in the battle. A fresh text
lookup in the supplied Advanced PDF found no named Harass/Stone combined rule.

Normal Stone resolution compares counters left after successful Harass,
including same-plan and opposing holders and Mirror-copied Stone. A successful
opposing Traitor cancels the withdrawal; its validated outcome still wins before
Stone scoring. Allocation choices and original dial/support legality remain
mandatory. No return, fee, casualty or card disposal executes twice.

Active Occupy returns only the actual card user's pool. Ecaz Harass removes
the original fixed undialed `floor(E/2)`, leaving the ally variable remainder;
ally Harass removes variable undialed counters, leaving fixed Ecaz undialed
forces. Original mandatory `ceil(E/2)` commitment and native ally support stay.
Canceled Occupy uses its lead's ordinary own pool.

Precommit checks use public configuration and selected lead, never a hidden
opponent Harass/Stone card. If an opposing Ecaz lead may withdraw its fixed
remainder, each revealed alternative must have an allocation-invariant winner;
different alternatives may legitimately have different winners. Actual controls
label post-withdrawal counts as conditional on no opposing successful Traitor.

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

The shared physical quote validates dialed counters from `casualtyOptions`, then
returns the undialed normal and elite counters to their owner's reserves. The
leader resolves normally. An opponent's successful Traitor call, including mutual
calls, cancels withdrawal. Returned reserves are outside subsequent board losses
and Face Dancer replacement. Harass is discarded once and excluded from ordinary
winner retention and Moritani ally retention.

Both selectors enforce the complete pair in either selection order. The private
guide explains unique returns or the later revealed allocation choice. The
[physical allocation follow-up](HARASS_ALLOCATION.md) connects typed and sector
selection after reveal, with exact committed winner losses. All four AI
profiles use the same physical quote and category-aware inspection comparison;
the card adds no fictitious weapon or defense value. Stronger profiles value
saved forces when expecting defeat and discourage use when expecting to win.
This is a legal strategy path, not strength calibration.

## Current boundaries

- Basic and Advanced now support explicit ordinary/elite and sector allocation
  after reveal. Unique returns are automatic; previously valid legacy battles
  retain unique-only derivation. See the [allocation contract](HARASS_ALLOCATION.md).
- Additional optional modules remain gated, including Homeworlds, Nexus,
  Leader Skills, Tech Tokens, Stronghold Cards and Discoveries. This includes
  the printed own-Homeworld prohibition without claiming other Homeworld
  battles are already implemented for this card.
- Richese card-family configurations now admit Harass under the
  [provisional post-withdrawal policy](#provisional-stone-burner-timing--16-october-2026).
  The ordinary invariant-allocation guard and separate Ix/Poison Tooth timing
  boundary remain. No public expansion start or played-game retrofit is added.
  A card user's own still-concealed No-Field remains guarded until its original
  reveal; this wave does not certify Harass on a concealed native marker.
- Co-present armies remain guarded in Basic or without the supported Advanced
  Occupy profile. The [combined-army follow-up](ECAZ_OCCUPY_RULES.md#independent-cards-with-combined-armies--2-october-2026)
  returns only actual card-user forces: original fixed Ecaz commitment or the
  selected ally's native variable commitment. It never returns the other ally
  or recomputes mandatory fixed losses from the diminished board.
- [Bounded Reinforcements](REINFORCEMENTS_RUNTIME.md) can appear in the
  opposing Battle Plan in classic-faction Basic/Advanced games. The two cards
  cannot share one player's plan; their relative same-plan timing remains
  unresolved. Both prototypes retain their separate provisional cost and
  outcome interpretations.

## Scoped interaction proof — 16 October 2026

- The affected thirteen-file offline union passes **161/161**, including
  Stone/Harass pure and native battle cases, original fixed/variable Occupy,
  typed/sector returns, Mirror retention and Traitor cancellation. Types/lint
  and production build pass; build retains module-register, large-chunk and
  Unknown-route warnings.
- Eight genuine Richese/classic Basic/Advanced same-plan policy programs
  exercised all four profiles and24 accepted continuation actions. This is
  minimal legal participation, not strategic calibration.
- Two actual styled390px table journeys used original native controls from
  before plan commitment through winner retention and collection. Basic
  Harass dial2 returns3, leaving0 versus Stone dial4's1: defender wins, the
  two committed attackers reach Tanks, and Harass discards once. Advanced
  dial2/support1 exposes the actual typed choice; selecting one elite
  commitment returns three ordinary counters, charges support once30→29,
  kills both original leaders and awards bounty11. Stone winner keeps its
  physical card and the original battle/decision clears. Conditional revealed
  counts and the provisional warning are visible; no root overflow or
  application/browser error occurred in the corrected host's journeys.
- Native fixtures exposed two driver assumptions: a Richese Bidding lot can
  exist without an ordinary row, and shared preparation still needs its actual
  ready actions. Both now follow native controls. Bounty is compared between
  paired modes rather than pinning a wallet before automatic collection.
- Current reference parses;33 evidence paths across both topics resolve and
  all ten checklist facets remain Partial. Runtime artifacts stay outside Git.
  No human server, saved room, D1, deployment or public start changed. No new
  broad, HTTP, recovery/privacy/custody assurance campaign ran.

## Historical verification and preservation — 14 September 2026

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
