import type { Card } from './cards';

export function canUseAsKarama(advanced: boolean, faction: string, card: Card) {
  return (
    card.effect === 'karama' ||
    (advanced && faction === 'beneGesserit' && card.kind === 'worthless')
  );
}
