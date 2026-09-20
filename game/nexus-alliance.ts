export type NexusAllianceSeat = {
  id: string;
  ally: string | null;
};

export type NexusAllianceQuote = {
  allies: Record<string, string | null>;
  offers: Record<string, string>;
  formed: [string, string] | null;
};

export class NexusAllianceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NexusAllianceError';
  }
}

function requireAlliance(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) throw new NexusAllianceError(message);
}

/**
 * Quotes only ordinary reciprocal Nexus offers and alliance identities. Phase
 * authorization, expansion restrictions, card forfeiture and public effects
 * remain with the engine.
 */
export function quoteNexusAlliance(context: {
  players: readonly NexusAllianceSeat[];
  offers: Readonly<Record<string, string>>;
  actor: string;
  target: string | null;
}): NexusAllianceQuote {
  const ids = context.players.map((player) => player.id);
  requireAlliance(
    ids.every((id) => typeof id === 'string' && id.length > 0) &&
      new Set(ids).size === ids.length,
    'Alliance seats require distinct player IDs.',
  );
  const byId = new Map(context.players.map((player) => [player.id, player]));
  const owner = byId.get(context.actor);
  requireAlliance(owner, 'Choose a seated player.');

  const allies = Object.fromEntries(
    context.players.map((player) => [player.id, player.ally]),
  );
  const offers = { ...context.offers };

  if (context.target === null) {
    if (owner.ally !== null) {
      requireAlliance(
        byId.has(owner.ally),
        'The current alliance partner is no longer seated.',
      );
      allies[owner.ally] = null;
    }
    allies[context.actor] = null;
    delete offers[context.actor];
    return { allies, offers, formed: null };
  }

  requireAlliance(context.target !== context.actor, 'Choose another player.');
  const other = byId.get(context.target);
  requireAlliance(other, 'Choose another seated player.');
  requireAlliance(
    owner.ally === null && other.ally === null,
    'Break existing alliances before forming a new one.',
  );

  offers[context.actor] = context.target;
  if (offers[context.target] !== context.actor)
    return { allies, offers, formed: null };

  allies[context.actor] = context.target;
  allies[context.target] = context.actor;
  delete offers[context.actor];
  delete offers[context.target];
  return { allies, offers, formed: [context.actor, context.target] };
}
