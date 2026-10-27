import { voiceChoices } from './battle-cards';
import type { Battle } from './engine';

export type NexusBorrowedVoiceFrame = {
  event: string;
  turn: number;
  battle: string;
  order: [string, string];
  passed: string[];
  stage: 'choose' | 'declared' | 'active' | 'canceled' | 'passed';
  owner: string | null;
  /** A canceled command remains a receipt; only stage 'active' applies it. */
  voice: {
    target: string;
    kind: NonNullable<Battle['voice']>['kind'];
    must: boolean;
  } | null;
};

export type NexusBorrowedVoiceContext = {
  turn: number;
  battle: { event: string; attacker: string; defender: string };
};

function requireVoice(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function validId(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function event(turn: number, battle: string): string {
  return JSON.stringify(['nexusBorrowedVoice', turn, battle]);
}

function validateContext(context: NexusBorrowedVoiceContext): void {
  requireVoice(
    context && Number.isSafeInteger(context.turn) && context.turn > 0 &&
      context.battle && validId(context.battle.event) &&
      validId(context.battle.attacker) && validId(context.battle.defender) &&
      context.battle.attacker !== context.battle.defender,
    'Borrowed Voice needs its original turn and distinct combatants.',
  );
}

function validateFrame(frame: NexusBorrowedVoiceFrame): void {
  requireVoice(
    frame && typeof frame === 'object' && !Array.isArray(frame) &&
      Object.keys(frame).sort().join(',') === 'battle,event,order,owner,passed,stage,turn,voice' &&
      Number.isSafeInteger(frame.turn) && frame.turn > 0 &&
      validId(frame.battle) && frame.event === event(frame.turn, frame.battle) &&
      Array.isArray(frame.order) && frame.order.length === 2 &&
      validId(frame.order[0]) && validId(frame.order[1]) && frame.order[0] !== frame.order[1] &&
      Array.isArray(frame.passed) && frame.passed.length <= 2 &&
      (frame.passed.length === 0 || frame.passed[0] === frame.order[0]) &&
      (frame.passed.length < 2 || frame.passed[1] === frame.order[1]) &&
      ['choose', 'declared', 'active', 'canceled', 'passed'].includes(frame.stage),
    'Borrowed Voice lost its original event or ordered opportunity.',
  );
  if (frame.stage === 'choose' || frame.stage === 'passed') {
    requireVoice(
      frame.owner === null && frame.voice === null &&
        (frame.stage === 'passed' ? frame.passed.length === 2 : frame.passed.length < 2),
      'An undecided or all-passed borrowed Voice cannot contain a declaration.',
    );
    return;
  }
  requireVoice(
    frame.passed.length < 2 && frame.owner === frame.order[frame.passed.length] &&
      frame.voice && typeof frame.voice === 'object' && !Array.isArray(frame.voice) &&
      Object.keys(frame.voice).sort().join(',') === 'kind,must,target' &&
      frame.voice.target === frame.order[1 - frame.passed.length] &&
      typeof frame.voice.kind === 'string' && voiceChoices(true).includes(frame.voice.kind) &&
      typeof frame.voice.must === 'boolean',
    'Borrowed Voice needs one ordered owner and a canonical opposing command.',
  );
}

export function validateNexusBorrowedVoice(
  context: NexusBorrowedVoiceContext,
  frame: NexusBorrowedVoiceFrame,
): void {
  validateContext(context);
  validateFrame(frame);
  requireVoice(
    frame.turn === context.turn && frame.battle === context.battle.event &&
      frame.order[0] === context.battle.attacker && frame.order[1] === context.battle.defender,
    'Borrowed Voice must remain bound to its original battle and combatants.',
  );
}

export function createNexusBorrowedVoice(
  context: NexusBorrowedVoiceContext,
): NexusBorrowedVoiceFrame {
  validateContext(context);
  return {
    event: event(context.turn, context.battle.event),
    turn: context.turn,
    battle: context.battle.event,
    order: [context.battle.attacker, context.battle.defender],
    passed: [],
    stage: 'choose',
    owner: null,
    voice: null,
  };
}

export function currentNexusBorrowedVoiceOwner(frame: NexusBorrowedVoiceFrame): string | null {
  validateFrame(frame);
  return frame.stage === 'choose' ? frame.order[frame.passed.length] : null;
}

export function passNexusBorrowedVoice(
  frame: NexusBorrowedVoiceFrame,
  actor: string,
): NexusBorrowedVoiceFrame {
  requireVoice(
    currentNexusBorrowedVoiceOwner(frame) === actor && frame.stage === 'choose',
    'Only the current combatant may continue past borrowed Voice.',
  );
  const passed = [...frame.passed, actor];
  return {
    ...frame,
    order: [...frame.order],
    passed,
    stage: passed.length === 2 ? 'passed' : 'choose',
  };
}

export function declareNexusBorrowedVoice(
  frame: NexusBorrowedVoiceFrame,
  actor: string,
  voice: NonNullable<NexusBorrowedVoiceFrame['voice']>,
): NexusBorrowedVoiceFrame {
  requireVoice(
    currentNexusBorrowedVoiceOwner(frame) === actor && frame.stage === 'choose',
    'Only the current combatant may declare borrowed Voice once.',
  );
  const next: NexusBorrowedVoiceFrame = {
    ...frame,
    order: [...frame.order],
    passed: [...frame.passed],
    stage: 'declared',
    owner: actor,
    voice: voice && { ...voice },
  };
  validateFrame(next);
  return next;
}

/** Settle the original Voice response exactly once; cancellation never reopens the queue. */
export function finishNexusBorrowedVoice(
  frame: NexusBorrowedVoiceFrame,
  canceled: boolean,
): NexusBorrowedVoiceFrame {
  validateFrame(frame);
  requireVoice(
    frame.stage === 'declared' && typeof canceled === 'boolean',
    'Only an unsettled borrowed Voice declaration can finish its response.',
  );
  return {
    ...frame,
    order: [...frame.order],
    passed: [...frame.passed],
    stage: canceled ? 'canceled' : 'active',
    voice: { ...frame.voice! },
  };
}
