# Moritani Extortion: sequence and payment

Bounded primary-source audit, 2026-09-06. No runtime edits or live-room actions were performed.

## Confirmed sequence

The official token paragraph orders the events as follows:

1. On revelation, take **5 spice from the bank** and put it in front of Moritani’s shield.
2. **During Mentat Pause**, collect that spice.
3. **Then** recover the Terror token unless one player, approached in storm order, pays Moritani **3 spice**.

Payment/recovery therefore belongs to Mentat after collection, not the original entry/revelation. Payment prevents recovery; it does not cancel or replace the bank’s five-spice award. If paid, Moritani receives five from the bank plus three from the payer, and the revealed token remains removed. If everyone declines, the token returns to hidden supply. Only one payment is needed or authorized. [GF9 Ecaz & Moritani, printed p. 6](https://www.gf9games.com/dune/wp-content/uploads/EcazMoritani-Rulebook-LOWRES.pdf#page=6)

The revealed token is no longer a placed trigger while this is pending. The ordinary Terror rule removes revealed tokens, and Extortion supplies the later recovery exception. It must not trigger repeatedly from new entries before Mentat. [GF9 Ecaz & Moritani, printed pp. 5–6](https://www.gf9games.com/dune/wp-content/uploads/EcazMoritani-Rulebook-LOWRES.pdf#page=5)

## Who may pay?

The paragraph does not restrict the payer to the faction that triggered Extortion or exclude Moritani’s ally. Including the ally follows the broad stated eligibility. This payment is the token’s specified effect, not an ordinary bribe, so the ordinary restriction on bribing allies does not itself prohibit it. Paying three should transfer actual available spice; the text does not authorize pooled payments, a bank subsidy, or use of another faction’s earmarked aid.

**Self-payment is not explicitly answered.** The instruction that a player pays Moritani naturally describes a transfer from another player. Excluding Moritani from the payer queue is the straightforward implementation composition. Treating Moritani as a payer would require an unstated self-transfer procedure, potentially eliminating its own token at no net spice cost. No retrieved official FAQ discusses that behavior; do not claim an explicit published self-exclusion sentence exists.

## Storm order

Use this turn’s storm order, beginning with its First Player and continuing around the table, restricted to eligible payers. Extortion supplies no trigger-relative starting player or reversed order. The base rules establish the First Player from the storm and use that order throughout the turn. [GF9 base rulebook, printed pp. 7, 9–10](https://www.gf9games.com/dunegame/wp-content/uploads/Dune-Rulebook.pdf)

Current `g.order` is recalculated by storm movement and is not reordered by Guild movement priority. It is therefore the appropriate current engine input. A persistent queue should snapshot its player IDs **when the Mentat payment window begins**, with passed players or a next-player cursor. Do not advance the storm, derive order from arrival, or reinitialize passes on reload. Snapshotting at Mentat is an implementation choice that faithfully captures the applicable order; it is not a separate timing rule in the token text.

Do not silently auto-pass an insolvent player merely to shorten the queue if phase-independent effects can raise that player’s available spice before deciding. A visible pass/payment decision and payment-time balance validation avoid that assumption.

## Material Mentat ordering gap

Moritani may also place or move one Terror token during Mentat. Neither the placement paragraph nor Extortion specifies their relative order. Recovering Extortion first can permit immediately placing it again; placement first cannot. This changes a substantive option and is not harmless UI serialization. No targeted official or written designer clarification was found. Keep this combination explicitly unresolved or apply a user-approved interpretation; do not infer priority from the engine’s current handler order. [GF9 Ecaz & Moritani, printed pp. 5–6](https://www.gf9games.com/dune/wp-content/uploads/EcazMoritani-Rulebook-LOWRES.pdf)

There is likewise no retrieved complete priority rule against Mentat bribe collection, CHOAM’s effects or victory checking. The token’s **own** collection-before-payment sequence is explicit. The general placement/Mentat ordering is not. Current `beginPhase(8)` collects bribes and opens Moritani placement, while `finishMoritaniPlacement` may immediately check victory; neither path should bypass an unresolved Extortion obligation. CHOAM has a later end-phase continuation that must also preserve the obligation.

## Narrow persistence requirements

- Store the specific revealed Extortion token ID, owner, triggering turn and pending five-spice credit. Keep the deferred credit distinct from spendable spice before Mentat. A record separate from aggregate bribes makes once-only collection auditable.
- On Mentat collection, credit exactly five and mark it settled before any payer response. Reloads, failed transactions and nested Truthtrance must not award it again.
- Persist payer order and progress. A valid three-spice payment deducts the payer, credits Moritani and permanently settles non-recovery atomically; later player responses are stale. Declining the final payer returns the exact token once.
- Use the existing hidden-supply return helper when recovering. Its identity rotation avoids later linking a public Extortion identity to a newly hidden face. Do not restore the public revealed ID unchanged.
- Treat current-owner eligibility separately from the original entrant. Moritani may have changed allies since revelation; the original target alone is not the payment queue.
- No generic Karama cancellation of revelation/Extortion is stated by the E3 table. Keep existing Terror effect rules and the unanswered separate Mentat-order issue distinct.

These are implementation recommendations, not newly asserted publisher procedures.

## Evidence boundary

Compared `/tmp/dune-rules/ecaz-audit.txt` printed pp. 5–6 against the exact official indexed p. 6 paragraph, and searched GF9 and the designer’s site for Extortion, payment, storm order and Mentat placement. The retrieved official paragraph agrees with the local publisher-authored extract. No Extortion-specific FAQ beyond that paragraph was found. Direct publisher download restrictions and crawler timestamps were not treated as edition evidence. No community priority convention was substituted for the missing combined rule.
