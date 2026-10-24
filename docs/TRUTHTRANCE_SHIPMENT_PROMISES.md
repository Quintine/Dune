# Truthtrance reserve-shipment promises

Original checkpoint, 7 September 2026; Advanced follow-up, 13 September 2026. The [14 September compound follow-up](COMPOUND_SHIPMENT_PROMISES.md) adds shipment-only AND/OR while retaining the boundaries below. This implements a bounded reserve-shipment future-action predicate. It does not certify complete Truthtrance, Advanced play or expansion interactions, and opens no new mode gate.

The former Advanced Guild exclusion is superseded by the
[18 October native Guild composition](#advanced-guild-interception-and-rates--18-october-2026).
The [24 October waiting-turn follow-up](#same-phase-waiting-respondents--24-october-2026) supersedes the active-only timing boundary. The [earlier Basic phase follow-up](#earlier-basic-phases--24-october-2026) extends current-turn timing before Movement. Earlier scope descriptions and verification totals remain historical.

## Authority and supported meaning

The [GF9 November 2020 FAQ, printed p8](https://www.gf9games.com/dune/wp-content/uploads/2020/11/Dune-FAQ-Nov-2020.pdf) provides the Emperor/Carthag example: a definite Yes binds the matching shipment while possible; No allows fewer forces, another destination or none. Current-turn commitments, unknown for outcomes beyond the respondent's control, storm-order priority and release upon impossibility are the publisher's rules. The independent reviewer retrieved official indexed text this checkpoint; direct PDF access returned 403. No tournament or other-edition rule was adopted.

The new question is explicit: will the target ship at least N **physical forces from reserves** to a named territory this turn? Ordinary Guild shipping, Fremen reinforcement and Guild-allied Fremen transport from southern reserves qualify. Guild board-to-board/board-to-reserves transport, ground movement, existing garrisons and free BG accompaniment do not. Quantity does not mean combat strength.

Automatic enforcement accepts this structured question in the Basic game without faction expansions and in base Advanced games without Guild or optional modules, during the active target's unused shipment opportunity, with pending decisions resolved. This is an unfinished software boundary, not a restriction printed on Truthtrance. Earlier-phase questions, Advanced Guild cancellation, concealed and allied No-Fields, expansion arrival chains, compound shipment/fact predicates and arbitrary prose remain unimplemented. Previously pending material interpretation questions remain pending.

## Advanced follow-up: typed preparation and conversion

The shared mode guard now agrees across question entry, saved-ledger validation and controls. The new Advanced boundary excludes seated Guild, faction expansions and separately enabled Tech, Stronghold, Nexus and Homeworld modules. Existing Basic behavior is preserved. This is a readiness boundary, not a printed Truthtrance prohibition, and the public Advanced start gate stays closed.

Reachability uses the same Ghola quote as actual card controls. Three ordinary plus two elite forces in the Tanks permit four returns when the elite allowance is unused; an exhausted elite allowance permits only the ordinary forces. Proposed actions carry exact physical elite allocation, shown as Sardaukar or Fedaykin in private guidance.

An owned Worthless card can provide a prospective BG shipment discount. While its conversion awaits responses, the private feasibility copy considers successful conversion so the existing promise is retained. The real table keeps the response, spent physical card and pending effect. Actual cancellation releases the promise only when no owned alternative remains; allowance activates the discount once. Pending conversions project no executable shipment or current-price guidance. Fremen reinforcement, joining BG advisors and later free accompaniment preserve the distinct original shipment event.

The 13 September regressions use genuine Advanced setup followed by conserved scenarios, with all five non-Guild factions, four bot profiles, mixed and elite-only Tanks, exhausted revival quota, Yes/No enforcement and private-state perturbations. Production SQLite cases restore pending questions/conversions and race duplicate Ghola, cancellation and shipment actions. Exact run results are recorded in the checkpoint commit and verification report. Earlier figures below remain historical.

### Browser follow-up, 13 September

Two newly created isolated rooms followed genuine Advanced initialization before scenario staging; this is feature acceptance, not a full Advanced game. In `EUZZ8D4M`, the actual question form submitted a six-force commitment to Hard Emperor, whose public No was followed by a legal nonmatching shipment. In `GWNCVCAP`, the human Emperor answered Yes, saw an exact four-force Ghola preparation including one Sardaukar, executed it, then shipped six including that Sardaukar to Carthag for six spice. Conflicting shipment, movement and finish controls were disabled until fulfillment. The faction-colored Ghola notice appeared; the resulting state retained one force in the Tanks, zero reserves and zero personal spice. Refresh and phone-width settlement controls were checked separately; no full mobile setup-to-finish game is claimed. Private backups precede each staged room, outside the checkout.

## Implementation

`game/shipment-promises.ts` defines the normalized destination/minimum and turn-scoped boolean obligation. `game/truthtrance.ts` parses one to twenty physical forces and a printed territory, generates the public sentence, offers target-private answers through the engine, and binds/history/discards atomically through the existing overlay. A definite answer consumes exactly one physical Truthtrance. It does not select the final shipment sector, quantity or payment.

`findShipmentCompletion` in `game/engine.ts` searches canonical shipment quotes for all relevant physical quantities and destination sectors, honoring the full set of prior promises jointly. It tries deterministic preparations controlled by the respondent: their retained Karama, Ghola's canonical eligible force revival, including the one-elite-per-turn limit, and withdrawal of their own recoverable outgoing pledge. Existing incoming escrow and already-active rate benefits are usable; unpledged rival spice, unknown cards and future cooperation are not assumed. These preparation operations preserve smaller-quantity choices, so maximal Basic Ghola revival is sufficient for destination/minimum predicates. Owned preparations may be combined. The Guild-allied Fremen southern-reserve route uses its actual authoritative transport action and paid tariff.

The solver never uses the AI's ranked move shortlist to declare an answer impossible. The independent probe showed those lists can omit both six-force quantities and otherwise legal destinations. Preparations run through the internal non-reconciling action seam on cloned state; they do not recursively invoke `applyAction`, change the real table, draw random cards, or reveal a witness publicly.

`ship`, `guildShip`, movement-first and `endMovement` check the obligation. `commitShipment`, reserve-origin Guild transport and actual skip/movement completion record fulfillment at the consumed opportunity. A qualifying shipment satisfies a Yes even if its forces later move or die. No permits any nonmatching event or skip. A target cannot bribe away required spice or spend the only needed preparation card to make their obligation disappear. Reconciliation retries all available owned preparations after an opposing change and publicly releases a genuinely impossible answer once, without private resource details. Older-turn records remain historical and do not constrain a new turn.

Saved records are validated before action, normalization and projection: seated distinct asker/target, supported active opportunity, valid turn/destination/count, boolean answer and coherent lifecycle. A saved pending shipment question is reparsed and retains a unique physical Truthtrance in each queued holder's actual hand. Independent review found two corruption-only risks—writing an invalid binding before projection failed, and consuming a wrongly substituted queue card—and both were fixed and covered. No client-accessible corruption route was demonstrated.

## Controls and AI

The question editor provides a destination, numeric minimum, public sentence preview, invalid-input feedback and the explicit supported timing boundary. The target sees available Yes/No choices privately. Movement shows accepted obligations and disables conflicting selected shipments, moves and end-of-turn actions with a linked explanation. Private optional guidance offers one executable preparation at a time, then a funded shipment with its exact payment breakdown.

All four AI profiles consume the target-only allowed answers. They rank destinations using their own reserves and visible board value, filter obligation-breaking movement proposals, and prepend the first action of the authoritative completion when a positive promise exists. The rest of the sequence is reprojected after each preparation. No extra spice, forces, cards or opponent knowledge are granted. Strategic question selection and full relative-strength calibration remain separate unfinished work.

## Verification

Registered focused coverage:

- `tests/shipment-promises.test.ts`: 13 tests, including every minimum 1–20 for all six Basic factions; jointly compatible Yes/No ranges and sector alternatives; blocked entry; exact owned preparation chains; Fremen/Guild reserve transport; voluntary evasion; opposing escrow withdrawal; private-view equivalence; malformed records and legacy/expired/fulfilled recovery.
- `tests/shipment-promises-bots.test.ts`: 8 tests across all four profiles, including destinations and counts omitted by ordinary strategy, positive/negative answers, own Ghola/Karama/escrow preparation, southern reserves and unrelated hidden-state perturbations. Generated proposals are checked through actual `applyAction` calls and JSON roundtrips.
- `tests/shipment-promises-recovery.test.ts`: 5 tests against the production room module and SQLite SQL. Fresh module reload, target-only projections, malformed requests, conflicting Yes/No CAS, duplicate shipment CAS, one discard/payment/arrival/fulfillment, 12 corrupted ledger subcases and six malformed pending-question/queue subcases, older-turn and completed records, and absent legacy fields.

The full regression run passes 1,598 rules/client/component tests and 148 multiplayer tests (1,746 total). After the saved-question validator changes, the focused Truthtrance/shipment set passes 38 tests. These figures measure implemented behaviors, not complete rules coverage.

Browser playtest used only the existing isolated QA room, saving its previous state before each staged scenario. At 390×844 the form remained readable; zero disabled Ask, six restored it. A real form submission received a paced Hard AI Yes, then the AI shipped six forces and completed its movement turn. A separate human respondent accepted Yes with one reserve, five tanks and three spice; the private guide executed Karama, Ghola for five, then six forces to Carthag for three spice. Conflicting normal shipment/end controls were disabled. Refresh restored the human shipment with six forces in Carthag, zero personal spice, no remaining reserves and the three physical cards discarded once. The restored player legitimately retains their movement choice; no further human action was automated.


Final typecheck, lint and production build pass. The first lint run found a missing input-label association, JSX apostrophe and untyped action-value interpolation; these were corrected before the final lint/build. Final evidence: `/tmp/dune-shipment-full-tests.log` (1,598, 61.13s), `/tmp/dune-shipment-multiplayer.log` (148, 17.42s), `/tmp/dune-shipment-final-focused.log` (38, 4.36s), `/tmp/dune-shipment-final-type3.log`, `/tmp/dune-shipment-final-lint3.log`, `/tmp/dune-shipment-build.log`. All processes completed successfully; earlier failing lint logs are not final evidence.

## Complete-game exercise

The reviewed offline runner `/tmp/dune-shipment-fullgames.ts` uses the unchanged public production start gate, genuine lobby readiness and setup, and naturally dealt/purchased cards. Twenty Basic games cover each player count 2–6 at each of the four homogeneous AI levels. A bounded **test question policy**, not a newly calibrated production asking strategy, chooses at most one natural Truthtrance per turn using only its holder's view and a publicly legal destination with minimum one. Respondents use their normal AI answer and fulfillment policy. No resources, card inventory, faction powers or rule exceptions are injected.

All 20 games completed: 9,597 accepted actions, zero rejected candidates, stalls, exceptions or invariant failures; 94 actual setup actions and 441 actual continuations from serialized JSON. Thirty shipment questions produced 23 Yes and seven No; all 30 records were fulfilled, with no pending or released promises. Yes occurred at every difficulty; the sampled No answers occurred at Hard and Brutal. Full-game thresholds here are minimum one; the six-force, all-minimum and preparation-path coverage comes from focused tests and browser play. This homogeneous sample cannot calibrate relative AI strength or certify the remaining game scope.

The root independently reviewed the runner and reread all 57 source/runner hashes with zero changes. Combined SHA-256: `e6c4c008d059934b8519d06b01c2bc15c9aaec40270cdd78b23a97bb6a70ca2c`. Results `/tmp/dune-shipment-fullgames.json`, SHA-256 `62f6d214b3b17f661497c65159534d732e710873f04fa407a1d15079bfa135df`. The run took 48.392 seconds and its terminal exited successfully.

## Advanced Guild interception and rates — 18 October 2026

**Prototyped / Partial.** Base Advanced games now support the same structured
reserve-shipment and mixed current-fact questions with Guild seated, including
Guild itself and its reciprocal ally as respondent. Asking still requires the
active player's unused shipment and finished control windows. Native TAKE/WAIT
decides that active opportunity first. No faction expansion or other optional
module is admitted by this change; existing Basic/Richese Semuta scope remains.

The original FAQ's commitment/release rule composes with native Guild powers;
no new numerical or timing ruling is introduced. A declaration awaiting native
interception, transport permission or rate responses neither fulfills nor releases
the promise. Actual delivery settles the actual reserve count/destination once,
before its later arrival reactions. Physical force type, tariffs, bank/Guild
income, original funding and one-use powers remain authoritative.

An opposing Guild special Karama consumes the shipment opportunity without
delivery or payment. Evaluate each complete accepted expression against that
absence: matching answers fulfill; impossible answers publicly release. This
also handles a Yes to an OR whose frozen current fact is already true. The
respondent's promise cannot veto the opponent's printed stop. The Guild may not
use self-interception to evade its own required shipment; shared server legality
disables the stop button with its reason, while native allowance stays available.
Own stops permitted by the whole promise retain the normal power and card cost.

Rate cancellation remains separate from interception. A funded full tariff
delivers and fulfills normally. An unaffordable original payment split returns
the declaration unused, retains the full-rate restriction and rechecks available
owned preparation. An independent retained Karama discount may keep a promise
possible; without a legal completion, an opposing cancellation releases it. The
respondent cannot deliberately spend its last completion away. Denied native
cross/return permission moves nothing and consumes no shipment: ordinary Fremen
reinforcement remains a separate possible fallback, while an unreachable
destination releases. A purchased price does not restore denied route permission.

Private suggested actions appear only at an executable clean boundary, not while
Truthtrance, a decision, response, opening or physical shipment is pending. The
reachability solver can preserve a possible allowed route during those windows
without offering a concurrent duplicate action. Existing policies use the same
private feasible answers and completion witness; no strategy tuning is included.

### Targeted proof and limits

A disjoint fixture lane, bounded continuation review and owner integration pass
**10 files106/106**, one updated existing in-memory scope-regression case,
`npm run check:quick`, production build and actual-rule/rendered-control smoke.
Frozen feedback removed one unused fixture import. The old negative case that
classified Advanced Guild itself as corruption is removed; the remaining
unsupported-expansion case remains. Only that existing in-memory test runs,
not a new recovery or production-save assurance campaign.

The passing frozen source is based on
`377e9c516035191a6d73f8eca05e253d31f39739`, tree
`a1b4fe7440dbfeb2a664db86acf0813ca9711ff486c30e505131057f077792ee`,
2,595 tracked/nonignored files. The preserved untracked source PDF contributes
only its hash to the snapshot; it is not committed or republished.

`tests/fixture-truthtrance-guild-shipment.ts` uses actual public classic Advanced
setup, original physical starting deals and native TAKE/WAIT. Only unopened
starting-deal/Spice positions and authoritative scalar lotteries are selected;
no postdeal hand, wallet, army, clock, flag or promise is installed. Both sources
use39 actions. Four programmes finish the actual respondent turn in8–10 more:

- Emperor3, including one Sardaukar, is allowed for3 paid to Guild and fulfills;
  actual opposing special Karama instead consumes the opportunity, pays and
  delivers0, and publicly releases the impossible positive.
- Guild TAKE ships3 for half2, or an actual opposing Emperor Karama removes that
  rate and the funded full3 is paid once. Both deliveries fulfill.

`tests/truthtrance-guild-shipment-engine.test.ts` covers these original controls.
Four existing profiles make12 legal answer/shipment/Guild proposals and finish
their resulting opportunity. `tests/truthtrance-guild-shipment.test.ts` separately
uses controlled No/mixed, self-stop, funded/unaffordable rate, owned alternative
and denied Fremen-route probes. The ordinary completion remains legal without
strategic refinement. Existing compound, core Guild and shipment tests pass.

Actual GameTable/ShipmentPromises render question, bound, interception, rate and
finished states. The real self-stop button is disabled with the server reason;
the executable guide is absent during pending controls. Framework aliases/CSS
stubs mean no browser click or visual acceptance. Private logs, snapshots, HTML
and runtime results are in
`/home/quintine/.local/share/dune/checkpoints/20261018-truth-guild-shipment/`;
`frozen-integrated-2/report.json` is the complete passing batch. Final prose and
reference evidence edits are checked against all frozen file hashes before push.

Broader phases/routes/modules, full Truthtrance/modes, final assurance and
browser/deployed acceptance remain open. No saved-room/database/reset/restart/
deployment operation was performed.


## Same-phase waiting respondents — 24 October 2026

**Prototyped / Partial.** Structured reserve-shipment and mixed current-fact
questions now include a respondent whose unused turn remains in the original
Shipment & Movement queue, as well as the active player. The same current-turn
FAQ commitment/release rule applies; this removes a software timing boundary,
not a new printed restriction or numerical ruling. Existing base Basic/Advanced
and classic-payer Richese Semuta profiles remain; no other module or earlier
phase opens. Semuta eligibility reads the actual respondent, not the active
faction. Original Truthtrance priority and the interrupted turn stay intact.

Feasibility uses the respondent's existing resources, owned preparation and
joint whole promises. A private quote selects that owner's later turn and clears
a foreign transient shipping price/declaration, without changing the real active
player, queue or intervening decisions. No future income, voluntary cooperation,
returned troops or vacated destination is assumed. Mixed facts remain frozen at
the original answer. The public accepted question and owner promise panel stay
visible; executable completion guidance waits for the actual turn and a clean
control boundary. Native Guild WAIT/TAKE still chooses its real opportunity.

Foreign pending decisions retain the future promise until the outcome is known.
An ally's already approved shipment contribution cannot be withdrawn or counted
as freely recoverable preparation while its original declaration is pending.
Delivery may spend it and release an impossible answer; a stop preserves the
original refund and later recovery route. Other opposing completed effects still
release only when no legal completion remains. A waiting owner may not declare
an Emperor gift or accept BG accompaniment that spends the last completion;
the allowed outflow is checked before opening its response, where the eventual
responder is another player. Affordable gifts/accompaniment remain legal.

### Targeted proof and limits

A disjoint original-action fixture lane, bounded continuation review and owner
integration pass **14 files146/146**, one updated existing in-memory scope case,
`npm run check:quick`, production build and three actual-gameplay/rendered-table
programmes. First feedback updated an old negative pending-question fixture:
a waiting respondent is now legal, so the invalid case also removes that turn.
Type feedback added the queue's existing null case to the helper signature and
narrowed the generic policy answer in its test. No rule change followed feedback.

The passing frozen source is based on
`2939ffa900f8f201fd0b55173cb2406657ccc93b`, tree
`96bf67b82570590afe79feda3491373f02714ff8b591c8897f81f0f07a261285`,
2,598 tracked/nonignored files. The supplied untracked PDF contributes only its
hash; it is neither committed nor republished. Final checkpoint/reference prose
is checked against all frozen file hashes before push.

`tests/fixture-truthtrance-future-shipment.ts` earns the question from public
classic four-seat setup and the original unopened physical starting deal. Only
five unopened card positions, unopened land Spice positions and scalar lotteries
are selected. No dealt holdings, wallets, armies, phase, turn queue, timing flags
or promise receipts are installed. Three programmes finish the respondent turn:

- Basic Emperor uses40 source and16 continuation actions. Atreides really ships1
  to Imperial Basin for2 first; Emperor later ships3 to Sietch Tabr for3.
- Advanced Emperor uses45 source and19 continuations, including original Guild
  WAIT before the question and another afterward. The later3 include one
  physical Sardaukar; the original tariff is3.
- A mixed future Guild answer uses45 source and29 continuations. Atreides and
  Emperor each really pay2 for an earlier shipment; Guild waits once more while
  bound, then takes its native turn before still-unstarted Harkonnen. Guild3
  pays half2 and fulfills once; its earlier current-spice fact stays compiled
  from the answer even as earned incoming shipment income accrues.

`tests/truthtrance-future-shipment-engine.test.ts` covers those actual paths,
original queue, no early action/witness, native timing, one physical discard and
later paid fulfillment. Four existing profiles make eight legal answer/shipment
proposals, with no early movement action, and complete their native turn in the
runtime smoke. `tests/truthtrance-future-shipment.test.ts` separately controls
foreign temporary prices, actual respondent Semuta scope, locked approved ally
funding with allowance/stop, and both rejected and affordable Emperor gifts/BG
accompaniment. All four minimal profiles legally decline the optional advisor
choice while bound; this is legality, not strategic refinement.

Actual GameTable/ShipmentPromises render the question, persistent waiting
promise without executable guidance, active private guide and finished turn.
Framework aliases/CSS stubs do not establish browser clicks, visual or deployed
acceptance. Private reports, source hashes, HTML and runtime results are in
`/home/quintine/.local/share/dune/checkpoints/20261024-truth-future-shipment/`;
`frozen-integrated-3/report.json` is the complete passing batch. Earlier failed
feedback is retained. No new save/recovery audit was added.

Earlier phases, broader routes/modules/actions, full Truthtrance/modes, final
assurance and browser/deployed acceptance remain open. No saved-room/database/
reset/restart/deployment operation was performed.


## Earlier Basic phases — 24 October 2026

**Prototyped / Partial.** Bare classic Basic games now accept structured reserve
shipment and mixed current-fact questions during phases0–4, as well as the
existing unused phase5 opportunity. This removes an implementation boundary;
the FAQ already describes a this-turn promise. Advanced, faction expansions,
optional modules and independent expansion Treachery keep their earlier-phase
boundaries. Existing phase5 profiles retain their own support. Answering never
ships early or changes another player's turn.

The selected provisional interpretation evaluates the current board and
respondent's owned route. It is not a prediction of unresolved Storm movement,
unknown future purchases, rival gifts/income or vacated destinations. Native
forced/opposing changes can release an answer after they actually make it
impossible. Future rule breadth and comprehensive assurance remain unfinished.
The FAQ supplies the current-turn binding/release rule; this private witness and
readiness protocol is an explicit product interpretation, not a new publisher
worked example.

The witness includes remaining owned Charity and ordinary force Revival using
actual quotes, physical Tanks and remaining/free allowances. It does not assume
unoffered ally revival benefits. Current winning auction invoices reserve their
actual own-spice share or a retained physical Karama. The same card cannot also
supply the later shipping discount. Unknown purchased cards contribute nothing.
Unused outgoing Bidding escrow returns to its donor at phase completion, net
any actual committed contribution; incoming Bidding aid expires rather than
becoming future shipping funds. An unresolved ally invoice and its income
responses finish before release; an actual funded outcome may preserve the
route, while canceled income can leave a real shortfall.

A definite answer reopens the respondent's already-confirmed Charity/Revival
readiness. Own Ready cannot forego the last required preparation. Own bids,
normal force/leader revival, bribes, gifts, extra paid ally revival and card
spending must preserve a route. The Emperor's proposed gift/revival invoice is
checked before its response so another responder cannot turn that voluntary
cost into an escape. Passing a bid or allowing a foreign power remains native
continuation, not a new owner payment.

The actual table retains the original question and later-this-turn guidance
through earlier phases. Only current available Charity/Revival preparation
gets a button; future shipment and price controls remain absent. Actual shipping
guidance still waits for phase5, the original turn and completed control windows.
The editor describes both timing scopes. Existing profiles use minimal legal
preparation, pass Bidding and choose a valid committed payment when delivery is
required. Where skipping honors all answers, ordinary legal policy remains,
including Karama-funded overbids. No strategy or difficulty calibration is added.

### Targeted proof and limits

A disjoint original-fixture/control lane, bounded continuation review and owner
integration pass **18 files131/131**, `npm run check:quick`, production build and
two original gameplay/rendered-table programmes. Both actual Storm and Charity
questions survive native Bidding/Revival, buy the actual auction card for2, then
ship8 to Carthag for8 and explicitly finish the respondent's turn. The source
fixture uses22 original actions, full original Basic decks and selected unopened
deal/Spice positions plus scalar lotteries; no dealt hand, army, wallet, clock or
promise is installed. The Storm programme uses the genuine earlier after-setup
snapshot. Its52 and the Charity programme's38 continuations are distinct from
the controlled probes.

All four existing profiles traverse Charity/Bidding/Revival/Shipment with four
legal owner proposals and20 total continuations apiece, fulfill and finish.
Actual GameTable rendering retains the early promise during Storm, Charity,
Bidding and Revival, hides future shipment controls and exposes the real phase5
cost/action. Framework aliases/CSS stubs mean runtime rendering, not browser or
visual acceptance. The six isolated control cases cover phases0–4, current
preparation payloads/busy controls, original grouped questions and phase5 behavior.

The eleven early engine cases include original eight-force purchase/delivery,
controlled owned Charity/Revival and reopened readiness, distinct physical
auction/shipping Karamas, expired incoming escrow, actual ally-invoice income
allow/cancel, pre-response extra-revival costs and native No-answer overbids.
Related existing tests cover joint claims, waiting/native Guild, typed preparation,
normal auction and Revival. Earlier malformed-scope cases now use post-Movement
phase6 rather than newly supported phase4. Focused feedback found and fixed early
foreign-invoice release, delayed extra-revival evasion and a No-answer policy
forcing an unfunded cash payment. A controlled retained-card test was corrected
from3 to7 because the actual remaining Karama legally funds half-price shipping;
type feedback gave the poisoned-view getter an explicit throwing return type.

The passing frozen source is based on
`6d30e7c5e177b45a03bfbd95e93d9e3c0e0fe15f`, tree
`36da1bc827d67564f7fae17a65d40d399583d87faeda8bb6a42823c29e9306af`,
2,614 tracked/nonignored files. The untracked supplied PDF contributes only its
hash and is not committed or republished. Private reports, logs, HTML and runtime
results are in
`/home/quintine/.local/share/dune/checkpoints/20261024-truth-early-shipment/`;
`frozen-integrated-3/report.json` is the complete passing batch. Final checkpoint
prose and reference evidence are checked against every frozen source hash before
push. Earlier failed feedback reports remain separate.

Earlier-phase Advanced/modules, wider future actions, full Truthtrance/modes,
comprehensive assurance and browser/deployed acceptance remain open. No saved-
room/database/reset/restart/deployment operation or strategic calibration.
