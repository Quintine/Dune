# Ixians & Tleilaxu functional prototype

## Hidden Mobile Stronghold passenger collection — 28 October 2026

**Prototyped / Partial.** The publisher's E1 rulebook, printed p. 9, permits
Ixians to collect two spice per force in their stronghold without explicitly
resolving foreign passengers. This prototype provisionally includes foreign
fighters, while Ixians alone receive the spice. The supplied Advanced revision,
physical p. 36 / printed p. 34, treats a deployed No-Field as one force for
effects including collection; its concealed value is not used. It also says
advisors have no effect on other factions (physical p. 28 / printed p. 26), so
advisors are provisionally excluded, including a marker controlled by an
advisor. These applications are interpretations, not explicit publisher
clarifications. Normal and special relocation selections use the shared public
capacity; old actions and pending moves without selections retain their old
Ixian-only automatic limit. This avoids changing the result of a saved choice.

The shared [capacity helper](../game/mobile-stronghold-collection.ts) reads only
public positions and stances. [Native movement cases](../tests/mobile-stronghold-passengers-runtime.test.ts)
exercise Basic and Advanced declarations, a real response, collection and the
legacy default with conserved staged counters and spice. [Helper cases](../tests/mobile-stronghold-passengers.test.ts)
cover advisor-controlled and concealed No-Fields; [control cases](../tests/mobile-stronghold-collection-controls.test.tsx)
exercise projected states in a component harness. Four related files pass 17
cases; this does not certify every movement interaction or deployed play.
The production build and `npm run check:quick` also passed for this batch.

## Hidden Mobile Stronghold route collection choices — 27 October 2026

**Prototyped / Partial.** The printed Ixian power permits optional collection
when the occupied stronghold moves into, from or through a spice sector, at
two spice per force in the stronghold. See publisher E1 printed p. 9 and the
user-authorized revised source physical p. 34 / printed p. 32. The publisher
does not spell out partial allocations; this preview provisionally permits any
whole amount up to the live pile and the eligible force limit in each visited
sector. The passenger interpretation and legacy behavior are described above.
The existing unique-sector route, storm and destination constraints remain.

The controls show starting and subsequent route sectors and permit zero or a
partial amount. Sandmaster deductions, if selected, occur first. A cancelable
ordinary declaration retains the selected amounts through the real response;
Advanced special Karama uses the same selector and two-territory limit. Legacy
actions and saved pending moves without choices retain their previous automatic
maximum or no-collection behavior. AI may continue using that legal default.
[Runtime tests](../tests/mobile-stronghold-collection-runtime.test.ts) use a
native source and explicitly conserved staging for the two-pile examples;
[control tests](../tests/mobile-stronghold-collection-controls.test.tsx) use
a controlled component harness, not a browser. Wider route interpretations,
other combinations and deployed acceptance remain open.

## Advanced starting draft source cutover — 27 October 2026

**Prototyped / Partial.** The user-authorized Advanced revision, physical34 /
printed32 A, explicitly adds one card to the original Ixian starting pool when
Harkonnen is seated, then deals Harkonnen two from the shuffled remainder.
Fresh Advanced setup now follows that complete pool: Ixians may choose any
of its N+1 physical cards, including the added card. Every other faction still
starts with one, Harkonnen with two, and no later extra card is drawn.
See the [source adoption](RULE_DECISIONS.md#authorized-source-amendment--1-october-2026).

Basic remains different. The publisher-authored E1 book, printed8, draws one
card per faction; its printed11 Q&A explicitly retains Harkonnen's extra draw
from the top of the deck after Ixian setup. Fresh retrieval of the official
GF9 URL returned403; the [publisher-file mirror](https://cdn.1j1ju.com/medias/20/16/31-dune-ixians-tleilaxu-rulebook.pdf#page=11)
was reread, including the original FAQ. This is an Advanced-source cutover,
not a claim that the supplied revision changed Basic or the classic edition.

The recorded pool's original size identifies the procedure. Existing Advanced
N-card pools and historical short pools retain the prior one-per-other-player
deal and separate Harkonnen bonus; no card is inserted into a saved choice.
Fresh Advanced without Harkonnen still draws N. The shared pure deal plan
preserves original seat order and exact recipient quantities. Actual native
choice, shuffle, private views and existing legal AI use the offered cards.

With Leader Skills, Ixian selection and the complete physical starting-card
deal still precede offers/training. Without Skills, the existing setup order
remains. The persistent choice panel explains the current saved procedure;
no new action, confirmation, hand access or module gate is introduced.

Focused paths: [deal plan](../game/ixian-starting-cards.ts),
[native source](../tests/fixture-ix-starting-pool.ts),
[native cases](../tests/ix-starting-pool-runtime.test.ts),
[controls](../components/ix-technology.tsx).
Frozen **15 files, 153/153**, types/lint/build and six genuine setup programmes
pass. Runtime records 14 GameTable SSR, 6 private choice-panel renders and
6 actual starting-card callbacks, with source/further action arrays
28/16. Initializers are not counted actions or public-start acceptance.
Basic/Advanced, all14 order and two no-Hark controls use actual original deals;
old-count completion is a labelled conserved unit supplement. Seventeen new
focused cases and the corrected old source expectations pass. The existing
server returned HTTP200 without restart. Wider combinations, complete modes
and final rules/recovery/privacy/browser/deployed acceptance remain.
Proof: `/home/quintine/.local/share/dune/checkpoints/20261027-ix-starting-pool-proof-v2/`;
journeys/HTML: adjacent `20261027-ix-starting-pool-runtime/run/`.

The [26 October live World follow-up](HOMEWORLD_RULES.md#live-world-sandtrout--26-october-2026)
keeps occupation capabilities available while an original Sandtrout waits.
It corrects a module-context rejection; the original Spice effects and
provisional compositions below retain their existing source and timing.

## Original Spice cards and selected policy — 24 October 2026

Normal lobbies now offer labelled Basic/Advanced expansion previews through
the [current entry controls](EXPANSION_FACTIONS_PROTOTYPE.md). The September
initializer and evidence below are historical; complete expansion rules and
publication acceptance remain open.

This bounded source review covers original Thumper, Sandtrout and the two
physical Harvesters. It retains existing mechanics under the standing
14 October choose-recommended instruction, with these explicit interpretations:

- Thumper creates an encounter without consuming a real Spice Card. The
  [original photographed card faces](https://static.lelekan.ua/image/cache/catalog/igri/dune-ixians-tleilaxu-expansion-eng/dune-ixians-tleilaxu-expansion-gale-force-nine-eng-lelekan-components-2-800x800.jpg)
  replace the reveal with Shai-Hulud. The [GF9 November FAQ, printed page 8](https://www.gf9games.com/dune/wp-content/uploads/2020/11/Dune-FAQ-Nov-2020.pdf#page=8)
  confirms Nexus and Advanced subsequent-worm placement; it does not expressly
  decide first-turn precedence.
- Provisionally give the [base first-turn rule, printed page 8](https://www.gf9games.com/dunegame/wp-content/uploads/Dune-Rulebook.pdf#page=8)
  precedence over both generated and drawn worms. Thumper is discarded but its
  first-turn encounter is ignored; a drawn first-turn worm does not consume
  waiting Sandtrout or earn doubling. Real ignored worms return to the original
  deck, while the virtual encounter never becomes an extra physical card.
- On later turns, waiting Sandtrout suppresses Thumper by the card's equivalence
  to Shai-Hulud. This composition is provisional, not a named publisher ruling.
  The [E1 rulebook, printed page 11](https://www.gf9games.com/dunegame/wp-content/uploads/2020/09/IxianAndTleilaxuRulebook.pdf#page=11)
  limits doubling to the immediate replacement territory. Another worm instead
  resolves normally, including its Nexus; a later territory receives no bonus.
- Each original Harvester doubles the current fresh blow while its window
  remains open. Two distinct copies therefore give four times the original
  blow, or eight times when an immediate Sandtrout replacement already doubled
  it. Pre-existing ground spice is unchanged. This is the recommended sequential
  reading of the photographed faces, not an independently confirmed FAQ result.

The photograph shows original components but is hosted by a retailer. Direct
official PDF retrieval returned 403; publisher-domain indexed excerpts and those
photographed faces supplied the bounded review. The authorized local Advanced
PDF corroborates first-turn ignoring on physical page 7 (printed 5), Thumper on
physical 41 (printed 39), and Sandtrout on physical 42 (printed 40). It does not
settle the stated ambiguities and supplies no new Basic authority.

The held Thumper explanation persistently warns about first-turn disposal before
the player spends it. Waiting Sandtrout also has an immediate-replacement warning.
Public chronicle entries explain ignored first-turn encounters. These are
readable controls and feedback; no extra confirmation, timing restriction or
numerical effect was introduced.

### Focused proof and limits

`tests/fixture-ix-spice-cards.ts` starts actual three-seat public Basic/Advanced
selected-Ix games with Atreides, Harkonnen and Fremen. Only four unopened original
Treachery deal positions and specified unopened Spice prefixes are selected;
native setup, phase openings and intervening turns actually execute. No dealt
hand, force, wallet, mode, turn or effect flag is installed. The independent
`tests/ix-spice-cards-engine.test.ts` assertions cover first/later Thumper,
first-turn Sandtrout/worm precedence, an immediate doubled replacement, a normal
replacement worm and both original Harvesters. All twelve programmes finish the
actual Spice phase, retain all 47 physical Treachery identities and preserve the
six real worms, fifteen territories and one physical/waiting Sandtrout. A second
Harvester clears earlier readiness and spends its own original physical card.

Frozen integration passes **4 files, 47/47 tests**, types/lint and production
build. Twelve original gameplay programmes also render the actual GameTable:
held-card warnings appear before disposal, and public projected logs retain the
new ignored-encounter explanation. Four existing minimal difficulty profiles
each submit one legal acceptance from the actual harvested window and finish
the phase; this is participation evidence, not strategy calibration.

| Programme | Basic source + continuation actions | Advanced source + continuation actions | Actual fresh-blow outcome |
| --- | --- | --- | --- |
| First-turn Thumper | 18 + 7 | 20 + 10 | 8; no Nexus |
| Later ordinary Thumper | 78 + 10 | 83 + 13 | 8; Nexus |
| First-turn Sandtrout then worm | 18 + 9 | 20 + 12 | 8; Sandtrout still waiting |
| Two original Harvesters | 18 + 12 | 20 + 15 | 8 → 16 → 32 |
| Waiting Sandtrout then Thumper and two Harvesters | 18 + 70 | 20 + 76 | 8 → 16 → 32 → 64; no Nexus |
| Waiting Sandtrout then Thumper and replacement worm | 18 + 70 | 20 + 76 | 8; Nexus, no delayed doubling |

Source identity: base `6fabe6aa627845a8521049ea217faf9f9cc54826`, frozen tree
`c4fa1d22163a3b0ebd00e5107ddef4a4b76fed00c0d8a3e36a5fbe8671ae96c5`,
2,603 tracked/nonignored files. Private reports, original failed rendering check,
repaired runtime, HTML and proof manifest live outside Git under
`20261024-ix-spice-cards/`. The initial rendering check incorrectly expected text
inside the default-collapsed chronicle. Only that private assertion changed to
check the public projected log; runtime alone reran on the identical source.
The final aggregate retains the original passing tests/types/lint/build with
their logs and links the repaired runtime explicitly. Subsequent checkpoint
prose/reference changes are separately reviewed; runtime source stays frozen.

These source programmes do not certify native Ixian/Tleilaxu decisions, all
phase-opening priorities, optional-module combinations, full modes, save/recovery
assurance, browser visuals or deployed acceptance. Those requirements remain due.

## Historical prototype — 13 September 2026

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
