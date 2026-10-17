import assert from 'node:assert/strict';
import { applyAction, createGame, joinGame, newPlayer, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import type { FactionId } from '../game/catalog';
import type { LeaderSkillId } from '../game/leader-skill-cards';
import { treacheryDeck } from '../game/cards';
import { ecazTreacheryCards } from '../game/ecaz-cards';
import { NEXUS_FACTIONS } from '../game/nexus-cards';
import { skillOfferRolls } from './fixture-independent-card-modules';
import { nextClassicDiscoveryNexusStep, applyClassicDiscoveryNexusStep } from './fixture-discovery-classic-nexus';

export type ClassicIndependentNexusOptions = {
  advanced?: boolean;
  skills?: boolean;
  /** False exercises the original base33 without selecting the independent variant. */
  independent?: boolean;
  tech?: boolean;
  strongholds?: boolean;
  roster?: readonly FactionId[];
  training?: Partial<Record<FactionId, LeaderSkillId>>;
  /** Only original, still-undealt starting Treachery slots are ordered. */
  startingCards?: Partial<Record<FactionId, readonly string[]>>;
};
export type ClassicIndependentNexusStep = { actor: string; action: Action };

export function createClassicIndependentNexusFixture(options: ClassicIndependentNexusOptions = {}) {
  const roster = options.roster ?? ['atreides', 'guild', 'emperor'];
  const advanced = options.advanced ?? false;
  const independent = options.independent ?? true;
  let game = createGame('CLASSICINDEPENDENTNEXUS', newPlayer(roster[0], roster[0], roster[0]), advanced, []);
  for (const faction of roster.slice(1)) joinGame(game, newPlayer(faction, faction, faction));
  const actions: ClassicIndependentNexusStep[] = [], staging: string[] = [];
  const act = (actor: string, action: Action) => {
    actions.push({ actor, action });
    game = game.status === 'setup'
      ? applyClassicDiscoveryNexusStep(game, { actor, action })
      : applyAction(game, actor, action);
  };
  for (const option of [...(independent ? ['ecazTreachery'] : []), 'nexusCards', ...(options.skills ? ['leaderSkills'] : [])])
    act(game.host, { type: 'moduleOption', module: option, enabled: true });
  if (options.tech) act(game.host, { type: 'techTokens', enabled: true });
  if (options.strongholds) act(game.host, { type: 'strongholdCards', enabled: true });
  for (const player of game.players) act(player.id, { type: 'ready' });
  const lobby = structuredClone(game);
  const rolls = options.skills ? skillOfferRolls(game, options.training) : [];
  rolls.push(...Array<number>(NEXUS_FACTIONS.length - 1).fill(0xffffffff));
  if (options.startingCards) {
    const source = [...treacheryDeck([]), ...(independent ? ecazTreacheryCards() : [])].map(card => card.id);
    const used = new Set<string>(), prefix: string[] = [];
    const reserved = new Set(Object.values(options.startingCards).flatMap(cards => cards ?? []));
    for (const player of game.players) {
      const count = player.faction === 'harkonnen' ? 2 : 1;
      const desired = options.startingCards[player.faction] ?? [];
      assert.ok(desired.length <= count);
      for (let index = 0; index < count; index++) {
        const card = desired[index] ?? source.find(id => !used.has(id) && !reserved.has(id));
        assert.ok(card && source.includes(card) && !used.has(card));
        used.add(card); prefix.push(card);
      }
    }
    const target = [...prefix, ...source.filter(id => !used.has(id))], working = [...source];
    for (let index = working.length - 1; index > 0; index--) {
      const from = working.indexOf(target[index]);
      assert.ok(from >= 0 && from <= index);
      rolls.push(Math.floor((from + 0.5) * 0x100000000 / (index + 1)));
      [working[index], working[from]] = [working[from], working[index]];
    }
    staging.push('Select the original unused Treachery shuffle before starting deals; no played hand is changed.');
  }
  let cursor = 0;
  const native = crypto.getRandomValues.bind(crypto);
  const descriptor = Object.getOwnPropertyDescriptor(crypto, 'getRandomValues');
  crypto.getRandomValues = <T extends ArrayBufferView | null>(array: T): T => {
    if (array instanceof Uint32Array && array.length === 1) array[0] = rolls[cursor++] ?? 0xffffffff;
    else Reflect.apply(native, crypto, [array]);
    return array;
  };
  try { act(game.host, advanced ? { type: 'start', advancedPreview: true } : { type: 'start' }); }
  finally {
    if (descriptor) Object.defineProperty(crypto, 'getRandomValues', descriptor);
    else Reflect.deleteProperty(crypto, 'getRandomValues');
  }
  assert.equal(game.status, 'setup');
  const setup = structuredClone(game);
  for (let count = 0; game.status === 'setup' && count < 300; count++) {
    if (game.setupStage === 'leaderSkills') {
      const actor = Object.keys(game.leaderSkills!.offers)[0], own = viewGame(game, actor).leaderSkills!;
      const faction = game.players.find(p => p.id === actor)!.faction;
      const requested = options.training?.[faction];
      const skill = requested ?? own.offer!.cards.find(card => !own.unavailableSkills?.[card]);
      assert.ok(skill && own.offer!.cards.includes(skill) && !own.unavailableSkills?.[skill]);
      const leader = own.eligibleLeaders[0]; assert.ok(leader);
      act(actor, { type: 'leaderSkill', event: own.offer!.event, skill, leader: leader.id });
      continue;
    }
    let step: ClassicIndependentNexusStep | undefined;
    for (const player of game.players) {
      const view = viewGame(game, player.id);
      view.players.find(p => p.id === player.id)!.bot = 'Easy';
      const action = botActions(view)[0];
      if (action) { step = { actor: player.id, action }; break; }
    }
    assert.ok(step, `The original setup must expose its owned ${game.setupStage} choice`);
    act(step.actor, step.action);
  }
  assert.equal(game.status, 'playing');
  for (const player of game.players)
    for (const [index, card] of (options.startingCards?.[player.faction] ?? []).entries())
      assert.equal(player.hand[index]?.id, card, 'The requested original card must come from its genuine starting deal');
  return { lobby, setup, game, actions, staging };
}

/** Reuse the original native Nexus controller and lottery; no alternate phase
 * machine, fabricated alliance, draw, wallet, force placement or card grant. */
export function advanceClassicIndependentNexus(game: Game, until: (state: Game) => boolean,
  actions?: ClassicIndependentNexusStep[], max = 1200): Game {
  for (let count = 0; !until(game) && count < max; count++) {
    assert.notEqual(game.status, 'finished', 'Original lifecycle ended before requested continuation');
    let step: ClassicIndependentNexusStep | null;
    if (game.pendingGuildBetrayal) {
      const actor = game.pendingGuildBetrayal.required.find(id => !game.pendingGuildBetrayal!.passed.includes(id));
      assert.ok(actor);
      const view = viewGame(game, actor);
      view.players.find(player => player.id === actor)!.bot = 'Easy';
      const action = botActions(view)[0];
      assert.ok(action && ['guildBetrayalUse', 'guildBetrayalPass'].includes(action.type));
      step = { actor, action };
    } else step = nextClassicDiscoveryNexusStep(game);
    assert.ok(step, `Use the real sealed control at ${game.turn}/${game.phase}/${game.decision?.kind}`);
    game = applyClassicDiscoveryNexusStep(game, step, actions);
  }
  assert.ok(until(game), 'Reach the original independent-Nexus continuation');
  return game;
}
