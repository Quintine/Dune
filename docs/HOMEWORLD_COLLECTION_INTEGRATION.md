# Homeworld Collection and Terror integration audit

This is a read-only code audit and proposed integration boundary. The current
source audit determines the precise Grumman and Giedi Prime wording, action
ordering and unresolved combinations. Existing source contracts are in
[Homeworld rules](HOMEWORLD_RULES.md),
[Moritani Terror rules](MORITANI_TERROR_RULES.md) and
[Ecaz Collection implementation](ECAZ_COLLECTION_IMPLEMENTATION.md).
No faction or expansion completion is implied.

## Concrete hazards in the current implementation

1. `engine.ts::openTerrorEntry` uses `.find` for the first placed token at the
   destination and saves that single identity. Permitting Grumman stacks without
   changing entry selection silently chooses a secret effect by array order.
   The present view, `decideTerror`, bots and Terror reaction component all
   operate on one token. Source verification must settle whether one or several
   tokens may resolve for an entry and who chooses their order.
2. `moritani-terror.ts::placeTerror` rejects a destination already containing a
   token and consumes `placementTurn`. That is the ordinary Mentat opportunity,
   not a reusable Grumman Collection action. Reusing it either prevents stacking
   or consumes the wrong phase's allowance. Its engine action also opens an
   ordinary Karama response; Homeworld effects must not inherit that response.
3. A removed token's destination matters. `revealTerror` exposes its face and
   removes it from play; `returnTerror` returns it to supply and rotates available
   identities using private randomness. Neither is an automatic interpretation
   of Grumman's removal wording. Reusing the wrong function can reveal a hidden
   face, create a replacement token or permanently lose a recoverable token.
4. `CollectionQuote.receipts[].collected` omits Ecaz shared desert escrow until
   allocation. Harkonnen may be the ally. Awarding Giedi only from the initial
   receipt misses later qualifying income; awarding it just because a shared
   lot exists may pay even when Harkonnen eventually receives zero.
5. `collect` only gets an `ecazCollection` completion marker when an Ecaz bonus,
   shared allocation or same-turn frame exists. A Homeworld once-per-Collection
   award needs its own durable receipt even in a game with no Ecaz. Reads and
   normalization must not infer a fresh award from current board presence.
6. Low Grumman must feed both actual entry/reveal legality and earlier competing
   reaction checks. Adding only a guard to `openTerrorEntry` leaves less-than-three
   entries incorrectly rejected by preflight checks that see any placed Terror.
7. Existing Terror guidance permits even zero No-Field placement to trigger.
   The subsequent source audit confirms the public marker counts as one force:
   low Grumman therefore suppresses a marker-only entry, independently of its
   hidden value; a marker plus two admitted physical forces reaches three.
   A public window must never depend on the concealed denomination.

## Arrival contract and consumers

`openTerrorEntry` is called only after entry is committed. It stores entrant,
destination, sector, `amount`, `elite`, cause, turn, phase and a continuation
for worm rides or Ambassadors. Existing callers pass total physical arrivals as
`amount`; `elite` is a subset, not an additional count. Existing forces already
at the destination must not contribute to the entering threshold. BG advisors
are physical arrivals and already qualify under ordinary Terror guidance;
ordinary one-advisor and Wallach two-advisor batches remain below three.

The smallest shared public eligibility quote should consume native Grumman
effect state, owner/entrant/ally identities, original entry cause and a verified
entering count. It should return an explicit trigger/reveal block without
reading token kinds, hands or private resources. Keep physical population and
retained occupation effects separated as described in the
[occupation integration audit](HOMEWORLD_OCCUPATION_INTEGRATION.md).

Use the same quote in these adapters:

- `openTerritoryEntry`, `openTerrorEntry` and `terrorRevealBlocked`.
- The competing-reaction checks in `guildAdvisorAmbassador` and the Ambassador
  relocation path, plus the engine's movement board supplied Terror list.
- Guild Ambassador shipment and advisor continuations, Fremen Ambassador
  relocation, normal/Guild shipment, ordinary movement and worm-ride entry.
- Saved Terror alliance and discard continuations, including `terrorAllianceBlocked`:
  refusal requires revelation, so an unavailable revelation cannot be bypassed
  by offering Enemy of My Enemy first.

A quote for stacked entries must return owner-selectable physical token IDs;
public observers should learn only the same entry/location/stage information
they already receive. Preserve a chosen token's identity through alliance reply,
discard continuation and random resolution. Never reroll or reselect on reload.
Keep unresolved token effects gated even when another token in the stack is
implemented. Exact multiple-token sequencing awaits source confirmation.

## Collection pipeline and source provenance

`board-resolution-quote.ts::quoteSpiceCollection` settles advisor stances,
calculates collection capacity, removes map deposits and returns independent
stronghold income, ordinary collected amounts and Ecaz shared lots.
`engine.ts::collect` may first open the Ecaz ordinary-advantage Karama window;
`commitCollection` then applies receipts and starts shared allocation.
`decideSharedSpice` credits each resolved lot and marks that frame complete.
`nextPhase` invokes collection on entering phase 7 and opens ordinary Terror
placement separately on entering Mentat phase 8.

Keep Homeworld additions out of `quoteSpiceCollection`'s resource mutation until
its existing result has been committed. Otherwise `commitCollection` assigning
each `receipt.balance` can overwrite a Homeworld credit made earlier. A helper
that awards during view or re-quote also duplicates payment when Ecaz's canceled
quote is recomputed. Existing `collectionBoardSignature` intentionally excludes
private balances and native reserve counts; it is not an original Homeworld
eligibility receipt.

Giedi needs qualifying collection provenance, not a balance difference. Ordinary
stronghold bank income, poison/technology payments, bribe returns and unrelated
Collection effects must not qualify by accident. Current `collected` merges all
map deposits without a terrain tag. A minimal extension is committed source
receipts of the form `{player, source, amount}`, with `source` distinguishing
desert collection, Homeworld collection and other income. Shared allocation
must add receipts for its actual recipients, including zero where needed for
auditing, rather than redistributing the original bank or ordinary income.
Homeworld occupation Collection itself remains separate unfinished work.

A pure Giedi quote can take public native-effect context plus a validated
qualifying amount and an existing event receipt, and return either zero or the
printed bank bonus. A general resource quote must not inspect another player's
private balance to decide eligibility. Current-versus-captured native eligibility
and whether qualifying shared participation requires a positive allocation must
follow the source audit rather than an incidental hook position.

## Smallest coherent Grumman contract

Use a separate `HomeworldCollection` event with turn, owner, stage and completed
receipt; do not overload `TerrorState.placementTurn` or `ecazCollection`. It must
coordinate with the existing Ecaz decision so neither overwrites the other.
The source audit determines the permitted phase ordering; a continuation can
open the next authorized opportunity only after the active one settles.

A focused pure quote should validate a discriminated action: decline, add an
owned eligible physical token to a qualifying already-marked stronghold, or
remove a selected placed token. It should return the precise custody change and
bank payment without mutating state. Validate native high eligibility, original
event, legal destination, unique token identity and prior completion. The
source must determine whether payment requires completing one operation and
where a removed token goes; the contract must represent those decisions
explicitly. Preserve Mentat placement independently.

Project own choices from the same quote for a new Collection component and bot
decision branch. The existing `MoritaniPlacementDecision` component and
`bots.ts` placement branch intentionally seek empty strongholds, so they are
inappropriate for stack destinations. All four bot levels need a legal action
or decline path. Observers see public stack count/location and completed bank
income, while available hidden token faces stay owner-only. If a hidden token
returns to supply, preserve the identity-rotation protection before reuse.

## Focused verification before enabling the paths

- Entry batches of two and three, elites counted once, existing destination
  forces excluded, advisors included, module off and native high/low crossings.
- Low eligibility in both preflight and actual continuation; immutable rejected
  actions and no paid entry replay through Ambassador, alliance or discard.
- Stack selection with two different physical token IDs; concealed observer
  equivalence; chosen identity retained through JSON and SQL recovery.
- Collection add/remove/decline preserves six-token custody, independently of
  the same turn's Mentat placement; no duplicate bank payment on retry/read.
- Giedi: zero collection, stronghold-only income, positive desert income, several
  qualifying locations, and shared Ecaz allocation of zero versus positive
  spice under the verified qualification rule; award at most once per event.
- Ecaz ordinary Collection cancellation does not cancel a Homeworld effect;
  pending allocation and Grumman choice preserve their own original receipts.
- Source-confirmed No-Field and occupation cases, with explicit release gates
  where those compositions remain unresolved.

The audit itself makes no engine changes. A subsequent isolated implementation
adds `game/homeworld-collection.ts::quoteGiediCollectionBonus` and
`lowGrummanRevealBlock`, with eight passing pure regressions in
`tests/homeworld-collection.test.ts`. They use current physical population and
validated actual source/count inputs; event timing, No-Field composition,
occupation and high Grumman token operations remain outside those helpers.
Focused lint, code references and local documentation links were checked.

The low Grumman engine integration now shares that block across movement and
Ambassador preflight, entry opening, reveal and alliance availability. Narrow
Ambassador destinations where one or two forces avoid a currently unsupported
simultaneous Intrusion/Terror reaction expose a maximum of two, used by the UI
and all four bot levels. High and module-off paths retain their prior behavior.

New entries carry `entrySignature`, a consistency receipt binding the original
public count, token, entrant, location, cause, turn and continuation identity.
View, action and normalization validate both live entries and suspended Terror
discard entries. Alliance cancellation preserves the receipt. Older saved
entries without a signature remain an explicit compatibility boundary; nothing
reconstructs their original count from present forces. Current Grumman population
is still rechecked independently of the immutable arrival.

Twelve new engine regressions cover typed counts, advisor arrivals, identical
observer views for concealed zero/three/five markers, marker-plus-two movement,
count-dependent Ambassador legality, all four bots, actual Karama cancellation,
and corrupt live/suspended receipts. The related 19-file run passed 281 tests.
These results do not implement high Grumman stacking/removal or occupation.
