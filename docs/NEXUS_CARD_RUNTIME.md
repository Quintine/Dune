# Nexus cards: common lifecycle checkpoint

Integration record, 10 September 2026. **Types, lint, all 3,795 offline tests, the production build and 40 HTTP/session tests pass.** This checkpoint implements the optional Nexus card inventory and common draw/keep/replace lifecycle, plus a complete inspectable reference. It does **not** implement the thirty-six card effects, enable a complete public Nexus module, or certify Ecaz & Moritani or all expansions. Source facts, photographed component faces, and unresolved effect interactions are in [NEXUS_CARD_RULES.md](NEXUS_CARD_RULES.md).

## Implemented scope

- [nexus-cards.ts](../game/nexus-cards.ts) owns the twelve physical identities, deck/discard/one-card hands, shuffle/recycling, alliance forfeiture, owner-only projection, and native/opposing/absent faction mode selection. The deck includes all twelve factions regardless of the seated roster.
- [nexus-card-phase.ts](../game/nexus-card-phase.ts) records a whole Spice Blow and Nexus phase, whether a real Nexus occurred, the final eligible unallied owners, and completed choices. Its consistency signature binds the original phase progress; it is not a cryptographic defense against wholesale fabrication of a saved game.
- The engine remembers Nexus occurrence across Advanced A/B blows and offers cards only when the entire phase ends with an alliance present. Earlier worm responses, alliance negotiations, rides and entry reactions finish before the closing card choices. The next phase waits for the eligible owners; a stale turn, card identity or already-finished opportunity cannot draw again. Genuine first-turn/no-Nexus/no-alliance cases remain distinct.
- Accepted alliance formation discards the incoming partners' held Nexus cards through the common physical custody helper. Failed offers and canceled alliance attempts do not forfeit a card. Existing card effects remain unavailable.
- [nexus-card-options.ts](../game/nexus-card-options.ts) provides the shared action shape and bot choices. All four bot profiles use the common ownership controls; future strategic selection of actual Nexus effects is separate work.

## Private pre-draw preference

An owner chooses **draw**, **discard and replace**, or **keep/skip**, as offered by the server. Before drawing, the optional selector specifies what to do if the drawn card matches the owner's faction:

| Preference | `ownRedraws` | Behavior |
| --- | --- | --- |
| Keep it | `0` | Retain the drawn card, including one's faction. |
| Redraw once | `1` | Replace an own-faction result once, then retain the next result. |
| Redraw whenever it appears | `2` | Continue replacing an own-faction result within the bounded twelve-card physical inventory until a different faction is drawn. |

The value `2` is a policy encoding, not an authorization to redraw arbitrary cards twice. A keep/skip action always sends `0`. Every action binds the current turn and the owner's original held identity, including `null` before a first draw. All policy draws and discards commit within one action. No owner-only confirmation is left pending afterward, so public readiness or phase advancement does not reveal that someone drew their own faction. The policy is available in Basic and Advanced.

Original intermediate draws remain physical transactions. Recycling can draw the same own-faction card again; the runtime preserves that possibility instead of silently excluding it. A lost HTTP response or reconnect must restore the committed final card without new randomness.

## Inspectable cards and privacy

[nexus-card-reference.ts](../game/nexus-card-reference.ts) contains faithful English summaries of every original panel, independently checked against all twelve physical faces. [nexus-cards.tsx](../components/nexus-cards.tsx) shows the owner's card with its applicable mode, all three readable panels, the existing faction-associated Homeworld artwork, and an accessible enlarged dialog. A collapsed gallery contains the full twelve-card reference, which is public rules information and does not identify opponents' held cards.

The panel also shows deck/discard/held counts and the names of players still choosing. It obtains those from the projected offer and public roster. No opponent hand, spice balance, traitor pool, hidden battle plan or deck sequence is consulted. Choice buttons disable during submission. The panel says that card effects are not playable and has no effect-play button. Historical art and source text do not imply live support for the corresponding advantages.

## Verification record

- **Focused UI/reference:** 9 control cases passed, covering all twelve identities and all thirty-six panels, material physical-card numbers and timing, exact action binding, all three private draw policies in both modes, stale and nonowner actions, mode selection, disabled/busy controls, public waiting information, and hidden-field getter traps.
- **Focused lint:** type-aware lint passed for the reference, component and controls test.
- **Pure inventory and phase:** 18 cases pass, including twelve-card conservation across two through six seats, absent-faction roles, malformed identities/RNG, reciprocal alliances, signed phase progress, own-card recycling and identity-independent public completion.
- **Engine:** 10 cases pass through genuine setup and Storm entry, Basic and Advanced A/B phases, first-turn skipped worms, no-alliance/no-worm phases, a summoned-before-blow Nexus, all three actual alliance producers, preselected redraw policies, stale/corrupt requests, private projections and all four bot profiles. The Storm-to-Spice path opens with `initialize=false`; review fixed tracker initialization at that real entry rather than assuming only normal phase initialization.
- **Production SQLite recovery:** three cases pass with real room/session code and disposable databases: competing keep-own/redraw-own requests produce one committed result; a lost response restores the same private card without reroll or extra writes; malformed inventory and changed/missing closing progress reject before projection or storage. An unrelated room remains unchanged.
- **Final integrated checks:** `npm run check` passes types, lint and **3,795/3,795 offline tests**, with no skips or cancellations (93.9 seconds for the tests). This adds 40 cases to the preceding checkpoint. `npm run build` and **40/40 HTTP/session checks** pass. Final logs are `/tmp/dune-nexus-final-check.log`, `/tmp/dune-nexus-final-build.log` and `/tmp/dune-nexus-final-http.log`.
- **Three-seat browser:** isolated room `43U78HGQ` reached its genuine closing opportunity at version 3. Harkonnen selected “Redraw whenever it appears” and used the keyboard to draw. The physical Harkonnen card went to discard and Ecaz became the one held card; version 4 advanced to Charity with ten deck cards, one discard and one held card. All three private sessions restored after refresh; only Harkonnen receives Ecaz's identity. Desktop and 390-pixel phone layouts had no overflow or page errors.
- **Complete component review:** the internal rules gallery opened all twelve normal and enlarged faces by keyboard. Each phone dialog scrolled to its final panel and restored focus on closing. Independent inspection of all **48 screenshots** (normal, enlarged desktop, and paired phone top/bottom for every card) found no readability, clipping, truncation or rules-text discrepancies. This verifies the 36 displayed panels, not their unimplemented effects. Artifacts: `/tmp/dune-nexus-gallery/results.json` and sibling PNGs.
- **Saved-game preservation:** the pre-work baseline contains **3,173** rooms; every original version and SHA-256 state hash is unchanged after browser and HTTP work. The database contains 3,234 rooms: that baseline, the isolated Nexus room and 60 rooms from two HTTP runs. Read-only three-seat restoration also passed for Tupile `ZMA84DY8` v7, Grumman `HU6YUC7Z` v10, Caladan `LV2TNQ88` v5 and revival `463GUCY3` v7. The existing development server was reused; no restart was due during this checkpoint, no database was reset, and the removed automation stays removed.

## Remaining release gates

Every effect family still needs its own original-action timing, cancellation, payment/discard/force or leader custody, hidden-information, bot, UI and recovery integration. Atreides' inspected elements are a distinct upcoming family; they are not enabled merely because the panel is displayed. Existing unresolved Homeworld, revival, No-Field and occupation interpretations remain isolated. Original-format saved games without this optional module are not retroactively dealt cards, and arbitrary saved JSON is not a substitute for a genuine setup/draw history.
