import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAction,
  createGame,
  initializeBaseGameForAudit,
  joinGame,
  newPlayer,
  viewGame,
  type Action,
  type Game,
} from '../game/engine';
import { recruitsPlayAction } from '../game/recruits';
import { normalRevivalAllowance, newRevivalRules } from '../game/revival';
import { botActions } from '../game/bots';
import { recruitsGame } from './fixture-recruits';

const play = { type: 'card', card: 'ecaz-recruits' } as const;
function rejectUnchanged(g: Game, player: string, action: Action = play) {
  const before = structuredClone(g);
  assert.throws(() => applyAction(g, player, action));
  assert.deepEqual(g, before);
}
function physical(g: Game) {
  return [
    ...g.deck,
    ...g.discard,
    ...g.players.flatMap((player) => player.hand),
    ...(g.ixSetupCards ?? []),
    ...(g.ixAuction?.cards ?? []),
    ...(g.auction?.cards.slice(g.auction.index) ?? []),
  ];
}
function settleRevival(state: Game) {
  let g = state;
  for (let step = 0; g.pendingRevival && step < 20; step++) {
    let next: Game | undefined;
    for (const player of g.players) {
      const view = viewGame(g, player.id);
      view.players.find((candidate) => candidate.id === player.id)!.bot = 'Medium';
      const action = botActions(view)[0];
      if (action) {
        next = applyAction(g, player.id, action);
        break;
      }
    }
    assert.ok(next, 'Pending revival must retain a legal continuation.');
    g = next;
  }
  assert.equal(g.pendingRevival, null);
  return g;
}

void test('genuine Basic and Advanced setup owns exactly one of all three independent cards and projects only the holder play', () => {
  for (const advanced of [false, true]) {
    const g = recruitsGame(advanced);
    const cards = physical(g).filter((card) => card.id.startsWith('ecaz-'));
    assert.deepEqual(cards.map((card) => card.id).sort(), [
      'ecaz-harass-withdraw',
      'ecaz-recruits',
      'ecaz-reinforcements',
    ]);
    const owner = g.players.find((player) => player.hand.some((card) => card.id === play.card))!;
    for (const player of g.players) {
      const preview = viewGame(g, player.id).recruitsPreview;
      assert.ok(preview);
      assert.equal(preview.active, false);
      assert.deepEqual(
        recruitsPlayAction(preview),
        player.id === owner.id ? play : null,
      );
      assert.equal(preview.play === null, player.id !== owner.id);
    }
  }
});

void test('playing Recruits discards its exact card and publishes effective rates and independent limits', () => {
  for (const advanced of [false, true]) {
    const before = recruitsGame(advanced);
    const g = applyAction(before, 'ch', play);
    assert.deepEqual(g.recruits, { turn: 2, player: 'ch', card: play.card });
    assert.equal(g.players.find((player) => player.id === 'ch')!.hand.some((card) => card.id === play.card), false);
    assert.equal(g.discard.filter((card) => card.id === play.card).length, 1);
    const preview = viewGame(JSON.parse(JSON.stringify(g)), 'at').recruitsPreview!;
    assert.deepEqual(
      Object.fromEntries(preview.rates.map((row) => [row.player, [row.freeRate, row.limit]])),
      { at: [4, 7], fr: [6, 7], tl: [4, 20], ch: [0, 20] },
    );
    assert.equal(preview.active, true);
    assert.equal(preview.playedBy, 'ch');
    assert.equal(preview.grantRevivalBlocked?.includes('before Recruits'), true);
  }
});

void test('the accepted card changes the authoritative normal revival quote and free ledger', () => {
  let g = applyAction(recruitsGame(true), 'ch', play);
  const player = g.players.find((candidate) => candidate.id === 'at')!;
  const before = { reserves: player.reserves, tanks: player.tanks, spice: player.spice };
  g = settleRevival(applyAction(g, player.id, { type: 'revive', amount: 4, elite: 0 }));
  const after = g.players.find((candidate) => candidate.id === player.id)!;
  assert.equal(after.reserves, before.reserves + 4);
  assert.equal(after.tanks, before.tanks - 4);
  assert.equal(after.spice, before.spice);
  assert.equal(after.revived, 4);
  assert.equal(after.freeForcesRevived, 4);
  assert.equal(viewGame(g, player.id).revival.forcesRemaining, 3);
  rejectUnchanged(g, player.id, { type: 'revive', amount: 4, elite: 0 });
});

void test('free prevention remains zero and canceled unlimited faction caps compose to seven', () => {
  const g = recruitsGame();
  g.revivalRules = {
    ...newRevivalRules(),
    freeBlocked: ['at'],
    choamBlocked: true,
    limitBlocked: true,
  };
  const active = applyAction(g, 'ch', play);
  const rows = Object.fromEntries(
    viewGame(active, 'at').recruitsPreview!.rates.map((row) => [row.player, row]),
  );
  assert.equal(rows.at.freeRate, 0);
  assert.equal(rows.at.limit, 7);
  assert.equal(rows.tl.limit, 7);
  assert.equal(rows.ch.limit, 7);
});

void test('prior settled Fremen ally grant is doubled, while a grant after activation rejects immutably', () => {
  let g = recruitsGame();
  const fremen = g.players.find((player) => player.id === 'fr')!;
  const atreides = g.players.find((player) => player.id === 'at')!;
  fremen.ally = atreides.id;
  atreides.ally = fremen.id;
  g = applyAction(g, fremen.id, { type: 'grantRevival' });
  g = applyAction(g, 'ch', play);
  assert.deepEqual(
    viewGame(g, 'at').recruitsPreview!.rates.find((row) => row.player === 'at'),
    { player: 'at', freeRate: 6, limit: 7 },
  );

  const late = recruitsGame();
  late.players.find((player) => player.id === 'fr')!.ally = 'at';
  late.players.find((player) => player.id === 'at')!.ally = 'fr';
  const active = applyAction(late, 'ch', play);
  rejectUnchanged(active, 'fr', { type: 'grantRevival' });
});

void test('activation rejects pending, prior paid, unknown and inconsistent revival histories without consuming the card', () => {
  const cases = [
    (g: Game) => {
      g.decision = { kind: 'revivalStop', player: 'at', recipient: 'at', revival: 'forces' };
    },
    (g: Game) => { const p = g.players[0]; p.revived = 2; p.freeForcesRevived = 1; },
    (g: Game) => { const p = g.players[0]; p.revived = 1; delete p.freeForcesRevived; },
    (g: Game) => { const p = g.players[0]; p.revived = 1; p.freeForcesRevived = 2; },
  ];
  for (const arrange of cases) {
    const g = recruitsGame();
    arrange(g);
    assert.ok(viewGame(g, 'ch').recruitsPreview!.play?.blocked);
    rejectUnchanged(g, 'ch');
  }
});

void test('same-turn Box recovery cannot replay or consume Recruits', () => {
  const g = applyAction(recruitsGame(), 'ch', play);
  const card = g.discard.find((candidate) => candidate.id === play.card)!;
  g.discard = g.discard.filter((candidate) => candidate.id !== play.card);
  g.players.find((player) => player.id === 'ch')!.hand.push(card);
  assert.equal(viewGame(g, 'ch').recruitsPreview!.play?.blocked?.includes('already active'), true);
  rejectUnchanged(g, 'ch');
});

void test('a ready owner may still play before Revival closes, and the receipt expires on the next turn', () => {
  let g = recruitsGame();
  for (const player of g.players) {
    player.reserves += Object.values(player.forces).reduce((sum, amount) => sum + amount, 0);
    player.forces = {};
    if (player.elites) {
      player.elites.reserves += Object.values(player.elites.forces).reduce((sum, amount) => sum + amount, 0);
      player.elites.forces = {};
    }
    if (player.advisors) player.advisors = {};
  }
  g.ready = ['ch'];
  g = applyAction(g, 'ch', play);
  assert.equal(g.recruits?.turn, 2);
  for (let step = 0; g.status === 'playing' && g.turn === 2 && step < 1000; step++) {
    let next: Game | undefined;
    for (const player of g.players) {
      const view = viewGame(g, player.id);
      view.players.find((candidate) => candidate.id === player.id)!.bot = 'Medium';
      const action = botActions(view)[0];
      if (action) {
        next = applyAction(g, player.id, action);
        break;
      }
    }
    assert.ok(next, 'The active effect must retain a legal path to turn end.');
    g = next;
  }
  assert.equal(g.turn, 3);
  assert.equal(g.recruits, null);
  assert.equal(viewGame(g, 'at').recruitsPreview?.active, false);
});

void test('legacy known-zero ledgers are initialized atomically when Recruits is accepted', () => {
  const g = recruitsGame();
  for (const player of g.players) delete player.freeForcesRevived;
  const active = applyAction(g, 'ch', play);
  assert.ok(active.players.every((player) => player.freeForcesRevived === 0));
  assert.doesNotThrow(() => viewGame(JSON.parse(JSON.stringify(active)), 'at'));
});

void test('a sold Recruits card is counted once while its normal auction continuation is open', () => {
  const g = recruitsGame();
  const card = g.players.find((player) => player.id === 'ch')!.hand.find((candidate) => candidate.id === play.card)!;
  g.phase = 3;
  g.auction = { cards: [card], index: 0, bid: 1, bidder: 'ch', active: 'ch', passed: [], opener: 0, peekKnown: false };
  g.currentAuctionSale = { winner: 'ch', amount: 1, free: false, origin: 'normal', seller: null };
  g.response = { kind: 'harkonnenBonus', owner: 'ch', passed: [] };
  assert.doesNotThrow(() => viewGame(g, 'at'));
});

void test('ordinary audit setup cannot silently activate a forged Ecaz variant marker', () => {
  const lobby = createGame('NOECAZV', newPlayer('at', 'Atreides', 'atreides'));
  joinGame(lobby, newPlayer('fr', 'Fremen', 'fremen'));
  for (const player of lobby.players) player.ready = true;
  lobby.ecazTreachery = true;
  rejectUnchanged(lobby, 'at', { type: 'start' });
  assert.throws(() => initializeBaseGameForAudit(lobby), /audit initializer supports/);
});

void test('ordinary revival math remains unchanged while Recruits is inactive', () => {
  const g = recruitsGame();
  const player = g.players.find((candidate) => candidate.id === 'at')!;
  g.revivalRules = newRevivalRules();
  g.freeRevival = [player.id];
  player.revived = 2;
  player.freeForcesRevived = 0;
  assert.equal(normalRevivalAllowance(g, player).freeRemaining, 1);
  g.recruits = { turn: g.turn, player: 'ch', card: 'ecaz-recruits' };
  assert.equal(normalRevivalAllowance(g, player).freeRemaining, 5);
});

void test('preview rejects missing, duplicate and forged physical variant cards', () => {
  for (const corrupt of [
    (g: Game) => { g.deck = g.deck.filter((card) => card.id !== 'ecaz-reinforcements'); },
    (g: Game) => { g.deck.push({ ...physical(g).find((card) => card.id === 'ecaz-harass-withdraw')! }); },
    (g: Game) => {
      const card = physical(g).find((candidate) => candidate.id === 'ecaz-reinforcements')!;
      card.effect = 'recruits';
    },
  ]) {
    const g = recruitsGame();
    corrupt(g);
    assert.throws(() => viewGame(g, 'at'), /inventory/);
  }
});

void test('seat-control changes cannot persist a malformed variant save', () => {
  const g = recruitsGame();
  g.deck = g.deck.filter((card) => card.id !== 'ecaz-reinforcements');
  rejectUnchanged(g, 'at', { type: 'setAutopilot', difficulty: 'Medium' });
});
