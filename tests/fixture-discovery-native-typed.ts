import assert from 'node:assert/strict';
import {
  applyAction, createGame, initializeDiscoveryGameForAudit, joinGame, newPlayer,
  viewGame, type Action, type Game, type Player,
} from '../game/engine';
import { MOBILE_LOCATION, MOBILE_STRONGHOLD, gameTerritories, splitLocation } from '../game/board';
import { spiceDeck, treacheryDeck, type Card } from '../game/cards';
import { traitorDeck } from '../game/traitors';
import { DISCOVERY_SPICE_CARDS, validateDiscoveryState, type DiscoveryTokenFace } from '../game/discoveries';
import { nextSkillsTechBattleStep, openSkillsTechBattle } from './fixture-skills-tech-battle';
import { putDiscovery } from './fixture-discovery';

export type NativeTypedOptions = { advanced?: boolean; tech?: boolean; advisors?: boolean };
export type NativeTypedRevealPosition = { game: Game; owner: string; token: string };
export const nativeTypedReload = (game: Game): Game => JSON.parse(JSON.stringify(game));
export function nativeTypedPlayer(game: Game, id: string): Player {
  const player = game.players.find(p => p.id === id);
  assert.ok(player);
  return player;
}
export function nativeTypedStep(game: Game): Game {
  const next = game.decision?.kind === 'discoveryEntry'
    ? { actor: game.decision.player, action: { type: 'decision', accept: false, event: game.decision.event } }
    : game.decision?.kind === 'ixSubstitution'
      ? { actor: game.decision.player, action: { type: 'decision', decline: true } }
      : nextSkillsTechBattleStep(game);
  return applyAction(game, next.actor, next.action);
}
/** Original controls only: do not assign phases, turns, wallets or pending frames. */
export function nativeTypedPhase(state: Game, phase: number, turn = state.turn): Game {
  let game = state;
  for (let step = 0; step < 1200 && (game.turn !== turn || game.phase !== phase ||
    game.phaseOpening || game.response || game.decision); step++) {
    assert.equal(game.status, 'playing');
    assert.ok(game.turn <= turn);
    game = nativeTypedStep(game);
  }
  assert.equal(game.turn, turn);
  assert.equal(game.phase, phase);
  assert.ok(!game.phaseOpening && !game.response && !game.decision);
  return game;
}
export function nativeTypedCustody(game: Game): void {
  assert.deepEqual([...game.deck, ...game.discard, ...(game.ixSetupCards ?? []),
    ...game.players.flatMap(p => p.hand)].map(c => c.id).sort(),
  treacheryDeck(['ix']).map(c => c.id).sort());
  assert.deepEqual([...(game.traitorReserve ?? []), ...game.players.flatMap(p => [
    ...p.traitors, ...p.traitorChoices, ...(p.faceDancers ?? []).map(c => c.leader),
  ])].sort(), traitorDeck(game.players, true).sort());
  for (const p of game.players) {
    const board = Object.values(p.forces).reduce((sum, n) => sum + n, 0);
    assert.equal(p.reserves + p.tanks + board, 20);
    assert.ok(p.reserves >= (p.elites?.reserves ?? 0));
    assert.ok(p.tanks >= (p.elites?.tanks ?? 0));
    for (const [key, total] of Object.entries(p.forces)) {
      assert.ok(Number.isSafeInteger(total) && total >= 0);
      assert.ok(total >= (p.elites?.forces[key] ?? 0));
    }
    if (p.elites) {
      assert.equal(p.elites.reserves + p.elites.tanks +
        Object.values(p.elites.forces).reduce((sum, n) => sum + n, 0),
      p.faction === 'ixians' ? 7 : p.faction === 'fremen' ? 3 : 5);
      for (const [key, elite] of Object.entries(p.elites.forces))
        assert.ok(Number.isSafeInteger(elite) && elite >= 0 && elite <= (p.forces[key] ?? 0));
    }
  }
  validateDiscoveryState(game.discoveries!);
}
/** Labelled conserved position: physical reserves -> board, including typed subsets. */
export function nativeTypedPlace(game: Game, id: string, key: string, normal: number, elite = 0): void {
  const player = nativeTypedPlayer(game, id);
  assert.ok(player.reserves - (player.elites?.reserves ?? 0) >= normal);
  assert.ok((player.elites?.reserves ?? 0) >= elite);
  player.reserves -= normal + elite;
  player.forces[key] = (player.forces[key] ?? 0) + normal + elite;
  if (elite) {
    player.elites!.reserves -= elite;
    player.elites!.forces[key] = (player.elites!.forces[key] ?? 0) + elite;
  }
}
/** Keep the actual native HMS garrison; return other original board pieces to reserves. */
export function nativeTypedClearBoard(game: Game): void {
  for (const p of game.players) {
    for (const [key, total] of Object.entries(p.forces)) {
      if (key === MOBILE_LOCATION) continue;
      p.reserves += total;
      delete p.forces[key];
      if (p.elites) {
        p.elites.reserves += p.elites.forces[key] ?? 0;
        delete p.elites.forces[key];
      }
    }
    if (p.advisors) p.advisors = {};
  }
}
export function nativeTypedSetup(options: NativeTypedOptions = {}) {
  let lobby = createGame('DISCOVERYNATIVETYPED', newPlayer('i', 'Ixians', 'ixians'),
    options.advanced ?? false, ['ix']);
  for (const [id, faction] of [['t', 'tleilaxu'], ['f', 'fremen'], ['g', 'guild']] as const)
    joinGame(lobby, newPlayer(id, faction, faction));
  if (options.advisors) joinGame(lobby, newPlayer('b', 'Bene Gesserit', 'beneGesserit'));
  if (options.tech) lobby = applyAction(lobby, lobby.host, { type: 'techTokens', enabled: true });
  for (const p of lobby.players) lobby = applyAction(lobby, p.id, { type: 'ready' });
  lobby.discoveryEnabled = true;
  let game = initializeDiscoveryGameForAudit(lobby);
  const initialized = nativeTypedReload(game);
  assert.equal(game.deck.length, 47);
  assert.equal(game.spiceDeck.length, spiceDeck(true).length + DISCOVERY_SPICE_CARDS.length + 1);
  assert.equal(game.spiceDeck.filter(c => 'sandtrout' in c && c.sandtrout).length, 1);
  assert.equal(game.discoveries!.tokens.length, 8);
  for (let step = 0; step < 250 && game.status === 'setup'; step++) game = nativeTypedStep(game);
  assert.equal(game.status, 'playing');
  assert.equal(nativeTypedPlayer(game, 'i').forces[MOBILE_LOCATION], 6);
  assert.equal(nativeTypedPlayer(game, 'i').elites!.forces[MOBILE_LOCATION], 3);
  assert.equal(nativeTypedPlayer(game, 't').faceDancers!.length, 3);
  // Conserved unplayed deck order keeps the first two turns free of unrelated worms/Discoveries.
  const blows = game.spiceDeck.filter(c => 'territory' in c && !c.discovery);
  assert.ok(blows.length >= 4);
  for (const [position, card] of blows.slice(0, 4).entries()) {
    const index = game.spiceDeck.indexOf(card);
    game.spiceDeck.splice(position, 0, game.spiceDeck.splice(index, 1)[0]);
  }
  nativeTypedCustody(game);
  return { lobby, initialized, game };
}
/** Original setup/phase controls, then explicitly labelled supply-token placement
 * and reserve-counter position. Collection inspect/reveal is always the real engine producer. */
export function nativeTypedCollection(face: DiscoveryTokenFace = 'shrine', owner = 'i',
  options: NativeTypedOptions = {}) {
  const setup = nativeTypedSetup(options);
  let game = nativeTypedPhase(setup.game, 5);
  nativeTypedClearBoard(game);
  const token = putDiscovery(game, face);
  const source = `${token.territory}:${token.sector}`;
  assert.notEqual(token.sector, game.storm);
  nativeTypedPlace(game, owner, source, 2, owner === 'i' || (owner === 'f' && game.advanced) ? 1 : 0);
  game = nativeTypedPhase(game, 7);
  if (viewGame(game, owner).discoveries!.canInspect.includes(token.id))
    game = applyAction(game, owner, { type: 'discovery', token: token.id, reveal: false });
  assert.ok(viewGame(game, owner).discoveries!.canReveal.includes(token.id));
  nativeTypedCustody(game);
  return { ...setup, game, token: token.id, source, parent: token.territory!, owner };
}
export function nativeTypedReveal(state: NativeTypedRevealPosition): Game {
  return applyAction(state.game, state.owner, { type: 'discovery', token: state.token, reveal: true });
}
export function nativeTypedEntry(options: NativeTypedOptions = {}, owner = 'i') {
  const position = nativeTypedCollection('shrine', owner, options);
  let game = nativeTypedReveal(position);
  game = nativeTypedPhase(game, 8);
  for (let step = 0; step < 100 && game.decision?.kind !== 'discoveryEntry'; step++) game = nativeTypedStep(game);
  assert.equal(game.turn, 2);
  assert.equal(game.phase, 0);
  assert.equal(game.decision?.kind, 'discoveryEntry');
  assert.equal(game.decision?.player, owner);
  nativeTypedCustody(game);
  return { ...position, game };
}
export function nativeTypedCard(game: Game, id: string, predicate: (card: Card) => boolean): Card {
  const index = game.deck.findIndex(predicate);
  assert.ok(index >= 0);
  const card = game.deck.splice(index, 1)[0];
  nativeTypedPlayer(game, id).hand.push(card);
  return card;
}
/** Exchange a genuine private Traitor identity with one genuine native Face Dancer. */
export function nativeTypedMatchDancer(game: Game, leader: string): void {
  const dancers = nativeTypedPlayer(game, 't').faceDancers!;
  if (dancers.some(c => c.leader === leader && !c.revealed)) return;
  const dancer = dancers.find(c => !c.revealed)!;
  assert.ok(dancer);
  const reserve = game.traitorReserve!.indexOf(leader);
  if (reserve >= 0) game.traitorReserve![reserve] = dancer.leader;
  else {
    const holder = game.players.find(p => p.traitors.includes(leader));
    assert.ok(holder);
    holder.traitors[holder.traitors.indexOf(leader)] = dancer.leader;
  }
  dancer.leader = leader;
}
/** Native nested-location battle. Winner cleanup and original Tech rewards are
 * executed before the original Face Dance choice; no reward/receipt is staged. */
export function nativeTypedFaceDance(advanced = false, tech = false) {
  const entry = nativeTypedEntry({ advanced, tech });
  assert.ok(entry.game.decision?.kind === 'discoveryEntry');
  let game = applyAction(entry.game, 'i', { type: 'decision', accept: false, event: entry.game.decision!.event });
  game = nativeTypedPhase(game, 5);
  nativeTypedClearBoard(game);
  for (const p of game.players) { game.deck.push(...p.hand); p.hand = []; }
  nativeTypedPlace(game, 'g', 'shrine:0', 8);
  nativeTypedPlace(game, 't', 'shrine:0', 8);
  nativeTypedPlace(game, 't', entry.source, 3);
  // A second conserved conflict keeps Battle open after this reward/Face Dance.
  const other = gameTerritories(game).find(t => t.type === 'sand' &&
    t.id !== splitLocation(entry.source).territory && !t.sectors.includes(game.storm));
  assert.ok(other);
  for (const id of ['g', 't']) nativeTypedPlace(game, id, `${other.id}:${other.sectors[0]}`, 1);
  const winnerLeader = nativeTypedPlayer(game, 'g').leaders.filter(l => !l.dead).sort((a, b) => b.strength - a.strength)[0];
  const loserLeader = nativeTypedPlayer(game, 't').leaders.filter(l => !l.dead).sort((a, b) => a.strength - b.strength)[0];
  nativeTypedMatchDancer(game, winnerLeader.id);
  const weapon = nativeTypedCard(game, 'g', c => c.kind === 'projectile');
  const defense = nativeTypedCard(game, 'g', c => c.kind === 'shield');
  const loserCard = nativeTypedCard(game, 't', c => c.kind === 'worthless');
  game = nativeTypedPhase(game, 6);
  game = openSkillsTechBattle(game, 'g', 't', 'shrine');
  const beforePlans = nativeTypedReload(game);
  game = applyAction(game, 'g', { type: 'battlePlan', leader: winnerLeader.id, dial: 0, support: 0,
    weapon: weapon.id, defense: defense.id });
  game = applyAction(game, 't', { type: 'battlePlan', leader: loserLeader.id, dial: 0, support: 0, weapon: loserCard.id });
  let cleanup: Game | undefined;
  for (let step = 0; step < 200 && game.decision?.kind !== 'faceDance'; step++) {
    if (game.decision?.kind === 'battleCards') {
      cleanup = nativeTypedReload(game);
      game = applyAction(game, 'g', { type: 'decision', discard: [defense.id] });
    } else game = nativeTypedStep(game);
  }
  assert.ok(cleanup);
  assert.equal(game.decision?.kind, 'faceDance');
  assert.equal(game.decision?.territory, 'shrine');
  assert.equal(game.decision?.player, 't');
  nativeTypedCustody(game);
  return { game, beforePlans, cleanup, winnerLeader: winnerLeader.id, loserLeader: loserLeader.id,
    weapon, defense, loserCard, source: entry.source, action: {
      type: 'decision', reveal: true, sources: { reserves: 1, [entry.source]: 2 }, sector: 0,
    } as Action };
}
export function nativeTypedMovementTurn(state: Game, owner: string): Game {
  let game = state;
  for (let step = 0; step < 100 && (game.active !== owner || game.decision || game.response || game.phaseOpening); step++) {
    assert.equal(game.phase, 5);
    game = nativeTypedStep(game);
  }
  assert.equal(game.active, owner);
  assert.equal(game.phase, 5);
  return game;
}
export { MOBILE_LOCATION, MOBILE_STRONGHOLD };
