import assert from 'node:assert/strict';
import { handLimit, viewGame, type Action, type Game } from '../game/engine';
import { nativeShipmentSources } from '../game/homeworld-options';
import { SEMUTA_DRUG_ID } from '../game/semuta-drug';
import { semutaEmperorPlayer as player, moveSemutaEmperorCard } from './fixture-semuta-emperor-share';
import { advanceSemutaHomeworldChoam, applySemutaHomeworldChoamStep,
  createSemutaHomeworldChoamSetup, finishSemutaBattleOutcome,
  holdSemutaHomeworldChoamCard } from './fixture-semuta-homeworld-choam';
import type { RicheseSkillsTechStep } from './fixture-richese-skills-tech';

export type SemutaHomeworldWinnerKind = 'mandatory' | 'selected';
export type SemutaHomeworldWinnerFixture = {
  kind: SemutaHomeworldWinnerKind; setup: Game; beforeBattle: Game; game: Game;
  owner: string; holder: string; winner: string; loser: string; location: string;
  card: string; kept: string; projectile: string; worthless: string;
  winnerLeader: string; loserLeader: string; actor: string; action: Action;
  actions: RicheseSkillsTechStep[]; staging: string[];
  shipments: { actor: string; action: Action; before: Game; after: Game }[];
  earlierEvents: string[];
};
const clean = (g: Game) => !g.phaseOpening && !g.response && !g.decision && !g.pendingTreacheryDiscard;
export function semutaHomeworldWinnerStock(g: Game) {
  return [g.deck, g.discard, g.richeseCache ?? [], g.richeseRemoved ?? [],
    ...g.players.map(p => p.hand)].flat().map(c => c.id).sort();
}
export function semutaHomeworldWinnerResources(g: Game) {
  return { custody: structuredClone(g.homeworlds?.custody),
    players: g.players.map(p => ({ id: p.id, spice: p.spice, reserves: p.reserves,
      tanks: p.tanks, forces: structuredClone(p.forces), elites: structuredClone(p.elites),
      battleLosses: p.battleLosses, leaders: structuredClone(p.leaders) })) };
}
function passOffer(state: Game, actions?: RicheseSkillsTechStep[]) {
  let g = state;
  const pending = g.pendingTreacheryDiscard;
  assert.equal(pending?.reaction?.stage, 'offer');
  const event = pending!.batch.event;
  for (const seat of state.players) {
    if (!g.pendingTreacheryDiscard || g.pendingTreacheryDiscard.batch.event !== event) break;
    const reaction = g.pendingTreacheryDiscard.reaction;
    assert.ok(reaction?.stage === 'offer');
    if (!reaction.passed.includes(seat.id))
      g = applySemutaHomeworldChoamStep(g, seat.id, { type: 'semutaPass', event }, actions);
  }
  return g;
}

/** Original first-turn game: native paid shipments and plans; only conserved
 * physical hands and two unplayed non-worm Spice Cards are positioned. */
export function createSemutaHomeworldWinnerFixture(
  kind: SemutaHomeworldWinnerKind, advanced = false, fullHolder = false,
): SemutaHomeworldWinnerFixture {
  const native = createSemutaHomeworldChoamSetup(advanced);
  let game = native.game;
  const setup = structuredClone(game), actions = native.actions;
  const owner = native.owner, holder = native.holder, loser = native.canceller;
  const staging = ['Conserved original physical Semuta held by Richese.'];
  const battleBlow = game.spiceDeck.find(c => 'territory' in c && c.territory === 'red_chasm');
  const otherBlow = game.spiceDeck.find(c => 'territory' in c && c !== battleBlow);
  assert.ok(battleBlow && otherBlow);
  const blows = [battleBlow, otherBlow];
  for (const [index, card] of blows.entries())
    game.spiceDeck.splice(index, 0, game.spiceDeck.splice(game.spiceDeck.indexOf(card), 1)[0]);
  staging.push('Reorder the original Red Chasm Spice Card and another non-worm card, proving real Collection income after cleanup.');
  const shipments: SemutaHomeworldWinnerFixture['shipments'] = [];
  for (const [actor, amount] of [[loser, 1], [owner, 4]] as const) {
    game = advanceSemutaHomeworldChoam(game,
      g => g.phase === 5 && g.active === actor && clean(g), actions);
    assert.equal(game.turn, 1);
    const sources = nativeShipmentSources(viewGame(game, actor), amount, 0);
    assert.ok(sources);
    const action: Action = { type: 'ship', territory: 'red_chasm', sector: 7,
      amount, elite: 0, homeworldSources: sources, allyPayment: 0 };
    const before = structuredClone(game);
    game = applySemutaHomeworldChoamStep(game, actor, action, actions);
    game = advanceSemutaHomeworldChoam(game, clean, actions);
    shipments.push({ actor, action, before, after: structuredClone(game) });
    assert.equal(player(game, actor).spice, player(before, actor).spice - 2 * amount);
    assert.equal(player(game, actor).reserves, player(before, actor).reserves - amount);
    game = applySemutaHomeworldChoamStep(game, actor, { type: 'endMovement' }, actions);
  }
  game = advanceSemutaHomeworldChoam(game, g => g.phase === 6 && clean(g), actions);
  const projectile = holdSemutaHomeworldChoamCard(game, owner, 'Crysknife');
  const kept = holdSemutaHomeworldChoamCard(game, owner, 'Shield');
  const worthless = holdSemutaHomeworldChoamCard(game, loser, 'Baliset');
  const cheap = kind === 'mandatory' ? holdSemutaHomeworldChoamCard(game, owner, 'Cheap Hero') : null;
  staging.push('Conserved printed Crysknife and Shield to CHOAM; Worthless to Emperor.' +
    (cheap ? ' Conserved printed Cheap Hero to CHOAM.' : ''));
  if (fullHolder) {
    while (player(game, holder).hand.length < handLimit(player(game, holder))) {
      const card = game.deck.find(c => c.id !== SEMUTA_DRUG_ID);
      assert.ok(card);
      moveSemutaEmperorCard(game, card.id, holder);
    }
    staging.push('Conserved undealt physical cards fill the Richese hand to its native limit.');
  }
  assert.ok(player(game, owner).hand.length <= handLimit(player(game, owner)));
  const beforeBattle = structuredClone(game);
  const chooser = game.active;
  assert.ok(chooser && [owner, loser].includes(chooser));
  const target = chooser === owner ? loser : owner;
  game = applySemutaHomeworldChoamStep(game, chooser,
    { type: 'chooseBattle', territory: 'red_chasm', target }, actions);
  game = advanceSemutaHomeworldChoam(game,
    g => !!g.battle?.preLeader?.closed && clean(g), actions);
  const winnerLeader = cheap ?? player(game, owner).leaders.find(l => !l.dead && !l.usedAt)!.id;
  const loserLeader = player(game, loser).leaders.find(l => !l.dead && !l.usedAt)!.id;
  for (const actor of [game.battle!.attacker, game.battle!.defender]) {
    const action: Action = actor === owner
      ? { type: 'battlePlan', dial: 1, support: advanced ? 1 : 0,
        leader: winnerLeader, weapon: projectile, defense: kept }
      : { type: 'battlePlan', dial: 0, support: 0, leader: loserLeader, weapon: worthless };
    game = applySemutaHomeworldChoamStep(game, actor, action, actions);
  }
  const voters = [game.battle!.attacker, game.battle!.defender];
  game = applySemutaHomeworldChoamStep(game, voters[0], { type: 'traitorCall', call: false }, actions);
  const finalResponse: Action = { type: 'traitorCall', call: false };
  const earlierEvents: string[] = [];
  let action = finalResponse;
  if (kind === 'selected') {
    game = applySemutaHomeworldChoamStep(game, voters[1], finalResponse, actions);
    game = finishSemutaBattleOutcome(game, actions);
    if (game.pendingTreacheryDiscard) {
      earlierEvents.push(game.pendingTreacheryDiscard.batch.event);
      game = passOffer(game, actions);
    }
    game = advanceSemutaHomeworldChoam(game,
      g => g.decision?.kind === 'battleCards', actions);
    action = { type: 'decision', discard: [projectile] };
  }
  return { kind, setup, beforeBattle, game, owner, holder, winner: owner, loser,
    location: 'red_chasm:7', card: cheap ?? projectile, kept, projectile, worthless,
    winnerLeader, loserLeader, actor: kind === 'mandatory' ? voters[1] : owner,
    action, actions, staging, shipments, earlierEvents };
}

export function disposeSemutaHomeworldWinner(f: SemutaHomeworldWinnerFixture,
  state = f.game, actions?: RicheseSkillsTechStep[]): Game {
  let game = applySemutaHomeworldChoamStep(state, f.actor, f.action, actions);
  game = finishSemutaBattleOutcome(game, actions);
  if (f.kind === 'mandatory' && game.pendingTreacheryDiscard?.continuation.kind === 'battleResolved')
    game = passOffer(game, actions);
  return game;
}

/** Retain unselected original winner cards, complete the real CHOAM market and
 * reach Collection without ever replaying battle or editing the native clock. */
export function finishSemutaHomeworldWinner(state: Game,
  actions?: RicheseSkillsTechStep[]): Game {
  const game = advanceSemutaHomeworldChoam(state, g => g.phase === 7 && clean(g), actions);
  assert.equal(game.turn, state.turn);
  return game;
}
