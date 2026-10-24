import assert from 'node:assert/strict';
import { createGame, joinGame, newPlayer, viewGame, type Action, type Game } from '../game/engine';
import { splitLocation, territory } from '../game/board';
import { guildShipmentCost } from '../game/shipment-price';
import { junctionTransportChoice } from '../game/junction-transport-options';
import type { HomeworldShipmentSources } from '../game/homeworld-shipment-options';
import {
  actAdvisorPreparation, advisorPreparationClean, advisorPreparationInventory,
  advisorPreparationPlayer, nextAdvisorPreparationStep,
} from './fixture-advisor-preparation';

export type AdvisorTransportMatchingKind = 'guild' | 'junctionBoard' | 'junctionWorld';
export type AdvisorTransportMatchingDirection = 'fightersToAdvisors' | 'advisorsToFighters';
export type AdvisorTransportMatchingStep = { actor: string; action: Action };
export type AdvisorTransportMatchingTransition = { before: Game; steps: AdvisorTransportMatchingStep[]; after: Game };
export const actAdvisorTransportMatching = actAdvisorPreparation;
export const advisorTransportMatchingPlayer = advisorPreparationPlayer;
export const advisorTransportMatchingInventory = advisorPreparationInventory;
export const advisorTransportMatchingClean = advisorPreparationClean;

function ownedTransportResponse(game: Game) {
  return !!game.response && ['advisorFlip', 'guildTransportPermission', 'guildRate'].includes(game.response.kind);
}
/** New matching and original permission/rate controls remain caller-owned.
 * Native early Guild timing yields the ordinary seat while sourcing BG's turn. */
export function nextAdvisorTransportMatching(game: Game): AdvisorTransportMatchingStep | null {
  if (ownedTransportResponse(game)) return null;
  if (!game.phaseOpening && !game.response && !game.pendingTreacheryDiscard) {
    if (game.decision?.kind === 'advisorBattle')
      return { actor: game.decision.player, action: { type: 'decision', accept: false } };
    if (game.decision?.kind === 'guildTiming')
      return { actor: game.decision.player, action: { type: 'decision', take: false } };
    if (game.decision?.kind === 'homeworldShipmentGuild')
      return { actor: game.decision.player, action: { type: 'decision', event: game.decision.event, allow: true } };
  }
  return nextAdvisorPreparationStep(game);
}
export function advanceAdvisorTransportMatching(game: Game, until: (state: Game) => boolean,
  steps: AdvisorTransportMatchingStep[] = []): Game {
  for (let count = 0; count < 2200; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished', 'The original transport chronology ended before its requested boundary');
    const next = nextAdvisorTransportMatching(game);
    assert.ok(next, `Choose the original matching/permission/rate control at ${game.turn}/${game.phase}/${game.decision?.kind}`);
    game = actAdvisorTransportMatching(game, next.actor, next.action, steps);
  }
  throw Error('The native advisor transport matching source did not reach its finite boundary');
}
export function passAdvisorTransportMatching(game: Game, steps: AdvisorTransportMatchingStep[] = []): Game {
  for (let count = 0; game.response && !ownedTransportResponse(game) && count < 60; count++) {
    const actor = game.players.find(player => !game.response!.passed.includes(player.id)); assert.ok(actor);
    game = actAdvisorTransportMatching(game, actor.id, { type: 'passResponse' }, steps);
  }
  assert.ok(!game.response || ownedTransportResponse(game)); return game;
}

/** Native Guild ally cross-shipment or actual high-population Junction offer.
 * BG's two opposed board groups are earned by real setup and a paid shipment;
 * World mode instead uses the untouched original typed native reserve pool. */
export function createAdvisorTransportMatchingFixture(options: {
  kind?: AdvisorTransportMatchingKind; direction?: AdvisorTransportMatchingDirection;
} = {}) {
  const kind = options.kind ?? 'guild', direction = options.direction ?? 'fightersToAdvisors';
  assert.ok(kind !== 'junctionWorld' || direction === 'fightersToAdvisors', 'The native World source enters resident advisors');
  const bg = 'beneGesserit', guild = 'guild', holder = 'atreides', homeworlds = kind !== 'guild';
  let game = createGame('ADVISORTRANSPORTMATCHING', newPlayer(bg, 'Bene Gesserit', 'beneGesserit'), true);
  joinGame(game, newPlayer(guild, 'Guild', 'guild')); joinGame(game, newPlayer(holder, 'Atreides', 'atreides'));
  const initial = structuredClone(game), steps: AdvisorTransportMatchingStep[] = [];
  const act = (actor: string, action: Action) => { game = actAdvisorTransportMatching(game, actor, action, steps); };
  const reach = (until: (state: Game) => boolean) => { game = advanceAdvisorTransportMatching(game, until, steps); };
  const transition = (run: () => void): AdvisorTransportMatchingTransition => {
    const before = structuredClone(game), start = steps.length; run();
    return { before, steps: structuredClone(steps.slice(start)), after: structuredClone(game) };
  };
  const enableHomeworlds = homeworlds ? transition(() => { act(game.host, { type: 'homeworlds', enabled: true }); }) : null;
  for (const player of game.players) act(player.id, { type: 'ready' });
  const lobby = structuredClone(game); act(game.host, { type: 'start', advancedPreview: true });
  const setup = structuredClone(game);
  assert.equal(game.status, 'setup'); assert.equal(game.advanced, true); assert.deepEqual(game.expansions, []);
  assert.equal(!!game.homeworlds, homeworlds);
  assert.ok(!game.nexusCards && !game.leaderSkills && !game.techTokens && !game.strongholdCards &&
    !game.discoveryEnabled && !game.ecazTreachery);
  assert.ok(game.players.every(player => !player.hand.length));
  const originalInventory = advisorTransportMatchingInventory(game); assert.equal(originalInventory.length, 33);
  const karama = game.deck.find(card => card.effect === 'karama'); assert.ok(karama);
  const ordinary = game.deck.filter(card => ['projectile', 'poison', 'shield', 'snooper'].includes(card.kind)).slice(0, 2);
  assert.equal(ordinary.length, 2);
  const selected = [ordinary[0], ordinary[1], karama];
  const dealOrder = selected.map((card, position) => {
    const from = game.deck.findIndex(candidate => candidate.id === card.id); assert.ok(from >= position);
    [game.deck[position], game.deck[from]] = [game.deck[from], game.deck[position]];
    return { position, from, card: card.id };
  });
  const beforeStartingDeal = structuredClone(game);
  let advisorSetup: AdvisorTransportMatchingTransition | null = null;
  for (let count = 0; game.status === 'setup' && count < 100; count++) {
    const next = nextAdvisorTransportMatching(game); assert.ok(next);
    const before = next.action.type === 'advisorSetup' ? structuredClone(game) : null;
    act(next.actor, next.action);
    if (before) advisorSetup = { before, steps: [structuredClone(next)], after: structuredClone(game) };
  }
  assert.equal(game.status, 'playing'); assert.ok(advisorSetup);
  const afterSetup = structuredClone(game);
  assert.deepEqual(game.players.flatMap(player => player.hand.map(card => card.id)), selected.map(card => card.id));
  assert.equal(advisorTransportMatchingPlayer(game, bg).forces['arrakeen:10'], 1);
  assert.ok(advisorTransportMatchingPlayer(game, bg).advisors?.arrakeen);
  assert.equal(advisorTransportMatchingPlayer(game, holder).forces['arrakeen:10'], 10);
  assert.equal(advisorTransportMatchingPlayer(game, guild).forces['tueks_sietch:5'], 5);
  const originalSpice = game.spiceDeck.map(card => JSON.stringify(card)).sort();
  const spiceOrder = [0, 1, 2, 3].map(position => {
    const from = game.spiceDeck.findIndex((card, index) => index >= position && 'territory' in card && !card.discovery &&
      !['imperial_basin', 'arrakeen', 'tueks_sietch'].includes(card.territory));
    assert.ok(from >= position); const card = game.spiceDeck.splice(from, 1)[0];
    game.spiceDeck.splice(position, 0, card); return { position, from, card: structuredClone(card) };
  });
  assert.deepEqual(game.spiceDeck.map(card => JSON.stringify(card)).sort(), originalSpice);
  reach(state => state.turn === 1 && state.phase === 5 && state.active === bg && advisorTransportMatchingClean(state));
  const beforeFirstShipment = structuredClone(game);
  let fighterShipment: AdvisorTransportMatchingTransition | null = null;
  let beforeWorm: Game | null = null, nexus: Game | null = null;
  let wormOrder: { position: number; from: number; card: Game['spiceDeck'][number] } | null = null;
  let wormFollowupOrder: { position: number; from: number; card: Game['spiceDeck'][number] }[] = [];
  let alliance: AdvisorTransportMatchingTransition | null = null;
  if (kind !== 'junctionWorld') {
    fighterShipment = transition(() => {
      act(bg, { type: 'ship', territory: 'imperial_basin', sector: 9, amount: 2, elite: 0, allyPayment: 0 });
      reach(advisorTransportMatchingClean);
    });
    assert.equal(advisorTransportMatchingPlayer(fighterShipment.before, bg).spice - advisorTransportMatchingPlayer(game, bg).spice, 4);
    assert.equal(advisorTransportMatchingPlayer(game, bg).forces['imperial_basin:9'], 2);
    assert.ok(!advisorTransportMatchingPlayer(game, bg).advisors?.imperial_basin);
    if (kind === 'guild') {
      reach(state => state.turn === 2 && state.phase === 1 && advisorTransportMatchingClean(state) &&
        !state.spiceSequence && !state.spiceResolution && !state.spiceWindow && !state.nexus && state.ready.length === 0);
      beforeWorm = structuredClone(game);
      const beforeWormInventory = game.spiceDeck.map(card => JSON.stringify(card)).sort();
      const from = game.spiceDeck.findIndex(card => 'worm' in card && !card.greatMaker && !card.suppressed && !card.thumper);
      assert.ok(from >= 0); const card = game.spiceDeck.splice(from, 1)[0]; game.spiceDeck.unshift(card);
      wormOrder = { position: 0, from, card: structuredClone(card) };
      wormFollowupOrder = [1, 2].map(position => {
        const from = game.spiceDeck.findIndex((card, index) => index >= position && 'territory' in card && !card.discovery &&
          !['imperial_basin', 'arrakeen', 'tueks_sietch'].includes(card.territory));
        assert.ok(from >= position); const card = game.spiceDeck.splice(from, 1)[0];
        game.spiceDeck.splice(position, 0, card); return { position, from, card: structuredClone(card) };
      });
      assert.deepEqual(game.spiceDeck.map(card => JSON.stringify(card)).sort(), beforeWormInventory);
      reach(state => state.nexus && !state.spiceWindow && !state.spiceResolution && advisorTransportMatchingClean(state));
      nexus = structuredClone(game);
      alliance = transition(() => {
        act(bg, { type: 'alliance', target: guild }); act(guild, { type: 'alliance', target: bg });
      });
      assert.equal(advisorTransportMatchingPlayer(game, bg).ally, guild);
      assert.equal(advisorTransportMatchingPlayer(game, guild).ally, bg);
    }
    reach(state => state.turn === 2 && state.phase === 5 && state.active === bg && advisorTransportMatchingClean(state));
  }
  let offerStep: AdvisorTransportMatchingStep | null = null;
  let junctionOffer: AdvisorTransportMatchingTransition | null = null;
  if (homeworlds) {
    const sponsor = viewGame(game, guild).junctionTransport; assert.ok(sponsor?.canOffer);
    assert.equal(sponsor.recipient, bg);
    offerStep = { actor: guild, action: { type: 'offerJunctionTransport', event: sponsor.offerEvent, rate: 'half' } };
    junctionOffer = transition(() => { act(offerStep!.actor, offerStep!.action); });
  }
  const nativeWorld = homeworlds ? viewGame(game, bg).homeworlds!.worlds!.find(world => world.native === bg && !world.secondary)!.id : null;
  const fighterLocation = kind === 'junctionWorld' ? nativeWorld! : 'imperial_basin:9';
  const declaration = (from: string, to: string, amount: number) => {
    const sources: HomeworldShipmentSources = { [from]: { normal: amount, elite: 0 } };
    if (kind === 'guild') {
      const destination = splitLocation(to);
      const action: Action = { type: 'guildShip', from, territory: destination.territory,
        sector: destination.sector, amount, elite: 0, allyPayment: 0 };
      return { action, sources, cost: guildShipmentCost(territory(destination.territory).type, amount, true) };
    }
    const quote = junctionTransportChoice(viewGame(game, bg), to, sources, 0);
    assert.equal(quote.blocked, null); assert.ok(quote.action);
    return { action: quote.action, sources, cost: quote.cost };
  };
  const fighterQuote = declaration(fighterLocation, 'arrakeen:10', 1);
  const advisorQuote = kind === 'junctionWorld' ? null : declaration('arrakeen:10', 'imperial_basin:9', 1);
  const largerQuote = declaration(fighterLocation, 'arrakeen:10', 2);
  const emptyQuote = declaration(fighterLocation, kind === 'junctionWorld' ? 'imperial_basin:9' : 'polar_sink:0', 1);
  const quote = direction === 'fightersToAdvisors' ? fighterQuote : advisorQuote!;
  const sourceLocation = direction === 'fightersToAdvisors' ? fighterLocation : 'arrakeen:10';
  const destinationLocation = direction === 'fightersToAdvisors' ? 'arrakeen:10' : 'imperial_basin:9';
  const action = quote.action, player = advisorTransportMatchingPlayer(game, bg);
  assert.equal(game.active, bg); assert.equal(game.phase, 5); assert.ok(advisorTransportMatchingClean(game));
  assert.equal(player.shipped, false); assert.equal(player.moved, 0);
  assert.equal(player.forces['arrakeen:10'], 1); assert.ok(player.advisors?.arrakeen);
  if (kind !== 'junctionWorld') assert.equal(player.forces['imperial_basin:9'], 2);
  assert.ok(quote.cost <= player.spice); assert.equal(quote.cost, 1);
  assert.ok(advisorTransportMatchingPlayer(game, holder).hand.some(card => card.id === karama.id));
  assert.deepEqual(advisorTransportMatchingInventory(game), originalInventory);
  return { game, source: structuredClone(game), beforeAction: structuredClone(game), initial, enableHomeworlds,
    lobby, setup, beforeStartingDeal, afterSetup, advisorSetup, beforeFirstShipment, fighterShipment,
    beforeWorm, wormOrder, wormFollowupOrder, nexus, alliance, offerStep, junctionOffer,
    kind, direction, bg, owner: bg, guild, holder, atreides: holder, karama: karama.id, card: karama.id,
    actor: bg, shipper: bg, nativeWorld, sourceLocation, destinationLocation, from: sourceLocation, to: destinationLocation,
    origin: sourceLocation.startsWith('homeworld:') ? sourceLocation : splitLocation(sourceLocation).territory,
    destination: splitLocation(destinationLocation).territory,
    action, sources: quote.sources, amount: 1, cost: quote.cost,
    fightersToAdvisors: fighterQuote.action, advisorsToFighters: advisorQuote?.action ?? null,
    largerPacket: largerQuote.action, noMatch: emptyQuote.action,
    replacement: largerQuote.action, replacements: [largerQuote.action, emptyQuote.action],
    matchingActions: [fighterQuote.action, ...(advisorQuote ? [advisorQuote.action] : [])],
    actionQuotes: { fighter: fighterQuote, advisor: advisorQuote, larger: largerQuote, empty: emptyQuote },
    transportStep: { actor: bg, action } satisfies AdvisorTransportMatchingStep,
    steps, actions: steps, sourceActionCount: steps.length, originalInventory, originalSpice, dealOrder, spiceOrder,
    staging: [
      'Actual public Advanced BG/Guild/Atreides ready/startPreview, original base33 and no card/force modules. Original prediction/private Traitors and actual advisorSetup place BG beside Atreides’ ten Arrakeen10 counters. Atreides retains its originally dealt printed Karama.',
      homeworlds
        ? 'Homeworlds are enabled by their actual lobby action. Original typed native pools and high-population Junction remain native; no custody, population or offer is installed.'
        : 'No Homeworld or optional module is selected. The native Guild alliance is earned later through the actual Nexus.',
      'Select only original scalar shuffle draws, three unopened Treachery positions and four safe unopened ordinary Spice positions. Native Storm/dual Spice/Charity/Bidding/Revival and original preparation decline/Guild timing/interception/income controls execute.',
      kind === 'junctionWorld'
        ? 'Stop at the original first-turn BG unused shipment after Guild’s actual high-population half-price Junction offer. The real quote selects one ordinary counter from BG’s original native World and joins its resident Arrakeen advisor; no prior board fighter is claimed.'
        : 'BG actually pays four to ship two reserves into empty Basin9 on turn1. Guild’s native five remain in Tuek’s, avoiding a manufactured battle. Original Arrakeen advisors and Basin fighters survive native Collection/Mentat and turn-two Storm1; BG’s next shipment and movement remain unused.',
      kind === 'guild'
        ? 'One original unopened turn-two Shai-Hulud and two safe original follow-up land cards earn an actual Nexus. BG actually proposes alliance and Guild actually accepts; only that reciprocal alliance permits the returned native guildShip cross declaration.'
        : 'Guild actually submits its current live Junction offer event at half tariff to BG; every returned declaration is the exact owner-view junctionTransportChoice over original typed sources. No native Guild alliance is claimed.',
      'Stop before the declaration and before new matching/original permission/rate. Expose both board directions, a genuine two-counter retry packet and an empty-destination replacement where applicable. No played phase, army, wallet, hand, alliance, stance, transport privilege, offer, response or receipt is installed.',
    ] };
}
export type AdvisorTransportMatchingFixture = ReturnType<typeof createAdvisorTransportMatchingFixture>;

/** Declare only; matching and original permission/rate are never auto-passed. */
export function commitAdvisorTransportMatching(source: Game, fixture: AdvisorTransportMatchingFixture,
  action: Action = fixture.action, steps: AdvisorTransportMatchingStep[] = []) {
  const before = structuredClone(source), start = steps.length;
  const game = actAdvisorTransportMatching(source, fixture.bg, action, steps);
  return { game, before, after: structuredClone(game), steps: structuredClone(steps.slice(start)) };
}
/** After explicit owned responses, resume only the original transport parent. */
export function finishAdvisorTransportMatching(source: Game, steps: AdvisorTransportMatchingStep[] = []): Game {
  return advanceAdvisorTransportMatching(source,
    game => !game.pendingGuildTransport && !game.pendingHomeworldShipment && advisorTransportMatchingClean(game), steps);
}
