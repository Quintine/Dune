# Basic Moritani with Leader Skills

Connected development prototype, 21 September 2026. Basic rules, Moritani and
two through six total seats with base-faction opponents now use the full
fourteen-card Leader Skills deck. Public starts and publication remain gated;
this integrates existing effects, not complete Leader Skills compliance.

## Public configuration and setup

The existing `leader-skills` local initializer accepts exactly `['ecaz']`,
Basic rules, Moritani plus base factions, and no other optional modules. It
does not enable Ecaz, Advanced assassination, the separate Ecaz Treachery
variant, Homeworlds, Nexus, Discoveries, Tech Tokens or Stronghold Cards with
this roster. Existing base and CHOAM/Richese profiles retain their boundaries.
Admission uses only public configuration, never hidden hands or the random deal.

Starting Treachery Cards and the ordinary private two-card skill offers precede
Traitors. Every physical skill remains eligible for Basic Moritani assignment;
there is no reduced deck or card-specific admission workaround. Moritani places
its six starting forces after the other setup choices. Existing human controls,
private offers, public assignments and minimal legal AI choices are reused.

## Connected interactions

Shared public-profile checks connect Banker spending, Diplomat base-defense
copying, Sandmaster ground/worm collection, Smuggler shipping/battle collection,
Bureaucrat payment redirection and Planetologist movement across engine,
projection, controls and bots. Suk casualty rescue, Rihani exchanges and
Sandmaster victory spice use the same expanded battle boundary. Printed leader
strength stays distinct from skill bonuses and bounty calculations.

Terror Assassination kills an ordinary skilled leader under the existing Terror
rules and returns its exact physical skill once. A later own-leader revival
offers an optional draw before revealing either card; the drawn choice remains
private through saved continuation. Sabotage affects Treachery custody only.
An Enemy of My Enemy alliance changes allies without transferring assignments.
The losing ally's retention choice excludes a used Planetologist Special and a
Diplomat copied Worthless card, since both must be discarded after use.

These are compositions of the recorded [Leader Skills contract](LEADER_SKILLS_RULES.md),
[Terror Assassination](MORITANI_ASSASSINATION_SNEAK.md),
[enemy alliance](MORITANI_ENEMY_ALLIANCE.md),
[ally retention](MORITANI_ALLY_RETENTION_RULES.md),
[Planetologist](PLANETOLOGIST_RULES.md) and [Diplomat](DIPLOMAT_DEFENSE.md)
contracts. No new publisher ruling is asserted. Existing Atomics/Extortion,
exceptional assassination pools and competing-arrival questions remain explicit.

## Remaining work

The [Leader Skills runtime](LEADER_SKILLS_RUNTIME.md) retains unfinished normal
Banker income, ordinary Mentat-question activation, Diplomat retreat, modified
Smuggler collection, captured replacement entitlement and other source gaps.
The private Mentat question preview has not been enabled for this roster.
Basic Moritani admission does not settle those effects or certify every valid
expansion/module combination. Advanced Moritani, Ecaz, Ixians and Tleilaxu need
their own integration, including the recorded deferred Tleilaxu revival timing.
Full AI strategy and difficulty calibration still wait for feature completion.

## Reproducible entry and verification

Create a fresh Basic lobby with Ecaz & Moritani selected, seat Moritani and only
base opponents, and ready every human. Preserve the room cookie and run the
existing backed-up, version-checked local tool:

```sh
node --import tsx tools/start-prototype.ts --profile leader-skills \
  --db PATH_TO_LOCAL_D1_SQLITE --room EIGHT_CHARACTER_CODE \
  --version CURRENT_LOBBY_VERSION --out /private/new-moritani-skills
node --import tsx tools/faction-games.ts --profile moritani-skills \
  --out /private/new-moritani-skills-samples
npm test -- moritani-skills
```

The sample profile runs Basic games at two through six seats, adding Emperor,
Guild, Harkonnen, Fremen and Bene Gesserit in that order. It preserves all four
existing difficulty profiles and verifies Treachery, skill, Traitor and force
custody, rejected-action immutability and periodic JSON/private-view restoration.
Separate genuine-setup focused tests include Atreides. These are legal-play
samples, not calibration or exhaustive roster/skill coverage. Interrupted games
can use the existing `--resume` path, which retains the full module and roster.

Focused regressions exercise every physical skill assignment, public guards,
movement controls, legal bot choices, Terror death/Sabotage, revival, payment,
battle effects, real alliances and mandatory retention exclusions. Authenticated
in-memory SQLite restart and concurrent choices verify one physical assignment,
private offers, preserved seats and the final Moritani placement. Conserved
staged phase/battle positions are labeled rather than claimed as played games.

Private source-bound final checks, sample results, browser observations,
saved-game preservation and Git delivery live under `20260921-moritani-skills`
outside the checkout. Actual outcomes and remaining limitations are recorded in
the commit message; no saved game is reset or discarded for verification.
