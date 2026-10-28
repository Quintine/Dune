# Truthtrance: recorded predictions and storm knowledge

## Public Basic Richese cache lot — 28 October 2026

**Prototyped / Partial.** A separate `{kind:'cacheLot', name}` fact asks whether
the currently offered public Basic Richese cache card has a named printed face.
Any seated respondent can give a definite answer while that actual lot is
active. Missing, completed, Advanced and Black Market lots return unknown.
Only the offered card is read, not the other cached cards; the existing
Atreides inspection question keeps its original meaning. Single and compound
editors use the public name registry and minimal bots use the same answer path.

The [GF9 FAQ p. 8](https://www.gf9games.com/dune/wp-content/uploads/2020/11/Dune-FAQ-Nov-2020.pdf#page=8)
permits game-related yes/no questions. This selector and its active-lot boundary
are a provisional online interpretation; broader special auctions and full
Truthtrance acceptance remain open.

## Already answered battle Prescience — 28 October 2026

**Prototyped / Partial.** A current-fact question can compare the leader,
weapon, defense or exact dial already revealed through native battle
Prescience. The field must match the answered inspection and the respondent
must be entitled to the existing battle insight. Pending or unavailable
inspection, a different field and an expired battle return unknown. The
normal inspection category conversion is reused, including an Ecaz battle
special represented as no element. The question exposes no inspected value to
the asker beyond the target's ordinary Yes/No response.

The [GF9 FAQ p. 8](https://www.gf9games.com/dune/wp-content/uploads/2020/11/Dune-FAQ-Nov-2020.pdf#page=8)
permits game-related yes/no and compound questions. This bounded selector
expresses that general permission and is not a new printed restriction.
Other forms of private knowledge, general freeform interpretation and complete
Truthtrance coverage remain unfinished.

Eleven focused files pass 58 cases, including genuine Basic Prescience answers,
Truthtrance questions, all four minimal bot responses and battle continuation
for all four fields. The native fixture orders unopened cards without staging
hands or positions. Controlled component callbacks exercise the selectors;
`npm run check:quick` and the production build also passed. Browser and
deployed acceptance remain open.

## Basic Ixian auction knowledge — 28 October 2026

**Prototyped / Partial.** The structured fact `{kind:'ixPoolPeek', name}`
asks whether a named printed Treachery Card is in the Basic Ixian's recorded
inspected auction group. The group records cards retained after Ixians returned
one to the deck; it is not the current unsold lots, and retains cards sold
afterward. The current Bidding phase and turn, native Ixian seat and matching
recorded controller are required. A canceled, absent, stale or unauthorized
inspection yields unknown. Other factions do not receive the group; the target
alone sees the verified scalar, and the normal answer publishes the response.

The [GF9 FAQ p. 8](https://www.gf9games.com/dune/wp-content/uploads/2020/11/Dune-FAQ-Nov-2020.pdf#page=8)
permits game-related yes/no and compound questions. This selector and its
boundary are a software interpretation, not a printed restriction. Advanced
Technology and borrowed Homeworld inspection are separate and remain open.
Eight related unit files pass 27 cases, including a genuine Basic inspection,
private questions and all-profile responses. Missing and aged observations are
explicitly staged; broader combinations and deployed acceptance remain open.

## Atreides ordinary auction knowledge — 27 October 2026

**Prototyped / Partial.** The structured fact `{kind:'auctionPeek', name}` asks
whether Atreides' currently inspected ordinary auction card has the named
printed face. The answer uses only the current lot's successful native
inspection. Other factions, canceled or expired inspections and missing lots
return unknown. Active Ixian and Richese special auctions and non-Atreides
occupied Homeworld inspection are separate and remain unfinished. The card identity is
not added to another seat's view; the selected answer is public through the
normal Truthtrance flow. Single and compound selectors use the public printed
name registry, and existing bots answer from their own projected scalar.

The [GF9 FAQ p. 8](https://www.gf9games.com/dune/wp-content/uploads/2020/11/Dune-FAQ-Nov-2020.pdf#page=8)
permits game-related yes/no and compound questions. This selector and its
software boundary are a bounded interpretation, not a printed restriction.
Native Basic/Advanced auction progression exercises an actual card inspection,
question, answer and all four minimal AI profiles; the unavailable-inspection
case is staged. Eight related unit files pass 32 cases. Broader question
language and special-auction interactions remain open.

## Atreides Spice Blow knowledge — 27 October 2026

**Prototyped / Partial.** The structured fact `{kind:'spicePeek', value}` asks
whether Atreides' currently known next Spice Card is a sandworm, Sandtrout, or
a blow naming one of the printed territories. A Discovery card at the named
territory also matches that territory question. Only the native Atreides seat
with an active, uncanceled Shipment and Movement peek receives a definite
answer; an unavailable peek, another faction or an empty deck yields unknown.
This reports existing knowledge rather than granting a forecast, looking at a
future replacement card or promising a future outcome. Both single and
compound controls use public face choices; the owner-only scalar, physical
Truthtrance handling and four legal bot answer paths remain shared.

The existing general [GF9 FAQ p. 8](https://www.gf9games.com/dune/wp-content/uploads/2020/11/Dune-FAQ-Nov-2020.pdf#page=8)
permits game-related yes/no and combined questions. These particular selectors
and entitlement boundaries are software interpretations, not a new printed
restriction. Five focused files pass 24 cases; two runtime cases include real
Basic/Advanced progression to the successful peek, actual asking and answering,
all four bot profiles, a staged canceled-peek state and physical card custody.
Full Truthtrance language, broader interactions and deployed acceptance remain
open.

14 September 2026. **Prototyped**, with **Partial** coverage. This extends the
existing question flow with four typed predicates; freeform interpretation,
general future commitments and complete mode acceptance remain unfinished.

## Authority and semantics

The [GF9 November 2020 FAQ, p. 8](https://www.gf9games.com/dune/wp-content/uploads/2020/11/Dune-FAQ-Nov-2020.pdf#page=8)
permits game-related Yes/No questions and AND/OR combinations. Its unknown-answer
flow allows another question or retaining the card. Publisher-indexed text was
retrieved again for this batch. These precise predicate definitions implement
part of that broad permission; they are not additional printed restrictions.

- **Prediction faction:** compare the respondent's already-recorded native Bene
  Gesserit prediction with a named faction.
- **Prediction turn:** compare the turn in that stored prediction using exactly,
  at least or at most. This asks what was selected, not whether that future win
  will happen or whether the player promises to make it happen.
- **Submitted storm dial:** compare this respondent's locked value while the
  current Storm phase and its submission remain active. A not-yet-submitted or
  expired dial is unknown; zero is a real first-turn value, not missing data.
  The separate combined turn-action question can bind an eligible Basic player’s
  future exact dial; it does not turn an unsubmitted dial into a recorded fact.
- **Known forecast:** compare the current storm card only for native Advanced
  Fremen when the existing knowledge flag is true. Canceled peeks, unknown cards
  and other factions receive unknown; no new deck lookup or borrowed knowledge
  is granted. The question concerns the known card, not a promise about eventual
  storm movement after other effects.

The shared parser accepts canonical faction identities, prediction turns 1–10,
dials 0–20 and forecasts 1–6, and rejects malformed comparisons and values.
Stored dial entitlement also checks the turn's actual legal dialing range.
Missing knowledge yields unknown rather than inventing a choice or an answer.

## Connected behavior and privacy

`truthKnowledgeOf` constructs only the target's eligible facts. Both server answer
validation and target-only answer projection use that same snapshot. AND/OR uses
the existing three-valued evaluation: a false AND term or true OR term can settle
the aggregate despite an unknown sibling. No matching-clause list is published.

The public question and response controls are independent of private values. The
target sees the verified scalar, and its answer becomes public through the normal
history flow. Neither prediction fields nor an unrevealed dial/forecast are added
to rivals' views. Equality answers can naturally reveal the queried value, as the
chosen question intends. A definite answer discards the actual Truthtrance once;
unknown retains its retry/save continuation. The original storm, auction, battle
or other interaction remains in place while the question is open.

The four UI choices share faction/value fields and numeric comparison controls.
Both compound clauses support them, with invalid-input and busy submission guards.
All four AI profiles answer the existing owner-only scalar. They do not receive
opponent knowledge, and this does not claim new strategic question selection or
freeform language understanding.

## Verification boundary

Focused tests use real Basic/Advanced setup, a real locked prediction and ordinary
storm/forecast progression. They stage only the asker's physical Truthtrance
acquisition by relocation, without duplicating cards. They cover private Yes/No
and unknown answers, changed/expired entitlement, invalid queries, dishonest and
duplicate answers, compound indistinguishability, all profiles and JSON views.
The isolated component tests check all numeric comparisons and ranges.

Thirteen new cases pass (six rules, two controls and five production SQLite
recovery cases); the focused union with existing Truthtrance/spice coverage passes
44 cases. Authenticated saved-seat tests restore pending questions and the original
storm-peek response, preserve all private views and physical custody, reject stale,
dishonest and duplicate answers, and allow only one competing version write.
Malformed saved predicates fail without a database write. Independent source and
privacy review found missing numeric comparison controls; integration review also
fixed the parent selector mapping and invalid-input submission guard.

Two genuine-setup, four-profile games finish without rejected actions: Basic in
192 actions with five periodic JSON rounds, Advanced in 518 with fourteen. Exact
card/force custody holds and all eight final seat views restore. Explicitly
scripted legal questions use naturally held cards: the Basic sample asks about a
prediction faction and a submitted storm dial; Advanced asks about a prediction
turn. Neither sample exercises a forecast question. These are bounded continuation
checks, not evidence of autonomous AI question strategy or strength calibration.

The separate browser exercise uses real Advanced setup, a recorded prediction and
ordinary forecast progression, relocating only two physical Truthtrances to the
asker. It verifies invalid dial input, an unknown answer and rephrasing, a compound
faction/turn question, a forecast comparison and refresh after submission and
resolution. The final history is unknown/Yes/Yes, both physical cards are discarded,
and unrelated resources and private projections remain unchanged. Pending-answer
restoration is established by SQLite tests, not a paused browser observation.

All 767 opening games and original seat/recovery records match the backup after
the reported outage. Integrity and foreign keys pass; the healthy server is reused.
The new browser room brings the preservation baseline to 768 before broad checks.
Required broad results, source fingerprint, final preservation totals and Git
delivery are recorded in the checkpoint commit and private report. These results
do not certify all Truthtrance questions, complete expansions or publication readiness.
