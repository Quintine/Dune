import test from 'node:test';
import assert from 'node:assert/strict';
import { Children, createElement, isValidElement, type ChangeEvent, type InputHTMLAttributes, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { RicheseHomeworldForces, type RicheseHomeworldForcesProps } from '../components/richese-homeworld-forces';

/** Direct controlled props and actual callbacks; no browser or native engine
 * provenance is claimed by these component-only tests. */
function props(patch: Partial<RicheseHomeworldForcesProps> = {}): RicheseHomeworldForcesProps {
  return { enabled: true, amount: 3, max: 10, busy: false, onChange() {}, ...patch };
}
const markup = (value: RicheseHomeworldForcesProps) => renderToStaticMarkup(createElement(RicheseHomeworldForces, value));
function input(value: RicheseHomeworldForcesProps): ReactElement<InputHTMLAttributes<HTMLInputElement>> {
  const queue: ReactNode[] = [RicheseHomeworldForces(value)];
  while (queue.length) {
    const node = queue.shift();
    if (!isValidElement<{ children?: ReactNode }>(node)) continue;
    if (node.type === 'input') return node as ReactElement<InputHTMLAttributes<HTMLInputElement>>;
    queue.push(...Children.toArray(node.props.children));
  }
  throw Error('The persistent paid-force input is missing');
}
function change(field: ReactElement<InputHTMLAttributes<HTMLInputElement>>, value: string) {
  assert.ok(field.props.onChange);
  field.props.onChange({ target: { value } } as ChangeEvent<HTMLInputElement>);
}

void test('paid-force control is persistent, labelled and separates current forces from concealed revelation', () => {
  const html = markup(props());
  assert.match(html, /aria-label="Richese Homeworld shipment"/);
  assert.match(html, /Paid reserve forces with No-Field/);
  assert.match(html, /type="number"[^>]*min="0"[^>]*max="10"[^>]*step="1"/);
  assert.match(html, /Paid forces enter the destination now/);
  assert.match(html, /stay in reserves until revelation/);
  assert.match(html, /reserves then available/);
  assert.doesNotMatch(html, /timeout|countdown|automatically submit/i);
});

void test('actual numeric callback accepts bounded whole amounts including zero', () => {
  const seen: number[] = [], field = input(props({ onChange: value => seen.push(value) }));
  for (const value of ['4', '0', '10']) change(field, value);
  for (const value of ['-1', '11', '1.5', 'not-a-number', 'Infinity']) change(field, value);
  assert.deepEqual(seen, [4, 0, 10]);
});

void test('busy state disables the field and an already queued callback cannot change the selection', () => {
  const seen: number[] = [], value = props({ busy: true, onChange: amount => seen.push(amount) });
  const field = input(value);
  assert.equal(field.props.disabled, true);
  change(field, '0');
  assert.deepEqual(seen, []);
  assert.match(markup(value), /disabled=""/);
});

void test('lost High entitlement clearly blocks a positive selection while keeping zero selectable', () => {
  const seen: number[] = [], value = props({ enabled: false, onChange: amount => seen.push(amount) });
  const field = input(value);
  assert.equal(field.props.disabled, false);
  assert.equal(field.props['aria-invalid'], true);
  change(field, '2'); change(field, '0');
  assert.deepEqual(seen, [0]);
  const html = markup(value);
  assert.match(html, /require Richese at High population/);
  assert.match(html, /Set the amount to 0/);
  assert.match(markup(props({ enabled: false, amount: 0, max: 0 })), /type="number"/);
});

void test('a stale amount above the current physical maximum stays visible with a correction path', () => {
  const seen: number[] = [], value = props({ amount: 3, max: 1, onChange: amount => seen.push(amount) });
  assert.match(markup(value), /Only 1 physical reserve force is available/);
  change(input(value), '1');
  assert.deepEqual(seen, [1]);
});
