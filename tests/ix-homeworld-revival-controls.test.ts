import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { IxHomeworldRevivalBonus } from '../components/ix-homeworld-revival';

void test('the automatic Ix quote persists and describes the selected physical bonus', () => {
  const props = { enabled: true, amount: 3, elite: 1, free: 1,
    freeElite: 0, normalTanks: 4 };
  const html = renderToStaticMarkup(createElement(IxHomeworldRevivalBonus, props));
  assert.match(html, /also returns 2 Suboids for free/);
  assert.match(html, /do not use normal revival allowance/);
  assert.match(html, /aria-live="polite"/);
  assert.doesNotMatch(html, /button|timeout|Continue/);
  const one = renderToStaticMarkup(createElement(IxHomeworldRevivalBonus,
    { ...props, normalTanks: 3 }));
  assert.match(one, /also returns 1 Suboid for free/);
  assert.doesNotMatch(one, /1 Suboids/);
});

void test('free Cyborg selection quotes zero and stale selections remain readable', () => {
  const props = { enabled: true, amount: 3, elite: 1, free: 1,
    freeElite: 1, normalTanks: 4 };
  assert.match(renderToStaticMarkup(createElement(IxHomeworldRevivalBonus, props)),
    /also returns 0 Suboids/);
  assert.match(renderToStaticMarkup(createElement(IxHomeworldRevivalBonus,
    { ...props, elite: 4 })), /Select an available revival group/);
  assert.equal(renderToStaticMarkup(createElement(IxHomeworldRevivalBonus,
    { ...props, enabled: false })), '');
  const blocked = renderToStaticMarkup(createElement(IxHomeworldRevivalBonus,
    { ...props, blocked: true }));
  assert.match(blocked, /La La La prevents/);
  assert.match(blocked, /Paid Cyborg revival remains available/);
});
