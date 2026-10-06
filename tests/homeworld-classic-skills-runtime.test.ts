import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, type Action, type Game } from '../game/engine';
import { DIFFICULTIES } from '../game/bot-profiles';
import type { FactionId } from '../game/catalog';
import { LEADER_SKILL_CARDS } from '../game/leader-skill-cards';
import { homeworldContext } from '../game/homeworld-game';
import { homeworldForceGroups } from '../game/homeworld-custody';
import type { HomeworldCombatLossContext } from '../game/homeworld-combat-loss';
import { quoteSukPhysicalRescue, type SukReserveDestinations } from '../game/suk-graduate';
import {
  advanceClassicHomeworldSkills as advance, assertClassicHomeworldSkillsCustody as custody,
  classicHomeworldSkillsBotOffers as offers, classicHomeworldSkillsPlayer as player,
  createClassicHomeworldSkillsFixture as fixture, createClassicHomeworldSkillsSetup as setup,
  quoteClassicHomeworldSkillsBattle as quoteBattle, revealClassicHomeworldSkillsBattle as reveal,
  settleClassicHomeworldSkillsBattle as settle,
} from './fixture-homeworld-classic-skills';

function legalOffers(game: Game, actor: string): void {
  for (const level of DIFFICULTIES) {
    const actions = offers(game, actor, level); assert.ok(actions.length, `${level} has a real supported offer`);
    for (const action of actions) custody(applyAction(game, actor, action));
  }
}
function context(game: Game): HomeworldCombatLossContext {
  return { advanced: game.advanced, players: game.players.map(p => {
    const total = Object.values(p.forces).reduce((a, b) => a + b, 0);
    const elite = Object.values(p.elites?.forces ?? {}).reduce((a, b) => a + b, 0);
    return { id: p.id, faction: p.faction, reserves: p.reserves, eliteReserves: p.elites?.reserves ?? 0,
      tanks: p.tanks, eliteTanks: p.elites?.tanks ?? 0, battleLosses: p.battleLosses,
      boardForces: { normal: total - elite, elite } };
  }) };
}
function pool(game: Game, actor: string, location: string) {
  return homeworldForceGroups(homeworldContext(game), game.homeworlds!.custody!)
    .find(home => home.id === location)!.forces[actor] ?? { normal: 0, elite: 0 };
}
function reject(game: Game, actor: string, action: Action): void {
  const before = structuredClone(game); assert.throws(() => applyAction(game, actor, action)); assert.deepEqual(game, before);
}
function rescueChoice(game: Game, elite: boolean): number {
  const decision = game.decision; assert.equal(decision?.kind, 'sukRescue');
  if (decision?.kind !== 'sukRescue') throw Error('A real rescue choice is required');
  const maximum = Math.max(...decision.options.map(option => option.normal + option.elite));
  const choice = decision.options.findIndex(option => option.normal + option.elite === maximum &&
    (elite ? option.elite > 0 && option.kept?.kind === 'elite' : option.kept?.kind === 'normal'));
  assert.ok(choice >= 0); return choice;
}
function splitReturn(game: Game, choice: number): SukReserveDestinations | undefined {
  const decision = game.decision; assert.ok(decision?.kind === 'sukRescue');
  if (!decision.reserveHomes) return undefined;
  const option = decision.options[choice];
  const normal = option.normal - (option.kept?.kind === 'normal' ? 1 : 0);
  const elite = option.elite - (option.kept?.kind === 'elite' ? 1 : 0);
  if (!normal && !elite) return undefined;
  // Deliberately NOT the revival mapping: any returned ordinary pieces go to
  // Salusa and any returned Sardaukar go to Kaitain. This application placement
  // choice exercises exact two-home conservation, not a publisher ruling.
  return Object.fromEntries(decision.reserveHomes.map(home => [home.id,
    home.secondary ? { normal, elite: 0 } : { normal: 0, elite }]));
}

void test('original Basic/Advanced two-through-six classic Homeworld setups retain starting hands and all fourteen physical skills', () => {
  const roster: FactionId[] = ['emperor', 'guild', 'atreides', 'harkonnen', 'fremen', 'beneGesserit'];
  for (const advanced of [false, true]) for (let seats = 2; seats <= 6; seats++) {
    const f = setup({ advanced, roster: roster.slice(0, seats) });
    const physical = f.offered.leaderSkills!;
    assert.deepEqual([...physical.deck, ...Object.values(physical.offers).flatMap(o => o.cards), ...physical.assignments.map(a => a.skill)].sort(), LEADER_SKILL_CARDS.map(c => c.id).sort());
    for (const p of f.afterSetup.players) {
      assert.equal(p.hand.length, p.faction === 'harkonnen' ? 2 : 1);
    }
    for (const p of f.offered.players) legalOffers(f.offered, p.id);
    custody(f.offered); custody(f.afterSetup);
  }
});

void test('every physical skill remains selectable through actual Emperor offers', () => {
  for (const advanced of [false, true]) for (const card of LEADER_SKILL_CARDS) {
    const f = setup({ advanced, roster: ['emperor', 'guild'], skill: card.id });
    assert.equal(f.afterSetup.leaderSkills!.assignments.find(a => a.owner === 'emperor')!.skill, card.id);
    legalOffers(f.offered, 'emperor');
    custody(f.afterSetup);
  }
});


for (const advanced of [false, true]) {
  void test(`${advanced ? 'Advanced' : 'Basic'} trained native and invader add the actual Mentat bonus without turning native strength into counters`, () => {
    for (const kind of ['native-bonus', 'visitor-bonus'] as const) {
      const f = fixture({ kind, advanced });
      for (const actor of [f.owner, f.opponent]) legalOffers(f.game, actor);
      const revealed = reveal(f), quote = quoteBattle(revealed);
      const own = revealed.battle!.attacker === f.owner ? 'attacker' : 'defender';
      const leader = player(revealed, f.owner).leaders.find(l => l.id === f.trainer)!;
      const alternative = player(f.game, f.owner).leaders.find(disc => disc.id !== f.trainer && !disc.dead)!;
      const untrained = reveal({ ...f, plans: f.plans.map(step => step.actor === f.owner
        ? { ...step, action: { ...step.action, leader: alternative.id } } : step) });
      const untrainedQuote = quoteBattle(untrained);
      assert.equal(quote.scores![own] - untrainedQuote.scores![own], leader.strength - alternative.strength + 2);
      const beforePool = pool(revealed, f.owner, f.territory);
      const completed = settle(revealed);
      assert.equal(completed.lastBattleContext!.winner, f.owner);
      const losses = player(completed, f.owner).tanks - player(revealed, f.owner).tanks;
      const afterPool = pool(completed, f.owner, f.territory);
      assert.equal(beforePool.normal + beforePool.elite - afterPool.normal - afterPool.elite, losses);
      assert.equal(player(completed, f.owner).leaders.find(l => l.id === f.trainer)!.dead, false);
      custody(completed);
    }
  });

  void test(`${advanced ? 'Advanced' : 'Basic'} actual lethal native and invader plans kill the trained disc and return its one physical skill exactly once`, () => {
    for (const kind of ['native-death', 'visitor-death'] as const) {
      const f = fixture({ kind, advanced }), revealed = reveal(f);
      assert.equal(quoteBattle(revealed).leaderDeaths[revealed.battle!.attacker === f.owner ? 'attacker' : 'defender'], true);
      const done = settle(revealed);
      assert.equal(player(done, f.owner).leaders.find(l => l.id === f.trainer)!.dead, true);
      assert.ok(!done.leaderSkills!.assignments.some(a => a.leader === f.trainer));
      assert.equal(done.leaderSkills!.deck.filter(id => id === 'mentat').length, 1);
      const ended = advance(done, game => game.turn > done.turn);
      assert.equal(ended.leaderSkills!.deck.filter(id => id === 'mentat').length, 1);
      custody(done); custody(ended);
    }
  });

  void test(`${advanced ? 'Advanced' : 'Basic'} native Homeworld trained Suk saves actual counters in their same reserve pool`, () => {
    const f = fixture({ kind: 'native-suk', advanced }), revealed = reveal(f), pending = settle(revealed, 'suk');
    assert.equal(pending.pendingSukRescue!.territory, f.territory);
    assert.equal(pending.pendingSukRescue!.skill.mode, 'skilled');
    assert.equal(pending.pendingSukRescue!.pool.length, 1);
    const choice = rescueChoice(pending, advanced);
    assert.ok(pending.decision?.kind === 'sukRescue');
    assert.equal(pending.decision.reserveHomes, undefined, 'Native rescue cannot offer a free Emperor internal move');
    legalOffers(pending, f.owner);
    const before = pool(pending, f.owner, f.territory), option = pending.decision.options[choice];
    reject(pending, f.owner, { type: 'decision', event: pending.decision.event, choice,
      destinations: { 'homeworld:emperor': { normal: advanced ? 0 : 1, elite: advanced ? 1 : 0 } } });
    const done = applyAction(JSON.parse(JSON.stringify(pending)), f.owner, { type: 'decision', event: pending.decision.event, choice });
    const completed = settle(done), after = pool(completed, f.owner, f.territory);
    assert.equal(before.normal - after.normal, pending.pendingSukRescue!.losses!.normal - option.normal);
    assert.equal(before.elite - after.elite, pending.pendingSukRescue!.losses!.elite - option.elite);
    if (advanced) assert.deepEqual(completed.homeworlds!.custody!.salusa, pending.homeworlds!.custody!.salusa,
      'Three dialed native Sardaukar saved at Salusa never leave Salusa or duplicate their reserve totals');
    custody(completed);
  });

  void test(`${advanced ? 'Advanced' : 'Basic'} visitor Homeworld and Arrakis trained Suk conserve typed casualties, board/visitor pools and native return allocations`, () => {
    for (const kind of ['visitor-suk', 'arrakis-suk'] as const) {
      const f = fixture({ kind, advanced }), revealed = reveal(f);
      let pending = settle(revealed, 'suk');
      assert.ok(pending.decision?.kind === 'sukRescue');
      const choice = rescueChoice(pending, false), option = pending.decision.options[choice];
      const destinations = splitReturn(pending, choice), original = pending.pendingSukRescue!;
      assert.equal(original.skill.mode, 'skilled');
      if (advanced) assert.equal(pending.decision.reserveHomes?.length, 2);
      if (advanced) {
        assert.equal(original.losses!.normal, 2);
        assert.equal(original.losses!.elite, 1);
      }
      legalOffers(pending, f.owner);
      const physical = quoteSukPhysicalRescue(context(pending), pending.homeworlds!.custody!, {
        player: f.owner, territory: f.territory, skill: original.skill, pool: original.pool,
        losses: original.losses!, option, destinations,
      });
      assert.equal(physical.receipt.source, kind === 'visitor-suk' ? 'visitor-homeworld' : 'arrakis');
      if (advanced) {
        const incomplete = { 'homeworld:emperor': { normal: 0, elite: 0 } };
        reject(pending, f.owner, { type: 'decision', event: pending.decision.event, choice, destinations: incomplete });
        reject(pending, f.owner, { type: 'decision', event: pending.decision.event, choice, destinations: { 'homeworld:guild': { normal: 2, elite: 0 } } });
        reject(pending, f.owner, { type: 'decision', event: pending.decision.event, choice });
      }
      const before = player(pending, f.owner);
      pending = applyAction(JSON.parse(JSON.stringify(pending)), f.owner, { type: 'decision', event: pending.decision.event, choice, ...(destinations ? { destinations } : {}) });
      const done = settle(pending), after = player(done, f.owner);
      assert.equal(after.tanks - before.tanks, original.losses!.normal + original.losses!.elite - option.normal - option.elite);
      assert.deepEqual(done.homeworlds!.custody, physical.custody);
      assert.equal(after.reserves, physical.players.find(p => p.id === f.owner)!.reserves);
      assert.equal(after.elites?.reserves, physical.players.find(p => p.id === f.owner)!.eliteReserves);
      assert.equal(done.pendingSukRescue ?? null, null);
      custody(done);
    }
  });

  void test(`${advanced ? 'Advanced' : 'Basic'} real empty-territory Smuggler shipment withdraws six physical counters priced as five and presents the actual Bureaucrat payer invoice`, () => {
    const f = fixture({ kind: 'smuggler-payment', advanced });
    const before = f.beforeShipment!, after = f.afterShipment!;
    assert.equal(player(after, f.owner).reserves, player(before, f.owner).reserves - 6);
    assert.equal(player(after, f.owner).spice, player(before, f.owner).spice - 5);
    assert.equal(Object.values(player(after, f.owner).forces).reduce((a, b) => a + b, 0), 6);
    if (advanced) assert.equal(player(after, f.owner).elites!.reserves, player(before, f.owner).elites!.reserves - 2);
    legalOffers(before, f.owner);
    const invoice = advance(after, game => game.decision?.kind === 'bureaucratPayment');
    const payment = invoice.bureaucratPayments!.pending!.source;
    assert.equal(payment.kind, 'shipment'); assert.equal(payment.payer, f.owner);
    assert.equal(payment.payee, f.opponent); assert.equal(payment.amount, 5);
    const bureaucrat = invoice.decision!.player;
    assert.notEqual(bureaucrat, payment.payer); assert.notEqual(bureaucrat, payment.payee);
    legalOffers(invoice, bureaucrat);
    const paid = applyAction(JSON.parse(JSON.stringify(invoice)), bureaucrat, { type: 'decision', event: invoice.decision!.kind === 'bureaucratPayment' ? invoice.decision!.event : '', redirect: true });
    const done = advance(paid, game => !game.response && !game.decision && !game.phaseOpening);
    assert.equal(player(done, f.opponent).spice, player(before, f.opponent).spice + 3);
    assert.equal(player(done, f.owner).spice, player(before, f.owner).spice - 5);
    assert.equal(done.bureaucratPayments!.used.length, 1);
    assert.deepEqual(player(done, f.owner).forces, player(after, f.owner).forces, 'Invoice settlement cannot replay physical arrival');
    custody(done);
  });
}
