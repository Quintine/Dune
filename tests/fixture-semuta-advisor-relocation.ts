import assert from 'node:assert/strict';
import {
  applyAction, createGame, initializeSemutaGameForAudit, joinGame, newPlayer, viewGame,
  type Action, type Game,
} from '../game/engine';
import { isAdvisor } from '../game/advisors';
import { AMBASSADOR_EFFECTS, type AmbassadorEffect } from '../game/ecaz-ambassadors';
import { DISCOVERY_CARD_PLACEMENTS, DISCOVERY_TOKEN_BY_ID } from '../game/discoveries';
import { discoveryEntryMoveAction } from '../game/discovery-entry-options';
import { SEMUTA_DRUG_ID } from '../game/semuta-drug';
import { withClassicDiscoveryNexusLottery } from './fixture-discovery-classic-nexus';
import {
  nextSemutaRicheseCacheKarama, semutaRicheseCacheKaramaClean,
  semutaRicheseCacheKaramaInventory, semutaRicheseCacheKaramaPlayer,
} from './fixture-semuta-richese-cache-karama';
import {
  passSemutaFremenGuildMovement, claimSemutaFremenGuildMovement,
} from './fixture-semuta-fremen-guild-movement';

export type SemutaAdvisorRelocationKind = 'ambassador' | 'discovery';
export type SemutaAdvisorRelocationStep = { actor: string; action: Action };
export const passSemutaAdvisorRelocation = passSemutaFremenGuildMovement;
export const claimSemutaAdvisorRelocation = claimSemutaFremenGuildMovement;
export const semutaAdvisorRelocationPlayer = semutaRicheseCacheKaramaPlayer;
export const semutaAdvisorRelocationInventory = semutaRicheseCacheKaramaInventory;
export const semutaAdvisorRelocationClean = semutaRicheseCacheKaramaClean;
export const semutaAdvisorRelocationPhysical = (game: Game) => ({
  turn: game.turn, phase: game.phase, storm: game.storm, order: game.order,
  spice: game.spice, spiceDeck: game.spiceDeck, spiceDiscard: game.spiceDiscard,
  players: game.players.map(player => ({ id: player.id, spice: player.spice,
    reserves: player.reserves, tanks: player.tanks, forces: player.forces, elites: player.elites,
    leaders: player.leaders, shipped: player.shipped, moved: player.moved, revived: player.revived, ally: player.ally })),
});
const cisternPlacement = DISCOVERY_CARD_PLACEMENTS['discovery-hagga-basin'];

/** Select only real scalar packet/token draws. UUID and byte entropy stay
 * native; optional scalars must all be consumed by the actual producer. */
function originalRelocationAction(game: Game, actor: string, action: Action,
  actions: SemutaAdvisorRelocationStep[], scalars: readonly number[] = []): Game {
  const descriptor = Object.getOwnPropertyDescriptor(crypto, 'getRandomValues');
  const original = crypto.getRandomValues.bind(crypto); let cursor = 0;
  crypto.getRandomValues = <V extends ArrayBufferView | null>(array: V): V => {
    if (array instanceof Uint32Array && array.length === 1)
      array[0] = cursor < scalars.length ? scalars[cursor++] : 0xffffffff;
    else Reflect.apply(original, crypto, [array]);
    return array;
  };
  try {
    const gameAfter = applyAction(game, actor, action);
    assert.equal(cursor, scalars.length, 'The actual original producer consumes every selected scalar draw');
    actions.push({ actor, action: structuredClone(action) }); return gameAfter;
  } finally {
    if (descriptor) Object.defineProperty(crypto, 'getRandomValues', descriptor);
    else Reflect.deleteProperty(crypto, 'getRandomValues');
  }
}
export function actSemutaAdvisorRelocation(game: Game, actor: string, action: Action,
  actions: SemutaAdvisorRelocationStep[] = []): Game {
  return originalRelocationAction(game, actor, action, actions);
}
export function nextSemutaAdvisorRelocation(game: Game): SemutaAdvisorRelocationStep | null {
  if (game.pendingTreacheryDiscard || game.truthtrance || game.response?.automaticAdvisorFlip) return null;
  if (!game.phaseOpening && !game.response) {
    const bg = game.players.find(player => player.faction === 'beneGesserit'); assert.ok(bg);
    const ecaz = game.players.find(player => player.faction === 'ecaz');
    if (game.status === 'setup' && game.setupStage === 'prediction')
      return { actor: bg.id, action: { type: 'predict', faction: 'atreides', turn: 10 } };
    if (game.status === 'setup' && game.setupStage === 'forces') {
      if (ecaz?.reserves === 20)
        return { actor: ecaz.id, action: { type: 'ecazSetup', placements: { 'imperial_basin:10': 6 } } };
      if (!bg.advisorSetup)
        return { actor: bg.id, action: { type: 'advisorSetup', territory: ecaz ? 'imperial_basin' : cisternPlacement.territory,
          sector: ecaz ? 10 : cisternPlacement.sector } };
    }
    const decision = game.decision;
    if (decision?.kind === 'ecazPlacement' || decision?.kind === 'ecazAmbassador') return null;
    if (decision?.kind === 'advisorBattle' || decision?.kind === 'advisor')
      return { actor: decision.player, action: { type: 'decision', accept: false } };
    if (decision?.kind === 'intrusion')
      return { actor: decision.player, action: { type: 'decision', accept: true } };
    if (decision?.kind === 'discoveryEntry')
      return { actor: decision.player, action: { type: 'decision', event: decision.event, accept: false } };
  }
  return nextSemutaRicheseCacheKarama(game);
}
export function advanceSemutaAdvisorRelocation(game: Game, until: (state: Game) => boolean,
  actions: SemutaAdvisorRelocationStep[] = []): Game {
  for (let count = 0; count < 2000; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished');
    const step = nextSemutaAdvisorRelocation(game);
    assert.ok(step, 'Choose the original Ambassador, conversion or fresh discard before continuing');
    game = actSemutaAdvisorRelocation(game, step.actor, step.action, actions);
  }
  throw Error('The original relocation-conversion programme did not reach its finite boundary');
}
export function allowSemutaAdvisorRelocation(game: Game,
  actions: SemutaAdvisorRelocationStep[] = []): Game {
  assert.equal(game.response?.automaticAdvisorFlip?.producer, 'specialRelocation');
  for (let count = 0; game.response?.kind === 'advisorFlip' && count < game.players.length; count++) {
    const actor = game.players.find(player => !game.response!.passed.includes(player.id)); assert.ok(actor);
    game = actSemutaAdvisorRelocation(game, actor.id, { type: 'passResponse' }, actions);
  }
  assert.notEqual(game.response?.kind, 'advisorFlip'); return game;
}
/** Finish only the original entry parent. In phase zero stop as soon as the
 * Discovery round clears, before unrelated Storm readiness or its movement. */
export function finishSemutaAdvisorRelocation(game: Game,
  actions: SemutaAdvisorRelocationStep[] = []): Game {
  assert.equal(game.pendingTreacheryDiscard ?? null, null); assert.equal(game.pendingKarama ?? null, null);
  const discovery = game.phase === 0;
  return advanceSemutaAdvisorRelocation(game, state => discovery
    ? !state.discoveryEntry && !state.response?.automaticAdvisorFlip
    : !state.pendingAmbassador && semutaAdvisorRelocationClean(state), actions);
}

function fremenPacket() {
  const original = AMBASSADOR_EFFECTS.filter(effect => effect !== 'ecaz');
  const supply: Exclude<AmbassadorEffect, 'ecaz'>[] = ['fremen', ...original.filter(effect => effect !== 'fremen').slice(0, 4)];
  const order = [...supply, ...original.filter(effect => !supply.includes(effect))];
  const current = [...original], scalars: number[] = [];
  for (let index = current.length - 1; index > 0; index--) {
    const from = current.indexOf(order[index]); assert.ok(from >= 0 && from <= index);
    scalars.push(Math.floor((from + 0.5) * 4294967296 / (index + 1)));
    [current[index], current[from]] = [current[from], current[index]];
  }
  assert.deepEqual(current, order); assert.equal(scalars.length, 9); return { supply, order, scalars };
}

/** Real Advanced Semuta setup for the original narrow E3 or Discovery
 * initializer. No played cards, pieces, resources, tokens or controls are set. */
function createRelocationSetup(kind: SemutaAdvisorRelocationKind) {
  const richese = 'richese', holder = 'choam', owner = 'beneGesserit', atreides = 'atreides';
  const spender = kind === 'ambassador' ? atreides : 'emperor';
  let game = createGame('SEMUTAADVISORRELOCATION', newPlayer(richese, 'Richese', 'richese'), true,
    kind === 'ambassador' ? ['choam', 'ecaz'] : ['choam']);
  const roster = kind === 'ambassador' ? [holder, 'ecaz', owner, atreides] as const
    : [holder, owner, atreides, 'emperor'] as const;
  for (const faction of roster) joinGame(game, newPlayer(faction, faction, faction));
  const initial = structuredClone(game), actions: SemutaAdvisorRelocationStep[] = [];
  const act = (actor: string, action: Action) => { game = actSemutaAdvisorRelocation(game, actor, action, actions); };
  if (kind === 'discovery') act(game.host, { type: 'moduleOption', module: 'discoveries', enabled: true });
  const configured = structuredClone(game);
  for (const player of game.players) act(player.id, { type: 'ready' });
  const lobby = structuredClone(game);
  game = withClassicDiscoveryNexusLottery(() => initializeSemutaGameForAudit(game));
  const setup = structuredClone(game), initialization = { before: lobby, after: setup,
    entry: kind === 'ambassador' ? 'original-undealt-bare-advanced-ecaz-semuta' : 'original-undealt-semuta-discovery' };
  assert.equal(game.status, 'setup'); assert.equal(game.advanced, true); assert.equal(game.semutaPreview, true);
  assert.equal(!!game.discoveryEnabled, kind === 'discovery');
  assert.ok(game.players.every(player => player.hand.length === 0));
  assert.ok(!game.homeworlds && !game.nexusCards && !game.leaderSkills && !game.techTokens &&
    !game.strongholdCards && !game.ecazTreachery);
  const originalInventory = semutaAdvisorRelocationInventory(game);
  assert.equal(originalInventory.length, 45); assert.equal(game.deck.length, 35); assert.equal(game.richeseCache!.length, 10);
  const printed = game.deck.find(card => card.effect === 'karama'); assert.ok(printed);
  const ordinary = game.deck.filter(card => card.kind === 'projectile' && !card.effect).slice(0, 4);
  assert.equal(ordinary.length, 4);
  const selected = [...ordinary, printed], cost = printed.id;
  const dealOrder = selected.map((card, position) => {
    const from = game.deck.findIndex(candidate => candidate.id === card.id); assert.ok(from >= position);
    [game.deck[position], game.deck[from]] = [game.deck[from], game.deck[position]];
    return { position, from, card: card.id };
  });
  const beforeStartingDeal = structuredClone(game), packet = kind === 'ambassador' ? fremenPacket() : null;
  let packetCreation: { before: Game; steps: SemutaAdvisorRelocationStep[]; after: Game } | null = null;
  let advisorSetup: { before: Game; steps: SemutaAdvisorRelocationStep[]; after: Game } | null = null;
  for (let count = 0; game.status === 'setup' && count < 120; count++) {
    const step = nextSemutaAdvisorRelocation(game); assert.ok(step);
    const before = structuredClone(game), start = actions.length;
    const initializesForces = packet && game.setupStage === 'traitors' && step.action.type === 'traitor' &&
      game.players.filter(player => player.traitorChoices.length).length === 1;
    game = initializesForces
      ? originalRelocationAction(game, step.actor, step.action, actions, packet!.scalars)
      : actSemutaAdvisorRelocation(game, step.actor, step.action, actions);
    const record = { before, steps: structuredClone(actions.slice(start)), after: structuredClone(game) };
    if (initializesForces) packetCreation = record;
    if (step.action.type === 'advisorSetup') advisorSetup = record;
  }
  assert.equal(game.status, 'playing'); assert.ok(advisorSetup);
  const afterSetup = structuredClone(game);
  assert.deepEqual(game.players.flatMap(player => player.hand.map(card => card.id)), selected.map(card => card.id));
  assert.ok(semutaAdvisorRelocationPlayer(game, spender).hand.some(card => card.id === cost));
  if (packet) {
    assert.ok(packetCreation);
    assert.deepEqual(game.ecazAmbassadors!.cohort.map(id => game.ecazAmbassadors!.tokens.find(token => token.id === id)!.effect), packet.supply);
  }
  const originalSpice = game.spiceDeck.map(card => JSON.stringify(card)).sort();
  const spiceOrder = [0, 1].map(position => {
    const from = game.spiceDeck.findIndex((card, index) => index >= position && 'territory' in card &&
      (kind === 'discovery' && position === 0 ? card.discovery === 'discovery-hagga-basin' : !card.discovery));
    assert.ok(from >= position); const card = game.spiceDeck.splice(from, 1)[0];
    game.spiceDeck.splice(position, 0, card); return { position, from, card: structuredClone(card) };
  });
  assert.deepEqual(game.spiceDeck.map(card => JSON.stringify(card)).sort(), originalSpice);
  return { game, initial, configured, lobby, setup, initialization, beforeStartingDeal, afterSetup,
    packet, packetCreation, advisorSetup, richese, holder, owner, bg: owner, atreides, spender,
    cost, semuta: SEMUTA_DRUG_ID, actions, originalInventory, originalSpice, dealOrder, spiceOrder };
}

/** Actual paid cache purchase. Never substitute a physical card into a played
 * hand when acquiring Semuta for either relocation chronology. */
function acquireSemuta(game: Game, actions: SemutaAdvisorRelocationStep[]) {
  const holder = 'choam', richese = 'richese';
  let beforeBid: Game | undefined, bid: SemutaAdvisorRelocationStep | undefined, bidAt = -1;
  for (let count = 0; count < 1000 && !semutaAdvisorRelocationPlayer(game, holder).hand.some(card => card.id === SEMUTA_DRUG_ID); count++) {
    const step = nextSemutaAdvisorRelocation(game); assert.ok(step);
    if (step.actor === holder && step.action.type === 'richeseBid' && step.action.amount === 1) {
      beforeBid = structuredClone(game); bid = structuredClone(step); bidAt = actions.length;
    }
    game = actSemutaAdvisorRelocation(game, step.actor, step.action, actions);
  }
  assert.ok(beforeBid && bid && bidAt >= 0, 'CHOAM really purchases the original cache Semuta for one spice');
  const acquired = structuredClone(game), acquisition = { before: beforeBid, bid,
    steps: structuredClone(actions.slice(bidAt)), after: acquired, price: 1 };
  assert.equal(semutaAdvisorRelocationPlayer(beforeBid, holder).spice - semutaAdvisorRelocationPlayer(game, holder).spice, 1);
  assert.equal(semutaAdvisorRelocationPlayer(game, richese).spice - semutaAdvisorRelocationPlayer(beforeBid, richese).spice, 1);
  return { game, acquired, acquisition };
}

export function createSemutaAdvisorRelocationFixture(options: { kind: SemutaAdvisorRelocationKind }) {
  const { kind } = options, base = createRelocationSetup(kind), { actions, owner, holder, atreides } = base;
  let game = base.game;
  const act = (actor: string, action: Action) => { game = actSemutaAdvisorRelocation(game, actor, action, actions); };
  const reach = (until: (state: Game) => boolean) => { game = advanceSemutaAdvisorRelocation(game, until, actions); };
  const transition = (run: () => void) => {
    const before = structuredClone(game), start = actions.length; run();
    return { before, steps: structuredClone(actions.slice(start)), after: structuredClone(game) };
  };
  let tokenPlacement: ReturnType<typeof transition> | null = null, tokenScalar: number | null = null;
  if (kind === 'discovery') {
    reach(state => state.phase === 1 && semutaAdvisorRelocationClean(state));
    const before = structuredClone(game), start = actions.length;
    const eligible = game.discoveries!.tokens.filter(token => token.status === 'supply' && token.type === DISCOVERY_TOKEN_BY_ID.cistern.type);
    const selected = eligible.findIndex(token => token.face === 'cistern'); assert.ok(selected >= 0);
    tokenScalar = Math.floor((selected + 0.5) * 4294967296 / eligible.length);
    for (let count = 0; !game.discoveries!.tokens.some(token => token.face === 'cistern' && token.status === 'placed') && count < 100; count++) {
      const step = nextSemutaAdvisorRelocation(game); assert.ok(step);
      const places = !game.response && !game.phaseOpening && !game.decision && step.action.type === 'ready' &&
        game.ready.length === game.players.length - 1;
      game = originalRelocationAction(game, step.actor, step.action, actions, places ? [tokenScalar] : []);
    }
    tokenPlacement = { before, steps: structuredClone(actions.slice(start)), after: structuredClone(game) };
    const placed = game.discoveries!.tokens.find(token => token.face === 'cistern'); assert.ok(placed);
    assert.equal(placed.status, 'placed'); assert.equal(placed.territory, cisternPlacement.territory);
  }
  const paidSemuta = acquireSemuta(game, actions); game = paidSemuta.game;
  let placement: ReturnType<typeof transition> | null = null, trigger: ReturnType<typeof transition> | null = null;
  let intrusion: ReturnType<typeof transition> | null = null, revelation: ReturnType<typeof transition> | null = null;
  let offer: Game | null = null;
  let token: string, event: string, territory: string, from: string, destination: string, sector: number, amount: number;
  let mover: string, nativeAction: Action, shipment: ReturnType<typeof transition>;
  if (kind === 'ambassador') {
    const ecaz = 'ecaz'; territory = 'imperial_basin'; from = 'imperial_basin:10'; mover = ecaz;
    assert.equal(semutaAdvisorRelocationPlayer(game, ecaz).forces[from], 6);
    assert.equal(semutaAdvisorRelocationPlayer(game, owner).forces[from], 1);
    assert.equal(isAdvisor(semutaAdvisorRelocationPlayer(game, owner), territory), true);
    reach(state => state.phase === 4 && !state.response && !state.phaseOpening && state.decision?.kind === 'ecazPlacement');
    const physicalToken = game.ecazAmbassadors!.tokens.find(candidate => candidate.effect === 'fremen'); assert.ok(physicalToken);
    token = physicalToken.id; assert.equal(physicalToken.zone, 'supply');
    placement = transition(() => {
      act(ecaz, { type: 'decision', token, territory: 'carthag' });
      reach(state => !state.response && !state.phaseOpening && state.decision?.kind === 'ecazPlacement');
    });
    assert.equal(semutaAdvisorRelocationPlayer(placement.before, ecaz).spice - semutaAdvisorRelocationPlayer(game, ecaz).spice, 1);
    act(ecaz, { type: 'decision', decline: true });
    reach(state => state.phase === 5 && state.active === atreides && semutaAdvisorRelocationClean(state));
    shipment = transition(() => {
      act(atreides, { type: 'ship', territory: 'carthag', sector: 11, amount: 1, elite: 0, allyPayment: 0 });
      reach(state => !state.response && !state.phaseOpening && state.pendingAmbassador?.stage === 'offer');
    });
    offer = structuredClone(game); event = game.pendingAmbassador!.event;
    trigger = transition(() => {
      act(ecaz, { type: 'decision', event, trigger: true, beneficiary: ecaz });
      reach(state => !state.response && !state.phaseOpening && state.pendingAmbassador?.stage === 'move');
    });
    assert.equal(game.pendingAmbassador!.effect, 'fremen'); assert.equal(game.pendingAmbassador!.beneficiary, ecaz);
    destination = 'tueks_sietch'; sector = 5; amount = 6;
    nativeAction = { type: 'decision', event, forces: { [from]: amount }, territory: destination, sector };
  } else {
    territory = cisternPlacement.territory; from = `${territory}:${cisternPlacement.sector}`; mover = atreides;
    const physicalToken = game.discoveries!.tokens.find(candidate => candidate.face === 'cistern'); assert.ok(physicalToken);
    token = physicalToken.id; assert.equal(physicalToken.status, 'placed');
    assert.equal(isAdvisor(semutaAdvisorRelocationPlayer(base.afterSetup, owner), territory), false);
    reach(state => state.phase === 5 && state.active === owner && semutaAdvisorRelocationClean(state));
    act(owner, { type: 'endMovement' });
    reach(state => state.phase === 5 && state.active === atreides && semutaAdvisorRelocationClean(state));
    shipment = transition(() => {
      act(atreides, { type: 'ship', territory, sector: cisternPlacement.sector, amount: 1, elite: 0, allyPayment: 0 });
      reach(state => !state.response && !state.phaseOpening && state.decision?.kind === 'intrusion');
    });
    intrusion = transition(() => {
      act(owner, { type: 'decision', accept: true }); reach(semutaAdvisorRelocationClean);
    });
    assert.equal(semutaAdvisorRelocationPlayer(shipment.before, atreides).spice - semutaAdvisorRelocationPlayer(game, atreides).spice, 2);
    assert.equal(semutaAdvisorRelocationPlayer(game, atreides).forces[from], 1);
    assert.equal(isAdvisor(semutaAdvisorRelocationPlayer(game, owner), territory), true);
    reach(state => state.turn === 1 && state.phase === 7 && semutaAdvisorRelocationClean(state));
    assert.ok(viewGame(game, atreides).discoveries!.canInspect.includes(physicalToken.id));
    revelation = transition(() => {
      act(atreides, { type: 'discovery', token, reveal: false });
      act(atreides, { type: 'discovery', token, reveal: true });
    });
    reach(state => state.turn === 2 && state.phase === 0 && !state.response && !state.phaseOpening &&
      state.decision?.kind === 'discoveryEntry' && state.decision.player === atreides);
    const entryAction = discoveryEntryMoveAction(viewGame(game, atreides), [{ source: from, normal: 1, elite: 0 }]);
    assert.ok(entryAction); assert.ok(game.decision?.kind === 'discoveryEntry');
    event = game.decision.event; nativeAction = entryAction; destination = 'cistern'; sector = 0; amount = 1;
  }
  const beforeDeclaration = structuredClone(game);
  const relocation = transition(() => { act(mover, nativeAction); });
  const destinationLocation = `${destination}:${sector}`;
  assert.equal(semutaAdvisorRelocationPlayer(game, mover).forces[from], undefined);
  assert.equal(semutaAdvisorRelocationPlayer(game, mover).forces[destinationLocation],
    (semutaAdvisorRelocationPlayer(beforeDeclaration, mover).forces[destinationLocation] ?? 0) + amount);
  assert.deepEqual(game.players.map(player => [player.id, player.spice, player.reserves, player.tanks, player.shipped, player.moved]),
    beforeDeclaration.players.map(player => [player.id, player.spice, player.reserves, player.tanks, player.shipped, player.moved]));
  assert.equal(game.response?.kind, 'advisorFlip'); assert.equal(game.response?.owner, owner);
  assert.equal(game.response?.automaticAdvisorFlip?.producer, 'specialRelocation');
  assert.ok(game.pendingAutomaticAdvisorRelocation && game.pendingAutomaticAdvisorFlips?.length === 1);
  assert.equal(isAdvisor(semutaAdvisorRelocationPlayer(game, owner), territory), true);
  assert.ok(semutaAdvisorRelocationPlayer(game, owner).advisors?.[territory]?.aloneFlipHold);
  if (kind === 'ambassador') assert.equal(game.pendingAmbassador?.relocation?.next, 'flip');
  else assert.equal(game.discoveryEntry?.stage, 'arrival');
  assert.equal(game.phaseOpening ?? null, null); assert.equal(game.decision ?? null, null);
  assert.equal(game.pendingTreacheryDiscard ?? null, null); assert.equal(game.pendingKarama ?? null, null);
  assert.ok(semutaAdvisorRelocationPlayer(game, holder).hand.some(card => card.id === SEMUTA_DRUG_ID));
  assert.ok(semutaAdvisorRelocationPlayer(game, base.spender).hand.some(card => card.id === base.cost));
  assert.deepEqual(semutaAdvisorRelocationInventory(game), base.originalInventory);
  const source = structuredClone(game), action: Action = { type: 'card', card: base.cost, mode: 'cancel' };
  return { ...base, game, source, beforeCost: source, kind, advanced: true as const, mover, actor: mover,
    territory, origin: territory, from, location: from, destination, destinationLocation, to: destinationLocation,
    sector, amount, event, token, action, nativeAction,
    originalResponse: structuredClone(game.response!),
    originalAutomaticSource: structuredClone(game.response!.automaticAdvisorFlip!),
    originalParent: structuredClone(game.pendingAutomaticAdvisorRelocation!),
    originalQueue: structuredClone(game.pendingAutomaticAdvisorFlips!),
    originalAmbassador: structuredClone(game.pendingAmbassador ?? null),
    originalDiscoveryEntry: structuredClone(game.discoveryEntry ?? null),
    originalHeldStance: structuredClone(semutaAdvisorRelocationPlayer(game, owner).advisors![territory]),
    originalPhysical: structuredClone(semutaAdvisorRelocationPhysical(game)), originalHistory: structuredClone(game.log),
    originalAmbassadorToken: structuredClone(game.ecazAmbassadors?.tokens.find(candidate => candidate.id === token) ?? null),
    originalDiscoveryToken: structuredClone(game.discoveries?.tokens.find(candidate => candidate.id === token) ?? null),
    acquired: paidSemuta.acquired, acquisition: paidSemuta.acquisition, beforeDeclaration, relocation,
    placement, shipment, offer, trigger, tokenPlacement, tokenScalar, intrusion, revelation,
    sourceActions: actions, sourceActionCount: actions.length,
    staging: [
      kind === 'ambassador'
        ? 'Original narrow Advanced Ecaz Semuta initializer on ready undealt R/C/Ecaz/BG/A, exact CHOAM+Ecaz and no optional modules. The actual final Traitor choice consumes nine selected original packet scalars to earn Fremen supply; no token is installed.'
        : 'Actual lobby Discovery moduleOption, then original Advanced Semuta Discovery initializer on ready undealt R/C/BG/A/E, exact CHOAM and only Discoveries. No fresh profile/start gate is added.',
      'Select original unopened Treachery positions so the stopper is really dealt printed Karama. CHOAM actually buys original cache Semuta for one spice; no played hand, wallet or physical card is assigned.',
      kind === 'ambassador'
        ? 'Actual Ecaz setup six in Basin10 and BG advisorSetup one beside them. Native first Storm, dual Spice, Charity, auction and Revival run. Ecaz actually pays one to place Fremen at Carthag; A really ships one there and Ecaz triggers the original token for itself.'
        : 'Actual BG advisorSetup at empty Gara Kulon8 is initially a fighter. The original Hagga Basin Discovery Spice Card and a real selected supply-token draw place Cistern there. A later pays two to ship one beside BG; actual accepted Intrusion and allowed original flip make BG an advisor, and accompaniment is declined.',
      kind === 'ambassador'
        ? 'Actually relocate all six original Basin counters to empty Tueks5, leaving BG alone. The consumed token, original paid A shipment and Ambassador arrival child remain native while conversion is pending.'
        : 'At actual Collection A inspects then reveals Cistern. At the original next-turn free-entry chooser A really moves its one non-advisor parent counter into Cistern0, leaving BG alone. No fake reveal, free-entry frame or played clock is installed.',
      'Stop at the original specialRelocation automatic advisorFlip before spending the original printed Karama. Finish only that Ambassador/Discovery parent once and stop before unrelated future movement or Storm readiness.',
    ],
  };
}
export type SemutaAdvisorRelocationFixture = ReturnType<typeof createSemutaAdvisorRelocationFixture>;
