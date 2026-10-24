import assert from 'node:assert/strict';
import { applyAction, createGame, joinGame, newPlayer, viewGame, type Action, type Game } from '../game/engine';
import { traitorDeck } from '../game/traitors';
import {
  actAdvisorPreparation, advisorPreparationClean, advisorPreparationInventory,
  advisorPreparationPlayer, nextAdvisorPreparationStep,
} from './fixture-advisor-preparation';

export type AdvisorFaceDanceFlipStep = { actor: string; action: Action };
export type AdvisorFaceDanceFlipTransition = { before: Game; steps: AdvisorFaceDanceFlipStep[]; after: Game };
export const actAdvisorFaceDanceFlip = actAdvisorPreparation;
export const advisorFaceDanceFlipClean = advisorPreparationClean;
export const advisorFaceDanceFlipInventory = advisorPreparationInventory;
export const advisorFaceDanceFlipPlayer = advisorPreparationPlayer;
export const advisorFaceDanceFlipTraitors = (game: Game) => {
  const identities = [...(game.traitorReserve ?? []), ...game.players.flatMap(player =>
    [...player.traitors, ...player.traitorChoices, ...(player.faceDancers ?? []).map(card => card.leader)])];
  assert.equal(new Set(identities).size, identities.length, 'Each original Traitor/Face Dancer retains one physical slot');
  return identities.sort();
};

/** Original native continuations never reveal the Face Dancer or pass the new
 * conversion. Optional preparation and unused special inspection are declined. */
export function nextAdvisorFaceDanceFlip(game: Game): AdvisorFaceDanceFlipStep | null {
  if (game.response?.automaticAdvisorFlip) return null;
  if (!game.phaseOpening && !game.response && !game.pendingTreacheryDiscard) {
    const decision = game.decision;
    if (decision?.kind === 'faceDance') return null;
    if (decision?.kind === 'advisorBattle')
      return { actor: decision.player, action: { type: 'decision', accept: false } };
    if (decision?.kind === 'revivalStop' || decision?.kind === 'fullPlanOffer')
      return { actor: decision.player, action: { type: 'decision', decline: true } };
    if (decision?.kind === 'fullPlanRead')
      return { actor: decision.player, action: { type: 'decision', continue: true } };
    if (game.status === 'setup' && game.setupStage === 'traitors') {
      const player = game.players.find(candidate => candidate.traitorChoices.length); assert.ok(player);
      return { actor: player.id, action: { type: 'traitor', leader: player.traitorChoices[0] } };
    }
  }
  return nextAdvisorPreparationStep(game);
}
export function advanceAdvisorFaceDanceFlip(game: Game, until: (state: Game) => boolean,
  steps: AdvisorFaceDanceFlipStep[] = []): Game {
  for (let count = 0; count < 1800; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished', 'The original Face Dance chronology ended before its requested boundary');
    const next = nextAdvisorFaceDanceFlip(game);
    assert.ok(next, `Choose the original Face Dance/conversion/private plan at ${game.turn}/${game.phase}/${game.decision?.kind}`);
    game = actAdvisorFaceDanceFlip(game, next.actor, next.action, steps);
  }
  throw Error('The native advisor Face Dance source did not reach its finite boundary');
}
export function passAdvisorFaceDanceFlip(game: Game, steps: AdvisorFaceDanceFlipStep[] = []): Game {
  for (let count = 0; game.response && !game.response.automaticAdvisorFlip && count < 60; count++) {
    const actor = game.players.find(player => !game.response!.passed.includes(player.id)); assert.ok(actor);
    game = actAdvisorFaceDanceFlip(game, actor.id, { type: 'passResponse' }, steps);
  }
  assert.ok(!game.response || game.response.automaticAdvisorFlip); return game;
}

/** Select only the first native Face Dancer shuffle in the actual final setup
 * action. No held card, dealt identity or revealed status is ever assigned. */
function dealOriginalFaceDancers(game: Game, step: AdvisorFaceDanceFlipStep,
  steps: AdvisorFaceDanceFlipStep[]) {
  assert.equal(game.status, 'setup'); assert.equal(game.setupStage, 'forces');
  assert.equal(step.action.type, 'advisorSetup');
  assert.ok(game.players.every(player => !player.traitorChoices.length && !player.faceDancers));
  const held = new Set(game.players.flatMap(player => player.traitors));
  const original = traitorDeck(game.players, true).filter(identity => !held.has(identity));
  const first = ['tleilaxu-3', 'tleilaxu-4', 'atreides-0'];
  assert.ok(first.every(identity => original.includes(identity)));
  const order = [...first, ...original.filter(identity => !first.includes(identity))];
  const current = [...original], scalars: number[] = [];
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
      assert.ok(cursor < scalars.length, 'Only the first actual Face Dancer shuffle uses selected scalar entropy');
      array[0] = scalars[cursor++];
    } else Reflect.apply(native, crypto, [array]);
    return array;
  };
  try {
    const next = applyAction(game, step.actor, step.action);
    assert.equal(cursor, scalars.length, 'The original Face Dancer shuffle consumes its selected permutation once');
    steps.push(structuredClone(step)); return { game: next, original, order, scalars };
  } finally {
    if (descriptor) Object.defineProperty(crypto, 'getRandomValues', descriptor);
    else Reflect.deleteProperty(crypto, 'getRandomValues');
  }
}

/** Public Advanced BG/Tleilaxu/Atreides, in that original seat order. Native
 * setup/deals, paid shipment and ground movement earn one real battle and its
 * private Face Dance opportunity. Stop BEFORE the original reveal action. */
export function createAdvisorFaceDanceFlipFixture(options: { zeroReplacement?: boolean } = {}) {
  const zeroReplacement = options.zeroReplacement ?? false;
  const bg = 'beneGesserit', tleilaxu = 'tleilaxu', holder = 'atreides';
  const territory = 'arrakeen', location = 'arrakeen:10', battleTerritory = zeroReplacement ? territory : 'imperial_basin';
  let game = createGame('ADVISORFACEDANCEFLIP', newPlayer(bg, 'Bene Gesserit', 'beneGesserit'), true, ['ix']);
  joinGame(game, newPlayer(tleilaxu, 'Tleilaxu', 'tleilaxu'));
  joinGame(game, newPlayer(holder, 'Atreides', 'atreides'));
  const initial = structuredClone(game), steps: AdvisorFaceDanceFlipStep[] = [];
  const act = (actor: string, action: Action) => { game = actAdvisorFaceDanceFlip(game, actor, action, steps); };
  const reach = (until: (state: Game) => boolean) => { game = advanceAdvisorFaceDanceFlip(game, until, steps); };
  const transition = (run: () => void): AdvisorFaceDanceFlipTransition => {
    const before = structuredClone(game), start = steps.length; run();
    return { before, steps: structuredClone(steps.slice(start)), after: structuredClone(game) };
  };
  for (const player of game.players) act(player.id, { type: 'ready' });
  const lobby = structuredClone(game); act(game.host, { type: 'start', advancedPreview: true });
  const setup = structuredClone(game);
  assert.equal(game.status, 'setup'); assert.equal(game.advanced, true);
  assert.deepEqual(game.players.map(player => player.faction), [bg, tleilaxu, holder]);
  assert.deepEqual(game.expansions, ['ix']);
  assert.ok(!game.homeworlds && !game.nexusCards && !game.leaderSkills && !game.techTokens &&
    !game.strongholdCards && !game.discoveryEnabled && !game.ecazTreachery);
  assert.ok(game.players.every(player => !player.hand.length && !player.faceDancers));
  const originalInventory = advisorFaceDanceFlipInventory(game); assert.equal(originalInventory.length, 47);
  const originalTraitors = traitorDeck(game.players, true).sort();
  const karama = game.deck.find(card => card.effect === 'karama'); assert.ok(karama);
  const ordinary = game.deck.filter(card => ['projectile', 'poison', 'shield', 'snooper'].includes(card.kind)).slice(0, 2);
  assert.equal(ordinary.length, 2);
  const selected = [ordinary[0], ordinary[1], karama];
  const dealOrder = selected.map((card, position) => {
    const from = game.deck.findIndex(candidate => candidate.id === card.id); assert.ok(from >= position);
    [game.deck[position], game.deck[from]] = [game.deck[from], game.deck[position]];
    return { position, from, card: card.id };
  });
  const beforeStartingDeal = structuredClone(game);
  let advisorSetup: AdvisorFaceDanceFlipTransition | null = null;
  let faceDancerDeal: ReturnType<typeof dealOriginalFaceDancers> | null = null;
  for (let count = 0; game.status === 'setup' && count < 100; count++) {
    const next = nextAdvisorFaceDanceFlip(game); assert.ok(next);
    if (next.action.type === 'advisorSetup') {
      const before = structuredClone(game), start = steps.length;
      faceDancerDeal = dealOriginalFaceDancers(game, next, steps); game = faceDancerDeal.game;
      advisorSetup = { before, steps: structuredClone(steps.slice(start)), after: structuredClone(game) };
    } else act(next.actor, next.action);
  }
  assert.equal(game.status, 'playing'); assert.ok(advisorSetup && faceDancerDeal);
  const afterSetup = structuredClone(game);
  assert.deepEqual(game.players.flatMap(player => player.hand.map(card => card.id)), selected.map(card => card.id));
  assert.equal(advisorFaceDanceFlipPlayer(game, bg).forces[location], 1);
  assert.ok(advisorFaceDanceFlipPlayer(game, bg).advisors?.arrakeen);
  assert.equal(advisorFaceDanceFlipPlayer(game, holder).forces[location], 10);
  const dancers = structuredClone(advisorFaceDanceFlipPlayer(game, tleilaxu).faceDancers!);
  assert.equal(dancers.length, 3); assert.ok(dancers.every(card => !card.revealed));
  const winner = holder;
  const winningDisc = advisorFaceDanceFlipPlayer(game, winner).leaders
    .filter(leader => !leader.dead && dancers.some(card => !card.revealed && card.leader === leader.id))
    .sort((a, b) => b.strength - a.strength || a.id.localeCompare(b.id))[0]; assert.ok(winningDisc);
  const losingDisc = advisorFaceDanceFlipPlayer(game, tleilaxu).leaders
    .filter(leader => !leader.dead).sort((a, b) => a.strength - b.strength || a.id.localeCompare(b.id))[0]; assert.ok(losingDisc);
  const winnerLeader = winningDisc.id, loserLeader = losingDisc.id;
  assert.deepEqual(advisorFaceDanceFlipTraitors(game), originalTraitors);
  const originalSpice = game.spiceDeck.map(card => JSON.stringify(card)).sort();
  const spiceOrder = [0, 1].map(position => {
    const from = game.spiceDeck.findIndex((card, index) => index >= position && 'territory' in card && !card.discovery);
    assert.ok(from >= position); const card = game.spiceDeck.splice(from, 1)[0];
    game.spiceDeck.splice(position, 0, card); return { position, from, card: structuredClone(card) };
  });
  assert.deepEqual(game.spiceDeck.map(card => JSON.stringify(card)).sort(), originalSpice);
  reach(state => state.turn === 1 && state.phase === 5 && !state.phaseOpening && !state.response && state.decision?.kind === 'advisorBattle');
  const openingOffer = structuredClone(game);
  const declinedPreparation = transition(() => {
    act(bg, { type: 'decision', accept: false });
    reach(state => state.phase === 5 && state.active === bg && advisorFaceDanceFlipClean(state));
  });
  act(bg, { type: 'endMovement' });
  reach(state => state.phase === 5 && state.active === tleilaxu && advisorFaceDanceFlipClean(state));
  const shipment = transition(() => {
    act(tleilaxu, { type: 'ship', territory, sector: 10, amount: 3, elite: 0, allyPayment: 0 });
    reach(advisorFaceDanceFlipClean);
  });
  assert.equal(advisorFaceDanceFlipPlayer(shipment.before, tleilaxu).spice - advisorFaceDanceFlipPlayer(game, tleilaxu).spice, 3);
  const tleilaxuMovement = transition(() => {
    act(tleilaxu, { type: 'move', from: location, territory: 'imperial_basin', sector: 10, amount: 2 });
    reach(advisorFaceDanceFlipClean);
  });
  assert.equal(advisorFaceDanceFlipPlayer(game, tleilaxu).forces[location], 1);
  assert.equal(advisorFaceDanceFlipPlayer(game, tleilaxu).forces['imperial_basin:10'], 2);
  act(tleilaxu, { type: 'endMovement' });
  reach(state => state.phase === 5 && state.active === holder && advisorFaceDanceFlipClean(state));
  const atreidesDeparture = !zeroReplacement ? transition(() => {
    act(holder, { type: 'move', from: location, territory: 'imperial_basin', sector: 10, amount: 10 });
    reach(advisorFaceDanceFlipClean);
  }) : null;
  reach(state => state.phase === 6 && advisorFaceDanceFlipClean(state) && !!state.active);
  const beforeBattle = structuredClone(game);
  const choice = game.players.flatMap(player => viewGame(game, player.id).battleChoices)
    .find(candidate => candidate.territory === battleTerritory); assert.ok(choice);
  const battleStep: AdvisorFaceDanceFlipStep = { actor: choice.chooser, action: {
    type: 'chooseBattle', territory: battleTerritory,
    target: choice.attacker === choice.chooser ? choice.defender : choice.attacker,
  } };
  act(battleStep.actor, battleStep.action);
  const beforePreparation = structuredClone(game);
  reach(state => !!state.battle && advisorFaceDanceFlipClean(state) && !state.battle.preparation && state.battle.preLeader?.closed !== false);
  const beforePlans = structuredClone(game);
  const planSteps: AdvisorFaceDanceFlipStep[] = [
    { actor: winner, action: { type: 'battlePlan', leader: winnerLeader, dial: 1, support: 1, weapon: null, defense: null } },
    { actor: tleilaxu, action: { type: 'battlePlan', leader: loserLeader, dial: 0, support: 0, weapon: null, defense: null } },
  ];
  for (const step of planSteps) act(step.actor, step.action);
  const revealed = structuredClone(game);
  reach(state => !state.response && !state.phaseOpening && state.decision?.kind === 'faceDance');
  assert.equal(game.decision?.player, tleilaxu);
  assert.ok(game.decision?.kind === 'faceDance');
  assert.equal(game.decision.winner, winner); assert.equal(game.decision.identity, winnerLeader);
  const survivors = Object.entries(advisorFaceDanceFlipPlayer(game, winner).forces)
    .filter(([key]) => key.startsWith(`${battleTerritory}:`)).reduce((sum, [, amount]) => sum + amount, 0);
  assert.equal(survivors, 9);
  assert.equal(advisorFaceDanceFlipPlayer(game, bg).forces[location], 1);
  assert.ok(advisorFaceDanceFlipPlayer(game, bg).advisors?.arrakeen);
  assert.equal(advisorFaceDanceFlipPlayer(game, tleilaxu).forces[location] ?? 0, zeroReplacement ? 0 : 1);
  assert.ok(advisorFaceDanceFlipPlayer(game, holder).hand.some(card => card.id === karama.id));
  assert.deepEqual(advisorFaceDanceFlipInventory(game), originalInventory);
  assert.deepEqual(advisorFaceDanceFlipTraitors(game), originalTraitors);
  const sources: Record<string, number> = zeroReplacement ? {} : { [location]: 1, reserves: survivors - 1 };
  const action: Action = { type: 'decision', reveal: true, sources, sector: 10 };
  const winnerBefore = structuredClone(advisorFaceDanceFlipPlayer(game, winner));
  const dancerBefore = structuredClone(advisorFaceDanceFlipPlayer(game, tleilaxu).faceDancers!.find(card => card.leader === winnerLeader)!);
  return { game, source: structuredClone(game), beforeFaceDance: structuredClone(game), initial, lobby, setup,
    beforeStartingDeal, afterSetup, advisorSetup, faceDancerDeal: {
      before: advisorSetup.before, after: advisorSetup.after, steps: advisorSetup.steps,
      original: faceDancerDeal.original, order: faceDancerDeal.order, scalars: faceDancerDeal.scalars,
    }, dancers, openingOffer, declinedPreparation, shipment, tleilaxuMovement, atreidesDeparture,
    beforeBattle, battleStep, beforePreparation, beforePlans, planSteps, revealed,
    zeroReplacement, bg, owner: bg, tleilaxu, actor: tleilaxu, holder, atreides: holder,
    karama: karama.id, card: karama.id, winner, winnerLeader, loserLeader, battleTerritory,
    territory, location, from: location, sector: 10, sources, survivors, amount: zeroReplacement ? 0 : survivors,
    action, faceDanceStep: { actor: tleilaxu, action } satisfies AdvisorFaceDanceFlipStep,
    winnerBefore, winnerReservesBefore: winnerBefore.reserves,
    winnerLeaderBefore: structuredClone(winnerBefore.leaders.find(leader => leader.id === winnerLeader)!), dancerBefore,
    context: structuredClone(game.lastBattleContext),
    steps, actions: steps, sourceActionCount: steps.length, originalInventory, originalTraitors, originalSpice, dealOrder, spiceOrder,
    staging: [
      'Actual public Advanced BG/Tleilaxu/Atreides setup in that seat order, original Ix47 deck and no optional module. Native prediction and actual first-card Traitor choices precede actual advisorSetup placing the original BG advisor beside Atreides’ native ten Arrakeen10 counters.',
      'Select only original scalar shuffle draws, three original unopened Treachery positions and two original unopened ordinary Spice positions. BG and Tleilaxu receive ordinary cards; Atreides receives its original Karama. No played hand, army, phase, wallet or Tanks is installed.',
      'Only the original finishSetup Face Dancer shuffle inside actual advisorSetup uses a selected conserved permutation of the original available Traitor identities: Tleilaxu3, Tleilaxu4, Atreides0 first. The real native deal creates all three unrevealed cards after other factions choose Traitors; no dealt card or status is installed. Choose the strongest matching living native Atreides disc from that earned original hand.',
      'Actually complete safe first Storm, both Spice blows, Charity, Bidding and Revival. BG declines preparation and ends movement. Tleilaxu pays three to ship three reserves into Arrakeen10, then actually moves two to Basin10, leaving one beside BG and Atreides.',
      zeroReplacement
        ? 'Atreides actually ends its unused movement without departing. The actual Arrakeen A10/T1 battle leaves nine winning Atreides counters beside BG after ordinary dial/support1 casualties. Zero replacement returns those native survivors without bringing a new Tleilaxu counter.'
        : 'Atreides actually moves all ten native Arrakeen counters to Basin10 and fights the actual Tleilaxu two there. A real unarmed native-leader win with dial/support1 leaves nine Atreides survivors; the returned Face Dance action selects one actual remote Arrakeen counter and eight actual reserves.',
      'Native battle preparation, optional special-inspection decline, actual plans, declined Traitor calls and original winner cleanup reach the original private Face Dance chooser. The original Karama remains held. Stop before revealing; leader death, winning-force return, source withdrawal, revealed identity and mandatory advisor conversion are caller-owned actual outcomes.',
    ],
  };
}
export type AdvisorFaceDanceFlipFixture = ReturnType<typeof createAdvisorFaceDanceFlipFixture>;

/** Submit only the original reveal action. Any new mandatory conversion stays
 * caller-owned after the committed return, death, reveal and replacement. */
export function commitAdvisorFaceDanceFlip(source: Game, fixture: AdvisorFaceDanceFlipFixture,
  steps: AdvisorFaceDanceFlipStep[] = []) {
  const before = structuredClone(source), start = steps.length;
  const game = actAdvisorFaceDanceFlip(source, fixture.tleilaxu, fixture.action, steps);
  const winnerBefore = advisorFaceDanceFlipPlayer(before, fixture.winner);
  const winnerAfter = advisorFaceDanceFlipPlayer(game, fixture.winner);
  return { game, before, after: structuredClone(game), steps: structuredClone(steps.slice(start)),
    winnerReservesBefore: winnerBefore.reserves, winnerReservesAfter: winnerAfter.reserves,
    winnerLeaderBefore: structuredClone(winnerBefore.leaders.find(leader => leader.id === fixture.winnerLeader)!),
    winnerLeaderAfter: structuredClone(winnerAfter.leaders.find(leader => leader.id === fixture.winnerLeader)!),
    dancerBefore: structuredClone(advisorFaceDanceFlipPlayer(before, fixture.tleilaxu).faceDancers!.find(card => card.leader === fixture.winnerLeader)!),
    dancerAfter: structuredClone(advisorFaceDanceFlipPlayer(game, fixture.tleilaxu).faceDancers!.find(card => card.leader === fixture.winnerLeader)!),
  };
}
/** Call after the explicit conversion choice, then use original phase controls. */
export function finishAdvisorFaceDanceFlip(source: Game, steps: AdvisorFaceDanceFlipStep[] = []): Game {
  return advanceAdvisorFaceDanceFlip(source,
    game => !game.battle && game.phase >= 7 && game.phase <= 8 && advisorFaceDanceFlipClean(game), steps);
}
