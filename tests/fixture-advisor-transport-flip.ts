import assert from 'node:assert/strict';
import { createGame, joinGame, newPlayer, type Action, type Game } from '../game/engine';
import {
  actAdvisorPreparation, advisorPreparationClean, advisorPreparationInventory,
  advisorPreparationPlayer, nextAdvisorPreparationStep,
} from './fixture-advisor-preparation';

export type AdvisorTransportFlipStep = { actor: string; action: Action };
export type AdvisorTransportFlipTransition = {
  before: Game; steps: AdvisorTransportFlipStep[]; after: Game;
};
export const actAdvisorTransportFlip = actAdvisorPreparation;
export const advisorTransportFlipClean = advisorPreparationClean;
export const advisorTransportFlipInventory = advisorPreparationInventory;
export const advisorTransportFlipPlayer = advisorPreparationPlayer;

/** The original public setup places the advisor beside Guild's native army.
 * Guild may actually take its native early turn; no origin group is moved. */
export function nextAdvisorTransportFlip(game: Game): AdvisorTransportFlipStep | null {
  if (!game.phaseOpening && !game.response && !game.pendingTreacheryDiscard) {
    if (game.status === 'setup' && game.setupStage === 'forces' &&
        !advisorTransportFlipPlayer(game, 'beneGesserit').advisorSetup)
      return { actor: 'beneGesserit', action: { type: 'advisorSetup', territory: 'tueks_sietch', sector: 5 } };
    if (game.decision?.kind === 'advisorBattle')
      return { actor: game.decision.player, action: { type: 'decision', accept: false } };
    if (game.decision?.kind === 'guildTiming')
      return { actor: game.decision.player, action: { type: 'decision', take: true } };
  }
  return nextAdvisorPreparationStep(game);
}
export function advanceAdvisorTransportFlip(game: Game, until: (state: Game) => boolean,
  steps: AdvisorTransportFlipStep[] = []): Game {
  for (let count = 0; count < 1600; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished', 'The genuine transport-flip chronology ended before its requested boundary');
    const next = nextAdvisorTransportFlip(game);
    assert.ok(next, `Choose the original native control at ${game.turn}/${game.phase}/${game.decision?.kind}`);
    game = actAdvisorTransportFlip(game, next.actor, next.action, steps);
  }
  throw Error('The native transport-flip source did not reach its finite boundary');
}
export function passAdvisorTransportFlip(game: Game, steps: AdvisorTransportFlipStep[] = []): Game {
  for (let count = 0; game.response && count < 60; count++) {
    const actor = game.players.find(player => !game.response!.passed.includes(player.id)); assert.ok(actor);
    game = actAdvisorTransportFlip(game, actor.id, { type: 'passResponse' }, steps);
  }
  assert.ok(!game.response); return game;
}

/** Public Advanced BG/Atreides/Guild. The native advisor and all five original
 * Guild counters share Tuek's Sietch, whose printed sector is 5. Stop BEFORE
 * cross/return transport. All payment, transfer and flip responses are native
 * caller continuations; no played force, phase, wallet, hand or hold is set. */
export function createAdvisorTransportFlipFixture(options: { kind?: 'cross' | 'return'; intrusion?: boolean } = {}) {
  const kind = options.kind ?? 'cross', intrusion = options.intrusion ?? false;
  assert.ok(!intrusion || kind === 'cross', 'The native Intrusion source uses the cross route');
  const bg = 'beneGesserit', holder = 'atreides', guild = 'guild';
  let game = createGame('ADVISORTRANSPORTFLIP', newPlayer(bg, 'Bene Gesserit', 'beneGesserit'), true);
  joinGame(game, newPlayer(holder, 'Atreides', 'atreides'));
  joinGame(game, newPlayer(guild, 'Guild', 'guild'));
  const initial = structuredClone(game), steps: AdvisorTransportFlipStep[] = [];
  const act = (actor: string, action: Action) => { game = actAdvisorTransportFlip(game, actor, action, steps); };
  const reach = (until: (state: Game) => boolean) => { game = advanceAdvisorTransportFlip(game, until, steps); };
  const transition = (run: () => void): AdvisorTransportFlipTransition => {
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
  const originalInventory = advisorTransportFlipInventory(game);
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
  let advisorSetup: AdvisorTransportFlipTransition | null = null;
  for (let count = 0; game.status === 'setup' && count < 100; count++) {
    const next = nextAdvisorTransportFlip(game); assert.ok(next);
    const before = next.action.type === 'advisorSetup' ? structuredClone(game) : null;
    act(next.actor, next.action);
    if (before) advisorSetup = { before, steps: [structuredClone(next)], after: structuredClone(game) };
  }
  assert.equal(game.status, 'playing'); assert.ok(advisorSetup);
  const afterSetup = structuredClone(game);
  assert.deepEqual(game.players.flatMap(player => player.hand.map(card => card.id)), selected.map(card => card.id));
  assert.equal(advisorTransportFlipPlayer(game, bg).forces['tueks_sietch:5'], 1);
  assert.ok(advisorTransportFlipPlayer(game, bg).advisors?.tueks_sietch);
  assert.equal(advisorTransportFlipPlayer(game, guild).forces['tueks_sietch:5'], 5);
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
    if (intrusion) {
      for (let count = 0; count < 100 && !(game.phase === 5 && game.active === bg && advisorTransportFlipClean(game)); count++) {
        const next = nextAdvisorTransportFlip(game); assert.ok(next);
        if (!game.phaseOpening && !game.response && game.decision?.kind === 'guildTiming')
          next.action = { type: 'decision', take: false };
        act(next.actor, next.action);
      }
      assert.ok(game.phase === 5 && game.active === bg && advisorTransportFlipClean(game));
    } else reach(state => state.phase === 5 && state.active === guild && advisorTransportFlipClean(state));
  });
  let intrusionShipment: AdvisorTransportFlipTransition | null = null;
  let bgEnd: AdvisorTransportFlipTransition | null = null;
  if (intrusion) {
    intrusionShipment = transition(() => {
      act(bg, { type: 'ship', territory: 'imperial_basin', sector: 10, amount: 1, elite: 0, allyPayment: 0 });
      reach(advisorTransportFlipClean);
    });
    assert.equal(advisorTransportFlipPlayer(intrusionShipment.before, bg).spice - advisorTransportFlipPlayer(game, bg).spice, 2);
    assert.equal(advisorTransportFlipPlayer(game, bg).forces['imperial_basin:10'], 1);
    assert.ok(!advisorTransportFlipPlayer(game, bg).advisors?.imperial_basin);
    bgEnd = transition(() => {
      act(bg, { type: 'endMovement' });
      reach(state => state.phase === 5 && state.active === guild && advisorTransportFlipClean(state));
    });
  }
  assert.equal(game.active, guild); assert.equal(game.phase, 5); assert.ok(advisorTransportFlipClean(game));
  assert.equal(advisorTransportFlipPlayer(game, bg).forces['tueks_sietch:5'], 1);
  assert.ok(advisorTransportFlipPlayer(game, bg).advisors?.tueks_sietch);
  assert.equal(advisorTransportFlipPlayer(game, guild).forces['tueks_sietch:5'], 5);
  assert.equal(advisorTransportFlipPlayer(game, guild).shipped, false);
  assert.equal(advisorTransportFlipPlayer(game, guild).moved, 0);
  assert.equal(advisorTransportFlipPlayer(game, bg).forces['imperial_basin:10'] ?? 0, intrusion ? 1 : 0);
  assert.ok(game.players.filter(player => player.id !== bg).every(player => (player.forces['imperial_basin:10'] ?? 0) === 0));
  assert.ok(advisorTransportFlipPlayer(game, holder).hand.some(card => card.id === karama.id));
  assert.deepEqual(advisorTransportFlipInventory(game), originalInventory);
  const from = 'tueks_sietch:5', to = kind === 'return' ? 'reserves' : 'imperial_basin:10';
  const action: Action = { type: 'guildShip', from, amount: 5, elite: 0, allyPayment: 0,
    territory: kind === 'return' ? 'reserves' : 'imperial_basin', ...(kind === 'cross' ? { sector: 10 } : {}) };
  return { game, source: structuredClone(game), beforeAction: structuredClone(game), initial, lobby, setup,
    beforeStartingDeal, afterSetup, advisorSetup, openingOffer, declinedPreparation, intrusionShipment, bgEnd,
    kind, intrusion, bg, owner: bg, holder, atreides: holder, guild, actor: guild, observer: guild,
    card: karama.id, karama: karama.id, action, transportStep: { actor: guild, action } satisfies AdvisorTransportFlipStep,
    territory: 'tueks_sietch', sector: 5, from, to, amount: 5,
    steps, actions: steps, sourceActionCount: steps.length, originalInventory, originalSpice, dealOrder, spiceOrder,
    staging: [
      'Actual public Advanced Bene Gesserit/Atreides/Guild ready/startPreview, prediction and private Traitor choices. The native advisorSetup action places one advisor at Tuek’s Sietch5 beside Guild’s original five counters. The printed board and native setup both use sector5; no sector9 position is manufactured.',
      'Select only original scalar shuffle order, three original unopened Treachery positions and two original unopened ordinary Spice positions. Atreides really receives its original starting Karama; no later card or hand acquisition is staged.',
      intrusion
        ? 'Actually complete safe first Storm, both Spice blows, Charity, normal Bidding and Revival, then decline optional advisor preparation and Guild’s first native early timing opportunity. BG pays two to ship one reserve into empty Imperial Basin10 as a fighter; original Guild interception/income controls resolve with the original Karama retained. BG really ends its turn, then Guild takes its next native early opportunity. The original BG advisor and five Guild counters remain at Tuek’s Sietch5.'
        : 'Actually complete safe first Storm, both Spice blows, Charity, normal Bidding and Revival. Decline original optional advisor preparation, then actually take Guild’s native early movement turn and allow its original response. All five Guild source counters remain unmoved.',
      kind === 'return'
        ? 'Stop before the actual guildShip return of all five original Tuek’s counters to abstract reserves. Permission, rate, payment, physical return and automatic advisor conversion remain caller actions.'
        : intrusion
          ? 'Stop before the actual guildShip cross-shipment of all five original Tuek’s counters to Imperial Basin10, where BG’s real paid fighter now stands. Original permission/rate, physical transfer, origin automatic conversion and destination Intrusion remain caller continuations.'
          : 'Stop before the actual guildShip cross-shipment of all five original Tuek’s counters to empty Imperial Basin10. Permission, rate, payment, physical transfer and automatic advisor conversion remain caller actions.',
      'No played army, advisor stance, phase, wallet, hand, reserve, hold, response or receipt is assigned. This source does not assert an automatic-flip outcome.',
    ],
  };
}
export type AdvisorTransportFlipFixture = ReturnType<typeof createAdvisorTransportFlipFixture>;

/** Allow only original transport continuations and stop BEFORE passing the
 * automatic advisor response. Older engines can reach a clean committed state;
 * this source helper does not substitute an expected flip outcome. */
export function commitAdvisorTransportFlip(source: Game, fixture: AdvisorTransportFlipFixture,
  steps: AdvisorTransportFlipStep[] = []) {
  const before = structuredClone(source), start = steps.length;
  let game = source;
  if (!game.pendingGuildTransport && !game.response)
    game = actAdvisorTransportFlip(game, fixture.guild, fixture.action, steps);
  for (let count = 0; count < 100; count++) {
    const guild = advisorTransportFlipPlayer(game, fixture.guild);
    const committed = guild.shipped && (guild.forces[fixture.from] ?? 0) === 0;
    if (game.response?.automaticAdvisorFlip || (committed && advisorTransportFlipClean(game))) {
      assert.ok(committed, 'The actual physical transport commits before its advisor response');
      assert.ok(advisorTransportFlipPlayer(game, fixture.holder).hand.some(card => card.id === fixture.card));
      return { game, before, after: structuredClone(game), steps: structuredClone(steps.slice(start)),
        price: advisorTransportFlipPlayer(before, fixture.guild).spice - guild.spice };
    }
    const next = nextAdvisorTransportFlip(game); assert.ok(next, 'The original transport continuation needs its live native control');
    game = actAdvisorTransportFlip(game, next.actor, next.action, steps);
  }
  throw Error('The native Guild transport did not reach its physical commitment boundary');
}
export function finishAdvisorTransportFlip(source: Game, steps: AdvisorTransportFlipStep[] = []): Game {
  return advanceAdvisorTransportFlip(source, game => game.phase >= 6 && game.phase <= 7 && advisorTransportFlipClean(game), steps);
}
