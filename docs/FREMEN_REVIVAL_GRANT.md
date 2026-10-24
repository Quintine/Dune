# Fremen allied free revival

## Source and selected timing — 24 October 2026

The base publisher rulebook physical p16 gives the Fremen ally three free
revivals; ordinary force limits and special-force rules remain independent.
The November2020 publisher FAQ p7 permits a Karama to stop an alliance ability
for one use. The native permission therefore needs a response before its
benefit is committed, rather than an uncancelable direct addition to the
permission list. The exact digital declaration point and prevention duration
below are implementation policy, not a Fremen-specific worked FAQ.
[Official base rules](https://www.gf9games.com/dunegame/wp-content/uploads/Dune-Rulebook.pdf),
[official FAQ](https://www.gf9games.com/dune/wp-content/uploads/2020/11/Dune-FAQ-Nov-2020.pdf).

The existing optional Fremen grant action now binds the current native owner,
mutual ally and turn during Revival. It opens the existing Karama response.
All-pass commits the original grant once; prevention leaves it uncommitted and
blocks that Fremen-to-current-ally opportunity for this Revival turn. It never
sets general free-revival prevention. The recipient keeps its intrinsic free
rate, Recruits, prior payments and completed returns. A later native Revival
opening resets this denial through the existing phase rules. The user’s
14 October choose-recommended authority selects this scope; no new question
or claim of publisher confirmation is implied.

Publisher E3 physical pp11/16 says Recruits doubles current free rates, with
the ordinary total raised to seven. Under the same explicit current-rate
prototype policy, a grant accepted after Recruits uses the same current
calculation as a grant accepted before it. Recruits doubles the current granted rate, including applicable bonuses,
before caps; without other bonuses, three becomes six. It replaces the native ordinary rate,
not an additional six-force gift. Actual prior free usage consumes this rate;
all prior returns consume the total cap. The already selected late-paid policy
retains prices/classifications and supplies no refund or retroactive relabeling.
No direct combined late-grant ruling was found in the bounded primary search.
[Official E3](https://www.gf9games.com/dune/wp-content/uploads/EcazMoritani-Rulebook-LOWRES.pdf),
[existing Recruits interpretation](RECRUITS_RULES.md).

Original source passages were freshly checked through the publisher's indexed
rulebooks and FAQ. No new edition, community rule or unrelated faction/module
permission is adopted. This composition is provisional; complete rules/modes
and final acceptance remain unfinished.

## Connected implementation

`game/fremen-revival-grant.ts` validates the original relationship and source,
blocks repeated/prevented grants and checks known prior free usage before an
active Recruits rate change. Native `game/revival.ts` remains the only owner of
force quotes, intrinsic/granted rates, paid prices, total and elite caps,
Homeworld additions and separate free prevention. A grant never moves counters.

The engine opens `fremenRevivalGrant`, validates that same source on allow and
before cancellation-card cost, then commits or marks the optional
`revivalRules.fremenGrantBlocked` recipient list. New responses retain their
source in the existing cancellation-context/purpose protocols. Completed grants
have no new response or implicit undo. Unknown old grants are not converted into
new pending windows. A pending native return or priority transaction must finish
before a new grant can be declared; no accepted invoice is silently repriced.

The public owner-only projection contains recipient identity, granted status
and a generic blocked reason, without private wallets/Tanks or numeric usage.
`components/fremen-revival-grant.tsx` provides the real persistent table action,
status and provisional guidance. The normal response panel names the offered
grant. Existing minimal bots consume that same legal projection and ordinary
response/return controls, with no strategy or strength changes.

## Verification and remaining work

Frozen proof passes **14 affected offline files305/305**, types/lint and build.
Twelve actual grant/Recruits/return callback and full GameTable SSR journeys
reach native Shipment. Sixteen existing-profile native and Recruits paths
accept80 legal grant/response/return proposals through their own views, with
no strategy refinement or difficulty calibration. Focused engine cases also
reach the next actual Revival and verify the denied grant becomes available.

The genuine three-seat public Fremen/Atreides/Emperor source selects only
original scalar order, three unopened Treachery positions, two ordinary Spice
positions and a later unopened worm. Native Fremen setup puts ten at Tabr;
Atreides pays six to invade with six real reserves. Both seal native unarmed
plans; Fremen dials six and wins, producing six actual Tank counters for each.
The next turn's real worm/Nexus permits an actual proposal and accepted alliance.
Native controls reach second Revival:75–77 Basic or92–94 Advanced source actions.
Optional Recruits is selected before setup and originally dealt; optional prior
Atreides returns are actually two free and one paid for two spice. No played
phase, wallet, army, alliance, grant/denial or payment receipt is installed.

The twelve journeys cover ordinary allow/cancel, both Recruits/grant orders,
prevention retaining intrinsic doubled returns and the actual prior-paid branch.
Original force/card quantities and prior payment/usage remain intact. Existing
related cases retain La La La, native/World limits, other revival and source/
purpose behavior. First feedback passes304/305, exposing an old text assertion
after review corrected bonus/cancellation wording. Targeted guidance feedback
then passes. The next union passes305/305; types identify two exhaustive kind
registries and one test's invented response label. The final frozen batch passes
all steps after those corrections. Bounded review finds no concrete blocker;
this is not comprehensive rules or privacy/persistence review.

Private evidence:
`/home/quintine/.local/share/dune/checkpoints/20261024-fremen-revival-grant/`,
including `frozen-integrated-3/report.json`, `runtime-smoke.json`, HTML and feedback.
Verified base `d63efccb55723c8ff33d9ec0d9daf037d0bd66ca`, source tree
`62f9b1817cbe890828d2c1aa9c1563fd492e5d05fd923dc3881aefcf468e5034`
(2699 nonignored files, identical before/after checks). Only checkpoint
prose, reference strings and evidence paths follow proof; delivery records that
reviewed overlay and pushed revision. The supplied PDF stays untracked.

Framework aliases/CSS stubs mean callback/gameplay/SSR evidence, not visual
browser or deployed acceptance. Full modes, all combinations, broader native
Karama/optional nesting and comprehensive rules/recovery/privacy/custody
assurance remain unfinished. Exact timing/prevention scope and late-grant
rate composition remain provisional. No server, saved-room/D1/reset/restart
or deployment operation occurs here.
