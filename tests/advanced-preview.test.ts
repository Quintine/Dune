import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyAction, createGame, joinGame, newPlayer, normalizeAutomaticGame, viewGame,
  initializeBaseGameForAudit, type Action, type Game,
} from '../game/engine';
import { FACTIONS, type FactionId } from '../game/catalog';
import { baseDeck } from '../game/cards';
import { botActions } from '../game/bots';
import { DIFFICULTIES, type Difficulty } from '../game/bot-profiles';
import { createLeaderSkills } from '../game/leader-skills';
import { createTechTokens } from '../game/tech-tokens';
import { createStrongholdCards } from '../game/stronghold-cards';

const BASE = FACTIONS.filter(entry => entry.expansion === 'base').map(entry => entry.id);
const reload = (game: Game): Game => JSON.parse(JSON.stringify(game));
const act = (game: Game, owner: string, action: Action) => reload(applyAction(reload(game), owner, action));
const preview = { type: 'start', advancedPreview: true };
function lobby(roster: FactionId[] = ['atreides', 'harkonnen'], advanced = false) {
  const game = createGame('ADVANCEDPREVIEW', newPlayer(roster[0], roster[0], roster[0]), advanced);
  for (const id of roster.slice(1)) joinGame(game, newPlayer(id, id, id));
  return game;
}
function ready(game: Game) {
  for (const p of game.players) if (!p.ready) game = act(game, p.id, { type: 'ready' });
  return game;
}
function reject(game: Game, owner: string, action: Action) {
  const before = structuredClone(game);
  assert.throws(() => applyAction(game, owner, action));
  assert.deepEqual(game, before);
}
function completedSetup(initial: Game, difficulty: Difficulty = 'Easy') {
  let game = initial;
  for (let step = 0; game.status === 'setup' && step < 25; step++) {
    const pending = viewGame(game, game.host).setupPending;
    assert.ok(pending.length, `${difficulty}: ${game.setupStage} has an entitled setup actor.`);
    const id = pending[0], view = viewGame(game, id);
    view.players.find(candidate => candidate.id === id)!.bot = difficulty;
    for (const other of view.players.filter(candidate => candidate.id !== id)) {
      assert.equal(other.hand, undefined);
      assert.equal(other.traitors, undefined);
      assert.equal(other.traitorChoices, undefined);
      assert.equal(other.prediction, undefined);
    }
    assert.equal('deck' in view, false);
    assert.equal('traitorReserve' in view, false);
    const before = structuredClone(view), actions = botActions(view);
    assert.deepEqual(view, before);
    assert.ok(actions.length, `${difficulty}: ${game.setupStage}/${id} can continue legally.`);
    game = act(game, id, actions[0]);
  }
  assert.equal(game.status, 'playing');
  assert.equal(game.setupStage, undefined);
  assert.deepEqual(normalizeAutomaticGame(reload(game)), game);
  const cards = [...game.deck, ...game.discard, ...game.players.flatMap(p => p.hand)].map(card => card.id).sort();
  assert.deepEqual(cards, baseDeck().map(card => card.id).sort());
  const traitors = [...game.traitorReserve!, ...game.players.flatMap(p => [...p.traitors, ...p.traitorChoices])];
  assert.equal(new Set(traitors).size, traitors.length);
  assert.deepEqual(traitors.sort(), game.players.flatMap(p => p.leaders.map(leader => leader.id)).sort());
  for (const p of game.players) {
    assert.equal(p.reserves + p.tanks + Object.values(p.forces).reduce((sum, amount) => sum + amount, 0), 20);
    assert.equal(p.hand.length, p.faction === 'harkonnen' ? 2 : 1);
    assert.equal(p.traitors.length, p.faction === 'harkonnen' ? 4 : 1);
    if (game.advanced && ['fremen', 'emperor'].includes(p.faction)) {
      assert.ok(p.elites);
      assert.equal(p.elites.reserves + p.elites.tanks + Object.values(p.elites.forces).reduce((sum, amount) => sum + amount, 0),
        p.faction === 'fremen' ? 3 : 5);
    } else assert.equal(p.elites, undefined);
    if (p.faction === 'beneGesserit') {
      assert.ok(p.prediction);
      assert.equal(p.reserves, 19);
      if (game.advanced) assert.equal(p.advisorSetup, true);
    }
    assert.equal(viewGame(game, p.id).advancedPreview, game.advancedPreview === true);
  }
  return game;
}

void test('Basic stays the default and its ordinary start does not opt into Advanced preview', () => {
  const game = ready(lobby());
  assert.equal(game.advanced, false);
  assert.equal(game.advancedPreview, undefined);
  assert.equal(viewGame(game, game.host).advancedPreview, false);
  reject(game, game.host, preview);
  const started = act(game, game.host, { type: 'start' });
  assert.equal(started.advanced, false);
  assert.equal(started.advancedPreview, undefined);
  const done = completedSetup(started);
  reject(done, done.host, { type: 'rules', advanced: true });
  reject(done, done.host, preview);
});

void test('only the host can select a boolean rules mode, changes clear human readiness, and Basic clears unused Stronghold Cards but retains Tech Tokens', () => {
  let game = lobby(['atreides', 'emperor']);
  game = act(game, game.host, { type: 'addBot', faction: 'fremen', difficulty: 'Hard' });
  game = act(game, game.host, { type: 'techTokens', enabled: true });
  game = ready(game);
  const tokens = structuredClone(game.techTokens);
  const bot = game.players.find(p => p.bot)!;
  reject(game, 'emperor', { type: 'rules', advanced: true });
  reject(game, bot.id, { type: 'rules', advanced: true });
  for (const advanced of [undefined, null, 1, 0, 'true', 'false', {}, []])
    reject(game, game.host, { type: 'rules', advanced });
  reject(game, game.host, { type: 'rules', advanced: true, advancedPreview: true });
  game = act(game, game.host, { type: 'rules', advanced: true });
  assert.equal(game.advanced, true);
  assert.equal(game.advancedPreview, undefined);
  assert.deepEqual(game.players.map(p => [p.id, p.ready]), game.players.map(p => [p.id, !!p.bot]));
  assert.match(game.log.at(-1)!.text, /Advanced preview/);
  game = act(game, game.host, { type: 'strongholdCards', enabled: true });
  game = ready(game);
  assert.deepEqual(act(game, game.host, { type: 'rules', advanced: true }), game, 'A rules no-op preserves readiness and logs.');
  game = act(game, game.host, { type: 'rules', advanced: false });
  assert.equal(game.strongholdCards, null);
  assert.deepEqual(game.techTokens, tokens);
  assert.ok(game.players.every(p => p.ready === !!p.bot));
  assert.match(game.log.at(-1)!.text, /Stronghold Cards were disabled/);
  assert.deepEqual(act(game, game.host, { type: 'rules', advanced: false }), game);
  reject(game, game.host, { type: 'strongholdCards', enabled: true });
  completedSetup(act(ready(game), game.host, { type: 'start' }));
});

void test('Advanced starts require the exact host opt-in and cannot dispatch audit initializers or hidden bypass options', () => {
  const game = ready(lobby(BASE, true));
  reject(game, game.host, { type: 'start' });
  reject(game, game.players[1].id, preview);
  for (const advancedPreview of [false, 1, 'true', null, {}])
    reject(game, game.host, { type: 'start', advancedPreview });
  for (const extra of [{ audit: true }, { advanced: false }, { allowUnsupported: true }, { profile: 'ix' }, { expansions: [] }])
    reject(game, game.host, { ...preview, ...extra });
  reject(game, game.host, { type: 'initializeBaseGameForAudit' });
  const unready = reload(game);
  unready.players[1].ready = false;
  reject(unready, unready.host, preview);
  const started = act(game, game.host, preview);
  assert.equal(started.status, 'setup');
  assert.equal(started.setupStage, 'prediction');
  assert.equal(started.advancedPreview, true);
  assert.ok(started.players.every(p => !p.hand.length && !p.traitors.length && !p.traitorChoices.length));
  reject(started, started.host, preview);
  reject(started, started.host, { type: 'rules', advanced: false });
});

void test('the explicit preview keeps expansion, module and separate development-profile gates closed at rules selection and start', () => {
  const changes: ((game: Game) => void)[] = [
    ...['ix', 'choam', 'ecaz'].map(expansion => (game: Game) => { game.expansions = [expansion]; }),
    ...FACTIONS.filter(entry => entry.expansion !== 'base').map(entry => (game: Game) => {
      game.players[1] = { ...newPlayer(game.players[1].id, entry.name, entry.id), ready: true };
    }),
    game => { game.homeworlds = { custody: null }; },
    game => { game.nexusCards = { cards: null, phase: null }; },
    game => { game.discoveryEnabled = true; },
    game => { game.leaderSkills = createLeaderSkills(() => 0.25); },
    game => { game.ecazTreachery = true; },
    game => { game.mentatQuestionPreview = true; },
    game => { game.moritaniAssassinatePreview = true; },
  ];
  for (const change of changes) {
    const game = ready(lobby());
    change(game);
    reject(game, game.host, { type: 'rules', advanced: true });
    game.advanced = true;
    reject(game, game.host, preview);
  }
});

void test('preview start validates a fresh lobby and refuses existing pieces or module ownership instead of redealing', () => {
  const changes: ((game: Game) => void)[] = [
    game => { game.turn = 2; },
    game => { game.phase = 1; },
    game => { game.deck.push(baseDeck()[0]); },
    game => { game.players[0].hand.push(baseDeck()[0]); },
    game => { game.players[0].spice = 1; },
    game => { game.players[0].forces = { 'arrakeen:10': 1 }; game.players[0].reserves--; },
    game => { game.players[1].id = game.players[0].id; },
    game => { game.players[1].faction = game.players[0].faction; },
    game => { game.playerPositions![game.players[1].id] = game.playerPositions![game.players[0].id]; },
    game => { game.advancedPreview = true; },
    game => { game.techTokens = createTechTokens(); game.techTokens.production.owner = game.host; },
    game => { game.strongholdCards = createStrongholdCards(); game.strongholdCards.owners.arrakeen = game.host; },
  ];
  for (const change of changes) {
    const game = ready(lobby(['atreides', 'harkonnen', 'emperor'], true));
    change(game);
    reject(game, game.host, preview);
  }
  const one = ready(lobby(['atreides'], true));
  reject(one, one.host, preview);
});

void test('existing Tech Tokens and Advanced Stronghold Cards use their normal setup validation and initial ownership', () => {
  let game = lobby(['atreides', 'fremen', 'beneGesserit']);
  game = act(game, game.host, { type: 'rules', advanced: true });
  game = act(game, game.host, { type: 'techTokens', enabled: true });
  game = act(game, game.host, { type: 'strongholdCards', enabled: true });
  const done = completedSetup(act(ready(game), game.host, preview), 'Hard');
  assert.equal(done.advancedPreview, true);
  assert.deepEqual(done.strongholdCards, createStrongholdCards());
  assert.deepEqual(done.techTokens, createTechTokens(done.players));
  let two = lobby(['atreides', 'guild'], true);
  two = act(two, two.host, { type: 'techTokens', enabled: true });
  reject(ready(two), two.host, preview);
});

void test('fresh setup rejects altered native leaders and prior player ledgers before either normal start or audit initialization', () => {
  const changes: ((game: Game) => void)[] = [
    game => { game.players[0].leaders.pop(); },
    game => { game.players[0].leaders[1] = structuredClone(game.players[0].leaders[0]); },
    game => { game.players[0].leaders[0].name = 'Changed leader'; },
    game => { game.players[0].leaders[0].strength++; },
    game => { game.players[0].leaders[0].dead = true; },
    game => { game.players[0].leaders[0].deaths = 1; },
    game => { game.players[0].leaders[0].usedAt = 'arrakeen'; },
    game => { game.players[0].leaders[0].capturedBy = game.players[1].id; },
    game => { game.players[0].leaders[0].gholaBy = game.players[1].id; },
    game => { game.players[0].leaders[0].controller = game.players[0].id; },
    game => { game.players[0].ally = game.players[1].id; },
    game => { game.players[0].allySinceTurn = 1; },
    game => { game.players[0].bribes = 1; },
    game => { game.players[0].revived = 1; },
    game => { game.players[0].freeForcesRevived = 1; },
    game => { game.players[0].leaderRevived = true; },
    game => { game.players[0].revivalCycle = 1; },
    game => { game.players[0].battleLosses = 7; },
    game => { game.players[0].kwisatz = { dead: false }; },
    game => { game.players[0].specialKaramaUsed = true; },
    game => { game.players[0].charityTurn = 1; },
    game => { game.players[0].faceDancers = []; },
    game => { game.players[0].revealedTraitors = [game.players[0].leaders[0].id]; },
    game => { game.players[0].gholaBlocked = { stale: 1 }; },
  ];
  for (const change of changes) {
    const game = ready(lobby(['atreides', 'harkonnen'], true));
    change(game);
    const before = structuredClone(game);
    reject(game, game.host, preview);
    assert.throws(() => initializeBaseGameForAudit(game));
    assert.deepEqual(game, before);
    game.advanced = false;
    reject(game, game.host, { type: 'start' });
  }
});

void test('normal base start cannot retain undeclared card zones, physical resources or stale continuations', () => {
  const changes: ((game: Game) => void)[] = [
    game => { game.richeseCache = [baseDeck()[0]]; },
    game => { game.richeseRemoved = [baseDeck()[0]]; },
    game => { game.ixSetupCards = [baseDeck()[0]]; },
    game => { game.spice = { 'the_great_flat:15': 9 }; },
    game => { game.aid[game.host] = { recipient: game.players[1].id, amount: 4 }; },
    game => { game.freeRevival = [game.host]; },
    game => { game.emperorExtra[game.host] = 2; },
    game => { game.hajr = [game.host]; },
    game => { game.stormDials[game.host] = 1; },
    game => { game.mobileStronghold = { location: 'polar_sink:0' }; },
    game => { game.pendingIxAlly = { player: game.host, card: baseDeck()[0].id, free: false }; },
    game => { game.truthHistory = []; },
    game => { Reflect.deleteProperty(game, 'allianceOffers'); },
    game => { Reflect.deleteProperty(game, 'stormDials'); },
    game => { game.botsPending = true; },
    game => { game.botNextActionAt = Date.now(); },
  ];
  for (const advanced of [false, true]) for (const change of changes) {
    const game = ready(lobby(['atreides', 'harkonnen'], advanced));
    change(game);
    reject(game, game.host, advanced ? preview : { type: 'start' });
  }
});

void test('ordinary lobby configuration and persisted storage metadata remain compatible with strict fresh-state admission', () => {
  let game = lobby(['atreides', 'harkonnen']);
  game = act(game, game.host, { type: 'addBot', faction: 'emperor', difficulty: 'Medium' });
  const bot = game.players.find(p => p.bot)!;
  game = act(game, game.host, { type: 'configureBot', target: bot.id, difficulty: 'Hard', faction: 'fremen', position: 6 });
  game = act(game, 'harkonnen', { type: 'faction', faction: 'guild' });
  game = act(game, game.host, { type: 'homeworlds', enabled: true });
  game = act(game, game.host, { type: 'homeworlds', enabled: false });
  game = act(game, game.host, { type: 'rules', advanced: true });
  game = act(game, game.host, { type: 'techTokens', enabled: true });
  game = act(game, game.host, { type: 'strongholdCards', enabled: true });
  game = ready(game);
  game.version = 42;
  game.botsPending = false;
  const positions = structuredClone(game.playerPositions);
  const names = game.players.map(p => p.name);
  const done = completedSetup(act(game, game.host, preview));
  assert.equal(done.version, 42);
  assert.deepEqual(done.playerPositions, positions);
  assert.deepEqual(done.players.map(p => p.name), names);
  assert.equal(done.players.find(p => p.id === bot.id)!.bot, 'Hard');
});

void test('all 57 base rosters from 2 through 6 complete normal Advanced preview setup with each of four legal AI profiles and JSON custody', () => {
  for (let mask = 1; mask < 2 ** BASE.length; mask++) {
    const roster = BASE.filter((_, index) => mask & (1 << index));
    if (roster.length < 2) continue;
    for (const difficulty of DIFFICULTIES) {
      const game = ready(lobby(roster, true));
      const done = completedSetup(act(game, game.host, preview), difficulty);
      assert.equal(done.advancedPreview, true);
      assert.equal(done.advanced, true);
      assert.deepEqual(normalizeAutomaticGame(reload(done)), done);
    }
  }
});

void test('saved preview marker cannot silently change mode or introduce an unsupported profile', () => {
  const game = completedSetup(act(ready(lobby(['atreides', 'guild'], true)), 'atreides', preview));
  for (const change of [
    (state: Game) => { state.advanced = false; },
    (state: Game) => { state.status = 'lobby'; },
    (state: Game) => { state.expansions = ['ix']; },
    (state: Game) => { state.discoveryEnabled = true; },
    (state: Game) => { Object.assign(state, { advancedPreview: false }); },
  ]) {
    const corrupt = reload(game);
    change(corrupt);
    const before = structuredClone(corrupt);
    assert.throws(() => viewGame(corrupt, corrupt.host));
    assert.throws(() => normalizeAutomaticGame(corrupt));
    reject(corrupt, corrupt.host, { type: 'advanceBots' });
    assert.deepEqual(corrupt, before);
  }
});
