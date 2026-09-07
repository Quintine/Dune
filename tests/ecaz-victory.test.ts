import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAction,
  createGame,
  newPlayer,
  viewGame,
  type Game,
} from '../game/engine';
import { type FactionId } from '../game/catalog';
import { baseDeck } from '../game/cards';
import { territory } from '../game/board';
import { quoteVictory } from '../game/victory-quote';
import { strongholdProgress } from '../game/victory-progress';
import { createTechTokens } from '../game/tech-tokens';
import { createStrongholdCards } from '../game/stronghold-cards';
import { createTerrorState } from '../game/moritani-terror';
import { botActions } from '../game/bots';
import { createAmbassadors } from '../game/ecaz-ambassadors';
import {
  createRicheseNoField,
  deployRicheseNoField,
} from '../game/richese-no-field';

const THREE = ['arrakeen', 'carthag', 'sietch_tabr'];
const seat = (g: Game, id: string) => g.players.find((p) => p.id === id)!;
const json = (g: Game): Game => JSON.parse(JSON.stringify(g));

// Constructed, conserved development board; transitions into Mentat are real
// ready actions, not a production Ecaz-start or combined-combat claim.
function fixture(
  ally: FactionId = 'emperor',
  extra: FactionId[] = ['beneGesserit'],
  advanced = true,
) {
  const g = createGame(
    'ECAZVICTORY',
    newPlayer('ec', 'Ecaz', 'ecaz'),
    advanced,
    ['ecaz'],
  );
  g.players.push(newPlayer('al', 'Ally', ally));
  extra.forEach((f, i) => g.players.push(newPlayer(`x${i}`, f, f)));
  Object.assign(g, {
    status: 'playing',
    phase: 7,
    turn: 2,
    storm: 18,
    order: g.players.map((p) => p.id),
    active: null,
    ready: [],
    phaseOpening: null,
    deck: baseDeck(),
  });
  for (const p of g.players)
    Object.assign(p, {
      hand: [],
      forces: {},
      reserves: 20,
      spice: 20,
      traitors: [],
      traitorChoices: [],
    });
  seat(g, 'ec').ally = 'al';
  seat(g, 'al').ally = 'ec';
  seat(g, 'ec').allySinceTurn = 1;
  seat(g, 'al').allySinceTurn = 1;
  return g;
}
function occupy(g: Game, id: string, holds: string[]) {
  const p = seat(g, id);
  p.forces = Object.fromEntries(
    holds.map((t) => [`${t}:${territory(t).sectors[0]}`, 1]),
  );
  p.reserves = 20 - holds.length;
}
function joint(g: Game, holds = THREE) {
  occupy(g, 'ec', holds);
  occupy(g, 'al', holds);
  return g;
}
function mentat(state: Game) {
  let g = json(state);
  for (const p of state.players) g = applyAction(g, p.id, { type: 'ready' });
  assert.equal(g.phase, 8);
  return g;
}
function verdict(state: Game, winners: string[]) {
  const original = json(state);
  const input = json(state);
  input.phase = 8;
  const quote = quoteVictory(input);
  assert.deepEqual(quote.winner, winners);
  assert.deepEqual(state, original);
  const done = mentat(state);
  assert.deepEqual(done.winner, winners);
  assert.equal(done.status, winners.length ? 'finished' : 'playing');
  for (const p of state.players) {
    assert.deepEqual(seat(done, p.id).forces, p.forces);
    assert.equal(seat(done, p.id).reserves, p.reserves);
  }
  return done;
}

for (const advanced of [false, true])
  void test(`actual ${advanced ? 'Advanced' : 'Basic'} Mentat awards three jointly held strongholds to both Ecaz allies`, () => {
    const g = joint(fixture('emperor', ['beneGesserit'], advanced));
    const row = strongholdProgress(g).progress.find((p) => p.player === 'ec')!;
    assert.equal(row.target, 4);
    assert.equal(row.occupyTarget, 3);
    assert.deepEqual(new Set(row.jointlyOccupied), new Set(THREE));
    assert.equal(row.qualifies, true);
    assert.deepEqual(
      mentat(g).players.map((p) => p.hand.length),
      [0, 0, 0],
    );
    verdict(g, ['ec', 'al']);
  });

void test('a two-and-one distribution cannot win at three; ordinary four still wins without three joint locations', () => {
  const g = fixture();
  occupy(g, 'ec', ['arrakeen', 'carthag']);
  occupy(g, 'al', ['sietch_tabr']);
  verdict(g, []);
  occupy(g, 'al', ['sietch_tabr', 'tueks_sietch']);
  const row = strongholdProgress(g).progress.find((p) => p.player === 'al')!;
  assert.deepEqual(row.jointlyOccupied, []);
  assert.equal(row.strongholds.length, 4);
  verdict(g, ['ec', 'al']);
});

void test('two jointly held locations plus all Tech Tokens is not a third physical joint location', () => {
  const g = joint(fixture(), THREE.slice(0, 2));
  g.techTokens = createTechTokens();
  for (const token of Object.values(g.techTokens)) token.owner = 'al';
  const row = strongholdProgress(g).progress.find((p) => p.player === 'ec')!;
  assert.equal(row.techStronghold, true);
  assert.equal(row.jointlyOccupied.length, 2);
  assert.equal(row.qualifies, false);
  verdict(g, []);
  occupy(g, 'ec', THREE);
  verdict(g, ['ec', 'al']); // Three ordinary locations plus one owned bonus.
  g.techTokens.production.owner = 'ec';
  assert.equal(
    strongholdProgress(g).progress.find((p) => p.player === 'ec')!
      .techStronghold,
    false,
  );
  verdict(g, []);
});

void test('storm order changes presentation order, not which Ecaz alliance qualifies', () => {
  const g = joint(fixture());
  g.order = ['al', 'x0', 'ec'];
  verdict(g, ['al', 'ec']);
});

void test('correct BG prediction overrides either allied faction of an Ecaz joint-three winner only on its chosen turn', () => {
  for (const faction of ['ecaz', 'emperor'] as const) {
    const g = joint(fixture());
    seat(g, 'x0').prediction = { faction, turn: 2 };
    const publicBefore = strongholdProgress(g);
    verdict(g, ['x0']);
    seat(g, 'x0').prediction!.turn = 3;
    assert.deepEqual(strongholdProgress(g), publicBefore);
    verdict(g, ['ec', 'al']);
  }
});

void test('joint stronghold occupied solely by the pair counts under storm; opposing fighters remove it', () => {
  const g = joint(fixture('emperor', ['harkonnen']));
  g.storm = 10;
  verdict(g, ['ec', 'al']);
  occupy(g, 'x0', ['arrakeen']);
  assert.equal(
    strongholdProgress(g).progress.find((p) => p.player === 'ec')!
      .jointlyOccupied.length,
    2,
  );
  verdict(g, []);
});

void test('an allied BG advisor is not the second fighter, and unrelated BG advisors do not contest a joint win', () => {
  const g = joint(fixture('beneGesserit', ['emperor']));
  seat(g, 'al').advisors = { sietch_tabr: {} };
  assert.equal(strongholdProgress(g).released.length, 0);
  verdict(g, []);
  delete seat(g, 'al').advisors;
  verdict(g, ['ec', 'al']);
  const other = joint(fixture());
  occupy(other, 'x0', THREE);
  seat(other, 'x0').advisors = {
    arrakeen: {},
    carthag: {},
    sietch_tabr: {},
  };
  verdict(other, ['ec', 'al']);
});

void test('lone BG advisor release feeds ordinary progress but cannot manufacture a second joint occupier', () => {
  const g = fixture('beneGesserit', ['emperor']);
  occupy(g, 'ec', ['arrakeen', 'carthag']);
  occupy(g, 'al', ['sietch_tabr', 'tueks_sietch']);
  seat(g, 'al').advisors = { sietch_tabr: {}, tueks_sietch: {} };
  const progress = strongholdProgress(g);
  assert.equal(progress.released.length, 2);
  assert.deepEqual(
    progress.progress.find((p) => p.player === 'ec')!.jointlyOccupied,
    [],
  );
  const done = verdict(g, ['ec', 'al']);
  assert.equal(seat(done, 'al').advisors?.sietch_tabr, undefined);
});

void test('all three concealed No-Field values provide identical public joint occupation without revelation', () => {
  let publicResult: ReturnType<typeof strongholdProgress> | undefined;
  for (let index = 0; index < 3; index++) {
    const g = joint(fixture('richese'));
    occupy(g, 'al', THREE.slice(0, 2));
    const ids = ['field-zero', 'field-three', 'field-five'];
    seat(g, 'al').noField = deployRicheseNoField(createRicheseNoField(ids), {
      tokenId: ids[index],
      controller: 'al',
      location: { territory: 'sietch_tabr', sector: 14 },
    });
    const progress = strongholdProgress(g);
    if (publicResult) assert.deepEqual(progress, publicResult);
    publicResult = progress;
    const done = verdict(g, ['ec', 'al']);
    assert.deepEqual(seat(done, 'al').noField, seat(g, 'al').noField);
    const other = viewGame(done, 'ec').players.find((p) => p.id === 'al')!;
    assert.equal(JSON.stringify(other.noField).includes(ids[index]), false);
  }
});

void test('a placed HMS can be the third actual jointly held location and final cards remain controlled by Ecaz', () => {
  const g = joint(fixture('ixians'), THREE.slice(0, 2));
  g.mobileStronghold = { location: 'red_chasm:7' };
  for (const id of ['ec', 'al']) {
    seat(g, id).forces['hidden_mobile_stronghold:0'] = 1;
    seat(g, id).reserves--;
  }
  g.strongholdCards = createStrongholdCards();
  const done = verdict(g, ['ec', 'al']);
  assert.equal(done.strongholdCards!.owners.arrakeen, 'ec');
  assert.equal(done.strongholdCards!.owners.hidden_mobile_stronghold, 'ec');
  assert.equal(done.strongholdCards!.claimedTurn, 2);
});

void test('public progress never reads private prediction, cards, balances or No-Field token inventory', () => {
  const g = joint(fixture('richese'));
  const expected = strongholdProgress(g);
  for (const p of g.players)
    for (const key of ['hand', 'spice', 'prediction'])
      Object.defineProperty(p, key, {
        get() {
          throw Error(`Private ${key} read`);
        },
      });
  assert.deepEqual(strongholdProgress(g), expected);
  const tokens = createRicheseNoField(['n0', 'n3', 'n5']);
  seat(g, 'al').noField = tokens;
  Object.defineProperty(tokens, 'tokens', {
    get() {
      throw Error('Private No-Field inventory read');
    },
  });
  assert.deepEqual(strongholdProgress(g), expected);
});

for (const converted of [false, true])
  void test(`${converted ? 'BG-converted' : 'printed'} cancellation of genuine Moritani placement preserves the Ecaz joint victory`, () => {
    let g = joint(fixture('emperor', ['moritani', 'beneGesserit']));
    g.moritaniTerror = createTerrorState(() => 0.4);
    const actor = converted ? 'x1' : 'al';
    const index = g.deck.findIndex(
      (c) => c.name === (converted ? 'Baliset' : 'Karama'),
    );
    assert.ok(index >= 0);
    const card = g.deck.splice(index, 1)[0];
    seat(g, actor).hand.push(card);
    if (converted) {
      // A real remaining blocker keeps the conversion open for JSON recovery.
      const blocker = g.deck.findIndex((c) => c.name === 'Karama');
      assert.ok(blocker >= 0);
      seat(g, 'ec').hand.push(g.deck.splice(blocker, 1)[0]);
    }
    g = mentat(g);
    assert.equal(g.status, 'playing');
    assert.equal(g.decision?.kind, 'moritaniPlacement');
    const token = g.moritaniTerror!.tokens[0].id;
    g = applyAction(g, 'x0', {
      type: 'decision',
      token,
      territory: 'tueks_sietch',
    });
    assert.equal(g.response?.kind, 'moritaniPlacement');
    const source = json(g);
    g = applyAction(g, actor, { type: 'card', card: card.id, mode: 'cancel' });
    if (converted) assert.equal(g.response?.kind, 'worthlessKarama');
    for (let n = 0; g.response && n < 20; n++) {
      const responder = g.players.find(
        (p) => !g.response!.passed.includes(p.id),
      )!;
      g = applyAction(json(g), responder.id, { type: 'passResponse' });
    }
    assert.equal(g.response, null);
    assert.deepEqual(g.winner, ['ec', 'al']);
    assert.equal(g.status, 'finished');
    assert.equal(g.discard.filter((c) => c.id === card.id).length, 1);
    assert.deepEqual(g.moritaniTerror!.tokens, source.moritaniTerror!.tokens);
    assert.equal(g.moritaniTerror!.placementTurn, 2);
    for (const id of ['ec', 'al'])
      assert.deepEqual(seat(g, id).forces, seat(source, id).forces);
  });

for (const level of ['Hard', 'Brutal'] as const)
  void test(`${level} prioritizes a legal shipment completing the third joint stronghold`, () => {
    const g = joint(
      fixture('emperor', ['harkonnen'], false),
      THREE.slice(0, 2),
    );
    occupy(g, 'al', THREE);
    Object.assign(g, {
      phase: 5,
      active: 'ec',
      movementRemaining: [...g.order],
    });
    const view = viewGame(g, 'ec');
    view.players.find((p) => p.id === 'ec')!.bot = level;
    const before = structuredClone(view);
    const actions = botActions(view);
    assert.deepEqual(view, before);
    const action = actions.find((a) => a.type === 'ship');
    assert.ok(action);
    assert.equal(action.territory, 'sietch_tabr');
    const moved = applyAction(g, 'ec', action);
    assert.equal(moved.phase, 5);
    assert.equal(moved.status, 'playing');
    assert.equal(
      strongholdProgress(moved).progress.find((p) => p.player === 'ec')!
        .jointlyOccupied.length,
      3,
    );
  });

void test('Brutal Guild takes its real timing opportunity against a joint-two threat, and waits when that public threat is absent', () => {
  for (const threatened of [false, true]) {
    let g = joint(
      fixture('emperor', ['guild']),
      threatened ? THREE.slice(0, 2) : THREE.slice(0, 1),
    );
    g.phase = 4;
    g.ecazAmbassadors = createAmbassadors(() => 0.4);
    for (const p of g.players) g = applyAction(g, p.id, { type: 'ready' });
    assert.equal(g.decision?.kind, 'ecazPlacement');
    g = applyAction(g, 'ec', { type: 'decision', decline: true });
    assert.equal(g.phase, 5);
    assert.equal(g.decision?.kind, 'guildTiming');
    const view = viewGame(g, 'x0');
    view.players.find((p) => p.id === 'x0')!.bot = 'Brutal';
    const action = botActions(view)[0];
    assert.equal(action.type, 'decision');
    assert.equal(action.take, threatened);
    const done = applyAction(g, 'x0', action);
    assert.equal(done.active, threatened ? 'x0' : 'ec');
    assert.deepEqual(done.order, g.order);
  }
});
