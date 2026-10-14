import assert from 'node:assert/strict';
import {
  applyAction, createGame, initializeNexusGameForAudit, joinGame, newPlayer, viewGame,
  type Action, type Game,
} from '../game/engine';
import { location, territory } from '../game/board';
import { treacheryDeck } from '../game/cards';
import { validateNexusCards } from '../game/nexus-cards';
import { shipmentAvailable } from '../game/shipment-opportunity';
import { traitorDeck } from '../game/traitors';
import { nextStrongholdFactionsNativeStep } from './fixture-stronghold-factions';
import { nexusTleilaxuSecretAllyPlayer as player } from './fixture-nexus-tleilaxu-secret-ally';

export type NexusFremenFreeQuotaStep = { actor: string; action: Action };
export type NexusFremenFreeQuotaFixtureOptions = { advanced?: boolean; tleilaxu?: boolean };
export type NexusFremenFreeQuotaFixture = {
  game: Game;
  owner: string;
  initial: Game;
  scenario: {
    advanced: boolean;
    tleilaxu: boolean;
    opponent: string;
    partner: string;
    event: string;
    staging: string[];
  };
  actions: NexusFremenFreeQuotaStep[];
  physicalfacts: {
    shipmentCost: number;
    deadLeader: string;
    battleLosses: number;
    beforeDraw: Game;
    draw: NexusFremenFreeQuotaStep;
    afterDraw: Game;
  };
};

export const nexusFremenFreeQuotaQuiet = (game: Game): boolean =>
  !game.phaseOpening && !game.response && !game.decision && !game.pendingRevival;

/** Continue only original public choices; private battle plans and closing draws
 * remain explicit actions of the chronology rather than fabricated state. */
export function nextNexusFremenFreeQuotaNativeStep(game: Game): NexusFremenFreeQuotaStep | null {
  if (game.nexusCards?.phase?.stage === 'drawing' && nexusFremenFreeQuotaQuiet(game)) return null;
  if (game.decision?.kind === 'faceDance')
    return { actor: game.decision.player, action: { type: 'decision', reveal: false } };
  return nextStrongholdFactionsNativeStep(game);
}
export function advanceNexusFremenFreeQuota(
  game: Game, until: (state: Game) => boolean, actions?: NexusFremenFreeQuotaStep[],
): Game {
  for (let count = 0; count < 2000; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished');
    const next = nextNexusFremenFreeQuotaNativeStep(game);
    assert.ok(next, `Native Fremen chronology stopped at ${game.status}/${game.turn}/${game.phase}`);
    actions?.push(structuredClone(next));
    game = applyAction(game, next.actor, next.action);
  }
  throw Error('Native Fremen chronology did not reach its boundary');
}

/** Scalar producer entropy, scoped to the real initializer/actions. Each shuffle
 * retains its original printed order; no candidate histories are retried. */
function identityRandom<T>(run: () => T): T {
  const descriptor = Object.getOwnPropertyDescriptor(crypto, 'getRandomValues');
  crypto.getRandomValues = <V extends ArrayBufferView | null>(array: V): V => {
    assert.ok(array);
    new Uint8Array(array.buffer, array.byteOffset, array.byteLength).fill(255);
    return array;
  };
  try { return run(); }
  finally {
    if (descriptor) Object.defineProperty(crypto, 'getRandomValues', descriptor);
    else Reflect.deleteProperty(crypto, 'getRandomValues');
  }
}

export function assertNexusFremenFreeQuotaInventory(game: Game): void {
  const cards = [...game.deck, ...game.discard, ...game.players.flatMap(p => p.hand),
    ...(game.auction?.cards.slice(game.auction.index + (game.currentAuctionSale ? 1 : 0)) ?? [])];
  assert.deepEqual(cards.map(card => card.id).sort(), treacheryDeck(game.expansions).map(card => card.id).sort());
  assert.equal(new Set(cards.map(card => card.id)).size, cards.length);
  for (const p of game.players) {
    assert.equal(p.reserves + p.tanks + Object.values(p.forces).reduce((sum, n) => sum + n, 0), 20);
    if (p.elites) {
      assert.equal(p.elites.reserves + p.elites.tanks +
        Object.values(p.elites.forces).reduce((sum, n) => sum + n, 0), p.faction === 'emperor' ? 5 : 3);
      assert.ok(p.elites.reserves <= p.reserves && p.elites.tanks <= p.tanks);
    }
  }
  assert.deepEqual([...(game.traitorReserve ?? []), ...game.players.flatMap(p =>
    [...p.traitors, ...p.traitorChoices, ...(p.faceDancers ?? []).map(card => card.leader)])].sort(),
  traitorDeck(game.players, game.expansions.includes('ix')).sort());
  assert.ok(game.nexusCards?.cards);
  validateNexusCards(game.nexusCards.cards, game.players);
}

/** Genuine original Basic/Advanced setup, shipment, weapon death, eight-counter
 * exchange, Shai-Hulud, reciprocal alliance, and physical Fremen closing draw.
 * Only original undealt deck order and producer entropy are staged. */
export function createNexusFremenFreeQuotaFixture(
  options: NexusFremenFreeQuotaFixtureOptions = {},
): NexusFremenFreeQuotaFixture {
  return identityRandom(() => {
    const advanced = options.advanced ?? false, tleilaxu = options.tleilaxu ?? false;
    const owner = 'atreides', opponent = 'emperor', partner = tleilaxu ? 'tleilaxu' : 'guild';
    let lobby = createGame('NEXUSFREMENFREEQUOTA', newPlayer(owner, 'Atreides', 'atreides'), advanced, tleilaxu ? ['ix'] : []);
    joinGame(lobby, newPlayer(partner, tleilaxu ? 'Tleilaxu' : 'Guild', tleilaxu ? 'tleilaxu' : 'guild'));
    joinGame(lobby, newPlayer(opponent, 'Emperor', 'emperor'));
    lobby.nexusCards = { cards: null, phase: null };
    for (const p of lobby.players) lobby = applyAction(lobby, p.id, { type: 'ready' });
    const initial = initializeNexusGameForAudit(lobby);
    const actions: NexusFremenFreeQuotaStep[] = [], staging: string[] = [];
    const act = (game: Game, actor: string, action: Action): Game => {
      actions.push({ actor, action: structuredClone(action) });
      return applyAction(game, actor, action);
    };
    let game = advanceNexusFremenFreeQuota(initial, state => state.status === 'playing', actions);
    assert.ok(!game.players.some(p => p.faction === 'fremen'));
    assert.ok(game.players.every(p => p.hand.length > 0));
    if (tleilaxu) assert.equal(player(game, partner).faceDancers?.length, 3);
    const weapon = player(game, opponent).hand.find(card => card.kind === 'projectile' || card.kind === 'poison');
    assert.ok(weapon, 'The original third-seat deal supplies the real leader-killing weapon');
    assertNexusFremenFreeQuotaInventory(game);

    game = advanceNexusFremenFreeQuota(game,
      state => state.turn === 1 && state.phase === 5 && state.active === opponent && nexusFremenFreeQuotaQuiet(state), actions);
    const sector = territory('arrakeen').sectors[0], target = location('arrakeen', sector);
    assert.ok(shipmentAvailable(game, player(game, opponent)));
    const shipmentSpice = player(game, opponent).spice;
    game = act(game, opponent, { type: 'ship', territory: 'arrakeen', sector, amount: 1, elite: 0, allyPayment: 0 });
    game = advanceNexusFremenFreeQuota(game, nexusFremenFreeQuotaQuiet, actions);
    const shipmentCost = shipmentSpice - player(game, opponent).spice;
    assert.ok(shipmentCost > 0);
    assert.equal(player(game, opponent).forces[target], 1);
    assert.equal(player(game, owner).forces[target], 10);

    game = advanceNexusFremenFreeQuota(game,
      state => state.turn === 1 && state.phase === 6 && nexusFremenFreeQuotaQuiet(state), actions);
    if (!game.battle) {
      assert.ok(game.active === owner || game.active === opponent);
      game = act(game, game.active, { type: 'chooseBattle', territory: 'arrakeen',
        target: game.active === owner ? opponent : owner });
    }
    game = advanceNexusFremenFreeQuota(game,
      state => nexusFremenFreeQuotaQuiet(state) && !nextNexusFremenFreeQuotaNativeStep(state), actions);
    assert.ok(game.battle && !game.battle.revealed);
    const ownLeader = player(game, owner).leaders.filter(leader => !leader.dead).sort((a, b) => a.strength - b.strength)[0];
    const otherLeader = player(game, opponent).leaders.filter(leader => !leader.dead).sort((a, b) => a.strength - b.strength)[0];
    assert.ok(ownLeader && otherLeader);
    game = act(game, owner, { type: 'battlePlan', dial: advanced ? 4 : 8, support: 0,
      leader: ownLeader.id, weapon: null, defense: null });
    game = act(game, opponent, { type: 'battlePlan', dial: 0, support: 0,
      leader: otherLeader.id, weapon: weapon.id, defense: null });
    game = advanceNexusFremenFreeQuota(game, state => state.turn === 2 && state.phase === 1 &&
      nexusFremenFreeQuotaQuiet(state) && !state.spiceSequence && !state.spiceResolution &&
      !state.spiceWindow && !state.nexus && state.ready.length === 0, actions);
    assert.equal(player(game, owner).leaders.find(leader => leader.id === ownLeader.id)?.dead, true);
    assert.equal(player(game, owner).tanks, 8);

    const wormIndex = game.spiceDeck.findIndex(card => 'worm' in card && !card.greatMaker && !card.suppressed && !card.thumper);
    assert.ok(wormIndex >= 0);
    game.spiceDeck.unshift(game.spiceDeck.splice(wormIndex, 1)[0]);
    staging.push('Ordered one original undealt Shai-Hulud singleton before the real turn-two Spice Blow.');
    game = advanceNexusFremenFreeQuota(game,
      state => state.nexus === true && !state.spiceWindow && nexusFremenFreeQuotaQuiet(state), actions);
    game = act(game, opponent, { type: 'alliance', target: partner });
    game = act(game, partner, { type: 'alliance', target: opponent });
    assert.equal(player(game, owner).ally, null);
    game = advanceNexusFremenFreeQuota(game, state => state.nexusCards?.phase?.stage === 'drawing', actions);
    assert.deepEqual(game.nexusCards!.phase!.eligible, [owner]);
    const cards = game.nexusCards!.cards!;
    assert.equal(cards.hands[owner], null);
    const fremenIndex = cards.deck.indexOf('fremen');
    assert.ok(fremenIndex >= 0);
    cards.deck.unshift(cards.deck.splice(fremenIndex, 1)[0]);
    staging.push('Ordered the original undealt Fremen Nexus singleton before the real closing draw; no hand was replaced.');
    const beforeDraw = structuredClone(game);
    const draw: NexusFremenFreeQuotaStep = { actor: owner, action: { type: 'nexusCardChoice',
      turn: game.turn, card: cards.hands[owner], choice: 'draw', ownRedraws: 0 } };
    game = act(game, draw.actor, draw.action);
    assert.equal(game.nexusCards!.cards!.hands[owner], 'fremen');
    const afterDraw = structuredClone(game);
    game = advanceNexusFremenFreeQuota(game,
      state => state.turn === 2 && state.phase === 4 && nexusFremenFreeQuotaQuiet(state), actions);
    assert.equal(player(game, owner).tanks, 8);
    assert.equal(player(game, owner).freeForcesRevived, 0);
    assert.equal(player(game, owner).ally, null);
    const offer = viewGame(game, owner).nexusFremenRevival;
    assert.ok(offer);
    assert.equal(offer.blocked, null);
    assertNexusFremenFreeQuotaInventory(game);
    return { initial, game, owner, actions,
      scenario: { advanced, tleilaxu, opponent, partner, event: offer.event, staging },
      physicalfacts: { shipmentCost, deadLeader: ownLeader.id, battleLosses: 8, beforeDraw, draw, afterDraw } };
  });
}
