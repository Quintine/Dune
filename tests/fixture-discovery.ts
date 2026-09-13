import assert from 'node:assert/strict';
import {
  applyAction,
  createGame,
  initializeDiscoveryGameForAudit,
  joinGame,
  newPlayer,
  viewGame,
  type Game,
} from '../game/engine';
import { botActions } from '../game/bots';
import {
  placeDiscovery,
  type DiscoverySpiceCardId,
  type DiscoveryTokenFace,
} from '../game/discoveries';

export function discoveryLobby(
  advanced = false,
  ids: [string, string, string] = ['a', 'g', 'f'],
): Game {
  let g = createGame(
    'DISCQA01',
    newPlayer(ids[0], 'Atreides', 'atreides'),
    advanced,
    [],
  );
  joinGame(g, newPlayer(ids[1], 'Guild', 'guild'));
  joinGame(g, newPlayer(ids[2], 'Fremen', 'fremen'));
  for (const p of g.players) g = applyAction(g, p.id, { type: 'ready' });
  g.discoveryEnabled = true;
  return g;
}
export function discoveryFixture(
  advanced = false,
  ids: [string, string, string] = ['a', 'g', 'f'],
): Game {
  let g = initializeDiscoveryGameForAudit(discoveryLobby(advanced, ids));
  for (let step = 0; step < 80 && g.status === 'setup'; step++) {
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
    assert.ok(
      next,
      `Discovery setup stalled at ${g.setupStage}/${g.decision?.kind}`,
    );
    g = next;
  }
  assert.equal(g.status, 'playing');
  return g;
}
export function putDiscovery(g: Game, face: DiscoveryTokenFace) {
  const source = g.discoveries!.tokens.find((token) => token.face === face)!;
  const card: DiscoverySpiceCardId =
    source.type === 'hiereg'
      ? 'discovery-hagga-basin'
      : 'discovery-wind-pass-north';
  const eligible = g.discoveries!.tokens.filter(
    (token) => token.type === source.type && token.status === 'supply',
  );
  const index = eligible.findIndex((token) => token.face === face);
  assert.ok(index >= 0);
  g.discoveries = placeDiscovery(
    g.discoveries!,
    card,
    () => (index + 0.1) / eligible.length,
  );
  return g.discoveries.tokens.find((token) => token.face === face)!;
}
export function enterDiscoveryCollection(
  g: Game,
  face: DiscoveryTokenFace,
  owner = g.players[0].id,
) {
  const token = putDiscovery(g, face),
    p = g.players.find((player) => player.id === owner)!;
  const key = `${token.territory}:${token.sector}`;
  p.reserves -= 2;
  p.forces[key] = (p.forces[key] ?? 0) + 2;
  Object.assign(g, {
    phase: 7,
    ready: [],
    decision: null,
    response: null,
    phaseOpening: null,
    storm: 18,
    stormPending: null,
  });
  return token;
}
