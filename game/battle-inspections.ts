import { FACTIONS, type FactionId } from './catalog';
import type { PlanField } from './engine';

export type InspectionValue = string | number | null;
export type NativeInspection = {
  player: string;
  field: PlanField;
  value?: InspectionValue;
};
export type NexusInspection = {
  version: 1;
  event: string;
  mode: 'cunning' | 'secretAlly' | 'betrayal';
  owner: string;
  target: string;
  field: PlanField;
  stage: 'response' | 'answer' | 'answered' | 'canceled';
  answers: InspectionValue[];
  /** Original first disclosure remains evidence even after Residual reopens it. */
  first?: { player: string; field: PlanField; value: InspectionValue };
  /** Current native commitment; absent only after its recorded reopening. */
  firstCurrent?: { value: InspectionValue };
  /** Original native attempt can disappear when Betrayal cancels it. */
  nativeProvider?: string;
  nativeBeneficiary?: string;
  signature: string;
};
export type BattleInspectionContext = {
  event: string;
  attacker: string;
  defender: string;
  players: readonly { id: string; faction: FactionId }[];
  native?: NativeInspection;
};
export type CommittedPlanElement = {
  source: 'native' | 'nexus';
  beneficiary: string;
  target: string;
  field: PlanField;
  value: InspectionValue;
};
type InspectionBattle = {
  event?: string;
  attacker: string;
  defender: string;
  prescience?: NativeInspection;
  nexusInspection?: NexusInspection;
};
const has = (object: object, key: string) =>
  Object.prototype.hasOwnProperty.call(object, key);
const fields: PlanField[] = ['leader', 'weapon', 'defense', 'dial'];
function requireInspection(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) throw new Error(message);
}
function validId(id: unknown): id is string {
  return typeof id === 'string' && id.trim().length > 0;
}
function validateValue(field: PlanField, value: unknown): void {
  requireInspection(
    field === 'dial'
      ? typeof value === 'number' &&
          value >= 0 &&
          Number.isSafeInteger(value * 2)
      : value === null || validId(value),
    'Invalid battle inspection value.',
  );
}
function validateNative(native: NativeInspection): void {
  requireInspection(
    native && validId(native.player) && fields.includes(native.field),
    'Invalid native inspection.',
  );
  if (has(native, 'value')) validateValue(native.field, native.value);
}
function opponent(
  context: { attacker: string; defender: string },
  player: string,
): string {
  requireInspection(
    player === context.attacker || player === context.defender,
    'An inspection must belong to a combatant.',
  );
  return player === context.attacker ? context.defender : context.attacker;
}
function validateContext(context: BattleInspectionContext): void {
  requireInspection(
    validId(context.event) &&
      validId(context.attacker) &&
      validId(context.defender) &&
      context.attacker !== context.defender &&
      Array.isArray(context.players) &&
      context.players.length >= 2 &&
      context.players.length <= 6,
    'Invalid inspection battle.',
  );
  const ids = new Set<string>();
  const factions = new Set<FactionId>();
  for (const player of context.players) {
    requireInspection(
      validId(player.id) &&
        !ids.has(player.id) &&
        !factions.has(player.faction) &&
        FACTIONS.some((faction) => faction.id === player.faction),
      'Invalid inspection seats.',
    );
    ids.add(player.id);
    factions.add(player.faction);
  }
  requireInspection(
    ids.has(context.attacker) && ids.has(context.defender),
    'Inspection combatants must be seated.',
  );
  if (context.native) {
    validateNative(context.native);
    opponent(context, context.native.player);
  }
}
function signature(inspection: Omit<NexusInspection, 'signature'>): string {
  return JSON.stringify([
    'nexusInspection',
    inspection.version,
    inspection.event,
    inspection.mode,
    inspection.owner,
    inspection.target,
    inspection.field,
    inspection.stage,
    inspection.answers,
    inspection.first
      ? [
          inspection.first.player,
          inspection.first.field,
          inspection.first.value,
        ]
      : null,
    inspection.firstCurrent ? [inspection.firstCurrent.value] : null,
    inspection.nativeProvider ?? null,
    inspection.nativeBeneficiary ?? null,
  ]);
}
function validateRecord(inspection: NexusInspection): void {
  requireInspection(
    inspection &&
      typeof inspection === 'object' &&
      !Array.isArray(inspection) &&
      inspection.version === 1 &&
      validId(inspection.event) &&
      validId(inspection.owner) &&
      validId(inspection.target) &&
      ['cunning', 'secretAlly', 'betrayal'].includes(inspection.mode) &&
      fields.includes(inspection.field) &&
      ['response', 'answer', 'answered', 'canceled'].includes(
        inspection.stage,
      ) &&
      Array.isArray(inspection.answers),
    'Invalid Nexus inspection record.',
  );
  const keys = [
    'version',
    'event',
    'mode',
    'owner',
    'target',
    'field',
    'stage',
    'answers',
    'signature',
  ];
  if (inspection.mode === 'cunning') {
    keys.push('first');
    requireInspection(
      inspection.first &&
        Object.keys(inspection.first).sort().join(',') === 'field,player,value',
      'Cunning requires the original first disclosure.',
    );
    validateNative(inspection.first);
    if (has(inspection, 'firstCurrent')) {
      keys.push('firstCurrent');
      requireInspection(
        inspection.firstCurrent &&
          Object.keys(inspection.firstCurrent).join(',') === 'value',
        'Invalid current native inspection receipt.',
      );
      validateValue(inspection.first.field, inspection.firstCurrent.value);
    }
  }
  if (inspection.mode === 'betrayal') {
    keys.push('nativeProvider', 'nativeBeneficiary');
    requireInspection(
      validId(inspection.nativeProvider) &&
        validId(inspection.nativeBeneficiary) &&
        inspection.stage === 'canceled' &&
        inspection.answers.length === 0,
      'Betrayal records a canceled native attempt without an answer.',
    );
  } else {
    requireInspection(
      (inspection.stage !== 'response' ||
        (inspection.mode === 'cunning' && inspection.answers.length === 0)) &&
        (inspection.stage !== 'canceled' ||
          (inspection.mode === 'cunning' && inspection.answers.length === 0)) &&
        (inspection.stage !== 'answered' || inspection.answers.length > 0) &&
        (inspection.field !== 'leader' || inspection.answers.length <= 1) &&
        !(
          inspection.field === 'leader' &&
          inspection.stage === 'answer' &&
          inspection.answers.length
        ),
      'Invalid Nexus inspection answer history.',
    );
  }
  requireInspection(
    Object.keys(inspection).sort().join(',') === keys.sort().join(','),
    'Invalid Nexus inspection fields.',
  );
  for (const value of inspection.answers)
    validateValue(inspection.field, value);
  requireInspection(
    inspection.signature === signature(inspection),
    'The Nexus inspection has lost its original disclosure history.',
  );
}
export function validateNexusInspection(
  context: BattleInspectionContext,
  inspection: NexusInspection,
): void {
  validateContext(context);
  validateRecord(inspection);
  requireInspection(
    inspection.event === context.event,
    'The Nexus inspection belongs to another battle.',
  );
  const owner = context.players.find((p) => p.id === inspection.owner);
  const atreides = context.players.find((p) => p.faction === 'atreides');
  requireInspection(owner, 'The Nexus inspection owner must be seated.');
  if (inspection.mode === 'betrayal') {
    requireInspection(
      atreides &&
        owner.id !== atreides.id &&
        inspection.nativeProvider === atreides.id &&
        inspection.target === opponent(context, inspection.nativeBeneficiary!),
      'Betrayal must bind the native Atreides attempt.',
    );
    if (context.native)
      requireInspection(
        context.native.player === inspection.nativeBeneficiary &&
          context.native.field === inspection.field &&
          !has(context.native, 'value'),
        'Betrayal must cancel the original unanswered attempt.',
      );
  } else {
    requireInspection(
      inspection.target === opponent(context, owner.id),
      'An inspection must target its owner’s battle opponent.',
    );
    if (inspection.mode === 'secretAlly')
      requireInspection(
        !atreides,
        'Secret Ally requires Atreides to be absent.',
      );
    else
      requireInspection(
        owner.faction === 'atreides' &&
          inspection.first!.player === owner.id &&
          context.native?.player === inspection.first!.player &&
          context.native.field === inspection.first!.field &&
          inspection.field !== inspection.first!.field &&
          has(context.native, 'value') === has(inspection, 'firstCurrent') &&
          (!has(inspection, 'firstCurrent') ||
            context.native.value === inspection.firstCurrent!.value),
        'Cunning must preserve a distinct original native disclosure.',
      );
  }
}
export function createNexusInspection(
  context: BattleInspectionContext,
  input: Pick<NexusInspection, 'mode' | 'owner' | 'target' | 'field'>,
): NexusInspection {
  validateContext(context);
  const inspection: NexusInspection = {
    version: 1,
    event: context.event,
    mode: input.mode,
    owner: input.owner,
    target: input.target,
    field: input.field,
    stage:
      input.mode === 'betrayal'
        ? 'canceled'
        : input.mode === 'cunning'
          ? 'response'
          : 'answer',
    answers: [],
    signature: '',
  };
  if (input.mode === 'cunning') {
    requireInspection(
      context.native && has(context.native, 'value'),
      'Answer native prescience before using Cunning.',
    );
    inspection.firstCurrent = { value: context.native.value! };
    inspection.first = {
      player: context.native.player,
      field: context.native.field,
      value: context.native.value!,
    };
  }
  if (input.mode === 'betrayal') {
    requireInspection(
      context.native &&
        !has(context.native, 'value') &&
        context.native.field === input.field,
      'Betrayal needs an unanswered native attempt.',
    );
    inspection.nativeProvider = context.players.find(
      (p) => p.faction === 'atreides',
    )?.id;
    inspection.nativeBeneficiary = context.native.player;
  }
  inspection.signature = signature(inspection);
  validateNexusInspection(context, inspection);
  return inspection;
}
/** Record a native re-answer obligation before the engine removes its value. */
export function reopenNexusNative(
  context: BattleInspectionContext,
  inspection: NexusInspection,
): NexusInspection {
  validateNexusInspection(context, inspection);
  requireInspection(
    inspection.mode === 'cunning' &&
      context.native &&
      context.native.field !== 'leader' &&
      has(context.native, 'value') &&
      inspection.firstCurrent,
    'Only an answered non-leader native inspection can reopen.',
  );
  const next = structuredClone(inspection);
  delete next.firstCurrent;
  next.signature = signature(next);
  validateNexusInspection(
    {
      ...context,
      native: { player: context.native.player, field: context.native.field },
    },
    next,
  );
  return next;
}
/** Record a legitimate replacement native answer before the engine stores it. */
export function answerNexusNative(
  context: BattleInspectionContext,
  inspection: NexusInspection,
  value: InspectionValue,
): NexusInspection {
  validateNexusInspection(context, inspection);
  requireInspection(
    inspection.mode === 'cunning' &&
      context.native &&
      !has(context.native, 'value') &&
      !has(inspection, 'firstCurrent'),
    'The original native inspection is not awaiting a replacement answer.',
  );
  validateValue(context.native.field, value);
  const next = { ...structuredClone(inspection), firstCurrent: { value } };
  next.signature = signature(next);
  validateNexusInspection(
    { ...context, native: { ...context.native, value } },
    next,
  );
  return next;
}
/** The engine calls this only after the original Karama response finishes. */
export function allowNexusInspection(
  context: BattleInspectionContext,
  inspection: NexusInspection,
): NexusInspection {
  validateNexusInspection(context, inspection);
  requireInspection(
    inspection.mode === 'cunning' &&
      inspection.stage === 'response' &&
      inspection.answers.length === 0,
    'Only the original Cunning response can allow its answer.',
  );
  const next = { ...structuredClone(inspection), stage: 'answer' as const };
  next.signature = signature(next);
  validateNexusInspection(context, next);
  return next;
}
export function answerNexusInspection(
  context: BattleInspectionContext,
  inspection: NexusInspection,
  value: InspectionValue,
): NexusInspection {
  validateNexusInspection(context, inspection);
  requireInspection(
    inspection.stage === 'answer',
    'This Nexus inspection is not awaiting an answer.',
  );
  validateValue(inspection.field, value);
  const next = {
    ...structuredClone(inspection),
    stage: 'answered' as const,
    answers: [...inspection.answers, value],
  };
  next.signature = signature(next);
  validateNexusInspection(context, next);
  return next;
}
/** Ordinary native-power cancellation can stop only the original unanswered
 * extra Cunning attempt. The first disclosure and spent-card record survive. */
export function cancelNexusInspection(
  context: BattleInspectionContext,
  inspection: NexusInspection,
): NexusInspection {
  validateNexusInspection(context, inspection);
  requireInspection(
    inspection.mode === 'cunning' &&
      inspection.stage === 'response' &&
      inspection.answers.length === 0,
    'Only the original unanswered Cunning inspection can be canceled.',
  );
  const next = { ...structuredClone(inspection), stage: 'canceled' as const };
  next.signature = signature(next);
  validateNexusInspection(context, next);
  return next;
}
export function reopenNexusInspection(
  context: BattleInspectionContext,
  inspection: NexusInspection,
): NexusInspection {
  validateNexusInspection(context, inspection);
  requireInspection(
    inspection.stage === 'answered' && inspection.field !== 'leader',
    'Only an answered non-leader inspection can reopen.',
  );
  const next = { ...structuredClone(inspection), stage: 'answer' as const };
  next.signature = signature(next);
  validateNexusInspection(context, next);
  return next;
}
/** Current binding only. Historical answers survive on the record but do not
 * constrain a reopened field. Callers validate the full public context first. */
export function committedPlanElements(
  battle: InspectionBattle,
  target: string,
): CommittedPlanElement[] {
  const result: CommittedPlanElement[] = [];
  if (battle.prescience) {
    const native = battle.prescience;
    validateNative(native);
    if (opponent(battle, native.player) === target && has(native, 'value'))
      result.push({
        source: 'native',
        beneficiary: native.player,
        target,
        field: native.field,
        value: native.value!,
      });
  }
  const inspection = battle.nexusInspection;
  if (inspection) {
    validateRecord(inspection);
    requireInspection(
      battle.event === inspection.event,
      'The Nexus inspection belongs to another battle.',
    );
    if (inspection.mode !== 'betrayal')
      requireInspection(
        opponent(battle, inspection.owner) === inspection.target,
        'An inspection must target its owner’s battle opponent.',
      );
    if (inspection.stage === 'answered' && inspection.target === target)
      result.push({
        source: 'nexus',
        beneficiary: inspection.owner,
        target,
        field: inspection.field,
        value: inspection.answers.at(-1)!,
      });
  }
  return result;
}
export const inspectedPlanElements = committedPlanElements;
