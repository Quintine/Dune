import type { Game, ResponseWindow } from './engine';
import {
  gameTerritories,
  location,
  splitLocation,
  validLocation,
} from './board';

export class ChoamWorthlessCancellationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ChoamWorthlessCancellationError';
  }
}
export type ChoamWorthlessCancellationContext = Pick<
  Game,
  | 'status'
  | 'turn'
  | 'phase'
  | 'active'
  | 'mobileStronghold'
  | 'pendingChoamWorthless'
  | 'choamWorthlessBlocked'
  | 'pendingRevival'
  | 'pendingChoamMove'
  | 'stormResolution'
  | 'choamMentatPending'
> & { players: readonly Pick<Game['players'][number], 'id' | 'faction'>[] };
export type ChoamWorthlessCancellationQuote = {
  owner: string;
  card: string;
  effect: NonNullable<Game['pendingChoamWorthless']>['effect'];
  blocked: NonNullable<Game['choamWorthlessBlocked']>;
  pendingChoamWorthless: null;
  resume:
    | { kind: 'none' | 'storm' | 'revival' | 'movement' }
    | { kind: 'mentat'; decision: { kind: 'choamMentat'; player: string } };
};
const effects = {
  kulon: { phase: 5, name: 'Kulon' },
  laLaLa: { phase: 4, name: 'La La La' },
  gamont: { phase: 8, name: 'Trip to Gamont' },
  baliset: { phase: 5, name: 'Baliset' },
  jubba: { phase: 0, name: 'Jubba Cloak' },
} as const;
const id = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0;
const whole = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) >= 0;
function requireDeclaration(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) throw new ChoamWorthlessCancellationError(message);
}

/** Validate the denied declaration and identify exactly one original resume.
 * The caller separately proves storm/revival suffixes and the existing Baliset
 * movement-or-fizzle path. This does not spend the declared card, re-evaluate
 * its usefulness, choose a response, traverse storm, revive, or move forces. */
export function quoteChoamWorthlessCancellation(
  g: ChoamWorthlessCancellationContext,
  response: ResponseWindow,
): ChoamWorthlessCancellationQuote | null {
  if (response.kind !== 'choamWorthless') return null;
  requireDeclaration(
    g.status === 'playing' &&
      whole(g.turn) &&
      g.turn > 0 &&
      Array.isArray(g.players) &&
      g.players.every((p) => id(p.id)) &&
      new Set(g.players.map((p) => p.id)).size === g.players.length,
    'The denied Worthless effect needs its current active game.',
  );
  const p = g.pendingChoamWorthless;
  const choam = g.players.filter((seat) => seat.faction === 'choam');
  requireDeclaration(
    p &&
      choam.length === 1 &&
      p.owner === choam[0].id &&
      p.owner === response.owner &&
      id(p.card) &&
      Object.hasOwn(effects, p.effect),
    'The denied Worthless effect needs its original CHOAM declaration.',
  );
  requireDeclaration(
    g.phase === effects[p.effect].phase &&
      response.intent === effects[p.effect].name,
    'The Worthless effect does not match its phase and declared printed name.',
  );
  const flags = [p.storm, p.revival, p.movement, p.mentat];
  requireDeclaration(
    flags.every((flag) => flag === undefined || typeof flag === 'boolean') &&
      flags.filter((flag) => flag === true).length <= 1,
    'The Worthless declaration has contradictory or invalid original contexts.',
  );
  requireDeclaration(
    (!p.storm || p.effect === 'jubba') &&
      (!p.revival || p.effect === 'laLaLa') &&
      (!p.movement || p.effect === 'baliset') &&
      (!p.mentat || p.effect === 'gamont') &&
      (p.effect !== 'jubba' || p.storm === true),
    'This Worthless effect cannot resume the recorded original context.',
  );
  const target = g.players.find((seat) => seat.id === p.target);
  requireDeclaration(
    response.recipient === p.target && response.elite === p.elite,
    'The denied effect no longer matches its declared target and force type.',
  );
  const territory = (to: unknown) =>
    id(to) && gameTerritories(g).some((t) => t.id === to);
  const key = (value: unknown) => {
    if (!id(value)) return null;
    const loc = splitLocation(value);
    return location(loc.territory, loc.sector) === value &&
      territory(loc.territory) &&
      validLocation(loc.territory, loc.sector)
      ? loc
      : null;
  };
  if (p.effect === 'kulon') {
    requireDeclaration(
      g.active === p.owner &&
        p.target === undefined &&
        p.location === undefined &&
        response.location === undefined &&
        p.elite === undefined,
      'Denied Kulon needs CHOAM’s own movement turn and no target.',
    );
  } else if (p.effect === 'laLaLa') {
    requireDeclaration(
      target &&
        p.location === undefined &&
        response.location === undefined &&
        p.elite === undefined,
      'Denied La La La needs its originally selected revival target.',
    );
  } else if (p.effect === 'gamont') {
    requireDeclaration(
      target &&
        target.id !== p.owner &&
        key(p.location) &&
        response.location === p.location &&
        (p.elite === 0 || p.elite === 1) &&
        (p.noFieldEvent === undefined ||
          (id(p.noFieldEvent) &&
            target.faction === 'richese' &&
            p.elite === 0)),
      'Denied Gamont needs its original opposing sector and selected force type.',
    );
  } else {
    const loc = key(response.location);
    requireDeclaration(
      target &&
        territory(p.location) &&
        loc &&
        loc.territory === p.location &&
        p.elite === undefined &&
        (p.effect === 'jubba' ? target.id === p.owner : target.id !== p.owner),
      'The denied territory effect needs its original destination and target.',
    );
    if (p.movement)
      requireDeclaration(
        g.pendingChoamMove &&
          g.pendingChoamMove.player === p.target &&
          g.pendingChoamMove.to === p.location &&
          g.pendingChoamMove.sector === loc.sector &&
          g.pendingChoamMove.origin !== g.pendingChoamMove.to,
        'Reactive Baliset no longer matches its original declared movement.',
      );
  }
  requireDeclaration(
    p.effect === 'gamont' || p.noFieldEvent === undefined,
    'Only Gamont has a declared No-Field identity.',
  );
  if (p.revival)
    requireDeclaration(
      g.pendingRevival &&
        g.pendingRevival.player === p.target &&
        p.target !== p.owner &&
        g.pendingRevival.kind === 'forces' &&
        whole(g.pendingRevival.free) &&
        g.pendingRevival.free > 0 &&
        !g.pendingRevival.emperorExtra,
      'Reactive La La La needs the original opposing free force revival.',
    );
  if (p.storm)
    requireDeclaration(
      g.stormResolution && g.stormResolution.traversed === 0,
      'Reactive Jubba needs its untraversed moving storm.',
    );
  if (p.mentat)
    requireDeclaration(
      g.choamMentatPending === true,
      'The original CHOAM Mentat opportunity is no longer pending.',
    );
  const previous = g.choamWorthlessBlocked;
  const cards =
    previous?.turn === g.turn && previous.phase === g.phase
      ? previous.cards
      : [];
  requireDeclaration(
    Array.isArray(cards) &&
      cards.every(id) &&
      new Set(cards).size === cards.length &&
      !cards.includes(p.card),
    'The current Worthless cancellation record is malformed or already contains this card.',
  );
  return {
    owner: p.owner,
    card: p.card,
    effect: p.effect,
    pendingChoamWorthless: null,
    blocked: { turn: g.turn, phase: g.phase, cards: [...cards, p.card] },
    resume: p.storm
      ? { kind: 'storm' }
      : p.revival
        ? { kind: 'revival' }
        : p.movement
          ? { kind: 'movement' }
          : p.mentat
            ? {
                kind: 'mentat',
                decision: { kind: 'choamMentat', player: p.owner },
              }
            : { kind: 'none' },
  };
}
