import type { Card } from './cards';

export type RicheseCardEffect =
  | 'ornithopter'
  | 'residualPoison'
  | 'semutaDrug'
  | 'stoneBurner'
  | 'mirrorWeapon'
  | 'portableSnooper'
  | 'distrans'
  | 'juiceOfSapho'
  | 'karama'
  | 'nullentropyBox';
export type RicheseCard = Card & { kind: 'special'; effect: RicheseCardEffect };
export type RicheseCardDefinition = Readonly<{
  card: Readonly<RicheseCard>;
  quantity: 1;
  printedType:
    | 'Special'
    | 'Special - Movement'
    | 'Weapon - Special'
    | 'Defense - Poison';
  timing: string;
  summary: string;
  gameplay: readonly string[];
  behavior: Readonly<{
    spiceCost: 0 | 2;
    disposal: 'normal-discard' | 'normal-discard-top-after-shuffle';
    battleCategory: 'none' | 'weapon' | 'poison-defense';
    contract: readonly string[];
  }>;
  verification: Readonly<{
    inventory: 'physical-faces-verified';
    gameplay: 'original-paraphrase-of-physical-faces';
    runtime: 'partial' | 'not-implemented';
    combinedInteractions: 'incomplete';
    unresolved: readonly string[];
  }>;
}>;

/** Separate faction cache, not a general expansion deck or an activation flag. */
export const RICHESE_COLLECTION = Object.freeze({
  physicalCards: 10,
  initialZone: 'richese-cache',
  cacheCountsTowardHand: false,
  discardedDestination: 'normal-discard',
  activation: 'not-implemented',
  audit: 'docs/RICHESE_COMPONENTS.md',
} as const);

function define(
  id: string,
  name: string,
  effect: RicheseCardEffect,
  printedType: RicheseCardDefinition['printedType'],
  timing: string,
  summary: string,
  gameplay: string[],
  contract: string[],
  unresolved: string[],
  spiceCost: 0 | 2 = 0,
): RicheseCardDefinition {
  return Object.freeze({
    // Preserve physical transport identities in saved games. Supported battle roles
    // are admitted by exact canonical predicates, never the generic special kind.
    card: Object.freeze({
      id: `richese-${id}`,
      name,
      kind: 'special' as const,
      effect,
    }),
    quantity: 1 as const,
    printedType,
    timing,
    summary,
    gameplay: Object.freeze(gameplay),
    behavior: Object.freeze({
      spiceCost,
      disposal:
        effect === 'nullentropyBox'
          ? ('normal-discard-top-after-shuffle' as const)
          : ('normal-discard' as const),
      battleCategory:
        printedType === 'Weapon - Special'
          ? ('weapon' as const)
          : printedType === 'Defense - Poison'
            ? ('poison-defense' as const)
            : ('none' as const),
      contract: Object.freeze(contract),
    }),
    verification: Object.freeze({
      inventory: 'physical-faces-verified' as const,
      gameplay: 'original-paraphrase-of-physical-faces' as const,
      runtime: effect === 'karama' || effect === 'distrans' || effect === 'nullentropyBox' || effect === 'ornithopter' || effect === 'residualPoison' || effect === 'portableSnooper' || effect === 'stoneBurner' ? ('partial' as const) : ('not-implemented' as const),
      combinedInteractions: 'incomplete' as const,
      unresolved: Object.freeze(unresolved),
    }),
  });
}

/** Original guidance for the photographed physical cards; no printed artwork or text reproduction. */
export const RICHESE_CARD_DEFINITIONS: readonly RicheseCardDefinition[] =
  Object.freeze([
    define(
      'ornithopter',
      'Ornithopter',
      'ornithopter',
      'Special - Movement',
      'own-movement',
      'During your movement, move a group up to three territories or move two groups normally.',
      [
        'Use Ornithopter as part of your movement. Choose either to move one group of your forces as far as three territories, or to move two different groups using your normal movement allowance.',
        'This is a movement effect; it does not provide another reserve shipment. Discard the card after using the chosen option.',
      ],
      [
        'Choose one movement mode before resolving it.',
        'Persist both group moves as one card effect; discard exactly once.',
      ],
      [
        'Composition with storm, movement prevention, No-Fields, special movement allowances, mobile strongholds and interrupted entry reactions.',
      ],
    ),
    define(
      'residual-poison',
      'Residual Poison',
      'residualPoison',
      'Special',
      'before-leader-selection',
      'Before leaders are chosen in your battle, send one randomly selected available opposing leader to the Tanks.',
      [
        'Play against an opponent before leaders are chosen for a battle. Randomly select one available leader belonging to that faction and send that leader to the Tanks.',
        'No player collects spice for this death. Discard Residual Poison after use.',
      ],
      [
        'Server selects the available leader at random once; preserve that result across continuation and reload.',
        'Death awards no spice.',
      ],
      [
        'Definition of available for captured leaders, gholas, Duke Vidal, repeated-use restrictions and a faction with no available leader.',
        'Order against other pre-plan effects and leader skills.',
      ],
    ),
    define(
      'semuta-drug',
      'Semuta Drug',
      'semutaDrug',
      'Special',
      'immediately-after-other-player-discard',
      'Take one Treachery Card immediately after another player discards it.',
      [
        'Immediately after another player discards a Treachery Card, use Semuta Drug to take that discarded card into your hand.',
        'If several cards are discarded together, choose which one to take. Discard Semuta Drug after use.',
      ],
      [
        'Bind selection to a specific fresh discard event and its physical cards.',
        'Never expose older discard-pile contents through this reaction.',
      ],
      [
        'Full-hand timing before Semuta itself is discarded, simultaneous claims, and interaction with Nullentropy or other replacement effects.',
        'Whether particular nonstandard discard transactions supply a valid reaction window.',
      ],
    ),
    define(
      'stone-burner',
      'Stone Burner',
      'stoneBurner',
      'Weapon - Special',
      'battle-plan-and-reveal-choice',
      'After plans are revealed, choose to kill both leaders or disregard the strength of any surviving leaders; compare undialed forces.',
      [
        'Commit Stone Burner in your weapon slot. After both plans are revealed, choose to kill both leaders or ignore the strength of leaders who otherwise survive. Ignoring strength does not protect a leader from other weapons.',
        'Both choices compare undialed physical force tokens: the player with more undialed force tokens wins, and the aggressor wins a tie. Dialed force losses and spice support still apply normally; leader and Kwisatz Haderach strength do not decide this comparison.',
        'Normal leader bounty and battle-card retention apply unless another effect overrides them. A winning player may keep Stone Burner; a losing played card is discarded, subject to the usual Moritani ally retention power.',
      ],
      [
        'Post-reveal owner choice is persisted before applying the selected result.',
        'Victory comparison uses undialed force tokens, not the ordinary strength total.',
      ],
      [
        'Tie resolution, other weapons/defenses, traitors, Face Dancers, Cheap Heroes, explosions and battle skills.',
        'Advanced double/half-strength forces, supported forces, Ecaz combined forces, No-Fields, Karama and death-spice accounting.',
      ],
    ),
    define(
      'mirror-weapon',
      'Mirror Weapon',
      'mirrorWeapon',
      'Weapon - Special',
      'battle-plan',
      'Copy the weapon revealed in the opponent’s Battle Plan.',
      [
        'Include Mirror Weapon in your Battle Plan. It copies the opponent’s revealed weapon, provided their card counts as a weapon.',
        'If the order of using the two weapons matters, your copied weapon must be used first. Discard Mirror Weapon after use.',
      ],
      [
        'Determine the copied weapon from the revealed opposing plan, not the opponent’s hand.',
        'Physical disposal follows the general official winner-retention rule unless a specific exception applies; copied special-weapon disposal remains under audit.',
      ],
      [
        'Two Mirror Weapons, no opposing weapon, mode-dependent cards, Poison Tooth, Artillery Strike, Stone Burner and weapon-order effects.',
        'Copied card disposal and effects that cancel or replace weapons.',
      ],
    ),
    define(
      'portable-snooper',
      'Portable Snooper',
      'portableSnooper',
      'Defense - Poison',
      'after-own-plan-reveal',
      'Use as your poison defense, or add it after revealing a plan with no defense and room for another battle card.',
      [
        'Choose Portable Snooper as the defense in your Battle Plan to protect your leader against a poison weapon. You may also play it after revealing your Battle Plan if that plan contained no defense, unless Bene Gesserit Voice prevents this play.',
        'You cannot play it if your Battle Plan contained both a weapon and a Worthless Card. Discard after use under normal battle cleanup; the general official FAQ permits a battle winner to retain it.',
        'Portable Snooper is a different card from Snooper for CHOAM’s duplicate-card exchange.',
      ],
      [
        'Late poison-defense play requires a plan with no defense and must obey Voice.',
        'Reject the weapon-plus-Worthless plan combination.',
        'Distinct identity from the ordinary Snooper for duplicate matching.',
      ],
      [
        'Prescience/Truthtrance promises about the original plan versus later defense, weapon-order timing, combinations and nonstandard slot occupants.',
      ],
    ),
    define(
      'distrans',
      'Distrans',
      'distrans',
      'Special',
      'any-time-except-during-bid',
      'Give another player a card from your hand if their hand has room.',
      [
        'At any time other than during a bid, give another player one Treachery Card from your hand. The recipient must have room for the card.',
        'Discard Distrans after carrying out the transfer. This card can give to another player; it does not require an alliance.',
      ],
      [
        'Validate recipient capacity and physical ownership before a single atomic transfer/discard.',
        'Never select a card from the separate Richese cache.',
      ],
      [
        'Giving Distrans itself, committed/reserved cards, suspended transactions and exactly which auction substeps constitute during a bid.',
      ],
    ),
    define(
      'juice-of-sapho',
      'Juice of Sapho',
      'juiceOfSapho',
      'Special',
      'when-intervening-in-available-phase',
      'Choose to become the battle aggressor, or act first or last in a turn-ordered action.',
      [
        'Choose one effect: become the aggressor in a battle; take the first position in a phase or action that uses turn order; or take the last position in such a phase or action, including after the Spacing Guild.',
        'Play the card during the phase in which you want to intervene, while that intervention is still available. The Richese Once-Around auction permits using it to bid last.',
        'Discard Juice of Sapho after use.',
      ],
      [
        'Declare exactly one order change within an available current action.',
        'Once-Around last-bid use is expressly confirmed by the rulebook FAQ.',
      ],
      [
        'Ordering against Richese’s final matching opportunity, concurrent order changes, already completed turns and nested action queues.',
        'Silent-auction tie order is not expressly changed by the face.',
      ],
    ),
    define(
      'karama',
      'Karama',
      'karama',
      'Special',
      'advantage-attempt-or-purchase',
      'Use the standard updated Karama options for faction-power cancellation, shipping or card acquisition.',
      [
        'After setup and all faction starting actions are complete, prevent one use of a faction advantage, including an alliance ability, when a player attempts it. An advantage used in a Battle Plan must be prevented before plans are revealed.',
        'Alternatively, purchase a reserve shipment to the planet at Spacing Guild rates, paying the bank; or use the Treachery auction option to bid beyond your spice without revealing the Karama, or acquire the card without paying spice. You cannot acquire a card this way if your hand is full.',
        'Karama cannot stop a special victory condition or a special Karama power. In an advanced game, the holder may instead use their own faction’s special Karama power when its requirements are met. Resolve the chosen use and discard the Karama.',
        'A Richese cache sale or Black Market sale cannot be won using Karama, including when the card being sold is this Karama.',
      ],
      [
        'Same updated Karama rules family, separate physical card ID.',
        'Purchase restrictions depend on auction provenance, not the printed card family.',
      ],
      [
        'Every faction-specific cancellation window, special-power once-per-game bookkeeping, prevention interactions and commitments require existing Karama validation integration.',
      ],
    ),
    define(
      'nullentropy-box',
      'Nullentropy Box',
      'nullentropyBox',
      'Special',
      'any-time',
      'Pay two spice to search the discard pile privately and take a card other than Nullentropy Box.',
      [
        'At any time, pay two spice to the bank. Secretly search the Treachery discard pile for any card other than a Nullentropy Box, and add that card to your hand.',
        'Afterward, shuffle the discard pile and return it to its place, then discard Nullentropy Box on top. The FAQ explicitly forbids recovering Nullentropy Box with its own effect.',
        'The search is permission granted by this card. It does not make the discard pile public information for other players.',
      ],
      [
        'Pay exactly two to the bank; expose searchable discard faces only to the acting player.',
        'Exclude Nullentropy Box from selection.',
        'Shuffle remaining discard, then put this card on top; never return it to Richese’s cache.',
      ],
      [
        'Full-hand capacity before the Box leaves, empty discard pile, discard recycling order and Semuta’s reaction to the final discard.',
      ],
      2,
    ),
  ]);

/** Fresh inventory only. Caller must not insert this into a game before runtime support exists. */
export function richeseCards(): RicheseCard[] {
  return RICHESE_CARD_DEFINITIONS.map(({ card }) => ({ ...card }));
}

/** Never enrich an arbitrary similarly named or effect-tagged card. */
export function richeseCardDefinition(
  card: Pick<Card, 'id' | 'name' | 'kind' | 'effect'>,
): RicheseCardDefinition | undefined {
  return RICHESE_CARD_DEFINITIONS.find(
    ({ card: canonical }) =>
      canonical.id === card.id &&
      canonical.name === card.name &&
      canonical.kind === card.kind &&
      canonical.effect === card.effect,
  );
}
