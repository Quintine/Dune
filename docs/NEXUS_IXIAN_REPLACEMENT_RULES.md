# Ixian Nexus Secret Ally: purchased-card replacement

Source audit: 2026-09-10. Bounded local prototype integration and verification: 2026-10-01. **Partial development verified**, not complete Ixian/Nexus family or expansion acceptance. This document records the source and runtime boundary of the fresh `ixian-replacement` profile. Existing [Nexus release gates](NEXUS_CARD_RUNTIME.md) remain in force.

## Primary evidence

- **Face:** [photograph of the twelve original GF9 Nexus Cards](https://boardgamegeek.com/image/7767032/dune-ecaz-and-moritani), independently inspected again at `/tmp/dune-nexus-cards.jpg`. The photographed publisher text is the authority, not commentary by its uploader.
- **E3:** [GF9 Ecaz & Moritani rules, pp.11,16](https://www.gf9games.com/dune/wp-content/uploads/EcazMoritani-Rulebook-LOWRES.pdf#page=11), indexed publisher text and the previously retrieved [publisher-authored mirror](https://gamers-hq.de/media/pdf/0f/7a/86/Dune_EcazMoritani_Rulebook_EN.pdf), `/tmp/dune-e3-nexus-rules.pdf` and `.txt`.
- **Base:** [GF9 base rules, pp.6,8,17](https://www.gf9games.com/dunegame/wp-content/uploads/Dune-Rulebook.pdf#page=6), freshly retrieved publisher-indexed setup, bidding and Harkonnen text.
- **E1:** [GF9 Ixian & Tleilaxu rules, p.9](https://www.gf9games.com/dunegame/wp-content/uploads/2020/09/IxianAndTleilaxuRulebook.pdf#page=9), freshly retrieved publisher-indexed alliance paragraph.
- **FAQ:** [GF9 November 2020 FAQ, pp.6–7](https://www.gf9games.com/dune/wp-content/uploads/2020/11/Dune-FAQ-Nov-2020.pdf#page=6), freshly retrieved publisher-indexed inspection and Karama rulings.
- **E2:** [GF9 CHOAM & Richese rules, pp.4,10–11](https://www.gf9games.com/dune/wp-content/uploads/2021/11/CHOAM-Rulebook-low-res.pdf#page=10), freshly retrieved publisher-indexed discard secrecy and purchase FAQ.

Direct official PDF retrieval returned 403. Several older temporary `.pdf` paths contain HTML error pages; they were not treated as readable PDFs. No tournament rewrite or community compilation supplies a ruling here.

The user-supplied `UNOFFICIAL_Revised_Dune_Rulebook_v.2.3_web.pdf` is the adopted source for relevant Advanced core rules, including later Storm determination. It does not contain the Nexus Cards or this face. It therefore supplies no new Ixian replacement, cache-scope, bonus-order or Nexus-cancellation ruling; the photographed publisher card and cited publisher rules remain this feature's evidence.

## Printed operation

The face permits the holder, when Ixians are absent, to discard the Treachery Card just purchased during Bidding and then draw the top Treachery Deck card. This identifies one particular purchase, not an arbitrary held card. The replacement is optional, but playing it spends the Nexus Card. No spice refund, extra payment, free choice from the deck, or second replacement is printed. The panel has no Advanced-only qualification. [Face](https://boardgamegeek.com/image/7767032/dune-ecaz-and-moritani)

Common Nexus rules require an unallied holder; joining an alliance discards the held Nexus Card. Secret Ally applies when the represented faction is absent, distinct from native Cunning or Betrayal. The E3 FAQ contains no Ixian replacement clarification. [E3](https://www.gf9games.com/dune/wp-content/uploads/EcazMoritani-Rulebook-LOWRES.pdf#page=11)

The buyer takes the purchased card after payment. The native Ixian allied replacement explicitly occurs immediately after purchasing; November's FAQ permits viewing that purchased card before choosing. Applying the same inspection entitlement to this independently printed just-purchased replacement is ordinary composition, not a Nexus-specific FAQ. [Base p.8](https://www.gf9games.com/dunegame/wp-content/uploads/Dune-Rulebook.pdf#page=8), [E1 p.9](https://www.gf9games.com/dunegame/wp-content/uploads/2020/09/IxianAndTleilaxuRulebook.pdf#page=9), [FAQ p.6](https://www.gf9games.com/dune/wp-content/uploads/2020/11/Dune-FAQ-Nov-2020.pdf#page=6)

## Custody, deck and purchase consequences

- Discard first, then draw. A full but legal hand is supported: the discard opens the slot before replacement; neither transient overcapacity nor a full-hand exception is needed.
- Base setup requires discard reshuffling to replenish an exhausted Treachery Deck. Therefore an empty deck is not a reason to disallow this effect: its own preceding discard supplies a card. That physical identity can be drawn again. Do not exclude it or promise a different card.
- The already dealt auction row is distinct from the remaining deck. Draw the actual deck top, not the next unsold auction lot. Do not rebuild the auction pool.
- Harkonnen retains the bonus earned by the original purchase, subject to its ordinary hand cap and cancellation. Replacement is a draw, not another purchase, so it earns no second bonus. At seven cards before purchase, the purchase fills the eighth slot; a one-for-one replacement does not create bonus capacity.

These are compositions of the printed discard-then-draw operation with [base pp.6,8,17](https://www.gf9games.com/dunegame/wp-content/uploads/Dune-Rulebook.pdf#page=17). Preserve the original paid price and recipient exactly once; this card contains no reversal instruction.

An ordinary Karama acquisition is described by November's FAQ as purchasing without spice, so zero payment alone does not exclude a genuine Bidding purchase. Gifts, bonus draws, Ambassador draws, Nullentropy retrieval and Technology swaps are not purchases merely because they occur in Bidding. [FAQ p.7](https://www.gf9games.com/dune/wp-content/uploads/2020/11/Dune-FAQ-Nov-2020.pdf#page=7)

## Richese and cancellation: distinguish source scope

E2 explicitly excludes a direct Richese cache purchase from the **Ixian ally** replacement, while allowing Black Market purchases, including a Richese-family card. It also awards Harkonnen's normal bonus for both sale kinds. The restriction follows purchase origin, not card family. [E2 pp.10–11](https://www.gf9games.com/dune/wp-content/uploads/2021/11/CHOAM-Rulebook-low-res.pdf#page=10)

That question names an ally of Ixians. The later Nexus face independently grants the operation when Ixians are absent and does not name the native alliance advantage or repeat the cache exclusion. The literal independent-grant reading includes genuine cache purchases during Bidding. Extending the older exception to the new card is an alternative interpretation; no retrieved primary clarification selects it. Do not silently reuse an existing native `ixAllyCard` origin filter as though it settled this distinction. The same analysis matters for Richese's genuine special-Karama cache purchase during Bidding; its other timing and hand-cap boundaries remain in the [acquisition audit](RICHESE_ACQUISITION_RULES.md).

November's Karama table expressly permits stopping the native Ixian ally from discarding a purchased card. For this separately worded Nexus grant, Ixians are absent and the holder is not using a present faction's native or actual alliance advantage. Treating it as a direct card effect without that native cancellation window is the supported category composition used for Atreides Secret Ally; it is not an express general Nexus-immunity ruling. Unlike Bene Gesserit Secret Ally, this face does not say to use a named faction advantage. [FAQ p.7](https://www.gf9games.com/dune/wp-content/uploads/2020/11/Dune-FAQ-Nov-2020.pdf#page=7), [Face](https://boardgamegeek.com/image/7767032/dune-ecaz-and-moritani)

## Ordering and unresolved boundaries

**Harkonnen draw order:** the purchase earns its bonus, and Nexus applies to the just-purchased card. Neither inspected paragraph explicitly orders these two post-purchase draws. Choosing replacement after viewing the bonus can change the informed decision; bonus cancellation can also affect the deck. Preserve separate purchased, replacement and bonus identities and report the priority gap before selecting a fixed order. Owner-selected ordering is a possible implementation proposal, not a retrieved official ruling. The free bonus itself is never an eligible purchased target.

**Other immediate disposal effects:** use the ordinary physical-discard pipeline. Applicable Ecaz poison income and Semuta reactions must neither duplicate the discarded card nor cause a second replacement. Precise competing immediate-effect priority is not supplied by this Nexus face. Existing Semuta and occupation source gaps remain separate.

**Nullentropy and custody interruptions:** a paid Box search freezes the searched pile in the existing subsystem. The replacement cannot draw or reshuffle that pile while browsing. Conversely, playing or transferring the just-purchased card cannot leave a live replacement offer pointing at custody it no longer owns. Preserve or settle the exact purchase continuation; do not reopen an expired purchase from an arbitrary historical card ID. Whether a player can interleave a particular anytime power before exercising an immediate purchase right needs an explicit sequencing policy, not an invisible loss of the right. See the [Box audit](NULLENTROPY_BOX_ENGINE_AUDIT.md).

**Private opportunity timing:** a pause offered only to the eligible Ixian-card holder may reveal the secret identity. This bounded prototype instead gives every publicly unallied supported buyer with public held-Nexus presence the same neutral **Purchased card choice**, independently of its hidden face. An irrelevant-face buyer can Pass but cannot Use. This is an inferred development privacy convention, not publisher-prescribed timing, a ruling on all anytime interleavings or approval of every unresolved private-response design. The Harkonnen-buyer and unsupported-origin guards depend on public faction/origin, not secret face.

## Bounded local runtime contract

The fresh `ixian-replacement` profile is a working development integration of the independently printed Secret Ally grant. It admits two through six unique classic factions in Basic or Advanced with the base Treachery deck and Nexus alone. Native Ixians, expansion factions/decks, Leader Skills, Homeworlds, Semuta, Discoveries, Ecaz variants and other module overlays are excluded. It does not retrofit an in-play game, enable a public start, reset a saved room or change existing native Ixian allied replacement.

There is no starting Nexus deal. Native draws require a qualifying closing
Nexus with a settled alliance, so a two-seat profile can continue its base
game but cannot naturally produce an unallied Secret Ally holder. Actual
replacement scenarios need at least three seats; two simultaneous unallied
recipients need at least four. Fixtures form genuine nonrecipient alliances
and never add seats to an admitted game or fabricate Nexus hands.

### Connected purchase and choice

1. Only an actual normal-auction purchase is connected: paid spice or a genuine printed Karama-paid purchase, including direct printed Karama acquisition before a positive bid is recorded. The free purchase must originate from the actual printed Karama; native Bene Gesserit Worthless/Truthtrance substitutions continue unchanged without this new offer. This is a bounded producer restriction, not a ruling that those acquisitions cease to be purchases. The original source, purchased physical card and native sale continuation are bound after the genuine acquisition. Gifts, bonus draws, Technology swaps, old hand cards and historical purchase IDs cannot create an opportunity.
2. A Harkonnen **buyer** and Richese cache, Black Market or special-acquisition origins are guarded, not adjudicated. A Harkonnen rival is allowed and retains its ordinary native play outside this offer. These bounds preserve the unresolved independent Nexus cache scope and Harkonnen bonus priority above; they are not printed prohibitions or imports of the native `ixAllyCard` origin filter.
3. Every publicly possible supported buyer receives the same event and public buyer identity, regardless of its secret Nexus face. Only that buyer receives Pass and the exact already-owned purchased card for inspection; only a truly eligible unallied holder of the physical Ixian Nexus receives Use. Opponents receive neither the purchased/replacement face nor private price, receipt, deck order or eligibility reason. The buyer may inspect its own actually held Nexus through the existing authorized inspector; the neutral prompt grants no rival entitlement.
4. **Pass** retains the purchased card and Nexus, closes this opportunity and continues the original sale once. **Use** spends that singleton Nexus once, discards exactly the just-purchased physical Treachery Card, then draws the actual next deck card privately. There is no card selector, arbitrary hand exchange, new Karama counter, refund, repayment or re-auction.
5. The discard opens a full legal hand's slot before the draw. An exhausted deck recycles eligible Treachery discards, including that just-discarded card; drawing the same physical card again is legal. The unsold auction row is not the draw deck. Earlier Atreides auction inspection does not grant a new peek of this replacement.
6. The original funded amount, own/authorized-ally contribution and recorded free/paid source are preserved. Already completed payment is not repeated, and original income and native auction suffix run once through their genuine continuation. Other response/decision priorities remain native: finish the source-bound choice before another payment, lot, transfer or card effect can change its reserved source. No expiry bypass or raw-action replay is added.
7. Refresh restores the same pending event or closed outcome without another payment, shuffle, draw or Nexus spend. Closed, stale, foreign or malformed events cannot reopen that purchase. Historical receipts remain valid after later transfers, reshuffles and same-card recycling; they do not require an old purchased card to stay in discard forever. Cursor/descriptor consistency is not authentication against arbitrary rewritten saves; authenticated sessions and production compare-and-swap remain required.

### Public APIs and ownership

- `initializeIxianNexusReplacementGameForAudit(state: Game): Game` in `game/engine.ts` is the fresh-only initializer; `Game.nexusIxianReplacementPreview?: true` marks the admitted profile. Genuine setup and Nexus dealing remain native.
- `GameView.nexusIxianReplacementPreview` reports the profile. `GameView.nexusIxianReplacement` is the neutral event/buyer view with `canPass`, `canUse`, `blocked` and `purchased`; rivals have no face or private blocked reason.
- `{ type: 'nexusIxianReplacementPass', event }` and `{ type: 'nexusIxianReplacementUse', event }` accept only that event-bound shape. There is no client-chosen purchased ID, replacement, recipient, price or Nexus identity.
- `game/nexus-ixian-replacement.ts` owns canonical physical/source/custody/history validation through `createIxianReplacementSource`, `validateIxianReplacementSource`, `closeIxianReplacementSource` and `validateIxianReplacementHistory`, with `initialIxianReplacementCursor` and `ixianReplacementEvent` for bounded progress. The source snapshots the exact purchased descriptor, not a whole-Game undo or payment replay. Canonical descriptor, original parent, owned exact target, legal hand cap and single physical custody are validated before Nexus cost or randomness. The closed receipt chain and independent cursor do not require an old discard to remain in its historical location. The engine alone owns purchase authorization, original payment and native discard/draw/sale continuation. Existing native Ixian ally response remains a distinct cancelable ability, not an alias or fallback for the absent-faction Nexus grant.
- `components/nexus-ixian-replacement.tsx` and `components/game-table.tsx` own the private inspector and neutral controls; `game/bots.ts` consumes each bot's own legal projection. Easy, Medium, Hard and Brutal have minimal legal Use/Pass policies, not calibrated Nexus strategy.
- The local CLI entry is `node --import tsx tools/start-prototype.ts --profile ixian-replacement --db PATH --room CODE --version NUMBER --out /private/new-directory`. It requires the exact current room version, a fresh supported setup and a private new backup/kit directory; it preserves room/seat/setup identity and existing saves rather than replacing or resetting a game. `tools/prototype-room.ts` owns admission and the private backup transaction.

## Verification and retained release gates

**Partial development verified.** Types, lint, 6,227 offline cases and the
73-case selected six-file union pass. Actual standalone native execution
covers fourteen Basic/Advanced paid/printed-Karama Use/Pass, wrong-face
Keep, full-hand and depleted-source outcomes with exact original ledger,
physical Treachery/Nexus/force/elite custody and replay rejection.

The depleted source is captured from genuine six-seat play, seed 11:
turn five, native `auctionPayment`, seventeen held cards, twelve actual
discards, four native reserved lots and an empty draw deck. All 33 cards
are present. Legal purchases, Battle Plans and winner discards produced
it; no row inflation, stock deletion or phase rewrite was used.
`tests/fixtures/nexus-ixian-native-depleted.json` then exercises the actual
payment and native replenishment shuffle, including exact same-card redraw.

Independent rules/privacy rereviews have no finding after two actual fixes.
Nine retained purchase records grew to 7,030,825 bytes under recursive
signature nesting; nonrecursive result-head links reduce them to 134,145
bytes. A permanent linear-history regression retains corruption/replay
checks without a cryptographic-authentication claim.
Actual phone Take back control previously sent no POST during a pending
choice; it now sends one 200, restores the original seat controller and
retains that same paid-source event. Gameplay locks still protect the offer.
Incidental disabled-attribute-order and attempted-SQL-write pins were removed;
actual room/eligibility locks, durable `total_changes()` and credential CAS
remain checked.

Three same-admitted setup/seat/circle QA rooms were privately backed up and
entered by exact-version CLI: `GTCHEGKU` Basic paid Use plus independent
takeback, `JUXLJXHC` Advanced printed free Use, and `HJ5Q64T5` Basic
irrelevant-face Keep. Actual 390-pixel inspection, actions, native income
and refresh retain the source. The wrong-face owner receives no Use or
Ixian inspector. Read-only saved proof conserves original native inventories,
exact spice and one closed outcome; all eleven previous QA rooms are unchanged.

Repository evidence: `tests/nexus-ixian-replacement.test.ts` (pure source,
custody/history), `tests/nexus-ixian-replacement-engine.test.ts` and genuine
`tests/fixture-nexus-ixian-replacement.ts` (native acquisition/continuation),
`tests/nexus-ixian-replacement-controls.test.tsx` (private controls),
`tests/bot-nexus-ixian-replacement.test.ts` (four legal policies),
`tests/nexus-ixian-replacement-recovery.test.ts` (authenticated SQLite) and
`tests/prototype-room.test.ts` (fresh profile and exact-version backed-up CLI).
This evidence is not complete family/module or deployed acceptance.

Native Harkonnen-buyer bonus/cancellation/cap sequencing, independent Richese cache/Black Market/special scope, expansion-card discard reactions, Semuta/Ecaz priority and anytime interleaving remain pending outside this profile. Full Ixian/Nexus families, combined modules, public starts, complete games and live release acceptance remain separate gates.
