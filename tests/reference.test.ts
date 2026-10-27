import test from 'node:test';
import assert from 'node:assert/strict';
import { RULE_TOPICS, phaseRuleId } from '../game/reference';
import { FACTIONS, PHASES } from '../game/catalog';

void test('every phase and base faction has a discoverable rule topic with valid related links', () => {
  const ids = new Set(RULE_TOPICS.map((t) => t.id));
  assert.equal(ids.size, RULE_TOPICS.length);
  for (const topic of RULE_TOPICS) {
    for (const related of topic.related ?? [])
      assert.ok(ids.has(related), `${topic.id} -> ${related}`);
  }
  PHASES.forEach((_, i) => assert.ok(ids.has(phaseRuleId(i))));
  FACTIONS.forEach((f) => assert.ok(ids.has(`faction-${f.id}`)));
  assert.ok(ids.has('ai-players'));
});

void test('setup and expansion guides describe available starts as unfinished previews', () => {
  for (const id of [
    'setup',
    'card-amal',
    'moritani-enemy',
    'moritani-ally-retention',
    'choam-gamont',
    'choam-jubba',
    'ecaz-modules',
  ]) {
    const topic = RULE_TOPICS.find((item) => item.id === id);
    assert.ok(topic, `missing ${id}`);
    const guidance = topic.steps.join(' ');
    assert.match(guidance, /preview/i, id);
    assert.doesNotMatch(guidance, /(?:expansion|CHOAM|Moritani) (?:faction )?(?:starts|games) remain (?:unavailable|disabled|gated)/i, id);
  }
});
