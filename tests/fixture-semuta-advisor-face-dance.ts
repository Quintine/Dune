import assert from 'node:assert/strict';
import { applyAction, createGame, initializeSemutaGameForAudit, joinGame, newPlayer, viewGame, type Action, type Game } from '../game/engine';
import { traitorDeck } from '../game/traitors';
import { SEMUTA_DRUG_ID } from '../game/semuta-drug';
import { withClassicDiscoveryNexusLottery } from './fixture-discovery-classic-nexus';
import { advisorFaceDanceFlipTraitors } from './fixture-advisor-face-dance-flip';
import {
  actSemutaCombatCapabilities, nextSemutaCombatCapabilities,
  semutaCombatCapabilitiesPlayer, semutaCombatCapabilitiesInventory, semutaCombatCapabilitiesClean,
  passSemutaCombatCapabilities, claimSemutaCombatCapabilities,
} from './fixture-semuta-combat-capabilities';

export type SemutaAdvisorFaceDanceStep = { actor: string; action: Action };
export const actSemutaAdvisorFaceDance = actSemutaCombatCapabilities;
export const semutaAdvisorFaceDancePlayer = semutaCombatCapabilitiesPlayer;
export const semutaAdvisorFaceDanceInventory = semutaCombatCapabilitiesInventory;
export const semutaAdvisorFaceDanceClean = semutaCombatCapabilitiesClean;
export const semutaAdvisorFaceDanceTraitors = advisorFaceDanceFlipTraitors;
export const passSemutaAdvisorFaceDance = passSemutaCombatCapabilities;
export const claimSemutaAdvisorFaceDance = claimSemutaCombatCapabilities;
export const semutaAdvisorFaceDancePhysical = (game: Game) => game.players.map(p => ({
  id: p.id, forces: p.forces, reserves: p.reserves, tanks: p.tanks, elites: p.elites,
  leaders: p.leaders, battleLosses: p.battleLosses, faceDancers: p.faceDancers,
}));

/** Native controls only. Face Dance and a completed replacement's conversion
 * remain explicit caller choices; actual earlier Semuta groups receive passes. */
export function nextSemutaAdvisorFaceDance(game: Game): SemutaAdvisorFaceDanceStep | null {
  if (game.response?.automaticAdvisorFlip) return null;
  if (!game.response && !game.phaseOpening && !game.pendingTreacheryDiscard) {
    if (game.status === 'setup' && game.setupStage === 'prediction')
      return { actor: 'beneGesserit', action: { type: 'predict', faction: 'atreides', turn: 10 } };
    if (game.status === 'setup' && game.setupStage === 'traitors') {
      const p = game.players.find(p => p.traitorChoices.length); assert.ok(p);
      return { actor: p.id, action: { type: 'traitor', leader: p.traitorChoices[0] } };
    }
    const bg = game.players.find(p => p.faction === 'beneGesserit');
    if (game.status === 'setup' && game.setupStage === 'forces' && bg && !bg.advisorSetup)
      return { actor: bg.id, action: { type: 'advisorSetup', territory: 'arrakeen', sector: 10 } };
    const d = game.decision;
    if (d?.kind === 'faceDance') return null;
    if (d?.kind === 'advisorBattle' || d?.kind === 'advisor' || d?.kind === 'intrusion')
      return { actor: d.player, action: { type: 'decision', accept: false } };
    if (d?.kind === 'revivalStop' || d?.kind === 'fullPlanOffer')
      return { actor: d.player, action: { type: 'decision', decline: true } };
    if (d?.kind === 'fullPlanRead') return { actor: d.player, action: { type: 'decision', continue: true } };
  }
  return nextSemutaCombatCapabilities(game);
}
export const nextSemutaAdvisorFaceDanceStep = nextSemutaAdvisorFaceDance;
export function advanceSemutaAdvisorFaceDance(game: Game, until: (state: Game) => boolean,
  actions: SemutaAdvisorFaceDanceStep[] = []): Game {
  for (let count = 0; count < 3600; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished');
    const next = nextSemutaAdvisorFaceDance(game);
    assert.ok(next, `Supply the real Face Dance/private plan at ${game.turn}/${game.phase}/${game.decision?.kind}`);
    game = actSemutaAdvisorFaceDance(game, next.actor, next.action, actions);
  }
  throw Error('The native zero-stock Face Dance programme did not reach its finite boundary');
}
export function allowSemutaAdvisorFaceDance(game: Game, actions: SemutaAdvisorFaceDanceStep[] = []): Game {
  assert.ok(game.response?.automaticAdvisorFlip?.producer === 'faceDance');
  for (let count = 0; game.response?.automaticAdvisorFlip?.producer === 'faceDance' && count < game.players.length; count++) {
    const p = game.players.find(p => !game.response!.passed.includes(p.id)); assert.ok(p);
    game = actSemutaAdvisorFaceDance(game, p.id, { type: 'passResponse' }, actions);
  }
  assert.notEqual(game.response?.automaticAdvisorFlip?.producer, 'faceDance'); return game;
}
/** Complete only original aftermath/Collection entry; no new return, Face
 * Dance, shipment or battle declaration is made by this driver. */
export function finishSemutaAdvisorFaceDance(game: Game, actions: SemutaAdvisorFaceDanceStep[] = []): Game {
  assert.ok(!game.pendingTreacheryDiscard);
  return advanceSemutaAdvisorFaceDance(game, state => !state.battle && state.phase >= 7 && state.phase <= 8 &&
    semutaAdvisorFaceDanceClean(state), actions);
}

/** Select only the original finishSetup Face Dancer Fisher-Yates shuffle on
 * actual advisorSetup. The real engine deals the conserved physical cards. */
function dealOriginalFaceDancers(game: Game, step: SemutaAdvisorFaceDanceStep, actions: SemutaAdvisorFaceDanceStep[]) {
  assert.equal(game.status, 'setup'); assert.equal(game.setupStage, 'forces'); assert.equal(step.action.type, 'advisorSetup');
  assert.ok(game.players.every(p => !p.traitorChoices.length && !p.faceDancers));
  const held = new Set(game.players.flatMap(p => p.traitors));
  const original = traitorDeck(game.players, true).filter(id => !held.has(id));
  const first = ['tleilaxu-3', 'tleilaxu-4', 'atreides-0']; assert.ok(first.every(id => original.includes(id)));
  const order = [...first, ...original.filter(id => !first.includes(id))], current = [...original], scalars: number[] = [];
  for (let index = current.length - 1; index > 0; index--) {
    const from = current.indexOf(order[index]); assert.ok(from >= 0 && from <= index);
    scalars.push(Math.floor((from + 0.5) * 4294967296 / (index + 1)));
    [current[index], current[from]] = [current[from], current[index]];
  }
  assert.deepEqual(current, order);
  const descriptor = Object.getOwnPropertyDescriptor(crypto, 'getRandomValues');
  const native = crypto.getRandomValues.bind(crypto); let cursor = 0;
  crypto.getRandomValues = <V extends ArrayBufferView | null>(array: V): V => {
    if (array instanceof Uint32Array && array.length === 1) {
      assert.ok(cursor < scalars.length, 'Only the first actual Face Dancer shuffle consumes selected scalar entropy');
      array[0] = scalars[cursor++];
    } else Reflect.apply(native, crypto, [array]);
    return array;
  };
  try {
    const next = applyAction(game, step.actor, step.action); assert.equal(cursor, scalars.length);
    actions.push(structuredClone(step)); return { game: next, original, order, scalars };
  } finally {
    if (descriptor) Object.defineProperty(crypto, 'getRandomValues', descriptor);
    else Reflect.deleteProperty(crypto, 'getRandomValues');
  }
}

/** Real deferred bribes fund all twenty Tleilaxu reserves. The real losing
 * battle then leaves no reserve or board counter available for replacement. */
export function createSemutaAdvisorFaceDanceFixture() {
  const richese = 'richese', holder = 'choam', owner = 'beneGesserit', tleilaxu = 'tleilaxu', winner = 'atreides', spender = 'emperor';
  const territory = 'arrakeen', sector = 10, location = `${territory}:${sector}`;
  let game = createGame('SEMUTAADVISORFACEDANCE', newPlayer(richese, 'Richese', 'richese'), true, ['choam', 'ix']);
  for (const faction of ['choam', 'beneGesserit', 'tleilaxu', 'atreides', 'emperor'] as const)
    joinGame(game, newPlayer(faction, faction, faction));
  const initial = structuredClone(game), actions: SemutaAdvisorFaceDanceStep[] = [];
  const act = (actor: string, action: Action) => { game = actSemutaAdvisorFaceDance(game, actor, action, actions); };
  const reach = (until: (state: Game) => boolean) => { game = advanceSemutaAdvisorFaceDance(game, until, actions); };
  const transition = (run: () => void) => {
    const before = structuredClone(game), at = actions.length; run();
    return { before, steps: structuredClone(actions.slice(at)), after: structuredClone(game) };
  };
  for (const p of game.players) act(p.id, { type: 'ready' });
  const lobby = structuredClone(game);
  game = withClassicDiscoveryNexusLottery(() => initializeSemutaGameForAudit(game));
  const setup = structuredClone(game);
  assert.equal(game.status, 'setup'); assert.equal(game.advanced, true); assert.equal(game.semutaPreview, true);
  assert.ok(game.players.every(p => p.hand.length === 0 && !p.faceDancers));
  assert.ok(!game.homeworlds && !game.nexusCards && !game.leaderSkills && !game.techTokens &&
    !game.strongholdCards && !game.discoveryEnabled && !game.ecazTreachery);
  const originalInventory = semutaAdvisorFaceDanceInventory(game); assert.equal(originalInventory.length, 57);
  const originalTraitors = traitorDeck(game.players, true).sort();
  const printed = game.deck.find(card => card.effect === 'karama' && !card.id.startsWith('ix-')); assert.ok(printed);
  const ordinary = game.deck.filter(card => card.kind === 'projectile' || card.kind === 'poison').slice(0, 5);
  assert.equal(ordinary.length, 5); const selected = [...ordinary, printed];
  const dealOrder = selected.map((card, position) => {
    const from = game.deck.findIndex(candidate => candidate.id === card.id); assert.ok(from >= position);
    [game.deck[position], game.deck[from]] = [game.deck[from], game.deck[position]];
    return { card: card.id, position, from };
  });
  const beforeStartingDeal = structuredClone(game), cost = printed.id;
  let faceDancerDeal: ReturnType<typeof dealOriginalFaceDancers> | null = null;
  let advisorSetup: { before: Game; steps: SemutaAdvisorFaceDanceStep[]; after: Game } | null = null;
  for (let count = 0; game.status === 'setup' && count < 150; count++) {
    const next = nextSemutaAdvisorFaceDance(game); assert.ok(next);
    if (next.action.type === 'advisorSetup') {
      const before = structuredClone(game), at = actions.length;
      faceDancerDeal = dealOriginalFaceDancers(game, next, actions); game = faceDancerDeal.game;
      advisorSetup = { before, steps: structuredClone(actions.slice(at)), after: structuredClone(game) };
    } else act(next.actor, next.action);
  }
  assert.equal(game.status, 'playing'); assert.ok(faceDancerDeal && advisorSetup);
  const afterSetup = structuredClone(game);
  assert.deepEqual(game.players.flatMap(p => p.hand.map(card => card.id)), selected.map(card => card.id));
  assert.equal(semutaAdvisorFaceDancePlayer(game, owner).forces[location], 1);
  assert.ok(semutaAdvisorFaceDancePlayer(game, owner).advisors?.[territory]);
  assert.equal(semutaAdvisorFaceDancePlayer(game, winner).forces[location], 10);
  const dancers = structuredClone(semutaAdvisorFaceDancePlayer(game, tleilaxu).faceDancers!);
  const winningDisc = semutaAdvisorFaceDancePlayer(game, winner).leaders.filter(leader =>
    dancers.some(card => card.leader === leader.id && !card.revealed)).toSorted((a, b) => b.strength - a.strength)[0];
  const losingDisc = semutaAdvisorFaceDancePlayer(game, tleilaxu).leaders.toSorted((a, b) => a.strength - b.strength)[0];
  assert.ok(winningDisc && losingDisc); const winnerLeader = winningDisc.id, loserLeader = losingDisc.id;
  assert.deepEqual(semutaAdvisorFaceDanceTraitors(game), originalTraitors);
  const originalSpice = game.spiceDeck.map(card => JSON.stringify(card)).sort();
  const spiceOrder = [0, 1, 2, 3].map(position => {
    const from = game.spiceDeck.findIndex((card, index) => index >= position && 'territory' in card && !card.discovery);
    assert.ok(from >= position); const card = game.spiceDeck.splice(from, 1)[0]; game.spiceDeck.splice(position, 0, card);
    return { position, from, card: structuredClone(card) };
  });
  assert.deepEqual(game.spiceDeck.map(card => JSON.stringify(card)).sort(), originalSpice);
  let beforeBid: Game | undefined, bid: SemutaAdvisorFaceDanceStep | undefined, bidAt = -1;
  for (let count = 0; count < 1000 && !semutaAdvisorFaceDancePlayer(game, holder).hand.some(card => card.id === SEMUTA_DRUG_ID); count++) {
    const next = nextSemutaAdvisorFaceDance(game); assert.ok(next);
    if (next.actor === holder && next.action.type === 'richeseBid' && next.action.amount === 1) {
      beforeBid = structuredClone(game); bid = structuredClone(next); bidAt = actions.length;
    }
    act(next.actor, next.action);
  }
  assert.ok(beforeBid && bid && bidAt >= 0);
  const acquired = structuredClone(game), acquisition = { before: beforeBid, bid,
    steps: structuredClone(actions.slice(bidAt)), after: acquired, price: 1 };
  reach(state => state.turn === 1 && state.phase === 5 && semutaAdvisorFaceDanceClean(state));
  const funding = transition(() => {
    act(winner, { type: 'bribe', target: tleilaxu, amount: 9 });
    act(spender, { type: 'bribe', target: tleilaxu, amount: 10 });
  });
  assert.equal(semutaAdvisorFaceDancePlayer(game, tleilaxu).bribes, 19);
  reach(state => state.turn === 1 && state.phase === 7 && semutaAdvisorFaceDanceClean(state));
  const fundingCollection = transition(() => {
    reach(state => state.turn === 1 && state.phase === 8 && semutaAdvisorFaceDanceClean(state));
  });
  assert.equal(semutaAdvisorFaceDancePlayer(game, tleilaxu).bribes, 0);
  assert.equal(semutaAdvisorFaceDancePlayer(game, tleilaxu).spice - semutaAdvisorFaceDancePlayer(fundingCollection.before, tleilaxu).spice, 19);
  reach(state => state.turn === 2 && state.phase === 5 && state.active === tleilaxu && semutaAdvisorFaceDanceClean(state));
  assert.equal(semutaAdvisorFaceDancePlayer(game, tleilaxu).reserves, 20);
  const shipment = transition(() => {
    act(tleilaxu, { type: 'ship', territory, sector, amount: 20, elite: 0, allyPayment: 0 });
    reach(semutaAdvisorFaceDanceClean);
  });
  assert.equal(semutaAdvisorFaceDancePlayer(shipment.before, tleilaxu).spice - semutaAdvisorFaceDancePlayer(game, tleilaxu).spice, 20);
  assert.equal(semutaAdvisorFaceDancePlayer(game, tleilaxu).reserves, 0);
  assert.equal(semutaAdvisorFaceDancePlayer(game, tleilaxu).forces[location], 20);
  reach(state => state.turn === 2 && state.phase === 6 && semutaAdvisorFaceDanceClean(state) && !!state.active);
  const beforeBattle = structuredClone(game), choice = viewGame(game, game.active!).battleChoices.find(row => row.territory === territory);
  assert.ok(choice); const battleAction: Action = { type: 'chooseBattle', territory,
    target: choice.attacker === choice.chooser ? choice.defender : choice.attacker };
  act(choice.chooser, battleAction);
  reach(state => !!state.battle && semutaAdvisorFaceDanceClean(state) && !state.battle.preparation &&
    state.battle.preLeader?.closed !== false);
  const beforePlans = structuredClone(game), planSteps: SemutaAdvisorFaceDanceStep[] = [
    { actor: winner, action: { type: 'battlePlan', leader: winnerLeader, dial: 1, support: 1, weapon: null, defense: null } },
    { actor: tleilaxu, action: { type: 'battlePlan', leader: loserLeader, dial: 0, support: 0, weapon: null, defense: null } },
  ];
  for (const step of planSteps) act(step.actor, step.action);
  const revealed = structuredClone(game), cleanupAt = actions.length;
  reach(state => !state.response && !state.phaseOpening && state.decision?.kind === 'faceDance');
  assert.ok(game.decision?.kind === 'faceDance'); assert.equal(game.decision.player, tleilaxu);
  assert.equal(game.decision.winner, winner); assert.equal(game.decision.identity, winnerLeader);
  assert.equal(semutaAdvisorFaceDancePlayer(game, tleilaxu).reserves, 0);
  assert.equal(Object.values(semutaAdvisorFaceDancePlayer(game, tleilaxu).forces).reduce((a, b) => a + b, 0), 0);
  assert.equal(semutaAdvisorFaceDancePlayer(game, tleilaxu).tanks, 20);
  assert.equal(semutaAdvisorFaceDancePlayer(game, winner).forces[location], 9);
  const cleanup = { before: revealed, steps: structuredClone(actions.slice(cleanupAt)), after: structuredClone(game) };
  const faceDanceAction: Action = { type: 'decision', reveal: true, sources: {}, sector };
  const replacement = transition(() => { act(tleilaxu, faceDanceAction); });
  assert.ok(game.response?.automaticAdvisorFlip?.producer === 'faceDance');
  const automatic = game.response.automaticAdvisorFlip;
  assert.equal(automatic.faceDance.amount, 0); assert.deepEqual(automatic.faceDance.sources, {});
  assert.deepEqual(automatic.faceDance.returned, { [winner]: 9 });
  assert.equal(semutaAdvisorFaceDancePlayer(game, winner).forces[location] ?? 0, 0);
  assert.equal(semutaAdvisorFaceDancePlayer(game, winner).reserves, semutaAdvisorFaceDancePlayer(replacement.before, winner).reserves + 9);
  assert.equal(semutaAdvisorFaceDancePlayer(game, tleilaxu).faceDancers!.find(card => card.leader === winnerLeader)?.revealed, true);
  assert.equal(game.battle, null); assert.equal(game.pendingFaceDance, null);
  assert.deepEqual(semutaAdvisorFaceDanceInventory(game), originalInventory);
  assert.deepEqual(semutaAdvisorFaceDanceTraitors(game), originalTraitors);
  return { game, kind: 'advisorFlip' as const, advanced: true as const, zeroReplacement: true as const,
    richese, holder, owner, tleilaxu, winner, spender, cost, karama: cost, semuta: SEMUTA_DRUG_ID,
    action: { type: 'card', card: cost, mode: 'cancel' } as Action,
    originalResponse: structuredClone(game.response), originalAutomaticSource: structuredClone(automatic),
    originalParent: structuredClone(game.pendingAutomaticAdvisorFaceDance!), originalQueue: structuredClone(game.pendingAutomaticAdvisorFlips!),
    originalPhysical: structuredClone(semutaAdvisorFaceDancePhysical(game)), originalStance: structuredClone(semutaAdvisorFaceDancePlayer(game, owner).advisors!),
    originalBattle: structuredClone(revealed.battle!), originalBattleContext: structuredClone(game.lastBattleContext!),
    originalBalances: game.players.map(p => ({ id: p.id, spice: p.spice })), originalDeck: structuredClone(game.deck),
    originalFaceDancers: structuredClone(semutaAdvisorFaceDancePlayer(game, tleilaxu).faceDancers!),
    territory, location, sector, winnerLeader, loserLeader, faceDanceAction, battleAction, choice,
    initial, lobby, setup, beforeStartingDeal, afterSetup, advisorSetup,
    faceDancerDeal: { original: faceDancerDeal.original, order: faceDancerDeal.order, scalars: faceDancerDeal.scalars,
      before: advisorSetup.before, steps: advisorSetup.steps, after: advisorSetup.after },
    dancers, dealOrder, deal: selected.map(card => card.id), originalInventory, originalTraitors, originalSpice, spiceOrder,
    acquisition, acquired, cache: acquisition, funding, fundingCollection, fuel: { funding, fundingCollection, shipment },
    shipment, beforeBattle, beforePlans, planSteps, revealed, cleanup, replacement,
    actions, steps: actions, sourceActionCount: actions.length,
    staging: [
      'Original undealt Advanced R/C/BG/T/A/E Semuta initializer with native CHOAM/Ix decks and no other module. Actual BG setup places one advisor beside original Atreides10. Only unopened main/Spice positions and native scalar lotteries are selected; C buys cache1 Semuta and E is dealt printed Karama.',
      'The actual final setup advisor action consumes a selected conserved permutation of the original Face Dancer shuffle: T3/T4/A0 first. All actual private Traitor choices precede it; the engine physically deals all three unrevealed cards. The winning leader is selected from that actual matching living hand.',
      'At clean first movement A really bribes T9 and E really bribes T10. The nineteen deferred spice becomes spendable only through real Mentat collection; T’s native five then funds the actual turn2 city shipment of all twenty reserves for twenty spice. No stock or wallet is installed.',
      'The actual unarmed Arrakeen battle uses winning A leader5/dial1/support1 and weak T leader/dial0. All twenty T counters really enter Tanks; A retains nine. Native preparation, Traitor declines, final outcome and cleanup remain real actions; earlier Semuta offers are passed so C retains Drug.',
      'T has no reserve or board counter left, then actually reveals its held matching Face Dancer with sources{}. Real replacement returns A9, kills its leader, spends the physical Face Dancer and leaves original BG alone. Stop at the resulting native mandatory conversion before printed Karama cost.',
    ] };
}
export type SemutaAdvisorFaceDanceFixture = ReturnType<typeof createSemutaAdvisorFaceDanceFixture>;
