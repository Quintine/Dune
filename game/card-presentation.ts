import type { Card } from './cards';
import { BATTLE_CARD_HELP, battleCardLabel } from './battle-cards';
import { RULE_TOPICS, type RuleTopic } from './reference';
import { ecazTreacheryDefinition } from './ecaz-cards';
import { richeseCardDefinition } from './richese-cards';

/** Presentation uses only a card the caller has already been authorized to see. */
export type VisibleCard = Readonly<
  Pick<Card, 'id' | 'name' | 'kind' | 'effect'>
>;
export type CardPresentation = {
  category: string;
  role: 'weapon' | 'defense' | 'leader' | 'utility';
  guidance: string;
  /** Complete player-facing rules for a canonical component, separate from audit metadata. */
  gameplay?: readonly string[];
  /** A bounded component may be inspectable before its actions are implemented. */
  availability?: string;
  topics: readonly RuleTopic[];
};

/** UI eligibility only; exact identity avoids disabling unrelated special cards. */
export function richeseCardActionBlock(card: VisibleCard): string | null {
  const definition = richeseCardDefinition(card);
  if (definition?.card.effect === 'stoneBurner')
    return 'Choose Stone Burner in your battle weapon slot, then choose its leader effect after both plans are revealed.';
  if (definition?.card.effect === 'portableSnooper')
    return 'Choose Portable Snooper as your battle defense, or use its late-defense panel after reveal before submitting your traitor decision.';
  if (definition?.card.effect === 'residualPoison')
    return 'Use the Residual Poison panel before either combatant commits a leader.';
  if (definition?.card.effect === 'ornithopter')
    return 'Use the Ornithopter movement controls with your selected force group.';
  if (definition?.card.effect === 'nullentropyBox')
    return 'Use the Nullentropy Box panel to pay for a private search.';
  if (definition?.card.effect === 'juiceOfSapho')
    return 'Use the Juice of Sapho panel to choose an available Once Around or movement order change.';
  if (definition?.card.effect === 'distrans')
    return 'Choose a recipient and card in the Distrans transfer panel.';
  return definition && definition.card.effect !== 'karama'
    ? 'This Richese card’s effect is not implemented yet. You can inspect its rules.'
    : null;
}

const BASIC_GUIDANCE: Partial<Record<Card['kind'], string>> = {
  projectile:
    'Play in the weapon slot of your battle plan. A projectile weapon kills an opposing leader who has no projectile defense.',
  poison:
    'Play in the weapon slot of your battle plan. A poison weapon kills an opposing leader who has no poison defense.',
  lasgun:
    'Play in the weapon slot. A lasgun kills the opposing leader. If either player uses a Shield or Shield Snooper, a lasgun explosion takes precedence over ordinary weapon effects; traitor resolution comes first.',
  shield:
    'Play in the defense slot to protect your leader from projectile weapons. A lasgun played against any shield causes an explosion unless traitor resolution overrides it.',
  snooper:
    'Play in the defense slot to protect your leader from ordinary poison weapons. A Snooper does not protect against an activated Poison Tooth.',
  worthless:
    'May occupy either the weapon or defense slot in a battle plan, but supplies no attack or protection. Some factions can spend Worthless cards for their own powers.',
  hero: 'Use instead of a leader in your battle plan. A Cheap Hero or Heroine has zero leader strength and is discarded after use.',
};

const BATTLE_TOPIC: Partial<Record<Card['kind'], string>> = {
  poisonTooth: 'card-poison-tooth',
  artillery: 'card-artillery',
  poisonBlade: 'ix-battle-cards',
  shieldSnooper: 'ix-battle-cards',
  weirdingWay: 'ix-battle-cards',
  chemistry: 'ix-battle-cards',
  hero: 'cheap-hero-traitor',
};

/** Canonical component guides and the internal reference supply original explanations.
 * Audit metadata never enters this presentation or its rendered rules text.
 */
export function cardPresentation(card: VisibleCard): CardPresentation {
  const richese = richeseCardDefinition(card);
  if (richese)
    return {
      category: richese.printedType,
      role:
        richese.behavior.battleCategory === 'weapon'
          ? 'weapon'
          : richese.behavior.battleCategory === 'poison-defense'
            ? 'defense'
            : 'utility',
      guidance: richese.summary,
      gameplay: richese.gameplay,
      availability:
        richese.card.effect === 'juiceOfSapho'
          ? 'Richese effect integration and verification are incomplete. Supported controls cover Once Around first before bidding begins, Once Around last before your bid, and bounded movement order changes. Battle aggressor and other phase or auction modes remain unfinished; expansion starts remain disabled.'
          : richese.card.effect === 'stoneBurner'
            ? 'Stone Burner has development battle controls. Combined allocation timing and Ix timing remain guarded; full expansion starts stay disabled.'
            : 'Richese effect integration and verification are incomplete. Karama, Distrans, Nullentropy Box, Ornithopter, Residual Poison, Portable Snooper and Stone Burner have card handlers in development fixtures; full expansion starts remain disabled.',
      topics: RULE_TOPICS.filter(
        (topic) =>
          topic.id ===
          (richese.card.effect === 'juiceOfSapho'
            ? 'juice-of-sapho'
            : richese.card.effect === 'stoneBurner'
              ? 'stone-burner'
              : richese.card.effect === 'portableSnooper'
                ? 'portable-snooper'
                : 'richese-cards'),
      ),
    };
  const ecaz = ecazTreacheryDefinition(card);
  if (ecaz && ecaz.card.name === card.name)
    return {
      category: 'Special treachery',
      role: 'utility',
      guidance: ecaz.summary,
      gameplay: ecaz.gameplay,
      topics: [],
    };
  const topicIds =
    card.kind === 'special'
      ? [`card-${card.effect ?? ''}`]
      : card.kind === 'worthless'
        ? [
            'battle-cards',
            'bg-charity-karama',
            ...(card.name === 'Trip to Gamont'
              ? ['choam-gamont']
              : card.name === 'Jubba Cloak'
                ? ['choam-jubba']
                : ['choam-worthless']),
          ]
        : [
            'battle-cards',
            ...(BATTLE_TOPIC[card.kind] ? [BATTLE_TOPIC[card.kind]!] : []),
          ];
  const topics = topicIds
    .map((id) => RULE_TOPICS.find((topic) => topic.id === id))
    .filter((topic): topic is RuleTopic => !!topic);
  const role = ['shield', 'snooper', 'shieldSnooper', 'chemistry'].includes(
    card.kind,
  )
    ? 'defense'
    : card.kind === 'hero'
      ? 'leader'
      : card.kind === 'special' || card.kind === 'worthless'
        ? 'utility'
        : 'weapon';
  return {
    category:
      card.kind === 'special'
        ? 'Special treachery'
        : battleCardLabel(card.kind),
    role,
    guidance:
      (card.kind === 'special' && card.effect === 'ghola'
        ? 'Play at any time to return one eligible dead leader, or up to five forces, for free. Forces return to your reserves. Discard this card after use.'
        : undefined) ??
      BATTLE_CARD_HELP[card.kind] ??
      BASIC_GUIDANCE[card.kind] ??
      topics[0]?.summary ??
      'Inspect the card’s available controls and the internal rules reference for its timing and permitted targets.',
    topics,
  };
}
