import assert from 'node:assert/strict';
import {
  applyAction, createGame, handLimit, initializeSemutaGameForAudit, joinGame, newPlayer,
  viewGame, type Action, type Game,
} from '../game/engine';
import type { Card } from '../game/cards';
import { nativeShipmentSources } from '../game/homeworld-options';
import { forceRevivalQuote, forceRevivalRemaining } from '../game/revival';
import { SEMUTA_DRUG_ID } from '../game/semuta-drug';
import { nextRicheseSkillsTechNativeStep, type RicheseSkillsTechStep } from './fixture-richese-skills-tech';
import { moveSemutaEmperorCard, semutaEmperorCardId, semutaEmperorPlayer,
  type SemutaEmperorShareKind } from './fixture-semuta-emperor-share';

export type SemutaHomeworldEmperorShareFixture = {
  kind: SemutaEmperorShareKind; game: Game; setup: Game; beforeShipment: Game;
  paidShipment: Game; beforeWeather: Game; weather: Game; death: Game; worm: Game;
  alliance: Game; beforeBenefit: Game; beforeDeclaration: Game;
  owner: string; holder: string; recipient: string;
  canceller: string; karama: string; karamaCard: Card; weatherCard: string;
  shipment: Action; weatherAction: Action; declare: Action; cancel: Action;
  actions: RicheseSkillsTechStep[]; staging: string[];
};
const clean = (game: Game) => !game.phaseOpening && !game.response && !game.decision &&
  !game.pendingTreacheryDiscard;

export function nextSemutaHomeworldEmperorShareStep(game: Game): RicheseSkillsTechStep {
  const pending = game.pendingTreacheryDiscard, reaction = pending?.reaction;
  if (pending && reaction?.stage === 'offer') return {
    actor: game.players.find(p => !reaction.passed.includes(p.id))!.id,
    action: { type: 'semutaPass', event: pending.batch.event },
  };
  if (!game.phaseOpening && !game.response && !game.pendingTreacheryDiscard && game.biddingEnd) {
    const end = game.biddingEnd;
    return { actor: end.owners.find(id => !end.ready.includes(id))!,
      action: { type: 'biddingEnd', event: end.event, mode: 'ready' } };
  }
  if (game.decision?.kind === 'choamMarket') return {
    actor: game.decision.player, action: { type: 'decision', done: true },
  };
  // The Homeworld CHOAM Mentat window is optional: decline it so its special
  // effects never disturb the deployed Atreides counter before the storm.
  if (game.decision?.kind === 'choamMentat') return {
    actor: game.decision.player, action: { type: 'decision', done: true },
  };
  return nextRicheseSkillsTechNativeStep(game);
}
export function advanceSemutaHomeworldEmperorShare(state: Game, until: (game: Game) => boolean,
  actions?: RicheseSkillsTechStep[]): Game {
  let game = state;
  for (let n = 0; !until(game) && n < 2000; n++) {
    assert.notEqual(game.status, 'finished');
    const next = nextSemutaHomeworldEmperorShareStep(game);
    actions?.push(next);
    game = applyAction(game, next.actor, next.action);
  }
  assert.ok(until(game), 'Original share continuation reaches the requested native boundary');
  return game;
}
export function semutaHomeworldEmperorShareStock(game: Game): string[] {
  return [game.deck, game.discard, game.richeseCache ?? [], game.richeseRemoved ?? [],
    ...game.players.map(p => p.hand)].flat().map(card => card.id).sort();
}
export function semutaHomeworldEmperorShareResources(game: Game) {
  return { custody: structuredClone(game.homeworlds?.custody), emperorExtra: { ...game.emperorExtra },
    players: game.players.map(p => ({ id: p.id, spice: p.spice, forces: { ...p.forces },
      reserves: p.reserves, tanks: p.tanks, elites: structuredClone(p.elites),
      revived: p.revived, freeForcesRevived: p.freeForcesRevived,
      battleLosses: p.battleLosses, ally: p.ally, allySinceTurn: p.allySinceTurn })) };
}
function orderUnplayedSpice(game: Game, kinds: ('land' | 'worm')[]): void {
  for (const [position, kind] of kinds.entries()) {
    const at = game.spiceDeck.findIndex((card, i) => i >= position &&
      (kind === 'land' ? 'territory' in card : 'worm' in card));
    assert.ok(at >= position);
    game.spiceDeck.splice(position, 0, game.spiceDeck.splice(at, 1)[0]);
  }
}

/** Original R/C/E/A setup, paid three-counter deployment, real Weather casualties
 * and mutual worm Nexus alliance. Only physical cards/unplayed Spice order move. */
export function createSemutaHomeworldEmperorShareFixture(
  kind: SemutaEmperorShareKind, advanced = false, fullHolder = false,
): SemutaHomeworldEmperorShareFixture {
  let game = createGame('SEMUTAHWSHARE', newPlayer('r', 'Richese', 'richese'), advanced, ['choam']);
  joinGame(game, newPlayer('c', 'CHOAM', 'choam'));
  joinGame(game, newPlayer('e', 'Emperor', 'emperor'));
  joinGame(game, newPlayer('a', 'Atreides', 'atreides'));
  game = applyAction(game, 'r', { type: 'homeworlds', enabled: true });
  for (const p of game.players) game = applyAction(game, p.id, { type: 'ready' });
  game = initializeSemutaGameForAudit(game);
  const actions: RicheseSkillsTechStep[] = [], staging: string[] = [];
  const reach = (until: (g: Game) => boolean) => {
    game = advanceSemutaHomeworldEmperorShare(game, until, actions);
  };
  const act = (actor: string, action: Action) => {
    actions.push({ actor, action }); game = applyAction(game, actor, action);
  };
  reach(g => g.status === 'playing');
  const setup = structuredClone(game);
  moveSemutaEmperorCard(game, SEMUTA_DRUG_ID, 'r');
  orderUnplayedSpice(game, ['land', 'land']);
  staging.push('Original physical Semuta to Richese; first two unplayed original Spice Cards are non-worm.');
  reach(g => g.phase === 5 && g.active === 'a' && clean(g));
  const beforeShipment = structuredClone(game);
  const homeworldSources = nativeShipmentSources(viewGame(game, 'a'), 3, 0);
  assert.ok(homeworldSources);
  const shipment: Action = { type: 'ship', territory: 'red_chasm', sector: 7,
    amount: 3, elite: 0, homeworldSources, allyPayment: 0 };
  act('a', shipment);
  reach(clean);
  const paidShipment = structuredClone(game);
  assert.equal(semutaEmperorPlayer(game, 'a').spice, semutaEmperorPlayer(beforeShipment, 'a').spice - 6);
  assert.equal(semutaEmperorPlayer(game, 'a').forces['red_chasm:7'], 3);
  assert.equal(semutaEmperorPlayer(game, 'a').reserves, 7);
  act('a', { type: 'endMovement' });
  reach(g => g.turn === 2 && g.phase === 0 && clean(g));
  const weatherCard = semutaEmperorCardId(game, card => card.effect === 'weather');
  moveSemutaEmperorCard(game, weatherCard, 'a');
  staging.push('Conserved original printed Weather Control to Atreides before the second native Storm.');
  const beforeWeather = structuredClone(game);
  assert.equal(game.storm, 1);
  const weatherAction: Action = { type: 'card', card: weatherCard, amount: 6 };
  act('a', weatherAction);
  reach(clean);
  const weather = structuredClone(game);
  assert.equal(game.stormPending, 6);
  assert.equal(game.stormMovementSource?.kind, 'weather');
  reach(g => g.phase === 1 && clean(g));
  const death = structuredClone(game);
  assert.equal(game.storm, 7);
  assert.equal(semutaEmperorPlayer(game, 'a').forces['red_chasm:7'] ?? 0, 0);
  assert.equal(semutaEmperorPlayer(game, 'a').forces['arrakeen:10'], 10);
  assert.equal(semutaEmperorPlayer(game, 'a').tanks, 3);
  assert.equal(semutaEmperorPlayer(game, 'e').spice, 10);
  assert.ok(semutaEmperorPlayer(game, 'r').hand.some(card => card.id === SEMUTA_DRUG_ID));
  orderUnplayedSpice(game, ['worm', 'land', 'land']);
  staging.push('The next original unplayed worm opens the second-turn Nexus; later original land cards close Spice Blow.');
  reach(g => g.nexus && !g.spiceWindow && !g.spiceResolution && clean(g));
  const worm = structuredClone(game);
  act('e', { type: 'alliance', target: 'a' });
  act('a', { type: 'alliance', target: 'e' });
  const alliance = structuredClone(game);
  reach(g => g.phase === (kind === 'emperorGift' ? 2 : 4) && clean(g));
  const beforeBenefit = structuredClone(game);
  // Conserved late hand positioning follows every preceding committed market pool.
  for (const p of game.players) game.deck.push(...p.hand.splice(0));
  moveSemutaEmperorCard(game, SEMUTA_DRUG_ID, 'r');
  const karama = semutaEmperorCardId(game, card => card.effect === 'karama');
  moveSemutaEmperorCard(game, karama, 'a');
  if (fullHolder) while (semutaEmperorPlayer(game, 'r').hand.length < handLimit(semutaEmperorPlayer(game, 'r'))) {
    assert.ok(game.deck[0]); moveSemutaEmperorCard(game, game.deck[0].id, 'r');
  }
  const karamaCard = semutaEmperorPlayer(game, 'a').hand.find(card => card.id === karama)!;
  staging.push('Conserved original printed Karama to Atreides and Semuta to Richese; optional full hand uses original undealt stock.');
  assert.deepEqual(semutaHomeworldEmperorShareStock(game), semutaHomeworldEmperorShareStock(setup));
  assert.equal(semutaEmperorPlayer(game, 'e').spice, 10);
  assert.equal(semutaEmperorPlayer(game, 'a').tanks, 3);
  assert.equal(semutaEmperorPlayer(game, 'a').revived, 0);
  // Real UI entry point for the Emperor's own declaration: every conserved card
  // is already positioned, and only the declared benefit response is missing.
  const beforeDeclaration = structuredClone(game);
  const declare: Action = { type: kind, amount: kind === 'emperorGift' ? 3 : 2 };
  act('e', declare);
  assert.equal(game.response?.kind, kind);
  return { kind, game, setup, beforeShipment, paidShipment, beforeWeather, weather, death,
    worm, alliance, beforeBenefit, beforeDeclaration,
    owner: 'e', holder: 'r', recipient: 'a', canceller: 'a',
    karama, karamaCard, weatherCard, shipment, weatherAction,
    declare,
    cancel: { type: 'card', mode: 'cancel', card: karama }, actions, staging };
}

/** Stop at the paid printed cancellation receipt, before its native denial. */
export function disposeSemutaHomeworldEmperorShare(f: SemutaHomeworldEmperorShareFixture,
  state = f.game, actions?: RicheseSkillsTechStep[]): Game {
  assert.equal(state.response?.kind, f.kind);
  actions?.push({ actor: f.canceller, action: f.cancel });
  return applyAction(state, f.canceller, f.cancel);
}
export function reactSemutaHomeworldEmperorShare(state: Game, holder: string, claim: boolean): Game {
  const event = state.pendingTreacheryDiscard!.batch.event;
  if (claim) return applyAction(state, holder, { type: 'semutaCommit', event });
  let game = state;
  for (const p of state.players) game = applyAction(game, p.id, { type: 'semutaPass', event });
  return game;
}
/** The still-legal ordinary return this fixture exercises at that revival window. */
export function semutaHomeworldEmperorOrdinaryRevive(game: Game, playerId: string): number {
  const seat = semutaEmperorPlayer(game, playerId);
  const limit = Math.min(forceRevivalRemaining(game, seat), seat.tanks);
  return Array.from({ length: limit }, (_, index) => index + 1)
    .filter(count => forceRevivalQuote(game, seat, count).cost <= seat.spice).at(-1) ?? 0;
}
/** Use the same original controls. Revival additionally exercises the still-legal
 * ordinary Atreides return of whatever two-cost revivals remain that turn. */
export function finishSemutaHomeworldEmperorShare(state: Game, f: SemutaHomeworldEmperorShareFixture,
  actions?: RicheseSkillsTechStep[]): Game {
  let game = advanceSemutaHomeworldEmperorShare(state, clean, actions);
  if (f.kind === 'emperorRevival') {
    const amount = semutaHomeworldEmperorOrdinaryRevive(game, f.recipient);
    assert.ok(amount > 0, 'The original Tanks still support an ordinary revival this turn');
    const revive: Action = { type: 'revive', amount, elite: 0 };
    actions?.push({ actor: f.recipient, action: revive });
    game = applyAction(game, f.recipient, revive);
  }
  return advanceSemutaHomeworldEmperorShare(game,
    g => g.turn === 2 && g.phase === (f.kind === 'emperorGift' ? 3 : 5) && clean(g), actions);
}
