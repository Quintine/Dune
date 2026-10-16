import type { Card } from './cards';
import { BATTLE_CARD_HELP, battleCardLabel } from './battle-cards';
import { RULE_TOPICS, type RuleTopic } from './reference';
import { ecazTreacheryDefinition } from './ecaz-cards';
import { richeseCardDefinition } from './richese-cards';
import { printedCardCategory } from './card-category';

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
  if (definition?.card.effect === 'mirrorWeapon')
    return 'Choose Mirror Weapon in your battle weapon slot. It copies the opposing revealed weapon attack, with your own first post-reveal choice if needed.';
  if (definition?.card.effect === 'portableSnooper')
    return 'Choose Portable Snooper as your battle defense, or use its late-defense panel after reveal before submitting your traitor decision.';
  if (definition?.card.effect === 'residualPoison')
    return 'Use the Residual Poison panel before either combatant commits a leader.';
  if (definition?.card.effect === 'ornithopter')
    return 'Use the Ornithopter movement controls with your selected force group.';
  if (definition?.card.effect === 'nullentropyBox')
    return 'Use the Nullentropy Box panel to pay for a private search.';
  if (definition?.card.effect === 'juiceOfSapho')
    return 'Use the Juice of Sapho panel to choose an available order change or become battle aggressor before plans.';
  if (definition?.card.effect === 'distrans')
    return 'Choose a recipient and card in the Distrans transfer panel.';
  if (definition?.card.effect === 'semutaDrug')
    return 'Use the neutral fresh-discard response when offered in the selected Semuta development profile. Its connected producers are listed in the table preview and rules guide. Commit before inspecting private discarded faces; choose exactly one when the fresh group has multiple eligible cards. Taking a card never refunds a paid cost or replays its original effect. The approved full-hand exchange spends Semuta without increasing the completed hand.';
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
          ? 'Richese effect integration and verification are incomplete. Supported controls cover Once Around first or last while your bid remains open, bounded movement and battle-choice ordering, and aggressor during the shared pre-plan opportunity. Earlier bids stay committed. Later aggressor intervention and other phase or auction modes remain unfinished; expansion starts remain disabled.'
          : richese.card.effect === 'semutaDrug'
            ? 'The explicit Semuta development preview offers neutral responses after clean public ordinary-card discards, paid Box disposal, retired Ornithopter movement (including a following Bene Gesserit Intrusion), Distrans, ordinary and queued definite Truthtrance answers, four Sapho scopes, unready pre-leader Residual Poison, printed Karama cancelling CHOAM Charity/Inflation/Bene Gesserit Charity, native capture/Auditor/battle-income/Ix-substitution/Basic allied-retention powers, or settling a normal-auction purchase or winning bid, a completed CHOAM sale, clean Kulon, proactive or reactive La La La/Baliset, proactive/final-Mentat Trip to Gamont with an ordinary/elite force or concealed No-Field, accepted Jubba Cloak before storm protection, Ix-deck Thumper/Amal, three battle discard stages (including before original Tech award, native Advanced capture, Face Dance, quoted CHOAM income or Auditor) and private normal-auction or Black Market Ixian ally replacements. Acquiring a printed cancellation cost never restores its canceled effect. Tech requires a supported fresh 3–6-seat CHOAM/optional-Ix profile. Native Ixian casualty substitution keeps its original before-Tooth order. Native Basic Moritani cleanup offers only unkept played cards after the original choice and Karama response, preserving its kept card and unchanged original retention pool. The Basic Richese/Moritani CHOAM/Ecaz entry also adds private Sabotage and Robbery overflow after clean shipment/movement arrivals, preserving the original victim/draw and arrival suffix. Commitment is owner-only; the approved full-hand exchange spends Semuta without increasing your completed hand. Other pending rewards, producers, nested responses and normal expansion starts remain unfinished.'
          : richese.card.effect === 'mirrorWeapon'
            ? 'Mirror Weapon works in supported CHOAM/Richese-deck tables, including selected Ix/CHOAM with original Tech3+ and Advanced Strongholds2+, or existing Advanced native Ecaz/Moritani. Copied Tooth or Stone chooses before its original; a winning physical Mirror may be kept after copied Tooth or Artillery under the user-selected retention interpretation. Original Stone/Tooth uses provisional Stone-first. Typed public allocation safety, mixed E3 phase-module and other profile/full-start guards remain.'
          : richese.card.effect === 'stoneBurner'
            ? 'Stone Burner has development controls, including selected CHOAM/Ix with original Tech3+ and Advanced Strongholds2+. Earned Habbanya may decide a physical-token tie; +2 Reinforcements does not. Original Stone provisionally chooses before uncopied Tooth; Mirror copies still choose first as printed. Winner-changing physical allocations, mixed E3 phase modules and other profile/full-start limits remain guarded.'
            : 'Richese effect integration and verification are incomplete. Karama, Distrans, Nullentropy Box, Ornithopter, Residual Poison, Portable Snooper, Stone Burner and Mirror Weapon have bounded card handlers; full expansion starts remain disabled.',
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
      availability: ecaz.card.effect === 'recruits'
        ? 'Recruits has development controls during Revival, including classic Basic/Advanced Homeworlds with original Tech3+ and Advanced Strongholds2+. Selected Ix/CHOAM composes those phase modules separately without Homeworlds. Double the current native free rate within the seven-force total; typed deposits, special-force caps and original once-per-phase Axlotl income stay. Prior paid returns keep payment under the provisional no-refund policy; pending transactions, unknown ledgers, later Fremen grants and replay remain guarded.'
        : ecaz.card.effect === 'harassWithdraw'
          ? 'Harass & Withdraw has controls in either battle-card slot, with physical allocation after reveal. Classic tables including Homeworlds compose original Tech3+ and Advanced Strongholds2+; selected Ix/CHOAM remains without Worlds. Native custody returns Advanced Emperor normal to Kaitain/Sardaukar to Salusa; Basic to its primary World. Never use Harass on an own Homeworld. Original commitment/support stays. Own No-Field provisionally materializes first without resetting history. Stone compares post-withdrawal counters provisionally; its own profile/allocation guards remain.'
          : 'Reinforcements works in either slot in selected Ix/CHOAM, classic tables including Homeworlds, and selected Advanced Occupy. Classic Worlds now retain original Tech3+ and Advanced Strongholds2+; selected Ix/CHOAM phase modules remain without Worlds. Spend three original own reserves normal-first for +2 normal score, not support or physical tokens. Exact World sources seal when ambiguous; a fee here cannot also fund its dial. Original face/support stays. No-Field must leave three before payment; future Harass cannot fund it. Stone ignores +2 but charges reserves. Cost/order interpretations and remaining profile guards stay.',
      topics: RULE_TOPICS.filter((topic) => topic.id === (ecaz.card.effect === 'harassWithdraw' ? 'card-harass-withdraw' : ecaz.card.effect === 'reinforcements' ? 'card-reinforcements' : 'card-recruits')),
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
  const category = printedCardCategory(card);
  const role =
    category === 'hero'
      ? 'leader'
      : category === 'special' || category === 'worthless'
        ? 'utility'
        : category;
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
