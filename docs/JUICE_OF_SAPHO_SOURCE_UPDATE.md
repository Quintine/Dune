# Juice of Sapho: fresh primary-source and ordering review

Reviewed 7 September 2026. Read-only task; no project runtime changes. This supplements `docs/JUICE_OF_SAPHO_ENGINE_AUDIT.md`; it does not convert its unresolved interpretations into official rulings.

## Evidence checked

- Visually inspected `/tmp/dune-rules/choam-sapho-reading.png`, the readable physical publisher card face documented in `docs/RICHESE_COMPONENTS.md`. The [component photograph](https://cdn.anyfinder.eu/assets/QsUJtVktEC87xwK08oLlwnKyaozUWfuaLzG0LFEn67ENEEVgNrDGoITy3608Dqe7) is hosted externally; photographer, printing history and upload provenance are not independently established. Its visible text supports three alternatives: become battle aggressor; go first in a turn-ordered phase/action; go last in such a phase/action, explicitly superseding Guild. It says to intervene in the applicable phase and discard after use. It does not describe auction duration or suspension of an already-started movement turn.
- Fresh official-domain searches recovered the publisher's [CHOAM/Richese rulebook p11](https://www.gf9games.com/dune/wp-content/uploads/2021/11/CHOAM-Rulebook-low-res.pdf). Its Sapho FAQ confirms going last in Once Around. Local readable mirror `/tmp/dune-rules/choam-lelekan-mirror.txt` agrees. Page5 gives each participant one bid opportunity and normally puts Richese last; Richese must outbid, not match. Silent bidding is simultaneous with storm-order ties. Page6 requires normal Black Market bidding in storm order and specifies how subsequent normal bidding resumes. None supplies a general Sapho duration or first-versus-Guild rule.
- Fresh official search also verified [base rulebook, Guild p19](https://www.gf9games.com/dunegame/wp-content/uploads/Dune-Rulebook.pdf): Guild may choose its combined shipment/movement turn between other turns, preserving their sequence. Local `base.txt` also shows p9's shipment-then-movement sequence, p8's cyclic bidding until other players pass and next-card opener to the previous opener's right, and p10's battle ordering and aggressor tie advantage. These are underlying mechanics, not additional Sapho rulings.
- Searched official GF9 pages for Sapho with first, Guild, movement, auction, round, FAQ and later FAQ terms. Also searched local Ecaz text: no Sapho-specific clarification found. Broad search occasionally returned irrelevant GF9 game pages, which were excluded. Search-result crawl/publication metadata is not proof of a revised rulebook edition.

**Finding:** no fresh authoritative source located that resolves the earlier audit's three material boundaries: partly completed shipment/movement, duration/circuit behavior of ordinary cyclic auctions, and Sapho-first priority against an exercising Advanced Guild. Absence of a search result is not proof no ruling exists. Do not present a chosen convention as newly verified official text.

## Implementable contract, separated from unresolved extensions

### All modes: event identity and physical custody

Declare exactly one mode against a current concrete ordered action or live battle. Validate physical ownership and any existing card reservation; atomically discard and apply the effect once. Persist an event-bound effect, not a mutable global seat order. Duplicate or stale requests must not discard again or target a later event. A completed auction/battle/turn is not an available event; no implied refunds, replay, additional bids, extra movement, or initiative carried into later turns.

This is an implementation contract derived from the face's intervention and discard instructions. Server action serialization is necessary recovery behavior; it does not establish a physical simultaneous-card priority rule.

### Movement first/last

At an actual boundary between combined turns, reorder the remaining **unstarted** participants, retaining all others' relative sequence. Record a protected-last participant for this phase; Guild's later decline/defer operation must insert Guild before that participant, since LAST explicitly supersedes Guild. Do not reset `shipped`, `moved`, Hajr usage, Fremen range cancellation, transport choices, temporary allied occupation deadlines, or pending continuations.

If another faction is halfway through shipment/movement, retaining that active turn and applying the order change at its completion is a defensible bounded implementation, but it must be described as a supported boundary, not a verified entitlement to interrupt that faction. Moving the active faction itself to last after shipping would split a combined turn: sources inspected do not resolve it. The current engine's `movementRemaining` membership alone cannot distinguish unstarted from partly completed. An active seat may have committed movement before shipping was skipped, used a card, or have an outstanding shipment reaction. Both flags and pending declarations matter.

Sapho-first versus Guild-first remains a competing-priority question. The card expressly resolves only last. Preserving a pending Guild decision, or deferring first until after Guild's resolved choice, is an implementation restriction; globally suppressing Guild is a substantive interpretation. Do not cancel an already granted Guild turn or consume its power in a silent order rewrite.

### Finite Once Around first/last

The narrow last adapter is expressly supported: move an eligible, not-yet-acted participant to the end of the remaining opportunities, including after Richese. Keep highest bid, funding, passes, completed opportunities, physical lot and event intact. Recompute the next actor from unacted participants. Richese must not be restored to last after each bid. First follows the general face wording, although the specific FAQ only confirms last. Neither mode authorizes a second opportunity after the holder already acted.

Discard frees a hand slot. Determine eligibility for a previously full holder using the actual post-discard state if the current action remains available; a static initial eligible array should not by itself make that legal use impossible. Conversely do not reopen a settled lot, restore a completed pass, or silently undo other bids. These cases deserve explicit adapter tests.

### Ordinary cyclic and normal Black Market bidding

The source guarantees an order effect exists for ordered actions, but does not specify the cycle anchor or duration in a cyclic auction. Plausible implementations (one upcoming circuit, whole current lot, or full Bidding Phase) have different winners and opener sequences. None was resolved by this review.

Before enabling any such adapter, specify its selected scope and test that it preserves ordinary raise/pass termination. A last bidder is not entitled to buy at the standing price: every acquisition still requires a legal bid and the ordinary closing condition. Simply moving the holder to the end of an array while advancing from a numeric cursor can skip or repeat seats; immediately changing `active` can deprive another seat of an existing opportunity. A first/last array position without a declared cycle anchor has no stable meaning once bidding wraps.

Keep the previous actual opener by player ID independently of the transient queue; next-lot physical-right rotation and Black Market resume cannot use a now-reindexed integer. Preserve bidder, amount, ally contribution, passes, payment/peek/bonus continuations and discard-caused hand-capacity changes. Once Around confirmation does not automatically settle these normal-auction questions.

Silent auctions have no sequential bid opportunities. Do not alter their storm tie order or expose submitted values via a fabricated Sapho-first/last window.

### Aggressor and battle-selection order

Aggressor mode belongs to a participant in an unresolved battle and changes aggressor status for that battle, not control of every subsequent battle or another faction's forces. Store the effective aggressor separately from participant/plan identity; no need to exchange the entire attacker/defender state. Route ordinary ties and Stone Burner undialed-token ties through the effective aggressor, while retaining Habbanya's explicit tie override. Preserve special outcomes with no ordinary winner.

The face has no before-sealed-plans qualifier. A blanket restriction to initial planning would be an implementation boundary, not a sourced printed restriction. Live, post-reveal intervention needs a real window before resolution commits; no retrospective rewrite of paid battle costs, deaths, capture, Auditor or retention aftermath. Battle-choice first/last concerns the scheduling queue and should not silently rewrite an already selected battle's other keyed facts.

## Current integration seams and failure probes

Line positions describe the inspected baseline and may move during root integration:

- `game/engine.ts:5002` `movementTurn`, `:5026` `chooseGuildTiming`, and `endMovement` near `:12515`: persistent remaining-order adapter; protected-last logic must survive every Guild defer and recovery.
- `game/engine.ts:2967` `setAuction`, `:3289` `auctionNext`, `:3369` `nextAuction`, `:3674` `recoverAuctionPayment`: every one currently consults `g.order` or integer `opener`; changing only the next-bid action is insufficient.
- `game/richese-auction.ts` `moveRicheseBidderLast`: existing isolated Once Around hook already separates `order`, `acted`, `tieOrder` and event; actual card custody/discard belongs in engine. `submitRicheseBid` has a separate cyclic normal branch.
- `game/engine.ts:4917` `battles`: physical order currently determines generated attacker and enumeration; distinguish scheduling priority from battle participant identity. `battleTieWinner` near `:3079` is the existing effective-tie seam.
- Test one already completed movement turn, another partially committed turn, pending ordinary/Guild shipment and Hajr; Guild repeatedly defers while Sapho-last remains last. Test full-hand discard creates eligibility, acted Once Around cannot reenter, after-Richese outbid, normal wrap and next opener, Silent unchanged, and stale reload/CAS exactly-once discard. Test aggressor after both plans with Stone/Habbanya/no-winner outcomes and hidden opponent plan invariance.

No source-supported new global order, extra action, retroactive reversal, or blanket Karama-cancellable Sapho power was found. Sapho is a card effect; Guild's separate faction advantage can retain its existing Karama handling without inventing Karama cancellation of Sapho itself.
