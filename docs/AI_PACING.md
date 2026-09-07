# Online AI pacing

2026-09-06 implementation checkpoint. Online permanent AI seats and consented human autopilot use the same 1,500ms interval. Ordinary human/control actions commit immediately; they no longer execute an inline batch of AI choices. `botNextActionAt` persists the next deadline alongside `botsPending`, without a database migration.

`continueRoomBots` waits for the persisted deadline, rereads authority after waiting, executes at most one accepted `runBots` action, then uses the existing room-version compare-and-swap. A winning continuation sets the next deadline from its completion clock. Competing workers and human take-back-control requests cannot commit against superseded state. Early `advanceBots` requests are authenticated wake-ups and cannot accelerate the clock or manufacture game versions.

Authenticated room GET resumes a persisted queue after reconnection. Visible clients poll every 500ms while AI work is pending and every two seconds otherwise, scheduling after each request completes. Hidden tabs do not poll. The notice preference controls cosmetic feedback only; it does not alter server pacing or AI authority. Offline simulations retain the fast rules runner.

Legacy `botsPending` states without a deadline execute their first resumed step immediately, then acquire the interval. Because the bounded runner cannot know it has reached a human-only decision until its next probe, a final metadata-only version can clear the pending flag. This is not another AI game action.

## Verification

- Eight focused pacing tests exercise real production room SQL/engine/bot code using an internal trusted clock: deferred opt-in, one accepted action, preserved deadlines, early wake-up, race fencing, take-back-control, and authenticated GET scheduling. No request header/query/body can supply a clock or fast mode.
- Five continuation tests cover persistence and authority fencing.
- Three complete production SQLite games with controlled time retain the former completion scenarios: native Basic, Basic plus tech tokens, and all human seats delegated to AI. These verify full state progression without spending wall-clock minutes in every test run.
- Live HTTP tests retain actual-delay checks, private projections, refresh and recovery, concurrent controls, and take-back-control. The integrated persisted/API suite passed 56 tests at this checkpoint.

## Remaining acceptance boundary

The worker is bounded and uses request-lifetime continuation, not a durable alarm or queue. If every client remains disconnected after the host ends the worker, the persisted game resumes on the next authenticated request; indefinite unattended progress is not yet guaranteed. The completion tests above use a trusted clock, so they do not certify an entire real-time paced HTTP game or production deployment. Higher AI difficulty calibration and full Advanced/expansion acceptance remain separate unfinished scope.

## Automatic-response integration and polling review

A later independent review identified same-room worker fan-out from500ms GET polling. The route now shares one in-flight continuation promise per room within its isolate and clears it after success or rejection. CAS remains necessary across isolates. Before paced AI work, that continuation can persist an older uncancelable response through its own four-attempt CAS loop. New windows resolve in their originating action; `viewGame` does not mutate rewards. Seven production SQLite/route regressions cover exact-once recovery, legitimate response no-write, competing/four-bounded CAS, takeback and promise-gate cleanup. The final integrated persisted/API suite passed63 tests. This coalescing is a local load reduction, not a durable cross-isolate scheduler.
