# CHOAM Auditor engine audit

Audit: 2026-09-07 local date. Documentation-only review of the current engine; no runtime, component, test, or start-gate change is claimed here.

## Authority and component identity

The [GF9 CHOAM & Richese rulebook](https://www.gf9games.com/dune/wp-content/uploads/2021/11/CHOAM-Rulebook-low-res.pdf), printed pp.3, 8, 10 and 12, supplies the component, power, payment clarification and Karama entry. The publisher-authored local mirror is `/tmp/dune-rules/choam-lelekan-mirror.pdf`, with extracted text alongside it. Its provenance, hash and independent full-page visual inspection are recorded in [CHOAM_RICHESE_LEADERS.md](CHOAM_RICHESE_LEADERS.md). Fresh publisher-targeted searches recovered the indexed p.8 text but no separate Auditor erratum. Unrelated editions, fan compilations and forum answers were not used as authority.

Printed rule requirements, paraphrased:

- Auditor has strength 2 and is an additional Advanced CHOAM disc. Add its matching traitor identity during setup.
- Using it in battle permits an optional audit: two random opposing hand cards if it survives, one if it dies; exclude cards used in that battle.
- The opponent can cancel by paying CHOAM one spice per actually viewable card. Payment must cancel the whole audit, never reduce its size.
- It can take CHOAM's one ordinary leader revival for the turn without the usual all-leaders-in-the-Tanks prerequisite.
- It cannot be acquired as a Tleilaxu foreign ghola, captured by Harkonnen, or assigned a leader skill.
- Karama can prevent the audit.

The five ordinary CHOAM discs remain five. The extra disc must not inflate the verified sixty-ordinary-leader inventory. `choam-auditor` is a suggested application ID, not wording printed on the component.

## Corrections and ordinary rule composition

The historical `IMPLEMENTATION_STATUS.md` line stating that Auditor “cannot use Ghola” is too broad. The restriction names acquisition **by the Tleilaxu faction**. It does not prohibit CHOAM's ordinary Ghola treachery card revival. `applyGholaEffect` currently permits any dead, controlled, uncaptured leader, which is appropriate for this distinction. The named foreign-ghola action is a different operation.

The power tests leader survival, not victory. Do not implement a winner-only trigger or grant two cards merely because CHOAM won. A living Auditor in a lost battle still satisfies the living branch. A killed Auditor in a won battle satisfies the dead branch. The separate CHOAM battle-income power explicitly excludes traitor calls; the Auditor paragraph does not contain that exclusion. Preserve the generic traitor/explosion outcome, then determine the audit from the Auditor's resulting battle survival. This is composition of the printed trigger with battle resolution, not a new exception.

The added traitor is also eligible for the normal remaining-deck Face Dancer draw: being a Face Dancer is different from ownership as a foreign ghola. No inspected source bans the Auditor identity from that deck. Its audit should be based on survival in the resolved battle, before a later Face Dancer replacement changes leader custody/death. The [Ixians & Tleilaxu rulebook](https://www.gf9games.com/dunegame/wp-content/uploads/2020/09/IxianAndTleilaxuRulebook.pdf), printed p.10 Q&A, places Face Dancer declaration after battle resolution and traitor declaration. The locally verified text is `/tmp/dune-rules/ix-official-mirror.txt`.

Audit inspection transfers no card ownership, discards no inspected card, and grants no card exchange. Keep CHOAM's end-phase two-way alliance exchange independent. Cancellation payment belongs directly to CHOAM; it is the printed payment for the power, not a voluntary bribe or charity receipt. Do not route it into deferred bribe escrow, apply Inflation's charity multiplier, or take a bank fee. Normal combat bounty can change the opponent's available spice before an audit payment.

The [base rules](https://www.gf9games.com/dunegame/wp-content/uploads/Dune-Rulebook.pdf), printed p.7, establish ordinary leader revival costs and death cycles. Auditor's printed strength gives a normal cost of 2; applicable Tleilaxu allied discounts remain a separate existing rule. An Auditor revival must consume the same ordinary leader allowance as another CHOAM disc, not an additional allowance. Ghola-card revivals continue through their separate card path.

## Current implementation findings

| Area | Inspected current state | Required integration |
| --- | --- | --- |
| Ordinary factory | `game/cards.ts` documents Auditor but returns only five CHOAM leaders | Introduce canonical special identity/factory without modifying the ordinary roster contract |
| Setup | `newPlayer` creates ordinary leaders; `start` constructs `traitorDeck` before its per-player setup loop | Install the extra Advanced disc before any traitor draw; idempotently prevent duplicates; Basic and unseated CHOAM must contribute no Auditor |
| Face Dancer pool | `finishSetup` reconstructs `traitorDeck` from players and removes held traitors | Use the same authoritative special identity in both initial and reconstructed pools |
| Native control | Most battle code uses `controlledLeaders` over player leader arrays | An extra native entry can reuse control, leader selection and casualty logic; separate storage would require every consumer to explicitly compose the special disc |
| Capture | `captureCandidates` currently accepts every living controlled leader available in the territory | Exclude Auditor before random selection, including when it is the only otherwise eligible leader; do not select then reroll |
| Foreign ghola | `reviveForeignGhola` and AI already exclude `name === 'Auditor'` | Replace name-based recognition with canonical identity; keep the rule specific to foreign acquisition |
| Ordinary revival | `leaderRevivalOptions` and the action both enforce ordinary cycle eligibility | Add explicit Auditor eligibility and retain shared allowance, pricing, prevention, stale checks and commerce settlement |
| Ghola card | `applyGholaEffect` and `gholaPreparationActions` select dead controlled leaders | Preserve CHOAM's legal card revival; test that foreign-ghola exclusion cannot accidentally prohibit it |
| Battle trigger | `resolveBattle` computes deaths and used cards, then clears `g.battle` | Persist audit facts before clearing battle; never reconstruct them from a later incomplete hand |
| Continuations | `finishBattle` serializes retention, income, tech, capture and Face Dance | Insert a durable audit continuation that resumes exactly once and cannot be skipped by next-battle/phase transitions |
| Responses | `ResponseWindow`, `responseCancelCards`, `finishResponse`, `completeKarama` implement reusable cancellation machinery | Add an explicit audit cancellation reason and recoverable parent state; test Bene Gesserit Worthless conversion and future Kull Wahad nesting |
| Projection | `viewGame` generally spreads decision/response state, with only selected private exceptions | Never place the random result into an unredacted generic decision or response field |
| UI / AI | No Auditor-specific decision, result, strategy or revival quote exists | Add real optional controls, inspectable private results and all four AI decisions; no automatic random selection by a client |

## Suggested durable contract

This is an implementation proposal, not a claim that the rulebook names these stages.

1. At battle resolution, record a unique battle event, CHOAM owner, actual opposing combatant, territory, turn, Auditor identity and survival, and the opponent's physical cards used in the battle. Include the hero card, original slots and any late Portable Snooper. Copy facts before `g.battle = null`.
2. Build the eligible physical-card pool by excluding those used IDs. Winner-retained and Moritani-retained played cards remain excluded even though they are still in hand. Equal card names remain separate physical copies. Do not sample a card from a deck, discard, Richese cache, other hand, or public escrow.
3. Offer CHOAM audit/decline only when there is a nonempty eligible pool. With an empty pool, consume the event automatically and explain the result; no payment or acknowledgement decision is useful.
4. If CHOAM elects to audit, preserve the ordinary Karama opportunity and the opponent's real pay/allow choice. When no payment can be afforded, do not ask for an “allow” acknowledgement. When no player has an available blocker, normalize the response without extra clicks.
5. Only after all cancellation choices have finished, sample the required number uniformly without replacement on the authoritative server. Persist the chosen IDs/faces once. A read, reconnect, AI evaluation, stale request or duplicate submission must never resample. If all eligible cards are seen, no RNG call is necessary.
6. Project the result solely to the auditing player. Public history may report the power, count, decline/cancel outcome and paid amount, but no selected card identity. A selected card's owner already knows its hand; that does not automatically entitle spectators or allies to the selection result.
7. Resume the exact previous post-battle continuation. Do not wait on a confirmation for the automatic reveal result. Provide a readable private component display, keyboard-accessible enlargement and recovery of an interrupted disclosure.

Pool and payment count must stay internally consistent while cancellation is pending. Existing anytime effects can transfer, spend or recover cards during nested responses. Do not blindly freeze the initial pool and later reveal cards that left the hand, or charge a count that no longer exists. Conversely, locking every unrelated action for an entire battle would narrow card timing. Integrate the audit's active interval with the existing transfer/reservation machinery and revalidate actual eligibility before committing payment/sample. If a nested legal action changes the count, update the unpaid quote and explicitly preserve the opponent's resulting choice. Do not consume a payment and then reroll/recharge after continuation.

Avoid creating a permanent omniscient “known current hand” from an audit snapshot: later transfers, plays and redraws invalidate ownership knowledge. The base Atreides power separately reserves written card records to that faction. Recovery of an in-progress disclosure and a permanent CHOAM notebook are different features; the latter is not established by the Auditor text.

## Remaining source boundaries

These do not block implementing the directly stated audit, payment and custody restrictions.

- **Repeated ordinary revival:** Auditor's special permission unambiguously removes the all-in-Tanks prerequisite. Its interaction with the separate base “dead again” cycle is less explicit: does the special permission override that additional cycle restriction too? Do not silently equate “as if all leaders were in the Tanks” with unlimited repeated revival while other discs never die. The present `normalRevivalCycle` relies on every array entry's death count, so a special bypass can affect later ordinary leaders even when only Auditor is being revived. A targeted ruling or further authoritative evidence is needed before claiming those repeated-cycle cases complete.
- **Ordinary CHOAM cycle membership:** the base prerequisite names five leaders, while Advanced setup supplies a sixth. The Auditor paragraph gives its own revival exception but does not explicitly say whether a living Auditor delays revival of the five ordinary leaders. Do not casually copy the explicit Kwisatz “no effect on revival” exemption to Auditor. Resolve this together with the cycle implementation, not through a hidden roster-array side effect.
- **Ordering competing optional post-battle effects:** there is no inspected Auditor-specific ordering paragraph against capture, CHOAM income or newly acquired/discarded cards from other expansions. Many existing effects commute because all battle-used cards are excluded and an audit does not move ownership. Record an explicit application schedule for commuting cases. Only a concrete case that changes a legal outcome warrants a user ruling; absence of a detailed UI sequence alone does not.
- **Pay versus Karama priority:** both prevent the same audit and should not both charge resources. The source does not specify a universal priority between them. Prefer completing cancellation opportunities before taking payment, while preserving legal nested actions; identify this as application scheduling, not a printed timing rule.

No user question was sent by this audit agent. Searches did not establish answers to the two revival-cycle boundaries; no tournament rule has been substituted.

## Required verification before enabling the power

- Setup: Basic versus Advanced, CHOAM absent/present, all player counts, exact extra disc/traitor uniqueness, ordinary factory unchanged, Face Dancer initial/redraw pool and no Duke Vidal traitor contamination.
- Battle matrix: living/dead Auditor on either side; CHOAM victory/defeat; normal weapons, Artillery, activated Tooth, Stone Burner modes, Lasgun–shield, one/two traitors and later Face Dancer replacement. Verify audited count follows actual battle survival.
- Pool: zero through eight hand cards; exclude every used slot, hero and late defense; retain/discard choices on both factions; same-name copies distinguished; Richese cache and escrow excluded; one eligible card costs one even if Auditor survived.
- Choice/economy: decline, pay exact count, reject partial/negative/overlarge/stale amount, insufficient spice automatic allowance, Inflation/bribe separation, bank-spice conservation, combat bounty availability, no payment after Karama and no card movement after inspection.
- Cancellation: ordinary Karama, Bene Gesserit Worthless conversion, restoration from nested Nullentropy/gift/Distrans paths, Kull Wahad when integrated, and unsupported combinations clearly surfaced before accepting an unfinishable action.
- Leader lifecycle: capture pool exclusion before RNG, Auditor-only capture pool, foreign acquisition rejected canonically, Ghola card accepted for CHOAM, ordinary revival shares allowance and price/discount/prevention logic; cycle cases need an explicit resolved expectation.
- Privacy: compare all player projections before and after each stage; allies/spectators never receive selected IDs, faces or hidden candidate lists. Own results do not continuously track the later opposing hand.
- Reliability: persist and recover each genuine decision plus sampled result, concurrent payment/cancel, exact duplicate and stale-event rejection, no RNG on reads, no re-audit after death/revival or a subsequent battle, no skipped pending continuation.
- AI/UI: all four levels complete both sides of each choice without hidden-hand access. CHOAM can value future information; the opponent can value secrecy against spice. Inspect the original special disc and selected cards at ordinary/enlarged sizes, including small screens and reduced motion. No additional automatic acknowledgement button.

This audit establishes requirements and implementation locations. It does not certify any Auditor gameplay or remove Advanced/expansion gates.
