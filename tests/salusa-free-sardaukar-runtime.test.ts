import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, createGame, newPlayer, viewGame, type Action, type Game } from '../game/engine';
import { baseDeck } from '../game/cards';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { forceRevivalQuote } from '../game/revival';
import {
  holdRevivalCard, homeworldRevivalFixture,
  revivalInventory, revivalPlayer,
} from './fixture-homeworld-revival';
import { reachAdvancedRevivalOrderActor } from './fixture-advanced-revival-order';
import {
  createSalusaGholaFixture, salusaGholaArmy, salusaGholaInventory,
} from './fixture-salusa-ghola';

const emperor = (game: Game) => revivalPlayer(game, 'e');
const reload = (game: Game): Game => JSON.parse(JSON.stringify(game));
function reject(game: Game, actor: string, action: Action) {
  const before = structuredClone(game);
  assert.throws(() => applyAction(game, actor, action));
  assert.deepEqual(game, before);
}

/** Real Advanced Homeworld setup and the existing actual Charity/auction
 * continuation. The fixture itself stages Charity and Fremen positions. This
 * supplement explicitly moves conserved Imperial reserves into Tanks: retain
 * 1 or 2 original stars on Salusa, put the other stars and 2 ordinary forces
 * into Tanks. It does not claim natural casualties or a played-card purchase. */
function source(salusaStars: 1 | 2 = 1) {
  let game = homeworldRevivalFixture({ advanced: true });
  const p = emperor(game), deadStars = 5 - salusaStars;
  assert.equal(p.reserves, 20);
  assert.equal(p.elites!.reserves, 5);
  assert.equal(game.homeworlds!.custody!.salusa!.elite, 5);
  p.reserves -= deadStars + 2;
  p.tanks += deadStars + 2;
  p.elites!.reserves -= deadStars;
  p.elites!.tanks += deadStars;
  game.homeworlds!.custody!.salusa!.elite = salusaStars;
  const ghola = holdRevivalCard(game, 'e', 'ghola');
  const karama = holdRevivalCard(game, 'e', 'karama');
  revivalInventory(game);
  game = reachAdvancedRevivalOrderActor(game, 'e');
  assert.equal(game.phase, 4);
  assert.ok(!game.revivalOrder || game.revivalOrder.remaining[0] === 'e');
  revivalInventory(game);
  return { game, ghola, karama };
}

/** This is a separately controlled legacy-shaped Advanced battleless Revival
 * with no Homeworld module; the staged physical Tanks match the Low source. */
function withoutWorlds() {
  const player = newPlayer('e', 'Emperor', 'emperor');
  const game = createGame('SALUSANOWORLD', player, true);
  game.players.push(newPlayer('f', 'Fremen', 'fremen'));
  Object.assign(game, { status: 'playing', phase: 4, turn: 2, active: null,
    order: ['e', 'f'], ready: [], storm: 18, deck: baseDeck() });
  Object.assign(player, { reserves: 14, tanks: 6, spice: 20,
    elites: { reserves: 1, tanks: 4, forces: {}, revived: 0 } });
  return game;
}

void test('low Salusa makes a normal Sardaukar return paid, leaving the free allowance for an ordinary force', () => {
  const { game: initial } = source();
  const original = structuredClone(emperor(initial));
  const view = viewGame(initial, 'e');
  assert.equal(typeof view.revival.sardaukarFreeBlock, 'string');
  assert.equal(view.revival.freeRemaining, 1);
  const quote = forceRevivalQuote(initial, emperor(initial), 1, 1);
  assert.equal(quote.free, 0);
  assert.equal(quote.cost, 2);
  const poor = structuredClone(initial);
  emperor(poor).spice = 1; // Controlled insufficient-funds boundary.
  reject(poor, 'e', { type: 'revive', amount: 1, elite: 1 });

  let game = applyAction(reload(initial), 'e', { type: 'revive', amount: 1, elite: 1 });
  assert.equal(emperor(game).spice, original.spice - 2);
  assert.equal(emperor(game).freeForcesRevived, 0);
  assert.equal(emperor(game).revived, 1);
  assert.equal(emperor(game).elites!.revived, 1);
  assert.equal(game.homeworlds!.custody!.salusa!.elite, 2);
  assert.equal(viewGame(game, 'e').revival.sardaukarFreeBlock, null);
  assert.equal(viewGame(game, 'e').revival.freeRemaining, 1);
  game = applyAction(reload(game), 'e', { type: 'revive', amount: 1, elite: 0 });
  assert.equal(emperor(game).spice, original.spice - 2);
  assert.equal(emperor(game).freeForcesRevived, 1);
  assert.equal(emperor(game).revived, 2);
  revivalInventory(game);
});

void test('a mixed Low group spends free allowance on normal forces and pays for its Sardaukar', () => {
  const { game: initial } = source();
  const quote = forceRevivalQuote(initial, emperor(initial), 2, 1);
  assert.equal(quote.free, 1);
  assert.equal(quote.cost, 2);
  const before = structuredClone(emperor(initial));
  const game = applyAction(reload(initial), 'e', { type: 'revive', amount: 2, elite: 1 });
  assert.equal(emperor(game).spice, before.spice - 2);
  assert.equal(emperor(game).tanks, before.tanks - 2);
  assert.equal(emperor(game).elites!.tanks, before.elites!.tanks - 1);
  assert.equal(emperor(game).freeForcesRevived, 1);
  assert.equal(emperor(game).revived, 2);
  assert.equal(game.homeworlds!.custody!.salusa!.elite, 2);
  revivalInventory(game);
});

void test('actual native Low Salusa battle cannot revive its earned dead Sardaukar with Ghola', () => {
  const f = createSalusaGholaFixture();
  assert.deepEqual(salusaGholaArmy(f.game), { normal: 0, elite: 1 });
  assert.equal(f.game.players.find(player => player.id === f.actor)!.elites!.tanks, 1);
  const view = viewGame(f.game, f.actor);
  assert.equal(view.ghola.eliteRemaining, 0);
  assert.equal(typeof view.ghola.eliteBlock, 'string');
  reject(f.game, f.actor, f.action);
  assert.ok(f.game.players.find(player => player.id === f.actor)!.hand.some(card => card.id === f.card));
  assert.deepEqual(salusaGholaInventory(f.game), f.original);
});

void test('Low Ghola and Emperor special reject free stars while retaining normal-force alternatives', () => {
  const { game: initial, ghola, karama } = source();
  reject(initial, 'e', { type: 'card', card: ghola, amount: 1, elite: 1 });
  reject(initial, 'e', { type: 'card', mode: 'special', card: karama, amount: 1, elite: 1 });
  assert.notEqual(emperor(initial).specialKaramaUsed, true);
  assert.equal(initial.discard.some(card => card.id === karama || card.id === ghola), false);
  const gholaNormal = applyAction(reload(initial), 'e', { type: 'card', card: ghola, amount: 1, elite: 0 });
  assert.equal(emperor(gholaNormal).tanks, emperor(initial).tanks - 1);
  assert.equal(emperor(gholaNormal).elites!.tanks, emperor(initial).elites!.tanks);
  assert.equal(gholaNormal.discard.filter(card => card.id === ghola).length, 1);
  const specialNormal = applyAction(reload(initial), 'e', { type: 'card', mode: 'special', card: karama, amount: 1, elite: 0 });
  assert.equal(emperor(specialNormal).tanks, emperor(initial).tanks - 1);
  assert.equal(emperor(specialNormal).elites!.tanks, emperor(initial).elites!.tanks);
  assert.equal(emperor(specialNormal).specialKaramaUsed, true);
  assert.equal(specialNormal.discard.filter(card => card.id === karama).length, 1);
  revivalInventory(gholaNormal);
  revivalInventory(specialNormal);
});

void test('Salusa at the high threshold permits free Ghola and three-star special revival again', () => {
  const { game: initial, ghola, karama } = source(2);
  assert.equal(viewGame(initial, 'e').revival.sardaukarFreeBlock, null);
  assert.equal(forceRevivalQuote(initial, emperor(initial), 1, 1).cost, 0);
  const gholaGame = applyAction(reload(initial), 'e', { type: 'card', card: ghola, amount: 1, elite: 1 });
  assert.equal(gholaGame.homeworlds!.custody!.salusa!.elite, 3);
  const specialGame = applyAction(reload(initial), 'e', { type: 'card', mode: 'special', card: karama, amount: 3, elite: 3 });
  assert.equal(specialGame.homeworlds!.custody!.salusa!.elite, 5);
  assert.equal(emperor(specialGame).elites!.revived, 0);
  assert.equal(emperor(specialGame).specialKaramaUsed, true);
  revivalInventory(gholaGame);
  revivalInventory(specialGame);
});

void test('legacy Advanced games without Homeworlds retain a free normal Sardaukar return', () => {
  const initial = withoutWorlds();
  assert.equal(viewGame(initial, 'e').revival.sardaukarFreeBlock, null);
  assert.equal(forceRevivalQuote(initial, emperor(initial), 1, 1).free, 1);
  const game = applyAction(initial, 'e', { type: 'revive', amount: 1, elite: 1 });
  assert.equal(emperor(game).spice, 20);
  assert.equal(emperor(game).freeForcesRevived, 1);
  assert.equal(emperor(game).elites!.reserves, 2);
  assert.equal(game.homeworlds, undefined);
});

void test('all minimal bot profiles use only legal Low revival and Ghola proposals', () => {
  const { game } = source();
  for (const difficulty of DIFFICULTIES) {
    const view = viewGame(game, 'e');
    view.players.find(player => player.id === 'e')!.bot = difficulty;
    const actions = botActions(view);
    assert.ok(actions.length, `${difficulty} must have a legal continuation`);
    for (const action of actions) {
      if (action.type === 'card' && (action.mode === 'special' ||
        view.ghola.cards.includes(String(action.card))))
        assert.equal(action.elite ?? 0, 0, `${difficulty} cannot propose a free star`);
      assert.doesNotThrow(() => applyAction(game, 'e', action), `${difficulty}: ${JSON.stringify(action)}`);
    }
  }
});
