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

Before starting, open **Configure** on an AI seat to change its difficulty,
faction or player circle without replacing it. Changes save immediately and
clear human readiness. See [lobby AI configuration](docs/LOBBY_AI_CONFIGURATION.md).

Full AI implementation and tuning wait until all non-AI game features are
complete. The [AI development plan](docs/AI_DEVELOPMENT_PLAN.md) then targets
approximately 75% higher-tier wins for Medium/Easy, Hard/Medium and Brutal/Hard.
Until that stage, AI work focuses on minimal legal participation and critical
playability fixes.

Choose **Learn to play** for the [interactive introduction](docs/INTERACTIVE_INTRODUCTION.md)
at `/learn`. Practice storm dials, spice blows, alliances, charity, bidding, revival, shipping, movement, battle plans, Traitor calls and collection before entering a
room; lesson progress stays in your browser and does not change saved games.

Local games persist in `.wrangler/state`. Keep this directory across restarts. Apply new additive migrations before running code that depends on them. Never delete the local database to resolve a connection or rules problem. `.openai/hosting.json` belongs to the existing Sites project; do not recreate the hosting project.

For private NAS hosting and manually applied checkpoint image updates, see the
[TrueNAS container guide](docs/TRUENAS.md). Its separate persistent storage starts
with new games; the requested host port is 33046.

## Saved seats and reconnecting

The room cookie identifies your seat. Refreshing or reopening the invitation with that cookie restores your private hand and pending decisions. A failed restoration offers an explicit retry. Requests time out after 15 seconds; uncertain game actions are reconciled with a read rather than automatically repeated.

Use **Protect your saved seat** to generate and privately save a recovery kit before enabling its key. Keep the complete kit separate from the invitation. **Recover a saved seat** uses that kit to restore the same faction after cookie loss and revokes the previous browser sessions for that seat. Recovery keeps existing forces, resources and sealed commitments. Anyone holding the kit can control that seat and see its private information.

If recovery receives no confirmed response, keep the page open and retry the same recovery request. The server recognizes the receipt and does not rotate twice. Replacing the recovery key invalidates the older kit. Host-initiated takeover remains unfinished. An owning human seat can enable or disable its own AI control during a started game.

For a planned absence, **Let a player start AI for your seat** grants one named
human player permission to start your chosen difficulty once within 24 hours.
They can activate it while you are online, but receive no private seat access.
You can revoke unused permission or take back control. Recovering or transferring
either seat invalidates the grant. See [AI permission](docs/SEAT_AI_PERMISSION.md)
for saved retries and limits.

New create/join requests save a private, tab-scoped retry record before sending. If the response is uncertain, keep the tab open and use the explicit retry; refresh preserves the same request. Confirmed success removes that record. Clearly rejected first requests return to the form for correction. A retry can recover the original room and seat without creating duplicates, but closing the tab or clearing its data can lose the proof. This record is separate from the long-term seat recovery kit.

An uncertain saved-kit recovery keeps its exact retry details in memory and prevents conflicting navigation. If that recovery has become obsolete, deliberate abandonment releases the controls after explaining that it cannot undo a completed recovery. Keep a valid saved kit before discarding retry details.

Use **Pass your seat to another player** for a voluntary one-time transfer. The private offer lasts 24 hours; acceptance preserves progress and revokes the old owner’s sessions and recovery kits. The recipient uses **Accept a seat handover** on the home page, then creates their own recovery kit. Keep the tab open until acceptance is confirmed; exact private retry details survive refresh in that tab. See [seat handover](docs/SEAT_HANDOVER.md) for cancellation, retry behavior and current limits.

Use **Table discussion** below the board for public conversation or private
messages to another human seat. Messages survive refresh; exact retries avoid
duplicates. Private history follows the seat through recovery or handover.
Messages do not execute game actions, and AI opponents do not answer them yet.
See [table discussion](docs/TABLE_DISCUSSION.md).

Use **Bribes** beneath the table to pay a non-allied faction. The recipient's
share becomes spendable at the next Mentat Pause; the panel shows your own
incoming bribes and the current payment limit. See [bribe controls](docs/BRIBE_CONTROLS.md).

At a Nexus, an unanswered alliance offer names its recipient and offers
**Withdraw your alliance offer**. Formed alliances keep the separate **Break
alliance** action. See [Nexus offers](docs/NEXUS_OFFERS.md).

Use **Inspect forces** under any player to enlarge their counters and read public
reserves, Tanks and deployed groups, including Homeworld reserve breakdowns.
See [force inspection](docs/FORCE_INSPECTION.md).

Use **Inspect faction** under any player for public powers and alliance guidance.
The sheet starts in the table’s rules mode and offers an Advanced preview without
changing the game. Browse all twelve in the [faction-sheet gallery](docs/FACTION_SHEETS.md).

In new Advanced Ecaz development games, **Loyalty** shows the publicly set-aside
Traitor Card before dealing. Inspect it without making a game choice; its identity
persists through refresh. See [Ecaz Loyalty](docs/ECAZ_LOYALTY.md).

The local Leader Skills prototype also supports Basic Moritani with base
opponents and the full fourteen-card deck. See [entry, connected interactions
and remaining boundaries](docs/MORITANI_LEADER_SKILLS.md). Basic Tleilaxu also
supports the full deck, native Rihani exchanges and saved revival choices; see
[its integration boundary](docs/TLEILAXU_LEADER_SKILLS.md). Basic Ixians now connect
cyborg movement, HMS routes and battle aftermath through the same full deck; see
[Ixian integration](docs/IX_LEADER_SKILLS.md). The existing Basic CHOAM setup now
connects ordinary skill actions and saved market/revival choices; see
[CHOAM integration](docs/CHOAM_LEADER_SKILLS.md).

Above the board, **Treachery draw pile** and **Spice draw pile** show live card
counts separately from hands, auction cards and discards. See
[draw-pile counts](docs/DRAW_PILES.md).

Truthtrance's **Current physical forces** question compares counters in reserves,
the Tanks or an exact board location. It supports normal, elite and total counts
where recorded; see [force questions](docs/TRUTHTRANCE_FORCE_FACTS.md).

After both battle plans are revealed, **Compare revealed battle plans** opens
the shared dials, leader portraits and played card faces. Inspect any component,
then return to the pending decision. See [battle components](docs/REVEALED_BATTLE_COMPONENTS.md).

In **Your private hand**, search card names, filter by printed category or change
the display order. **Show all cards** clears filters. Inspectors and card actions
stay with each physical card. See [hand browsing](docs/HAND_BROWSING.md).

The table header offers optional **Sound effects**, with mute, volume and a test
sample. Short cues mark phase changes and automatic action notices. Sound starts
off; preferences stay in your browser. See [table sounds](docs/TABLE_SOUNDS.md)
for activation, background behavior and prototype limits.

**Automatic action notices** briefly identify completed actions in house colors.
Bursts summarize older notices while retaining their details in the chronicle;
see [completed-action feedback](docs/ACTION_FEEDBACK.md).

In Advanced development games, **Your Harkonnen inspection** preserves the cards
seen during the special-Karama exchange. A return with only one legal selection
completes automatically; see [private exchange history](docs/HARKONNEN_EXCHANGE.md).

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
