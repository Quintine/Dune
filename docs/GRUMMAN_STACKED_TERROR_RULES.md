# Grumman Collection and stacked Terror

Source audit, 10 September 2026. This supplements [HOMEWORLD_COLLECTION_RULES.md](HOMEWORLD_COLLECTION_RULES.md). It does not certify runtime integration or change release gates. The existing user question about unrevealed removal custody remains pending; this audit asks no duplicate question.

## Evidence and its limits

The original Grumman high face was visually inspected again in the [physical component photograph, BGG image 7767034](https://boardgamegeek.com/image/7767034/dune-ecaz-and-moritani), whose provenance is recorded in [HOMEWORLD_COMPONENT_AUDIT.md](HOMEWORLD_COMPONENT_AUDIT.md). It applies at 8–20 native Moritani reserves. During Spice Collection, Moritani may add a Terror token to a stronghold already holding one, or remove a board Terror token, then receive four bank spice. The face does not print an explicit repetition count or specify the removed token’s next custody zone.

Fresh publisher-indexed passages from the [official Ecaz & Moritani rulebook](https://www.gf9games.com/dune/wp-content/uploads/EcazMoritani-Rulebook-LOWRES.pdf) confirm:

- **p5:** six hidden physical Terror tokens; ordinary Mentat placement/movement targets an empty eligible stronghold; an opposing entry can permit revealing one token. Revealed tokens leave the game.
- **p8:** Ecaz and its ally agree on desert allocation, with the stated fallback when they disagree. Both receive applicable Advanced shared stronghold income.
- **p14:** storm/explosions do not remove Terror. A concealed No-Field placement can trigger it, including zero; revealing an existing No-Field or Face Dancer does not.
- **p16:** Terror cannot be placed on Homeworlds. Canceling Enemy of My Enemy prevents its alliance but leaves the token revelation available.

The [designer’s expansion page](https://futurepastimes.com/dune-ecaz-moritani) was also checked. Bounded searches found no authenticated designer or publisher clarification of multiple revelations from one stacked entry, Grumman versus Ecaz timing, or unrevealed Grumman removal custody. Tournament rewrites and community implementations were not treated as official rulings. No new audio clarification is claimed.

## Supported composition

**One operation and one payment per Collection.** Treat the singular phase opportunity as one optional add-or-remove transaction. This follows ordinary phase-ability grammar; it is not an explicit Grumman FAQ answer. There is no authority for repeatedly adding/removing tokens to earn unlimited spice. The four-spice award follows a completed legal operation, so declining or lacking a usable operation does not pay. Keep its completion separate from ordinary Mentat placement usage.

**Owner chooses a physical token.** A stack makes several tokens candidates for the same ordinary entry opportunity. The existing singular revelation language supports choosing one eligible token rather than automatically choosing the first array element. No retrieved source expressly allows activating several tokens from that same entry. The bounded implementation should resolve one selected token or decline, leaving other tokens placed; resolving the effect must not manufacture another entry event. This is ordinary-trigger composition, not a stacking-specific clarification. Separate later arrivals retain their own opportunities and low-Grumman entry requirements.

The chosen token must remain bound to the original entry through Enemy of My Enemy, its refusal or cancellation, card discards and saved continuations. A refusal applies the selected token’s compulsory outcome. Canceling the alliance must not silently select a different token. Existing effect-specific implementation gates still apply to the selected token; a supported neighbor in the stack does not implement an unfinished effect.

**After Ecaz settlement is an implementation ordering.** Neither inspected component sets precedence between these two Collection opportunities. Resolving Grumman after existing Ecaz allocation and bank-income continuations is a coherent serializer for the supported effects: allocation changes balances, while Grumman changes token custody and awards fixed bank income; neither operation changes the other’s force count, token availability or allocation formula. No material conflict between those ordinary operations was identified.

Do not describe that serializer as printed priority. Revalidate current native population when the Grumman action is accepted. An allowed intervening effect that changes population, token custody or the phase must use the same continuation checks; a future noncommuting interaction would require review. Ecaz settlement cannot consume Grumman’s opportunity, and Grumman cannot overwrite an unresolved allocation. Its award is not desert collection and must not create a shared Ecaz allocation or Giedi collection trigger.

## Unresolved removal custody

Removal from the board is not revelation. The revelation disposal rule does not establish that an unrevealed Grumman removal is permanently spent. Conversely, other effects’ express return-to-supply instructions do not prove this removal returns to hidden supply. Neither result was authenticated by this audit.

Keep that operation guarded pending the existing question. Do not reveal its face, call the revelation handler, rotate it into reusable supply, or credit four spice before its destination is resolved. Addition can be implemented independently using an actual available token and a stronghold already containing Terror. It does not authorize Homeworlds, the Hidden Mobile Stronghold, an invented token or movement from another stack.

## Concrete code review findings

At the inspected checkpoint, `openTerrorEntry` in [engine.ts](../game/engine.ts) selects the first placed token at the destination. Stacking requires an owner-visible candidate choice, with hidden faces excluded from other seats, and a durable selected identity afterward.

[moritani-alliance-cancellation.ts](../game/moritani-alliance-cancellation.ts) separately requires exactly one placed token at the entry location. Replace that location-wide uniqueness assumption when stacking is introduced. Preserve uniqueness of the selected **physical ID**, its placed status, location, original entry proof and valid effect. Two distinct colocated tokens are legal candidates; two copies of the same physical ID remain corruption.

The registry, projection and ordinary placement quote have different responsibilities: permit multiple distinct placed tokens at one location in the registry, expose public stack size without hidden faces, and continue requiring an empty destination for ordinary Mentat placement. Preserve all unselected tokens, original entry counts and protected token custody across rejection and JSON/SQLite recovery.

Only this source document was written in this task. Local links and whitespace were checked. Runtime tests, browser checks and checkpoint publication are outside this audit.
