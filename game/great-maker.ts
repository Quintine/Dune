export type GreatMaker = {
  arrival: {
    territory: string;
    sector: number;
    amount: number;
    elite: number;
  } | null;
  event: string;
  turn: number;
  pile: 0 | 1;
  index: number;
  territory: string | null;
  stage: 'worm' | 'vote' | 'ride' | 'arrival' | 'complete';
  order: string[];
  votes: { player: string; yes: boolean }[];
  ridesBefore: string[];
  signature: string;
};
export function greatMakerSignature(frame: GreatMaker): string {
  return JSON.stringify([
    frame.event,
    frame.turn,
    frame.pile,
    frame.index,
    frame.territory,
    frame.stage,
    frame.order,
    frame.votes,
    frame.ridesBefore,
    frame.arrival,
  ]);
}
export function validateGreatMaker(
  frame: GreatMaker,
  turn: number,
  players: readonly { id: string }[],
) {
  const ids = players.map((player) => player.id);
  if (
    !frame ||
    Object.keys(frame).sort().join(',') !==
      'arrival,event,index,order,pile,ridesBefore,signature,stage,territory,turn,votes' ||
    typeof frame.event !== 'string' ||
    !frame.event ||
    !Number.isSafeInteger(frame.turn) ||
    frame.turn < 2 ||
    frame.turn > turn ||
    ![0, 1].includes(frame.pile) ||
    !Number.isSafeInteger(frame.index) ||
    frame.index < 0 ||
    !['worm', 'vote', 'ride', 'arrival', 'complete'].includes(frame.stage) ||
    !Array.isArray(frame.order) ||
    frame.order.length !== ids.length ||
    new Set(frame.order).size !== ids.length ||
    frame.order.some((id) => !ids.includes(id)) ||
    !Array.isArray(frame.votes) ||
    frame.votes.length > ids.length ||
    frame.votes.some(
      (vote, index) =>
        !vote ||
        Object.keys(vote).sort().join(',') !== 'player,yes' ||
        vote.player !== frame.order[index] ||
        typeof vote.yes !== 'boolean',
    ) ||
    !Array.isArray(frame.ridesBefore) ||
    frame.ridesBefore.some((id) => typeof id !== 'string') ||
    (frame.territory !== null && typeof frame.territory !== 'string') ||
    (frame.stage === 'arrival' && !frame.arrival) ||
    (!['arrival', 'complete'].includes(frame.stage) &&
      frame.arrival !== null) ||
    (frame.arrival !== null &&
      (!frame.arrival ||
        Object.keys(frame.arrival).sort().join(',') !==
          'amount,elite,sector,territory' ||
        typeof frame.arrival.territory !== 'string' ||
        !Number.isSafeInteger(frame.arrival.sector) ||
        frame.arrival.sector < 0 ||
        frame.arrival.sector > 18 ||
        !Number.isSafeInteger(frame.arrival.amount) ||
        frame.arrival.amount < 1 ||
        frame.arrival.amount > 20 ||
        !Number.isSafeInteger(frame.arrival.elite) ||
        frame.arrival.elite < 0 ||
        frame.arrival.elite > frame.arrival.amount)) ||
    (frame.stage === 'worm' && frame.votes.length !== 0) ||
    (frame.stage === 'vote' && frame.votes.length >= ids.length) ||
    (['ride', 'arrival', 'complete'].includes(frame.stage) &&
      frame.votes.length !== ids.length) ||
    frame.signature !== greatMakerSignature(frame)
  )
    throw new Error(
      'The Great Maker has lost its original encounter or ordered vote.',
    );
}
export function greatMakerMajority(frame: GreatMaker): boolean {
  return frame.votes.filter((vote) => vote.yes).length > frame.order.length / 2;
}
