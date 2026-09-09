# Ecaz Ambassador alliance formation

Development checkpoint, 9 September 2026. The reusable Ecaz Ambassador now has
an alliance offer and consent flow alongside direct Duke acquisition. Full Ecaz
and expansion starts remain gated. The optional Duke loan remains unavailable
pending a ruling on its origin, tenure and return destination.

[Publisher evidence and unresolved loan questions](ECAZ_ALLIANCE_RULES.md) and
[the runtime review](ECAZ_ALLIANCE_RUNTIME_READINESS.md) define this boundary.

## Runtime and controls

An actual eligible arrival opens the existing Ecaz-owned Ambassador decision.
When Ecaz and the entrant are both unallied, Ecaz can offer an alliance. Choosing
the offer returns the reusable token to supply immediately without changing the
five random tokens. The entrant alone then accepts or refuses. Acceptance forms
the reciprocal pair, records the current turn, clears obsolete proposals to or
from either participant, and resets Ready. Refusal forms no alliance and grants
no replacement Duke effect. Both outcomes resume the original entrant’s remaining
actions; a worm rider continues its original remaining-ride sequence.

Alliance eligibility uses only public seated identities and alliance links. It
is independent of Duke availability, including the separate Advanced Harkonnen
acquisition gate. The engine does not alter Duke, native leaders, private cards,
spice or committed shipment counters when resolving this alliance. The ordinary
Nexus action retains its phase restriction; the new permission belongs only to
the current Ambassador event.

A pure quote in `game/ecaz-alliance.ts` validates the public roster and produces
the reciprocal links and cleaned offer record. Engine integration binds the
entry’s owner, entrant, turn, phase, returned physical token and reply owner.
The existing arrival-continuation validator also protects worm provenance.
Action, view and automatic-recovery entry points reject orphaned or corrupted
controls. Supported Nullentropy Box and other card suspensions preserve the
reply until their own decisions finish. Room version checks allow only one
competing acceptance/refusal to commit.

The owner sees separate Duke and alliance choices, each with its own availability
reason. The entrant sees explicit accept/refuse controls. Other seats see who
must act. All four AI profiles prefer an available alliance offer, otherwise use
the existing Duke/decline path, and accept valid owned replies. The chronicle
explains token return, consent and continuation; successful formation emits the
existing configurable house-colored automatic notice.

## Coverage checklist

| Area | Evidence | Remaining |
| --- | --- | --- |
| Implementation | Public quote, actual arrival, token commitment, consent, reciprocal links, continuation and saved-control integrity | Optional Duke loan; full faction and module combinations |
| Player controls | Independent blocked reasons, owner offer, entrant accept/refuse, public decision ownership | Full multi-human mobile faction journey |
| AI | All four levels propose/accept via their own projected state; existing Duke fallback tested | Relative negotiation strength and complete expansion games |
| Documentation | Internal Ambassador guide and five-area checklist, source contract, runtime and implementation reports | Loan ruling and complete expansion guidance |
| Verification | 8 pure, 18 engine and 4 production-room SQLite tests; mobile keyboard proposal, real AI acceptance and refresh | Loan lifecycle, full Advanced/expansion acceptance |

The engine tests cover Basic/Advanced actual shipment, either already-allied
participant, unavailable Duke, valid Moritani and BG fighter entrants, BG advisor
exclusion, refusal, private prediction independence, worm continuation, all four
AI levels, genuine paid Box suspension and invalid live/suspended receipts.
SQLite tests use production migrations, authentication and room code. Duplicate
and opposing accept/refuse requests race at the actual compare-and-swap; exactly
one wins. Reload preserves seats and private data, while stale, duplicate and
corrupted commands reject before a write. Unrelated rooms are preserved.

## Browser evidence

Isolated QA room `8S3MRDEK` was backed up at version 126. A staged Advanced
position retained the three authenticated QA seats and used an actual engine
shipment to create version 127’s Ambassador offer. Duke was deliberately in the
Tanks and an Advanced Harkonnen seat was present, so his acquisition remained
unavailable while the alliance action remained enabled.

At 390×844, the browser displayed the distinct actions and availability text,
with visible keyboard focus and no clipped action text. Keyboard Enter submitted
the offer. The Medium AI entrant accepted and made its remaining movement.
Version 132 retained reciprocal Ecaz/Emperor links, the same dead Duke, unchanged
spice, an unchanged random Ambassador cohort and the reusable token in supply.
Refresh restored the alliance. The chronicle contains one offer, one acceptance
and subsequent movement. The normal viewport was restored. This verifies the
owner’s browser flow and AI reply; human reply behavior is covered by engine and
SQL tests, not claimed as a separate authenticated browser session.

All **2,586** pre-existing non-QA room versions and state hashes remained unchanged
before the new HTTP test fixtures. QA snapshots and evidence are local under
`/tmp/dune-ecaz-alliance-qa-*.json` and
`/tmp/dune-ecaz-alliance-browser-evidence.json`.

## Validation status

`npm run check` passed typecheck, lint and **3,058 offline tests**, including all
30 new alliance cases. `npm run build` passed. `npm run test:integration` passed
**40 tests** against the local development server. The independent review found
no remaining concrete defect in the implemented consent flow.

Twenty public-start Basic AI games across two through six players and all four
levels completed **12,186 accepted actions** and **545 JSON round trips** with
zero rejected candidates, stalls or invariant failures. Seed: `20261025`.
Game-source fingerprints stayed unchanged throughout. These homogeneous-level
Basic games check shared-engine regressions; they neither exercise gated Ecaz
starts nor measure relative AI strength.

Logs: `/tmp/dune-ecaz-alliance-check-final.log`,
`/tmp/dune-ecaz-alliance-build-final.log`,
`/tmp/dune-ecaz-alliance-http-final.log`, and
`/tmp/dune-ecaz-alliance-fullgames.json`.

The full goal remains active. No Advanced, expansion or optional-module start
gate was opened. The removed maintenance automation was not recreated.
