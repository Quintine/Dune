# Homeworld payment income runtime

The 14 October 2026 user ruling resolves allied rounding: low native income is `ceil(total eligible invoice / 2)` once, not a sum of rounded contributor legs. Original payer costs and eligibility stay unchanged. Fresh classic `banker-income --homeworlds` additionally connects actual final Bank portions to original Mentat; occupation receipts remain authoritative. See [the current Banker contract](SPICE_BANKER_RUNTIME.md#classic-homeworld-final-bank-income--14-october-2026). This is not complete Homeworld or deployed acceptance.

## Calculation and settlement

[homeworld-payment-income.ts](../game/homeworld-payment-income.ts) quotes the original eligible gross amount, current native low condition, faction income and bank remainder. A supported low receipt rounds its half upward. Eligibility and actual contributor routing are established before this calculation; a Guild-funded share already destined for the bank is not included in Guild's gross receipt. Kaitain counts its own native forces, excluding the Emperor's Salusa allocation.

The payer has already paid when the faction income opportunity opens. [The engine](../game/engine.ts) credits the quoted faction amount once when that opportunity settles; it does not charge again, refund the buyer or replay the shipment or acquired card. Current native population controls the reduction at receipt. This checkpoint adds no Ghola interruption window; pending income retains the existing card-timing boundaries. Rechecking population at receipt is the continuous-threshold composition documented in the source contract, not a dedicated publisher Ghola example.

Ordinary Karama can prevent the separate Emperor or Guild income advantage. The Homeworld penalty itself remains immune. Canceling an eligible native income leaves the payment in the bank and preserves the completed purchase or transport. This supported unoccupied branch does not decide future occupied-income cancellation or beneficiary rules.

Emperor adapters include ordinary paid auctions, the existing Richese cache self-purchase destination, Richese's advanced three-spice special purchase and successful Richese Ambassador paid draws. Emperor buying for itself creates no self-income. Richese's own seller receipts retain their destination. Guild adapters preserve ordinary and legacy shipment, native return, Homeworld shipment and Junction-sponsored route classifications. Free transport and unrelated bank rewards create no new payment income.

## Ruled whole-invoice rounding — 14 October 2026

Two eligible odd contributions are now admitted; the former comparative fence and UI/AI exclusion are removed. Five plus three yields native4 and Bank4 when unoccupied and low. Attribution floors each remaining contribution’s half and assigns any extra Bank rounding unit to the declared primary payer first, then the ally. This is internal only: no payer, funding, eligibility or rounding identity is newly projected.

When Bureaucrat redirects two, choose the first individually eligible contribution (declared payer first, ally second), subtract two before the native/occupied calculation, and combine that payer’s two with their own other final Bank portions of this invoice. Never pool payers or unrelated invoices. Thus low unoccupied5+3 becomes native3, retained Bank3, diversion2 and final payer Bank legs4/1; it earns one deferred Banker spice. Occupied cancellation instead banks only the native share;5+3 then leaves Bank legs3/1 and earns none. These accounting choices are user rulings, not publisher worked examples.

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

Focused current evidence includes [whole-invoice quotes](../tests/homeworld-payment-income.test.ts), [Bank attribution](../tests/homeworld-bank-payment.test.ts), [native Banker consumers](../tests/homeworld-banker-income.test.ts), [actual off-planet transport](../tests/homeworld-banker-transport.test.ts) and [existing engine flows](../tests/homeworld-payment-income-engine.test.ts). The 9 September recovery/full-suite counts above are historical evidence; comprehensive assurance is deferred until all rules are implemented. The current frozen related18-file union passes292/292, types/lint and app build pass; actual390px Bureaucrat and native Mentat controls are recorded in the linked Banker contract.

This documentation/reference pass changes no database or automation. The removed automation remains removed. Occupation retention, occupied percentage recipients and Collection income, remaining Homeworld effects and complete expansion acceptance retain their existing release gates.
