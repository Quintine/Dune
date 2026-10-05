import assert from 'node:assert/strict';
import {
  applyAction, createGame, initializeLeaderSkillsGameForAudit, joinGame, newPlayer,
  viewGame, type Action, type Game,
} from '../game/engine';
import { gameDistance, gameTerritories, MOBILE_LOCATION, splitLocation, territory } from '../game/board';
import { isAuditorLeader } from '../game/cards';
import { DISCOVERY_CARD_PLACEMENTS } from '../game/discoveries';
import { greatMakerRideAction } from '../game/great-maker-options';
import { LEADER_SKILL_CARDS, type LeaderSkillId } from '../game/leader-skill-cards';
import { pairedNexusLeaderSkillsProfile } from '../game/leader-skill-profile';
import { traitorDeck } from '../game/traitors';
import { nextPairedIxNexusSkillsModulesStep } from './fixture-paired-ix-nexus-skills-modules';
import {
  pairedDiscoveryNexusClean as clean, pairedDiscoveryNexusPlayer,
  placePairedDiscoveryNexus, reservePairedDiscoveryNexusBoard,
  type PairedDiscoveryNexusClosing, type PairedDiscoveryNexusFixture,
  type PairedDiscoveryNexusTransition,
} from './fixture-discovery-paired-nexus';
import { withClassicDiscoveryNexusLottery, withClassicDiscoveryNexusToken } from './fixture-discovery-classic-nexus';

export type DiscoveryPairedNexusE1SkillsStep = { actor: string; action: Action };
export type DiscoveryPairedNexusE1SkillsOptions = {
  /** Authenticated original lobby or unassigned original turn-one setup. */
  initial?: Game;
  advanced?: boolean;
  tech?: boolean;
  strongholds?: boolean;
  /** An explicit discipline must belong to the actual original offer. */
  skill?: LeaderSkillId;
};
export type DiscoveryPairedNexusE1SkillsSetup = {
  initial: Game; setup: Game; offered: Game; afterSetup: Game; game: Game;
  owner: string; native: string; guild: string; fremen: string;
  trainer: string; skill: LeaderSkillId;
  actions: DiscoveryPairedNexusE1SkillsStep[]; staging: string[];
};
export type DiscoveryPairedNexusE1SkillsEntry = PairedDiscoveryNexusFixture & {
  offered: Game; trainer: string; skill: LeaderSkillId;
};
export type DiscoveryPairedNexusE1SkillsBattle = {
  entry: DiscoveryPairedNexusE1SkillsEntry; closing: PairedDiscoveryNexusClosing;
  beforeBattle: Game; battleStep: DiscoveryPairedNexusE1SkillsStep; game: Game;
  owner: string; opponent: string; trainer: string; skill: LeaderSkillId;
  enemy: string; location: 'shrine:0'; replacementSource: string;
  /** Only original, actually dealt cards are eligible; none is injected. */
  weapon: string | null; defense: string | null;
  plans: DiscoveryPairedNexusE1SkillsStep[];
  actions: DiscoveryPairedNexusE1SkillsStep[]; staging: string[];
};
export type DiscoveryPairedNexusE1SkillsBoundary =
  'losses' | 'rescue' | 'substitution' | 'cards' | 'tech' | 'faceDance' | 'complete';
export const discoveryPairedNexusE1SkillsPlayer = pairedDiscoveryNexusPlayer;

/** Original schedulers handle shared responses first. Returned controls never
 * choose an owned free entry, vote, ride, Cunning, private plan or Face Dance. */
export function nextDiscoveryPairedNexusE1SkillsStep(game: Game): DiscoveryPairedNexusE1SkillsStep | null {
  if (!game.phaseOpening && !game.response && !game.pendingTreacheryDiscard) {
    const d = game.decision;
    if (d?.kind === 'discoveryEntry' || d?.kind === 'greatMakerRide')
      return { actor: d.player, action: { type: 'decision', event: d.event, accept: false } };
    if (d?.kind === 'greatMakerVote')
      return { actor: d.player, action: { type: 'decision', event: d.event, yes: false } };
    if (d?.kind === 'discoveryDiscard') {
      const card = pairedDiscoveryNexusPlayer(game, d.player).hand[0]; assert.ok(card);
      return { actor: d.player, action: { type: 'decision', event: d.event, card: card.id } };
    }
    if (d?.kind === 'faceDance' || d?.kind === 'strongholdCopy') return null;
  }
  return nextPairedIxNexusSkillsModulesStep(game);
}
export function stepDiscoveryPairedNexusE1Skills(game: Game, step: DiscoveryPairedNexusE1SkillsStep,
  actions?: DiscoveryPairedNexusE1SkillsStep[]): Game {
  actions?.push(structuredClone(step));
  return withClassicDiscoveryNexusLottery(() => applyAction(game, step.actor, step.action));
}
export function advanceDiscoveryPairedNexusE1Skills(state: Game, until: (game: Game) => boolean,
  actions?: DiscoveryPairedNexusE1SkillsStep[]): Game {
  let game = structuredClone(state);
  for (let n = 0; n < 2400; n++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished');
    const step = nextDiscoveryPairedNexusE1SkillsStep(game);
    assert.ok(step, 'Original paired E1 needs its owned human plan, copy or matching Face Dance');
    game = stepDiscoveryPairedNexusE1Skills(game, step, actions);
  }
  throw Error('Original paired E1 Discovery/Skills programme did not reach its human boundary');
}

/** Bounded original shuffle control. Byte/UUID entropy is forwarded unchanged. */
function withShuffle<T>(operation: () => T, source: string[], desired: string[]): T {
  assert.deepEqual([...source].sort(), [...desired].sort());
  const working = [...source], rolls: number[] = [];
  for (let i = working.length - 1; i > 0; i--) {
    const from = working.indexOf(desired[i]); assert.ok(from >= 0 && from <= i);
    rolls.push(Math.floor((from + 0.5) * 0x100000000 / (i + 1)));
    [working[i], working[from]] = [working[from], working[i]];
  }
  const descriptor = Object.getOwnPropertyDescriptor(crypto, 'getRandomValues');
  const native = crypto.getRandomValues.bind(crypto); let cursor = 0;
  crypto.getRandomValues = <V extends ArrayBufferView | null>(array: V): V => {
    if (array instanceof Uint32Array) for (let i = 0; i < array.length; i++) array[i] = rolls[cursor++] ?? 0xffffffff;
    else Reflect.apply(native, crypto, [array]);
    return array;
  };
  try { return operation(); }
  finally {
    if (descriptor) Object.defineProperty(crypto, 'getRandomValues', descriptor);
    else Reflect.deleteProperty(crypto, 'getRandomValues');
  }
}

/** Starting hands precede Skills. Supplied hands/offers and actor IDs are
 * authoritative. Only an original undealt shuffle is controlled, never redealt. */
export function initializeDiscoveryPairedNexusE1SkillsSetup(
  options: DiscoveryPairedNexusE1SkillsOptions = {},
): DiscoveryPairedNexusE1SkillsSetup {
  const advanced = options.advanced ?? options.initial?.advanced ?? true;
  const tech = options.tech ?? (options.initial ? !!options.initial.techTokens : true);
  const strongholds = options.strongholds ?? (options.initial ? !!options.initial.strongholdCards : advanced);
  let game = options.initial ? structuredClone(options.initial)
    : createGame('DISCOVERYPAIREDE1SKILLS', newPlayer('ixians', 'Ixians', 'ixians'), advanced, ['ix']);
  if (!options.initial) for (const faction of ['tleilaxu', 'guild', 'fremen'] as const)
    joinGame(game, newPlayer(faction, faction, faction));
  assert.deepEqual(game.players.map(p => p.faction).sort(), ['ixians', 'tleilaxu', 'guild', 'fremen'].sort());
  assert.deepEqual(game.expansions, ['ix']); assert.equal(game.advanced, advanced);
  assert.ok(!game.homeworlds && !game.ecazTreachery);
  assert.ok(game.status === 'lobby' || game.status === 'setup' && game.turn === 1 && game.phase === 0 &&
    game.leaderSkills?.assignments.length === 0 && game.players.every(p => !p.traitors.length && !p.faceDancers?.length &&
      p.leaders.every(l => !l.dead && !l.usedAt)), 'Only a genuine original lobby or unassigned native setup may continue');
  const initial = structuredClone(game), actions: DiscoveryPairedNexusE1SkillsStep[] = [], staging: string[] = [];
  const seat = (faction: string) => game.players.find(p => p.faction === faction)!.id;
  const owner = seat('ixians'), native = seat('tleilaxu'), guild = seat('guild'), fremen = seat('fremen');
  const requested = options.skill ?? 'suk-graduate';
  const passives: LeaderSkillId[] = (['sandmaster', 'smuggler', 'prana-bindu-adept', 'killer-medic'] as LeaderSkillId[])
    .filter(skill => skill !== requested);
  const selected: LeaderSkillId[] = game.players.map(p => p.id === owner ? requested : passives.shift()!);
  if (game.status === 'lobby') {
    assert.ok(!game.leaderSkills);
    for (const [type, enabled, present] of [
      ['techTokens', tech, !!game.techTokens], ['strongholdCards', strongholds, !!game.strongholdCards],
    ] as const) if (enabled !== present)
      game = stepDiscoveryPairedNexusE1Skills(game, { actor: game.host, action: { type, enabled } }, actions);
    game.discoveryEnabled = true; game.nexusCards ??= { cards: null, phase: null };
    assert.deepEqual(game.nexusCards, { cards: null, phase: null });
    for (const p of game.players) if (!p.ready)
      game = stepDiscoveryPairedNexusE1Skills(game, { actor: p.id, action: { type: 'ready' } }, actions);
    const source = LEADER_SKILL_CARDS.map(c => c.id), remainder = source.filter(s => !selected.includes(s));
    const desired = selected.flatMap(s => [s, remainder.shift()!]);
    game = withShuffle(() => initializeLeaderSkillsGameForAudit(game), source, [...desired, ...remainder]);
    staging.push('Controlled original all14 shuffle before original starting-card selection; native all47 first hands and actual two-card offers are never replaced.');
  }
  assert.ok(pairedNexusLeaderSkillsProfile(game)); assert.equal(game.discoveryEnabled, true);
  assert.equal(!!game.techTokens, tech); assert.equal(!!game.strongholdCards, strongholds);
  assert.ok(game.discoveries && game.nexusCards?.cards && game.leaderSkills);
  const setup = structuredClone(game); let offered = structuredClone(game), trainer = '';
  for (let n = 0; game.status === 'setup' && n < 250; n++) {
    let step: DiscoveryPairedNexusE1SkillsStep;
    if (game.setupStage === 'leaderSkills') {
      if (offered.setupStage !== 'leaderSkills') offered = structuredClone(game);
      const actor = Object.keys(game.leaderSkills!.offers)[0], offer = game.leaderSkills!.offers[actor];
      const projection = viewGame(game, actor).leaderSkills!;
      const legal = offer.cards.filter(c => !projection.unavailableSkills?.[c]);
      const desired = selected[game.players.findIndex(p => p.id === actor)];
      const skill = actor === owner && options.skill ? legal.find(c => c === options.skill)
        : options.initial?.status === 'setup' ? legal[0] : legal.find(c => c === desired) ?? legal[0];
      const eligible = new Set(projection.eligibleLeaders.map(l => l.id));
      const leader = pairedDiscoveryNexusPlayer(game, actor).leaders.filter(l => eligible.has(l.id))
        .sort((a, b) => b.strength - a.strength)[0];
      assert.ok(skill && leader, 'Explicit training must be available in the original offer on an original eligible living disc');
      if (actor === owner) trainer = leader.id;
      step = { actor, action: { type: 'leaderSkill', event: offer.event, skill, leader: leader.id } };
    } else {
      const next = nextDiscoveryPairedNexusE1SkillsStep(game); assert.ok(next); step = next;
      if (game.setupStage === 'traitors' && step.action.type === 'traitor') {
        const card = pairedDiscoveryNexusPlayer(game, step.actor).traitorChoices.find(id => id !== trainer);
        assert.ok(card); step.action.leader = card;
      }
    }
    if (game.setupStage === 'forces') {
      const held = new Set(game.players.flatMap(p => p.traitors));
      const source = traitorDeck(game.players, true).filter(id => !held.has(id));
      assert.ok(source.includes(trainer)); actions.push(structuredClone(step));
      game = withShuffle(() => applyAction(game, step.actor, step.action), source, [trainer, ...source.filter(id => id !== trainer)]);
      staging.push('Controlled original undealt Traitor remainder shuffle before actual native three-Face-Dancer draw; no held identity, reveal flag or replacement history is assigned.');
    } else game = stepDiscoveryPairedNexusE1Skills(game, step, actions);
  }
  assert.equal(game.status, 'playing');
  const assignment = game.leaderSkills!.assignments.find(a => a.owner === owner)!;
  return { initial, setup, offered, afterSetup: structuredClone(game), game, owner, native, guild, fremen,
    trainer: assignment.leader, skill: assignment.skill, actions, staging };
}

/** Printed blow, actual paid typed collection and real inspection/reveal precede
 * first END Mentat. The endpoint is free entry BEFORE next Storm, not a fake clock. */
export function createDiscoveryPairedNexusE1SkillsEntry(
  options: DiscoveryPairedNexusE1SkillsOptions = {},
): DiscoveryPairedNexusE1SkillsEntry {
  const s = initializeDiscoveryPairedNexusE1SkillsSetup(options);
  const { owner, native, guild, fremen, trainer, skill, actions, staging } = s;
  let game = s.game;
  const take = (matches: (card: Game['spiceDeck'][number]) => boolean) => {
    const at = game.spiceDeck.findIndex(matches); assert.ok(at >= 0); return game.spiceDeck.splice(at, 1)[0];
  };
  const ordered = [take(c => 'territory' in c && c.discovery === 'discovery-hagga-basin')];
  if (game.advanced) ordered.push(take(c => 'territory' in c && !c.discovery && c.territory === 'broken_land'));
  ordered.push(take(c => 'worm' in c && !!c.greatMaker));
  ordered.push(take(c => 'territory' in c && c.discovery === 'discovery-sihaya-ridge'));
  if (game.advanced) ordered.push(take(c => 'territory' in c && !c.discovery && c.territory === 'rock_outcroppings'));
  game.spiceDeck.unshift(...ordered);
  staging.push('Conserved original unplayed Spice order: printed Hagga Basin and optional Advanced Broken Land, then Great Maker, Sihaya Ridge and optional Advanced Rock Outcroppings.');
  game = advanceDiscoveryPairedNexusE1Skills(game, g => g.phase === 1 && clean(g), actions);
  for (let n = 0; !game.discoveries!.tokens.some(t => t.face === 'shrine' && t.status === 'placed') && n < 100; n++) {
    const step = nextDiscoveryPairedNexusE1SkillsStep(game); assert.ok(step); actions.push(structuredClone(step));
    game = withClassicDiscoveryNexusToken(game, 'shrine', () => applyAction(game, step.actor, step.action));
  }
  const token = game.discoveries!.tokens.find(t => t.face === 'shrine')!; assert.equal(token.status, 'placed');
  staging.push('Actual original supply-token lottery selects Shrine at the printed first blow; no token face, status or location is assigned.');
  const printed = DISCOVERY_CARD_PLACEMENTS['discovery-hagga-basin'], source = `${printed.territory}:${printed.sector}`;
  game = advanceDiscoveryPairedNexusE1Skills(game, g => g.phase === 5 && g.active === owner && clean(g), actions);
  game = stepDiscoveryPairedNexusE1Skills(game, { actor: owner, action: { type: 'ship', territory: printed.territory,
    sector: printed.sector, amount: 3, elite: 1, allyPayment: 0 } }, actions);
  game = advanceDiscoveryPairedNexusE1Skills(game, g => g.phase === 7 && clean(g), actions);
  const collection = structuredClone(game);
  for (const reveal of [false, true]) game = stepDiscoveryPairedNexusE1Skills(game,
    { actor: owner, action: { type: 'discovery', token: token.id, reveal } }, actions);
  game = advanceDiscoveryPairedNexusE1Skills(game, g => g.phase === 8 && clean(g), actions);
  reservePairedDiscoveryNexusBoard(game, [source, MOBILE_LOCATION]);
  placePairedDiscoveryNexus(game, owner, `arrakeen:${territory('arrakeen').sectors[0]}`, 1);
  placePairedDiscoveryNexus(game, native, 'hagga_basin:12', 2);
  staging.push('Before real END Mentat, conserve unrelated counters into original reserves, retain paid parent/HMS groups, place one Arrakeen claim and two native Maker-source counters. No wallet, earned Card, training or phase is assigned.');
  let firstMentat: PairedDiscoveryNexusTransition | undefined;
  while (game.turn === 1) {
    const before = structuredClone(game), step = nextDiscoveryPairedNexusE1SkillsStep(game); assert.ok(step);
    game = stepDiscoveryPairedNexusE1Skills(game, step, actions);
    if (game.turn === 2) firstMentat = { before, step, after: structuredClone(game) };
  }
  assert.ok(firstMentat);
  game = advanceDiscoveryPairedNexusE1Skills(game, g => g.decision?.kind === 'discoveryEntry', actions);
  assert.equal(game.phase, 0); assert.equal(game.decision!.player, owner);
  return { initial: s.initial, setup: s.setup, offered: s.offered, afterSetup: s.afterSetup, collection, firstMentat,
    game, family: 'ix', owner, native, collector: owner, guild, fremen, token: token.id, source, claim: 'arrakeen',
    trainer, skill, actions, staging };
}

/** Human typed entry, exact storm-order votes/ride and settled classic alliance
 * precede the real end-Spice choice. Both Advanced piles are processed natively. */
export function closeDiscoveryPairedNexusE1Skills(f: DiscoveryPairedNexusE1SkillsEntry): PairedDiscoveryNexusClosing {
  const before = structuredClone(f.game), offer = viewGame(before, f.owner).discoveryEntry!;
  const step: DiscoveryPairedNexusE1SkillsStep = { actor: f.owner, action: { type: 'decision', event: offer.event,
    accept: true, groups: [{ source: f.source, normal: 1, elite: 1 }] } };
  let game = stepDiscoveryPairedNexusE1Skills(before, step, f.actions);
  const entry = { before, step, after: structuredClone(game) };
  game = advanceDiscoveryPairedNexusE1Skills(game, g => g.greatMaker?.stage === 'vote', f.actions);
  const vote = structuredClone(game);
  while (game.decision?.kind === 'greatMakerVote') game = stepDiscoveryPairedNexusE1Skills(game,
    { actor: game.decision.player, action: { type: 'decision', event: game.decision.event, yes: true } }, f.actions);
  assert.equal(game.decision?.kind, 'greatMakerRide'); assert.equal(game.decision!.player, f.fremen);
  const rideBefore = structuredClone(game);
  const action = greatMakerRideAction(viewGame(game, f.fremen), 'polar_sink', 0, 2, game.advanced ? 1 : 0); assert.ok(action);
  const rideStep = { actor: f.fremen, action }; game = stepDiscoveryPairedNexusE1Skills(game, rideStep, f.actions);
  const ride = { before: rideBefore, step: rideStep, after: structuredClone(game) };
  game = advanceDiscoveryPairedNexusE1Skills(game, g => !!g.nexus && !g.spiceWindow && !g.spiceResolution && clean(g), f.actions);
  for (const [actor, target] of [[f.guild, f.fremen], [f.fremen, f.guild]])
    game = stepDiscoveryPairedNexusE1Skills(game, { actor, action: { type: 'alliance', target } }, f.actions);
  const alliance = structuredClone(game);
  game = advanceDiscoveryPairedNexusE1Skills(game, g => g.nexusCards?.phase?.stage === 'drawing', f.actions);
  const cards = game.nexusCards!.cards!; assert.ok(cards.deck.includes('ixians') && cards.deck.includes('tleilaxu'));
  cards.deck = ['ixians', 'tleilaxu', ...cards.deck.filter(c => c !== 'ixians' && c !== 'tleilaxu')];
  f.staging.push('Conserved undealt all12 singleton order only; native Cunning hands are earned by actual unallied closing choices after both Spice piles and settled classic alliance.');
  const drawing = structuredClone(game);
  for (const actor of [f.owner, f.native]) game = stepDiscoveryPairedNexusE1Skills(game,
    { actor, action: { type: 'nexusCardChoice', turn: game.turn, card: cards.hands[actor], choice: 'draw', ownRedraws: 0 } }, f.actions);
  game = advanceDiscoveryPairedNexusE1Skills(game, g => g.nexusCards?.phase?.stage !== 'drawing', f.actions);
  return { entry, vote, ride, alliance, drawing, afterDraw: structuredClone(game) };
}

/** Turn-two physical consumer, retaining original first hands. Eight Ix counters
 * (six Suboids/two Cyborgs) make Suk rescue leave a genuine Cyborg Tank loss even
 * under full Suboid Cunning. A second conflict keeps cleanup in native Battle. */
export function prepareDiscoveryPairedNexusE1SkillsBattle(f: DiscoveryPairedNexusE1SkillsEntry,
  closing = closeDiscoveryPairedNexusE1Skills(f)): DiscoveryPairedNexusE1SkillsBattle {
  let game = advanceDiscoveryPairedNexusE1Skills(closing.afterDraw, g => g.phase === 5 && clean(g), f.actions);
  reservePairedDiscoveryNexusBoard(game, [MOBILE_LOCATION]);
  const location = 'shrine:0';
  placePairedDiscoveryNexus(game, f.owner, location, 8, 2);
  placePairedDiscoveryNexus(game, f.native, location, 8);
  placePairedDiscoveryNexus(game, f.native, f.source, 3);
  const other = gameTerritories(game).find(t => t.type === 'sand' && t.id !== 'hagga_basin' && t.id !== 'gara_kulon' &&
    t.sectors.some(s => s >= 9 && s !== game.storm)); assert.ok(other);
  const key = `${other.id}:${other.sectors.find(s => s >= 9 && s !== game.storm)}`;
  for (const actor of [f.owner, f.native]) placePairedDiscoveryNexus(game, actor, key, 1);
  const enemy = pairedDiscoveryNexusPlayer(game, f.native).leaders.filter(l => !l.dead && !isAuditorLeader(l) &&
    !game.leaderSkills!.assignments.some(a => a.leader === l.id)).sort((a, b) => a.strength - b.strength)[0]; assert.ok(enemy);
  const own = pairedDiscoveryNexusPlayer(game, f.owner);
  const weapon = own.hand.find(c => c.kind === 'projectile' || c.kind === 'worthless')?.id ?? null;
  const defense = own.hand.find(c => c.kind === 'shield')?.id ?? null;
  assert.ok(pairedDiscoveryNexusPlayer(game, f.native).faceDancers!.some(c => c.leader === f.trainer && !c.revealed));
  f.staging.push('Before native Movement completion, conserve original counters into revealed Shrine, native parent replacement sources and second conflict. All held Treachery remains actually dealt; no card injection or identity exchange.');
  game = advanceDiscoveryPairedNexusE1Skills(game, g => g.phase === 6 && clean(g), f.actions);
  const beforeBattle = structuredClone(game), actor = game.active!; assert.ok(actor === f.owner || actor === f.native);
  const battleStep: DiscoveryPairedNexusE1SkillsStep = { actor,
    action: { type: 'chooseBattle', territory: 'shrine', target: actor === f.owner ? f.native : f.owner } };
  game = stepDiscoveryPairedNexusE1Skills(game, battleStep, f.actions);
  const plans: DiscoveryPairedNexusE1SkillsStep[] = [
    { actor: f.owner, action: { type: 'battlePlan', leader: f.trainer, dial: 8,
      support: game.advanced ? 2 : 0, weapon, defense } },
    { actor: f.native, action: { type: 'battlePlan', leader: enemy.id, dial: 0, support: 0, weapon: null, defense: null } },
  ];
  return { entry: f, closing, game, beforeBattle, battleStep, owner: f.owner, opponent: f.native,
    trainer: f.trainer, skill: f.skill, enemy: enemy.id, location, replacementSource: f.source,
    weapon, defense, plans, actions: f.actions, staging: f.staging };
}
export function createDiscoveryPairedNexusE1SkillsBattle(options: DiscoveryPairedNexusE1SkillsOptions = {}): DiscoveryPairedNexusE1SkillsBattle {
  return prepareDiscoveryPairedNexusE1SkillsBattle(createDiscoveryPairedNexusE1SkillsEntry(options));
}
export function prepareDiscoveryPairedNexusE1SkillsPlans(f: DiscoveryPairedNexusE1SkillsBattle, state = f.game): Game {
  let game = structuredClone(state);
  for (let n = 0; n < 160; n++) {
    const step = nextDiscoveryPairedNexusE1SkillsStep(game);
    if (!step) { assert.ok(game.battle && !game.battle.revealed); return game; }
    if (step.action.type === 'leaderSkillVisibility') step.action.hide = step.actor === f.owner;
    game = stepDiscoveryPairedNexusE1Skills(game, step, f.actions);
  }
  throw Error('Original paired E1 skill posture did not reach private plans');
}
export function beginDiscoveryPairedNexusE1SkillsCunning(f: DiscoveryPairedNexusE1SkillsBattle,
  state = prepareDiscoveryPairedNexusE1SkillsPlans(f)): Game {
  const offer = viewGame(state, f.owner).nexusSuboids?.offer; assert.ok(offer); assert.equal(offer.blocked, null);
  return stepDiscoveryPairedNexusE1Skills(state, { actor: f.owner, action: { type: 'nexusSuboids', event: offer.event } }, f.actions);
}
/** Suggested high-dial plans consume actual Cunning first. Humans may replace
 * either suggested plan and explicitly opt out with their own legal dial. */
export function revealDiscoveryPairedNexusE1SkillsBattle(f: DiscoveryPairedNexusE1SkillsBattle,
  options: { state?: Game; cunning?: boolean; plans?: DiscoveryPairedNexusE1SkillsStep[] } = {}): Game {
  let game = prepareDiscoveryPairedNexusE1SkillsPlans(f, options.state ?? f.game);
  if (options.cunning !== false) game = advanceDiscoveryPairedNexusE1Skills(beginDiscoveryPairedNexusE1SkillsCunning(f, game), clean, f.actions);
  for (const step of options.plans ?? f.plans) {
    game = stepDiscoveryPairedNexusE1Skills(game, step, f.actions);
    while (game.response || game.phaseOpening || game.decision?.kind === 'fullPlanOffer') {
      const next = nextDiscoveryPairedNexusE1SkillsStep(game); assert.ok(next);
      game = stepDiscoveryPairedNexusE1Skills(game, next, f.actions);
    }
  }
  assert.ok(game.battle?.revealed); return game;
}
export function finishDiscoveryPairedNexusE1SkillsBattle(state: Game,
  stop: DiscoveryPairedNexusE1SkillsBoundary = 'complete', actions?: DiscoveryPairedNexusE1SkillsStep[]): Game {
  const kinds: Record<DiscoveryPairedNexusE1SkillsBoundary, string> = { losses: 'battleLosses', rescue: 'sukRescue',
    substitution: 'ixSubstitution', cards: 'battleCards', tech: 'techToken', faceDance: 'faceDance', complete: '' };
  return advanceDiscoveryPairedNexusE1Skills(state, game => game.decision?.kind === kinds[stop] ||
    stop === 'losses' && game.decision?.kind === 'sukRescue' ||
    stop === 'tech' && game.decision?.kind === 'faceDance' && !game.pendingTech ||
    !game.battle && clean(game) && !game.pendingTreacheryDiscard, actions);
}
/** Printed graph search only; the actual movement action validates its range. */
export function discoveryPairedNexusE1SkillsRangeSource(game: Game): string {
  const source = gameTerritories(game).flatMap(t => t.type === 'sand' ? t.sectors.map(s => `${t.id}:${s}`) : [])
    .find(key => gameDistance(game, key, 'shrine:0', candidate => splitLocation(candidate).sector === game.storm) === 3);
  assert.ok(source, 'Revealed original nested graph must supply a three-territory Planetologist consumer');
  return source;
}
