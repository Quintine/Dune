# Truthtrance: compound shipment promises

14 September 2026. This extends the [reserve-shipment prototype](TRUTHTRANCE_SHIPMENT_PROMISES.md)
with shipment-only AND/OR questions. Public mode and publication gates remain
unchanged.

## Mixed current facts and future shipment — 3 October 2026

The structured builder now supports bounded nested AND/OR trees containing
current named-card, card-count, inventory, traitor, personal-spice, physical-force
or knowledge facts alongside reserve-shipment conditions. Both kinds must be
present; the existing software limit is sixteen logical leaves and four grouped
levels, not a printed limit on game questions. Current fact legality comes from
the existing fact parser; reserve shipment uses the original destination/count
quote and the same active-unused-shipment/mode boundary.

Evaluate current facts when a definite answer is given and freeze their
three-valued results privately. Later legal card/force/spice changes cannot
rewrite the past statement. Future leaves still describe one eventual reserve
shipment or its absence, and the whole expression must match the public answer.
For example:

- **Yes** to “I currently hold at least10 spice OR I will ship4 to Arrakeen”
  with20 spice permits later spending and no shipment.
- **No** to “I currently hold at most10 spice AND I will ship4 to Arrakeen”
  with20 spice permits shipment even if its cost later reduces the wallet to5.
- **Yes AND** with a true current clause still requires the future shipment.
  **No OR** with a true current clause is impossible.

Unknown current information stays unknown: it is not converted to false for a
No promise. A definite answer is available only when an actually legal future
outcome makes the whole statement definite. Multiple ordinary and mixed
promises constrain that same event together. Voluntary spending cannot remove
the last legal completion, but need not preserve a current holding that was not
itself a future promise.

Only the respondent receives a mixed promise's compiled fixed answers and
private feasible choices. Public question/history text keeps the original
grouping and whole answer, never which current clause matched. Shared shipment,
skip, preparation, release, controls and minimal legal policies use the same
frozen expression. Default public parsers reject caller-supplied constants.

The existing FAQ whole-question semantics and historical/current distinction
support this composition; it is not a new expansion or timing ruling. Earlier
phases, other future actions, expansion shipment modes and arbitrary prose
enforcement remain outside the bounded implementation.

Eight actual programs cover the four mixed truth/skip/shipment/changed-spice
paths and all four legal policies. Nested and joint promises have rule
regressions. The affected truth/ship/discard rule batch passes88/88;
mixed/reference23/23, types/lint and
build pass. Human390px **4PVKRRWB v10** authored and answered the actual OR
claim, then spent all20 spice as a bribe, skipped shipment and fulfilled the
promise while the public answer stayed Yes. This is bounded local evidence, not
complete Truthtrance, module or deployed acceptance.

The later390px **FCGZTEGV v11** control check authored an outer OR around
`(current spice >=10 AND ship4 to Arrakeen)`, with an alternative shipment6
to Carthag. The respondent answered Yes at20 spice, paid a real12-spice bribe,
then shipped4 to Arrakeen at a four-spice cost. The frozen nested branch
fulfilled the whole answer with only4 current spice; native end-movement
continued the original turn and the exact grouped question/Yes survived refresh.
This is additional human control evidence, not another program case or an
expanded timing/module claim.



## Meaning and authority

The [GF9 November 2020 FAQ, printed page 8](https://www.gf9games.com/dune/wp-content/uploads/2020/11/Dune-FAQ-Nov-2020.pdf)
permits AND/OR questions and binds definite answers while compliance remains
possible. Each condition here describes the same eventual reserve shipment in
the active opportunity, using a destination and minimum physical force count.
The original shipment-only form does not promise two shipments; the later
mixed form above adds current facts without turning them into future holdings.

AND is true only if every condition matches. OR is true if any condition matches.
A No answer negates the whole expression: No to AND requires at least one false
condition; No to OR requires every condition to be false. Skipping shipment makes
all these positive shipment conditions false. Separately answered questions must
all be honored together.

For example, Yes to “at least six to Carthag OR at least four to Arrakeen” permits
either branch. No to that same question permits fewer than six to Carthag, fewer
than four to Arrakeen, another destination or no shipment. AND with two different
destinations cannot be fulfilled by a single shipment, so Yes is unavailable.

## Connected prototype

The question form adds a second destination/count condition and an AND/OR choice.
The shared engine expression supports grouping within software limits of sixteen leaves and four nested groups; the first visual builder exposes two conditions. Existing flat questions
and saved promises retain their meaning. Public question/history text preserves
grouping, while answer feasibility and suggested preparations stay private to
the respondent.

The completion search considers every relevant destination, physical count and
legal sector, with the same controlled preparations and funding as single
promises. It evaluates the entire expression and all earlier promises together.
Actual shipment, skipping, voluntary spending and opposing-effect release use
the same evaluator. A fulfilled promise records the shipment event and survives
later movement or casualties.

All four AI profiles rank the projected feasible answers using only public
destination value and their own reserves. Strategic preference never determines
whether an answer is possible. The existing complete continuation remains the
fallback when a strategic shipment shortlist misses a legal route.

## Evidence and remaining scope

Focused engine, controls, AI and authenticated SQLite cases cover whole-expression
truth, alternative destinations, old saves, joint commitments, custody, private
restoration and duplicate actions. Final results and source fingerprints belong
to the private checkpoint report and Git message.

The isolated browser used genuine base setup before conserved turn-two staging.
The human asked “twenty to Carthag OR four to Arrakeen.” The respondent's legal
AI policy answered Yes, and the public grouped question/answer survived refresh.
Its next AI action shipped four to Arrakeen, spent four spice and fulfilled the
aggregate promise once. All six accepted actions replayed exactly; all private
views, card/force custody and the original seat row were preserved. This is a
targeted browser scenario, not a complete human game.

The existing active-unused-shipment scope remains: base Basic, and supported
base Advanced games without Guild or optional modules. Mixed current-fact/
shipment trees now use that same opportunity. Earlier timing, other future
actions, expansion shipment combinations and arbitrary prose remain unfinished.
This prototype does not settle pending material rulings or certify complete
Truthtrance.

The opening backup preserves 1,004 local rooms and their seat/recovery records.
Reuse the healthy server and keep all subsequent games.
