# Moritani entry timing: bounded primary-source review

Reviewed 2026-09-06. This supplements `MORITANI_TERROR_RULES.md`; it does not enable combined-faction play or certify an implementation order.

## Finding

**The examined primary sources do not establish a complete priority order for Terror, Intrusion, accompanying advisors, shipment income and arrival storm losses.** No retrieved classic-game rule assigns these conflicts to storm order or to the moving player. This is a bounded research result, not a claim that no designer clarification exists anywhere.

## Applicable evidence

- Terror is an optional reaction to another non-allied faction entering a token's stronghold by movement or shipment, including advisors. The No-Field FAQ distinguishes placement from later revelation; Face Dancer replacement is excluded. Enemy of My Enemy precedes the token's revelation. These define trigger boundaries, without ranking the other arrival effects. [GF9 E3, pp. 5–6, 14](https://www.gf9games.com/dune/wp-content/uploads/EcazMoritani-Rulebook-LOWRES.pdf)
- The interruption answer on p. 15 specifically concerns **Ambassadors**, with an Ecaz/Guild example. Extending it to Terror would be an inference, not the printed ruling. [GF9 E3, p. 15](https://www.gf9games.com/dune/wp-content/uploads/EcazMoritani-Rulebook-LOWRES.pdf#page=15)
- Intrusion must occur immediately when the other faction intrudes. The November 2020 FAQ also includes worm rides in that trigger. It predates Moritani and gives no paired priority rule. “Immediate” prevents postponing Intrusion until a later unrelated action; it does not independently establish that Intrusion outranks Terror. [GF9 November 2020 FAQ, p. 4](https://www.gf9games.com/dune/wp-content/uploads/2020/11/Dune-FAQ-Nov-2020.pdf#page=4)
- Spiritual advisors are a separate free shipment caused by another faction's off-planet shipment. Guild shipment payment replaces payment to the bank. The base rules specify those entitlements, without an ordered arrival-reaction procedure. Fremen reserves may enter storm with half losses; the updated FAQ prohibits ordinary movement or worm rides into storm. [GF9 base rulebook, pp. 16, 18–19](https://www.gf9games.com/dunegame/wp-content/uploads/Dune-Rulebook.pdf), [November 2020 FAQ, p. 5](https://www.gf9games.com/dune/wp-content/uploads/2020/11/Dune-FAQ-Nov-2020.pdf#page=5)

Consequently, the exact relationship between paying the shipment, transferring forces, opening Terror and completing other arrival reactions remains an implementation policy requiring an explicit qualification. It should not be described as a publisher-certified interrupt-before-arrival or a generic simultaneous-effects rule.

## Atomics and later allies

The current official indexed p. 5 still says: “From this turn forward, your hand limit is reduced by 1 (as well as your ally’s)”. It does not specify how a later alliance change affects either former or new allies. Both a continuing current-ally modifier and a detonation-time recipient remain interpretations. No targeted clarification was found. [GF9 E3, p. 5](https://www.gf9games.com/dune/wp-content/uploads/EcazMoritani-Rulebook-LOWRES.pdf#page=5)

Implementation recommendation: retain the detonation turn and ally at detonation separately from any chosen effective modifier. That preserves the facts needed for a later correction without pretending that historical custody resolves the rule.

## Research boundary and excluded evidence

Read the existing Moritani audit and the relevant passages in `/tmp/dune-rules/ecaz-audit.txt`, including printed pp. 5–6 and 14–16. Compared the targeted passages with publisher-indexed results. The direct GF9 expansion PDF and its site root returned HTTP 403 in this pass; indexed wording therefore verifies these passages, not the complete latest binary or its publication date. Search-engine crawl/publication estimates were not treated as revision dates.

Searched GF9 and Future Pastimes for Terror/Intrusion/advisor timing, Atomics/alliance changes, simultaneous effects and shipment income. The [designer's expansion page](https://futurepastimes.com/dune-ecaz-moritani) supplied no additional written timing clarification; its rule/FAQ shortlinks also returned 403 through the retrieval tool. Embedded video material was not transcribed, and no community discussion was elevated to designer authority.

One tempting search result establishes turn-order priority for Market cards in the **separate 2021 Dune: Conquest & Diplomacy game**. It is inapplicable to classic Dune. [GF9 2021 rulebook, p. 10](https://www.gf9games.com/dune/wp-content/uploads/2021/07/Dune-Movie-Rulebook-WEB.pdf#page=10)

## Consequences for pending-entry architecture

These are software recommendations, not additional rules:

- Retain an explicit entry event and separate obligations so the selected order can be revised. Do not replay payment or force transfer when a saved continuation resumes.
- An accompanying advisor creates another entry by another faction; do not silently merge it into the original entrant's Terror decision.
- Destructive effects can invalidate saved force/elite casualty counts or intrusion eligibility. Reconcile custody before restoring such a continuation; retaining a response object alone is insufficient.
- Preserve shipment-payment obligations independently of surviving troops. Source review did not establish a Terror refund or cancellation of payment.
- Keep combined timing and Atomics alliance semantics marked unresolved until an authoritative clarification or explicitly provisional table interpretation is adopted.

## Incidental correction escalated to integration owner

The same official November 2020 FAQ p. 5 explicitly permits Fremen to purchase additional revivals when Tleilaxu is present, up to the expanded five-force limit. This contradicts the recent unconditional free-only Fremen implementation under that combination. The integration owner was notified immediately; no runtime or revival-document changes were made in this bounded timing task. [GF9 November 2020 FAQ, p. 5](https://www.gf9games.com/dune/wp-content/uploads/2020/11/Dune-FAQ-Nov-2020.pdf#page=5)
