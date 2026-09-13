# Ixians & Tleilaxu functional prototype

13 September 2026. This connects the existing expansion mechanics to genuine
setup and an ordinary saved browser table. It is a **working prototype**, with
rules coverage still partial. Normal Advanced/expansion start gates and the
publication gate remain closed.

## Playable boundary

`initializeIxGameForAudit` uses the same staged setup as the game: prediction,
private traitors, starting forces, private Ixian starting-card selection, then
the automatic deal and first Storm. It accepts Basic or Advanced, two through
six ready players, base factions plus Ixians and Tleilaxu, and exactly the Ix
expansion. It includes the 47 physical Treachery Cards and the 22-card Spice
Deck containing Sandtrout from the outset. It does not inject cards or change
factions after setup. Tech Tokens, Stronghold Cards, Homeworlds, Nexus Cards and
combined expansion decks remain separate integration work.

The actual player controls, private views, bot actions and saved game format
are reused. The initializer cannot redeal a started or nonempty game, and no
player action or HTTP endpoint dispatches it. Existing card outcomes and the
interpretations documented in the [Ix deck](../game/reference.ts),
[component inventory](COMPONENT_INVENTORY.md), [Ixian Cunning sources](NEXUS_IXIAN_CUNNING_RULES.md)
and [setup contract](ADVANCED_SETUP_TEST_SEAM.md) are preserved. In particular,
the Thumper/Sandtrout timing, repeated Harvester effects and remaining faction
interactions are not settled by this prototype.

## Start a local prototype table

Create a **new** local browser room with the Ixians & Tleilaxu expansion selected,
choose its human/AI factions, and mark everyone ready. Retain its room cookie.
Use the current database version of that named lobby with:

```sh
node --import tsx tools/start-prototype.ts \
  --db PATH_TO_LOCAL_D1_SQLITE \
  --room EIGHT_CHARACTER_CODE \
  --version CURRENT_LOBBY_VERSION \
  --out /private/new-prototype-checkpoint
```

The output directory must be new and outside the repository. The command first
captures an online backup and saved-room hashes, then initializes only that
fresh ready Ix lobby. An atomic version-and-state comparison rejects a concurrent
lobby change. It leaves every seat/recovery record and other room untouched.
Its private result records the source revision/fingerprint and before/after
versions. Refresh the invitation to continue through normal private setup.
Keep the resulting game; rerunning setup on it is rejected. Reuse the running
server—this workflow does not require a restart.

## Evidence and remaining work

`tests/ix-prototype.test.ts` exercises genuine Basic/Advanced setup at all four
AI profiles, private Ixian choices, Face Dancer custody, starting hands and
JSON restoration. Two complete mixed-profile games include both expansion
factions, checking final force/card inventory and winners. These sample games
do not prove every card was played or measure difficulty ordering.

`tests/prototype-room.test.ts` covers the local saved-room entry, unchanged
sessions/other rooms, stale version and redeal rejection, and invalid lobby
immutability. Independent review caught and fixed a missing JSON version update
in the prototype writer; the database row and saved game now advance together.
It uses in-memory SQLite. Browser room `W5LE6VFB` was created normally with a
human Ixian, Medium Tleilaxu and Hard Atreides. It reached private traitor and
starting-card choices through real setup, restored the same card offer after
refresh, played Weather Control, placed the mobile stronghold at Sihaya Ridge 9
and handed the owned seat to Brutal autopilot. No post-setup card/force staging
was used. Its later outcome and final checks are recorded with the checkpoint.
The earlier writer's version mismatch was corrected by the first ordinary
game action; current browser state and database version were confirmed equal.
Expand combination and rules coverage during
the later refinement pass; continue prototyping independent missing functions.
