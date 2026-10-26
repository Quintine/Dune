'use client';
import { MovementClaimFields } from './movement-claim-fields';
import { AllianceClaimFields, allianceClaimInputError } from './alliance-claim-fields';
import type { AllianceClaim } from '@/game/alliance-promises';
import { BribeClaimFields, bribeClaimInputError } from './bribe-claim-fields';
import type { BribeClaim } from '@/game/bribe-promises';
import { RevivalClaimFields, revivalClaimInputError } from './revival-claim-fields';
import type { RevivalClaim } from '@/game/revival-promises';
import { BidClaimFields, bidClaimInputError } from './bid-claim-fields';
import type { BidClaim } from '@/game/bid-promises';
import { TraitorDecisionAnswers } from './traitor-decision-promises';
import { validMovementClaim, type MovementClaim } from '@/game/movement-promises';
import { TruthShipmentQuestion } from './truth-shipment-question';
import { TruthBattlePlanQuestion } from './truth-battle-plan-question';
import type { ShipmentExpression } from '@/game/shipment-promises';
import {
  MixedShipmentFields,
  mixedShipmentInputError,
} from './mixed-shipment-fields';
import { TruthFactQuestion } from './truth-fact-question';
import type { MixedShipmentExpression } from '@/game/mixed-shipment-question';
import type { PlanClaim } from '@/game/battle-promises';
import { useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { CHEAP_HERO_TRAITOR } from '@/game/traitors';
import {
  truthQuestionText,
  type TruthFact,
  type TruthQuestion,
} from '@/game/truthtrance';
import type { Action, GameView } from '@/game/engine';
import { canUseAsTruthtranceRole } from '@/game/shrine';

export function Truthtrance({
  game: g,
  act,
  busy,
}: {
  game: GameView;
  act: (a: Action) => void;
  busy: boolean;
}) {
  const w = g.truthtrance!;
  const me = g.players.find((p) => p.id === g.me)!;
  const current = w.queue[0];
  const truthCards =
    me.hand?.filter((card) => canUseAsTruthtranceRole(g, me, card)) ?? [];
  const declaration = (cards: typeof truthCards): Action => ({
    type: 'card',
    card: cards[0].id,
    ...(cards.length > 1 ? { cards: cards.slice(1).map((card) => card.id) } : {}),
    ...(cards.some((card) => card.effect === 'karama')
      ? {
          shrineTruthtrance: cards
            .filter((card) => card.effect === 'karama')
            .map((card) => card.id),
        }
      : {}),
  });
  const [target, setTarget] = useState(
    g.players.find((p) => p.id !== me.id)!.id,
  );
  const [kind, setKind] = useState<
    'fact' | 'freeform' | 'battlePlan' | 'shipment' | 'mixedShipment' | 'movement' | 'traitorCall' | 'bid' | 'revival' | 'bribe' | 'alliance'
  >('fact');
  const [alliancePartner, setAlliancePartner] = useState(g.me);
  const allianceClaim: AllianceClaim = { turn: g.turn, partner: alliancePartner };
  const alliancePartners = g.players.filter(player => player.id !== target);
  const [bribeSelection, setBribeSelection] = useState<Pick<BribeClaim, 'recipient' | 'minimum'>>({ recipient: g.me, minimum: 3 });
  const bribeClaim: BribeClaim = { turn: g.turn, ...bribeSelection };
  const bribeRespondent = g.players.find(player => player.id === target);
  const bribeRecipients = g.players.filter(player => player.id !== target && player.id !== bribeRespondent?.ally);
  const [revivalSelection, setRevivalSelection] = useState<Pick<RevivalClaim, 'counter' | 'minimum'>>({ counter: 'total', minimum: 1 });
  const revivalClaim: RevivalClaim = { turn: g.turn, ...revivalSelection };
  const [bidMinimum, setBidMinimum] = useState(1);
  const bidClaim: BidClaim = { turn: g.bidPromiseLot?.turn ?? g.turn,
    lot: g.bidPromiseLot?.lot ?? 1, minimum: bidMinimum };
  const [movement, setMovement] = useState<MovementClaim>({ territory: 'carthag', minimum: 6 });
  const [shipment, setShipment] = useState<ShipmentExpression>({ territory: 'carthag', minimum: 6 });
  const [mixed, setMixed] = useState<MixedShipmentExpression>({
    kind: 'and',
    terms: [
      { kind: 'fact', fact: { kind: 'hand', name: 'Shield' } },
      { kind: 'shipment', territory: 'carthag', minimum: 6 },
    ],
  });
  const invalidMixed = mixedShipmentInputError(mixed, g, target);
  const shipmentAvailable = g.truthShipmentTargets.includes(target);
  const [planClaim, setPlanClaim] = useState<PlanClaim>({ kind: 'dial', compare: 'gte', value: 1 });
  const [scope, setScope] = useState<'fact' | 'currentTurn'>('fact');
  const [text, setText] = useState('');
  const [fact, setFact] = useState<TruthFact>({ kind: 'hand', name: 'Shield' });
  const factId = useId();
  const leaderName = (id: string) =>
    id === CHEAP_HERO_TRAITOR
      ? 'Cheap Hero / Heroine'
      : (g.allLeaders.find((l) => l.id === id)?.name ?? id);
  const name = (id: string) => g.players.find((p) => p.id === id)!.name;
  const locationName = (id: string) => g.combatLocations.find(place => place.id === id)!.name;
  const question: TruthQuestion =
    kind === 'fact'
      ? {
          kind,
          target,
          fact,
        }
      : kind === 'battlePlan'
        ? {
            kind,
            target,
            territory: g.battle?.territory ?? '',
            claim: planClaim,
          }
        : kind === 'traitorCall' ? { kind, target, battle: g.battle?.event ?? '', territory: g.battle?.territory ?? '' }
        : kind === 'movement' ? { kind, target, ...movement }
        : kind === 'alliance' ? { kind, target, ...allianceClaim }
        : kind === 'bribe' ? { kind, target, ...bribeClaim }
        : kind === 'revival' ? { kind, target, ...revivalClaim }
        : kind === 'bid' ? { kind, target, ...bidClaim }
        : kind === 'shipment'
          ? {
              kind,
              target,
              claim: shipment,
            }
          : kind === 'mixedShipment'
            ? { kind, target, mixed }
            : { kind, target, text, scope };
  const button = (label: string, action: Action, disabled = false) => (
    <Button
      className="game-action"
      disabled={busy || disabled}
      onClick={() => act(action)}
    >
      {label}
    </Button>
  );
  return (
    <section className="truthtrance-panel" aria-label="Truthtrance question">
      <h2>Truthtrance</h2>
      <p className="fine">
        <a href="/rules#card-truthtrance">Question rules</a> · The table
        resumes its previous decision after these questions.
      </p>
      {w.stage === 'priority' ? (
        <>
          <p>
            A Truthtrance has been declared. Declare yours now or pass;
            questions then follow storm order.
          </p>
          <ul>
            {g.players.map((p) => (
              <li key={p.id}>
                {p.name} ·{' '}
                {w.queue.some((q) => q.player === p.id)
                  ? 'Declared'
                  : w.passed.includes(p.id)
                    ? 'Passed'
                    : 'Choosing'}
              </li>
            ))}
          </ul>
          {!w.passed.includes(me.id) && (
            <>
              {truthCards.map((c) => (
                  <div key={c.id}>
                    {button(
                      c.effect === 'karama'
                        ? 'Use my Karama as Truthtrance'
                        : 'Declare my Truthtrance',
                      declaration([c]),
                    )}
                  </div>
                ))}
              {truthCards.length > 1 &&
                button(
                  `Declare all ${truthCards.length} as Truthtrance`,
                  declaration(truthCards),
                )}
              {button('Pass Truthtrance priority', { type: 'truthPass' })}
            </>
          )}
        </>
      ) : (
        <>
          <p className="eyebrow">
            {name(current.player)} holds the question · {w.queue.length} pending
          </p>
          {w.question && (
            <blockquote>
              <p>{truthQuestionText(w.question, leaderName, locationName, name)}</p>
              <p className="fine">Asked of {name(w.question.target)}</p>
            </blockquote>
          )}
          {w.stage === 'answer' ? (
            w.question!.target === me.id ? (
              <>
                <p>
                  Your answer is public. Answer truthfully about the game; a
                  promise can only bind decisions in this turn.
                </p>
                {w.question!.kind === 'shipment' || w.question!.kind === 'mixedShipment' ? (
                  <>
                    <p className="notice">
                      A definite answer binds the whole claim about your
                      shipment from reserves this turn. Any current facts are
                      fixed privately when you answer; they create no later
                      card, spice or force holding obligation. Available
                      preparation includes your Ghola, Karama and recoverable
                      allied funding. Count, sector and payment remain yours
                      to choose while honoring the whole claim. AND requires
                      all conditions; OR requires at least one. No makes the
                      whole claim false. A Yes answer may allow skipping
                      shipment if a current-fact branch already satisfies it.
                    </p>
                    {(g.truthShipmentAnswers ?? []).map((answer) => (
                      <div key={answer}>
                        {button(
                          answer === 'unknown'
                            ? 'I don’t know yet'
                            : `Answer ${answer === 'yes' ? 'Yes' : 'No'}`,
                          { type: 'truthAnswer', answer },
                        )}
                      </div>
                    ))}
                  </>
                ) : w.question!.kind === 'alliance' ? (
                  <>
                    <p className="notice">This answer concerns actual membership when this Nexus closes. An offer alone does not form an alliance. Yes remains binding after formation; No requires ending without this named partner. Consent that is not yet available may be unknown, letting the holder ask again or save the card.</p>
                    {(g.truthAllianceAnswers ?? []).map(answer => <div key={answer}>
                      {button(answer === 'unknown' ? 'I don’t know yet' : `Answer ${answer === 'yes' ? 'Yes' : 'No'}`, { type: 'truthAnswer', answer })}
                    </div>)}
                  </>
                ) : w.question!.kind === 'bribe' ? (
                  <>
                    <p className="notice">Yes requires cumulative ordinary bribe payments to this named recipient while possible. No keeps all later payments below the minimum. Earlier payments, gifts and allied aid do not count. You pay now; the recipient spends the receipt at Mentat Pause.</p>
                    {(g.truthBribeAnswers ?? []).map(answer => <div key={answer}>
                      {button(`Answer ${answer === 'yes' ? 'Yes' : answer === 'no' ? 'No' : 'I don’t know'}`, { type: 'truthAnswer', answer })}
                    </div>)}
                  </>
                ) : w.question!.kind === 'revival' ? (
                  <>
                    <p className="notice">Yes requires the chosen total of future ordinary force returns while possible. No forbids reaching that total, including split requests. Only completed returns after this answer count. Keep the original revival funding and finish all remaining Yes answers before ending Revival.</p>
                    {(g.truthRevivalAnswers ?? []).map(answer => <div key={answer}>
                      {button(`Answer ${answer === 'yes' ? 'Yes' : answer === 'no' ? 'No' : 'I don’t know'}`, { type: 'truthAnswer', answer })}
                    </div>)}
                  </>
                ) : w.question!.kind === 'bid' ? (
                  <>
                    <p className="notice">Yes requires one qualifying bid in this ordinary lot while possible. No forbids qualifying bids until it closes. A bid does not promise a win; winning still requires the original payment. Keep the funding needed by your answer.</p>
                    {(g.truthBidAnswers ?? []).map(answer => <div key={answer}>
                      {button(`Answer ${answer === 'yes' ? 'Yes' : answer === 'no' ? 'No' : 'I don’t know'}`, { type: 'truthAnswer', answer })}
                    </div>)}
                  </>
                ) : w.question!.kind === 'movement' ? (
                  <>
                    <p className="notice">Yes requires one matching ground movement before your turn ends, while possible. No forbids every matching move through later Hajr or Ornithopter opportunities. Separate smaller groups do not add together. The No-Field marker itself is not a physical force counter.</p>
                    {(g.truthMovementAnswers ?? []).map(answer => (
                      <div key={answer}>{button(answer === 'unknown' ? 'I don’t know yet' : `Answer ${answer === 'yes' ? 'Yes' : 'No'}`, { type: 'truthAnswer', answer })}</div>
                    ))}
                  </>
                ) : w.question!.kind === 'traitorCall' ? (
                  <TraitorDecisionAnswers game={g} act={act} busy={busy} />
                ) : w.question!.kind === 'battlePlan' ? (
                  <>
                    <p className="notice">
                      Choose an answer you can honor in a legal plan, including
                      available Ghola preparation. Earlier Truthtrance answers,
                      Voice and revealed prescience elements apply. An answer
                      about a sealed plan is already fixed.
                    </p>
                    {(g.truthBattleAnswers ?? []).map((answer) => (
                      <div key={answer}>
                        {button(
                          answer === 'unknown'
                            ? 'I don’t know yet'
                            : `Answer ${answer === 'yes' ? 'Yes' : 'No'}`,
                          { type: 'truthAnswer', answer },
                        )}
                      </div>
                    ))}
                    <p className="fine">
                      A definite answer constrains your plan. Other plan
                      elements remain yours to choose.
                    </p>
                  </>
                ) : w.question!.kind === 'fact' ? (
                  <>
                    <p className="notice">
                      Your current game information establishes:{' '}
                      <strong>
                        {g.truthAnswer === 'unknown'
                          ? 'I don’t know yet'
                          : g.truthAnswer === 'yes'
                            ? 'Yes'
                            : 'No'}
                      </strong>
                      . Only you see this until you answer.
                    </p>
                    {button('Publish my answer', {
                      type: 'truthAnswer',
                      answer: g.truthAnswer,
                    })}
                  </>
                ) : (
                  <>
                    {button('Answer Yes', {
                      type: 'truthAnswer',
                      answer: 'yes',
                    })}
                    {button('Answer No', { type: 'truthAnswer', answer: 'no' })}
                    {button('I don’t know', {
                      type: 'truthAnswer',
                      answer: 'unknown',
                    })}
                    <p className="fine">
                      Use “I don’t know” for something you cannot know or
                      decide. The holder can ask a different question or save
                      the card.
                    </p>
                  </>
                )}
              </>
            ) : (
              <output>Waiting for {name(w.question!.target)} to answer.</output>
            )
          ) : current.player !== me.id ? (
            <output>
              Waiting for {name(current.player)} to{' '}
              {w.stage === 'unknown'
                ? 'ask again or save the card'
                : 'ask a question'}
              .
            </output>
          ) : (
            <>
              {w.stage === 'unknown' && (
                <>
                  <p>
                    The answer could not be known. Ask a different question or
                    keep Truthtrance for later.
                  </p>
                  {button('Save card for later', { type: 'truthSave' })}
                </>
              )}
              <label>
                Ask which player?
                <select
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                >
                  {g.players
                    .filter((p) => p.id !== me.id)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                        {p.bot ? ' · AI' : ''}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Question type
                <select
                  value={kind}
                  onChange={(e) => setKind(e.target.value as typeof kind)}
                >
                  <option value="fact">
                    Verified current facts
                  </option>
                  <option value="movement">Bind ground movement this turn</option>
                  <option value="alliance">Bind alliance membership at this Nexus close</option>
                  <option value="bribe">Bind ordinary bribe payments this turn</option>
                  <option value="revival">Bind ordinary force revivals this turn</option>
                  <option value="bid">Bind a bid in this ordinary lot</option>
                  <option value="traitorCall">Bind this battle’s Traitor declaration</option>
                  <option value="shipment">
                    Bind a shipment from reserves
                  </option>
                  <option value="mixedShipment">
                    Combine current facts and this-turn shipment
                  </option>
                  <option value="freeform">Write a game question</option>
                  {g.battle && (
                    <option value="battlePlan">
                      Bind a battle-plan choice
                    </option>
                  )}
                </select>
              </label>
              {kind === 'alliance' ? (
                <>
                  <AllianceClaimFields value={allianceClaim} partners={alliancePartners} disabled={busy || !g.truthAllianceTargets.includes(target)}
                    onChange={claim => setAlliancePartner(claim.partner)} />
                  <p className="fine">The final actual partnership in the current ordinary Nexus is binding. Yes uses an already held partnership or an actual incoming invitation the respondent can accept; another player’s future consent is not invented. No may require breaking a temporary alliance before readiness.</p>
                  {!g.truthAllianceTargets.includes(target) && <p className="notice">Choose a supported participant in a quiet open ordinary Nexus. Optional modules and broader alliance questions remain unfinished.</p>}
                  <p className="notice" aria-label="Public alliance question preview">{truthQuestionText(question, leaderName, locationName, name)}</p>
                </>
              ) : kind === 'bribe' ? (
                <>
                  <BribeClaimFields value={bribeClaim} recipients={bribeRecipients} disabled={busy || !g.truthBribeTargets.includes(target)}
                    onChange={claim => setBribeSelection({ recipient: claim.recipient, minimum: claim.minimum })} />
                  <p className="fine">Count cumulative ordinary payer payments after this answer, before this turn ends. Keep the current spendable spice needed by every Yes. Actual bribe timing and deferred recipient receipts remain; optional modules and future-income preparation remain unfinished.</p>
                  {!g.truthBribeTargets.includes(target) && <p className="notice">Choose a supported participant before Mentat Pause and finish pending decisions.</p>}
                  <p className="notice" aria-label="Public bribe question preview">{truthQuestionText(question, leaderName, locationName, name)}</p>
                </>
              ) : kind === 'revival' ? (
                <>
                  <RevivalClaimFields value={revivalClaim} disabled={busy || !g.truthRevivalTargets.includes(target)}
                    onChange={claim => setRevivalSelection({ counter: claim.counter, minimum: claim.minimum })} />
                  {g.phase < 4 && <p className="notice">Revival comes later this turn. Keep its required funding; actual Charity or an owned auction payment may prepare the return. Unknown future draws, gifts and casualties are not assumed.</p>}
                  <p className="fine">Count physical total, normal or elite counters returned by ordinary native Revival after the answer. Smaller requests add together. Earlier returns, Ghola, Emperor-funded extras and other special returns do not count. Current native limits, prices and response choices remain.</p>
                  {!g.truthRevivalTargets.includes(target) && <p className="notice">Choose a respondent whose native Revival opportunity remains this turn and finish pending decisions. Registered native Basic and Advanced tables without optional modules are supported first.</p>}
                  <p className="notice" aria-label="Public revival question preview">{truthQuestionText(question, leaderName, locationName, name)}</p>
                </>
              ) : kind === 'bid' ? (
                <>
                  <BidClaimFields value={bidClaim} disabled={busy || !g.bidPromiseLot}
                    onChange={claim => setBidMinimum(claim.minimum)} />
                  <p className="fine">One accepted bid from now until this lot closes. Earlier bids do not count. A larger opposing bid may make Yes impossible; your own pass, lower bid or voluntary spending cannot evade it.</p>
                  {!g.truthBidTargets.includes(target) && <p className="notice">Choose a bidder with an unused opportunity in the current ordinary lot and finish pending decisions. Registered native Basic and Advanced tables without optional modules are supported; other auctions and module compositions remain unfinished.</p>}
                  <p className="notice" aria-label="Public bid question preview">{truthQuestionText(question, leaderName, locationName, name)}</p>
                </>
              ) : kind === 'traitorCall' ? (
                <>
                  <p className="notice">Choose a still-unsubmitted voter in the current revealed battle. A definite answer binds that player’s original declaration, without reopening any sealed vote or promising that a later response will allow it.</p>
                  {!g.truthTraitorTargets.includes(target) && <p>Reveal both plans and choose a voter who has not submitted their Traitor decision.</p>}
                  {g.battle?.revealed && <p className="notice" aria-label="Public Traitor question preview">{truthQuestionText(question, leaderName, locationName, name)}</p>}
                </>
              ) : kind === 'movement' ? (
                <>
                  <MovementClaimFields id={`${factId}-movement`} value={movement} onChange={setMovement} />
                  <p className="fine">One ground movement of the chosen physical minimum, from now until the respondent’s Movement turn ends. Shipment, HMS relocation and Ambassador relocation do not count. Owned Hajr, Ornithopter, native Kulon and paid Box recovery of a known discard can prepare a later move. No stays binding after earlier nonmatching moves.</p>
                  {g.phase < 5 && <p className="notice">Movement comes later this round. Keep the forces, spice and cards needed by your answer; available Charity, your own CHOAM opening income or Revival may prepare the route. Current auction commitments reserve their actual funding. Current preparation appears when it is available.</p>}
                  {g.advanced && <p className="fine">Advanced movement counts physical forces, including each elite once. Hajr remains available only immediately after a completed movement and its required arrival decisions.</p>}
                  <p className="fine">An owned No-Field may prepare a route through its normal shipment, movement or voluntary reveal. The concealed marker does not count toward the promised physical minimum; revelation uses only available reserves.</p>
                  {!g.truthMovementTargets.includes(target) && <p className="notice">Choose a supported Basic or Advanced respondent with declared native families and an unused turn this round, and finish pending decisions. Optional modules remain unfinished.</p>}
                  <p className="notice" aria-label="Public movement question preview">{truthQuestionText(question, leaderName, locationName, name)}</p>
                </>
              ) : kind === 'shipment' || kind === 'mixedShipment' ? (

                <>
                  {kind === 'mixedShipment' ? (
                    <MixedShipmentFields id={`${factId}-mixed`} value={mixed}
                      game={g} target={target} disabled={busy} onChange={setMixed} />
                  ) : question.kind === 'shipment' && (
                    <TruthShipmentQuestion game={g} question={question} busy={busy}
                      act={act} onChange={setShipment} />
                  )}
                  <p className="fine">
                    Includes Fremen reinforcements and Guild transport from
                    southern reserves. Ground movement and transport of forces
                    already on the board do not count.
                    {' '}Guild interception and Karama rate responses resolve
                    before delivery. A stopped shipment can release an
                    impossible answer; an unfinished response does not fulfill it.
                  </p>
                  {g.phase < 5 && <p className="notice">Your shipment comes later this turn. Answers use the current board and preparations you can make yourself. A change outside your control can release an answer that becomes impossible. Keep playing the current phase; shipping waits for your turn.</p>}
                  {!shipmentAvailable && (
                    <p className="notice">
                      Automatic enforcement supports a later shipment this turn
                      under Basic or Advanced rules with selected native faction
                      decks and no optional modules, including the Guild. Active
                      or waiting turns are eligible during Shipment and Movement;
                      existing optional profiles retain their separate scope. Select
                      an eligible player and finish pending decisions first.
                      Native No-Field shipments and other rules configurations
                      remain unfinished.
                    </p>
                  )}
                  {kind === 'mixedShipment' && <p className="notice" aria-label="Public grouped question preview">
                    {invalidMixed ?? truthQuestionText(question, leaderName, locationName, name)}
                  </p>}
                </>
              ) : kind === 'battlePlan' ? (
                question.kind === 'battlePlan' && (
                  <TruthBattlePlanQuestion game={g} question={question} busy={busy}
                    act={act} onChange={setPlanClaim} />
                )
              ) : kind === 'fact' ? (
                question.kind === 'fact' && (
                  <TruthFactQuestion game={g} question={question} busy={busy}
                    act={act} onChange={setFact} />
                )
              ) : (
                <>
                  <label>
                    Question concerns
                    <select
                      value={scope}
                      onChange={(e) => setScope(e.target.value as typeof scope)}
                    >
                      <option value="fact">A game fact</option>
                      <option value="currentTurn">
                        A promise during turn {g.turn}
                      </option>
                    </select>
                  </label>
                  <label>
                    One yes/no question
                    <textarea
                      rows={4}
                      maxLength={500}
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      placeholder="Will you ship at least six forces to Carthag this turn?"
                    />
                  </label>
                  <p className="notice">
                    Freeform answers rely on the players. Automatic checks for
                    arbitrary promises are unfinished. AI can answer structured
                    fact, supported shipment and battle-plan questions; it
                    cannot yet interpret freeform questions.
                  </p>
                </>
              )}
              {!['fact', 'battlePlan', 'shipment'].includes(kind) && button(
                'Ask publicly',
                { type: 'truthAsk', question },
                (kind === 'movement' && (!validMovementClaim(movement) || !g.truthMovementTargets.includes(target))) ||
                (kind === 'alliance' && (!!allianceClaimInputError(allianceClaim, alliancePartners) || !g.truthAllianceTargets.includes(target))) ||
                (kind === 'bribe' && (!!bribeClaimInputError(bribeClaim, bribeRecipients) || !g.truthBribeTargets.includes(target))) ||
                (kind === 'revival' && (!!revivalClaimInputError(revivalClaim) || !g.truthRevivalTargets.includes(target))) ||
                (kind === 'bid' && (!!bidClaimInputError(bidClaim) || !g.truthBidTargets.includes(target))) ||
                (kind === 'traitorCall' && !g.truthTraitorTargets.includes(target)) ||
                  (kind === 'mixedShipment' &&
                    (!!invalidMixed || !shipmentAvailable)) ||
                  (kind === 'freeform' && !text.trim()),
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}
export function TruthHistory({ game: g }: { game: GameView }) {
  const records = g.truthHistory.filter((r) => r.turn === g.turn);
  if (!records.length) return null;
  const name = (id: string) => g.players.find((p) => p.id === id)?.name ?? id;
  return (
    <details className="notice truthtrance-history">
      <summary>Truthtrance answers · Turn {g.turn}</summary>
      <p className="fine">
        Supported battle-plan, Nexus-alliance, bid, revival, bribe, movement and reserve-shipment
        answers are enforced. Current-turn freeform promises remain binding when possible,
        but their automatic enforcement is unfinished.
      </p>
      <ol>
        {records.map((r, i) => (
          <li key={i}>
            <p>
              {name(r.asker)} → {name(r.question.target)}:{' '}
              {truthQuestionText(r.question, (id) =>
                id === CHEAP_HERO_TRAITOR
                  ? 'Cheap Hero / Heroine'
                  : (g.allLeaders.find((l) => l.id === id)?.name ?? id),
                id => g.combatLocations.find(place => place.id === id)!.name,
                name,
              )}
            </p>
            <strong>
              {r.answer === 'unknown'
                ? 'I don’t know'
                : r.answer === 'yes'
                  ? 'Yes'
                  : 'No'}
            </strong>
          </li>
        ))}
      </ol>
    </details>
  );
}
