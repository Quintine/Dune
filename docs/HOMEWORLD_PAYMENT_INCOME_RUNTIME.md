# Homeworld payment income runtime

Development checkpoint, 9 September 2026. Low Kaitain and low Junction now reduce supported native faction payment receipts while preserving the payer's original cost. Occupation and divergent allied-contributor rounding remain unfinished. The [source contract](HOMEWORLD_PAYMENT_INCOME_RULES.md) distinguishes printed rules from timing composition and records the pending user question. No Homeworld, Advanced or expansion start gate is opened by this checkpoint.

## Calculation and settlement

[homeworld-payment-income.ts](../game/homeworld-payment-income.ts) quotes the original eligible gross amount, current native low condition, faction income and bank remainder. A supported low receipt rounds its half upward. Eligibility and actual contributor routing are established before this calculation; a Guild-funded share already destined for the bank is not included in Guild's gross receipt. Kaitain counts its own native forces, excluding the Emperor's Salusa allocation.

The payer has already paid when the faction income opportunity opens. [The engine](../game/engine.ts) credits the quoted faction amount once when that opportunity settles; it does not charge again, refund the buyer or replay the shipment or acquired card. Current native population controls the reduction at receipt. This checkpoint adds no Ghola interruption window; pending income retains the existing card-timing boundaries. Rechecking population at receipt is the continuous-threshold composition documented in the source contract, not a dedicated publisher Ghola example.

Ordinary Karama can prevent the separate Emperor or Guild income advantage. The Homeworld penalty itself remains immune. Canceling an eligible native income leaves the payment in the bank and preserves the completed purchase or transport. This supported unoccupied branch does not decide future occupied-income cancellation or beneficiary rules.

Emperor adapters include ordinary paid auctions, the existing Richese cache self-purchase destination, Richese's advanced three-spice special purchase and successful Richese Ambassador paid draws. Emperor buying for itself creates no self-income. Richese's own seller receipts retain their destination. Guild adapters preserve ordinary and legacy shipment, native return, Homeworld shipment and Junction-sponsored route classifications. Free transport and unrelated bank rewards create no new payment income.

## Unanswered contributor rounding

For two eligible odd contributions, rounding the combined payment and rounding each contributor separately differ. A one-spice plus one-spice non-Guild payment would produce either one or two spice for low Guild. The user question is pending; neither result has been adopted for that case.

The engine rejects that unsupported split before a low-Junction shipment declaration or cost commits. This is a temporary scope guard, not a printed prohibition. Single positive eligible contributions and two-contributor splits on which both interpretations agree remain supported. The aggregate quote implements their common result; it must not be cited as resolving blocked cases. Original contribution evidence accompanies the receipt for later validation, including population-sensitive settlement. Player shipment controls and all four AI profiles use the same public funding guard; blocked candidates are excluded before declaration.

## Saved receipts and private information

New Homeworld Guild income responses retain positive original eligible contribution amounts and a matching proof string. The proof binds turn, phase, owner, gross and contributions. It is an internal consistency record, not a cryptographic authentication claim. Validation checks the amounts sum to gross and rejects partial deletion or mismatched initialized metadata before the relevant read or continuation can settle it.

Legacy responses missing **all** new contribution metadata remain compatible. Such a response cannot reconstruct historical payer evidence, and total metadata removal is not distinguished from a legacy shape by this compatibility rule. This limitation is explicit; the checkpoint does not claim complete tamper detection or full recovery certification.

Contribution amounts and their proof remain server-private in the response projection. The public income preview shows the already-paid eligible gross, current native receipt and bank remainder to every seat; it exposes no private acquired card or unrelated spice balance. [The table](../components/game-table.tsx) explains the low split and unchanged payer cost at the ordinary income opportunity. No additional player claim is needed for the automatic arithmetic.

## Verification at this handoff

Final `npm run check` passes types, lint and **3,541 offline cases**. The
production build passes. **40 HTTP integration cases** passed before the final
UI/AI funding-filter adjustment; that adjustment received the final offline
check and build. The three new payment suites add 26 cases: ten pure quotes,
eleven engine/control/AI scenarios and five production SQLite scenarios.
Independent review verified all four profiles and found no secret-state access
in the shared funding guard. It also identified the Ambassador preview-binding
and AI-candidate defects repaired before these final checks.

All **2,894** rooms in the saved maintenance baseline retain their exact versions
and state hashes. This checkpoint added one isolated browser QA room and thirty
HTTP test rooms. No saved game was reset.

Desktop and phone browser checks exercised a five-spice bid yielding three to low-population Emperor and two to the bank. Keyboard allowance and refresh of all three seats passed. The coordinating agent inspected the resulting views and reported no page overflow or browser errors. These are bounded payment-flow checks, not complete Homeworld-game acceptance.

Focused entry point: `npm test -- homeworld-payment-income`. The relevant suites are [pure rules](../tests/homeworld-payment-income.test.ts), [engine flows](../tests/homeworld-payment-income-engine.test.ts) and [production SQLite recovery](../tests/homeworld-payment-income-recovery.test.ts). Their coverage includes source routing, unchanged payer cost, native threshold crossings, allowed/canceled receipt recovery, divergence rejection before commitment, proof validation and private projection. The implementation-status checkpoint records the same scoped evidence; complete expansion games and occupation behavior are not certified.

This documentation/reference pass changes no database or automation. The removed automation remains removed. Occupation retention, occupied percentage recipients and Collection income, remaining Homeworld effects and complete expansion acceptance retain their existing release gates.
