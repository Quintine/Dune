# Ecaz poison-discard income

Audit: 9 September 2026. This covers high Ecaz's card-discard income, not its
Homeworld victory condition or a complete Ecaz release.

## Source contract

The original Ecaz high face was visually rechecked in
[BGG component photograph 7767034](https://boardgamegeek.com/image/7767034/dune-ecaz-and-moritani)
(`/tmp/dune-card-economy-homeworlds.jpg`). At native population 7–20, it awards
three bank spice for each discarded poison weapon. It does not restrict the
discarding faction, phase, location, reason or number of awards. Consequently,
Ecaz's own discards qualify too; a two-card qualifying batch pays six. The
wording makes collection automatic, with no separate optional claim.

[GF9 E3, pp.9–10](https://www.gf9games.com/dune/wp-content/uploads/EcazMoritani-Rulebook-LOWRES.pdf#page=9)
makes high eligibility depend on current native reserves and protects Homeworld
advantages and penalties from Karama. Check Ecaz's own Homeworld at the actual
discard event. An ally's reserves or foreign visitors do not supply its native
threshold. Neither merely playing Ecaz nor selecting Advanced rules activates
the Homeworld module. Occupation lifecycle questions remain documented in
[Homeworld rules](HOMEWORLD_RULES.md).

The [November GF9 FAQ, pp.3–5,8](https://www.gf9games.com/dune/wp-content/uploads/2020/11/Dune-FAQ-Nov-2020.pdf)
clarifies generic weapon categories for special cards, Chemistry's conditional
role, and unused Poison Tooth disposal. The
[E2 rulebook, p.9](https://www.gf9games.com/dune/wp-content/uploads/2021/11/CHOAM-Rulebook-low-res.pdf#page=9)
independently requires Chemistry to be played as a weapon for the poison-weapon
Leader Skill bonus. These indexed publisher passages were freshly retrieved;
direct PDF endpoints remain unavailable. No specific Ecaz/Chemistry worked
example was retrieved, so composing the actual played role with the discard
trigger is an explicit interpretation from those category rules.

## Classification

| Physical card / runtime kind | Qualifies when actually discarded? |
| --- | --- |
| Chaumas, Chaumurky, Gom Jabbar, Ellaca Drug; Basilia Weapon (`poison`) | Yes, including unused hand disposal or a cost. |
| Poison Blade (`poisonBlade`) | Yes: its generic attack categories include poison and projectile. One card still produces one award. |
| Poison Tooth (`poisonTooth`) | Yes: poison weapon, including an unused Tooth that must nevertheless be discarded. Activation changes its attack, not its category. A retained Tooth produces no discard award. |
| Chemistry (`chemistry`) | Yes when discarded from its actual weapon slot, with the already validated complementary defense. No when used as defense or discarded directly from hand. Potential weapon use is insufficient. |
| Shield Snooper, Snooper, Portable Snooper | No: poison defenses are not poison weapons. |
| Artillery Strike, Lasgun, Stone Burner, projectile weapons, Weirding Way | No: killing a leader does not make a card a poison weapon. |
| Residual Poison | No: its verified physical card is Special, with a pre-leader effect, not a poison battle weapon. The name alone supplies no category. See [Richese component audit](RICHESE_COMPONENTS.md). |
| Worthless, Cheap Hero, ordinary special cards | No, even if occupying a weapon slot. |
| Mirror Weapon | Direct hand disposal: no. A played copy uses its retained actual copied weapon category, including poison, Blade, Tooth or weapon Chemistry. No opposing weapon gives no poison category. Existing Mirror activation/retention work remains separate. |

The Chemistry distinction must use the plan slot at disposal, before battle
cleanup loses that information. In particular, winner optional disposal and
Moritani retention occur after the engine clears `g.battle`; they need an
event-bound retained role receipt rather than consulting a missing plan. Do not call `weaponTypes(card)` on every card:
that helper assumes a weapon role and would incorrectly classify hand or
defense Chemistry. Do not rewrite a physical card's stored kind to its battle
role. Generic printed poison/Blade/Tooth discards do not require a battle.

These classifications apply equally to mandatory cleanup, voluntary winning
card disposal, hand reduction, exchange costs, CHOAM cash-in or Ambassador
effects, and paid Kaitain disposal. Merely returning an unsold lot to the deck,
transferring a card between hands, recovering a discard, reshuffling the old
discard pile or removing a card from the game is not a new discard.

## Battle cleanup timing

The [GF9 base rulebook, p.11](https://www.gf9games.com/dunegame/wp-content/uploads/Dune-Rulebook.pdf#page=11)
describes losing cleanup (all losing forces and played cards) before winning
cleanup (dialed force losses, then card retention/disposal). The
[official Quick Start, p.11](https://www.gf9games.com/dunegame/wp-content/uploads/Quick-start-Guide.pdf#page=11)
uses the same order in its worked battle. These publisher-indexed passages
support the existing losing-discard-before-winner-casualties sequence; they do
not number smaller simultaneous timing steps. Accordingly, native Ecaz winning
with seven reserves can receive losing-poison income while still high, then
fall to six when its own dialed losses are removed. Its subsequent winning-card
discards use that new low population. E3's continuous threshold rule supplies
the immediate change; no contrary E3 cleanup rule was retrieved.

The original E1 Poison Tooth face was freshly inspected in
[component photograph 5495302](https://boardgamegeek.com/image/5495302/dune-ixians-and-tleilaxu)
(`/tmp/dune-ix-cards.jpg`). It permits declining the weapon after seeing battle
results and contains no physical-discard instruction. The November FAQ, p.8,
requires a used winning Tooth to be discarded, through its winner/loser
retention answer; it does not instruct discarding upon activation. E2, p.4,
replaces this original face. Retrieval of the revised physical face remains
incomplete, so it cannot be cited as granting an earlier disposal event.

The source-based implementation recommendation is therefore to retain losing
card disposal in losing cleanup, and apply a winning used Tooth's mandatory
disposal after winner casualties, alongside winning-card cleanup. This is a
composition of the published cleanup order and the FAQ retention exception,
not an explicit Ecaz/Tooth worked ruling. Selecting Tooth activation alone is
not a physical discard: a subsequent successful traitor declaration still
overrides ordinary weapon resolution. Do not manufacture a new activation-time
discard or snapshot the battle's starting population for later disposal.

## Pure API and engine responsibilities

`game/ecaz-poison-income.ts` exports:

```ts
type EcazPoisonDiscard = {
  card: Card;
  battleSlot?: 'weapon' | 'defense' | 'leader';
  effectiveWeapon?: EffectiveWeapon; // retained validated Mirror copy
};
quoteEcazPoisonIncome(context, discarded)
// => { player, amount, count } | null
```

The context is the Game subset `advanced`, `players`, `homeworlds`. The quote
uses public native custody and discarded physical descriptors; it does not read
hands, spice balances, opponents' plans or discarded-by identity. It validates
unique physical IDs and supplied slot values. For a played Mirror, the caller supplies its retained
`resolveBattleWeapons` descriptor. A missing or conflicting descriptor raises
`EcazPoisonIncomeError` as an integrity failure. The
[Mirror source audit](MIRROR_WEAPON_ENGINE_AUDIT.md) establishes actual-role
copying; applying that role to this discard trigger is source composition,
not a separate new ruling. The earlier unanswered question about mandatory
physical disposal after copying Tooth/Artillery concerns whether a discard
occurs, not what category its already established copy has. A recovered poison may later be
discarded again and earn again: deduplication belongs to the particular event,
not a permanent set of rewarded card IDs.

The engine must prove the cards genuinely cross into discard custody, obtain
the actual prior battle slots, pay exactly once, and preserve that payment
through JSON/CAS and any fresh-discard continuation. Quote before mutation;
commit the physical transition and its income in the same transaction. Do not
pay again when merely resuming `pendingTreacheryDiscard`. The quote's current
population must correspond to that actual event; neither a phase-start snapshot
nor a later reconstruction after unrelated force changes is equivalent.

Use the existing visibility of each source discard. A private discard remains
private; do not expose card IDs/names or change `publicFace: false` to publish the
income. Current game logs are globally projected. Any added public income
message must be reviewed for revealing a private discarded card's category;
private account evidence is preferable where the source keeps its face secret.

## Physical mutation audit

At this audit, `rg` found these direct engine mutations:

| Location | Meaning / integration requirement |
| --- | --- |
| `discard(g,p,id)` | Central hand-to-pile transition; covers battle cleanup, gifts' disposal costs, sales, cash-in, Ambassador/terror discards and ordinary card play. Preserve plan slot before cleanup. |
| `finishNullentropy`: `g.discard = result.discard` | Removes the recovered target, shuffles old cards and appends the used Box. Only the Box is freshly discarded; recovering a poison or moving old poison within the pile earns nothing. |
| `finishOrnithopter`: `g.discard.push(flight.card)` | Played-card-to-pile transition; Ornithopter itself does not qualify. |
| Distrans action: `g.discard.push(result.discarded)` | Only played Distrans is discarded; the transferred card is not. |
| `draw`: `g.discard = []` | Reshuffle into the deck, not fresh disposal. |
| `newGame`: `discard: []` | Initialization, not disposal. |
| Guild cancellation: `g.discard.splice(...)` | Retrieves a previously spent rate card; no new discard or refund of prior Ecaz income. |

`stageTreacheryDiscard` and `finishTreacheryDiscard` preserve receipts and resume
effects; they are not additional physical transfers. Existing `discard()` had
no Ecaz income hook when this audit began. No other direct `.discard.push` or
`.discard =` mutation was found in `game/`. The battle-resolution quote returns
card-ID disposal instructions; its engine adapter executes them through
`discard()`. Winner cleanup and Moritani retention also use that helper.
`resolveNullentropyBox` and inactive `resolveSemuta` construct detached discard
arrays; Box is accounted for above, while future Semuta integration must not
re-award a recovered poison. Generic hand-transfer helpers move cards without
discarding the transferred identity.

## Verification

Eight focused tests in `tests/ecaz-poison-income.test.ts` pass. They cover all
seven qualifying physical cards in the currently assembled base+Ix inventory,
both game modes, conditional Chemistry, all remaining current card kinds,
exact threshold and module-off behavior, foreign visitors, private-access
traps, JSON stability, malformed/duplicate receipts and actual Mirror-copy descriptors.
Run `npm test -- ecaz-poison-income`. These are pure-quote tests; engine timing,
income visibility and multiplayer recovery need separate integration evidence.
