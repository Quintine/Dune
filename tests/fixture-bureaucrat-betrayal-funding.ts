import assert from 'node:assert/strict';
import {
  applyAction, createGame, initializeGuildBetrayalLeaderSkillsGameForAudit, joinGame,
  newPlayer, viewGame, type Action, type Game,
} from '../game/engine';
import type { FactionId } from '../game/catalog';
import { LEADER_SKILL_CARDS, type LeaderSkillId } from '../game/leader-skill-cards';
import { validateLeaderSkills } from '../game/leader-skills';
import { createGuildBetrayalFixture, type GuildBetrayalFixture } from './fixture-nexus-guild-betrayal';

export const betrayalFundingSeat = (game: Game, id: string) => game.players.find(p => p.id === id)!;

/** Scope exactly the thirteen Fisher–Yates draws of the original all14 deck;
 * all later setup entropy remains native. No assignment or offer is replaced. */
function skillLottery<T>(selected: LeaderSkillId[], operation: () => T): T {
  const working: LeaderSkillId[] = LEADER_SKILL_CARDS.map(card => card.id);
  const remainder = working.filter(skill => !selected.includes(skill));
  const desired = [...selected.flatMap(skill => [skill, remainder.shift()!]), ...remainder];
  const rolls: number[] = [];
  for (let i = working.length - 1; i > 0; i--) {
    const j = working.indexOf(desired[i]);
    assert.ok(j >= 0 && j <= i);
    rolls.push(Math.floor((j + 0.5) * 0x100000000 / (i + 1)));
    [working[i], working[j]] = [working[j], working[i]];
  }
  const descriptor = Object.getOwnPropertyDescriptor(crypto, 'getRandomValues');
  const native = crypto.getRandomValues.bind(crypto);
  let cursor = 0;
  crypto.getRandomValues = <V extends ArrayBufferView | null>(array: V): V => {
    if (array instanceof Uint32Array && array.length === 1 && cursor < rolls.length)
      array[0] = rolls[cursor++];
    else Reflect.apply(native, crypto, [array]);
    return array;
  };
  try { const result = operation(); assert.equal(cursor, 13); return result; }
  finally {
    if (descriptor) Object.defineProperty(crypto, 'getRandomValues', descriptor);
    else Reflect.deleteProperty(crypto, 'getRandomValues');
  }
}

function trainedSetup(advanced: boolean, allied: boolean): { initial: Game; trained: Game; trainer: string } {
  const roster: [string, FactionId, LeaderSkillId][] = [
    ['holder', 'atreides', 'warmaster'], ['guild', 'guild', 'killer-medic'],
    ['shipper', 'emperor', 'master-of-assassins'],
    ...(allied ? [['donor', 'harkonnen', 'swordmaster-of-ginaz'] as [string, FactionId, LeaderSkillId]] : []),
    ['trainer', 'beneGesserit', 'bureaucrat'],
  ];
  let game = createGame('BUREAUCRATBETRAYAL', newPlayer(roster[0][0], roster[0][0], roster[0][1]), advanced, []);
  for (const [id, faction] of roster.slice(1)) joinGame(game, newPlayer(id, id, faction));
  for (const player of game.players) game = applyAction(game, player.id, { type: 'ready' });
  game = skillLottery(roster.map(([, , skill]) => skill), () => initializeGuildBetrayalLeaderSkillsGameForAudit(game));
  const initial = structuredClone(game);
  assert.equal(game.status, 'setup');
  if (game.setupStage === 'prediction')
    game = applyAction(game, 'trainer', { type: 'predict', faction: 'emperor', turn: 4 });
  assert.equal(game.setupStage, 'leaderSkills');
  while (game.setupStage === 'leaderSkills') {
    const actor = Object.keys(game.leaderSkills!.offers)[0];
    const offer = viewGame(game, actor).leaderSkills!;
    const skill = roster.find(([id]) => id === actor)![2];
    assert.ok(offer.offer!.cards.includes(skill) && !offer.unavailableSkills?.[skill]);
    const leader = offer.eligibleLeaders[0];
    assert.ok(leader);
    game = applyAction(game, actor, { type: 'leaderSkill', event: offer.offer!.event, skill, leader: leader.id });
  }
  assert.equal(game.status, 'setup', 'The shared fixture owns the remaining native setup.');
  validateLeaderSkills(game.leaderSkills!, game.players);
  assert.equal(game.leaderSkills!.assignments.find(a => a.skill === 'bureaucrat')?.owner, 'trainer');
  return { initial, trained: game, trainer: 'trainer' };
}

/** Finish only real native acknowledgements/income, declining optional ordinary
 * Bureaucrat income for the all-pass physical-shipment comparison. */
export function settleBetrayalFunding(state: Game): Game {
  let game = state;
  for (let n = 0; n < 100; n++) {
    if (game.pendingGuildBetrayal) {
      const frame = game.pendingGuildBetrayal;
      const actor = frame.required.find(id => !frame.passed.includes(id))!;
      game = applyAction(game, actor, { type: 'guildBetrayalPass', event: frame.invoice.event });
    } else if (game.decision?.kind === 'bureaucratPayment') {
      game = chooseBetrayalFunding(game, false);
    } else if (game.decision?.kind === 'guildShipment') {
      game = applyAction(game, game.decision.player, { type: 'decision', allow: true });
    } else if (game.decision?.kind === 'advisor') {
      game = applyAction(game, game.decision.player, { type: 'decision', accept: false });
    } else if (game.response) {
      const actor = game.players.find(p => !game.response!.passed.includes(p.id))!.id;
      game = applyAction(game, actor, { type: 'passResponse' });
    } else return game;
  }
  throw Error('The original Betrayal shipment continuation did not settle.');
}

export function chooseBetrayalFunding(game: Game, redirect: boolean): Game {
  assert.equal(game.decision?.kind, 'bureaucratPayment');
  return applyAction(game, game.decision!.player, { type: 'decision', event: game.bureaucratPaymentEvent, redirect });
}

export interface BureaucratBetrayalFundingFixture extends GuildBetrayalFixture {
  initial: Game;
  trained: Game;
  trainer: string;
  beforePledge: Game;
  primary: number;
  donorAmount: number;
}

/** Reuse the shared native fixture's conserved card custody and original setup,
 * then declare the requested larger shipment from its pre-declaration boundary.
 * The provisional two-force branch is never replayed into this branch. Wallets,
 * forces, signed invoices, escrow and usage ledgers are not assigned here. */
export function createBureaucratBetrayalFundingFixture({
  advanced = false, primary = 5, donorAmount = 0, own = false, alreadyUsed = false,
}: { advanced?: boolean; primary?: number; donorAmount?: number; own?: boolean; alreadyUsed?: boolean } = {}): BureaucratBetrayalFundingFixture {
  const setup = trainedSetup(advanced, donorAmount > 0);
  const base = createGuildBetrayalFixture({ initial: setup.trained, advanced,
    payer: own ? 'holder' : 'other', allyPayment: donorAmount > 0 ? 1 : 0 });
  let game = structuredClone(base.before);
  if (base.donor) game = applyAction(game, base.donor, { type: 'pledgeAid', amount: 0 });
  if (alreadyUsed) {
    assert.ok(betrayalFundingSeat(game, base.shipper).spice >= primary + 5);
    game = applyAction(game, base.shipper, { type: 'bribe', target: base.guild, amount: 5 });
    game = chooseBetrayalFunding(game, true);
    assert.equal(viewGame(game, setup.trainer).bureaucrat.usedThisPhase, true);
  }
  const beforePledge = structuredClone(game);
  if (base.donor) game = applyAction(game, base.donor, { type: 'pledgeAid', amount: donorAmount });
  assert.ok(betrayalFundingSeat(game, base.shipper).spice >= primary, 'The original wallet must fund its real invoice leg.');
  const before = structuredClone(game);
  const declaration: Action = { ...base.declaration, amount: primary + donorAmount, allyPayment: donorAmount };
  game = applyAction(game, base.shipper, declaration);
  if (game.decision?.kind === 'guildShipment')
    game = applyAction(game, game.decision.player, { type: 'decision', allow: true });
  assert.ok(game.pendingGuildBetrayal, 'A real accepted paid shipment creates the invoice.');
  const invoice = game.pendingGuildBetrayal.invoice;
  assert.equal(invoice.price, primary + donorAmount);
  assert.equal(invoice.ownPayment, primary);
  assert.equal(invoice.allyPayment, donorAmount);
  return { ...base, ...setup, beforePledge, primary, donorAmount, game, before, declaration,
    event: invoice.event, price: invoice.price, original: settleBetrayalFunding(game) };
}

export function useBetrayalFunding(fixture: BureaucratBetrayalFundingFixture): Game {
  return applyAction(fixture.game, fixture.holder, { type: 'guildBetrayalUse', event: fixture.event });
}
