import { TERRITORIES, splitLocation, validLocation } from './board';
import { SPICE_CARDS } from './cards';
import { presenceAt, type ForcePresence } from './force-presence';

/** Public identity of one accepted worm, captured before its original devouring. */
export type NexusFremenProtectionContext = Readonly<{
  event: string;
  turn: number;
  territory: string;
  origin: 'natural' | 'additional' | 'summoned';
  pile?: 0 | 1;
  index?: number;
  parent?: string;
}>;

/** Deliberately excludes card faces, No-Field values and token inventory. */
export type NexusFremenProtectionPlayer = ForcePresence & Readonly<{
  id: string;
  faction: string;
  ally?: string | null;
  hasNexus: boolean;
}>;

export type NexusFremenProtectionInput = NexusFremenProtectionContext & Readonly<{
  order: readonly string[];
  players: readonly NexusFremenProtectionPlayer[];
}>;

export type NexusFremenProtectionFrame = NexusFremenProtectionContext & Readonly<{
  stage: 'choose' | 'complete';
  order: readonly string[];
  passed: readonly string[];
  protected: string | null;
}>;

function requireProtection(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const identity = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;
const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

function validateContext(context: NexusFremenProtectionContext): void {
  requireProtection(
    object(context) && identity(context.event) &&
      Number.isSafeInteger(context.turn) && context.turn > 0 &&
      TERRITORIES.some((territory) => territory.id === context.territory &&
        (territory.type === 'sand' || SPICE_CARDS.some(([id]) => id === territory.id))) &&
      ['natural', 'additional', 'summoned'].includes(context.origin),
    'Invalid original Fremen protection occurrence.',
  );
  requireProtection(
    context.origin === 'summoned'
      ? identity(context.parent) && context.pile === undefined && context.index === undefined
      : context.parent === undefined &&
        (context.pile === undefined || context.pile === 0 || context.pile === 1) &&
        (context.index === undefined ||
          (Number.isSafeInteger(context.index) && context.index >= 0)) &&
        (context.origin !== 'natural' ||
          (context.pile !== undefined && context.index !== undefined)),
    'Invalid original Fremen protection source binding.',
  );
}

function validateIds(ids: readonly string[]): void {
  requireProtection(Array.isArray(ids), 'Invalid Fremen protection decision order.');
  const seen = new Set<string>();
  for (const id of ids) {
    requireProtection(
      identity(id) && !seen.has(id),
      'Invalid Fremen protection decision order.',
    );
    seen.add(id);
  }
}

function validateInput(input: NexusFremenProtectionInput): void {
  validateContext(input);
  validateIds(input.order);
  requireProtection(Array.isArray(input.players), 'Invalid public protection seats.');
  const ids = new Set<string>();
  for (const player of input.players) {
    requireProtection(
      object(player) && identity(player.id) && !ids.has(player.id) &&
        identity(player.faction) && typeof player.hasNexus === 'boolean' &&
        object(player.forces),
      'Invalid public protection seat.',
    );
    ids.add(player.id);
    for (const [key, count] of Object.entries(player.forces)) {
      const at = splitLocation(key);
      if (at.territory !== input.territory) continue;
      requireProtection(
        key === `${at.territory}:${at.sector}` &&
          validLocation(at.territory, at.sector) &&
          typeof count === 'number' && Number.isSafeInteger(count) && count >= 0,
        'Invalid public protection force presence.',
      );
    }
    if (player.noField !== undefined && player.noField !== null) {
      requireProtection(object(player.noField), 'Invalid public No-Field presence.');
      const deployed = player.noField.deployed;
      requireProtection(
        deployed === null ||
          (object(deployed) && object(deployed.location) &&
            identity(deployed.location.territory) &&
            typeof deployed.location.sector === 'number' &&
            Number.isSafeInteger(deployed.location.sector) &&
            (deployed.location.territory !== input.territory ||
              validLocation(deployed.location.territory, deployed.location.sector))),
        'Invalid public No-Field location.',
      );
    }
  }
  requireProtection(
    input.order.length === ids.size && input.order.every((id) => ids.has(id)),
    'Fremen protection needs the original storm order of every seat.',
  );
  for (const player of input.players)
    requireProtection(
      player.ally === undefined || player.ally === null ||
        (identity(player.ally) && player.ally !== player.id && ids.has(player.ally)),
      'Invalid public protection alliance.',
    );
}

function candidates(input: NexusFremenProtectionInput): string[] {
  if (input.players.some((player) => player.faction === 'fremen')) return [];
  const eligible = new Set<string>();
  for (const player of input.players)
    if (!player.ally && player.hasNexus && presenceAt(player, input.territory) > 0)
      eligible.add(player.id);
  return input.order.filter((id) => eligible.has(id));
}

function validateFrame(frame: NexusFremenProtectionFrame): void {
  validateContext(frame);
  const keys = ['event', 'turn', 'territory', 'origin', 'stage', 'order', 'passed', 'protected'];
  if (frame.pile !== undefined) keys.push('pile');
  if (frame.index !== undefined) keys.push('index');
  if (frame.parent !== undefined) keys.push('parent');
  requireProtection(
    Object.keys(frame).sort().join(',') === keys.sort().join(',') &&
      (frame.stage === 'choose' || frame.stage === 'complete'),
    'Invalid saved Fremen protection frame.',
  );
  validateIds(frame.order);
  validateIds(frame.passed);
  requireProtection(
    frame.order.length > 0 && frame.passed.length <= frame.order.length &&
      frame.passed.every((id, index) => id === frame.order[index]),
    'Fremen protection acknowledgements must be an original ordered prefix.',
  );
  requireProtection(
    frame.protected === null ||
      (identity(frame.protected) && frame.passed.includes(frame.protected)),
    'Fremen protection must belong to one acknowledged original owner.',
  );
  requireProtection(
    (frame.stage === 'complete') === (frame.passed.length === frame.order.length),
    'Fremen protection must close the entire original queue.',
  );
}

/** Public candidates only; a wrong private card face still receives the same queue. */
export function createNexusFremenProtection(
  input: NexusFremenProtectionInput,
): NexusFremenProtectionFrame | null {
  validateInput(input);
  const order = candidates(input);
  if (!order.length) return null;
  return {
    event: input.event,
    turn: input.turn,
    territory: input.territory,
    origin: input.origin,
    ...(input.pile === undefined ? {} : { pile: input.pile }),
    ...(input.index === undefined ? {} : { index: input.index }),
    ...(input.parent === undefined ? {} : { parent: input.parent }),
    stage: 'choose',
    order,
    passed: [],
    protected: null,
  };
}

export function currentNexusFremenProtectionOwner(
  frame: NexusFremenProtectionFrame,
): string | null {
  validateFrame(frame);
  return frame.stage === 'complete' ? null : frame.order[frame.passed.length];
}

/** The parent must authenticate and spend the actual Fremen card before committing
 * this result. `passed` is the acknowledgement prefix, including a Use answer.
 * Protection does not skip any remaining acknowledgement or grant worm riding. */
export function answerNexusFremenProtection(
  frame: NexusFremenProtectionFrame,
  actor: string,
  use: boolean,
): NexusFremenProtectionFrame {
  validateFrame(frame);
  requireProtection(typeof use === 'boolean', 'Choose Use or Pass for Fremen protection.');
  requireProtection(
    frame.stage === 'choose' && actor === frame.order[frame.passed.length],
    'Only the current original owner may answer Fremen protection.',
  );
  requireProtection(!use || frame.protected === null, 'This worm already has its protected owner.');
  const passed = [...frame.passed, actor];
  return {
    ...frame,
    passed,
    protected: use ? actor : frame.protected,
    stage: passed.length === frame.order.length ? 'complete' : 'choose',
  };
}

/** Validate against the original public pre-devour snapshot, not live hands after
 * expenditure or board presence after devouring. This is not card entitlement,
 * an event-history receipt, or authority to retrofit an already-devoured worm. */
export function validateNexusFremenProtection(
  input: NexusFremenProtectionInput,
  frame: NexusFremenProtectionFrame,
): void {
  validateInput(input);
  validateFrame(frame);
  requireProtection(
    frame.event === input.event && frame.turn === input.turn &&
      frame.territory === input.territory && frame.origin === input.origin &&
      frame.pile === input.pile && frame.index === input.index && frame.parent === input.parent,
    'Fremen protection has lost its original occurrence identity.',
  );
  const order = candidates(input);
  requireProtection(
    order.length === frame.order.length &&
      order.every((id, index) => id === frame.order[index]),
    'Fremen protection has lost its original public candidates and storm order.',
  );
}
