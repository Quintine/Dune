import assert from 'node:assert/strict';
import {
  applyAction, createGame, initializeNexusGameForAudit, joinGame, newPlayer, viewGame,
  type Game,
} from '../game/engine';
import { location, territory } from '../game/board';
import { emperorNexusEvent } from '../game/nexus-emperor-secret-ally';
import { withClassicDiscoveryNexusLottery } from './fixture-discovery-classic-nexus';
import { frontNativeHomeworldSpice } from './fixture-homeworld-native-e1e2-modules';
import {
  createSingleNexusE1Setup, nextSingleNexusE1Step,
  openSingleNexusE1Battle, revealSingleNexusE1Plans, shipSingleNexusE1,
  singleNexusE1Clean, singleNexusE1Inventory, singleNexusE1Player,
  type SingleNexusE1Step,
} from './fixture-single-nexus-e1';
import { nexusTleilaxuSecretAllyInventory } from './fixture-nexus-tleilaxu-secret-ally';

export type NexusEmperorExtraOptions = {
  advanced?: boolean;
  profile?: NexusEmperorExtraProfile;
  tech?: boolean;
  homeworlds?: boolean;
};
export type NexusEmperorExtraProfile = 'classic' | 'tleilaxu' | 'ixians' | 'fremen';
export type NexusEmperorExtraFixture = {
  initial: Game;
  afterSetup: Game;
  beforeShipment: Game;
  afterShipment: Game;
  beforeBattle: Game;
  afterBattle: Game;
  beforeBlow: Game;
  beforeDraw: Game;
  afterDraw: Game;
  game: Game;
  owner: string;
  opponent: string;
  partner: string;
  profile: NexusEmperorExtraProfile;
  actions: SingleNexusE1Step[];
  event: string;
};
export const nexusEmperorExtraPlayer = singleNexusE1Player;
export const nexusEmperorExtraClean = (game: Game): boolean =>
  singleNexusE1Clean(game) && !game.pendingRevival;
export function nexusEmperorExtraInventory(game: Game): void {
  if (game.expansions.length) singleNexusE1Inventory(game);
  else nexusTleilaxuSecretAllyInventory(game);
}
export function stepNexusEmperorExtra(
  game: Game, step: SingleNexusE1Step, actions?: SingleNexusE1Step[],
): Game {
  actions?.push(structuredClone(step));
  return withClassicDiscoveryNexusLottery(() => applyAction(game, step.actor, step.action));
}
/** A live native stop is never decided by the producer: callers choose Allow or Prevent. */
export function advanceNexusEmperorExtra(
  game: Game, until: (game: Game) => boolean, actions?: SingleNexusE1Step[],
): Game {
  for (let count = 0; count < 2000; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished');
    assert.notEqual(game.decision?.kind, 'revivalStop', 'Choose the real Tleilaxu Allow/Prevent control');
    const next = game.turn === 1 && game.phase === 5 && game.decision?.kind === 'guildTiming' &&
      game.homeworlds && game.players.some(p => p.faction === 'fremen')
      ? { actor: game.decision.player, action: { type: 'decision', take: true } }
      : nextSingleNexusE1Step(game);
    assert.ok(next, `Original Emperor chronology stops at ${game.turn}/${game.phase}/${game.decision?.kind ?? 'plan'}`);
    game = stepNexusEmperorExtra(game, next, actions);
  }
  throw Error('Original Emperor chronology did not reach its boundary');
}
export function settleNexusEmperorExtra(game: Game): Game {
  return advanceNexusEmperorExtra(game, nexusEmperorExtraClean);
}
function classicSetup(advanced: boolean, options: NexusEmperorExtraOptions) {
  let game = createGame('NEXUSEMPEROREXTRA', newPlayer('atreides', 'Atreides', 'atreides'), advanced);
  joinGame(game, newPlayer('guild', 'Guild', 'guild'));
  joinGame(game, newPlayer('harkonnen', 'Harkonnen', 'harkonnen'));
  game.nexusCards = { cards: null, phase: null };
  const actions: SingleNexusE1Step[] = [];
  for (const [type, enabled] of [['homeworlds', options.homeworlds], ['techTokens', options.tech]] as const)
    if (enabled) game = stepNexusEmperorExtra(game,
      { actor: game.host, action: { type, enabled: true } }, actions);
  const initial = structuredClone(game);
  for (const player of game.players)
    game = stepNexusEmperorExtra(game, { actor: player.id, action: { type: 'ready' } }, actions);
  game = withClassicDiscoveryNexusLottery(() => initializeNexusGameForAudit(game));
  game = advanceNexusEmperorExtra(game, state => state.status === 'playing', actions);
  return { initial, afterSetup: game, actions };
}

/** Original Basic/Advanced setup and deals, paid shipment/battle casualties,
 * turn-two Shai-Hulud/alliance/closing draw, and quiet native Revival. Only
 * original undealt singleton order and scoped scalar lottery are controlled.
 * No hand, army, Tanks, wallet, alliance, phase, skill or history is rewritten. */
export function createNexusEmperorExtraFixture(
  options: NexusEmperorExtraOptions = {},
): NexusEmperorExtraFixture {
  const advanced = options.advanced ?? true, profile = options.profile ?? 'classic';
  assert.ok(profile !== 'fremen' || options.homeworlds,
    'The Fedaykin source uses original Homeworld setup and physical starred reserves.');
  const source = profile === 'classic' ? classicSetup(advanced, options) : createSingleNexusE1Setup({
    native: profile === 'fremen' ? 'tleilaxu' : profile, advanced,
    roster: profile === 'fremen' ? ['tleilaxu', 'guild', 'fremen'] : [profile, 'guild', 'atreides'],
    skills: false, homeworlds: options.homeworlds ?? false, discovery: false, tech: options.tech ?? false, strongholds: false,
    startingKinds: ['worthless', 'worthless', 'worthless'],
    startingEffects: [profile === 'tleilaxu' || profile === 'fremen' ? 'karama' : undefined],
  });
  const { initial, afterSetup } = source, actions = [...source.actions];
  let game = structuredClone(afterSetup);
  const owner = profile === 'ixians' ? 'ixians' : profile === 'fremen' ? 'fremen' : 'atreides';
  const opponent = profile === 'ixians' ? 'atreides' : 'guild';
  const partner = game.players.find(player => player.id !== owner && player.id !== opponent)!.id;
  assert.ok(!game.players.some(player => player.faction === 'emperor'));
  assert.ok(game.players.every(player => player.hand.length > 0 && player.tanks === 0));
  // Printed land blows keep the first full turn free of an earlier Nexus draw.
  frontNativeHomeworldSpice(game, card => 'territory' in card && card.territory === 'hagga_basin', 0);
  if (advanced)
    frontNativeHomeworldSpice(game, card => 'territory' in card && card.territory === 'broken_land', 1);
  const destination = profile === 'fremen' ? 'sietch_tabr' : 'arrakeen';
  const shipper = profile === 'ixians' ? owner : opponent;
  game = advanceNexusEmperorExtra(game,
    state => state.turn === 1 && state.phase === 5 && state.active === shipper && nexusEmperorExtraClean(state), actions);
  const beforeShipment = structuredClone(game);
  const arrival = shipSingleNexusE1(game, shipper, destination, profile === 'ixians' ? 8 : 1,
    profile === 'ixians' ? 3 : 0, actions);
  game = arrival.after;
  if (profile === 'fremen') {
    game = advanceNexusEmperorExtra(game,
      state => state.phase === 5 && state.active === owner && nexusEmperorExtraClean(state), actions);
    game = shipSingleNexusE1(game, owner, destination, 6, 1, actions).after;
  }
  const afterShipment = structuredClone(game);
  assert.ok(nexusEmperorExtraPlayer(game, shipper).spice < nexusEmperorExtraPlayer(beforeShipment, shipper).spice);
  const target = location(destination, territory(destination).sectors[0]);
  if (profile !== 'fremen') assert.equal(nexusEmperorExtraPlayer(game, 'atreides').forces[target], 10);
  game = openSingleNexusE1Battle(game, owner, opponent, destination, actions);
  const beforeBattle = structuredClone(game);
  const ownLeader = nexusEmperorExtraPlayer(game, owner).leaders.filter(leader => !leader.dead)
    .sort((a, b) => profile === 'ixians' ? a.strength - b.strength : b.strength - a.strength)[0];
  const otherLeader = nexusEmperorExtraPlayer(game, opponent).leaders.filter(leader => !leader.dead)
    .sort((a, b) => profile === 'ixians' ? b.strength - a.strength : a.strength - b.strength)[0];
  assert.ok(ownLeader && otherLeader);
  game = revealSingleNexusE1Plans(game, [
    { actor: owner, action: { type: 'battlePlan',
      dial: profile === 'ixians' ? 0 : profile === 'fremen' ? advanced ? 6 : 5 : 8,
      support: advanced && profile !== 'ixians' && profile !== 'fremen' ? 8 : 0,
      leader: ownLeader.id, weapon: null, defense: null } },
    { actor: opponent, action: { type: 'battlePlan', dial: 0, support: 0,
      leader: otherLeader.id, weapon: null, defense: null } },
  ], actions);
  for (let count = 0; game.battle || !nexusEmperorExtraClean(game); count++) {
    assert.ok(count < 600);
    let next = nextSingleNexusE1Step(game);
    if (!next) {
      const decision = game.decision;
      assert.ok(decision);
      let action: Parameters<typeof applyAction>[2];
      if (decision.kind === 'ixSubstitution') action = { type: 'decision', decline: true };
      else if (decision.kind === 'faceDance') action = { type: 'decision', reveal: false };
      else if (decision.kind === 'battleCards') action = { type: 'decision', discard: [] };
      else if (decision.kind === 'techToken') action = { type: 'decision', token: decision.choices[0] };
      else throw Error(`Consume the real ${decision.kind} before continuing`);
      next = { actor: decision.player, action };
    }
    game = stepNexusEmperorExtra(game, next, actions);
  }
  const afterBattle = structuredClone(game);
  assert.equal(nexusEmperorExtraPlayer(game, owner).tanks, profile === 'fremen' ? 5 : 8);
  if (profile === 'ixians') assert.equal(nexusEmperorExtraPlayer(game, owner).elites!.tanks, 3);
  if (profile === 'fremen') assert.equal(nexusEmperorExtraPlayer(game, owner).elites!.tanks, 1);
  nexusEmperorExtraInventory(game);
  game = advanceNexusEmperorExtra(game, state => state.turn === 2 && state.phase === 1 &&
    nexusEmperorExtraClean(state) && !state.spiceSequence && !state.spiceResolution && !state.spiceWindow &&
    !state.nexus && state.ready.length === 0, actions);
  const beforeBlow = structuredClone(game);
  frontNativeHomeworldSpice(game, card => 'worm' in card && !card.greatMaker && !card.suppressed && !card.thumper, 0);
  frontNativeHomeworldSpice(game, card => 'territory' in card && card.territory === 'rock_outcroppings', 1);
  if (advanced)
    frontNativeHomeworldSpice(game, card => 'territory' in card && card.territory === 'oh_gap', 2);
  game = advanceNexusEmperorExtra(game, state => !!state.nexus && !state.spiceWindow &&
    !state.spiceResolution && nexusEmperorExtraClean(state), actions);
  for (const [actor, ally] of [[opponent, partner], [partner, opponent]])
    game = stepNexusEmperorExtra(game, { actor, action: { type: 'alliance', target: ally } }, actions);
  game = advanceNexusEmperorExtra(game, state => state.nexusCards?.phase?.stage === 'drawing' &&
    nexusEmperorExtraClean(state), actions);
  assert.deepEqual(game.nexusCards!.phase!.eligible, [owner]);
  const cards = game.nexusCards!.cards!, index = cards.deck.indexOf('emperor');
  assert.ok(index >= 0);
  cards.deck.unshift(cards.deck.splice(index, 1)[0]);
  const beforeDraw = structuredClone(game);
  game = stepNexusEmperorExtra(game, { actor: owner, action: { type: 'nexusCardChoice',
    turn: game.turn, card: cards.hands[owner], choice: 'draw', ownRedraws: 0 } }, actions);
  const afterDraw = structuredClone(game);
  game = advanceNexusEmperorExtra(game, state => state.turn === 2 && state.phase === 4 &&
    nexusEmperorExtraClean(state), actions);
  assert.equal(game.nexusCards!.cards!.hands[owner], 'emperor');
  assert.equal(nexusEmperorExtraPlayer(game, owner).ally, null);
  assert.equal(nexusEmperorExtraPlayer(game, owner).tanks, profile === 'fremen' ? 5 : 8);
  assert.ok(viewGame(game, owner).nexusEmperorSecretAlly);
  const event = emperorNexusEvent(game.turn, game.phase, owner, game.nexusEmperorSecretHistory?.length ?? 0);
  nexusEmperorExtraInventory(game);
  return { initial, afterSetup, beforeShipment, afterShipment, beforeBattle, afterBattle,
    beforeBlow, beforeDraw, afterDraw, game, owner, opponent, partner, profile, actions, event };
}
