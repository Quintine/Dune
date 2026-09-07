# Richese Black Market: source checkpoint

Audit: 2026-09-06. This supplements `RICHESE_IMPLEMENTATION_PLAN.md`; it does not enable Richese starts or supply missing cache faces. Retrieval used indexed text from publisher PDFs. Direct opening of the CHOAM/Richese PDF returned 403, so no visual card-face verification is claimed. Only this document was written.

## Official expansion anchors

**R2 p.6:** Advanced-only, before declaration: optionally auction one concealed hand card; sales claims may deceive; Atreides may inspect. Choose normal, Once Around, or Silent bidding. All-zero bidding means retain the card and end the intervention. A sale reduces normal lots by one. Richese receives payments; Karama acquisition is prohibited. Normal-method bids follow storm order; subsequent normal bidding continues its opener sequence. Alternative methods restart normal bidding in storm order. [R2](https://www.gf9games.com/dune/wp-content/uploads/2021/11/CHOAM-Rulebook-low-res.pdf)

**R2 p.5:** Once Around chooses direction; each other faction bids higher or passes once, then Richese has the final outbid choice. Silent offers include zero, reveal together, and use storm-order tiebreaks. Its cache-auction all-zero keep/remove option is superseded by Black Market's mandatory retention. [R2](https://www.gf9games.com/dune/wp-content/uploads/2021/11/CHOAM-Rulebook-low-res.pdf)

**R2 pp.10–12:** Harkonnen gains its bonus for either sale origin. Ixian allies may replace Black Market purchases, even cache-family cards, but not direct cache purchases. Ixian pool size subtracts Richese lots and retains its extra inspection card. Karama can prevent the hand-card sale. [R2](https://www.gf9games.com/dune/wp-content/uploads/2021/11/CHOAM-Rulebook-low-res.pdf)

## Applicable ordinary rules

**B19 p.8:** Full hands must pass, and normal bids start at one spice and must increase. The winner pays the bid and acquires the card after everyone else passes. The normal opening bidder advances from the prior opener, rather than from the winner. Ordinary affordability limits apply unless a valid exception exists. Public hand counts remain visible during bidding. [Base rulebook](https://www.gf9games.com/dunegame/wp-content/uploads/Dune-Rulebook.pdf)

**F20 pp.6–7:** An Ixian ally may inspect its purchase before deciding to replace it. Ordinary Karama can allow overbidding, free settlement, or immediate acquisition, but does not let a full hand bid. Karama cancellation normally prevents one use, not every use throughout the phase; allied advantages can be canceled. The FAQ specifically lists the Harkonnen bonus and Ixian ally replacement as cancelable. [November 2020 FAQ](https://www.gf9games.com/dune/wp-content/uploads/2020/11/Dune-FAQ-Nov-2020.pdf)

**I20 p.9:** Ally replacement happens immediately after purchase: discard the purchased card and draw the deck's top card. Separately, advanced Ixian Technology exchanges a hand card with the upcoming lot once during bidding, before bidding and before Atreides inspection. This is a different operation from the ally's post-purchase replacement. [Ixian/Tleilaxu rulebook](https://www.gf9games.com/dunegame/wp-content/uploads/2020/09/IxianAndTleilaxuRulebook.pdf)

Use the expansion's specific instructions and built-in FAQ over the general rule where they differ. F20 predates Richese and cannot establish a novel Richese exception. No tournament variant was used.

## Interpretations that are not settled by these anchors

- **Self-purchase:** Do not invent a blanket seller bidding ban. The alternative method includes a seller bid, but the retrieved text supplies no separate Black Market self-payment or full-hand-seller ruling. Whether a self-sale consumes the normal-lot reduction also needs an explicit interpretation. Cache self-payment rules are not automatically a Black Market exception.
- **Custody during offering:** No precise escrow or hand-capacity checkpoint was located. Removing a card from the seller's hand merely to make the seller eligible could manufacture eligibility. Keeping the card in hand requires fencing exchanges and other card consumption until settlement. Either representation needs a deliberate custody policy.
- **Overbidding with Karama held:** Preventing acquisition clearly defeats immediate/free purchase. Treating a held Karama as unlimited bidding credit on an ineligible lot would create an unfundable winning bid. Rejecting such credit is the operationally coherent inference; the retrieved expansion does not separately spell out this subcase.
- **Ixian Technology before bidding:** The general power is broader than the FAQ about the ally. No Black Market-specific exchange-custody ruling was located. If supported, exchanging the seller's lot into Ixian custody requires a policy for the substitute and the no-sale return. Do not silently treat the ally FAQ as authority for this distinct operation.
- **Reduction on no sale:** The p.6 sale condition and p.11 pool wording need to be read together; do not decrement the normal pool merely because an offer was announced. No separate correction resolving every canceled/failed offer case was retrieved.
- **Interruption priority:** No precise digital window was specified for canceling the sale relative to disclosure, bidding, payment, and acquisition. Staging the offer before bids and settling nothing until the response closes is an implementation proposal. Do not describe it as verbatim timing text.
- **Discard/replacement:** The ordinary or already implemented card's disposal semantics apply when it is actually discarded. An unsold offer is not a discard. No cache face can be reconstructed from the replacement FAQ.

These are limits of the retrieved primary evidence, not claims that no additional official clarification exists.

## Implementable internal slice and current engine changes

The following is a software proposal, not additional game rules. It can use actual existing `Card` instances from a Richese fixture's hand without inventing cache cards or leaders. Keep the full-faction start gate and label a normal-method implementation as a partial internal slice until alternative methods and unresolved interactions are covered.

1. Add a Bidding entry checkpoint before `setAuction` draws anything. Save the resume checkpoint, current normal opener, seller ID, exact offered card ID, and transaction origin. A public prompt must not reveal the selected face or imply possession of a particular card. Seller selection and card identity stay private except through authorized inspection/acquisition.
2. Store a pending offer, then a dedicated sale-cancellation response. Revalidate exact custody when resolving it. Cancellation and decline must resume the entry schedule without modifying cards, money, or the normal deck.
3. Distinguish `richeseHand` from `normalDeck` transaction origin independently of the card's printed family. Audit `auctionNext`: its current all-pass branch returns remaining cards to the deck and calls `nextPhase`, which is unsuitable for a retained seller card and resumed declaration.
4. Parameterize settlement recipient and the continuation. `continueAuctionSale` currently opens Emperor income; it cannot be reused unchanged. `nextAuction` similarly assumes a normal pool and must not advance/end the phase for a standalone intervention.
5. Reuse the post-acquisition `ixAllyCard` and `harkonnenBonus` machinery through an explicit resume record. The current `settleAuction` already adds the card before the ally decision. Preserve this buyer-private inspection point and prevent duplicated bonus, payment, or pool decrement across responses and reloads.
6. Audit every ordinary Karama bypass together: direct purchase in the card action, `auctionPayment` settlement, bid ceiling, `recoverAuctionPayment`, CHOAM cash-in continuation, and private bot/UI candidates. A lot-origin guard only on the immediate purchase action is insufficient.
7. Preserve exact card conservation through offer, cancellation, all-pass, purchase, Ixian replacement, and resumptions. Never put a hand-origin card into `g.deck` merely because a standard-lot helper returns its unused tail.

Useful focused tests: private seller/Atreides/buyer/opponent projections; canceled offer; all-pass then declaration; positive sale then adjusted pool construction; unfunded bid with a Karama; Harkonnen bonus after purchase; Ixian ally inspection/replace/decline/cancellation; exact JSON round-trip at each suspended checkpoint. Explicitly mark seller self-bidding and Ixian Technology exchange fixtures unresolved until their policies are chosen from sufficient authority.

Validation: read-only comparison against `setAuction`, `offerAuctionTechnology`, `auctionNext`, `settleAuction`, `continueAuctionSale`, `auctionBonus`, `nextAuction`, and the Karama payment paths in `game/engine.ts`. No engine/UI/AI changes or complete Richese-game claims.
