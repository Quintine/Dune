import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  RulesetControls,
  AdvancedPreviewNotice,
} from '../components/ruleset-controls';
import { createRoomEntry, parseRoomEntry } from '../lib/room-entry';

void test('rules controls identify the unfinished selection before readiness and restrict peer editing', () => {
  const render = (advanced: boolean, host: boolean) =>
    renderToStaticMarkup(
      createElement(RulesetControls, {
        advanced,
        host,
        lobby: true,
        onChange() {},
      }),
    );
  assert.match(render(false, true), /value="basic" selected=""/);
  const preview = render(true, true);
  assert.match(preview, /value="advanced" selected=""/);
  assert.match(preview, /Rules and card interactions are still/);
  assert.match(preview, /six classic factions/);
  assert.match(preview, /Changing rules clears player readiness/);
  assert.match(preview, /Switching to Basic removes Stronghold Cards/);
  assert.match(render(true, false), /<select disabled=""/);
  assert.match(render(true, false), /The host chooses the rules/);
  const ongoing = renderToStaticMarkup(
    createElement(AdvancedPreviewNotice, { compact: true }),
  );
  assert.match(ongoing, /Advanced preview/);
  assert.match(ongoing, /Some play may need fixes/);
});

void test('an Advanced creation attempt retains the exact selection and proof through a tab retry', () => {
  const attempt = createRoomEntry({
    name: 'Preview host',
    faction: 'fremen',
    advanced: true,
    expansions: [],
  });
  const restored = parseRoomEntry(JSON.stringify(attempt));
  assert.equal(restored.bodyText, attempt.bodyText);
  const body = JSON.parse(restored.bodyText);
  assert.equal(body.advanced, true);
  assert.deepEqual(body.expansions, []);
  assert.equal(body.faction, 'fremen');
  assert.equal(
    body.entry.sessionToken,
    JSON.parse(attempt.bodyText).entry.sessionToken,
  );
});
