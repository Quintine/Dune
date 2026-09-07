# Dune — Arrakis Table

An unofficial multiplayer adaptation of Gale Force Nine’s classic 2019 Dune, built with React, TypeScript, Vinext, and Cloudflare Workers/D1. **Development is ongoing; this is not yet a complete rules implementation.** Advanced and unfinished expansion starts remain disabled. See [implementation status](docs/IMPLEMENTATION_STATUS.md) for implemented systems, evidence, outstanding rules questions and release gates.

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

## Verify changes

Run the development server before the persisted multiplayer suite:

```sh
npm test
npm run test:multiplayer
npm run typecheck
npm run lint
npm run build
```

The production build is written to `dist`. `npm start` runs that build with Wrangler; apply its database migrations to the intended storage environment before use. The included local migration command targets the development database, not a remote deployment.

Reproduce the current AI study with:

```sh
node --import tsx tools/ai-calibration.ts --games 120 --seed 20260907 --out /tmp/dune-ai-calibration.json
```

See [AI calibration](docs/AI_CALIBRATION.md), [multiplayer audit](docs/MULTIPLAYER_AUDIT.md), [component inventory](docs/COMPONENT_INVENTORY.md), and [visual playtest](docs/VISUAL_PLAYTEST.md) for scope and limitations. Passing subsystem tests does not certify every rules combination.

## Development maintenance

During active development, preserve database state and perform a controlled server restart approximately hourly. Warn before interrupting human play and defer until a safe decision point. Verify server health and restoration afterward. No recurring automation is installed; the user requested leaving it removed. Fix causes of crashes and lost progress rather than relying on restarts.

The application bundles its artwork, fonts and rules guidance. Source provenance and third-party notices live in developer documentation; the player-facing reference uses internal links. Publication remains gated on completion and integrated verification of the requested rules, expansions and critical player journeys.
