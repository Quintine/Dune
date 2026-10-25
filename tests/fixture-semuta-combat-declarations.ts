import assert from 'node:assert/strict';
import {
  createGame, initializeSemutaGameForAudit, joinGame, newPlayer,
  type Action, type Game, type Plan,
} from '../game/engine';
import { gameTerritories } from '../game/board';
import { isAdvisor } from '../game/advisors';
import { quoteCombatResponse } from '../game/combat-response-quote';
import { SEMUTA_DRUG_ID } from '../game/semuta-drug';
import { withClassicDiscoveryNexusLottery } from './fixture-discovery-classic-nexus';
import {
  actSemutaSpiritualForesight, nextSemutaSpiritualForesight,
  semutaSpiritualForesightClean, semutaSpiritualForesightInventory, semutaSpiritualForesightPlayer,
} from './fixture-semuta-spiritual-foresight';
import { passSemutaFremenGuildMovement, claimSemutaFremenGuildMovement } from './fixture-semuta-fremen-guild-movement';

export type SemutaCombatDeclarationsKind = 'voice' | 'prescience';
export type SemutaCombatDeclarationsStep = { actor: string; action: Action };
export const actSemutaCombatDeclarations = actSemutaSpiritualForesight;
export const passSemutaCombatDeclarations = passSemutaFremenGuildMovement;
export const claimSemutaCombatDeclarations = claimSemutaFremenGuildMovement;
export const semutaCombatDeclarationsPlayer = semutaSpiritualForesightPlayer;
export const semutaCombatDeclarationsInventory = semutaSpiritualForesightInventory;
export const semutaCombatDeclarationsClean = semutaSpiritualForesightClean;

/** Original preparation controls only; declaration counters and fresh costs
 * remain explicit. No plan or battle result is chosen by the native driver. */
export function nextSemutaCombatDeclarations(game: Game): SemutaCombatDeclarationsStep | null {
  if (game.pendingTreacheryDiscard || game.truthtrance ||
    game.response?.kind === 'voice' || game.response?.kind === 'prescience') return null;
  if (!game.response && !game.phaseOpening && game.battle) {
    if (game.decision?.kind === 'fullPlanOffer') return { actor: game.decision.player,
      action: { type: 'decision', decline: true } };
    const b = game.battle;
    if (!game.decision && b.preLeader && !b.preLeader.closed) {
      const actor = [b.attacker, b.defender].find(player => !b.preLeader!.ready.includes(player)); assert.ok(actor);
      return { actor, action: { type: 'battlePreparationReady', event: b.preLeader.event } };
    }
    if (!game.decision && b.preparation) {
      if (b.preparation.kind === 'prescienceAnswer') {
        assert.equal(b.prescience?.field, 'weapon');
        return { actor: b.preparation.owner, action: { type: 'prescienceAnswer', value: null } };
      }
      assert.ok(b.preparation.kind === 'voice' || b.preparation.kind === 'prescience');
      return { actor: b.preparation.owner, action: { type: 'declineBattlePower' } };
    }
    if (!game.decision) return null;
  }
  return nextSemutaSpiritualForesight(game);
}
export function advanceSemutaCombatDeclarations(game: Game, until: (state: Game) => boolean,
  actions: SemutaCombatDeclarationsStep[] = []): Game {
  for (let count = 0; count < 1800; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished');
    const step = nextSemutaCombatDeclarations(game);
    assert.ok(step, 'Choose the original declaration, fresh cost or private plan before continuing');
    game = actSemutaCombatDeclarations(game, step.actor, step.action, actions);
  }
  throw Error('The original combat-declaration programme did not reach its finite boundary');
}
/** Pass only the original declared combat advantage. Its next preparation or
 * pending opponent answer remains a separate original control. */
export function allowSemutaCombatDeclarations(game: Game,
  actions: SemutaCombatDeclarationsStep[] = []): Game {
  const kind = game.response?.kind; assert.ok(kind === 'voice' || kind === 'prescience');
  for (let count = 0; count < game.players.length && game.response?.kind === kind; count++) {
    const actor = game.players.find(player => !game.response!.passed.includes(player.id)); assert.ok(actor);
    game = actSemutaCombatDeclarations(game, actor.id, { type: 'passResponse' }, actions);
  }
  assert.notEqual(game.response?.kind, kind); return game;
}
/** Continue native preparation to legal private-plan readiness. In particular,
 * an allowed Prescience gets its real null weapon answer; a prevented one does
 * not. No plans, payments, result acknowledgements or fresh discards are made. */
export function finishSemutaCombatDeclarations(game: Game,
  actions: SemutaCombatDeclarationsStep[] = []): Game {
  for (let count = 0; count < 40; count++) {
    assert.equal(game.pendingTreacheryDiscard ?? null, null, 'Resolve the actual fresh cost first');
    assert.ok(game.battle && !game.battle.revealed);
    assert.ok(game.response?.kind !== 'voice' && game.response?.kind !== 'prescience',
      'Resolve the original declared power first');
    if (!game.response && !game.decision && !game.battle.preparation &&
      (!game.battle.preLeader || game.battle.preLeader.closed)) return game;
    const step = nextSemutaCombatDeclarations(game); assert.ok(step);
    game = actSemutaCombatDeclarations(game, step.actor, step.action, actions);
  }
  throw Error('The original combat declaration did not reach private-plan readiness');
}

/** Genuine Basic/public or original Advanced Semuta setup, paid cache1, and
 * direct BG fighter shipment into Atreides' native Arrakeen garrison. Every
 * setup, stance, battle, shared readiness and declaration is an actual action. */
export function createSemutaCombatDeclarationsFixture(options: {
  kind: SemutaCombatDeclarationsKind; advanced?: boolean;
}) {
  const kind = options.kind, advanced = options.advanced ?? false;
  const richese = 'richese', holder = 'choam', bg = 'beneGesserit', atreides = 'atreides', spender = 'emperor';
  const owner = kind === 'voice' ? bg : atreides;
  let game = createGame('SEMUTACOMBATDECLARATIONS', newPlayer(richese, 'Richese', 'richese'), advanced, ['choam']);
  for (const faction of [holder, bg, atreides, spender] as const) joinGame(game, newPlayer(faction, faction, faction));
  const initial = structuredClone(game), actions: SemutaCombatDeclarationsStep[] = [];
  const act = (actor: string, action: Action) => { game = actSemutaCombatDeclarations(game, actor, action, actions); };
  const reach = (until: (state: Game) => boolean) => { game = advanceSemutaCombatDeclarations(game, until, actions); };
  const transition = (run: () => void) => {
    const before = structuredClone(game), start = actions.length; run();
    return { before, steps: structuredClone(actions.slice(start)), after: structuredClone(game) };
  };
  for (const player of game.players) act(player.id, { type: 'ready' });
  const lobby = structuredClone(game);
  if (advanced) game = withClassicDiscoveryNexusLottery(() => initializeSemutaGameForAudit(game));
  else act(game.host, { type: 'start' });
  const setup = structuredClone(game), initialization = { before: lobby, after: setup,
    entry: advanced ? 'original-undealt-semuta-preview' : 'public-basic-start' };
  assert.equal(game.status, 'setup'); assert.equal(game.advanced, advanced); assert.equal(game.semutaPreview, true);
  assert.ok(game.players.every(player => player.hand.length === 0));
  assert.ok(!game.homeworlds && !game.nexusCards && !game.leaderSkills && !game.techTokens &&
    !game.strongholdCards && !game.discoveryEnabled && !game.ecazTreachery);
  const originalInventory = semutaCombatDeclarationsInventory(game); assert.equal(originalInventory.length, 45);
  assert.equal(game.deck.length, 35); assert.equal(game.richeseCache!.length, 10);
  const printed = game.deck.find(card => card.effect === 'karama'); assert.ok(printed);
  const ordinary = game.deck.filter(card => card.kind === 'projectile' && !card.effect).slice(0, 4);
  assert.equal(ordinary.length, 4);
  const deal = [...ordinary.map(card => card.id), printed.id], cost = printed.id;
  const dealOrder = deal.map((card, position) => {
    const from = game.deck.findIndex(candidate => candidate.id === card); assert.ok(from >= position);
    [game.deck[position], game.deck[from]] = [game.deck[from], game.deck[position]];
    return { card, from, position };
  });
  const beforeStartingDeal = structuredClone(game);
  reach(state => state.status === 'playing'); const afterSetup = structuredClone(game);
  assert.deepEqual(game.players.flatMap(player => player.hand.map(card => card.id)), deal);
  assert.equal(semutaCombatDeclarationsPlayer(game, bg).forces['polar_sink:0'], 1);
  assert.equal(semutaCombatDeclarationsPlayer(game, atreides).forces['arrakeen:10'], 10);
  const originalSpice = game.spiceDeck.map(card => JSON.stringify(card)).sort();
  const spiceOrder: { position: number; from: number; card: Game['spiceDeck'][number] }[] = [];
  for (let position = 0; position < (advanced ? 2 : 1); position++) {
    const from = game.spiceDeck.findIndex((card, index) => index >= position && 'territory' in card && !card.discovery &&
      ['hagga_basin', 'rock_outcroppings', 'broken_land', 'oh_gap'].includes(card.territory));
    assert.ok(from >= position); const card = game.spiceDeck.splice(from, 1)[0]; game.spiceDeck.splice(position, 0, card);
    spiceOrder.push({ position, from, card: structuredClone(card) });
  }
  assert.deepEqual(game.spiceDeck.map(card => JSON.stringify(card)).sort(), originalSpice);
  let beforeBid: Game | undefined, bid: SemutaCombatDeclarationsStep | undefined, bidAt = -1;
  for (let count = 0; count < 900 && !semutaCombatDeclarationsPlayer(game, holder).hand.some(card => card.id === SEMUTA_DRUG_ID); count++) {
    const step = nextSemutaCombatDeclarations(game); assert.ok(step);
    if (step.actor === holder && step.action.type === 'richeseBid' && step.action.amount === 1) {
      beforeBid = structuredClone(game); bid = structuredClone(step); bidAt = actions.length;
    }
    act(step.actor, step.action);
  }
  assert.ok(beforeBid && bid && bidAt >= 0);
  const acquired = structuredClone(game), acquisition = { before: beforeBid, bid,
    steps: structuredClone(actions.slice(bidAt)), after: acquired, price: 1 };
  assert.equal(semutaCombatDeclarationsPlayer(beforeBid, holder).spice - semutaCombatDeclarationsPlayer(game, holder).spice, 1);
  assert.equal(semutaCombatDeclarationsPlayer(game, richese).spice - semutaCombatDeclarationsPlayer(beforeBid, richese).spice, 1);
  reach(state => state.turn === 1 && state.phase === 5 && state.active === bg && semutaCombatDeclarationsClean(state));
  const shipmentAction: Action = { type: 'ship', territory: 'arrakeen', sector: 10, amount: 2, elite: 0, allyPayment: 0 };
  const shipment = transition(() => { act(bg, shipmentAction); reach(semutaCombatDeclarationsClean); });
  assert.equal(semutaCombatDeclarationsPlayer(shipment.before, bg).spice - semutaCombatDeclarationsPlayer(game, bg).spice, 2);
  assert.equal(semutaCombatDeclarationsPlayer(game, bg).forces['arrakeen:10'], 2);
  assert.equal(isAdvisor(semutaCombatDeclarationsPlayer(game, bg), 'arrakeen'), false);
  act(bg, { type: 'endMovement' });
  reach(state => state.turn === 1 && state.phase === 6 && !state.battle && semutaCombatDeclarationsClean(state));
  const beforeBattle = structuredClone(game), chooser = game.active!;
  assert.ok(chooser === bg || chooser === atreides);
  const battleAction: Action = { type: 'chooseBattle', territory: 'arrakeen', target: chooser === bg ? atreides : bg };
  const battle = transition(() => {
    act(chooser, battleAction);
    reach(state => !state.response && !state.decision && state.battle?.preparation?.kind === 'voice');
  });
  const readiness = transition(() => {
    assert.ok(game.battle?.preLeader);
    for (const actor of [game.battle.attacker, game.battle.defender])
      act(actor, { type: 'battlePreparationReady', event: game.battle!.preLeader!.event });
  });
  assert.equal(game.battle?.preLeader?.closed, true);
  let declinedVoice: ReturnType<typeof transition> | null = null;
  if (kind === 'prescience') declinedVoice = transition(() => { act(bg, { type: 'declineBattlePower' }); });
  const beforeDeclaration = structuredClone(game);
  const nativeAction: Action = kind === 'voice'
    ? { type: 'voice', kind: 'projectile', must: false } : { type: 'prescience', field: 'weapon' };
  const declaration = transition(() => { act(owner, nativeAction); });
  assert.equal(game.response?.kind, kind); assert.equal(game.response?.owner, owner);
  assert.equal(game.phaseOpening ?? null, null); assert.equal(game.decision ?? null, null);
  assert.equal(game.pendingTreacheryDiscard ?? null, null);
  assert.deepEqual(game.battle?.plans, {}); assert.equal(game.battle?.revealed, false);
  if (kind === 'voice') {
    assert.deepEqual(game.battle?.voice, { target: atreides, kind: 'projectile', must: false });
    assert.deepEqual(game.battle?.preparation, { kind: 'prescience', owner: atreides, beneficiary: atreides });
  } else {
    assert.deepEqual(game.battle?.prescience, { player: atreides, field: 'weapon' });
    assert.deepEqual(game.battle?.preparation, { kind: 'prescienceAnswer', owner: bg, beneficiary: atreides });
  }
  const source = structuredClone(game), originalResponse = structuredClone(game.response!), originalBattle = structuredClone(game.battle!);
  const input = { ...game, territoryIds: gameTerritories(game).map(territory => territory.id) };
  const expected = quoteCombatResponse(input, { kind: 'response', response: { kind, owner }, canceled: true });
  const allowed = quoteCombatResponse(input, { kind: 'response', response: { kind, owner }, canceled: false });
  const plans: Record<string, Plan> = {};
  for (const actor of [atreides, bg]) {
    const leader = semutaCombatDeclarationsPlayer(game, actor).leaders.find(leader => !leader.dead); assert.ok(leader);
    plans[actor] = { dial: actor === atreides ? 1 : 0, support: actor === atreides && advanced ? 1 : 0,
      leader: leader.id, weapon: null, defense: null };
  }
  assert.ok(semutaCombatDeclarationsPlayer(game, holder).hand.some(card => card.id === SEMUTA_DRUG_ID));
  assert.ok(semutaCombatDeclarationsPlayer(game, spender).hand.some(card => card.id === cost));
  assert.deepEqual(semutaCombatDeclarationsInventory(game), originalInventory);
  const action: Action = { type: 'card', card: cost, mode: 'cancel' };
  return { game, source, beforeCost: source, kind, advanced, richese, holder, spender, owner, bg, atreides,
    cost, semuta: SEMUTA_DRUG_ID, action, nativeAction, originalResponse, originalBattle, expected, allowed, plans,
    initial, lobby, setup, initialization, beforeStartingDeal, afterSetup, deal, dealOrder, originalSpice, spiceOrder,
    acquired, acquisition, shipment, shipmentAction, beforeBattle, chooser, battleAction, battle, readiness,
    declinedVoice, beforeDeclaration, declaration, originalInventory, actions, sourceActions: actions,
    sourceActionCount: actions.length,
    staging: [
      'Public bare Basic start or original Advanced Semuta initializer on the genuinely ready undealt R/C/BG/A/E lobby. Only unopened original starting-card/Spice positions and scalar lotteries are selected; original main35/cache10 remain physical. Emperor really receives printed Karama, and CHOAM pays1 for original cache Semuta.',
      'BG makes its actual prediction and (Advanced) Polar Sink advisorSetup. During its real turn BG pays2 to ship two original reserves directly as fighters into Atreides native Arrakeen10. No stance or force is installed; earlier optional native choices are actually declined.',
      'At the original first Battle phase the native chooser selects that actual battle. Both combatants really ready the shared Richese pre-leader event, leaving private plans empty.',
      kind === 'voice' ? 'BG declares a real ban on projectile weapons. Stop at native Voice response, retaining the original next Prescience preparation owned by Atreides.' :
        'BG actually declines its earlier Voice. Atreides declares ordinary weapon Prescience. Stop at its native response with the original BG prescienceAnswer unsubmitted and no inspected value.',
      'No played hand, wallet, force, clock, battle, declaration or snapshot is installed. Later preparation/full-plan offer is answered only through current original controls; the supplied unarmed plans are real legal continuation actions, not preinstalled commitments.',
    ] };
}
export type SemutaCombatDeclarationsFixture = ReturnType<typeof createSemutaCombatDeclarationsFixture>;
