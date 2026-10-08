# CHOAM Auditor implementation

7 September 2026 checkpoint, with an 8 October Advanced revival follow-up. Inspection, component identity and custody rules are connected. This does not certify the complete CHOAM faction or all expansion combinations; public Advanced and expansion starts remain gated.

## Advanced revival follow-up — 8 October 2026

The authorized supplied PDF, physical **p29 CHOAM E**, says the Auditor is
eligible to be revived **each turn**, regardless of how many leaders are in
Tanks. Native ordinary revival now applies that permission after repeated
deaths as well as the first death, with printed cost2 before discounts,
the existing one-leader allowance and unchanged Tleilaxu prevention.
Death history is retained, not reset; own Ghola remains independent.

**Provisional ordinary-cycle policy:** only the five ordinary CHOAM discs
determine the normal cohort. A living or repeatedly killed Auditor neither
delays nor opens that cohort. This is the content-first implementation
choice, not a numerical user ruling or publisher clarification. It is
shown in CHOAM's owned Revival panel and recorded in the rules checklist.
Non-CHOAM cohorts and exceptional Duke custody retain their existing rules.

Two before/after native smoke positions now let Easy revive a second-death
Auditor for two spice and open an ordinary five-disc cycle despite a living
Auditor. Exact death history, price and single allowance are preserved.
Chromium observed actual GameTable SSR options and the provisional warning.
No broad suite, recovery campaign or deployed acceptance was run.


## Authority

The [GF9 CHOAM & Richese rulebook](https://www.gf9games.com/dune/wp-content/uploads/2021/11/CHOAM-Rulebook-low-res.pdf), printed pp.3, 8, 10 and 12, establishes the strength-2 extra disc, matching traitor, survival-based optional inspection, actual-card cancellation cost, revival permission, custody restrictions and Karama prevention. The publisher-authored mirror and its provenance are recorded in [CHOAM_RICHESE_LEADERS.md](CHOAM_RICHESE_LEADERS.md). The [earlier source/engine audit](CHOAM_AUDITOR_ENGINE_AUDIT.md) and independent `/tmp/dune-auditor-source-review.md` record searches and unresolved boundaries. Base ordinary revival is on printed p.9, correcting the earlier audit's p.7 citation.

For Advanced, the [authorized supplied PDF amendment](RULE_DECISIONS.md#authorized-source-amendment--1-october-2026) governs source precedence. Printed publisher components and official clarifications remain sources for omitted details; the five-disc cohort policy above is explicitly provisional.

## Runtime and information

`game/cards.ts` defines the canonical extra `choam-auditor` disc and fresh factory; `leaders('choam')` still returns the five ordinary discs. Advanced setup installs the additional disc before prediction and traitor dealing. Existing traitor and remaining Face Dancer pools include this identity naturally. Capture and Tleilaxu foreign-ghola acquisition reject the canonical ID, not arbitrary display names. Leader Skills remains an unfinished module, so no skill assignment is enabled.

`game/choam-auditor.ts` filters the opponent's current physical hand by exact used-card IDs. Uniform partial Fisher–Yates sampling selects one or two distinct cards; an entire eligible pool needs no random draw. Returned faces are detached snapshots. Eligibility excludes original weapon/defense, hero and late Portable Snooper, including retained cards. It does not inspect a deck, cache, another hand or old discard.

At battle resolution the engine freezes actual Auditor survival, the two combatants, used physical IDs, territory, turn and unique battle event before cleanup. Survival, rather than victory, determines the limit. The same trigger applies after traitor and explosion resolution. The engine preserves these facts through winner casualties, Moritani retention, CHOAM battle income, tech claims and Harkonnen capture, offers the audit, then resumes Face Dancing. This is an explicit application schedule where the sources do not prescribe every competing optional aftermath priority. Capture income can therefore fund cancellation; later Face Dance death does not alter the frozen audit limit.

CHOAM may decline or declare an audit. Declaration opens the ordinary Karama response, including Bene Gesserit Worthless conversion and its counter-cancellation. If uncanceled, the opponent can pay CHOAM the entire current eligible-card count or allow inspection. No partial payment, bank fee, charity multiplication or bribe escrow applies. No payment is collected after Karama cancellation. An empty pool and an unaffordable cancellation proceed automatically without an acknowledgement choice.

The unpaid quote is recomputed after legal intervening hand changes; a payment submits the count it was offered, and a changed count rejects before payment. Sampled faces are generated only after cancellation is settled. Reads, retries and recovery cannot resample the committed result. The owner-only snapshot survives refresh and the move to Spice Collection; it expires when another battle starts or the next turn reaches Storm. It is historical information and never tracks later hand ownership. Generic public decision/response objects and public history contain no candidate IDs or sampled identities.

Pending-state checks bind the current turn, last battle participants, real territory, decision owner, response owner and event. They recognize suspended Box, Richese gift and Worthless-conversion parents. Clearing the pending event precedes post-battle continuation, preventing repeat inspection or payment.

## Revival boundary

Ordinary Auditor return bypasses cohort eligibility on any death count, costs two before existing discounts, and consumes CHOAM's ordinary one-leader allowance. Tleilaxu prevention and allied discount cancellation use the shared revival pipeline. CHOAM's own Ghola card can revive it through the independent card path.

The 8 October source cutover and provisional ordinary-cohort policy supersede the earlier first-return-only implementation. The ordinary-cycle publisher question remains unresolved; the first version does not claim the user answered it.

## Presentation and verification

`components/choam-auditor.tsx` supplies the actual offer, full payment and private inspectable result. All four AI profiles handle these decisions from their authorized view and own hand. `components/leader-portrait.tsx` now resolves both ordinary and exact special identities; this fixed the initial missing Auditor portrait in the live table. The normal disc and enlarged leader inspector carry the new original painting and crisp rules text. Image provenance is in [AUDITOR_ART_GENERATION.json](AUDITOR_ART_GENERATION.json); the 1254×1254 PNG SHA-256 is `68b8d266f088f3b6b43be4edc69d35b77beb8636ec2d0020db8e49762b436ed3`.

Focused suites are `choam-auditor.test.ts`, `choam-auditor-engine.test.ts`, `choam-auditor-bots.test.ts`, `choam-auditor-lifecycle.test.ts` and `choam-auditor-recovery.test.ts`. They cover identity and sampling, real battle outcomes, used-card exclusions, payment changes, nested Karama, privacy, Face Dance survival, native revival, capture, production SQLite recovery and concurrent submissions. Lifecycle setup exercises the unchanged private initializer in an isolated test module while explicitly asserting both public gates stay closed.

Live browser QA used only a new isolated room `FS5PK7VH`, created with CHOAM and a Hard Guild AI. `/tmp/dune-stage-auditor.ts` staged the initial battle fixture and then used real engine battle/traitor actions to produce the offer. CHOAM lost with a surviving Auditor, declared the audit through the UI, and automatically inspected two cards against a zero-spice opponent. Reload preserved the same Snooper and Shield without changing hands, and completing the existing CHOAM market moved to phase7 with the snapshot intact. Root inspected the normal and enlarged Auditor portrait on desktop and 390×844 phone, plus an audited card inspector on both sizes. The viewport was restored. This is a staged interaction check, not a full-game compliance claim.

Full-game sampling found an existing Emperor AI timing bug: it proposed special Karama during a pending CHOAM revival. The authoritative server rejected that proposal. A public pending-revival boolean now lets the AI apply the same timing guard, while retaining Tleilaxu's explicit prevention opportunity and ordinary Karama responses. The original failing state/trace is preserved at `/tmp/dune-auditor-fullgames.json.first-rejection-8.json`; replay and aggregate results are recorded at checkpoint completion.

## Completed checkpoint

- The registered full suite passes **1,560 rules/client/component tests and 137 multiplayer/API tests**, with zero failures. Logs: `/tmp/dune-auditor-final-full.log` (59.96s) and `/tmp/dune-auditor-final-multiplayer.log` (17.15s). Final TypeScript and lint pass; production build passes in `/tmp/dune-auditor-build.log`. All retained processes were polled to terminal success. The coordinating agent read all contributed helpers/tests, reviewed the independent audits, and inspected the generated portrait.
- Corrected same-seed complete-game sample: **20/20 completed**, two through six players × four homogeneous profiles, 14,316 accepted actions, zero rejections/stalls/invariant failures, 100 genuine setup actions and 627 persisted JSON continuations. It exercised 11 audit declarations, eight inspections and three full cancellation payments. CHOAM appeared in every game and each base faction appeared ten times. The unchanged production private initializer was exposed only in an isolated Node VM, without altering resources, hands, forces or decks. These are current-support smoke games, not a claim that the two unresolved revival cases, Kull Wahad or all expansion combinations were exercised or implemented. Homogeneous profiles do not establish comparative difficulty calibration.
- Runner `/tmp/dune-auditor-fullgames.ts`, results `/tmp/dune-auditor-fullgames.json`, summary `/tmp/dune-auditor-fullgames-summary.json`. Results SHA-256: `f87d5999f4f9fe30f790bbef1b9bdf7cec905495f41066d47c49df35445c7987`. Combined source fingerprint: `5ec3860aee4b97def382ace0b65c34a6c978edded2736c85ced490d21d9a58c1`. Root independently compared every measured source after the run with zero changes.
- A second browser-created isolated room, `8S3MRDEK`, tested the opposing human payment control. `/tmp/dune-stage-auditor-payment.ts` produced the decision through actual battle and audit actions. The desktop and 390×844 phone control displayed the exact two-spice price. The user-side click paid two from Guild directly to CHOAM, cleared the pending event, produced no insight, and resumed phase7. Final state has Guild0/CHOAM2 spice with both Guild cards intact. First room `FS5PK7VH` retains the two-card insight at phase7. Saved final states: `/tmp/dune-auditor-browser-final-FS5PK7VH.json` and `/tmp/dune-auditor-browser-final-8S3MRDEK.json`. Temporary viewport sizing was reset.
- At 01:31 UTC, all 1,593 rooms from the latest maintenance backup still had identical JSON hashes and versions; the current database contained 1,686 rooms after isolated test additions. The existing development server remained healthy. No automation was created or restored.
- The final browser reload of payment room `8S3MRDEK` restored Spice Collection, zero Guild spice, both Shield and Snooper, and no pending audit or private audit result. The payment was not repeated.
