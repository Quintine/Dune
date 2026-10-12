import assert from 'node:assert/strict';
import {
  createGame, joinGame, newPlayer, initializeSemutaGameForAudit, handLimit,
  viewGame, type Action, type Game,
} from '../game/engine';
import { nativeShipmentSources } from '../game/homeworld-options';
import { quoteSpiceCollection } from '../game/board-resolution-quote';
import { SEMUTA_DRUG_ID } from '../game/semuta-drug';
import { moveSemutaEmperorCard, semutaEmperorCardId, semutaEmperorPlayer as player } from './fixture-semuta-emperor-share';
import { applySemutaHomeworldChoamStep } from './fixture-semuta-homeworld-choam';
import { advanceSemutaHomeworldEmperorShare, nextSemutaHomeworldEmperorShareStep }
  from './fixture-semuta-homeworld-emperor-share';
import type { RicheseSkillsTechStep } from './fixture-richese-skills-tech';

export type SemutaHomeworldCaptureKaramaFixture = {
  initial: Game; setup: Game; beforeBattle: Game; acceptedBattle: Game;
  nativecaptureOffer: Game | null; originalresponse: Game | null;
  gameBeforeCost: Game; game: Game;
  paidShipment: { actor: string; action: Action; before: Game; after: Game };
  actor: string; owner: string; holder: string; captor: string; victim: string;
  winner: string; loser: string; location: string; card: string;
  winnerLeader: string; loserLeader: string; action: Action;
  actions: RicheseSkillsTechStep[]; staging: string[];
};
const clean = (g: Game) => !g.phaseOpening && !g.response && !g.decision && !g.pendingTreacheryDiscard;

export function semutaHomeworldCaptureKaramaStock(g: Game): string[] {
  return [g.deck, g.discard, g.richeseCache ?? [], g.richeseRemoved ?? [],
    ...g.players.map(p => p.hand)].flat().map(c => c.id).sort();
}
export function semutaHomeworldCaptureKaramaResources(g: Game) {
  return { custody: structuredClone(g.homeworlds?.custody), spice: structuredClone(g.spice),
    players: g.players.map(p => ({ id: p.id, spice: p.spice, reserves: p.reserves,
      tanks: p.tanks, forces: structuredClone(p.forces), elites: structuredClone(p.elites),
      battleLosses: p.battleLosses, leaders: structuredClone(p.leaders),
      traitors: [...p.traitors], ally: p.ally })),
    context: structuredClone(g.lastBattleContext), tech: structuredClone(g.techTokens) };
}

/** Genuine first-turn R/C/E/A/H native setup. Only physical hand positions and
 * still-unplayed Spice Card order are staged; no clocks or counters are assigned. */
export function createSemutaHomeworldCaptureKaramaFixture(
  fullHolder = false, advanced = true,
): SemutaHomeworldCaptureKaramaFixture {
  let game = createGame('SEMUTAHOMECAPTURE', newPlayer('r', 'Richese', 'richese'), advanced, ['choam']);
  for (const [id, name, faction] of [
    ['c', 'CHOAM', 'choam'], ['e', 'Emperor', 'emperor'],
    ['a', 'Atreides', 'atreides'], ['h', 'Harkonnen', 'harkonnen'],
  ] as const) joinGame(game, newPlayer(id, name, faction));
  const actions: RicheseSkillsTechStep[] = [], staging: string[] = [];
  const act = (actor: string, action: Action) => {
    game = applySemutaHomeworldChoamStep(game, actor, action, actions);
  };
  act(game.host, { type: 'homeworlds', enabled: true });
  for (const seat of game.players) act(seat.id, { type: 'ready' });
  const initial = structuredClone(game);
  game = initializeSemutaGameForAudit(game);
  game = advanceSemutaHomeworldEmperorShare(game, g => g.status === 'playing', actions);
  const setup = structuredClone(game);
  const blows = game.spiceDeck.filter(c => 'territory' in c).slice(0, 2);
  assert.equal(blows.length, 2);
  for (const [i, card] of blows.entries())
    game.spiceDeck.splice(i, 0, game.spiceDeck.splice(game.spiceDeck.indexOf(card), 1)[0]);
  staging.push('Reorder two original still-unplayed non-worm Spice Cards.');
  game = advanceSemutaHomeworldEmperorShare(game,
    g => g.phase === 5 && g.active === 'e' && clean(g), actions);
  assert.equal(game.turn, 1);
  assert.equal(player(game, 'h').forces['carthag:11'], 10);
  assert.equal(player(game, 'e').spice, player(setup, 'e').spice,
    'Explicit original Bidding readiness must leave the Emperor funding untouched for the real paid deployment');
  const sources = nativeShipmentSources(viewGame(game, 'e'), 2, 0);
  assert.ok(sources);
  const shipment: Action = { type: 'ship', territory: 'carthag', sector: 11,
    amount: 2, elite: 0, homeworldSources: sources, allyPayment: 0 };
  const beforeShipment = structuredClone(game);
  act('e', shipment);
  game = advanceSemutaHomeworldEmperorShare(game, clean, actions);
  const paidShipment = { actor: 'e', action: shipment, before: beforeShipment, after: structuredClone(game) };
  assert.equal(player(game, 'e').spice, player(beforeShipment, 'e').spice - 2);
  assert.equal(player(game, 'e').reserves, player(beforeShipment, 'e').reserves - 2);
  assert.deepEqual(player(game, 'e').elites, player(beforeShipment, 'e').elites);
  act('e', { type: 'endMovement' });
  game = advanceSemutaHomeworldEmperorShare(game, g => g.phase === 6 && clean(g), actions);
  // Later conserved custody, not an auction award or a copied physical face.
  game.deck.push(...player(game, 'r').hand.splice(0));
  moveSemutaEmperorCard(game, SEMUTA_DRUG_ID, 'r');
  const existingKarama = player(game, 'e').hand.find(c => c.effect === 'karama');
  const card = existingKarama?.id ?? moveSemutaEmperorCard(game,
    semutaEmperorCardId(game, c => c.effect === 'karama'), 'e');
  assert.ok(player(game, 'e').hand.length <= handLimit(player(game, 'e')));
  if (fullHolder) while (player(game, 'r').hand.length < handLimit(player(game, 'r'))) {
    assert.ok(game.deck[0]);
    moveSemutaEmperorCard(game, game.deck[0].id, 'r');
  }
  staging.push(`Conserved original ${SEMUTA_DRUG_ID} to Richese and printed ${card} to Emperor; ` +
    (fullHolder ? 'Richese filled to four using original undealt cards.' : 'Richese holds only Semuta.'));
  const beforeBattle = structuredClone(game);
  const chooser = game.active;
  assert.ok(chooser && ['e', 'h'].includes(chooser));
  act(chooser, { type: 'chooseBattle', territory: 'carthag', target: chooser === 'e' ? 'h' : 'e' });
  game = advanceSemutaHomeworldEmperorShare(game,
    g => !!g.battle?.preLeader?.closed && clean(g), actions);
  const winnerLeader = player(game, 'h').leaders.filter(l => !l.dead && !l.usedAt)
    .sort((a, b) => b.strength - a.strength)[0].id;
  const loserLeader = player(game, 'e').leaders.filter(l => !l.dead && !l.usedAt)
    .sort((a, b) => a.strength - b.strength)[0].id;
  assert.ok(player(game, 'h').leaders.find(l => l.id === winnerLeader)!.strength + 1 >
    player(game, 'e').leaders.find(l => l.id === loserLeader)!.strength);
  const battle = game.battle!;
  for (const actor of [battle.attacker, battle.defender]) act(actor,
    { type: 'battlePlan', dial: actor === 'h' ? 1 : 0,
      support: advanced && actor === 'h' ? 1 : 0,
      leader: actor === 'h' ? winnerLeader : loserLeader });
  for (const actor of [battle.attacker, battle.defender]) act(actor, { type: 'traitorCall', call: false });
  const acceptedBattle = structuredClone(game);
  let nativecaptureOffer: Game | null = null, originalresponse: Game | null = null;
  if (advanced) {
    game = advanceSemutaHomeworldEmperorShare(game, g => g.decision?.kind === 'captureOffer', actions);
    assert.equal(game.decision?.player, 'h');
    nativecaptureOffer = structuredClone(game);
    act('h', { type: 'decision', accept: true });
    assert.equal(game.response?.kind, 'capture');
    assert.equal(game.response?.owner, 'h');
    originalresponse = structuredClone(game);
  } else {
    game = advanceSemutaHomeworldEmperorShare(game, g => g.phase === 7 && clean(g), actions);
    assert.equal(game.pendingCapture, null);
  }
  return { initial, setup, beforeBattle, acceptedBattle, nativecaptureOffer, originalresponse,
    gameBeforeCost: game, game, paidShipment, actor: 'e', owner: 'e', holder: 'r',
    captor: 'h', victim: 'e', winner: 'h', loser: 'e', location: 'carthag:11', card,
    winnerLeader, loserLeader, action: { type: 'card', mode: 'cancel', card }, actions, staging };
}

export function disposeSemutaHomeworldCaptureKarama(f: SemutaHomeworldCaptureKaramaFixture,
  state = f.gameBeforeCost, actions?: RicheseSkillsTechStep[]): Game {
  return applySemutaHomeworldChoamStep(state, f.actor, f.action, actions);
}

/** Stop before the original final Battle/market close; quote Collection before
 * its native credits, never quote an already-collected phase-seven board twice. */
export function finishSemutaHomeworldCaptureKarama(state: Game, actions: RicheseSkillsTechStep[] = []) {
  assert.equal(state.pendingTreacheryDiscard, null,
    'Resolve the original printed-cost offer before the native Collection continuation');
  let game = state;
  for (let n = 0; n < 1600; n++) {
    assert.equal(game.turn, state.turn);
    assert.equal(game.phase, 6);
    const beforeCollection = game;
    const collection = quoteSpiceCollection(beforeCollection);
    const next = nextSemutaHomeworldEmperorShareStep(game);
    game = applySemutaHomeworldChoamStep(game, next.actor, next.action, actions);
    if (game.phase === 7) {
      game = advanceSemutaHomeworldEmperorShare(game, clean, actions);
      return { beforeCollection, collection, game };
    }
  }
  throw new Error('Original native capture cleanup must reach Collection');
}
