import type { Game } from './engine';
import { HomeworldCustodyError } from './homeworld-custody';
import { homeworldContext } from './homeworld-game';
import { homeworldPopulations } from './homeworld-population';

export type HomeworldCollectionContext = Pick<
  Game,
  'advanced' | 'players' | 'homeworlds'
>;

export type HomeworldCollectionSource = {
  kind: 'desert' | 'homeworld' | 'stronghold' | 'technology';
  amount: number;
};

/** Source amounts are actual settled receipts, including an agreed Ecaz split,
 * not capacity, presence, expected income or a change in the held balance.
 * The engine owns event timing and the durable already-awarded receipt. */
export function quoteGiediCollectionBonus(
  context: HomeworldCollectionContext,
  ownerId: string,
  sources: HomeworldCollectionSource[],
  alreadyAwarded: boolean,
): { player: string; amount: 0 | 2; qualifying: number } {
  const owner = context.players.find((player) => player.id === ownerId);
  if (!owner || owner.faction !== 'harkonnen')
    throw new HomeworldCustodyError(
      'Only Harkonnen can receive the native Giedi Prime collection bonus.',
    );
  if (typeof alreadyAwarded !== 'boolean' || !Array.isArray(sources))
    throw new HomeworldCustodyError(
      'Giedi Prime needs settled collection sources and an award receipt.',
    );
  let total = 0;
  let qualifying = 0;
  for (const source of sources) {
    if (
      !source ||
      typeof source !== 'object' ||
      Array.isArray(source) ||
      !['desert', 'homeworld', 'stronghold', 'technology'].includes(
        source.kind,
      ) ||
      !Number.isSafeInteger(source.amount) ||
      source.amount < 0
    )
      throw new HomeworldCustodyError(
        'Collection sources need a known kind and a nonnegative safe amount.',
      );
    total += source.amount;
    if (!Number.isSafeInteger(total))
      throw new HomeworldCustodyError('Settled collection sources overflow.');
    if (source.kind === 'desert' || source.kind === 'homeworld')
      qualifying += source.amount;
  }
  const high = context.homeworlds?.custody
    ? homeworldPopulations(
        homeworldContext(context),
        context.homeworlds.custody,
      ).some(
        (home) =>
          home.native === ownerId &&
          home.card === 'giedi_prime' &&
          home.side === 'high',
      )
    : false;
  return {
    player: ownerId,
    amount: high && qualifying > 0 && !alreadyAwarded ? 2 : 0,
    qualifying,
  };
}

/** The caller supplies the verified original entering force count. This must
 * not be fed a concealed No-Field size to infer a public reaction window.
 * Occupation retention and No-Field composition are separate rules. */
export function lowGrummanRevealBlock(
  context: HomeworldCollectionContext,
  ownerId: string,
  entering: number,
): string | null {
  if (!Number.isSafeInteger(entering) || entering < 0)
    throw new HomeworldCustodyError(
      'A Terror entry requires a nonnegative safe entering force count.',
    );
  if (!context.homeworlds?.custody) return null;
  const low = homeworldPopulations(
    homeworldContext(context),
    context.homeworlds.custody,
  ).some(
    (home) =>
      home.native === ownerId && home.card === 'grumman' && home.side === 'low',
  );
  return low && entering < 3
    ? 'Low-population Grumman prevents revealing Terror unless at least three forces enter.'
    : null;
}
