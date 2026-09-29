import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { NexusFremenBetrayal } from '../components/nexus-fremen-betrayal';
import { applyAction, viewGame } from '../game/engine';
import { fremenBetrayalWormFixture } from './fixture-nexus-fremen-betrayal';

void test('pre-blow owner sees worm prevention while rival cannot see the held card or offer', () => {
  const { g, play } = fremenBetrayalWormFixture();
  const owner = renderToStaticMarkup(createElement(NexusFremenBetrayal, {
    game: viewGame(g, 'h'), act() {}, busy: false,
  }));
  const rival = renderToStaticMarkup(createElement(NexusFremenBetrayal, {
    game: viewGame(g, 'f'), act() {}, busy: false,
  }));
  assert.match(owner, /Use Betrayal: prevent worm riding this turn/);
  assert.match(owner, /Worm destruction, survival, protection and Nexus still resolve/);
  assert.equal(rival, '');
  const spent = applyAction(g, 'h', play);
  assert.equal(renderToStaticMarkup(createElement(NexusFremenBetrayal, {
    game: viewGame(spent, 'h'), act() {}, busy: false,
  })), '');
  assert.equal(viewGame(spent, 'f').players.find(player => player.id === 'f')!.fremenNexusWormBlocked, true);
});
