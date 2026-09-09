# Caladan victory reinforcement: integration audit

Historical pre-integration audit. The subsequent
[runtime checkpoint](HOMEWORLD_VICTORY_REINFORCEMENT_RUNTIME.md) records the
implemented hook and evidence. Face Dancer overlap remains guarded pending a
ruling; the structural recommendation below does not establish its rules order.

10 September 2026. Read-only, bounded runtime audit. This identifies integration
points for the high-Caladan optional reserve force; it does not establish new
rules, certify the feature, or change existing saves. The source/quote owner must
settle the timing and destination boundaries called out below.

The current [Caladan component](../game/homeworld-cards.ts) requires a battle win
and an existing own force at that battle's territory or Homeworld. Its high
threshold is six native forces. The [Homeworld rule inventory](HOMEWORLD_RULES.md)
identifies this as a post-battle transfer, separate from ordinary shipment.

## Actual battle completion order

The following functions are in [engine.ts](../game/engine.ts). The ordering is
observable across saved discard batches, decisions, and responses; the initial
winner announcement is not the end of cleanup.

| Stage | Existing behavior | Reinforcement implication |
| --- | --- | --- |
| `chooseBattle` | Creates a fresh `Battle.event`; validates the selected unresolved board/Homeworld battle. Voice, prescience, Stronghold powers, and later revealed-plan responses belong to this battle. | Bind a new entitlement to this event, not territory plus turn. Multiple battles can occur in the same territory and turn. |
| `resolveBattle` | Uses the committed resolution quote; pays support/bounties, kills losers, and applies immediate Basic winner losses where the quote supplies them. Traitor wins preserve their winner; mutual traitors/explosions do not declare a winner. | A winner can have no surviving force. Never add a force before final winner casualties to make an otherwise eliminated winner survive. A native explosion survivor is not a battle winner. |
| Resolved context | Sets `lastBattleContext` with event, turn, territory, combatants, winner and result. Stages winner mandatory-discard commitments separately. Saves Homeworld casualty commitments, clears `g.battle`, and stages the losing/mandatory discard batch. | This is a place to record new-event provenance, but not yet to expose an actionable reinforcement. Keep a pending marker even when cleanup suspends. |
| `continueResolvedBattle` | Runs after the first discard continuation. Applies the sole casualty option, exposes `battleLosses`, or routes a native explosion through `homeworldExplosion`. | The reserve force cannot enter the committed casualty pool or change the number/type of losses. |
| `settleWinnerCasualties` | Applies real normal/starred casualties; clears the Homeworld loss record. A surviving Ixian Suboid and a lost Cyborg can produce `ixSubstitution`. | Do not bypass the casualty or substitution continuation. Atreides cannot itself be the Ixian substitution winner, but a generic cleanup hook must retain this ordering. |
| `finishWinner` | Retires mandatory winner cards through `winnerMandatoryDiscard`, then exposes optional `battleCards`, or calls `finishBattle`. | The new choice must not replace a mandatory discard or reuse its optional-card list. Winning Cheap Heroes/Poison Tooth can have a separate physical retirement batch. |
| Optional winning discards | The current `battleCards` decision handler stages `battleCleanup`; `finishTreacheryDiscard` resumes `finishBattle` only after retirement. | A zero-card choice and a nonempty discard batch must reach the same reinforcement stage once. |
| `finishBattle` aftermath | Uses [battle-aftermath-quote.ts](../game/battle-aftermath-quote.ts): Moritani retention, CHOAM battle income, technology transfer, Harkonnen capture, CHOAM Auditor, Face Dance, then board continuation. | `finishBattle` is called repeatedly. An unchecked hook here would grant several forces for one battle. |
| Board continuation | Once the quote returns `board`, computes remaining battles and activates the next attacker; otherwise calls `nextPhase`. | This is the narrow final interception point before another battle or Collection. Do not advance the phase while an owned choice/arrival remains. |

`g.battle = null` retires the old Voice, prescience, revealed plans and battle
power checks. Their completed context is historical evidence; reinforcement
must not recreate `g.battle`, restart `beginBattlePowers`, call
`finishBattlePreparation`, or revive a spent Voice response. Captured leaders are
returned/marked during resolution and the capture aftermath; reinforcement does
not reopen their battle eligibility.

## Recommended hook and the timing boundary

The smallest structural hook is immediately before the final `board` branch of
`finishBattle`, after `currentBattleAftermathQuote` and its existing deterministic
steps have committed. It opens an optional owned decision or records a terminal
skip, then eventually resumes that same board suffix. This preserves every
existing casualty, discard, capture and resource response.

**This placement is a recommendation about code structure, not a source ruling
that Caladan follows Face Dance.** Face Dance removes the original winner's
entire remaining army and returns it to native reserves; the Tleilaxu replacement
can even be zero. If reinforcement occurs after it, the original winner has no
survivor and cannot reinforce. If sources require reinforcement before it, add a
distinct aftermath stage immediately before Face Dance, and let its completion
resume Face Dance. Do not choose between these outcomes accidentally by placing
a generic end-action observer. The winner in `lastBattleContext` does not change
when a Face Dancer replaces it.

The same source decision must identify when to evaluate native high population:
at the original win, after casualty cleanup, or when the choice is used. Native
Caladan casualties can change that side. Record the rule-defined eligibility
facts; recheck current physical availability and destinations before mutation.
Do not infer a new entitlement simply because a subsequent return raises Caladan.

## Minimal durable contract

Use a feature-specific optional Game record; keep it outside the exact-shape
`homeworlds.custody` object. A practical record contains:

- Original battle event, turn, player, target combat-location ID, result and
  rule-defined qualifying facts. Bind these immutable fields in a canonical
  signature.
- A stage such as `waiting`, `choice`, `arrival`, `complete`; a fixed grant of one
  ordinary force; and a signed completion/decline outcome. A completed marker
  must survive every repeated `finishBattle` call for that event.
- An owned decision carrying the same event. Accept only the current event and
  a currently offered sector/destination, or explicit decline. Do not accept a
  posted winner, battle result, source balance, or additional amount.
- If a transfer can cause an arrival reaction, a saved parent describing the
  exact board/aftermath suffix, plus original arrival provenance and completion
  evidence. Retire the reinforcement transfer before executing a child.

Validate the record and owned decision together in the common integrity path
used by `viewGame`, `applyAction`, and `normalizeAutomaticGame`. A signed record
does not by itself detect deletion: a new battle's independently committed
context needs an obligation/completion marker if deleting the pending record
must be rejected. The existing `lastBattleContext.winnerDiscards` versus
`pendingWinnerDiscards` pair illustrates why this matters.

Reject malformed original fields, contradictory stages, missing required owned
choices, stale battle events, and replayed completion before any custody, log,
resource, phase or response mutation. A skip because there is no surviving force
must also become terminal for the event; repeated normalization cannot wait for
some later action to manufacture a survivor.

## Physical destinations and reactions

Use [combat-location.ts](../game/combat-location.ts) and
[homeworld-custody.ts](../game/homeworld-custody.ts), rather than an Arrakis-only
`at()`/`p.forces` test. Homeworld defenders/visitors have physical forces outside
ordinary board keys. For Atreides' source, withdraw one ordinary counter from the
actual native pool through [homeworld-native-reserves.ts](../game/homeworld-native-reserves.ts).
An aggregate reserve count or foreign visitor does not prove native availability.

For an Arrakis target, require the original battle territory and a legal offered
sector, then withdraw and place the one counter atomically. For a foreign
Homeworld target, withdraw native custody and deposit explicit visitor custody.
Retain allied-Homeworld and applicable occupancy restrictions; do not silently
route to a different territory. The native-Caladan target needs an explicit
source/quote decision: native reserves are already the native battle army, so
withdrawing and depositing into the same pool cannot create an additional
physical counter. Do not increase native population as though a force came from
outside custody.

Do not reuse `ship` or `guildShip`: those actions consume phase-five usage and
can assess Guild income/technology and response windows. This grant must not
change `shipped`, `moved`, spice, revival allowances, Tanks, or the already paid
battle support merely to add a reserve force.

`openTerritoryEntry` composes Ecaz Ambassador and Moritani Terror and expects a
supported cause plus a clear decision/response parent. It is not a generic safe
callback: it can open multiple saved children or reject competing entry effects.
The new reinforcement's shipment/movement classification, storm permission,
Spiritual Advisors, Intrusion, and Terror need the source owner's explicit
contract. Gate any unresolved affected destination before transfer. The recently
added [revival return](../game/homeworld-revival-return.ts) shows a durable
Ambassador chain but is a different entitlement and must not be reused by
pretending victory reinforcement was revival.

## Persistence and verification seams

[rooms.ts](../db/rooms.ts) persists automatic normalization with a version CAS.
Its `needsAutomaticRoomRecovery` predicate must recognize any new `waiting` or
`arrival` stage that needs to advance without a user action. A deliberate human
`choice` should remain pending; bots use its projected legal options. Never mutate
on read or write an unfenced completion from a projection helper.

Older saves can contain an already completed `lastBattleContext` or a legacy
cleanup context constructed by `cleanupBattleContext`. Neither proves that a
new Caladan offer is owed or was previously consumed. Missing new-feature
provenance must remain legacy-compatible without granting a retrospective force.
Newly resolved battles can opt into the signed record at their real commit.
No database migration needs to rewrite old room JSON or fabricate battle history.

Focused regressions should use genuine battle resolution: ordinary and traitor
wins; zero survivors; mutual traitors/native explosions; losing and winner
discard retirement; before/after final casualty population; same-location second
battle; Homeworld visitor custody; chosen-versus-declined single grant; stale
events/corrupt or deleted queues; Face Dance ordering; and any supported arrival
child. Production in-memory SQLite should race two identical decisions and two
automatic workers across reload, asserting one transfer and one suffix, exact
twenty-counter custody, unchanged battle losses/usage, private observer views,
and zero writes for rejected corruption.

Only this document was created. No production engine, persistence code, stored
room, test fixture, or release gate was changed by this audit.
