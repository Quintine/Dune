# Expansion-faction development profile

13 September 2026. This checkpoint connects genuine setup for any nonempty
selection of the Ixians & Tleilaxu, CHOAM & Richese, and Ecaz & Moritani
expansions. It is a local development profile for faction play. Optional
variants, normal public expansion starts, and publication remain gated.

## Source and deck boundary

The source audit used the archived publisher-authored rulebooks at
`/home/quintine/.local/share/dune/sources/ecaz-moritani.pdf` and
`/home/quintine/.local/share/dune/sources/choam-richese-rulebook-en.pdf`, with
their extracted text. A targeted official web check reproduced the CHOAM &
Richese component text from GF9's index. The current Ecaz & Moritani PDF URL
returned HTTP 403, so the findings below use the archived publisher file and
retain its public URL rather than claiming a fresh download. No publisher or
designer clarification of Ecaz's starting-sector allocation was found in the
bounded follow-up search.

The Ecaz & Moritani rulebook calls Homeworlds, Nexus Cards, New Treachery
Cards, and Discovery Tokens variants that may be added together or separately,
regardless of the factions selected. Choosing Ecaz or Moritani therefore does
not add Recruits, Reinforcements, or Harass & Withdraw. Those three cards remain
an independent, unimplemented variant. [GF9 Ecaz & Moritani, printed
pp. 4, 9, 11](https://www.gf9games.com/dune/wp-content/uploads/EcazMoritani-Rulebook-LOWRES.pdf#page=9)

The CHOAM & Richese rulebook says its Poison Tooth and Artillery Strike replace
the versions from Ixians & Tleilaxu, or are added when that expansion is absent.
Its two updated Karama cards replace the two core cards. These are physical
replacements, so they do not duplicate identities or increase the combined Ix
deck. [GF9 CHOAM & Richese, printed
p. 4](https://www.gf9games.com/dune/wp-content/uploads/2021/11/CHOAM-Rulebook-low-res.pdf#page=4)

| Selected expansion sets | Ordinary Treachery Deck |
| --- | ---: |
| Ecaz & Moritani only | 33 |
| CHOAM & Richese only | 35 |
| Ixians & Tleilaxu only | 47 |
| Ixians & Tleilaxu plus either or both later sets | 47 |
| CHOAM & Richese plus Ecaz & Moritani, without Ix | 35 |

Richese's ten technology cards form a separate faction cache and do not count
toward the ordinary deck or the Richese hand at setup. When Richese is seated,
the setup creates that cache and its three concealed No-Field tokens with
values zero, three, and five. [GF9 CHOAM & Richese, printed
pp. 5–6](https://www.gf9games.com/dune/wp-content/uploads/2021/11/CHOAM-Rulebook-low-res.pdf#page=5)

The ordinary Spice Deck gains Sandtrout when Ixians & Tleilaxu is selected.
The seven Ecaz & Moritani Spice Cards belong to the separate Discovery Tokens
variant and are absent from this profile.

## Connected setup

`initializeFactionExpansionsGameForAudit` accepts an already constructed Basic
or Advanced lobby, two through six distinct ready players, and any roster whose
faction sets are among the selected nonempty expansion list. It uses the shared
prediction, traitor, force-placement, starting-card, and first-Storm pipeline.
It rejects an already dealt or modified lobby and does not add optional modules.
The ordinary browser lobby still creates Basic games only; Advanced profile
setup is currently an offline development/test path rather than a visible mode
selection.

Faction-specific setup uses the existing physical inventories and decisions:

- Ixians place three cyborgs and three suboids in the unplaced Hidden Mobile
  Stronghold, then make their private starting-card choice. Tleilaxu receives
  three Face Dancers after the other factions finish traitor selection.
- Advanced CHOAM receives the additional Auditor disc before traitors are
  dealt. Richese receives its separate cache and concealed No-Field inventory.
- Ecaz receives its Ecaz Ambassador plus five random non-Ecaz Ambassadors and
  allocates six starting forces among the three printed sectors of Imperial
  Basin, leaving fourteen in reserve. The printed constraint specifies the
  territory and total, without a one-stack restriction or a separate setup
  sector procedure. The prototype therefore accepts any nonnegative allocation
  totaling six within sectors 9, 10, and 11. This is the implementation's
  literal territory-level reading, not a separate publisher ruling about
  sector allocation; a targeted publisher/designer search found no more
  specific clarification.
- Moritani receives six concealed Terror tokens and places six forces in an
  unoccupied territory after every other faction completes setup, leaving
  fourteen in reserve. Ecaz or Moritani also creates the one shared Duke Vidal
  disc. Moritani-last is explicit on printed p. 5. The Ecaz setup on printed
  p. 7 states its location and inventory but no relative priority. The
  Fremen–Ecaz–Advanced-Bene-Gesserit order is therefore engine sequencing
  needed to resolve those choices, not a claimed publisher priority among the
  three factions.

These setup values come from the faction sections of the
[GF9 Ecaz & Moritani rulebook, printed pp. 5 and
7](https://www.gf9games.com/dune/wp-content/uploads/EcazMoritani-Rulebook-LOWRES.pdf#page=5)
and the [GF9 CHOAM & Richese rulebook, printed pp. 5 and
7](https://www.gf9games.com/dune/wp-content/uploads/2021/11/CHOAM-Rulebook-low-res.pdf#page=5).
The earlier [Ix prototype](IX_PROTOTYPE.md) records its setup and 47-card
inventory evidence.

## Start a local faction prototype

Create a new local Basic room with the intended expansion sets and factions,
then mark every seat ready. Preserve the room cookie and current lobby version.
Start only that fresh lobby with:

```sh
node --import tsx tools/start-prototype.ts \
  --profile factions \
  --db PATH_TO_LOCAL_D1_SQLITE \
  --room EIGHT_CHARACTER_CODE \
  --version CURRENT_LOBBY_VERSION \
  --out /private/new-prototype-checkpoint
```

The output directory must be new and outside the repository. The tool first
backs up all saved rooms, then uses an atomic state-and-version comparison to
write the selected lobby. It preserves sessions, recovery records, other rooms,
and the public start gate. Refresh the existing invitation to continue through
the ordinary private setup controls. Reusing the command on the started game is
rejected.

## Known incomplete play

This entry point makes the faction setup real and reviewable; it does not mark
the expansion rules complete. The three optional Ecaz Treachery Cards have
metadata and source guides but no runtime. Richese's cache and auction lifecycle
are present, but cache custody does not establish complete runtime or combined
interaction coverage for every technology card. Ecaz, Moritani, CHOAM, Richese,
Ixian, and Tleilaxu powers retain narrower supported and pending contracts in
the current in-game reference and their feature documents. In particular, see
the [Ecaz Treachery audit](ECAZ_TREACHERY_RULES.md),
[Ecaz Ambassadors](ECAZ_AMBASSADORS_RULES.md),
[Moritani Terror](MORITANI_TERROR_RULES.md),
[Richese implementation plan](RICHESE_IMPLEMENTATION_PLAN.md),
[CHOAM remaining rules](CHOAM_REMAINING_RULES.md), and
[Ix prototype](IX_PROTOTYPE.md). Those records and later feature-specific
runtime documents govern over older inventory snapshots. When an earlier
source/readiness audit says that a component or action was absent, the later
dated runtime document overrides that historical statement only for the slice
it actually connects.

Advanced Ixian Technology on a Richese cache or Black Market lot has a specific
combined-source gap: the rules do not assign the substituted card's seller,
sale income, or zero-bid destination. The development profile therefore does
not implement that exchange. A valid Richese cache or Black Market declaration
first creates a saved `ixRicheseTechnology` decision for Ixians, before the lot
opens, bidding begins, or Atreides receives an inspection. The only supported
answer is an explicit `decline: true` with the exact current event. It then
opens the originally declared lot without using Technology, moving either card,
or marking the once-per-turn power used. Technology remains available for a
later Richese or supported normal lot. The saved declaration binds the round,
turn, source, card custody, auction method and any direction or claim; public
views do not expose a concealed Black Market card through this pause.

This continuation prevents the known combined-game deadlock while preserving
the unresolved exchange. It is not a ruling that Technology cannot affect a
Richese lot, and it does not establish substitute ownership, sale income or
zero-bid custody. See the [Richese auction contract](RICHESE_AUCTION_RULES.md).

No Homeworld, Nexus, Leader Skill, Discovery, Tech Token, or Advanced
Stronghold Card state is admitted by this profile. Selecting expansion factions
does not imply any of those modules, and this checkpoint supplies no evidence
for their combinations.

`tests/expansion-factions-prototype.test.ts` covers every nonempty expansion
selection in Basic and Advanced at all four AI profiles, two-through-six-player
rosters, private views, deck and component custody, JSON continuation, stale
actions, and dirty lobby rejection. It includes a direct 2/2/2 Ecaz allocation,
the Fremen–Ecaz–Advanced-Bene-Gesserit sequence, Moritani's final placement,
and rejection of missing or forged placement state.

`tests/ecaz-setup-controls.test.tsx` checks the human allocation control and
bot path. `tests/expansion-factions-recovery.test.ts` exercises the mixed
six-faction setup through the migrated SQLite room API across reloads, plus
optimistic concurrency, unrelated room/session preservation, and repeated-start
rejection. The focused union reported 74 passing tests and typecheck passed;
the final checkpoint report records the required broad checks. Browser setup
and refresh restored the owned Ecaz allocation and private cards. This bounded setup evidence establishes a development path, not
complete games with every printed effect or public mode acceptance.

## Integrated sample games and browser evidence

The following historical `cab2f1c` samples predate the
[deferred movement repair](DEFERRED_MOVEMENT_ARRIVAL.md). New source-bound
samples use [the reusable harness](VERIFICATION_WORKFLOW.md#reusable-base-and-faction-sample-games).

Six deterministic samples used genuine faction setup, all four AI levels,
unchanged physical inventories and JSON continuations every 37 accepted actions.
No pieces were staged or phases skipped in these samples.

| Profile | Accepted actions | JSON continuations | Result notes |
| --- | ---: | ---: | --- |
| CHOAM & Richese, Basic | 1,054 | 28 | Finished at turn ten with no rejected candidates. |
| CHOAM & Richese, Advanced | 225 | 6 | Finished at turn two with no rejected candidates. |
| Ecaz & Moritani, Basic | 91 | 2 | Finished at turn one after four guarded Ambassador candidates were rejected and legal alternatives were used. |
| Ecaz & Moritani, Advanced | 523 | 14 | Finished at turn five after 32 guarded arrival candidates were rejected and legal alternatives were used. |
| All three expansion sets, Basic | 476 | 12 | Finished at turn two with no rejected candidates. |
| All three expansion sets, Advanced | 614 | 16 | Stopped at turn three on an existing CHOAM movement/Ambassador arrival guard. |

The first combined Advanced run stopped at action 70 on the old Ixian/Richese
special-lot guard. With the decline continuation, the same seed declined three
Richese lots and reached eleven ordinary Technology decisions before the separate
arrival stop. This is evidence of the connected auction path, not a completed
combined Advanced game. The current movement stop and rejected arrival candidates
remain integration work; public modes stay gated.

An initial CHOAM Basic custody audit mistakenly counted the already sold current
normal-auction card both in its winner's hand and in its sale receipt. Correcting
that private harness alias accounting allowed the full sample to run. The first
failure logs were retained; production card ownership was not changed to fit the
harness.

Browser room `WEBF27AU` used genuine six-expansion-faction setup. The human Ecaz
seat chose its private traitor, saw an incomplete four-force allocation rejected,
submitted two forces in each Imperial Basin sector, and refreshed to fourteen
reserves, twelve spice, its dealt Crysknife and unchanged traitor at opening Storm.
Ixian private dealing and Moritani's final placement completed in the same game.

A separate fresh browser lobby `BMHNSASJ` was configured for Advanced by the local
QA helper before genuine initialization. Thirty-seven accepted bot-selected
setup and phase actions reached the Ixian cache-offer decision; no pieces were
staged and no phases skipped. Refresh restored the human Ixian choice, clicking
its explicit decline opened the unchanged Ornithopter Once Around lot, and another
refresh retained the legal bid controls, private Harvester and traitor. The saved
hand, spice, offered card, ordinary pool count and unused Technology all matched
the pending-offer snapshot. This developer configuration does not add a public
Advanced lobby selector.

The outage recovery audit preserved all 597 opening rooms and their seat/recovery
records. A stale development-server module cache caused room requests to fail
although the home page responded. A fresh 598-room backup preceded a necessary
restart; all 598 rooms matched immediately afterward and the private QA seat
restored. No database reset or recurring maintenance automation was used. Final
room totals, required checks and source identity are recorded in the checkpoint
commit and private reports under
`/home/quintine/.local/share/dune/checkpoints/20260913-expansion-factions/`.
