# Automatic actions and player decisions

Read-only engine/UI/API audit, 2026-09-06, against the updated goal's requirement: automatic effects should not require confirmation; optional 1–2-second house-colored action notifications must not block play. Only this audit document was written. No rule or timing interpretation was changed.

## Safest concrete removals

| Current behavior                                                                                                                                                                                       | Why it is redundant                                                                                                                                                | Safe implementation boundary                                                                                                                                                                                                                                                                                                                                                                   |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `resolveBattle` creates `battleLosses` even when `casualtyOptions` contains exactly one result (`game/engine.ts`, approximately 3753 and 3873).                                                        | There is no choice of unit mix. Even a zero-loss result can require a click. This differs from storm casualties, which already resolve a forced mix automatically. | Extract the existing settlement of the selected option from the `battleLosses` handler. Invoke it directly for one option. Preserve the following Ixian substitution decision, winner card-retention choice, and postbattle continuation. Do not bypass them by merely calling `finishBattle`.                                                                                                 |
| Every power owner must submit `passResponse` for its own power; completion currently counts every player (`game/engine.ts`, approximately 5695–5715; `components/game-table.tsx`, approximately 1495). | The same dispatcher explicitly forbids the owner from canceling its own power. This pass is not an ordinary Karama cancellation choice.                            | Count the owner as satisfied using public `response.owner`, while requiring all other participants' passes. Use one shared responder predicate for engine, bots and UI; normalize persisted windows and nested Worthless-Karama windows. Keep permitted Truthtrance/CHOAM overlays available while the actual responders decide. Do not globally auto-pass other players based on their hands. |
| `fullPlanRead` only accepts `{continue:true}` (`game/engine.ts`, approximately 6291); UI requires “Finish inspection.”                                                                                 | Opponent's plan is already committed, and the Atreides player's next meaningful action is preparing their own plan. The acknowledgement does not choose an effect. | Remove the extra blocking decision only with persistent private inspection in the ordinary plan editor. Preserve `fullPlan` target-first submission and authorized `insight`, including Truthtrance promises. A 1–2-second animation must not be the sole way to inspect a tactical plan. Legacy saved `fullPlanRead` can normalize to the plan editor without submitting a plan.              |

These findings are based on actual code branches, not a count of buttons labelled “Confirm.” No runtime reproductions were needed to establish the singleton branch or all-player response predicate; new integration tests remain necessary before modifying them.

The owner-pass reduction does not establish a new automatic deadline for other players. A player who has already passed can currently still use permitted overlays/cancel before the last responder passes; preserve those existing rights unless a separate authoritative timing change is made.

## Additional candidate requiring a narrower integration check

`beginPhase(7)` calls `collect(g)` immediately. The UI then presents “Ready for next phase” to every player even though collection has already happened. Current `collect` contains automatic stronghold/desert awards; no collection allocation choice is exposed in this baseline. A collection-result notification followed by the existing phase-end continuation would remove a likely acknowledgement-only pause.

Do **not** implement this by removing all phase readiness or skipping `nextPhase`: CHOAM phase-end market, technology settlement, future Ecaz co-collection choices, and any applicable phase-specific reactions must remain. Complete the current phase's real decisions first. Special CHOAM and Truthtrance currently have broad timing, so verify their existing before/after boundary semantics when advancing automatically. This candidate is less isolated than singleton casualties and is not certified as a universal all-expansions rule.

## Prompts that protect real choices

| Prompt/window                                                                    | Actual choice or reaction protected                                                                                                                                                                                              |
| -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Storm movement confirmation                                                      | Weather Control and Family Atomics before movement. Do not move storm on a display timeout.                                                                                                                                      |
| Accept spice blow                                                                | Harvester timing; other current Spice Blow continuations also include Thumper, Nexus, Fremen special Karama and worm choices. A publicly Harvester-closed blow can be examined separately, not used to remove all spice windows. |
| Phase opening                                                                    | Amal, including an opportunity after a prior Amal. The engine deliberately offers the same window regardless of hidden ownership.                                                                                                |
| Opponents allowing powers                                                        | Ordinary Karama; Advanced BG Worthless conversion and nested cancellation. Income that looks automatic still has a cancellation window before settlement.                                                                        |
| Guild shipment, full-plan offer, revival stop                                    | Spending an optional special Karama versus preserving it; hand-independent offers prevent information leaks.                                                                                                                     |
| Charity/Revival ready                                                            | Remaining claims, revival resources, leader/force choices and other phase powers. Zero current payable revivals is not proof of no actions when special cards or resources can change.                                           |
| Winner card cleanup, Moritani retention, Poison Tooth                            | Keep/discard/activate choices remain even if one card is involved. One eligible card still offers keep versus discard.                                                                                                           |
| Advisor arrival/intrusion, Face Dancer, captured leader, Moritani/Ecaz placement | Optional effects, destinations, ownership or spending choices. Their availability is not equivalent to mandatory use.                                                                                                            |
| Mentat readiness                                                                 | Negotiation, later turn-end effects, Face Dancer replacement, Gamont and other faction choices; do not globally skip because victory has already been checked once.                                                              |
| Lobby readiness, battle-plan lock, storm dial                                    | Consent or sealed strategic decisions, never automatic acknowledgements.                                                                                                                                                         |

`choamTradeConfirm` is a genuine final assent after the ally specifies the returned card. `auctionPayment` can choose Karama versus spice. Do not remove either simply because it contains a confirmation label.

## Existing automatic behavior to preserve

- `stormCasualties` calls `kill` directly when the allowable elite-loss interval is a singleton; only a real mix choice creates `stormLosses`.
- `finishBattle` transfers a single available technology token directly; multiple tokens produce `techToken`.
- Empty winner-card cleanup proceeds immediately; combat with no remaining battles advances through its existing phase-end continuation.
- Force transfers, payments, resource awards, setup completion, predetermined casualties and battle results already commit on the server; they need presentation, not new acknowledgements.

Do not replace these with client confirmation steps merely to make animations visible.

## Privacy and multiplayer requirements

**Do not auto-pass based on a player's hidden hand.** A faster or absent Karama/Amal/Guild-special window would disclose that a player lacks a relevant card. A private local checkbox which emits an immediate pass only when a card is absent can leak through visible timing too. Removing a responder because they publicly own the power is different: that condition is already public and the rules branch prohibits self-cancellation.

Automatic rules resolution belongs in the authoritative engine on the disposable action clone, before the database compare-and-swap commits. `db/rooms.ts act` currently applies one action, runs AI, increments version and writes under room-version plus current-token authority. A deterministic normalization chain can share that transaction. It must stop at the first meaningful choice/reaction and use a bound that reports a real loop rather than silently dropping work. Do not imitate human confirmations from the browser or add client timer POSTs.

`continueRoomBots` already persists bounded AI batches with version fencing. It is not permission to advance human choices, and an animation completing must not call `advanceBots`, `ready`, or `passResponse`. Read-only GET/reconnect should project state; any migration that resolves a legacy redundant decision must happen at an explicit authoritative write, or a separately designed fenced continuation, never a mutating view.

## Nonblocking notification contract

The UI currently has ordinary game logs and reduced-motion CSS, but no audited structured automatic-action notification stream. `Game.log` contains `{seq,text}` and retains 250 entries; one persisted bot batch can produce many events and skip intermediate phase snapshots. A phase-name comparison alone cannot reliably report every action.

Prefer small server-authored public event metadata such as `{seq,kind,actorFaction,label}` alongside the settled result. Private effects need viewer-authorized metadata; do not infer secrets from full game state or put inspected cards into public events. Keep action names separate from player-generated names and arbitrary log parsing.

Display each notification for approximately 1–2 seconds, with faction colors and a readable action name. It must use no modal backdrop, focus trap, pointer interception or disabled gameplay state. Provide a local toggle, honor reduced motion, and keep a durable readable history. Turning it off must change only presentation. Keep a per-room processed sequence so refresh or stale poll cannot replay old notifications; initialize a newly joined/restored view at its current sequence. Coalesce excessive AI-batch notices rather than queueing minutes of stale animation. Avoid announcing the entire historical log through a live region on every update.

## Meaningful validation before changes land

1. Single-option Advanced casualties settle exactly once, including JSON legacy state; multiple options still ask. Ixian cyborg losses still offer legal substitution. Winner cleanup, Moritani retention, technology/capture/Face Dancer continuations remain intact.
2. Power owner is never a required pass; every other player remains eligible, including an ally. Windows remain identical for hidden-card variants. Nested BG conversion/counter and Truthtrance overlays restore the correct responders.
3. Special prescience proceeds to Atreides planning with persistent private opponent-plan visibility; the opponent cannot change it and other seats cannot inspect it. Refresh preserves the insight; no automatic battle plan is submitted.
4. Automatic settlement survives duplicate requests/concurrent CAS without duplicate payment, RNG, casualties or events. A disconnected owner's redundant acknowledgement cannot stall an otherwise settled window.
5. Notices remain nonblocking on desktop/mobile and keyboard; toggle/reduced-motion behavior does not affect room state. Reconnect and multi-event bot batches do not replay history or expose hidden identities.

Full scope remains gated. This is an implementation audit of the present runtime, not a claim that every future expansion effect is automatic or already covered.

## Implemented checkpoint (2026-09-06)

The candidate audit above describes the earlier baseline. Singleton auction payment and full-plan acknowledgement removal are now implemented. Exact funded split plus no usable Karama permits automatic payment; a real Karama choice remains explicit. Atreides retains private plan inspection until reveal, including when helping an ally. Legacy saved decisions recover via authenticated CAS continuation. Tests: automatic-decisions, full-plan, automatic-response-recovery, and the full 1,029 rules / 74 persistence checkpoint. Other candidate pauses still require their own timing audit.
