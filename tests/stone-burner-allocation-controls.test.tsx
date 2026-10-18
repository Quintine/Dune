import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement, type MouseEvent, type ReactElement, type ButtonHTMLAttributes } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { StoneBurnerAllocation } from '../components/stone-burner-allocation';

void test('Stone Burner allocation keeps explicit physical-total commitments and provisional sealed timing readable until chosen', () => {
  const committed: number[] = [], props = { event: 'stone-original-event', totals: [5, 2, 5],
    onCommit: (total: number) => committed.push(total), busy: false };
  const html = renderToStaticMarkup(createElement(StoneBurnerAllocation, props));
  assert.match(html, /aria-label="Stone Burner undialed force commitment"/);
  assert.match(html, /Provisional timing/);
  assert.match(html, /Choices stay sealed until everyone has committed/);
  assert.match(html, /ordinary and elite losses afterward/);
  assert.match(html, /Commit 2 undialed physical forces/);
  assert.match(html, /Commit 5 undialed physical forces/);
  assert.equal((html.match(/<button/g) ?? []).length, 2);
  assert.deepEqual(committed, [], 'Rendering never commits or starts an automatic countdown');
  const panel = StoneBurnerAllocation(props)!;
  const buttons = panel.props.children[3].props.children as ReactElement<ButtonHTMLAttributes<HTMLButtonElement>>[];
  buttons[0].props.onClick!({} as MouseEvent<HTMLButtonElement>);
  buttons[1].props.onClick!({} as MouseEvent<HTMLButtonElement>);
  assert.deepEqual(committed, [2, 5]);
});

void test('busy Stone Burner commitments cannot submit through their callback, and a fresh event retains its own original choices', () => {
  const committed: number[] = [], onCommit = (total: number) => committed.push(total);
  const props = { event: 'first-original-event', totals: [1, 3], onCommit, busy: true };
  const html = renderToStaticMarkup(createElement(StoneBurnerAllocation, props));
  assert.equal((html.match(/<button\b[^>]*\sdisabled=""/g) ?? []).length, 2);
  const panel = StoneBurnerAllocation(props)!;
  const buttons = panel.props.children[3].props.children as ReactElement<ButtonHTMLAttributes<HTMLButtonElement>>[];
  for (const button of buttons) button.props.onClick!({} as MouseEvent<HTMLButtonElement>);
  assert.deepEqual(committed, []);
  const next = renderToStaticMarkup(createElement(StoneBurnerAllocation,
    { event: 'next-original-event', totals: [0, 4], onCommit, busy: false }));
  assert.match(next, /data-event="next-original-event"/);
  assert.match(next, /Commit 0 undialed physical forces/);
  assert.match(next, /Commit 4 undialed physical forces/);
  assert.doesNotMatch(next, /Commit 1 undialed|Commit 3 undialed/);
});
