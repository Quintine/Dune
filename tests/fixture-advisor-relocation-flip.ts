import assert from 'node:assert/strict';
import { applyAction, createGame, joinGame, newPlayer, viewGame, type Action, type Game } from '../game/engine';
import { AMBASSADOR_EFFECTS, type AmbassadorEffect } from '../game/ecaz-ambassadors';
import { DISCOVERY_CARD_PLACEMENTS, DISCOVERY_TOKEN_BY_ID } from '../game/discoveries';
import { discoveryEntryMoveAction } from '../game/discovery-entry-options';
import {
  advisorPreparationClean, advisorPreparationInventory, advisorPreparationPlayer,
  nextAdvisorPreparationStep,
} from './fixture-advisor-preparation';

export type AdvisorRelocationStep = { actor: string; action: Action };
export type AdvisorRelocationTransition = { before: Game; steps: AdvisorRelocationStep[]; after: Game };
export const advisorRelocationPlayer = advisorPreparationPlayer;
export const advisorRelocationInventory = advisorPreparationInventory;
export const advisorRelocationClean = advisorPreparationClean;
const cisternPlacement = DISCOVERY_CARD_PLACEMENTS['discovery-hagga-basin'];

/** Original native scalar draws only. Optional selected draws are consumed by
 * one real packet/placement producer; UUIDs and byte entropy remain native. */
function originalRelocationAction(game: Game, actor: string, action: Action,
  steps: AdvisorRelocationStep[], scalars: readonly number[] = []): Game {
  const descriptor = Object.getOwnPropertyDescriptor(crypto, 'getRandomValues');
  const native = crypto.getRandomValues.bind(crypto); let cursor = 0;
  crypto.getRandomValues = <V extends ArrayBufferView | null>(array: V): V => {
    if (array instanceof Uint32Array && array.length === 1)
      array[0] = cursor < scalars.length ? scalars[cursor++] : 0xffffffff;
    else Reflect.apply(native, crypto, [array]);
    return array;
  };
  try {
    const next = applyAction(game, actor, action);
    assert.equal(cursor, scalars.length, 'The actual original producer consumes its selected scalar draws');
    steps.push({ actor, action: structuredClone(action) }); return next;
  } finally {
    if (descriptor) Object.defineProperty(crypto, 'getRandomValues', descriptor);
    else Reflect.deleteProperty(crypto, 'getRandomValues');
  }
}
export function actAdvisorRelocation(game: Game, actor: string, action: Action,
  steps: AdvisorRelocationStep[] = []): Game {
  return originalRelocationAction(game, actor, action, steps);
}
/** Original Ambassador choices stay owned; Discovery entries may be declined
 * while seeking another seat's original offer. New conversion is never passed. */
export function nextAdvisorRelocation(game: Game): AdvisorRelocationStep | null {
  if (game.response?.automaticAdvisorFlip) return null;
  if (!game.phaseOpening && !game.response && !game.pendingTreacheryDiscard) {
    const ecaz = game.players.find(player => player.faction === 'ecaz');
    if (game.status === 'setup' && game.setupStage === 'forces') {
      if (ecaz?.reserves === 20)
        return { actor: ecaz.id, action: { type: 'ecazSetup', placements: { 'imperial_basin:10': 6 } } };
      if (!advisorRelocationPlayer(game, 'beneGesserit').advisorSetup)
        return { actor: 'beneGesserit', action: { type: 'advisorSetup',
          territory: ecaz ? 'imperial_basin' : cisternPlacement.territory,
          sector: ecaz ? 10 : cisternPlacement.sector } };
    }
    const decision = game.decision;
    if (decision?.kind === 'ecazPlacement' || decision?.kind === 'ecazAmbassador') return null;
    if (decision?.kind === 'advisorBattle')
      return { actor: decision.player, action: { type: 'decision', accept: false } };
    if (decision?.kind === 'intrusion')
      return { actor: decision.player, action: { type: 'decision', accept: true } };
    if (decision?.kind === 'discoveryEntry')
      return { actor: decision.player, action: { type: 'decision', event: decision.event, accept: false } };
  }
  return nextAdvisorPreparationStep(game);
}
export function advanceAdvisorRelocation(game: Game, until: (state: Game) => boolean,
  steps: AdvisorRelocationStep[] = []): Game {
  for (let count = 0; count < 2000; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished', 'The native relocation chronology ended before its requested boundary');
    const next = nextAdvisorRelocation(game);
    assert.ok(next, `Choose the original Ambassador/conversion at ${game.turn}/${game.phase}/${game.decision?.kind}`);
    game = actAdvisorRelocation(game, next.actor, next.action, steps);
  }
  throw Error('The native advisor relocation source did not reach its finite boundary');
}
export function passAdvisorRelocation(game: Game, steps: AdvisorRelocationStep[] = []): Game {
  for (let count = 0; game.response && !game.response.automaticAdvisorFlip && count < 60; count++) {
    const actor = game.players.find(player => !game.response!.passed.includes(player.id)); assert.ok(actor);
    game = actAdvisorRelocation(game, actor.id, { type: 'passResponse' }, steps);
  }
  assert.ok(!game.response || game.response.automaticAdvisorFlip); return game;
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
function createRelocationSetup(kind: 'ambassador' | 'discovery') {
  const bg = 'beneGesserit', holder = 'atreides', other = kind === 'ambassador' ? 'ecaz' : 'emperor';
  let game = createGame('ADVISORRELOCATIONFLIP', newPlayer(bg, 'Bene Gesserit', 'beneGesserit'), true,
    kind === 'ambassador' ? ['ecaz'] : []);
  if (kind === 'ambassador') {
    joinGame(game, newPlayer(other, 'Ecaz', 'ecaz')); joinGame(game, newPlayer(holder, 'Atreides', 'atreides'));
  } else {
    joinGame(game, newPlayer(holder, 'Atreides', 'atreides')); joinGame(game, newPlayer(other, 'Emperor', 'emperor'));
  }
  const initial = structuredClone(game), steps: AdvisorRelocationStep[] = [];
  const act = (actor: string, action: Action) => { game = actAdvisorRelocation(game, actor, action, steps); };
  if (kind === 'discovery') act(game.host, { type: 'moduleOption', module: 'discoveries', enabled: true });
  const configured = structuredClone(game);
  for (const player of game.players) act(player.id, { type: 'ready' });
  const lobby = structuredClone(game); act(game.host, { type: 'start', advancedPreview: true });
  const setup = structuredClone(game);
  assert.equal(game.status, 'setup'); assert.equal(game.advanced, true);
  assert.equal(!!game.discoveryEnabled, kind === 'discovery');
  assert.ok(!game.homeworlds && !game.nexusCards && !game.leaderSkills && !game.techTokens &&
    !game.strongholdCards && !game.ecazTreachery);
  assert.ok(game.players.every(player => !player.hand.length));
  const originalInventory = advisorRelocationInventory(game); assert.equal(originalInventory.length, 33);
  const karama = game.deck.find(card => card.effect === 'karama'); assert.ok(karama);
  const ordinary = game.deck.filter(card => ['projectile', 'poison', 'shield', 'snooper'].includes(card.kind)).slice(0, 2);
  assert.equal(ordinary.length, 2);
  const selected = kind === 'ambassador' ? [ordinary[0], ordinary[1], karama] : [ordinary[0], karama, ordinary[1]];
  const dealOrder = selected.map((card, position) => {
    const from = game.deck.findIndex(candidate => candidate.id === card.id); assert.ok(from >= position);
    [game.deck[position], game.deck[from]] = [game.deck[from], game.deck[position]];
    return { position, from, card: card.id };
  });
  const beforeStartingDeal = structuredClone(game), packet = kind === 'ambassador' ? fremenPacket() : null;
  let packetCreation: AdvisorRelocationTransition | null = null;
  let advisorSetup: AdvisorRelocationTransition | null = null;
  for (let count = 0; game.status === 'setup' && count < 100; count++) {
    const next = nextAdvisorRelocation(game); assert.ok(next);
    const before = structuredClone(game), start = steps.length;
    const initializesForces = packet && game.setupStage === 'traitors' && next.action.type === 'traitor' &&
      game.players.filter(player => player.traitorChoices.length).length === 1;
    game = initializesForces
      ? originalRelocationAction(game, next.actor, next.action, steps, packet!.scalars)
      : actAdvisorRelocation(game, next.actor, next.action, steps);
    const record = { before, steps: structuredClone(steps.slice(start)), after: structuredClone(game) };
    if (initializesForces) packetCreation = record;
    if (next.action.type === 'advisorSetup') advisorSetup = record;
  }
  assert.equal(game.status, 'playing'); assert.ok(advisorSetup);
  const afterSetup = structuredClone(game);
  assert.deepEqual(game.players.flatMap(player => player.hand.map(card => card.id)), selected.map(card => card.id));
  assert.ok(advisorRelocationPlayer(game, holder).hand.some(card => card.id === karama.id));
  if (packet) {
    assert.ok(packetCreation);
    assert.deepEqual(game.ecazAmbassadors!.cohort.map(id => game.ecazAmbassadors!.tokens.find(token => token.id === id)!.effect), packet.supply);
  }
  return { game, initial, configured, lobby, setup, beforeStartingDeal, afterSetup, advisorSetup,
    packet, packetCreation, kind, bg, holder, atreides: holder, other, karama: karama.id,
    steps, actions: steps, originalInventory, dealOrder };
}
function orderOriginalSpice(game: Game, discovery: boolean) {
  const originalSpice = game.spiceDeck.map(card => JSON.stringify(card)).sort();
  const spiceOrder = [0, 1].map(position => {
    const from = game.spiceDeck.findIndex((card, index) => index >= position && 'territory' in card &&
      (discovery && position === 0 ? card.discovery === 'discovery-hagga-basin' : !card.discovery));
    assert.ok(from >= position); const card = game.spiceDeck.splice(from, 1)[0];
    game.spiceDeck.splice(position, 0, card); return { position, from, card: structuredClone(card) };
  });
  assert.deepEqual(game.spiceDeck.map(card => JSON.stringify(card)).sort(), originalSpice);
  return { originalSpice, spiceOrder };
}

/** Real Ecaz6/BG setup, paid original Fremen token and actual A entrant.
 * Stop before Ecaz relocates its entire native Basin group away from BG. */
export function createAdvisorAmbassadorRelocationFixture() {
  const base = createRelocationSetup('ambassador'), { bg, holder, karama, steps } = base, ecaz = base.other;
  let game = base.game;
  const act = (actor: string, action: Action) => { game = actAdvisorRelocation(game, actor, action, steps); };
  const reach = (until: (state: Game) => boolean) => { game = advanceAdvisorRelocation(game, until, steps); };
  const transition = (run: () => void): AdvisorRelocationTransition => {
    const before = structuredClone(game), start = steps.length; run();
    return { before, steps: structuredClone(steps.slice(start)), after: structuredClone(game) };
  };
  const spice = orderOriginalSpice(game, false), territory = 'imperial_basin', location = 'imperial_basin:10';
  assert.equal(advisorRelocationPlayer(game, ecaz).forces[location], 6);
  assert.equal(advisorRelocationPlayer(game, bg).forces[location], 1);
  assert.ok(advisorRelocationPlayer(game, bg).advisors?.[territory]);
  reach(state => state.phase === 4 && !state.response && !state.phaseOpening && state.decision?.kind === 'ecazPlacement');
  const token = game.ecazAmbassadors!.tokens.find(candidate => candidate.effect === 'fremen')!;
  assert.equal(token.zone, 'supply');
  const placement = transition(() => {
    act(ecaz, { type: 'decision', token: token.id, territory: 'carthag' });
    game = passAdvisorRelocation(game, steps);
  });
  assert.equal(advisorRelocationPlayer(placement.before, ecaz).spice - advisorRelocationPlayer(game, ecaz).spice, 1);
  act(ecaz, { type: 'decision', decline: true });
  reach(state => state.phase === 5 && state.active === holder && advisorRelocationClean(state));
  const shipment = transition(() => {
    act(holder, { type: 'ship', territory: 'carthag', sector: 11, amount: 1, elite: 0, allyPayment: 0 });
    reach(state => !state.response && !state.phaseOpening && state.pendingAmbassador?.stage === 'offer');
  });
  const offer = structuredClone(game), event = game.pendingAmbassador!.event;
  const trigger = transition(() => {
    act(ecaz, { type: 'decision', event, trigger: true, beneficiary: ecaz });
    reach(state => !state.response && !state.phaseOpening && state.pendingAmbassador?.stage === 'move');
  });
  assert.equal(game.pendingAmbassador!.effect, 'fremen'); assert.equal(game.pendingAmbassador!.beneficiary, ecaz);
  const destination = 'tueks_sietch', sector = 5;
  const action: Action = { type: 'decision', event, forces: { [location]: 6 }, territory: destination, sector };
  assert.ok(advisorRelocationPlayer(game, holder).hand.some(card => card.id === karama));
  assert.deepEqual(advisorRelocationInventory(game), base.originalInventory);
  return { ...base, ...spice, game, source: structuredClone(game), beforeAction: structuredClone(game),
    ecaz, actor: ecaz, mover: ecaz, shipper: ecaz, kind: 'ambassador' as const, event, token: token.id,
    placement, shipment, offer, trigger, territory, location, from: location, origin: territory,
    destination, destinationLocation: `${destination}:${sector}`, to: `${destination}:${sector}`, sector, amount: 6, action,
    relocationStep: { actor: ecaz, action } satisfies AdvisorRelocationStep,
    sourceActionCount: steps.length, staging: [
      'Actual public Advanced BG/Ecaz/Atreides ready/startPreview, native prediction, private Traitors and original base33. Exactly nine original packet draws on the last actual Traitor choice earn Fremen in Ecaz’s original supply; no token state is installed.',
      'Original ecazSetup places six counters in Basin10; actual BG advisorSetup places one advisor beside them. Only three unopened Treachery positions and two original ordinary Spice positions are selected; Atreides retains its originally dealt Karama.',
      'Native first Storm, both Spice blows, Charity, Bidding and Revival execute. Ecaz actually pays one to place the original Fremen token in Carthag, then ends placement. Earlier native movement turns skip without moving Basin forces.',
      'Atreides actually ships one reserve to Carthag. The original entry offer really triggers the Fremen token for Ecaz and reaches its real relocation choice. Stop before moving all six original Basin counters to empty Tuek’s5, leaving the original BG advisor behind.',
      'No played force, wallet, hand, alliance, phase, stance, relocation receipt or prevention is installed. The optional BG-beneficiary arrival route is excluded because it would require a separate genuine alliance chronology.',
    ] };
}

/** Actual Cistern placement/reveal and next-turn A entry. Only the original
 * token placement lottery is selected; the parent is printed Gara Kulon8. */
export function createAdvisorDiscoveryRelocationFixture() {
  const base = createRelocationSetup('discovery'), { bg, holder, karama, steps } = base;
  let game = base.game;
  const act = (actor: string, action: Action) => { game = actAdvisorRelocation(game, actor, action, steps); };
  const reach = (until: (state: Game) => boolean) => { game = advanceAdvisorRelocation(game, until, steps); };
  const transition = (run: () => void): AdvisorRelocationTransition => {
    const before = structuredClone(game), start = steps.length; run();
    return { before, steps: structuredClone(steps.slice(start)), after: structuredClone(game) };
  };
  const spice = orderOriginalSpice(game, true), territory = cisternPlacement.territory;
  const location = `${territory}:${cisternPlacement.sector}`;
  assert.equal(advisorRelocationPlayer(game, bg).forces[location], 1);
  assert.ok(!advisorRelocationPlayer(game, bg).advisors?.[territory]);
  reach(state => state.phase === 1 && advisorRelocationClean(state));
  const beforeToken = structuredClone(game), tokenStart = steps.length;
  const eligible = game.discoveries!.tokens.filter(token => token.status === 'supply' && token.type === DISCOVERY_TOKEN_BY_ID.cistern.type);
  const selected = eligible.findIndex(token => token.face === 'cistern'); assert.ok(selected >= 0);
  const tokenScalar = Math.floor((selected + 0.5) * 4294967296 / eligible.length);
  for (let count = 0; !game.discoveries!.tokens.some(token => token.face === 'cistern' && token.status === 'placed') && count < 100; count++) {
    const next = nextAdvisorRelocation(game); assert.ok(next);
    const places = !game.response && !game.phaseOpening && !game.decision && next.action.type === 'ready' &&
      game.ready.length === game.players.length - 1;
    game = originalRelocationAction(game, next.actor, next.action, steps, places ? [tokenScalar] : []);
  }
  const token = game.discoveries!.tokens.find(candidate => candidate.face === 'cistern')!;
  assert.equal(token.status, 'placed'); assert.equal(token.territory, territory);
  const tokenPlacement: AdvisorRelocationTransition = {
    before: beforeToken, steps: structuredClone(steps.slice(tokenStart)), after: structuredClone(game),
  };
  reach(state => state.phase === 5 && state.active === bg && advisorRelocationClean(state));
  act(bg, { type: 'endMovement' });
  reach(state => state.phase === 5 && state.active === holder && advisorRelocationClean(state));
  const shipment = transition(() => {
    act(holder, { type: 'ship', territory, sector: cisternPlacement.sector, amount: 1, elite: 0, allyPayment: 0 });
    reach(state => !state.response && !state.phaseOpening && state.decision?.kind === 'intrusion');
  });
  const intrusion = transition(() => {
    act(bg, { type: 'decision', accept: true });
    reach(advisorRelocationClean);
  });
  assert.equal(advisorRelocationPlayer(shipment.before, holder).spice - advisorRelocationPlayer(game, holder).spice, 2);
  assert.equal(advisorRelocationPlayer(game, holder).forces[location], 1);
  assert.ok(advisorRelocationPlayer(game, bg).advisors?.[territory]);
  reach(state => state.turn === 1 && state.phase === 7 && advisorRelocationClean(state));
  assert.ok(viewGame(game, holder).discoveries!.canInspect.includes(token.id));
  const revelation = transition(() => {
    act(holder, { type: 'discovery', token: token.id, reveal: false });
    act(holder, { type: 'discovery', token: token.id, reveal: true });
  });
  reach(state => state.turn === 2 && state.phase === 0 && !state.response && !state.phaseOpening &&
    state.decision?.kind === 'discoveryEntry' && state.decision.player === holder);
  const action = discoveryEntryMoveAction(viewGame(game, holder), [{ source: location, normal: 1, elite: 0 }]);
  assert.ok(action); assert.ok(game.decision?.kind === 'discoveryEntry');
  const event = game.decision.event;
  assert.equal(advisorRelocationPlayer(game, holder).forces[location], 1);
  assert.equal(advisorRelocationPlayer(game, bg).forces[location], 1);
  assert.ok(advisorRelocationPlayer(game, bg).advisors?.[territory]);
  assert.ok(advisorRelocationPlayer(game, holder).hand.some(card => card.id === karama));
  assert.deepEqual(advisorRelocationInventory(game), base.originalInventory);
  return { ...base, ...spice, game, source: structuredClone(game), beforeAction: structuredClone(game),
    emperor: base.other, actor: holder, mover: holder, shipper: holder, kind: 'discovery' as const,
    event, token: token.id, tokenPlacement, tokenScalar, shipment, intrusion, revelation,
    territory, location, from: location, origin: territory, destination: 'cistern', destinationLocation: 'cistern:0', to: 'cistern:0', sector: 0, amount: 1,
    action, relocationStep: { actor: holder, action } satisfies AdvisorRelocationStep,
    sourceActionCount: steps.length, staging: [
      'Actual public Advanced BG/Atreides/Emperor lobby enables only Discoveries through moduleOption, then ready/startPreview and original base33 setup. Original prediction, private Traitors and actual advisorSetup place BG’s counter in empty printed Gara Kulon8, making it a native fighter.',
      'Only three original unopened Treachery positions, the original Hagga Basin Discovery Spice Card plus one ordinary Spice position, and the actual supply-token placement lottery are selected. That printed card places a real Cistern Hiereg in Gara Kulon8; no token identity, location or revealed turn is assigned.',
      'Native Storm/dual Spice/Charity/Bidding/Revival run. BG actually ends movement. Atreides pays two to ship one reserve beside BG at the parent; actual accepted Intrusion and allowed ordinary advisorFlip make BG peaceful, and separate Spiritual Advisors accompaniment is declined. No battle is manufactured.',
      'At real Collection, Atreides actually inspects and reveals Cistern. Remaining Collection/Mentat controls reach the original next-turn free Discovery entry. Stop before Atreides moves its sole parent counter into empty Cistern0, leaving BG’s original advisor behind.',
      'Discovery entry remains restricted to non-advisor sources; BG never uses an advisor-only free entry. No played force, wallet, hand, phase, stance, revealed identity, entry frame, relocation receipt or prevention is installed.',
    ] };
}
export type AdvisorRelocationFixture = ReturnType<typeof createAdvisorAmbassadorRelocationFixture> |
  ReturnType<typeof createAdvisorDiscoveryRelocationFixture>;

/** Commit only the real source action; the new conversion remains caller-owned. */
export function commitAdvisorRelocation(source: Game, fixture: AdvisorRelocationFixture,
  steps: AdvisorRelocationStep[] = []) {
  const before = structuredClone(source), start = steps.length;
  const game = actAdvisorRelocation(source, fixture.actor, fixture.action, steps);
  return { game, before, after: structuredClone(game), steps: structuredClone(steps.slice(start)) };
}
/** After the explicit counter, resume only the original parent. Discovery
 * stops when its entry round clears, before unrelated Storm readiness. */
export function finishAdvisorRelocation(source: Game, steps: AdvisorRelocationStep[] = []): Game {
  const discovery = source.phase === 0;
  return advanceAdvisorRelocation(source, game => discovery ? !game.discoveryEntry && !game.response?.automaticAdvisorFlip
    : !game.pendingAmbassador && advisorRelocationClean(game), steps);
}

export const createAdvisorAmbassadorFlipFixture = createAdvisorAmbassadorRelocationFixture;
export const createAdvisorDiscoveryFlipFixture = createAdvisorDiscoveryRelocationFixture;
export const actAdvisorRelocationFlip = actAdvisorRelocation;
export const advisorRelocationFlipPlayer = advisorRelocationPlayer;
export const advisorRelocationFlipInventory = advisorRelocationInventory;
export const passAdvisorRelocationFlip = passAdvisorRelocation;
export const finishAdvisorRelocationFlip = finishAdvisorRelocation;
export const commitAdvisorRelocationFlip = commitAdvisorRelocation;
