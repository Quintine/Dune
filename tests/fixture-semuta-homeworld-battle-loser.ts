import assert from 'node:assert/strict';
import { handLimit, viewGame, type Action, type Game } from '../game/engine';
import { treacheryDeck } from '../game/cards';
import { splitLocation } from '../game/board';
import { nativeShipmentSources } from '../game/homeworld-options';
import { SEMUTA_DRUG_ID } from '../game/semuta-drug';
import { advanceSemutaHomeworldChoam, applySemutaHomeworldChoamStep,
  createSemutaHomeworldChoamSetup, finishSemutaBattleOutcome } from './fixture-semuta-homeworld-choam';
import { moveSemutaEmperorCard, semutaEmperorPlayer as player } from './fixture-semuta-emperor-share';
import { nextRicheseSkillsTechNativeStep, type RicheseSkillsTechStep } from './fixture-richese-skills-tech';

export type SemutaHomeworldLoserFixture = {
  setup: Game; game: Game; beforeBattle: Game; owner: string; winner: string; holder: string;
  location: string; cards: string[]; winnerCards: string[]; action: Action; actor: string; support: number;
  winnerLeader: string; loserLeader: string; actions: RicheseSkillsTechStep[]; staging: string[];
  shipments: { actor: string; action: Action; before: Game; after: Game; price: number }[];
};
const clean = (g: Game) => !g.phaseOpening && !g.response && !g.decision && !g.pendingTreacheryDiscard;

/** Native continuation, except that the real end-of-Bidding gate is answered
 * with the entitled seat's own spending-free ready mode so no wallet is
 * decided by an unrelated generic bot policy. */
function advance(state: Game, until: (game: Game) => boolean, actions: RicheseSkillsTechStep[]): Game {
  let game = state;
  for (let n = 0; !until(game) && n < 1600; n++) {
    assert.notEqual(game.status, 'finished', 'The original Homeworld game must reach the requested boundary');
    const end = game.biddingEnd;
    const seat = end && clean(game)
      ? end.owners.find(id => !end.ready.includes(id)) : undefined;
    if (seat) {
      game = applySemutaHomeworldChoamStep(game, seat,
        { type: 'biddingEnd', event: end!.event, mode: 'ready' }, actions);
      continue;
    }
    game = advanceSemutaHomeworldChoam(game, g => until(g) || !!g.biddingEnd, actions);
  }
  assert.ok(until(game), 'The native Homeworld continuation must reach its boundary');
  return game;
}

/** Original completed native setup; only printed hands and unplayed Spice order
 * are positioned. Every force, wallet, battle control and casualty is native. */
export function createSemutaHomeworldLoserFixture(advanced = false, fullHolder = false): SemutaHomeworldLoserFixture {
  const native = createSemutaHomeworldChoamSetup(advanced);
  let game = native.game;
  const setup = structuredClone(game), actions = native.actions;
  const holder = native.holder, owner = native.owner, winner = native.canceller;
  const location = 'red_chasm:7';
  const staging = ['Conserved original Semuta in Richese hand.'];
  staging.push('Answer the real end-of-Bidding gate with each entitled seat\'s own spending-free ready mode.');
  const blows = game.spiceDeck.filter(card => 'territory' in card).slice(0, 2);
  assert.equal(blows.length, 2);
  for (const [position, card] of blows.entries())
    game.spiceDeck.splice(position, 0, game.spiceDeck.splice(game.spiceDeck.indexOf(card), 1)[0]);
  staging.push('Position two original unplayed non-worm Spice Cards.');
  const shipments: SemutaHomeworldLoserFixture['shipments'] = [];
  for (const [actor, amount, price] of [[winner, 4, 8], [owner, 1, 2]] as const) {
    game = advance(game, g => g.phase === 5 && g.active === actor && clean(g), actions);
    assert.equal(game.turn, 1);
    const sources = nativeShipmentSources(viewGame(game, actor), amount, 0);
    assert.ok(sources, 'Actual native custody must supply the normal shipment');
    const action: Action = { type: 'ship', ...splitLocation(location), amount, elite: 0,
      homeworldSources: sources, allyPayment: 0 };
    const before = structuredClone(game);
    game = applySemutaHomeworldChoamStep(game, actor, action, actions);
    game = advance(game, clean, actions);
    assert.equal(player(game, actor).spice, player(before, actor).spice - price);
    assert.equal(player(game, actor).reserves, player(before, actor).reserves - amount);
    assert.equal(player(game, actor).forces[location], amount);
    shipments.push({ actor, action, before, after: structuredClone(game), price });
    game = applySemutaHomeworldChoamStep(game, actor, { type: 'endMovement' }, actions);
  }
  game = advance(game, g => g.phase === 6 && clean(g), actions);
  const allocated: string[] = [];
  const give = (actor: string, kind: 'projectile' | 'shield') => {
    const card = treacheryDeck(game.expansions).find(c => c.kind === kind && !allocated.includes(c.id));
    assert.ok(card);
    allocated.push(card.id);
    return moveSemutaEmperorCard(game, card.id, actor);
  };
  const winnerCards = [give(winner, 'projectile'), give(winner, 'shield')];
  const cards = [give(owner, 'projectile'), give(owner, 'shield')];
  staging.push(`Conserved distinct original projectile/Shield pairs: ${winnerCards.join(', ')} to Emperor; ${cards.join(', ')} to CHOAM.`);
  if (fullHolder) {
    while (player(game, holder).hand.length < handLimit(player(game, holder))) {
      assert.ok(game.deck[0]);
      moveSemutaEmperorCard(game, game.deck[0].id, holder);
    }
    staging.push('Conserved original undealt cards fill Richese to four.');
  }
  for (const seat of game.players) assert.ok(seat.hand.length <= handLimit(seat));
  assert.ok(player(game, holder).hand.some(c => c.id === SEMUTA_DRUG_ID));
  const beforeBattle = structuredClone(game);
  const actor = game.active!;
  assert.ok(actor === owner || actor === winner, 'Choose only the actual original phase-six battle actor');
  game = applySemutaHomeworldChoamStep(game, actor,
    { type: 'chooseBattle', territory: splitLocation(location).territory, target: actor === winner ? owner : winner }, actions);
  game = advance(game,
    g => !!g.battle && !g.battle.preparation && g.battle.preLeader?.closed !== false && clean(g), actions);
  const strongest = player(game, winner).leaders.filter(l => !l.dead && !l.usedAt).sort((a, b) => b.strength - a.strength)[0];
  const weakest = player(game, owner).leaders.filter(l => !l.dead && !l.usedAt).sort((a, b) => a.strength - b.strength)[0];
  assert.ok(strongest && weakest && strongest.strength + 1 > weakest.strength);
  const support = advanced ? 1 : 0;
  assert.ok(player(game, winner).spice >= support, 'The native budget must cover the Advanced spice support');
  game = applySemutaHomeworldChoamStep(game, winner, { type: 'battlePlan', dial: 1,
    support, leader: strongest.id, weapon: winnerCards[0], defense: winnerCards[1] }, actions);
  game = applySemutaHomeworldChoamStep(game, owner, { type: 'battlePlan', dial: 0,
    support: 0, leader: weakest.id, weapon: cards[0], defense: cards[1] }, actions);
  // Use the public native voter order; stop before its last real response.
  let final: RicheseSkillsTechStep | undefined;
  for (let n = 0; n < 100; n++) {
    const next = nextRicheseSkillsTechNativeStep(game);
    if (next.action.type === 'traitorCall') {
      const voters = viewGame(game, game.host).battle!.traitorVoters;
      if (voters.every(id => id === next.actor || game.battle!.traitorCalls[id] !== undefined)) {
        final = next;
        break;
      }
    }
    game = applySemutaHomeworldChoamStep(game, next.actor, next.action, actions);
  }
  assert.ok(final, 'Native final traitor-pass control must resolve the original battle');
  return { setup, game, beforeBattle, owner, winner, holder, location, cards, winnerCards, support,
    actor: final.actor, action: final.action, winnerLeader: strongest.id, loserLeader: weakest.id,
    actions, staging, shipments };
}

export function disposeSemutaHomeworldLoser(f: SemutaHomeworldLoserFixture,
  state = f.game, actions?: RicheseSkillsTechStep[]): Game {
  const game = applySemutaHomeworldChoamStep(state, f.actor, f.action, actions);
  return finishSemutaBattleOutcome(game, actions);
}

/** Keep the winner's held played cards, then use original income/market controls
 * to enter this same turn's Collection exactly once. */
export function finishSemutaHomeworldLoser(state: Game, actions?: RicheseSkillsTechStep[]): Game {
  return advance(state, g => g.phase === 7 && clean(g), actions ?? []);
}
