import type { Card } from './cards';

/** The same mandatory-discard test applies to winners and Moritani's defeated ally. */
export function canRetainBattleCard(
  card: Card,
  traitorDecided: boolean,
  toothUsed: boolean,
) {
  return (
    card.kind !== 'hero' &&
    (traitorDecided ||
      (card.kind !== 'artillery' &&
        !(card.kind === 'poisonTooth' && toothUsed)))
  );
}

export type MoritaniRetention = {
  owner: string;
  player: string;
  territory: string;
  turn: number;
  played: string[];
  eligible: string[];
  stage: 'choose' | 'response';
  keep?: string;
};

export function retentionReservesCard(
  state: { moritaniRetention?: MoritaniRetention | null },
  player: string,
  card: string,
) {
  return (
    state.moritaniRetention?.player === player &&
    state.moritaniRetention.played.includes(card)
  );
}
