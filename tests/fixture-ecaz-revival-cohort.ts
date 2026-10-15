import assert from 'node:assert/strict';
import { viewGame, type Game } from '../game/engine';
import { TERRITORIES } from '../game/board';
import {
  advanceNexusDuke, assertNexusDukeCustody, closeNexusDukeDraw,
  createNexusDukeCaptureFixture, createNexusDukeDeathFixture, nexusDukeClean, nexusDukePlayer,
  openNexusDukeBattle, sealNexusDukeBattle, stepNexusDuke,
  type NexusDukePlan, type NexusDukeStep,
} from './fixture-nexus-duke-capture';

type Transition = { before: Game; after: Game; leader: string };
export type NativeEcazCohortFixture = {
  game: Game; owner: string; captor: string; plan: NexusDukePlan; actions: NexusDukeStep[];
  deaths: Transition[]; funding: { before: Game; after: Game; amount: number };
  first: Transition; repeat: Transition;
};

function poisonDeath(game: Game, context: Pick<NativeEcazCohortFixture, 'owner' | 'captor' | 'plan' | 'actions'>,
  leader: string, territory = 'imperial_basin'): Transition {
  const { owner, captor, plan, actions } = context;
  // Choose after the real next Storm; a storm-separated target can otherwise
  // skip that entire Battle phase and run this bounded chronology past turn ten.
  if (game.phase > 6)
    game = advanceNexusDuke(game, g => g.phase === 4 && nexusDukeClean(g), plan, actions);
  if (territory === 'imperial_basin') {
    const usable = (target: typeof TERRITORIES[number]) => target.type === 'sand' &&
      !target.sectors.includes(game.storm) &&
      !game.players.some(p => p.id !== owner && p.id !== captor &&
        Object.entries(p.forces).some(([key, amount]) => amount > 0 && key.startsWith(`${target.id}:`)));
    const target = TERRITORIES.find(t => t.id === territory && usable(t)) ?? TERRITORIES.find(usable);
    assert.ok(target, 'The original board must offer an uncontested non-storm desert for both shipments.');
    territory = target.id;
  }
  plan.ship = { [owner]: { territory, amount: 1 }, [captor]: { territory, amount: 1 } };
  const battle = openNexusDukeBattle(game, plan, actions, { territory, first: owner, second: captor });
  const poison = nexusDukePlayer(battle.game, captor).hand.find(c => c.kind === 'poison');
  assert.ok(poison, 'The original winning Harkonnen hand retains its dealt poison.');
  const enemy = nexusDukePlayer(battle.game, captor).leaders
    .filter(l => !l.dead).sort((a, b) => a.strength - b.strength)[0];
  assert.ok(enemy);
  const before = structuredClone(battle.game);
  const revealed = sealNexusDukeBattle(battle.game, plan, actions, [
    { actor: owner, leader, dial: 0, support: 0 },
    { actor: captor, leader: enemy.id, dial: 0, support: 0, weapon: poison.id },
  ]);
  const after = advanceNexusDuke(revealed, g => !g.battle && nexusDukeClean(g), plan, actions);
  assert.equal(nexusDukePlayer(after, owner).leaders.find(l => l.id === leader)!.dead, true);
  assertNexusDukeCustody(after);
  return { before, after, leader };
}

/** No death/history/hand/wallet assignment: original setup deal, five native
 * poison deaths, a paid return and that same disc's real repeat death. */
export function createNativeEcazCohortFixture(): NativeEcazCohortFixture {
  const f = createNexusDukeCaptureFixture({ variant: 'unused', deal: faction =>
    faction === 'harkonnen' ? ['worthless', 'poison'] : ['worthless'] });
  const { owner, captor, plan, actions } = f;
  plan.capture = 'decline';
  const closing = closeNexusDukeDraw(f.game, plan, actions);
  const native = nexusDukePlayer(closing.game, owner).leaders
    .slice().sort((a, b) => a.strength - b.strength).map(l => l.id);
  let game = closing.game;
  const kill = (leader: string): Transition => {
    const result = poisonDeath(game, f, leader);
    game = result.after;
    return result;
  };
  const deaths = native.map(kill);
  assert.ok(nexusDukePlayer(game, owner).leaders.every(l => l.dead && l.deaths === 1));
  game = advanceNexusDuke(game, g => g.phase === 7 && nexusDukeClean(g), plan, actions);
  const fundingBefore = structuredClone(game), amount = 15;
  assert.ok(nexusDukePlayer(game, captor).spice >= amount);
  game = stepNexusDuke(game, plan, { actor: captor,
    action: { type: 'bribe', target: owner, amount } }, actions);
  const funding = { before: fundingBefore, after: structuredClone(game), amount };
  game = advanceNexusDuke(game, g => g.phase === 4 && nexusDukeClean(g), plan, actions);
  const firstBefore = structuredClone(game);
  const firstLeader = native[0];
  assert.ok(viewGame(game, owner).revival.leaders.some(l => l.id === firstLeader));
  game = stepNexusDuke(game, plan, { actor: owner,
    action: { type: 'reviveLeader', leader: firstLeader } }, actions);
  const first = { before: firstBefore, after: structuredClone(game), leader: firstLeader };
  const repeat = kill(firstLeader);
  game = advanceNexusDuke(game, g => g.phase === 4 && nexusDukeClean(g), plan, actions);
  plan.ship = {};
  assert.equal(nexusDukePlayer(game, owner).leaders.find(l => l.id === firstLeader)!.deaths, 2);
  assertNexusDukeCustody(game);
  return { game, owner, captor, plan, actions, deaths, funding, first, repeat };
}

export type NativeEcazSecondCohortFixture = Pick<NativeEcazCohortFixture, 'game' | 'owner' | 'captor' | 'plan' | 'actions'> & {
  dukeDeath: Game; deaths: Transition[]; paid: Transition[]; repeats: Transition[];
  ghola: Transition; funding: { before: Game; after: Game; amount: number };
};

/** The original Duke and four native discs die; three native paid returns and
 * one actual Ghola complete the cohort. All four then really die again, within
 * the original ten-turn limit. The never-killed fifth native remains alive. */
export function createNativeEcazSecondCohortFixture(): NativeEcazSecondCohortFixture {
  const death = createNexusDukeDeathFixture({ deal: faction => faction === 'ecaz' ? ['ghola']
    : faction === 'harkonnen' ? ['worthless', 'poison'] : ['worthless'] });
  const { owner, captor, plan, actions } = death;
  plan.capture = 'decline';
  const native = nexusDukePlayer(death.window, owner).leaders
    .slice().sort((a, b) => a.strength - b.strength).map(l => l.id);
  let game = death.window;
  const deaths: Transition[] = [];
  for (let i = 0; i < 4; i++) {
    const result = poisonDeath(game, death, native[i], i === 0 ? 'carthag' : 'imperial_basin');
    deaths.push(result);
    game = result.after;
  }
  game = advanceNexusDuke(game, g => g.phase === 7 && nexusDukeClean(g), plan, actions);
  const fundingBefore = structuredClone(game), amount = 25;
  assert.ok(nexusDukePlayer(game, captor).spice >= amount);
  game = stepNexusDuke(game, plan, { actor: captor,
    action: { type: 'bribe', target: owner, amount } }, actions);
  const funding = { before: fundingBefore, after: structuredClone(game), amount };
  const paid: Transition[] = [], repeats: Transition[] = [];
  let ghola!: Transition;
  for (let i = 0; i < 3; i++) {
    game = advanceNexusDuke(game, g => g.phase === 4 && nexusDukeClean(g), plan, actions);
    const before = structuredClone(game);
    game = stepNexusDuke(game, plan, { actor: owner,
      action: { type: 'reviveLeader', leader: native[i] } }, actions);
    paid.push({ before, after: structuredClone(game), leader: native[i] });
    if (i === 2) {
      const card = nexusDukePlayer(game, owner).hand.find(c => c.effect === 'ghola');
      assert.ok(card);
      const before = structuredClone(game);
      game = stepNexusDuke(game, plan, { actor: owner,
        action: { type: 'card', card: card.id, leader: native[3] } }, actions);
      ghola = { before, after: structuredClone(game), leader: native[3] };
    }
    const repeated = poisonDeath(game, death, native[i]);
    repeats.push(repeated);
    game = repeated.after;
  }
  const last = poisonDeath(game, death, native[3]);
  repeats.push(last);
  game = advanceNexusDuke(last.after, g => g.phase === 4 && nexusDukeClean(g), plan, actions);
  plan.ship = {};
  assert.equal(nexusDukePlayer(game, owner).leaders.find(l => l.id === native[4])!.dead, false);
  assert.equal(game.dukeVidal!.leader.dead, true);
  assert.equal(game.dukeVidal!.leader.deaths, 1);
  assertNexusDukeCustody(game);
  return { game, owner, captor, plan, actions, dukeDeath: death.game, deaths, paid, repeats, ghola, funding };
}
