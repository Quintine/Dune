import test from 'node:test';
import assert from 'node:assert/strict';
import {
  RULE_TOPICS,
  RULE_CHECKLIST_AREAS,
  PHASE_HELP,
  phaseRuleId,
} from '../game/reference';
import { FACTIONS, PHASES } from '../game/catalog';
import { readFileSync } from 'node:fs';

void test('every phase and base faction has a discoverable rule topic with valid related links', () => {
  const ids = new Set(RULE_TOPICS.map((t) => t.id));
  assert.equal(ids.size, RULE_TOPICS.length);
  for (const topic of RULE_TOPICS) {
    assert.ok(topic.steps.length > 0, topic.id);
    for (const related of topic.related ?? [])
      assert.ok(ids.has(related), `${topic.id} -> ${related}`);
  }
  assert.equal(PHASE_HELP.length, PHASES.length);
  PHASES.forEach((_, i) => assert.ok(ids.has(phaseRuleId(i))));
  FACTIONS.forEach((f) => assert.ok(ids.has(`faction-${f.id}`)));
  assert.ok(ids.has('ai-players'));
});

void test('reviewed feature checklists expose all five independent facets and real local verification evidence', () => {
  const hub = RULE_TOPICS.find(
    (topic) => topic.id === 'implementation-checklist',
  )!;
  const features = [
    'setup',
    'truthtrance-spice',
    'richese-cards',
    'richese-acquisition',
    'richese-no-field',
    'nullentropy-search',
    'ecaz-ambassadors',
    'automatic-casualties',
    'automatic-responses',
    'automatic-decisions',
    'ai-pacing',
  ];
  for (const id of features) {
    const topic = RULE_TOPICS.find((candidate) => candidate.id === id)!;
    assert.ok(
      hub.related?.includes(id),
      `${id} is discoverable from the checklist hub`,
    );
    assert.deepEqual(
      topic.checklist?.map((item) => item.area),
      [...RULE_CHECKLIST_AREAS],
      id,
    );
    assert.equal(
      topic.checklist?.find((item) => item.area === 'Verification')?.status,
      'Partial',
      'focused tests do not certify all browser and expansion interactions',
    );
    for (const item of topic.checklist ?? []) {
      assert.ok(
        item.detail.length > 20,
        `${id}: ${item.area} has an explicit scope`,
      );
      for (const evidence of item.evidence ?? []) {
        assert.match(evidence, /^tests\/[a-z0-9-]+\.test\.ts$/);
        assert.match(
          readFileSync(new URL(`../${evidence}`, import.meta.url), 'utf8'),
          /test\(/,
          evidence,
        );
      }
    }
  }
});

void test('Richese checklist reports integrated auctions separately from inert card effects and unresolved rules', () => {
  const topic = RULE_TOPICS.find(
    (candidate) => candidate.id === 'richese-cards',
  )!;
  const guide = topic.steps.join(' ');
  assert.equal(topic.coverage, 'Partial');
  for (const phrase of [
    'Once Around or Silent bidding',
    'normal, Once Around or Silent bidding',
    'Silent bids remain private',
    'pledged ally spice',
    'Atreides inspection',
    'Harkonnen bonus',
    'positive Black Market self-bids',
    'exhausted-cache arithmetic',
    'Ixian Technology substitution',
    'skips the optional Black Market prelude',
    'Juice of Sapho',
    'Richese expansion starts remain disabled',
    'persisted-room checks pass',
  ])
    assert.ok(guide.includes(phrase), phrase);
  assert.match(
    guide,
    /implementation guards.*not claims of official prohibitions/,
  );
  assert.equal(
    topic.checklist!.find((item) => item.area === 'AI')!.status,
    'Partial',
  );
  assert.ok(
    topic
      .checklist!.find((item) => item.area === 'Verification')!
      .evidence!.includes('tests/richese-auction-bots.test.ts'),
  );
  assert.ok(
    topic
      .checklist!.find((item) => item.area === 'Verification')!
      .evidence!.includes('tests/richese-engine.test.ts'),
  );
  assert.doesNotMatch(JSON.stringify(topic), /https?:\/\//);
});

void test('Richese acquisition guide separates purchase immunity, income response and independent transfer/search controls', () => {
  const topic = RULE_TOPICS.find(
    (candidate) => candidate.id === 'richese-acquisition',
  )!;
  assert.equal(topic.coverage, 'Partial');
  const text = topic.steps.join(' ');
  for (const phrase of [
    'once per game',
    'enters your hand secretly',
    'cannot cancel the special purchase',
    'Emperor income has a separate response',
    'Full-hand activation',
    'final cached card',
    'have their own hand-panel controls',
  ])
    assert.ok(text.includes(phrase), phrase);
  assert.equal(topic.checklist!.length, 5);
  assert.ok(topic.checklist!.every((item) => item.status === 'Partial'));
  assert.ok(
    topic
      .checklist!.find((item) => item.area === 'Verification')!
      .evidence!.includes('tests/richese-acquisition-bots.test.ts'),
  );
  assert.doesNotMatch(JSON.stringify(topic), /https?:\/\//);
});

void test('Ecaz checklist distinguishes integrated lifecycle from unopened expansion starts', () => {
  const topic = RULE_TOPICS.find(
    (candidate) => candidate.id === 'ecaz-ambassadors',
  )!;
  assert.equal(topic.coverage, 'Partial');
  const guide = topic.steps.join(' ');
  assert.match(guide, /before spice is paid/);
  assert.match(guide, /previous placements and payments remain/);
  assert.match(
    guide,
    /supply policy is an interpretation, not an explicit official FAQ ruling/,
  );
  assert.match(
    guide,
    /CHOAM market, deferred technology income, then Ecaz placement/,
  );
  assert.match(guide, /not a priority established by a combined official FAQ/);
  assert.match(
    guide,
    /Storm crossings return tokens.*overriding traitor victory leaves it placed/,
  );
  assert.match(guide, /Full Ecaz starts remain disabled/);
  assert.ok(
    RULE_TOPICS.find(
      (candidate) => candidate.id === 'revival',
    )!.related?.includes(topic.id),
  );
  assert.ok(
    RULE_TOPICS.find(
      (candidate) => candidate.id === 'ecaz-modules',
    )!.related?.includes(topic.id),
  );
});

void test('automation reference keeps single-outcome settlement, cosmetic notices and paced AI distinct', () => {
  const casualty = RULE_TOPICS.find(
    (topic) => topic.id === 'automatic-casualties',
  )!;
  const pacing = RULE_TOPICS.find((topic) => topic.id === 'ai-pacing')!;
  assert.match(
    casualty.steps.join(' '),
    /If several physical casualty combinations are legal, the winner still chooses/,
  );
  assert.match(casualty.steps.join(' '), /1\.5 seconds each/);
  assert.match(casualty.steps.join(' '), /while notices are off are consumed/);
  assert.match(casualty.steps.join(' '), /turning notices on does not replay/);
  assert.match(
    casualty.steps.join(' '),
    /Successful powers without a notice tag remain outside/,
  );
  assert.match(
    casualty.steps.join(' '),
    /hiding notices does not disable automatic rule settlement or change AI timing/,
  );
  assert.match(
    casualty.steps.join(' '),
    /Uncancelable responses now settle automatically/,
  );
  for (const event of [
    'successful Ecaz Ambassador placement',
    'Emperor auction income',
    'Harkonnen bonus-card draws',
    'private full-plan inspection availability',
  ])
    assert.ok(casualty.steps.join(' ').includes(event), event);
  assert.match(
    casualty.steps.join(' '),
    /without exposing its private card identity/,
  );
  assert.match(pacing.steps.join(' '), /at most one AI action per step/);
  assert.match(pacing.steps.join(' '), /Competing workers cannot both commit/);
  assert.match(pacing.steps.join(' '), /Offline simulations use fast batches/);
  assert.ok(
    RULE_TOPICS.find((topic) => topic.id === 'battle')!.related?.includes(
      casualty.id,
    ),
  );
  assert.ok(
    RULE_TOPICS.find((topic) => topic.id === 'ai-players')!.related?.includes(
      pacing.id,
    ),
  );
});

void test('player-facing entry and rules pages contain no external navigation links', () => {
  for (const file of [
    'app/page.tsx',
    'components/game-table.tsx',
    'components/rules-reference.tsx',
    'app/rules/coverage/page.tsx',
  ]) {
    const source = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /href\s*=\s*["'](?:https?:)?\/\//, file);
  }
});

void test('automatic allowance checklist distinguishes implemented physical custody from conservative promise legality and incomplete notice coverage', () => {
  const topic = RULE_TOPICS.find(
    (candidate) => candidate.id === 'automatic-responses',
  )!;
  const guide = topic.steps.join(' ');
  assert.equal(topic.coverage, 'Partial');
  assert.match(
    guide,
    /owner cannot cancel that power and needs no Allow click/,
  );
  assert.match(guide, /only your own cancelable cards/);
  assert.match(guide, /Other players’ pass choices.*are not exposed/);
  assert.match(guide, /already allowed may still cancel/);
  assert.match(guide, /Allies retain legal cancellation choices/);
  assert.match(
    guide,
    /active Truthtrance question or phase-opening choice pauses/,
  );
  assert.match(
    guide,
    /remain listed conservatively.*would break a promise and be rejected/,
  );
  assert.match(
    guide,
    /merely preparing a player’s view does not award spice or draw cards/,
  );
  assert.match(guide, /all successful-power notice tags.*remain unfinished/);
  const verification = topic.checklist!.find(
    (item) => item.area === 'Verification',
  )!;
  assert.equal(verification.status, 'Partial');
  assert.ok(
    verification.evidence?.includes('tests/automatic-responses.test.ts'),
  );
  assert.ok(
    verification.evidence?.includes(
      'tests/automatic-response-recovery.test.ts',
    ),
  );
  assert.equal(
    topic.checklist!.find((item) => item.area === 'Player controls')!.status,
    'Partial',
  );
  assert.ok(topic.related?.includes('card-truthtrance'));
  assert.ok(
    RULE_TOPICS.find(
      (candidate) => candidate.id === 'automatic-casualties',
    )!.related?.includes(topic.id),
  );
});

void test('no-choice decision checklist preserves genuine alternatives and persistent owner-only inspection', () => {
  const topic = RULE_TOPICS.find(
    (candidate) => candidate.id === 'automatic-decisions',
  )!;
  const guide = topic.steps.join(' ');
  assert.equal(topic.coverage, 'Partial');
  assert.match(guide, /declared split.*can be paid exactly/);
  assert.match(
    guide,
    /genuine Karama option or an unfunded payment still requires/,
  );
  assert.match(guide, /There is no Finish inspection action/);
  assert.match(guide, /outside the battle helping an ally/);
  assert.match(guide, /not copied into the ally’s private view/);
  assert.match(
    guide,
    /Card enlargement and Truthtrance promise controls remain separate/,
  );
  assert.match(
    guide,
    /Other decisions with only one legal outcome.*remain under review/,
  );
  const special = RULE_TOPICS.find(
    (candidate) => candidate.id === 'special-karama',
  )!;
  assert.match(
    special.steps.join(' '),
    /No inspection acknowledgement is required/,
  );
  assert.doesNotMatch(
    special.steps.join(' '),
    /table pauses while Atreides reads/,
  );
  assert.ok(
    topic
      .checklist!.find((item) => item.area === 'Verification')!
      .evidence!.includes('tests/automatic-decisions.test.ts'),
  );
});

void test('Ecaz entry checklist separates eight supported effects and private historical snapshots from unopened interactions', () => {
  const topic = RULE_TOPICS.find(
    (candidate) => candidate.id === 'ecaz-ambassadors',
  )!;
  const guide = topic.steps.join(' ');
  assert.equal(topic.coverage, 'Partial');
  assert.match(
    guide,
    /Emperor, Atreides, Harkonnen, CHOAM, Ixian, Richese, Fremen and Guild entry effects are integrated/,
  );
  assert.match(guide, /Bene Gesserit copies of those eight effects/);
  assert.match(guide, /recipient’s private inspection history/);
  assert.match(guide, /do not become a live view of later changes/);
  assert.match(guide, /closing them needs no game acknowledgement/);
  assert.match(guide, /including none, for three spice each/);
  assert.match(guide, /Ixians require one available card/);
  assert.match(
    guide,
    /Entries with competing arrival reactions remain blocked/,
  );
  assert.match(guide, /Full Ecaz starts remain disabled/);
  const evidence = topic.checklist!.find(
    (item) => item.area === 'Verification',
  )!.evidence!;
  assert.ok(evidence.includes('tests/ecaz-entry.test.ts'));
  assert.ok(evidence.includes('tests/ecaz-entry-bots.test.ts'));
  assert.ok(evidence.includes('tests/guild-ambassador-bots.test.ts'));
  assert.ok(evidence.includes('tests/guild-ambassador-engine.test.ts'));
  assert.match(
    guide,
    /No-Field substitution.*awaits the user’s interpretation/,
  );
  assert.match(
    guide,
    /Simultaneous Intrusion\/Terror and Ambassador\/Terror combinations remain blocked/,
  );
});

void test('Nullentropy checklist preserves paid-only privacy, real choices, recovery and explicit interpretation guards', () => {
  const topic = RULE_TOPICS.find(
    (candidate) => candidate.id === 'nullentropy-search',
  )!;
  const text = topic.steps.join(' ');
  assert.equal(topic.coverage, 'Partial');
  assert.equal(topic.checklist!.length, 5);
  assert.ok(topic.checklist!.every((item) => item.status === 'Partial'));
  for (const phrase of [
    'two spice to the bank',
    'no discard names or candidate count',
    'Only the paying player',
    'no free cancellation',
    'exactly one legal card',
    'without charging again',
    'Temporary search access ends',
    'pre-existing free hand slot',
    'pending Guild refund claim',
    'not a general ban',
    'before payment',
    'without discard lookahead',
    'full Richese starts remain disabled',
  ]) {
    assert.ok(
      (text + JSON.stringify(topic.checklist)).includes(phrase),
      phrase,
    );
  }
  assert.ok(
    topic
      .checklist!.find((item) => item.area === 'Verification')!
      .evidence!.includes('tests/nullentropy-box-recovery.test.ts'),
  );
  assert.ok(
    RULE_TOPICS.find(
      (candidate) => candidate.id === 'card-richese-nullentropy-box',
    )!.related!.includes(topic.id),
  );
  assert.doesNotMatch(JSON.stringify(topic), /https?:\/\//);
});

void test('Richese generated guides distinguish the eight bounded handlers from two inactive faces', () => {
  const cards = RULE_TOPICS.filter((topic) =>
    topic.id.startsWith('card-richese-'),
  );
  assert.equal(cards.length, 10);
  const active = new Set([
    'card-richese-karama',
    'card-richese-distrans',
    'card-richese-nullentropy-box',
    'card-richese-ornithopter',
    'card-richese-residual-poison',
    'card-richese-portable-snooper',
    'card-richese-stone-burner',
    'card-richese-juice-of-sapho',
  ]);
  for (const card of cards) {
    const text = card.steps.join(' ');
    if (active.has(card.id))
      assert.doesNotMatch(text, /game actions are not enabled/);
    else assert.match(text, /game actions are not enabled/);
    assert.equal(card.coverage, 'Partial');
  }
  for (const id of ['richese-cards', 'richese-gift'])
    assert.match(
      RULE_TOPICS.find((topic) => topic.id === id)!.steps.join(' '),
      /Mirror Weapon and Semuta Drug remain unfinished/,
    );
});
