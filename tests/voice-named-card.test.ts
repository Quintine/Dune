import assert from 'node:assert/strict';
import test from 'node:test';
import { baseDeck, ixBattleCards, ixStandardCards, type Card } from '../game/cards';
import {
  VOICE_KINDS, VOICE_NAMED_CARDS, voiceChoices, voiceNamedCard,
  defaultVoiceMatch, playedVoiceMatch, battleCardLabel,
} from '../game/battle-cards';

const face = (name: string): Card => {
  const card = [...baseDeck(), ...ixStandardCards(), ...ixBattleCards()].find(item => item.name === name);
  assert.ok(card, `Expected original ${name} card`);
  return card;
};

void test('specific-name commands are canonical public Advanced choices, not Basic categories or arbitrary card IDs', () => {
  assert.deepEqual(voiceChoices(false), VOICE_KINDS);
  for (const name of VOICE_NAMED_CARDS) {
    assert.ok(voiceChoices(true).includes(`named:${name}`));
    assert.equal(voiceNamedCard(`named:${name}`), name);
  }
  assert.equal(voiceNamedCard('named:Truthtrance'), null);
  assert.equal(voiceNamedCard('named:Poison Tooth'), null);
  assert.equal(voiceNamedCard('named:treachery-1'), null);
  assert.equal(voiceNamedCard('poison'), null);
  assert.equal(battleCardLabel('named:Maula Pistol'), 'Maula Pistol (specific card)');
  assert.equal(battleCardLabel('poison'), 'Poison weapon');
});

void test('specific-name Voice distinguishes different ordinary faces with the same role', () => {
  const pistol = face('Maula Pistol');
  const knife = face('Crysknife');
  assert.equal(defaultVoiceMatch(pistol, 'named:Maula Pistol'), true);
  assert.equal(defaultVoiceMatch(knife, 'named:Maula Pistol'), false);
  assert.equal(playedVoiceMatch(pistol, 'weapon', 'named:Maula Pistol'), true);
  assert.equal(playedVoiceMatch(knife, 'weapon', 'named:Maula Pistol'), false);
  assert.equal(playedVoiceMatch(pistol, 'defense', 'named:Maula Pistol'), false);
  assert.equal(defaultVoiceMatch(pistol, 'projectile'), true);
  assert.equal(defaultVoiceMatch(knife, 'projectile'), true);
  // Matching the text alone cannot turn a card of another printed role into
  // the named physical face.
  assert.equal(defaultVoiceMatch({ ...pistol, kind: 'poison' }, 'named:Maula Pistol'), false);
  assert.equal(playedVoiceMatch({ ...pistol, kind: 'poison' }, 'weapon', 'named:Maula Pistol'), false);
});

void test('named defense, Worthless and Cheap Hero commands honor legal battle slots and copies', () => {
  const shields = [...baseDeck(), ...ixStandardCards()].filter(card => card.name === 'Shield');
  assert.ok(shields.length >= 2);
  for (const shield of shields) {
    assert.equal(defaultVoiceMatch(shield, 'named:Shield'), true);
    assert.equal(playedVoiceMatch(shield, 'defense', 'named:Shield'), true);
    assert.equal(playedVoiceMatch(shield, 'weapon', 'named:Shield'), false);
  }
  const baliset = face('Baliset');
  assert.equal(playedVoiceMatch(baliset, 'weapon', 'named:Baliset'), true);
  assert.equal(playedVoiceMatch(baliset, 'defense', 'named:Baliset'), true);
  assert.equal(playedVoiceMatch(baliset, 'leader', 'named:Baliset'), false);
  assert.equal(defaultVoiceMatch(face('Kulon'), 'named:Baliset'), false);
  const hero = face('Cheap Hero'), heroine = face('Cheap Heroine');
  assert.equal(playedVoiceMatch(hero, 'leader', 'named:Cheap Hero'), true);
  assert.equal(playedVoiceMatch(heroine, 'leader', 'named:Cheap Hero'), false);
  assert.equal(playedVoiceMatch(hero, 'weapon', 'named:Cheap Hero'), false);
  assert.equal(defaultVoiceMatch(heroine, 'hero'), true);
});

void test('generic special-card default and alternate Voice matching remain intact', () => {
  const chemistry = face('Chemistry'), weirding = face('Weirding Way');
  assert.equal(defaultVoiceMatch(chemistry, 'snooper'), true);
  assert.equal(defaultVoiceMatch(chemistry, 'poison'), false);
  assert.equal(playedVoiceMatch(chemistry, 'weapon', 'poison'), true);
  assert.equal(defaultVoiceMatch(weirding, 'projectile'), true);
  assert.equal(defaultVoiceMatch(weirding, 'shield'), false);
  assert.equal(playedVoiceMatch(weirding, 'defense', 'shield'), true);
  assert.equal(voiceNamedCard('named:Chemistry'), null);
});
