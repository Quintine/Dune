# CHOAM Nexus Cunning

Source audit: 2026-09-10. This source audit defines native Cunning and its saved-receipt contract. The separate [runtime checkpoint](NEXUS_CHOAM_RUNTIME.md) implements five effects; this audit does not resolve the other CHOAM Nexus panels or lift any [Nexus/expansion release gate](NEXUS_CARD_RUNTIME.md).

## Authority and printed scope

The [original GF9 Nexus component photograph](https://boardgamegeek.com/image/7767032/dune-ecaz-and-moritani), independently inspected at `/tmp/dune-nexus-cards.jpg`, permits native CHOAM to discard any Treachery Card to use any Worthless Card special effect. The choice is one held physical card and one effect. It does not require holding the corresponding named Worthless card, transform the chosen card's printed identity, grant money, or supply a phase-long conversion permission.

The [GF9 Ecaz & Moritani rulebook, p.11](https://www.gf9games.com/dune/wp-content/uploads/EcazMoritani-Rulebook-LOWRES.pdf#page=11) classifies Cunning as enhancement of a native advantage. The holder must remain unallied, and a played Nexus Card is discarded. Those common conditions still apply. Publisher-indexed text and the previously fetched [publisher-authored E3 mirror](https://gamers-hq.de/media/pdf/0f/7a/86/Dune_EcazMoritani_Rulebook_EN.pdf) were used; no community compilation supplies a ruling.

CHOAM's Treachery advantage is on the ordinary faction-rules page, before its Advanced advantages. Therefore this Cunning is usable in Basic and Advanced; it is not CHOAM's separate once-per-game special Karama. [GF9 CHOAM & Richese rules, pp.7–8](https://www.gf9games.com/dune/wp-content/uploads/2021/11/CHOAM-Rulebook-low-res.pdf#page=7)

## Six effects and their timing

E2 lists **six**, not five. Five have current ordinary engine effect handlers; Kull Wahad retains its separate unfinished reaction subsystem.

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

- **Kull:** [the existing source update](CHOAM_KULL_SOURCE_UPDATE.md) leaves counter priority, BG conversion timing, interrupted-card custody and unfunded overbid recovery unresolved. Cunning does not settle those interactions. No new question was sent. Omitting Kull from a supported five-effect checkpoint must be explicit; it cannot be presented as all CHOAM Cunning.
- **Phase cancellation scope:** the existing [Worthless continuation audit](CHOAM_WORTHLESS_CONTINUATION_AUDIT.md) records unresolved scope across other physical copies or effects. Current runtime binds a canceled physical card for the phase. A new Nexus use should preserve the selected policy rather than silently broaden or erase that historical restriction. The spent Nexus itself cannot be retried.
- **Inherited effect boundaries:** fixed Ornithopter range versus Kulon, reactive movement/Revival/storm parents, special force custody, No-Field Gamont and other already documented exclusions remain properties of the selected effect. They are not reasons to reject an ordinary source-supported Cunning use with a different effect.
- **No fresh hidden reaction policy:** native CHOAM's existing effect opportunities and public circumstances supply the interaction points. Extend those owner's controls without pausing only because a secret Nexus card exists, adding compulsory no-choice confirmations, or reopening another player's completed action. Kull retains its separate pending policy.

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

[game/nexus-choam.ts](../game/nexus-choam.ts) exports the six-name `CHOAM_NEXUS_EFFECTS` map, `NexusChoamEffect`, `NexusChoamContext`, `NexusChoamReceipt`, `createNexusChoam(context, owner, phase, card, effect)` and `validateNexusChoam(context, receipt)`. Context contains the current turn and ID/faction roster only. Intrinsic validation checks exact keys, effect/phase compatibility, original native owner/roster, nonempty card ID, safe numbers and signature. The event is `JSON.stringify(['nexusChoam', turn, phase, owner, card, effect])`. Kull's intrinsic timing admits phases 0–8; this does not authorize playing its still-gated effect. Historical validation neither reads private hands nor requires the card still held, CHOAM still unallied or the old Nexus still in discard. The engine owns canonical card validation, held Nexus/unallied eligibility, exact original effect source and physical custody.

The engine should separately bind progress (`pending`, `canceled`, `discarded`, `complete`) and the exact original resume context. An independently retained latest-progress marker prevents deleting or rewinding the detailed frame from restoring the Nexus or causing another discard. Bind target, territory/sector, elite type, No-Field event and movement/revival/storm parent only where the selected effect uses them. Avoid freezing unrelated hidden hands, resource changes or nested response passes in a signature.

Integrate through the existing native effect validator with an explicit selected effect, preserving the original selected Card. Do not construct a fake Worthless hand entry merely to satisfy name-based checks. On cancellation, validate and resume the existing denied suffix without applying or paying for the chosen effect. On allowed disposal, record the physical event before yielding to a fresh-discard child; the continuation must know whether the card and effect have already committed. Reject stale actor/event/effect/target/custody before costs or private output.

Four focused pure tests in [tests/nexus-choam.test.ts](../tests/nexus-choam.test.ts) pass: six-effect timing, later-turn/reordered-roster recovery with private getter traps, edited receipt rejection, and malformed/foreign creation. Type-aware lint and whitespace checks pass. These are receipt checks, not gameplay integration certification.

Meaningful integration tests should cover all five currently supported effects in their genuine producers, Basic/Advanced parity, arbitrary canonical card families, successful and canceled selected-card custody, normal Worthless parity, denied-card phase behavior, poison-income and fresh-discard children, real BG/Box interruption, exact saved parent, private owner projection, bots, JSON/CAS recovery and failed-action immutability. Kull is a named remaining effect until its own rules and runtime are resolved. No completed engine integration or gameplay verification is claimed here.
