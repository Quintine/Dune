'use client';

import { TERRITORIES } from '@/game/board';
import { PHASES } from '@/game/catalog';
import type { GameView } from '@/game/engine';
import type { MixedActionExpression } from '@/game/mixed-action-question';
import { parseBattleActionClaim } from '@/game/mixed-battle-question';
import { battlePowerOf, nativeBattlePowerOpportunity, type BattlePowerClaim } from '@/game/battle-power-question';
import { battleCardLabel, VOICE_KINDS } from '@/game/battle-cards';
import { nativeStormDialOpportunity } from '@/game/storm-dial-question';
import { karamaBattleCancelOpportunity, WINDOW_CARD_EFFECTS, windowCardOpportunity, type WindowCardEffect } from '@/game/window-card-play';
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
const windowRoleNames: Record<WindowCardEffect, string> = { weather: 'Weather Control', atomics: 'Family Atomics', harvester: 'Harvester',
  karamaAuction: 'Spend a printed Karama for this current ordinary lot',
  karamaShipment: 'Spend a printed Karama for the current shipment-price opportunity',
  karamaBattleCancel: 'Spend a printed Karama to cancel this Voice or Prescience',
  thumper: 'Play Thumper before this turn’s first spice reveal', amal: 'Play Amal in this original phase opening' };
const battleCancelOpportunity = karamaBattleCancelOpportunity;
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
    A Storm dial condition compares the value the respondent will submit in their original current Storm dial.
    The first Storm allows 0–20; later Basic storms allow 1–3. The other player&apos;s value stays sealed until both dials reveal.
    Native Voice and Prescience conditions concern your original use or explicit decline, exact Voice command,
    or requested Prescience field in this battle. They count before later Karama prevention.
    A requested field is not the opponent&apos;s answer or inspected value. Borrowed Nexus and special powers do not count.
    These conditions close at the actual native choice or when its original source expires.
    Printed-card conditions ask you to play Hajr, Tleilaxu Ghola, Nullentropy Box, Distrans, Juice of Sapho, Semuta Drug, Ornithopter or Residual Poison in its printed role after this answer this turn.
    An earlier play, discard, sale, Karama role or recovery alone does not count; an actual later replay after Box recovery does.
    Hajr counts when played even if its extra movement is unused. Tleilaxu Ghola is a card play, separate from ordinary Revival.
    Hajr conditions close at your own Movement turn end; Tleilaxu Ghola conditions close at the actual turn end.
    Nullentropy Box counts when its printed activation is accepted and you pay 2 spice to begin the private search.
    Earlier activation or recovery alone does not count. The selected recovered card stays private and is not promised by this condition.
    Box conditions close at the actual turn end; complete the paid search with the existing native controls.
    Distrans and Juice of Sapho conditions count an actual later printed use, not a particular recipient, transferred card or order outcome.
    Their native controls retain those choices. The deadline is the actual turn end, including for a whole No answer.
    Semuta Drug counts only after its native transfer and disposal complete after this answer.
    Committing to inspect multiple candidates, an earlier play or recovery alone does not count; the selected card is not promised.
    A committed private choice cannot be canceled. The condition, including a whole No answer, has the actual turn-end deadline.
    Ornithopter counts its actual physical flight declaration after this answer, when the card enters its played zone.
    Later groups and disposal do not count again. This condition closes at your own Movement turn end; it names no flight mode or destination.
    Residual Poison counts the actual printed play, random leader death and disposal after this answer, not a selected victim.
    Its deadline, including for a whole No answer, is the original turn end. Earlier play, disposal or recovery alone does not count.
    Weather Control, Family Atomics and Harvester conditions count an actual accepted future printed-role play after this answer
    in the original open Storm or fresh spice-blow window. Earlier plays, disposal, other roles and recovery alone do not count.
    They do not ask for a selected storm distance or resulting spice amount. Each condition closes only when its original native window closes.
    A current-lot Karama condition requires spending a printed Karama for this original ordinary lot, through immediate purchase
    or its winning invoice. Other Karama roles, Worthless conversion and a successful bid alone do not count.
    Recovery alone does not count. This condition closes with the original ordinary lot.
    A shipment-price Karama condition requires spending a printed Karama to grant the named active recipient this original
    unused native shipment price. The giver may be another player. The price grant counts separately from an actual force shipment;
    it does not require the recipient to ship forces. Other roles, Worthless conversion and recovery alone do not count.
    This condition closes when that original shipment-price opportunity ends.
    A battle-cancellation Karama condition concerns the actual current Voice or Prescience response in its named battle.
    Only spending a physical printed Karama to cancel that declaration after this answer counts.
    Passing, another Karama role, Worthless conversion and a different battle or response do not count.
    The condition closes when the original response ends; another player&apos;s cancellation can end the opportunity.
    Thumper conditions count an actual accepted future printed play before this turn&apos;s original first spice reveal.
    Earlier plays, disposal, other roles and recovery alone do not count. A later reveal is a different opportunity.
    This condition closes when the actual first spice draw begins.
    Amal conditions count an actual accepted future printed play in this original phase opening.
    Earlier plays, disposal, other roles and recovery alone do not count. The condition closes with this opening.
    Amal halves available cash before ordinary payments become legal; preserve enough remaining cash for any payment condition.
    Shipment conditions concern the single future original reserve shipment after the answer. Choose any sector or one exact printed sector;
    a different sector in the same territory does not satisfy an exact-sector condition.
    Ground-movement conditions use the maximum physical forces in one actual future move to that destination and optional exact sector; smaller moves never add together.
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
    if (windowCardOpportunity(game, 'karamaBattleCancel') && (action.kind !== 'windowCardPlay' || action.effect !== 'karamaBattleCancel'))
      throw new Error('During this response, choose only a printed Karama cancellation of the current Voice or Prescience; current facts may still be combined.');
    if (action.kind === 'stormDial' && !nativeStormDialOpportunity(game, target, action.source))
      throw new Error('Choose the respondent’s still-unsubmitted current Storm dial.');
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
    if (action.kind === 'windowCardPlay') {
      const opportunity = action.effect === 'karamaBattleCancel' ? battleCancelOpportunity(game, target)
        : windowCardOpportunity(game, action.effect);
      if (!opportunity || opportunity.turn !== game.turn || action.source !== opportunity.source)
        throw new Error('Choose an original current native window for this printed role, including an eligible battle response.');
    }
    return action;
  },
  renderAction: ({ value, id, game, target, disabled, onChange }) => {
    const choices = recipients(game, target), leaderChoices = leaders(game, target), lot = currentLot(game), partnerChoices = partners(game, target);
    const currentPower = value.kind === 'battlePower' ? powerOpportunity(game, target, value.claim) : null;
    const currentWindow = value.kind === 'windowCardPlay'
      ? value.effect === 'karamaBattleCancel' ? battleCancelOpportunity(game, target) : windowCardOpportunity(game, value.effect)
      : null;
    return <>
      <label htmlFor={`${id}-action`}>Future action</label>
      <select id={`${id}-action`} value={value.kind} disabled={disabled} onChange={event => {
        const kind = event.currentTarget.value;
        if (kind === value.kind) return;
        const minimum = 'minimum' in value ? value.minimum : 1;
        if (kind === 'stormDial') {
          const opportunity = nativeStormDialOpportunity(game, target);
          onChange({ kind, source: opportunity?.source ?? '', value: opportunity?.min ?? 0 });
        }
        if (kind === 'cardPlay') onChange({ kind, effect: 'hajr' });
        if (kind === 'windowCardPlay') {
          const effect = battleCancelOpportunity(game, target) ? 'karamaBattleCancel'
            : windowCardOpportunity(game, 'amal') ? 'amal'
            : WINDOW_CARD_EFFECTS.find(effect => effect !== 'karamaBattleCancel' && windowCardOpportunity(game, effect)) ?? 'weather';
          onChange({ kind, effect, source: windowCardOpportunity(game, effect)?.source ?? '' });
        }
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
        <option value="stormDial">Compare your value in this current Storm dial</option>
        <option value="cardPlay">Use a named printed card role after this answer</option>
        <option value="windowCardPlay">Use a printed card in this original native window or shipment-price opportunity</option>
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
      {value.kind === 'stormDial' ? (() => {
        const opportunity = nativeStormDialOpportunity(game, target, value.source);
        return <>
          <p className="fine">The respondent’s original current Storm dial counts once. Other dials remain sealed until reveal.</p>
          <label htmlFor={`${id}-storm-dial-compare`}>Storm dial comparison</label>
          <select id={`${id}-storm-dial-compare`} value={value.compare ?? 'eq'} disabled={disabled}
            onChange={event => {
              const compare = event.currentTarget.value;
              if (compare === 'eq' || compare === 'gte' || compare === 'lte')
                onChange({ ...value, compare });
            }}>
            <option value="eq">Exactly</option>
            <option value="gte">At least</option>
            <option value="lte">At most</option>
          </select>
          <label htmlFor={`${id}-storm-dial-value`}>Storm dial value</label>
          <Input id={`${id}-storm-dial-value`} type="number" min={opportunity?.min ?? (game.turn === 1 ? 0 : 1)}
            max={opportunity?.max ?? (game.turn === 1 ? 20 : 3)} step={1} required disabled={disabled}
            value={Number.isFinite(value.value) ? value.value : ''}
            aria-invalid={!opportunity || !Number.isSafeInteger(value.value) || value.value < opportunity.min || value.value > opportunity.max}
            onChange={event => onChange({ ...value, value: event.currentTarget.valueAsNumber })} />
          {!opportunity && <p className="fine">Choose a still-unsubmitted dialer in this current Storm.</p>}
        </>;
      })() : value.kind === 'cardPlay' ? <>
        <label htmlFor={`${id}-effect`}>Printed card role after this answer</label>
        <select id={`${id}-effect`} value={value.effect} disabled={disabled}
          aria-invalid={!['hajr', 'ghola', 'nullentropyBox', 'distrans', 'juiceOfSapho', 'semutaDrug', 'ornithopter', 'residualPoison'].includes(value.effect)} onChange={event => {
            const effect = event.currentTarget.value;
            if (effect === 'hajr' || effect === 'ghola' || effect === 'nullentropyBox' || effect === 'distrans' || effect === 'juiceOfSapho' || effect === 'semutaDrug' || effect === 'ornithopter' || effect === 'residualPoison') onChange({ kind: 'cardPlay', effect });
          }}>
          <option value="hajr">Play Hajr in its printed role after this answer this turn</option>
          <option value="ghola">Play Tleilaxu Ghola in its printed role after this answer this turn</option>
          <option value="nullentropyBox">Activate Nullentropy Box and pay 2 spice after this answer this turn</option>
          <option value="distrans">Play Distrans in its printed role after this answer this turn</option>
          <option value="juiceOfSapho">Play Juice of Sapho in its printed role after this answer this turn</option>
          <option value="semutaDrug">Complete a printed Semuta Drug transfer and disposal after this answer this turn</option>
          <option value="ornithopter">Declare a physical Ornithopter flight after this answer this turn</option>
          <option value="residualPoison">Complete a printed Residual Poison play after this answer this turn</option>
        </select>
      </> : value.kind === 'windowCardPlay' ? <>
        <label htmlFor={`${id}-window-effect`}>Printed role in the original window</label>
        <select id={`${id}-window-effect`} value={WINDOW_CARD_EFFECTS.includes(value.effect) ? value.effect : ''}
          disabled={disabled} aria-invalid={!WINDOW_CARD_EFFECTS.includes(value.effect)} onChange={event => {
            const effect = event.currentTarget.value;
            if (effect === 'weather' || effect === 'atomics' || effect === 'harvester' || effect === 'karamaAuction' || effect === 'karamaShipment' || effect === 'karamaBattleCancel' || effect === 'thumper' || effect === 'amal')
              onChange({ kind: 'windowCardPlay', effect, source: (effect === 'karamaBattleCancel'
                ? battleCancelOpportunity(game, target) : windowCardOpportunity(game, effect))?.source ?? '' });
          }}>
          <option value="">Choose a printed role</option>
          {WINDOW_CARD_EFFECTS.filter(effect => effect !== 'karamaBattleCancel' || !!battleCancelOpportunity(game, target) || value.effect === effect)
            .map(effect => <option key={effect} value={effect}>{windowRoleNames[effect]}</option>)}
        </select>
        <label htmlFor={`${id}-window-source`}>Original native window</label>
        <select id={`${id}-window-source`} value={currentWindow?.source === value.source ? value.source : ''}
          disabled={disabled} aria-invalid={!currentWindow || currentWindow.source !== value.source} onChange={event => {
            const opportunity = value.effect === 'karamaBattleCancel' ? battleCancelOpportunity(game, target)
              : windowCardOpportunity(game, value.effect);
            if (event.currentTarget.value === '') onChange({ ...value, source: '' });
            else if (opportunity?.source === event.currentTarget.value) onChange({ ...value, source: opportunity.source });
          }}>
          <option value="">Choose the original open window</option>
          {currentWindow && <option value={currentWindow.source}>{value.effect === 'harvester'
            ? `Turn ${currentWindow.turn} · Fresh spice blow in ${game.combatLocations.find(location => location.id === game.spiceWindow?.territory)?.name ?? game.spiceWindow?.territory}`
            : value.effect === 'karamaAuction' ? `Turn ${currentWindow.turn} · Ordinary lot ${game.bidPromiseLot?.lot}`
              : value.effect === 'thumper' ? `Turn ${currentWindow.turn} · Before the original first spice reveal`
              : value.effect === 'amal' ? `Turn ${currentWindow.turn} · Original ${PHASES[game.phase]} opening`
              : value.effect === 'karamaBattleCancel' ? `Turn ${currentWindow.turn} · ${game.response?.kind === 'voice' ? 'Voice' : 'Prescience'} declared by ${game.players.find(player => player.id === game.response?.owner)?.name ?? game.response?.owner} · ${game.combatLocations.find(location => location.id === game.battle?.territory)?.name ?? game.battle?.territory}`
              : currentWindow.effect === 'karamaShipment' ? `Turn ${currentWindow.turn} · ${game.players.find(player => player.id === currentWindow.recipient)?.name ?? currentWindow.recipient}’s current native shipment price`
              : `Turn ${currentWindow.turn} · Before this Storm movement`}</option>}
        </select>
        {!currentWindow && <p className="fine">This printed role has no current original open native window.</p>}
        {value.effect === 'thumper' && game.turn === 1 && <p className="notice">On turn 1, playing Thumper still discards the card,
          but its worm encounter is ignored and the normal Spice Card draw continues.</p>}
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
          onChange={event => {
            const destination = event.currentTarget.value;
            // An exact sector belongs to its printed territory. Selecting a
            // different territory returns to the explicit any-sector choice.
            onChange({ kind: value.kind, territory: destination, minimum: value.minimum });
          }}>
          <option value="">Choose a printed Arrakis territory</option>
          {TERRITORIES.map(destination => <option key={destination.id} value={destination.id}>{destination.name}</option>)}
        </select>
        {(value.kind === 'ship' || value.kind === 'move') && (() => {
          const printed = TERRITORIES.find(destination => destination.id === value.territory);
          return <>
            <label htmlFor={`${id}-sector`}>{value.kind === 'ship' ? 'Shipment sector' : 'Ground-movement sector'}</label>
            <select id={`${id}-sector`} disabled={disabled} value={value.sector === undefined ? '' : String(value.sector)}
              aria-invalid={value.sector !== undefined && !printed?.sectors.includes(value.sector)} onChange={event => {
                const chosen = event.currentTarget.value;
                if (chosen === '') onChange({ kind: value.kind, territory: value.territory, minimum: value.minimum });
                else {
                  const sector = Number(chosen);
                  if (printed?.sectors.includes(sector)) onChange({ ...value, sector });
                }
              }}>
              <option value="">Any sector in this territory</option>
              {printed?.sectors.map(sector => <option key={sector} value={sector}>Sector {sector}</option>)}
            </select>
          </>;
        })()}
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
