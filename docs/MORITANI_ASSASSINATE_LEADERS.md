# Moritani: Advanced Assassinate Leaders preview

14 September 2026. **Prototyped / Partial**, in an explicitly opted-in local
preview. Normal game-start and publication gates remain closed. This is the
battle-loss ability, separate from the random Assassination Terror token.

## Authority and Advanced duration cutover

The [GF9 Ecaz & Moritani rulebook](https://www.gf9games.com/dune/wp-content/uploads/EcazMoritani-Rulebook-LOWRES.pdf),
pp. 6, 14 and 16, supplies the ability, captured-own-leader answer and Karama table.
The historical publisher review found no official duration clarification.
The user-authorized revised Advanced PDF now supplies an explicit game-long
condition, recorded below. The runtime retains the following sequence:

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

**Authorized Advanced cutover — 2 October 2026:** the supplied
`UNOFFICIAL_Revised_Dune_Rulebook_v.2.3_web.pdf`, physical p35 / logical p33,
Assassinate Leaders D condition(d), says Moritani must **“not yet [have]
revealed your Traitor Card normally this game.”** A normal own-card reveal
therefore forfeits the advantage for the rest of this game, across later turns
and all opposing factions. The existing persisted normal-call flag already
enforced this scope; owner guidance and public reveal history now describe
the sourced forfeiture rather than an unresolved-duration guard.

This resolves the old duration question under the authorized Advanced source,
not as a newly located GF9 erratum. Basic, exceptional leader interactions and
the independent private-step UX/public-preview gates remain unchanged. See
[source identity and precedence](RULE_DECISIONS.md#authorized-source-amendment--1-october-2026).

The captured-own-leader answer preserves original faction identity: a Moritani
leader used by Harkonnen does not become a Harkonnen-faction assassination card.
It does not define every other captured or foreign-ghola target interaction.

## Connected scope and private information

The preview supports native Moritani with Atreides, Bene Gesserit, Emperor,
Fremen and Guild opponents, Advanced rules and the Ecaz faction expansion, without
optional modules. Harkonnen presence is excluded uniformly from public configuration
so candidate availability cannot reveal secret captures. Other expansion factions,
Nexus, Stronghold Cards, Homeworlds, Discoveries and other faction combinations
retain their separate integration boundaries. The
[bounded all14 native skill composition](MORITANI_LEADER_SKILLS.md#advanced-assassination-composition--4-october-2026)
now extends this same non-Harkonnen roster without opening public starts.
Winner Suk rescue and Rihani choice finish first; the unspent assassination
receipt waits, then opens its original private choice. Already completed
casualties cannot replay after reveal/decline. A different eligible trained
disc returns its physical skill once; printed bounty and original Mentat
replacement remain. This scope is not a printed restriction on other combinations.

**7 October 2026 — original paired native Nexus composition:** the exact
Ecaz/Moritani/classic profiles, without Skills or with all14 and original
optional modules, now admit **Ecaz as an opposing printed faction**.
The classic-only trigger/receipt list was a software scope limit, not
a printed prohibition. Two real original native Ecaz battle losses reject
before, then reveal a different actual held Ecaz card, kill its original
disc for printed bounty and replace it once at Mentat after the shared list
gains Ecaz. Winning-disc exclusion, game-long normal-call forfeiture,
shared/captured/Ghola and Advanced Harkonnen guards remain. A foreign
Homeworld's normal Traitor prohibition does not prohibit this distinct
native ability. The no-Skills receipt retains its earlier pause before
winner casualties; all14 retains its skill-first pause afterward.
[Canonical programme, game and human qualifications](NEXUS_CARD_RULES.md#mixed-e1e2-and-paired-e3-nexus--7-october-2026).

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

The Mentat replacement now draws the first **distinct** physical Traitor Card in
the reserve rather than the reserve's first entry: the set-aside card can still
sit in that list, and re-drawing it would duplicate a card instead of replacing
it. When no distinct card remains, the replacement is blocked with an explicit
reason instead of committing an invalid receipt. (7 October 2026)
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

## 29 September 2026 — five-roster game continuation

The reusable [faction-game runner](VERIFICATION_WORKFLOW.md#reusable-base-and-faction-sample-games)
now exercises this exact gated Advanced preview from two through six seats
with Moritani and only the supported classic opponents except Harkonnen.
Five games at seed `20260929` completed in 2,511 accepted actions, with
zero rejected candidates and 65 JSON continuations. The six-seat game
opened two genuine private assassination decisions; both were declined.
The existing staged battle/replacement cases and the external physical
custody check cover the actual reveal, retirement and new-card draw, but
the natural full-game samples do **not** demonstrate a reveal. The source
boundaries and pending user timing/UX questions above remain unchanged.

## 29 September 2026 — natural revealed-card game

An additional unchanged-source six-seat Advanced game using base seed
`20261307` and the existing `moritani-assassinate` profile completed
1,666 accepted actions, zero rejected candidates and 45 JSON view
restores. A genuine turn-six battle loss first produced a private offer
that Moritani declined. A second loss let its Easy bot reveal its
actually held `emperor-1` Traitor Card against a different Emperor leader.
That named leader was already dead, so the legal reveal paid no second
bounty. The physical card remained held at accepted action 987; automatic
Mentat replacement at action 995 set it aside and privately drew
`fremen-4`. A separate Node replay JSON-restored every seat view at
both boundaries; the whole-game runner checked physical custody
after every accepted action through final turn ten.

Source-bound private report:
`/tmp/dune-assassinate-natural-reveal-20261307/report.json`, based on
`583cd97a250bce4b2a9f570bc1e2893e9d49db41`. This establishes one
natural dead-target reveal and replacement, not a natural living-target
kill, full module composition, an official resolution of normal-traitor
duration, or public Advanced Moritani readiness.
