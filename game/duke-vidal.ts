import type { Leader } from './cards';

export const DUKE_VIDAL_ID = 'duke-vidal';
export type DukeSource = 'moritani' | 'ecaz' | 'ecazNexus' | 'ally';
export type DukeState = {
  leader: Leader;
  controller: string | null;
  acquiredTurn: number | null;
  source: DukeSource | null;
  /** Server-only original underlay retained across private capture and execution. */
  captureVisibility?: {
    controller: string | null;
    acquiredTurn: number | null;
    source: DukeSource | null;
  };
};

/** A losing battle's living disc, recorded before its one-battle release. */
export type DukeReleasedCaptureWitness = { deaths: number; usedAt: string };

/** Server-only effective custody. Projected clients must use projected leader fields. */
export function dukeController(state: DukeState): string | null {
  return state.leader.capturedBy ?? state.leader.gholaBy ?? state.controller;
}

/** One shared disc, deliberately outside every native roster and traitor inventory. */
export function createDukeVidal(): DukeState {
  return {
    leader: {
      id: DUKE_VIDAL_ID,
      name: 'Duke Prad Vidal',
      strength: 6,
      faction: 'ecaz',
      dead: false,
      deaths: 0,
    },
    controller: null,
    acquiredTurn: null,
    source: null,
  };
}

function cloneDuke(state: DukeState): DukeState {
  return {
    leader: structuredClone(state.leader),
    controller: state.controller,
    acquiredTurn: state.acquiredTurn,
    source: state.source,
    ...(state.captureVisibility ? { captureVisibility: { ...state.captureVisibility } } : {}),
  };
}
function validTurn(turn: number) {
  if (!Number.isSafeInteger(turn) || turn < 1)
    throw new Error('Choose a valid turn for Duke Vidal custody.');
}

function validDisc(state: DukeState) {
  const leader = state.leader;
  if (leader.id !== DUKE_VIDAL_ID || leader.faction !== 'ecaz' ||
    leader.strength !== 6 || typeof leader.dead !== 'boolean' ||
    !Number.isSafeInteger(leader.deaths) || leader.deaths < 0 ||
    (leader.usedAt !== undefined && (typeof leader.usedAt !== 'string' || !leader.usedAt)))
    throw new Error('Duke Vidal lost his shared physical identity or death history.');
}

function validUnderlay(state: Pick<DukeState, 'controller' | 'acquiredTurn' | 'source'>, turn: number) {
  if (state.controller === null
    ? state.acquiredTurn !== null || state.source !== null
    : typeof state.controller !== 'string' || !state.controller.trim() ||
      !Number.isSafeInteger(state.acquiredTurn) || state.acquiredTurn! < 1 ||
      state.acquiredTurn! > turn || !['moritani', 'ecaz', 'ecazNexus', 'ally'].includes(state.source!))
    throw new Error('Duke Vidal lost his underlying custody.');
}

function validCaptive(state: DukeState, turn: number) {
  validDisc(state);
  validUnderlay(state, turn);
  const { leader } = state;
  const hidden = leader.concealed;
  const visibility = state.captureVisibility;
  if (!visibility || visibility.controller !== state.controller ||
    visibility.acquiredTurn !== state.acquiredTurn || visibility.source !== state.source)
    throw new Error('Duke Vidal lost his original captured visibility.');
  if (!leader.capturedBy || typeof leader.capturedBy !== 'string' ||
    !leader.capturedBy.trim() || leader.capturedBy === state.controller || leader.gholaBy ||
    (hidden && (hidden.captor !== leader.capturedBy ||
      typeof hidden.controller !== 'string' || !hidden.controller.trim() ||
      hidden.controller === hidden.captor || hidden.dead !== false ||
      !Number.isSafeInteger(hidden.deaths) || hidden.deaths < 0 ||
      hidden.deaths !== leader.deaths - (leader.dead ? 1 : 0) ||
      (hidden.usedAt !== undefined && (typeof hidden.usedAt !== 'string' || !hidden.usedAt)) ||
      (state.controller !== null && hidden.controller !== state.controller))))
    throw new Error('Duke Vidal lost his original captured custody.');
}

/** A secretly executed captive is back in the Tanks, not still controlled by its captor.
 * Keep this exact snapshot until a real public return; it is not foreign-Ghola custody. */
export function returnedDukeCapture(state: DukeState): boolean {
  const { leader } = state;
  const hidden = leader.concealed;
  const visibility = state.captureVisibility;
  if (!visibility) return false;
  try {
    validUnderlay(visibility, Number.MAX_SAFE_INTEGER);
  } catch {
    return false;
  }
  return leader.id === DUKE_VIDAL_ID && leader.faction === 'ecaz' &&
    leader.strength === 6 && leader.dead === true &&
    Number.isSafeInteger(leader.deaths) && leader.deaths > 0 &&
    leader.usedAt === undefined && leader.capturedBy === undefined &&
    leader.gholaBy === undefined && state.controller === null &&
    state.acquiredTurn === null && state.source === null &&
    !!hidden && typeof hidden.captor === 'string' && !!hidden.captor.trim() &&
    typeof hidden.controller === 'string' && !!hidden.controller.trim() &&
    hidden.controller !== hidden.captor && hidden.dead === false &&
    Number.isSafeInteger(hidden.deaths) && hidden.deaths >= 0 &&
    Math.max(2, hidden.deaths + 1) === leader.deaths &&
    (visibility.controller === null || visibility.controller === hidden.controller) &&
    (hidden.usedAt === undefined || (typeof hidden.usedAt === 'string' && !!hidden.usedAt));
}

/** Provisional capture policy: retain an unused disc's underlying tenure.
 * A just-released battle disc instead requires the caller's original battle witness. */
export function captureDuke(
  state: DukeState, captor: string, loser: string, turn: number,
  territory: string, releasedWitness?: DukeReleasedCaptureWitness,
): DukeState {
  validTurn(turn);
  validDisc(state);
  validUnderlay(state, turn);
  if (typeof captor !== 'string' || !captor.trim() ||
    typeof loser !== 'string' || !loser.trim() || captor === loser ||
    typeof territory !== 'string' || !territory.trim() ||
    state.leader.dead || state.leader.capturedBy || state.leader.gholaBy ||
    state.leader.concealed || state.captureVisibility)
    throw new Error('Choose the original living losing Duke for capture.');
  if (releasedWitness
    ? state.controller !== null || state.acquiredTurn !== null || state.source !== null ||
      !Number.isSafeInteger(releasedWitness.deaths) ||
      releasedWitness.deaths !== state.leader.deaths ||
      releasedWitness.usedAt !== territory || state.leader.usedAt !== territory
    : dukeController(state) !== loser || !!state.leader.usedAt ||
      (state.source !== 'ecaz' && state.acquiredTurn !== turn))
    throw new Error('Duke Vidal no longer matches the original losing battle custody.');
  const captured = cloneDuke(state);
  captured.captureVisibility = {
    controller: state.controller, acquiredTurn: state.acquiredTurn, source: state.source,
  };
  captured.leader.capturedBy = captor;
  captured.leader.concealed = {
    captor, controller: loser, dead: false, deaths: state.leader.deaths,
    ...(state.leader.usedAt === undefined ? {} : { usedAt: state.leader.usedAt }),
  };
  return captured;
}

/** Early unused release restores valid prior tenure, never native-roster custody.
 * Death, battle use and expired temporary tenure all return the same disc set aside. */
export function releaseCapturedDuke(
  state: DukeState, captor: string, turn: number,
): DukeState {
  validTurn(turn);
  validCaptive(state, turn);
  if (captor !== state.leader.capturedBy)
    throw new Error('Only the actual captor can release Duke Vidal.');
  const released = cloneDuke(state);
  delete released.leader.capturedBy;
  delete released.leader.concealed;
  delete released.captureVisibility;
  if (released.leader.dead || released.leader.usedAt ||
    (released.source !== 'ecaz' && released.acquiredTurn !== turn))
    return consumeDuke(released);
  return released;
}

/** Original Harkonnen execution returns the actual dead disc to Ecaz's Tanks.
 * The caller pays the original two-spice bounty; unrelated seats retain their snapshot. */
export function executeCapturedDuke(
  state: DukeState, captor: string, turn: number,
): DukeState {
  validTurn(turn);
  validCaptive(state, turn);
  if (state.leader.dead || captor !== state.leader.capturedBy || !state.leader.concealed)
    throw new Error('Only the actual captor can execute the original living Duke.');
  const executed = cloneDuke(state);
  executed.leader.dead = true;
  executed.leader.deaths = Math.max(2, executed.leader.deaths + 1);
  delete executed.leader.usedAt;
  delete executed.leader.capturedBy;
  executed.controller = null;
  executed.acquiredTurn = null;
  executed.source = null;
  return executed;
}

/**
 * The caller authorizes the faction power and resolves any applicable Karama.
 * Ecaz Nexus Cunning independently revives the set-aside shared disc from Tanks.
 * Moritani and Ecaz Nexus Cunning liberate a living captive; no foreign-Ghola source is legal.
 */
export function acquireDuke(
  state: DukeState,
  controller: string,
  turn: number,
  source: DukeSource,
): DukeState {
  validTurn(turn);
  validDisc(state);
  validUnderlay(state, turn);
  if (typeof controller !== 'string' || !controller.trim())
    throw new Error('Choose a player to control Duke Vidal.');
  if (!['moritani', 'ecaz', 'ecazNexus', 'ally'].includes(source))
    throw new Error('Choose a valid source of Duke Vidal custody.');
  if (state.leader.dead && source !== 'ecazNexus')
    throw new Error('Duke Vidal is in the Tanks and cannot be acquired by this source.');
  if (state.leader.gholaBy)
    throw new Error('Duke Vidal cannot be acquired from foreign Ghola custody.');
  if (state.leader.capturedBy) {
    if ((source !== 'ecazNexus' && source !== 'moritani') || state.leader.dead)
      throw new Error('Only Moritani acquisition or Ecaz Nexus Cunning can take the living captured Duke.');
    validCaptive(state, turn);
  } else if ((state.leader.concealed || state.captureVisibility) &&
    !(source === 'ecazNexus' && returnedDukeCapture(state))) {
    throw new Error('Duke Vidal has unresolved concealed custody.');
  }
  if (state.leader.dead &&
    (state.controller !== null || state.acquiredTurn !== null || state.source !== null))
    throw new Error('Duke Vidal must be set aside in the Tanks before Ecaz Nexus acquisition.');
  if (source === 'ecazNexus' && !state.leader.dead && state.leader.usedAt)
    throw new Error('Duke Vidal has already been used in battle this turn.');
  const acquired = cloneDuke(state);
  if (source === 'ecazNexus' || source === 'moritani') {
    delete acquired.leader.capturedBy;
    delete acquired.leader.concealed;
    delete acquired.captureVisibility;
  }
  if (state.leader.dead) {
    acquired.leader.dead = false;
    // An independent resurrection permits a new battle use without erasing deaths.
    delete acquired.leader.usedAt;
  }
  acquired.controller = controller;
  acquired.acquiredTurn = turn;
  acquired.source = source;
  return acquired;
}

/** The battle caller resolves leader death and bounty before releasing temporary control. */
export function consumeDuke(state: DukeState): DukeState {
  const released = cloneDuke(state);
  delete released.leader.capturedBy;
  delete released.leader.concealed;
  delete released.captureVisibility;
  released.controller = null;
  released.acquiredTurn = null;
  released.source = null;
  return released;
}

/**
 * End-turn custody only. Ecaz's ordinary Ambassador acquisition lasts until
 * battle use; Ecaz Nexus Cunning and the Basic Ambassador ally loan last this
 * turn. The prototype sets an unused loan aside, pending return-policy refinement.
 */
export function expireDuke(state: DukeState, turn: number): DukeState {
  validTurn(turn);
  if (
    (state.source === 'moritani' || state.source === 'ecazNexus' || state.source === 'ally') &&
    state.acquiredTurn !== null &&
    state.acquiredTurn <= turn &&
    !state.leader.dead &&
    !state.leader.capturedBy &&
    !state.leader.gholaBy
  )
    return consumeDuke(state);
  return cloneDuke(state);
}

export const DUKE_VIDAL_RULES = Object.freeze({
  name: 'Duke Prad Vidal',
  strength: 6,
  faction: 'ecaz',
  traitor: false,
  summary:
    'One shared Ecaz leader with strength six and no Traitor card. His temporary controller changes through specific faction powers.',
  gameplay: Object.freeze([
    'Duke Prad Vidal remains an Ecaz leader when another faction controls him. His strength is six, and there is no Traitor card for this separate disc. Inspecting him does not acquire him or commit him to a battle.',
    'At the end of Shipment and Movement, Moritani gains the living Duke when its forces face battles in at least two different strongholds, excluding battles involving Ecaz. This checks the battles about to occur, rather than past battle results or several opponents in one stronghold.',
    'Moritani may use Duke Vidal for one battle. An unused living, uncaptured Duke is set aside at the end of the turn; Moritani must qualify again on a later turn to acquire him again.',
    'Karama may prevent Moritani from acquiring Duke Vidal. It does not strip him from Moritani once already controlled and does not cancel his ordinary battle use.',
    'The Ecaz Ambassador may acquire Duke Vidal when he is not dead, captured or a ghola. Ecaz keeps him until battle use or until Moritani takes him. The Ambassador’s separate alliance choice can permit a loan to the faction that has just allied with Ecaz for that turn.',
    'Battle death sends the same disc to the Tanks and preserves its death history. Only Ecaz may revive Duke Vidal, including when using the Ghola Treachery Card. His printed revival price is five spice, distinct from his battle strength of six, and this revival does not require other leaders to be dead.',
    'Ecaz can begin ordinary leader revival when five of its leaders are in the Tanks, counting Duke Vidal, even if it still has another living leader. These special rules do not create an extra native leader or an extra Traitor card.',
  ]),
  /** Developer metadata: the guide describes rules beyond this module's custody helpers. */
  implementation: Object.freeze({
    custody: 'implemented',
    capture: 'original-harkonnen-provisional-return',
    revival: 'ecaz-only-set-aside',
    ambassadorAcquisition: 'ecaz-self-implemented',
    ambassadorAlliance: 'consent-implemented',
    ambassadorNewAllyLoan: 'basic-prototype',
    ambassadorAllyAcquisition: 'unresolved',
    allyLoanReturn: 'basic-set-aside-provisional',
    sourceAudit: 'docs/DUKE_VIDAL_RULES.md',
  }),
});
