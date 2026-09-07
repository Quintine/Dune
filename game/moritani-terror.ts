export type TerrorKind =
  | 'assassination'
  | 'atomics'
  | 'extortion'
  | 'robbery'
  | 'sabotage'
  | 'sneakAttack';
export type TerrorStatus = 'available' | 'placed' | 'removed' | 'extortion';
export type TerrorToken = {
  id: string;
  kind: TerrorKind;
  location: string | null;
  status: TerrorStatus;
};
export type TerrorState = {
  tokens: TerrorToken[];
  placementTurn?: number;
  /** Private persisted counter for replacement supply IDs; never projected. */
  supplyEpoch?: number;
};
export type OwnerTerrorView = { tokens: TerrorToken[]; placementTurn?: number };
export type PublicTerrorToken =
  | { id: string; location: string; status: 'placed' }
  | {
      id: string;
      kind: TerrorKind;
      location: null;
      status: 'removed' | 'extortion';
    };
export type PublicTerrorView = {
  tokens: PublicTerrorToken[];
  placementTurn?: number;
};
export type TerrorView = OwnerTerrorView | PublicTerrorView;

export const TERROR_KINDS: readonly TerrorKind[] = Object.freeze([
  'assassination',
  'atomics',
  'extortion',
  'robbery',
  'sabotage',
  'sneakAttack',
]);
export const TERROR_STRONGHOLDS: readonly string[] = Object.freeze([
  'arrakeen',
  'carthag',
  'sietch_tabr',
  'habbanya_ridge_sietch',
  'tueks_sietch',
]);

/**
 * Opaque IDs identify uninterrupted custody; supplied randomness assigns secret faces.
 * Returning tokens must rotate the whole available supply before redeployment:
 * an ID whose face was revealed cannot safely represent a hidden face again.
 */
export function createTerrorState(random: () => number): TerrorState {
  const kinds = [...TERROR_KINDS];
  for (let index = kinds.length - 1; index > 0; index--) {
    const draw = random();
    if (!Number.isFinite(draw) || draw < 0 || draw >= 1)
      throw new Error(
        'Terror random draws must be finite numbers from zero inclusive to one exclusive.',
      );
    const selected = Math.floor(draw * (index + 1));
    [kinds[index], kinds[selected]] = [kinds[selected], kinds[index]];
  }
  return {
    tokens: kinds.map((kind, index) => ({
      id: `terror-${index + 1}`,
      kind,
      location: null,
      status: 'available',
    })),
  };
}

const cloneToken = (token: TerrorToken): TerrorToken => ({
  id: token.id,
  kind: token.kind,
  location: token.location,
  status: token.status,
});

/** No effects are resolved here. The caller must authorize Moritani's Mentat opportunity. */
export function placeTerror(
  state: TerrorState,
  tokenId: string,
  to: string,
  turn: number,
): TerrorState {
  if (!Number.isSafeInteger(turn) || turn < 1)
    throw new Error('Choose a valid turn for Terror placement.');
  if (state.placementTurn !== undefined && turn <= state.placementTurn)
    throw new Error(
      'The Terror placement or relocation opportunity has already been used for this turn.',
    );
  if (!TERROR_STRONGHOLDS.includes(to))
    throw new Error(
      'Choose one of the five ordinary strongholds for Terror placement.',
    );
  const matches = state.tokens.filter((candidate) => candidate.id === tokenId);
  if (matches.length !== 1)
    throw new Error('Choose a Terror token in your supply or already placed.');
  const token = matches[0];
  if (token.status !== 'available' && token.status !== 'placed')
    throw new Error(
      'That Terror token is not available for placement or relocation.',
    );
  if (token.location === to)
    throw new Error('Relocate the Terror token to a different stronghold.');
  if (
    state.tokens.some(
      (candidate) =>
        candidate.id !== tokenId &&
        candidate.status === 'placed' &&
        candidate.location === to,
    )
  )
    throw new Error('That stronghold already contains a Terror token.');
  return {
    tokens: state.tokens.map((candidate) =>
      candidate.id === tokenId
        ? { ...cloneToken(candidate), status: 'placed', location: to }
        : cloneToken(candidate),
    ),
    placementTurn: turn,
    ...(state.supplyEpoch === undefined
      ? {}
      : { supplyEpoch: state.supplyEpoch }),
  };
}

/** Reveal custody only: callers separately authorize the trigger and resolve its effect. */
export function revealTerror(state: TerrorState, tokenId: string): TerrorState {
  const matches = state.tokens.filter((token) => token.id === tokenId);
  if (matches.length !== 1 || matches[0].status !== 'placed')
    throw new Error('Choose a placed Terror token to reveal.');
  return {
    tokens: state.tokens.map((token) =>
      token.id === tokenId
        ? {
            ...cloneToken(token),
            location: null,
            status: token.kind === 'extortion' ? 'extortion' : 'removed',
          }
        : cloneToken(token),
    ),
    ...(state.placementTurn === undefined
      ? {}
      : { placementTurn: state.placementTurn }),
    ...(state.supplyEpoch === undefined
      ? {}
      : { supplyEpoch: state.supplyEpoch }),
  };
}

/**
 * Return an unrevealed token or recover Extortion without resolving its rule effect.
 * Every available ID is replaced, and the supply is rebuilt in a fresh random order.
 * This removes structural face links; deductions from a singleton supply remain possible.
 * The caller must supply private randomness, never a client-controlled/public seed.
 */
export function returnTerror(
  state: TerrorState,
  tokenId: string,
  random: () => number,
): TerrorState {
  const matches = state.tokens.filter((token) => token.id === tokenId);
  if (
    matches.length !== 1 ||
    (matches[0].status !== 'placed' && matches[0].status !== 'extortion')
  )
    throw new Error(
      'Choose a placed Terror token or revealed Extortion to return.',
    );
  const previousEpoch = state.supplyEpoch ?? 0;
  if (
    !Number.isSafeInteger(previousEpoch) ||
    previousEpoch < 0 ||
    previousEpoch >= Number.MAX_SAFE_INTEGER
  )
    throw new Error('The Terror supply epoch is invalid.');
  const supplyEpoch = previousEpoch + 1;
  const supply = state.tokens
    .filter((token) => token.status === 'available' || token.id === tokenId)
    .map(
      (token): TerrorToken => ({
        ...cloneToken(token),
        status: 'available',
        location: null,
      }),
    );
  for (let index = supply.length - 1; index > 0; index--) {
    const draw = random();
    if (!Number.isFinite(draw) || draw < 0 || draw >= 1)
      throw new Error(
        'Terror random draws must be finite numbers from zero inclusive to one exclusive.',
      );
    const selected = Math.floor(draw * (index + 1));
    [supply[index], supply[selected]] = [supply[selected], supply[index]];
  }
  const rotated = supply.map((token, index) => ({
    ...token,
    id: `terror-supply-${supplyEpoch}-${index + 1}`,
  }));
  if (
    rotated.some((token) =>
      state.tokens.some((previous) => previous.id === token.id),
    )
  )
    throw new Error(
      'The Terror supply epoch would reuse an existing identity.',
    );
  return {
    tokens: [
      ...state.tokens
        .filter((token) => token.status !== 'available' && token.id !== tokenId)
        .map(cloneToken),
      ...rotated,
    ],
    ...(state.placementTurn === undefined
      ? {}
      : { placementTurn: state.placementTurn }),
    supplyEpoch,
  };
}

export function projectTerror(state: TerrorState, owner: true): OwnerTerrorView;
export function projectTerror(
  state: TerrorState,
  owner: false,
): PublicTerrorView;
export function projectTerror(state: TerrorState, owner: boolean): TerrorView;
export function projectTerror(state: TerrorState, owner: boolean): TerrorView {
  const marker =
    state.placementTurn === undefined
      ? {}
      : { placementTurn: state.placementTurn };
  if (owner) return { tokens: state.tokens.map(cloneToken), ...marker };
  const tokens: PublicTerrorToken[] = [];
  for (const token of state.tokens) {
    if (token.status === 'placed' && token.location !== null)
      tokens.push({ id: token.id, location: token.location, status: 'placed' });
    else if (token.status === 'removed' || token.status === 'extortion')
      tokens.push({
        id: token.id,
        kind: token.kind,
        location: null,
        status: token.status,
      });
  }
  return { tokens, ...marker };
}

export type TerrorDefinition = Readonly<{
  kind: TerrorKind;
  name: string;
  quantity: 1;
  summary: string;
  gameplay: readonly string[];
  verification: Readonly<{
    inventory: 'verified';
    sourceRules: 'verified';
    componentArtwork: 'not-verified';
    runtimeEffects: 'partial' | 'not-implemented';
    combinedInteractions: 'incomplete';
    audit: 'docs/MORITANI_TERROR_RULES.md';
    unresolved: readonly string[];
  }>;
}>;

/** Shared original-language guidance; these paragraphs do not expose token custody. */
export const TERROR_COMMON_GAMEPLAY: readonly string[] = Object.freeze([
  'During Mentat Pause, Moritani may place one hidden Terror token from supply or move one placed token. Choose an ordinary stronghold without another Terror token. Storm does not prevent placement; Homeworlds and the Hidden Mobile Stronghold are excluded.',
  'A token may be revealed when another faction enters its stronghold by shipment or movement. An ally does not qualify, but Bene Gesserit advisors do. Existing occupation alone does not trigger it. Declining the opportunity keeps the token hidden and unspent.',
  'Before revealing a token, Moritani may instead offer the entrant an alliance, except when the entrant is Ecaz. Acceptance ends both previous alliances and returns the token to supply without revealing it. Refusal requires the token to be revealed.',
  'Karama may prevent the placement or relocation opportunity, or prevent Enemy of My Enemy from forming an alliance while leaving revelation available. There is no generic Karama cancellation of a Terror token’s reveal or effect.',
  'Terror tokens survive storm and Lasgun/Shield explosions. A Richese No-Field placement can trigger one even with a zero token; revealing a No-Field or replacing forces with Face Dancers does not.',
  'After ordinary revelation, remove the token from the game. Extortion has its own recovery procedure. Inspecting a token does not place it, reveal it or resolve its effect.',
]);

const define = (
  kind: TerrorKind,
  name: string,
  summary: string,
  effect: string[],
  unresolved: string[],
): TerrorDefinition =>
  Object.freeze({
    kind,
    name,
    quantity: 1,
    summary,
    gameplay: Object.freeze([...effect, ...TERROR_COMMON_GAMEPLAY]),
    verification: Object.freeze({
      inventory: 'verified',
      sourceRules: 'verified',
      componentArtwork: 'not-verified',
      runtimeEffects: [
        'robbery',
        'sabotage',
        'assassination',
        'sneakAttack',
      ].includes(kind)
        ? ('partial' as const)
        : ('not-implemented' as const),
      combinedInteractions: 'incomplete',
      audit: 'docs/MORITANI_TERROR_RULES.md',
      unresolved: Object.freeze([
        'Exact priority among Terror and other reactions to the same entry remains unaudited.',
        ...unresolved,
      ]),
    }),
  });

/** Original mechanics prose, separate from developer-only verification limits. No activation flags. */
export const TERROR_DEFINITIONS: Readonly<
  Record<TerrorKind, TerrorDefinition>
> = Object.freeze({
  assassination: define(
    'assassination',
    'Assassination',
    'Randomly eliminate an entrant’s leader and collect spice for its value.',
    [
      'Randomly select a leader of the entrant and send that leader to the Tanks. Moritani receives spice equal to the leader’s value; Zoal awards three spice.',
      'The victim is selected at random. This Terror effect is separate from Moritani’s advanced Assassinate Leaders ability.',
    ],
    [
      'The eligible pool for captured leaders, foreign Gholas, Duke Vidal or already unavailable leaders needs a specific ruling.',
    ],
  ),
  atomics: define(
    'atomics',
    'Atomics',
    'Destroy all forces in the territory and leave a permanent shipment prohibition.',
    [
      'Send every force in the territory to the Tanks, regardless of its owner. Place the Atomics Aftermath token there.',
      'Aftermath permanently prevents shipment into that territory, including Fremen shipment. It does not itself prohibit ordinary movement. Sneak Attack expressly permits its reserve entry despite Aftermath.',
      'Starting this turn, reduce Moritani’s hand limit and its ally’s hand limit by one each. A hand above its new limit loses a random card.',
    ],
    [
      'Which allied faction keeps or gains the hand-limit reduction after a later alliance change remains unresolved.',
    ],
  ),
  extortion: define(
    'extortion',
    'Extortion',
    'Reserve five bank spice for Mentat collection, then offer the table a chance to prevent this token’s recovery.',
    [
      'Set aside five spice from the bank in front of Moritani’s shield. Collect this spice during Mentat Pause; it is not immediately spendable when set aside.',
      'Then approach players in storm order. One player may pay Moritani three spice to prevent Extortion from returning to supply. If nobody pays, recover the token.',
      'The possible three-spice payment is separate from the five bank spice. It prevents token recovery and does not replace or cancel that award.',
    ],
    [
      'The ordering of collection and token recovery relative to other Mentat opportunities needs a complete continuation contract.',
    ],
  ),
  robbery: define(
    'robbery',
    'Robbery',
    'Take half the entrant’s spice, rounded up, or draw the top Treachery card.',
    [
      'Choose between taking half of the entrant’s spice, rounded up, and drawing the top card of the Treachery Deck.',
      'For the card option, draw first. If the draw takes Moritani over its hand limit, choose one of its cards to discard. A full hand does not prevent choosing the draw.',
    ],
    [],
  ),
  sabotage: define(
    'sabotage',
    'Sabotage',
    'Randomly discard an entrant’s Treachery card, then optionally give that player one of yours.',
    [
      'Randomly draw and discard one Treachery card from the entrant, if possible.',
      'Afterward, Moritani may give the entrant a chosen card from its own hand. The gift is optional and does not require an exchange or payment.',
    ],
    [
      'The source does not specify exceptional recipient overflow when no card could be discarded or hand capacity changed.',
    ],
  ),
  sneakAttack: define(
    'sneakAttack',
    'Sneak Attack',
    'Bring up to five Moritani reserve forces into the stronghold for free.',
    [
      'Bring up to five of Moritani’s reserve forces into this territory for free. Respect the storm and occupancy restrictions.',
      'This entry is permitted even when Atomics Aftermath is present. The effect grants this reserve entry only; it does not grant another ordinary movement or a general shipment exemption.',
    ],
    [],
  ),
});
