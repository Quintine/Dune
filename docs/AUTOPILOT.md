# Voluntary human-seat AI control

A human player can delegate an existing seat to AI after setup begins, then take back control using the same seat credential. This addresses planned absences without giving hosts access to another person's hand or changing the board game's rules. It does not resolve a lost, unprepared seat whose owner has neither a session nor a recovery kit.

## Control and persistence

`Player.autopilot` is an optional Easy/Medium/Hard/Brutal setting, separate from permanent `Player.bot` seats. Existing room JSON needs no database migration. `setAutopilot` accepts only `type` and `difficulty`; a difficulty enables the owner's mode, and null removes it. Native AI seats, lobby/finished games, other-player targets and malformed choices are rejected. No inactivity detector silently delegates a seat.

The pure control transition changes only the owner's mode and public log. It bypasses gameplay postprocessing, preserving sealed dials, battle plans, setup commitments, Truthtrance, reaction windows and suspended transactions exactly. The authenticated room action then runs eligible AI normally. Taking control cannot undo a decision already committed to the room.

The API blocks ordinary owner submissions while autopilot is active. Take back control and explicit AI continuation remain available. The normal version/CAS boundary protects against stale requests and simultaneous opt-in, takeback, recovery and background processing. Session hashes and saved recovery keys are not replaced by delegation. Recovery preserves the mode; the recovered owner can take back control. A host cannot target another human through this feature.

`botActions` uses the same authorized `viewGame` projection for permanent bots and delegated humans. Difficulty selection is identical. Public views show the control mode but retain the usual hand, spice, traitor and sealed-plan privacy. No external AI service receives game state.

## Server continuation and limits

An accepted API action processes a bounded AI batch. If more work is pending, the route schedules `continueRoomBots` through Cloudflare's `waitUntil`. Each subsequent batch reads current persisted authority and performs a version-conditional update. A takeover or competing worker wins by committing a newer version; the obsolete batch is discarded and the loop rereads. Waiting for a human and a finished game stop the loop.

The current continuation has a sixteen-batch budget. It is **best effort, not a durable scheduler**. Cloudflare permits work after response/disconnect for a bounded period; runtime interruption or exhaustion can leave the persisted `botsPending` flag for a later explicit continuation. The existing browser reconnect/resume flow can resume it. No automatic platform alarm resumes a room after an unattended server restart. That remaining reliability requirement must be implemented and verified before claiming fully unattended operation. [Cloudflare duration limits](https://developers.cloudflare.com/workers/platform/limits/#duration), [module waitUntil export](https://blog.cloudflare.com/nodejs-workers-2025/).

GET remains a private read and does not advance a game. The all-controlled HTTP acceptance case polls only GET after the final delegation request, proving the observed completion came from the request's server continuation.

## Coverage ledger

| Requirement                                       | Engine/server                                                              | Human controls                                                  | AI/privacy                                    | Verification                                                                             |
| ------------------------------------------------- | -------------------------------------------------------------------------- | --------------------------------------------------------------- | --------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Voluntary own-seat control, four difficulties     | Top-level `applyAction` control branch; API identity and target validation | Explicit Start autopilot and Take back control                  | Native bot identity remains separate          | Seven `autopilot.test.ts` scenarios; HTTP auth and mode cases                            |
| Preserve pending/sealed choices on control change | Control branch skips ordinary phase postprocessing                         | Takeback stays reachable outside decision panels                | Same authorized projection before/after       | JSON dials, Truthtrance, phase opening, response and hand exchange fixtures              |
| Recovery and concurrent owner writes              | Existing credential rotation/CAS reused                                    | Existing saved-kit recovery; public active-mode banner          | Revoked cookie cannot read or act             | Six `autopilot-recovery.test.ts` HTTP cases                                              |
| Background batches cannot overwrite takeback      | Current-state read and version-fenced update per batch                     | Normal reconnect/resume controls                                | Only persisted bot/autopilot seats run        | Five SQLite `bot-continuation.test.ts` cases, including real authenticated takeover race |
| Complete an all-controlled game                   | POST schedules background continuation                                     | Final outcome remains inspectable                               | Three original human credentials preserved    | HTTP final opt-in returned playing, later GET finished; no subsequent gameplay POST      |
| Responsive and refresh flow                       | Saved mode read after refresh                                              | Mobile 44px takeback, separate opt-in, keyboard-native controls | Inspection remains readable during delegation | Browser room2SG3ZS3E; details in `VISUAL_PLAYTEST.md`                                    |
| Durable unattended restart scheduling             | Missing                                                                    | Reopen/resume available                                         | No automatic host takeover                    | Not certified; next reliability work                                                     |

## Validation checkpoint

After integration, `npm test` passed790 unit tests and `npm run test:multiplayer` passed45 persisted/API tests. TypeScript, lint and production build passed. The browser test enabled Medium during setup, refreshed, took back the same seat with its sealed storm choice intact, then selected Hard on mobile. Once the separate QA peer chose Medium, the game reached Harkonnen victory on turn7. This is one completed Basic autoplay journey, not AI strength calibration or complete Advanced/expansion acceptance.

The HTTP completion test observed a playing response at version9 followed by finished at version10, using separate fully consumed GET requests only. This proves current-process background progress; it is not evidence of durable alarms, recovery during a process crash, or every supported game configuration.
