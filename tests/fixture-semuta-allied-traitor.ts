import assert from 'node:assert/strict';
import {
  createGame, initializeSemutaGameForAudit, joinGame, newPlayer, viewGame,
  type Action, type Game,
} from '../game/engine';
import { SEMUTA_DRUG_ID } from '../game/semuta-drug';
import { withClassicDiscoveryNexusLottery } from './fixture-discovery-classic-nexus';
import {
  actSemutaCombatCapabilities, nextSemutaCombatCapabilities,
  semutaCombatCapabilitiesPlayer, semutaCombatCapabilitiesInventory, semutaCombatCapabilitiesClean,
  passSemutaCombatCapabilities, claimSemutaCombatCapabilities,
} from './fixture-semuta-combat-capabilities';

export type SemutaAlliedTraitorStep = { actor: string; action: Action };
export const actSemutaAlliedTraitor = actSemutaCombatCapabilities;
export const semutaAlliedTraitorPlayer = semutaCombatCapabilitiesPlayer;
export const semutaAlliedTraitorInventory = semutaCombatCapabilitiesInventory;
export const semutaAlliedTraitorClean = semutaCombatCapabilitiesClean;
export const passSemutaAlliedTraitor = passSemutaCombatCapabilities;
export const claimSemutaAlliedTraitor = claimSemutaCombatCapabilities;

/** Native controls and explicit declines only. Sealing plans and the allied
 * positive Traitor declaration remain caller-owned source acts. */
export function nextSemutaAlliedTraitor(game: Game): SemutaAlliedTraitorStep | null {
  if (!game.phaseOpening && !game.response && !game.pendingTreacheryDiscard) {
    const fremen = game.players.find(p => p.faction === 'fremen');
    if (game.status === 'setup' && game.setupStage === 'forces' && fremen?.reserves === 20 &&
      viewGame(game, fremen.id).setupPending.includes(fremen.id))
      return { actor: fremen.id, action: { type: 'fremenSetup', placements: { 'sietch_tabr:14': 10 } } };
    const decision = game.decision;
    if (decision?.kind === 'wormRide' || decision?.kind === 'wormPlacement')
      return { actor: decision.player, action: { type: 'decision', accept: false } };
    if (decision?.kind === 'wormProtection')
      return { actor: decision.player, action: { type: 'decision', accept: true } };
    if (decision?.kind === 'choamBattleFunding')
      return { actor: decision.player, action: { type: 'decision', amount: 0 } };
  }
  return nextSemutaCombatCapabilities(game);
}
export const nextSemutaAlliedTraitorStep = nextSemutaAlliedTraitor;
export function advanceSemutaAlliedTraitor(game: Game, until: (state: Game) => boolean,
  actions: SemutaAlliedTraitorStep[] = []): Game {
  for (let count = 0; count < 2600; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished');
    const next = nextSemutaAlliedTraitor(game);
    assert.ok(next, `Supply the actual owned allied-Traitor control at ${game.turn}/${game.phase}/${game.decision?.kind}`);
    game = actSemutaAlliedTraitor(game, next.actor, next.action, actions);
  }
  throw Error('The native allied-Traitor programme did not reach its finite boundary');
}
export function allowSemutaAlliedTraitor(game: Game, actions: SemutaAlliedTraitorStep[] = []): Game {
  assert.equal(game.response?.kind, 'harkonnenTraitor');
  for (let count = 0; game.response?.kind === 'harkonnenTraitor' && count < game.players.length; count++) {
    const actor = game.players.find(p => !game.response!.passed.includes(p.id)); assert.ok(actor);
    game = actSemutaAlliedTraitor(game, actor.id, { type: 'passResponse' }, actions);
  }
  assert.notEqual(game.response?.kind, 'harkonnenTraitor'); return game;
}
/** Finish only this original battle: missing voters, the shared final window
 * and actual cleanup decisions. No new battle, return or card play is made. */
export function finishSemutaAlliedTraitor(game: Game, actions: SemutaAlliedTraitorStep[] = []): Game {
  assert.ok(game.battle && !game.pendingTreacheryDiscard);
  return advanceSemutaAlliedTraitor(game, state => !state.battle &&
    !state.pendingTreacheryDiscard && !state.response && !state.decision, actions);
}

/** Original R/C/H/E/F setup and paid cache1. A real turn2 worm earns the
 * Harkonnen/Emperor alliance; both combat cohorts actually ship. The opposing
 * leader is selected from Harkonnen's original four physical Traitor cards. */
export function createSemutaAlliedTraitorFixture(options: { advanced?: boolean; last?: boolean } = {}) {
  const advanced = options.advanced ?? false, last = options.last ?? false;
  const richese = 'richese', holder = 'choam', owner = 'harkonnen', beneficiary = 'emperor', spender = beneficiary;
  const fremen = 'fremen', territory = 'the_great_flat', sector = 15, location = `${territory}:${sector}`;
  let game = createGame('SEMUTAALLIEDTRAITOR', newPlayer(richese, 'Richese', 'richese'), advanced, ['choam']);
  for (const faction of ['choam', 'harkonnen', 'emperor', 'fremen'] as const)
    joinGame(game, newPlayer(faction, faction, faction));
  const initial = structuredClone(game), actions: SemutaAlliedTraitorStep[] = [];
  const act = (actor: string, action: Action) => { game = actSemutaAlliedTraitor(game, actor, action, actions); };
  const reach = (until: (state: Game) => boolean) => { game = advanceSemutaAlliedTraitor(game, until, actions); };
  const transition = (run: () => void) => {
    const before = structuredClone(game), at = actions.length; run();
    return { before, steps: structuredClone(actions.slice(at)), after: structuredClone(game) };
  };
  for (const p of game.players) act(p.id, { type: 'ready' });
  const lobby = structuredClone(game);
  if (advanced) game = withClassicDiscoveryNexusLottery(() => initializeSemutaGameForAudit(game));
  else act(game.host, { type: 'start' });
  const setup = structuredClone(game);
  assert.equal(game.status, 'setup'); assert.equal(game.semutaPreview, true);
  assert.ok(game.players.every(p => p.hand.length === 0));
  const originalInventory = semutaAlliedTraitorInventory(game); assert.equal(originalInventory.length, 45);
  const costCard = game.deck.find(card => card.effect === 'karama'); assert.ok(costCard);
  const ordinary = game.deck.filter(card => card.kind === 'projectile' || card.kind === 'poison').slice(0, 5);
  assert.equal(ordinary.length, 5);
  const selected = [ordinary[0], ordinary[1], ordinary[2], ordinary[3], costCard, ordinary[4]];
  const dealOrder = selected.map((card, position) => {
    const from = game.deck.findIndex(candidate => candidate.id === card.id); assert.ok(from >= position);
    [game.deck[position], game.deck[from]] = [game.deck[from], game.deck[position]];
    return { card: card.id, position, from };
  });
  const beforeStartingDeal = structuredClone(game), cost = costCard.id;
  reach(state => state.status === 'playing'); const afterSetup = structuredClone(game);
  assert.ok(semutaAlliedTraitorPlayer(game, spender).hand.some(card => card.id === cost));
  assert.equal(semutaAlliedTraitorPlayer(game, owner).traitors.length, 4);
  const candidates = game.players.filter(p => ![owner, beneficiary].includes(p.id)).flatMap(p =>
    p.leaders.filter(leader => semutaAlliedTraitorPlayer(game, owner).traitors.includes(leader.id))
      .map(leader => ({ player: p.id, leader }))).sort((a, b) => b.leader.strength - a.leader.strength);
  const target = candidates[0]; assert.ok(target, 'Use an opposing leader Harkonnen actually received as a Traitor');
  const opponent = target.player, traitorId = target.leader.id;
  const beneficiaryLeader = semutaAlliedTraitorPlayer(game, beneficiary).leaders
    .toSorted((a, b) => a.strength - b.strength)[0]; assert.ok(beneficiaryLeader);
  assert.ok(target.leader.strength > beneficiaryLeader.strength,
    'Without the allied Traitor, the actual unarmed opposing plan wins normally');
  const originalSpice = game.spiceDeck.map(card => JSON.stringify(card)).sort();
  const spiceOrder: { turn: number; position: number; from: number; card: Game['spiceDeck'][number] }[] = [];
  const orderSpice = (faces: string[]) => {
    for (let position = 0; position < faces.length; position++) {
      const face = faces[position], from = game.spiceDeck.findIndex((card, index) => index >= position &&
        (face === 'worm' ? 'worm' in card && !card.suppressed && !card.thumper && !card.greatMaker
          : 'territory' in card && card.territory === face && !card.discovery));
      assert.ok(from >= position, `Choose an original unopened ${face} Spice Card`);
      const card = game.spiceDeck.splice(from, 1)[0]; game.spiceDeck.splice(position, 0, card);
      spiceOrder.push({ turn: game.turn, position, from, card: structuredClone(card) });
    }
  };
  orderSpice(['funeral_plain', 'hagga_basin']);
  let beforeBid: Game | undefined, bid: SemutaAlliedTraitorStep | undefined, bidAt = -1;
  for (let count = 0; count < 1000 && !semutaAlliedTraitorPlayer(game, holder).hand.some(card => card.id === SEMUTA_DRUG_ID); count++) {
    const next = nextSemutaAlliedTraitor(game); assert.ok(next);
    if (next.actor === holder && next.action.type === 'richeseBid' && next.action.amount === 1) {
      beforeBid = structuredClone(game); bid = structuredClone(next); bidAt = actions.length;
    }
    act(next.actor, next.action);
  }
  assert.ok(beforeBid && bid && bidAt >= 0);
  const acquired = structuredClone(game), acquisition = { before: beforeBid, bid,
    steps: structuredClone(actions.slice(bidAt)), after: acquired, price: 1 };
  assert.equal(semutaAlliedTraitorPlayer(beforeBid, holder).spice - semutaAlliedTraitorPlayer(game, holder).spice, 1);
  reach(state => state.turn === 2 && state.phase === 1 && semutaAlliedTraitorClean(state) &&
    !state.spiceSequence && !state.spiceResolution && !state.spiceWindow && !state.nexus && state.ready.length === 0);
  orderSpice(['worm', 'the_great_flat', 'broken_land']);
  reach(state => state.turn === 2 && state.phase === 1 && state.nexus && !state.spiceWindow &&
    !state.spiceResolution && semutaAlliedTraitorClean(state));
  const alliance = transition(() => {
    act(owner, { type: 'alliance', target: beneficiary }); act(beneficiary, { type: 'alliance', target: owner });
  });
  assert.equal(semutaAlliedTraitorPlayer(game, owner).ally, beneficiary);
  assert.equal(semutaAlliedTraitorPlayer(game, beneficiary).ally, owner);
  reach(state => state.turn === 2 && state.phase === 5 && semutaAlliedTraitorClean(state));
  const shipments: { actor: string; cost: number; before: Game; steps: SemutaAlliedTraitorStep[]; after: Game }[] = [];
  for (let count = 0; game.turn === 2 && game.phase === 5 && count < 200; count++) {
    const actor = game.active;
    if (semutaAlliedTraitorClean(game) && actor && [beneficiary, opponent].includes(actor) &&
      !semutaAlliedTraitorPlayer(game, actor).shipped) {
      const shipment = transition(() => {
        act(actor, { type: 'ship', territory, sector, amount: 1, elite: 0, allyPayment: 0 });
        reach(semutaAlliedTraitorClean);
      });
      const paid = actor === fremen ? 0 : 2;
      assert.equal(semutaAlliedTraitorPlayer(shipment.before, actor).spice - semutaAlliedTraitorPlayer(game, actor).spice, paid);
      shipments.push({ actor, cost: paid, ...shipment });
    } else {
      const next = nextSemutaAlliedTraitor(game); assert.ok(next); act(next.actor, next.action);
    }
  }
  assert.equal(shipments.length, 2);
  assert.equal(semutaAlliedTraitorPlayer(game, beneficiary).forces[location], 1);
  assert.equal(semutaAlliedTraitorPlayer(game, opponent).forces[location], 1);
  reach(state => state.phase === 6 && semutaAlliedTraitorClean(state) && !!state.active);
  const beforeBattle = structuredClone(game), chooser = game.active!;
  const choice = viewGame(game, chooser).battleChoices.find(row => row.territory === territory &&
    [row.attacker, row.defender].includes(beneficiary) && [row.attacker, row.defender].includes(opponent));
  assert.ok(choice);
  const battleAction: Action = { type: 'chooseBattle', territory,
    target: choice.attacker === chooser ? choice.defender : choice.attacker };
  act(chooser, battleAction);
  reach(state => !!state.battle && semutaAlliedTraitorClean(state) && !state.battle.preparation &&
    state.battle.preLeader?.closed !== false);
  assert.ok(game.battle && !game.battle.revealed && ![game.battle.attacker, game.battle.defender].includes(owner));
  const plans: Record<string, Action> = {
    [beneficiary]: { type: 'battlePlan', leader: beneficiaryLeader.id, dial: 0, support: 0, weapon: null, defense: null },
    [opponent]: { type: 'battlePlan', leader: traitorId, dial: 0, support: 0, weapon: null, defense: null },
  };
  const reveal = transition(() => {
    for (const actor of [game.battle!.attacker, game.battle!.defender]) act(actor, plans[actor]);
    reach(state => !!state.battle?.revealed && semutaAlliedTraitorClean(state));
  });
  const voters = viewGame(game, owner).battle!.traitorVoters;
  assert.ok(voters.includes(owner)); assert.equal(voters.length, 3);
  const votes = transition(() => {
    if (last) for (const voter of voters.filter(id => id !== owner)) act(voter, { type: 'traitorCall', call: false });
    act(owner, { type: 'traitorCall', call: true });
  });
  assert.ok(game.response?.kind === 'harkonnenTraitor'); assert.equal(game.response.owner, owner);
  assert.equal(game.battle?.traitorCalls[owner], true); assert.ok(!game.battle?.outcomeWindow);
  assert.ok(semutaAlliedTraitorPlayer(game, spender).hand.some(card => card.id === cost));
  assert.ok(semutaAlliedTraitorPlayer(game, holder).hand.some(card => card.id === SEMUTA_DRUG_ID));
  assert.deepEqual(semutaAlliedTraitorInventory(game), originalInventory);
  return { game, kind: 'harkonnenTraitor' as const, advanced, last, holder, spender, owner, beneficiary, opponent,
    combatant: beneficiary, richese, fremen, cost, karama: cost, semuta: SEMUTA_DRUG_ID, traitorId,
    action: { type: 'card', card: cost, mode: 'cancel' } as Action,
    originalBattle: structuredClone(game.battle!), originalResponse: structuredClone(game.response!),
    plans, territory, sector, location, voters, initial, lobby, setup, beforeStartingDeal, afterSetup,
    dealOrder, deal: selected.map(card => card.id), originalInventory, originalSpice, spiceOrder,
    acquisition, acquired, cache: acquisition, alliance, shipments, beforeBattle, chooser, battleAction, reveal, votes,
    actions, steps: actions, sourceActionCount: actions.length,
    staging: [
      'Original R/C/H/E/F undealt setup, unopened deals/Spice and scoped native scalar lotteries only. Emperor receives the printed Karama; Harkonnen retains its four original Traitors; CHOAM pays actual cache1 for Semuta.',
      'Original turn1 movement is unused. A real turn2 worm at the empty Funeral pile opens Nexus, where Harkonnen and Emperor genuinely propose/accept alliance. Both competing normal cohorts actually ship to Great Flat15.',
      'The opposing leader is selected from Harkonnen’s actual dealt identities. Real shared preparation and unarmed plans reveal before Harkonnen’s actual spectator-ally Traitor declaration. Early/last variants preserve which other voters truly answered.',
      'No played card, force, wallet, clock, ally, Traitor, plan, vote, battle or pending control is installed. Stop before Emperor spends the actual cancellation cost.',
    ] };
}
export type SemutaAlliedTraitorFixture = ReturnType<typeof createSemutaAlliedTraitorFixture>;
