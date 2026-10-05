import assert from 'node:assert/strict';
import {
  applyAction, createGame, joinGame, newPlayer, viewGame, type Game,
} from '../game/engine';
import { gameDistance, gameTerritories, splitLocation, territory } from '../game/board';
import { type Card } from '../game/cards';
import { validateLeaderSkills } from '../game/leader-skills';
import { type LeaderSkillId } from '../game/leader-skill-cards';
import { initializeAdvancedNativeSkillsSetup } from './fixture-advanced-native-skills';
import { nextSkillsTechBattleStep, openSkillsTechBattle, type SkillsTechBattleStep } from './fixture-skills-tech-battle';
import { nativeTypedClearBoard, nativeTypedCustody, nativeTypedPlace, nativeTypedPlayer } from './fixture-discovery-native-typed';
import { putDiscovery } from './fixture-discovery';

export type DiscoveryNativeE1SkillsOptions = {
  /** Original authenticated lobby or original undealt skill setup. Never convert a played save. */
  initial?: Game;
  advanced?: boolean;
  tech?: boolean;
  strongholds?: boolean;
  skill?: LeaderSkillId;
};
export type DiscoveryNativeE1SkillsStep = SkillsTechBattleStep;
export type DiscoveryNativeE1SkillsEntry = {
  initial: Game;
  offered: Game;
  afterSetup: Game;
  afterFirstStorm: Game;
  beforeFirstMentat: Game;
  firstMentatStep: DiscoveryNativeE1SkillsStep;
  game: Game;
  owner: string;
  opponent: string;
  guild: string;
  fremen: string;
  trainer: string;
  skill: LeaderSkillId;
  token: string;
  source: string;
  actions: DiscoveryNativeE1SkillsStep[];
  staging: string[];
};
export type DiscoveryNativeE1SkillsBattle = DiscoveryNativeE1SkillsEntry & {
  beforeBattle: Game;
  plans: DiscoveryNativeE1SkillsStep[];
  weapon: string;
  defense: string;
  losingCard: string;
  losingLeader: string;
  location: 'shrine:0';
  replacementSource: string;
};
export const reloadDiscoveryNativeE1Skills = (game: Game): Game => JSON.parse(JSON.stringify(game));
export const discoveryNativeE1SkillsPlayer = nativeTypedPlayer;
export function assertDiscoveryNativeE1SkillsCustody(game: Game): void {
  nativeTypedCustody(game);
  validateLeaderSkills(game.leaderSkills!, game.players);
}
const clean = (game: Game) => !game.phaseOpening && !game.response && !game.decision;

/** Original controls, declining optional entry/substitution/Face Dance. Human consumers stop before them. */
export function nextDiscoveryNativeE1SkillsStep(game: Game): DiscoveryNativeE1SkillsStep {
  const d = game.decision;
  if (d?.kind === 'discoveryEntry') return { actor: d.player,
    action: { type: 'decision', event: d.event, accept: false } };
  if (d?.kind === 'ixSubstitution') return { actor: d.player, action: { type: 'decision', decline: true } };
  if (d?.kind === 'faceDance') return { actor: d.player, action: { type: 'decision', reveal: false } };
  if (d?.kind === 'sukRescue') {
    const maximum = Math.max(...d.options.map(o => o.normal + o.elite));
    const choice = d.options.findIndex(o => o.normal + o.elite === maximum && o.kept?.kind === 'normal');
    return { actor: d.player, action: { type: 'decision', event: d.event,
      choice: choice >= 0 ? choice : d.options.findIndex(o => o.normal + o.elite === maximum) } };
  }
  if (d?.kind === 'battleLosses') return { actor: d.player, action: { type: 'decision',
    choice: d.options.findIndex(o => o.elite === Math.max(...d.options.map(c => c.elite))) } };
  return nextSkillsTechBattleStep(game);
}
export function stepDiscoveryNativeE1Skills(game: Game, step = nextDiscoveryNativeE1SkillsStep(game)): Game {
  return applyAction(game, step.actor, step.action);
}
export function advanceDiscoveryNativeE1Skills(state: Game, until: (game: Game) => boolean,
  actions?: DiscoveryNativeE1SkillsStep[]): Game {
  let game = state;
  for (let i = 0; i < 1800; i++) {
    if (until(game)) return game;
    assert.equal(game.status, 'playing', 'Original programme must retain a live game');
    const step = nextDiscoveryNativeE1SkillsStep(game);
    actions?.push(structuredClone(step));
    game = stepDiscoveryNativeE1Skills(game, step);
  }
  throw Error('Original E1 Discovery/Skills programme did not reach its requested control');
}
export function phaseDiscoveryNativeE1Skills(state: Game, phase: number): Game {
  const turn = state.turn;
  return advanceDiscoveryNativeE1Skills(state, game => {
    assert.equal(game.turn, turn, 'Phase continuation cannot invent a later turn');
    return game.phase === phase && clean(game);
  });
}
export function settleDiscoveryNativeE1Skills(state: Game): Game {
  return advanceDiscoveryNativeE1Skills(state, game => clean(game) && !game.pendingShipment && !game.pendingTreacheryDiscard);
}
function held(game: Game, actor: string, predicate: (card: Card) => boolean): string {
  const player = nativeTypedPlayer(game, actor);
  const owned = player.hand.find(predicate);
  if (owned) return owned.id;
  const index = game.deck.findIndex(predicate);
  assert.ok(index >= 0 && player.hand.length < 4, 'Canonical unplayed card and native hand capacity required');
  const card = game.deck.splice(index, 1)[0]; player.hand.push(card);
  return card.id;
}
function matchingDancer(game: Game, actor: string, leader: string): void {
  const stock = nativeTypedPlayer(game, actor).faceDancers!;
  if (stock.some(c => c.leader === leader && !c.revealed)) return;
  const dancer = stock.find(c => !c.revealed); assert.ok(dancer);
  const index = game.traitorReserve!.indexOf(leader);
  if (index >= 0) game.traitorReserve![index] = dancer.leader;
  else {
    const donor = game.players.find(p => p.traitors.includes(leader)); assert.ok(donor);
    donor.traitors[donor.traitors.indexOf(leader)] = dancer.leader;
  }
  dancer.leader = leader;
}

/** Real setup → first Storm/Tech → Collection inspect/reveal → first END Mentat claim
 * → first free typed entry. Conserved unplayed lotteries/positions are labeled below.
 * Explicit requested disciplines require their genuine offer; omitted discipline
 * on a supplied original setup selects an actually available offered card. */
export function createDiscoveryNativeE1SkillsEntry(options: DiscoveryNativeE1SkillsOptions = {}): DiscoveryNativeE1SkillsEntry {
  const requestedSkill = options.skill ?? 'suk-graduate';
  let game = options.initial ? structuredClone(options.initial)
    : createGame('DISCOVERYE1SKILLS', newPlayer('ix', 'Ixians', 'ixians'), options.advanced ?? false, ['ix']);
  if (!options.initial) for (const [id, faction] of [['tl', 'tleilaxu'], ['gu', 'guild'], ['fr', 'fremen']] as const)
    joinGame(game, newPlayer(id, faction, faction));
  assert.ok(game.status === 'lobby' || game.status === 'setup');
  if (options.advanced !== undefined) assert.equal(game.advanced, options.advanced);
  const seat = (faction: string) => {
    const player = game.players.find(p => p.faction === faction); assert.ok(player, `Original ${faction} seat required`);
    return player.id;
  };
  const owner = seat('ixians'), opponent = seat('tleilaxu'), guild = seat('guild'), fremen = seat('fremen');
  if (game.status === 'setup') {
    assert.ok(game.discoveryEnabled && game.leaderSkills && game.turn === 1 && game.phase === 0);
    assert.ok(game.players.every(p => !p.hand.length && !p.traitors.length && !p.traitorChoices.length),
      'Only the original undealt setup with unused Traitor selections may continue');
    if (options.tech) assert.ok(game.techTokens);
    if (options.strongholds) assert.ok(game.strongholdCards);
  } else {
    if (options.tech && !game.techTokens) game = applyAction(game, game.host, { type: 'techTokens', enabled: true });
    if (options.strongholds && !game.strongholdCards) game = applyAction(game, game.host, { type: 'strongholdCards', enabled: true });
    game.discoveryEnabled = true;
  }
  const initial = structuredClone(game), actions: DiscoveryNativeE1SkillsStep[] = [];
  game = initializeAdvancedNativeSkillsSetup({ initial: game, family: 'ixians', skillOwner: 'ixians',
    requestedSkill, rules: game.advanced ? 'advanced' : 'basic' });
  const offered = structuredClone(game);
  for (let i = 0; game.status === 'setup' && i < 250; i++) {
    let step: DiscoveryNativeE1SkillsStep;
    if (game.setupStage === 'leaderSkills') {
      const actor = Object.keys(game.leaderSkills!.offers)[0], offer = game.leaderSkills!.offers[actor];
      const view = viewGame(game, actor).leaderSkills!;
      const selected = actor === owner && !(initial.status === 'setup' && options.skill === undefined)
        ? requestedSkill : offer.cards.find(c => !view.unavailableSkills?.[c]);
      const eligible = new Set(view.eligibleLeaders.map(l => l.id));
      const leader = nativeTypedPlayer(game, actor).leaders.filter(l => eligible.has(l.id))
        .sort((a, b) => b.strength - a.strength)[0];
      assert.ok(selected && offer.cards.includes(selected) && !view.unavailableSkills?.[selected] && leader,
        'The actual original offer and living eligible disc must supply this programme');
      step = { actor, action: { type: 'leaderSkill', event: offer.event, skill: selected, leader: leader.id } };
    } else step = nextDiscoveryNativeE1SkillsStep(game);
    actions.push(structuredClone(step)); game = stepDiscoveryNativeE1Skills(game, step);
  }
  assert.equal(game.status, 'playing');
  const afterSetup = structuredClone(game), assignment = game.leaderSkills!.assignments.find(a => a.owner === owner)!;
  const trainer = assignment.leader, skill = assignment.skill;
  const blows = game.spiceDeck.filter(c => 'territory' in c && !c.discovery).slice(0, 6);
  assert.equal(blows.length, 6);
  for (const [index, card] of blows.entries()) game.spiceDeck.splice(index, 0, game.spiceDeck.splice(game.spiceDeck.indexOf(card), 1)[0]);
  game = advanceDiscoveryNativeE1Skills(game, g => g.phase === 5 && clean(g), actions);
  const afterFirstStorm = structuredClone(game);
  nativeTypedClearBoard(game); // Retains the actual native HMS six-counter garrison.
  const token = putDiscovery(game, 'shrine'), source = `${token.territory}:${token.sector}`;
  assert.notEqual(token.sector, game.storm);
  nativeTypedPlace(game, owner, source, 2, 1);
  if (game.strongholdCards) nativeTypedPlace(game, owner, `arrakeen:${territory('arrakeen').sectors[0]}`, 1);
  game = advanceDiscoveryNativeE1Skills(game, g => g.phase === 7 && clean(g), actions);
  if (viewGame(game, owner).discoveries!.canInspect.includes(token.id)) {
    const step: DiscoveryNativeE1SkillsStep = { actor: owner, action: { type: 'discovery', token: token.id, reveal: false } };
    actions.push(step); game = stepDiscoveryNativeE1Skills(game, step);
  }
  assert.ok(viewGame(game, owner).discoveries!.canReveal.includes(token.id));
  const reveal: DiscoveryNativeE1SkillsStep = { actor: owner, action: { type: 'discovery', token: token.id, reveal: true } };
  actions.push(reveal); game = stepDiscoveryNativeE1Skills(game, reveal);
  game = advanceDiscoveryNativeE1Skills(game, g => g.phase === 8 && clean(g), actions);
  let beforeFirstMentat: Game | undefined, firstMentatStep: DiscoveryNativeE1SkillsStep | undefined;
  while (game.turn === 1) {
    const before = structuredClone(game), step = nextDiscoveryNativeE1SkillsStep(game);
    actions.push(structuredClone(step)); game = stepDiscoveryNativeE1Skills(game, step);
    if (game.turn === 2) { beforeFirstMentat = before; firstMentatStep = step; }
  }
  assert.ok(beforeFirstMentat && firstMentatStep);
  game = advanceDiscoveryNativeE1Skills(game, g => g.decision?.kind === 'discoveryEntry', actions);
  assert.equal(game.decision?.player, owner);
  assertDiscoveryNativeE1SkillsCustody(game);
  return { initial, offered, afterSetup, afterFirstStorm, beforeFirstMentat, firstMentatStep,
    game, owner, opponent, guild, fremen, trainer, skill, token: token.id, source, actions,
    staging: ['Only the original first all14 shuffle is controlled; supplied original offers are unchanged.',
      'Conserved first six unused ordinary Spice Blows moved within their original deck; no fake phase or wallet history.',
      'Conserved original board → reserves except native HMS; two Suboids/one Cyborg placed at an original supply Shrine token.',
      'Optional Arrakeen control is conserved before the real first END Mentat; its retained card is never granted directly.'] };
}

/** Human sequence: decline free entry; real turn-two Movement; physical nested
 * armies/cards; choose Shrine battle; hide training; seal these original plans.
 * The second original conflict keeps cleanup/reward/Face Dance in Battle. */
export function createDiscoveryNativeE1SkillsBattle(options: DiscoveryNativeE1SkillsOptions = {}): DiscoveryNativeE1SkillsBattle {
  const entry = createDiscoveryNativeE1SkillsEntry(options);
  assert.ok(entry.skill === 'suk-graduate' || entry.skill === 'planetologist',
    'This battle consumer requires genuine Suk/Planetologist training; other actual offers retain the typed entry programme');
  assert.ok(entry.game.decision?.kind === 'discoveryEntry');
  let game = applyAction(entry.game, entry.owner, { type: 'decision', event: entry.game.decision.event, accept: false });
  game = phaseDiscoveryNativeE1Skills(game, 5);
  nativeTypedClearBoard(game);
  for (const p of game.players) { game.deck.push(...p.hand); p.hand = []; }
  const location = 'shrine:0';
  nativeTypedPlace(game, entry.owner, location, 6, 2);
  nativeTypedPlace(game, entry.opponent, location, 8);
  const parent = gameTerritories(game).find(t => t.id === splitLocation(entry.source).territory)!;
  const replacementSource = `${parent.id}:${parent.sectors.find(s => s !== game.storm)}`;
  nativeTypedPlace(game, entry.opponent, replacementSource, 3);
  const other = gameTerritories(game).find(t => t.type === 'sand' && t.id !== parent.id && !t.sectors.includes(game.storm));
  assert.ok(other);
  for (const actor of [entry.owner, entry.opponent]) nativeTypedPlace(game, actor, `${other.id}:${other.sectors[0]}`, 1);
  matchingDancer(game, entry.opponent, entry.trainer);
  const losingLeader = nativeTypedPlayer(game, entry.opponent).leaders.filter(l => !l.dead &&
    !game.leaderSkills!.assignments.some(a => a.leader === l.id)).sort((a, b) => a.strength - b.strength)[0];
  assert.ok(losingLeader);
  const weapon = held(game, entry.owner, c => entry.skill === 'planetologist' ? c.id === 'ix-thumper' : c.kind === 'projectile');
  const defense = held(game, entry.owner, c => c.kind === 'shield');
  const losingCard = held(game, entry.opponent, c => c.kind === 'worthless');
  game = phaseDiscoveryNativeE1Skills(game, 6);
  const beforeBattle = structuredClone(game);
  game = openSkillsTechBattle(game, entry.owner, entry.opponent, 'shrine');
  assertDiscoveryNativeE1SkillsCustody(game);
  const plans: DiscoveryNativeE1SkillsStep[] = [
    { actor: entry.owner, action: { type: 'battlePlan', leader: entry.trainer,
      dial: game.advanced ? 5 : 6, support: game.advanced ? 1 : 0, weapon, defense } },
    { actor: entry.opponent, action: { type: 'battlePlan', leader: losingLeader.id, dial: 0, support: 0, weapon: losingCard } },
  ];
  return { ...entry, game, beforeBattle, plans, weapon, defense, losingCard, losingLeader: losingLeader.id,
    location, replacementSource, staging: [...entry.staging,
      'Original turn-two Movement: conserve six Suboids/two Cyborgs at Shrine, eight opposing counters, three replacement sources and a real second conflict.',
      'Canonical unplayed Treachery and private matching Face Dancer identities exchanged within original custody; not a natural lottery claim.'] };
}
export function revealDiscoveryNativeE1SkillsBattle(fixture: DiscoveryNativeE1SkillsBattle): Game {
  let game = reloadDiscoveryNativeE1Skills(fixture.game);
  for (const step of fixture.plans) {
    game = stepDiscoveryNativeE1Skills(game, step);
    if (!game.battle?.revealed) game = settleDiscoveryNativeE1Skills(game);
  }
  assert.ok(game.battle?.revealed);
  return game;
}
export function finishDiscoveryNativeE1SkillsBattle(state: Game,
  stop: 'rescue' | 'substitution' | 'cards' | 'faceDance' | 'complete' = 'complete'): Game {
  const kinds = { rescue: 'sukRescue', substitution: 'ixSubstitution', cards: 'battleCards', faceDance: 'faceDance', complete: '' };
  return advanceDiscoveryNativeE1Skills(state, game => game.decision?.kind === kinds[stop] ||
    !game.battle && clean(game) && !game.pendingTreacheryDiscard);
}
export function movementDiscoveryNativeE1Skills(state: Game, owner: string): Game {
  return advanceDiscoveryNativeE1Skills(phaseDiscoveryNativeE1Skills(state, 5), game => game.active === owner && clean(game));
}
export function discoveryNativeE1PlanetologistRoute(game: Game): { source: string; distance: 2 | 3 } {
  const source = gameTerritories(game).filter(t => t.type === 'sand').flatMap(t => t.sectors.map(s => `${t.id}:${s}`))
    .find(key => splitLocation(key).sector !== game.storm && gameDistance(game, key, 'shrine:0', k => splitLocation(k).sector === game.storm) === 3);
  assert.ok(source, 'Original revealed Shrine must supply a storm-safe three-territory route');
  return { source, distance: 3 };
}
