import assert from 'node:assert/strict';
import { createGame, joinGame, newPlayer, viewGame, type Action, type Game } from '../game/engine';
import { guildHomeworldShipmentChoice } from '../game/guild-homeworld-shipment-options';
import { junctionTransportChoice } from '../game/junction-transport-options';
import type { HomeworldShipmentSources } from '../game/homeworld-shipment-options';
import {
  actAdvisorPreparation, advisorPreparationClean, advisorPreparationInventory,
  advisorPreparationPlayer, nextAdvisorPreparationStep,
} from './fixture-advisor-preparation';

export type AdvisorHomeworldFlipStep = { actor: string; action: Action };
export type AdvisorHomeworldFlipTransition = { before: Game; steps: AdvisorHomeworldFlipStep[]; after: Game };
export const actAdvisorHomeworldFlip = actAdvisorPreparation;
export const advisorHomeworldFlipClean = advisorPreparationClean;
export const advisorHomeworldFlipInventory = advisorPreparationInventory;
export const advisorHomeworldFlipPlayer = advisorPreparationPlayer;

/** Native continuation preserves the new mandatory conversion and original
 * destination Intrusion. Guild timing normally yields the next ordinary seat. */
export function nextAdvisorHomeworldFlip(game: Game): AdvisorHomeworldFlipStep | null {
  if (game.response?.automaticAdvisorFlip) return null;
  if (!game.phaseOpening && !game.response && !game.pendingTreacheryDiscard) {
    if (game.decision?.kind === 'intrusion') return null;
    if (game.decision?.kind === 'advisorBattle')
      return { actor: game.decision.player, action: { type: 'decision', accept: false } };
    if (game.decision?.kind === 'guildTiming')
      return { actor: game.decision.player, action: { type: 'decision', take: false } };
    if (game.decision?.kind === 'homeworldShipmentGuild')
      return { actor: game.decision.player, action: { type: 'decision', event: game.decision.event, allow: true } };
  }
  return nextAdvisorPreparationStep(game);
}
export function advanceAdvisorHomeworldFlip(game: Game, until: (state: Game) => boolean,
  steps: AdvisorHomeworldFlipStep[] = [], options: { takeGuild?: boolean } = {}): Game {
  for (let count = 0; count < 1800; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished', 'The native Homeworld chronology ended before its requested boundary');
    const next = nextAdvisorHomeworldFlip(game);
    assert.ok(next, `Choose the original conversion or Intrusion at ${game.turn}/${game.phase}/${game.decision?.kind}`);
    if (options.takeGuild && !game.phaseOpening && !game.response && game.decision?.kind === 'guildTiming')
      next.action = { type: 'decision', take: true };
    game = actAdvisorHomeworldFlip(game, next.actor, next.action, steps);
  }
  throw Error('The native Homeworld advisor source did not reach its finite boundary');
}
/** Ordinary response passes never consume the new advisor conversion. */
export function passAdvisorHomeworldFlip(game: Game, steps: AdvisorHomeworldFlipStep[] = []): Game {
  for (let count = 0; game.response && !game.response.automaticAdvisorFlip && count < 60; count++) {
    const actor = game.players.find(player => !game.response!.passed.includes(player.id)); assert.ok(actor);
    game = actAdvisorHomeworldFlip(game, actor.id, { type: 'passResponse' }, steps);
  }
  assert.ok(!game.response || game.response.automaticAdvisorFlip); return game;
}

/** Actual public Advanced classic + Homeworlds setup. Return either the native
 * Guild return or a real sponsored Junction choice, before its declaration.
 * Only original unopened card/Spice positions and scalar shuffle draws change. */
export function createAdvisorHomeworldFlipFixture(options: {
  kind?: 'native' | 'junction'; intrusion?: boolean; advisorArrival?: boolean;
} = {}) {
  const kind = options.kind ?? 'native', intrusion = options.intrusion ?? false;
  const advisorArrival = options.advisorArrival ?? false;
  assert.ok(!intrusion || kind === 'junction', 'The earned destination Intrusion uses Junction transport');
  assert.ok(!advisorArrival || kind === 'junction' && !intrusion, 'The advisor arrival uses its own Junction route');
  const bg = 'beneGesserit', holder = 'atreides', guild = 'guild';
  const territory = kind === 'native' ? 'tueks_sietch' : 'arrakeen', sector = kind === 'native' ? 5 : 10;
  let game = createGame('ADVISORHOMEWORLDFLIP', newPlayer(bg, 'Bene Gesserit', 'beneGesserit'), true);
  joinGame(game, newPlayer(holder, 'Atreides', 'atreides'));
  joinGame(game, newPlayer(guild, 'Guild', 'guild'));
  const initial = structuredClone(game), steps: AdvisorHomeworldFlipStep[] = [];
  const act = (actor: string, action: Action) => { game = actAdvisorHomeworldFlip(game, actor, action, steps); };
  const reach = (until: (state: Game) => boolean, takeGuild = false) => {
    game = advanceAdvisorHomeworldFlip(game, until, steps, { takeGuild });
  };
  const transition = (run: () => void): AdvisorHomeworldFlipTransition => {
    const before = structuredClone(game), start = steps.length; run();
    return { before, steps: structuredClone(steps.slice(start)), after: structuredClone(game) };
  };
  const enableHomeworlds = transition(() => { act(game.host, { type: 'homeworlds', enabled: true }); });
  for (const player of game.players) act(player.id, { type: 'ready' });
  const lobby = structuredClone(game); act(game.host, { type: 'start', advancedPreview: true });
  const setup = structuredClone(game);
  assert.equal(game.status, 'setup'); assert.equal(game.advanced, true); assert.ok(game.homeworlds);
  assert.deepEqual(game.expansions, []);
  assert.ok(!game.nexusCards && !game.leaderSkills && !game.techTokens && !game.strongholdCards &&
    !game.discoveryEnabled && !game.ecazTreachery);
  assert.ok(game.players.every(player => !player.hand.length));
  const originalInventory = advisorHomeworldFlipInventory(game); assert.equal(originalInventory.length, 33);
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
  let advisorSetup: AdvisorHomeworldFlipTransition | null = null;
  for (let count = 0; game.status === 'setup' && count < 100; count++) {
    const next = nextAdvisorHomeworldFlip(game); assert.ok(next);
    const before = next.action.type === 'advisorSetup' ? structuredClone(game) : null;
    if (before) next.action = { type: 'advisorSetup', territory, sector };
    act(next.actor, next.action);
    if (before) advisorSetup = { before, steps: [structuredClone(next)], after: structuredClone(game) };
  }
  assert.equal(game.status, 'playing'); assert.ok(advisorSetup);
  const afterSetup = structuredClone(game);
  assert.deepEqual(game.players.flatMap(player => player.hand.map(card => card.id)), selected.map(card => card.id));
  const from = `${territory}:${sector}`;
  assert.equal(advisorHomeworldFlipPlayer(game, bg).forces[from], 1);
  assert.ok(advisorHomeworldFlipPlayer(game, bg).advisors?.[territory]);
  assert.equal(advisorHomeworldFlipPlayer(game, kind === 'native' ? guild : holder).forces[from], kind === 'native' ? 5 : 10);
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
    reach(state => state.phase === 5 && state.active === (kind === 'native' ? guild : bg) && advisorHomeworldFlipClean(state), kind === 'native');
  });
  let intrusionShipment: AdvisorHomeworldFlipTransition | null = null;
  let bgEnd: AdvisorHomeworldFlipTransition | null = null;
  let junctionOffer: AdvisorHomeworldFlipTransition | null = null;
  let offerStep: AdvisorHomeworldFlipStep | null = null;
  if (kind === 'junction') {
    if (intrusion) {
      intrusionShipment = transition(() => {
        act(bg, { type: 'ship', territory: 'imperial_basin', sector: 10, amount: 1, elite: 0, allyPayment: 0 });
        reach(advisorHomeworldFlipClean);
      });
      assert.equal(advisorHomeworldFlipPlayer(intrusionShipment.before, bg).spice - advisorHomeworldFlipPlayer(game, bg).spice, 2);
      assert.equal(advisorHomeworldFlipPlayer(game, bg).forces['imperial_basin:10'], 1);
      assert.ok(!advisorHomeworldFlipPlayer(game, bg).advisors?.imperial_basin);
    }
    if (!advisorArrival) {
      bgEnd = transition(() => {
        act(bg, { type: 'endMovement' });
        reach(state => state.phase === 5 && state.active === holder && advisorHomeworldFlipClean(state));
      });
    }
    const sponsor = viewGame(game, guild).junctionTransport; assert.ok(sponsor?.canOffer);
    assert.equal(sponsor.recipient, advisorArrival ? bg : holder);
    offerStep = { actor: guild, action: { type: 'offerJunctionTransport', event: sponsor.offerEvent, rate: 'half' } };
    junctionOffer = transition(() => { act(offerStep!.actor, offerStep!.action); });
  }
  const shipper = kind === 'native' ? guild : advisorArrival ? bg : holder;
  const amount = kind === 'native' ? 5 : advisorArrival ? 1 : 10;
  const to = kind === 'native' ? 'homeworld:guild' : intrusion || advisorArrival ? 'imperial_basin:10' : 'homeworld:atreides';
  const sources: HomeworldShipmentSources = { [from]: { normal: amount, elite: 0 } };
  const quote = kind === 'native'
    ? guildHomeworldShipmentChoice(viewGame(game, shipper), to, sources, 0)
    : junctionTransportChoice(viewGame(game, shipper), to, sources, 0);
  assert.equal(quote.blocked, null); assert.ok(quote.action);
  const action = quote.action, cost = quote.cost;
  assert.equal(cost, kind === 'native' ? 3 : advisorArrival ? 1 : intrusion ? 10 : 5);
  assert.equal(game.turn, 1); assert.equal(game.phase, 5); assert.equal(game.active, shipper);
  assert.ok(advisorHomeworldFlipClean(game));
  assert.equal(advisorHomeworldFlipPlayer(game, shipper).forces[from], amount);
  assert.equal(advisorHomeworldFlipPlayer(game, shipper).shipped, false);
  assert.equal(advisorHomeworldFlipPlayer(game, shipper).moved, 0);
  assert.equal(advisorHomeworldFlipPlayer(game, bg).forces[from], 1);
  assert.ok(advisorHomeworldFlipPlayer(game, bg).advisors?.[territory]);
  assert.ok(advisorHomeworldFlipPlayer(game, holder).hand.some(card => card.id === karama.id));
  assert.deepEqual(advisorHomeworldFlipInventory(game), originalInventory);
  return { game, source: structuredClone(game), beforeAction: structuredClone(game), initial,
    enableHomeworlds, lobby, setup, beforeStartingDeal, afterSetup, advisorSetup,
    openingOffer, declinedPreparation, intrusionShipment, bgEnd, junctionOffer, offerStep,
    kind, intrusion, advisorArrival, bg, owner: bg, holder, atreides: holder, guild, shipper, actor: shipper,
    karama: karama.id, card: karama.id, territory: advisorArrival ? 'imperial_basin' : territory,
    origin: territory, sector, location: from,
    from, to, destination: to, sources, amount, cost, action,
    transportStep: { actor: shipper, action } satisfies AdvisorHomeworldFlipStep,
    steps, actions: steps, sourceActionCount: steps.length, originalInventory, originalSpice, dealOrder, spiceOrder,
    staging: [
      'Actual public Advanced Bene Gesserit/Atreides/Guild setup enables Homeworlds with the original lobby action, then uses ready/startPreview, native prediction and private Traitor decisions. Original base33, physical native Homeworld pools and ordinary starting forces remain; no other optional module is selected.',
      'Select only original scalar shuffle draws, three original unopened Treachery positions and two original unopened ordinary Spice positions. Atreides really receives its original starting Karama while BG/Guild receive ordinary cards; no played hand or card acquisition is staged.',
      kind === 'native'
        ? 'Actual advisorSetup places the original BG advisor beside Guild’s native five Tuek’s Sietch5 counters. Safe first Storm, both Spice blows, Charity, Bidding and Revival execute normally. BG declines preparation; Guild actually takes its first native early turn and retains all five source counters.'
        : `Actual advisorSetup places the original BG advisor beside Atreides’ native ten Arrakeen10 counters. Safe first Storm, both Spice blows, Charity, Bidding and Revival execute normally. BG declines preparation and Guild declines original early timing.${advisorArrival ? ' BG retains its actual unused turn.' : ' BG’s real turn ends before the unused Atreides shipment.'}`,
      intrusion
        ? 'During its actual first turn BG pays two spice to ship one native reserve into empty Imperial Basin10 as a fighter. Original Guild interception/income resolves through actual decisions and passes. The original Arrakeen advisor remains peaceful; Atreides retains its full original ten-spice shipment budget.'
        : 'No native source group is moved or reduced before the tested declaration.',
      kind === 'native'
        ? 'Stop before the exact owner-view guildHomeworldShipmentChoice returning five real Tuek’s counters to native Junction for three. Original Guild interception, transport permission, rate, payment and physical return remain caller continuations.'
        : advisorArrival
          ? 'Guild actually offers its current high-population Junction half tariff to BG. Stop before moving the original Arrakeen advisor to empty Basin10 for one spice; a mandatory destination conversion follows the committed transfer.'
          : intrusion
          ? 'Guild actually offers its current high-population Junction half tariff to Atreides. Stop before the exact junctionTransportChoice transporting all ten real Arrakeen counters to BG’s earned Basin fighter for ten; origin conversion and original destination Intrusion remain caller continuations.'
          : 'Guild actually offers its current high-population Junction half tariff to Atreides. Stop before the exact junctionTransportChoice returning all ten real Arrakeen counters to native Caladan for five. Junction permission and tariff retain their original immune source.',
      'No played army, phase, wallet, hand, native reserve, advisor stance, hold, transport privilege, price, response or receipt is installed. Automatic conversion and Intrusion are not answered by commit/continuation helpers.',
    ],
  };
}
export type AdvisorHomeworldFlipFixture = ReturnType<typeof createAdvisorHomeworldFlipFixture>;

/** Declare once and allow only original Homeworld interception/permission/rate
 * and income. Stop before conversion or original destination Intrusion; legacy
 * runtimes may instead finish at their clean committed boundary. */
export function commitAdvisorHomeworldFlip(source: Game, fixture: AdvisorHomeworldFlipFixture,
  steps: AdvisorHomeworldFlipStep[] = []) {
  const before = structuredClone(source), start = steps.length;
  let game = source;
  if (!game.pendingHomeworldShipment && !game.response && !advisorHomeworldFlipPlayer(game, fixture.shipper).shipped)
    game = actAdvisorHomeworldFlip(game, fixture.shipper, fixture.action, steps);
  for (let count = 0; count < 120; count++) {
    const shipper = advisorHomeworldFlipPlayer(game, fixture.shipper);
    const committed = shipper.shipped && (shipper.forces[fixture.from] ?? 0) === 0;
    if (game.response?.automaticAdvisorFlip || game.decision?.kind === 'intrusion' ||
        (committed && advisorHomeworldFlipClean(game))) {
      assert.ok(committed, 'The original typed transport physically commits before conversion/Intrusion');
      assert.ok(advisorHomeworldFlipPlayer(game, fixture.holder).hand.some(card => card.id === fixture.karama));
      assert.deepEqual(advisorHomeworldFlipInventory(game), fixture.originalInventory);
      return { game, before, after: structuredClone(game), steps: structuredClone(steps.slice(start)),
        price: advisorHomeworldFlipPlayer(before, fixture.shipper).spice - shipper.spice };
    }
    if (game.decision?.kind === 'homeworldShipmentGuild' && !game.response) {
      game = actAdvisorHomeworldFlip(game, game.decision.player,
        { type: 'decision', event: game.decision.event, allow: true }, steps); continue;
    }
    assert.ok(game.response && ['guildTransportPermission', 'guildRate', 'guildIncome'].includes(game.response.kind),
      'Allow only the original Homeworld transport continuations before conversion');
    const actor = game.players.find(player => !game.response!.passed.includes(player.id)); assert.ok(actor);
    game = actAdvisorHomeworldFlip(game, actor.id, { type: 'passResponse' }, steps);
  }
  throw Error('The native Homeworld transport did not reach its committed boundary');
}

/** Finish only after caller-owned conversion and Intrusion have been resolved. */
export function finishAdvisorHomeworldFlip(source: Game, steps: AdvisorHomeworldFlipStep[] = []): Game {
  return advanceAdvisorHomeworldFlip(source,
    game => !game.battle && game.phase >= 6 && game.phase <= 7 && advisorHomeworldFlipClean(game), steps);
}
