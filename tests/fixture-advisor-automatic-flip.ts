import assert from 'node:assert/strict';
import { createGame, joinGame, newPlayer, type Action, type Game } from '../game/engine';
import {
  actAdvisorPreparation, advisorPreparationClean, advisorPreparationInventory,
  advisorPreparationPlayer, nextAdvisorPreparationStep,
} from './fixture-advisor-preparation';

export type AdvisorAutomaticFlipStep = { actor: string; action: Action };
export type AdvisorAutomaticFlipTransition = {
  before: Game; steps: AdvisorAutomaticFlipStep[]; after: Game;
};
export const actAdvisorAutomaticFlip = actAdvisorPreparation;
export const advisorAutomaticFlipClean = advisorPreparationClean;
export const advisorAutomaticFlipInventory = advisorPreparationInventory;
export const advisorAutomaticFlipPlayer = advisorPreparationPlayer;

/** Original native setup/phase controls; retain the source advisor stance by
 * declining optional preparation and leave Guild's movement until last. */
export function nextAdvisorAutomaticFlip(game: Game): AdvisorAutomaticFlipStep | null {
  if (!game.phaseOpening && !game.response && !game.pendingTreacheryDiscard) {
    if (game.decision?.kind === 'advisorBattle')
      return { actor: game.decision.player, action: { type: 'decision', accept: false } };
    if (game.decision?.kind === 'guildTiming')
      return { actor: game.decision.player, action: { type: 'decision', take: false } };
  }
  return nextAdvisorPreparationStep(game);
}
export function advanceAdvisorAutomaticFlip(game: Game, until: (state: Game) => boolean,
  steps: AdvisorAutomaticFlipStep[] = []): Game {
  for (let count = 0; count < 1600; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished', 'The native automatic-flip chronology ended before its requested boundary');
    const next = nextAdvisorAutomaticFlip(game);
    assert.ok(next, `Choose the original private control at ${game.turn}/${game.phase}/${game.decision?.kind}`);
    game = actAdvisorAutomaticFlip(game, next.actor, next.action, steps);
  }
  throw Error('The genuine automatic-flip source did not reach its finite boundary');
}
export function passAdvisorAutomaticFlip(game: Game, steps: AdvisorAutomaticFlipStep[] = []): Game {
  for (let count = 0; game.response && count < 60; count++) {
    const actor = game.players.find(player => !game.response!.passed.includes(player.id)); assert.ok(actor);
    game = actAdvisorAutomaticFlip(game, actor.id, { type: 'passResponse' }, steps);
  }
  assert.ok(!game.response); return game;
}

/** Public Advanced BG/Atreides/Guild with the native advisor actually placed at
 * occupied Arrakeen. Stop BEFORE a real ground movement would leave advisors
 * alone: BG empty-territory arrival, or the last Atreides outsiders' departure.
 * No played force, stance, phase, wallet, hand or prevention receipt is set. */
export function createAdvisorAutomaticFlipFixture(options: { kind: 'arrival' | 'departure' } = { kind: 'arrival' }) {
  const kind = options.kind, bg = 'beneGesserit', holder = 'atreides', observer = 'guild';
  let game = createGame('ADVISORAUTOMATICFLIP', newPlayer(bg, 'Bene Gesserit', 'beneGesserit'), true);
  joinGame(game, newPlayer(holder, 'Atreides', 'atreides'));
  joinGame(game, newPlayer(observer, 'Guild', 'guild'));
  const initial = structuredClone(game), steps: AdvisorAutomaticFlipStep[] = [];
  const act = (actor: string, action: Action) => { game = actAdvisorAutomaticFlip(game, actor, action, steps); };
  const reach = (until: (state: Game) => boolean) => { game = advanceAdvisorAutomaticFlip(game, until, steps); };
  const transition = (run: () => void): AdvisorAutomaticFlipTransition => {
    const before = structuredClone(game), start = steps.length; run();
    return { before, steps: structuredClone(steps.slice(start)), after: structuredClone(game) };
  };
  for (const player of game.players) act(player.id, { type: 'ready' });
  const lobby = structuredClone(game); act(game.host, { type: 'start', advancedPreview: true });
  const setup = structuredClone(game);
  assert.equal(game.status, 'setup'); assert.equal(game.advanced, true);
  assert.equal(game.expansions.length, 0);
  assert.ok(!game.homeworlds && !game.nexusCards && !game.leaderSkills && !game.techTokens &&
    !game.strongholdCards && !game.discoveryEnabled && !game.ecazTreachery);
  assert.ok(game.players.every(player => player.hand.length === 0));
  const originalInventory = advisorAutomaticFlipInventory(game);
  const karama = game.deck.find(card => card.effect === 'karama'); assert.ok(karama);
  const ordinary = game.deck.filter(card => ['projectile', 'poison', 'shield', 'snooper'].includes(card.kind)).slice(0, 2);
  assert.equal(ordinary.length, 2);
  const selected = [ordinary[0], karama, ordinary[1]];
  const dealOrder = selected.map((card, position) => {
    const from = game.deck.findIndex(candidate => candidate.id === card.id); assert.ok(from >= position);
    [game.deck[position], game.deck[from]] = [game.deck[from], game.deck[position]];
    return { position, from, card: card.id };
  });
  const beforeStartingDeal = structuredClone(game);
  let advisorSetup: AdvisorAutomaticFlipTransition | null = null;
  for (let count = 0; game.status === 'setup' && count < 100; count++) {
    const next = nextAdvisorAutomaticFlip(game); assert.ok(next);
    const before = next.action.type === 'advisorSetup' ? structuredClone(game) : null;
    act(next.actor, next.action);
    if (before) advisorSetup = { before, steps: [structuredClone(next)], after: structuredClone(game) };
  }
  assert.equal(game.status, 'playing'); assert.ok(advisorSetup);
  const afterSetup = structuredClone(game);
  assert.deepEqual(game.players.flatMap(player => player.hand.map(card => card.id)), selected.map(card => card.id));
  assert.equal(advisorAutomaticFlipPlayer(game, bg).forces['arrakeen:10'], 1);
  assert.ok(advisorAutomaticFlipPlayer(game, bg).advisors?.arrakeen);
  assert.equal(advisorAutomaticFlipPlayer(game, holder).forces['arrakeen:10'], 10);
  const originalSpice = game.spiceDeck.map(card => JSON.stringify(card)).sort();
  const spiceOrder = [0, 1].map(position => {
    const from = game.spiceDeck.findIndex((card, index) => index >= position && 'territory' in card && !card.discovery);
    assert.ok(from >= position); const card = game.spiceDeck.splice(from, 1)[0];
    game.spiceDeck.splice(position, 0, card); return { position, from, card: structuredClone(card) };
  });
  assert.deepEqual(game.spiceDeck.map(card => JSON.stringify(card)).sort(), originalSpice);
  reach(state => state.turn === 1 && state.phase === 5 && !state.phaseOpening && !state.response && state.decision?.kind === 'advisorBattle');
  const openingOffer = structuredClone(game);
  const declinedPreparation = transition(() => {
    act(bg, { type: 'decision', accept: false });
    reach(state => state.phase === 5 && state.active === bg && advisorAutomaticFlipClean(state));
  });
  let skippedBg: AdvisorAutomaticFlipTransition | null = null;
  if (kind === 'departure') skippedBg = transition(() => {
    act(bg, { type: 'endMovement' });
    reach(state => state.phase === 5 && state.active === holder && advisorAutomaticFlipClean(state));
  });
  const actor = kind === 'arrival' ? bg : holder, amount = kind === 'arrival' ? 1 : 10;
  const territory = kind === 'arrival' ? 'imperial_basin' : 'arrakeen';
  assert.equal(game.active, actor); assert.ok(advisorAutomaticFlipClean(game));
  assert.equal(advisorAutomaticFlipPlayer(game, bg).forces['arrakeen:10'], 1);
  assert.ok(advisorAutomaticFlipPlayer(game, bg).advisors?.arrakeen);
  assert.equal(advisorAutomaticFlipPlayer(game, holder).forces['arrakeen:10'], 10);
  assert.ok(game.players.every(player => (player.forces['imperial_basin:10'] ?? 0) === 0));
  assert.ok(advisorAutomaticFlipPlayer(game, holder).hand.some(card => card.id === karama.id));
  assert.deepEqual(advisorAutomaticFlipInventory(game), originalInventory);
  const action: Action = { type: 'move', from: 'arrakeen:10', territory: 'imperial_basin', sector: 10, amount };
  return { game, source: structuredClone(game), initial, lobby, setup, beforeStartingDeal, afterSetup,
    advisorSetup, openingOffer, declinedPreparation, skippedBg,
    kind, bg, owner: bg, holder, atreides: holder, observer, guild: observer,
    actor, card: karama.id, karama: karama.id, action,
    movementStep: { actor, action } satisfies AdvisorAutomaticFlipStep,
    from: 'arrakeen:10', to: 'imperial_basin:10', territory, automaticTerritory: territory, sector: 10, amount,
    steps, actions: steps, sourceActionCount: steps.length, originalInventory, originalSpice, dealOrder, spiceOrder,
    staging: [
      'Actual public Advanced Bene Gesserit/Atreides/Guild ready/startPreview, prediction and private Traitor choices. The original advisorSetup action places one advisor at occupied Arrakeen10 beside the ten native Atreides counters.',
      'Select only original scalar shuffle order, three original unopened Treachery positions and two original unopened ordinary Spice positions. Atreides actually receives the original starting Karama; no later hand or card acquisition is staged.',
      'Actually complete safe first Storm, both Spice blows, Charity, normal Bidding and Revival. Decline the original optional advisorBattle preparation and defer Guild through its native timing choices; no faction ships or moves an origin counter.',
      kind === 'departure'
        ? 'Actually end BG’s unused movement turn, then stop at Atreides’ native active turn with all ten original Arrakeen counters still present. Their whole-group ground move to empty Imperial Basin10 remains the caller action.'
        : 'Stop at BG’s native active turn with its original advisor still beside Atreides. Moving that one advisor to empty Imperial Basin10 remains the caller action.',
      'The source ends before the tested movement. No played army, stance, phase, wallet, Tanks, hold, response or cancellation receipt is assigned, and no automatic-flip outcome is asserted.',
    ],
  };
}
export type AdvisorAutomaticFlipFixture = ReturnType<typeof createAdvisorAutomaticFlipFixture>;

/** After the caller resolves any actual automatic-flip response, continue the
 * original turns into the next native Battle/Collection boundary. */
export function finishAdvisorAutomaticFlip(source: Game, steps: AdvisorAutomaticFlipStep[] = []): Game {
  return advanceAdvisorAutomaticFlip(source, game => game.phase >= 6 && game.phase <= 7 && advisorAutomaticFlipClean(game), steps);
}
