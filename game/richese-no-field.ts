import { MOBILE_STRONGHOLD } from './board';

export type NoFieldValue = 0 | 3 | 5;
export type NoFieldLocation = { territory: string; sector: number };
export type NoFieldToken = { id: string; value: NoFieldValue };
export type NoFieldDeployment = {
  tokenId: string;
  controller: string;
  location: NoFieldLocation;
};
export type RicheseNoField = {
  tokens: NoFieldToken[];
  /** Shared own/allied shipment history; revelation never resets it. */
  lastShipped: string | null;
  deployed: NoFieldDeployment | null;
};
export type NoFieldRevealCause =
  | 'voluntary'
  | 'battle'
  | 'storm'
  | 'worm'
  | 'gamont'
  | 'beforeAlly'
  | 'allyShipment';
export type NoFieldReveal = {
  state: RicheseNoField;
  tokenId: string;
  controller: string;
  location: NoFieldLocation;
  value: NoFieldValue;
  /** Materialized physical forces, not the hidden marker's effective count. */
  forces: number;
  cause: NoFieldRevealCause;
};
export type RicheseNoFieldView = {
  deployed: {
    controller: string;
    location: NoFieldLocation;
    effectiveForces: 1;
  } | null;
  lastUsed: NoFieldValue | null;
};
export type RicheseNoFieldOwnerView = RicheseNoFieldView & {
  private: RicheseNoField;
};

function requireNoField(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) throw new Error(message);
}
function validId(id: unknown): id is string {
  return typeof id === 'string' && id.trim().length > 0;
}
function validateLocation(location: NoFieldLocation) {
  requireNoField(
    location &&
      validId(location.territory) &&
      Number.isSafeInteger(location.sector) &&
      (location.sector >= 1 ||
        (location.sector === 0 &&
          (location.territory === 'polar_sink' ||
            location.territory === MOBILE_STRONGHOLD))) &&
      location.sector <= 18,
    'Choose a valid planet territory and sector for the No-Field.',
  );
}

/** Validate JSON custody too; no assumption that a restored token list is sound. */
export function validateRicheseNoField(state: RicheseNoField): void {
  requireNoField(
    state && Array.isArray(state.tokens) && state.tokens.length === 3,
    'Richese must have exactly three No-Field tokens.',
  );
  requireNoField(
    Array.from(state.tokens).every(
      (token) => token && validId(token.id) && [0, 3, 5].includes(token.value),
    ) &&
      new Set(state.tokens.map((token) => token.id)).size === 3 &&
      new Set(state.tokens.map((token) => token.value)).size === 3,
    'No-Field tokens need distinct identities and the values zero, three and five.',
  );
  requireNoField(
    state.lastShipped === null ||
      state.tokens.some((token) => token.id === state.lastShipped),
    'The last shipped No-Field must be a physical token.',
  );
  requireNoField(
    state.deployed === null ||
      (typeof state.deployed === 'object' && !!state.deployed),
    'Invalid deployed No-Field custody.',
  );
  if (state.deployed) {
    requireNoField(
      state.tokens.some((token) => token.id === state.deployed!.tokenId) &&
        state.deployed.tokenId === state.lastShipped &&
        validId(state.deployed.controller),
      'The deployed No-Field must match the most recent shipment and a controller.',
    );
    validateLocation(state.deployed.location);
  }
}

/** Engine supplies opaque identities; this pure constructor never draws RNG. */
export function createRicheseNoField(ids: readonly string[]): RicheseNoField {
  const values: NoFieldValue[] = [0, 3, 5];
  requireNoField(
    ids.length === 3,
    'Provide three physical No-Field identities.',
  );
  const state: RicheseNoField = {
    tokens: ids.map((id, index) => ({ id, value: values[index] })),
    lastShipped: null,
    deployed: null,
  };
  validateRicheseNoField(state);
  return state;
}

/** Engine resolves authorization, shipment legality, payment and Karama first. */
export function deployRicheseNoField(
  previous: RicheseNoField,
  deployment: NoFieldDeployment,
): RicheseNoField {
  validateRicheseNoField(previous);
  requireNoField(
    !previous.deployed,
    'Reveal the existing No-Field before deploying another.',
  );
  requireNoField(
    previous.tokens.some((token) => token.id === deployment.tokenId),
    'Choose a physical No-Field token.',
  );
  requireNoField(
    deployment.tokenId !== previous.lastShipped,
    'The same No-Field cannot be shipped twice in a row.',
  );
  requireNoField(
    validId(deployment.controller),
    'Choose the No-Field force controller.',
  );
  validateLocation(deployment.location);
  const state = structuredClone(previous);
  state.lastShipped = deployment.tokenId;
  state.deployed = structuredClone(deployment);
  return state;
}

/** Location/custody only; path, movement allowance and exposure belong to engine. */
export function moveRicheseNoField(
  previous: RicheseNoField,
  tokenId: string,
  location: NoFieldLocation,
): RicheseNoField {
  validateRicheseNoField(previous);
  requireNoField(
    previous.deployed?.tokenId === tokenId,
    'That No-Field is not deployed.',
  );
  validateLocation(location);
  const state = structuredClone(previous);
  state.deployed!.location = structuredClone(location);
  return state;
}

/**
 * Returns materialization facts, never changes reserves/Tanks or allocates losses.
 * Engine validates the cause's phase/window. Destruction with scarce reserves is
 * conservation-based composition, recorded in docs/RICHESE_NO_FIELD_RULES.md.
 */
export function revealRicheseNoField(
  previous: RicheseNoField,
  input: { tokenId: string; reserves: number; cause: NoFieldRevealCause },
): NoFieldReveal {
  validateRicheseNoField(previous);
  requireNoField(
    previous.deployed?.tokenId === input.tokenId,
    'That No-Field is not deployed.',
  );
  requireNoField(
    Number.isSafeInteger(input.reserves) && input.reserves >= 0,
    'Available reserves must be a nonnegative safe integer.',
  );
  requireNoField(
    [
      'voluntary',
      'battle',
      'storm',
      'worm',
      'gamont',
      'beforeAlly',
      'allyShipment',
    ].includes(input.cause),
    'Choose a valid No-Field reveal cause.',
  );
  const deployed = previous.deployed!;
  const token = previous.tokens.find(
    (candidate) => candidate.id === input.tokenId,
  )!;
  const state = structuredClone(previous);
  state.deployed = null;
  return {
    state,
    tokenId: token.id,
    controller: deployed.controller,
    location: structuredClone(deployed.location),
    value: token.value,
    forces: Math.min(token.value, input.reserves),
    cause: input.cause,
  };
}

/** Any existing marker must already have been revealed by the authorized caller. */
export function shipAlliedRicheseNoField(
  previous: RicheseNoField,
  deployment: NoFieldDeployment,
  reserves: number,
): NoFieldReveal {
  const deployed = deployRicheseNoField(previous, deployment);
  return revealRicheseNoField(deployed, {
    tokenId: deployment.tokenId,
    reserves,
    cause: 'allyShipment',
  });
}

export function projectRicheseNoField(
  state: RicheseNoField,
  owner: true,
): RicheseNoFieldOwnerView;
export function projectRicheseNoField(
  state: RicheseNoField,
  owner: false,
): RicheseNoFieldView;
export function projectRicheseNoField(
  state: RicheseNoField,
  owner: boolean,
): RicheseNoFieldView | RicheseNoFieldOwnerView;
export function projectRicheseNoField(
  state: RicheseNoField,
  owner: boolean,
): RicheseNoFieldView | RicheseNoFieldOwnerView {
  validateRicheseNoField(state);
  const view: RicheseNoFieldView = {
    deployed: state.deployed
      ? {
          controller: state.deployed.controller,
          location: structuredClone(state.deployed.location),
          effectiveForces: 1,
        }
      : null,
    lastUsed:
      !state.deployed && state.lastShipped !== null
        ? state.tokens.find((token) => token.id === state.lastShipped)!.value
        : null,
  };
  return owner ? { ...view, private: structuredClone(state) } : view;
}
