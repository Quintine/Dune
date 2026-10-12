import assert from 'node:assert/strict';
import { applyAction, handLimit, viewGame, type Action, type Game } from '../game/engine';
import { treacheryDeck } from '../game/cards';
import { nativeShipmentSources } from '../game/homeworld-options';
import { homeworldWorthlessSaleBlock } from '../game/homeworld-card-economy';
import { moveSemutaEmperorCard, semutaEmperorPlayer } from './fixture-semuta-emperor-share';
import { createSemutaHomeworldChoamSetup, advanceSemutaHomeworldChoam, holdSemutaHomeworldChoamCard } from './fixture-semuta-homeworld-choam';

export type HomeworldChoamSaleKind = 'worthless' | 'duplicate';
/** Native setup, native closing market, conserved physical sale cards. A real
 * ten-force shipment lowers Tupile before the Worthless sale; nothing assigns
 * clocks, wallets, population, visitors or payment history. */
export function createSemutaHomeworldChoamSaleFixture(kind: HomeworldChoamSaleKind, advanced = false, fullHolder = false) {
  const native = createSemutaHomeworldChoamSetup(advanced);
  let game = native.game;
  const owner = native.owner, holder = native.holder, actions = native.actions;
  const card = holdSemutaHomeworldChoamCard(game, owner, kind === 'worthless' ? 'Baliset' : 'Shield');
  let witness: string | undefined;
  if (kind === 'duplicate') {
    const other = treacheryDeck(game.expansions).find(c => c.name === 'Shield' && c.id !== card);
    assert.ok(other); witness = moveSemutaEmperorCard(game, other.id, owner);
  }
  holdSemutaHomeworldChoamCard(game, native.canceller, 'Karama');
  const action: Action = { type: 'decision', mode: 'sell', card, ...(witness ? { witness } : {}) };
  const setup = structuredClone(game);
  game = advanceSemutaHomeworldChoam(game, g => g.decision?.kind === 'choamMarket' && !g.response && !g.phaseOpening, actions);
  const highMarket = structuredClone(game);
  assert.equal(semutaEmperorPlayer(highMarket, owner).reserves, 20);
  let beforeShipment: Game | null = null, afterShipment: Game | null = null;
  if (kind === 'worthless') {
    assert.ok(homeworldWorthlessSaleBlock(highMarket, owner,
      semutaEmperorPlayer(highMarket, owner).hand.find(c => c.id === card)!));
    game = advanceSemutaHomeworldChoam(game,
      g => g.phase === 5 && g.active === owner && !g.phaseOpening && !g.response && !g.decision, actions);
    beforeShipment = structuredClone(game);
    const sources = nativeShipmentSources(viewGame(game, owner), 10, 0); assert.ok(sources);
    const ship: Action = { type: 'ship', territory: 'habbanya_ridge_sietch', sector: 17,
      amount: 10, elite: 0, homeworldSources: sources };
    actions.push({ actor: owner, action: ship }); game = applyAction(game, owner, ship);
    game = advanceSemutaHomeworldChoam(game, g => !g.phaseOpening && !g.response && !g.decision, actions);
    afterShipment = structuredClone(game);
    assert.equal(semutaEmperorPlayer(game, owner).reserves, 10);
    assert.equal(semutaEmperorPlayer(game, owner).forces['habbanya_ridge_sietch:17'], 10);
    const end: Action = { type: 'endMovement' };
    actions.push({ actor: owner, action: end }); game = applyAction(game, owner, end);
    game = advanceSemutaHomeworldChoam(game,
      g => g.phase === 5 && g.decision?.kind === 'choamMarket' && !g.response && !g.phaseOpening, actions);
    assert.equal(homeworldWorthlessSaleBlock(game, owner,
      semutaEmperorPlayer(game, owner).hand.find(c => c.id === card)!), null);
  }
  if (fullHolder) {
    const player = semutaEmperorPlayer(game, holder);
    while (player.hand.length < handLimit(player)) {
      assert.ok(game.deck[0]); moveSemutaEmperorCard(game, game.deck[0].id, holder);
    }
  }
  assert.equal(game.decision?.kind, 'choamMarket');
  assert.equal(game.decision!.player, owner);
  return { game, setup, highMarket, beforeShipment, afterShipment, owner, holder,
    canceller: native.canceller, card, witness, price: kind === 'worthless' ? 2 : 3, action, actions, kind };
}

export function playSemutaHomeworldChoamSale(f: ReturnType<typeof createSemutaHomeworldChoamSaleFixture>): Game {
  let game = applyAction(f.game, f.owner, f.action);
  for (let n = 0; game.response && n < 16; n++) {
    assert.equal(game.response.kind, 'choamSale');
    const actor = game.players.find(p => {
      const controls = viewGame(game, p.id).responseControls;
      return controls && !controls.hasPassed && controls.cancelCards.length > 0;
    });
    assert.ok(actor);
    game = applyAction(game, actor.id, { type: 'passResponse' });
  }
  assert.ok(!game.response);
  return game;
}
