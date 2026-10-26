import assert from 'node:assert/strict';
import { viewGame, type Action, type Game } from '../game/engine';
import {
  actTruthBid, createTruthBidFixture, nextTruthBid, truthBidClean, truthBidInventory, truthBidPlayer, type TruthBidStep,
} from './fixture-truth-bid';
import { beforeIxSpiceDraw, orderIxSpiceCards } from './fixture-ix-spice-cards';

export type TruthAllianceStep = TruthBidStep;
export type TruthAllianceTransition = { before: Game; steps: TruthAllianceStep[]; after: Game };
export const actTruthAlliance = actTruthBid;
export const truthAllianceClean = truthBidClean;
export const truthAllianceInventory = truthBidInventory;
export const truthAlliancePlayer = truthBidPlayer;
export function truthAllianceNexus(game: Game) {
  return game.phase === 1 && game.nexus && !game.spiceWindow && !game.spiceResolution && truthAllianceClean(game);
}
export function nextTruthAlliance(game: Game): TruthAllianceStep | null {
  if (game.truthtrance) return null;
  for (const player of game.players) {
    const guide = viewGame(game, player.id).alliancePromiseGuide;
    if (guide) return { actor: player.id, action: guide.action };
  }
  return nextTruthBid(game);
}
export function advanceTruthAlliance(game: Game, until: (state: Game) => boolean, actions: TruthAllianceStep[] = []): Game {
  for (let count = 0; count < 1500; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished', 'The genuine alliance source ended before its owned control');
    const next = nextTruthAlliance(game); assert.ok(next, 'The original Truthtrance question, answer or saved card belongs to its caller');
    game = actTruthAlliance(game, next.actor, next.action, actions);
  }
  throw Error('The genuine alliance source did not reach its finite boundary');
}
export function settleTruthAlliance(game: Game, actions: TruthAllianceStep[] = []): Game {
  return advanceTruthAlliance(game, truthAllianceClean, actions);
}
export function closeTruthAllianceNexus(game: Game, actions: TruthAllianceStep[] = []): Game {
  assert.ok(truthAllianceNexus(game)); const turn = game.turn;
  return advanceTruthAlliance(game, state => state.turn === turn && !state.nexus && truthAllianceClean(state), actions);
}
export function finishTruthAlliance(game: Game, actions: TruthAllianceStep[] = []): Game {
  const turn = game.turn;
  return advanceTruthAlliance(game, state => state.turn === turn && state.phase === 2 && truthAllianceClean(state), actions);
}

/** Original public H/A/E base33, two actual Harkonnen Truthtrances and no
 * optional Nexus Cards. Finish the original first turn and real later Storm;
 * select only an unopened original worm plus ordinary replacements, then open
 * the real ordinary Nexus. Consent is a native partner offer and reciprocal
 * acceptance, never an installed ally/offer or assumed foreign decision. */
export function createTruthAllianceFixture(options: {
  advanced?: boolean; consent?: 'none' | 'offered' | 'allied'; partner?: 'atreides' | 'harkonnen';
} = {}) {
  const advanced = options.advanced ?? false, consent = options.consent ?? 'offered';
  const base = createTruthBidFixture({ advanced, window: 'waiting' });
  const partner = options.partner ?? base.opponent;
  let game = structuredClone(base.game); const actions = structuredClone(base.sourceActions);
  const act = (actor: string, action: Action) => { game = actTruthAlliance(game, actor, action, actions); };
  const reach = (until: (state: Game) => boolean) => { game = advanceTruthAlliance(game, until, actions); };
  const transition = (run: () => void): TruthAllianceTransition => {
    const before = structuredClone(game), from = actions.length; run();
    return { before, steps: structuredClone(actions.slice(from)), after: structuredClone(game) };
  };
  const nextStorm = transition(() => {
    reach(state => state.turn === 2 && beforeIxSpiceDraw(state));
  });
  assert.ok(game.players.every(player => player.ally === null));
  const nexusSpiceOrder = orderIxSpiceCards(game, ['worm', 'land', ...(advanced ? ['land' as const] : [])]);
  const beforeWorm = structuredClone(game);
  const encounter = transition(() => { reach(truthAllianceNexus); });
  assert.equal(game.turn, 2); assert.equal(game.phase, 1); assert.equal(game.nexus, true);
  assert.ok(game.spiceDiscard.flat().some(card => 'worm' in card && !card.suppressed));
  assert.ok(!game.nexusCards && !game.homeworlds && !game.leaderSkills && !game.techTokens &&
    !game.strongholdCards && !game.discoveryEnabled && !game.ecazTreachery);
  const beforeConsent = structuredClone(game);
  let offer: TruthAllianceTransition | null = null, acceptance: TruthAllianceTransition | null = null;
  if (consent !== 'none') {
    offer = transition(() => { act(partner, { type: 'alliance', target: base.target }); });
    assert.equal(game.allianceOffers[partner], base.target); assert.equal(truthAlliancePlayer(game, base.target).ally, null);
  }
  if (consent === 'allied') {
    acceptance = transition(() => { act(base.target, { type: 'alliance', target: partner }); });
    assert.equal(truthAlliancePlayer(game, base.target).ally, partner);
    assert.equal(truthAlliancePlayer(game, partner).ally, base.target);
  }
  assert.deepEqual(truthAllianceInventory(game), base.originalCards);
  assert.equal(truthAlliancePlayer(game, base.target).spice, 10);
  assert.equal(viewGame(game, base.target).alliancePromiseNexus?.turn, game.turn);
  const question = { kind: 'alliance' as const, target: base.target, turn: game.turn, partner };
  return { ...base, game, sourceGame: structuredClone(game), base, advanced, consent, partner,
    nextStorm, beforeWorm, nexusSpiceOrder, encounter, beforeConsent, offer, acceptance,
    question, questionAction: { type: 'truthAsk', question } as Action,
    allianceAction: { type: 'alliance', target: partner } as Action,
    breakAction: { type: 'alliance', target: null } as Action,
    actions, sourceActions: structuredClone(actions), sourceActionCount: actions.length,
    staging: [] as string[], sourceDisclosure: 'Genuine public original H/A/E base33 and native first-turn/later-Storm controls. Only inherited unopened original deal/lot/Spice positions, the later original worm/replacement prefix and scalar lotteries are selected. The actual ordinary worm opens this Nexus; native reciprocal offers earn any existing alliance. No clock, hand, wallet, offer, ally or promise is installed, and no foreign consent is invented.' };
}
export type TruthAllianceFixture = ReturnType<typeof createTruthAllianceFixture>;
export function declareTruthAlliance(f: TruthAllianceFixture, state = f.game, options: { copies?: 1 | 2 } = {}) {
  let game = state; const before = structuredClone(game), actions: TruthAllianceStep[] = [];
  const declaration: Action = { type: 'card', card: f.truths[0], ...(options.copies === 2 ? { cards: [f.truths[1]] } : {}) };
  game = actTruthAlliance(game, f.asker, declaration, actions);
  for (let count = 0; game.truthtrance?.stage === 'priority' && count < game.players.length; count++) {
    const actor = game.players.find(player => !game.truthtrance!.passed.includes(player.id)); assert.ok(actor);
    game = actTruthAlliance(game, actor.id, { type: 'truthPass' }, actions);
  }
  assert.equal(game.truthtrance?.stage, 'ask');
  return { game, before, declaration, actions, actionCount: actions.length };
}
export function askTruthAlliance(game: Game, asker: string, target: string, partner: string,
  actions: TruthAllianceStep[] = []): Game {
  return actTruthAlliance(game, asker, { type: 'truthAsk', question: { kind: 'alliance', target, turn: game.turn, partner } }, actions);
}
export function answerTruthAlliance(game: Game, target: string, answer: 'yes' | 'no' | 'unknown',
  actions: TruthAllianceStep[] = []): Game {
  return actTruthAlliance(game, target, { type: 'truthAnswer', answer }, actions);
}
export function bindTruthAlliance(f: TruthAllianceFixture, answer: 'yes' | 'no' = 'yes', partner = f.partner, state = f.game) {
  const declared = declareTruthAlliance(f, state), actions = [...declared.actions];
  const asked = askTruthAlliance(declared.game, f.asker, f.target, partner, actions);
  const game = answerTruthAlliance(asked, f.target, answer, actions);
  return { game, declared, asked, actions, actionCount: actions.length };
}
