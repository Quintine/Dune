import {
  validateNexusCards,
  validateNexusPlayers,
  type NexusPlayer,
  type NexusState,
} from './nexus-cards';

/** One closing opportunity for the whole Spice Blow and Nexus phase, including
 * both Advanced spice piles. Pre-draw own-faction policies resolve privately
 * within one action, so public progress never identifies a drawn card. */
export type NexusCardPhase = {
  turn: number;
  occurred: boolean;
  stage: 'spice' | 'drawing' | 'complete';
  eligible: string[];
  done: string[];
  signature: string;
};
export type NexusCardChoice = 'draw' | 'replace' | 'keep';

function requireNexus(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
function signature(phase: Omit<NexusCardPhase, 'signature'>): string {
  return JSON.stringify([
    'nexusCardPhase',
    phase.turn,
    phase.occurred,
    phase.stage,
    phase.eligible,
    phase.done,
  ]);
}
function validateFrame(phase: NexusCardPhase): void {
  requireNexus(
    phase &&
      typeof phase === 'object' &&
      !Array.isArray(phase) &&
      Object.keys(phase).sort().join(',') ===
        'done,eligible,occurred,signature,stage,turn' &&
      Number.isSafeInteger(phase.turn) &&
      phase.turn > 0 &&
      typeof phase.occurred === 'boolean' &&
      ['spice', 'drawing', 'complete'].includes(phase.stage),
    'Invalid saved Nexus phase.',
  );
  for (const list of [phase.eligible, phase.done])
    requireNexus(
      Array.isArray(list) &&
        new Set(list).size === list.length &&
        list.every((id) => typeof id === 'string' && id.trim().length > 0),
      'Invalid Nexus decision owners.',
    );
  requireNexus(
    phase.done.every((id) => phase.eligible.includes(id)),
    'Nexus choices must belong to an eligible player.',
  );
  requireNexus(
    phase.signature === signature(phase),
    'The saved Nexus phase has lost its original progress.',
  );
  if (phase.stage === 'spice')
    requireNexus(
      !phase.eligible.length && !phase.done.length,
      'Nexus draws cannot precede the closing opportunity.',
    );
  if (!phase.occurred)
    requireNexus(
      !phase.eligible.length,
      'Nexus draws require an actual Nexus this phase.',
    );
  if (phase.stage === 'complete')
    requireNexus(
      phase.eligible.length === phase.done.length,
      'A completed Nexus opportunity cannot retain a choice.',
    );
  if (phase.stage === 'drawing')
    requireNexus(
      phase.eligible.some((id) => !phase.done.includes(id)),
      'A Nexus draw window needs an unfinished recipient.',
    );
}
function signed(phase: Omit<NexusCardPhase, 'signature'>): NexusCardPhase {
  return { ...phase, signature: signature(phase) };
}
export function createNexusCardPhase(turn: number): NexusCardPhase {
  requireNexus(
    Number.isSafeInteger(turn) && turn > 0,
    'Invalid Nexus phase turn.',
  );
  return signed({
    turn,
    occurred: false,
    stage: 'spice',
    eligible: [],
    done: [],
  });
}
export function markNexusCardOccurred(phase: NexusCardPhase): NexusCardPhase {
  validateFrame(phase);
  requireNexus(
    phase.stage === 'spice',
    'A Nexus occurrence needs its open Spice Blow phase.',
  );
  return signed({ ...structuredClone(phase), occurred: true });
}
export function validateNexusCardPhase(
  phase: NexusCardPhase,
  players: readonly NexusPlayer[],
  cards: NexusState,
): void {
  validateFrame(phase);
  validateNexusCards(cards, players);
  requireNexus(
    phase.eligible.every((id) => players.some((player) => player.id === id)),
    'Invalid Nexus decision owners.',
  );
  if (phase.stage === 'drawing') {
    const unallied = players
      .filter((player) => !player.ally)
      .map((player) => player.id);
    requireNexus(
      players.some((player) => !!player.ally) &&
        phase.eligible.length === unallied.length &&
        unallied.every((id) => phase.eligible.includes(id)),
      'A Nexus draw window needs every unallied recipient and a settled alliance.',
    );
  }
}
export function closeNexusCardPhase(
  phase: NexusCardPhase,
  players: readonly NexusPlayer[],
): NexusCardPhase {
  validateFrame(phase);
  validateNexusPlayers(players);
  requireNexus(
    phase.stage === 'spice',
    'This Nexus phase already reached its closing opportunity.',
  );
  const eligible =
    phase.occurred && players.some((player) => !!player.ally)
      ? players.filter((player) => !player.ally).map((player) => player.id)
      : [];
  return signed({
    ...structuredClone(phase),
    eligible,
    stage: eligible.length ? 'drawing' : 'complete',
  });
}
export function nexusCardChoices(
  phase: NexusCardPhase | null,
  cards: NexusState,
  player: string,
): NexusCardChoice[] {
  if (!phase) return [];
  validateFrame(phase);
  if (
    phase.stage !== 'drawing' ||
    !phase.eligible.includes(player) ||
    phase.done.includes(player)
  )
    return [];
  return cards.hands[player] ? ['keep', 'replace'] : ['keep', 'draw'];
}
/** Called only after the selected physical operation (and any preauthorized
 * own-faction replacements) committed. No private card-dependent progress. */
export function finishNexusCardChoice(
  phase: NexusCardPhase,
  players: readonly NexusPlayer[],
  cards: NexusState,
  player: string,
  choice: NexusCardChoice,
): NexusCardPhase {
  validateNexusCardPhase(phase, players, cards);
  requireNexus(
    ['draw', 'replace', 'keep'].includes(choice),
    'Choose a valid Nexus card operation.',
  );
  requireNexus(
    phase.stage === 'drawing' &&
      phase.eligible.includes(player) &&
      !phase.done.includes(player),
    'Your Nexus choice is already complete or unavailable.',
  );
  requireNexus(
    choice === 'keep' || cards.hands[player] !== null,
    'A completed Nexus draw must have its physical card.',
  );
  const done = [...phase.done, player];
  const next = signed({
    ...structuredClone(phase),
    done,
    stage: done.length === phase.eligible.length ? 'complete' : 'drawing',
  });
  validateNexusCardPhase(next, players, cards);
  return next;
}
