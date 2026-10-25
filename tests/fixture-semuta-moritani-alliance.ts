import assert from 'node:assert/strict';
import { createGame, joinGame, newPlayer, type Action, type Game } from '../game/engine';
import { territory as boardTerritory } from '../game/board';
import { reserveShipmentCost } from '../game/shipment-price';
import { SEMUTA_DRUG_ID } from '../game/semuta-drug';
import {
  actSemutaCombatCapabilities, nextSemutaCombatCapabilities,
  semutaCombatCapabilitiesPlayer, semutaCombatCapabilitiesInventory, semutaCombatCapabilitiesClean,
  passSemutaCombatCapabilities, claimSemutaCombatCapabilities,
} from './fixture-semuta-combat-capabilities';

export type SemutaMoritaniAllianceStep = { actor: string; action: Action };
export const actSemutaMoritaniAlliance = actSemutaCombatCapabilities;
export const semutaMoritaniAlliancePlayer = semutaCombatCapabilitiesPlayer;
export const semutaMoritaniAllianceInventory = semutaCombatCapabilitiesInventory;
export const semutaMoritaniAllianceClean = semutaCombatCapabilitiesClean;
export const passSemutaMoritaniAlliance = passSemutaCombatCapabilities;
export const claimSemutaMoritaniAlliance = claimSemutaCombatCapabilities;

/** Placement, Terror revelation and the entrant's owned group remain explicit
 * caller actions; other controls finish only through real native choices. */
export function nextSemutaMoritaniAlliance(game: Game): SemutaMoritaniAllianceStep | null {
  if (!game.response && !game.phaseOpening &&
    (game.decision?.kind === 'moritaniPlacement' || game.decision?.kind === 'moritaniTerror')) return null;
  return nextSemutaCombatCapabilities(game);
}
export const nextSemutaMoritaniAllianceStep = nextSemutaMoritaniAlliance;
export function advanceSemutaMoritaniAlliance(game: Game, until: (state: Game) => boolean,
  actions: SemutaMoritaniAllianceStep[] = []): Game {
  for (let count = 0; count < 2400; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished');
    const next = nextSemutaMoritaniAlliance(game);
    assert.ok(next, `Supply the native Moritani placement/entry choice at ${game.turn}/${game.phase}/${game.decision?.kind}`);
    game = actSemutaMoritaniAlliance(game, next.actor, next.action, actions);
  }
  throw Error('The native Enemy of My Enemy programme did not reach its finite boundary');
}
export function allowSemutaMoritaniAlliance(game: Game, actions: SemutaMoritaniAllianceStep[] = []): Game {
  assert.equal(game.response?.kind, 'moritaniAlliance');
  for (let count = 0; game.response?.kind === 'moritaniAlliance' && count < game.players.length; count++) {
    const actor = game.players.find(p => !game.response!.passed.includes(p.id)); assert.ok(actor);
    game = actSemutaMoritaniAlliance(game, actor.id, { type: 'passResponse' }, actions);
  }
  assert.notEqual(game.response?.kind, 'moritaniAlliance'); return game;
}
/** Cancellation restores the original hidden-token chooser. Leave that actual
 * revelation/decline, or an allowed offer's entrant reply, to the caller. */
export function finishSemutaMoritaniAlliance(game: Game, actions: SemutaMoritaniAllianceStep[] = []): Game {
  assert.ok(!game.pendingTreacheryDiscard);
  return advanceSemutaMoritaniAlliance(game, state => !state.response && !state.phaseOpening &&
    state.decision?.kind === 'moritaniTerror', actions);
}

/** Original public Basic R/C/M/E/G setup, paid cache1, real turn1 Mentat
 * Robbery placement and committed turn2 entry. No played state is installed. */
export function createSemutaMoritaniAllianceFixture(options: { entry?: 'shipment' | 'movement' } = {}) {
  const entryKind = options.entry ?? 'shipment';
  const richese = 'richese', holder = 'choam', owner = 'moritani', entrant = 'emperor', spender = 'guild';
  const territory = 'arrakeen', sector = 10, location = `${territory}:${sector}`, origin = 'imperial_basin:10';
  let game = createGame('SEMUTAMORITANIALLIANCE', newPlayer(richese, 'Richese', 'richese'), false, ['choam', 'ecaz']);
  for (const faction of ['choam', 'moritani', 'emperor', 'guild'] as const)
    joinGame(game, newPlayer(faction, faction, faction));
  const initial = structuredClone(game), actions: SemutaMoritaniAllianceStep[] = [];
  const act = (actor: string, action: Action) => { game = actSemutaMoritaniAlliance(game, actor, action, actions); };
  const reach = (until: (state: Game) => boolean) => { game = advanceSemutaMoritaniAlliance(game, until, actions); };
  const transition = (run: () => void) => {
    const before = structuredClone(game), at = actions.length; run();
    return { before, steps: structuredClone(actions.slice(at)), after: structuredClone(game) };
  };
  for (const p of game.players) act(p.id, { type: 'ready' });
  const lobby = structuredClone(game); act(game.host, { type: 'start' });
  const setup = structuredClone(game);
  assert.equal(game.status, 'setup'); assert.equal(game.advanced, false); assert.equal(game.semutaPreview, true);
  assert.ok(game.players.every(p => p.hand.length === 0));
  assert.ok(!game.homeworlds && !game.nexusCards && !game.leaderSkills && !game.techTokens &&
    !game.strongholdCards && !game.discoveryEnabled && !game.ecazTreachery);
  const originalInventory = semutaMoritaniAllianceInventory(game); assert.equal(originalInventory.length, 45);
  const printed = game.deck.find(card => card.effect === 'karama'); assert.ok(printed);
  const ordinary = game.deck.filter(card => card.kind === 'projectile' || card.kind === 'poison').slice(0, 4);
  assert.equal(ordinary.length, 4);
  const selected = [...ordinary, printed];
  const dealOrder = selected.map((card, position) => {
    const from = game.deck.findIndex(candidate => candidate.id === card.id); assert.ok(from >= position);
    [game.deck[position], game.deck[from]] = [game.deck[from], game.deck[position]];
    return { card: card.id, position, from };
  });
  const beforeStartingDeal = structuredClone(game), cost = printed.id;
  reach(state => state.status === 'playing'); const afterSetup = structuredClone(game);
  assert.deepEqual(game.players.flatMap(p => p.hand.map(card => card.id)), selected.map(card => card.id));
  assert.ok(semutaMoritaniAlliancePlayer(game, spender).hand.some(card => card.id === cost));
  assert.equal(semutaMoritaniAlliancePlayer(game, owner).forces['oh_gap:9'], 6);
  const originalSpice = game.spiceDeck.map(card => JSON.stringify(card)).sort();
  const spiceOrder = [0, 1, 2, 3].map(position => {
    const from = game.spiceDeck.findIndex((card, index) => index >= position && 'territory' in card &&
      !card.discovery && !['oh_gap', 'arrakeen', 'imperial_basin', 'tueks_sietch'].includes(card.territory));
    assert.ok(from >= position);
    const card = game.spiceDeck.splice(from, 1)[0]; game.spiceDeck.splice(position, 0, card);
    return { position, from, card: structuredClone(card) };
  });
  assert.deepEqual(game.spiceDeck.map(card => JSON.stringify(card)).sort(), originalSpice);
  let beforeBid: Game | undefined, bid: SemutaMoritaniAllianceStep | undefined, bidAt = -1;
  for (let count = 0; count < 1000 && !semutaMoritaniAlliancePlayer(game, holder).hand.some(card => card.id === SEMUTA_DRUG_ID); count++) {
    const next = nextSemutaMoritaniAlliance(game); assert.ok(next);
    if (next.actor === holder && next.action.type === 'richeseBid' && next.action.amount === 1) {
      beforeBid = structuredClone(game); bid = structuredClone(next); bidAt = actions.length;
    }
    act(next.actor, next.action);
  }
  assert.ok(beforeBid && bid && bidAt >= 0);
  const acquired = structuredClone(game), acquisition = { before: beforeBid, bid,
    steps: structuredClone(actions.slice(bidAt)), after: acquired, price: 1 };
  assert.equal(semutaMoritaniAlliancePlayer(beforeBid, holder).spice - semutaMoritaniAlliancePlayer(game, holder).spice, 1);
  reach(state => state.turn === 1 && state.phase === 8 && !state.response && !state.phaseOpening &&
    state.decision?.kind === 'moritaniPlacement');
  const robbery = game.moritaniTerror!.tokens.find(token => token.kind === 'robbery' && token.status === 'available');
  assert.ok(robbery); const token = robbery.id;
  const placementAction: Action = { type: 'decision', token, territory };
  const placement = transition(() => {
    act(owner, placementAction);
    reach(state => !state.response && state.moritaniTerror!.tokens.some(row => row.id === token && row.status === 'placed'));
  });
  reach(state => state.turn === 2 && state.phase === 5 && state.active === entrant && semutaMoritaniAllianceClean(state));
  assert.ok(!semutaMoritaniAlliancePlayer(game, owner).ally && !semutaMoritaniAlliancePlayer(game, entrant).ally);
  const shipmentTerritory = entryKind === 'shipment' ? territory : 'imperial_basin';
  const price = reserveShipmentCost({ faction: 'emperor', halfRate: false }, boardTerritory(shipmentTerritory).type, 1);
  const shipmentAction: Action = { type: 'ship', territory: shipmentTerritory, sector, amount: 1, elite: 0, allyPayment: 0 };
  let paidShipment: { before: Game; steps: SemutaMoritaniAllianceStep[]; after: Game };
  let entry: { before: Game; steps: SemutaMoritaniAllianceStep[]; after: Game };
  const chooser = (state: Game) => !state.response && !state.phaseOpening && state.decision?.kind === 'moritaniTerror' &&
    state.pendingTerrorEntry?.stage === 'offer';
  let entryAction: Action;
  if (entryKind === 'shipment') {
    entryAction = shipmentAction;
    entry = transition(() => { act(entrant, shipmentAction); reach(chooser); });
    paidShipment = entry;
  } else {
    paidShipment = transition(() => { act(entrant, shipmentAction); reach(semutaMoritaniAllianceClean); });
    entryAction = { type: 'move', from: origin, amount: 1, elite: 0, territory, sector };
    entry = transition(() => { act(entrant, entryAction); reach(chooser); });
  }
  assert.equal(semutaMoritaniAlliancePlayer(paidShipment.before, entrant).spice -
    semutaMoritaniAlliancePlayer(paidShipment.after, entrant).spice, price);
  assert.equal(semutaMoritaniAlliancePlayer(game, entrant).forces[location], 1);
  assert.equal(semutaMoritaniAlliancePlayer(game, entrant).shipped, true);
  assert.equal(semutaMoritaniAlliancePlayer(game, entrant).moved, entryKind === 'movement' ? 1 : 0);
  const offerAction: Action = { type: 'decision', alliance: true };
  const offer = transition(() => { act(owner, offerAction); });
  assert.ok(game.response?.kind === 'moritaniAlliance'); assert.equal(game.response.owner, owner);
  assert.equal(game.pendingTerrorEntry?.stage, 'allianceResponse');
  assert.equal(game.pendingTerrorEntry?.cause, entryKind); assert.equal(game.pendingTerrorEntry?.token, token);
  assert.equal(game.decision ?? null, null); assert.equal(game.pendingTreacheryDiscard ?? null, null);
  assert.deepEqual(semutaMoritaniAllianceInventory(game), originalInventory);
  return { game, kind: 'moritaniAlliance' as const, advanced: false as const, entryKind,
    owner, recipient: entrant, entrant, holder, spender, richese, guild: spender, cost, karama: cost,
    semuta: SEMUTA_DRUG_ID, action: { type: 'card', card: cost, mode: 'cancel' } as Action,
    originalResponse: structuredClone(game.response), originalEntry: structuredClone(game.pendingTerrorEntry!),
    originalTerror: structuredClone(game.moritaniTerror!), originalOffers: structuredClone(game.allianceOffers),
    token, territory, sector, location, origin, price, shipmentAction, entryAction, offerAction,
    revealAction: { type: 'decision', reveal: true } as Action, revealActor: owner,
    declineAction: { type: 'decision', decline: true } as Action, declineActor: owner,
    acceptAction: { type: 'decision', accept: true } as Action, acceptActor: entrant,
    robberyAction: { type: 'decision', choice: 'spice' } as Action, robberyActor: owner,
    initial, lobby, setup, beforeStartingDeal, afterSetup, deal: selected.map(card => card.id), dealOrder,
    originalInventory, originalSpice, spiceOrder, acquisition, acquired, cache: acquisition,
    placement, paidShipment, entry, offer, actions, steps: actions, sourceActionCount: actions.length,
    staging: [
      'Original public Basic R/C/M/E/G E2/E3 setup, unopened main/Spice positions and scalar lotteries only. Guild is actually dealt the printed Karama; CHOAM buys physical cache Semuta for one spice; Moritani places its original six in Oh Gap.',
      'Native turn1 Mentat actually places the available Robbery token at empty Arrakeen. Original legal Storm dials and ordinary controls reach turn2. Emperor genuinely pays the printed city1 or desert2 shipment tariff and Guild collects its native income.',
      entryKind === 'shipment' ? 'The actual one-counter Arrakeen shipment opens the hidden-token entry.'
        : 'The actual paid Imperial Basin10 cohort then makes its ordinary one-territory ground move into Arrakeen10, consuming its real movement index before the entry.',
      'Moritani actually offers Enemy of My Enemy while both parties are unallied. Stop before the real used cancellation cost. No played hand, force, payment, token, alliance, clock, Terror entry or pending control is installed.',
    ] };
}
export type SemutaMoritaniAllianceFixture = ReturnType<typeof createSemutaMoritaniAllianceFixture>;
