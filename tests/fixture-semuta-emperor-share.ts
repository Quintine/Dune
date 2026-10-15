import assert from 'node:assert/strict';
import {
  applyAction, createGame, initializeSemutaGameForAudit, joinGame, newPlayer,
  viewGame, type Action, type Game, type Player,
} from '../game/engine';
import { nextRicheseSkillsTechNativeStep } from './fixture-richese-skills-tech';
import { SEMUTA_DRUG_ID } from '../game/semuta-drug';

export type SemutaEmperorShareKind = 'emperorGift' | 'emperorRevival';
export type SemutaEmperorShareFixture = {
  game: Game;
  owner: string;
  holder: string;
  recipient: string;
  karama: string;
  karamaCard: { id: string; name: string; kind: string; effect?: string };
  semuta: string;
  kind: SemutaEmperorShareKind;
  declare: Action;
  cancel: Action;
};
export function semutaEmperorPlayer(game: Game, id: string): Player {
  const player = game.players.find(seat => seat.id === id);
  assert.ok(player, `Missing original ${id} seat`);
  return player;
}
/** Locate one existing physical card identity across the original zones. */
export function semutaEmperorCardId(game: Game, match: (card: { id: string; effect?: string; kind?: string }) => boolean): string {
  for (const zone of [game.deck, game.discard, game.richeseCache ?? [],
    game.richeseRemoved ?? [], ...game.players.map(p => p.hand)]) {
    const card = zone.find(candidate => match(candidate));
    if (card) return card.id;
  }
  throw new Error('The requested original physical card is unavailable');
}
/** Move one existing physical card between zones; never duplicate a face. */
export function moveSemutaEmperorCard(game: Game, id: string, to: string): string {
  for (const zone of [game.deck, game.discard, game.richeseCache ?? [],
    game.richeseRemoved ?? [], ...game.players.map(p => p.hand)]) {
    const index = zone.findIndex(card => card.id === id);
    if (index < 0) continue;
    const card = zone.splice(index, 1)[0];
    semutaEmperorPlayer(game, to).hand.push(card);
    return card.id;
  }
  throw new Error(`Missing original physical ${id}`);
}
/** Original native setup, first turn and actual worm alliance precede the share.
 * Later hands/Tanks are staged by conserved moves; clocks, wallets and decks remain native. */
export function createSemutaEmperorShareFixture(kind: SemutaEmperorShareKind): SemutaEmperorShareFixture {
  let game = createGame('SEMUTAEMPEROR', newPlayer('r', 'Richese', 'richese'), false, ['choam']);
  joinGame(game, newPlayer('e', 'Emperor', 'emperor'));
  joinGame(game, newPlayer('a', 'Atreides', 'atreides'));
  for (const player of game.players) game = applyAction(game, player.id, { type: 'ready' });
  game = initializeSemutaGameForAudit(game);
  const clean = () => !game.phaseOpening && !game.response && !game.decision;
  const reach = (until: () => boolean) => {
    for (let n = 0; !until() && n < 1800; n++) {
      assert.notEqual(game.status, 'finished', 'Original native actions must reach the share');
      const pending = game.pendingTreacheryDiscard;
      const reaction = pending?.reaction;
      const next = reaction?.stage === 'offer' && pending
        ? { actor: game.players.find(p => !reaction.passed.includes(p.id))!.id,
          action: { type: 'semutaPass', event: pending.batch.event } }
        : nextRicheseSkillsTechNativeStep(game);
      game = applyAction(game, next.actor, next.action);
    }
    assert.ok(until(), 'Original native actions must reach the requested boundary');
  };
  const orderUnplayedSpice = (kinds: ('land' | 'worm')[]) => {
    for (const [position, type] of kinds.entries()) {
      const index = game.spiceDeck.findIndex((card, i) => i >= position &&
        (type === 'land' ? 'territory' in card : 'worm' in card));
      assert.ok(index >= position, 'An original unplayed Spice Card must remain');
      game.spiceDeck.splice(position, 0, game.spiceDeck.splice(index, 1)[0]);
    }
  };
  reach(() => game.status === 'playing');
  orderUnplayedSpice(['land', 'land']);
  reach(() => game.phase === 5 && clean());
  for (const player of game.players) {
    player.reserves += Object.values(player.forces).reduce((total, amount) => total + amount, 0);
    player.forces = {};
  }
  reach(() => game.turn === 2 && game.phase === 1 && clean());
  orderUnplayedSpice(['worm', 'land', 'land']);
  reach(() => game.nexus && !game.spiceWindow && !game.spiceResolution && clean());
  game = applyAction(game, 'e', { type: 'alliance', target: 'a' });
  game = applyAction(game, 'a', { type: 'alliance', target: 'e' });
  reach(() => game.phase === (kind === 'emperorRevival' ? 4 : 2) && clean());
  const owner = semutaEmperorPlayer(game, 'e'), holder = semutaEmperorPlayer(game, 'r');
  const recipient = semutaEmperorPlayer(game, 'a');
  for (const player of game.players) game.deck.push(...player.hand.splice(0));
  assert.ok(recipient.reserves >= 3);
  recipient.reserves -= 3;
  recipient.tanks += 3;
  const karamaId = moveSemutaEmperorCard(game, semutaEmperorCardId(game, card => card.effect === 'karama'), recipient.id);
  const semuta = moveSemutaEmperorCard(game, SEMUTA_DRUG_ID, holder.id);
  const karamaCard = recipient.hand.find(card => card.id === karamaId)!;
  const declare: Action = kind === 'emperorGift'
    ? { type: 'emperorGift', amount: 3 }
    : { type: 'emperorRevival', amount: 2 };
  return {
    game, owner: owner.id, holder: holder.id, recipient: recipient.id,
    karama: karamaId, karamaCard, semuta, kind, declare,
    cancel: { type: 'card', mode: 'cancel', card: karamaId },
  };
}
/** Resolve the neutral offer: a real commit (singleton completes directly) or all passes. */
export function reactSemutaEmperorShare(
  state: Game, fixture: SemutaEmperorShareFixture, claim: boolean,
): Game {
  const event = state.pendingTreacheryDiscard!.batch.event;
  if (claim) return applyAction(state, fixture.holder, { type: 'semutaCommit', event });
  let game = state;
  for (const player of state.players)
    game = applyAction(game, player.id, { type: 'semutaPass', event });
  return game;
}
export function semutaEmperorSharePhysical(game: Game) {
  return game.players.map(player => ({
    id: player.id, faction: player.faction, spice: player.spice, forces: player.forces,
    reserves: player.reserves, tanks: player.tanks, elites: player.elites,
    moved: player.moved, revived: player.revived,
  }));
}
export function semutaEmperorShareViews(game: Game): void {
  for (const player of game.players) viewGame(game, player.id);
}

/** Pass only original special costs/results; never skip a committed private selection. */
export function passSemutaSpecialDiscards(
  state: Game, actions?: { actor: string; action: Action }[],
): Game {
  let game = state;
  for (let n = 0; game.pendingTreacheryDiscard?.batch.cause.startsWith('specialKarama:') && n < 20; n++) {
    const pending = game.pendingTreacheryDiscard;
    const reaction = pending.reaction; assert.ok(reaction?.stage === 'offer');
    const event = pending.batch.event;
    for (const seat of game.players.filter(p => !reaction.passed.includes(p.id))) {
      const action: Action = { type: 'semutaPass', event };
      actions?.push({ actor: seat.id, action });
      game = applyAction(game, seat.id, action);
    }
  }
  assert.ok(!game.pendingTreacheryDiscard?.batch.cause.startsWith('specialKarama:'),
    'The native special discard continuation must actually retire.');
  return game;
}
