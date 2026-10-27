'use client';

import type { Action } from '@/game/engine';
import { Button } from './ui/button';

/** The ordering frame is public: eligibility depends on who queued a question,
 * never on whether any player holds Juice of Sapho. */
export type SaphoTruthOrderFrame = {
  event: string;
  holders: string[];
  passed: string[];
  revision: number;
};
export type SaphoTruthOrderChoice = { card: string; mode: 'first' | 'last' };
export type SaphoTruthOrderProps = {
  frame: SaphoTruthOrderFrame;
  me: string;
  choices: SaphoTruthOrderChoice[];
  act: (action: Action) => void;
  busy: boolean;
};

/** The authoritative action is revalidated by the server. These local checks
 * also avoid sending a callback after its visible event or revision changed. */
function currentFrame(props: SaphoTruthOrderProps, frame: SaphoTruthOrderFrame,
  event: string, revision: number): boolean {
  return !props.busy && props.frame === frame && frame.event === event &&
    frame.revision === revision && typeof event === 'string' && event.length > 0 &&
    Number.isSafeInteger(revision) && revision >= 0 &&
    frame.holders.includes(props.me) && !frame.passed.includes(props.me);
}

export function SaphoTruthOrderPass(props: SaphoTruthOrderProps) {
  const { frame } = props, event = frame.event, revision = frame.revision;
  const canAct = () => currentFrame(props, frame, event, revision);
  return <Button className="game-action min-h-11 whitespace-normal" data-testid="sapho-truth-order-pass"
    disabled={!canAct()} onClick={() => { if (canAct()) props.act({ type: 'truthOrderPass', event, revision }); }}>
    Continue without changing question order
  </Button>;
}

export function SaphoTruthOrderChoiceButton(props: SaphoTruthOrderProps & { choice: SaphoTruthOrderChoice }) {
  const { frame, choice } = props, event = frame.event, revision = frame.revision;
  const card = choice.card, mode = choice.mode;
  const canAct = () => currentFrame(props, frame, event, revision) &&
    typeof card === 'string' && card.length > 0 && (mode === 'first' || mode === 'last') &&
    choice.card === card && choice.mode === mode &&
    props.choices.some(item => item.card === card && item.mode === mode);
  return <Button className="game-action min-h-11 whitespace-normal" data-testid={`sapho-truth-order-${mode}`}
    disabled={!canAct()} onClick={() => {
      if (canAct()) props.act({ type: 'saphoTruthOrder', event, revision, card, mode });
    }}>
    Use Juice of Sapho to ask {mode}
  </Button>;
}

/** Render the same public pass opportunity to every queued holder. The choices
 * array contains only this viewer's server-quoted, privately held cards. */
export function SaphoTruthOrder(props: SaphoTruthOrderProps) {
  const { frame, me } = props;
  const eligible = frame.holders.includes(me), passed = frame.passed.includes(me);
  return <section className="notice space-y-3" aria-label="Truthtrance question order">
    <h3>Truthtrance question order</h3>
    <p>Before the questions begin, each player who queued a Truthtrance may continue or use an available order change. Questions from the same player stay together.</p>
    <p>{frame.passed.length} of {frame.holders.length} players have finished this choice.</p>
    {eligible && !passed ? <>
      <SaphoTruthOrderPass {...props} />
      {props.choices.map(choice => <SaphoTruthOrderChoiceButton {...props} key={`${choice.card}:${choice.mode}`} choice={choice} />)}
    </> : <p>{eligible ? 'You have finished this choice.' : 'Waiting for the players who queued questions.'}</p>}
  </section>;
}
