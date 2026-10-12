import assert from 'node:assert/strict';
import { handLimit, viewGame, type Action, type Game } from '../game/engine';
import { nativeShipmentSources } from '../game/homeworld-options';
import { SEMUTA_DRUG_ID } from '../game/semuta-drug';
import { semutaEmperorPlayer as player, moveSemutaEmperorCard } from './fixture-semuta-emperor-share';
import { advanceSemutaHomeworldChoam, applySemutaHomeworldChoamStep,
  createSemutaHomeworldChoamSetup, holdSemutaHomeworldChoamCard } from './fixture-semuta-homeworld-choam';
import type { RicheseSkillsTechStep } from './fixture-richese-skills-tech';

export type SemutaHomeworldResidualPoisonFixture = {
  setup: Game; beforeBattle: Game; game: Game; owner: string; holder: string; target: string;
  actor: string; chooser: string; card: string; action: Action; event: string; location: string;
  projectile: string; shield: string; worthless: string;
  actions: RicheseSkillsTechStep[]; staging: string[];
  shipments: { actor: string; action: Action; before: Game; after: Game }[];
};
const clean = (g: Game) => !g.phaseOpening && !g.response && !g.decision && !g.pendingTreacheryDiscard;

/** Original spending-free end-of-Bidding readiness, not incidental paid Kaitain
 * disposal selected by a generic continuation policy. */
function advance(state: Game, until: (g: Game) => boolean, actions: RicheseSkillsTechStep[]): Game {
  let game = state;
  for (let n = 0; !until(game) && n < 1600; n++) {
    const end = game.biddingEnd;
    const actor = end && clean(game) ? end.owners.find(id => !end.ready.includes(id)) : undefined;
    if (actor) game = applySemutaHomeworldChoamStep(game, actor,
      { type: 'biddingEnd', event: end!.event, mode: 'ready' }, actions);
    else game = advanceSemutaHomeworldChoam(game, g => until(g) || !!g.biddingEnd, actions);
  }
  assert.ok(until(game));
  return game;
}

/** Native first-turn paid C4/E1 deployments. Only original physical cards and
 * two unplayed non-worm Spice Cards are positioned; no leader is manufactured. */
export function createSemutaHomeworldResidualPoisonFixture(
  advanced = false, fullHolder = false,
): SemutaHomeworldResidualPoisonFixture {
  const native = createSemutaHomeworldChoamSetup(advanced);
  let game = native.game;
  const setup = structuredClone(game), actions = native.actions;
  const owner = native.owner, holder = native.holder, target = native.canceller;
  const location = 'red_chasm:7';
  const staging = ['Conserved original Semuta in Richese hand.',
    'Each entitled seat answers original end-of-Bidding with its spending-free ready mode.'];
  const blow = game.spiceDeck.find(c => 'territory' in c && c.territory === 'red_chasm');
  const other = game.spiceDeck.find(c => 'territory' in c && c !== blow);
  assert.ok(blow && other);
  for (const [position, card] of [blow, other].entries())
    game.spiceDeck.splice(position, 0, game.spiceDeck.splice(game.spiceDeck.indexOf(card), 1)[0]);
  staging.push('Position original eight-spice Red Chasm blow and another original non-worm Spice Card.');
  const shipments: SemutaHomeworldResidualPoisonFixture['shipments'] = [];
  for (const [actor, amount] of [[target, 1], [owner, 4]] as const) {
    game = advance(game, g => g.phase === 5 && g.active === actor && clean(g), actions);
    assert.equal(game.turn, 1);
    const sources = nativeShipmentSources(viewGame(game, actor), amount, 0);
    assert.ok(sources);
    const action: Action = { type: 'ship', territory: 'red_chasm', sector: 7,
      amount, elite: 0, homeworldSources: sources, allyPayment: 0 };
    const before = structuredClone(game);
    game = applySemutaHomeworldChoamStep(game, actor, action, actions);
    game = advance(game, clean, actions);
    assert.equal(player(game, actor).spice, player(before, actor).spice - 2 * amount);
    assert.equal(player(game, actor).reserves, player(before, actor).reserves - amount);
    shipments.push({ actor, action, before, after: structuredClone(game) });
    game = applySemutaHomeworldChoamStep(game, actor, { type: 'endMovement' }, actions);
  }
  game = advance(game, g => g.phase === 6 && clean(g), actions);
  const cached = game.richeseCache?.find(c => c.effect === 'residualPoison');
  assert.ok(cached, 'Original Richese cache must supply the canonical physical Poison');
  const card = moveSemutaEmperorCard(game, cached.id, owner);
  const projectile = holdSemutaHomeworldChoamCard(game, owner, 'Crysknife');
  const shield = holdSemutaHomeworldChoamCard(game, owner, 'Shield');
  const worthless = holdSemutaHomeworldChoamCard(game, target, 'Baliset');
  staging.push('Conserve original Richese-cache Residual Poison, Crysknife and Shield to CHOAM; Baliset to Emperor.');
  if (fullHolder) {
    while (player(game, holder).hand.length < handLimit(player(game, holder))) {
      const next = game.deck.find(c => c.id !== SEMUTA_DRUG_ID);
      assert.ok(next);
      moveSemutaEmperorCard(game, next.id, holder);
    }
    staging.push('Conserved undealt cards fill Richese to its native four-card limit.');
  }
  for (const seat of game.players) assert.ok(seat.hand.length <= handLimit(seat));
  const beforeBattle = structuredClone(game), chooser = game.active!;
  assert.equal(chooser, target, 'Original Emperor actor chooses the native desert battle');
  game = applySemutaHomeworldChoamStep(game, chooser,
    { type: 'chooseBattle', territory: 'red_chasm', target: owner }, actions);
  game = advance(game, clean, actions);
  const battle = game.battle!;
  assert.equal(battle.preLeader?.closed, false);
  assert.deepEqual(battle.preLeader.ready, []);
  assert.deepEqual(battle.plans, {});
  assert.ok(!battle.preparation && !battle.prescience && !battle.nexusInspection);
  const event = battle.event!;
  const action: Action = { type: 'card', card, target, event };
  return { setup, beforeBattle, game, owner, holder, target, actor: owner, chooser,
    card, action, event, location, projectile, shield, worthless, actions, staging, shipments };
}

export function disposeSemutaHomeworldResidualPoison(f: SemutaHomeworldResidualPoisonFixture,
  state = f.game, actions?: RicheseSkillsTechStep[]): Game {
  return applySemutaHomeworldChoamStep(state, f.actor, f.action, actions);
}

/** Finish the same battle with currently living native discs and actual supported
 * plans, then retain played winner cards and reach original native Collection. */
export function finishSemutaHomeworldResidualPoison(f: SemutaHomeworldResidualPoisonFixture,
  state: Game, actions: RicheseSkillsTechStep[] = []) {
  let game = advance(state, g => !!g.battle?.preLeader?.closed && clean(g), actions);
  assert.equal(game.battle?.event, f.event);
  const beforePlans = structuredClone(game);
  const winnerLeader = player(game, f.owner).leaders.find(l => !l.dead && (!l.usedAt || l.usedAt === 'red_chasm'));
  const loserLeader = player(game, f.target).leaders.find(l => !l.dead && (!l.usedAt || l.usedAt === 'red_chasm'));
  assert.ok(winnerLeader && loserLeader);
  const plans: RicheseSkillsTechStep[] = [
    { actor: f.owner, action: { type: 'battlePlan', dial: 1, support: game.advanced ? 1 : 0,
      leader: winnerLeader.id, weapon: f.projectile, defense: f.shield } },
    { actor: f.target, action: { type: 'battlePlan', dial: 0, support: 0,
      leader: loserLeader.id, weapon: f.worthless } },
  ];
  for (const plan of plans) game = applySemutaHomeworldChoamStep(game, plan.actor, plan.action, actions);
  game = advance(game, g => g.decision?.kind === 'battleCards', actions);
  const afterBattle = structuredClone(game);
  assert.equal(game.decision?.player, f.owner);
  game = applySemutaHomeworldChoamStep(game, f.owner, { type: 'decision', discard: [] }, actions);
  const beforeCollection = advance(game, g => g.decision?.kind === 'choamMarket', actions);
  game = advance(beforeCollection, g => g.phase === 7 && clean(g), actions);
  assert.equal(game.turn, state.turn);
  return { game, beforePlans, afterBattle, beforeCollection, plans,
    winnerLeader: winnerLeader.id, loserLeader: loserLeader.id };
}
