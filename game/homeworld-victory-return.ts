import type { Game } from './engine';
import type { HomeworldAmbassadorArrival } from './homeworld-arrival';
import type { HomeworldVictoryWitness } from './homeworld-victory-reinforcement';
import { HomeworldCustodyError } from './homeworld-custody';

export type HomeworldVictoryReturn = HomeworldVictoryWitness & {
  phase: 6;
  stage: 'waiting' | 'choice' | 'arrival' | 'complete';
  signature: string;
  offer?: { population: number; survivors: number; blocked: string | null; signature: string };
  destination?: string;
  ambassadors?: HomeworldAmbassadorArrival[];
  arrivalSignature?: string;
};
export type HomeworldVictoryObligation = {
  event: string;
  completed: boolean;
  /** Absent only on completed development saves written before stage receipts. */
  stage?: HomeworldVictoryReturn['stage'];
  signature: string;
};

function fail(): never {
  throw new HomeworldCustodyError('The saved Caladan reinforcement no longer matches its original victory and completion obligation.');
}
function originalSignature(witness: HomeworldVictoryWitness) {
  return JSON.stringify(['caladanVictory', witness.event, witness.turn, witness.player, witness.territory, witness.result]);
}
function witnessValid(witness: HomeworldVictoryWitness) {
  return typeof witness.event === 'string' && !!witness.event &&
    Number.isSafeInteger(witness.turn) && witness.turn > 0 &&
    typeof witness.player === 'string' && !!witness.player &&
    typeof witness.territory === 'string' && !!witness.territory &&
    ['normal', 'traitor'].includes(witness.result);
}
export function makeHomeworldVictoryReturn(witness: HomeworldVictoryWitness): HomeworldVictoryReturn {
  if (!witnessValid(witness)) fail();
  return { ...witness, phase: 6, stage: 'waiting', signature: originalSignature(witness) };
}
export function homeworldVictoryObligationSignature(context: NonNullable<Game['lastBattleContext']>, completed: boolean,
  stage?: HomeworldVictoryReturn['stage']) {
  return JSON.stringify(['caladanObligation', context.event, context.turn, context.territory,
    context.winner, context.result, completed, ...(stage === undefined ? [] : [stage])]);
}
export function homeworldVictoryOfferSignature(frame: HomeworldVictoryReturn,
  offer: Pick<NonNullable<HomeworldVictoryReturn['offer']>, 'population' | 'survivors' | 'blocked'>) {
  return JSON.stringify(['caladanOffer', frame.signature, offer.population, offer.survivors, offer.blocked]);
}

/** Original battle facts and the independent obligation survive nullable choices.
 * Arrival chain validation is shared with other Homeworld arrivals by the engine. */
export function validateHomeworldVictoryReturn(g: Pick<Game, 'turn' | 'phase' | 'players' | 'homeworlds' | 'lastBattleContext' | 'homeworldVictoryReinforcement'>) {
  const frame = g.homeworldVictoryReinforcement;
  const context = g.lastBattleContext;
  const obligation = context?.caladanReinforcement;
  if (obligation) {
    if (!frame || obligation.event !== context!.event || frame.event !== obligation.event ||
      typeof obligation.completed !== 'boolean' ||
      obligation.signature !== homeworldVictoryObligationSignature(context!, obligation.completed, obligation.stage) ||
      (obligation.stage === undefined ? !obligation.completed : obligation.stage !== frame.stage) ||
      obligation.completed !== (frame.stage === 'complete')) fail();
  }
  if (frame === undefined || frame === null) return;
  if (typeof frame !== 'object' || Array.isArray(frame) ||
    Object.keys(frame).some((key) => !['event', 'turn', 'phase', 'player', 'territory', 'result', 'stage',
      'signature', 'offer', 'destination', 'ambassadors', 'arrivalSignature'].includes(key)) ||
    !witnessValid(frame) || frame.signature !== originalSignature(frame) || frame.phase !== 6 ||
    !['waiting', 'choice', 'arrival', 'complete'].includes(frame.stage) ||
    !g.homeworlds?.custody ||
    g.players.filter((p) => p.id === frame.player && p.faction === 'atreides').length !== 1 ||
    frame.turn > g.turn) fail();
  if (frame.stage !== 'complete' || frame.event === context?.event) {
    if (!obligation || (frame.stage !== 'complete' && (frame.turn !== g.turn || g.phase !== 6)) ||
      context!.event !== frame.event || context!.turn !== frame.turn ||
      context!.territory !== frame.territory || context!.winner !== frame.player ||
      context!.result !== frame.result) fail();
  }
  const offer = frame.offer;
  if (offer && (typeof offer !== 'object' || Array.isArray(offer) ||
    Object.keys(offer).some((key) => !['population', 'survivors', 'blocked', 'signature'].includes(key)) ||
    !Number.isSafeInteger(offer.population) || offer.population < 6 || offer.population > 20 ||
    !Number.isSafeInteger(offer.survivors) || offer.survivors < 1 || offer.survivors > 20 ||
    offer.blocked !== null && (typeof offer.blocked !== 'string' || !offer.blocked) ||
    offer.signature !== homeworldVictoryOfferSignature(frame, offer))) fail();
  if (frame.stage === 'waiting' || frame.stage === 'choice') {
    if (frame.destination !== undefined || frame.ambassadors !== undefined || frame.arrivalSignature !== undefined ||
      (frame.stage === 'waiting' ? offer !== undefined : !offer)) fail();
  } else if (typeof frame.destination !== 'string' || !frame.destination || !Array.isArray(frame.ambassadors) ||
    typeof frame.arrivalSignature !== 'string' || (!offer && frame.destination !== 'decline')) fail();
}
