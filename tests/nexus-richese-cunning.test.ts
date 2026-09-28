import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, normalizeAutomaticGame, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { presenceAt } from '../game/force-presence';
import { nexusRicheseAllow, nexusRicheseFixture } from './fixture-nexus-richese';

function pair(g: Game, owner: string, revealedValue: 0 | 3 | 5 = 5): Action {
  const tokens = g.players.find(player => player.id === owner)!.noField!.tokens;
  const revealed = tokens.find(token => token.value === revealedValue)!;
  const concealed = tokens.find(token => token.id !== revealed.id &&
    token.id !== g.players.find(player => player.id === owner)!.noField!.lastShipped)!;
  return {
    type: 'ship', noField: concealed.id, revealedToken: revealed.id,
    nexus: viewGame(g, owner).nexusRicheseCunning!.event,
    event: g.players.find(player => player.id === owner)!.noFieldEvent,
    territory: 'arrakeen', sector: 10, allyPayment: 0,
  };
}

void test('Basic and Advanced Richese pair spends one card and price, materializes one public token and retains one concealed', () => {
  for (const advanced of [false, true]) {
    const { g: before, owner, target } = nexusRicheseFixture({ ownerFaction: 'richese', advanced });
    const p = before.players.find(player => player.id === owner)!;
    const original = JSON.stringify(before);
    const request = pair(before, owner);
    const concealed = String(request.noField);
    const revealed = String(request.revealedToken);
    const after = applyAction(before, owner, request);
    const actual = after.players.find(player => player.id === owner)!;
    assert.equal(JSON.stringify(before), original);
    assert.equal(after.nexusCards!.cards!.hands[owner], null);
    assert.equal(actual.spice, p.spice - 1);
    assert.equal(actual.reserves, p.reserves - 5);
    assert.equal(actual.forces['arrakeen:10'], 5);
    assert.equal(actual.noField!.deployed!.tokenId, concealed);
    assert.equal(actual.noField!.lastShipped, concealed);
    assert.equal(presenceAt(actual, 'arrakeen'), 6);
    assert.equal(after.nexusRicheseCunningLast?.stage, 'shipped');
    assert.match(after.log.at(-1)!.text, /faceup 5 token placed 5 physical forces/);
    const rival = viewGame(after, target);
    assert.equal(rival.richeseNoField!.private, null);
    assert.equal(rival.nexusRicheseCunning, null);
    assert.equal(JSON.stringify(rival).includes(concealed), false);
    assert.equal(JSON.stringify(rival).includes(revealed), false);
    const restored = normalizeAutomaticGame(JSON.parse(JSON.stringify(after)));
    assert.equal(restored.players.find(player => player.id === owner)!.reserves, p.reserves - 5);
    assert.equal(viewGame(restored, target).richeseNoField!.public.deployed!.effectiveForces, 1);
    assert.throws(() => applyAction(restored, owner, request), /ship once|unused shipment|stale/i);
  }
});

void test('Karama cancels the two-token attempt without spending spice or tokens, while the Nexus stays spent', () => {
  const { g: before, owner, target, karama } = nexusRicheseFixture({ ownerFaction: 'richese', karama: true });
  const request = pair(before, owner);
  const declared = applyAction(before, owner, request);
  assert.equal(declared.response?.kind, 'richeseNoField');
  assert.equal(declared.nexusCards!.cards!.hands[owner], null);
  assert.equal(declared.players[0].noField!.deployed, null);
  const canceled = applyAction(JSON.parse(JSON.stringify(declared)), target,
    { type: 'card', mode: 'cancel', card: karama! });
  assert.equal(canceled.nexusRicheseCunningLast?.stage, 'stopped');
  assert.equal(canceled.players[0].noField!.lastShipped, null);
  assert.equal(canceled.players[0].reserves, before.players[0].reserves);
  assert.equal(canceled.players[0].spice, before.players[0].spice);
  assert.equal(canceled.players[0].shipped, false);
  assert.equal(viewGame(canceled, owner).nexusRicheseCunning, null);
  assert.throws(() => applyAction(canceled, owner, request), /unavailable|stale/i);
  const ordinary = applyAction(canceled, owner,
    { type: 'ship', amount: 1, territory: 'arrakeen', sector: 10 });
  assert.equal(ordinary.players[0].forces['arrakeen:10'], 1);
});

void test('Advanced Guild special prevention spends Cunning without moving a token or charging shipment price', () => {
  const { g, owner, target, karama } = nexusRicheseFixture({
    ownerFaction: 'richese', opponentFaction: 'guild', advanced: true, karama: true,
  });
  const request = pair(g, owner);
  const pending = nexusRicheseAllow(applyAction(g, owner, request));
  assert.equal(pending.decision?.kind, 'guildShipment');
  assert.equal(pending.pendingShipment?.richesePair?.revealedTokenId, request.revealedToken);
  const stopped = nexusRicheseAllow(applyAction(
    JSON.parse(JSON.stringify(pending)), target,
    { type: 'card', mode: 'special', card: karama! },
  ));
  assert.equal(stopped.nexusRicheseCunningLast?.stage, 'stopped');
  assert.equal(stopped.players[0].spice, g.players[0].spice);
  assert.equal(stopped.players[0].reserves, g.players[0].reserves);
  assert.equal(stopped.players[0].noField!.deployed, null);
  assert.equal(stopped.players[0].noField!.lastShipped, null);
  assert.equal(stopped.nexusCards!.cards!.hands[owner], null);
  assert.equal(stopped.players[0].shipped, true);
});

void test('restoration rejects an orphaned pair before it can lose its Karama or Guild continuation', () => {
  const basic = nexusRicheseFixture({ ownerFaction: 'richese', karama: true });
  const declared = applyAction(basic.g, basic.owner, pair(basic.g, basic.owner));
  assert.equal(declared.response?.kind, 'richeseNoField');
  const missingResponse = JSON.parse(JSON.stringify(declared)) as Game;
  missingResponse.response = null;
  assert.throws(() => normalizeAutomaticGame(missingResponse), /Karama response or Guild interception/);

  const advanced = nexusRicheseFixture({
    ownerFaction: 'richese', opponentFaction: 'guild', advanced: true,
  });
  const pending = nexusRicheseAllow(applyAction(
    advanced.g, advanced.owner, pair(advanced.g, advanced.owner),
  ));
  assert.equal(pending.decision?.kind, 'guildShipment');
  const missingDecision = JSON.parse(JSON.stringify(pending)) as Game;
  missingDecision.decision = null;
  assert.throws(() => viewGame(missingDecision, advanced.owner), /Karama response or Guild interception/);
});

void test('pair rejects duplicate, prior-used and stale tokens without changing the original game', () => {
  const { g, owner } = nexusRicheseFixture({ ownerFaction: 'richese' });
  const request = pair(g, owner);
  const original = JSON.stringify(g);
  for (const altered of [
    { ...request, revealedToken: request.noField },
    { ...request, noField: 'foreign-token' },
    { ...request, nexus: 'stale' },
    { ...request, event: 'stale' },
    { ...request, extra: 'unbound' },
  ]) {
    assert.throws(() => applyAction(g, owner, altered));
    assert.equal(JSON.stringify(g), original);
  }
  const old = g.players[0].noField!;
  old.lastShipped = old.tokens.find(token => token.value === 5)!.id;
  assert.throws(() => applyAction(g, owner, request));
});

void test('all four profiles choose and complete a legal pair using their private own-token view', () => {
  for (const difficulty of ['Easy', 'Medium', 'Hard', 'Brutal'] as const) {
    const { g, owner } = nexusRicheseFixture({ ownerFaction: 'richese' });
    const view = viewGame(g, owner);
    view.players.find(player => player.id === owner)!.bot = difficulty;
    const action = botActions(view)[0];
    assert.equal(action?.type, 'ship');
    assert.equal(action?.nexus, view.nexusRicheseCunning!.event, JSON.stringify(action));
    assert.ok(action?.revealedToken && action.noField && action.revealedToken !== action.noField);
    const after = applyAction(g, owner, action);
    assert.equal(after.nexusRicheseCunningLast?.stage, 'shipped');
  }
});
