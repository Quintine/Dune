import assert from 'node:assert/strict';
import {
  applyAction, createGame, initializeEcazOccupyGameForAudit, joinGame, newPlayer,
  viewGame, type Action, type Game, type Player,
} from '../game/engine';
import { treacheryDeck, type Card } from '../game/cards';
import { ecazTreacheryCards } from '../game/ecaz-cards';
import { richeseCards } from '../game/richese-cards';
import { traitorDeck } from '../game/traitors';
import { defaultHarassWithdrawAllocation, type HarassWithdrawSelection } from '../game/harass-withdraw';
import { finishHarassPreparation, harassWithdrawGame, takeHarassCard } from './fixture-harass-withdraw';
import {
  chooseEcazOccupyLead, ecazOccupyFixture, openEcazOccupyPlans, type EcazOccupyFixture,
} from './fixture-ecaz-occupy';
import { finishOccupyCardsAftermath } from './fixture-ecaz-occupy-cards';

export const HARASS_CARD = 'ecaz-harass-withdraw';
export const STONE_CARD = 'richese-stone-burner';
export const MIRROR_CARD = 'richese-mirror-weapon';
export type StoneHarassMode = 'kill' | 'ignore';
export type StoneHarassSide = 'attacker' | 'defender';
export type StoneHarassStep = { actor: string; action: Action };

export function stoneHarassPlayer(game: Game, id: string): Player {
  const player = game.players.find(candidate => candidate.id === id);
  assert.ok(player, 'The genuine setup must contain this physical owner.');
  return player;
}

/** Move one original physical face, including the separate native Richese cache. */
export function takeStoneHarassCard(game: Game, owner: string, id: string): Card {
  const player = stoneHarassPlayer(game, owner);
  const held = player.hand.find(card => card.id === id);
  if (held) return held;
  for (const zone of [game.richeseCache ?? [], game.deck, game.discard,
    ...game.players.filter(candidate => candidate.id !== owner).map(candidate => candidate.hand)]) {
    const index = zone.findIndex(card => card.id === id);
    if (index < 0) continue;
    const [card] = zone.splice(index, 1);
    player.hand.push(card);
    return card;
  }
  throw new Error(`Missing original physical Stone/Harass fixture card ${id}`);
}

/** Exchange one original held Traitor Card for another real identity. */
export function holdStoneHarassTraitor(game: Game, owner: string, identity: string): void {
  const player = stoneHarassPlayer(game, owner);
  if (player.traitors.includes(identity)) return;
  assert.ok(player.traitors[0], 'An original Traitor Card must fund this exchange.');
  const reserve = game.traitorReserve;
  const index = reserve?.indexOf(identity) ?? -1;
  if (reserve && index >= 0) {
    reserve[index] = player.traitors[0];
    player.traitors[0] = identity;
    return;
  }
  const donor = game.players.find(candidate => candidate.id !== owner && candidate.traitors.includes(identity));
  assert.ok(donor, 'A real non-loyal Traitor Card must exist in the original source.');
  const donorIndex = donor.traitors.indexOf(identity);
  donor.traitors[donorIndex] = player.traitors[0];
  player.traitors[0] = identity;
}

/** Physical conservation across the native Richese cache and every ordinary zone. */
export function stoneHarassCustody(game: Game): void {
  const cards = [...game.deck, ...game.discard, ...(game.richeseCache ?? []),
    ...(game.richeseRemoved ?? []), ...(game.ixSetupCards ?? []),
    ...game.players.flatMap(player => player.hand)];
  assert.deepEqual(cards.map(card => card.id).sort(),
    [...treacheryDeck(game.expansions), ...ecazTreacheryCards(), ...richeseCards()]
      .map(card => card.id).sort(),
    'The original card family and the Richese cache must each retain every physical face.');
  assert.deepEqual([
    ...(game.ecazLoyalty?.card ? [game.ecazLoyalty.card] : []),
    ...(game.traitorReserve ?? []),
    ...game.players.flatMap(player => [...player.traitors,
      ...(player.faceDancers ?? []).map(card => card.leader)]),
  ].sort(), traitorDeck(game.players, game.expansions.includes('ix')).sort());
  for (const player of game.players) {
    // All admitted native fixture rosters use four-card hands.
    assert.ok(player.hand.length <= 4, 'Conserved card staging must also respect native hand capacity.');
    assert.equal(player.reserves + player.tanks +
      Object.values(player.forces).reduce((sum, amount) => sum + amount, 0), 20);
    assert.ok([player.reserves, player.tanks, ...Object.values(player.forces)]
      .every(amount => Number.isSafeInteger(amount) && amount >= 0));
    if (player.elites) {
      assert.equal(player.elites.reserves + player.elites.tanks +
        Object.values(player.elites.forces).reduce((sum, amount) => sum + amount, 0),
      player.faction === 'emperor' ? 5 : player.faction === 'ixians' ? 7 : 3);
      assert.ok(player.elites.reserves <= player.reserves && player.elites.tanks <= player.tanks);
      for (const [key, amount] of Object.entries(player.elites.forces))
        assert.ok(amount <= (player.forces[key] ?? 0));
    }
  }
}

/** Every original physical traitor identity currently in play. */
export function traitorIdentities(game: Game): Set<string> {
  return new Set([...(game.traitorReserve ?? []),
    ...game.players.flatMap(player => [...player.traitors,
      ...(player.faceDancers ?? []).map(card => card.leader)])]);
}

function restage(game: Game, id: string, total: number, location: string): void {
  const player = stoneHarassPlayer(game, id);
  player.reserves += Object.values(player.forces).reduce((sum, amount) => sum + amount, 0);
  player.forces = {};
  player.reserves -= total;
  if (total) player.forces[location] = total;
  assert.equal(Object.values(player.forces).reduce((sum, amount) => sum + amount, 0), total);
}

export type StoneHarassOptions = {
  advanced?: boolean;
  /** Which physical slot buys Harass & Withdraw; its owner plays the card. */
  harass?: StoneHarassSide | null;
  /** Who holds the physical Stone Burner: the Harass owner's opponent or itself. */
  stone?: 'opponent' | 'harass' | null;
  /** Hand the physical Mirror Weapon to the side without the Stone. */
  mirror?: boolean;
  /** Stage Harass in the owner's plan: false leaves the same card in hand. */
  playHarass?: boolean;
  /** Prefer plan leaders that also exist in the original physical traitor pool. */
  traitorableLeaders?: boolean;
  mode?: StoneHarassMode;
  /** Ordinary counters staged for the native attacker after the original deal. */
  attackerForces?: number;
  attackerElite?: number;
  defenderForces?: number;
  attackerDial?: number;
  defenderDial?: number;
  attackerSupport?: number;
  defenderSupport?: number;
  /** Native battle location; the second sector enables the allocation decision. */
  territory?: string;
  sector?: number;
  secondSector?: number;
  split?: number;
};
export type StoneHarassCase = {
  game: Game;
  attacker: string;
  defender: string;
  harassOwner: string | null;
  stoneOwner: string | null;
  mirrorOwner: string | null;
  territory: string;
  sector: number;
  location: string;
  locations: string[];
  leaders: Record<string, string>;
  dials: Record<string, number>;
  supports: Record<string, number>;
  mode: StoneHarassMode;
  plans: StoneHarassStep[];
};

/** Genuine Basic/Advanced three-seat native setup (classics plus Richese's own
 * cache). Forces are restaged only as conserved physical counters of the real
 * battle territory; the battle itself is the original native chooseBattle. */
export function stoneHarassFixture(options: StoneHarassOptions = {}): StoneHarassCase {
  const harassOwner = options.harass === null ? null : options.harass === 'attacker' ? 'a' : 'd';
  const stoneOwner = options.stone === null ? null : options.stone === 'harass'
    ? harassOwner : harassOwner === 'a' ? 'd' : 'a';
  assert.ok(stoneOwner !== null || options.mirror !== true,
    'A Mirror Weapon needs an opposing physical Stone Burner.');
  const mirrorOwner = options.mirror
    ? stoneOwner === 'a' ? 'd' : 'a' : null;
  const territory = options.territory ?? 'arrakeen';
  const sector = options.sector ?? 10;
  const game = harassWithdrawGame({ advanced: options.advanced ?? false,
    factions: ['emperor', 'atreides', 'richese'],
    normal: options.attackerForces ?? 5, elite: options.attackerElite ?? 0,
    prepare: true, territory, sector });
  const locations = [location(territory, sector)];
  if ((options.defenderForces ?? 5) !== 5)
    restage(game, 'd', options.defenderForces ?? 5, locations[0]);
  if (options.split) {
    assert.ok(options.secondSector !== undefined,
      'A split staging needs the second native sector of this territory.');
    const second = location(territory, options.secondSector);
    for (const id of ['a', 'd'] as const) {
      const player = stoneHarassPlayer(game, id);
      const available = player.forces[locations[0]] ?? 0;
      const elite = player.elites?.forces[locations[0]] ?? 0;
      assert.ok(options.split <= available - elite,
        'A split staging keeps every staged elite counter in its original sector.');
      player.forces[locations[0]] = available - options.split;
      player.forces[second] = (player.forces[second] ?? 0) + options.split;
    }
    locations.push(second);
  }
  if (harassOwner) takeHarassCard(game, harassOwner, HARASS_CARD);
  if (stoneOwner) takeStoneHarassCard(game, stoneOwner, STONE_CARD);
  if (mirrorOwner) takeStoneHarassCard(game, mirrorOwner, MIRROR_CARD);
  const dials: Record<string, number> = { a: options.attackerDial ?? 0, d: options.defenderDial ?? 0 };
  // Advanced ordinary counter pools require support equal to the dialed counters.
  const supports: Record<string, number> = {
    a: options.attackerSupport ?? (options.advanced ? dials.a : 0),
    d: options.defenderSupport ?? (options.advanced ? dials.d : 0) };
  const leaders: Record<string, string> = {};
  const plans: StoneHarassStep[] = (['a', 'd'] as const).map(actor => {
    const available = stoneHarassPlayer(game, actor).leaders.filter(leader => !leader.dead && !leader.usedAt);
    const traitor = options.traitorableLeaders ? traitorIdentities(game) : null;
    leaders[actor] = (traitor ? available.find(leader => traitor.has(leader.id)) : undefined)?.id
      ?? available[0].id;
    const weapon = actor === stoneOwner ? STONE_CARD : actor === mirrorOwner ? MIRROR_CARD : undefined;
    const playHarass = actor === harassOwner && (options.playHarass ?? true);
    return { actor, action: { type: 'battlePlan', dial: dials[actor], support: supports[actor],
      leader: leaders[actor],
      ...(weapon ? { weapon } : {}),
      ...(playHarass ? { [weapon ? 'defense' : 'weapon']: HARASS_CARD } : {}) } };
  });
  stoneHarassCustody(game);
  return { game, attacker: 'a', defender: 'd', harassOwner, stoneOwner, mirrorOwner,
    territory, sector, location: locations[0], locations, leaders, dials, supports,
    mode: options.mode ?? 'ignore', plans };
}

function location(territory: string, sector: number): string {
  return `${territory}:${sector}`;
}

/** Seal the original native plans in their staged actor order. */
export function sealStoneHarassPlans(fixture: Pick<StoneHarassCase, 'game' | 'plans'>): Game {
  let game = fixture.game;
  for (const step of fixture.plans) game = applyAction(game, step.actor, step.action);
  assert.equal(game.battle?.revealed, true, 'Both original sealed plans must reveal.');
  return game;
}

/** Answer only the native reveal offers; never a phase, receipt or mode of our own. */
export function chooseStoneHarassReveal(state: Game, options: {
  mode?: StoneHarassMode; modes?: Record<string, StoneHarassMode>;
  returns?: HarassWithdrawSelection;
} = {}): Game {
  let game = state;
  for (let attempt = 0; attempt < 10; attempt++) {
    const decision = game.decision;
    if (decision?.kind === 'harassWithdraw') {
      const offer = viewGame(game, decision.player).battle?.harassAllocation;
      assert.ok(offer, 'Choose only the actual revealed physical withdrawal allocation.');
      game = applyAction(game, decision.player, { type: 'decision', event: decision.event,
        returns: options.returns ?? defaultHarassWithdrawAllocation(offer.context, offer.dial, offer.support) });
    } else if (decision?.kind === 'stoneBurner') {
      game = applyAction(game, decision.player, { type: 'decision', event: decision.event,
        mode: options.modes?.[decision.player] ?? options.mode ?? 'ignore' });
    } else return game;
  }
  throw new Error('The native Stone/Harass reveal offers did not finish.');
}

/** Traitor declarations and the native aftermath; asserts physical conservation. */
export function finishStoneHarassBattle(state: Game, options: {
  mode?: StoneHarassMode; modes?: Record<string, StoneHarassMode>;
  returns?: HarassWithdrawSelection; traitors?: readonly string[];
} = {}): Game {
  let game = chooseStoneHarassReveal(state, options);
  for (let attempt = 0; game.battle && attempt < 10; attempt++) {
    assert.equal(game.decision, null, 'Every required reveal choice precedes traitor declarations.');
    const battle = viewGame(game, game.battle!.attacker).battle!;
    const voter = battle.traitorVoters.find(id => !battle.traitorSubmitted.includes(id));
    if (!voter) break;
    game = applyAction(game, voter, { type: 'traitorCall',
      call: options.traitors?.includes(voter) ?? false });
    if (game.decision) break;
  }
  game = finishOccupyCardsAftermath(game);
  stoneHarassCustody(game);
  return game;
}

export type StoneHarassOccupyOptions = {
  lead?: 'ecaz' | 'ally';
  allyFaction?: 'guild' | 'ixians' | 'tleilaxu';
  /** Stage Harass in the selected lead's plan; false keeps the same card in hand. */
  harass?: boolean;
  stone?: 'opponent' | 'harass';
  mirror?: boolean;
  variableDial?: number;
  support?: number;
  ecazForces?: number;
  allyForces?: number;
  allyElite?: number;
  opponentForces?: number;
  opponentElite?: number;
  opponentDial?: number;
  mode?: StoneHarassMode;
};
export type StoneHarassOccupyCase = StoneHarassCase & {
  occupy: EcazOccupyFixture;
  ecaz: string;
  ally: string;
  opponent: string;
  lead: string;
};

/** Genuine E3 advanced roster (Ecaz, its real ally, a classic opponent and
 * Richese's own cache) through the original Nexus, shared shipment and Occupy
 * lead choice. Only conserved card/force staging exposes the Stone rule. */
export function stoneHarassOccupyFixture(
  options: StoneHarassOccupyOptions = {},
): StoneHarassOccupyCase {
  const lead: 'ecaz' | 'ally' = options.lead ?? 'ecaz';
  const allyFaction = options.allyFaction ?? 'guild';
  const expansions: Game['expansions'] = ['ecaz', 'choam', ...(allyFaction === 'guild' ? [] : ['ix'] as const)];
  // The original four-seat advanced lobby supplies Ecaz, its real ally, a
  // classic opponent and Richese's own card cache; every later step is native.
  let initial = createGame('STONEOCCUPY', newPlayer('ecaz', 'ecaz', 'ecaz'), true, expansions);
  for (const faction of [allyFaction, 'emperor', 'richese'] as const)
    joinGame(initial, newPlayer(faction, faction, faction));
  for (const player of initial.players) initial = applyAction(initial, player.id, { type: 'ready' });
  initial.ecazTreachery = true;
  initial = initializeEcazOccupyGameForAudit(initial);
  const occupy = ecazOccupyFixture({ initial, expansions, ecazTreachery: true,
    allyFaction, opponentFaction: 'emperor',
    ecazForces: options.ecazForces ?? 5, allyForces: options.allyForces ?? 4,
    ...(options.allyElite === undefined ? {} : { allyElite: options.allyElite }),
    ...(options.opponentForces === undefined ? {} : { opponentForces: options.opponentForces }),
    ...(options.opponentElite === undefined ? {} : { opponentElite: options.opponentElite }) });
  // Isolate selected battle cards after genuine setup/auctions, before the
  // lead choice reserves any plan. Return real unselected hands to the deck;
  // adding Stone, Harass and a paired reserve card must not create a fifth card.
  for (const player of occupy.game.players) {
    occupy.game.deck.push(...player.hand);
    player.hand = [];
  }
  const owner = lead === 'ecaz' ? occupy.ecaz : occupy.ally;
  const harassOwner = options.harass === false ? null : owner;
  const stoneOwner = options.stone === 'harass' ? owner : occupy.opponent;
  const mirrorOwner = options.mirror ? stoneOwner === owner ? occupy.opponent : owner : null;
  if (owner) takeHarassCard(occupy.game, owner, HARASS_CARD);
  takeStoneHarassCard(occupy.game, stoneOwner, STONE_CARD);
  if (mirrorOwner) takeStoneHarassCard(occupy.game, mirrorOwner, MIRROR_CARD);
  const game = finishHarassPreparation(openEcazOccupyPlans(chooseEcazOccupyLead(occupy, lead)));
  const profile = viewGame(game, owner).battle?.ecazOccupy?.profile;
  assert.ok(profile, 'The native Occupy plan must quote its physical profile.');
  const variableDial = options.variableDial ?? 0;
  const leaders: Record<string, string> = {
    [owner]: stoneHarassPlayer(game, owner).leaders.find(leader => !leader.dead && !leader.usedAt)!.id,
    [occupy.opponent]: stoneHarassPlayer(game, occupy.opponent)
      .leaders.find(leader => !leader.dead && !leader.usedAt)!.id,
  };
  const plans: StoneHarassStep[] = [
    { actor: owner, action: { type: 'battlePlan', dial: profile.fixedEcazDial + variableDial,
      support: options.support ?? variableDial, leader: leaders[owner],
      ...(stoneOwner === owner ? { weapon: STONE_CARD } : {}),
      ...(mirrorOwner === owner ? { weapon: MIRROR_CARD } : {}),
      ...(harassOwner && options.harass !== false ? { defense: HARASS_CARD } : {}) } },
    { actor: occupy.opponent, action: { type: 'battlePlan', dial: options.opponentDial ?? 0,
      support: 0, leader: leaders[occupy.opponent],
      ...(stoneOwner === occupy.opponent ? { weapon: STONE_CARD } : {}),
      ...(mirrorOwner === occupy.opponent ? { weapon: MIRROR_CARD } : {}) } },
  ];
  stoneHarassCustody(game);
  return { game, plans, occupy, ecaz: occupy.ecaz, ally: occupy.ally, opponent: occupy.opponent,
    lead: owner, harassOwner, stoneOwner, mirrorOwner,
    attacker: game.battle!.attacker, defender: game.battle!.defender,
    territory: occupy.territory, sector: Number(occupy.location.split(':')[1]),
    location: occupy.location, locations: [occupy.location],
    leaders, dials: { [owner]: profile.fixedEcazDial + variableDial,
      [occupy.opponent]: options.opponentDial ?? 0 },
    supports: { [owner]: options.support ?? 0, [occupy.opponent]: 0 },
    mode: options.mode ?? 'ignore' };
}
