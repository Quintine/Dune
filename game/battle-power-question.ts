import { voiceChoices } from './battle-cards';

export type NativeBattlePower = 'voice' | 'prescience';
export type BattlePowerClaim =
  | { kind: 'voice'; use: boolean }
  | { kind: 'voiceCommand'; cardType: string; must: boolean }
  | { kind: 'prescience'; use: boolean }
  | { kind: 'prescienceField'; field: 'leader' | 'weapon' | 'defense' | 'dial' };
export type BattlePowerDeclaration =
  | { power: 'voice'; use: false }
  | { power: 'voice'; use: true; cardType: string; must: boolean }
  | { power: 'prescience'; use: false }
  | { power: 'prescience'; use: true; field: 'leader' | 'weapon' | 'defense' | 'dial' };
export type NativeBattlePowerOpportunity = {
  event: string; territory: string; power: NativeBattlePower; owner: string;
  beneficiary: string; target: string; ready: boolean;
};
export type NativeBattlePowerGame = {
  status: string;
  phase: number;
  players: readonly { id: string; faction: string; ally?: string | null }[];
  battle?: {
    event?: string | null;
    territory: string;
    attacker: string;
    defender: string;
    revealed: boolean;
    prepared?: boolean;
    preparation?: { kind: string; owner: string; beneficiary: string; blocked?: string } | null;
  } | null;
  response?: unknown;
  decision?: unknown;
  phaseOpening?: unknown;
  truthtrance?: unknown;
  pendingTreacheryDiscard?: unknown;
};

export class BattlePowerQuestionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BattlePowerQuestionError';
  }
}
function check(value: unknown, message: string): asserts value {
  if (!value) throw new BattlePowerQuestionError(message);
}
function object(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
const identifier = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value === value.trim();
const keys = (value: Record<string, unknown>, expected: string): boolean =>
  Object.keys(value).sort().join(',') === expected;
const cardType = (value: unknown): value is string => typeof value === 'string' && voiceChoices(true).includes(value);
const field = (value: unknown): value is 'leader' | 'weapon' | 'defense' | 'dial' =>
  value === 'leader' || value === 'weapon' || value === 'defense' || value === 'dial';

/** Declaration/request predicates only; never a successful effect or inspected value. */
export function parseBattlePowerClaim(value: unknown): BattlePowerClaim {
  check(object(value), 'Choose one native Voice or Prescience declaration predicate.');
  if (value.kind === 'voice' || value.kind === 'prescience') {
    check(keys(value, 'kind,use') && typeof value.use === 'boolean', 'Choose actual use or explicit Decline of this native power.');
    return { kind: value.kind, use: value.use };
  }
  if (value.kind === 'voiceCommand') {
    check(keys(value, 'cardType,kind,must') && cardType(value.cardType) && typeof value.must === 'boolean',
      'Choose one native Voice category and require or forbid command.');
    return { kind: 'voiceCommand', cardType: value.cardType, must: value.must };
  }
  check(value.kind === 'prescienceField' && keys(value, 'field,kind') && field(value.field),
    'Choose only the native Prescience field requested, without an answer value.');
  return { kind: 'prescienceField', field: value.field };
}

export function battlePowerOf(claim: BattlePowerClaim): NativeBattlePower {
  const parsed = parseBattlePowerClaim(claim);
  return parsed.kind === 'voice' || parsed.kind === 'voiceCommand' ? 'voice' : 'prescience';
}

function validateDeclaration(value: unknown): asserts value is BattlePowerDeclaration {
  check(object(value) && (value.power === 'voice' || value.power === 'prescience') && typeof value.use === 'boolean',
    'Retain an actual native battle-power declaration.');
  check(!value.use ? keys(value, 'power,use') : value.power === 'voice'
    ? keys(value, 'cardType,must,power,use') && cardType(value.cardType) && typeof value.must === 'boolean'
    : keys(value, 'field,power,use') && field(value.field),
  'Retain only the declared native command or requested field, or explicit Decline.');
}

export function battlePowerMatches(claim: BattlePowerClaim, declaration: BattlePowerDeclaration): boolean {
  const parsed = parseBattlePowerClaim(claim);
  validateDeclaration(declaration);
  if (battlePowerOf(parsed) !== declaration.power) return false;
  if (parsed.kind === 'voice' || parsed.kind === 'prescience') return parsed.use === declaration.use;
  if (!declaration.use) return false;
  return parsed.kind === 'voiceCommand' ? declaration.power === 'voice' &&
    parsed.cardType === declaration.cardType && parsed.must === declaration.must :
    declaration.power === 'prescience' && parsed.field === declaration.field;
}

/** Public native owner/side/order only. Command legality, No-Field restrictions
 * and inspected hidden values remain with the real engine quotation. */
export function nativeBattlePowerOpportunity(game: NativeBattlePowerGame, actor: string,
  power: NativeBattlePower): NativeBattlePowerOpportunity | null {
  if (!identifier(actor) || (power !== 'voice' && power !== 'prescience') || game.status !== 'playing' || game.phase !== 6) return null;
  const battle = game.battle, preparation = battle?.preparation;
  if (!battle || battle.revealed || !identifier(battle.event) || !identifier(battle.territory) ||
    !preparation || battle.attacker === battle.defender || !Array.isArray(game.players) ||
    game.players.some(player => !identifier(player.id)) || new Set(game.players.map(player => player.id)).size !== game.players.length ||
    !game.players.some(player => player.id === battle.attacker) || !game.players.some(player => player.id === battle.defender)) return null;
  const side = (kind: NativeBattlePower) => {
    const owners = game.players.filter(player => player.faction === (kind === 'voice' ? 'beneGesserit' : 'atreides'));
    if (owners.length !== 1) return null;
    const owner = owners[0], combatants = [battle.attacker, battle.defender];
    const beneficiary = combatants.includes(owner.id) ? owner.id : owner.ally && combatants.includes(owner.ally) &&
      game.players.some(player => player.id === owner.ally && player.ally === owner.id) ? owner.ally : null;
    return beneficiary ? { owner: owner.id, beneficiary,
      target: battle.attacker === beneficiary ? battle.defender : battle.attacker } : null;
  };
  const native = side(power);
  if (!native || native.owner !== actor) return null;
  const current = preparation.kind === power;
  if (current) {
    if (preparation.owner !== native.owner || preparation.beneficiary !== native.beneficiary) return null;
  } else {
    if (power !== 'prescience' || preparation.kind !== 'voice') return null;
    const voice = side('voice');
    if (!voice || preparation.owner !== voice.owner || preparation.beneficiary !== voice.beneficiary) return null;
  }
  return { event: battle.event, territory: battle.territory, power, ...native,
    ready: current && !game.response && !game.decision && !game.phaseOpening &&
      !game.truthtrance && !game.pendingTreacheryDiscard };
}
