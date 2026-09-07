'use client';
import { TERRITORIES } from '@/game/board';
import { BattleClaimFields } from './battle-promises';
import { CardCountFields } from './truthtrance-card-count';
import type { PlanClaim } from '@/game/battle-promises';
import { useId, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CHEAP_HERO_TRAITOR } from '@/game/traitors';
import {
  TRUTH_CARD_NAMES,
  truthQuestionText,
  type TruthFact,
  type TruthQuestion,
} from '@/game/truthtrance';
import type { Action, GameView } from '@/game/engine';

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
  const [target, setTarget] = useState(
    g.players.find((p) => p.id !== me.id)!.id,
  );
  const [kind, setKind] = useState<
    'fact' | 'freeform' | 'battlePlan' | 'shipment'
  >('fact');
  const [shipmentTerritory, setShipmentTerritory] = useState('carthag');
  const [shipmentMinimum, setShipmentMinimum] = useState(6);
  const invalidShipment =
    !Number.isSafeInteger(shipmentMinimum) ||
    shipmentMinimum < 1 ||
    shipmentMinimum > 20;
  const shipmentAvailable =
    !g.advanced &&
    !g.expansions.length &&
    g.phase === 5 &&
    g.active === target &&
    !g.players.find((p) => p.id === target)?.shipped &&
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
  const invalidSpice = (fact: TruthFact) =>
    (fact.kind === 'spice' || fact.kind === 'handCount') &&
    (!Number.isSafeInteger(fact.value) || fact.value < 0);
  const invalidFact = clauses
    .slice(0, join === 'single' ? 1 : 2)
    .some(invalidSpice);
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
              territory: shipmentTerritory,
              minimum: shipmentMinimum,
            }
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
        <Link href="/rules#card-truthtrance">Question rules</Link> · The table
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
              {me.hand
                ?.filter((c) => c.effect === 'truthtrance')
                .slice(0, 1)
                .map((c) => (
                  <div key={c.id}>
                    {button('Declare my Truthtrance', {
                      type: 'card',
                      card: c.id,
                    })}
                  </div>
                ))}
              {(me.hand?.filter((c) => c.effect === 'truthtrance').length ??
                0) > 1 &&
                button('Declare both Truthtrances', {
                  type: 'card',
                  card: me.hand!.find((c) => c.effect === 'truthtrance')!.id,
                  cards: me
                    .hand!.filter((c) => c.effect === 'truthtrance')
                    .slice(1)
                    .map((c) => c.id),
                })}
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
                {w.question!.kind === 'shipment' ? (
                  <>
                    <p className="notice">
                      A definite answer binds your shipment from reserves this
                      turn. Available preparation includes your Ghola, Karama
                      and recoverable allied funding. Yes leaves the exact
                      count, sector and payment yours to choose; No allows a
                      different shipment or none.
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
                    Verified cards, traitors or spice
                  </option>
                  <option value="shipment">
                    Bind a shipment from reserves
                  </option>
                  <option value="freeform">Write a game question</option>
                  {g.battle && (
                    <option value="battlePlan">
                      Bind a battle-plan choice
                    </option>
                  )}
                </select>
              </label>
              {kind === 'shipment' ? (
                <>
                  <label>
                    Shipment destination
                    <select
                      value={shipmentTerritory}
                      onChange={(e) => setShipmentTerritory(e.target.value)}
                    >
                      {TERRITORIES.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label htmlFor={`${factId}-shipment-minimum`}>
                    Minimum physical forces
                    <Input
                      id={`${factId}-shipment-minimum`}
                      type="number"
                      min={1}
                      max={20}
                      step={1}
                      required
                      value={
                        Number.isNaN(shipmentMinimum) ? '' : shipmentMinimum
                      }
                      aria-invalid={invalidShipment}
                      aria-describedby={`${factId}-shipment-help`}
                      onChange={(e) =>
                        setShipmentMinimum(e.currentTarget.valueAsNumber)
                      }
                    />
                  </label>
                  <p className="fine" id={`${factId}-shipment-help`}>
                    Includes Fremen reinforcements and Guild transport from
                    southern reserves. Ground movement and transport of forces
                    already on the board do not count.
                  </p>
                  {!shipmentAvailable && (
                    <p className="notice">
                      Automatic enforcement currently supports the active
                      player’s unused shipment in the Basic game without
                      expansions. Select that player and finish pending
                      decisions first. Earlier questions and other rules
                      configurations remain unfinished.
                    </p>
                  )}
                  <p className="notice">
                    {invalidShipment
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
                        <label>
                          Fact type
                          <select
                            value={c.kind}
                            onChange={(e) =>
                              setClauses(
                                clauses.map((old, n) =>
                                  n === index
                                    ? e.target.value === 'hand'
                                      ? { kind: 'hand', name: 'Shield' }
                                      : e.target.value === 'handCount'
                                        ? {
                                            kind: 'handCount',
                                            name: 'Shield',
                                            compare: 'gte',
                                            value: 2,
                                          }
                                        : e.target.value === 'spice'
                                          ? {
                                              kind: 'spice',
                                              compare: 'gte',
                                              value: 6,
                                            }
                                          : {
                                              kind: 'traitor',
                                              leader: g.allLeaders[0].id,
                                            }
                                    : old,
                                ),
                              )
                            }
                          >
                            <option value="hand">Holds a named card</option>
                            <option value="handCount">
                              Number of a named card
                            </option>
                            <option value="traitor">Selected a traitor</option>
                            <option value="spice">
                              Current personal spice
                            </option>
                          </select>
                        </label>
                        {c.kind === 'hand' ? (
                          <label>
                            Card name
                            <select
                              value={c.name}
                              onChange={(e) =>
                                setClauses(
                                  clauses.map((old, n) =>
                                    n === index
                                      ? { kind: 'hand', name: e.target.value }
                                      : old,
                                  ),
                                )
                              }
                            >
                              {TRUTH_CARD_NAMES.map((name) => (
                                <option key={name}>{name}</option>
                              ))}
                            </select>
                          </label>
                        ) : c.kind === 'handCount' ? (
                          <CardCountFields
                            value={c}
                            onChange={(next) =>
                              setClauses(
                                clauses.map((old, n) =>
                                  n === index ? next : old,
                                ),
                              )
                            }
                          />
                        ) : c.kind === 'spice' ? (
                          <>
                            <label>
                              Compare personal spice
                              <select
                                value={c.compare}
                                onChange={(e) =>
                                  setClauses(
                                    clauses.map((old, n) =>
                                      n === index
                                        ? {
                                            ...c,
                                            compare: e.target
                                              .value as typeof c.compare,
                                          }
                                        : old,
                                    ),
                                  )
                                }
                              >
                                <option value="eq">Exactly</option>
                                <option value="gte">At least</option>
                                <option value="lte">At most</option>
                              </select>
                            </label>
                            <label htmlFor={`${factId}-${index}-spice-amount`}>
                              Spice amount
                              <Input
                                id={`${factId}-${index}-spice-amount`}
                                type="number"
                                min={0}
                                max={Number.MAX_SAFE_INTEGER}
                                step={1}
                                required
                                value={Number.isNaN(c.value) ? '' : c.value}
                                aria-invalid={invalidSpice(c)}
                                aria-describedby={`${factId}-${index}-spice-help${invalidSpice(c) ? ` ${factId}-${index}-spice-error` : ''}`}
                                onChange={(e) =>
                                  setClauses(
                                    clauses.map((old, n) =>
                                      n === index
                                        ? {
                                            ...c,
                                            value:
                                              e.currentTarget.valueAsNumber,
                                          }
                                        : old,
                                    ),
                                  )
                                }
                              />
                            </label>
                            <p
                              className="fine"
                              id={`${factId}-${index}-spice-help`}
                            >
                              Counts spice the player personally holds now.
                              Excludes pledged aid and incoming payments. This
                              asks about the current balance; it does not
                              promise future holdings or spending.
                            </p>
                            {invalidSpice(c) && (
                              <p
                                className="notice"
                                role="alert"
                                id={`${factId}-${index}-spice-error`}
                              >
                                {Number.isInteger(c.value) &&
                                c.value > Number.MAX_SAFE_INTEGER
                                  ? 'That spice amount is too large.'
                                  : 'Enter a whole spice amount of zero or more.'}
                              </p>
                            )}
                          </>
                        ) : (
                          c.kind === 'traitor' && (
                            <label>
                              Leader
                              <select
                                value={c.leader}
                                onChange={(e) =>
                                  setClauses(
                                    clauses.map((old, n) =>
                                      n === index
                                        ? {
                                            kind: 'traitor',
                                            leader: e.target.value,
                                          }
                                        : old,
                                    ),
                                  )
                                }
                              >
                                {g.allLeaders.map((l) => (
                                  <option key={l.id} value={l.id}>
                                    {l.name}
                                  </option>
                                ))}
                                <option value={CHEAP_HERO_TRAITOR}>
                                  Cheap Hero / Heroine
                                </option>
                              </select>
                            </label>
                          )
                        )}
                      </fieldset>
                    ))}
                  <p className="notice">
                    {invalidFact
                      ? 'Enter a valid whole amount before asking this question.'
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
