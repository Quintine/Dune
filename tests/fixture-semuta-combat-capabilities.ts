import assert from 'node:assert/strict';
import {
  createGame, initializeSemutaGameForAudit, joinGame, newPlayer, viewGame,
  type Action, type Game,
} from '../game/engine';
import { gameDistance, location, splitLocation, TERRITORIES } from '../game/board';
import { SEMUTA_DRUG_ID } from '../game/semuta-drug';
import { actTruthMovement } from './fixture-truth-movement';
import { nextSemutaIxianAuctionStep } from './fixture-semuta-ixian-auction';
import { withClassicDiscoveryNexusLottery } from './fixture-discovery-classic-nexus';

export type SemutaCombatCapabilitiesKind = 'kwisatz' | 'ixElite';
export type SemutaCombatCapabilitiesStep = { actor: string; action: Action };
export const actSemutaCombatCapabilities = actTruthMovement;
export const semutaCombatCapabilitiesPlayer = (game: Game, id: string) => {
  const player = game.players.find(p => p.id === id); assert.ok(player); return player;
};
export const semutaCombatCapabilitiesClean = (game: Game) => !game.response && !game.decision &&
  !game.phaseOpening && !game.truthtrance && !game.pendingTreacheryDiscard;
export function semutaCombatCapabilitiesInventory(game: Game): string[] {
  const ids = [...game.deck, ...game.discard, ...(game.richeseCache ?? []), ...(game.richeseRemoved ?? []),
    ...(game.ixSetupCards ?? []), ...(game.ixAuction?.cards ?? []), ...game.players.flatMap(p => p.hand),
    ...(game.auction?.cards.slice(game.auction.index + Number(game.currentAuctionSale?.origin === 'normal')) ?? [])]
    .map(card => card.id).sort();
  assert.equal(new Set(ids).size, ids.length, 'Every original main/cache card retains one physical zone');
  return ids;
}

/** Native acknowledgements only. A legal Battle Plan is always caller-owned. */
export function nextSemutaCombatCapabilities(game: Game): SemutaCombatCapabilitiesStep | null {
  if (game.truthtrance) return null;
  const pending = game.pendingTreacheryDiscard;
  if (pending) {
    const reaction = pending.reaction;
    if (reaction?.stage !== 'offer') return null;
    const actor = game.players.find(p => !reaction.passed.includes(p.id)); assert.ok(actor);
    return { actor: actor.id, action: { type: 'semutaPass', event: pending.batch.event } };
  }
  if (game.phaseOpening) {
    const actor = game.players.find(p => !game.phaseOpening!.passed.includes(p.id)); assert.ok(actor);
    return { actor: actor.id, action: { type: 'ready' } };
  }
  if (game.response) {
    const actor = game.players.find(p => !game.response!.passed.includes(p.id)); assert.ok(actor);
    return { actor: actor.id, action: { type: 'passResponse' } };
  }
  if (game.status === 'setup' && game.setupStage === 'traitors') {
    const emperor = semutaCombatCapabilitiesPlayer(game, 'emperor');
    const atreides = game.players.find(p => p.faction === 'atreides');
    const held = emperor.traitorChoices.find(id => atreides?.leaders.some(leader => leader.id === id));
    if (held) return { actor: emperor.id, action: { type: 'traitor', leader: held } };
  }
  const decision = game.decision;
  if (decision?.kind === 'fullPlanOffer')
    return { actor: decision.player, action: { type: 'decision', decline: true } };
  if (decision?.kind === 'battleCards')
    return { actor: decision.player, action: { type: 'decision', discard: [] } };
  if (decision?.kind === 'ixSubstitution')
    return { actor: decision.player, action: { type: 'decision', decline: true } };
  if (decision?.kind === 'battleLosses')
    return { actor: decision.player, action: { type: 'decision', choice: 0 } };
  const battle = game.battle;
  if (!decision && battle?.preLeader && !battle.preLeader.closed) {
    const actor = [battle.attacker, battle.defender].find(id => !battle.preLeader!.ready.includes(id)); assert.ok(actor);
    return { actor, action: { type: 'battlePreparationReady', event: battle.preLeader.event } };
  }
  if (!decision && battle?.preparation)
    return { actor: battle.preparation.owner, action: { type: 'declineBattlePower' } };
  if (!decision && battle?.revealed) {
    const voter = viewGame(game, battle.attacker).battle!.traitorVoters.find(id => battle.traitorCalls[id] === undefined);
    if (voter) return { actor: voter, action: { type: 'traitorCall', call: false } };
    if (battle.outcomeWindow && !battle.outcomeWindow.closed) {
      const actor = [battle.attacker, battle.defender].find(id => !battle.outcomeWindow!.ready.includes(id)); assert.ok(actor);
      return { actor, action: { type: 'battleOutcomeReady', event: battle.outcomeWindow.event } };
    }
  }
  if (!decision && battle && !battle.revealed) return null;
  return nextSemutaIxianAuctionStep(game);
}
export function advanceSemutaCombatCapabilities(game: Game, until: (state: Game) => boolean,
  actions: SemutaCombatCapabilitiesStep[] = []): Game {
  for (let count = 0; count < 2400; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished');
    const next = nextSemutaCombatCapabilities(game);
    assert.ok(next, `Supply the real owned control at ${game.turn}/${game.phase}/${game.decision?.kind}/${game.response?.kind}`);
    game = actSemutaCombatCapabilities(game, next.actor, next.action, actions);
  }
  throw Error('The native combat capability programme did not reach its finite boundary');
}
export function passSemutaCombatCapabilities(game: Game, actions: SemutaCombatCapabilitiesStep[] = []): Game {
  const event = game.pendingTreacheryDiscard?.batch.event; assert.ok(event);
  for (let count = 0; game.pendingTreacheryDiscard?.batch.event === event && count < game.players.length; count++) {
    const next = nextSemutaCombatCapabilities(game); assert.ok(next && next.action.type === 'semutaPass');
    game = actSemutaCombatCapabilities(game, next.actor, next.action, actions);
  }
  assert.notEqual(game.pendingTreacheryDiscard?.batch.event, event); return game;
}
export function claimSemutaCombatCapabilities(game: Game, holder: string,
  actions: SemutaCombatCapabilitiesStep[] = []): Game {
  const pending = game.pendingTreacheryDiscard; assert.ok(pending && pending.batch.entries.length === 1);
  const event = pending.batch.event, card = pending.batch.entries[0].card.id;
  game = actSemutaCombatCapabilities(game, holder, { type: 'semutaCommit', event }, actions);
  if (game.pendingTreacheryDiscard?.reaction?.stage === 'select')
    game = actSemutaCombatCapabilities(game, holder, { type: 'semutaSelect', event, card }, actions);
  return game;
}
export function allowSemutaCombatCapabilities(game: Game, actions: SemutaCombatCapabilitiesStep[] = []): Game {
  const kind = game.response?.kind; assert.ok(kind === 'kwisatz' || kind === 'eliteStrength');
  for (let count = 0; game.response?.kind === kind && count < game.players.length; count++) {
    const actor = game.players.find(p => !game.response!.passed.includes(p.id)); assert.ok(actor);
    game = actSemutaCombatCapabilities(game, actor.id, { type: 'passResponse' }, actions);
  }
  assert.notEqual(game.response?.kind, kind); return game;
}
/** Finish only real preparation. Sealing plans remains a separate caller act. */
export function finishSemutaCombatCapabilities(game: Game, actions: SemutaCombatCapabilitiesStep[] = []): Game {
  return advanceSemutaCombatCapabilities(game, state => !!state.battle &&
    semutaCombatCapabilitiesClean(state) && !state.battle.preparation && state.battle.preLeader?.closed !== false, actions);
}
function leader(game: Game, owner: string, strongest = true) {
  const choices = semutaCombatCapabilitiesPlayer(game, owner).leaders.filter(row => !row.dead && !row.capturedBy && !row.usedAt)
    .sort((a, b) => strongest ? b.strength - a.strength : a.strength - b.strength);
  assert.ok(choices[0]); return choices[0];
}

/** Original setup, unopened deals/Spice and paid cache1 only. KH is earned by
 * actual seven-counter battle loss; Cyborgs actually ship and move to battle.
 * No played hand, force, wallet, casualty, clock or pending control is installed. */
export function createSemutaCombatCapabilitiesFixture(options: { kind: SemutaCombatCapabilitiesKind }) {
  const kind = options.kind, advanced = kind === 'kwisatz';
  const richese = 'richese', holder = 'choam', owner = advanced ? 'atreides' : 'ixians', spender = 'emperor';
  let game = createGame('SEMUTACOMBATCAPABILITIES', newPlayer(richese, 'Richese', 'richese'), advanced,
    advanced ? ['choam'] : ['choam', 'ix']);
  for (const faction of ['choam', advanced ? 'atreides' as const : 'ixians' as const, 'emperor'] as const)
    joinGame(game, newPlayer(faction, faction, faction));
  const actions: SemutaCombatCapabilitiesStep[] = [];
  const act = (actor: string, action: Action) => { game = actSemutaCombatCapabilities(game, actor, action, actions); };
  const reach = (until: (state: Game) => boolean) => { game = advanceSemutaCombatCapabilities(game, until, actions); };
  const transition = (run: () => void) => {
    const before = structuredClone(game), at = actions.length; run();
    return { before, steps: structuredClone(actions.slice(at)), after: structuredClone(game) };
  };
  if (!advanced) {
    act(owner, { type: 'seatPosition', position: 5 });
    act(spender, { type: 'seatPosition', position: 3 });
  }
  for (const p of game.players) act(p.id, { type: 'ready' });
  const lobby = structuredClone(game);
  if (advanced) game = withClassicDiscoveryNexusLottery(() => initializeSemutaGameForAudit(game));
  else act(game.host, { type: 'start' });
  const setup = structuredClone(game);
  assert.equal(game.status, 'setup'); assert.equal(game.semutaPreview, true);
  assert.ok(game.players.every(p => !p.hand.length));
  const originalInventory = semutaCombatCapabilitiesInventory(game);
  assert.equal(originalInventory.length, advanced ? 45 : 57);
  const costCard = game.deck.find(card => card.effect === 'karama' && !card.id.startsWith('ix-'));
  const shield = game.deck.find(card => card.kind === 'shield');
  const ordinary = game.deck.filter(card => card.kind === 'projectile' && !card.effect).slice(0, 3);
  assert.ok(costCard && shield); assert.equal(ordinary.length, 3);
  const selected = [ordinary[0].id, ordinary[1].id, shield.id, costCard.id,
    ...(!advanced ? [ordinary[2].id] : [])];
  const dealOrder = selected.map((card, position) => {
    const from = game.deck.findIndex(row => row.id === card); assert.ok(from >= position);
    [game.deck[position], game.deck[from]] = [game.deck[from], game.deck[position]];
    return { card, position, from };
  });
  const beforeStartingDeal = structuredClone(game), cost = costCard.id;
  reach(state => state.status === 'playing'); const afterSetup = structuredClone(game);
  assert.ok(semutaCombatCapabilitiesPlayer(game, spender).hand.some(card => card.id === cost));
  assert.ok(semutaCombatCapabilitiesPlayer(game, owner).hand.some(card => card.id === shield.id));
  const originalSpice = game.spiceDeck.map(card => JSON.stringify(card)).sort(), front: Game['spiceDeck'] = [];
  for (let index = 0; index < (advanced ? 4 : 2); index++) {
    const at = game.spiceDeck.findIndex(card => 'territory' in card && !card.discovery); assert.ok(at >= 0);
    front.push(game.spiceDeck.splice(at, 1)[0]);
  }
  game.spiceDeck.unshift(...front);
  assert.deepEqual(game.spiceDeck.map(card => JSON.stringify(card)).sort(), originalSpice);
  let beforeBid: Game | undefined, bidAt = -1;
  for (let count = 0; count < 900 && !semutaCombatCapabilitiesPlayer(game, holder).hand.some(card => card.id === SEMUTA_DRUG_ID); count++) {
    const next = nextSemutaCombatCapabilities(game); assert.ok(next);
    if (next.actor === holder && next.action.type === 'richeseBid' && next.action.amount === 1) {
      beforeBid = structuredClone(game); bidAt = actions.length;
    }
    act(next.actor, next.action);
  }
  assert.ok(beforeBid && bidAt >= 0);
  const acquired = structuredClone(game), acquisition = { before: beforeBid,
    steps: structuredClone(actions.slice(bidAt)), after: acquired, price: 1 };
  assert.equal(semutaCombatCapabilitiesPlayer(beforeBid, holder).spice - semutaCombatCapabilitiesPlayer(game, holder).spice, 1);
  assert.equal(semutaCombatCapabilitiesPlayer(game, richese).spice - semutaCombatCapabilitiesPlayer(beforeBid, richese).spice, 1);
  const shipments: ReturnType<typeof transition>[] = [], moves: ReturnType<typeof transition>[] = [];
  let earningBattle: { before: Game; steps: SemutaCombatCapabilitiesStep[]; after: Game } | null = null;
  let territory = 'imperial_basin', sector = 9;
  if (!advanced) {
    const candidate = TERRITORIES.filter(row => row.type === 'sand').flatMap(row => row.sectors.map(s => location(row.id, s)))
      .find(key => splitLocation(key).sector !== game.storm && gameDistance(game, 'polar_sink:0', key,
        point => splitLocation(point).sector === game.storm) === 1);
    assert.ok(candidate, 'The native Cyborg needs a real adjacent desert destination');
    ({ territory, sector } = splitLocation(candidate));
  }
  let ownerTurn = false, opponentTurn = false;
  reach(state => state.turn === 1 && state.phase === 5 && semutaCombatCapabilitiesClean(state));
  while (game.turn === 1 && game.phase === 5) {
    if (!semutaCombatCapabilitiesClean(game)) {
      const next = nextSemutaCombatCapabilities(game); assert.ok(next); act(next.actor, next.action); continue;
    }
    const actor = game.active; assert.ok(actor);
    if (actor === spender && !opponentTurn) {
      shipments.push(transition(() => {
        act(spender, { type: 'ship', territory, sector, amount: 1, elite: 0, allyPayment: 0 });
        reach(semutaCombatCapabilitiesClean);
      }));
      opponentTurn = true;
    }
    if (actor === owner && !ownerTurn) {
      if (!advanced) {
        assert.ok(opponentTurn, 'The native Emperor ships before the Cyborg moves into its group');
        shipments.push(transition(() => {
          act(owner, { type: 'ship', territory: 'polar_sink', sector: 0, amount: 1, elite: 1, allyPayment: 0 });
          reach(semutaCombatCapabilitiesClean);
        }));
      }
      moves.push(transition(() => {
        act(owner, advanced
          ? { type: 'move', from: 'arrakeen:10', amount: 7, elite: 0, territory, sector }
          : { type: 'move', forces: { 'polar_sink:0': 1 }, eliteForces: { 'polar_sink:0': 1 }, territory, sector });
        reach(semutaCombatCapabilitiesClean);
      }));
      ownerTurn = true;
    }
    act(actor, { type: 'endMovement' });
  }
  assert.ok(ownerTurn && opponentTurn);
  const choose = () => {
    const actor = game.active; assert.ok(actor === owner || actor === spender);
    act(actor, { type: 'chooseBattle', territory, target: actor === owner ? spender : owner });
  };
  reach(state => state.phase === 6 && !state.battle && semutaCombatCapabilitiesClean(state));
  if (advanced) {
    const before = structuredClone(game), start = actions.length;
    assert.equal(semutaCombatCapabilitiesPlayer(game, owner).battleLosses, 0);
    choose(); game = finishSemutaCombatCapabilities(game, actions);
    const strong = leader(game, owner), weak = leader(game, spender, false);
    assert.equal(strong.strength, 5);
    act(owner, { type: 'battlePlan', leader: strong.id, dial: 3.5, support: 0 });
    act(spender, { type: 'battlePlan', leader: weak.id, dial: 0, support: 0 });
    reach(state => !state.battle && !state.pendingTreacheryDiscard);
    assert.equal(game.lastBattleContext?.winner, owner);
    assert.equal(semutaCombatCapabilitiesPlayer(game, owner).battleLosses, 7);
    assert.equal(semutaCombatCapabilitiesPlayer(game, owner).tanks, 7);
    assert.equal(semutaCombatCapabilitiesPlayer(game, owner).forces['arrakeen:10'], 3);
    earningBattle = { before, steps: structuredClone(actions.slice(start)), after: structuredClone(game) };
    reach(state => state.turn === 2 && state.phase === 5 && state.active === spender && semutaCombatCapabilitiesClean(state));
    territory = 'arrakeen'; sector = 10;
    shipments.push(transition(() => {
      act(spender, { type: 'ship', territory, sector, amount: 1, elite: 0, allyPayment: 0 });
      reach(semutaCombatCapabilitiesClean);
    }));
    act(spender, { type: 'endMovement' });
    reach(state => state.phase === 6 && !state.battle && semutaCombatCapabilitiesClean(state));
  }
  const beforeBattle = structuredClone(game), openingAt = actions.length;
  choose();
  const responseKind = advanced ? 'kwisatz' as const : 'eliteStrength' as const;
  reach(state => state.response?.kind === responseKind && state.response.owner === owner);
  assert.ok(game.battle && !game.battle.revealed);
  assert.equal(game.battle.territory, territory);
  assert.ok(semutaCombatCapabilitiesPlayer(game, holder).hand.some(card => card.id === SEMUTA_DRUG_ID));
  assert.ok(semutaCombatCapabilitiesPlayer(game, spender).hand.some(card => card.id === cost));
  if (!advanced) {
    assert.equal(semutaCombatCapabilitiesPlayer(game, owner).elites?.forces[location(territory, sector)], 1);
    assert.equal(viewGame(game, owner).battle?.ownForces?.eliteStrength, 2);
  }
  const traitorLeader = advanced ? semutaCombatCapabilitiesPlayer(game, owner).leaders.find(row =>
    semutaCombatCapabilitiesPlayer(game, spender).traitors.includes(row.id) && !row.dead) : undefined;
  if (advanced) assert.ok(traitorLeader, 'The original dealt Emperor Traitor supplies a real KH protection test');
  const ownerLeader = traitorLeader ?? leader(game, owner), opponentLeader = leader(game, spender, false);
  const ownerPlan: Action = { type: 'battlePlan', leader: ownerLeader.id, dial: 0, support: 0 };
  const opponentPlan: Action = { type: 'battlePlan', leader: opponentLeader.id, dial: 0, support: 0 };
  const allowedPlan: Action = advanced ? { ...ownerPlan, kwisatz: true } : { ...ownerPlan, dial: 2 };
  const canceledPlan: Action = advanced ? { ...ownerPlan, kwisatz: false } : { ...ownerPlan, dial: 1 };
  assert.deepEqual(semutaCombatCapabilitiesInventory(game), originalInventory);
  return { game, kind, responseKind, advanced, holder, spender, owner, richese, cost,
    semuta: SEMUTA_DRUG_ID, action: { type: 'card', card: cost, mode: 'cancel' } as Action,
    originalResponse: structuredClone(game.response!), originalBattle: structuredClone(game.battle!),
    beforeBattle, openingSteps: structuredClone(actions.slice(openingAt)), ownerPlan, opponentPlan, allowedPlan, canceledPlan,
    combatant: owner, opponent: spender,
    ownerLeader: ownerLeader.id, opponentLeader: opponentLeader.id, territory, sector,
    earningBattle, shipments, moves, setup, lobby, beforeStartingDeal, afterSetup, dealOrder,
    acquired, acquisition, originalInventory, originalSpice, actions, sourceActionCount: actions.length,
    staging: [
      'Only original unopened main/Spice positions and native scalar lotteries are selected. Original setup deals the printed Karama to Emperor and the real Shield to the capability owner; CHOAM buys the original cache Semuta for one spice.',
      advanced ? 'Actually move seven original Atreides counters out of Arrakeen, ship the opposing Emperor counter, allow native preparation, seal unarmed plans, decline both Traitor calls and finish the shared outcome. All seven dialed counters really enter Tanks; a later actual Arrakeen shipment creates the earned-KH battle.'
        : 'Original lobby circle choices give Emperor its combined turn first. Emperor actually ships the opposing desert counter; Ix actually pays to ship one Cyborg to Polar Sink, then moves that physical Cyborg into the occupied adjacent desert. Original HMS setup and every remaining native choice are retained.',
      'Stop before the actual capability counter cost. No battle, casualty, skill, hand, wallet, clock or pending control is installed. Later Semuta/preparation/plan choices remain real caller actions.',
    ] };
}
export type SemutaCombatCapabilitiesFixture = ReturnType<typeof createSemutaCombatCapabilitiesFixture>;
