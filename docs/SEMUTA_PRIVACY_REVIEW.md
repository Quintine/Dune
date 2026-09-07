# Semuta privacy and durable continuation review

7 September 2026. Read-only audit of `docs/SEMUTA_DRUG_ENGINE_AUDIT.md` in full, current engine, Truthtrance, bots and room persistence. No new timing or capacity ruling is assumed. No shared source edits. The existing audit's verified physical face and official CHOAM rulebook provide the effect/provenance: one fresh Treachery discard from another player, optional activation, choose one from simultaneous discards, then discard Semuta. Private discard inspection does not become freely available merely by holding Semuta.

## Decision that cannot be solved by hiding a player name

The following three requirements cannot all be guaranteed by a server-only secret-eligibility check:

1. Give a human a usable manual interruption immediately after every eligible fresh discard.
2. Never pause or ask for acknowledgement when nobody privately has a usable Semuta.
3. Keep public event existence, pending/closed status and progress independent of hidden Semuta possession.

Opening a neutral event and immediately auto-closing it only when no holder exists still leaks through event duration/versions/continuation. Opening only a private owner prompt while publicly blocking the game leaks that *someone* has an eligible card. Hiding the holder's name reduces leakage but does not establish noninterference, especially when observers know some other hands. Automatically marking ineligible players passed and publishing remaining IDs/counts is an even stronger leak.

No new artificial timeout, grace period or default turn deadline is justified by the face. Do not silently choose one to reconcile these requirements.

**Strict privacy baseline:** a neutral public fresh-discard boundary, enabled by public rules configuration and semantic event, with the same opportunity participants and pass/close protocol whether Semuta is held, reserved, in cache, or absent from hands. All relevant seats get a generic continue/reaction affordance; only a holder gets a private activation button. This costs empty-choice acknowledgements. Skip boundaries only from public facts, e.g. the public enabled deck cannot contain Semuta, an empty semantic batch, or a publicly established singleton custody state that makes every claim impossible. A private server knowledge proof is not a public proof.

**Automatic alternative requiring an explicit interaction policy:** a private standing instruction set *before* the event, authorizing automatic decline or automatic commit on a future eligible event. If all affected seats are resolved automatically under that policy, no manual pause is necessary; a claimed card then produces only the legitimate public played-Semuta event. A standing auto-claim can authorize paying/committing before seeing unknown faces, with later mandatory selection if several candidates remain. This is a new product interaction choice, not authority to spend a user's card inferred from possession. A manual override mode still needs the public neutral boundary or accepts the existence/timing leak. Auto-pass defaults plus a secret manual-holder pause alone do not solve strict privacy.

Therefore root should explicitly retain the neutral acknowledgement tradeoff or obtain the intended standing-policy/timing choice. The user's preference for automatic no-choice handling can immediately be honored **after commitment** when exactly one eligible target remains, with no privacy sacrifice or timing invention.

## Exact projection invariants

Compare two authoritative states differing only in hidden opponent cards or unrevealed discard faces, while preserving already public actions and declared rules:

- A non-owner sees the same neutral event identifier, phase/turn, public cause classification, opportunity participants, and closure protocol. Do not project `eligibleHolder`, `canSomeoneClaim`, private pass count, number of private viable targets, or an owner-derived response kind before activation.
- Before commitment, even the Semuta holder receives no unknown candidate ID, face, name, kind, value/rank, or sorted order derived from a private discard. A remembered or already public face can remain visible under its original authorization, but is not permission to expose its private batch companions.
- After accepted commitment, the claimant alone can inspect the fresh batch's eligible other-owner card snapshots. No previous pile contents, future draws, victim's remaining hand, other queued batches, or cards discarded by the claimant enter that candidate view.
- Selection/read access must require persisted commitment and exact event ownership, not a UI route argument or a transient `isHolder` flag. Reload, observer view, takeover and other tabs must enforce the same authorization.
- Public commitment announces the actual Semuta play, never a list of private eligible target faces. Public completion can say one card was recovered without identifying it unless it was already public. The resulting hand uses normal hand privacy; off-Bidding hand counts must stay private under current rules.
- Event metadata must not accidentally expose the source's private state. Use stable public `cause` codes and discard-owner IDs only where they were already authorized; do not stringify the original action, hidden plan, random victim card or whole continuation into public logs.
- Invalid caller guesses at old/current private IDs must have a generic, non-enumerating rejection and leave byte-identical state; they must not return candidate names or distinguish “exists elsewhere in private pile” from “not eligible.”
- Candidate inspection is not an optional free peek. Once `begin` succeeds, no cancel/back action refunds the commitment. A sole candidate can move immediately in that same accepted action. Multiple candidates require exactly one selection; no other gameplay spends its reserved slot/card meanwhile.

## Minimal reusable architecture

The existing central `discard` (engine:1806) knows physical owner but has no semantic batch. `draw` (1795) can immediately shuffle the entire pile. Direct writes also exist for Box (1295), escrowed Ornithopter (3903), and Distrans (10286). An end-of-`applyAction` pile diff is insufficient: the target may already be drawn and one action may contain multiple sequential discards.

Introduce a semantic `discardBatch` boundary plus a typed continuation dispatcher, and refactor producers to stop at this boundary. Use exact IDs with face snapshots for validation; snapshots are evidence, **not** extra physical inventory. Keep the cards in the actual discard pile until claimed. No producer may call `draw`, replace/shuffle the pile, or advance a nested effect past a pending boundary.

Suggested durable shape (names are proposed, not a required root API):

```ts
type FreshDiscard = {
  event: string; turn: number; phase: number;
  operation: string; // opaque parent operation identity
  cause: DiscardCause;
  entries: { id: string; discardedBy: string; snapshot: Card;
             visibility: 'public' | 'private' }[];
};
type SemutaPause = {
  version: 1;
  batch: FreshDiscard;
  opportunity: { participants: string[]; passed: string[] };
  resume: DiscardContinuation;
} & (
  | { stage: 'offer'; claim?: never }
  | { stage: 'select'; claim: {
      event: string; player: string; semuta: 'richese-semuta-drug';
      eligibleIds: string[]; // private committed snapshot, never ordinary view
      capacityReservation: { incoming: 1 };
    } }
);
```

`DiscardContinuation` should be a discriminated union of actual remaining operations, not a saved `Game`, JavaScript closure, arbitrary original client action or generic replay instruction. Examples to implement at real call sites:

- `cardEffect`: typed effect and validated remaining operands, **after** its activating card was paid/discarded; no repeat of the original `applyAction`.
- `ambassadorReplacement`: original entry/event, beneficiary and pending replacement count; the selected discard is complete, replacement draw and `finishAmbassador` are not.
- `ixAllyReplacement`: original purchase/recipient, draw then finish that purchase exactly once.
- `battleCleanup`: frozen outcome/participants/winner and remaining cleanup stage; casualties, bounty, KH, traitors and already earned income are complete, not recalculated.
- `moritaniRetention`: the original retention event and next cleanup stage; chosen kept card is excluded.
- `winnerDiscard`: resume final battle continuation after the submitted subset, not re-run the selection.
- `terrorSabotage`: original entry and next gift/finish stage, with random victim selection already committed.
- `phaseOpening`: original opening/initialize state and remaining Amal effect/continuation in the chosen printed order.
- `resumeSuspended`: a fixed, typed response/decision/paid operation that is already fully earned and only awaits restoration. Prefer preserving it in its native Game fields plus a locked guard where practical.

Each variant must define exactly which mutations already happened. An `effectPaid:true` flag is not an adequate replacement for an explicit step if the same code still grants income twice. For multi-stage effects such as CHOAM special Karama, distinguish the activating Karama cost from the subsequently selected simultaneous card batch; do not flatten all calls in one HTTP request into one group. Conversely one battle cleanup batch should retain every former owner rather than offering one Semuta claim per card.

A helper returning `paused: boolean` works only if **every caller returns immediately** when true. A thrown control-flow sentinel that catches at the transaction wrapper is dangerous when post-discard operands live only on the stack; only use it after an explicit typed continuation has been saved and with a clearly separate success path. Do not replay a suspended client action: replay can reroll Sabotage, spend the card/payment twice, re-award battle resources or select a different auction card.

## Reusable existing patterns and their limits

- **Nullentropy Box** (engine:1307–1337): useful committed-private-inspection pattern. It pays before exposing `search.cards`, reserves its own physical Box, snapshots pile identity, saves response/decision/Karama/opening, and auto-finishes a sole candidate. Semuta has no two-spice payment; reserve its activating card/capacity instead. Reuse validation-before-inspection and exact restoration, not the Box's whole-pile search permission.
- **Truthtrance** (`game/truthtrance.ts:330–379`): useful public action-declaration → shared priority opportunity. The initial declared card is public, unlike an unplayed Semuta, and its storm priority is specific to Truthtrance. Do not import its priority rule as a new general simultaneous-card rule. Do not expose Semuta eligibility through a named decision before commitment.
- **Phase opening** (engine:10327–10364): public Ix configuration creates the boundary, every seat passes, and the saved `initialize` flag preserves one-time phase entry. This is the closest neutral opportunity model, but it is phase-scoped and cannot overwrite an existing opening or represent nested per-discard continuations. Amal itself can discard inside it.
- **Automatic responses** (10043–10071): current code tests secret available Karama cards to stop or auto-allow. It already has timing dependencies that cannot serve as proof of strict Semuta noninterference. A new Semuta pause must stop this loop and `finishActionContinuations` (10006), `normalizeAutomaticGame` (10078) and phase/battle continuation dispatch before they consume fresh candidates.
- **Rooms** (`db/rooms.ts:343–383`, 415–437, 463–474): preserve existing auth and version CAS for begin/select/pass/automatic continuation. Authenticated views must be generated after commit. Competing begin/pass or duplicate select requests must produce exactly one accepted version, not two claims or two restored continuations.

A Semuta interruption may occur inside an existing Truthtrance queue, Karama response, Ix replacement or paid Box completion. Do not reject the whole phase merely because it has nested state. Save/preserve the already authorized operation and route Semuta ahead of generic decision/response dispatch; lock unrelated actions while selection is committed. Be explicit about any exact unsupported composition instead of inventing an all-Bidding or all-Battle restriction.

## Producer checkpoints needing focused tests

Current examples establish why this is a cross-phase engine change:

- Ix Ambassador currently loops selected `discard` then immediately `draw`/`finishAmbassador` (4502–4523); with empty deck the new card can reshuffle before the client ever sees a window.
- Ix ally replacement similarly does discard and draw in one path (8233–8234).
- CHOAM Ambassador grants selected-count bank spice after discard (4503); its continuation must preserve exactly one payout.
- CHOAM special Karama discards the Karama and selected cards at 9658–9659, then grants spice and marks once-per-game. It requires explicit sequential/batch staging.
- Sabotage shuffles victim hand, discards one and opens gift/finishes entry (4795–4810); persist random victim before pause.
- Battle resolution discards used cards (7400–7408), then updates captives, capture/technology/Duke, clears battle and begins winner cleanup. Its Semuta continuation must not re-enter numerical battle resolution.
- Winner discard decision (11466–11473) is a later semantic batch. Moritani retention (7712) likewise excludes the held card and resumes once.
- Box completion rewrites the pile (1295) then restores prior pending fields (1296–1300). Only the newly spent Box is fresh; old shuffled cards and the recovered card are not fresh events.
- Ornithopter/Distrans direct pushes need the original effect owner, not the current HTTP responder, as discarder.
- Gift, auction purchase, cache removal, Ix auction exchange and hand exchange are not discard events. Hand disappearance or pile-order change is not sufficient evidence.

## Capacity, reservation and recovery

Do not settle the audited full-hand ambiguity by UI arithmetic. The printed take-then-discard sequence versus hand limit remains an explicit user/source boundary. Whichever temporary supported guard root uses must include reserved incoming auction/Harkonnen/Ix/exchange slots and be described as that guard, not fabricated card wording.

Before committing, validate canonical Semuta identity, one physical copy, unreserved own custody, event freshness, other-owner candidate existence and permitted capacity. After commitment, lock both the activating card and claimed incoming slot; revalidate selected ID against the original eligible IDs and live discard custody. The selected card must not also exist in a hand, deck, cache, escrow or removal zone. Preserve relative order of all unselected pile cards. Remove target/add to claimant, then discard Semuta in the agreed sequence; update event stage and resume exactly once in the same CAS transaction.

The provisional shipping-Karama return noted in the existing audit is an exact target-reservation composition, not permission to ban Semuta during movement. If its source ruling remains unresolved, visibly guard that reserved physical target before private inspection/commitment. Root must not silently keep a refundable copy after Semuta transfers the original.

Fresh Semuta's own discard need not recursively expose a second hidden-holder opportunity in a verified singleton game when public physical custody proves no second Semuta exists. If using generic event recording anyway, the normal public impossibility rule should terminate it. Do not bypass ordinary physical card conservation or permit self-recovery.

## All four AI levels and multiplayer tests

Before commitment, a bot can use only its own Semuta, capacity/reservations, public event/cause and previously authorized public faces. No `game.discard`, private candidate values or future deck previews. A simple deterministic policy may spend for a useful known public card or sometimes commit blind based on hand flexibility; it must not claim to know the hidden target is valuable. If the event is optional and the bot declines, it emits the exact current event pass and never loops.

After commitment, every profile receives the same authorized fresh candidate subset. Rank only that subset using normal card value and choose one exact ID; return at least one legal action even if every candidate is undesirable or currently unsupported. The choice is mandatory after inspection, so a negative score cannot cause `[]`/deadlock. A sole candidate should settle automatically on the server and never create a redundant AI/UI decision.

Place the Semuta branch before resumed generic `g.decision`/response actions, but retain seat-control/auth checks and paid nested-operation guards. `runBots` (2910) catches rejected candidates and falls back, so tests must actually apply **every emitted candidate** and count rejections. Normalize a pending automatic sole-choice/resume even when it is neither the existing generic response nor the old Richese ally trigger; the current runBots pre-normalization condition is not generic enough by itself.

Required evidence: all four levels blind/public begin and pass; unknown multi-choice compulsory completion; sole-choice immediate transfer; private perturbation before/after commitment; empty-deck replacement resumes once; public opportunity traces equal with hidden holder relocated/absent; mixed-owner batches; all producer categories; strict full-hand policy; persisted paid search/response/Truth queue; concurrent claim/decline, duplicate choose, module restart and fresh authenticated reconnect; no log/snapshot leak or card-count leak. Browser controls must distinguish **commit to use and inspect** from **decline** and show no hidden candidate inspector before commitment.

This recommendation is not a full Semuta implementation or an answer to the outstanding automatic/manual timing and full-hand policies.
