# Distrans: source and synchronous engine contract

Audit date: 2026-09-06. Read `docs/RICHESE_ACQUISITION_RULES.md` first. This audit does not activate the card or certify the remaining Richese effects.

## Verified printed effect

Distrans is a Special Treachery Card. Its holder gives **one other player one Treachery Card from the holder's hand**, provided the recipient has room. It can be played at any time except during a bid. Distrans is discarded after use.

The rulebook depicts the face on p5: [GF9 CHOAM & Richese rules](https://www.gf9games.com/dune/wp-content/uploads/2021/11/CHOAM-Rulebook-low-res.pdf). The publisher-text extraction `/tmp/dune-rules/choam-lelekan-mirror.txt` interleaves that face with the surrounding faction prose. I also visually re-read the enlarged physical face at `/tmp/dune-rules/choam-distrans-reading.png`, derived from the [component photograph](https://cdn.anyfinder.eu/assets/QsUJtVktEC87xwK08oLlwnKyaozUWfuaLzG0LFEn67ENEEVgNrDGoITy3608Dqe7) linked by the [product gallery](https://www.tabletopfinder.eu/en/boardgame/32692/dune-choam-richese). The face and publisher PDF agree. Photograph printing/date provenance remains unverified; the visible publisher card text is the evidence, not retailer commentary.

Bounded fresh official-domain searches for Distrans, its hand-transfer wording and its bid exception returned no specific FAQ resolution. Local available publisher rule/FAQ extracts contain no additional Distrans answer. Absence of an indexed answer is not proof that no later ruling exists.

| Question                   | Source-backed contract                                                                                                                                                                                                                      |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Who may activate it?       | Any player who physically holds the canonical Distrans card. Richese ownership/faction/alliance is not required.                                                                                                                            |
| Who supplies the transfer? | The activating player's own hand. Not another player's hand, the Richese cache, the discard pile, a deck or an offered auction lot.                                                                                                         |
| What may transfer?         | A Treachery Card from that hand, without a Richese-family restriction. Base, Ix and other enabled expansion cards are eligible subject to existing commitments.                                                                             |
| Recipient                  | One distinct seated player with hand space. May be an ally or opponent; no mutual-alliance requirement.                                                                                                                                     |
| Consent                    | No accept/refuse step is printed. Do not introduce a free veto or acknowledgement.                                                                                                                                                          |
| Payment                    | No spice cost is printed. Do not invoke auction aid, Emperor income, Guild income or purchase bonuses.                                                                                                                                      |
| Disposal                   | Transfer the selected card intact to the recipient. Discard only the played Distrans after use into the ordinary Treachery discard pile.                                                                                                    |
| Karama                     | This is an ordinary card effect, not the Richese alliance ability or a faction advantage. Generic faction-power cancellation does not cancel it. Do not create a `richeseGift`-style Karama window.                                         |
| Hand limits                | Recipient must have room before transfer. Donor may start full: the normal distinct-card operation removes two cards from their hand and adds none. Use the authoritative current faction hand limit, including Harkonnen/CHOAM exceptions. |
| Repetition                 | A single physical Distrans is consumed once. No additional once-per-phase restriction is printed.                                                                                                                                           |

The distinction between an ordinary Treachery effect and a cancellable faction/alliance advantage follows the general Karama rule; the [GF9 FAQ](https://www.gf9games.com/dune/wp-content/uploads/2020/04/Dune-FAQ.pdf), p1, discusses cancellation of advantages and alliance powers. No Distrans-specific immunity or extra counter procedure was found.

## Explicit unresolved guards

1. **Giving the activating Distrans itself.** The give-then-discard wording does not explain self-selection. Do not put the same physical card in both the recipient's hand and the discard, discard a different card, or silently omit the discard. Until clarified, require a separate transferred card and label self-selection unsupported, not a printed prohibition.
2. **Exact scope of “during a bid.”** The face does not define whether this means one bid declaration or the complete auction of a card. It does not say the entire Bidding phase. A temporary guard over unresolved normal/Once Around/Silent lots, including unsettled payment, is an explicit conservative implementation boundary. Pre-bid declaration/selection, between-lot windows and post-purchase income are distinct contexts; do not silently present a blanket phase-3 ban as the official rule. The user has already been asked about this boundary by root; this audit adds no question or assumed answer.
3. **Active Truthtrance answer priority.** Existing question/priority resolution prevents changing the queried hand mid-question. No retrieved Distrans-specific rule overrides it. Keep this narrow existing priority boundary, rather than disabling Distrans for every unrelated decision or response.
4. **Future Semuta discard reaction.** Discarding Distrans creates a real discard event. Semuta may eventually react to that card; the transferred card was not discarded and is not a Semuta target. Do not replay the transfer when resuming a future discard reaction. The exact combined Semuta capacity/counter sequence remains in its own unfinished subsystem.

A setup-only prohibition is also not printed on the face. Current supported setup normally has no reachable Distrans in a hand; if a new setup module makes that reachable, verify that boundary rather than inferring a general rule from current implementation gates.

## Recommended action and atomic result

Use the ordinary card action family, for example `{type:'card', card:distransId, target:recipientId, give:transferredCardId}`. Names are an adapter choice; the normalized facts are actor, canonical activating ID, exact transferred ID and exact recipient ID. Authenticate actor ownership and never derive recipient from a mutable ally field.

Preparation must validate both physical cards and all commitments without discarding, transferring, drawing or using RNG. Reject duplicate/self identity as the explicit unresolved guard. Preview the final hand sets, donor promises and pending transaction feasibility. Only then mutate the authoritative working clone:

- Donor loses the selected distinct transfer card and the played Distrans.
- Recipient gains that same transferred card exactly once.
- Normal discard gains Distrans exactly once.
- Deck, cache, other hands, spice, auction payments, faction-use markers and submitted battle plans do not otherwise change.

No persisted pending transfer or new response is needed for this synchronous effect. If a later Semuta response is introduced, its pending state begins **after** these effects and records a completed discard event, not a transfer command to replay. Existing room CAS and version checks fence duplicate accepted actions; a repeated fresh-version action also fails because Distrans is no longer held.

## Exact insertion and continuation risks

The current late `if (t === 'card')` branch is behind phase-opening, response and decision gates. Merely adding an effect case there would incorrectly make most anytime use unavailable. Add a canonical Distrans branch after `resolveTruthAction` preserves existing Truthtrance priority, but before generic phase-opening/response/decision gates. Keep existing `response`, `decision`, `pendingKarama` and `phaseOpening` objects in place during the synchronous transfer. Do not use the Richese gift response stack or clear phase readiness. Let the ordinary post-action continuation drain run afterward.

Because the action remains `type:'card'`, `reconcileBattlePromises(g,{actor,action})` already attributes voluntary donor losses correctly. Validate the prospective result before mutation as well, then retain the outer check. Receiving a card is not the recipient voluntarily breaking a promise. A sealed or fully inspected plan remains the exact original plan; adding a card must not reopen it or modify an inspection snapshot.

### Physical commitments on both cards

Check both Distrans and the transferred card, not only the latter:

- New `pendingRicheseGift` exact owner/card reservation.
- Sealed battle `weapon`, `defense`, card-valued `leader` and fixed prescience identity.
- `retentionReservesCard` for unresolved Moritani played-card cleanup.
- Queued Truthtrance identities.
- Unsold Black Market physical lot still in its seller's hand.
- An accepted Ixian replacement's selected card, including when its response is saved beneath a gift or BG conversion.

Reuse common physical reservation checks, adding missing exact cases rather than disabling a whole hand or every pending interaction. Existing `discard` now protects pending-gift cards, but direct removal of the transferred card still needs the same validation. Do not call `richeseGiftContext` to remove a pending gift from the actual Distrans validation state: doing so would erase precisely the reservation that must remain effective.

Optional CHOAM trade proposals already handle missing cards gracefully on final confirmation. Existing CHOAM Worthless effects deliberately recheck that their declared card remains in CHOAM's hand, and have continuations for an absent card; existing human cash-in during those responses is supported. Do not invent a blanket new reservation over every CHOAM declaration merely because Distrans is added. Preserve the established no-effect/resumption behavior when an otherwise legal hand change removes one of those cards.

### Pending transaction capacity

The pure gift helper is **not** directly reusable: it requires a Richese donor and mutual ally, and models only one outgoing card. Distrans needs its own two-out/one-in prospective hand calculation.

- Preserve the target's slot for an unsettled ordinary winning bid and the current engine's conservative sealed-lot commitments. If an open-lot timing guard currently prevents all such cases, keep the invariant ready for the eventual timing ruling and legacy recovery.
- **Harkonnen mandatory hand exchange:** the forced return is future incoming capacity for `handExchange.target`. If another player gives that target a card after Harkonnen took cards, the mandatory return can otherwise overfill the target and become impossible. Require prospective target hand size plus outstanding return count to fit its limit. Conversely, if the Distrans donor is the exchange actor, their hand after losing both cards must still contain at least the mandatory return count. Inspect saved parent decisions as well as the live one.
- Preserve an accepted Ecaz Ix discard or copy's legal completion after the donor loses two cards; the current outer check is useful, but the shared prospective validator must count both outgoing cards.
- Harkonnen bonus now rechecks live capacity at settlement, so an incoming Distrans gift can legitimately fill the last slot and cause no bonus draw. Do not introduce a ninth card or a blanket ban on the pending bonus.
- One-for-one Ixian/CHOAM replacements do not inherently require an additional free slot, but their exact committed card must remain available where the replacement has already been accepted.

## Interactions with a pending Richese gift

| Distrans use                                                                        | Correct bounded behavior                                                                                                                                                                                 |
| ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Activate the Distrans card currently reserved as the Richese gift                   | Reject before any mutation; it must remain in the original donor hand.                                                                                                                                   |
| Transfer any other card currently reserved as that gift                             | Reject before mutation, even if the destination is the same ally.                                                                                                                                        |
| Gift owner uses an unrelated Distrans and transfers another unreserved card         | Permit where timing/other commitments allow; preserve pending gift and parent response unchanged.                                                                                                        |
| Pending gift recipient plays Distrans and frees hand space                          | Permit; revalidate the eventual Richese gift against the new actual hand.                                                                                                                                |
| A third player uses Distrans to fill the pending gift recipient's final slot        | Complete the ordinary card effect if legal; later Richese gift settlement aborts gracefully without moving its reserved card. No new free veto or Karama cancellation is involved.                       |
| After Karama canceled a Richese gift, its owner uses Distrans to transfer that card | This is a different card effect. The unresolved same-card/same-phase **Richese gift** retry guard does not automatically forbid Distrans. Still require a distinct activating Distrans and valid timing. |
| Distrans supplies a Karama during a still-open original response                    | The new holder can use existing cancellation rights; do not reset passed history or recreate an already finished response.                                                                               |

## Privacy and focused validation

The donor chooses from their own hand. Only the recipient's own view receives the transferred card identity after commitment. Distrans itself becomes a normal public discard; do not announce the identity of the other card in public logs or action notices. No opponent hand array, exact private balance, or private reservation list is needed in the UI. Public counts and legal capacity checks follow the existing projection policy.

Recommended regressions: atomic distinct-card conservation and fresh-version replay; nonallied recipient and full donor; full recipient rejection; both reserved-card roles; gift response plus BG conversion/phase-opening preservation; pending gift recipient fills/frees; exact donor Truthtrance promises; Harkonnen exchange actor/target capacity; no Hark/Emperor/Ix purchase effects; supported bid boundaries and explicit self-transfer guard; authenticated CAS duplicate action and restart before/after transfer. Test future Semuta against only the actual Distrans discard event.

## Runtime integration checkpoint

The ordinary card action and owner-only projected transfer choices are integrated. Shared exact-card reservations cover saved parent Ix replacements and pending gifts; prospective checks preserve compulsory exchanges and binding donor promises. No new response or recipient confirmation is created. The supported post-payment context uses currentAuctionSale only after the existing code has paid and transferred the purchased card. Open unpaid lots and self-transfer remain explicit unresolved guards.

Six root engine, six independent review, five AI and three real SQLite/API cases pass, in addition to six pure custody cases. Full registered suites pass1,247 rules/client and96 persisted/API tests; TypeScript, lint and production build pass. The real browser gave Shield from a synthetic Harkonnen hand using Distrans while preserving a separate pending Richese gift; fresh-tab recovery did not replay it. Exact logs and fixtures are in IMPLEMENTATION_STATUS.md. Mobile, future Semuta, bid/self-transfer rulings and full Richese games remain incomplete.

The final combined suite additionally registers four existing portrait checks and seven pure Nullentropy custody cases:1,258/1,258 pass. Runtime multiplayer remains96/96; type, lint and build pass. No Box runtime activation is implied.
