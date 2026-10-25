import assert from 'node:assert/strict';
import {
  applyAction, createGame, initializeSemutaGameForAudit, joinGame, newPlayer, type Action, type Game,
} from '../game/engine';
import { isAdvisor } from '../game/advisors';
import { AMBASSADOR_EFFECTS, type AmbassadorEffect } from '../game/ecaz-ambassadors';
import { SEMUTA_DRUG_ID } from '../game/semuta-drug';
import { withClassicDiscoveryNexusLottery } from './fixture-discovery-classic-nexus';
import {
  actSemutaSpiritualCost, passSemutaSpiritualCost, claimSemutaSpiritualCost, allowSemutaSpiritualCost,
  semutaSpiritualCostPlayer, semutaSpiritualCostInventory, semutaSpiritualCostPhysical,
} from './fixture-semuta-spiritual-cost';
import { nextSemutaRicheseCacheKarama } from './fixture-semuta-richese-cache-karama';

export type SemutaSpiritualAmbassadorCostStage = 'shipping' | 'matching';
export type SemutaSpiritualAmbassadorCostStep = { actor: string; action: Action };
export const actSemutaSpiritualAmbassadorCost = actSemutaSpiritualCost;
export const passSemutaSpiritualAmbassadorCost = passSemutaSpiritualCost;
export const claimSemutaSpiritualAmbassadorCost = claimSemutaSpiritualCost;
export const allowSemutaSpiritualAmbassadorCost = allowSemutaSpiritualCost;
export const semutaSpiritualAmbassadorCostPlayer = semutaSpiritualCostPlayer;
export const semutaSpiritualAmbassadorCostInventory = semutaSpiritualCostInventory;
export const semutaSpiritualAmbassadorCostPhysical = semutaSpiritualCostPhysical;
export const semutaSpiritualAmbassadorCostClean = (game: Game) => !game.response && !game.phaseOpening &&
  !game.decision && !game.truthtrance && !game.pendingTreacheryDiscard && !game.pendingSpiritualAdvisor &&
  !game.pendingAmbassador && !game.pendingArrivalReaction?.length;

/** Keep actual Ambassador grants and Spiritual choices explicit. The earlier
 * ordinary Carthag accompaniment is separately declined by its owned source. */
export function nextSemutaSpiritualAmbassadorCost(game: Game): SemutaSpiritualAmbassadorCostStep | null {
  if (game.pendingTreacheryDiscard || game.truthtrance || game.pendingSpiritualAdvisor ||
    game.response?.spiritualAdvisorSource || game.response?.automaticAdvisorFlip) return null;
  if (!game.response && !game.phaseOpening) {
    const bg = game.players.find(player => player.faction === 'beneGesserit'); assert.ok(bg);
    const ecaz = game.players.find(player => player.faction === 'ecaz'); assert.ok(ecaz);
    if (game.status === 'setup' && game.setupStage === 'prediction')
      return { actor: bg.id, action: { type: 'predict', faction: 'atreides', turn: 10 } };
    if (game.status === 'setup' && game.setupStage === 'forces' && ecaz.reserves === 20)
      return { actor: ecaz.id, action: { type: 'ecazSetup', placements: { 'imperial_basin:10': 6 } } };
    const decision = game.decision;
    if (decision?.kind === 'advisor' || decision?.kind === 'intrusion' ||
      decision?.kind === 'ecazPlacement' || decision?.kind === 'ecazAmbassador') return null;
    if (decision?.kind === 'advisorBattle')
      return { actor: decision.player, action: { type: 'decision', accept: false } };
    if (game.status === 'setup' && game.setupStage === 'forces' && !bg.advisorSetup)
      return { actor: bg.id, action: { type: 'advisorSetup', territory: 'arrakeen', sector: 10 } };
  }
  return nextSemutaRicheseCacheKarama(game);
}
export function advanceSemutaSpiritualAmbassadorCost(game: Game, until: (state: Game) => boolean,
  actions: SemutaSpiritualAmbassadorCostStep[] = []): Game {
  for (let count = 0; count < 1800; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished');
    const step = nextSemutaSpiritualAmbassadorCost(game);
    assert.ok(step, 'Choose the original Ambassador, Spiritual or fresh-cost control before continuing');
    game = actSemutaSpiritualAmbassadorCost(game, step.actor, step.action, actions);
  }
  throw Error('The original Guild Ambassador Spiritual programme did not reach its finite boundary');
}
/** Matching prevention restores the real chooser. Otherwise finish only the
 * original Guild parent, leaving the same native entrant turn active. */
export function finishSemutaSpiritualAmbassadorCost(game: Game,
  actions: SemutaSpiritualAmbassadorCostStep[] = []): Game {
  assert.equal(game.pendingTreacheryDiscard ?? null, null, 'Choose the original fresh cost first');
  return advanceSemutaSpiritualAmbassadorCost(game, state => semutaSpiritualAmbassadorCostClean(state) ||
    (!state.response && !state.phaseOpening && state.decision?.kind === 'advisor' &&
      state.pendingSpiritualAdvisor?.stage === 'offer'), actions);
}

function originalGuildPacket() {
  const original = AMBASSADOR_EFFECTS.filter(effect => effect !== 'ecaz');
  const supply: Exclude<AmbassadorEffect, 'ecaz'>[] = ['guild', ...original.filter(effect => effect !== 'guild').slice(0, 4)];
  const order = [...supply, ...original.filter(effect => !supply.includes(effect))];
  const current = [...original], scalars: number[] = [];
  for (let index = current.length - 1; index > 0; index--) {
    const from = current.indexOf(order[index]); assert.ok(from >= 0 && from <= index);
    scalars.push(Math.floor((from + 0.5) * 4294967296 / (index + 1)));
    [current[index], current[from]] = [current[from], current[index]];
  }
  assert.deepEqual(current, order); assert.equal(scalars.length, 9); return { supply, order, scalars };
}
function createOriginalPacket(game: Game, step: SemutaSpiritualAmbassadorCostStep,
  actions: SemutaSpiritualAmbassadorCostStep[], scalars: readonly number[]): Game {
  const descriptor = Object.getOwnPropertyDescriptor(crypto, 'getRandomValues');
  const original = crypto.getRandomValues.bind(crypto); let cursor = 0;
  crypto.getRandomValues = <V extends ArrayBufferView | null>(array: V): V => {
    if (array instanceof Uint32Array && array.length === 1)
      array[0] = cursor < scalars.length ? scalars[cursor++] : 0xffffffff;
    else Reflect.apply(original, crypto, [array]);
    return array;
  };
  try {
    const after = applyAction(game, step.actor, step.action);
    assert.equal(cursor, scalars.length, 'The original Ecaz packet consumes its nine selected native draws');
    actions.push(structuredClone(step)); return after;
  } finally {
    if (descriptor) Object.defineProperty(crypto, 'getRandomValues', descriptor);
    else Reflect.deleteProperty(crypto, 'getRandomValues');
  }
}

/** Real Advanced narrow Ecaz Semuta setup, paid token and entrant, then an
 * actual free Guild child shipment. No played card, counter, stance, wallet,
 * clock, token, grant, receipt or control is assigned. */
export function createSemutaSpiritualAmbassadorCostFixture(options: {
  stage?: SemutaSpiritualAmbassadorCostStage;
} = {}) {
  const stage = options.stage ?? 'shipping', richese = 'richese', holder = 'choam', ecaz = 'ecaz',
    owner = 'beneGesserit', spender = 'atreides', entrant = spender, shipper = ecaz;
  const territory = stage === 'shipping' ? 'arrakeen' : 'polar_sink', sector = stage === 'shipping' ? 10 : 0;
  const location = `${territory}:${sector}`, foreignDestination = stage === 'shipping' ? 'arrakeen' : 'tueks_sietch';
  const foreignSector = stage === 'shipping' ? 10 : 5, foreignLocation = `${foreignDestination}:${foreignSector}`;
  let game = createGame('SEMUTASPIRITUALAMBASSADORCOST', newPlayer(richese, 'Richese', 'richese'), true, ['choam', 'ecaz']);
  for (const faction of [holder, ecaz, owner, spender] as const)
    joinGame(game, newPlayer(faction, faction, faction));
  const initial = structuredClone(game), actions: SemutaSpiritualAmbassadorCostStep[] = [];
  const act = (actor: string, action: Action) => { game = actSemutaSpiritualAmbassadorCost(game, actor, action, actions); };
  const reach = (until: (state: Game) => boolean) => { game = advanceSemutaSpiritualAmbassadorCost(game, until, actions); };
  const transition = (run: () => void) => {
    const before = structuredClone(game), start = actions.length; run();
    return { before, steps: structuredClone(actions.slice(start)), after: structuredClone(game) };
  };
  for (const player of game.players) act(player.id, { type: 'ready' });
  const lobby = structuredClone(game);
  game = withClassicDiscoveryNexusLottery(() => initializeSemutaGameForAudit(game));
  const setup = structuredClone(game), initialization = { before: lobby, after: setup,
    entry: 'original-undealt-bare-advanced-ecaz-semuta' };
  assert.equal(game.status, 'setup'); assert.equal(game.advanced, true); assert.equal(game.semutaPreview, true);
  assert.deepEqual(game.expansions, ['choam', 'ecaz']); assert.ok(game.players.every(player => !player.hand.length));
  assert.ok(!game.homeworlds && !game.nexusCards && !game.leaderSkills && !game.techTokens &&
    !game.strongholdCards && !game.discoveryEnabled && !game.ecazTreachery);
  const originalInventory = semutaSpiritualAmbassadorCostInventory(game);
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
  const beforeStartingDeal = structuredClone(game), packet = originalGuildPacket();
  let packetCreation: ReturnType<typeof transition> | null = null, advisorSetup: ReturnType<typeof transition> | null = null;
  for (let count = 0; game.status === 'setup' && count < 120; count++) {
    const step = nextSemutaSpiritualAmbassadorCost(game); assert.ok(step);
    if (step.action.type === 'advisorSetup') step.action = { type: 'advisorSetup', territory, sector };
    const before = structuredClone(game), start = actions.length;
    const createsPacket = game.setupStage === 'traitors' && step.action.type === 'traitor' &&
      game.players.filter(player => player.traitorChoices.length).length === 1;
    game = createsPacket ? createOriginalPacket(game, step, actions, packet.scalars)
      : actSemutaSpiritualAmbassadorCost(game, step.actor, step.action, actions);
    const record = { before, steps: structuredClone(actions.slice(start)), after: structuredClone(game) };
    if (createsPacket) packetCreation = record;
    if (step.action.type === 'advisorSetup') advisorSetup = record;
  }
  assert.equal(game.status, 'playing'); assert.ok(packetCreation && advisorSetup);
  const afterSetup = structuredClone(game);
  assert.deepEqual(game.players.flatMap(player => player.hand.map(card => card.id)), selected.map(card => card.id));
  assert.equal(semutaSpiritualAmbassadorCostPlayer(game, owner).forces[location], 1);
  assert.equal(isAdvisor(semutaSpiritualAmbassadorCostPlayer(game, owner), territory), stage === 'shipping');
  assert.ok(semutaSpiritualAmbassadorCostPlayer(game, spender).hand.some(card => card.id === cost));
  assert.deepEqual(game.ecazAmbassadors!.cohort.map(id => game.ecazAmbassadors!.tokens.find(token => token.id === id)!.effect), packet.supply);
  const originalSpice = game.spiceDeck.map(card => JSON.stringify(card)).sort();
  const spiceOrder = [0, 1].map(position => {
    const from = game.spiceDeck.findIndex((card, index) => index >= position && 'territory' in card && !card.discovery);
    assert.ok(from >= position); const card = game.spiceDeck.splice(from, 1)[0];
    game.spiceDeck.splice(position, 0, card); return { position, from, card: structuredClone(card) };
  });
  assert.deepEqual(game.spiceDeck.map(card => JSON.stringify(card)).sort(), originalSpice);
  let beforeBid: Game | undefined, bid: SemutaSpiritualAmbassadorCostStep | undefined, bidAt = -1;
  for (let count = 0; count < 900 && !semutaSpiritualAmbassadorCostPlayer(game, holder).hand.some(card => card.id === SEMUTA_DRUG_ID); count++) {
    const step = nextSemutaSpiritualAmbassadorCost(game); assert.ok(step);
    if (step.actor === holder && step.action.type === 'richeseBid' && step.action.amount === 1) {
      beforeBid = structuredClone(game); bid = structuredClone(step); bidAt = actions.length;
    }
    act(step.actor, step.action);
  }
  assert.ok(beforeBid && bid && bidAt >= 0, 'CHOAM really buys the original cache Semuta for one spice');
  const acquired = structuredClone(game), acquisition = { before: beforeBid, bid,
    steps: structuredClone(actions.slice(bidAt)), after: acquired, price: 1 };
  assert.equal(semutaSpiritualAmbassadorCostPlayer(beforeBid, holder).spice - semutaSpiritualAmbassadorCostPlayer(game, holder).spice, 1);
  assert.equal(semutaSpiritualAmbassadorCostPlayer(game, richese).spice - semutaSpiritualAmbassadorCostPlayer(beforeBid, richese).spice, 1);
  reach(state => state.phase === 4 && !state.response && !state.phaseOpening && state.decision?.kind === 'ecazPlacement');
  const guild = game.ecazAmbassadors!.tokens.find(token => token.effect === 'guild'); assert.ok(guild);
  assert.equal(guild.zone, 'supply'); const token = guild.id;
  const placement = transition(() => {
    act(ecaz, { type: 'decision', token, territory: 'carthag' });
    reach(state => !state.response && !state.phaseOpening && state.decision?.kind === 'ecazPlacement');
  });
  assert.equal(semutaSpiritualAmbassadorCostPlayer(placement.before, ecaz).spice - semutaSpiritualAmbassadorCostPlayer(game, ecaz).spice, 1);
  act(ecaz, { type: 'decision', decline: true });
  reach(state => state.phase === 5 && state.active === owner && semutaSpiritualAmbassadorCostClean(state));
  const bgTurn = transition(() => {
    act(owner, { type: 'endMovement' });
    reach(state => state.phase === 5 && state.active === entrant && semutaSpiritualAmbassadorCostClean(state));
  });
  const paidShipmentAction: Action = { type: 'ship', territory: 'carthag', sector: 11, amount: 1, elite: 0, allyPayment: 0 };
  const earlierAccompaniment: SemutaSpiritualAmbassadorCostStep[] = [];
  const paidEntry = transition(() => {
    act(entrant, paidShipmentAction);
    for (let count = 0; !(game.pendingAmbassador?.stage === 'offer' && !game.response && !game.phaseOpening) && count < 150; count++) {
      if (!game.response && !game.phaseOpening && game.decision?.kind === 'advisor') {
        const step: SemutaSpiritualAmbassadorCostStep = { actor: owner, action: { type: 'decision', accept: false } };
        earlierAccompaniment.push(structuredClone(step)); act(step.actor, step.action);
      } else {
        const step = nextSemutaSpiritualAmbassadorCost(game); assert.ok(step, 'Complete only the original paid Carthag entry');
        act(step.actor, step.action);
      }
    }
    assert.equal(game.pendingAmbassador?.stage, 'offer');
  });
  assert.equal(semutaSpiritualAmbassadorCostPlayer(paidEntry.before, entrant).spice - semutaSpiritualAmbassadorCostPlayer(game, entrant).spice, 1);
  const offer = structuredClone(game), event = game.pendingAmbassador!.event;
  const trigger = transition(() => {
    act(ecaz, { type: 'decision', event, trigger: true, beneficiary: ecaz });
    reach(state => !state.response && !state.phaseOpening && state.pendingAmbassador?.stage === 'ship');
  });
  const foreignShipmentAction: Action = { type: 'decision', event, territory: foreignDestination,
    sector: foreignSector, amount: 1, elite: 0 };
  const foreignShipment = transition(() => {
    act(shipper, foreignShipmentAction);
    reach(state => !state.response && !state.phaseOpening && state.decision?.kind === 'advisor');
  });
  assert.equal(semutaSpiritualAmbassadorCostPlayer(foreignShipment.before, shipper).spice,
    semutaSpiritualAmbassadorCostPlayer(game, shipper).spice);
  assert.equal(semutaSpiritualAmbassadorCostPlayer(foreignShipment.before, shipper).reserves -
    semutaSpiritualAmbassadorCostPlayer(game, shipper).reserves, 1);
  assert.equal(semutaSpiritualAmbassadorCostPlayer(game, shipper).forces[foreignLocation], 1);
  assert.equal(semutaSpiritualAmbassadorCostPlayer(game, shipper).shipped,
    semutaSpiritualAmbassadorCostPlayer(foreignShipment.before, shipper).shipped);
  assert.ok(game.decision?.kind === 'advisor'); assert.equal(game.decision.player, owner);
  assert.equal(game.decision.shipment, shipper); assert.equal(game.decision.destination, foreignLocation);
  assert.equal(game.decision.ambassadorEvent, event);
  assert.equal(game.pendingAmbassador?.shipmentReceipt?.next, 'advisor');
  const beforeDeclaration = structuredClone(game), originalChooser = structuredClone(game.decision);
  const accompany: Action = { type: 'decision', accept: true, accompany: true, amount: 1 };
  const sink: Action = { type: 'decision', accept: true, accompany: false, amount: 1 };
  const decline: Action = { type: 'decision', accept: false }, nativeAction = stage === 'shipping' ? accompany : sink;
  const declaration = transition(() => { act(owner, nativeAction); });
  assert.equal(game.response?.kind, 'advisor'); assert.ok(game.response?.spiritualAdvisorSource);
  assert.equal(game.pendingSpiritualAdvisor?.stage, 'shipping');
  const shipping = structuredClone(game), shippingAllowance = stage === 'matching'
    ? transition(() => { game = allowSemutaSpiritualAmbassadorCost(game, actions); }) : null;
  assert.equal(game.response?.kind, stage === 'shipping' ? 'advisor' : 'advisorFlip');
  assert.equal(game.pendingSpiritualAdvisor?.stage, stage);
  assert.ok(game.response?.spiritualAdvisorSource && game.pendingSpiritualAdvisor && game.pendingAmbassador);
  assert.deepEqual(semutaSpiritualAmbassadorCostPhysical(game), semutaSpiritualAmbassadorCostPhysical(beforeDeclaration));
  const source = structuredClone(game), originalResponse = structuredClone(game.response),
    originalFrame = structuredClone(game.pendingSpiritualAdvisor), originalSource = structuredClone(game.response.spiritualAdvisorSource),
    originalAmbassador = structuredClone(game.pendingAmbassador);
  const action: Action = { type: 'card', card: cost, mode: 'cancel' };
  assert.ok(semutaSpiritualAmbassadorCostPlayer(game, holder).hand.some(card => card.id === SEMUTA_DRUG_ID));
  assert.ok(semutaSpiritualAmbassadorCostPlayer(game, spender).hand.some(card => card.id === cost));
  assert.deepEqual(semutaSpiritualAmbassadorCostInventory(game), originalInventory);
  return { game, source, beforeCost: source, stage, kind: originalResponse.kind, advanced: true as const,
    richese, seller: richese, holder, ecaz, owner, bg: owner, spender, atreides: spender, entrant, shipper, actor: owner,
    cost, karama: cost, semuta: SEMUTA_DRUG_ID, action, nativeAction, accompany, sink, decline,
    replacementAction: stage === 'matching' ? accompany : null,
    territory, sector, location, foreignDestination, foreignSector, foreignLocation,
    event, parentEvent: event, token, paidShipmentAction, foreignShipmentAction,
    originalFrame, originalParent: originalFrame, originalSource, originalResponse, originalChooser, originalAmbassador,
    originalQueue: structuredClone(game.pendingArrivalReaction ?? null),
    originalForeignReceipt: structuredClone(originalAmbassador.shipmentReceipt!),
    originalToken: structuredClone(game.ecazAmbassadors!.tokens.find(candidate => candidate.id === token)!),
    originalPhysical: structuredClone(semutaSpiritualAmbassadorCostPhysical(game)), originalHistory: structuredClone(game.log),
    initial, lobby, setup, initialization, beforeStartingDeal, afterSetup, advisorSetup, packet, packetCreation,
    deal: selected.map(card => card.id), dealOrder, spiceOrder, originalSpice, originalInventory,
    acquired, acquisition, placement, bgTurn, paidEntry, earlierAccompaniment, offer, trigger, foreignShipment,
    entryCost: 1, placementCost: 1, foreignCost: 0, beforeDeclaration, declaration, shipping, shippingAllowance,
    actions, sourceActions: actions, sourceActionCount: actions.length,
    staging: [
      'Original narrow Advanced Ecaz Semuta initializer on the ready undealt R/C/Ecaz/BG/A exact-CHOAM+Ecaz lobby, without optional modules or a new profile gate. Only unopened card/Spice order and actual scalar lotteries are selected.',
      'The final real Traitor choice consumes nine original packet draws earning Guild supply. Actual Ecaz setup keeps six in Basin10; BG really places its advisor at occupied Arrakeen10 for shipping or its fighter at empty Polar0 for matching. A is originally dealt printed Karama; C really buys original cache Semuta for one.',
      'Native first Storm, dual Spice, Charity, Bidding and Revival execute. Ecaz pays one to place Guild at Carthag; BG ends its real turn; A pays one to enter Carthag and any earlier ordinary Spiritual accompaniment is actually declined.',
      'Ecaz triggers the actual token for itself, then really ships one native reserve free through Guild to Arrakeen10 for shipping or empty Tueks5 for matching. The physical free entrant, token use, original A payment and Guild receipt are already committed before BG declares its independent packet.',
      stage === 'shipping'
        ? 'BG selects actual accompaniment beside its original Arrakeen advisor. Stop at the new explicit Spiritual shipping response before withdrawal; no matching or alone conversion is needed beside Ecazs committed foreign force.'
        : 'BG selects the actual Polar fallback beside its original fighter and really allows shipping. Stop at the separate matching counter before withdrawal. Prevention restores the original chooser; real accompaniment at Tueks remains legal because that is a different destination beside Ecazs committed foreign force.',
      'No played hand, force, stance, wallet, clock, token, parent, grant or own Semuta window is installed. Finish only the exact Guild Ambassador child and retain the original native entrant turn; no future battle, shipment or movement is invented.',
    ],
  };
}
export type SemutaSpiritualAmbassadorCostFixture = ReturnType<typeof createSemutaSpiritualAmbassadorCostFixture>;
