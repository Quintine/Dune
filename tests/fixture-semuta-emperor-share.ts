import assert from 'node:assert/strict';
import {
  applyAction, createGame, initializeSemutaGameForAudit, joinGame, newPlayer,
  viewGame, type Action, type Game, type Player,
} from '../game/engine';
import { baseDeck, spiceDeck } from '../game/cards';
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
/** Genuine three-seat Richese/Emperor/Atreides Semuta setup; only the clock,
 *  phase, alliance, active seat and later held cards are conserved. */
export function createSemutaEmperorShareFixture(kind: SemutaEmperorShareKind): SemutaEmperorShareFixture {
  let game = createGame('SEMUTAEMPEROR', newPlayer('r', 'Richese', 'richese'), false, ['choam']);
  joinGame(game, newPlayer('e', 'Emperor', 'emperor'));
  joinGame(game, newPlayer('a', 'Atreides', 'atreides'));
  for (const player of game.players) player.ready = true;
  game = initializeSemutaGameForAudit(game);
  game.status = 'playing';
  game.phase = kind === 'emperorRevival' ? 4 : 2;
  game.turn = 2;
  game.storm = 18;
  game.active = 'r';
  game.order = ['r', 'e', 'a'];
  game.ready = [];
  game.decision = null;
  game.response = null;
  game.phaseOpening = null;
  game.deck = baseDeck();
  game.spiceDeck = spiceDeck();
  const owner = semutaEmperorPlayer(game, 'e'), holder = semutaEmperorPlayer(game, 'r');
  const recipient = semutaEmperorPlayer(game, 'a');
  for (const player of game.players) { player.hand = []; player.spice = 20; player.forces = {}; }
  owner.ally = recipient.id;
  recipient.ally = owner.id;
  recipient.tanks = 3;
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
