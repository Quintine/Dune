import assert from 'node:assert/strict';
import test from 'node:test';
import { viewGame, type Action, type Game } from '../game/engine';
import type { FactionId } from '../game/catalog';
import { DIFFICULTIES } from '../game/bot-profiles';
import { leaders } from '../game/cards';
import { territory } from '../game/board';
import { TERROR_KINDS } from '../game/moritani-terror';
import {
  advanceMixedE3Moritani as advance, assertMixedE3MoritaniPhysical as physical,
  assertMixedE3MoritaniRejects as rejects, createMixedE3MoritaniProgramme as programme,
  createMixedE3MoritaniSetup as setup, mixedE3MoritaniClean as clean,
  mixedE3MoritaniCunningRequest as cunning, mixedE3MoritaniInventory as inventory,
  mixedE3MoritaniPlayer as player, mixedE3MoritaniPolicy as policy, mixedE3MoritaniReload as reload,
  mixedE3MoritaniToken as token, nextMixedE3MoritaniStep as next, quoteMixedE3MoritaniBattle as quote,
  settleMixedE3MoritaniBoundary as boundary,
  stageMixedE3MoritaniLoss as loss, stepMixedE3Moritani as step,
  type MixedE3MoritaniBoundary, type MixedE3MoritaniOptions,
} from './fixture-mixed-e3-moritani-nexus';

/** Explicit test-author physical choices; the reusable controller stops here. */
function consume(g: Game, kind: MixedE3MoritaniBoundary['kind']): Game {
  const d = g.decision; assert.ok(d, `The ${kind} boundary needs its real owner decision.`);
  if (kind === 'losses' && d.kind === 'battleLosses') {
    const elite = Math.max(...d.options.map(o => o.elite));
    return step(g, { actor: d.player, action: { type: 'decision', choice: d.options.findIndex(o => o.elite === elite) } });
  }
  if (kind === 'rescue' && d.kind === 'sukRescue')
    return step(g, { actor: d.player, action: { type: 'decision', event: d.event, choice: 0 } });
  if (kind === 'cards' && d.kind === 'battleCards')
    return step(g, { actor: d.player, action: { type: 'decision', discard: [] } });
  if (kind === 'tech' && d.kind === 'techToken')
    return step(g, { actor: d.player, action: { type: 'decision', token: d.choices[0] } });
  if (kind === 'faceDance' && d.kind === 'faceDance')
    return step(g, { actor: d.player, action: { type: 'decision', reveal: false } });
  throw Error(`The test must explicitly consume the ${d.kind} decision.`);
}

/** Every physical counter a seat owns: Tanks, reserves and board sectors. */
function totalCounters(g: Game, id: string): number {
  const seat = player(g, id);
  return seat.tanks + seat.reserves +
    Object.values(seat.forces).reduce((n, amount) => n + amount, 0);
}

/** Walk the real aftermath in order, consuming each boundary exactly once and
 * leaving the private assassination choice to `reveal`. */
function aftermath(g: Game, normalCallOwner: string | null, reveal?: (g: Game) => Game,
  callCard: string | null = null): {
  game: Game; order: MixedE3MoritaniBoundary['kind'][]; revealed: Game | null;
} {
  const order: MixedE3MoritaniBoundary['kind'][] = [];
  let revealed: Game | null = null;
  for (let n = 0; n < 16; n++) {
    const b = boundary(g, normalCallOwner, undefined, callCard); order.push(b.kind); g = b.game;
    if (b.kind === 'settled') return { game: g, order, revealed };
    if (b.kind === 'assassination') {
      const d = b.game.decision; assert.ok(d?.kind === 'moritaniAssassinate');
      g = reveal ? reveal(b.game) : step(b.game, { actor: d.player,
        action: { type: 'decision', event: d.event, decline: true } });
      revealed = g; continue;
    }
    g = consume(g, b.kind);
  }
  throw Error('The original mixed E3 aftermath did not settle.');
}

void test('original mixed E3 native Moritani admission conserves decks, marks, tokens and forces across every selected band', () => {
  const bands: MixedE3MoritaniOptions[] = [
    { rules: 'basic', families: ['ix'], skills: false },
    { rules: 'advanced', families: ['ix'], skills: false },
    { rules: 'advanced', families: ['choam'], skills: true },
    { rules: 'advanced', families: ['ix', 'choam'], skills: false, tech: true },
    { rules: 'advanced', families: ['ix', 'choam'], skills: true, strongholds: true },
    { rules: 'advanced', families: ['ix', 'choam'], skills: false, homeworlds: true, discovery: true },
  ];
  for (const options of bands) {
    const f = setup(options);
    const advanced = options.rules !== 'basic';
    assert.equal(f.afterSetup.status, 'playing');
    assert.equal(f.afterSetup.advanced, advanced);
    assert.deepEqual([...f.afterSetup.expansions].sort(), ['ecaz', ...(options.families ?? [])].sort());
    assert.equal(!!f.afterSetup.leaderSkills, !!options.skills);
    assert.equal(!!f.afterSetup.techTokens, !!options.tech);
    assert.equal(!!f.afterSetup.strongholdCards, !!options.strongholds);
    assert.equal(!!f.afterSetup.discoveries, !!options.discovery);
    assert.equal(!!f.afterSetup.homeworlds, !!options.homeworlds);
    // The Advanced native Moritani mark belongs to the mixed E3 envelope only.
    assert.equal(!!f.afterSetup.moritaniAssassinate, advanced);
    assert.deepEqual(f.afterSetup.moritaniTerror!.tokens.map(t => t.kind).sort(), [...TERROR_KINDS].sort());
    assert.equal(player(f.afterSetup, f.moritani).reserves, 14);
    assert.equal(player(f.afterSetup, f.moritani).forces[f.location], 6);
    assert.ok(player(f.afterSetup, f.moritani).traitors.includes(f.target),
      'The revealed Traitor is the card the original setup deal actually gave Moritani.');
    assert.ok(leaders(f.nativeFaction).some(l => l.id === f.target));
    if (options.families?.includes('ix'))
      assert.ok(!f.afterSetup.ixSetupCards, 'The Ixians pre-training row is consumed exactly once.');
    physical(f.afterSetup);
    // A supplied original setup keeps its own hands and offers and is never redealt.
    const continued = setup({ ...options, initial: reload(f.offered) });
    assert.deepEqual(continued.afterSetup.players.map(p => ({ id: p.id, hand: p.hand })),
      f.afterSetup.players.map(p => ({ id: p.id, hand: p.hand })));
    assert.deepEqual(continued.afterSetup.nexusCards, f.afterSetup.nexusCards);
  }
});

void test('two-through-six original seats, the combined five/six-native roster and the Harkonnen guards stay original', () => {
  const two = setup({ families: ['ix'], roster: ['moritani', 'tleilaxu'] });
  assert.equal(two.afterSetup.players.length, 2); assert.equal(two.partner, null);
  assert.equal(two.afterSetup.nexusCards!.cards!.deck.length, 12);
  physical(two.afterSetup);
  for (const count of [3, 4, 5, 6] as const) {
    const classics = (['guild', 'emperor', 'atreides', 'fremen'] as FactionId[]).slice(0, count - 2);
    const f = setup({ families: ['ix'], roster: ['moritani', 'tleilaxu', ...classics] });
    assert.equal(f.afterSetup.players.length, count); physical(f.afterSetup);
  }
  // The bare all-three-family roster keeps the original combined five/six-native entry.
  const five = setup({ families: ['ix', 'choam'], roster: ['moritani', 'ecaz', 'ixians', 'tleilaxu', 'choam'] });
  assert.equal(five.entry, 'combined'); assert.equal(five.afterSetup.players.length, 5);
  assert.equal(five.afterSetup.expansions.length, 3); physical(five.afterSetup);
  const six = setup({ families: ['ix', 'choam'],
    roster: ['moritani', 'ecaz', 'ixians', 'tleilaxu', 'choam', 'richese'] });
  assert.equal(six.entry, 'combined'); assert.equal(six.afterSetup.richeseCache!.length, 10);
  assert.ok(six.afterSetup.expansions.includes('ix'));
  physical(six.afterSetup);
  // Basic Harkonnen remains a legal classic seat; Advanced retains its guard.
  const basic = setup({ rules: 'basic', families: ['ix'], roster: ['moritani', 'tleilaxu', 'harkonnen'] });
  assert.equal(player(basic.afterSetup, basic.seats.harkonnen!).traitors.length, 4);
  assert.equal(basic.afterSetup.moritaniAssassinate, undefined);
  assert.throws(() => setup({ rules: 'advanced', families: ['ix'], roster: ['moritani', 'tleilaxu', 'harkonnen'] }));
  assert.throws(() => setup({ rules: 'basic', families: ['ix'], strongholds: true }));
});

void test('genuine turn-one/two chronology reaches a real alliance change, both Advanced Spice piles and Moritani own closing Nexus draw', () => {
  const f = programme({ rules: 'advanced', families: ['ix'], skills: false });
  assert.ok(f.firstMentat && f.alliance && f.drawing);
  assert.equal(f.firstMentat.before.turn, 1); assert.equal(f.firstMentat.after.turn, 2);
  const allies = f.alliance.players.filter(p => p.ally);
  assert.equal(allies.length, 2);
  assert.equal(allies[0].ally, allies[1].id); assert.equal(allies[1].ally, allies[0].id);
  assert.equal(player(f.alliance, f.moritani).ally, null, 'Moritani stays unallied to keep its closing qualification.');
  assert.equal(f.drawing.phase, 1);
  assert.ok(f.drawing.spiceDiscard.every(pile => pile.length > 0), 'Both original Spice piles precede the closing draw.');
  const draw = f.draws[0];
  assert.equal(draw.after.nexusCards!.cards!.hands[f.moritani], 'moritani');
  assert.equal(draw.before.nexusCards!.cards!.hands[f.moritani], null);
  assert.equal(player(draw.before, f.moritani).spice, player(draw.after, f.moritani).spice,
    'The original Nexus draw invents no bank income.');
  rejects(draw.after, f.moritani, draw.step.action);
  inventory(f.game);
});

for (const band of [
  { name: 'native E1 Ixians', natives: { ix: 'ixians' } as const, families: ['ix'] as const, skills: false },
  { name: 'native E2 CHOAM', natives: { choam: 'choam' } as const, families: ['choam'] as const, skills: false },
  { name: 'native E1 Tleilaxu with all14 skills', natives: { ix: 'tleilaxu' } as const, families: ['ix'] as const, skills: true },
] as const) void test(`Advanced Moritani loss to ${band.name} reveals a different original held faction Traitor, pays its printed bounty and replaces it once`, () => {
  const f = programme({ rules: 'advanced', families: [...band.families], natives: { ...band.natives }, skills: band.skills });
  assert.ok(f.firstMentat && f.alliance);
  const battle = loss(f, f.game);
  assert.equal(battle.target, f.target);
  assert.notEqual(battle.enemyLeader, f.target, 'The opposed disc is always a different leader.');
  assert.equal(quote(battle.revealed).winner, f.native, 'The selected native wins the real battle.');
  const revealedState = battle.revealed;
  const targetLeader = player(revealedState, f.native).leaders.find(l => l.id === f.target)!;
  assert.equal(targetLeader.dead, false);
  let chosen: Game | undefined;
  const walk = aftermath(revealedState, band.skills ? null : f.moritani, boundaryGame => {
    const d = boundaryGame.decision; assert.ok(d?.kind === 'moritaniAssassinate');
    const action: Action = { type: 'decision', event: d.event, card: f.target };
    rejects(boundaryGame, f.native, action);
    rejects(boundaryGame, f.moritani, { ...action, event: 'stale-assassination' });
    rejects(boundaryGame, f.moritani, { ...action, card: battle.enemyLeader });
    const at = player(boundaryGame, f.native), own = player(boundaryGame, f.moritani);
    chosen = step(boundaryGame, { actor: d.player, action });
    assert.equal(player(chosen, f.native).leaders.find(l => l.id === f.target)!.dead, true);
    assert.equal(player(chosen, f.native).leaders.find(l => l.id === f.target)!.deaths, targetLeader.deaths + 1);
    assert.equal(player(chosen, f.moritani).spice, own.spice + targetLeader.strength,
      'The printed bounty is paid once from the bank.');
    assert.equal(player(chosen, f.native).spice, at.spice);
    assert.equal(totalCounters(chosen, f.native), totalCounters(boundaryGame, f.native),
      'The assassination conserves the native’s physical counters.');
    assert.equal(totalCounters(chosen, f.moritani), totalCounters(boundaryGame, f.moritani),
      'The assassination conserves Moritani’s physical counters.');
    rejects(chosen, f.moritani, action);
    if (band.skills) {
      const skill = f.afterSetup.leaderSkills!.assignments.find(a => a.leader === f.target)!.skill;
      assert.equal(chosen.leaderSkills!.assignments.some(a => a.leader === f.target), false);
      assert.equal(chosen.leaderSkills!.deck.filter(c => c === skill).length, 1,
        'A different trained disc returns its physical skill exactly once.');
    }
    return chosen;
  });
  assert.ok(chosen, 'The Advanced native loss must open its private reveal choice.');
  if (band.skills) {
    assert.ok(walk.order.includes('assassination'), walk.order.join(','));
    assert.ok(walk.order.indexOf('assassination') < walk.order.indexOf('cards'), walk.order.join(','));
  } else assert.equal(walk.order[0], 'assassination', walk.order.join(','));
  const settled = advance(walk.game, s => s.decision?.kind === 'moritaniPlacement', f.actions);
  const receipt = settled.moritaniAssassinate!.opportunities.at(-1)!;
  assert.equal(receipt.stage, 'replaced'); assert.equal(receipt.card, f.target);
  const reserve = chosen.traitorReserve!;
  assert.equal(receipt.replacement, reserve[0]);
  assert.equal(settled.traitorReserve!.length, reserve.length - 1, 'Exactly one private Mentat replacement.');
  assert.ok(player(settled, f.moritani).traitors.includes(reserve[0]));
  assert.equal(settled.traitorReserve!.includes(f.target), false, 'The revealed card stays a public set-aside.');
  assert.equal(Object.hasOwn(viewGame(settled, f.native).moritaniAssassinate!.history.at(-1)!, 'replacement'), false,
    'The public history never carries the private Mentat replacement.');
  physical(settled);
});

void test('a normal own-card Traitor reveal forfeits the Advanced advantage for the rest of the game across later real battles', () => {
  const f = programme({ rules: 'advanced', families: ['ix'], natives: { ix: 'ixians' }, skills: false });
  assert.ok(f.firstMentat);
  const first = loss(f, f.game, { disc: 'held' });
  const won = aftermath(first.revealed, f.moritani, undefined, first.target);
  assert.equal(won.order.includes('assassination'), false, won.order.join(','));
  const g = won.game;
  assert.equal(g.lastBattleContext!.result, 'traitor');
  assert.equal(g.lastBattleContext!.winner, f.moritani);
  assert.equal(g.moritaniAssassinate!.normalTraitorCall, true);
  assert.equal(g.moritaniAssassinateCallEvents!.length, 1);
  assert.deepEqual(g.moritaniAssassinate!.opportunities, []);
  assert.ok(viewGame(g, f.moritani).moritaniAssassinate!.blocked?.includes('forfeited'));
  // A later genuine loss to the same faction still grants nothing. The disc
  // already died to the normal Traitor call, so compare its death count.
  const second = loss(f, g);
  const targetDeaths = player(g, f.native).leaders.find(l => l.id === second.target)!.deaths;
  const later = aftermath(second.revealed, null);
  assert.equal(later.order.includes('assassination'), false, later.order.join(','));
  assert.deepEqual(later.game.moritaniAssassinate!.opportunities, []);
  assert.equal(later.game.moritaniAssassinate!.normalTraitorCall, true);
  assert.equal(player(later.game, f.native).leaders.find(l => l.id === second.target)!.deaths, targetDeaths,
    'The later battle grants no second assassination.');
  physical(later.game);
});

void test('supply-only native Cunning and the real Terror arrival retain the physical token, leader and bounty', () => {
  const f = programme({ rules: 'advanced', families: ['ix'], natives: { ix: 'ixians' }, skills: false });
  assert.ok(f.firstMentat && f.alliance);
  // The native Cunning is offered only inside its own quiet window.
  let g = advance(reload(f.game), s => viewGame(s, f.moritani).nexusMoritani?.blocked === null, f.actions);
  // red_chasm has one sector; a random storm can cover it and reject the
  // committed shipment this test needs, so keep the storm off the destination.
  g.storm = 0;
  const request = cunning(g, f.moritani, 'robbery', 'red_chasm');
  rejects(g, f.native, request);
  rejects(g, f.moritani, { ...request, nexus: 'stale-cunning' });
  rejects(g, f.moritani, { type: 'decision', token: token(g, 'robbery').id, territory: 'red_chasm' });
  const before = reload(g);
  g = advance(step(g, { actor: f.moritani, action: request }),
    s => clean(s) && s.moritaniTerror!.tokens.some(t => t.kind === 'robbery' && t.status === 'placed'), f.actions);
  assert.equal(token(g, 'robbery').location, 'red_chasm');
  assert.equal(g.moritaniTerror!.placementTurn, g.turn);
  assert.equal(g.nexusCards!.cards!.hands[f.moritani], null, 'The Nexus singleton is the whole supply-only cost.');
  assert.equal(g.nexusCards!.cards!.discard.filter(c => c === 'moritani').length, 1);
  assert.equal(player(g, f.moritani).spice, player(before, f.moritani).spice, 'No bank income is invented.');
  assert.deepEqual(player(g, f.moritani).leaders, player(before, f.moritani).leaders);
  // A real enemy shipment into the declared territory opens the private arrival.
  g = advance(g, s => s.phase === 5 && s.active === f.native && clean(s), f.actions);
  g = step(g, { actor: f.native, action: { type: 'ship', territory: 'red_chasm',
    sector: territory('red_chasm').sectors[0], amount: 3, elite: 0, allyPayment: 0 } }, f.actions);
  g = advance(g, s => s.pendingTerrorEntry?.stage === 'offer', f.actions);
  assert.equal(viewGame(g, f.moritani).terrorEntry!.kind, 'robbery');
  assert.equal(viewGame(g, f.native).terrorEntry!.kind, undefined, 'The token face stays owner-private.');
  const revealed = step(step(g, { actor: f.moritani, action: { type: 'decision', reveal: true } }),
    { actor: f.moritani, action: { type: 'decision', choice: 'spice' } });
  assert.equal(revealed.pendingTerrorEntry ?? null, null);
  assert.notEqual(token(revealed, 'robbery').status, 'available');
  assert.deepEqual(player(revealed, f.moritani).leaders.map(l => l.id), player(g, f.moritani).leaders.map(l => l.id));
  const robbed = player(g, f.native).spice;
  assert.equal(player(revealed, f.moritani).spice, player(g, f.moritani).spice + Math.ceil(robbed / 2),
    'Printed Robbery transfers exactly half the entrant spice, rounded up, once.');
  assert.equal(player(revealed, f.native).spice, robbed - Math.ceil(robbed / 2));
  inventory(revealed);
});

void test('all four original policies consume the real private assassination window and rejected actions never move stock', () => {
  const f = programme({ rules: 'advanced', families: ['ix'], natives: { ix: 'ixians' }, skills: false });
  assert.ok(f.firstMentat);
  const battle = loss(f, f.game);
  let g = battle.revealed;
  for (let n = 0; n < 16; n++) {
    const b = boundary(g, f.moritani); g = b.game;
    if (b.kind === 'settled') throw Error('The Advanced loss must grant an assassination opportunity.');
    if (b.kind === 'assassination') break;
    g = consume(g, b.kind);
  }
  const d = g.decision; assert.ok(d?.kind === 'moritaniAssassinate');
  const original = reload(g);
  for (const difficulty of DIFFICULTIES) {
    const action = policy(g, f.moritani, difficulty).find(a => a.type === 'decision');
    assert.ok(action, `${difficulty} must consume the actual assassination window.`);
    rejects(g, f.native, action);
    const after = step(reload(g), { actor: f.moritani, action });
    assert.ok(['revealed', 'declined'].includes(after.moritaniAssassinate!.opportunities.at(-1)!.stage));
    assert.deepEqual(g, original, 'A rejected rival action cannot spend the original opportunity.');
  }
  assert.equal(next(g) ?? null, null, 'The private choice is never auto-consumed by the controller.');
});
