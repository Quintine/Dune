# Truthtrance physical-force facts

Development prototype, 21 September 2026. Structured questions now compare the
respondent's current physical counters in reserves, the Tanks or one exact board
location. This extends the existing fact family; it does not complete arbitrary
prose interpretation, future commitments or all Truthtrance interactions.

## Source and semantics

The November 2020 GF9 FAQ p.8 permits game-related yes/no questions and AND/OR
combinations. The existing [nonbattle source audit](TRUTHTRANCE_NONBATTLE_READINESS_20260907.md)
identifies current force/reserve/Tank counts as answerable facts. This prototype
uses the same current-custody distinction as [personal spice facts](TRUTHTRANCE_SPICE_FACTS.md).
No new faction advantage, hidden-information disclosure or future promise is inferred.

Each physical counter counts once. `total` includes the elite subset; `normal`
subtracts it, and `elite` counts that subset directly. Combat strength, support,
Suboid/Cyborg multipliers and other temporary bonuses do not change these values.
Advisors are physical counters and are included without a separate fighting-state
question. A concealed No-Field is a separate marker; neither its presence nor
its private denomination adds physical counters at the queried location.

Reserves includes the native Homeworld breakdown already represented by the
player's aggregate reserve pool. The Tanks is a separate pool. Board questions
select an exact territory and sector, including an available HMS interior or
revealed Discovery location. They do not aggregate a whole multi-sector territory
or query individual Homeworld populations; those question forms remain separate
work. Changing the HMS pointer does not move the counters inside to the outside
territory.

Basic special-force factions may lack a tracked normal/starred split. Their
aggregate total is answerable; typed comparisons are unavailable rather than
inventing a distribution. Ordinary factions without special counters have zero
elite counters. The same public guard feeds parsing and controls.

## Connected flow and saved behavior

Choose **Current physical forces**, then the pool, optional board location,
counter type, comparison and nonnegative whole threshold. Combine this clause
with another supported fact using AND or OR. The preview names the exact scope;
invalid values or unavailable typed splits disable submission with an explanation.

The authoritative answer uses custody at the answer action. Only the respondent
receives the private expected answer; the final response discloses the aggregate
Yes/No result, without identifying which compound clause matched. Existing legal
AI response paths consume that same private projection. No strategy tuning is added.

New saved fact questions are reparsed before actions and view projection. A
malformed threshold, counter, location or nested clause cannot silently become a
different question after restoration. Historical answers remain observations:
later legal revival or movement does not rewrite them or violate a commitment.
The original interrupted decision resumes after mandatory Truthtrance disposal.

## Verification

```sh
npm test -- truthtrance-force
npm test -- truthtrance
```

Pure comparisons, genuine setup and conserved game scenarios, component
validation, all four legal AI answer paths, malformed saved questions and
authenticated concurrent recovery cover this boundary. Private source-bound
checkpoint reports record final broad checks, browser and preservation results.
Full mode, combination and visual acceptance remain open.

The browser check used genuine Basic Atreides/Emperor setup and relocated only
the two existing Truthtrance Cards for focused testing; forces stayed unchanged.
A negative count disabled submission. A mobile compound question compared twenty
Emperor reserves and zero counters in Carthag sector 11, received the AI's Yes
and resumed Storm after one discard. A separately staged real question asked the
human about ten normal counters in Arrakeen sector 10. Its pending private answer
survived refresh with the saved row unchanged, then published Yes and retired
the second card once. The 390-pixel layout had no horizontal overflow. Existing
screenshot capture failures leave full visual acceptance open.
