# CHOAM Nexus Cunning

Source audit: 2026-09-10; bounded Kull integration contract updated 30 September 2026. This source audit defines native Cunning and its saved-receipt contract. The separate [runtime checkpoint](NEXUS_CHOAM_RUNTIME.md) preserves the earlier five-effect evidence and records the new explicit `nexus-kull` profile separately. Neither scope resolves the other CHOAM Nexus panels or lifts any [Nexus/expansion release gate](NEXUS_CARD_RUNTIME.md).

## Authority and printed scope

The [original GF9 Nexus component photograph](https://boardgamegeek.com/image/7767032/dune-ecaz-and-moritani), independently inspected at `/tmp/dune-nexus-cards.jpg`, gives CHOAM Cunning this printed instruction: **“Discard any Treachery Card to obtain a Worthless Card special effect of your choice.”** The choice is one held physical card and one effect. It does not require holding the corresponding named Worthless card, transform the chosen card's printed identity, grant money, or supply a phase-long conversion permission.

The [GF9 Ecaz & Moritani rulebook, p.11](https://www.gf9games.com/dune/wp-content/uploads/EcazMoritani-Rulebook-LOWRES.pdf#page=11) classifies Cunning as enhancement of a native advantage. The holder must remain unallied, and a played Nexus Card is discarded. Those common conditions still apply. Publisher-indexed text and the previously fetched [publisher-authored E3 mirror](https://gamers-hq.de/media/pdf/0f/7a/86/Dune_EcazMoritani_Rulebook_EN.pdf) were used; no community compilation supplies a ruling.

CHOAM's Treachery advantage is on the ordinary faction-rules page, before its Advanced advantages. Therefore this Cunning is usable in Basic and Advanced; it is not CHOAM's separate once-per-game special Karama. [GF9 CHOAM & Richese rules, pp.7–8](https://www.gf9games.com/dune/wp-content/uploads/2021/11/CHOAM-Rulebook-low-res.pdf#page=7)

## Six effects and their timing

E2 lists **six**, not five. The earlier Cunning runtime implemented five. The separate opt-in [printed Kull profile](CHOAM_KULL_DESIGN.md#opt-in-development-scope) still does not admit Nexus Cards. Only the new explicit `nexus-kull` profile enables Cunning's Kull choice at the existing attempted-Karama opportunity; other Nexus previews retain their Kull guard. This is one bounded interaction, not a silent retrofit or a full-family release.

| Chosen effect | Printed outcome and timing |
| --- | --- |
| Baliset | During Shipment and Movement, prevent a player moving into a territory CHOAM occupies; shipment remains permitted. |
| Jubba Cloak | Protect CHOAM forces in one territory from the moving storm. |
| Kull Wahad | On a player's attempted Karama play, prevent that player playing Karama during this phase. |
| Kulon | One extra territory of movement on CHOAM's own Shipment and Movement turn. |
| La La La | During Revival, prevent a player taking Free Revival. |
| Trip to Gamont | During Mentat Pause, return one other player's force to its reserves. |

None lists an additional spice fee. Cunning changes the required card identity, not timing, targets or quantity. It does not grant an extra movement action, make Jubba protect spice, or make a shipment count as Baliset movement. [E2 p.7](https://www.gf9games.com/dune/wp-content/uploads/2021/11/CHOAM-Rulebook-low-res.pdf#page=7)

A purchased or gifted card already in CHOAM's hand can supply the discard, including a Worthless card, weapon, defense, special card, Cheap Hero or Richese card. Existing reservations and binding commitments still matter. Do not require the selected card's name to match the effect or physically create a named Worthless card. Playing a printed Karama as this discard cost does not also activate its Karama power; no additional once-per-game use is earned or spent.

## Cancellation and physical disposal

E2's Karama table permits prevention of CHOAM's special-effect Worthless discard. Applying that rule to Cunning's enhancement is ordinary native-advantage composition: the selected Treachery card remains held when its discard is prevented, the chosen effect does not occur, and the already played Nexus stays spent. Use one ordinary CHOAM-effect response, not separate cancellation windows for conversion and effect. [E2 p.12](https://www.gf9games.com/dune/wp-content/uploads/2021/11/CHOAM-Rulebook-low-res.pdf#page=12), [E3 p.11](https://www.gf9games.com/dune/wp-content/uploads/EcazMoritani-Rulebook-LOWRES.pdf#page=11)

This differs from Bene Gesserit's expressly discarded Worthless-as-Karama when that conversion is prevented. That specific FAQ consequence does not transfer to CHOAM. The general FAQ permits stopping one native-ability use; CHOAM's later table supplies its own phase-scoped wording. [GF9 November FAQ, p.7](https://www.gf9games.com/dune/wp-content/uploads/2020/11/Dune-FAQ-Nov-2020.pdf#page=7)

On an allowed use, the **original physical card** crosses into discard exactly once. Its canonical descriptor remains intact. For example, a poison weapon discarded to obtain Kulon still qualifies for any applicable actual-discard Ecaz income; hand-discard Chemistry is not promoted to a poison weapon. A canceled declaration creates no such discard event, income or Semuta opportunity. Reuse the [Ecaz physical-discard contract](ECAZ_POISON_INCOME_RULES.md) and ordinary fresh-discard continuation; a selected effect label must never overwrite card type.

The effect choice and native use may be public without revealing the rest of CHOAM's hand. Do not add a public poison-income message that identifies a privately discarded category. Preserve existing discard visibility. Successful disposal must pass through the current Semuta/reservation handling, and an interruption must resume the chosen effect and its original parent once. A later retrieval of the discarded card does not undo an already earned effect or permit replaying its receipt.

## Existing boundaries to preserve

- **Kull:** the [source update](CHOAM_KULL_SOURCE_UPDATE.md#user-selected-preview-timing--30-september-2026) records approved distinct-card counters and BG-before-conversion custody as user-selected product policy, not publisher clarification. The new `nexus-kull` profile composes those policies with physical any-Treachery fuel and CHOAM Nexus Cunning. It reserves the interrupted original, retains it and any special once-use on success, and resumes it once on decline or prevention. Unpayable winning-overbid recovery is deliberately deferred; the existing private precommitment fence remains independent of hidden ownership. The old `kull` profile still excludes Nexus, and other Nexus previews do not gain this choice.
- **Phase cancellation scope:** the existing [Worthless continuation audit](CHOAM_WORTHLESS_CONTINUATION_AUDIT.md) records unresolved scope across other physical copies or effects. Current runtime binds a canceled physical card for the phase. A new Nexus use should preserve the selected policy rather than silently broaden or erase that historical restriction. The spent Nexus itself cannot be retried.
- **Inherited effect boundaries:** fixed Ornithopter range versus Kulon, reactive movement/Revival/storm parents, special force custody, No-Field Gamont and other already documented exclusions remain properties of the selected effect. They are not reasons to reject an ordinary source-supported Cunning use with a different effect.
- **No fresh hidden reaction policy:** native CHOAM's existing effect opportunities and public circumstances supply the interaction points. Kull reuses the same neutral validated-attempt opportunity regardless of CHOAM's Nexus identity or eligible fuel. Do not pause only because a secret Nexus card exists, expose private cost lists to opponents, add compulsory no-choice confirmations, or reopen another player's completed action. This privacy protocol is application policy, not publisher-prescribed priority.

## Kull source, cost and action boundary

Fresh Basic or Advanced `nexus-kull` games require two to six ready seats with native CHOAM and otherwise classic factions, exactly the physical CHOAM and Ix Treachery decks, and Nexus alone. `initializeNexusKullGameForAudit` sets the explicit `nexusKullPreview` capability together with the shared `kullPreview` interception capability. It is not an in-play upgrade. No other expansion faction, Homeworld, Leader Skills, Discovery, Tech Token, Stronghold, Sandtrout, Ecaz variant, Semuta or Richese Betrayal composition is admitted by this profile.

| Source | Required physical cost | When spent |
| --- | --- | --- |
| `printed` | One eligible held printed Kull Wahad | That card remains held while pending; discard once only on successful Kull. No Nexus is spent. |
| `nexus` | Unallied native CHOAM's actual singleton CHOAM Nexus **and** one eligible held canonical Treachery fuel card | The Nexus is spent once at accepted declaration, even if Kull is later prevented. Fuel remains held until successful settlement and is retained on prevention. |

Any Treachery fuel identity is eligible in principle; live physical custody, reservations and own binding promises remain authoritative. This is not a free effect or a manufactured Worthless card. The pure `kullNexusCostCards(held, physicalCards, reservedIds)` helper classifies uniquely held canonical fuel and excludes reserved IDs; it does not authorize a profile, Nexus ownership, alliance, phase or promise. The engine proves those separately. A declaration must not reuse the original reserved attempt as a cost or counter.

The API uses `kullReaction.plays`, not a bare `cards` list. Each private choice is `{ source: 'printed' | 'nexus', effect: 'kull', card, event, blocked }`. The selected `card` is the real fuel descriptor. Other viewers receive an empty plays list and the same public event/player/target/purpose. Client Use supplies only the canonical event, source and actual card ID; decline has no source or cost:

```ts
{ type: 'kullDecision', event, decline: true }
{ type: 'kullDecision', event, source: 'printed', card }
{ type: 'kullDecision', event, source: 'nexus', card }
```

**Source is required on every Use, including printed Kull.** There is no omitted-source fallback and no client-selected effect, target, price or Nexus ID. The generic any-time Nexus action does not play Kull: the validated pending Karama opportunity is required. Reject stale/foreign events, malformed costs or broken saved ownership before costs or writes.

The accepted-declaration Nexus spend and retained pending fuel reuse the existing native Cunning application convention. E3 establishes that a played Nexus is discarded; it does not prescribe this internal transaction boundary or a Kull nested-response priority. A distinct eligible counter acts before the stamped phase ban; the original remains reserved. Success discards fuel once, keeps the original printed/BG card unplayed and special once-use unspent, and restricts its activating player for the current turn and phase. Prevention retains fuel under the existing exact-cost phase policy, leaves Nexus spent and resumes the saved original once. Decline spends neither cost and resumes it once. BG interception is before conversion; the original ordinary conversion and its FAQ disposal rules resume only after decline or prevention.

## Pure saved receipt and integration contract

This is engineering design, separate from publisher rules. Keep the authorization receipt independent from the physical card and the existing effect's continuation.

```ts
type NexusChoamEffect =
  | 'baliset' | 'jubba' | 'kull' | 'kulon' | 'laLaLa' | 'gamont';

type NexusChoamReceipt = {
  version: 1;
  event: string;
  owner: string;
  turn: number;
  phase: number;
  effect: NexusChoamEffect;
  card: string; // original physical ID; server only
  roster: { id: string; faction: FactionId }[];
  signature: string;
};
```

[game/nexus-choam.ts](../game/nexus-choam.ts) exports the six-name `CHOAM_NEXUS_EFFECTS` map, `NexusChoamEffect`, `NexusChoamContext`, `NexusChoamReceipt`, `createNexusChoam(context, owner, phase, card, effect)` and `validateNexusChoam(context, receipt)`. Context contains the current turn and ID/faction roster only. Intrinsic validation checks exact keys, effect/phase compatibility, original native owner/roster, nonempty card ID, safe numbers and signature. The event is `JSON.stringify(['nexusChoam', turn, phase, owner, card, effect])`. Kull's intrinsic timing admits phases 0–8; only the engine's explicit profile and canonical pending attempt authorize its use. Historical validation neither reads private hands nor requires the card still held, CHOAM still unallied or the old Nexus still present.

The engine should separately bind progress (`pending`, `canceled`, `discarded`, `complete`) and the exact original resume context. An independently retained latest-progress marker prevents deleting or rewinding the detailed frame from restoring the Nexus or causing another discard. Bind target, territory/sector, elite type, No-Field event and movement/revival/storm parent only where the selected effect uses them. Avoid freezing unrelated hidden hands, resource changes or nested response passes in a signature.

Integrate through the existing native effect validator with an explicit selected effect, preserving the original selected Card. Do not construct a fake Worthless hand entry merely to satisfy name-based checks. On cancellation, validate and resume the existing denied suffix without applying or paying for the chosen effect. On allowed disposal, record the physical event before yielding to a fresh-discard child; the continuation must know whether the card and effect have already committed. Reject stale actor/event/effect/target/custody before costs or private output.

At the source-audit checkpoint, four focused pure tests in [tests/nexus-choam.test.ts](../tests/nexus-choam.test.ts) passed: six-effect timing, later-turn/reordered-roster recovery with private getter traps, edited receipt rejection, and malformed/foreign creation. Type-aware lint and whitespace checks passed then. These are preserved historical receipt checks, not new Kull gameplay integration certification.

The historical five-effect matrix remains separate from the new source-aware Kull evidence. The frozen Kull checkpoint passes types, lint, 6,022 offline tests and build, plus actual Basic/Advanced CLI/runtime/phone Use and distinct prevention with refresh and conserved source costs. Authenticated SQLite cases cover saved source ownership, races, corrupt rejection and bounded old printed-counter migration; other Nexus profiles do not gain Kull. Wider verification remains **Partial**: local HTTP is 49/55 with four POST 503s and two timeouts, and full-mode/deployed acceptance stays open. See [current evidence and boundaries](NEXUS_CHOAM_RUNTIME.md#bounded-nexus-kull-profile). Pure receipts alone do not establish publisher priority or blanket Nexus immunity to Karama.
