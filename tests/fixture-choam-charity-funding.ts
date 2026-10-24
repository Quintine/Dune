import assert from 'node:assert/strict';
import { applyAction, createGame, joinGame, newPlayer, type Action, type Game } from '../game/engine';
import { nextRicheseStrongholdsNativeStep } from './fixture-richese-strongholds';

export type ChoamCharityFundingStep = { actor: string; action: Action };
export type ChoamCharityFundingTransition = {
  before: Game; steps: ChoamCharityFundingStep[]; after: Game;
};
export const choamCharityFundingPlayer = (game: Game, id: string) => {
  const player = game.players.find(player => player.id === id); assert.ok(player); return player;
};
export const choamCharityFundingClean = (game: Game) => !game.phaseOpening && !game.response &&
  !game.decision && !game.truthtrance && !game.pendingTreacheryDiscard;
export function cloneChoamCharityFunding(game: Game): Game {
  assert.ok(choamCharityFundingClean(game), 'Clone an actual clean Charity choice boundary');
  return structuredClone(game);
}
export const choamCharityFundingInventory = (game: Game) => {
  const cards = [...game.deck, ...game.discard, ...(game.auction?.cards.slice(game.auction.index) ?? []),
    ...game.players.flatMap(player => player.hand)];
  const ids = cards.map(card => card.id).sort();
  assert.equal(new Set(ids).size, ids.length, 'Each original physical Treachery Card has one current slot');
  return ids;
};

/** Choose only original scalar shuffle order. UUIDs and all other native byte
 * entropy remain untouched; no played card or resource is replaced. */
function originalScalarOrder<T>(run: () => T): T {
  const descriptor = Object.getOwnPropertyDescriptor(crypto, 'getRandomValues');
  const original = crypto.getRandomValues.bind(crypto);
  crypto.getRandomValues = <V extends ArrayBufferView | null>(array: V): V => {
    if (array instanceof Uint32Array && array.length === 1) array[0] = 0xffffffff;
    else Reflect.apply(original, crypto, [array]);
    return array;
  };
  try { return run(); }
  finally {
    if (descriptor) Object.defineProperty(crypto, 'getRandomValues', descriptor);
    else Reflect.deleteProperty(crypto, 'getRandomValues');
  }
}
export function actChoamCharityFunding(game: Game, actor: string, action: Action,
  actions: ChoamCharityFundingStep[] = []): Game {
  const next = originalScalarOrder(() => applyAction(game, actor, action));
  actions.push({ actor, action: structuredClone(action) }); return next;
}
/** Native setup, market, response and phase controls only. This helper never
 * claims Charity, initiates a bribe or makes a ruling about unpaid obligations. */
export function nextChoamCharityFundingStep(game: Game): ChoamCharityFundingStep | null {
  if (!game.phaseOpening && !game.response && game.decision?.kind === 'choamMarket')
    return { actor: game.decision.player, action: { type: 'decision', done: true } };
  return nextRicheseStrongholdsNativeStep(game);
}
export function advanceChoamCharityFunding(game: Game, until: (state: Game) => boolean,
  actions: ChoamCharityFundingStep[] = []): Game {
  for (let count = 0; count < 1000; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished', 'The genuine CHOAM chronology ended before its requested boundary');
    const next = nextChoamCharityFundingStep(game);
    assert.ok(next, `A caller must choose the original control at ${game.status}/${game.turn}/${game.phase}/${game.decision?.kind}`);
    game = actChoamCharityFunding(game, next.actor, next.action, actions);
  }
  throw Error('The original CHOAM Charity chronology did not reach its finite boundary');
}
export function passChoamCharityFundingResponses(game: Game,
  actions: ChoamCharityFundingStep[] = []): Game {
  for (let count = 0; game.response && count < 60; count++) {
    const actor = game.players.find(player => !game.response!.passed.includes(player.id)); assert.ok(actor);
    game = actChoamCharityFunding(game, actor.id, { type: 'passResponse' }, actions);
  }
  assert.ok(!game.response); return game;
}

/** Fresh public three-seat E2 source through its FIRST allowed Charity income.
 * Ordinary bribes then remove spendable spice from CHOAM and Guild. Incoming
 * bribes remain native deferred receipts, so they do not fund the pending claim.
 * Stop BEFORE either CHOAM or Guild claims. This reproduces the legal funding boundary without
 * choosing a remedy or asserting how the claim ought to be paid. */
export function createChoamCharityFundingFixture(options: {
  advanced?: boolean; choamSpice?: 0 | 1; guildSpice?: 0 | 1;
} = {}) {
  const advanced = options.advanced ?? false;
  const choamSpice = options.choamSpice ?? 0, claimantSpice = options.guildSpice ?? 0;
  const choam = 'choam', claimant = 'guild', recipient = 'atreides';
  let game = createGame('CHOAMCHARITYFUNDING', newPlayer(choam, 'CHOAM', 'choam'), advanced, ['choam']);
  joinGame(game, newPlayer(recipient, 'Atreides', 'atreides'));
  joinGame(game, newPlayer(claimant, 'Guild', 'guild'));
  const initial = structuredClone(game), actions: ChoamCharityFundingStep[] = [];
  const act = (actor: string, action: Action) => { game = actChoamCharityFunding(game, actor, action, actions); };
  const reach = (until: (state: Game) => boolean) => { game = advanceChoamCharityFunding(game, until, actions); };
  const transition = (run: () => void): ChoamCharityFundingTransition => {
    const before = structuredClone(game), from = actions.length; run();
    return { before, steps: structuredClone(actions.slice(from)), after: structuredClone(game) };
  };
  for (const player of game.players) act(player.id, { type: 'ready' });
  const lobby = structuredClone(game);
  act(game.host, advanced ? { type: 'start', advancedPreview: true } : { type: 'start' });
  const setup = structuredClone(game);
  assert.equal(game.status, 'setup'); assert.equal(game.advanced, advanced);
  assert.ok(!game.homeworlds && !game.nexusCards && !game.leaderSkills && !game.techTokens &&
    !game.strongholdCards && !game.discoveryEnabled && !game.ecazTreachery);
  assert.ok(game.players.every(player => player.hand.length === 0));
  const originalInventory = choamCharityFundingInventory(game);
  const ordinary = game.deck.filter(card => ['projectile', 'poison', 'shield', 'snooper'].includes(card.kind)).slice(0, 2);
  const karama = game.deck.find(card => card.effect === 'karama');
  assert.equal(ordinary.length, 2); assert.ok(karama);
  const startingCards = [ordinary[0], karama, ordinary[1]];
  const dealOrder = startingCards.map((card, position) => {
    const from = game.deck.findIndex(candidate => candidate.id === card.id); assert.ok(from >= position);
    [game.deck[position], game.deck[from]] = [game.deck[from], game.deck[position]];
    return { position, from, card: card.id };
  });
  const beforeStartingDeal = structuredClone(game);
  reach(state => state.status === 'playing');
  const afterSetup = structuredClone(game);
  assert.deepEqual(game.players.flatMap(player => player.hand.map(card => card.id)), startingCards.map(card => card.id));
  assert.equal(choamCharityFundingPlayer(game, choam).spice, 2);
  assert.equal(choamCharityFundingPlayer(game, claimant).spice, 5);
  const originalSpice = game.spiceDeck.map(card => JSON.stringify(card)).sort();
  const spiceOrder = [0, 1].map(position => {
    const from = game.spiceDeck.findIndex((card, index) => index >= position && 'territory' in card && !card.discovery);
    assert.ok(from >= position); const card = game.spiceDeck.splice(from, 1)[0];
    game.spiceDeck.splice(position, 0, card); return { position, from, card: structuredClone(card) };
  });
  assert.deepEqual(game.spiceDeck.map(card => JSON.stringify(card)).sort(), originalSpice);
  reach(state => state.phase === 2 && state.response?.kind === 'choamCharity');
  const originalIncomeResponse = structuredClone(game);
  const income = transition(() => {
    game = passChoamCharityFundingResponses(game, actions);
    reach(state => state.phase === 2 && choamCharityFundingClean(state));
  });
  assert.deepEqual(game.choamCharity, { turn: 1, canceled: false });
  assert.equal(choamCharityFundingPlayer(game, choam).spice, 8);
  const beforeBribes = structuredClone(game);
  const claimantBribe = transition(() => act(claimant, {
    type: 'bribe', target: recipient, amount: choamCharityFundingPlayer(game, claimant).spice - claimantSpice,
  }));
  const beforeFundingBribe = structuredClone(game);
  const fundingBribe = transition(() => act(choam, {
    type: 'bribe', target: recipient, amount: choamCharityFundingPlayer(game, choam).spice - choamSpice,
  }));
  assert.equal(game.turn, 1); assert.equal(game.phase, 2); assert.ok(choamCharityFundingClean(game));
  assert.equal(choamCharityFundingPlayer(game, choam).spice, choamSpice);
  assert.equal(choamCharityFundingPlayer(game, claimant).spice, claimantSpice);
  assert.equal(choamCharityFundingPlayer(game, recipient).spice, choamCharityFundingPlayer(beforeBribes, recipient).spice);
  assert.equal(choamCharityFundingPlayer(game, recipient).bribes, 13 - claimantSpice - choamSpice);
  assert.notEqual(choamCharityFundingPlayer(game, choam).charityTurn, game.turn);
  assert.notEqual(choamCharityFundingPlayer(game, claimant).charityTurn, game.turn);
  assert.deepEqual(choamCharityFundingInventory(game), originalInventory);
  const claim: Action = { type: 'charity' };
  const claimStep: ChoamCharityFundingStep = { actor: choam, action: claim };
  const otherClaimStep: ChoamCharityFundingStep = { actor: claimant, action: claim };
  return { game, initial, lobby, setup, beforeStartingDeal, afterSetup, originalIncomeResponse,
    beforeBribes, beforeFundingBribe, income, claimantBribe, fundingBribe,
    choam, owner: choam, payer: choam, claimant: choam, guild: claimant, otherClaimant: claimant,
    recipient, holder: recipient, karama: karama.id,
    advanced, choamSpice, guildSpice: claimantSpice, amount: 2 - choamSpice, otherAmount: 2 - claimantSpice,
    claim, claimStep, selfClaim: claim, selfClaimStep: claimStep, otherClaim: claim, otherClaimStep,
    actions, sourceActionCount: actions.length, originalInventory, originalSpice, dealOrder, spiceOrder,
    staging: [
      'Actual public three-seat CHOAM/Atreides/Guild ready/start, native private Traitor choices, initial armies and starting wallets. Advanced uses the original explicit preview start; no played Basic game is converted.',
      'Select only original scalar shuffle order, three original unopened Treachery positions and two original unopened ordinary Spice positions. Atreides receives its original starting Karama, keeping the first CHOAM income response genuinely open.',
      'Actually complete first Storm, native closing CHOAM market and Spice controls, then pass the original first Charity income response. CHOAM earns six bank spice on top of its original two.',
      `During clean first Charity, Guild actually pays a ${5 - claimantSpice}-spice bribe and CHOAM actually pays an ${8 - choamSpice}-spice bribe to unallied Atreides. The original ${13 - claimantSpice - choamSpice} deferred incoming spice stays unspendable until Mentat. No phase, wallet, force, alliance, claim stamp or payment receipt is assigned.`,
      'Stop before either original Charity claim. The primary claimStep belongs to CHOAM itself; otherClaimStep belongs to Guild. Expected funding/remedies are deliberately not asserted by this source constructor.',
    ],
  };
}
export type ChoamCharityFundingFixture = ReturnType<typeof createChoamCharityFundingFixture>;
