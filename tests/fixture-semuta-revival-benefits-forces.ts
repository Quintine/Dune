import assert from 'node:assert/strict';
import {
  createGame, initializeSemutaGameForAudit, joinGame, newPlayer, type Action, type Game,
} from '../game/engine';
import { TERRITORIES, location } from '../game/board';
import { quoteRevivalCancellation } from '../game/revival-cancellation';
import { quoteRevivalResume } from '../game/revival-resume';
import { SEMUTA_DRUG_ID } from '../game/semuta-drug';
import { withClassicDiscoveryNexusLottery } from './fixture-discovery-classic-nexus';
import {
  actSemutaRevivalIncome, advanceSemutaRevivalIncome, nextSemutaRevivalIncomeStep,
  semutaRevivalIncomeClean, semutaRevivalIncomeInventory, semutaRevivalIncomePlayer,
  passSemutaRevivalIncome, claimSemutaRevivalIncome,
  type SemutaRevivalIncomeStep,
} from './fixture-semuta-revival-income';

export type SemutaRevivalBenefitsForcesKind = 'choamRevival' | 'revivalLimit' | 'revivalDiscount';
export type SemutaRevivalBenefitsForcesStep = SemutaRevivalIncomeStep;
export const actSemutaRevivalBenefitsForces = actSemutaRevivalIncome;
export const nextSemutaRevivalBenefitsForces = nextSemutaRevivalIncomeStep;
export const advanceSemutaRevivalBenefitsForces = advanceSemutaRevivalIncome;
export const semutaRevivalBenefitsForcesPlayer = semutaRevivalIncomePlayer;
export const semutaRevivalBenefitsForcesInventory = semutaRevivalIncomeInventory;
export const semutaRevivalBenefitsForcesClean = semutaRevivalIncomeClean;
export const passSemutaRevivalBenefitsForces = passSemutaRevivalIncome;
export const claimSemutaRevivalBenefitsForces = claimSemutaRevivalIncome;

/** Pass exactly the current native window, leaving a subsequent benefit or
 * earned-income window explicit. This never submits another revival request. */
export function allowSemutaRevivalBenefitsForces(game: Game,
  actions: SemutaRevivalBenefitsForcesStep[] = []): Game {
  const response = game.response; assert.ok(response);
  const original = { kind: response.kind, owner: response.owner, recipient: response.recipient };
  for (let count = 0; count < game.players.length && game.response &&
    game.response.kind === original.kind && game.response.owner === original.owner &&
    game.response.recipient === original.recipient; count++) {
    assert.equal(game.pendingTreacheryDiscard ?? null, null);
    const actor = game.players.find(player => !game.response!.passed.includes(player.id)); assert.ok(actor);
    game = actSemutaRevivalBenefitsForces(game, actor.id, { type: 'passResponse' }, actions);
  }
  return game;
}

/** Finish only the already submitted return's actual optional free-revival,
 * benefit and income continuations. Ordinary phase readiness remains untouched. */
export function finishSemutaRevivalBenefitsForces(game: Game,
  actions: SemutaRevivalBenefitsForcesStep[] = []): Game {
  for (let count = 0; count < 30; count++) {
    assert.equal(game.pendingTreacheryDiscard ?? null, null, 'Choose the fresh used-cost batch first');
    if (game.response) {
      assert.ok(['choamRevival', 'revivalLimit', 'revivalDiscount', 'revivalIncome'].includes(game.response.kind));
      game = allowSemutaRevivalBenefitsForces(game, actions);
    } else if (game.decision?.kind === 'revivalStop' || game.decision?.kind === 'choamFreeRevival') {
      game = actSemutaRevivalBenefitsForces(game, game.decision.player, { type: 'decision', decline: true }, actions);
    } else {
      assert.equal(game.pendingRevival ?? null, null);
      assert.equal(game.decision ?? null, null);
      return game;
    }
  }
  throw Error('The original force-revival continuations did not settle');
}

/** Genuine bare native source. Only unopened starting-card/Spice positions and
 * original scalar lotteries are selected. No played forces, Tanks, wallets,
 * free quotas, phase, pending return or cancellation response is installed. */
export function createSemutaRevivalBenefitsForcesFixture(options: {
  kind: SemutaRevivalBenefitsForcesKind; advanced?: boolean; amount?: number; unfunded?: boolean;
}) {
  const kind = options.kind, advanced = options.advanced ?? false, unfunded = options.unfunded ?? false;
  const amount = options.amount ?? (kind === 'choamRevival' ? 3 : kind === 'revivalLimit' ? 5 : 4);
  assert.ok(kind === 'revivalLimit' ? amount === 5 :
    kind === 'choamRevival' ? amount === 3 || amount === 4 : amount === 4);
  assert.ok(!unfunded || kind === 'revivalDiscount', 'Only the own-T discount source needs its real bribe variant');
  const seller = 'richese', holder = 'choam', tleilaxu = 'tleilaxu', atreides = 'atreides', spender = 'emperor';
  const recipient = kind === 'choamRevival' ? holder : kind === 'revivalLimit' ? atreides : tleilaxu;
  const owner = kind === 'choamRevival' ? holder : tleilaxu;
  let game = createGame('SEMUTAREVIVALFORCES', newPlayer(seller, 'Richese', 'richese'), advanced, ['choam', 'ix']);
  for (const faction of ['choam', 'tleilaxu', 'atreides', 'emperor'] as const)
    joinGame(game, newPlayer(faction, faction, faction));
  const actions: SemutaRevivalBenefitsForcesStep[] = [];
  const act = (actor: string, action: Action) => { game = actSemutaRevivalBenefitsForces(game, actor, action, actions); };
  const reach = (until: (state: Game) => boolean) => { game = advanceSemutaRevivalBenefitsForces(game, until, actions); };
  const transition = (run: () => void) => {
    const before = structuredClone(game), start = actions.length; run();
    return { before, steps: structuredClone(actions.slice(start)), after: structuredClone(game) };
  };
  for (const player of game.players) act(player.id, { type: 'ready' });
  const lobby = structuredClone(game);
  if (advanced) game = withClassicDiscoveryNexusLottery(() => initializeSemutaGameForAudit(game));
  else act(game.host, { type: 'start' });
  const setup = structuredClone(game), initialization = { before: lobby, after: setup,
    entry: advanced ? 'explicit-original-semuta-initializer' : 'public-basic-start' };
  assert.equal(game.status, 'setup'); assert.equal(game.semutaPreview, true);
  assert.ok(game.players.every(player => player.hand.length === 0));
  const originalInventory = semutaRevivalBenefitsForcesInventory(game); assert.equal(originalInventory.length, 57);
  const costCard = game.deck.find(card => card.effect === 'karama' && !card.id.startsWith('ix-'));
  const ordinary = game.deck.filter(card => !card.effect &&
    ['projectile', 'poison', 'shield', 'antidote'].includes(card.kind)).slice(0, 4);
  assert.ok(costCard); assert.equal(ordinary.length, 4);
  const deal = [...ordinary.map(card => card.id), costCard.id];
  const dealOrder = deal.map((card, position) => {
    const from = game.deck.findIndex(candidate => candidate.id === card); assert.ok(from >= position);
    [game.deck[position], game.deck[from]] = [game.deck[from], game.deck[position]];
    return { card, from, position };
  });
  const beforeStartingDeal = structuredClone(game), cost = costCard.id;
  reach(state => state.status === 'playing'); const afterSetup = structuredClone(game);
  assert.deepEqual(game.players.flatMap(player => player.hand.map(card => card.id)), deal);
  assert.equal(semutaRevivalBenefitsForcesPlayer(game, tleilaxu).faceDancers?.length, 3);
  const originalSpice = game.spiceDeck.map(card => JSON.stringify(card)).sort();
  const spiceOrder: { position: number; from: number; card: Game['spiceDeck'][number] }[] = [];
  const spiceDraws = (advanced ? 2 : 1) * (kind === 'revivalDiscount' ? 3 : 2);
  for (let position = 0; position < spiceDraws; position++) {
    const from = game.spiceDeck.findIndex((card, index) => index >= position && 'territory' in card && !card.discovery &&
      TERRITORIES.some(territory => territory.id === card.territory && territory.sectors.every(sector => sector >= 9)));
    assert.ok(from >= position); const card = game.spiceDeck.splice(from, 1)[0]; game.spiceDeck.splice(position, 0, card);
    spiceOrder.push({ position, from, card: structuredClone(card) });
  }
  assert.deepEqual(game.spiceDeck.map(card => JSON.stringify(card)).sort(), originalSpice);
  let beforeBid: Game | undefined, bid: SemutaRevivalBenefitsForcesStep | undefined, bidAt = -1;
  for (let count = 0; count < 900 && !semutaRevivalBenefitsForcesPlayer(game, holder).hand.some(card => card.id === SEMUTA_DRUG_ID); count++) {
    const next = nextSemutaRevivalBenefitsForces(game); assert.ok(next);
    if (next.actor === holder && next.action.type === 'richeseBid' && next.action.amount === 1) {
      beforeBid = structuredClone(game); bid = structuredClone(next); bidAt = actions.length;
    }
    act(next.actor, next.action);
  }
  assert.ok(beforeBid && bid && bidAt >= 0);
  const acquired = structuredClone(game), acquisition = { before: beforeBid, bid,
    steps: structuredClone(actions.slice(bidAt)), after: acquired, price: 1 };
  assert.equal(semutaRevivalBenefitsForcesPlayer(beforeBid, holder).spice - semutaRevivalBenefitsForcesPlayer(game, holder).spice, 1);
  assert.equal(semutaRevivalBenefitsForcesPlayer(game, seller).spice - semutaRevivalBenefitsForcesPlayer(beforeBid, seller).spice, 1);
  reach(state => state.turn === 1 && state.phase === 4 && semutaRevivalBenefitsForcesClean(state));
  const firstRevival = structuredClone(game);
  assert.equal(game.storm, 18);
  assert.equal(semutaRevivalBenefitsForcesPlayer(game, atreides).tanks, 0);
  assert.equal(semutaRevivalBenefitsForcesPlayer(game, atreides).forces['arrakeen:10'], 10);
  let financingReturn: ReturnType<typeof transition> | null = null;
  let financingFunding: ReturnType<typeof transition> | null = null;
  let funding: ReturnType<typeof transition> | null = null;
  if (kind !== 'choamRevival') {
    financingFunding = transition(() => { act(spender, { type: 'bribe', target: atreides, amount: 6 }); });
    assert.equal(semutaRevivalBenefitsForcesPlayer(game, atreides).spice, 10);
    assert.equal(semutaRevivalBenefitsForcesPlayer(game, atreides).bribes, 6);
  }
  const firstShipper = kind === 'choamRevival' ? holder : atreides;
  const firstAmount = kind === 'choamRevival' ? 4 : 5;
  reach(state => state.turn === 1 && state.phase === 5 && state.active === firstShipper && semutaRevivalBenefitsForcesClean(state));
  const firstShipment = transition(() => {
    act(firstShipper, { type: 'ship', territory: 'cielago_north', sector: 1, amount: firstAmount, elite: 0, allyPayment: 0 });
    reach(semutaRevivalBenefitsForcesClean);
  });
  assert.equal(semutaRevivalBenefitsForcesPlayer(firstShipment.before, firstShipper).spice - semutaRevivalBenefitsForcesPlayer(game, firstShipper).spice, 2 * firstAmount);
  assert.equal(semutaRevivalBenefitsForcesPlayer(game, firstShipper).forces['cielago_north:1'], firstAmount);
  act(firstShipper, { type: 'endMovement' });
  reach(state => state.turn === 2 && state.phase === 0 && semutaRevivalBenefitsForcesClean(state));
  const firstStorm = transition(() => {
    reach(state => state.turn === 2 && state.phase === 1 && semutaRevivalBenefitsForcesClean(state));
  });
  assert.equal(firstStorm.before.storm, 18); assert.ok(firstStorm.after.storm >= 1 && firstStorm.after.storm <= 6);
  assert.equal(semutaRevivalBenefitsForcesPlayer(game, firstShipper).tanks, firstAmount);
  assert.equal(semutaRevivalBenefitsForcesPlayer(game, firstShipper).forces['cielago_north:1'] ?? 0, 0);
  reach(state => state.turn === 2 && state.phase === 4 && semutaRevivalBenefitsForcesClean(state));
  if (kind !== 'choamRevival') {
    assert.equal(semutaRevivalBenefitsForcesPlayer(game, atreides).bribes, 0);
    assert.equal(semutaRevivalBenefitsForcesPlayer(game, atreides).spice, 6 + (advanced ? 2 : 0));
  }
  let shipment = firstShipment, storm = firstStorm;
  let shipmentDestination = { territory: 'cielago_north', sector: 1 };
  if (kind === 'revivalDiscount') {
    financingReturn = transition(() => {
      act(tleilaxu, { type: 'tleilaxuRevivalLimit', target: atreides });
      act(atreides, { type: 'revive', amount: 5, elite: 0 });
      game = finishSemutaRevivalBenefitsForces(game, actions);
    });
    assert.equal(semutaRevivalBenefitsForcesPlayer(game, atreides).revived, 5);
    assert.equal(semutaRevivalBenefitsForcesPlayer(game, tleilaxu).spice, 12);
    reach(state => state.turn === 2 && state.phase === 5 && state.active === recipient && semutaRevivalBenefitsForcesClean(state));
    const sector = game.storm % 18 + 1;
    const exposed = TERRITORIES.find(territory => territory.type === 'sand' && territory.sectors.includes(sector) &&
      !Object.entries(game.spice).some(([key, amount]) => amount > 0 && key.startsWith(`${territory.id}:`)) && game.players.every(player =>
        !Object.entries(player.forces).some(([key, count]) => count > 0 && key.startsWith(`${territory.id}:`))));
    assert.ok(exposed, 'Choose actual spice-free exposed sand in the next Storm path');
    shipmentDestination = { territory: exposed.id, sector };
    shipment = transition(() => {
      act(recipient, { type: 'ship', ...shipmentDestination, amount: 4, elite: 0, allyPayment: 0 });
      reach(semutaRevivalBenefitsForcesClean);
    });
    assert.equal(semutaRevivalBenefitsForcesPlayer(shipment.before, recipient).spice - semutaRevivalBenefitsForcesPlayer(game, recipient).spice, 8);
    assert.equal(semutaRevivalBenefitsForcesPlayer(game, recipient).forces[location(exposed.id, sector)], 4);
    assert.equal(semutaRevivalBenefitsForcesPlayer(game, recipient).spice, 4);
    act(recipient, { type: 'endMovement' });
    reach(state => state.turn === 3 && state.phase === 0 && semutaRevivalBenefitsForcesClean(state));
    assert.equal(semutaRevivalBenefitsForcesPlayer(game, recipient).spice, 4, 'No collection credit funds the reprice');
    storm = transition(() => {
      reach(state => state.turn === 3 && state.phase === 1 && semutaRevivalBenefitsForcesClean(state));
    });
    assert.equal(semutaRevivalBenefitsForcesPlayer(game, recipient).tanks, 4);
    assert.equal(semutaRevivalBenefitsForcesPlayer(game, recipient).forces[location(exposed.id, sector)] ?? 0, 0);
    reach(state => state.turn === 3 && state.phase === 4 && semutaRevivalBenefitsForcesClean(state));
    if (unfunded) {
      const bribe = semutaRevivalBenefitsForcesPlayer(game, recipient).spice - 2;
      assert.ok(bribe > 0);
      funding = transition(() => { act(recipient, { type: 'bribe', target: spender, amount: bribe }); });
      assert.equal(semutaRevivalBenefitsForcesPlayer(game, recipient).spice, 2);
    }
  }
  const beforeRevival = structuredClone(game), nativeAction: Action = { type: 'revive', amount, elite: 0 };
  const revival = transition(() => {
    if (kind === 'revivalLimit') act(tleilaxu, { type: 'tleilaxuRevivalLimit', target: recipient });
    act(recipient, nativeAction);
    for (let count = 0; count < 20 && game.response?.kind !== kind; count++) {
      if (game.decision?.kind === 'revivalStop' || game.decision?.kind === 'choamFreeRevival')
        act(game.decision.player, { type: 'decision', decline: true });
      else if (game.response?.kind === 'revivalLimit' && kind === 'revivalDiscount')
        game = allowSemutaRevivalBenefitsForces(game, actions);
      else throw Error('The original force request did not reach its native benefit response');
    }
  });
  assert.equal(game.response?.kind, kind); assert.equal(game.response?.owner, owner);
  assert.equal(game.response?.recipient, recipient); assert.ok(game.pendingRevival);
  assert.equal(game.phaseOpening ?? null, null); assert.equal(game.decision ?? null, null);
  assert.equal(game.pendingTreacheryDiscard ?? null, null);
  assert.deepEqual(semutaRevivalBenefitsForcesPlayer(game, recipient), semutaRevivalBenefitsForcesPlayer(beforeRevival, recipient));
  assert.ok(semutaRevivalBenefitsForcesPlayer(game, holder).hand.some(card => card.id === SEMUTA_DRUG_ID));
  assert.ok(semutaRevivalBenefitsForcesPlayer(game, spender).hand.some(card => card.id === cost));
  const source = structuredClone(game), pending = structuredClone(game.pendingRevival!);
  const originalResponse = structuredClone(game.response!), expected = quoteRevivalCancellation(game, game.response!);
  const allowedResume = quoteRevivalResume(game, 'finish');
  const expectedResume = expected.pending ? quoteRevivalResume({ ...game,
    revivalRules: expected.rules, pendingRevival: expected.pending }, 'finish') : null;
  const action: Action = { type: 'card', card: cost, mode: 'cancel' };
  assert.deepEqual(semutaRevivalBenefitsForcesInventory(game), originalInventory);
  return { game, source, beforeCost: source, kind, advanced, amount, unfunded,
    holder, spender, owner, recipient, payer: recipient, seller, tleilaxu, atreides,
    cost, semuta: SEMUTA_DRUG_ID, action, nativeAction, pending, expected, expectedResume, allowedResume, originalResponse,
    lobby, setup, initialization, beforeStartingDeal, afterSetup, deal, dealOrder, originalSpice, spiceOrder,
    acquisition, acquired, firstRevival, financingFunding, firstShipment, firstStorm,
    financingReturn, shipment, shipmentDestination, storm, funding, beforeRevival, revival,
    casualties: { first: firstStorm.after, later: storm.after },
    originalInventory, actions, sourceActions: actions, sourceActionCount: actions.length,
    staging: [
      'Public Basic start or original Advanced Semuta initializer on a ready undealt R/C/T/A/E lobby; original union47/cache10 retained. Only unopened starting-card/Spice positions and scalar lotteries are selected. Emperor really receives printed Karama; CHOAM pays1 for cache Semuta.',
      'Actual first Storm17+0 ends18; Atreides protected Arrakeen10 survives. Actual turn1 shipment (CHOAM4 or Atreides5) to exposed Cielago North1 is killed by the next Storm. No casualties, played forces, wallets, clocks or pending controls are installed.',
      kind === 'revivalLimit' ? 'Emperor actually bribes Atreides6 before the first Mentat; Atreides ships5 for10, then the deferred6 becomes spendable at Mentat. After actual turn2 Storm casualties, Tleilaxu grants5 permission and Atreides submits the funded5-counter request (native free2, paid3) for6. The unpaid native limit response is the source.' :
        kind === 'choamRevival' ? 'CHOAM uses its real post-cache11 to ship4 for8 into Cielago North1. The next actual Storm kills4; native turn2 CHOAM opening income funds the original cheap3/4-counter request.' :
          'Emperor actually bribes Atreides6 before first Mentat; Atreides ships5 for10, then the deferred6 becomes spendable (Advanced also retains its actual Arrakeen city income2). After real turn2 Storm deaths Atreides revives5 (free2, paid3), paying6 and earning Tleilaxu7 paid/free income (5→12). Tleilaxu ships4 for8 into actual spice-free exposed sand in the next Storm path, retaining4; turn3 Storm kills4. Its request4 keeps native free2, cheap2/full4. The unfunded branch actually bribes2 away before requesting.',
      'Stop before Emperor spends its actual cancellation cost. The pure native cancellation quote supplies abandonment/repricing/funding; later income is finished only through actual current response passes, never a replacement request.',
    ] };
}
export type SemutaRevivalBenefitsForcesFixture = ReturnType<typeof createSemutaRevivalBenefitsForcesFixture>;
