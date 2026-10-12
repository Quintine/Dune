import assert from 'node:assert/strict';
import {
  createGame, handLimit, initializeSemutaGameForAudit, joinGame, newPlayer,
  viewGame, type Action, type Game,
} from '../game/engine';
import { SEMUTA_DRUG_ID } from '../game/semuta-drug';
import { nextRicheseSkillsTechNativeStep, type RicheseSkillsTechStep } from './fixture-richese-skills-tech';
import { moveSemutaEmperorCard, semutaEmperorCardId, semutaEmperorPlayer } from './fixture-semuta-emperor-share';
import { applySemutaHomeworldChoamStep } from './fixture-semuta-homeworld-choam';

export type SemutaHomeworldBgCharityFixture = {
  initial: Game; setup: Game; gameBeforeBGclaim: Game; game: Game;
  originalIncomeResponse: Game; originalResponse: Game | null;
  actor: string; owner: string; holder: string; payer: string; target: string;
  card: string; amount: number; claim: Action; action: Action; event: string | null;
  actions: RicheseSkillsTechStep[]; staging: string[];
};
const clean = (game: Game) => !game.phaseOpening && !game.response && !game.decision && !game.pendingTreacheryDiscard;

/** Native human continuation: decline markets, allow responses, and ready the
 * original queues. Never use the optional paid Kaitain end-of-Bidding control. */
function advance(state: Game, until: (game: Game) => boolean, actions?: RicheseSkillsTechStep[]): Game {
  let game = state;
  for (let n = 0; !until(game) && n < 1600; n++) {
    assert.notEqual(game.status, 'finished');
    let next: RicheseSkillsTechStep;
    const pending = game.pendingTreacheryDiscard, reaction = pending?.reaction;
    if (pending && reaction?.stage === 'offer') next = {
      actor: game.players.find(p => !reaction.passed.includes(p.id))!.id,
      action: { type: 'semutaPass', event: pending.batch.event },
    };
    else if (game.decision?.kind === 'choamMarket') next = {
      actor: game.decision.player, action: { type: 'decision', done: true },
    };
    else if (game.biddingEnd && clean(game)) next = {
      actor: game.biddingEnd.owners.find(id => !game.biddingEnd!.ready.includes(id))!,
      action: { type: 'biddingEnd', event: game.biddingEnd.event, mode: 'ready' },
    };
    else next = nextRicheseSkillsTechNativeStep(game);
    game = applySemutaHomeworldChoamStep(game, next.actor, next.action, actions);
  }
  assert.ok(until(game), 'Original native controls must reach the BG charity boundary');
  return game;
}

/** Five original ready participants, actual prediction/force setup and first
 * CHOAM income. Only conserved physical cards and unplayed Spice order stage. */
export function createSemutaHomeworldBgCharityFixture(
  advanced = true, fullHolder = false,
): SemutaHomeworldBgCharityFixture {
  let game = createGame('SEMUTAHWBG', newPlayer('r', 'Richese', 'richese'), advanced, ['choam']);
  joinGame(game, newPlayer('c', 'CHOAM', 'choam'));
  joinGame(game, newPlayer('e', 'Emperor', 'emperor'));
  joinGame(game, newPlayer('a', 'Atreides', 'atreides'));
  joinGame(game, newPlayer('b', 'Bene Gesserit', 'beneGesserit'));
  const actions: RicheseSkillsTechStep[] = [], staging: string[] = [];
  game = applySemutaHomeworldChoamStep(game, game.host, { type: 'homeworlds', enabled: true }, actions);
  for (const seat of game.players) game = applySemutaHomeworldChoamStep(game, seat.id, { type: 'ready' }, actions);
  const initial = structuredClone(game);
  game = initializeSemutaGameForAudit(game);
  game = advance(game, g => g.status === 'playing', actions);
  const setup = structuredClone(game);
  const blows = game.spiceDeck.filter(card => 'territory' in card).slice(0, 2);
  assert.equal(blows.length, 2);
  for (const [position, card] of blows.entries())
    game.spiceDeck.splice(position, 0, game.spiceDeck.splice(game.spiceDeck.indexOf(card), 1)[0]);
  staging.push('Order two original still-unplayed non-worm Spice Cards.');
  moveSemutaEmperorCard(game, SEMUTA_DRUG_ID, 'r');
  const card = moveSemutaEmperorCard(game, semutaEmperorCardId(game, c => c.effect === 'karama'), 'e');
  staging.push('Conserved original Semuta to Richese and printed Karama to Emperor.');
  if (fullHolder) {
    const holder = semutaEmperorPlayer(game, 'r');
    while (holder.hand.length < handLimit(holder)) {
      assert.ok(game.deck[0]);
      moveSemutaEmperorCard(game, game.deck[0].id, holder.id);
    }
    staging.push('Conserved undealt stock fills the original Richese hand to four.');
  }
  game = advance(game, g => g.response?.kind === 'choamCharity', actions);
  const originalIncomeResponse = structuredClone(game);
  game = advance(game, g => g.phase === 2 && clean(g), actions);
  const gameBeforeBGclaim = structuredClone(game), claim: Action = { type: 'charity' };
  if (advanced) game = applySemutaHomeworldChoamStep(game, 'b', claim, actions);
  assert.equal(semutaEmperorPlayer(game, 'b').spice, 5);
  assert.equal(semutaEmperorPlayer(game, 'c').spice, 12);
  if (advanced) {
    assert.equal(game.response?.kind, 'bgCharity');
    assert.equal(game.response?.amount, 2);
    assert.ok(viewGame(game, 'e').responseControls?.cancelCards.includes(card));
  }
  return { initial, setup, gameBeforeBGclaim, originalIncomeResponse,
    originalResponse: advanced ? structuredClone(game) : null, game,
    actor: 'e', owner: 'b', holder: 'r', payer: 'c', target: 'a', card,
    amount: advanced ? game.response!.amount! : viewGame(game, 'b').charity.amount,
    claim, action: { type: 'card', mode: 'cancel', card }, event: null, actions, staging };
}

/** Spend the real printed card before the bound original BG denial. */
export function disposeSemutaHomeworldBgCharity(
  f: SemutaHomeworldBgCharityFixture, state = f.game, actions?: RicheseSkillsTechStep[],
): Game {
  const game = applySemutaHomeworldChoamStep(state, f.actor, f.action, actions);
  f.event = game.pendingTreacheryDiscard?.batch.event ?? null;
  return game;
}

export function reactSemutaHomeworldBgCharity(
  state: Game, holder: string, claim: boolean, actions?: RicheseSkillsTechStep[],
): Game {
  const pending = state.pendingTreacheryDiscard, reaction = pending?.reaction;
  assert.ok(pending && reaction?.stage === 'offer');
  const event = pending.batch.event;
  if (claim) return applySemutaHomeworldChoamStep(state, holder, { type: 'semutaCommit', event }, actions);
  let game = state;
  for (const seat of state.players.filter(p => !reaction.passed.includes(p.id)))
    game = applySemutaHomeworldChoamStep(game, seat.id, { type: 'semutaPass', event }, actions);
  return game;
}

/** Continue the same original native charity close into usable Bidding. */
export function finishSemutaHomeworldBgCharity(
  state: Game, actions?: RicheseSkillsTechStep[],
): Game {
  assert.ok(!state.pendingTreacheryDiscard && state.response?.kind !== 'bgCharity');
  return advance(state, g => g.phase === 3 && clean(g), actions);
}
