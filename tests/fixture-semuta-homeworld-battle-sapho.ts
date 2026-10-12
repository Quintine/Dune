import assert from 'node:assert/strict';
import { handLimit, viewGame, type Action, type Game } from '../game/engine';
import { nativeShipmentSources } from '../game/homeworld-options';
import { SEMUTA_DRUG_ID } from '../game/semuta-drug';
import { semutaEmperorPlayer as player, moveSemutaEmperorCard } from './fixture-semuta-emperor-share';
import { advanceSemutaHomeworldChoam, applySemutaHomeworldChoamStep,
  createSemutaHomeworldChoamSetup, holdSemutaHomeworldChoamCard } from './fixture-semuta-homeworld-choam';
import type { RicheseSkillsTechStep } from './fixture-richese-skills-tech';

export type SemutaHomeworldBattleSaphoFixture = {
  scope: 'aggressor' | 'order'; mode: 'first' | 'last'; advanced: boolean;
  setup: Game; beforeBattle: Game; game: Game;
  choam: string; holder: string; emperor: string; atreides: string; owner: string; actor: string;
  action: Action; card: string; location: string; actions: RicheseSkillsTechStep[]; staging: string[];
  shipments: { actor: string; action: Action; before: Game; after: Game; price: number }[];
  completedPrefix?: { before: Game; after: Game; event: string; actions: RicheseSkillsTechStep[];
    richeseLeader: string; atreidesLeader: string; reinforcementEvent: string };
};
const clean = (g: Game) => !g.phaseOpening && !g.response && !g.decision && !g.pendingTreacheryDiscard;

/** Reach the requested native boundary, answering each real gate with its own
 * entitled seat's original spending-free control and declining the winner's own
 * native Caladan reinforcement instead of letting a generic bot spend. */
function advance(state: Game, until: (game: Game) => boolean, actions: RicheseSkillsTechStep[]): Game {
  let game = state;
  const stop = (g: Game) => until(g) || !!g.biddingEnd || (g.phase === 5 && clean(g));
  for (let n = 0; !until(game) && n < 1600; n++) {
    assert.notEqual(game.status, 'finished');
    const end = game.biddingEnd;
    const seat = end && clean(game) ? end.owners.find(id => !end.ready.includes(id)) : undefined;
    if (seat) game = applySemutaHomeworldChoamStep(game, seat,
      { type: 'biddingEnd', event: end!.event, mode: 'ready' }, actions);
    else if (game.decision?.kind === 'caladanReinforcement')
      game = applySemutaHomeworldChoamStep(game, game.decision.player,
        { type: 'decision', event: game.decision.event, decline: true }, actions);
    else if (game.phase === 5 && clean(game))
      game = applySemutaHomeworldChoamStep(game, game.active!, { type: 'endMovement' }, actions);
    else game = advanceSemutaHomeworldChoam(game,
      g => stop(g) || g.decision?.kind === 'caladanReinforcement', actions);
  }
  assert.ok(until(game), 'Native continuation must reach the requested boundary');
  return game;
}

/** Real shared preparation: podium, readiness, optional powers, pre-leader close. */
export function prepareSemutaHomeworldBattleSapho(state: Game, actions?: RicheseSkillsTechStep[]): Game {
  return advanceSemutaHomeworldChoam(state,
    g => !!g.battle?.preLeader?.closed && !g.battle.preparation && clean(g), actions);
}

/** Genuine native first turn; only conserved physical hands, unplayed Spice order
 * and the real Caladan decline are controlled. Every force, wallet and battle
 * control is native. Order-last uses the genuine Emperor as the conserved Sapho
 * owner, whose position can legally move behind CHOAM. */
export function createSemutaHomeworldBattleSaphoFixture(
  scope: 'aggressor' | 'order', mode: 'first' | 'last' = 'first', advanced = false, fullHolder = false,
): SemutaHomeworldBattleSaphoFixture {
  const native = createSemutaHomeworldChoamSetup(advanced);
  let game = native.game;
  const setup = structuredClone(game), actions = native.actions;
  const choam = native.owner, holder = native.holder, emperor = native.canceller, atreides = native.target;
  const owner = scope === 'order' && mode === 'last' ? emperor : choam;
  const staging = ['Conserved physical Semuta to Richese; use native spending-free end-of-Bidding readiness.'];
  const blow = game.spiceDeck.find(c => 'territory' in c && c.territory === 'red_chasm');
  const other = game.spiceDeck.find(c => 'territory' in c && c !== blow);
  assert.ok(blow && other);
  for (const [index, card] of [blow, other].entries())
    game.spiceDeck.splice(index, 0, game.spiceDeck.splice(game.spiceDeck.indexOf(card), 1)[0]);
  staging.push('Position original Red Chasm eight-spice blow and another non-worm Spice Card.');
  const shipments: SemutaHomeworldBattleSaphoFixture['shipments'] = [];
  const routes: readonly (readonly [string, number, string, number, number])[] = scope === 'order'
    ? [[holder, 1, 'arrakeen', 10, 1], [emperor, 1, 'red_chasm', 7, 2], [choam, 4, 'red_chasm', 7, 8]]
    : [[emperor, 1, 'red_chasm', 7, 2], [choam, 4, 'red_chasm', 7, 8]];
  for (const [actor, amount, territory, sector, price] of routes) {
    game = advance(game, g => g.phase === 5 && g.active === actor && clean(g), actions);
    const sources = nativeShipmentSources(viewGame(game, actor), amount, 0);
    assert.ok(sources);
    const action: Action = { type: 'ship', territory, sector, amount, elite: 0,
      homeworldSources: sources, allyPayment: 0 };
    const before = structuredClone(game);
    game = applySemutaHomeworldChoamStep(game, actor, action, actions);
    game = advance(game, clean, actions);
    assert.equal(player(game, actor).spice, player(before, actor).spice - price);
    assert.equal(player(game, actor).reserves, player(before, actor).reserves - amount);
    shipments.push({ actor, action, before, after: structuredClone(game), price });
    game = applySemutaHomeworldChoamStep(game, actor, { type: 'endMovement' }, actions);
  }
  game = advance(game, g => g.phase === 6 && clean(g), actions);
  const beforeBattle = structuredClone(game);
  let completedPrefix: SemutaHomeworldBattleSaphoFixture['completedPrefix'];
  if (scope === 'order') {
    assert.equal(game.active, holder);
    const start = actions.length, before = structuredClone(game);
    game = applySemutaHomeworldChoamStep(game, holder,
      { type: 'chooseBattle', territory: 'arrakeen', target: atreides }, actions);
    const event = game.battle!.event!;
    game = prepareSemutaHomeworldBattleSapho(game, actions);
    const richeseLeader = player(game, holder).leaders.filter(l => !l.dead && !l.usedAt)
      .sort((a, b) => a.strength - b.strength)[0];
    const atreidesLeader = player(game, atreides).leaders.filter(l => !l.dead && !l.usedAt)
      .sort((a, b) => b.strength - a.strength)[0];
    assert.ok(richeseLeader && atreidesLeader && atreidesLeader.strength > richeseLeader.strength);
    for (const [actor, leader] of [[holder, richeseLeader.id], [atreides, atreidesLeader.id]])
      game = applySemutaHomeworldChoamStep(game, actor,
        { type: 'battlePlan', dial: 0, support: 0, leader }, actions);
    game = advance(game, g => g.phase === 6 && !g.battle && clean(g), actions);
    const decline = actions.slice(start).find(step =>
      step.action.type === 'decision' && 'decline' in step.action && step.action.decline === true &&
      'event' in step.action && typeof step.action.event === 'string');
    assert.ok(decline && decline.action.type === 'decision' && 'event' in decline.action &&
      typeof decline.action.event === 'string', 'The real Caladan decline must be recorded');
    const reinforcementEvent: string = decline.action.event;
    assert.equal(player(game, holder).tanks, 1);
    assert.equal(player(game, holder).forces['arrakeen:10'] ?? 0, 0);
    assert.equal(player(game, atreides).forces['arrakeen:10'], 10);
    assert.equal(player(game, atreides).reserves, player(before, atreides).reserves);
    completedPrefix = { before, after: structuredClone(game), event,
      actions: actions.slice(start), richeseLeader: richeseLeader.id,
      atreidesLeader: atreidesLeader.id, reinforcementEvent };
  }
  const card = holdSemutaHomeworldChoamCard(game, owner, 'Juice of Sapho');
  staging.push('Conserve canonical Juice of Sapho to its genuine owner before the next clean opportunity.');
  if (fullHolder) {
    while (player(game, holder).hand.length < handLimit(player(game, holder))) {
      const next = game.deck.find(c => c.id !== SEMUTA_DRUG_ID);
      assert.ok(next);
      moveSemutaEmperorCard(game, next.id, holder);
    }
    staging.push('Conserve undealt original cards to fill the native Richese hand limit.');
  }
  if (scope === 'aggressor') {
    assert.equal(game.active, emperor);
    game = applySemutaHomeworldChoamStep(game, emperor,
      { type: 'chooseBattle', territory: 'red_chasm', target: choam }, actions);
    if (game.decision?.kind === 'fullPlanOffer')
      game = applySemutaHomeworldChoamStep(game, game.decision.player,
        { type: 'decision', decline: true }, actions);
    assert.equal(game.battle!.attacker, emperor);
    assert.equal(game.battle!.defender, choam);
    assert.equal(game.battle!.chooser, emperor);
    assert.equal(game.battle!.preLeader!.closed, false);
    assert.equal(game.battle!.preLeader!.ready.length, 0);
    assert.ok(!game.battle!.preparation);
  }
  for (const seat of game.players) assert.ok(seat.hand.length <= handLimit(seat));
  const option = viewGame(game, owner).saphoOptions.find(o => scope === 'aggressor'
    ? o.scope === 'battleAggressor' : o.scope === 'battleOrder' && o.mode === mode);
  assert.ok(option, 'The original native game exposes the exact legal Sapho option');
  const action: Action = { type: 'card', card, ...option };
  return { scope, mode, advanced, setup, beforeBattle, game, choam, holder, emperor, atreides,
    owner, actor: owner, action, card, location: 'red_chasm:7', actions, staging, shipments, completedPrefix };
}

export function disposeSemutaHomeworldBattleSapho(f: SemutaHomeworldBattleSaphoFixture,
  state = f.game, actions?: RicheseSkillsTechStep[]): Game {
  return applySemutaHomeworldChoamStep(state, f.actor, f.action, actions);
}

/** Real next-chooser selection, shared preparation, zero-dial equal living
 * leaders, traitor passes and cleanup, then the one native Collection. */
export function finishSemutaHomeworldBattleSapho(state: Game, f: SemutaHomeworldBattleSaphoFixture,
  actions: RicheseSkillsTechStep[] = []) {
  let game = state;
  if (game.pendingTreacheryDiscard)
    for (const seat of game.players) {
      if (!game.pendingTreacheryDiscard) break;
      game = applySemutaHomeworldChoamStep(game, seat.id,
        { type: 'semutaPass', event: game.pendingTreacheryDiscard.batch.event }, actions);
    }
  const chooser = game.battle?.chooser ?? game.active;
  assert.ok(chooser, 'The original native actor retains the next battle choice');
  let attacker = game.battle?.attacker, defender = game.battle?.defender, target: string | null = null;
  if (!game.battle) {
    const choice = viewGame(game, chooser).battleChoices.find(c => c.chooser === chooser);
    assert.ok(choice, 'The native next chooser retains a real physical battle option');
    target = choice.attacker === chooser ? choice.defender : choice.attacker;
    attacker = choice.attacker;
    defender = choice.defender;
    game = applySemutaHomeworldChoamStep(game, chooser,
      { type: 'chooseBattle', territory: choice.territory, target }, actions);
  }
  const opened = structuredClone(game);
  game = prepareSemutaHomeworldBattleSapho(game, actions);
  const [first, second] = [attacker!, defender!];
  const strength = player(game, first).leaders.find(l => !l.dead && !l.usedAt &&
    player(game, second).leaders.some(o => !o.dead && !o.usedAt && o.strength === l.strength))!.strength;
  for (const id of [first, second]) {
    const leader = player(game, id).leaders.find(l => !l.dead && !l.usedAt && l.strength === strength)!;
    game = applySemutaHomeworldChoamStep(game, id,
      { type: 'battlePlan', leader: leader.id, dial: 0, support: 0 }, actions);
  }
  const revealed = structuredClone(game);
  game = advance(game, g => !g.battle && clean(g), actions);
  const afterBattle = structuredClone(game);
  game = advance(game, g => g.phase === 7 && clean(g), actions);
  assert.equal(game.turn, state.turn);
  return { game, opened, revealed, afterBattle, chooser, attacker, defender, target };
}
