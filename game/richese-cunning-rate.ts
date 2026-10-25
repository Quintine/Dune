export type RicheseCunningRateSource = {
  player: string;
  owner: string;
  card?: string;
};
export type RicheseCunningRateGrant = RicheseCunningRateSource & { costClaimed?: true };

export class RicheseCunningRateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RicheseCunningRateError';
  }
}

const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
const identifier = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

/** Identity snapshot only: live refund flags and physical card custody are not
 * part of the original purchased-rate source. */
export function validRicheseCunningRateSource(value: unknown): value is RicheseCunningRateSource {
  return record(value) && Object.hasOwn(value, 'player') && Object.hasOwn(value, 'owner') &&
    Object.keys(value).every(key => key === 'player' || key === 'owner' || key === 'card') &&
    identifier(value.player) && identifier(value.owner) &&
    (!Object.hasOwn(value, 'card') || identifier(value.card));
}

/** Copy the active beneficiary's exact origin, leaving its mutable cost-claim
 * history on the original grant. Legacy grants may omit the physical card. */
export function sourceForRicheseCunning(
  active: RicheseCunningRateGrant | null | undefined,
  beneficiary: string,
): RicheseCunningRateSource | undefined {
  if (!identifier(beneficiary))
    throw new RicheseCunningRateError('Choose the original purchased-rate beneficiary.');
  if (active === null || active === undefined) return undefined;
  if (!record(active))
    throw new RicheseCunningRateError('The active purchased rate has an invalid origin.');
  const source = {
    player: active.player,
    owner: active.owner,
    ...(active.card === undefined ? {} : { card: active.card }),
  };
  if (!validRicheseCunningRateSource(source))
    throw new RicheseCunningRateError('The active purchased rate needs its original player, owner and optional card.');
  return source.player === beneficiary ? source : undefined;
}

/** An unchanged rounded fee is insufficient: retain the original full source.
 * Absence records that this beneficiary had no purchased rate at declaration. */
export function richeseCunningRateMatches(
  savedSource: RicheseCunningRateSource | undefined,
  active: RicheseCunningRateGrant | null | undefined,
  beneficiary: string,
): boolean {
  if (savedSource !== undefined && !validRicheseCunningRateSource(savedSource)) return false;
  try {
    const current = sourceForRicheseCunning(active, beneficiary);
    if (savedSource === undefined) return current === undefined;
    return current !== undefined && savedSource.player === current.player &&
      savedSource.owner === current.owner && savedSource.card === current.card;
  } catch (error) {
    if (error instanceof RicheseCunningRateError) return false;
    throw error;
  }
}
