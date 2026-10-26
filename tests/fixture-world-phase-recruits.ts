import assert from 'node:assert/strict';
import {
  applyAction, createGame, joinGame, newPlayer, viewGame, type Action, type Game, type GameView,
} from '../game/engine';
import { createTechTokens, ownedTech } from '../game/tech-tokens';
import { createStrongholdCards } from '../game/stronghold-cards';
import { RECRUITS_CARD_ID } from '../game/recruits';
import {
  assertRecruitsHomeworldInventory, createRecruitsHomeworldFixture,
  recruitsHomeworldClean, recruitsHomeworldPlayer, type RecruitsHomeworldFixture, type RecruitsHomeworldStep,
} from './fixture-recruits-homeworld';
import { nextHarassHomeworldStep } from './fixture-harass-homeworld';
import type { IndependentCardModulesOptions } from './fixture-independent-card-modules';

export type WorldPhaseRecruitsOptions = {
  advanced?: boolean;
  strongholds?: boolean;
  seatIds?: readonly [string, string, string, string];
  skills?: boolean;
  training?: IndependentCardModulesOptions['training'];
};

export type WorldPhaseRecruitsFixture = {
  initial: Game; afterSetup: Game; game: Game;
  afterPaidReturn: Game; beforePlay: Game; afterPlay: Game; beforeFremen: Game;
  afterTypedReturn: Game; afterReturns: Game; beforePhaseEnd: Game; afterPhaseEnd: Game;
  phaseEndStep: RecruitsHomeworldStep;
  actors: { emperor: string; fremen: string; atreides: string; guild: string; owner: string };
  actions: Record<'paidReturn' | 'readyAtreides' | 'play' | 'reopenedReturn' |
    'typedReturn' | 'followupReturn', Action>;
  ordinary: { fremen: GameView['revival']; atreides: GameView['revival'] };
  expected: {
    paidReturnPrice: number; reopenedReturnPrice: number; fremenReturnPrice: number;
    income: number; wallets: Record<string, number>;
    doubled: { fremenFree: number; atreidesFree: number; limit: number };
    afterThreshold: { freeRemaining: number; forcesRemaining: number; homeworldBonus: number };
  };
  nativeSteps: RecruitsHomeworldStep[]; steps: RecruitsHomeworldStep[]; staging: string[];
};

export const worldPhaseRecruitsPlayer = recruitsHomeworldPlayer;
export function worldPhaseRecruitsNativePool(game: Game, actor: string) {
  const world = viewGame(game, actor).homeworlds?.worlds?.find(w => w.native === actor && !w.secondary);
  assert.ok(world, 'The original native World must retain its real custody');
  return world.forces[actor];
}

/** Original E/F/A/G setup, paid typed shipments and two actual battles are
 * supplied by the canonical World fixture. Only an undealt lobby is composed
 * here: no live phase, force, wallet, owner or revival receipt is retrofitted.
 * Its existing initializer scopes its own entropy; the first subsequent draw
 * is the original first-Storm shuffle of the two unassigned Tech Tokens.
 * All later entropy (including Advanced's native Storm deck) delegates intact. */
export function createWorldPhaseRecruitsFixture(options: WorldPhaseRecruitsOptions = {}): WorldPhaseRecruitsFixture {
  const advanced = options.advanced ?? false;
  const strongholds = options.strongholds ?? false;
  assert.ok(!strongholds || advanced, 'Original Stronghold Cards require Advanced');
  const ids = options.seatIds ?? ['emperor', 'fremen', 'atreides', 'guild'];
  const [emperor, fremen, atreides, guild] = ids;
  let lobby = createGame('WORLDPHASERECRUITS', newPlayer(emperor, 'Emperor', 'emperor'), advanced);
  for (const [id, faction] of [[fremen, 'fremen'], [atreides, 'atreides'], [guild, 'guild']] as const)
    joinGame(lobby, newPlayer(id, faction, faction));
  const lobbySteps: RecruitsHomeworldStep[] = [];
  if (advanced) {
    // First Storm0 ends at1; the native later card1..6 ends at2..7.
    // Actual printed circles14/17 therefore keep Atreides before Fremen,
    // without completing the latter before its later typed requests.
    for (const [actor, position] of [[atreides, 5], [fremen, 6]] as const) {
      const action: Action = { type: 'seatPosition', position };
      lobby = applyAction(lobby, actor, action); lobbySteps.push({ actor, action });
    }
  }
  lobby = applyAction(lobby, emperor, { type: 'homeworlds', enabled: true });
  lobby.techTokens = createTechTokens();
  if (strongholds) lobby.strongholdCards = createStrongholdCards();
  const descriptor = Object.getOwnPropertyDescriptor(crypto, 'getRandomValues');
  // Binding loses Crypto's generic guarantee that it returns the same view.
  const originalRandom = crypto.getRandomValues.bind(crypto) as <T extends ArrayBufferView | null>(array: T) => T;
  let firstStormDraw = true;
  crypto.getRandomValues = <T extends ArrayBufferView | null>(array: T): T => {
    if (!firstStormDraw) return originalRandom(array);
    assert.ok(array);
    firstStormDraw = false;
    new Uint8Array(array.buffer, array.byteOffset, array.byteLength).fill(255);
    return array;
  };
  let source: RecruitsHomeworldFixture;
  try { source = createRecruitsHomeworldFixture({ advanced, initial: lobby, seatIds: ids,
    skills: options.skills, training: options.training }); }
  finally {
    if (descriptor) Object.defineProperty(crypto, 'getRandomValues', descriptor);
    else Reflect.deleteProperty(crypto, 'getRandomValues');
  }
  assert.equal(firstStormDraw, false, 'The original first Storm must assign unused Tech Tokens');
  let game = structuredClone(source.game);
  const steps: RecruitsHomeworldStep[] = [];
  const act = (actor: string, action: Action) => {
    steps.push({ actor, action: structuredClone(action) });
    game = applyAction(game, actor, action);
  };
  const settle = () => {
    for (let count = 0; count < 100; count++) {
      if (recruitsHomeworldClean(game)) return;
      const next = nextHarassHomeworldStep(game); assert.ok(next);
      act(next.actor, next.action);
    }
    throw Error('Original World revival decisions did not settle');
  };
  const awaitOwner = (actor: string) => {
    while (game.revivalOrder && game.revivalOrder.remaining[0] !== actor) {
      assert.ok(game.revivalOrder.remaining.includes(actor), 'The later native request must retain its pending opportunity.');
      const preceding = game.revivalOrder.remaining[0]; assert.ok(preceding);
      act(preceding, { type: 'ready' }); settle();
    }
  };
  const actions = {
    paidReturn: { type: 'revive', amount: 3, elite: 0 },
    readyAtreides: { type: 'ready' },
    play: { type: 'card', card: RECRUITS_CARD_ID },
    reopenedReturn: { type: 'revive', amount: 2, elite: 0 },
    typedReturn: { type: 'revive', amount: 1, elite: 1 },
    followupReturn: { type: 'revive', amount: 5, elite: 0 },
  } satisfies Record<string, Action>;
  const owner = game.techTokens?.axlotl.owner; assert.ok(owner);
  const income = ownedTech(game.techTokens, owner).length;
  assert.ok(income > 0);
  const ordinary = {
    fremen: structuredClone(viewGame(game, fremen).revival),
    atreides: structuredClone(viewGame(game, atreides).revival),
  };
  const wallets = Object.fromEntries(game.players.map(p => [p.id, p.spice]));
  awaitOwner(atreides);
  act(atreides, actions.paidReturn); settle();
  const afterPaidReturn = structuredClone(game);
  if (!advanced) act(atreides, actions.readyAtreides);
  const beforePlay = structuredClone(game);
  act(emperor, actions.play);
  const afterPlay = structuredClone(game);
  act(atreides, actions.reopenedReturn); settle();
  if (advanced) act(atreides, actions.readyAtreides);
  awaitOwner(fremen);
  const beforeFremen = structuredClone(game);
  act(fremen, actions.typedReturn); settle();
  const afterTypedReturn = structuredClone(game);
  act(fremen, actions.followupReturn); settle();
  const afterReturns = structuredClone(game);
  let beforePhaseEnd: Game | undefined;
  let phaseEndStep: RecruitsHomeworldStep | undefined;
  for (let count = 0; count < 100 && game.phase === 4; count++) {
    const next = nextHarassHomeworldStep(game); assert.ok(next);
    const before = structuredClone(game);
    act(next.actor, next.action);
    if (game.phase !== 4) { beforePhaseEnd = before; phaseEndStep = structuredClone(next); }
  }
  assert.ok(beforePhaseEnd && phaseEndStep, 'The original last ready must settle Revival');
  assert.equal(game.phase, 5);
  const afterPhaseEnd = structuredClone(game);
  for (const boundary of [source.afterSetup, source.game, afterPaidReturn, beforePlay, afterPlay,
    beforeFremen, afterTypedReturn, afterReturns, beforePhaseEnd, afterPhaseEnd])
    assertRecruitsHomeworldInventory(boundary);
  return {
    initial: source.initial, afterSetup: source.afterSetup, game: source.game,
    afterPaidReturn, beforePlay, afterPlay, beforeFremen, afterTypedReturn, afterReturns,
    beforePhaseEnd, phaseEndStep, afterPhaseEnd,
    actors: { emperor, fremen, atreides, guild, owner }, actions, ordinary,
    expected: {
      paidReturnPrice: 2, reopenedReturnPrice: 0, fremenReturnPrice: 0,
      income, wallets,
      doubled: { fremenFree: 7, atreidesFree: 4, limit: 7 },
      afterThreshold: { freeRemaining: 5, forcesRemaining: 5, homeworldBonus: 0 },
    },
    nativeSteps: [...lobbySteps, ...source.nativeSteps], steps,
    staging: [...source.staging,
      'Select unused original Tech Tokens and optional Advanced Strongholds in the undealt lobby, before readiness and original setup.',
      'Fix only the original first-Storm unused-token shuffle; restore native later Storm entropy. Custody and held-token count are read, never assigned.',
      ...(advanced ? ['Select original lobby circles14 for Atreides and17 for Fremen. Finish preceding native turns; keep Atreides current through both requests before advancing to still-pending Fremen. No played queue or phase is changed.'] : []),
      'Atreides pays for three original native returns before Recruits; its recorded paid counter remains paid after activation. Basic retains ready/reopening; Advanced keeps that opportunity open. Fremen then returns one typed Fedaykin and five normal counters on separate current-rate requests.',
    ],
  };
}
