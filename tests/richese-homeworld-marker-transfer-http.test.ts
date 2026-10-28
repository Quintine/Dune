// @dune-suite integration
import assert from 'node:assert/strict';
import test from 'node:test';
import { TERRITORIES } from '../game/board';
import { botActions } from '../game/bots';
import { richeseHomeworldMarkerChoice } from '../game/homeworld-shipment-options';
import type { Action, GameView } from '../game/engine';

const base = process.env.DUNE_TEST_URL ?? 'http://localhost:3000';
async function request(path: string, cookie?: string, body?: unknown) {
  const response = await fetch(base + path, {
    method: body === undefined ? 'GET' : 'POST', signal: AbortSignal.timeout(15_000),
    headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(cookie ? { cookie } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: response.status, cookie: response.headers.get('set-cookie')?.split(';')[0],
    data: await response.json() as GameView & { error?: string } };
}

/** A fresh room uses real human seat credentials and native legal actions.
 * No server phase, currency, force, token, or card state is manufactured. */
void test('authenticated marker transfer retains its hidden identity between foreign Homeworlds', async () => {
  const host = await request('/api/rooms', undefined, {
    name: 'Marker origin world', faction: 'atreides', advanced: false, expansions: ['choam'],
  });
  assert.equal(host.status, 201, JSON.stringify(host.data)); assert.ok(host.cookie);
  const path = `/api/rooms/${host.data.code}`;
  const owner = await request(path, undefined, { type: 'join', name: 'Marker owner', faction: 'richese' });
  assert.equal(owner.status, 200, JSON.stringify(owner.data)); assert.ok(owner.cookie);
  const guild = await request(path, undefined, { type: 'join', name: 'Marker destination world', faction: 'guild' });
  assert.equal(guild.status, 200, JSON.stringify(guild.data)); assert.ok(guild.cookie);
  const seats = [host, owner, guild].map(result => ({ cookie: result.cookie!, id: result.data.me }));
  const ownerSeat = seats[1], hostSeat = seats[0], guildSeat = seats[2];
  let view = guild.data;
  const act = async (cookie: string, action: Action) => {
    const next = await request(path, cookie, { version: view.version, action });
    assert.equal(next.status, 200, `Rejected ${action.type}: ${JSON.stringify(next.data)}`);
    view = next.data; return next.data;
  };
  const read = async (cookie: string) => {
    const result = await request(path, cookie);
    assert.equal(result.status, 200, JSON.stringify(result.data));
    view = result.data; return result.data;
  };
  await act(hostSeat.cookie, { type: 'homeworlds', enabled: true });
  for (const seat of seats) await act(seat.cookie, { type: 'ready' });
  await act(hostSeat.cookie, { type: 'start' });

  let firstMarkerPlaced = false;
  async function advance(until: (ownerView: GameView) => boolean) {
    for (let count = 0; count < 800; count++) {
      const currentOwner = await read(ownerSeat.cookie);
      if (until(currentOwner)) return currentOwner;
      assert.notEqual(currentOwner.status, 'finished', 'The QA game ended before marker transfer.');

      // Atreides sends its actual reserves away from its World, so the
      // concealed marker can remain there through the next Battle phase.
      if (currentOwner.status === 'playing' && currentOwner.phase === 5 && currentOwner.active === hostSeat.id &&
          !currentOwner.response && !currentOwner.decision && !currentOwner.phaseOpening &&
          !currentOwner.truthtrance) {
        const at = await read(hostSeat.cookie);
        const me = at.players.find(player => player.id === hostSeat.id)!;
        if (!me.shipped && me.reserves > 0) {
          let accepted = false;
          for (const territory of TERRITORIES.filter(item => item.type === 'stronghold')) {
            for (const sector of territory.sectors) {
              if (sector === at.storm) continue;
              const attempt = await request(path, hostSeat.cookie, { version: view.version, action: {
                type: 'ship', territory: territory.id, sector, amount: me.reserves, elite: 0,
                allyPayment: 0, homeworldSources: { 'homeworld:atreides': { normal: me.reserves, elite: 0 } },
              } });
              if (attempt.status === 200) { view = attempt.data; accepted = true; break; }
              assert.equal(attempt.status, 409, JSON.stringify(attempt.data));
            }
            if (accepted) break;
          }
          assert.ok(accepted, 'Atreides can ship its physical reserves to an available stronghold.');
          continue;
        }
      }

      let proposed: { cookie: string; actor: string; action: Action } | null = null;
      for (const seat of seats) {
        const own = await read(seat.cookie);
        const local = structuredClone(own);
        const self = local.players.find(player => player.id === seat.id); assert.ok(self);
        self.bot = 'Easy'; // Client-side adapter only; authoritative seat stays human.
        const choices = botActions(local);
        if (choices.length) { proposed = { cookie: seat.cookie, actor: seat.id, action: choices[0] }; break; }
      }
      assert.ok(proposed, `No native continuation at ${currentOwner.status}/${currentOwner.phase}/${currentOwner.decision?.kind ?? 'no decision'}.`);
      if (view.response && !view.response.passed.includes(view.me)) proposed.action = { type: 'passResponse' };
      // Keep the actual Atreides shipment affordable and avoid extra foreign
      // arrivals to the temporary marker World; all passes/skips are legal.
      else if (proposed.actor === hostSeat.id && proposed.action.type === 'bid') proposed.action = { type: 'passBid' };
      else if (proposed.actor === hostSeat.id && proposed.action.type === 'richeseBid')
        proposed.action = { type: 'richeseBid', event: proposed.action.event, amount: 0, allyPayment: 0 };
      else if (view.phase === 5 && view.active === proposed.actor && !view.response && !view.decision &&
               !view.truthtrance && !view.phaseOpening &&
               (proposed.actor === guildSeat.id || proposed.actor === ownerSeat.id && firstMarkerPlaced))
        proposed.action = { type: 'endMovement' };
      await act(proposed.cookie, proposed.action);
    }
    throw Error('The dedicated HTTP room did not reach the native marker transfer boundary.');
  }

  const first = await advance(own => own.status === 'playing' && own.phase === 5 && own.active === own.me &&
    !own.players.find(player => player.id === own.me)!.shipped &&
    own.players.find(player => player.id === hostSeat.id)!.reserves === 0 &&
    !!own.homeworldShipment && !own.homeworldShipment.blocked && !!own.richeseNoField?.canShip);
  const markerInfo = first.richeseNoField!; assert.ok(markerInfo.private);
  const token = markerInfo.private.tokens.find(candidate => candidate.id !== markerInfo.private!.lastShipped);
  assert.ok(token);
  const ids = markerInfo.private.tokens.map(candidate => candidate.id);
  const initial = richeseHomeworldMarkerChoice(first, 'homeworld:atreides', token.id);
  assert.ok(initial.action, initial.blocked ?? 'The initial marker shipment is available.');
  await act(ownerSeat.cookie, initial.action);
  firstMarkerPlaced = true;
  const landed = await advance(own => own.phase === 5 && !!own.richeseNoField?.private?.deployed &&
    own.players.find(player => player.id === own.me)?.shipped === true);
  assert.deepEqual(landed.richeseNoField!.private!.deployed!.location, { homeworld: 'homeworld:atreides' });
  const firstTurn = landed.turn;
  const beforeTransfer = await advance(own => own.status === 'playing' && own.turn > firstTurn && own.phase === 5 &&
    own.active === own.me && !own.players.find(player => player.id === own.me)!.shipped &&
    !!own.homeworldShipment && !own.homeworldShipment.blocked && !!own.richeseNoField?.private?.deployed);
  const mover = beforeTransfer.players.find(player => player.id === beforeTransfer.me)!;
  const oldSpice = mover.spice, oldReserves = mover.reserves;
  const transfer = richeseHomeworldMarkerChoice(beforeTransfer, 'homeworld:guild', token.id, 0, 'homeworld:atreides');
  assert.ok(transfer.action, transfer.blocked ?? 'The marker transfer is available.');
  assert.equal(transfer.action.noFieldFrom, 'homeworld:atreides');
  await act(ownerSeat.cookie, transfer.action);
  const after = await advance(own => own.phase === 5 && own.players.find(player => player.id === own.me)?.shipped === true &&
    !!own.richeseNoField?.private?.deployed && 'homeworld' in own.richeseNoField.private.deployed.location &&
    own.richeseNoField.private.deployed.location.homeworld === 'homeworld:guild');
  const result = after.players.find(player => player.id === after.me)!;
  assert.equal(result.spice, oldSpice! - 1); assert.equal(result.reserves, oldReserves);
  assert.equal(after.richeseNoField!.private!.deployed!.tokenId, token.id);
  assert.equal(after.richeseNoField!.private!.lastShipped, token.id);
  const other = await read(hostSeat.cookie);
  assert.equal(other.richeseNoField!.private, null);
  assert.deepEqual(other.richeseNoField!.public.deployed!.location, { homeworld: 'homeworld:guild' });
  for (const id of ids) assert.equal(JSON.stringify(other).includes(id), false, 'A foreign seat cannot inspect marker identity.');
});
