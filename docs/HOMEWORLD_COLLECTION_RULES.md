# Grumman and Giedi Prime: collection and Terror restrictions

Primary-source audit, 9 September 2026. This document supplies a bounded implementation contract, not a runtime checkpoint. Occupation lifecycle and the separate low-Guild contributor-rounding questions remain pending; do not duplicate them.

## Evidence inspected

The original high faces were visually read again from `/tmp/dune-card-economy-homeworlds.jpg`, the 3024×4032 original photograph associated with [BGG image 7767034](https://boardgamegeek.com/image/7767034/dune-ecaz-and-moritani), posted by Jaakko/zaksalo on 2 October 2023. Grumman and Giedi Prime are both legible in its bottom row. The photograph is primary component evidence; the photographer's opinions are not rules authority. The [component audit](HOMEWORLD_COMPONENT_AUDIT.md) records all face provenance.

The low-Grumman face wording comes from the earlier complete reverse-face inspection recorded in that audit. The old reverse-image cache is absent. A fresh attempt to retrieve the original gallery's public RSS returned 403, so no new reverse-image inspection is claimed. Fresh publisher-indexed E3 pages 5, 15 and 16 and E2 page 6 were retrieved successfully; direct opening of the E3 PDF failed. No additional authenticated designer ruling was located in bounded searches.

## Giedi Prime high collection income

The high face requires at least seven native Harkonnen reserves and awards two bank spice when Harkonnen collects spice from desert territories or Homeworlds during that turn's Spice Collection. The E3 FAQ explicitly limits this to **two total**, even when several qualifying collections occur. Ordinary stronghold income is not one of its listed reasons. Homeworld effects resist Karama. [GF9 E3, pp.10,15](https://www.gf9games.com/dune/wp-content/uploads/EcazMoritani-Rulebook-LOWRES.pdf#page=15).

Executable contract:

- Preserve each actual collection receipt's player, turn, phase, source kind and positive amount. A positive desert receipt qualifies; presence in an empty desert or an uncredited collection quote does not.
- For Ecaz/Harkonnen shared desert collection, use Harkonnen's **settled allocation**. A reserved joint pool is not yet its income; a zero share does not qualify. A positive agreed or fallback share retains its desert origin. This composes the card trigger with [Ecaz's allocation rules](ECAZ_COLLECTION_RULES.md), not a dedicated Giedi/Ecaz FAQ example.
- Once the condition is met while the high advantage is available, credit two and retain a once-only turn receipt. Later desert or Homeworld receipts, repeated phase normalization and restored allocation continuations do not pay again.
- Exclude ordinary stronghold bank income, the extra Ecaz stronghold award, technology receipts, sales, charity, revival income, payment income, Grumman's four-spice award, unrelated ally gifts and collection outside the named phase. Having all Tech Tokens count toward victory does not turn their income into desert or Homeworld collection.
- Future occupied-Homeworld bank income needs its actual authorized recipient and original source. Immediate sharing of another occupier's income is not explicitly classified by this card or the retrieved FAQ; preserve provenance and resolve that interaction with occupation rather than silently counting every ally transfer.

Population at an actual qualifying receipt is the continuous-threshold composition used elsewhere in this module. The printed text does not freeze the population at phase start. An eventual low-to-high change after an earlier collection but before the phase ends needs deliberate timing composition; this document does not claim a dedicated retroactive-trigger ruling. Ordinary phase-end settlement can retain qualifying-source evidence without paying twice.

The existing `quoteSpiceCollection` totals map deposits into `receipt.collected`; it does not guarantee every deposited location is a desert. A Giedi consumer must retain/filter each source territory's actual `sand` type, rather than equating the aggregate field with desert income. Commit normal and shared receipts separately, preserving current balances and their existing durable continuations.

## Grumman high Collection opportunity

The inspected high face requires at least eight native Moritani reserves. It offers adding a Terror token to a stronghold already containing one, **or** removing a Terror token from the board during Spice Collection, followed by four bank spice. The payment is tied to the completed token change: declining or having no legal token change supplies no independent four-spice claim.

The singular phase-scoped opportunity supports one selected operation and one award per Collection, using the same ordinary phase grammar as Terrorize's place-or-move opportunity. The card does not contain an explicit repeat count or the word “once”; this is a grammar composition, not a Grumman-specific FAQ quotation. It does not authorize an add/remove loop generating repeated income. Retain a turn/phase completion receipt independent of the ordinary Mentat `placementTurn`.

For addition, select one available physical Terror token and a permitted stronghold already holding a placed token. The card supplies an exception to ordinary Terrorize's empty-destination requirement; it does not authorize a new token, a second ordinary Mentat placement, relocation from another stronghold, Homeworld placement or use of the Hidden Mobile Stronghold. Storm alone does not prevent ordinary Terror placement. [GF9 E3, pp.5,16](https://www.gf9games.com/dune/wp-content/uploads/EcazMoritani-Rulebook-LOWRES.pdf#page=5).

For removal, select one actual placed token. A spent token, the separate Atomics Aftermath marker, an available supply token or a revealed Extortion record is not a Terror token on the board. The face says removal from the board; it does not expressly name its next custody zone. Returning it to hidden supply is a plausible composition, while ordinary **revelation** expressly removes tokens from the game. Do not claim the latter as authority to permanently spend an unrevealed removal, or call `revealTerror` merely to clear its location. The removal destination remains a source boundary for the coordinator; no new question was sent by this audit.

Token change and four-spice credit must be one accepted transaction after checking current high population, valid custody, phase and unused opportunity. Reject before mutation or randomness if any check fails. Preserve the six physical identities and every other placed token. If returning a token to hidden supply is adopted from sufficient authority, use the established identity-rotation contract so a previously known face cannot be followed through a persistent public ID.

Stacking is a genuine new registry condition. Remove only the global one-token-per-location assumption; retain unique physical identity, exactly one location/status per token and valid stronghold locations. Ordinary Mentat placement still requires an empty destination. Never overwrite an existing token merely because both share a location.

## Grumman low entry restriction

The recorded low face, zero through seven native forces, permits Terror revelation only when at least three forces enter its territory. The base Terror rule includes entering advisors and excludes Moritani and its ally. Existing presence is not an arrival. The threshold does not force revelation. [GF9 E3, p.5](https://www.gf9games.com/dune/wp-content/uploads/EcazMoritani-Rulebook-LOWRES.pdf#page=5).

Count the current completed entry group, not the territory's population after arrival. Regular and special counters each count one physical force; do not double Sardaukar, Fedaykin or Cyborg battle strength. Count entering advisors as the ordinary Terror rule explicitly includes them. A legal move combining several sectors into one entering group uses that combined entry count. Separate shipment, movement and accompanying-advisor events do not accumulate toward three; stationary allied forces do not enlarge another faction's incoming group.

A concealed No-Field counts as one force regardless of its private 0/3/5 value. The ordinary Terror FAQ identifies its placement as an entry, including zero; it does not waive Grumman's additional low restriction. Thus a lone concealed marker fails three, while a legally admitted single move of two physical newcomers plus that marker reaches three. Do not read its secret value or force a reveal to compute eligibility. Revealing an already-present No-Field and Face Dancer replacement are not new Terror entries. This combines the ordinary marker-presence rule with the Homeworld restriction. [GF9 E2, p.6](https://www.gf9games.com/dune/wp-content/uploads/2021/11/CHOAM-Rulebook-low-res.pdf#page=6), [GF9 E3, p.14](https://www.gf9games.com/dune/wp-content/uploads/EcazMoritani-Rulebook-LOWRES.pdf#page=14).

Keep the original public entry count through a pending decision; later group changes must not rewrite which event happened. Current native population controls whether the low penalty currently applies. A mid-response population change and Enemy of My Enemy's compulsory-refusal revelation need their existing continuation checks; a disallowed low entry must not be used to manufacture an alliance offer whose refused outcome cannot legally reveal. Retained occupied penalties remain subject to the existing occupation boundary.

## Multiple placed tokens and private choices

The ordinary rule permits Moritani to choose a Terror token to reveal. With a stack, a first-array-element lookup cannot stand in for the owner's choice. Present the owner the actual eligible placed identities, preserve their secret faces for every other seat and keep decline available. The singular entry opportunity supports selecting one token; no retrieved Grumman FAQ expressly discusses activating several stacked tokens from the same entry. Treat one-choice handling as ordinary trigger composition, not as an invented automatic all-token resolution or a claim of a dedicated stacking clarification.

Bind the selected token and immutable original entry to the saved continuation. Validate all current candidates remain at that location, and ensure relocation/removal cannot consume a reserved token during its pending trigger. Place/remove operations do not themselves activate Terror or reveal a hidden face. A successful Grumman Collection operation should not expose the removed token's type through logs, errors, public IDs or arbitrary supply ordering.

## Verification handoff

Test Giedi's first positive desert receipt, multiple pools still totaling two, desert-versus-stronghold deposits, shared zero/positive allocations, high/low boundaries, unrelated Collection-phase income and no replay across JSON restoration. Homeworld income and indirect sharing require the separate occupation source decisions.

Test Grumman addition and removal with exact custody and four-spice conservation, decline and unavailable operations, separate Collection/Mentat usage, storm and location rules, stacked owner selection, three physical elites versus two, advisors, combined and separate entry groups, stationary forces, concealed marker getter traps, original entry binding and low-state rejection without token disclosure. Extend SQLite continuation tests once runtime producers exist.

Only this document was written. Local links and whitespace were reviewed; no runtime, database, reference or implementation-status change and no gameplay verification claim follows from this audit.
