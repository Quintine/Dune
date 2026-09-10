# Emperor Nexus temporary Sardaukar

10 September 2026. This checkpoint implements the bounded native **Cunning** effect in [NEXUS_EMPEROR_RULES.md](NEXUS_EMPEROR_RULES.md). It extends the [Nexus lifecycle](NEXUS_CARD_RUNTIME.md) without enabling Emperor Secret Ally, Betrayal, undersized groups or incomplete mode starts.

## Five existing counters, one battle

An unallied Emperor holding its own Nexus card can declare Cunning during its current Advanced battle before submitting its plan. The eligible army must contain at least five ordinary counters and no actual Sardaukar. A canceled starred-force advantage does not turn a physical Sardaukar into an ordinary counter or satisfy that absence condition.

The declaration spends the Nexus card and opens one ordinary Karama response for the native enhancement. While pending, no temporary roles are active. Allowing the response makes five ordinary counters count as Sardaukar for this battle. Cancellation prevents the whole enhancement and leaves the Nexus card spent. This response is distinct from suppressing actual starred Sardaukar.

The five counters retain their physical identity. No starred counter is created, shipped, revived or removed from reserves. Effective strength and support use a temporary role over the ordinary pool; every loss still removes an ordinary counter. The role ends with its original battle and does not carry to a later battle that turn. A Homeworld army retains its existing physical eligibility and size limits.

| Opponent | Each temporary Sardaukar, supported | Unsupported |
| --- | --- | --- |
| Non-Fremen | 2 strength | 1 strength |
| Fremen | 1 strength | 0.5 strength |

Current applicable Salusa support rules are evaluated through the same combat profile. The effect does not confer free support on the whole Emperor army, and cancellation does not leave a support exemption on counters that never acquired the temporary role.

## Plans, controls and privacy

The shared combat helpers distinguish maximum strength from the number of counters that can receive support. The editor and bots use those helpers for their projected own/opposing armies. For example, seven ordinary counters with five temporary Sardaukar can supply strength twelve against a non-Fremen opponent, but at most seven paid support. Casualty options still contain zero physical starred losses.

Existing Prescience and Truthtrance commitments remain binding when activation is allowed. The authoritative offer checks that activation can preserve them; it cannot reopen an already submitted plan. The controls submit the exact current event and display the engine's blocked reason. A future-strength Prescience answer can include the held Cunning in its reachable preparation without spending the actual card during the search. Its private hint explicitly names Emperor Cunning, followed by the genuine Karama response. Preparation steps can remain open where the battle workflow permits them; live responses, Truthtrance and other action locks retain priority.

If Karama cancels the enhancement and makes an existing inspection impossible, the owner answers that same field again. Other feasible disclosures remain binding, including a disclosed leader. The shared reconciliation also preserves the existing Residual Poison restrictions; it does not decide the unresolved case of two individually feasible but jointly incompatible Cunning answers. Earlier observations remain private historical evidence. Native Prescience, both orders of Cunning fields and Secret Ally inspection have regressions.

Winner casualties retain a saved commitment to the original effective forces, dial, support and every legal physical loss allocation. Independent battle markers detect removed history. Current and suspended choices must match that commitment, and competing requests can settle only one allocation. Completion records survive subsequent battles without applying the temporary role again.

Independent review also caught a pending display inconsistency: the response was still open while force profiles already showed temporary strength. Only an allowed declaration now affects public force profiles. Private future-plan search explicitly models allowance on its own copy; pending and active projections have a regression.

The holder gets one **Use five forces as Sardaukar** action. Declaration and allowance become public, with a pending response notice followed by an active-battle notice. The board and loss explanations identify the counters as physically ordinary. The standard response panel supplies Karama/pass controls and a readable effect name without printing its internal event.

All four bot profiles consume the owner's current offer and wait for the response before boosted planning. The legal-plan search uses the projected temporary-role profile; it does not infer eligibility from another player's hand. Existing Hard/Brutal response policy can cancel a hostile enhancement in the bot's battle. This is legal-policy integration, not a new strategy calibration.

## Verification status and boundaries

The **35 new cases** cover six pure combat/Stone Burner cases, twelve engine cases, eight controls/bot cases, three Homeworld interactions and six production SQLite recovery cases. The independent counter enumeration verifies mixed support and physical loss mapping. SQL cases exercise competing plays and casualty choices, lost acknowledgments, private projections, replay and corrupted source/role/choice records. The genuine Salusa fixtures test high, low and the one-to-two threshold without counting temporary counters as physical stars.

The full-project check passes **4,006 offline cases**, types and lint. The production build and **40 HTTP/session cases** pass. Two isolated three-seat browser rooms exercise declaration/allowance, a twelve-strength/seven-support sealed plan, cancellation after a future-strength inspection and a revised dial of five. Desktop and phone controls, private refresh across all six seats and absence of page errors pass. Screenshots were visually inspected; the 390-pixel phone layout has no horizontal overflow. The non-inspecting third seat receives neither private answer nor sealed plan.

All **3,421** opening saved rooms retain their original versions and state hashes. Thirty HTTP-test rooms and two isolated browser rooms account for all additions. The existing development server was reused; no hourly restart was due at this checkpoint. No recurring automation was created.

An independent review found that a concealed Emperor-owned No-Field cannot arise from the implemented real allied Richese shipment: that path immediately reveals the token and materializes ordinary recipient counters. No fabricated hidden-Emperor fixture is counted as combination coverage. Mandatory discard and Homeworld suspended casualty corruption are validated by the shared receipt checks, but do not yet have separate corruption fixtures for this effect.

Implementation: [shared combat helpers](../game/combat.ts), [owned options](../game/nexus-sardaukar-options.ts), [controls](../components/nexus-sardaukar.tsx), [bots](../game/bots.ts), [table](../components/game-table.tsx), [engine](../game/engine.ts). Evidence: [controls](../tests/nexus-sardaukar-controls.test.ts), [bots](../tests/nexus-sardaukar-bots.test.ts), [physical combat solver](../tests/nexus-sardaukar-combat.test.ts), [engine and inspection](../tests/nexus-sardaukar-engine.test.ts), [Homeworld](../tests/nexus-sardaukar-homeworld.test.ts), [declaration recovery](../tests/nexus-sardaukar-recovery.test.ts), [casualty recovery](../tests/nexus-sardaukar-casualty-recovery.test.ts).

Fewer-than-five interpretation, Emperor Secret Ally purchases/revival and Betrayal remain outside this package. The existing source questions and reaction-policy gate remain explicit. Passing this battle enhancement cannot certify complete Emperor Nexus effects, complete module games or the full expansion goal.
