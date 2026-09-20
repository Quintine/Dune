import { DIFFICULTIES, type Difficulty } from './bot-profiles';
import { FACTIONS, faction, type FactionId } from './catalog';

export type LobbyBotConfiguration = Readonly<{
  target: string;
  difficulty: Difficulty;
  faction: FactionId;
  position: number;
}>;

export type LobbyBotConfigurationContext = Readonly<{
  status: string;
  host: string;
  players: ReadonlyArray<
    Readonly<{
      id: string;
      faction: FactionId;
      bot?: Difficulty;
    }>
  >;
  expansions: readonly string[];
  positions: Readonly<Record<string, number>>;
}>;

export type LobbyBotConfigurationQuote =
  | Readonly<{
      ok: true;
      configuration: LobbyBotConfiguration;
      changed: boolean;
    }>
  | Readonly<{ ok: false; reason: string }>;

const rejection = (reason: string): LobbyBotConfigurationQuote => ({
  ok: false,
  reason,
});

export function quoteLobbyBotConfiguration(
  context: LobbyBotConfigurationContext,
  actorId: string,
  input: unknown,
): LobbyBotConfigurationQuote {
  if (context.status !== 'lobby')
    return rejection('AI seats can be configured only in the lobby.');
  if (actorId !== context.host)
    return rejection('Only the host can configure AI seats.');
  if (!input || typeof input !== 'object' || Array.isArray(input))
    return rejection('Choose an AI seat configuration.');
  const value = input as Record<string, unknown>;
  const keys = ['type', 'target', 'difficulty', 'faction', 'position'];
  if (
    Object.keys(value).length !== keys.length ||
    !keys.every((key) => Object.hasOwn(value, key)) ||
    value.type !== 'configureBot'
  )
    return rejection(
      'Choose only the AI seat, difficulty, faction and player circle.',
    );
  if (typeof value.target !== 'string')
    return rejection('Choose a permanent AI seat.');
  const target = context.players.find((player) => player.id === value.target);
  if (!target?.bot) return rejection('Choose a permanent AI seat.');
  if (
    typeof value.difficulty !== 'string' ||
    !DIFFICULTIES.some((difficulty) => difficulty === value.difficulty)
  )
    return rejection('Choose a valid AI difficulty.');
  if (
    typeof value.faction !== 'string' ||
    !FACTIONS.some((entry) => entry.id === value.faction)
  )
    return rejection('Choose a valid faction.');
  const selectedFaction = value.faction as FactionId;
  const expansion = faction(selectedFaction).expansion;
  if (expansion !== 'base' && !context.expansions.includes(expansion))
    return rejection('That faction expansion is disabled.');
  if (
    context.players.some(
      (player) => player.id !== target.id && player.faction === selectedFaction,
    )
  )
    return rejection('That faction is taken.');
  if (
    typeof value.position !== 'number' ||
    !Number.isSafeInteger(value.position) ||
    value.position < 1 ||
    value.position > 6
  )
    return rejection('Player circle must be an integer from 1 to 6.');
  if (
    context.players.some(
      (player) =>
        player.id !== target.id &&
        context.positions[player.id] === value.position,
    )
  )
    return rejection('That player circle is occupied.');
  const configuration: LobbyBotConfiguration = {
    target: target.id,
    difficulty: value.difficulty as Difficulty,
    faction: selectedFaction,
    position: value.position,
  };
  return {
    ok: true,
    configuration,
    changed:
      target.bot !== configuration.difficulty ||
      target.faction !== configuration.faction ||
      context.positions[target.id] !== configuration.position,
  };
}
