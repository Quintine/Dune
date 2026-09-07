# Auction cancellation continuation contract — 7 September 2026

Implementation follow-up: [AUCTION_CANCELLATION_RECOVERY.md](AUCTION_CANCELLATION_RECOVERY.md) records the completed finite quotes, independent custody fix and verified limits. The analysis below is the original pre-implementation snapshot.

Read-only review of current engine. No gameplay simulation, runtime edits, tests, or new rules interpretation. Approximate line anchors below refer to inspected engine `67f4fb01e5ed0b1578ec5a76d348b70f6679f609febfe1b56162869c2c3bc029`; identity selector `game/karama-context.ts` was `1fc8da8fd1a5e869d7ea83b9201e49852437ce611182d8576dca2075674ea124`. Root is editing other families concurrently, so hashes identify the review snapshot, not a final release.

## Recommended next implementation

First implement **denied Ixian Technology → normal Atreides peek** as a small shared pure quote. It consumes no card from the proposed exchange, draws nothing, and changes only `pendingIxTechnology = null`, `auction.peekKnown = false`, and the immediate Atreides response (or none). Do not require the proposed replacement still to be held. The actual branch explicitly fizzles if the card disappeared, even when allowed.

Then extract a **paid-sale / next-normal-lot quote** shared by `continueAuctionSale`, `auctionBonus`, and `nextAuction`. It should calculate the existing deterministic choice/response/lot boundary from post-cost hand counts; represent draw, Richese completion, and phase-completion obligations explicitly rather than claiming they have been resolved. Finally handle canceled Ix pool preparation as a typed draw request with validated custody and deterministic pool setup after the real draw. This ordering creates useful shared runtime checks without a generic whole-Game validator or effectful preview.

A successful local quote is not permission to persist a Karama cost separately yet. The wrapper still drains automatic responses and reconciles original-actor promises. Unknown subsequent draw/phase work remains in the atomic action.

## Exact producers and minimum source evidence

All five current producers operate during playing phase 3. Validate current positive safe turn and actual seated family owner, plus only the source/successor structures read below. Do not silently change the existing Basic/Advanced distinctions.

| Family | Actual source and canceled work | Minimum evidence; checks to omit |
| --- | --- | --- |
| `ixAuction` | `setAuction` ~4292–4348 creates `ixAuction={count,cards:[]}`, null auction/active, when Ix exists, eligible bidders exist and count is nonzero. Count is frozen from normal eligibility, or current Richese round normalCount. `finishResponse` ~10171 draws count, clears pending, calls `setAuction(g,cards)`. | Ix owner, phase3, positive safe pending count, pending cards empty at response, no active normal auction. Validate a seated unique nonempty order and current normal-round metadata when present. Count is a prepared value: **do not recompute equality against current hand eligibility**; interruptions and the canceler's cost may change it. Basic Ix is supported. Short/empty physical deck is legal. |
| `ixTechnology` | `offerAuctionTechnology` ~4349 checks Advanced, Ix nonempty hand, unused turn and offers decision. Decision ~12882 marks `ixTechnologyTurn=turn`, saves offered card ID and creates response. Cancellation ~10185 skips exchange, clears pending, calls `offerAuctionPeek`. | Advanced Ix owner, current normal auction, valid integer index and current card, seated current bidder order/opener/active context, current used-turn stamp and nonempty declared replacement ID. No Richese offered lot: those Technology interactions remain blocked by `richeseOfferBlock`. Do not require current replacement ownership or still-nonempty Ix hand: cancellation performs no exchange. Do not reset used-turn stamp. |
| `ixAllyCard` | Normal `settleAuction` ~4641 paid/free purchase pushes acquired card into buyer hand and writes `currentAuctionSale`; if buyer.ally points at Ix it saves `{player,card,free}`. Also Black Market `settleRicheseLot` ~4150 offers it; cache never does. Decision ~12905 checks buyer, actual held acquired card and buyer.ally before response `{owner:ix,recipient:buyer}`. Cancellation ~10209 clears pending and calls `continueAuctionSale(pending.free)`. | Bind recipient/pending player/sale winner, free flag, acquired ID to normal indexed card or sold Black Market card, sale amount/origin/seller and live source. Existing producer only checks buyer→Ix alliance, while allowed discard-frame validation additionally requires mutual alliance; valid engine alliances are mutual, but do not describe the stronger predicate as producer wording. Denial neither discards nor draws. Do not require acquired card still held for cancellation: branch deliberately skips replacement if missing. Do not re-charge purchase or re-check buyer affordability/capacity. |
| `emperorIncome` | `continueAuctionSale` ~4666 emits for nonfree purchase when seated Emperor differs from winner, except a nonnormal sale to someone other than seller credits seller directly instead. Cancellation ~10653 does no payment and calls `auctionBonus`. | Emperor owner distinct winner; paid sale/current normal bidder; safe amount, free=false, correct normal sale or supported nonnormal self-purchase fallback. Do not re-check current winner spice/aid or credit Emperor. Existing source supports missing `currentAuctionSale` using `auction.bidder/bid`; handle this legacy path explicitly or preserve old atomic behavior rather than silently banning it. |
| `harkonnenBonus` | `auctionBonus` ~4685 emits for paid OR free winning Harkonnen with hand length<8. Also used after sold Richese lots. Cancellation ~10665 skips bonus draw and calls `nextAuction`. | Harkonnen owner equals paid/free sale winner (or legacy normal auction bidder), source index/lot outcome and valid successor context. Do not require hand currently below8: incoming cards can fill it after declaration, and automatic runtime explicitly allows that response without draw. Do not require deck card availability for denial. |

For a normal paid receipt validate: auction exists; index is a safe integer in `[0,cards.length)`; bidder is seated winner; nonnegative safe bid and `sale.amount===bid`; sale origin normal/seller null; free boolean; nonempty indexed card with stable physical identity. For new paid producers, the sale is mandatory; legacy fallback can be a separate explicitly supported variant rather than inventing a new receipt. No winning bid or ally debit is repeated. Normal auction has **no event field**: bind turn/index/card/order, not a fabricated event.

For sold Black Market/cache successor receipts, bind current Richese lot event, source, owner/seller, card ID, sold winner/amount, round turn/stage/position and free=false. `ixAllyCard` specifically excludes cache. Keep these separate from the disputed canceled `richeseAuction` count response: that guard is unchanged.

## Shared finite successor proposal

Use a private typed result along these lines (names illustrative):

- `peek`: retain current lot, set peekKnown false, optional seated Atreides response.
- `income`: existing paid receipt plus next Emperor response, or exact seller credit and next bonus boundary. Validate safe current seller balance plus amount only when this suffix will credit it.
- `bonus`: optional Harkonnen response using **post-cost current hand count**; otherwise continue to next-lot quote. Credit has already occurred before this boundary if applicable.
- `normalLot`: clear sale, increment valid index exactly once; reset bid/allyPayment/bidder/passed; rotate opener to next nonfull seated player; set active; offer Technology decision if Advanced Ix currently has a hand and current turn unused, else optional Atreides peek.
- `normalEnd`: return unauctioned suffix cards to deck front; clear auction/sale; either Richese cache decision, current round completion then phase end, or ordinary phase end.
- `richeseEnd`: existing `finishRicheseLot` branch, with exact source metadata; stop before actual cache/declaration event generation or downstream normal pool draw, unless those get their own shared execution contract.
- `drawPool`: requested frozen count plus validated physical draw source; actual drawing is deferred. After draw, shared deterministic `setAuction` selection handles no eligible bidders, zero cards, and first opener.

Before opener loops, validate order is nonempty, unique, seated; opener is an integer in range; index/card arrays valid. `nextAuction` currently checks equality with cards.length, so corrupt index beyond end would otherwise select undefined cards. This is a malformed-save prerequisite, **not a reproduced valid-state defect**. Derive `able` using current post-cost hands and actual `handLimit`; preserve separate existing transfer/reservation guards rather than changing eligibility rules. Preserve the current behavior that only index advances and unauctioned cards return; earlier sold array elements are historical references.

No pure quote should assign random IDs, shuffle, draw actual cards, mutate balances, construct a new choice answer, or call the global normalizer. Returned internal context may need private card IDs for custody; it must never be added wholesale to public GameView or eligibility controls.

## Physical custody, draws, and the cost boundary

`draw` ~2001 rejects live `pendingTreacheryDiscard` or a paid Box. It draws from deck head; on an empty deck it shuffles the entire current discard once and clears discard. Each pool iteration calls it, so a depleted combined pool simply yields fewer cards; there is no mandatory supply minimum. Allowed Harkonnen bonus similarly tolerates no card and logs that outcome.

- Printed cancellation cost is discarded before the current finishResponse. BG Worthless was discarded at declaration; a later successful conversion sees whatever the present discard/deck has become after legal interruptions. Quote the **actual intended post-cost pools**, not the initial declaration's old pools.
- Thus a just-spent Karama may join the refill and appear in the canceled Ix pool. A future frame must clear its own committed discard control before a legitimate actual draw. Never pre-sample that refill or replay it during recovery.
- Validate actual custody pools and canonical card entries; keep normal `auction.cards[0..index]` and sale IDs as references, not additional physical copies. Current purchased card is in the winner's hand (or has since moved through permitted effects); prior sold cards also remain referenced in the auction array. Unauctioned suffix and pending Ix drawn pool are physical holdings. Blind global duplicate checking across every auction array entry would reject valid states.
- Denied ixTechnology and denied ixAllyCard do not require draw validation themselves. The latter can still reach a Harkonnen bonus automatically, so a whole-action proof would need that later draw boundary too.
- The existing allowed Ix ally replacement frame ~2800/~3093 validates consumed acquired card, paid source, source index/event and alliance, clears frame before `draw`, then continues sale exactly once. Reuse its paid-source evidence where appropriate, but do not invoke its denied-card custody or replacement-draw requirements when cancellation skips those effects.

## Automatic closure and end-of-Bidding boundary

`settleAutomaticContinuations` ~12034 ignores a nominal response barrier if no unpassed player holds a usable cancellation card. Full Harkonnen hands skip that check and auto-finish without drawing. Consequently:

1. Canceled Ix Technology can immediately allow Atreides peek (`peekKnown=true`); a quote ending at response creation does not promise that peek remains unknown.
2. Canceled Emperor income may immediately allow a Harkonnen bonus, consuming a real random refill, then start another lot.
3. Canceled Ix ally replacement may credit Black Market seller, open Emperor income for a normal sale, allow it, then allow Harkonnen bonus and advance.
4. Canceled Harkonnen bonus does not draw that bonus, but the next normal lot can expose Technology choice/Atreides response; finishing Black Market may prepare the later normal pool.
5. Canceled Ix pool response always performs its count draws before any next choice.

`finishNormalBidding` ~4020 opens a final Richese cache decision when applicable, otherwise `nextPhase` ~7308 opens CHOAM Market or advances. With CHOAM the apparently terminal market can auto-finish when the current public phase3 hand conditions in `finishAutomaticDecision` ~5318 hold. Actual phase advance settles tech income, refunds every aid credit, resets ready/active, opens the optional Ix phase-opening window, then initializes phase4 revival records. These obligations are beyond an isolated next-lot quote. Validate current refund/tech prerequisites only in a dedicated end-of-Bidding suffix; do not run them as speculative gameplay. Stopping at a real player decision is valid bounded evidence; CHOAM auto-empty decision is the documented exception.

## Tests for the next slice

- Actual Ix Technology declaration, printed/BG denial, countercanceled BG restoring original exchange; stale lot/index/card/turn/family rejected before cost. Offered card missing must remain a legal denied/fizzled exchange, not a new hand-custody requirement. Pure quote zero RNG/no mutation.
- Actual paid normal auctions for Emperor and Harkonnen; free vs paid; buyer also canceler to expose post-cost eligibility. Preserve original payment, seller credit and bonus exactly once. Separate legacy missing-sale fixture if retained.
- Consecutive lots, all-full after incoming card, a just-freed canceler slot, last lot, zero supply, and unused Ix Technology decision. Keep physical current/past card references distinct from unsold ownership.
- Ix cancellation with initially empty deck and spend card entering discard, and pool shortage0/1. Existing `tests/ix-technology.test.ts` already covers shortage avoiding an impossible selection; do not regress it with supply minimums.
- Actual auto-allow chains with final opposing Karama spent: Emperor denial→Harkonnen draw→next lot, denied replacement→income→bonus, plus controlled responder retained to prove genuine stop boundary.
- Richese Black Market replacement and normal-end cache decision only under existing supported source contracts; no new canceled Richese count or Technology-on-cache behavior.

## Separate valid-state defect assessment

No confirmed valid-state deadlock found in this read-only pass. Empty/one-card Ix supply is explicitly handled, empty-handed Technology owner can decline, full Harkonnen bonus auto-finishes, and empty eligible bidder sets finish/return unauctioned cards. Missing current paid receipt, malformed order/index/count and inconsistent seller/funding amounts are saved-state corruption risks; do not present them as live-action exploits without a genuine declaration sequence. The existing stronger mutual-alliance replacement-frame check versus one-way producer check matters for legacy/corrupt fixture compatibility, not evidence of a legal alliance mutation during phase3.
