import assert from 'node:assert/strict';
import { createGame, joinGame, newPlayer, type Action, type Game } from '../game/engine';
import {
  actAdvisorPreparation, advisorPreparationClean, advisorPreparationInventory,
  advisorPreparationPlayer, nextAdvisorPreparationStep,
} from './fixture-advisor-preparation';

export type AdvisorGamontFlipStep = { actor: string; action: Action };
export type AdvisorGamontFlipTransition = { before: Game; steps: AdvisorGamontFlipStep[]; after: Game };
export const actAdvisorGamontFlip = actAdvisorPreparation;
export const advisorGamontFlipClean = advisorPreparationClean;
export const advisorGamontFlipInventory = advisorPreparationInventory;
export const advisorGamontFlipPlayer = advisorPreparationPlayer;

/** Preserve native cards, decline preparation, and stop at the final original
 * CHOAM chooser. Closing markets are finished without selling the held Gamont. */
export function nextAdvisorGamontFlip(game: Game): AdvisorGamontFlipStep | null {
  if (!game.phaseOpening && !game.response && !game.pendingTreacheryDiscard) {
    if (game.decision?.kind === 'choamMentat') return null;
    if (game.decision?.kind === 'advisorBattle')
      return { actor: game.decision.player, action: { type: 'decision', accept: false } };
  }
  return nextAdvisorPreparationStep(game);
}
export function advanceAdvisorGamontFlip(game: Game, until: (state: Game) => boolean,
  steps: AdvisorGamontFlipStep[] = []): Game {
  for (let count = 0; count < 1800; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished', 'The genuine Gamont chronology ended before its requested boundary');
    const next = nextAdvisorGamontFlip(game);
    assert.ok(next, `Choose the original final CHOAM/private control at ${game.turn}/${game.phase}/${game.decision?.kind}`);
    game = actAdvisorGamontFlip(game, next.actor, next.action, steps);
  }
  throw Error('The native advisor/Gamont source did not reach its finite boundary');
}
export function passAdvisorGamontFlip(game: Game, steps: AdvisorGamontFlipStep[] = []): Game {
  for (let count = 0; game.response && count < 60; count++) {
    const actor = game.players.find(player => !game.response!.passed.includes(player.id)); assert.ok(actor);
    game = actAdvisorGamontFlip(game, actor.id, { type: 'passResponse' }, steps);
  }
  assert.ok(!game.response); return game;
}

/** Actual public Advanced E2 source. BG earns fighters in Carthag and Tabr,
 * while its original advisor remains beside the last Atreides Arrakeen counter.
 * Stop BEFORE the original Gamont declaration, in ordinary or final Mentat.
 * No played force, phase, hand, wallet, stance, hold or receipt is assigned. */
export function createAdvisorGamontFlipFixture(options: { final?: boolean } = {}) {
  const final = options.final ?? true, bg = 'beneGesserit', holder = 'atreides', choam = 'choam';
  let game = createGame('ADVISORGAMONTFLIP', newPlayer(bg, 'Bene Gesserit', 'beneGesserit'), true, ['choam']);
  joinGame(game, newPlayer(holder, 'Atreides', 'atreides'));
  joinGame(game, newPlayer(choam, 'CHOAM', 'choam'));
  const initial = structuredClone(game), steps: AdvisorGamontFlipStep[] = [];
  const act = (actor: string, action: Action) => { game = actAdvisorGamontFlip(game, actor, action, steps); };
  const reach = (until: (state: Game) => boolean) => { game = advanceAdvisorGamontFlip(game, until, steps); };
  const transition = (run: () => void): AdvisorGamontFlipTransition => {
    const before = structuredClone(game), start = steps.length; run();
    return { before, steps: structuredClone(steps.slice(start)), after: structuredClone(game) };
  };
  for (const player of game.players) act(player.id, { type: 'ready' });
  const lobby = structuredClone(game); act(game.host, { type: 'start', advancedPreview: true });
  const setup = structuredClone(game);
  assert.equal(game.status, 'setup'); assert.equal(game.advanced, true);
  assert.deepEqual(game.expansions, ['choam']);
  assert.ok(!game.homeworlds && !game.nexusCards && !game.leaderSkills && !game.techTokens &&
    !game.strongholdCards && !game.discoveryEnabled && !game.ecazTreachery);
  assert.ok(game.players.every(player => player.hand.length === 0));
  const originalInventory = advisorGamontFlipInventory(game);
  assert.equal(originalInventory.length, 35);
  const karama = game.deck.find(card => card.effect === 'karama');
  const gamont = game.deck.find(card => card.name === 'Trip to Gamont');
  const ordinary = game.deck.find(card => card.kind === 'projectile');
  assert.ok(karama && gamont && ordinary);
  const selected = [ordinary, karama, gamont];
  const dealOrder = selected.map((card, position) => {
    const from = game.deck.findIndex(candidate => candidate.id === card.id); assert.ok(from >= position);
    [game.deck[position], game.deck[from]] = [game.deck[from], game.deck[position]];
    return { position, from, card: card.id };
  });
  const beforeStartingDeal = structuredClone(game);
  let advisorSetup: AdvisorGamontFlipTransition | null = null;
  for (let count = 0; game.status === 'setup' && count < 100; count++) {
    const next = nextAdvisorGamontFlip(game); assert.ok(next);
    const before = next.action.type === 'advisorSetup' ? structuredClone(game) : null;
    act(next.actor, next.action);
    if (before) advisorSetup = { before, steps: [structuredClone(next)], after: structuredClone(game) };
  }
  assert.equal(game.status, 'playing'); assert.ok(advisorSetup);
  const afterSetup = structuredClone(game);
  assert.deepEqual(game.players.flatMap(player => player.hand.map(card => card.id)), selected.map(card => card.id));
  assert.equal(advisorGamontFlipPlayer(game, bg).forces['arrakeen:10'], 1);
  assert.ok(advisorGamontFlipPlayer(game, bg).advisors?.arrakeen);
  assert.equal(advisorGamontFlipPlayer(game, holder).forces['arrakeen:10'], 10);
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
    reach(state => state.phase === 5 && state.active === bg && advisorGamontFlipClean(state));
  });
  const bgShipment = transition(() => {
    act(bg, { type: 'ship', territory: 'carthag', sector: 11, amount: 2, elite: 0, allyPayment: 0 });
    reach(advisorGamontFlipClean);
  });
  assert.equal(advisorGamontFlipPlayer(bgShipment.before, bg).spice - advisorGamontFlipPlayer(game, bg).spice, 2);
  assert.equal(advisorGamontFlipPlayer(game, bg).forces['carthag:11'], 2);
  assert.ok(!advisorGamontFlipPlayer(game, bg).advisors?.carthag);
  const bgMovement = transition(() => {
    act(bg, { type: 'move', from: 'carthag:11', territory: 'sietch_tabr', sector: 14, amount: 1 });
    reach(advisorGamontFlipClean);
  });
  assert.equal(advisorGamontFlipPlayer(game, bg).forces['carthag:11'], 1);
  assert.equal(advisorGamontFlipPlayer(game, bg).forces['sietch_tabr:14'], 1);
  assert.ok(!advisorGamontFlipPlayer(game, bg).advisors?.sietch_tabr);
  act(bg, { type: 'endMovement' });
  reach(state => state.phase === 5 && state.active === holder && advisorGamontFlipClean(state));
  const holderDeparture = transition(() => {
    act(holder, { type: 'move', from: 'arrakeen:10', territory: 'imperial_basin', sector: 10, amount: 9 });
    reach(advisorGamontFlipClean);
  });
  assert.equal(advisorGamontFlipPlayer(game, holder).forces['arrakeen:10'], 1);
  assert.equal(advisorGamontFlipPlayer(game, holder).forces['imperial_basin:10'], 9);
  assert.ok(advisorGamontFlipPlayer(game, bg).advisors?.arrakeen);
  reach(state => state.turn === 1 && state.phase === 8 && advisorGamontFlipClean(state));
  const ordinaryMentat = structuredClone(game), ordinaryMentatActionCount = steps.length;
  if (final) reach(state => state.phase === 8 && !state.phaseOpening && !state.response && state.decision?.kind === 'choamMentat');
  assert.equal(game.status, 'playing'); assert.equal(game.turn, 1); assert.equal(game.phase, 8);
  assert.equal(advisorGamontFlipPlayer(game, bg).forces['arrakeen:10'], 1);
  assert.ok(advisorGamontFlipPlayer(game, bg).advisors?.arrakeen);
  assert.equal(advisorGamontFlipPlayer(game, bg).forces['carthag:11'], 1);
  assert.equal(advisorGamontFlipPlayer(game, bg).forces['sietch_tabr:14'], 1);
  assert.equal(advisorGamontFlipPlayer(game, holder).forces['arrakeen:10'], 1);
  assert.ok(advisorGamontFlipPlayer(game, holder).hand.some(card => card.id === karama.id));
  assert.ok(advisorGamontFlipPlayer(game, choam).hand.some(card => card.id === gamont.id));
  assert.deepEqual(advisorGamontFlipInventory(game), originalInventory);
  const action: Action = { type: 'card', mode: 'choam', card: gamont.id, target: holder, from: 'arrakeen:10', elite: 0 };
  return { game, source: structuredClone(game), beforeAction: structuredClone(game), initial, lobby, setup,
    beforeStartingDeal, afterSetup, advisorSetup, openingOffer, declinedPreparation,
    bgShipment, bgMovement, holderDeparture, ordinaryMentat, ordinaryMentatActionCount,
    final, bg, owner: bg, choam, actor: choam, holder, atreides: holder,
    card: gamont.id, gamont: gamont.id, karama: karama.id, action,
    declarationStep: { actor: choam, action } satisfies AdvisorGamontFlipStep,
    territory: 'arrakeen', from: 'arrakeen:10', to: 'reserves', sector: 10,
    nearWin: { fighters: ['carthag', 'sietch_tabr'], advisors: ['arrakeen'], lastOutsider: holder },
    steps, actions: steps, sourceActionCount: steps.length, originalInventory, originalSpice, dealOrder, spiceOrder,
    staging: [
      'Actual public Advanced Bene Gesserit/Atreides/CHOAM ready/startPreview, prediction and private Traitor choices, with the original CHOAM35 deck and no optional module. Actual advisorSetup places BG’s starting advisor beside Atreides’ native ten Arrakeen counters.',
      'Select only original scalar shuffle order, three original unopened Treachery positions and two original unopened ordinary Spice positions. BG receives an ordinary weapon, Atreides its original Karama and CHOAM its original Trip to Gamont; no played hand or later card acquisition is staged.',
      'Actually complete safe first Storm, both Spice blows, Charity, normal Bidding and Revival, and decline original advisor preparation. BG pays two to ship two reserves as fighters into empty Carthag11, then uses its real city movement range to move one original counter from Carthag11 to empty Sietch Tabr14.',
      'BG actually ends movement. Atreides actually moves nine original counters from Arrakeen10 to Imperial Basin10, leaving one beside the original advisor. Other native turns finish normally; there is no battle or assigned casualty. Actual Collection gives BG two fighter-held strongholds while the Arrakeen advisor remains peaceful.',
      final
        ? 'Actually complete ordinary Mentat readiness and its closing CHOAM market without selling Gamont. Stop at the original public final choamMentat decision before declaring the held card.'
        : 'Stop at ordinary clean first Mentat before readiness and before declaring the held Gamont.',
      'No played phase, force, wallet, hand, stance, hold, prevention or receipt is installed. Gamont’s normal response, physical return, automatic advisor conversion and final victory continuation remain caller-owned outcomes.',
    ],
  };
}
export type AdvisorGamontFlipFixture = ReturnType<typeof createAdvisorGamontFlipFixture>;

/** Declare and allow only the original Worthless response, stopping before a
 * new mandatory conversion response or at the completed native return boundary.
 * The original final chooser is never answered by this helper. */
export function commitAdvisorGamontFlip(source: Game, fixture: AdvisorGamontFlipFixture,
  steps: AdvisorGamontFlipStep[] = []) {
  const before = structuredClone(source), start = steps.length;
  let game = actAdvisorGamontFlip(source, fixture.choam, fixture.action, steps);
  for (let count = 0; count < 80; count++) {
    const returned = (advisorGamontFlipPlayer(game, fixture.holder).forces[fixture.from] ?? 0) === 0 &&
      advisorGamontFlipPlayer(game, fixture.holder).reserves === advisorGamontFlipPlayer(before, fixture.holder).reserves + 1;
    if (game.response?.automaticAdvisorFlip || (returned && !game.response && !game.pendingTreacheryDiscard)) {
      assert.ok(returned, 'The original Gamont force returns before its advisor-conversion response');
      assert.ok(advisorGamontFlipPlayer(game, fixture.holder).hand.some(card => card.id === fixture.karama));
      return { game, before, after: structuredClone(game), steps: structuredClone(steps.slice(start)) };
    }
    assert.equal(game.response?.kind, 'choamWorthless', 'Allow only the original Gamont declaration before its committed return');
    const actor = game.players.find(player => !game.response!.passed.includes(player.id)); assert.ok(actor);
    game = actAdvisorGamontFlip(game, actor.id, { type: 'passResponse' }, steps);
  }
  throw Error('The original Gamont did not reach its committed physical-return boundary');
}

/** Explicitly finish the original Mentat after resolving the caller's owned
 * conversion choice. Native final confirmation may win or advance the turn. */
export function finishAdvisorGamontFlip(source: Game, steps: AdvisorGamontFlipStep[] = []): Game {
  const turn = source.turn;
  let game = source;
  for (let count = 0; count < 200; count++) {
    if (game.status === 'finished' || game.turn > turn) return game;
    const next = game.decision?.kind === 'choamMentat' && !game.response && !game.phaseOpening
      ? { actor: game.decision.player, action: { type: 'decision', done: true } satisfies Action }
      : nextAdvisorGamontFlip(game);
    assert.ok(next, 'Complete the original owned Gamont continuation before final Mentat');
    game = actAdvisorGamontFlip(game, next.actor, next.action, steps);
  }
  throw Error('The original Gamont Mentat continuation did not finish');
}
