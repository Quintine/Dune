import assert from 'node:assert/strict';
import { applyAction, createGame, initializeNexusGameForAudit, joinGame, newPlayer,
  type Action, type Game, type Player } from '../game/engine';
import { treacheryDeck, type Card } from '../game/cards';
import { AMBASSADOR_EFFECTS, validateAmbassadors } from '../game/ecaz-ambassadors';
import { validateNexusCards } from '../game/nexus-cards';
import { nextE3NexusEcazStep } from './fixture-e3-nexus-ecaz';
import { withClassicDiscoveryNexusLottery } from './fixture-discovery-classic-nexus';

export type NexusEmperorAmbassadorStep = { actor: string; action: Action };
export type NexusEmperorAmbassadorTransition = {
  before: Game; step: NexusEmperorAmbassadorStep; after: Game;
};
export type NexusEmperorAmbassadorFixture = {
  game: Game; owner: string; buyer: string; entrant: string; event: string; token: string;
  card: Card; actions: NexusEmperorAmbassadorStep[];
  wallets: Record<string, number>;
  chronology: {
    initial: Game; undealt: Game; afterSetup: Game; firstMentat: NexusEmperorAmbassadorTransition;
    worm: Game; alliance: Game; draw: NexusEmperorAmbassadorTransition; afterClosingDraw: Game;
    placement: NexusEmperorAmbassadorTransition; beforeArrival: Game;
    arrival: NexusEmperorAmbassadorTransition; entry: Game; trigger: NexusEmperorAmbassadorTransition;
  };
};
export const nexusEmperorAmbassadorClean = (g: Game): boolean =>
  !g.response && !g.phaseOpening && !g.decision && !g.truthtrance && !g.pendingTreacheryDiscard;
export function nexusEmperorAmbassadorPlayer(g: Game, id: string): Player {
  const player = g.players.find(p => p.id === id); assert.ok(player); return player;
}
export function stepNexusEmperorAmbassador(g: Game, step: NexusEmperorAmbassadorStep,
  actions?: NexusEmperorAmbassadorStep[]): Game {
  actions?.push(structuredClone(step));
  return withClassicDiscoveryNexusLottery(() => applyAction(structuredClone(g), step.actor, structuredClone(step.action)));
}
export function nextNexusEmperorAmbassadorStep(g: Game): NexusEmperorAmbassadorStep {
  if (!g.response && !g.phaseOpening && g.decision?.kind === 'nexusEmperorAmbassadorPurchase')
    return { actor: g.decision.player,
      action: { type: 'nexusEmperorAmbassadorPurchase', event: g.decision.event, use: false } };
  const step = nextE3NexusEcazStep(g);
  assert.ok(step, `Original Ambassador chronology needs its owner at ${g.turn}/${g.phase}/${g.decision?.kind}`);
  return step;
}
export function advanceNexusEmperorAmbassador(g: Game, until: (g: Game) => boolean,
  actions?: NexusEmperorAmbassadorStep[]): Game {
  for (let n = 0; n < 2600; n++) {
    if (until(g)) return g;
    assert.notEqual(g.status, 'finished');
    g = stepNexusEmperorAmbassador(g, nextNexusEmperorAmbassadorStep(g), actions);
  }
  throw Error('Original Ambassador chronology did not reach its requested boundary');
}
function transition(g: Game, step: NexusEmperorAmbassadorStep,
  actions: NexusEmperorAmbassadorStep[]): NexusEmperorAmbassadorTransition {
  return { before: structuredClone(g), step: structuredClone(step),
    after: stepNexusEmperorAmbassador(g, step, actions) };
}
/** Original component shuffle only, while the five Ambassador tokens are undealt. */
function originalRicheseCohort<T>(operation: () => T): T {
  const source = AMBASSADOR_EFFECTS.filter(effect => effect !== 'ecaz');
  const desired = ['richese', ...source.filter(effect => effect !== 'richese')];
  const current: string[] = [...source], rolls: number[] = [];
  for (let i = current.length - 1; i > 0; i--) {
    const j = current.indexOf(desired[i]); assert.ok(j >= 0 && j <= i);
    rolls.push(Math.floor((j + 0.5) * 0x100000000 / (i + 1)));
    [current[i], current[j]] = [current[j], current[i]];
  }
  const descriptor = Object.getOwnPropertyDescriptor(crypto, 'getRandomValues');
  const native = crypto.getRandomValues.bind(crypto); let cursor = 0;
  crypto.getRandomValues = <V extends ArrayBufferView | null>(array: V): V => {
    if (array instanceof Uint32Array && array.length === 1) array[0] = rolls[cursor++] ?? 0xffffffff;
    else Reflect.apply(native, crypto, [array]);
    return array;
  };
  try { return operation(); }
  finally {
    if (descriptor) Object.defineProperty(crypto, 'getRandomValues', descriptor);
    else Reflect.deleteProperty(crypto, 'getRandomValues');
  }
}
/** Reorder only physical cards that have not yet left the original Spice deck. */
function originalBlow(g: Game, worm: boolean, land: string): void {
  const desired = [...(worm ? ['worm'] : []), land, ...(g.advanced ? ['other'] : [])];
  for (const [position, face] of desired.entries()) {
    const index = g.spiceDeck.findIndex((c, i) => i >= position && (face === 'worm'
      ? 'worm' in c && !c.greatMaker && !c.suppressed && !c.thumper
      : 'territory' in c && !c.discovery && (face === 'other'
        ? !['hagga_basin', 'red_chasm', 'rock_outcroppings'].includes(c.territory)
        : c.territory === face)));
    assert.ok(index >= position, `Original undealt Spice card ${face} must remain available`);
    g.spiceDeck.splice(position, 0, g.spiceDeck.splice(index, 1)[0]);
  }
}
export function nexusEmperorAmbassadorCards(g: Game): string[] {
  return [...g.deck, ...g.discard, ...g.players.flatMap(p => p.hand),
    ...(g.auction?.cards.slice(g.auction.index + Number(!!g.currentAuctionSale)) ?? [])]
    .map(c => c.id).sort();
}
export function nexusEmperorAmbassadorInventory(g: Game): void {
  validateNexusCards(g.nexusCards!.cards!, g.players); validateAmbassadors(g.ecazAmbassadors!);
  assert.deepEqual(nexusEmperorAmbassadorCards(g), treacheryDeck(['ecaz']).map(c => c.id).sort());
  for (const p of g.players) assert.equal(p.reserves + p.tanks +
    Object.values(p.forces).reduce((sum, amount) => sum + amount, 0), 20);
}
/** Original standalone Ecaz Nexus setup, actual other-seat pact and closing draw,
 * original paid placement, physical entry and committed Richese trigger. Only
 * undealt deck/token lotteries are selected. No played hand, wallet, alliance,
 * force, clock, receipt or control frame is installed by this producer. */
export function createNexusEmperorAmbassadorFixture(options: {
  advanced?: boolean; nexusCard?: 'emperor' | 'guild'; truthtrance?: boolean;
  arrival?: 'shipment' | 'worm'; buyer?: 'ecaz' | 'harkonnen';
} = {}): NexusEmperorAmbassadorFixture {
  const advanced = options.advanced ?? true, owner = 'ecaz', buyer = options.buyer ?? owner;
  assert.ok(buyer !== 'harkonnen' || options.arrival !== 'worm');
  const actions: NexusEmperorAmbassadorStep[] = [];
  let g = createGame('NEXUSEMPERORAMBASSADOR', newPlayer(owner, 'Ecaz', 'ecaz'), advanced, ['ecaz']);
  for (const faction of ['guild', 'fremen', ...(buyer === 'harkonnen' ? ['harkonnen' as const] : [])] as const)
    joinGame(g, newPlayer(faction, faction, faction));
  g.nexusCards = { cards: null, phase: null };
  const initial = structuredClone(g);
  for (const player of g.players)
    g = stepNexusEmperorAmbassador(g, { actor: player.id, action: { type: 'ready' } }, actions);
  g = withClassicDiscoveryNexusLottery(() => initializeNexusGameForAudit(g));
  assert.ok(g.players.every(p => !p.hand.length));
  const front: Card[] = [];
  for (const player of g.players) for (let n = 0; n < (player.faction === 'harkonnen' ? 2 : 1); n++) {
    const index = g.deck.findIndex(card => options.truthtrance && player.id === 'guild'
      ? card.effect === 'truthtrance' : card.kind === 'worthless' || card.kind === 'shield');
    assert.ok(index >= 0); front.push(g.deck.splice(index, 1)[0]);
  }
  g.deck.unshift(...front);
  const undealt = structuredClone(g);
  while (g.status === 'setup') {
    const step = nextNexusEmperorAmbassadorStep(g);
    if (step.action.type === 'fremenSetup')
      step.action.placements = { sietch_tabr: 0, false_wall_south: 10, false_wall_west: 0 };
    const lastTraitor = step.action.type === 'traitor' && g.players.filter(p => p.traitorChoices.length).length === 1;
    if (lastTraitor) {
      actions.push(structuredClone(step));
      g = originalRicheseCohort(() => applyAction(structuredClone(g), step.actor, step.action));
    } else g = stepNexusEmperorAmbassador(g, step, actions);
  }
  const afterSetup = structuredClone(g);
  assert.ok(g.ecazAmbassadors!.tokens.some(t => t.effect === 'richese' && t.zone === 'supply'));
  originalBlow(g, false, 'hagga_basin');
  let firstMentat: NexusEmperorAmbassadorTransition | undefined;
  while (g.turn === 1) {
    const t = transition(g, nextNexusEmperorAmbassadorStep(g), actions); g = t.after;
    if (g.turn === 2) firstMentat = t;
  }
  assert.ok(firstMentat);
  g = advanceNexusEmperorAmbassador(g, s => s.turn === 2 && s.phase === 1 && nexusEmperorAmbassadorClean(s), actions);
  originalBlow(g, true, 'rock_outcroppings');
  g = advanceNexusEmperorAmbassador(g, s => !!s.nexus && !s.spiceWindow && !s.spiceResolution && nexusEmperorAmbassadorClean(s), actions);
  const worm = structuredClone(g);
  for (const [actor, target] of [['guild', 'fremen'], ['fremen', 'guild']])
    g = stepNexusEmperorAmbassador(g, { actor, action: { type: 'alliance', target } }, actions);
  const alliance = structuredClone(g);
  g = advanceNexusEmperorAmbassador(g, s => s.nexusCards?.phase?.stage === 'drawing' && nexusEmperorAmbassadorClean(s), actions);
  const cards = g.nexusCards!.cards!, at = cards.deck.indexOf(options.nexusCard ?? 'emperor');
  assert.ok(at >= 0); cards.deck.unshift(cards.deck.splice(at, 1)[0]);
  const draw = transition(g, { actor: owner, action: { type: 'nexusCardChoice', turn: g.turn,
    card: cards.hands[owner], choice: 'draw', ownRedraws: 0 } }, actions); g = draw.after;
  g = advanceNexusEmperorAmbassador(g, s => s.nexusCards?.phase?.stage !== 'drawing' && nexusEmperorAmbassadorClean(s), actions);
  const afterClosingDraw = structuredClone(g);
  g = advanceNexusEmperorAmbassador(g, s => s.decision?.kind === 'ecazPlacement' && !s.response && !s.phaseOpening, actions);
  const token = g.ecazAmbassadors!.tokens.find(t => t.effect === 'richese')!.id;
  const placement = transition(g, { actor: owner, action: { type: 'decision', token, territory: 'arrakeen' } }, actions);
  g = advanceNexusEmperorAmbassador(placement.after, s => s.phase === 5 && nexusEmperorAmbassadorClean(s), actions);
  assert.equal(g.ecazAmbassadors!.tokens.find(t => t.id === token)!.location, 'arrakeen');
  if (options.arrival === 'worm') {
    g = advanceNexusEmperorAmbassador(g, s => s.turn === 2 && s.phase === 5 &&
      s.active === 'fremen' && nexusEmperorAmbassadorClean(s), actions);
    g = stepNexusEmperorAmbassador(g, { actor: 'fremen',
      action: { type: 'ship', territory: 'rock_outcroppings', sector: 13, amount: 1 } }, actions);
    g = stepNexusEmperorAmbassador(g, { actor: 'fremen', action: { type: 'endMovement' } }, actions);
  }
  if (options.arrival === 'worm' || buyer === 'harkonnen') {
    g = advanceNexusEmperorAmbassador(g, s => s.turn === 3 && s.phase === 1 && nexusEmperorAmbassadorClean(s), actions);
    originalBlow(g, true, 'red_chasm');
  }
  if (buyer === 'harkonnen') {
    g = advanceNexusEmperorAmbassador(g, s => !!s.nexus && !s.spiceWindow && !s.spiceResolution && nexusEmperorAmbassadorClean(s), actions);
    for (const [actor, target] of [[owner, buyer], [buyer, owner]])
      g = stepNexusEmperorAmbassador(g, { actor, action: { type: 'alliance', target } }, actions);
  }
  const entrant = options.arrival === 'worm' ? 'fremen' : 'guild';
  let arrivalStep: NexusEmperorAmbassadorStep;
  if (options.arrival === 'worm') {
    g = advanceNexusEmperorAmbassador(g, s => s.decision?.kind === 'wormRide' && !s.response && !s.phaseOpening, actions);
    assert.ok(g.decision?.kind === 'wormRide');
    assert.equal(g.decision!.territory, 'rock_outcroppings');
    const source = Object.keys(nexusEmperorAmbassadorPlayer(g, entrant).forces).find(key => key.startsWith('rock_outcroppings:'));
    assert.ok(source);
    arrivalStep = { actor: entrant, action: { type: 'decision', accept: true,
      territory: 'arrakeen', sector: 10, forces: { [source]: 1 } } };
  } else {
    g = advanceNexusEmperorAmbassador(g, s => s.phase === 5 && s.active === entrant && nexusEmperorAmbassadorClean(s), actions);
    arrivalStep = { actor: entrant, action: { type: 'ship', territory: 'arrakeen', sector: 10, amount: 1 } };
  }
  const beforeArrival = structuredClone(g), arrival = transition(g, arrivalStep, actions); g = arrival.after;
  g = advanceNexusEmperorAmbassador(g, s => !!s.pendingAmbassador && !s.response && !s.phaseOpening, actions);
  const entry = structuredClone(g);
  assert.equal(g.pendingAmbassador!.stage, 'offer');
  const trigger = transition(g, { actor: owner, action: { type: 'decision',
    event: g.pendingAmbassador!.event, trigger: true, beneficiary: buyer } }, actions); g = trigger.after;
  assert.ok(g.decision?.kind === 'nexusEmperorAmbassadorPurchase');
  assert.equal(g.decision!.player, buyer);
  const event = g.decision!.event, card = g.deck[0]; assert.ok(card);
  nexusEmperorAmbassadorInventory(g);
  return { game: g, owner, buyer, entrant, event, token, card, actions,
    wallets: Object.fromEntries(g.players.map(p => [p.id, p.spice])),
    chronology: { initial, undealt, afterSetup, firstMentat, worm, alliance, draw,
      afterClosingDraw, placement, beforeArrival, arrival, entry, trigger } };
}
/** Deterministic source successor: finish only the original purchase's response
 * children. Its actual movement/worm suffix is left for the caller to observe. */
export function finishNexusEmperorAmbassador(g: Game): Game {
  return advanceNexusEmperorAmbassador(g, s => !s.pendingAmbassador && !s.response && !s.truthtrance);
}
