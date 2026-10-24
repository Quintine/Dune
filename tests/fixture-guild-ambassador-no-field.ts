import assert from 'node:assert/strict';
import { applyAction, createGame, joinGame, newPlayer, type Action, type Game } from '../game/engine';
import { AMBASSADOR_EFFECTS, type AmbassadorEffect } from '../game/ecaz-ambassadors';
import { nextRicheseStrongholdsNativeStep } from './fixture-richese-strongholds';

export type GuildAmbassadorNoFieldStep = { actor: string; action: Action };
export type GuildAmbassadorNoFieldTransition = {
  before: Game; steps: GuildAmbassadorNoFieldStep[]; after: Game;
};
export const guildAmbassadorNoFieldPlayer = (game: Game, id: string) => {
  const player = game.players.find(player => player.id === id); assert.ok(player); return player;
};
export const guildAmbassadorNoFieldClean = (game: Game) => !game.response && !game.phaseOpening &&
  !game.decision && !game.truthtrance && !game.pendingTreacheryDiscard;
export const guildAmbassadorNoFieldInventory = (game: Game) => {
  const cards = [...game.deck, ...game.discard, ...(game.richeseCache ?? []), ...(game.richeseRemoved ?? []),
    ...(game.auction?.cards.slice(game.auction.index) ?? []), ...game.players.flatMap(player => player.hand)];
  const ids = cards.map(card => card.id).sort();
  assert.equal(new Set(ids).size, ids.length, 'Each original physical Treachery Card has one current slot');
  return ids;
};

/** Select only original scalar lotteries. Nine selected draws belong to the
 * original Ambassador packet; UUIDs and other byte entropy remain native. */
function withOriginalScalarLottery<T>(run: () => T, packet: readonly number[] = []): T {
  const descriptor = Object.getOwnPropertyDescriptor(crypto, 'getRandomValues');
  const original = crypto.getRandomValues.bind(crypto); let cursor = 0;
  crypto.getRandomValues = <V extends ArrayBufferView | null>(array: V): V => {
    if (array instanceof Uint32Array && array.length === 1)
      array[0] = cursor < packet.length ? packet[cursor++] : 0xffffffff;
    else Reflect.apply(original, crypto, [array]);
    return array;
  };
  try {
    const result = run(); assert.equal(cursor, packet.length, 'The original packet consumes its nine selected draws');
    return result;
  } finally {
    if (descriptor) Object.defineProperty(crypto, 'getRandomValues', descriptor);
    else Reflect.deleteProperty(crypto, 'getRandomValues');
  }
}
export function actGuildAmbassadorNoField(game: Game, actor: string, action: Action,
  actions: GuildAmbassadorNoFieldStep[] = []): Game {
  const next = withOriginalScalarLottery(() => applyAction(game, actor, action));
  actions.push({ actor, action: structuredClone(action) }); return next;
}
function nextStep(game: Game): GuildAmbassadorNoFieldStep | null {
  if (!game.response && !game.phaseOpening) {
    if (game.decision?.kind === 'ecazAmbassador' || game.decision?.kind === 'ecazPlacement') return null;
    if (game.status === 'setup' && game.setupStage === 'forces' &&
      guildAmbassadorNoFieldPlayer(game, 'ecaz').reserves === 20)
      return { actor: 'ecaz', action: { type: 'ecazSetup', placements: { 'imperial_basin:9': 6 } } };
    if (game.decision?.kind === 'richeseCache') return {
      actor: game.decision.player, action: { type: 'decision', event: game.richeseBidding!.event,
        card: game.richeseCache![0].id, method: 'onceAround', direction: 'counterclockwise' },
    };
    if (game.decision?.kind === 'richeseUnbid') return { actor: game.decision.player,
      action: { type: 'decision', event: game.richeseBidding!.event, keep: false } };
  }
  return nextRicheseStrongholdsNativeStep(game);
}
export function advanceGuildAmbassadorNoField(game: Game, until: (state: Game) => boolean,
  actions: GuildAmbassadorNoFieldStep[] = []): Game {
  for (let count = 0; count < 1600; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished', 'The original Basic source ended before its next control');
    const next = nextStep(game);
    assert.ok(next, `Choose the original Ambassador control before advancing: ${JSON.stringify({
      status: game.status, phase: game.phase, active: game.active, decision: game.decision,
      entry: game.pendingAmbassador && { stage: game.pendingAmbassador.stage, effect: game.pendingAmbassador.effect },
    })}`);
    game = actGuildAmbassadorNoField(game, next.actor, next.action, actions);
  }
  throw Error('The original Guild Ambassador source did not reach its finite boundary');
}
export function passGuildAmbassadorNoFieldResponses(game: Game,
  actions: GuildAmbassadorNoFieldStep[] = []): Game {
  for (let count = 0; game.response && count < 60; count++) {
    const actor = game.players.find(player => !game.response!.passed.includes(player.id)); assert.ok(actor);
    game = actGuildAmbassadorNoField(game, actor.id, { type: 'passResponse' }, actions);
  }
  assert.equal(game.response, null); return game;
}
function originalGuildPacket() {
  const pool = AMBASSADOR_EFFECTS.filter(effect => effect !== 'ecaz');
  const supply: Exclude<AmbassadorEffect, 'ecaz'>[] = ['guild', 'atreides', 'emperor', 'fremen', 'harkonnen'];
  const desired = [...supply, ...pool.filter(effect => !supply.includes(effect))];
  const current = [...pool], rolls: number[] = [];
  for (let i = current.length - 1; i > 0; i--) {
    const j = current.indexOf(desired[i]); assert.ok(j >= 0 && j <= i);
    rolls.push(Math.floor((j + 0.5) * 0x100000000 / (i + 1)));
    [current[i], current[j]] = [current[j], current[i]];
  }
  assert.deepEqual(current, desired); assert.equal(rolls.length, 9); return { rolls, supply };
}

/** Fresh public bare Basic E2/E3 source. Ecaz pays for both original markers.
 * Its reusable self-marker really creates the Richese alliance at Carthag;
 * Richese explicitly accepts and Ecaz declines the optional Basic Duke loan.
 * Both future beneficiaries already made their own paid ordinary shipments and
 * ended their movement turns before Harkonnen pays for the Guild-marker entry.
 * Only original undealt card/packet order is selected. No wallet, army, phase,
 * alliance, allowance, token custody or continuation is assigned. */
export function createGuildAmbassadorNoFieldFixture(options: {
  beneficiary: 'own' | 'allied'; priorMarker?: boolean; karama?: boolean; includeGuild?: boolean;
}) {
  let game = createGame('GUILDAMBASSADORNOFIELD', newPlayer('ecaz', 'Ecaz', 'ecaz'), false, ['ecaz', 'choam']);
  const includeGuild = options.includeGuild !== false;
  const roster = includeGuild ? ['richese', 'harkonnen', 'guild'] as const : ['richese', 'harkonnen'] as const;
  for (const faction of roster)
    joinGame(game, newPlayer(faction, faction, faction));
  const ownerEcaz = 'ecaz', richese = 'richese', entrantHark = 'harkonnen', guild = 'guild';
  const beneficiaryID = options.beneficiary === 'own' ? richese : ownerEcaz;
  const actions: GuildAmbassadorNoFieldStep[] = [], staging: string[] = [];
  const act = (actor: string, action: Action) => { game = actGuildAmbassadorNoField(game, actor, action, actions); };
  const reach = (until: (state: Game) => boolean) => { game = advanceGuildAmbassadorNoField(game, until, actions); };
  const transition = (run: () => void): GuildAmbassadorNoFieldTransition => {
    const before = structuredClone(game), start = actions.length; run();
    return { before, steps: structuredClone(actions.slice(start)), after: structuredClone(game) };
  };
  for (const player of game.players) act(player.id, { type: 'ready' });
  const lobby = structuredClone(game); act(game.host, { type: 'start' });
  const setup = structuredClone(game);
  assert.equal(game.status, 'setup'); assert.equal(game.advanced, false);
  assert.ok(!game.homeworlds && !game.nexusCards && !game.leaderSkills && !game.techTokens &&
    !game.strongholdCards && !game.discoveryEnabled && !game.ecazTreachery);
  assert.ok(game.players.every(player => player.hand.length === 0));
  const originalInventory = guildAmbassadorNoFieldInventory(game);
  const originalMainDeck = game.deck.map(card => card.id).sort();
  const originalCache = game.richeseCache!.map(card => card.id).sort();
  // Harkonnen receives two actual starting cards; all other seats receive one.
  const dealCount = game.players.length + 1;
  const ordinary = game.deck.filter(card => ['projectile', 'poison', 'shield', 'snooper'].includes(card.kind)).slice(0, dealCount);
  assert.equal(ordinary.length, dealCount);
  const heldKarama = options.karama ? game.deck.find(card => card.effect === 'karama') : null;
  if (options.karama) { assert.ok(heldKarama); ordinary[2] = heldKarama; }
  const deal = ordinary.map(card => card.id);
  const dealOrder = deal.map((id, position) => {
    const from = game.deck.findIndex(card => card.id === id); assert.ok(from >= position);
    [game.deck[position], game.deck[from]] = [game.deck[from], game.deck[position]];
    return { position, from, card: id };
  });
  const beforeStartingDeal = structuredClone(game), packet = originalGuildPacket();
  let packetCreation: GuildAmbassadorNoFieldTransition | null = null;
  for (let count = 0; game.status === 'setup' && count < 100; count++) {
    const next = nextStep(game); assert.ok(next);
    const initializesForces = game.setupStage === 'traitors' && next.action.type === 'traitor' &&
      game.players.filter(player => player.traitorChoices.length > 0).length === 1;
    if (initializesForces) {
      const before = structuredClone(game);
      game = withOriginalScalarLottery(() => applyAction(game, next.actor, next.action), packet.rolls);
      actions.push(structuredClone(next)); packetCreation = { before, steps: [structuredClone(next)], after: structuredClone(game) };
    } else act(next.actor, next.action);
  }
  assert.equal(game.status, 'playing'); assert.ok(packetCreation);
  const afterSetup = structuredClone(game);
  assert.deepEqual(game.ecazAmbassadors!.cohort.map(id =>
    game.ecazAmbassadors!.tokens.find(token => token.id === id)!.effect), packet.supply);
  assert.deepEqual(game.players.flatMap(player => player.hand.map(card => card.id)), deal);
  const originalSpice = game.spiceDeck.map(card => JSON.stringify(card)).sort();
  const spiceOrder = [0, 1].map(position => {
    const from = game.spiceDeck.findIndex((card, index) => index >= position && 'territory' in card && !card.discovery);
    assert.ok(from >= position); const card = game.spiceDeck.splice(from, 1)[0];
    game.spiceDeck.splice(position, 0, card); return { position, from, card: structuredClone(card) };
  });
  assert.deepEqual(game.spiceDeck.map(card => JSON.stringify(card)).sort(), originalSpice);
  reach(state => state.phase === 4 && !state.response && !state.phaseOpening && state.decision?.kind === 'ecazPlacement');
  const selfToken = game.ecazAmbassadors!.tokens.find(token => token.effect === 'ecaz')!;
  const guildToken = game.ecazAmbassadors!.tokens.find(token => token.effect === 'guild')!;
  const placements = transition(() => {
    act(ownerEcaz, { type: 'decision', token: selfToken.id, territory: 'carthag' });
    reach(state => !state.response && state.decision?.kind === 'ecazPlacement');
    act(ownerEcaz, { type: 'decision', token: guildToken.id, territory: 'habbanya_ridge_sietch' });
    reach(state => !state.response && state.decision?.kind === 'ecazPlacement');
    act(ownerEcaz, { type: 'decision', decline: true });
  });
  assert.equal(guildAmbassadorNoFieldPlayer(game, ownerEcaz).spice,
    guildAmbassadorNoFieldPlayer(placements.before, ownerEcaz).spice - 3);
  reach(state => state.phase === 5 && state.active === ownerEcaz && guildAmbassadorNoFieldClean(state));
  assert.deepEqual(game.order, [ownerEcaz, richese, entrantHark, ...(includeGuild ? [guild] : [])]);
  assert.equal(game.storm, 1);
  const ordinaryEcaz = transition(() => {
    act(ownerEcaz, { type: 'ship', amount: 1, territory: 'polar_sink', sector: 0, elite: 0, allyPayment: 0 });
    reach(guildAmbassadorNoFieldClean); act(ownerEcaz, { type: 'endMovement' });
    reach(state => state.active === richese && guildAmbassadorNoFieldClean(state));
  });
  const tokens = guildAmbassadorNoFieldPlayer(game, richese).noField!.tokens.map(token => ({ ...token }));
  const priorToken = tokens.find(token => token.value === 3)!;
  const alliance = transition(() => {
    const richeseEvent = guildAmbassadorNoFieldPlayer(game, richese).noFieldEvent!;
    act(richese, options.priorMarker
      ? { type: 'ship', noField: priorToken.id, event: richeseEvent, territory: 'carthag', sector: 11 }
      : { type: 'ship', amount: 1, territory: 'carthag', sector: 11, elite: 0, allyPayment: 0 });
    reach(state => !state.response && state.pendingAmbassador?.stage === 'offer');
    act(ownerEcaz, { type: 'decision', event: game.pendingAmbassador!.event,
      trigger: true, beneficiary: ownerEcaz, choice: 'alliance' });
    assert.equal(game.pendingAmbassador?.stage, 'allianceReply');
    act(richese, { type: 'decision', event: game.pendingAmbassador!.event, accept: true });
    assert.equal(game.pendingAmbassador?.stage, 'loan');
    act(ownerEcaz, { type: 'decision', event: game.pendingAmbassador!.event, loan: false });
    reach(guildAmbassadorNoFieldClean);
  });
  assert.equal(guildAmbassadorNoFieldPlayer(game, ownerEcaz).ally, richese);
  assert.equal(guildAmbassadorNoFieldPlayer(game, richese).ally, ownerEcaz);
  act(richese, { type: 'endMovement' });
  reach(state => state.active === entrantHark && guildAmbassadorNoFieldClean(state));
  const arrival = transition(() => {
    act(entrantHark, { type: 'ship', amount: 1, territory: 'habbanya_ridge_sietch', sector: 17,
      elite: 0, allyPayment: 0 });
    reach(state => !state.response && state.pendingAmbassador?.stage === 'offer');
  });
  assert.equal(guildAmbassadorNoFieldPlayer(game, entrantHark).spice,
    guildAmbassadorNoFieldPlayer(arrival.before, entrantHark).spice - 1);
  const beforeTrigger = structuredClone(game);
  act(ownerEcaz, { type: 'decision', event: game.pendingAmbassador!.event, trigger: true, beneficiary: beneficiaryID });
  assert.ok(game.pendingAmbassador); assert.equal(game.pendingAmbassador.stage, 'ship');
  assert.equal(game.pendingAmbassador.effect, 'guild');
  assert.equal(game.decision?.player, beneficiaryID);
  assert.equal(game.active, entrantHark);
  assert.ok(guildAmbassadorNoFieldPlayer(game, ownerEcaz).shipped);
  assert.ok(guildAmbassadorNoFieldPlayer(game, richese).shipped);
  assert.deepEqual(guildAmbassadorNoFieldInventory(game), originalInventory);
  const event = game.pendingAmbassador.event;
  return { game, event, ownerEcaz, richese, beneficiaryID, entrantHark, guild, includeGuild, tokens,
    territory: 'sietch_tabr', sector: 14, desert: 'habbanya_ridge_flat', desertSector: 17,
    priorToken, currentTokenEvent: guildAmbassadorNoFieldPlayer(game, richese).noFieldEvent!,
    karama: heldKarama?.id ?? null, actions, staging, lobby, setup, beforeStartingDeal, afterSetup,
    originalInventory, originalMainDeck, originalCache, originalSpice, dealOrder, spiceOrder,
    packetCreation, placements, ordinaryEcaz, alliance, arrival, beforeTrigger };
}
export type GuildAmbassadorNoFieldFixture = ReturnType<typeof createGuildAmbassadorNoFieldFixture>;
