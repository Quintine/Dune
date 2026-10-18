import assert from 'node:assert/strict';
import { applyAction, createGame, joinGame, newPlayer, viewGame, type Action, type Game } from '../game/engine';
import { nextRicheseStrongholdsNativeStep } from './fixture-richese-strongholds';
import { withClassicDiscoveryNexusLottery } from './fixture-discovery-classic-nexus';

export const ALLOCATION_STONE = 'richese-stone-burner';
export const ALLOCATION_MIRROR = 'richese-mirror-weapon';
export type StoneBurnerAllocationStep = { actor: string; action: Action };
export type StoneBurnerAllocationOptions = {
  advanced?: boolean;
  mirror?: boolean;
  comparison?: 'ambiguous' | 'invariant' | 'normal';
  /** A genuine Advanced Emperor/Ix battle requires both sealed counts. */
  mixedOpponent?: boolean;
  /** Reverse the two human combatants' original join/seat order. */
  reverseSeats?: boolean;
  /** Original Advanced shipment choice; keeps the default programme unchanged. */
  ownElite?: 1 | 2;
};
export const stoneBurnerAllocationPlayer = (game: Game, actor: string) => {
  const player = game.players.find(player => player.id === actor); assert.ok(player); return player;
};
export const stoneBurnerAllocationClean = (game: Game) => !game.response && !game.phaseOpening &&
  !game.decision && !game.truthtrance && !game.pendingTreacheryDiscard;
export function actStoneBurnerAllocation(game: Game, actor: string, action: Action,
  actions: StoneBurnerAllocationStep[] = []): Game {
  actions.push({ actor, action: structuredClone(action) });
  return withClassicDiscoveryNexusLottery(() => applyAction(game, actor, action));
}

/** Original cache offers are explicit choices. One cache Stone is paid for by
 * the opponent; the optional next-turn Mirror is retained by its native owner
 * through the printed unbid-cache choice. Neither card is moved by staging. */
function nextStoneBurnerAllocationStep(game: Game): StoneBurnerAllocationStep | null {
  if (!game.response && !game.phaseOpening && game.decision) {
    const decision = game.decision;
    if (decision.kind === 'stoneAllocation' || decision.kind === 'battleLosses') return null;
    if (decision.kind === 'richeseCache') {
      const id = game.turn === 1 ? ALLOCATION_STONE : ALLOCATION_MIRROR;
      const card = game.richeseCache!.find(card => card.id === id) ?? game.richeseCache![0]; assert.ok(card);
      return { actor: decision.player, action: { type: 'decision', event: game.richeseBidding!.event,
        card: card.id, method: 'onceAround', direction: 'clockwise' } };
    }
    if (decision.kind === 'richeseUnbid') return { actor: decision.player, action: { type: 'decision',
      event: game.richeseBidding!.event, keep: game.richeseAuction!.cardId === ALLOCATION_MIRROR } };
  }
  const lot = game.richeseAuction;
  const buyer = game.players.find(player => player.faction === 'emperor')?.id ??
    game.players.find(player => player.faction === 'ixians')?.id;
  if (stoneBurnerAllocationClean(game) && lot && !lot.outcome && lot.cardId === ALLOCATION_STONE &&
    lot.active === buyer && lot.bid === 0)
    return { actor: lot.active!, action: { type: 'richeseBid', event: lot.event, amount: 1, allyPayment: 0 } };
  return nextRicheseStrongholdsNativeStep(game);
}
export function advanceStoneBurnerAllocation(game: Game, until: (state: Game) => boolean,
  actions: StoneBurnerAllocationStep[] = []): Game {
  for (let count = 0; count < 2000; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished', 'The genuine Stone programme ended before its next owned control');
    const step = nextStoneBurnerAllocationStep(game);
    assert.ok(step, `Choose the real ${game.decision?.kind ?? 'Battle Plan'} explicitly`);
    game = actStoneBurnerAllocation(game, step.actor, step.action, actions);
  }
  throw Error('The original Stone allocation programme did not reach its finite boundary');
}

/** Genuine host/private setup, paid native cache Stone, typed funded arrivals
 * and original revealed plans. Basic Ix dial2 uses one Cyborg or four Suboids;
 * Advanced Emperor dial3/support1 uses three or five actual counters. */
export function createStoneBurnerAllocationFixture(options: StoneBurnerAllocationOptions = {}) {
  const advanced = options.advanced ?? !!options.mixedOpponent, comparison = options.comparison ?? 'ambiguous';
  assert.ok(!options.mixedOpponent || (advanced && !options.mirror && comparison === 'ambiguous'),
    'The bounded two-count programme uses Advanced Emperor/Ix and the original Stone');
  const owner = advanced ? 'emperor' : 'ixians', opponent = options.mixedOpponent ? 'ixians' : 'richese';
  let game = createGame('STONEBURNERALLOCATION', newPlayer('richese', 'Richese', 'richese'), advanced,
    advanced && !options.mixedOpponent ? ['choam'] : ['ix', 'choam']);
  const seats: ('emperor' | 'ixians' | 'guild')[] = options.mixedOpponent
    ? options.reverseSeats ? ['ixians', 'emperor', 'guild'] : ['emperor', 'ixians', 'guild'] : [owner, 'guild'];
  for (const faction of seats) joinGame(game, newPlayer(faction, faction, faction));
  const actions: StoneBurnerAllocationStep[] = [];
  const act = (actor: string, action: Action) => { game = actStoneBurnerAllocation(game, actor, action, actions); };
  const reach = (until: (state: Game) => boolean) => { game = advanceStoneBurnerAllocation(game, until, actions); };
  for (const player of game.players) act(player.id, { type: 'ready' });
  const lobby = structuredClone(game);
  act(game.host, advanced ? { type: 'start', advancedPreview: true } : { type: 'start' });
  const setup = structuredClone(game);
  reach(state => state.status === 'playing');
  const afterSetup = structuredClone(game);
  const front: Game['spiceDeck'] = [];
  for (let count = 0; count < (options.mirror ? 2 : 1) * (advanced ? 2 : 1); count++) {
    const at = game.spiceDeck.findIndex(card => 'territory' in card && !card.discovery); assert.ok(at >= 0);
    front.push(game.spiceDeck.splice(at, 1)[0]);
  }
  game.spiceDeck.unshift(...front);
  reach(state => stoneBurnerAllocationPlayer(state, owner).hand.some(card => card.id === ALLOCATION_STONE));
  const acquiredStone = structuredClone(game);
  assert.ok(actions.some(step => step.actor === owner && step.action.type === 'richeseBid' && step.action.amount === 1),
    'The canonical Stone must be acquired through its original paid native cache lot');
  if (options.mirror) reach(state => state.turn === 2 &&
    stoneBurnerAllocationPlayer(state, opponent).hand.some(card => card.id === ALLOCATION_MIRROR));
  const acquiredMirror = options.mirror ? structuredClone(game) : null;
  const turn = options.mirror ? 2 : 1, shipments: { before: Game; step: StoneBurnerAllocationStep; after: Game }[] = [];
  const shipped = new Set<string>();
  for (let count = 0; shipped.size < 2 && count < 500; count++) {
    if (game.turn === turn && game.phase === 5 && stoneBurnerAllocationClean(game) && game.active &&
      [owner, opponent].includes(game.active) && !shipped.has(game.active)) {
      const actor = game.active, before = structuredClone(game), step: StoneBurnerAllocationStep = { actor, action: {
        type: 'ship', territory: 'arrakeen', sector: 10,
        amount: actor === owner || options.mixedOpponent ? 6 : advanced ? 3 : 4,
        elite: actor === owner ? advanced ? options.ownElite ?? 1 : 2 : options.mixedOpponent ? 2 : 0, allyPayment: 0,
      } };
      act(actor, step.action); reach(stoneBurnerAllocationClean);
      shipments.push({ before, step, after: structuredClone(game) }); shipped.add(actor);
    } else {
      const step = nextStoneBurnerAllocationStep(game); assert.ok(step);
      act(step.actor, step.action);
    }
  }
  assert.equal(shipped.size, 2);
  reach(state => state.phase === 6 && !!state.active && stoneBurnerAllocationClean(state));
  const beforeBattle = structuredClone(game), choice = viewGame(game, game.active!).battleChoices
    .find(choice => choice.territory === 'arrakeen'); assert.ok(choice);
  const chooseBattle: StoneBurnerAllocationStep = { actor: choice.chooser, action: {
    type: 'chooseBattle', territory: 'arrakeen', target: choice.chooser === owner ? opponent : owner,
  } };
  act(chooseBattle.actor, chooseBattle.action);
  reach(state => !!state.battle && !state.battle.preparation && state.battle.preLeader?.closed !== false && stoneBurnerAllocationClean(state));
  const beforePlans = structuredClone(game), leaders = (actor: string) => stoneBurnerAllocationPlayer(game, actor).leaders
    .filter(leader => !leader.dead && !leader.usedAt);
  const ownLeader = leaders(owner).sort((a, b) => b.strength - a.strength)[0],
    enemyLeader = leaders(opponent).sort((a, b) => a.strength - b.strength)[0]; assert.ok(ownLeader && enemyLeader);
  const opponentDial = options.mixedOpponent ? 3.5 : comparison === 'invariant' ? advanced ? 3 : 4 : 1;
  const plans: StoneBurnerAllocationStep[] = [
    { actor: owner, action: { type: 'battlePlan', leader: ownLeader.id, dial: advanced ? 3 : 2, support: advanced ? 1 : 0,
      weapon: comparison === 'normal' ? null : ALLOCATION_STONE } },
    { actor: opponent, action: { type: 'battlePlan', leader: enemyLeader.id, dial: opponentDial,
      support: options.mixedOpponent ? 1 : advanced ? opponentDial : 0, weapon: options.mirror ? ALLOCATION_MIRROR : null } },
  ];
  for (const step of plans) act(step.actor, step.action);
  const revealed = structuredClone(game);
  reach(state => !state.response && !state.phaseOpening &&
    (state.decision?.kind === 'stoneAllocation' || state.decision?.kind === 'battleLosses' ||
      (!state.battle && stoneBurnerAllocationClean(state))));
  return { game, lobby, setup, afterSetup, acquiredStone, acquiredMirror, shipments, beforeBattle,
    chooseBattle, beforePlans, plans, revealed, owner, opponent, advanced, comparison, mirror: options.mirror ?? false,
    mixedOpponent: options.mixedOpponent ?? false, reverseSeats: options.reverseSeats ?? false,
    ownElite: options.ownElite ?? 1,
    location: 'arrakeen:10', actions,
    staging: ['Only unopened scalar/deck lotteries are selected. The Stone is bought from its real native cache; optional Mirror is genuinely retained from the next original unbid cache lot. All forces and support are funded original actions.'] };
}
export type StoneBurnerAllocationFixture = ReturnType<typeof createStoneBurnerAllocationFixture>;

/** Every total comes from the authenticated current owner's actual view.
 * Later ordinary casualty and Ixian substitution choices retain their native
 * controls; choosing a total never installs a typed loss mix. */
export function completeStoneBurnerAllocation(fixture: StoneBurnerAllocationFixture,
  undialed?: number | Readonly<Record<string, number>>, lossChoice = 0) {
  let game = structuredClone(fixture.game);
  const actions: StoneBurnerAllocationStep[] = [], committed: { before: Game; step: StoneBurnerAllocationStep; after: Game }[] = [];
  for (let count = 0; count < 700; count++) {
    if (!game.battle && stoneBurnerAllocationClean(game)) return { game, actions, committed };
    const decision = game.decision;
    let step: StoneBurnerAllocationStep | null;
    if (!game.response && !game.phaseOpening && decision?.kind === 'stoneAllocation') {
      const offer = viewGame(game, decision.player).battle!.stoneAllocation; assert.ok(offer);
      const total = typeof undialed === 'object' ? undialed[offer.owner]
        : offer.owner === fixture.owner ? undialed : offer.totals[0];
      assert.ok(total !== undefined && offer.totals.includes(total));
      step = { actor: decision.player, action: { type: 'decision', event: offer.event, undialed: total } };
      const before = structuredClone(game);
      game = actStoneBurnerAllocation(game, step.actor, step.action, actions);
      committed.push({ before, step, after: structuredClone(game) });
      continue;
    } else if (!game.response && !game.phaseOpening && decision?.kind === 'battleLosses') {
      const view = viewGame(game, decision.player), current = view.decision;
      assert.ok(current?.kind === 'battleLosses');
      const choice = Math.min(lossChoice, current.options.length - 1);
      step = { actor: decision.player, action: { type: 'decision', choice } };
    } else step = nextStoneBurnerAllocationStep(game);
    assert.ok(step, 'The original Stone consequence needs its next owned native action');
    game = actStoneBurnerAllocation(game, step.actor, step.action, actions);
  }
  throw Error('Original Stone allocation and typed consequences did not complete');
}
