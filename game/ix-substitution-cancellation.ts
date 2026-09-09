import type { Game, ResponseWindow } from './engine';
import {
  validateBattleCleanupContext,
  type BattleCleanupContextQuote,
} from './karama-battle-preflight';

export class IxSubstitutionCancellationError extends Error {}
type Context = Pick<
  Game,
  | 'status'
  | 'phase'
  | 'turn'
  | 'battle'
  | 'lastBattle'
  | 'lastBattleContext'
  | 'pendingIxSubstitution'
> & {
  players: readonly Pick<Game['players'][number], 'id' | 'faction' | 'hand'>[];
  territories: readonly { id: string; sectors: readonly number[] }[];
  combatLocations?: readonly { id: string; kind: 'territory' | 'homeworld' }[];
  physicalCards: readonly { id: string }[];
};
function requireIx(value: unknown, message: string): asserts value {
  if (!value) throw new IxSubstitutionCancellationError(message);
}
const record = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const id = (v: unknown): v is string => typeof v === 'string' && v.length > 0;

/** A denied exchange does not kill suboids or recover cyborgs. Only its saved
 * declaration and the winner's actual next cleanup are prerequisites. */
export function quoteIxSubstitutionCancellation(
  g: Context,
  response: ResponseWindow,
) {
  if (response.kind !== 'ixSubstitution') return null;
  const p = g.pendingIxSubstitution;
  requireIx(
    g.status === 'playing' && record(p) && p.player === response.owner,
    'This canceled Ixian substitution has no current declaration.',
  );
  const owner = g.players.find((player) => player.id === p.player);
  requireIx(
    owner?.faction === 'ixians',
    'The canceled substitution needs its Ixian winner.',
  );
  const homeworld = g.combatLocations?.find(
    (location) => location.id === p.territory && location.kind === 'homeworld',
  );
  const territory = g.territories.find(
    (location) => location.id === p.territory,
  );
  requireIx(
    homeworld
      ? p.territory.startsWith('homeworld:') && !territory
      : !!territory && !p.territory.startsWith('homeworld:'),
    'The canceled substitution needs a current canonical combat location.',
  );
  let context: BattleCleanupContextQuote;
  try {
    context = validateBattleCleanupContext({
      phase: g.phase,
      turn: g.turn,
      battlePresent: !!g.battle,
      lastBattle: g.lastBattle,
      playerIds: g.players.map((p) => p.id),
      territoryIds: [
        ...g.territories.map((t) => t.id),
        ...(homeworld ? [homeworld.id] : []),
      ],
      territory: p.territory,
      winner: p.player,
      context: g.lastBattleContext,
    });
  } catch (error) {
    throw new IxSubstitutionCancellationError(
      error instanceof Error
        ? error.message
        : 'Invalid substitution battle receipt.',
    );
  }
  const counts = (value: unknown): value is Record<string, number> =>
    record(value) &&
    (!homeworld || Object.keys(value).length === 1) &&
    Object.entries(value).every(
      ([key, count]) =>
        (homeworld
          ? key === homeworld.id
          : territory!.sectors.some(
              (sector) => key === `${territory!.id}:${sector}`,
            )) &&
        Number.isSafeInteger(count) &&
        Number(count) > 0,
    );
  requireIx(
    counts(p.losses) && counts(p.sources) && counts(p.recover),
    'The canceled substitution needs its original casualty and exchange locations.',
  );
  const total = (value: Record<string, number>) =>
    Object.values(value).reduce((a, b) => a + b, 0);
  const sources = total(p.sources),
    recover = total(p.recover);
  requireIx(
    Number.isSafeInteger(sources) &&
      sources > 0 &&
      sources === recover &&
      Object.entries(p.recover).every(
        ([key, count]) => count <= (p.losses[key] ?? 0),
      ),
    'The canceled substitution must retain its declared matching exchange.',
  );
  requireIx(
    Array.isArray(p.cards) &&
      p.cards.every(id) &&
      new Set(p.cards).size === p.cards.length &&
      p.cards.every(
        (card) =>
          owner.hand.filter((c) => c.id === card).length === 1 &&
          g.physicalCards.filter((c) => c.id === card).length === 1,
      ),
    'The winning battle cards must remain available for cleanup.',
  );
  return {
    player: owner.id,
    territory: p.territory,
    context,
    decision: p.cards.length
      ? {
          kind: 'battleCards' as const,
          player: owner.id,
          territory: p.territory,
          cards: [...p.cards],
        }
      : null,
  };
}
