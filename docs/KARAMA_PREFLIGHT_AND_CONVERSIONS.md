# Karama preflight and conversion recovery

7 September 2026. This checkpoint fixes existing Bene Gesserit conversion interruptions and extracts prerequisites needed before a future Karama discard pause. It does **not** implement the complete `karamaCostDiscard` producer, all canceled response bindings, or new rules interpretations. Public Advanced and expansion starts remain gated.

## Actual play defects fixed

A BG direct purchase originally left the previous normal-auction bidder in place until conversion succeeded. After spending its Worthless card, BG could accept two Richese gifts to fill its hand; conversion then awarded the original auction card as a fifth card. Incoming transfer validation now reserves the pending purchase's slot even before BG becomes bidder. One gift that leaves room remains legal. The pre-fix reproducer is `/tmp/dune-bg-karama-gift-probe.ts` with its corresponding log.

A second interaction requires two future cards to be counted together. Harkonnen may take a card during a pending BG purchase, temporarily reducing BG's hand. A gift must leave room for both the obligatory hand return and the pending auction card. Checking each requirement independently accepted a second gift and left the mandatory return unable to finish. The revised calculation combines the return count and one auction slot, without counting multiple descriptions of the same auction purchase twice. It also supports older saves whose optional Richese-auction field is absent; that case was caught and corrected in the full regression run.

## Original opportunity across allowed interruptions

New BG shipment, direct-purchase and winning-payment conversions carry optional `opportunity` metadata containing a kind and internal consistency signature. Shipment binds the original owner, recipient, active unused shipment, rate absence, movement queue, turn and phase. Auction binds the original normal pool/card/index, bid/bidder/share, opener/order, turn and phase, with no overlapping paid sale or Richese lot. These values are never restored as a replacement Game. The new metadata is not sent to any player's view.

Hands, balances, response passes, logs and AI control are deliberately excluded. Actual Richese gifts, Distrans outside an unpaid lot, Truthtrance, paid Box searches, Harkonnen hand exchanges and special Richese purchase-income interruptions can still change those independent values. Matching controls are found in live state and gift, Box, purchase-income, summoned-worm and completed-discard resumes. Harkonnen's exchange stores the conversion response separately; the lookup follows that response even when a later Box or gift suspends the hand-return decision.

New stamped contexts require the matching Worthless response owner/kind. The current normal auction card must also exist in only its actual pool, with no duplicate in a hand, deck, discard, cache, removed pile, Ixian live pool or Ornithopter escrow. Historical auction prefixes and knowledge receipts are excluded from physical custody. Signing the pool while leaving hands unsigned is safe only with this separate custody check.

These stamps detect inconsistent saved state, not coordinated rewriting of every recorded value. Metadata-absent legacy conversions remain supported; their original identity cannot be retrospectively authenticated. Existing current-opportunity/capacity checks still apply when they resolve. Source-specific canceled-response stamping remains unfinished.

## Pure checks before consuming the card

`validateKaramaUse` now checks the known prerequisite failures before `spendKarama` discards, and checks the allowed use again before completion. Normal auction use validates the original unresolved lot; winning payment must belong to its actual bidder. Direct purchase retains its existing pre-cost eligibility requirement. Winning payment and a same-actor Richese cancellation can free their own incoming slot by spending the activating card; their initial quote accounts for that one card without mutating a hand.

The existing unsupported Richese normal-count cancellation rejects before either a printed Karama or BG conversion is accepted. A printed cancellation of an **older BG attempt** at that unsupported use is different: it restores the original Richese response and never executes the unsupported cancellation. That legacy recovery remains legal.

`game/richese-settlement.ts` provides a pure branch/payment quote shared by actual settlement and relevant cancellation preflight. It preserves unbid Black Market retention, the unbid cache choice/removal distinction, exact winning funding and payer split, last-slot capacity and the existing Black Market self-purchase guard. A separate pure cache check preserves the existing exhausted-cache declaration boundary. Quotes never draw, sample, pay, transfer, log or allocate a new event. Actual settlement performs those existing effects once after validation.

Canceled Black Market and Atreides Richese-peek paths validate the current phase/round/owner and their intended settlement branch. A documented saved sold-peek scenario covers corruption before its card or funding is consumed; today's ordinary final bid settles immediately, so those tests do not claim that constructed pause is produced by current public actions.

The original public action and voluntary promise reconciliation remain atomic. No general normalizer or effectful cancellation is used as speculative preflight. Exhaustive cancellation suffix checks, original-actor promise feasibility before a durable cost, and successor-frame handling are still required by [KARAMA_COST_PREFLIGHT_REVIEW.md](KARAMA_COST_PREFLIGHT_REVIEW.md).

## Verification

New tests are registered in the standard suites:

- `tests/karama-preflight.test.ts`: 25 scenarios for both forms, unsupported count, legacy nested cancellation, malformed and valid Richese settlement, zero-RNG rejection, and post-cost capacity.
- `tests/richese-settlement-preflight.test.ts`: 12 pure/engine scenarios, including 90 valid exact splits, immutable quotes, detached results and unchanged unbid behavior.
- `tests/bg-karama-opportunity.test.ts`: four scenarios for the original gift overflow, winning payment, actual Distrans/Truthtrance, 36 malformed opportunity/custody/control variants, and legacy recovery.
- `tests/bg-karama-nested-controls.test.ts`: five actual nested action sequences, with conserved unique card inventories and JSON recovery after every accepted action.
- `tests/bg-karama-opportunity-recovery.test.ts`: four production SQLite scenarios with real migrations, authenticated seats, module reload, concurrent final allowance, actual discounted shipment, paid Box restoration, rejected second gift and 24 malformed direct/gift/Box states with zero writes.

The coordinator reviewed every complete new source and test file. Independent findings and their resolutions are in [BG_KARAMA_OPPORTUNITY_REVIEW.md](BG_KARAMA_OPPORTUNITY_REVIEW.md) and [KARAMA_CONTEXT_RUNTIME_REVIEW.md](KARAMA_CONTEXT_RUNTIME_REVIEW.md). The legacy `karamaAuction` test fixture now relocates its selected physical card out of the shuffled deck instead of duplicating it; production custody validation was retained.

Final verification passes: **1,812 rules/client/component tests and 188 multiplayer tests (2,000 total)**, TypeScript, lint and production build. Logs are `/tmp/dune-karama-context-full3.log`, `/tmp/dune-karama-context-multiplayer2.log`, and `/tmp/dune-karama-context-final2-{type,lint,build}.log`. The final full rules run caught and resolved the absent optional-auction-field issue described above; earlier failed runs are retained as diagnostic history.

The final unchanged-source Basic matrix completed **20/20 games**, covering two through six players at each of the four homogeneous AI profiles, with **14,230 accepted actions, zero rejected candidates or stalls, and 627 JSON round trips** in 74.477 seconds. Results are `/tmp/dune-karama-context-final-fullgames.json` and its corresponding log; master seed is 20261008. This is a bounded completion sample, not relative-strength calibration or Advanced/expansion acceptance. Its trace contains five printed-Karama auction payments and ten printed-Karama cancellations; dedicated tests provide BG and Richese coverage. Engine SHA-256 is `f67f3b9fdc8a1871e963e5970e8b5efef6ae36ded1ab61cf276933b70eb3e08a`; matrix source fingerprint is `7df283a38b6b45b13482fbb39b05dbe3cb6e9fc71bac5ee0947cc556c186a427`.

Browser QA used only the explicitly staged private test room `8S3MRDEK`. An actual BG purchase declaration consumed Baliset once and displayed the Worthless-as-Karama response, two remaining private cards and 20 spice. Refresh and the subsequent server restart retained the same pending response and private hand. This is an intentional wait for the other human-designated QA seat, not a stalled game. The original auction card remained concealed. Browser evidence covers declaration and recovery; the automated SQLite scenarios cover final allowance and concurrency.

At approximately 05:50 UTC on 7 September, after integration tests stopped and active-room activity was checked, manual maintenance saved all **2,076 rooms**, restarted the development server, and verified exact room versions and JSON hashes plus HTTP health. Backup: `/tmp/dune-maintenance-20260907T0550/database.sqlite`. QA remains version 59; the known human room remains version 14. The restored browser was inspected afterward. Next manual maintenance is due around 06:50 UTC if active work and human play permit. The removed automation stays removed.

The recorded source/test/document manifest is `/tmp/dune-karama-context-final-hashes.json`; the checkpoint is `/tmp/dune-karama-context-checkpoint.md`. These results do not certify the full goal.

## Remaining work

No new Semuta opportunity or pre-effect Karama discard frame is active. Full cancellation-context validation, promise-aware cost acceptance, special Karama discard producers, remaining consumed cards, unresolved source questions and complete Advanced/expansion/module acceptance remain open. The maintenance automation remains removed at the user's request.
