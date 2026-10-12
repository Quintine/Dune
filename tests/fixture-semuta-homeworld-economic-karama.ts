import assert from 'node:assert/strict';
import { handLimit, viewGame, type Action, type Game } from '../game/engine';
import { SEMUTA_DRUG_ID } from '../game/semuta-drug';
import { quoteSpiceCollection, type CollectionQuote } from '../game/board-resolution-quote';
import { moveSemutaEmperorCard, semutaEmperorPlayer } from './fixture-semuta-emperor-share';
import { advanceSemutaHomeworldChoam, applySemutaHomeworldChoamStep,
  createSemutaHomeworldChoamSetup, holdSemutaHomeworldChoamCard } from './fixture-semuta-homeworld-choam';
import type { RicheseSkillsTechStep } from './fixture-richese-skills-tech';

export type SemutaHomeworldEconomicKaramaScope = 'charity' | 'inflation';
export type SemutaHomeworldEconomicKaramaFixture = {
  scope: SemutaHomeworldEconomicKaramaScope;
  setup: Game; beforeDeclaration: Game; originalResponse: Game; game: Game;
  owner: string; canceller: string; holder: string; target: string;
  card: string; action: Action; declaration: Action | null; event: string | null;
  actions: RicheseSkillsTechStep[]; staging: string[];
  afterCancel?: Game; targetSuffix?: Game; beforeNextIncome?: Game;
  beforeCollection?: Game; collectionQuote?: CollectionQuote;
};
const clean = (g: Game) => !g.phaseOpening && !g.response && !g.decision && !g.pendingTreacheryDiscard;

/** Spending-free native progression, preserving every original population and
 * wallet. End-of-Bidding readiness is not the paid Kaitain disposal control. */
function advance(state: Game, until: (g: Game) => boolean, actions?: RicheseSkillsTechStep[]): Game {
  let game = state;
  for (let n = 0; !until(game) && n < 1600; n++) {
    assert.notEqual(game.status, 'finished');
    const end = game.biddingEnd;
    const actor = end && clean(game) ? end.owners.find(id => !end.ready.includes(id)) : undefined;
    if (actor) game = applySemutaHomeworldChoamStep(game, actor,
      { type: 'biddingEnd', event: end!.event, mode: 'ready' }, actions);
    else if (game.phase === 5 && clean(game))
      game = applySemutaHomeworldChoamStep(game, game.active!, { type: 'endMovement' }, actions);
    else game = advanceSemutaHomeworldChoam(game,
      g => until(g) || (!!g.biddingEnd && clean(g)) || (g.phase === 5 && clean(g)), actions);
  }
  assert.ok(until(game), 'Original native controls must reach the economic boundary');
  return game;
}

/** Original completed R/C/E/A Homeworld setup, then first native phase-two
 * income or first Mentat placement. Only conserved cards/unplayed Spice order
 * are staged; no phase, response, attempt stamp, resource or receipt is set. */
export function createSemutaHomeworldEconomicKaramaFixture(
  scope: SemutaHomeworldEconomicKaramaScope, advanced = false, fullHolder = false,
): SemutaHomeworldEconomicKaramaFixture {
  const native = createSemutaHomeworldChoamSetup(advanced);
  let game = native.game;
  const setup = structuredClone(game), actions = native.actions;
  const staging = ['Conserved original physical Semuta to Richese after completed native setup.'];
  const blows = game.spiceDeck.filter(card => 'territory' in card).slice(0, 4);
  assert.equal(blows.length, 4);
  for (const [position, card] of blows.entries())
    game.spiceDeck.splice(position, 0, game.spiceDeck.splice(game.spiceDeck.indexOf(card), 1)[0]);
  staging.push('Order four original unplayed non-worm Spice Cards for the first and following native turns.');
  const card = holdSemutaHomeworldChoamCard(game, native.canceller, 'Karama');
  staging.push('Conserved printed Karama to original Emperor; no Worthless substitution.');
  if (fullHolder) {
    const holder = semutaEmperorPlayer(game, native.holder);
    while (holder.hand.length < handLimit(holder)) {
      assert.ok(game.deck[0]);
      moveSemutaEmperorCard(game, game.deck[0].id, holder.id);
    }
    staging.push('Conserved undealt cards fill original Richese hand to four.');
  }
  let beforeCollection: Game | undefined, collectionQuote: CollectionQuote | undefined;
  if (scope === 'inflation') {
    // Empty Battle may auto-skip phase six when no market is entitled. Capture
    // the actual last spending-free Movement control, before any Collection.
    game = advance(game, g => g.phase === 5 && clean(g) && g.movementRemaining?.length === 1, actions);
    beforeCollection = structuredClone(game);
    collectionQuote = quoteSpiceCollection(game);
  }
  game = advance(game, g => scope === 'charity'
    ? g.response?.kind === 'choamCharity'
    : g.phase === 8 && clean(g), actions);
  assert.equal(game.turn, setup.turn);
  const beforeDeclaration = structuredClone(game);
  const declaration: Action | null = scope === 'inflation' ? { type: 'choamInflation', side: 'double' } : null;
  if (declaration) game = applySemutaHomeworldChoamStep(game, native.owner, declaration, actions);
  assert.equal(game.response?.kind, scope === 'charity' ? 'choamCharity' : 'choamInflation');
  assert.ok(viewGame(game, native.canceller).responseControls?.cancelCards.includes(card));
  return { scope, setup, beforeDeclaration, originalResponse: structuredClone(game), game,
    owner: native.owner, canceller: native.canceller, holder: native.holder, target: native.target,
    card, action: { type: 'card', mode: 'cancel', card }, declaration,
    event: null, actions, staging, beforeCollection, collectionQuote };
}

/** The returned game pauses at the printed cost, before accepted denial. */
export function disposeSemutaHomeworldEconomicKarama(
  f: SemutaHomeworldEconomicKaramaFixture, state = f.game, actions?: RicheseSkillsTechStep[],
): Game {
  const game = applySemutaHomeworldChoamStep(state, f.canceller, f.action, actions);
  f.event = game.pendingTreacheryDiscard?.batch.event ?? null;
  if (!game.pendingTreacheryDiscard) f.afterCancel = structuredClone(game);
  return game;
}

export function reactSemutaHomeworldEconomicKarama(state: Game, holder: string,
  claim: boolean, actions?: RicheseSkillsTechStep[]): Game {
  const pending = state.pendingTreacheryDiscard, reaction = pending?.reaction;
  assert.ok(pending && reaction?.stage === 'offer');
  const event = pending.batch.event;
  if (claim) return applySemutaHomeworldChoamStep(state, holder, { type: 'semutaCommit', event }, actions);
  let game = state;
  for (const seat of state.players.filter(p => !reaction.passed.includes(p.id)))
    game = applySemutaHomeworldChoamStep(game, seat.id, { type: 'semutaPass', event }, actions);
  return game;
}

/** Only original queues: charity ends into native Bidding; canceled Inflation
 * closes the same CHOAM Mentat and reaches ordinary next-turn opening income. */
export function finishSemutaHomeworldEconomicKarama(state: Game,
  f: SemutaHomeworldEconomicKaramaFixture, actions?: RicheseSkillsTechStep[]): Game {
  assert.ok(!state.pendingTreacheryDiscard &&
    state.response?.kind !== f.originalResponse.response?.kind,
    'The original printed Karama cost and denied response must already be retired');
  // A legal next actor may have declared a different native power, such as
  // Gamont. Settle that real response before following the original close.
  const settled = advance(state, g => !g.pendingTreacheryDiscard && !g.response, actions);
  f.afterCancel = structuredClone(settled);
  if (f.scope === 'charity') {
    const game = advance(settled, g => g.phase === 3 && clean(g), actions);
    f.targetSuffix = structuredClone(game);
    return game;
  }
  let game = advance(settled, g => g.decision?.kind === 'choamMentat', actions);
  assert.equal(game.decision!.player, f.owner);
  game = applySemutaHomeworldChoamStep(game, f.owner, { type: 'decision', done: true }, actions);
  game = advance(game, g => g.turn === state.turn + 1 && g.phase === 1 && clean(g), actions);
  f.beforeNextIncome = structuredClone(game);
  game = advance(game, g => g.phase === 2 && clean(g), actions);
  f.targetSuffix = structuredClone(game);
  return game;
}

/** Conserved equal-size substitution changes only private Semuta ownership. */
export function withoutSemutaHomeworldEconomicHolder(state: Game, holder: string): Game {
  const game = structuredClone(state), hand = semutaEmperorPlayer(game, holder).hand;
  const at = hand.findIndex(card => card.id === SEMUTA_DRUG_ID);
  const replacement = game.deck.findIndex(card => card.effect !== 'karama');
  assert.ok(at >= 0 && replacement >= 0);
  const semuta = hand[at];
  hand[at] = game.deck.splice(replacement, 1)[0];
  game.deck.push(semuta);
  return game;
}
