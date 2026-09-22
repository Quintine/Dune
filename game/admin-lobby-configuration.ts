import { applyAction, createGame, newPlayer, type Game } from './engine';
import { FACTIONS } from './catalog';
import { DIFFICULTIES } from './bot-profiles';
import { createTechTokens } from './tech-tokens';
import { createStrongholdCards } from './stronghold-cards';
import type {
  AdminLobbyAction,
  AdminLobbyView,
} from '../lib/admin-lobby-configuration';
import type { RoomControl } from '../lib/room-control';

const unavailable = 'This saved lobby needs inspection before configuration.';
export class AdminLobbyRuleError extends Error {}
const reject = () => {
  throw new AdminLobbyRuleError(unavailable);
};
const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
function same(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) || Array.isArray(b))
    return (
      Array.isArray(a) &&
      Array.isArray(b) &&
      a.length === b.length &&
      a.every((value, index) => same(value, b[index]))
    );
  if (!record(a) || !record(b)) return false;
  const aKeys = Object.keys(a).filter((key) => a[key] !== undefined),
    bKeys = Object.keys(b).filter((key) => b[key] !== undefined);
  return (
    aKeys.length === bKeys.length &&
    aKeys.every((key) => Object.hasOwn(b, key) && same(a[key], b[key]))
  );
}

/** The same legacy/default player-circle allocation used by ordinary lobby actions. */
function positions(game: Game) {
  const result: Record<string, number> = Object.create(null);
  const occupied = new Set<number>();
  if (
    game.playerPositions !== undefined &&
    (!record(game.playerPositions) ||
      Object.keys(game.playerPositions).some(
        (id) => !game.players.some((player) => player.id === id),
      ))
  )
    reject();
  for (const player of game.players) {
    const position = game.playerPositions?.[player.id];
    if (position === undefined) continue;
    if (
      !Number.isInteger(position) ||
      position < 1 ||
      position > 6 ||
      occupied.has(position)
    )
      reject();
    result[player.id] = position;
    occupied.add(position);
  }
  for (const player of game.players) {
    if (result[player.id] !== undefined) continue;
    const position = [1, 2, 3, 4, 5, 6].find(
      (candidate) => !occupied.has(candidate),
    );
    if (position === undefined) reject();
    result[player.id] = position!;
    occupied.add(position!);
  }
  return result;
}

/** Compare native unused pieces and the complete runtime against a fresh game.
 * Unknown runtime/private fields fail closed; diagnostics never name those fields. */
export function freshAdminLobby(game: Game): boolean {
  try {
    if (
      game.status !== 'lobby' ||
      typeof game.advanced !== 'boolean' ||
      !Array.isArray(game.players) ||
      game.players.length < 1 ||
      game.players.length > 6 ||
      !Array.isArray(game.expansions) ||
      game.expansions.length ||
      !Array.isArray(game.log) ||
      !game.log.every(
        (entry) =>
          entry &&
          Number.isSafeInteger(entry.seq) &&
          entry.seq > 0 &&
          typeof entry.text === 'string',
      ) ||
      new Set(game.players.map((player) => player.id)).size !==
        game.players.length ||
      new Set(game.players.map((player) => player.faction)).size !==
        game.players.length ||
      (game.botsPending !== undefined && game.botsPending !== false) ||
      game.botNextActionAt !== undefined
    )
      return false;
    const host = game.players.find((player) => player.id === game.host);
    if (!host || host.bot) return false;
    for (const player of game.players) {
      if (
        !player ||
        typeof player.id !== 'string' ||
        !player.id ||
        player.id.length > 80 ||
        typeof player.name !== 'string' ||
        typeof player.ready !== 'boolean' ||
        !FACTIONS.some(
          (faction) =>
            faction.id === player.faction && faction.expansion === 'base',
        ) ||
        (player.bot !== undefined && !DIFFICULTIES.includes(player.bot))
      )
        return false;
      const expected = newPlayer(player.id, player.name, player.faction);
      expected.ready = player.ready;
      if (player.bot) expected.bot = player.bot;
      // Old saved lobbies may omit this zero-valued counter, as ordinary start permits.
      if (player.freeForcesRevived === undefined)
        delete (expected as Partial<typeof expected>).freeForcesRevived;
      if (!same(player, expected)) return false;
    }
    positions(game);
    if (game.techTokens != null && !same(game.techTokens, createTechTokens()))
      return false;
    if (
      game.strongholdCards != null &&
      (!game.advanced || !same(game.strongholdCards, createStrongholdCards()))
    )
      return false;
    if (
      game.homeworlds != null ||
      game.nexusCards != null ||
      game.leaderSkills != null ||
      game.ecazTreachery != null ||
      (game.discoveryEnabled !== undefined && game.discoveryEnabled !== false)
    )
      return false;
    const expected = createGame(game.code, host, game.advanced);
    const configuration = new Set([
      'code',
      'version',
      'host',
      'players',
      'playerPositions',
      'advanced',
      'expansions',
      'log',
      'botsPending',
      'botNextActionAt',
      'techTokens',
      'strongholdCards',
      'homeworlds',
      'nexusCards',
      'leaderSkills',
      'ecazTreachery',
      'discoveryEnabled',
    ]);
    for (const key of new Set([...Object.keys(game), ...Object.keys(expected)]))
      if (
        !configuration.has(key) &&
        !same(
          Object.hasOwn(game, key)
            ? (game as unknown as Record<string, unknown>)[key]
            : undefined,
          Object.hasOwn(expected, key)
            ? (expected as unknown as Record<string, unknown>)[key]
            : undefined,
        )
      )
        return false;
    return true;
  } catch {
    return false;
  }
}

export function projectAdminLobby(
  code: string,
  version: number,
  state: unknown,
  activeHumans: ReadonlySet<string>,
  control: RoomControl,
): AdminLobbyView {
  const base: AdminLobbyView = {
    code,
    version,
    status: 'unreadable',
    editable: false,
    blockedReason: unavailable,
    host: null,
    advanced: false,
    techTokens: false,
    strongholdCards: false,
    players: [],
    control,
  };
  try {
    const game = state as Game;
    if (
      !record(state) ||
      !['lobby', 'setup', 'playing', 'finished'].includes(game.status) ||
      !Array.isArray(game.players) ||
      game.players.length < 1 ||
      game.players.length > 6 ||
      game.players.some(
        (player) =>
          !player ||
          typeof player.id !== 'string' ||
          !player.id ||
          player.id.length > 80 ||
          typeof player.name !== 'string' ||
          player.name.length > 32 ||
          !FACTIONS.some((faction) => faction.id === player.faction) ||
          (player.bot !== undefined && !DIFFICULTIES.includes(player.bot)),
      )
    )
      return base;
    const circles = positions(game);
    const supported = game.code === code && freshAdminLobby(game);
    return {
      ...base,
      status: game.status,
      advanced: game.advanced === true,
      techTokens: !!game.techTokens,
      strongholdCards: !!game.strongholdCards,
      host: game.players.some((player) => player.id === game.host)
        ? game.host
        : null,
      editable: supported && !control.paused,
      blockedReason:
        game.status !== 'lobby'
          ? 'Lobby configuration is available only before the game starts.'
          : !supported
            ? unavailable
            : control.paused
              ? 'Resume the room before configuring its lobby.'
              : null,
      players: game.players.map((player) => ({
        id: player.id,
        name: player.name,
        faction: player.faction,
        bot: player.bot ?? null,
        position: circles[player.id],
        ready: player.ready === true,
        hostEligible: supported && !player.bot && activeHumans.has(player.id),
      })),
    };
  } catch {
    return base;
  }
}

export function applyAdminLobbyAction(
  game: Game,
  action: AdminLobbyAction,
  activeHumans: ReadonlySet<string>,
): Game {
  if (!freshAdminLobby(game)) reject();
  let next: Game;
  if (action.type === 'assignHost') {
    const target = game.players.find((player) => player.id === action.target);
    if (!target || target.bot || !activeHumans.has(target.id))
      throw new AdminLobbyRuleError(
        'Choose an existing human player with active saved-seat access.',
      );
    if (target.id === game.host)
      throw new AdminLobbyRuleError('That player already hosts this room.');
    next = structuredClone(game);
    next.host = target.id;
    next.players.forEach((player) => {
      player.ready = !!player.bot;
    });
  } else {
    try {
      next = applyAction(game, game.host, action);
    } catch {
      throw new AdminLobbyRuleError(
        'That lobby change is unavailable. Check the selected rules, factions, AI seat and player circle.',
      );
    }
  }
  if (!freshAdminLobby(next)) reject();
  // Ordinary engine actions retain their calculation, but must not impersonate
  // the human host in the public chronicle. Administrator identity/reason stay in audit.
  next.log = [
    ...structuredClone(game.log),
    {
      seq: (game.log.at(-1)?.seq ?? 0) + 1,
      text:
        action.type === 'assignHost'
          ? 'An administrator reassigned the room host. Human readiness was cleared.'
          : 'An administrator updated the lobby configuration.',
    },
  ];
  return next;
}
