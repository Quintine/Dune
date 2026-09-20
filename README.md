# Dune — Arrakis Table

An unofficial multiplayer adaptation of Gale Force Nine’s classic 2019 Dune, built with React, TypeScript, Vinext, and Cloudflare Workers/D1. **Development is ongoing; this is not yet a complete rules implementation.** Advanced and unfinished expansion starts remain disabled. Start with [current status](docs/CURRENT_STATUS.md) for implemented systems, remaining requirements and release gates; detailed historical evidence remains in the [implementation log](docs/IMPLEMENTATION_STATUS.md).

## Run locally

Use Node.js 22.13 or newer and npm. Install the locked dependencies and apply local migrations before starting the server:

```sh
npm ci
npm run db:local
npm run dev -- --host 0.0.0.0
```

Open `http://localhost:3000`. Create a room, share its eight-character invitation, and add human or AI seats. The host can configure Easy, Medium, Hard and Brutal AI opponents. Current calibration demonstrates a substantially weaker Easy policy; it does not yet demonstrate a consistent ordering among the upper three levels.

Local games persist in `.wrangler/state`. Keep this directory across restarts. Apply new additive migrations before running code that depends on them. Never delete the local database to resolve a connection or rules problem. `.openai/hosting.json` belongs to the existing Sites project; do not recreate the hosting project.

## Saved seats and reconnecting

The room cookie identifies your seat. Refreshing or reopening the invitation with that cookie restores your private hand and pending decisions. A failed restoration offers an explicit retry. Requests time out after 15 seconds; uncertain game actions are reconciled with a read rather than automatically repeated.

Use **Protect your saved seat** to generate and privately save a recovery kit before enabling its key. Keep the complete kit separate from the invitation. **Recover a saved seat** uses that kit to restore the same faction after cookie loss and revokes the previous browser sessions for that seat. Recovery keeps existing forces, resources and sealed commitments. Anyone holding the kit can control that seat and see its private information.

If recovery receives no confirmed response, keep the page open and retry the same recovery request. The server recognizes the receipt and does not rotate twice. Replacing the recovery key invalidates the older kit. Host-initiated takeover remains unfinished. An owning human seat can enable or disable its own AI control during a started game.

New create/join requests save a private, tab-scoped retry record before sending. If the response is uncertain, keep the tab open and use the explicit retry; refresh preserves the same request. Confirmed success removes that record. Clearly rejected first requests return to the form for correction. A retry can recover the original room and seat without creating duplicates, but closing the tab or clearing its data can lose the proof. This record is separate from the long-term seat recovery kit.

An uncertain saved-kit recovery keeps its exact retry details in memory and prevents conflicting navigation. If that recovery has become obsolete, deliberate abandonment releases the controls after explaining that it cannot undo a completed recovery. Keep a valid saved kit before discarding retry details.

Use **Pass your seat to another player** for a voluntary one-time transfer. The private offer lasts 24 hours; acceptance preserves progress and revokes the old owner’s sessions and recovery kits. The recipient uses **Accept a seat handover** on the home page, then creates their own recovery kit. Keep the tab open until acceptance is confirmed; exact private retry details survive refresh in that tab. See [seat handover](docs/SEAT_HANDOVER.md) for cancellation, retry behavior and current limits.

The table header offers optional **Sound effects**, with mute, volume and a test
sample. Short cues mark phase changes and automatic action notices. Sound starts
off; preferences stay in your browser. See [table sounds](docs/TABLE_SOUNDS.md)
for activation, background behavior and prototype limits.

## Verify changes

Use the [development guide](docs/DEVELOPMENT.md) for architecture, focused tests
and the [repeatable verification tools](docs/VERIFICATION_WORKFLOW.md). Tests are discovered automatically; the default
suite includes in-memory persistence recovery and needs no server:

```sh
npm test -- ecaz-collection ecaz-spice
npm run check
npm run build
```

Run `npm run test:integration` against a development server for HTTP/session
changes. `npm run test:multiplayer` remains available for recovery plus HTTP
checks; `npm run test:recovery` runs only in-memory persistence tests. All test
commands accept filename fragments and `--list` after `--`.

The production build is written to `dist`. `npm start` runs that build with Wrangler; apply its database migrations to the intended storage environment before use. The included local migration command targets the development database, not a remote deployment.

Reproduce the current AI study with:

```sh
node --import tsx tools/ai-calibration.ts --games 120 --seed 20260907 --out /tmp/dune-ai-calibration.json
```

See [AI calibration](docs/AI_CALIBRATION.md), [multiplayer audit](docs/MULTIPLAYER_AUDIT.md), [component inventory](docs/COMPONENT_INVENTORY.md), and [visual playtest](docs/VISUAL_PLAYTEST.md) for scope and limitations. Passing subsystem tests does not certify every rules combination.

## Development maintenance

The user-authorized 13 September 2026 local reset established a fresh saved-game baseline; see the [reset record](docs/VERIFICATION_WORKFLOW.md#authorized-reset-13-september-2026). Preserve all games created after that checkpoint.

Reuse the running development server. Restart only when a code or configuration change, or an observed server condition, makes leaving it running likely to cause issues; use judgment rather than an hourly schedule. Preserve database state, warn before interrupting human play, and defer until a safe decision point. Verify server health and restoration after a necessary restart. No recurring automation is installed; the user requested leaving it removed. Fix causes of crashes and lost progress rather than relying on restarts.

The application bundles its artwork, fonts and rules guidance. Source provenance and third-party notices live in developer documentation; the player-facing reference uses internal links. Publication remains gated on completion and integrated verification of the requested rules, expansions and critical player journeys.
