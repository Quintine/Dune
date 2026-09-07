import test from 'node:test';
import assert from 'node:assert/strict';
import { quoteVictory, VictoryQuoteError } from '../game/victory-quote';
import {
  applyAction,
  createGame,
  newPlayer,
  viewGame,
  type Game,
} from '../game/engine';
import { type FactionId } from '../game/catalog';
import { territory } from '../game/board';
import { createTechTokens } from '../game/tech-tokens';
import { createStrongholdCards } from '../game/stronghold-cards';
import { createTerrorState } from '../game/moritani-terror';
import { baseDeck } from '../game/cards';
import {
  createRicheseNoField,
  deployRicheseNoField,
} from '../game/richese-no-field';

function fixture(
  factions: FactionId[] = ['atreides', 'emperor', 'beneGesserit'],
  advanced = true,
) {
  const g = createGame(
    'VICTORYQUOTE',
    newPlayer('p0', factions[0], factions[0]),
    advanced,
  );
  factions
    .slice(1)
    .forEach((f, i) => g.players.push(newPlayer(`p${i + 1}`, f, f)));
  Object.assign(g, {
    status: 'playing',
    phase: 8,
    turn: 2,
    storm: 18,
    order: g.players.map((p) => p.id),
    ready: [],
    phaseOpening: null,
    deck: baseDeck(),
    active: null,
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
  return g;
}
function occupy(g: Game, index: number, ...holds: string[]) {
  g.players[index].forces = Object.fromEntries(
    holds.map((t) => [`${t}:${territory(t).sectors[0]}`, 1]),
  );
}
function actual(g: Game) {
  g = structuredClone(g);
  g.phase = 7;
  for (const p of g.players) g = applyAction(g, p.id, { type: 'ready' });
  return g;
}
function compare(g: Game, winner: string[]) {
  const before = structuredClone(g),
    q = quoteVictory(g),
    done = actual(g);
  assert.deepEqual(q.winner, winner);
  assert.deepEqual(done.winner, q.winner);
  assert.equal(done.status, q.status);
  assert.deepEqual(g, before);
  if (q.strongholds) assert.deepEqual(done.strongholdCards, q.strongholds);
  for (const release of q.released)
    assert.equal(
      done.players.find((p) => p.id === release.player)!.advisors?.[
        release.territory
      ],
      undefined,
    );
  return q;
}
void test('three normal holds win; storm-covered sole occupancy counts and contested occupancy does not', () => {
  const g = fixture();
  occupy(g, 0, 'arrakeen', 'carthag', 'sietch_tabr');
  g.storm = 10;
  compare(g, ['p0']);
  occupy(g, 1, 'arrakeen');
  compare(g, []);
});
void test('two seats require four normal holds', () => {
  const g = fixture(['atreides', 'emperor'], false);
  occupy(g, 0, 'arrakeen', 'carthag', 'sietch_tabr');
  compare(g, []);
  g.players[0].forces['tueks_sietch:5'] = 1;
  compare(g, ['p0']);
});
void test('allies combine sole team occupancy at four, including a shared allied stronghold', () => {
  const g = fixture();
  g.players[0].ally = 'p1';
  g.players[1].ally = 'p0';
  occupy(g, 0, 'arrakeen', 'carthag');
  occupy(g, 1, 'carthag', 'sietch_tabr');
  compare(g, []);
  g.players[1].forces['tueks_sietch:5'] = 1;
  assert.deepEqual(compare(g, ['p0', 'p1']).winner, ['p0', 'p1']);
  g.order = ['p1', 'p0', 'p2'];
  compare(g, ['p1', 'p0']);
});
void test('one owner must hold all three tech tokens; splitting them between allies adds no hold', () => {
  const g = fixture();
  g.techTokens = createTechTokens();
  for (const token of Object.values(g.techTokens)) token.owner = 'p0';
  occupy(g, 0, 'arrakeen', 'carthag');
  compare(g, ['p0']);
  g.players[0].ally = 'p1';
  g.players[1].ally = 'p0';
  occupy(g, 1, 'sietch_tabr');
  compare(g, ['p0', 'p1']);
  g.techTokens.production.owner = 'p1';
  compare(g, []);
});
void test('unaccompanied Advanced advisors release before victory, while occupied advisors do not contest', () => {
  const g = fixture();
  occupy(g, 2, 'arrakeen', 'carthag', 'sietch_tabr');
  g.players[2].advisors = { arrakeen: {}, carthag: {}, sietch_tabr: {} };
  assert.equal(compare(g, ['p2']).released.length, 3);
  occupy(g, 0, 'arrakeen', 'carthag', 'sietch_tabr');
  assert.equal(compare(g, ['p0']).released.length, 0);
});
void test('concealed No-Field presence and placed mobile stronghold count without secret values', () => {
  const g = fixture(['richese', 'emperor', 'beneGesserit']);
  occupy(g, 0, 'arrakeen', 'carthag');
  // Public projection deliberately omits the concealed token identity/value.
  g.players[0].noField = {
    deployed: { location: { territory: 'sietch_tabr', sector: 14 } },
  } as NonNullable<Game['players'][number]['noField']>;
  assert.deepEqual(quoteVictory(g).winner, ['p0']);
  Object.defineProperty(g.players[0].noField, 'tokens', {
    get() {
      throw Error('Secret inventory read');
    },
  });
  assert.deepEqual(quoteVictory(g).winner, ['p0']);
  delete g.players[0].noField;
  g.mobileStronghold = { location: 'red_chasm:7' };
  g.players[0].forces['hidden_mobile_stronghold:0'] = 1;
  compare(g, ['p0']);
});
void test('normal prediction overrides an allied winner, and wrong-turn prediction does not', () => {
  const g = fixture();
  g.players[0].ally = 'p1';
  g.players[1].ally = 'p0';
  occupy(g, 0, 'arrakeen', 'carthag');
  occupy(g, 1, 'sietch_tabr', 'tueks_sietch');
  g.players[2].prediction = { faction: 'emperor', turn: 2 };
  compare(g, ['p2']);
  g.players[2].prediction.turn = 3;
  compare(g, ['p0', 'p1']);
});
void test('actual final victory counts every concealed No-Field value as one and preserves its secrecy', () => {
  for (const index of [0, 1, 2]) {
    const g = fixture(['richese', 'emperor', 'beneGesserit']);
    occupy(g, 0, 'arrakeen', 'carthag');
    const ids = ['field-zero', 'field-three', 'field-five'];
    g.players[0].noField = deployRicheseNoField(createRicheseNoField(ids), {
      tokenId: ids[index],
      controller: 'p0',
      location: { territory: 'sietch_tabr', sector: 14 },
    });
    compare(g, ['p0']);
    const done = actual(g);
    assert.deepEqual(done.players[0].noField, g.players[0].noField);
    assert.equal(done.players[0].reserves, g.players[0].reserves);
  }
});
for (const predicted of ['atreides', 'fremen', 'guild'] as const)
  void test(`final-turn prediction preserves the existing ${predicted} fallback treatment`, () => {
    const g = fixture(['beneGesserit', predicted, 'emperor']);
    g.turn = 10;
    g.players[0].prediction = { faction: predicted, turn: 10 };
    occupy(g, 1, 'arrakeen', 'carthag');
    occupy(g, 2, 'sietch_tabr');
    compare(g, [predicted === 'atreides' ? 'p0' : 'p1']);
  });
void test('Fremen special conditions precede Guild, normal victory precedes fallback, and missing Guild permits Fremen fallback', () => {
  const g = fixture(['fremen', 'atreides', 'guild']);
  g.turn = 10;
  compare(g, ['p0']);
  occupy(g, 1, 'sietch_tabr');
  compare(g, ['p2']);
  occupy(g, 1, 'sietch_tabr', 'arrakeen', 'carthag');
  compare(g, ['p1']);
  const absent = fixture(['fremen', 'atreides', 'emperor']);
  absent.turn = 10;
  occupy(absent, 1, 'sietch_tabr');
  compare(absent, ['p0']);
});
void test('Richese presence at Tuek prevents only the Advanced Fremen special fallback', () => {
  const g = fixture(['fremen', 'richese', 'guild']);
  g.turn = 10;
  occupy(g, 1, 'tueks_sietch');
  compare(g, ['p2']);
  g.advanced = false;
  compare(g, ['p0']);
});
void test('individual final scores include ties and individual tech, and do not end earlier turns', () => {
  const g = fixture(['atreides', 'emperor', 'harkonnen']);
  occupy(g, 0, 'arrakeen');
  occupy(g, 1, 'carthag');
  compare(g, []);
  g.turn = 10;
  compare(g, ['p0', 'p1']);
  g.techTokens = createTechTokens();
  for (const token of Object.values(g.techTokens)) token.owner = 'p1';
  compare(g, ['p1']);
});
void test('final Stronghold ownership is exact, settles released advisors and Ecaz shared control, and is idempotent', () => {
  const g = fixture(['ecaz', 'emperor', 'beneGesserit']);
  g.strongholdCards = createStrongholdCards();
  g.players[0].ally = 'p1';
  g.players[1].ally = 'p0';
  occupy(g, 0, 'arrakeen', 'carthag');
  occupy(g, 1, 'carthag', 'sietch_tabr', 'tueks_sietch');
  occupy(g, 2, 'habbanya_ridge_sietch');
  g.players[2].advisors = { habbanya_ridge_sietch: {} };
  const q = compare(g, ['p0', 'p1']);
  assert.equal(q.strongholds!.owners.carthag, 'p0');
  assert.equal(q.strongholds!.owners.habbanya_ridge_sietch, 'p2');
  assert.equal(q.strongholds!.claimedTurn, 2);
  const done = actual(g);
  assert.equal(quoteVictory(done).strongholds, null);
});
void test('an already-claimed current-turn module is not settled again or subjected to a new end-Mentat gate', () => {
  const g = fixture();
  occupy(g, 0, 'arrakeen', 'carthag', 'sietch_tabr');
  g.strongholdCards = createStrongholdCards();
  g.strongholdCards.claimedTurn = g.turn;
  g.strongholdCards.owners.arrakeen = 'p1';
  g.phase = 7;
  const before = structuredClone(g.strongholdCards);
  assert.equal(quoteVictory(g).strongholds, null);
  assert.deepEqual(g.strongholdCards, before);
});
void test('public board quote never reads hands, reserves, leaders, spice or other seat predictions and allocates no RNG/event', () => {
  const g = fixture();
  occupy(g, 0, 'arrakeen', 'carthag', 'sietch_tabr');
  g.players[2].prediction = { faction: 'atreides', turn: 3 };
  const before = structuredClone(g),
    expected = quoteVictory(g);
  assert.deepEqual(g, before);
  for (const p of g.players) {
    for (const key of ['hand', 'traitors', 'reserves', 'spice', 'leaders'])
      Object.defineProperty(p, key, {
        get() {
          throw Error(`Private ${key} read`);
        },
      });
    if (p.faction !== 'beneGesserit')
      Object.defineProperty(p, 'prediction', {
        get() {
          throw Error('Unrelated prediction read');
        },
      });
  }
  const random = Math.random,
    uuid = Object.getOwnPropertyDescriptor(crypto, 'randomUUID');
  Math.random = () => {
    throw Error('RNG called');
  };
  crypto.randomUUID = () => {
    throw Error('Event allocated');
  };
  try {
    assert.deepEqual(quoteVictory(g), expected);
  } finally {
    Math.random = random;
    if (uuid) Object.defineProperty(crypto, 'randomUUID', uuid);
    else Reflect.deleteProperty(crypto, 'randomUUID');
  }
  assert.equal('prediction' in expected, false);
});

const corruptions: [string, (g: Game) => void][] = [
  [
    'absent ally',
    (g) => {
      g.players[0].ally = 'absent';
    },
  ],
  [
    'nonreciprocal ally',
    (g) => {
      g.players[0].ally = 'p1';
    },
  ],
  [
    'self ally',
    (g) => {
      g.players[0].ally = 'p0';
    },
  ],
  [
    'duplicate order',
    (g) => {
      g.order = ['p0', 'p0', 'p2'];
    },
  ],
  [
    'foreign winner',
    (g) => {
      g.winner = ['absent'];
    },
  ],
  [
    'duplicate winner',
    (g) => {
      g.winner = ['p0', 'p0'];
    },
  ],
  [
    'negative force',
    (g) => {
      g.players[0].forces['arrakeen:10'] = -1;
    },
  ],
  [
    'invalid sector',
    (g) => {
      g.players[0].forces['arrakeen:8'] = 1;
    },
  ],
  [
    'force overflow',
    (g) => {
      g.players[0].forces = {
        'arrakeen:10': Number.MAX_SAFE_INTEGER,
        'carthag:11': 1,
      };
    },
  ],
  [
    'invalid tech owner',
    (g) => {
      g.techTokens = createTechTokens();
      g.techTokens.production.owner = 'absent';
    },
  ],
  [
    'missing tech identity',
    (g) => {
      g.techTokens = {} as NonNullable<Game['techTokens']>;
    },
  ],
  [
    'invalid prediction target',
    (g) => {
      g.players[2].prediction = { faction: 'fremen', turn: 2 };
    },
  ],
  [
    'stale Stronghold turn',
    (g) => {
      g.strongholdCards = createStrongholdCards();
      g.strongholdCards.claimedTurn = 3;
    },
  ],
  [
    'foreign Stronghold owner',
    (g) => {
      g.strongholdCards = createStrongholdCards();
      g.strongholdCards.owners.arrakeen = 'absent';
    },
  ],
  [
    'Basic final module settlement',
    (g) => {
      g.advanced = false;
      g.strongholdCards = createStrongholdCards();
    },
  ],
];
for (const [name, corrupt] of corruptions)
  void test(`pure victory rejects ${name} without mutation`, () => {
    const g = fixture();
    occupy(g, 0, 'arrakeen', 'carthag', 'sietch_tabr');
    corrupt(g);
    const before = structuredClone(g);
    assert.throws(() => quoteVictory(g), VictoryQuoteError);
    assert.deepEqual(g, before);
  });

function moritaniSource() {
  let g = fixture(['moritani', 'emperor', 'beneGesserit']);
  g.phase = 7;
  g.moritaniTerror = createTerrorState(() => 0.4);
  const hold = (id: string, name: string) => {
    const index = g.deck.findIndex((c) => c.name === name);
    assert.ok(index >= 0);
    const card = g.deck.splice(index, 1)[0];
    g.players.find((p) => p.id === id)!.hand.push(card);
    return card.id;
  };
  const printed = hold('p1', 'Karama'),
    worthless = hold('p2', 'Baliset');
  for (const p of g.players) g = applyAction(g, p.id, { type: 'ready' });
  assert.equal(g.decision?.kind, 'moritaniPlacement');
  g = applyAction(g, 'p0', {
    type: 'decision',
    token: g.moritaniTerror!.tokens[0].id,
    territory: 'arrakeen',
  });
  assert.equal(g.response?.kind, 'moritaniPlacement');
  return { g, printed, worthless };
}
for (const form of ['printed', 'worthless'] as const)
  void test(`actual Moritani declaration with absent ally rejects ${form} cancellation before cost`, () => {
    const f = moritaniSource();
    f.g.players[0].ally = 'absent'; // Explicit corrupted copy after a genuine declaration.
    const before = structuredClone(f.g);
    assert.throws(() =>
      applyAction(f.g, form === 'printed' ? 'p1' : 'p2', {
        type: 'card',
        card: f[form],
        mode: 'cancel',
      }),
    );
    assert.deepEqual(f.g, before);
  });
void test('paid BG cancellation revalidates victory binding before final allowance and private prediction remains owner-only', () => {
  const f = moritaniSource();
  f.g.players[2].prediction = { faction: 'emperor', turn: 10 };
  const g = applyAction(f.g, 'p2', {
    type: 'card',
    card: f.worthless,
    mode: 'cancel',
  });
  assert.equal(g.response?.kind, 'worthlessKarama');
  assert.equal(g.discard.filter((c) => c.id === f.worthless).length, 1);
  assert.equal(viewGame(g, 'p1').players[2].prediction, undefined);
  g.players[0].ally = 'absent';
  const before = structuredClone(g);
  assert.throws(() => applyAction(g, 'p1', { type: 'passResponse' }));
  assert.deepEqual(g, before);
});
