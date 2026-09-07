# Juice of Sapho battle integration review

7 September 2026. Read-only audit of saved engine/bots/combat code. No shared source changed. Companion evidence: `/tmp/dune-sapho-stone-probe.ts` and `.jsonl`. The existing `docs/JUICE_OF_SAPHO_ENGINE_AUDIT.md` supplies the verified physical face and official CHOAM FAQ provenance; I did not discover a new timing ruling. The face allows becoming the battle aggressor and separately first/last in an ordered phase/action. It says discard after use. An unresolved current battle is the scope; completed casualties and winner cleanup cannot be reopened. Fine-grained online acknowledgement boundaries below are implementation recommendations, not quoted publisher rules.

## Smallest coherent contract

Keep `Battle.attacker` / `defender` as stable participant-slot identities. Add `aggressor?: string`, default `attacker` for valid legacy saves, validate any explicit value is one of the two distinct combatants. Store the accepted mode against the existing `battle.event`, current turn and physical canonical `richese-juice-of-sapho` identity. A dedicated validator may be shared with other Sapho scopes; accepting this mode must discard exactly that held, unreserved card and change only aggressor plus public log/activation state. Do not swap plans, leaders, preparation owners, traitor holders, stronghold effects, or battle scheduling ownership.

Use the existing central `battleTieWinner` (engine:3079), which is already consumed in ordinary and Stone combat, to return any effective Habbanya card owner among **both combatants** first, then `b.aggressor ?? b.attacker`. Current helper only checks the original defender because the original attacker already wins ties; that shortcut becomes wrong when the original attacker holds Habbanya and the original defender plays Sapho. Stronghold face explicitly says the card owner wins the tied battle (`game/stronghold-cards.ts:48–53`); preserve this specific advantage. Validate impossible duplicate effective Habbanya ownership separately rather than selecting by input array order. Project `aggressor` and retain existing `tieWinner`; the two can differ when Habbanya applies.

Keep first/last battle-phase scheduling in a separate scope/order, even if implemented in the same Sapho module. `battles` (4917), phase entry (5285), `chooseBattle` (12533), and post-battle continuation (7328) currently combine scheduling and pair orientation with physical `g.order`. Changing aggressor in the selected battle must not change `g.order` or the next eligible battle chooser. A phase-priority adapter must deliberately choose which pairs a new chooser can select; merely changing `g.active` while `chooseBattle` still requires `choice.attacker===id` leaves a later-storm-order chooser with no legal action. This is distinct from the aggressor mode.

## Required final intervention boundary

Currently both plans reveal at engine:12707–12723, then Stone/Tooth choices run via `nextRevealedDecision` (6805). The final traitor vote resolves the entire battle immediately at 12761–12764; cancellation/allowance of allied Harkonnen's traitor power reaches the same immediate resolver at 8420–8426. These are the two direct `resolveBattle` call sites.

Introduce one `finishBattleVotes` continuation used at **both** sites. When the public configuration supports Sapho, it opens an event-bound `battle.outcomeWindow` with both combatants' readiness IDs before calling `resolveBattle`. It must open independently of either hand, actual tie, weapons, secret traitors, and whether Sapho is currently in cache/discard. Never auto-close because a server hand scan finds no usable Sapho. Both combatants can explicitly finish; AI proposes a finite pass when it does not play. At both passes, close the window and resolve exactly once. A played Sapho can mark the holder finished if the action contract expressly combines play-and-finish; otherwise require a subsequent explicit finish. Do not reopen this same closed event after normalization/reload.

The window can live on Battle instead of overwriting `g.decision`: votes are settled before it opens; outstanding Harkonnen response must finish first. Reject unrelated phase advance/traitor resubmission/plan rewrites while it is open. Atomic CAS and JSON persistence preserve the same event/readiness/commit flag. After winner cleanup starts (`finishBattle`/casualties/capture/Auditor/Face Dance) there is no unresolved original battle to target.

Allow earlier aggressor declarations at clean, existing battle boundaries as well. In particular do not impose `!b.revealed` or `!b.plans[player]`. Sapho is a separate special card, not a plan role or Portable Snooper: submitting a traitor decision must not by itself exhaust the new final window. Do not use Portable Snooper's owner-has-not-voted restriction (6711) for Sapho. Refusing a declaration during an unresolved nested interaction, while preserving the guaranteed later final window, is safer than overwriting that response; if root permits earlier asynchronous intervention, preserve every suspended field byte-for-byte and validate its continuation against the new tie context.

`settleAutomaticContinuations` (9818) and `finishActionContinuations` must stop on the public final window. Do not model it as a normal Karama response: Sapho is a special card's deterministic effect, and the face does not grant a new Karama cancellation opportunity. Dedicated `sapho` / ready actions placed ahead of the generic decision gate must still honor paid Box, Truthtrance, response, setup, and reservation locks rather than bypassing them.

## Concrete Stone Burner hazard: real counterexample

The pure executable probe confirms:

- Original attacker: Fremen with 0 normal + 1 Fedaykin, free support; Stone Burner dial 0/support 0.
- Original defender: Emperor with 1 normal + 1 Sardaukar, dial 2/support 1.
- `stoneBurnerPlanBlock(Fremen,...,Emperor,'attacker','attacker')` returns null: currently admitted against every opposing commitment.
- Revealed undialed possibilities are attacker `[1]`, defender `[0,1]`.
- Original attacker tie priority gives invariant attacker victory. Sapho making defender the tie winner gives `winner:null`.
- `resolveBattle` (6867–6872) then rejects the saved battle as unresolved allocation before spending resources. This is possible without Ix, whose Stone timing is separately gated.

Thus merely threading a new aggressor into the existing comparisons is insufficient. Small safe integration: while the public rules configuration permits a later Sapho change, make every **pre-commit** Stone completion gate require support under every reachable tie owner (normally both combatants; only Habbanya owner if that advantage cannot change). Apply the same set to Voice compulsion, fixed-prescience completion, Truthtrance plan completion, and bot Stone plan filtering. This is a disclosed implementation boundary for the already unsupported ambiguous-allocation class, not a new printed prohibition.

Do not reject a late Sapho by inspecting the opponent's sealed plan: rejection would leak whether the hidden allocation lands on this boundary and could block an otherwise legal printed use. Do not silently choose casualties to force a result. To enable every printed Stone/Sapho combination, implement a genuine supported simultaneous allocation continuation under its existing source ruling; the conservative guard is not complete card compliance.

For legacy already-sealed plans admitted under the old gate, a new guard cannot retroactively make them valid under both priorities. Keep a migration/unsupported-state policy explicit; never discard Sapho then discover the resolver cannot finish. A public configuration guard before entering such a legacy battle is honest but a remaining limitation. A fully supported allocation model is the durable answer.

## Every current combat tie consumer

| Location | Meaning / integration |
|---|---|
| engine:3079 | Central final tie owner; update both Habbanya owners + explicit aggressor. |
| engine:5746–5752 | Stone plan admission; use reachable priority set for future interventions. |
| engine:5777–5783 | Voice Stone compulsion; same set, only public force possibilities. |
| engine:6855–6862 | Actual revealed Stone comparison; current effective tie owner. |
| engine:7030–7037 | Ordinary dial + surviving leader/KH totals; current effective tie owner. |
| engine:7063–7064 | Outcome text. Stone labels currently call original attacker totals “aggressor”; change to named combatant or stable attacker-slot labels. Avoid claiming Sapho aggressor's totals when displaying the other side. |
| engine:13571 | Public `battle.tieWinner`; retain and add public aggressor. |
| bots:621 | Ideal ordinary plan dial includes half/full-step needed when losing ties. |
| bots:656–662 | Stone candidate guard; must match server's public reachable-priority contract. |
| bots:714–715 | Stone prospective undialed score. |
| bots:1728–1744 | Revealed Stone kill/ignore decision comparison. |
| bots:1815 | Poison Tooth choice score's ordinary winner. |
| stone-burner:60–72,83,159,184 | Pure comparison/plan/Voice helpers already accept side-specific tie owner; no slot swap needed. |

No other current combat numeric tie consumer was found by repository search. `richese-auction.tieOrder` / Silent-auction storm ties are independent and must not be changed by battle aggressor or by unsupported first/last interpretations.

## Voice, prescience, full-plan and private AI

The benefit/target identities at engine:5978–6009 and 12593–12705 are already stored by player ID. Preserve them. `normalizeBattle` selects the opposing slot by identity, not aggressor, which is correct. Voice continues to target its actual selected opponent; Sapho grants no extra Voice or prescience use. Keep `fullPlan.owner/target`, existing revealed element/value, every `plans[id]`, KH blocking and Truth promises unchanged. The completion search delegates to `validatePlan` and so inherits updated Stone admission, but the view's `compliantPlan/compliantPreparation` must be recomputed from the changed public priority.

Use `viewGame` only for Sapho AI decisions. Existing plan AI uses only known `fullPlanInsight` / permitted prescience values; these remain owner-only at engine:13607–13619 and 13663 onward. Add owner-only held-Sapho legal scopes/block reasons, public event/readiness/aggressor/tieWinner, and no public flag derived from ownership. A public final window reveals neither held Sapho nor a tie. Do not include simulated opponent hand contents, opponent completion witness, unpublished traitor booleans, or a “would win now” oracle in private/public controls before both plans are revealed.

At the final window, all four profiles can evaluate the already revealed plans/cards with the existing effects + tie logic and prefer a legal Sapho if it turns an ordinary or determinate Stone tie into a win and no known public traitor/explosion overrides it. They must pass otherwise; Habbanya may make playing pointless. Early policy may estimate using its normal public/known-plan model, but must never replace missing information with authoritative enemy cards. Put this intervention before generic final-window pass in AI priority. Existing global response/decision guards still take precedence for nested interactions.

## Focused validation to require

Both physical orientations; ordinary tied/unequal totals; Habbanya owner in either original slot; original roles/plans/prescience/Voice/full-plan targets unchanged; Stone tie and the concrete ambiguous-pool regression; all four AI levels, before and after plan revelation, own-hand/nonowner perturbation; no second discard/finish after reload/CAS race; both direct outcome paths including allied Harkonnen cancel and autoallow; windows byte-equivalent with Sapho in either hand/cache/discard; no extra turn or changed storm/order/battle chooser; no card intervention after casualty, capture, Auditor or Face Dance begins. Canonical physical identity and all reservation paths (sealed/prescience, pending gift, Black Market, paid Box) must reject atomically.

The broader all-three-mode ambiguities in the existing audit remain: partly completed combined movement turns, normal auction cycle duration, first-versus-Guild precedence and explicit phase-versus-action scope. This battle review does not settle them or silently broaden the confirmed Once Around last rule.
