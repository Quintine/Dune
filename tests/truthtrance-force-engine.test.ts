import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, normalizeAutomaticGame, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { MOBILE_LOCATION, MOBILE_STRONGHOLD } from '../game/board';
import type { TruthFact } from '../game/truthtrance';
import { knowledgeGame, knowledgePhysical } from './truthtrance-knowledge-fixture';
import { completedIxSkillsGame, assertIxSkillsCustody } from './ix-skills-fixture';
import { discoveryFixture, enterDiscoveryCollection } from './fixture-discovery';
import { homeworldRevivalFixture, revivalInventory } from './fixture-homeworld-revival';

type ForceFact = Extract<TruthFact, { kind: 'forceCount' }>;
const reload = (game: Game): Game => JSON.parse(JSON.stringify(game));
const player = (game: Game, id: string) => game.players.find(candidate => candidate.id === id)!;
const act = (game: Game, owner: string, action: Action) => reload(applyAction(reload(game), owner, action));
const fact = (zone: ForceFact['zone'], counter: ForceFact['counter'], value: number,
  compare: ForceFact['compare'] = 'eq'): ForceFact => ({ kind: 'forceCount', zone, counter, compare, value });

function reject(game: Game, owner: string, action: Action) {
  const before = structuredClone(game);
  assert.throws(() => applyAction(game, owner, action));
  assert.deepEqual(game, before);
}

/** Move an existing physical card into the asker's hand; never replace a deck. */
function holdTruth(game: Game, owner: string) {
  if (player(game, owner).hand.some(card => card.effect === 'truthtrance')) return;
  const source = [game.deck, ...game.players.map(candidate => candidate.hand)]
    .find(cards => cards.some(card => card.effect === 'truthtrance'))!;
  assert.ok(source);
  const index = source.findIndex(card => card.effect === 'truthtrance');
  player(game, owner).hand.push(source.splice(index, 1)[0]);
}

function declared(game: Game, owner = game.players[0].id) {
  const card = player(game, owner).hand.find(candidate => candidate.effect === 'truthtrance');
  assert.ok(card);
  game = act(game, owner, { type: 'card', card: card.id });
  for (let step = 0; game.truthtrance?.stage === 'priority' && step < 20; step++) {
    const voter = game.players.find(candidate => !game.truthtrance!.passed.includes(candidate.id))!;
    game = act(game, voter.id, { type: 'truthPass' });
  }
  assert.equal(game.truthtrance?.stage, 'ask');
  return game;
}

function ask(game: Game, target: string, question: TruthFact, owner = game.players[0].id) {
  return act(declared(game, owner), owner, { type: 'truthAsk', question: { kind: 'fact', target, fact: question } });
}

function answer(game: Game, target: string, expected: 'yes' | 'no') {
  const before = knowledgePhysical(game);
  const question = structuredClone(game.truthtrance!.question);
  assert.equal(viewGame(game, target).truthAnswer, expected);
  for (const other of game.players.filter(candidate => candidate.id !== target)) {
    assert.equal(viewGame(game, other.id).truthAnswer, null);
    assert.equal(viewGame(game, other.id).players.find(candidate => candidate.id === target)!.hand, undefined);
  }
  reject(game, target, { type: 'truthAnswer', answer: expected === 'yes' ? 'no' : 'yes' });
  reject(game, target, { type: 'truthAnswer', answer: 'unknown' });
  game = act(game, target, { type: 'truthAnswer', answer: expected });
  assert.equal(game.truthtrance, null);
  assert.deepEqual(game.truthHistory!.at(-1)!.question, question);
  assert.equal(game.truthHistory!.at(-1)!.answer, expected);
  assert.deepEqual(knowledgePhysical(game), before);
  assert.deepEqual(reload(normalizeAutomaticGame(reload(game))), game);
  return game;
}

/** Genuine Advanced setup, followed by explicitly conserved typed positions. */
function typedGame() {
  const game = knowledgeGame(true);
  const fremen = player(game, 'f');
  Object.assign(fremen, { reserves: 10, tanks: 3, forces: { 'wind_pass:14': 7 },
    elites: { reserves: 1, tanks: 1, forces: { 'wind_pass:14': 1 }, revived: 0 } });
  assert.equal(knowledgePhysical(game).forces.find(candidate => candidate.id === 'f')!.total, 20);
  return game;
}

void test('Truthtrance counts physical total, normal and elite forces in reserves, Tanks and exact board sectors', () => {
  const initial = typedGame();
  const rows: [ForceFact['zone'], number, number][] = [
    [{ kind: 'reserves' }, 10, 1],
    [{ kind: 'tanks' }, 3, 1],
    [{ kind: 'location', territory: 'wind_pass', sector: 14 }, 7, 1],
    [{ kind: 'location', territory: 'wind_pass', sector: 15 }, 0, 0],
  ];
  for (const [zone, total, elite] of rows)
    for (const [counter, count] of [['total', total], ['normal', total - elite], ['elite', elite]] as const) {
      answer(ask(initial, 'f', fact(zone, counter, count)), 'f', 'yes');
      answer(ask(initial, 'f', fact(zone, counter, count + 1, 'gte')), 'f', 'no');
      answer(ask(initial, 'f', fact(zone, counter, Number.MAX_SAFE_INTEGER, 'lte')), 'f', 'yes');
    }
});

void test('Basic untracked starred factions allow total counts while ordinary absent elite tracking means zero elites', () => {
  const initial = knowledgeGame(false);
  assert.equal(player(initial, 'f').elites, undefined);
  answer(ask(initial, 'f', fact({ kind: 'reserves' }, 'total', player(initial, 'f').reserves)), 'f', 'yes');
  const waiting = declared(initial);
  for (const counter of ['normal', 'elite'] as const)
    reject(waiting, 'a', { type: 'truthAsk', question: { kind: 'fact', target: 'f', fact: fact({ kind: 'tanks' }, counter, 0) } });
  assert.equal(player(initial, 'b').elites, undefined);
  answer(ask(initial, 'b', fact({ kind: 'reserves' }, 'normal', player(initial, 'b').reserves)), 'b', 'yes');
  answer(ask(initial, 'b', fact({ kind: 'tanks' }, 'elite', 0)), 'b', 'yes');
  const ix = completedIxSkillsGame({ requestedSkill: 'warmaster' });
  holdTruth(ix, 't');
  assert.equal(player(ix, 'e').elites, undefined);
  answer(ask(ix, 'e', fact({ kind: 'reserves' }, 'total', player(ix, 'e').reserves), 't'), 'e', 'yes');
  const emperorWaiting = declared(ix, 't');
  for (const counter of ['normal', 'elite'] as const)
    reject(emperorWaiting, 't', { type: 'truthAsk', question: { kind: 'fact', target: 'e', fact: fact({ kind: 'tanks' }, counter, 0) } });
});

void test('physical force facts include Bene Gesserit advisors without exposing a separate advisor counter', () => {
  const initial = knowledgeGame(true);
  Object.assign(player(initial, 'b'), { reserves: 16, tanks: 0, forces: { 'imperial_basin:10': 4 },
    advisors: { 'imperial_basin:10': {} } });
  const zone: ForceFact['zone'] = { kind: 'location', territory: 'imperial_basin', sector: 10 };
  answer(ask(initial, 'b', fact(zone, 'total', 4)), 'b', 'yes');
  answer(ask(initial, 'b', fact(zone, 'normal', 4)), 'b', 'yes');
  const waiting = declared(initial);
  reject(waiting, 'a', { type: 'truthAsk', question: { kind: 'fact', target: 'b',
    fact: { ...fact(zone, 'total', 4), counter: 'advisors' } } });
});

void test('a force fact combined with a private hand fact projects only its aggregate answer to the respondent', () => {
  const initial = typedGame();
  const target = player(initial, 'f');
  const privateName = target.hand[0].name;
  const combined: TruthFact = { kind: 'or', terms: [
    fact({ kind: 'reserves' }, 'total', 11), { kind: 'hand', name: privateName },
  ] };
  const game = ask(initial, 'f', combined);
  for (const id of ['a', 'b', 'o']) {
    const view = viewGame(game, id);
    assert.equal(view.truthAnswer, null);
    assert.equal(view.players.find(candidate => candidate.id === 'f')!.hand, undefined);
    assert.deepEqual(view.truthHistory, []);
  }
  const done = answer(game, 'f', 'yes');
  assert.equal(done.truthHistory!.length, 1);
  assert.deepEqual(done.truthHistory![0].question, { kind: 'fact', target: 'f', fact: combined });
});

void test('invalid force questions reject atomically before consuming Truthtrance or fixing an answer', () => {
  const waiting = declared(typedGame());
  const base = fact({ kind: 'reserves' }, 'total', 0);
  const invalid = [
    { ...base, value: -1 }, { ...base, value: 0.5 }, { ...base, value: Number.MAX_SAFE_INTEGER + 1 },
    { ...base, value: '2' }, { ...base, compare: 'gt' }, { ...base, counter: 'combatStrength' },
    { ...base, zone: { kind: 'homeworld', homeworld: 'salusa_secundus' } },
    { ...base, zone: { kind: 'location', territory: 'salusa_secundus', sector: 0 } },
    { ...base, zone: { kind: 'location', territory: 'arrakeen', sector: 11 } },
    { ...base, zone: { kind: 'location', territory: 'arrakeen', sector: '10' } },
    { ...base, zone: { kind: 'location', territory: MOBILE_STRONGHOLD, sector: 0 } },
    { ...base, zone: { kind: 'location', territory: 'cistern', sector: 0 } },
  ];
  for (const question of invalid)
    reject(waiting, 'a', { type: 'truthAsk', question: { kind: 'fact', target: 'f', fact: question } });
  assert.equal(waiting.truthtrance!.stage, 'ask');
  assert.equal(waiting.truthtrance!.question, null);
  assert.equal(waiting.discard.length, 0);
});

void test('all four bot profiles pass priority and answer force facts legally from their private aggregate answer', () => {
  for (const difficulty of DIFFICULTIES) {
    const initial = typedGame();
    const card = player(initial, 'a').hand.find(candidate => candidate.effect === 'truthtrance')!;
    let game = act(initial, 'a', { type: 'card', card: card.id });
    const priorityView = viewGame(game, 'f');
    priorityView.players.find(candidate => candidate.id === 'f')!.bot = difficulty;
    const actions = botActions(priorityView);
    assert.deepEqual(actions, [{ type: 'truthPass' }]);
    game = act(game, 'f', actions[0]);
    while (game.truthtrance?.stage === 'priority') {
      const voter = game.players.find(candidate => !game.truthtrance!.passed.includes(candidate.id))!;
      game = act(game, voter.id, { type: 'truthPass' });
    }
    game = act(game, 'a', { type: 'truthAsk', question: { kind: 'fact', target: 'f', fact: fact({ kind: 'tanks' }, 'elite', 1) } });
    const view = viewGame(game, 'f');
    view.players.find(candidate => candidate.id === 'f')!.bot = difficulty;
    const before = structuredClone(view);
    const responses = botActions(view);
    assert.deepEqual(view, before);
    assert.deepEqual(responses, [{ type: 'truthAnswer', answer: 'yes' }]);
    assert.deepEqual(botActions(viewGame(game, 'b')), []);
    const done = act(game, 'f', responses[0]);
    assert.equal(done.truthtrance, null);
    assert.deepEqual(knowledgePhysical(done), knowledgePhysical(game));
  }
});

void test('historical force answers do not freeze a later legal revival or movement', () => {
  const revival = typedGame();
  Object.assign(revival, { phase: 4, active: null, phaseOpening: null, response: null, decision: null, storm: 18 });
  let game = answer(ask(revival, 'f', fact({ kind: 'tanks' }, 'total', 3)), 'f', 'yes');
  const history = structuredClone(game.truthHistory);
  game = act(game, 'f', { type: 'revive', amount: 2, elite: 1 });
  assert.equal(player(game, 'f').tanks, 1);
  assert.equal(player(game, 'f').reserves, 12);
  assert.deepEqual(game.truthHistory, history);

  const movement = knowledgeGame(false);
  Object.assign(movement, { phase: 5, active: 'o', movementRemaining: ['o', 'b', 'f', 'a'], phaseOpening: null,
    response: null, decision: null, storm: 18 });
  Object.assign(player(movement, 'o'), { forces: { 'imperial_basin:10': 3 }, reserves: 17, tanks: 0 });
  game = answer(ask(movement, 'o', fact({ kind: 'location', territory: 'imperial_basin', sector: 10 }, 'total', 3)), 'o', 'yes');
  const movementHistory = structuredClone(game.truthHistory);
  game = act(game, 'o', { type: 'move', forces: { 'imperial_basin:10': 2 }, territory: 'arrakeen', sector: 10 });
  assert.equal(player(game, 'o').forces['imperial_basin:10'], 1);
  assert.equal(player(game, 'o').forces['arrakeen:10'], 2);
  assert.deepEqual(game.truthHistory, movementHistory);
});

void test('the live HMS interior is an exact physical location distinct from its external pointer and cyborg strength', () => {
  const initial = completedIxSkillsGame({ requestedSkill: 'warmaster' });
  holdTruth(initial, 'e');
  assert.equal(initial.mobileStronghold!.location, 'polar_sink:0');
  assert.equal(player(initial, 'i').forces[MOBILE_LOCATION], 6);
  assert.equal(player(initial, 'i').elites!.forces[MOBILE_LOCATION], 3);
  for (const [counter, value] of [['total', 6], ['normal', 3], ['elite', 3]] as const)
    assertIxSkillsCustody(answer(ask(initial, 'i', fact({ kind: 'location', territory: MOBILE_STRONGHOLD, sector: 0 }, counter, value), 'e'), 'i', 'yes'));
  answer(ask(initial, 'i', fact({ kind: 'location', territory: 'polar_sink', sector: 0 }, 'total', 0), 'e'), 'i', 'yes');
  const waiting = declared(initial, 'e');
  reject(waiting, 'e', { type: 'truthAsk', question: { kind: 'fact', target: 'i',
    fact: fact({ kind: 'location', territory: MOBILE_STRONGHOLD, sector: 1 }, 'total', 6) } });
});

void test('a Discovery location becomes queryable only after its genuine reveal', () => {
  let game = discoveryFixture();
  const token = enterDiscoveryCollection(game, 'cistern');
  holdTruth(game, 'g');
  const hidden = declared(game, 'g');
  reject(hidden, 'g', { type: 'truthAsk', question: { kind: 'fact', target: 'a',
    fact: fact({ kind: 'location', territory: 'cistern', sector: 0 }, 'total', 0) } });
  game = act(game, 'a', { type: 'discovery', token: token.id, reveal: false });
  game = act(game, 'a', { type: 'discovery', token: token.id, reveal: true });
  assert.equal(game.discoveries!.tokens.find(candidate => candidate.id === token.id)!.revealedTurn, game.turn);
  answer(ask(game, 'a', fact({ kind: 'location', territory: 'cistern', sector: 0 }, 'total', 0), 'g'), 'a', 'yes');
});

void test('Homeworld reserve facts read the faction aggregate and do not add a separate Homeworld query', () => {
  const initial = homeworldRevivalFixture({ advanced: true });
  holdTruth(initial, 'f');
  const emperor = player(initial, 'e');
  const total = emperor.reserves;
  const elite = emperor.elites!.reserves;
  for (const [counter, value] of [['total', total], ['normal', total - elite], ['elite', elite]] as const)
    revivalInventory(answer(ask(initial, 'e', fact({ kind: 'reserves' }, counter, value), 'f'), 'e', 'yes'));
  const waiting = declared(initial, 'f');
  reject(waiting, 'f', { type: 'truthAsk', question: { kind: 'fact', target: 'e',
    fact: { kind: 'forceCount', zone: { kind: 'homeworld', homeworld: 'salusa-secundus' }, counter: 'total', compare: 'eq', value: total } } });
});

void test('malformed saved force facts reject actions, private views and automatic recovery without mutation', () => {
  const game = ask(typedGame(), 'f', fact({ kind: 'reserves' }, 'normal', 9));
  const original = game.truthtrance!.question;
  assert.equal(original?.kind, 'fact');
  const base = fact({ kind: 'reserves' }, 'normal', 9);
  const invalid: unknown[] = [
    { ...base, value: -1 }, { ...base, value: Number.MAX_SAFE_INTEGER + 1 },
    { ...base, counter: 'unknown' }, { ...base, extra: 'discarded field' },
    { ...base, zone: { kind: 'location', territory: 'arrakeen', sector: 11 } },
    { ...base, zone: { kind: 'location', territory: MOBILE_STRONGHOLD, sector: 0 } },
    { ...base, zone: { kind: 'location', territory: 'cistern', sector: 0 } },
    { ...base, zone: { kind: 'reserves', territory: 'arrakeen' } },
    { kind: 'and', terms: [base, { ...base, value: -1 }] },
  ];
  for (const invalidFact of invalid) {
    const saved = reload(game);
    saved.truthtrance!.question = { kind: 'fact', target: 'f', fact: invalidFact as TruthFact };
    const before = structuredClone(saved);
    reject(saved, 'f', { type: 'truthAnswer', answer: 'yes' });
    assert.throws(() => viewGame(saved, 'f'));
    assert.throws(() => normalizeAutomaticGame(saved));
    assert.deepEqual(saved, before);
  }
  const untracked = reload(game);
  delete player(untracked, 'f').elites;
  const before = structuredClone(untracked);
  reject(untracked, 'f', { type: 'truthAnswer', answer: 'yes' });
  assert.throws(() => viewGame(untracked, 'f'));
  assert.throws(() => normalizeAutomaticGame(untracked));
  assert.deepEqual(untracked, before);
  answer(game, 'f', 'yes');
});
