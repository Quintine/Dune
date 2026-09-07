import type { Game, Decision } from './engine';
import { SPICE_CARDS, type SpiceCard } from './cards';
import { gameTerritories } from './board';
import { presenceAt } from './force-presence';
import { ecazOccupancyRelation } from './ecaz-occupy';
import {
  quoteBattleBoard,
  type BoardContext,
  type AdvisorRelease,
  type BoardSeat,
} from './board-resolution-quote';

export class MovementPhaseQuoteError extends Error {}
function requireMovement(value: unknown, message: string): asserts value {
  if (!value) throw new MovementPhaseQuoteError(message);
}
type Context = Pick<
  Game,
  | 'status'
  | 'phase'
  | 'turn'
  | 'advanced'
  | 'storm'
  | 'order'
  | 'players'
  | 'mobileStronghold'
  | 'spiceDeck'
  | 'spiceDiscard'
>;
type AdvisorContext = BoardContext & { turn: number };
const whole = (n: unknown): n is number =>
  Number.isSafeInteger(n) && Number(n) >= 0;
function boardSeats(g: BoardContext, released: AdvisorRelease[]): BoardSeat[] {
  return g.players.map((p) => {
    const advisors = p.advisors ? { ...p.advisors } : undefined;
    for (const r of released)
      if (r.player === p.id && advisors) delete advisors[r.territory];
    return {
      id: p.id,
      faction: p.faction,
      ally: p.ally,
      advisors,
      forces: p.forces,
      noField: p.noField,
    };
  });
}
/** Consider existing advisors as fighters on a readonly public board. No
 * shipment, movement, arrival effect, or whole-game simulation is performed. */
export function quoteAdvisorBattleOffer(g: AdvisorContext) {
  try {
    const board = quoteBattleBoard(g);
    const players = boardSeats(g, board.released),
      bg = players.find((p) => p.faction === 'beneGesserit');
    if (!g.advanced || !bg)
      return {
        released: board.released,
        owner: null,
        territories: [] as string[],
      };
    const ally = bg.ally ? players.find((p) => p.id === bg.ally) : null;
    requireMovement(
      !bg.ally || ally,
      'The advisor opportunity needs its seated ally.',
    );
    const territories = Object.keys(bg.advisors ?? {}).filter((t) => {
      const stance = bg.advisors![t];
      requireMovement(
        !!stance &&
          typeof stance === 'object' &&
          gameTerritories(g).some((x) => x.id === t) &&
          (stance.lockedTurn === undefined || whole(stance.lockedTurn)),
        'The advisor opportunity needs valid territory stances.',
      );
      if (
        stance.lockedTurn === g.turn ||
        (ally &&
          presenceAt(ally, t) &&
          ecazOccupancyRelation(players, bg.id, ally.id, {
            kind: 'territory',
            id: t,
          }) !== 'ecazAlliance')
      )
        return false;
      const advisors = { ...bg.advisors };
      delete advisors[t];
      const candidate = quoteBattleBoard({
        ...g,
        players: players.map((p) => (p.id === bg.id ? { ...p, advisors } : p)),
      });
      return candidate.battles.some(
        (b) =>
          b.territory === t && (b.attacker === bg.id || b.defender === bg.id),
      );
    });
    return { released: board.released, owner: bg.id, territories };
  } catch (error) {
    if (error instanceof MovementPhaseQuoteError) throw error;
    throw new MovementPhaseQuoteError(
      error instanceof Error ? error.message : 'Malformed advisor opportunity.',
    );
  }
}
function validSpice(c: unknown): c is SpiceCard {
  if (!c || typeof c !== 'object' || Array.isArray(c)) return false;
  const card = c as Record<string, unknown>;
  if ('worm' in card)
    return (
      card.worm === true &&
      (card.thumper === undefined || typeof card.thumper === 'boolean')
    );
  if ('sandtrout' in card) return card.sandtrout === true;
  return SPICE_CARDS.some(
    ([territory, amount, sector]) =>
      card.territory === territory &&
      card.amount === amount &&
      card.sector === sector,
  );
}
type StartDecision = Extract<
  Decision,
  { kind: 'advisorBattle' | 'guildTiming' }
>;
export type MovementPhaseQuote =
  | { kind: 'opening'; phaseOpening: { passed: string[]; initialize: true } }
  | {
      kind: 'initialize';
      remaining: string[];
      released: AdvisorRelease[];
      spice: { owner: string | null; refill: boolean; hasCards: boolean };
      decision: StartDecision | null;
      active: string | null;
    };
/** Reset one genuine complete movement order. Atreides refill is a request to
 * real execution, never a shuffled preview. Ix opening is an explicit boundary. */
export function quoteMovementPhaseStart(
  g: Context,
  opening = false,
): MovementPhaseQuote {
  try {
    requireMovement(
      g.status === 'playing' &&
        g.phase === 5 &&
        whole(g.turn) &&
        g.turn > 0 &&
        Array.isArray(g.order) &&
        Array.isArray(g.players) &&
        g.players.length >= 2 &&
        g.players.length <= 6 &&
        new Set(g.players.map((p) => p.id)).size === g.players.length &&
        new Set(g.order).size === g.order.length &&
        g.order.length === g.players.length &&
        g.players.every(
          (p) =>
            typeof p.id === 'string' &&
            p.id.length > 0 &&
            g.order.includes(p.id),
        ),
      'Shipment and Movement needs its complete unique seated turn order.',
    );
    if (opening)
      return {
        kind: 'opening',
        phaseOpening: { passed: [], initialize: true },
      };
    const advisor = quoteAdvisorBattleOffer(g);
    const atreides = g.players.find((p) => p.faction === 'atreides'),
      guild = g.players.find((p) => p.faction === 'guild');
    let refill = false,
      hasCards = false;
    if (atreides) {
      requireMovement(
        Array.isArray(g.spiceDeck) && g.spiceDeck.every(validSpice),
        'Atreides movement-phase preview needs a readable spice deck.',
      );
      refill = g.spiceDeck.length === 0;
      if (refill) {
        requireMovement(
          Array.isArray(g.spiceDiscard) &&
            g.spiceDiscard.length === 2 &&
            g.spiceDiscard.every(
              (pile) => Array.isArray(pile) && pile.every(validSpice),
            ),
          'Atreides spice refill needs two readable discard piles.',
        );
        hasCards = g.spiceDiscard
          .flat()
          .some((c) => !('worm' in c && c.thumper));
      } else hasCards = true;
    }
    let decision: StartDecision | null = null,
      active: string | null = null;
    if (advisor.owner && advisor.territories.length)
      decision = {
        kind: 'advisorBattle',
        player: advisor.owner,
        territories: advisor.territories,
      };
    else if (g.advanced && guild)
      decision = {
        kind: 'guildTiming',
        player: guild.id,
        next: g.order[0],
        following: g.order.find((id) => id !== guild.id)!,
      };
    else active = g.order[0];
    return {
      kind: 'initialize',
      remaining: [...g.order],
      released: advisor.released,
      spice: { owner: atreides?.id ?? null, refill, hasCards },
      decision,
      active,
    };
  } catch (error) {
    if (error instanceof MovementPhaseQuoteError) throw error;
    throw new MovementPhaseQuoteError(
      error instanceof Error
        ? error.message
        : 'Malformed movement-phase initialization.',
    );
  }
}
