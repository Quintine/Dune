'use client';
import { ShipmentClaimFields, invalidShipmentClause, type ShipmentClauseInput } from './shipment-claim-fields';
import { BattleClaimFields } from './battle-promises';
import {
  MixedShipmentFields,
  TruthFactFields,
  invalidTruthFact,
  mixedShipmentInputError,
} from './mixed-shipment-fields';
import type { MixedShipmentExpression } from '@/game/mixed-shipment-question';
import type { PlanClaim } from '@/game/battle-promises';
import { useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { shipmentAvailable as targetShipmentAvailable } from '@/game/shipment-opportunity';
import { CHEAP_HERO_TRAITOR } from '@/game/traitors';
import { shipmentPromiseModeSupported } from '@/game/shipment-promises';
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
    'fact' | 'freeform' | 'battlePlan' | 'shipment' | 'mixedShipment'
  >('fact');
  const [shipmentJoin, setShipmentJoin] = useState<'single' | 'and' | 'or'>('single');
  const [shipmentClauses, setShipmentClauses] = useState<ShipmentClauseInput[]>([
    { territory: 'carthag', minimum: 6 },
    { territory: 'arrakeen', minimum: 4 },
  ]);
  const [mixed, setMixed] = useState<MixedShipmentExpression>({
    kind: 'and',
    terms: [
      { kind: 'fact', fact: { kind: 'hand', name: 'Shield' } },
      { kind: 'shipment', territory: 'carthag', minimum: 6 },
    ],
  });
  const invalidMixed = mixedShipmentInputError(mixed, g, target);
  const invalidShipment = shipmentClauses.slice(0, shipmentJoin === 'single' ? 1 : 2).some(invalidShipmentClause);
  const shipmentAvailable =
    shipmentPromiseModeSupported(g) &&
    g.phase === 5 &&
    g.active === target &&
    targetShipmentAvailable(g, {id:target,shipped:g.players.find(p => p.id === target)?.shipped ?? false}) &&
    !g.response &&
    !g.decision &&
    !g.phaseOpening;
  const [planClauses, setPlanClauses] = useState<PlanClaim[]>([
    { kind: 'dial', compare: 'gte', value: 1 },
    { kind: 'weapon', name: null },
  ]);
  const [scope, setScope] = useState<'fact' | 'currentTurn'>('fact');
  const [text, setText] = useState('');
  const [join, setJoin] = useState<'single' | 'and' | 'or'>('single');
  const [clauses, setClauses] = useState<TruthFact[]>([
    { kind: 'hand', name: 'Shield' },
    { kind: 'hand', name: 'Snooper' },
  ]);
  const factId = useId();
  const invalidFact = clauses
    .slice(0, join === 'single' ? 1 : 2)
    .some((fact) => invalidTruthFact(fact, g, target));
  const leaderName = (id: string) =>
    id === CHEAP_HERO_TRAITOR
      ? 'Cheap Hero / Heroine'
      : (g.allLeaders.find((l) => l.id === id)?.name ?? id);
  const name = (id: string) => g.players.find((p) => p.id === id)!.name;
  const question: TruthQuestion =
    kind === 'fact'
      ? {
          kind,
          target,
          fact: join === 'single' ? clauses[0] : { kind: join, terms: clauses },
        }
      : kind === 'battlePlan'
        ? {
            kind,
            target,
            territory: g.battle?.territory ?? '',
            claim:
              join === 'single'
                ? planClauses[0]
                : { kind: join, terms: planClauses },
          }
        : kind === 'shipment'
          ? {
              kind,
              target,
              ...(shipmentJoin === 'single' ? shipmentClauses[0] : { claim: { op: shipmentJoin, terms: shipmentClauses } }),
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
              <p>{truthQuestionText(w.question, leaderName)}</p>
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
              {kind === 'shipment' || kind === 'mixedShipment' ? (
                <>
                  {kind === 'mixedShipment' ? (
                    <MixedShipmentFields id={`${factId}-mixed`} value={mixed}
                      game={g} target={target} disabled={busy} onChange={setMixed} />
                  ) : (
                    <ShipmentClaimFields id={`${factId}-shipment`} clauses={shipmentClauses}
                      join={shipmentJoin} onClauses={setShipmentClauses} onJoin={setShipmentJoin} />
                  )}
                  <p className="fine">
                    Includes Fremen reinforcements and Guild transport from
                    southern reserves. Ground movement and transport of forces
                    already on the board do not count.
                  </p>
                  {!shipmentAvailable && (
                    <p className="notice">
                      Automatic enforcement currently supports the active
                      player’s unused shipment in base Basic games and base
                      Advanced games without Guild or optional modules. Select
                      that player and finish pending decisions first. Earlier
                      questions and other rules configurations remain
                      unfinished.
                    </p>
                  )}
                  <p className="notice" aria-label="Public grouped question preview">
                    {kind === 'mixedShipment'
                      ? invalidMixed ?? truthQuestionText(question, leaderName)
                      : invalidShipment
                        ? 'Enter a whole minimum of one to twenty forces.'
                        : truthQuestionText(question, leaderName)}
                  </p>
                </>
              ) : kind === 'battlePlan' ? (
                <>
                  <label>
                    Combine conditions
                    <select
                      value={join}
                      onChange={(e) => setJoin(e.target.value as typeof join)}
                    >
                      <option value="single">One condition</option>
                      <option value="and">Both · AND</option>
                      <option value="or">Either · OR</option>
                    </select>
                  </label>
                  {planClauses
                    .slice(0, join === 'single' ? 1 : 2)
                    .map((c, index) => (
                      <fieldset key={index}>
                        <legend>Condition {index + 1}</legend>
                        <BattleClaimFields
                          game={g}
                          value={c}
                          onChange={(next) =>
                            setPlanClauses(
                              planClauses.map((old, n) =>
                                n === index ? next : old,
                              ),
                            )
                          }
                        />
                      </fieldset>
                    ))}
                  <p className="notice">
                    {truthQuestionText(question, leaderName)}
                  </p>
                  {g.battle &&
                    ![g.battle.attacker, g.battle.defender].includes(
                      target,
                    ) && <p>Select one of the combatants for this question.</p>}
                </>
              ) : kind === 'fact' ? (
                <>
                  <label>
                    Combine facts
                    <select
                      value={join}
                      onChange={(e) => setJoin(e.target.value as typeof join)}
                    >
                      <option value="single">One fact</option>
                      <option value="and">Both facts · AND</option>
                      <option value="or">Either fact · OR</option>
                    </select>
                  </label>
                  {clauses
                    .slice(0, join === 'single' ? 1 : 2)
                    .map((c, index) => (
                      <fieldset key={index}>
                        <legend>Fact {index + 1}</legend>
                        <TruthFactFields value={c} game={g} target={target}
                          onChange={next => setClauses(clauses.map((old, n) => n === index ? next : old))} />
                      </fieldset>
                    ))}
                  <p className="notice">
                    {invalidFact
                      ? 'Resolve the marked fields before asking this question.'
                      : truthQuestionText(question, leaderName)}
                  </p>
                </>
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
              {button(
                'Ask publicly',
                { type: 'truthAsk', question },
                (kind === 'shipment' &&
                  (invalidShipment || !shipmentAvailable)) ||
                  (kind === 'mixedShipment' &&
                    (!!invalidMixed || !shipmentAvailable)) ||
                  (kind === 'freeform' && !text.trim()) ||
                  (kind === 'fact' && invalidFact) ||
                  (kind === 'battlePlan' &&
                    (!g.battle ||
                      ![g.battle.attacker, g.battle.defender].includes(
                        target,
                      ))),
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
        Structured battle-plan and supported reserve-shipment answers are
        enforced. Current-turn freeform promises remain binding when possible,
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
