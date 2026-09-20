# Lobby AI configuration

The host can add, remove and configure permanent AI seats before starting. Each
seat's Configure panel offers its existing difficulty, an available enabled
faction and an unoccupied player circle. Changes save immediately; human players
must confirm readiness again, while AI seats stay ready. Changing faction also
updates the public AI name. The same seat ID survives every change and refresh.

The shared `quoteLobbyBotConfiguration` validates the complete action for both
the controls and server: exact fields, authenticated host, lobby status,
permanent AI target, one of four existing profiles, enabled unoccupied faction,
and integer circle 1–6. Human seats, including those using autopilot, cannot be
configured through this action. Faction changes initialize leaders and Ixian
elite reserves consistently with existing lobby selection. Difficulty and circle
changes preserve those rosters. Public history names the changed fields and
explains the readiness reset.

Controls do not send unchanged settings. An identical direct server action
preserves players, readiness and history, but advances the room version through
the existing action store. Concurrent and stale requests retain that store's
version/session fences. Configuration cannot overwrite a simultaneous successful
start, and starting cannot overwrite a successful configuration. If configuration
wins, cleared human readiness blocks starting until reconfirmed.

This is an integrated lobby capability, not AI strategy refinement or complete
multiplayer acceptance. It preserves the existing profiles, mode/expansion start
gates and the [post-feature AI development plan](AI_DEVELOPMENT_PLAN.md).

Evidence includes the focused engine/quote tests in
`tests/lobby-bot-configuration.test.ts`, real SQLite/restart/concurrency checks in
`tests/lobby-bot-configuration-recovery.test.ts`, and authenticated HTTP checks in
`tests/lobby-bot-configuration-http.test.ts`. Browser, independent review and
final source-bound checks/preservation belong to the private checkpoint report
and Git message. Full rules completion, final accessibility review and AI
calibration remain separate gates.
