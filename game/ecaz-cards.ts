import type { Card } from './cards';

export type EcazTreacheryEffect =
  | 'recruits'
  | 'reinforcements'
  | 'harassWithdraw';
export type EcazTreacheryCardId =
  | 'ecaz-recruits'
  | 'ecaz-reinforcements'
  | 'ecaz-harass-withdraw';
export type EcazTreacheryCard = Card & {
  id: EcazTreacheryCardId;
  kind: 'special';
  effect: EcazTreacheryEffect;
};
export type EcazTreacheryDefinition = Readonly<{
  card: Readonly<EcazTreacheryCard>;
  quantity: 1;
  timing: 'revival' | 'battle-plan';
  battleSlots: readonly ('weapon' | 'defense')[];
  weaponCategory: false;
  defenseCategory: false;
  discard: 'after-use';
  summary: string;
  gameplay: readonly string[];
  verification: Readonly<{
    inventory: 'verified';
    sourceRules: 'verified';
    runtime: 'not-implemented';
    combinedInteractions: 'incomplete';
    unresolved: readonly string[];
  }>;
}>;

/** Metadata only. Selecting an expansion faction must never activate this module implicitly. */
export const ECAZ_TREACHERY_VARIANT = Object.freeze({
  id: 'ecaz-treachery',
  name: 'Ecaz & Moritani treachery cards',
  physicalCards: 3,
  independentOfFactions: true,
  independentOfOtherVariants: true,
  activation: 'not-implemented',
  audit: 'docs/ECAZ_TREACHERY_RULES.md',
} as const);

const define = (definition: EcazTreacheryDefinition): EcazTreacheryDefinition =>
  Object.freeze({
    ...definition,
    card: Object.freeze({ ...definition.card }),
    battleSlots: Object.freeze([...definition.battleSlots]),
    gameplay: Object.freeze([...definition.gameplay]),
    verification: Object.freeze({
      ...definition.verification,
      unresolved: Object.freeze([...definition.verification.unresolved]),
    }),
  });

/**
 * One physical copy of each verified identity. Text below is an original gameplay
 * guide, not a transcription or artwork reproduction. Unresolved source questions
 * are developer metadata and must not become guessed gameplay instructions.
 */
export const ECAZ_TREACHERY_DEFINITIONS: readonly EcazTreacheryDefinition[] =
  Object.freeze([
    define({
      card: {
        id: 'ecaz-recruits',
        name: 'Recruits',
        kind: 'special',
        effect: 'recruits',
      },
      quantity: 1,
      timing: 'revival',
      battleSlots: [],
      weaponCategory: false,
      defenseCategory: false,
      discard: 'after-use',
      summary:
        'During Revival, double every faction’s current free-revival rate for this turn and raise the ordinary force-revival limit to seven.',
      gameplay: [
        'Play during the Revival phase. Every faction receives twice its current free-revival rate for this turn; the effect applies across the table.',
        'The ordinary limit on force revival becomes seven for the turn. A doubled free allowance still respects that limit where it applies: a current free rate of four doubles to eight, but an ordinary faction can revive only seven forces.',
        'The doubled rate changes how many revivals are free. It does not make additional paid revivals free or state a separate spice payment to play this card.',
        'Discard Recruits after use. Its change lasts for this turn and does not permanently alter faction revival rates.',
      ],
      verification: {
        inventory: 'verified',
        sourceRules: 'verified',
        runtime: 'not-implemented',
        combinedInteractions: 'incomplete',
        unresolved: [
          'Timing after earlier completed revivals, refunds, reopening opportunities and any already pending transaction.',
          'Interactions with unlimited CHOAM/Tleilaxu revival, Karama limits, prevented free revival, Fremen ally grants, special units and changing Homeworld thresholds.',
        ],
      },
    }),
    define({
      card: {
        id: 'ecaz-reinforcements',
        name: 'Reinforcements',
        kind: 'special',
        effect: 'reinforcements',
      },
      quantity: 1,
      timing: 'battle-plan',
      battleSlots: ['weapon', 'defense'],
      weaponCategory: false,
      defenseCategory: false,
      discard: 'after-use',
      summary:
        'Commit in either battle-card slot to increase the dialed number by two, transferring three of your reserve forces to the Tanks.',
      gameplay: [
        'Include Reinforcements in either the weapon slot or the defense slot of your Battle Plan. You must have at least three of your own forces in reserves to use it.',
        'Increase the dialed number by two and transfer three of your reserve forces to the Tanks. These forces come from reserves; the card does not ship them into the battle territory. No separate spice payment is specified by the card.',
        'Although it occupies a battle-card slot, Reinforcements is neither a weapon nor a defense. If Prescience asks about the category of the slot it occupies, declare no card of that category without revealing Reinforcements’ identity.',
        'Discard Reinforcements after use.',
      ],
      verification: {
        inventory: 'verified',
        sourceRules: 'verified',
        runtime: 'not-implemented',
        combinedInteractions: 'incomplete',
        unresolved: [
          'Reserve-cost timing when either side calls a traitor and in explosion or instant-outcome battles.',
          'Whether the additional dial number affects advanced spice support or on-board casualties, the eligible regular/elite reserve mix, and battle-loss bookkeeping.',
          'Disposal when a battle effect is canceled or defeated before normal use resolution.',
        ],
      },
    }),
    define({
      card: {
        id: 'ecaz-harass-withdraw',
        name: 'Harass & Withdraw',
        kind: 'special',
        effect: 'harassWithdraw',
      },
      quantity: 1,
      timing: 'battle-plan',
      battleSlots: ['weapon', 'defense'],
      weaponCategory: false,
      defenseCategory: false,
      discard: 'after-use',
      summary:
        'Commit in either battle-card slot to return your undialed forces to reserves when revealed. An opponent’s traitor call cancels this effect.',
      gameplay: [
        'Include Harass & Withdraw in either the weapon slot or the defense slot of your Battle Plan. You cannot use it on your own Homeworld.',
        'When the plan is revealed, return your undialed forces to reserves. Your leader can still be killed normally. A traitor called by your opponent cancels the withdrawal effect.',
        'A Face Dancer affecting your leader does not affect the undialed forces returned to reserves. When Ecaz and an ally are together, only the card user’s undialed forces return; the other ally resolves normally.',
        'Harass & Withdraw is neither a weapon nor a defense, despite occupying one of those slots. If Prescience asks about that category, declare no card of that category without disclosing this card’s identity.',
        'No separate spice charge is specified by the card. Discard Harass & Withdraw after use.',
      ],
      verification: {
        inventory: 'verified',
        sourceRules: 'verified',
        runtime: 'not-implemented',
        combinedInteractions: 'incomplete',
        unresolved: [
          'Withdrawal ordering with Lasgun/Shield explosions and other instant outcomes.',
          'Physical dialed/undialed accounting for advanced half-strength and double-strength units, Ecaz support, zero commitments and multiple sectors.',
          'Whether a traitor-canceled special counts as used for mandatory disposal or winner retention.',
        ],
      },
    }),
  ]);

/** Inventory factory only: never composes, activates or changes an existing game deck. */
export function ecazTreacheryCards(): EcazTreacheryCard[] {
  return ECAZ_TREACHERY_DEFINITIONS.map(({ card }) => ({ ...card }));
}

/** Resolve a canonical physical identity, not an arbitrary special with a similar name. */
export function ecazTreacheryDefinition(
  card: Pick<Card, 'id' | 'kind' | 'effect'>,
): EcazTreacheryDefinition | undefined {
  return ECAZ_TREACHERY_DEFINITIONS.find(
    (definition) =>
      definition.card.id === card.id &&
      definition.card.kind === card.kind &&
      definition.card.effect === card.effect,
  );
}
