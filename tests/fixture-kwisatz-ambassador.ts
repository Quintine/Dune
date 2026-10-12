import assert from 'node:assert/strict';
import {
  applyAction, createGame, initializeFactionExpansionsGameForAudit, joinGame,
  newPlayer, type Action, type Game,
} from '../game/engine';
import { TERRITORIES } from '../game/board';
import { AMBASSADOR_EFFECTS, type AmbassadorEffect } from '../game/ecaz-ambassadors';
import { nextRicheseSkillsTechNativeStep } from './fixture-richese-skills-tech';
import { moveSemutaEmperorCard, semutaEmperorCardId, semutaEmperorPlayer } from './fixture-semuta-emperor-share';

export type KwisatzAmbassadorStep = { actor: string; action: Action };
export type KwisatzAmbassadorFixture = {
  game: Game; beforeArrival: Game; afterDeath: Game; afterLosses: Game;
  actions: KwisatzAmbassadorStep[]; owner: string; beneficiary: string;
  entrant: string; token: string; copied: boolean; location: string;
};

/** Control only the original nine-draw Ambassador packet when starting forces
 * initialize; no token identity, cohort or history is assigned afterwards. */
function withPacket<T>(copied: boolean, run: () => T): T {
  const pool = AMBASSADOR_EFFECTS.filter(effect => effect !== 'ecaz');
  const first: Exclude<AmbassadorEffect, 'ecaz'>[] = copied
    ? ['beneGesserit', 'atreides', 'choam', 'emperor', 'fremen']
    : ['tleilaxu', 'atreides', 'choam', 'emperor', 'fremen'];
  const desired = [...first, ...pool.filter(effect => !first.includes(effect))];
  const current = [...pool], rolls: number[] = [];
  for (let i = current.length - 1; i > 0; i--) {
    const j = current.indexOf(desired[i]); assert.ok(j >= 0 && j <= i);
    rolls.push(Math.floor((j + 0.5) * 0x100000000 / (i + 1)));
    [current[i], current[j]] = [current[j], current[i]];
  }
  const descriptor = Object.getOwnPropertyDescriptor(crypto, 'getRandomValues');
  const original = crypto.getRandomValues.bind(crypto); let cursor = 0;
  crypto.getRandomValues = <T extends ArrayBufferView | null>(array: T): T => {
    if (array instanceof Uint32Array && array.length === 1 && cursor < rolls.length)
      array[0] = rolls[cursor++];
    else Reflect.apply(original, crypto, [array]);
    return array;
  };
  try { return run(); }
  finally {
    if (descriptor) Object.defineProperty(crypto, 'getRandomValues', descriptor);
    else Reflect.deleteProperty(crypto, 'getRandomValues');
  }
}

/** Two original battles record seven losses, then an actual KH Lasgun/Shield
 * death. Original worm alliance, placement and entrant shipment invoke the grant.
 * Later force/card positions are conserved; no clocks, wallets, deaths or allies
 * are fabricated. Ghola returns only the accompanying ordinary leader. */
export function createKwisatzAmbassadorFixture(copied = false): KwisatzAmbassadorFixture {
  let game = createGame('KWISATZAMBASSADOR', newPlayer('x', 'Ecaz', 'ecaz'), true, ['ecaz']);
  joinGame(game, newPlayer('a', 'Atreides', 'atreides'));
  joinGame(game, newPlayer('g', 'Guild', 'guild'));
  for (const player of game.players) game = applyAction(game, player.id, { type: 'ready' });
  game = initializeFactionExpansionsGameForAudit(game);
  const actions: KwisatzAmbassadorStep[] = [];
  const act = (actor: string, action: Action) => {
    actions.push({ actor, action }); game = applyAction(game, actor, action);
  };
  const clean = () => !game.decision && !game.response && !game.phaseOpening && !game.pendingTreacheryDiscard;
  const next = () => {
    if (game.decision?.kind === 'ecazPlacement')
      return { actor: game.decision.player, action: { type: 'decision', decline: true } };
    const step = nextRicheseSkillsTechNativeStep(game);
    if (step.action.type === 'stormDial') step.action.amount = 0;
    return step;
  };
  const reach = (until: () => boolean) => {
    for (let n = 0; !until() && n < 2400; n++) {
      assert.notEqual(game.status, 'finished'); const step = next(); act(step.actor, step.action);
    }
    assert.ok(until(), 'Original native actions must reach the KH Ambassador boundary');
  };
  while (game.status === 'setup') {
    const step = next();
    const after = withPacket(copied, () => applyAction(game, step.actor, step.action));
    actions.push(step); game = after;
  }
  const effect = copied ? 'beneGesserit' : 'tleilaxu';
  const token = game.ecazAmbassadors!.tokens.find(token => token.effect === effect)!;
  assert.equal(token.zone, 'supply');
  assert.equal(game.ecazAmbassadors!.tokens.find(t => t.effect === 'tleilaxu')!.zone, copied ? 'pool' : 'supply');
  const landBlows = (count: number) => {
    for (let at = 0; at < count; at++) {
      const index = game.spiceDeck.findIndex((card, i) => i >= at && 'territory' in card);
      assert.ok(index >= at); game.spiceDeck.splice(at, 0, game.spiceDeck.splice(index, 1)[0]);
    }
  };
  landBlows(2);
  const reserveBoard = () => {
    for (const player of game.players) {
      player.reserves += Object.values(player.forces).reduce((sum, count) => sum + count, 0);
      player.forces = {};
    }
  };
  const stageBattle = (amount: number, enemy: number) => {
    reserveBoard();
    const site = TERRITORIES.find(t => t.type === 'sand' && !t.sectors.includes(game.storm)); assert.ok(site);
    const key = `${site.id}:${site.sectors[0]}`;
    for (const [id, count] of [['a', amount], ['g', enemy]] as const) {
      const player = semutaEmperorPlayer(game, id); assert.ok(player.reserves >= count);
      player.reserves -= count; player.forces[key] = count;
    }
    return site.id;
  };
  const openBattle = (site: string) => {
    reach(() => game.phase === 6 && clean());
    while (game.active === 'x') { const step = next(); act(step.actor, step.action); }
    assert.ok(game.active === 'a' || game.active === 'g');
    act(game.active!, { type: 'chooseBattle', territory: site, target: game.active === 'a' ? 'g' : 'a' });
    while (game.response || game.decision || game.battle?.preparation || game.battle?.preLeader?.closed === false) {
      const step = next(); act(step.actor, step.action);
    }
  };
  const seal = (actor: string, action: Action) => {
    act(actor, action);
    while (game.response || game.decision?.kind === 'fullPlanOffer') {
      const step = next(); act(step.actor, step.action);
    }
  };
  const nativeLeader = (id: string, strongest: boolean) => {
    const leaders = semutaEmperorPlayer(game, id).leaders.filter(l => !l.dead && !l.usedAt)
      .sort((a, b) => strongest ? b.strength - a.strength : a.strength - b.strength);
    assert.ok(leaders[0]); return leaders[0].id;
  };
  reach(() => game.phase === 5 && clean());
  const firstSite = stageBattle(7, 2); openBattle(firstSite);
  seal('a', { type: 'battlePlan', leader: nativeLeader('a', false), dial: 0, support: 0 });
  seal('g', { type: 'battlePlan', leader: nativeLeader('g', true), dial: 1, support: 1 });
  reach(() => !game.battle && clean());
  assert.equal(semutaEmperorPlayer(game, 'a').battleLosses, 7);
  const afterLosses = structuredClone(game);
  reach(() => game.turn === 2 && game.phase === 1 && clean());
  const worm = game.spiceDeck.findIndex(card => 'worm' in card); assert.ok(worm >= 0);
  game.spiceDeck.unshift(game.spiceDeck.splice(worm, 1)[0]);
  reach(() => game.nexus && !game.spiceWindow && !game.spiceResolution && clean());
  act('x', { type: 'alliance', target: 'a' }); act('a', { type: 'alliance', target: 'x' });
  reach(() => game.phase === 5 && clean());
  const secondSite = stageBattle(3, 3);
  const shield = moveSemutaEmperorCard(game, semutaEmperorCardId(game, card => card.kind === 'shield'), 'a');
  const lasgun = moveSemutaEmperorCard(game, semutaEmperorCardId(game, card => card.kind === 'lasgun'), 'g');
  openBattle(secondSite);
  const accompanying = nativeLeader('a', false);
  seal('a', { type: 'battlePlan', leader: accompanying, dial: 0, support: 0, defense: shield, kwisatz: true });
  seal('g', { type: 'battlePlan', leader: nativeLeader('g', true), dial: 0, support: 0, weapon: lasgun });
  reach(() => !game.battle && clean());
  assert.equal(semutaEmperorPlayer(game, 'a').kwisatz?.dead, true);
  assert.equal(semutaEmperorPlayer(game, 'a').kwisatz?.revivalCycle, 1);
  const afterDeath = structuredClone(game);
  landBlows(4);
  reach(() => game.turn === 3 && game.phase === 4 && game.decision?.kind === 'ecazPlacement');
  const destination = TERRITORIES.find(t => t.type === 'stronghold' && !t.sectors.includes(game.storm) &&
    !game.players.some(p => Object.keys(p.forces).some(key => key.startsWith(`${t.id}:`))));
  assert.ok(destination);
  act('x', { type: 'decision', token: token.id, territory: destination.id });
  while (game.response) { const step = next(); act(step.actor, step.action); }
  assert.equal(game.ecazAmbassadors!.tokens.find(t => t.id === token.id)!.zone, 'placed');
  act('x', { type: 'decision', decline: true });
  reach(() => game.phase === 5 && game.active === 'g' && clean());
  const ghola = moveSemutaEmperorCard(game, semutaEmperorCardId(game, card => card.effect === 'ghola'), 'a');
  act('a', { type: 'card', card: ghola, leader: accompanying });
  reach(clean);
  const atreides = semutaEmperorPlayer(game, 'a');
  atreides.reserves += atreides.tanks; atreides.tanks = 0;
  assert.equal(atreides.kwisatz?.dead, true);
  assert.ok(atreides.leaders.every(l => !l.dead));
  const beforeArrival = structuredClone(game);
  act('g', { type: 'ship', amount: 1, territory: destination.id, sector: destination.sectors[0] });
  reach(() => game.pendingAmbassador?.stage === 'offer');
  const event = game.pendingAmbassador!.event;
  act('x', { type: 'decision', event, trigger: true, beneficiary: 'a', choice: 'effect' });
  if (copied) {
    assert.equal(game.pendingAmbassador?.stage, 'copy');
    act('a', { type: 'decision', event, effect: 'tleilaxu' });
  }
  assert.equal(game.pendingAmbassador?.stage, 'revival');
  return { game, beforeArrival, afterDeath, afterLosses, actions, owner: 'x', beneficiary: 'a',
    entrant: 'g', token: token.id, copied, location: destination.id };
}
