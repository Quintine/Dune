# Basic Tleilaxu with Leader Skills

Connected development prototype, 21 September 2026. Basic Tleilaxu with base
opponents now uses all fourteen physical skills through genuine setup. Public
starts, complete-mode acceptance and publication remain gated. Existing missing
skill effects are still explicit; this is not complete expansion certification.

## Configuration and physical setup

The existing `leader-skills` local initializer accepts Basic rules, exactly the
Ixians & Tleilaxu expansion, Tleilaxu plus base factions, two through six seats,
and no other optional modules. It keeps the real Ix Treachery/Spice decks and
the Cheap Hero Traitor identity. Starting Treachery precedes simultaneous
private two-card skill offers; public assignments and ordinary Traitor choices
precede the native three Face Dancers. No hidden card controls profile admission.
Ixians, Advanced Tleilaxu and combined modules require further integration.

## Connected interactions

Native own-leader revival now records its optional skill offer when the revival
actually commits. Automatic early-permission/discount responses cannot skip the
offer; income responses finish before the player's choice. The undrawn offer
reveals neither card, can be declined, and binds a drawn choice to that revived
leader. Canceled or unaffordable revivals create no offer. Existing observation
of Ghola and other native revivals remains idempotent. Captured replacement
entitlement stays guarded. Foreign gholas remain Advanced-only and excluded
from this profile; the FAQ says acquiring one does not draw a new skill.

Rihani uses the [recorded FAQ](LEADER_SKILLS_RULES.md):
Tleilaxu's drawn cards become unrevealed Face Dancers, and only an unrevealed old
Face Dancer can be exchanged. The normal private peek returns cards first; the
optional draw then requires keeping one new card, publicly revealing/returning
one eligible old card, and privately returning the other new one. Retained
reveal statuses and all physical identities survive saved choices. Opponents
receive neither inspection history nor the drawn/kept identities. Human
controls identify Face Dancers and reuse the enlarged component inspector;
existing AI chooses only from its private eligible lists.

Skills and winner card cleanup finish before native Face Dance. A completed
Rihani receipt remains bound to live custody during that cleanup. At validated
Face Dance admission a signed saved boundary retires that historical snapshot
as a live constraint, allowing the later reveal or three-card refresh. The
original receipt and the current physical census remain validated. Face Dance
kills a living winning leader without a bounty and returns its skill once.
Older receipts without the new boundary retain their original signature shape.

Shared profile checks extend the existing ordinary movement, shipment, payment
and battle effects. Zoal's unmodified Smuggler collection uses the opposing
disc's printed value from the two revealed plans, including zero against Cheap
Hero; it does not use Zoal's revival value or copy the opponent's skill bonus.
This follows the existing [Zoal and skill contract](LEADER_SKILLS_RULES.md) and
[Smuggler boundary](SMUGGLER_BATTLE.md), without settling modified-strength cases.

## Entry and checks

Create a fresh Basic lobby with Ixians & Tleilaxu selected, Tleilaxu and base
opponents, and ready every human. Keep its room cookie, then use the backed-up,
version-checked local entry described in [prototype setup](IX_PROTOTYPE.md):

```sh
node --import tsx tools/start-prototype.ts --profile leader-skills \
  --db PATH_TO_LOCAL_D1_SQLITE --room EIGHT_CHARACTER_CODE \
  --version CURRENT_LOBBY_VERSION --out /private/new-tleilaxu-skills
node --import tsx tools/faction-games.ts --profile tleilaxu-skills \
  --out /private/new-tleilaxu-skills-samples
npm test -- tleilaxu-skills rihani-face-dancers
```

The sample profile runs two through six players with Emperor, Guild, Harkonnen,
Fremen and Bene Gesserit added in order; focused tests also include Atreides.
It counts all Treachery, skill, Traitor/Face Dancer and force custody, checks
rejected-action immutability and JSON/private-view restoration. Saved sample
continuation preserves the full module; Advanced selection fails before running.
These are legal-play checks, not difficulty calibration. The tests use genuine
setup followed by explicitly conserved focused positions, not invented full
phase histories. Authenticated in-memory SQLite checks cover concurrent setup
choices, restarted private views, three Face Dancers and unchanged seat records.
Private source-bound reports record final checks, game samples and browser work.

## Remaining work

Normal Banker income, ordinary Mentat questioning, Diplomat retreat, modified
Smuggler collection, captured replacement entitlement and other recorded skill
questions remain incomplete. See the [runtime boundaries](LEADER_SKILLS_RUNTIME.md)
and [rule decisions](RULE_DECISIONS.md). Full AI implementation and tuning wait
until all non-AI game features are complete.
