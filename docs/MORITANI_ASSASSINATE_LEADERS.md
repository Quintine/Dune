# Moritani: Advanced Assassinate Leaders preview

14 September 2026. **Prototyped / Partial**, in an explicitly opted-in local
preview. Normal game-start and publication gates remain closed. This is the
battle-loss ability, separate from the random Assassination Terror token.

## Authority and unresolved interpretation

The [GF9 Ecaz & Moritani rulebook](https://www.gf9games.com/dune/wp-content/uploads/EcazMoritani-Rulebook-LOWRES.pdf),
pp. 6, 14 and 16, supplies the ability, captured-own-leader answer and Karama table.
Independent source review found no official clarification of the disputed duration
below. The runtime uses the following undisputed sequence:

1. Native Advanced Moritani loses a normal battle against a surviving opposing
   leader disc, with no traitor called.
2. Moritani may reveal a held Traitor Card of the opposing player's printed
   faction, naming a different leader from the disc just opposed.
3. A living named leader goes to the Tanks and pays its printed strength from
   the Bank. An already-dead named leader remains a legal reveal: no repeated
   death or spice, but the faction use and replacement still occur.
4. Keep the revealed physical card through battle cleanup. During Mentat Pause,
   set it aside face up as that faction's permanent use marker and draw one
   private physical replacement. Use the advantage once per opposing faction.
   Karama has no effect on this ability.

The printed statement that a normal traitor reveal loses this advantage does not
specify a battle, faction or game duration. The prototype records the normal call
and explicitly guards further use; it does not label that guard as a settled
permanent forfeiture. The user has been asked whether to keep that interaction
gated or choose a duration. Previously normally revealed cards and exceptional
leader custody also remain outside this first runtime contract.

The captured-own-leader answer preserves original faction identity: a Moritani
leader used by Harkonnen does not become a Harkonnen-faction assassination card.
It does not define every other captured or foreign-ghola target interaction.

## Connected scope and private information

The preview supports native Moritani with Atreides, Bene Gesserit, Emperor,
Fremen and Guild opponents, Advanced rules and the Ecaz faction expansion, without
optional modules. Harkonnen presence is excluded uniformly from public configuration
so candidate availability cannot reveal secret captures. Other expansion factions,
Nexus, Leader Skills, Stronghold Cards, Homeworlds and Discoveries require further
custody, ordering and integration work. A first-version scope is not a printed
restriction on those combinations.

Every publicly qualifying loss gets the same private reveal-or-continue opportunity,
regardless of the hidden eligible card. Only Moritani sees its candidate identities
and blocked reason; rivals see the same decision and no private options. This
requires Continue even for an ineligible hand, conflicting with the user's usual
automatic-action preference. A uniform-private-step UX question is pending, shared
with Mentat. Until resolved, activation requires an explicit development preview;
no ordinary action or room API enables it. A publicly spent faction or prior
normal traitor call can be skipped without consulting hidden eligibility.

All four AI profiles use the same owner-only quote. They choose a legal card or
decline and do not inspect rival hidden state. The public history shows only
revealed cards and face-up set-aside markers; replacement identities remain private.
Dead-target inspection retains the printed leader strength despite its zero bounty.

## Save and physical custody

The resolved battle binds the opportunity's event, opposing faction and surviving
leader. Its saved continuation is also bound to a separate battle obligation before
the decision opens. Reveal/decline resumes that exact cleanup once. A normal
traitor call has a separate event ledger; its explanatory log waits until the
normal public reveal, preserving sealed submissions.

A physical Traitor Card belongs to one of three zones: reserve deck, player hands,
or this ability's public set-aside markers. Revealed cards stay held until Mentat;
retired cards never return to the deck in this profile. A replacement remains with
Moritani or becomes the card consumed by a later-turn assassination against another
faction. Cross-zone duplication, missing replacements, duplicate draws, forged
same-turn chains and altered continuation receipts fail validation.

Replacement runs automatically when Mentat begins. In this bounded profile it does
not compete with other traitor draws, and Terror placement does not alter traitor
custody. Ordering with Face Dancers, Nexus/Rihani draws, Extortion and other modules
remains an explicit integration boundary, not an inferred universal ordering.

## Reproduction and evidence

Use the existing private backup/CAS workflow with a fresh ready lobby:

```sh
node --import tsx tools/start-prototype.ts --profile moritani-assassinate --db /absolute/games.sqlite --room ABCDEFGH --version 1 --out /private/new-checkpoint
npm test -- moritani-assassinate prototype-room
```

Rules and engine tests use genuine Advanced setup followed by explicitly staged,
conserved forces and physical traitor swaps. They cover living and dead targets,
no-use paths, all four profiles, private indistinguishability, sealed normal calls,
per-faction limits, a real later-turn replacement chain, rejected-action immutability
and corrupt saves. Authenticated SQLite tests exercise pending restoration,
Truthtrance interruption, competing submissions and the actual Mentat replacement.
The local writer test preserves seats and unrelated rooms and rejects repeat starts.

Independent rules/privacy/persistence review and the 32-case focused union pass:
eight pure quote cases, eleven engine cases, three controls cases, five authenticated
SQLite cases and five prototype-writer cases (one added for this profile).

Two genuine Advanced four-player samples, with all four AI profiles rotated, finish
in 296 and 101 accepted actions with no rejected candidates. Neither sample stages
hands, decks, forces or phases. Ten periodic JSON rounds and all eight final seat
views restore; physical Treachery, Traitor, force and elite custody hold throughout.
The first game offers two assassination opportunities, both declined; the second
offers none. These samples prove continuation, not natural reveal/replacement use.

A separate browser exercise starts from genuine setup with explicitly staged,
conserved battle forces and one physical traitor swap. Real battle actions produce
the pending choice. Revealing Master Bewt kills that live leader and pays three
spice once; the card stays held until automatic Mentat replacement, then becomes
a public set-aside marker. Pending and resolved refresh preserve the human seat.
Choice and retired-card inspectors show readable, context-correct guidance. Exact
card/force custody and private projections pass; Guild separately collects two
spice from Arrakeen. The game remains saved at human Terror placement.

All 801 opening games remain unchanged after the reported power failure. The healthy
server is reused. Broad checks, source fingerprint, final saved-game preservation
and Git delivery are recorded with the checkpoint. Focused and staged evidence
does not certify a complete faction, all combinations or public
Advanced readiness.
