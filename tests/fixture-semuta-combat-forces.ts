import assert from 'node:assert/strict';
import { createGame, initializeSemutaGameForAudit, joinGame, newPlayer, viewGame, type Action, type Game } from '../game/engine';
import { TERRITORIES } from '../game/board';
import { quoteCombatResponse } from '../game/combat-response-quote';
import { SEMUTA_DRUG_ID } from '../game/semuta-drug';
import { withClassicDiscoveryNexusLottery } from './fixture-discovery-classic-nexus';
import {
  actSemutaDisasterWorm, nextSemutaDisasterWorm, passSemutaDisasterWorm, claimSemutaDisasterWorm,
  semutaDisasterWormPlayer, semutaDisasterWormInventory, semutaDisasterWormClean,
} from './fixture-semuta-disaster-worm';

export type SemutaCombatForcesKind = 'eliteStrength' | 'fremenSupport' | 'choamBattleAid';
export type SemutaCombatForcesStep = { actor: string; action: Action };
export const actSemutaCombatForces = actSemutaDisasterWorm;
export const passSemutaCombatForces = passSemutaDisasterWorm;
export const claimSemutaCombatForces = claimSemutaDisasterWorm;
export const semutaCombatForcesPlayer = semutaDisasterWormPlayer;
export const semutaCombatForcesInventory = semutaDisasterWormInventory;
export const semutaCombatForcesClean = semutaDisasterWormClean;
export const semutaCombatForcesPhysical = (game: Game) => ({
  players: game.players.map(p => ({ id: p.id, spice: p.spice, forces: p.forces, elites: p.elites,
    reserves: p.reserves, tanks: p.tanks, shipped: p.shipped, moved: p.moved, ally: p.ally })),
  aid: game.aid, spice: game.spice,
});

/** Native controls only; no plan, new card play or fresh reaction is selected.
 * The sole real mutual CHOAM alliance earns a positive one-spice pledge. */
export function nextSemutaCombatForces(game: Game): SemutaCombatForcesStep | null {
  if (game.pendingTreacheryDiscard || game.truthtrance) return null;
  if (!game.phaseOpening && !game.response && game.decision?.kind === 'choamBattleFunding')
    return { actor: game.decision.player, action: { type: 'decision', amount: 1 } };
  return nextSemutaDisasterWorm(game);
}
export const nextSemutaCombatForcesStep = nextSemutaCombatForces;
export function advanceSemutaCombatForces(game: Game, until: (state: Game) => boolean,
  actions: SemutaCombatForcesStep[] = []): Game {
  for (let count = 0; count < 2200; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished');
    const step = nextSemutaCombatForces(game);
    assert.ok(step, `Supply the original private plan/fresh control at ${game.turn}/${game.phase}/${game.decision?.kind}`);
    game = actSemutaCombatForces(game, step.actor, step.action, actions);
  }
  throw Error('The native force-power programme did not reach its finite boundary');
}
/** Allow this one actual check; later checks remain available to finish. */
export function allowSemutaCombatForces(game: Game, actions: SemutaCombatForcesStep[] = []): Game {
  const response = game.response; assert.ok(response);
  assert.ok(response.kind === 'eliteStrength' || response.kind === 'fremenSupport' || response.kind === 'choamBattleAid');
  for (let count = 0; game.response?.kind === response.kind && game.response.owner === response.owner && count < game.players.length; count++) {
    const actor = game.players.find(p => !game.response!.passed.includes(p.id)); assert.ok(actor);
    game = actSemutaCombatForces(game, actor.id, { type: 'passResponse' }, actions);
  }
  return game;
}
/** Complete only native remaining checks/preparation, then stop before any
 * private plan is sealed or support is paid. */
export function finishSemutaCombatForces(game: Game, actions: SemutaCombatForcesStep[] = []): Game {
  return advanceSemutaCombatForces(game, state => !!state.battle && !state.battle.revealed &&
    semutaCombatForcesClean(state) && !state.battle.preparation && state.battle.preLeader?.closed !== false, actions);
}

/** Genuine Advanced native elites/support/aid. Semuta is paid cache1; all
 * physical counters and the CHOAM alliance arise through original actions. */
export function createSemutaCombatForcesFixture(options: {
  kind?: SemutaCombatForcesKind; eliteOwner?: 'fremen' | 'emperor';
} = {}) {
  const kind = options.kind ?? 'eliteStrength', eliteOwner = options.eliteOwner ?? 'fremen';
  const richese = 'richese', holder = 'choam', fremen = 'fremen', emperor = 'emperor', spender = 'guild';
  const combatant = kind === 'fremenSupport' ? fremen : kind === 'choamBattleAid' ? emperor : eliteOwner;
  const owner = kind === 'choamBattleAid' ? holder : combatant, opponent = richese;
  const territory = 'the_great_flat', sector = 15, location = `${territory}:${sector}`;
  let game = createGame('SEMUTACOMBATFORCES', newPlayer(richese, 'Richese', 'richese'), true, ['choam']);
  for (const faction of ['choam', 'fremen', 'emperor', 'guild'] as const) joinGame(game, newPlayer(faction, faction, faction));
  const initial = structuredClone(game), actions: SemutaCombatForcesStep[] = [];
  const act = (actor: string, action: Action) => { game = actSemutaCombatForces(game, actor, action, actions); };
  const reach = (until: (state: Game) => boolean) => { game = advanceSemutaCombatForces(game, until, actions); };
  const transition = (run: () => void) => {
    const before = structuredClone(game), at = actions.length; run();
    return { before, steps: structuredClone(actions.slice(at)), after: structuredClone(game) };
  };
  for (const p of game.players) act(p.id, { type: 'ready' });
  const lobby = structuredClone(game);
  game = withClassicDiscoveryNexusLottery(() => initializeSemutaGameForAudit(game));
  const setup = structuredClone(game), initialization = { before: lobby, after: setup, entry: 'original-undealt-advanced-semuta-preview' };
  assert.equal(game.status, 'setup'); assert.equal(game.advanced, true); assert.equal(game.semutaPreview, true);
  assert.ok(game.players.every(p => p.hand.length === 0));
  assert.ok(!game.homeworlds && !game.nexusCards && !game.leaderSkills && !game.techTokens &&
    !game.strongholdCards && !game.discoveryEnabled && !game.ecazTreachery);
  const originalInventory = semutaCombatForcesInventory(game); assert.equal(originalInventory.length, 45);
  const karamas = game.deck.filter(card => card.effect === 'karama'); assert.equal(karamas.length, 2);
  const ordinary = game.deck.filter(card => card.kind === 'projectile').slice(0, 3); assert.equal(ordinary.length, 3);
  const selected = [ordinary[0], ordinary[1], ordinary[2], karamas[1], karamas[0]];
  const dealOrder = selected.map((card, position) => {
    const from = game.deck.findIndex(candidate => candidate.id === card.id); assert.ok(from >= position);
    [game.deck[position], game.deck[from]] = [game.deck[from], game.deck[position]];
    return { position, from, card: card.id };
  });
  const beforeStartingDeal = structuredClone(game);
  reach(state => state.status === 'playing');
  const afterSetup = structuredClone(game), cost = karamas[0].id, independentKarama = karamas[1].id;
  assert.deepEqual(game.players.flatMap(p => p.hand.map(card => card.id)), selected.map(card => card.id));
  assert.equal(semutaCombatForcesPlayer(game, fremen).elites?.reserves, 3);
  assert.equal(semutaCombatForcesPlayer(game, emperor).elites?.reserves, 5);
  const originalSpice = game.spiceDeck.map(card => JSON.stringify(card)).sort();
  const spiceOrder: { turn: number; position: number; from: number; card: Game['spiceDeck'][number] }[] = [];
  const orderSpice = (faces: string[]) => {
    for (let position = 0; position < faces.length; position++) {
      const face = faces[position];
      const from = game.spiceDeck.findIndex((card, index) => index >= position &&
        (face === 'worm' ? 'worm' in card && !card.suppressed && !card.thumper && !card.greatMaker
          : 'territory' in card && card.territory === face && !card.discovery));
      assert.ok(from >= position, `Choose the original still-unopened ${face} Spice Card`);
      const card = game.spiceDeck.splice(from, 1)[0]; game.spiceDeck.splice(position, 0, card);
      spiceOrder.push({ turn: game.turn, position, from, card: structuredClone(card) });
    }
  };
  orderSpice(['funeral_plain', 'hagga_basin']);
  let beforeBid: Game | undefined, bid: SemutaCombatForcesStep | undefined, bidAt = -1;
  for (let count = 0; count < 900 && !semutaCombatForcesPlayer(game, holder).hand.some(card => card.id === SEMUTA_DRUG_ID); count++) {
    const step = nextSemutaCombatForces(game); assert.ok(step);
    if (step.actor === holder && step.action.type === 'richeseBid' && step.action.amount === 1) {
      beforeBid = structuredClone(game); bid = structuredClone(step); bidAt = actions.length;
    }
    act(step.actor, step.action);
  }
  assert.ok(beforeBid && bid && bidAt >= 0);
  const acquired = structuredClone(game), acquisition = { before: beforeBid, bid,
    steps: structuredClone(actions.slice(bidAt)), after: acquired, price: 1 };
  assert.equal(semutaCombatForcesPlayer(beforeBid, holder).spice - semutaCombatForcesPlayer(game, holder).spice, 1);
  let alliance: { before: Game; steps: SemutaCombatForcesStep[]; after: Game } | null = null;
  if (kind === 'choamBattleAid') {
    reach(state => state.turn === 2 && state.phase === 1 && semutaCombatForcesClean(state) &&
      !state.spiceSequence && !state.spiceResolution && !state.spiceWindow && !state.nexus && state.ready.length === 0);
    orderSpice(['worm', 'the_great_flat', 'broken_land']);
    reach(state => state.turn === 2 && state.phase === 1 && state.nexus && !state.spiceWindow &&
      !state.spiceResolution && semutaCombatForcesClean(state));
    alliance = transition(() => {
      act(holder, { type: 'alliance', target: emperor }); act(emperor, { type: 'alliance', target: holder });
    });
    assert.equal(semutaCombatForcesPlayer(game, holder).ally, emperor);
    assert.equal(semutaCombatForcesPlayer(game, emperor).ally, holder);
  }
  const turn = kind === 'choamBattleAid' ? 2 : 1;
  reach(state => state.turn === turn && state.phase === 5 && semutaCombatForcesClean(state));
  const shipments: { actor: string; amount: number; elite: number; cost: number; before: Game;
    steps: SemutaCombatForcesStep[]; after: Game }[] = [];
  for (let count = 0; game.turn === turn && game.phase === 5 && count < 160; count++) {
    if (semutaCombatForcesClean(game) && (game.active === combatant || game.active === opponent) &&
        !semutaCombatForcesPlayer(game, game.active!).shipped) {
      const actor = game.active!, elite = Number(actor === combatant), paid = actor === fremen ? 0 : 2;
      const shipment = transition(() => {
        act(actor, { type: 'ship', territory, sector, amount: 1, elite, allyPayment: 0 });
        reach(semutaCombatForcesClean);
      });
      assert.equal(semutaCombatForcesPlayer(shipment.before, actor).spice - semutaCombatForcesPlayer(game, actor).spice, paid);
      shipments.push({ actor, amount: 1, elite, cost: paid, ...shipment });
    } else {
      const step = nextSemutaCombatForces(game); assert.ok(step); act(step.actor, step.action);
    }
  }
  assert.equal(shipments.length, 2);
  assert.equal(semutaCombatForcesPlayer(game, combatant).forces[location], 1);
  assert.equal(semutaCombatForcesPlayer(game, combatant).elites?.forces[location], 1);
  assert.equal(semutaCombatForcesPlayer(game, opponent).forces[location], 1);
  reach(state => state.turn === turn && state.phase === 6 && semutaCombatForcesClean(state) && !!state.active);
  const beforeBattle = structuredClone(game), choice = viewGame(game, game.active!).battleChoices.find(candidate =>
    candidate.territory === territory && [candidate.attacker, candidate.defender].includes(combatant) &&
    [candidate.attacker, candidate.defender].includes(opponent));
  assert.ok(choice); assert.equal(choice.chooser, game.active);
  const battleAction: Action = { type: 'chooseBattle', territory,
    target: choice.attacker === choice.chooser ? choice.defender : choice.attacker };
  act(choice.chooser, battleAction);
  const earlierControls = transition(() => { reach(state => state.response?.kind === kind && state.response.owner === owner); });
  assert.ok(game.battle && !game.battle.revealed && game.response);
  assert.equal(game.response.kind, kind); assert.equal(game.response.owner, owner);
  assert.ok(!game.phaseOpening && !game.decision && !game.pendingTreacheryDiscard);
  assert.deepEqual(game.battle.plans, {});
  const originalResponse = structuredClone(game.response), originalBattle = structuredClone(game.battle);
  const expected = quoteCombatResponse({ status: game.status, phase: game.phase, advanced: game.advanced,
    turn: game.turn, territoryIds: TERRITORIES.map(t => t.id), players: game.players, battle: game.battle },
  { kind: 'response', response: { kind, owner }, canceled: true });
  const ownLeader = semutaCombatForcesPlayer(game, combatant).leaders.filter(l => !l.dead)
    .sort((a, b) => b.strength - a.strength || a.id.localeCompare(b.id))[0];
  const otherLeader = semutaCombatForcesPlayer(game, opponent).leaders.filter(l => !l.dead)
    .sort((a, b) => a.strength - b.strength || a.id.localeCompare(b.id))[0];
  assert.ok(ownLeader && otherLeader);
  const allowedPlan: Action = { type: 'battlePlan', leader: ownLeader.id, dial: 2,
    support: combatant === fremen ? 0 : 1, allyPayment: kind === 'choamBattleAid' ? 1 : 0, weapon: null, defense: null };
  const canceledPlan: Action = { ...allowedPlan,
    ...(kind === 'eliteStrength' ? { dial: 1 } : kind === 'fremenSupport' ? { support: 1 } : { allyPayment: 0 }) };
  const opponentPlan: Action = { type: 'battlePlan', leader: otherLeader.id, dial: 0, support: 0,
    allyPayment: 0, weapon: null, defense: null };
  const source = structuredClone(game), action: Action = { type: 'card', card: cost, mode: 'cancel' };
  assert.ok(semutaCombatForcesPlayer(game, holder).hand.some(card => card.id === SEMUTA_DRUG_ID));
  assert.ok(semutaCombatForcesPlayer(game, spender).hand.some(card => card.id === cost));
  assert.deepEqual(semutaCombatForcesInventory(game), originalInventory);
  return { game, source, beforeCost: source, kind, eliteOwner, advanced: true as const, holder, spender, owner,
    recipient: combatant, combatant, opponent, richese, fremen, emperor, guild: spender, cost, karama: cost,
    independentKarama, semuta: SEMUTA_DRUG_ID, action, originalResponse, originalBattle, expected,
    originalPhysical: structuredClone(semutaCombatForcesPhysical(game)), territory, sector, location, turn,
    allowedPlan, canceledPlan, opponentPlan, ownLeader: ownLeader.id, opponentLeader: otherLeader.id,
    initial, lobby, setup, initialization, beforeStartingDeal, afterSetup, deal: selected.map(card => card.id), dealOrder,
    originalInventory, originalSpice, spiceOrder, acquisition, acquired, alliance, shipments, beforeBattle,
    battleAction, choice, earlierControls, originalAid: structuredClone(game.aid),
    actions, steps: actions, sourceActions: actions, sourceActionCount: actions.length,
    staging: [
      'Original Advanced Semuta preview initializer runs on the genuinely ready undealt R/C/F/E/G lobby, main35/cache10 and no optional modules. Only unopened starting-card/Spice positions and scalar lotteries are selected. No Basic-to-Advanced conversion.',
      'Guild and Emperor each receive a distinct original printed Karama. CHOAM really buys cache Semuta for one. Fremen really places ten normals in Sietch Tabr and retains three original reserve Fedaykin; Emperor retains five original reserve Sardaukar.',
      'Richese has no starting garrison: it actually pays two to ship one normal to Great Flat15. The actual opposing combatant really ships one original elite there: Fremen free entry, or Emperor paid two. Native unused turns, Guild timing and income responses complete normally.',
      kind === 'choamBattleAid' ? 'First-turn movement is really skipped. An original turn2 worm on the empty first Funeral pile earns Nexus; CHOAM and Emperor actually propose/accept alliance. Both real turn2 shipments and the original battle declaration earn native CHOAM funding1. Its earlier Emperor elite check is actually allowed before the aid response.' : kind === 'fremenSupport' ? 'At the actual first-turn unarmed/unsealed battle, the earlier Fedaykin strength check receives real passes before the free-support response.' : 'The first actual unrevealed battle reaches its native positive elite-strength check. Emperor faces Richese, never Fremen; the printed against-Fremen exclusion is preserved.',
      'Stop before Guild spends its originally dealt printed Karama. No played hand, wallet, force, elite, phase, alliance, plan, battle, response or power queue is installed. Helpers finish native remaining checks and stop before private plans or support payments.',
    ],
  };
}
export type SemutaCombatForcesFixture = ReturnType<typeof createSemutaCombatForcesFixture>;
