import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAction,
  createGame,
  newPlayer,
  viewGame,
  normalizeAutomaticGame,
  type Game,
  type Action,
} from '../game/engine';
import { baseDeck, ixBattleCards, type Card } from '../game/cards';
import { FACTIONS, type FactionId } from '../game/catalog';
import { richeseCards } from '../game/richese-cards';
import {
  isStoneBurner,
  isWeaponCard,
  validBattleCardPair,
  weaponTypes,
  defaultVoiceMatch,
} from '../game/battle-cards';

const stoneId = 'richese-stone-burner';
function fixture(f: FactionId = 'harkonnen', advanced = false) {
  let g = createGame('STONE', newPlayer('p', 'Stone holder', f), advanced, [
    'choam',
  ]);
  g.players.push(
    newPlayer('q', 'Opponent', f === 'guild' ? 'emperor' : 'guild'),
  );
  if (f !== 'richese') g.players.push(newPlayer('r', 'Richese', 'richese'));
  g.status = 'playing';
  g.phase = 6;
  g.turn = 2;
  g.active = 'p';
  g.order = g.players.map((p) => p.id);
  g.storm = 18;
  g.deck = baseDeck();
  g.richeseCache = richeseCards();
  for (const p of g.players) {
    p.hand = [];
    p.forces = {};
    p.reserves = 20;
    p.spice = 20;
    p.traitors = [];
  }
  for (const p of g.players.slice(0, 2)) {
    p.forces = { 'pasty_mesa:5': 5 };
    p.reserves = 15;
  }
  g.players[0].hand = [g.richeseCache.find((c) => c.id === stoneId)!];
  g.richeseCache = g.richeseCache.filter((c) => c.id !== stoneId);
  g = applyAction(g, 'p', {
    type: 'chooseBattle',
    territory: 'pasty_mesa',
    target: 'q',
  });
  for (const id of ['p', 'q'])
    g = applyAction(g, id, {
      type: 'battlePreparationReady',
      event: g.battle!.event,
    });
  while (g.battle?.preparation)
    g = applyAction(g, g.battle.preparation.owner, {
      type: 'declineBattlePower',
    });
  if (g.decision?.kind === 'fullPlanOffer')
    g = applyAction(g, g.decision.player, { type: 'decision', decline: true });
  return g;
}
function give(g: Game, id: string, card: Card) {
  g.players.find((p) => p.id === id)!.hand.push(card);
  g.deck = g.deck.filter((c) => c.id !== card.id);
  g.richeseCache = g.richeseCache?.filter((c) => c.id !== card.id);
}
function reveal(
  g: Game,
  own: Partial<Action> = {},
  other: Partial<Action> = {},
) {
  g = applyAction(g, 'p', {
    type: 'battlePlan',
    dial: 0,
    leader: g.players[0].leaders[0].id,
    weapon: stoneId,
    ...own,
  });
  return applyAction(g, 'q', {
    type: 'battlePlan',
    dial: g.advanced ? 2 : 4,
    support: 0,
    leader: g.players[1].leaders[0].id,
    ...other,
  });
}
const mode = (g: Game, mode: 'kill' | 'ignore') =>
  applyAction(g, 'p', { type: 'decision', event: g.battle!.event, mode });
const finish = (g: Game) =>
  applyAction(applyAction(g, 'q', { type: 'traitorCall', call: false }), 'p', {
    type: 'traitorCall',
    call: false,
  });

void test('canonical Stone is a named special weapon, never a generic special, poison or projectile', () => {
  const card = richeseCards().find((c) => c.id === stoneId)!;
  assert.equal(card.kind, 'special');
  assert.equal(isWeaponCard(card), true);
  assert.equal(validBattleCardPair(card), true);
  assert.deepEqual(weaponTypes(card), ['stoneBurner']);
  assert.equal(defaultVoiceMatch(card, 'stoneBurner'), true);
  assert.equal(defaultVoiceMatch(card, 'poison'), false);
  assert.equal(defaultVoiceMatch(card, 'projectile'), false);
  for (const forged of [
    { ...card, id: 'fake' },
    { ...card, name: 'fake' },
    { ...card, effect: 'portableSnooper' },
  ])
    assert.equal(isStoneBurner(forged), false);
  assert.equal(
    isWeaponCard(richeseCards().find((c) => c.effect === 'semutaDrug')!),
    false,
  );
});

void test('every faction can choose both Stone modes after reveal and physical undialed tokens replace ordinary strength', () => {
  for (const faction of FACTIONS)
    for (const advanced of [false, true])
      for (const choice of ['kill', 'ignore'] as const) {
        let g = reveal(fixture(faction.id, advanced));
        assert.equal(g.decision?.kind, 'stoneBurner');
        const plans = structuredClone(g.battle!.plans),
          a = g.players[0].leaders[0],
          d = g.players[1].leaders[0];
        assert.equal(a.dead, false);
        assert.equal(d.dead, false);
        g = mode(g, choice);
        assert.deepEqual(g.battle!.plans, plans);
        g = finish(g);
        assert.equal(
          g.players[0].forces['pasty_mesa:5'],
          5,
          `${faction.id}/${advanced}/${choice}`,
        );
        assert.equal(g.players[1].forces['pasty_mesa:5'], undefined);
        assert.equal(g.players[0].leaders[0].dead, choice === 'kill');
        assert.equal(g.players[1].leaders[0].dead, choice === 'kill');
        assert.equal(g.decision?.kind, 'battleCards');
        const bounty =
          choice === 'kill'
            ? (a.id === 'tleilaxu-0' ? d.strength : a.strength) +
              (d.id === 'tleilaxu-0' ? a.strength : d.strength)
            : 0;
        assert.equal(g.players[0].spice, 20 + bounty);
        assert.equal(g.discard.filter((c) => c.id === stoneId).length, 0);
        for (const p of g.players)
          assert.equal(
            p.reserves +
              p.tanks +
              Object.values(p.forces).reduce((a, b) => a + b, 0),
            20,
          );
      }
});

void test('Stone physical ties favor aggressor, winner keeps or discards normally, and an all-dialed loser loses all tokens', () => {
  let g = finish(mode(reveal(fixture(), { dial: 2 }, { dial: 2 }), 'ignore'));
  assert.equal(g.players[0].forces['pasty_mesa:5'], 3);
  assert.equal(g.players[1].tanks, 5);
  g = applyAction(g, 'p', { type: 'decision', discard: [] });
  assert.equal(g.players[0].hand.filter((c) => c.id === stoneId).length, 1);
  g = finish(mode(reveal(fixture(), { dial: 5 }, { dial: 0 }), 'ignore'));
  assert.equal(g.players[1].forces['pasty_mesa:5'], 5);
  assert.equal(g.players[0].tanks, 5);
  assert.equal(g.discard.filter((c) => c.id === stoneId).length, 1);
  g = finish(mode(reveal(fixture()), 'ignore'));
  g = applyAction(g, 'p', { type: 'decision', discard: [stoneId] });
  assert.equal(g.discard.filter((c) => c.id === stoneId).length, 1);
});

void test('ignore preserves ordinary attacks, kill ignores defenses, and Artillery suppresses bounty independently', () => {
  for (const choice of ['kill', 'ignore'] as const) {
    let g = fixture();
    const poison = g.deck.find((c) => c.kind === 'poison')!,
      shield = g.deck.find((c) => c.kind === 'shield')!;
    give(g, 'q', poison);
    give(g, 'q', shield);
    g = finish(
      mode(reveal(g, {}, { weapon: poison.id, defense: shield.id }), choice),
    );
    assert.equal(g.players[0].leaders[0].dead, true);
    assert.equal(g.players[1].leaders[0].dead, choice === 'kill');
  }
  let g = fixture();
  const artillery = ixBattleCards().find((c) => c.kind === 'artillery')!,
    shield = g.deck.find((c) => c.kind === 'shield')!;
  give(g, 'q', artillery);
  give(g, 'p', shield);
  g = finish(
    mode(reveal(g, { defense: shield.id }, { weapon: artillery.id }), 'kill'),
  );
  assert.equal(g.players[0].leaders[0].dead, true);
  assert.equal(g.players[1].leaders[0].dead, true);
  assert.equal(g.players[0].spice, 20);
});

void test('traitor and explosion precedence remain intact, while Stone never kills or scores the Kwisatz Haderach', () => {
  let g = mode(reveal(fixture()), 'kill');
  g.players[1].traitors = [g.battle!.plans.p.leader!];
  g = applyAction(g, 'q', { type: 'traitorCall', call: true });
  g = applyAction(g, 'p', { type: 'traitorCall', call: false });
  assert.equal(g.players[1].leaders[0].dead, false);
  assert.equal(g.players[1].forces['pasty_mesa:5'], 5);
  g = fixture();
  const laser = g.deck.find((c) => c.kind === 'lasgun')!,
    shield = g.deck.find((c) => c.kind === 'shield')!;
  give(g, 'q', laser);
  give(g, 'p', shield);
  g.spice['pasty_mesa:5'] = 8;
  g = finish(
    mode(reveal(g, { defense: shield.id }, { weapon: laser.id }), 'kill'),
  );
  assert.equal(g.players[0].tanks, 5);
  assert.equal(g.players[1].tanks, 5);
  assert.equal(g.spice['pasty_mesa:5'], undefined);
  assert.equal(g.players[0].spice, 20);
  assert.equal(g.players[1].spice, 20);
  for (const choice of ['kill', 'ignore'] as const) {
    g = fixture('atreides', true);
    g.players[0].battleLosses = 7;
    g = finish(
      mode(
        reveal(g, { dial: 1, support: 1, kwisatz: true }, { dial: 0 }),
        choice,
      ),
    );
    assert.equal(g.players[0].kwisatz?.dead, false);
    assert.equal(
      g.players[0].forces['pasty_mesa:5'],
      undefined,
      'KH bonus cannot turn four undialed tokens into six',
    );
    assert.equal(g.players[1].forces['pasty_mesa:5'], 5);
  }
});

void test('mode is owner-only, immutable, event-bound and JSON recoverable before any leader death or payment', () => {
  let g = reveal(
    fixture('harkonnen', true),
    { dial: 1, support: 1 },
    { dial: 2, support: 2 },
  );
  const before = structuredClone(g);
  for (const action of [
    { type: 'decision', mode: 'kill', event: 'old' },
    { type: 'decision', mode: 'wrong', event: g.battle!.event },
    { type: 'decision', mode: 'ignore', event: g.battle!.event, extra: 1 },
  ])
    assert.throws(() => applyAction(g, 'p', action));
  assert.throws(() =>
    applyAction(g, 'q', {
      type: 'decision',
      event: g.battle!.event,
      mode: 'kill',
    }),
  );
  assert.deepEqual(g, before);
  assert.deepEqual(normalizeAutomaticGame(JSON.parse(JSON.stringify(g))), g);
  g = mode(JSON.parse(JSON.stringify(g)), 'kill');
  for (const p of g.players)
    assert.equal(viewGame(g, p.id).battle!.stoneBurner.p, 'kill');
  assert.throws(() => mode(g, 'ignore'));
  assert.equal(g.players[0].spice, 20);
  assert.equal(g.players[0].leaders[0].deaths, 0);
  g = finish(JSON.parse(JSON.stringify(g)));
  assert.equal(g.players[0].leaders[0].deaths, 1);
  assert.equal(g.players[1].leaders[0].deaths, 1);
  const after = structuredClone(g);
  assert.deepEqual(normalizeAutomaticGame(g), after);
});

void test('reserved Stone custody corruption fails before mutation in action and automatic recovery', () => {
  const g = reveal(fixture());
  for (const corrupt of ['missing', 'duplicate', 'mode'] as const) {
    const damaged = structuredClone(g);
    if (corrupt === 'missing') damaged.players[0].hand = [];
    if (corrupt === 'duplicate')
      damaged.discard.push(damaged.players[0].hand[0]);
    if (corrupt === 'mode') damaged.battle!.stoneBurner = { q: 'kill' };
    const before = structuredClone(damaged);
    assert.throws(() => mode(damaged, 'kill'), /Stone Burner/);
    assert.throws(() => normalizeAutomaticGame(damaged), /Stone Burner/);
    assert.deepEqual(damaged, before);
  }
});
