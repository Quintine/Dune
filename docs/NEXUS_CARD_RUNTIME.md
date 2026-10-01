# Nexus cards: common lifecycle checkpoint

**Later Harkonnen Betrayal checkpoint:** the separate fresh local
`harkonnen-betrayal` profile connects actual personal and allied native
traitor calls. Native allied counters precede provisional neutral
acknowledgements; Use returns only the declared physical traitor immediately,
prevents that call and preserves one actual private Mentat replacement.
The previously asked universal reaction-policy question remains open.
Verification is **Partial development verified** for frozen native/private/
SQLite/CLI/phone evidence, including immediate retirement and actual Mentat draw;
see the [bounded existing source contract](NEXUS_HARKONNEN_RULES.md#bounded-betrayal-preview-contract--1-october-2026).
No historical checkpoint verifies this path or opens public/combined modes.

**Later Ixian Betrayal prototype:** the fresh local `ixian-betrayal` profile
connects both printed alternatives to original native attempts: Bidding
extra-card inspection/draw and Advanced Technology exchange. Native counters
resolve first; a uniform neutral acknowledgement then precedes the native
effect. These are explicit bounded privacy/ordering inferences, not publisher
priority. Verification is **Partial**, with development stage **Verified** for
the bounded native/private/recovery/CLI/phone path recorded below.
See the [source protocol](NEXUS_CARD_RULES.md#bounded-ixian-betrayal-source-protocol--1-october-2026)
and [current local contract](#bounded-ixian-betrayal-local-runtime--1-october-2026);
the historical lifecycle counts below do not verify this later feature.

**Later Ixian Secret Ally replacement prototype:** [NEXUS_IXIAN_REPLACEMENT_RULES.md](NEXUS_IXIAN_REPLACEMENT_RULES.md#bounded-local-runtime-contract) records the fresh local `ixian-replacement` profile: exact just-purchased normal paid/printed Karama card, discard before private deck draw, full-hand and genuinely depleted-deck same-card behavior, unchanged original payment and native sale continuation once. Harkonnen buyers, cache/Black Market/special origins and combined modules remain guarded. The neutral buyer choice is an inferred development privacy convention, not publisher timing. Its bounded native/SQLite/four-bot/CLI/phone evidence is **Partial development verified**; this historical lifecycle checkpoint does not certify full effects or enable public/module starts.

The later [Emperor Secret Ally revival prototype](NEXUS_EMPEROR_SECRET_ALLY_RUNTIME.md) adds exactly three additional free force returns, separate ordinary allowances, private controls and saved continuation. Its purchase alternative and full module acceptance remain pending.

**Later Guild Secret Ally runtime:** [NEXUS_GUILD_SECRET_ALLY_RUNTIME.md](NEXUS_GUILD_SECRET_ALLY_RUNTIME.md) records explicitly selected Guild prices, cross/return routes, typed Homeworld sources, paid Fremen reinforcement and committed shipment history. The card changes one shipment, without creating a native Guild or a real alliance. The Homeworld-return ruling and full module completion remain pending.

The later [Richese Secret Ally checkpoint](NEXUS_RICHESE_RUNTIME.md) adds an ordinary physical reserve shipment priced as one force; its other effects and complete module acceptance remain gated.

The later [Guild Cunning checkpoint](NEXUS_GUILD_CUNNING_RUNTIME.md) adds a separately recorded second shipment and remaining Hajr movement within the native Guild turn. Secret Ally, Betrayal and complete module acceptance remain unfinished.

**Historical foundation checkpoint.** Subsequent Atreides inspection integration is recorded in [Atreides runtime](NEXUS_ATREIDES_RUNTIME.md). The counts and effect limitations below describe the original lifecycle checkpoint.

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

## Bounded Ixian Betrayal local runtime — 1 October 2026

### Fresh local entry and natural card rights

The `ixian-betrayal` profile admits a fresh ready two-to-six-seat Basic or
Advanced lobby with unique factions, native Ixians and otherwise classic
factions or Tleilaxu. It uses the actual forty-seven-card Ix Treachery Deck and
the independent Nexus module. It excludes CHOAM, Richese, Ecaz and Moritani
factions/decks/variants, Homeworlds, Leader Skills, Semuta, Discoveries, Tech
Tokens, Stronghold Cards and other optional overlays. This is a private local
development entry, not a public start, reset, saved-game retrofit or approval
of complete Ixian/Nexus play.

`initializeIxianNexusBetrayalGameForAudit` in `game/engine.ts` initializes that
fresh boundary. `tools/prototype-room.ts` and `tools/start-prototype.ts` retain
the exact-version and private-backup safeguards of other prototype entries.
For an existing named fresh lobby, use the starter's `--profile ixian-betrayal
--db PATH --room CODE --version NUMBER --out /private/new-directory` options;
the output directory must satisfy the existing private backup contract.
Original room IDs, seats, names, rules and setup custody are preserved.

There is **no starting Nexus deal or automatic draw**. Complete genuine setup,
then the normal qualifying Spice Blow and Nexus phase: a Nexus must have
occurred, negotiations and earlier responses must finish, and at least one
alliance must exist at the whole phase's close. An unallied seat may then draw
through the normal private policy. Three actual seats are the minimum for
one unallied receiver alongside a two-seat alliance; four are needed for two
simultaneous unallied receivers. A two-seat profile can continue base play but
does not fabricate an unreachable Betrayal card.

### Original-source continuation and controls

`game/nexus-ixian-betrayal.ts` supplies the bounded source/custody protocol;
the original native engine callback owns the actual allow/deny continuation.
The source distinguishes `bidding` from `technology`, binding the original
provider, native window, turn/phase and required public responders. It does
not replay a raw action, snapshot/undo the whole game, duplicate native draw
algorithms or fabricate a Karama-cost card.

1. Complete the original native Karama responses first. A successful printed
   or legal Advanced BG counter takes the native denied path once without
   opening a Nexus gate or spending Nexus.
2. After native passes, pause before the original Bidding draw or declared
   Technology swap/Atreides peek. Publicly possible unallied non-Ixian held-
   Nexus seats acknowledge uniformly, regardless of their concealed face.
   Native role and publicly impossible source/seat membership can omit an
   impossible offer; the concealed Nexus identity cannot determine the pause.
3. Pass retains Nexus and records that seat's acknowledgement for this event.
   Only an actually eligible unallied rival Ixian-card holder receives private
   Use. Use spends exactly one physical Nexus and denies the current native
   attempt. All required passes allow it; no possible seats allow immediately.
4. Bidding denial draws only the original normal allocated count, without
   private Ixian inspection/return. Allowance retains the real native extra
   draw and selection. Technology denial preserves both original card
   locations and the declaration's used attempt; allowance swaps them.
   Both branches resume the original normal auction/Atreides suffix once.

The table uses `GameView.nexusIxianBetrayalReaction` and the preview marker.
The reaction carries only the public event, kind and provider plus that
viewer's own `canPass`, `hasPassed`, `canUse` and private `blocked` reason.
`nexusIxianBetrayalPass` and `nexusIxianBetrayalUse` submit exactly the offered
event, not client-selected source, draw count, card ID, price or provider.
Multiple outstanding public responders have no fabricated sole owner; the
last remaining public responder may own the acknowledgement.

The controls explain the selected native alternative and distinguish Pass
from private eligible Use. The holder's existing own-Nexus inspector shows
their actually held face; an irrelevant-face prompt cannot grant an Ixian
identity inspector. Neither the prompt nor the rival view reveals selected
Ixian cards, unseen lots, inspection faces, deck order, private source or
other seats' eligibility reasons. The bounded native-counter-first/neutral-
acknowledgement policy is an application inference, not universal publisher
priority, blanket Nexus immunity or an invented Karama response to Nexus.

### Saved boundaries and remaining acceptance

Refresh preserves the same pending source, passes and event. A completed
event expires; it cannot reopen or replay the original declaration, counter
cost, Nexus spend, draw, exchange or suffix. Closed history uses nonrecursive
bounded source links, so later real card recycling does not require an old
card to remain forever in discard or recursively copy prior signatures.
These are consistency safeguards, not cryptographic authentication of
arbitrarily fabricated saved JSON.

The pending source blocks ordinary bids, draws, exchanges and competing card
mutation while preserving existing response/decision/Truthtrance priority.
A missing or orphaned source must reject, not silently allow or heal during
a read. Independent own-seat `setAutopilot` remains available to every seat.
Easy, Medium, Hard and Brutal use only their own projected legal Use/Pass
choices: minimal continuation, not calibrated Nexus strategy.

Verification is **Partial**, with development stage **Verified** for this bounded
profile. The frozen parent check passed **6,315/6,315** offline tests, types and
lint; the affected nine-file union passed **167/167**. Actual native scripts
exercised eight allow/prevent/partial-pass cases and both original BG
Worthless-Karama interruptions. Genuine Harkonnen exchange and public
administrator acknowledgement ownership retain the original continuation.
Four exact-version, backed-up CLI rooms exercised 390px human Use, wrong-face
Pass, two-receiver partial refresh, original Ixian return and Technology
exchange. Read-only saved-state proof retained all forty-seven Treachery and
twelve Nexus cards, original wallets/forces and fourteen earlier QA games.
Earlier checkpoints and image publication do not deploy this path or certify
complete Ixian/Nexus play; wider and deployed acceptance remain open.

Both alternatives concern **one current attempt**, not a whole-phase ban or
retroactive undo of completed inspection, selection, exchange or purchase.
Advanced Technology on Richese cache/Black Market lots remains outside the
profile and unresolved; its special-lot decline continuation elsewhere is not
an exchange ruling. General multiple-lot duration, competing effect priority,
other modules/rosters, complete Ixian/Nexus games, strategy calibration,
public release and live deployment remain separate open gates.
