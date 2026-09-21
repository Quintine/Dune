# Basic Ixians with Leader Skills

Connected development prototype, 21 September 2026. Genuine Basic Ixian setup
now supports the full fourteen-card Leader Skills deck, optionally alongside
Tleilaxu and base factions. Public starts and completion/publication gates remain
closed. Existing missing skill bands are not certified by this admission.

## Setup and configuration

Use Basic rules, exactly Ixians & Tleilaxu, two through six players including
Ixians, and no other optional modules. The real private Ixian starting-card
choice precedes simultaneous private skill offers, then public assignments,
Traitors and native Face Dancers. The first Storm retains actual HMS placement
and all seven cyborgs/thirteen suboids. No dealt card determines admission.

Create and ready a fresh local lobby, then follow the backed-up version-checked
[prototype entry](IX_PROTOTYPE.md) using profile `leader-skills`.
The shared initializer retains the [Tleilaxu integration](TLEILAXU_LEADER_SKILLS.md).

## Connected interactions

- Planetologist calculates each gathered origin's range using only cyborgs
  selected from that origin. Selected sectors within the same territory share
  their moving group. Its range bonus independently survives native movement
  cancellation; a three-territory cyborg move still opens the proper Karama
  window. Independent city ornithopters do not create that native window.
- Sandmaster routes can enter or leave the HMS interior through its current
  pointer. Adjacency belongs to the room, respects the storm and never turns the
  interior into a shortcut or relocates the HMS. Interior battles and spice
  effects remain distinct from the external pointing sector.
- Suk Graduate finishes rescue before native substitution. Kept cyborgs and
  cyborgs returned to reserves are excluded from the actual Tank-loss map. Where
  more than one reserve-rescue origin is possible, the player explicitly selects
  it; only cyborgs truly lost in each sector can be substituted there. Normal
  rescued-force origins need no extra choice because no subsequent effect here
  depends on them. This exposes existing physical choices, not a new rescue power.
- Rihani finishes its private exchange before substitution. A saved receipt
  binds original losses, physical counters, cards and the declared exchange.
  Substitution allow, decline and cancellation all resume mandatory then optional
  winner cleanup; Planetologist substitutes cannot escape disposal.
- Thumper, the additional Harvester and Amal are the expansion's green Special
  cards eligible for Planetologist substitution. Exact physical identities,
  names and effects are checked. Their native effects do not execute during
  substitution; other cards in the engine's broad Special bucket are excluded.

## Sources and interpretation

Existing [Leader Skills rules](LEADER_SKILLS_RULES.md),
[Planetologist contract](PLANETOLOGIST_RULES.md),
[Suk Graduate contract](SUK_GRADUATE_RULES.md),
[Sandmaster routes](SANDMASTER_MOVEMENT.md) and
[Ix rules](IX_PROTOTYPE.md) supply the established powers, physical custody and
skill-before-faction precedence. Rescue-sector selection records the physical
choice needed to compose those powers without reviving an already rescued counter.

The canonical green Ix card inventory was checked directly against the printed
components visible in this [component photograph](https://static.lelekan.ua/image/cache/catalog/igri/dune-ixians-tleilaxu-expansion-eng/dune-ixians-tleilaxu-expansion-gale-force-nine-eng-lelekan-components-2-800x800.jpg).
This is physical component evidence, not a retailer's rules interpretation.
Thumper also appears in the existing designer Planetologist example. The private
source archive records SHA-256
`6d2eb22889059edc8b35b9cd1178b6907312132b1b41768051d15abcc9c89125`.
Sandtrout is a brown Spice card; red/blue battle cards do not qualify.

## Verification and remaining scope

```sh
npm test -- ix-skills
node --import tsx tools/faction-games.ts --profile ix-skills --out /private/new-ix-skills-samples
```

The sample profile adds Tleilaxu, Emperor, Guild, Harkonnen and Fremen in order
and preserves stable scenario ordinals 26–30. Focused tests use all fourteen
genuine assignments and conserved battle/movement positions, with legal actions
from existing AI profiles, controls, private views, strict rejection and JSON
continuation. In-memory authenticated recovery verifies exactly one concurrent
starting-card choice, subsequent private setup and unchanged seats. Final
source-bound check/build, samples, browser and preservation reports remain private.
These are playability checks, not AI strength studies.

Advanced Ixians, additional faction/module combinations, unresolved Sandmaster
eligibility during native HMS relocation and other missing Leader Skill effects remain
separate work. Existing Banker, Mentat, Diplomat and modified-Smuggler questions
remain in the [decision register](RULE_DECISIONS.md). Full AI implementation and
difficulty tuning wait until all non-AI game features are complete.
