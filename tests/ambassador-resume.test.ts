import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, newPlayer, type Game } from '../game/engine';
import {
  validAmbassadorResume,
  type AmbassadorResumeEntry,
} from '../game/ambassador-resume';

function fixture() {
  const g = createGame('AMB-RESUME', newPlayer('e', 'Ecaz', 'ecaz'), true);
  g.players.push(
    newPlayer('f', 'Fremen', 'fremen'),
    newPlayer('b', 'BG', 'beneGesserit'),
    newPlayer('p', 'Guild shipper', 'ixians'),
  );
  g.phase = 1;
  const entry: AmbassadorResumeEntry = {
    event: 'child-entry',
    entrant: 'b',
    territory: 'carthag',
    sector: 11,
    resume: 'wormRide',
    wormRider: 'f',
    guildAdvisorOrigin: {
      event: 'completed-guild-entry',
      player: 'p',
      territory: 'carthag',
      sector: 11,
    },
  };
  return { g, entry };
}
void test('legacy direct worm entries and newly stamped direct entries retain their original rider', () => {
  const { g } = fixture();
  const legacy: AmbassadorResumeEntry = {
    event: 'direct',
    entrant: 'f',
    territory: 'arrakeen',
    sector: 10,
    resume: 'wormRide',
  };
  assert.equal(validAmbassadorResume(g, legacy), true);
  assert.equal(validAmbassadorResume(g, { ...legacy, wormRider: 'f' }), true);
  assert.equal(validAmbassadorResume(g, { ...legacy, wormRider: 'p' }), false);
  assert.equal(validAmbassadorResume(g, { ...legacy, entrant: 'b' }), false);
  g.phase = 5;
  assert.equal(validAmbassadorResume(g, legacy), false);
});
void test('BG tail entry inherits the explicit Fremen rider across JSON without current-board or alliance requirements', () => {
  const { g, entry } = fixture();
  for (const p of g.players) {
    p.ally = null;
    p.forces = {};
    p.reserves = 0;
    p.tanks = 20;
    p.hand = [];
  }
  g.storm = 11;
  const before = JSON.stringify({ g, entry });
  for (let i = 0; i < 3; i++)
    assert.equal(
      validAmbassadorResume(
        JSON.parse(JSON.stringify(g)),
        JSON.parse(JSON.stringify(entry)),
      ),
      true,
    );
  assert.equal(JSON.stringify({ g, entry }), before);
  delete entry.wormRider;
  assert.equal(validAmbassadorResume(g, entry), false);
});
void test('non-worm tail entries require no rider and accept only granted arrival sectors', () => {
  const { g, entry } = fixture();
  g.phase = 5;
  entry.resume = 'none';
  delete entry.wormRider;
  assert.equal(validAmbassadorResume(g, entry), true);
  const polar = { ...entry, territory: 'polar_sink', sector: 0 };
  assert.equal(validAmbassadorResume(g, polar), true);
  assert.equal(validAmbassadorResume(g, { ...polar, sector: 1 }), false);
  assert.equal(
    validAmbassadorResume(g, { ...entry, territory: 'arrakeen', sector: 10 }),
    false,
  );
  assert.equal(validAmbassadorResume(g, { ...entry, wormRider: 'f' }), false);
  const direct = { ...entry };
  delete direct.guildAdvisorOrigin;
  assert.equal(validAmbassadorResume(g, direct), true);
});
void test('tail witness rejects changed identity, source event, malformed locations and unsupported original shippers', () => {
  const changes: ((g: Game, entry: AmbassadorResumeEntry) => void)[] = [
    (_, e) => {
      e.guildAdvisorOrigin!.event = e.event;
    },
    (_, e) => {
      e.guildAdvisorOrigin!.event = '';
    },
    (_, e) => {
      e.event = '';
    },
    (_, e) => {
      e.entrant = 'p';
    },
    (_, e) => {
      e.guildAdvisorOrigin!.player = 'b';
    },
    (_, e) => {
      e.guildAdvisorOrigin!.player = 'f';
    },
    (_, e) => {
      e.guildAdvisorOrigin!.player = 'missing';
    },
    (_, e) => {
      e.guildAdvisorOrigin!.sector = 0;
    },
    (_, e) => {
      e.guildAdvisorOrigin!.territory = 'reserves';
    },
    (_, e) => {
      e.sector = 12;
    },
    (_, e) => {
      e.wormRider = 'missing';
    },
    (_, e) => {
      e.wormRider = '';
    },
    (_, e) => {
      delete e.guildAdvisorOrigin;
    },
    (g) => {
      g.phase = 5;
    },
    (g) => {
      g.players.push({ ...g.players[1] });
    },
    (g) => {
      g.players.push({ ...g.players[2] });
    },
    (g) => {
      g.players.push({ ...g.players[3] });
    },
    (_, e) => {
      Object.assign(e, { resume: 'forged' });
    },
    (_, e) => {
      Object.assign(e, { guildAdvisorOrigin: null });
    },
  ];
  for (const change of changes) {
    const { g, entry } = fixture();
    change(g, entry);
    const before = JSON.stringify({ g, entry });
    assert.equal(validAmbassadorResume(g, entry), false);
    assert.equal(JSON.stringify({ g, entry }), before);
  }
});
void test('historical HMS source does not re-read mobile pointer or concealed custody', () => {
  const { g, entry } = fixture();
  Object.assign(entry, { territory: 'hidden_mobile_stronghold', sector: 0 });
  Object.assign(entry.guildAdvisorOrigin!, {
    territory: 'hidden_mobile_stronghold',
    sector: 0,
  });
  g.mobileStronghold = { location: null };
  assert.equal(validAmbassadorResume(g, entry), true);
  g.mobileStronghold.location = 'hagga_basin:12';
  assert.equal(validAmbassadorResume(g, entry), true);
});
