'use client';

import { TERRITORIES } from '@/game/board';
import type { GameView } from '@/game/engine';
import type { MixedActionExpression } from '@/game/mixed-action-question';
import { parseBattleActionClaim } from '@/game/mixed-battle-question';
import { battlePowerOf, nativeBattlePowerOpportunity, type BattlePowerClaim } from '@/game/battle-power-question';
import { battleCardLabel, VOICE_KINDS } from '@/game/battle-cards';
import { parseTurnActionLeaf, TURN_ACTION_MAX_DEPTH, TURN_ACTION_MAX_LEAVES, type TurnActionLeaf } from '@/game/turn-action-promises';
import { BattleClaimFields } from './battle-promises';
import { MixedActionFields, mixedActionInputError, type MixedActionConfig } from './mixed-action-fields';
import { Input } from './ui/input';

type TurnActionExpression = MixedActionExpression<TurnActionLeaf>;
const recipients = (game: GameView, target: string) => {
  const player = game.players.find(player => player.id === target);
  return player ? game.players.filter(recipient => recipient.id !== target && recipient.id !== player.ally) : [];
};
/** Public faction names only; casualties, custody and native eligibility stay
 * on the server. Advanced Atreides may name their Kwisatz Haderach. */
const leaders = (game: GameView, target: string) => {
  const faction = game.players.find(player => player.id === target)?.faction;
  return [...game.allLeaders.filter(leader => !!faction && leader.faction === faction),
    ...(game.advanced && faction === 'atreides' ? [{ id: 'kwisatz', name: 'Kwisatz Haderach' }] : [])];
};
const currentLot = (game: GameView) => game.bidPromiseLot?.turn === game.turn ? game.bidPromiseLot : null;
const partners = (game: GameView, target: string) => game.players.some(player => player.id === target)
  ? game.players.filter(player => player.id !== target) : [];
const currentNexus = (game: GameView, target: string) => game.status === 'playing' && game.phase === 1 && game.nexus && !game.spiceWindow &&
  game.alliancePromiseNexus?.turn === game.turn && game.truthMixedAllianceTargets.includes(target) &&
  !game.response && !game.decision && !game.phaseOpening && !game.automaticContinuationPending;
const currentBattle = (game: GameView, target: string, kind: 'battlePlan' | 'traitorCall') => {
  const battle = game.battle;
  if (game.status !== 'playing' || game.phase !== 6 || !battle || !battle.event || game.response || game.decision ||
    game.phaseOpening || game.automaticContinuationPending) return null;
  if (kind === 'battlePlan') return game.truthMixedBattleTargets.includes(target) &&
    [battle.attacker, battle.defender].includes(target) ? battle : null;
  return battle.revealed && game.truthMixedTraitorTargets.includes(target) && battle.traitorVoters.includes(target) &&
    !battle.traitorSubmitted.includes(target) ? battle : null;
};
const powerOpportunity = (game: GameView, target: string, claim: BattlePowerClaim) => {
  try { return nativeBattlePowerOpportunity(game, target, battlePowerOf(claim)); }
  catch { return null; }
};
const newPowerClaim = (game: GameView, target: string): BattlePowerClaim =>
  nativeBattlePowerOpportunity(game, target, 'voice') ? { kind: 'voice', use: true }
    : nativeBattlePowerOpportunity(game, target, 'prescience') ? { kind: 'prescience', use: true }
      : { kind: 'voice', use: true };
const config: MixedActionConfig<TurnActionLeaf> = {
  prefix: 'turn-action',
  legend: 'Current battle and this-turn action conditions, with optional current facts',
  actionLabel: 'native battle power, printed card play, battle, alliance, bid, Revival, payment, shipment or ground-movement condition',
  actionTiming: 'Current battle or future native action · this turn',
  actionHelp: <>Ordinary payment conditions sum future real bribes to the same recipient after the answer this turn.
    Earlier payments, gifts and ally aid do not count. The sender pays immediately; the recipient collects at the next Mentat opening.
    Payments made during Mentat Pause wait until next turn&apos;s Mentat opening; collection never counts twice.
    Ordinary bid conditions use the highest accepted future bid declaration in the named current lot, never the sum of smaller bids.
    A qualifying bid counts even if another player wins; it does not promise a purchase. Winning still requires the original payment.
    Ordinary Revival conditions count cumulative future normal and elite physical force returns, with each counter counted once,
    or an actual future return of a named native leader. Smaller ordinary force returns add together.
    Earlier returns, requests alone, Ghola, foreign leaders and special card returns do not count.
    Alliance conditions concern actual final membership when this current Nexus closes. Offers alone are not alliances.
    A remaining alliance condition settles at the actual close; forming an alliance does not fulfill it early.
    No can allow temporary membership followed by a break before the close. You cannot promise another player&apos;s consent.
    Battle-plan conditions concern one actual native plan in this current battle, including a plan already sealed or revealed.
    An open plan commitment settles when both plans are revealed, not merely when your own plan is sealed.
    Traitor conditions concern one original Reveal or decline declaration in the current revealed battle.
    The declaration counts before a later Karama or betrayal response can prevent its effect.
    Native Voice and Prescience conditions concern your original use or explicit decline, exact Voice command,
    or requested Prescience field in this battle. They count before later Karama prevention.
    A requested field is not the opponent&apos;s answer or inspected value. Borrowed Nexus and special powers do not count.
    These conditions close at the actual native choice or when its original source expires.
    Printed-card conditions ask you to play Hajr or Tleilaxu Ghola in its printed role after this answer this turn.
    An earlier play, discard, sale, Karama role or recovery alone does not count; an actual later replay after Box recovery does.
    Hajr counts when played even if its extra movement is unused. Tleilaxu Ghola is a card play, separate from ordinary Revival.
    Hajr conditions close at your own Movement turn end; Tleilaxu Ghola conditions close at the actual turn end.
    Shipment conditions concern the single future original reserve shipment after the answer.
    Ground-movement conditions use the maximum physical forces in one actual future move to that destination; smaller moves never add together.
    Bid conditions close with their named ordinary lot; Revival conditions close with your native Revival opportunity.
    Shipment and movement close at your own Movement turn end, while payment conditions last until the actual turn ends.
    AND requires every condition; OR keeps legal alternatives. No makes the whole expression false, not every condition separately.
    Original costs, timing, cards, preparation and action rights still apply; this claim grants no extra action.</>,
  fallbackError: 'Choose a current battle or future native action condition, with optional current facts.',
  maxLeaves: TURN_ACTION_MAX_LEAVES,
  maxDepth: TURN_ACTION_MAX_DEPTH,
  requireFact: false,
  newAction: () => ({ kind: 'ship', territory: 'carthag', minimum: 1 }),
  parseAction: (input, game, target) => {
    const action = parseTurnActionLeaf(input);
    if (action.kind === 'payment' && !recipients(game, target).some(recipient => recipient.id === action.recipient))
      throw new Error('Choose a public non-allied recipient for the future ordinary payment.');
    if (action.kind === 'bid' && currentLot(game)?.lot !== action.lot)
      throw new Error('Choose the current public ordinary lot for the future bid.');
    if (action.kind === 'leader' && !leaders(game, target).some(leader => leader.id === action.leader))
      throw new Error('Choose a public native leader for the respondent’s faction.');
    if (action.kind === 'alliance' && (!currentNexus(game, target) || !partners(game, target).some(partner => partner.id === action.partner)))
      throw new Error('Choose a public other partner during the current open Nexus.');
    if (action.kind === 'battlePlan' || action.kind === 'traitorCall') {
      const battle = currentBattle(game, target, action.kind);
      if (!battle || action.battle !== battle.event || action.territory !== battle.territory)
        throw new Error('Choose this player’s current native battle or unsubmitted Traitor declaration.');
      if (action.kind === 'battlePlan') parseBattleActionClaim(action.claim, game.allLeaders.map(leader => leader.id));
    }
    if (action.kind === 'battlePower') {
      const opportunity = powerOpportunity(game, target, action.claim);
      if (!opportunity || action.battle !== opportunity.event || action.territory !== opportunity.territory)
        throw new Error('Choose this player’s original native Voice or Prescience opportunity in the current battle.');
    }
    return action;
  },
  renderAction: ({ value, id, game, target, disabled, onChange }) => {
    const choices = recipients(game, target), leaderChoices = leaders(game, target), lot = currentLot(game), partnerChoices = partners(game, target);
    const currentPower = value.kind === 'battlePower' ? powerOpportunity(game, target, value.claim) : null;
    return <>
      <label htmlFor={`${id}-action`}>Future action</label>
      <select id={`${id}-action`} value={value.kind} disabled={disabled} onChange={event => {
        const kind = event.currentTarget.value;
        if (kind === value.kind) return;
        const minimum = 'minimum' in value ? value.minimum : 1;
        if (kind === 'cardPlay') onChange({ kind, effect: 'hajr' });
        if (kind === 'battlePower') {
          const claim = newPowerClaim(game, target), opportunity = powerOpportunity(game, target, claim);
          onChange({ kind, battle: opportunity?.event ?? '', territory: opportunity?.territory ?? '', claim });
        }
        if (kind === 'battlePlan') onChange({ kind, battle: game.battle?.event ?? '', territory: game.battle?.territory ?? '',
          claim: { kind: 'dial', compare: 'eq', value: 0 } });
        if (kind === 'traitorCall') onChange({ kind, battle: game.battle?.event ?? '', territory: game.battle?.territory ?? '', call: true });
        if (kind === 'alliance') onChange({ kind, partner: '' });
        if (kind === 'payment') onChange({ kind, recipient: '', minimum });
        if (kind === 'bid') onChange({ kind, lot: lot?.lot ?? NaN, minimum });
        if (kind === 'forces') onChange({ kind, counter: 'total', minimum });
        if (kind === 'leader') onChange({ kind, leader: leaderChoices[0]?.id ?? '' });
        if (kind === 'ship' || kind === 'move') onChange({ kind,
          territory: value.kind === 'ship' || value.kind === 'move' ? value.territory : 'carthag', minimum });
      }}>
        <option value="cardPlay">Play Hajr or Tleilaxu Ghola in its printed role</option>
        <option value="battlePower">Declare native Voice or Prescience in this battle</option>
        <option value="battlePlan">Use an actual current battle-plan choice</option>
        <option value="traitorCall">Make the current Traitor declaration</option>
        <option value="alliance">End this Nexus allied with a named partner</option>
        <option value="bid">Place an ordinary-lot bid</option>
        <option value="forces">Revive ordinary physical forces</option>
        <option value="leader">Revive a named ordinary leader</option>
        <option value="payment">Make an ordinary payment</option>
        <option value="ship">Ship from reserves</option>
        <option value="move">Make ground movement</option>
      </select>
      {value.kind === 'cardPlay' ? <>
        <label htmlFor={`${id}-effect`}>Printed card role after this answer</label>
        <select id={`${id}-effect`} value={value.effect} disabled={disabled}
          aria-invalid={value.effect !== 'hajr' && value.effect !== 'ghola'} onChange={event => {
            const effect = event.currentTarget.value;
            if (effect === 'hajr' || effect === 'ghola') onChange({ kind: 'cardPlay', effect });
          }}>
          <option value="hajr">Play Hajr in its printed role after this answer this turn</option>
          <option value="ghola">Play Tleilaxu Ghola in its printed role after this answer this turn</option>
        </select>
      </> : value.kind === 'battlePower' ? <>
        <label htmlFor={`${id}-power-claim`}>Original native declaration</label>
        <select id={`${id}-power-claim`} value={value.claim.kind} disabled={disabled} onChange={event => {
          const kind = event.currentTarget.value;
          const claim: BattlePowerClaim | null = kind === 'voice' || kind === 'prescience' ? { kind, use: true }
            : kind === 'voiceCommand' ? { kind, cardType: 'poison', must: false }
              : kind === 'prescienceField' ? { kind, field: 'leader' } : null;
          if (claim) {
            const opportunity = powerOpportunity(game, target, claim);
            onChange({ ...value, claim, battle: opportunity?.event ?? '', territory: opportunity?.territory ?? '' });
          }
        }}>
          <option value="voice">Use or explicitly decline native Voice</option>
          <option value="voiceCommand">Declare an exact native Voice command</option>
          <option value="prescience">Use or explicitly decline native Prescience</option>
          <option value="prescienceField">Request an exact native Prescience field</option>
        </select>
        <label htmlFor={`${id}-power-battle`}>Original current battle opportunity</label>
        <select id={`${id}-power-battle`} value={currentPower?.event === value.battle && currentPower.territory === value.territory ? value.battle : ''}
          disabled={disabled} aria-invalid={!currentPower || currentPower.event !== value.battle || currentPower.territory !== value.territory} onChange={event => {
          const opportunity = powerOpportunity(game, target, value.claim);
          if (event.currentTarget.value === '') onChange({ ...value, battle: '', territory: '' });
          else if (opportunity?.event === event.currentTarget.value)
            onChange({ ...value, battle: opportunity.event, territory: opportunity.territory });
        }}>
          <option value="">Choose an owned native opportunity</option>
          {currentPower && <option value={currentPower.event}>
            {game.combatLocations.find(location => location.id === currentPower.territory)?.name ?? currentPower.territory}
          </option>}
        </select>
        {value.claim.kind === 'voice' || value.claim.kind === 'prescience' ? <>
          <label htmlFor={`${id}-power-use`}>Original choice</label>
          <select id={`${id}-power-use`} value={value.claim.use ? 'use' : 'decline'} disabled={disabled}
            aria-invalid={typeof value.claim.use !== 'boolean'} onChange={event => {
              if (event.currentTarget.value === 'use' || event.currentTarget.value === 'decline')
                onChange({ ...value, claim: { kind: value.claim.kind as 'voice' | 'prescience', use: event.currentTarget.value === 'use' } });
            }}>
            <option value="use">Use this native power</option><option value="decline">Explicitly decline this native power</option>
          </select>
        </> : value.claim.kind === 'voiceCommand' ? <>
          <label htmlFor={`${id}-power-card-type`}>Voice card type</label>
          <select id={`${id}-power-card-type`} value={VOICE_KINDS.includes(value.claim.cardType) ? value.claim.cardType : ''}
            disabled={disabled} aria-invalid={!VOICE_KINDS.includes(value.claim.cardType)} onChange={event => {
              if (value.claim.kind === 'voiceCommand' && (event.currentTarget.value === '' || VOICE_KINDS.includes(event.currentTarget.value)))
                onChange({ ...value, claim: { ...value.claim, cardType: event.currentTarget.value } });
            }}>
            <option value="">Choose a native Voice card type</option>
            {VOICE_KINDS.map(kind => <option key={kind} value={kind}>{battleCardLabel(kind)}</option>)}
          </select>
          <label htmlFor={`${id}-power-must`}>Exact Voice command</label>
          <select id={`${id}-power-must`} value={value.claim.must ? 'must' : 'cannot'} disabled={disabled}
            aria-invalid={typeof value.claim.must !== 'boolean'} onChange={event => {
              if (value.claim.kind === 'voiceCommand' && (event.currentTarget.value === 'must' || event.currentTarget.value === 'cannot'))
                onChange({ ...value, claim: { ...value.claim, must: event.currentTarget.value === 'must' } });
            }}>
            <option value="cannot">Opponent cannot play this type</option><option value="must">Opponent must play this type</option>
          </select>
        </> : value.claim.kind === 'prescienceField' ? <>
          <label htmlFor={`${id}-power-field`}>Requested Prescience field</label>
          <select id={`${id}-power-field`} value={value.claim.field} disabled={disabled} onChange={event => {
            const field = event.currentTarget.value;
            if (field === 'leader' || field === 'weapon' || field === 'defense' || field === 'dial')
              onChange({ ...value, claim: { kind: 'prescienceField', field } });
          }}>
            <option value="leader">Leader</option><option value="weapon">Weapon</option>
            <option value="defense">Defense</option><option value="dial">Number dialed</option>
          </select>
        </> : null}
        {!currentPower && <p className="fine">This respondent has no original native opportunity for this power in the current battle.</p>}
      </> : value.kind === 'battlePlan' || value.kind === 'traitorCall' ? <>
        <label htmlFor={`${id}-battle`}>Current battle</label>
        <select id={`${id}-battle`} value={game.battle?.event === value.battle && game.battle.territory === value.territory ? value.battle ?? '' : ''}
          disabled={disabled} aria-invalid={!currentBattle(game, target, value.kind) || game.battle?.event !== value.battle || game.battle?.territory !== value.territory}
          onChange={event => {
            const selected = event.currentTarget.value;
            if (selected === '') onChange({ ...value, battle: '', territory: '' });
            else if (game.battle && selected === game.battle.event)
              onChange({ ...value, battle: game.battle.event, territory: game.battle.territory });
          }}>
          <option value="">Choose the current battle</option>
          {game.battle?.event && <option value={game.battle.event}>{game.combatLocations.find(location => location.id === game.battle?.territory)?.name ?? game.battle.territory}</option>}
        </select>
        {value.kind === 'battlePlan' ? <fieldset disabled={disabled} data-turn-action-plan-fields={id}>
          <BattleClaimFields game={game} value={value.claim} onChange={claim => {
            if (!disabled && !('terms' in claim)) onChange({ ...value, claim });
          }} />
        </fieldset> : <>
          <label htmlFor={`${id}-call`}>Original Traitor declaration</label>
          <select id={`${id}-call`} value={value.call ? 'reveal' : 'decline'} disabled={disabled}
            aria-invalid={typeof value.call !== 'boolean'} onChange={event => {
              if (event.currentTarget.value === 'reveal') onChange({ ...value, call: true });
              if (event.currentTarget.value === 'decline') onChange({ ...value, call: false });
            }}>
            <option value="reveal">Reveal traitor</option><option value="decline">Decline traitor</option>
          </select>
        </>}
      </> : value.kind === 'alliance' ? <>
        <label htmlFor={`${id}-partner`}>Final Nexus alliance partner</label>
        <select id={`${id}-partner`} value={partnerChoices.some(partner => partner.id === value.partner) ? value.partner : ''}
          disabled={disabled} aria-invalid={!partnerChoices.some(partner => partner.id === value.partner)} onChange={event => {
            const partner = event.currentTarget.value;
            if (partner === '' || partnerChoices.some(choice => choice.id === partner)) onChange({ ...value, partner });
          }}>
          <option value="">Choose a partner</option>
          {partnerChoices.map(partner => <option key={partner.id} value={partner.id}>{partner.name}</option>)}
        </select>
        {!currentNexus(game, target) && <p className="fine">Alliance conditions require the current open Nexus.</p>}
      </> : value.kind === 'bid' ? <>
        <label htmlFor={`${id}-lot`}>Current ordinary lot</label>
        <select id={`${id}-lot`} value={lot?.lot === value.lot ? String(value.lot) : ''} disabled={disabled}
          aria-invalid={lot?.lot !== value.lot} onChange={event => {
            const selected = event.currentTarget.value;
            if (selected === '' || lot && selected === String(lot.lot))
              onChange({ ...value, lot: selected === '' ? NaN : Number(selected) });
          }}>
          <option value="">Choose the current ordinary lot</option>
          {lot && <option value={lot.lot}>Turn {lot.turn} · Ordinary lot {lot.lot}</option>}
        </select>
        {!lot && <p className="fine">No public ordinary lot is currently available. Special auctions do not count.</p>}
      </> : value.kind === 'forces' ? <>
        <label htmlFor={`${id}-counter`}>Physical force counters</label>
        <select id={`${id}-counter`} value={value.counter} disabled={disabled} onChange={event => {
          const counter = event.currentTarget.value;
          if (counter === 'total' || counter === 'normal' || counter === 'elite') onChange({ ...value, counter });
        }}>
          <option value="total">All physical forces</option>
          <option value="normal">Normal forces</option>
          <option value="elite">Elite forces</option>
        </select>
      </> : value.kind === 'leader' ? <>
        <label htmlFor={`${id}-leader`}>Named ordinary leader</label>
        <select id={`${id}-leader`} value={leaderChoices.some(leader => leader.id === value.leader) ? value.leader : ''}
          disabled={disabled} aria-invalid={!leaderChoices.some(leader => leader.id === value.leader)} onChange={event => {
            const leader = event.currentTarget.value;
            if (leader === '' || leaderChoices.some(choice => choice.id === leader)) onChange({ ...value, leader });
          }}>
          <option value="">Choose a named leader</option>
          {leaderChoices.map(leader => <option key={leader.id} value={leader.id}>{leader.name}</option>)}
        </select>
      </> : value.kind === 'payment' ? <>
        <label htmlFor={`${id}-recipient`}>Ordinary payment recipient</label>
        <select id={`${id}-recipient`} value={choices.some(recipient => recipient.id === value.recipient) ? value.recipient : ''}
          disabled={disabled} aria-invalid={!choices.some(recipient => recipient.id === value.recipient)}
          onChange={event => {
            const recipient = event.currentTarget.value;
            if (recipient === '' || choices.some(choice => choice.id === recipient)) onChange({ ...value, recipient });
          }}>
          <option value="">Choose a recipient</option>
          {choices.map(recipient => <option key={recipient.id} value={recipient.id}>{recipient.name}</option>)}
        </select>
      </> : <>
        <label htmlFor={`${id}-territory`}>{value.kind === 'ship' ? 'Reserve-shipment destination' : 'Ground-movement destination'}</label>
        <select id={`${id}-territory`} value={TERRITORIES.some(destination => destination.id === value.territory) ? value.territory : ''}
          disabled={disabled} aria-invalid={!TERRITORIES.some(destination => destination.id === value.territory)}
          onChange={event => onChange({ ...value, territory: event.currentTarget.value })}>
          <option value="">Choose a printed Arrakis territory</option>
          {TERRITORIES.map(destination => <option key={destination.id} value={destination.id}>{destination.name}</option>)}
        </select>
      </>}
      {'minimum' in value && <>
        <label htmlFor={`${id}-minimum`}>{value.kind === 'payment' ? 'Minimum future ordinary payments in spice'
          : value.kind === 'bid' ? 'Minimum future accepted bid in spice'
            : value.kind === 'forces' ? 'Minimum future ordinary force returns'
              : `Minimum physical forces in one ${value.kind === 'ship' ? 'reserve shipment' : 'ground move'}`}</label>
        <Input id={`${id}-minimum`} type="number" min={1} max={value.kind === 'payment' || value.kind === 'bid' ? Number.MAX_SAFE_INTEGER : 20}
          step={1} required disabled={disabled} value={Number.isFinite(value.minimum) ? value.minimum : ''}
          aria-invalid={!Number.isSafeInteger(value.minimum) || value.minimum < 1 ||
            value.kind !== 'payment' && value.kind !== 'bid' && value.minimum > 20}
          onChange={event => onChange({ ...value, minimum: event.currentTarget.valueAsNumber })} />
      </>}
    </>;
  },
};

/** Public schema choices only; the native engine owns eligibility and funding. */
export function turnActionInputError(value: unknown, game: GameView, target: string): string | null {
  return mixedActionInputError(value, game, target, config);
}

export function TurnActionFields(props: {
  value: TurnActionExpression;
  game: GameView;
  target: string;
  disabled: boolean;
  onChange: (expression: TurnActionExpression) => void;
}) {
  return MixedActionFields({ ...props, config });
}
