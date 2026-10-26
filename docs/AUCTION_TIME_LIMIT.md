# Ordinary-auction time limit

## Source and scope

**Prototyped / Partial.** Publisher Basic rulebook printed8, Time Limit,
requires a bid within ten seconds of the previous player and treats silence as
a pass. The user-authorized supplied revised Advanced rulebook repeats it on
physical8/printed6. This is a Basic and Advanced rule, not an AI pacing option.
[Publisher rulebook](https://www.gf9games.com/dunegame/wp-content/uploads/Dune-Rulebook.pdf#page=8).

New native ordinary lots use a versioned clock. An already-open older lot with
no stamp retains its saved untimed protocol; the next newly opened native lot
uses the clock. Special silent/once-around procedures retain their own rules.
Pure engine/offline simulation has no wall-clock dependency. Only trusted
room time arms, suspends or expires an online clock; clients cannot supply time.

## Online timing convention

The clock starts when the current bidder can actually bid. Inspection,
Truthtrance, cancellation, payment and other native decisions hold the exact
remaining budget. Their native owners and mandatory continuation stay intact.
An ordinary bid or pass starts ten seconds for the next original bidder;
unrelated polls, chat and repeated requests cannot refresh the deadline.
At the exact deadline the server follows the canonical pass continuation.

A binding Truthtrance answer can legally prohibit passing. Under the standing
14 October choose-recommended policy, provisionally submit only its quoted
lowest legal bid compatible with the whole answer instead of letting silence
evade it. Finite predicate thresholds are quoted with exact private native
bounds; no speculative purchase is executed to search for an amount. This is an
explicit online composition, not a publisher timeout/Truthtrance worked example.
It grants no free purchase, extra bid or strategic escalation; normal payment
is still due if that bid wins. A whole-answer alternative permitting pass keeps
that ordinary pass available. Existing actual impossibility rules remain.

An administrative room-control or closure revision re-arms the current bid
with ten seconds once play resumes. This conservative online convention also
covers a pause that no active client observed. No paused, closed or removed
room advances. Current native interruptions retain their remaining budget.
Source and control epochs are private; the public countdown contains only an
opaque event, current bidder, remaining time and running status.

## Server continuation and controls

The persisted clock binds the exact native turn/lot/bidder/bid/pass/order
source. Version and operational-control fences prevent concurrent workers or
late requests from acting on a superseded bid. Authenticated reads/actions
resume or expire it before accepting a late bid. A bounded background worker
runs alongside existing automatic/AI work; it is not a durable alarm. After a
stopped host, the stored deadline is evaluated on the next authenticated
request. Server restarts neither invent a bid nor reset a game.

The ordinary-auction notice persists. Its local animation is display only;
only the server decides expiry and emits the native action. The notice shows
held/paused/starting states and explains any compulsory Truthtrance bid.
No client-generated pass, hidden-card source or disposable popup is used.

## Evidence and remaining scope

Helper: game/auction-clock.ts. Engine timing/source/expiry and private-to-public
projection: game/engine.ts. Trusted storage scheduling: db/rooms.ts and
room-continuation.ts. Human countdown: components/auction-countdown.tsx and the
native ordinary-auction section of components/game-table.tsx.
## Verified checkpoint — 27 October 2026

The frozen source passes17 files,199/199, types/lint and production build.
Thirteen pure clock, four real-component/display, nine native engine and14
trusted SQLite/fake-clock cases add40 focused checks. Existing bid, auction
retirement, continuation, funding, controls, bot pacing and reference cases
remain in the related union. Exact-deadline, held/resumed timing, source change,
old-lot, both control-revision fences, current-seat authorization, competing
writes and scalar/whole Truth obligations have bounded evidence.

Five native journeys plus one actual local HTTP journey pass, with14 full
GameTable SSR renders and43 HTTP requests. Original Basic source20 and Advanced
source23 expire by canonical pass. Source22 covers forced whole bid3 then pay2
and its real invoice, actual Truth holding8s until resolution, and a voluntary
first alternative5 whose compelled minimum is3. The HTTP room is genuinely
created/joined/readied/started, then reaches ordinary bidding through12 actual
controls; bid1 succeeds and the next bidder's silence records a native pass.
Late bid2 with stale version and forged now0 is rejected. Cookies stay in memory
and are neither logged nor saved. Native original inventories remain.

The first runtime smoke catches a countdown hidden behind the Truth control;
it is moved into persistent notices. Type and lint feedback is repaired. The
first related union reports197/199: its OR-pass test assumed the old lot stayed
open, and its VM concurrency test waited too few cross-context microtasks.
The first now compares actual canonical native pass/retirement and resolves
native aftermath before testing later payment. The second waits an event-loop
barrier while still requiring bots to start before releasing the sleeping
clock. Both exact repaired cases pass, then the related union passes199/199.

V5 retains V4's six passing runtime journeys through a per-file manifest:
only the two failing test files changed; all production code, native fixtures
and the private runtime script are identical. The final source passes quick
checks, related tests and build without recreating that HTTP room again.
Proof/manifest:
`/home/quintine/.local/share/dune/checkpoints/20261026-auction-clock-proof-v5/`;
reused journeys/HTML: adjacent `20261026-auction-clock-runtime-v4/`.

These are local native/SSR/controlled-display and real HTTP checks, not browser
or deployed acceptance. Special-auction timers, wider module/order interactions,
full-mode acceptance and comprehensive recovery/privacy/custody assurance remain
open. Existing publication/AI gates are preserved.
The stopped local server was started without resetting storage. HTTP proof
uses a dedicated QA room only; no existing game action, reset, deletion, restart
or deployment is performed.
