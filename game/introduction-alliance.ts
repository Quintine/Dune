import { quoteNexusAlliance } from './nexus-alliance';
import { strongholdProgress } from './victory-progress';
import { quoteVictory } from './victory-quote';
import type { BoardSeat } from './board-resolution-quote';

export type IntroductionAllianceChoice = {
  allianceScenario: 'invited' | 'accepts' | 'waits';
  allianceHoldings: 1 | 2;
  allianceActions: Array<'offer' | 'leave'>;
  allianceClosed: boolean;
  allianceChecked: boolean;
};
export const INTRODUCTION_ALLIANCE_DEFAULTS: IntroductionAllianceChoice = {
  allianceScenario: 'invited', allianceHoldings: 2, allianceActions: [],
  allianceClosed: false, allianceChecked: false,
};

/** Four-player, ordinary Basic examples. No room, hidden hand or AI strategy. */
export function introductionAlliance(s: IntroductionAllianceChoice) {
  if (!['invited', 'accepts', 'waits'].includes(s.allianceScenario) ||
    ![1, 2].includes(s.allianceHoldings) || !Array.isArray(s.allianceActions) ||
    s.allianceActions.length > 2 ||
    s.allianceActions.some((a, i) => !['offer', 'leave'].includes(a) ||
      (i === 1 && (a !== 'leave' || s.allianceActions[0] !== 'offer'))) ||
    typeof s.allianceClosed !== 'boolean' || typeof s.allianceChecked !== 'boolean' ||
    (s.allianceChecked && !s.allianceClosed)) throw new Error('Invalid alliance practice.');

  let players: BoardSeat[] = [
    { id: 'you', faction: 'atreides', ally: null, forces: { 'arrakeen:10': 1, 'carthag:11': 1 } },
    { id: 'emperor', faction: 'emperor', ally: null,
      forces: { 'sietch_tabr:14': 1, ...(s.allianceHoldings === 2 ? { 'habbanya_ridge_sietch:17': 1 } : {}) } },
    { id: 'harkonnen', faction: 'harkonnen', ally: null, forces: { 'tueks_sietch:5': 1 } },
    { id: 'guild', faction: 'guild', ally: null, forces: { 'polar_sink:0': 1 } },
  ];
  let offers: Record<string, string> = {};
  const actions: Array<{ actor: string; target: string | null }> = [];
  const transcript: string[] = [];
  const apply = (actor: string, target: string | null) => {
    const before = players.find(p => p.id === actor)!;
    const quote = quoteNexusAlliance({ players, offers, actor, target });
    players = players.map(p => ({ ...p, ally: quote.allies[p.id] }));
    offers = quote.offers;
    actions.push({ actor, target });
    const name = actor === 'you' ? 'You' : 'The Emperor';
    transcript.push(quote.formed ? 'You and the Emperor formed an alliance. Both players agreed.'
      : target ? `${name} offered an alliance.`
      : before.ally ? `${name} broke the alliance. Both players are now unallied.`
      : `${name} stayed unallied${actions.some(a => a.actor === actor && a.target) ? ' and withdrew the offer' : ''}.`);
  };
  if (s.allianceScenario === 'invited') apply('emperor', 'you');
  for (const action of s.allianceActions) {
    apply('you', action === 'offer' ? 'emperor' : null);
    if (action === 'offer' && s.allianceScenario === 'accepts') apply('emperor', 'you');
    else if (action === 'offer' && s.allianceScenario === 'waits')
      transcript.push('The Emperor has not accepted. An offer alone does not make an alliance.');
  }
  const board = { advanced: false, storm: 18, order: players.map(p => p.id), players };
  const progress = strongholdProgress(board).progress.find(p => p.player === 'you')!;
  const winner = s.allianceChecked ? quoteVictory({ ...board, turn: 2, phase: 8,
    status: 'playing', winner: [] }).winner : [];
  const ended = s.allianceActions.at(-1) === 'leave';
  return { players, offers, actions, transcript, progress, winner,
    allied: !!players[0].ally,
    incoming: offers.emperor === 'you' && !players[0].ally,
    outgoing: offers.you === 'emperor' && !players[0].ally,
    canOffer: !s.allianceClosed && !s.allianceActions.length,
    canLeave: !s.allianceClosed && !ended,
  };
}
