import type { Leader } from './cards';

export const DUKE_VIDAL_ID = 'duke-vidal';
export type DukeSource = 'moritani' | 'ecaz' | 'ally';
export type DukeState = {
  leader: Leader;
  controller: string | null;
  acquiredTurn: number | null;
  source: DukeSource | null;
};

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
  };
}
function validTurn(turn: number) {
  if (!Number.isSafeInteger(turn) || turn < 1)
    throw new Error('Choose a valid turn for Duke Vidal custody.');
}

/**
 * Custody only: the caller authorizes the faction power and resolves Karama first.
 * Blocking captured/ghola acquisition is an implementation boundary for unresolved
 * Moritani interactions, not a verified blanket restriction on the printed power.
 */
export function acquireDuke(
  state: DukeState,
  controller: string,
  turn: number,
  source: DukeSource,
): DukeState {
  validTurn(turn);
  if (typeof controller !== 'string' || !controller.trim())
    throw new Error('Choose a player to control Duke Vidal.');
  if (!['moritani', 'ecaz', 'ally'].includes(source))
    throw new Error('Choose a valid source of Duke Vidal custody.');
  if (state.leader.dead)
    throw new Error('Duke Vidal is in the Tanks and cannot be acquired.');
  if (state.leader.capturedBy || state.leader.gholaBy)
    throw new Error(
      'Acquiring Duke Vidal from captured or ghola custody is still being implemented.',
    );
  return { ...cloneDuke(state), controller, acquiredTurn: turn, source };
}

/** The battle caller resolves leader death and bounty before releasing temporary control. */
export function consumeDuke(state: DukeState): DukeState {
  return {
    ...cloneDuke(state),
    controller: null,
    acquiredTurn: null,
    source: null,
  };
}

/**
 * End-turn custody only. Ecaz's ordinary acquisition lasts until battle use.
 * Allied loans and captured/ghola release destinations need a verified return contract.
 */
export function expireDuke(state: DukeState, turn: number): DukeState {
  validTurn(turn);
  if (
    state.source === 'moritani' &&
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
    capture: 'not-implemented',
    revival: 'not-implemented',
    ambassadorAcquisition: 'ecaz-self-implemented',
    ambassadorAlliance: 'not-implemented',
    ambassadorAllyAcquisition: 'unresolved',
    allyLoanReturn: 'unresolved',
    sourceAudit: 'docs/DUKE_VIDAL_RULES.md',
  }),
});
