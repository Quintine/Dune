/** A future choice names only the actor's original native dial opportunity.
 * The accepted value stays in the normal private storm dial until reveal. */
export type StormDialSource = { turn: number; player: string };
export type StormDialClaim = { kind: 'stormDial'; source: string; value: number };
export type StormDialOpportunity = StormDialSource & { source: string; min: number; max: number };
export type StormDialGame = {
  status: string;
  advanced: boolean;
  phase: number;
  turn: number;
  players: readonly { id: string }[];
  stormDialers: readonly string[];
  stormPending: number | null;
  /** Public view: identities that have sealed, never their unrevealed values. */
  stormSubmitted?: readonly string[];
  /** Server state: only the presence of a property is inspected. */
  stormDials?: Readonly<Record<string, unknown>>;
};

export class StormDialQuestionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StormDialQuestionError';
  }
}
function check(value: unknown, message: string): asserts value {
  if (!value) throw new StormDialQuestionError(message);
}
const identifier = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value === value.trim();
const positive = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
const object = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

/** Public canonical source, still decodable after the original dial is sealed. */
export function parseStormDialSource(source: unknown): StormDialSource | null {
  if (!identifier(source)) return null;
  let tuple: unknown;
  try { tuple = JSON.parse(source); } catch { return null; }
  if (!Array.isArray(tuple) || tuple.length !== 3 || tuple[0] !== 'stormDial' ||
      !positive(tuple[1]) || !identifier(tuple[2]) || JSON.stringify(tuple) !== source) return null;
  return { turn: tuple[1], player: tuple[2] };
}

/** Parse only an exact future native choice within that turn's real dial range. */
export function parseStormDialClaim(value: unknown): StormDialClaim {
  check(object(value) && Object.keys(value).sort().join(',') === 'kind,source,value' && value.kind === 'stormDial',
    'Choose one original storm-dial opportunity and exact value.');
  const source = parseStormDialSource(value.source);
  check(source && typeof value.value === 'number' && Number.isSafeInteger(value.value) &&
    value.value >= (source.turn === 1 ? 0 : 1) && value.value <= (source.turn === 1 ? 20 : 3),
  'Choose a value within the original turn’s native storm-dial range.');
  return { kind: 'stormDial', source: value.source as string, value: value.value };
}

/** Compare the actual accepted native submission, never an invented default. */
export function stormDialMatches(claim: StormDialClaim, actual: unknown): boolean {
  const parsed = parseStormDialClaim(claim), source = parseStormDialSource(parsed.source)!;
  check(typeof actual === 'number' && Number.isSafeInteger(actual) &&
    actual >= (source.turn === 1 ? 0 : 1) && actual <= (source.turn === 1 ? 20 : 3),
  'Retain the actual native storm-dial submission.');
  return parsed.value === actual;
}

/** Public eligibility only. Reads whether a value is sealed, never that value.
 * Original phase/card/response gates and projected owner actions remain native. */
export function nativeStormDialOpportunity(game: StormDialGame, player: string,
  expectedSource?: string): StormDialOpportunity | null {
  if (game.status !== 'playing' || game.advanced !== false || game.phase !== 0 ||
      !positive(game.turn) || game.stormPending !== null || !identifier(player) ||
      !Array.isArray(game.players) || !game.players.length ||
      game.players.some(row => !row || !identifier(row.id)) ||
      new Set(game.players.map(row => row.id)).size !== game.players.length ||
      !Array.isArray(game.stormDialers) || !game.stormDialers.length ||
      !game.stormDialers.every(id => identifier(id) && game.players.some(row => row.id === id)) ||
      new Set(game.stormDialers).size !== game.stormDialers.length || !game.stormDialers.includes(player)) return null;
  if (game.stormSubmitted !== undefined) {
    if (!Array.isArray(game.stormSubmitted) || !game.stormSubmitted.every(id =>
      identifier(id) && game.stormDialers.includes(id)) ||
      new Set(game.stormSubmitted).size !== game.stormSubmitted.length || game.stormSubmitted.includes(player)) return null;
  } else if (!object(game.stormDials) || Object.hasOwn(game.stormDials, player)) return null;
  const source = JSON.stringify(['stormDial', game.turn, player]);
  if (expectedSource !== undefined && expectedSource !== source) return null;
  return { source, turn: game.turn, player, min: game.turn === 1 ? 0 : 1, max: game.turn === 1 ? 20 : 3 };
}
