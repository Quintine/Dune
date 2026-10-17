import assert from 'node:assert/strict';
import {
  applyAction, createGame, handLimit, joinGame, newPlayer, viewGame,
  type Action, type Game, type Player,
} from '../game/engine';
import { treacheryDeck, type Card } from '../game/cards';
import { ecazTreacheryCards } from '../game/ecaz-cards';
import { LEADER_SKILL_CARDS, type LeaderSkillId } from '../game/leader-skill-cards';
import { validateLeaderSkills } from '../game/leader-skills';
import { traitorDeck } from '../game/traitors';
import { HARASS_WITHDRAW_CARD, type HarassWithdrawSelection } from '../game/harass-withdraw';
import { REINFORCEMENTS_CARD } from '../game/reinforcements';
import { RECRUITS_CARD_ID } from '../game/recruits';
import { forceRevivalQuote } from '../game/revival';
import { botActions } from '../game/bots';
import type { Difficulty } from '../game/bot-profiles';
import { nextStrongholdFactionsNativeStep } from './fixture-stronghold-factions';
import { quoteIndependentSkillsBattle } from './fixture-independent-skills-battle';

export type IxIndependentSkillsStep = { actor: string; action: Action };
export type IxIndependentSkillsOptions = { advanced?: boolean; tech?: boolean; strongholds?: boolean };
export const ixIndependentSkillsPlayer = (game: Game, actor: string): Player => {
  const player = game.players.find(p => p.id === actor); assert.ok(player); return player;
};
export const ixIndependentSkillsClean = (game: Game) =>
  !game.response && !game.phaseOpening && !game.decision && !game.pendingTreacheryDiscard;

/** Scoped real shuffle entropy, restored even when a native action rejects. */
function entropy<T>(run: () => T, rolls: readonly number[] = []): T {
  const descriptor = Object.getOwnPropertyDescriptor(crypto, 'getRandomValues');
  const native = crypto.getRandomValues.bind(crypto); let cursor = 0;
  crypto.getRandomValues = <V extends ArrayBufferView | null>(array: V): V => {
    if (array instanceof Uint32Array) {
      for (let i = 0; i < array.length; i++) array[i] = rolls[cursor++] ?? 0xffffffff;
    } else Reflect.apply(native, crypto, [array]);
    return array;
  };
  try { return run(); }
  finally {
    if (descriptor) Object.defineProperty(crypto, 'getRandomValues', descriptor);
    else Reflect.deleteProperty(crypto, 'getRandomValues');
  }
}
function skillRolls(): number[] {
  const source = LEADER_SKILL_CARDS.map(c => c.id);
  const chosen: LeaderSkillId[] = ['suk-graduate', 'killer-medic', 'master-of-assassins'];
  const rest = source.filter(c => !chosen.includes(c));
  const desired = chosen.flatMap(c => [c, rest.shift()!]).concat(rest);
  const work = [...source], rolls: number[] = [];
  for (let i = work.length - 1; i > 0; i--) {
    const from = work.indexOf(desired[i]); assert.ok(from >= 0 && from <= i);
    rolls.push(Math.floor((from + 0.5) * 0x100000000 / (i + 1)));
    [work[i], work[from]] = [work[from], work[i]];
  }
  return rolls;
}
export function stepIxIndependentSkills(game: Game, step: IxIndependentSkillsStep): Game {
  return entropy(() => applyAction(game, step.actor, step.action));
}
/** Original private projection and real policy; never alter the human lobby seat. */
export function ixIndependentSkillsPolicyActions(game: Game, actor: string, difficulty: Difficulty): Action[] {
  const view = viewGame(game, actor);
  view.players.find(p => p.id === actor)!.bot = difficulty;
  return entropy(() => botActions(view));
}
/** Stop at allocations and rescue: these remain actual projected human controls. */
export function nextIxIndependentSkillsStep(game: Game): IxIndependentSkillsStep | null {
  if (!game.phaseOpening && !game.response) {
    const d = game.decision;
    if (d?.kind === 'techToken') return { actor: d.player,
      action: { type: 'decision', token: d.choices[0] } };
    if (d?.kind === 'leaderSkillVisibility') return { actor: d.player,
      action: { type: 'leaderSkillVisibility', event: d.event, hide: d.player === 'ixians' } };
    if (d?.kind === 'guildTiming') return { actor: d.player, action: { type: 'decision', take: false } };
    if (d?.kind === 'faceDance') return { actor: d.player, action: { type: 'decision', reveal: false } };
    if (d?.kind === 'mentatQuestion') return { actor: d.player,
      action: { type: 'decision', event: d.event, decline: true } };
    if (d?.kind === 'rihani') return { actor: d.player,
      action: { type: 'decision', event: d.event, draw: false } };
    if (d?.kind === 'sukRescue' || d?.kind === 'harassWithdraw') return null;
  }
  return nextStrongholdFactionsNativeStep(game);
}
export function advanceIxIndependentSkills(state: Game, until: (game: Game) => boolean,
  actions: IxIndependentSkillsStep[] = []): Game {
  let game = structuredClone(state);
  for (let i = 0; i < 1600; i++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished');
    const step = nextIxIndependentSkillsStep(game); assert.ok(step, 'Supply the original private plan, typed return or rescue');
    actions.push(structuredClone(step)); game = stepIxIndependentSkills(game, step);
  }
  throw Error('Native independent programme did not reach its requested boundary');
}
/** Only physical card custody is staged; no stock, forces, wallets or receipts. */
function conserveCard(game: Game, actor: string, id: string, staging: string[]): Card {
  const p = ixIndependentSkillsPlayer(game, actor), held = p.hand.find(c => c.id === id);
  if (held) return held;
  const zones = [{ label: 'remaining original deck', cards: game.deck },
    { label: 'original discard', cards: game.discard },
    ...game.players.filter(other => other.id !== actor).map(other => ({ label: other.id, cards: other.hand }))];
  const source = zones.find(zone => zone.cards.some(c => c.id === id)); assert.ok(source);
  if (p.hand.length >= handLimit(p)) {
    const returned = p.hand.shift()!; game.deck.push(returned);
    staging.push(`Conserved ${returned.id}: ${actor} hand → original remaining deck for printed hand capacity`);
  }
  const card = source.cards.splice(source.cards.findIndex(c => c.id === id), 1)[0];
  p.hand.push(card); staging.push(`Conserved ${id}: ${source.label} → ${actor} hand; not a purchase or native deal`);
  return card;
}
export function assertIxIndependentSkillsCustody(game: Game): void {
  validateLeaderSkills(game.leaderSkills!, game.players);
  const cards = [...game.deck, ...game.discard, ...game.players.flatMap(p => p.hand),
    ...(game.ixSetupCards ?? []), ...(game.ixAuction?.cards ?? []),
    ...(game.auction?.cards.slice(game.auction.index) ?? [])];
  assert.deepEqual(cards.map(c => c.id).sort(),
    [...treacheryDeck(['ix']), ...ecazTreacheryCards()].map(c => c.id).sort());
  for (const p of game.players) {
    assert.equal(p.reserves + p.tanks + Object.values(p.forces).reduce((a, b) => a + b, 0), 20);
    assert.ok([p.reserves, p.tanks, ...Object.values(p.forces)].every(n => Number.isSafeInteger(n) && n >= 0));
    assert.ok(p.hand.length <= handLimit(p));
    if (p.elites) {
      assert.equal(p.elites.reserves + p.elites.tanks + Object.values(p.elites.forces).reduce((a, b) => a + b, 0), 7);
      assert.ok([p.elites.reserves, p.elites.tanks, ...Object.values(p.elites.forces)]
        .every(n => Number.isSafeInteger(n) && n >= 0));
      assert.ok(p.elites.reserves <= p.reserves && p.elites.tanks <= p.tanks);
      for (const [key, count] of Object.entries(p.elites.forces)) assert.ok(count <= (p.forces[key] ?? 0));
    }
  }
  if (game.status === 'playing') assert.deepEqual([
    ...(game.traitorReserve ?? []), ...game.players.flatMap(p => p.traitors),
    ...game.players.flatMap(p => (p.faceDancers ?? []).map(c => c.leader)),
  ].sort(), traitorDeck(game.players, true).sort());
}
export type IxIndependentSkillsFixture = {
  initial: Game; beforeIxCard: Game; ixCard: IxIndependentSkillsStep; offered: Game; afterSetup: Game;
  beforeShipment: Game; shipment: IxIndependentSkillsStep; afterShipment: Game;
  move: IxIndependentSkillsStep; afterMove: Game; opponentMove: IxIndependentSkillsStep;
  beforeBattle: Game; battleStep: IxIndependentSkillsStep;
  /** Original before-plan window, not a synthetic revealed Battle. */
  game: Game; plans: IxIndependentSkillsStep[]; returns: HarassWithdrawSelection;
  ixians: string; tleilaxu: string; opponent: string; trainer: string;
  first: string; second: string; actions: IxIndependentSkillsStep[]; staging: string[];
};

/** Normal fresh lobby start → original Ix card-before-training → native armies →
 * real desert shipment and split movement. Only the two singleton cards move zones. */
export function createIxIndependentSkillsFixture(options: IxIndependentSkillsOptions = {}): IxIndependentSkillsFixture {
  const advanced = options.advanced ?? false;
  let game = createGame('IXINDEPENDENTSKILLS', newPlayer('ixians', 'Ixians', 'ixians'), advanced, ['ix']);
  joinGame(game, newPlayer('tleilaxu', 'Tleilaxu', 'tleilaxu'));
  joinGame(game, newPlayer('guild', 'Guild', 'guild'));
  const initial = structuredClone(game), actions: IxIndependentSkillsStep[] = [], staging: string[] = [];
  const record = (step: IxIndependentSkillsStep): Game => {
    actions.push(structuredClone(step)); game = stepIxIndependentSkills(game, step);
    return game;
  };
  for (const [type, enabled] of [
    ['techTokens', options.tech ?? false], ['strongholdCards', options.strongholds ?? false],
  ] as const) if (enabled) record({ actor: game.host, action: { type, enabled } });
  for (const option of ['leaderSkills', 'ecazTreachery'] as const)
    record({ actor: game.host, action: { type: 'moduleOption', module: option, enabled: true } });
  for (const p of game.players) record({ actor: p.id, action: { type: 'ready' } });
  const start: IxIndependentSkillsStep = { actor: game.host,
    action: { type: 'start', ...(advanced ? { advancedPreview: true } : {}) } };
  actions.push(start); game = entropy(() => applyAction(game, start.actor, start.action), skillRolls());
  staging.push('Scoped/restored original all14 lottery and canonical native setup shuffle; no offer or deck replacement');
  assert.equal(game.setupStage, 'skillTreachery'); assert.equal(game.decision?.kind, 'ixSetup');
  const beforeIxCard = structuredClone(game);
  const ixCard: IxIndependentSkillsStep = { actor: 'ixians', action: { type: 'decision', card: game.ixSetupCards![0].id } };
  game = record(ixCard); const offered = structuredClone(game);
  const chosen: Record<string, LeaderSkillId> = { ixians: 'suk-graduate', tleilaxu: 'killer-medic', guild: 'master-of-assassins' };
  for (let i = 0; game.status === 'setup' && i < 120; i++) {
    if (game.setupStage === 'leaderSkills') {
      const actor = Object.keys(game.leaderSkills!.offers)[0], offer = game.leaderSkills!.offers[actor];
      assert.ok(offer.cards.includes(chosen[actor]));
      const view = viewGame(game, actor).leaderSkills!;
      const leader = ixIndependentSkillsPlayer(game, actor).leaders
        .filter(l => view.eligibleLeaders.some(e => e.id === l.id)).sort((a, b) => b.strength - a.strength)[0];
      assert.ok(leader); record({ actor, action: { type: 'leaderSkill', event: offer.event, skill: chosen[actor], leader: leader.id } });
    } else { const step = nextIxIndependentSkillsStep(game); assert.ok(step); record(step); }
  }
  assert.equal(game.status, 'playing'); const afterSetup = structuredClone(game);
  const trainer = game.leaderSkills!.assignments.find(a => a.owner === 'ixians')!.leader;
  game = advanceIxIndependentSkills(game, g => g.phase === 5 && g.active === 'ixians' && ixIndependentSkillsClean(g), actions);
  const beforeShipment = structuredClone(game), first = 'pasty_mesa:5', second = 'pasty_mesa:6';
  const shipment: IxIndependentSkillsStep = { actor: 'ixians', action: {
    type: 'ship', territory: 'pasty_mesa', sector: 5, amount: 4, elite: 2, allyPayment: 0 } };
  record(shipment);
  game = advanceIxIndependentSkills(game, g => g.phase === 5 && g.active === 'ixians' && ixIndependentSkillsClean(g) && !g.pendingShipment, actions);
  const afterShipment = structuredClone(game);
  const move: IxIndependentSkillsStep = { actor: 'ixians', action: {
    type: 'move', from: first, amount: 2, elite: 1, territory: 'pasty_mesa', sector: 6 } };
  record(move);
  game = advanceIxIndependentSkills(game, g => g.phase === 5 && g.active === 'ixians' && ixIndependentSkillsClean(g), actions);
  const afterMove = structuredClone(game); record({ actor: 'ixians', action: { type: 'endMovement' } });
  game = advanceIxIndependentSkills(game, g => g.phase === 5 && g.active === 'guild' && ixIndependentSkillsClean(g), actions);
  const opponentMove: IxIndependentSkillsStep = { actor: 'guild', action: {
    type: 'move', from: 'tueks_sietch:5', amount: 5, territory: 'pasty_mesa', sector: 6 } };
  record(opponentMove);
  game = advanceIxIndependentSkills(game, g => g.phase === 5 && g.active === 'guild' && ixIndependentSkillsClean(g), actions);
  record({ actor: 'guild', action: { type: 'endMovement' } });
  game = advanceIxIndependentSkills(game, g => g.phase === 6 && ixIndependentSkillsClean(g), actions);
  conserveCard(game, 'ixians', REINFORCEMENTS_CARD, staging);
  conserveCard(game, 'ixians', HARASS_WITHDRAW_CARD, staging);
  const beforeBattle = structuredClone(game);
  const choice = viewGame(game, game.active!).battleChoices.find(c => c.territory === 'pasty_mesa'); assert.ok(choice);
  const battleStep: IxIndependentSkillsStep = { actor: choice.chooser,
    action: { type: 'chooseBattle', territory: 'pasty_mesa', target: choice.defender } };
  record(battleStep);
  game = advanceIxIndependentSkills(game, g => !!g.battle && !g.battle.revealed && ixIndependentSkillsClean(g), actions);
  const enemy = ixIndependentSkillsPlayer(game, 'guild').leaders
    .filter(l => !l.dead && l.id !== game.leaderSkills!.assignments.find(a => a.owner === 'guild')!.leader)
    .sort((a, b) => a.strength - b.strength)[0]; assert.ok(enemy);
  const plans: IxIndependentSkillsStep[] = [
    { actor: 'ixians', action: { type: 'battlePlan', dial: advanced ? 1.5 : 2.5, support: 0,
      leader: trainer, weapon: REINFORCEMENTS_CARD, defense: HARASS_WITHDRAW_CARD } },
    { actor: 'guild', action: { type: 'battlePlan', dial: 0, support: 0, leader: enemy.id, weapon: null, defense: null } },
  ];
  const returns: HarassWithdrawSelection = { [first]: { normal: 1, elite: 0 }, [second]: { normal: 0, elite: 1 } };
  assertIxIndependentSkillsCustody(game);
  return { initial, beforeIxCard, ixCard, offered, afterSetup, beforeShipment, shipment, afterShipment,
    move, afterMove, opponentMove, beforeBattle, battleStep, game, plans, returns,
    ixians: 'ixians', tleilaxu: 'tleilaxu', opponent: 'guild', trainer, first, second, actions, staging };
}
export function revealIxIndependentSkillsBattle(f: IxIndependentSkillsFixture, state = f.game): Game {
  let game = structuredClone(state);
  for (const step of f.plans) game = stepIxIndependentSkills(game, step);
  assert.ok(game.battle?.revealed); return game;
}
export function quoteIxIndependentSkillsBattle(f: IxIndependentSkillsFixture, state = revealIxIndependentSkillsBattle(f)) {
  return quoteIndependentSkillsBattle(state, { returns: f.returns });
}
export function finishIxIndependentSkillsBattle(f: IxIndependentSkillsFixture,
  options: { state?: Game; rescue?: 'save' | 'none'; stop?: 'rescue' | 'collection' } = {}): Game {
  let game = structuredClone(options.state ?? revealIxIndependentSkillsBattle(f));
  for (let i = 0; i < 400; i++) {
    if (options.stop === 'rescue' && game.decision?.kind === 'sukRescue') return game;
    if (game.phase === 7 && ixIndependentSkillsClean(game)) return game;
    let step: IxIndependentSkillsStep | null;
    const d = game.decision;
    if (d?.kind === 'harassWithdraw') step = { actor: d.player,
      action: { type: 'decision', event: d.event, returns: f.returns } };
    else if (d?.kind === 'sukRescue') {
      const choice = options.rescue === 'none' ? d.options.findIndex(o => o.normal + o.elite === 0)
        : d.options.findIndex(o => o.normal === 1 && o.elite === 1 && o.kept?.kind === 'elite');
      assert.ok(choice >= 0, 'Choose the original Cyborg/Suboid rescue');
      step = { actor: d.player, action: { type: 'decision', event: d.event, choice } };
    } else step = nextIxIndependentSkillsStep(game);
    assert.ok(step); game = stepIxIndependentSkills(game, step);
  }
  throw Error('Native independent battle did not reach Collection');
}

/** Real combat Tanks → real escrow bribe and Mentat → turn-two Revival. */
export function createIxIndependentSkillsRevivalFixture(options: IxIndependentSkillsOptions = {}) {
  const f = createIxIndependentSkillsFixture(options);
  const afterBattle = finishIxIndependentSkillsBattle(f, { rescue: 'none' });
  const bribe: IxIndependentSkillsStep = { actor: f.opponent, action: { type: 'bribe', target: f.ixians, amount: 3 } };
  let game = stepIxIndependentSkills(afterBattle, bribe);
  game = advanceIxIndependentSkills(game, g => g.turn === 2 && g.phase === 4 && ixIndependentSkillsClean(g) && !g.pendingRevival);
  const staging = [...f.staging]; conserveCard(game, f.ixians, RECRUITS_CARD_ID, staging);
  const beforeRecruits = structuredClone(game);
  const priorReturn: IxIndependentSkillsStep = { actor: f.ixians, action: { type: 'revive', amount: 1, elite: 0 } };
  game = stepIxIndependentSkills(game, priorReturn);
  game = advanceIxIndependentSkills(game, g => ixIndependentSkillsClean(g) && !g.pendingRevival);
  const beforePlay = structuredClone(game);
  const play: IxIndependentSkillsStep = { actor: f.ixians, action: { type: 'card', card: RECRUITS_CARD_ID } };
  game = stepIxIndependentSkills(game, play);
  game = advanceIxIndependentSkills(game, g => ixIndependentSkillsClean(g) && !g.pendingRevival);
  const beforeRevival = structuredClone(game);
  const revive: IxIndependentSkillsStep = { actor: f.ixians,
    action: { type: 'revive', amount: 3, elite: 1, freeElite: 0 } };
  const price = forceRevivalQuote(game, ixIndependentSkillsPlayer(game, f.ixians), 3, 1, 0);
  game = stepIxIndependentSkills(game, revive);
  game = advanceIxIndependentSkills(game, g => ixIndependentSkillsClean(g) && !g.pendingRevival);
  return { ...f, afterBattle, bribe, beforeRecruits, priorReturn, beforePlay, play,
    beforeRevival, revive, price, afterRevival: game, staging };
}
