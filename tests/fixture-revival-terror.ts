import assert from 'node:assert/strict';
import { applyAction, createGame, joinGame, newPlayer, viewGame, type Action, type Game } from '../game/engine';
import { homeworldGameIntegrity, homeworldTable } from '../game/homeworld-game';
import { nativeShipmentSources } from '../game/homeworld-options';
import { treacheryDeck } from '../game/cards';
import { ecazTreacheryCards } from '../game/ecaz-cards';
import type { TerrorKind } from '../game/moritani-terror';
import { nextStrongholdFactionsNativeStep } from './fixture-stronghold-factions';
import {
  actRevivalArrivalReactions, revivalArrivalReactionsClean,
  revivalArrivalReactionsInventory, revivalArrivalReactionsPlayer,
} from './fixture-revival-arrival-reactions';

export type RevivalTerrorStep = { actor: string; action: Action };
export type RevivalTerrorTransition = { before: Game; steps: RevivalTerrorStep[]; after: Game };
/** Later revealed effects use native entropy, including Assassination's real
 * living-disc lottery. Directed original shuffles belong only to construction. */
export function actRevivalTerror(game: Game, actor: string, action: Action,
  actions: RevivalTerrorStep[] = []): Game {
  const after = applyAction(game, actor, action);
  actions.push({ actor, action: structuredClone(action) }); return after;
}
export const revivalTerrorClean = revivalArrivalReactionsClean;
export const revivalTerrorPlayer = revivalArrivalReactionsPlayer;
export const revivalTerrorInventory = revivalArrivalReactionsInventory;

/** Original Mentat placement, returned-group placement and Terror choices
 * remain human controls. No printed Terror effect is silently selected. */
export function nextRevivalTerror(game: Game): RevivalTerrorStep | null {
  if (game.response?.automaticAdvisorFlip || game.truthtrance) return null;
  if (!game.response && !game.phaseOpening && !game.pendingTreacheryDiscard) {
    const d = game.decision;
    if (d && ['moritaniPlacement', 'moritaniTerror', 'moritaniExtortion',
      'ecazPlacement', 'ecazAmbassador', 'arrivalOverlap', 'advisor', 'intrusion',
      'homeworldRevivalDeployment', 'revivalStop'].includes(d.kind)) return null;
    const bg = game.players.find(seat => seat.faction === 'beneGesserit');
    if (bg && game.status === 'setup' && game.setupStage === 'prediction' &&
        viewGame(game, bg.id).setupPending.includes(bg.id))
      return { actor: bg.id, action: { type: 'predict', faction: 'tleilaxu', turn: 10 } };
    if (bg && game.advanced && game.status === 'setup' && game.setupStage === 'forces' && !bg.advisorSetup &&
        viewGame(game, bg.id).setupPending.includes(bg.id))
      return { actor: bg.id, action: { type: 'advisorSetup', territory: 'polar_sink', sector: 0 } };
    const ecaz = game.players.find(seat => seat.faction === 'ecaz');
    if (ecaz && game.status === 'setup' && game.setupStage === 'forces' && ecaz.reserves === 20 &&
        viewGame(game, ecaz.id).setupPending.includes(ecaz.id))
      return { actor: ecaz.id, action: { type: 'ecazSetup', placements: { 'imperial_basin:9': 6 } } };
    if (d?.kind === 'moritaniSetup') return { actor: d.player,
      action: { type: 'decision', territory: 'tueks_sietch', sector: 5 } };
    if (d?.kind === 'moritaniAssassinate') return { actor: d.player,
      action: { type: 'decision', event: d.event, decline: true } };
    if (d?.kind === 'advisorBattle') return { actor: d.player, action: { type: 'decision', accept: false } };
    if (game.status === 'playing' && game.phase === 0 && game.stormPending === null) {
      const actor = game.stormDialers.find(id => game.stormDials[id] === undefined);
      if (actor) return { actor, action: { type: 'stormDial', amount: game.turn === 1
        ? game.stormDialers.indexOf(actor) === 0 ? game.advanced ? 11 : 10 : 0
        : 1 } };
    }
  }
  return nextStrongholdFactionsNativeStep(game);
}
export function advanceRevivalTerror(game: Game, until: (state: Game) => boolean,
  actions: RevivalTerrorStep[] = []): Game {
  for (let count = 0; count < 1200; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished', 'The original Terror source ended before its next native control');
    const next = nextRevivalTerror(game);
    assert.ok(next, `Choose the original Terror/placement control at ${game.turn}/${game.phase}/${game.decision?.kind}`);
    game = actRevivalTerror(game, next.actor, next.action, actions);
  }
  throw Error('The genuine revival-Terror programme did not reach its finite boundary');
}
export function passRevivalTerror(game: Game, actions: RevivalTerrorStep[] = []): Game {
  for (let count = 0; game.response && !game.response.automaticAdvisorFlip && count < 100; count++) {
    const actor = game.players.find(player => !game.response!.passed.includes(player.id)); assert.ok(actor);
    game = actRevivalTerror(game, actor.id, { type: 'passResponse' }, actions);
  }
  assert.ok(!game.response || game.response.automaticAdvisorFlip); return game;
}
/** Consume original discard machinery until the next owned Terror choice. */
export function settleRevivalTerror(game: Game, actions: RevivalTerrorStep[] = []): Game {
  return advanceRevivalTerror(game, state => !state.response && !state.phaseOpening && !state.pendingTreacheryDiscard &&
    (state.decision?.kind === 'moritaniTerror' || !state.pendingTerrorEntry && revivalTerrorClean(state)), actions);
}
export function finishRevivalTerror(game: Game, actions: RevivalTerrorStep[] = []): Game {
  return advanceRevivalTerror(game, state => state.homeworldRevivalReturn?.stage === 'complete' &&
    !state.pendingTerrorEntry && revivalTerrorClean(state), actions);
}
export function commitRevivalTerror(game: Game, fixture: { entrant: string; action: Action },
  actions: RevivalTerrorStep[] = []) {
  const before = structuredClone(game), start = actions.length;
  game = actRevivalTerror(game, fixture.entrant, fixture.action, actions);
  return { game, before, steps: structuredClone(actions.slice(start)), after: structuredClone(game) };
}

/** Public Basic/Advanced Tleilaxu/Moritani, actual Homeworlds, original E1/E3.
 * Native casualties and first Mentat Terror placement precede ordinary free
 * revive1. Source stops BEFORE selecting the real revived-group destination. */
export function createRevivalTerrorFixture(options: {
  advanced?: boolean; kind?: TerrorKind; bg?: boolean; ecaz?: boolean; ambassadorFirst?: boolean;
} = {}) {
  const advanced = options.advanced ?? true, kind = options.kind ?? 'robbery';
  const entrant = 'tleilaxu', owner = 'moritani', holder = entrant;
  const territory = !advanced && options.ecaz ? 'arrakeen' : 'carthag';
  const sector = territory === 'arrakeen' ? 10 : 11, location = `${territory}:${sector}`;
  const casualtyLocation = 'hagga_basin:13';
  let game = createGame('REVIVALTERROR', newPlayer(entrant, 'Tleilaxu', 'tleilaxu'), advanced, ['ix', 'ecaz']);
  const bg = options.bg ? 'beneGesserit' : null, ecaz = options.ecaz ? 'ecaz' : null;
  if (ecaz && options.ambassadorFirst) {
    joinGame(game, newPlayer(ecaz, 'Ecaz', 'ecaz'));
    if (bg) joinGame(game, newPlayer(bg, 'Bene Gesserit', 'beneGesserit'));
    joinGame(game, newPlayer(owner, 'Moritani', 'moritani'));
  } else {
    joinGame(game, newPlayer(owner, 'Moritani', 'moritani'));
    if (bg) joinGame(game, newPlayer(bg, 'Bene Gesserit', 'beneGesserit'));
    if (ecaz) joinGame(game, newPlayer(ecaz, 'Ecaz', 'ecaz'));
  }
  const initial = structuredClone(game), actions: RevivalTerrorStep[] = [];
  let ambassadorToken: string | null = null, ambassadorPlacement: RevivalTerrorTransition | null = null;
  const act = (actor: string, action: Action) => { game = actRevivalArrivalReactions(game, actor, action, actions); };
  const reach = (until: (state: Game) => boolean) => {
    for (let count = 0; count < 1200 && !until(game); count++) {
      if (!game.response && !game.phaseOpening && !game.pendingTreacheryDiscard) {
        const d = game.decision;
        if (d?.kind === 'advisor' || d?.kind === 'intrusion') {
          act(d.player, { type: 'decision', accept: false }); continue;
        }
        if (d?.kind === 'ecazPlacement') {
          if (!ambassadorToken && game.turn === 1) {
            const token = game.ecazAmbassadors!.tokens.find(token => token.effect === 'emperor' &&
              token.zone === 'supply' && game.ecazAmbassadors!.cohort.includes(token.id));
            assert.ok(token, 'The selected original packet must actually supply its Emperor Ambassador');
            ambassadorToken = token.id;
            const before = structuredClone(game), start = actions.length;
            act(d.player, { type: 'decision', token: token.id, territory });
            for (let count = 0; game.response && count < 80; count++) {
              const actor = game.players.find(seat => !game.response!.passed.includes(seat.id)); assert.ok(actor);
              act(actor.id, { type: 'passResponse' });
            }
            assert.equal(game.ecazAmbassadors!.tokens.find(candidate => candidate.id === token.id)!.zone, 'placed');
            ambassadorPlacement = { before, steps: structuredClone(actions.slice(start)), after: structuredClone(game) };
          } else act(d.player, { type: 'decision', decline: true });
          continue;
        }
      }
      const next = nextRevivalTerror(game); assert.ok(next, 'The original source needs its owned native control');
      act(next.actor, next.action);
    }
    assert.ok(until(game), 'The original revival-Terror source must reach its next finite control');
  };
  const transition = (run: () => void): RevivalTerrorTransition => {
    const before = structuredClone(game), start = actions.length; run();
    return { before, steps: structuredClone(actions.slice(start)), after: structuredClone(game) };
  };
  const homeworlds = transition(() => { act(game.host, { type: 'homeworlds', enabled: true }); });
  const optionalEcazModules = ecaz ? transition(() => {
    act(game.host, { type: 'moduleOption', module: 'ecazTreachery', enabled: true });
    act(game.host, { type: 'moduleOption', module: 'nexusCards', enabled: true });
  }) : null;
  for (const seat of game.players) act(seat.id, { type: 'ready' });
  const lobby = structuredClone(game);
  act(game.host, advanced ? { type: 'start', advancedPreview: true } : { type: 'start' });
  const setup = structuredClone(game);
  assert.equal(game.status, 'setup'); assert.ok(game.homeworlds);
  assert.deepEqual(game.expansions, ['ix', 'ecaz']);
  assert.ok(!game.leaderSkills && !game.strongholdCards && !game.techTokens && !game.discoveryEnabled);
  assert.equal(!!game.nexusCards, !!ecaz); assert.equal(game.ecazTreachery === true, !!ecaz);
  assert.ok(game.players.every(seat => !seat.hand.length));
  const originalInventory = revivalTerrorInventory(game);
  const selectedOriginalCards = [...treacheryDeck(game.expansions), ...(ecaz ? ecazTreacheryCards() : [])]
    .map(card => card.id).sort();
  assert.deepEqual(originalInventory, selectedOriginalCards); assert.equal(originalInventory.length, ecaz ? 50 : 47);
  const karama = game.deck.find(card => card.effect === 'karama');
  const ordinary = game.deck.filter(card => ['projectile', 'poison', 'shield', 'snooper'].includes(card.kind))
    .slice(0, game.players.length - 1);
  const gift = ordinary[0]; assert.ok(karama && gift); assert.equal(ordinary.length, game.players.length - 1);
  let nextOrdinary = 1;
  const selected = game.players.map(seat => seat.id === entrant ? karama :
    seat.id === owner ? gift : ordinary[nextOrdinary++]);
  const dealOrder = selected.map((card, position) => {
    const from = game.deck.findIndex(candidate => candidate.id === card.id); assert.ok(from >= position);
    [game.deck[position], game.deck[from]] = [game.deck[from], game.deck[position]];
    return { position, from, card: card.id };
  });
  const beforeStartingDeal = structuredClone(game);
  reach(state => state.status === 'playing');
  const afterSetup = structuredClone(game);
  assert.deepEqual(game.players.flatMap(seat => seat.hand.map(card => card.id)), selected.map(card => card.id));
  assert.equal(revivalTerrorPlayer(game, entrant).reserves, 20);
  assert.equal(revivalTerrorPlayer(game, entrant).faceDancers?.length, 3);
  assert.deepEqual(revivalTerrorPlayer(game, owner).forces, { 'tueks_sietch:5': 6 });
  assert.equal(revivalTerrorPlayer(game, owner).reserves, 14);
  const originalTerror = structuredClone(game.moritaniTerror);
  assert.equal(originalTerror?.tokens.length, 6);
  const originalSpice = game.spiceDeck.map(card => JSON.stringify(card)).sort();
  const spiceOrder = Array.from({ length: advanced ? 4 : 2 }, (_, position) => {
    const from = game.spiceDeck.findIndex((card, index) => index >= position && 'territory' in card &&
      !card.discovery && !['hagga_basin', 'tueks_sietch', territory].includes(card.territory));
    assert.ok(from >= position); const card = game.spiceDeck.splice(from, 1)[0];
    game.spiceDeck.splice(position, 0, card); return { position, from, card: structuredClone(card) };
  });
  assert.deepEqual(game.spiceDeck.map(card => JSON.stringify(card)).sort(), originalSpice);
  const firstStorm = transition(() => { reach(state => state.turn === 1 && state.phase === 1); });
  assert.equal(game.storm, advanced ? 12 : 11);
  reach(state => state.turn === 1 && state.phase === 5 && state.active === entrant && revivalTerrorClean(state));
  const beforeShipment = structuredClone(game);
  const homeworldSources = nativeShipmentSources(viewGame(game, entrant), 1, 0); assert.ok(homeworldSources);
  const shipmentAction: Action = { type: 'ship', territory: 'hagga_basin', sector: 13,
    amount: 1, elite: 0, allyPayment: 0, homeworldSources };
  const shipment = transition(() => { act(entrant, shipmentAction); reach(revivalTerrorClean); });
  assert.equal(revivalTerrorPlayer(beforeShipment, entrant).spice - revivalTerrorPlayer(game, entrant).spice, 2);
  assert.equal(revivalTerrorPlayer(game, entrant).forces[casualtyLocation], 1);
  reach(state => state.turn === 1 && !state.response && !state.phaseOpening && state.decision?.kind === 'moritaniPlacement');
  const token = game.moritaniTerror!.tokens.find(token => token.kind === kind && token.status === 'available'); assert.ok(token);
  const beforePlacement = structuredClone(game);
  const placementAction: Action = { type: 'decision', token: token.id, territory };
  const placement = transition(() => {
    act(owner, placementAction);
    for (let count = 0; game.response && count < 80; count++) {
      const actor = game.players.find(seat => !game.response!.passed.includes(seat.id)); assert.ok(actor);
      act(actor.id, { type: 'passResponse' });
    }
    assert.ok(!game.response);
  });
  assert.equal(game.moritaniTerror!.tokens.find(candidate => candidate.id === token.id)!.status, 'placed');
  assert.equal(game.moritaniTerror!.tokens.find(candidate => candidate.id === token.id)!.location, territory);
  reach(state => state.turn === 2 && state.phase === 0 && !state.phaseOpening && !state.response &&
    state.stormPending === (advanced ? 1 : 2));
  const beforeStormMovement = structuredClone(game), stormSource = structuredClone(game.stormMovementSource);
  const storm = transition(() => { reach(state => state.turn === 2 && state.phase === 1); });
  assert.equal(game.storm, 13);
  assert.equal(revivalTerrorPlayer(game, entrant).forces[casualtyLocation], undefined);
  assert.equal(revivalTerrorPlayer(game, entrant).tanks, 1);
  reach(state => state.turn === 2 && state.phase === 4 && revivalTerrorClean(state));
  const beforeRequest = structuredClone(game), revivalAction: Action = { type: 'revive', amount: 1, elite: 0, freeElite: 0 };
  const revival = transition(() => {
    act(entrant, revivalAction);
    reach(state => !state.response && !state.phaseOpening && state.decision?.kind === 'homeworldRevivalDeployment');
  });
  assert.equal(revivalTerrorPlayer(game, entrant).reserves, 20);
  assert.equal(revivalTerrorPlayer(game, entrant).tanks, 0);
  assert.equal(revivalTerrorPlayer(game, entrant).revived, 1);
  assert.equal(revivalTerrorPlayer(game, entrant).freeForcesRevived, 1);
  assert.equal(homeworldTable(game)!.find(home => home.native === entrant)!.side, 'high');
  assert.equal(homeworldTable(game)!.find(home => home.native === owner)!.side, 'high');
  assert.ok(revivalTerrorPlayer(game, holder).hand.some(card => card.id === karama.id));
  assert.deepEqual(revivalTerrorInventory(game), originalInventory); homeworldGameIntegrity(game);
  const event = game.homeworldRevivalReturn!.event, source = structuredClone(game);
  const action: Action = { type: 'decision', event, destination: location, amount: 1 };
  return {
    game, source, beforeDeployment: source, beforeRequest, initial, lobby, setup, beforeStartingDeal,
    afterSetup, homeworlds, optionalEcazModules, firstStorm, beforeShipment, shipmentAction, shipment,
    beforePlacement, placementAction, placement, beforeStormMovement, stormSource, storm, revival, revivalAction,
    entrant, tleilaxu: entrant, holder, owner, moritani: owner, bg, ecaz,
    ambassadorToken, ambassadorPlacement, ambassadorFirst: options.ambassadorFirst ?? false, kind, token: token.id,
    karama: karama.id, gift: gift.id, territory, sector, location, destination: location, casualtyLocation, event, action,
    revealAction: { type: 'decision', reveal: true } as Action,
    declineAction: { type: 'decision', decline: true } as Action,
    cancelAction: { type: 'card', card: karama.id, mode: 'cancel' } as Action,
    originalInventory, originalCards: originalInventory, originalTerror, originalSpice, spiceOrder, dealOrder,
    actions, steps: actions, sourceActionCount: actions.length, advanced,
    staging: [
      `Public Basic/Advanced Tleilaxu/Moritani with actual Homeworlds setting and original E1/E3 deck. Default and BG-only sources retain main47 and no other optional module. Optional Ecaz uses only the already-admitted actual public independent three-card Ecaz variant plus Nexus Cards, retaining original main50; ordinary original Spice draws produce no Worm or Nexus acquisition in this prefix. Only original unopened starting-deal positions (Tleilaxu Karama and one ordinary face per other original seat), unopened ordinary land Spice positions and native scalar lotteries are selected. Tleilaxu gets original Karama/three Face Dancers; Moritani really places its original six at Tueks5 and retains fourteen native reserves. Actual first Storm ends11 (Basic10+0) or12 (Advanced11+0); Tleilaxu pays two spice for one Hagga13 reserve shipment. Moritani really selects the requested original Terror face for ${location} during its first Mentat placement and every original placement response passes. Next native Storm ends13 (Basic1+1, Advanced original Storm Card1), killing that Tleilaxu counter. Actual phase controls reach turn2 Revival; real ordinary free revive1 opens the original returned-group choice. Source stops before ${location} destination selection. Optional original BG seat really starts at Polar (Advanced uses original advisorSetup) and declines the original Hagga Spiritual offer. Optional original Ecaz seat really sets up six in printed Imperial Basin9; the first native Storm crosses that sector and destroys those six counters, which remain in its actual Tanks when ordinary Revival is skipped through readiness. Ecaz pays one for its original cohort Emperor Ambassador at ${location} during first Revival; Basic uses Arrakeen10 because the original Storm11 prevents Carthag placement, while Advanced retains Carthag11. No played force, wallet, phase, Tank, token, hand, alliance, response or revival receipt is installed. Later Terror victim lotteries use native entropy; no controlled supplemental effect source is claimed.`,
    ],
  };
}
export type RevivalTerrorFixture = ReturnType<typeof createRevivalTerrorFixture>;
