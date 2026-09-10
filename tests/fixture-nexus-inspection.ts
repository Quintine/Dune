import assert from 'node:assert/strict';
import {
  applyAction,
  createGame,
  initializeNexusGameForAudit,
  joinGame,
  newPlayer,
  viewGame,
  type Game,
} from '../game/engine';
import { botActions } from '../game/bots';
import { baseDeck, type Card } from '../game/cards';
import { richeseCards } from '../game/richese-cards';
import { deployRicheseNoField } from '../game/richese-no-field';
import { validateNexusCards } from '../game/nexus-cards';
import { drawNexusCard } from '../game/nexus-cards';
import {
  nexusFixture,
  enterNexusSpice,
  finishNexusSpice,
  orderNexusSpice,
  nexusInventory,
  nexusPlayer,
  nexusAllow,
} from './fixture-nexus-cards';

/** Genuine final roster and component setup, followed by a conserved battle
 * boundary. No faction, seat identity or signed history is changed afterward. */
export function nexusInspectionFixture(
  secretAlly = false,
  holder = 'a',
  options: { richese?: boolean; noField?: boolean } = {},
): Game {
  let g: Game;
  if (!secretAlly && !options.richese && !options.noField) g = nexusFixture();
  else {
    g = createGame(
      'INSPECT',
      newPlayer('f', 'Fremen', 'fremen'),
      false,
      [], // The explicit audit includes Richese's printed cache and markers; E2 deck release remains gated.
    );
    joinGame(
      g,
      newPlayer(
        'a',
        secretAlly ? 'Guild' : 'Atreides',
        secretAlly ? 'guild' : 'atreides',
      ),
    );
    joinGame(g, newPlayer('h', 'Harkonnen', 'harkonnen'));
    // Public lobby placeholders are replaced before any initialized components/history.
    if (options.noField) g.players[2] = newPlayer('h', 'Richese', 'richese');
    else if (options.richese)
      g.players[0] = newPlayer('f', 'Richese', 'richese');
    for (const p of g.players) g = applyAction(g, p.id, { type: 'ready' });
    g.nexusCards = { cards: null, phase: null };
    g = initializeNexusGameForAudit(g);
    for (let i = 0; g.status === 'setup' && i < 60; i++) {
      let next: Game | undefined;
      for (const p of g.players) {
        const v = viewGame(g, p.id);
        v.players.find((seat) => seat.id === p.id)!.bot = 'Easy';
        const action = botActions(v)[0];
        if (action) {
          next = applyAction(g, p.id, action);
          break;
        }
      }
      assert.ok(next, `Setup stalled at ${g.setupStage}`);
      g = next;
    }
    assert.equal(g.status, 'playing');
    for (const p of g.players) g.deck.push(...p.hand.splice(0));
  }
  g = enterNexusSpice(g);
  orderNexusSpice(g, ['land', 'land']);
  g = finishNexusSpice(g);
  Object.assign(g, {
    phase: 6,
    active: 'a',
    order: ['a', 'h', 'f'],
    ready: [],
    storm: 18,
    response: null,
    decision: null,
    phaseOpening: null,
  });
  for (const p of g.players) {
    p.forces = {};
    p.reserves = 20;
    p.tanks = 0;
    p.spice = 20;
  }
  for (const id of ['a', 'h']) {
    nexusPlayer(g, id).forces = { 'pasty_mesa:5': 5 };
    nexusPlayer(g, id).reserves = 15;
  }
  const cards = g.nexusCards!.cards!;
  cards.deck = [
    'atreides',
    ...cards.deck.filter((card) => card !== 'atreides'),
  ];
  g.nexusCards!.cards = drawNexusCard(cards, holder, g.players, () => 0);
  if (options.richese || options.noField) inspectionInventory(g);
  else nexusInventory(g);
  if (options.noField) {
    const target = nexusPlayer(g, 'h');
    assert.ok(target.noField);
    target.forces = {};
    target.reserves = 20;
    target.noField = deployRicheseNoField(target.noField, {
      tokenId: target.noField.tokens.find((t) => t.value === 3)!.id,
      controller: 'h',
      location: { territory: 'pasty_mesa', sector: 5 },
    });
  }
  g = applyAction(g, 'a', {
    type: 'chooseBattle',
    territory: 'pasty_mesa',
    target: 'h',
  });
  for (const id of ['a', 'h'])
    if (g.battle?.preLeader && !g.battle.preLeader.closed)
      g = applyAction(g, id, {
        type: 'battlePreparationReady',
        event: g.battle!.event,
      });
  return g;
}
export function inspectionHold(g: Game, id: string, kind: Card['kind']): Card {
  const index = g.deck.findIndex((card) => card.kind === kind);
  assert.ok(index >= 0, `Missing physical ${kind}`);
  const [card] = g.deck.splice(index, 1);
  nexusPlayer(g, id).hand.push(card);
  return card;
}
export function inspectionNative(
  g: Game,
  field: 'leader' | 'weapon' | 'defense' | 'dial' = 'dial',
  value: string | number | null = 0,
): Game {
  assert.equal(g.battle?.preparation?.kind, 'prescience');
  g = nexusAllow(applyAction(g, 'a', { type: 'prescience', field }));
  return applyAction(g, 'h', { type: 'prescienceAnswer', value });
}

export function inspectionInventory(g: Game): void {
  validateNexusCards(g.nexusCards!.cards!, g.players);
  assert.deepEqual(
    [
      ...g.deck,
      ...g.discard,
      ...g.players.flatMap((p) => p.hand),
      ...(g.richeseCache ?? []),
    ]
      .map((c) => c.id)
      .sort(),
    [
      ...baseDeck(),
      ...(g.players.some((p) => p.faction === 'richese') ? richeseCards() : []),
    ]
      .map((c) => c.id)
      .sort(),
  );
  for (const p of g.players)
    assert.equal(
      p.reserves + p.tanks + Object.values(p.forces).reduce((a, b) => a + b, 0),
      20,
    );
}
export function inspectionResidual(g: Game, holder = 'a'): string {
  const index = g.richeseCache!.findIndex(
    (c) => c.id === 'richese-residual-poison',
  );
  assert.ok(index >= 0);
  const card = g.richeseCache!.splice(index, 1)[0];
  nexusPlayer(g, holder).hand.push(card);
  return card.id;
}
