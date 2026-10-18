# Moritani Extortion: sequence and payment

Initial primary-source audit, 2026-09-06; placement-first implementation interpretation selected by the user on 2026-09-28. No live-room action was performed for this rule work.

## Sapho payer ordering — 18 October 2026

**Prototyped / Partial.** Juice of Sapho's physical face permits first/last in
an ordered action, and Extortion supplies a finite ordered payer sequence.
The [Sapho source audit](JUICE_OF_SAPHO_ENGINE_AUDIT.md#all-printed-modes-and-applicable-systems)
identifies this composition. No Extortion-specific Sapho clarification is claimed.
Provisionally apply the general card to the **unanswered payer suffix**; this
online boundary is an explicit implementation interpretation under the standing
recommended-choice instruction. It changes neither printed payment nor the
user's placement-first policy below.

While the exact native payer decision is current and otherwise clean, an
unreserved holder who is still an eligible unanswered payer may discard Sapho
to choose first/last. Completed declines stay completed. All other unanswered
players retain relative order; allies and insolvent players remain eligible.
Moritani is not added to its own payer queue. Current-first/already-last positions
cannot consume the card, and no one receives another opportunity. First/last
orders the optional **choice**, not a promised payment.

The original storm payer queue and every use are public ordered-action records.
The ledger retains the receipt through native answers, and validation replays
each change against the original queue, preserving the completed prefix. The
native payer event gains a revision only after a use; older receipt-free events
retain their bytes. A queued last use may leave the same player next, but that
player's older answer event still expires. Physical `g.order`, cursor, token,
collected bank5, balances and later placement are unchanged by Sapho. Actual
payment-time affordability remains the native check.

The next player receives the existing pay3/decline controls; a payment ends all
offers and retires the token, while all declines use native hidden-supply identity
rotation. The public notice displays the remaining names and explains an applied
Sapho order. Only the current payer sees affordability. The owner's hand panel
uses server-derived options; existing minimal policies can play the card and
answer the actual resulting event without strategy refinement.

In the opted-in Semuta preview, the physical discard can pause after reordering.
Its typed continuation parks exactly one **updated** payer decision, binding the
receipt and event. Completion restores that decision without paying, advancing,
recollecting bank spice or restarting placement. Existing continuation formats
remain unchanged. Direct combined claim/capture proof remains open.

Frozen **9 files115/115**, types/lint/build and six original-action/rendered-table
programmes pass. Genuine public Basic/Advanced setup/cache1, first native Terror
placement, paid foreign1 entry/reveal, later actual Mentat placement-before-bank5
and an Atreides decline use120/139 source actions. First/payment3, last/payment3
and last/all-decline use2–4 continuation actions. Moritani gains8 or5 from its
pre-placement balance; payment retires the token, otherwise native identity
rotation restores hidden supply. Prior declines never repeat. LAST leaves Guild
next but rejects its old event. Four profiles make eight legal holder/payer
proposals and complete without strategic refinement.

Only original unopened Spice positions and scalar lotteries are selected.
No dealt hand, counter, wallet, clock, payer queue or receipt is installed.
Seven pure public-order cases cover replay, no-ops, prefix/relative order and
recovered reuse separately from the genuine programmes. Actual GameTable and
isolated enabled/busy card/payer controls render remaining order and owner-only
affordability. Framework aliases/CSS stubs mean no browser clicks or visual/
deployed acceptance. Bounded source/continuation review found no concrete defect.
Frozen feedback corrected only the deliberate-invalid-mode test cast; all checks
then passed together without application rule repair.

Private proof: `/home/quintine/.local/share/dune/checkpoints/20261018-sapho-extortion/frozen-integrated-2/report.json`,
base `2d89ddb6e1aaf63a178c22c4f511fa9f832477e7`, source tree
`0ffe797657fdcac40c92f9282eac32a8495e227703f9777bb729b08389e9dc82`.
Final checkpoint prose/reference evidence is a separately reviewed overlay;
private `documentation-overlay.json` and `git-result.json` bind it to the pushed
revision while engine/helpers/controls/tests remain identical to frozen proof.
Direct combined Semuta claim/capture, broader combinations, complete modes,
final assurance and browser/deployed acceptance remain open. No saved-room/
database, reset, restart or deployment operation was performed.

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

## Mentat ordering: selected interpretation, not a publisher ruling

Moritani may also place or move one Terror token during Mentat. Neither the placement paragraph nor Extortion specifies their relative order. Recovering Extortion first could permit immediately placing it again; placement first cannot. No targeted publisher/designer clarification was found in the audited sources. **The user selected placement first on 28 September 2026.** Resolve the normal placement/relocation opportunity and its Karama response, then collect the deferred five-spice bank award, then offer the storm-order payment decisions. A recovered token cannot be redeployed during the same Mentat Pause. This is a table policy, not a newly discovered rule. [GF9 Ecaz & Moritani, printed pp. 5–6](https://www.gf9games.com/dune/wp-content/uploads/EcazMoritani-Rulebook-LOWRES.pdf)

The token's **own** collection-before-payment sequence is explicit. This implementation preserves the existing Mentat bribe collection before placement, settles Extortion before the no-CHOAM victory check, and keeps CHOAM's later market/Mentat continuation after Extortion. Those cross-effect priorities are software compositions, not separately sourced publisher procedures.

A legal entry may reveal Extortion **during** Mentat after Moritani has already used the placement opportunity (for example, a revived force triggers an Ambassador's free shipment into Terror). Complete the committed entry and its interruptions first, then collect and offer payment before turn advancement. This is the same placement-first table policy applied to a late arrival, not a separate publisher priority ruling. Never let a pending reserve cross a turn boundary.

## Narrow persistence requirements

- Store the specific revealed Extortion token ID, owner, triggering turn and pending five-spice credit. Keep the deferred credit distinct from spendable spice before Mentat. A record separate from aggregate bribes makes once-only collection auditable.
- On Mentat collection, credit exactly five and mark it settled before any payer response. Reloads, failed transactions and nested Truthtrance must not award it again.
- Persist payer order and progress. A valid three-spice payment deducts the payer, credits Moritani and permanently settles non-recovery atomically; later player responses are stale. Declining the final payer returns the exact token once.
- A Nullentropy search or Richese gift can suspend the current payer decision. Validate and restore that exact saved decision through the existing continuation frame without losing the one-time collection or exposing the payer's affordability to other seats.
- Use the existing hidden-supply return helper when recovering. Its identity rotation avoids later linking a public Extortion identity to a newly hidden face. Do not restore the public revealed ID unchanged.
- Treat current-owner eligibility separately from the original entrant. Moritani may have changed allies since revelation; the original target alone is not the payment queue.
- No generic Karama cancellation of revelation/Extortion is stated by the E3 table. Keep existing Terror effect rules and this explicitly selected Mentat-order interpretation distinct.

These are implementation recommendations, not newly asserted publisher procedures.

## Evidence boundary

Compared `/tmp/dune-rules/ecaz-audit.txt` printed pp. 5–6 against the exact official indexed p. 6 paragraph, and searched GF9 and the designer’s site for Extortion, payment, storm order and Mentat placement. The retrieved official paragraph agrees with the local publisher-authored extract. No Extortion-specific FAQ beyond that paragraph was found. Direct publisher download restrictions and crawler timestamps were not treated as edition evidence. No community priority convention was substituted for the missing combined rule.
