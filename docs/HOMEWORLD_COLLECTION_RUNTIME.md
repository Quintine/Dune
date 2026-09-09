# Giedi collection and low Grumman entry

This checkpoint connects two population effects. The complete Homeworld module,
Moritani faction and expansion starts remain gated. Printed component evidence,
the No-Field composition and Grumman's unresolved removal destination are in
[the source audit](HOMEWORLD_COLLECTION_RULES.md). The broader integration map is
in [the collection audit](HOMEWORLD_COLLECTION_INTEGRATION.md).

## Automatic Giedi Prime income

`board-resolution-quote.ts` separates actual desert collection from other map
deposits and stronghold income. The engine first commits ordinary balances,
then quotes Giedi's two bank spice using current physical native population.
Seven native reserves qualify in both Basic and Advanced. Multiple deposits
earn two total; technology and stronghold income do not qualify.

Ecaz joint desert lots remain escrow until their allocation settles. A positive
Harkonnen allocation can earn the first Giedi bonus; a zero allocation cannot.
An earlier ordinary desert bonus prevents another payment after shared income.
Canceling Ecaz's ordinary stronghold Collection advantage does not cancel Giedi.
Homeworld occupation income remains unfinished and has no new producer here.

`giedi-collection.ts` records turn, owner, cumulative actual qualifying income
and whether the bank bonus was paid. A canonical signature detects inconsistent
saved receipt fields at action, view and normalization boundaries. The receipt
is completed evidence, never a command to pay on read. Older saves without the
whole receipt remain compatible: they receive no reconstructed or retrospective
award. A newly settled positive share can still qualify. Whole-receipt absence
cannot be distinguished from legacy state and is not a claimed corruption check.

The public chronicle explains the automatic two-spice payment and supplies the
existing optional faction animation event. There is no new confirmation or AI
decision. Private balance and hand visibility remain unchanged.

## Low Grumman

The shared entry restriction checks fewer than eight native reserves and an
original entering group smaller than three. Physical special counters count
once; entering advisors count; existing destination forces do not. A concealed
No-Field counts as one independently of its private value. Two physical forces
and that marker in the same admitted movement form a group of three.

The restriction applies before competing reactions are declared and again at
actual entry, revelation and an alliance offer whose refusal requires Terror.
Ordinary movement, shipments, advisor arrivals and Ambassador continuations use
the same predicate. Guild and Fremen Ambassador choices project a maximum of
two where larger groups would require unresolved simultaneous Intrusion/Terror
ordering. Their controls and all four bot policies honor that limit.

The original public entry facts are bound to a canonical saved signature;
mutable resolution stages do not change the original count. The binding also
covers suspended Terror discard continuations. Current population can change
the low restriction, while the saved entering group cannot be rewritten.
Missing signatures remain legacy-compatible; present inconsistent signatures
must reject rather than repair the entry from current board forces.

High Grumman's optional Collection token change and four-spice payment remain
unfinished. No stacked-token or removal-destination interpretation is enabled
by these changes. The question about unrevealed removal custody is pending,
alongside the earlier occupation and low-Junction rounding questions.

## Verification scope

Final `npm run check` passes types, lint and **3,575 offline cases**. The final
production build and **40 HTTP cases** pass. There are 34 new cases: eight pure
quotes, seven Giedi engine cases, four Giedi SQLite cases, twelve Grumman engine
cases and three Grumman SQLite cases. The existing stale-Terror regression now
checks both signed receipts and legacy unsigned saves. Final check evidence is
in `/tmp/dune-collection-verified-check.log`, with build and HTTP evidence in
`/tmp/dune-collection-final-build.log` and `/tmp/dune-collection-final-http.log`.

The pure, engine and production SQLite suites cover population thresholds,
actual receipt provenance, shared allocations, rejection immutability,
simultaneous submissions, private projection and JSON/database restoration.
Grumman regression cases cover original entry counts, concealed marker equality,
advisors, elite counters, competing reactions and all four Ambassador bot levels.
These subsystem checks do not certify complete games with the module.

A three-seat browser table collected seven desert spice and automatically added
two bank spice, reaching Harkonnen's balance of 29 from 20. Keyboard completion,
three-seat refresh, private balances and desktop/390-pixel phone layouts passed.
Both chronicle screenshots were visually inspected. The initial capture waited
for chronicle text while the hand tab was selected; opening the chronicle fixed
the test harness, with no repeated gameplay action or application change.

The controlled development-server restart preserved all 2,958 existing room
versions and state hashes. Three saved payment-test seats reconnected at their
original version and balances without browser errors. The new collection QA
room and HTTP test rooms are additive. No saved game was reset, and no recurring
automation was installed.

At the end of verification, the database contains 3,019 rooms: the 2,958 unchanged
baseline rooms, one new collection browser table and 60 rooms from the two HTTP
runs. The collection table remains at version four with one completed bonus
record. Private saved-seat files and the database backup remain local temporary
artifacts and are not included in version control.
