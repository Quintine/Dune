import assert from 'node:assert/strict';
import test from 'node:test';
import { createGame, newPlayer, type Game } from '../game/engine';
import { emperorNexusBankPurchaseModeSupported } from '../game/nexus-emperor-purchase';

/** Public lobby proof only: an undealt, concealed Nexus face is not yet part of it. */
function lobby(
  factions: Parameters<typeof newPlayer>[2][],
  expansions: string[],
  advanced = false,
): Game {
  const g = createGame('BANKMODE', newPlayer(factions[0], factions[0], factions[0]), advanced, expansions);
  for (const faction of factions.slice(1)) g.players.push(newPlayer(faction, faction, faction));
  g.order = g.players.map(p => p.id);
  g.nexusCards = { cards: null, phase: null };
  return g;
}

function withTech(g: Game): Game {
  g.techTokens = {} as NonNullable<Game['techTokens']>;
  return g;
}

function withStrongholds(g: Game): Game {
  g.strongholdCards = {} as NonNullable<Game['strongholdCards']>;
  return g;
}

function withSkills(g: Game): Game {
  g.leaderSkills = {} as NonNullable<Game['leaderSkills']>;
  return g;
}

function withDiscovery(g: Game): Game {
  g.discoveryEnabled = true;
  return g;
}

function withHomeworlds(g: Game): Game {
  g.homeworlds = { custody: null };
  return g;
}

void test('supported native Nexus rosters with the Emperor absent admit the normal bank auction', () => {
  const admitted: [string, Game][] = [
    ['bare classic', lobby(['atreides', 'harkonnen', 'fremen'], [])],
    ['classic Tech', withTech(lobby(['atreides', 'harkonnen', 'fremen'], []))],
    ['classic Advanced Strongholds', withStrongholds(lobby(['atreides', 'harkonnen', 'fremen'], [], true))],
    ['classic Skills', withSkills(lobby(['atreides', 'harkonnen', 'fremen'], []))],
    ['classic Discovery', withDiscovery(lobby(['atreides', 'harkonnen', 'fremen'], []))],
    ['bare paired CHOAM/Richese', lobby(['harkonnen', 'richese', 'choam'], ['choam'])],
    ['bare paired Ixians/Tleilaxu', lobby(['atreides', 'ixians', 'tleilaxu'], ['ix'])],
    ['paired E1/E2 Tech', withTech(lobby(['harkonnen', 'richese', 'choam'], ['choam']))],
    ['paired E1/E2 Advanced Strongholds', withStrongholds(lobby(['harkonnen', 'richese', 'choam'], ['choam'], true))],
    ['paired E1/E2 Skills with Tech', withTech(withSkills(lobby(['harkonnen', 'richese', 'choam'], ['choam'])))],
    ['paired E1/E2 Homeworlds', withHomeworlds(withTech(lobby(['harkonnen', 'richese', 'choam'], ['choam'])))],
    ['paired E1/E2 Discovery', withDiscovery(lobby(['harkonnen', 'richese', 'choam'], ['choam']))],
    ['single E1/E2 native', lobby(['harkonnen', 'richese', 'atreides'], ['choam'])],
    ['single E1/E2 Skills', withSkills(lobby(['harkonnen', 'richese', 'atreides'], ['choam']))],
    ['mixed E1/E2 natives', lobby(['ixians', 'choam', 'atreides'], ['ix', 'choam'])],
    ['mixed E1/E2 Skills', withSkills(lobby(['ixians', 'choam', 'atreides'], ['ix', 'choam']))],
    ['standalone Ecaz', lobby(['ecaz', 'atreides', 'harkonnen'], ['ecaz'])],
    ['standalone Moritani', lobby(['moritani', 'atreides', 'guild'], ['ecaz'])],
    ['standalone E3 Skills', withSkills(lobby(['moritani', 'atreides', 'guild'], ['ecaz']))],
    ['paired E3 natives', lobby(['ecaz', 'moritani', 'atreides'], ['ecaz'])],
    ['paired E3 Skills', withSkills(lobby(['ecaz', 'moritani', 'atreides'], ['ecaz']))],
    ['mixed E3 natives', lobby(['ecaz', 'ixians', 'atreides'], ['ecaz', 'ix'])],
    ['mixed E3 Skills', withSkills(lobby(['ecaz', 'ixians', 'atreides'], ['ecaz', 'ix']))],
    ['mixed E3 Discovery', withDiscovery(lobby(['ecaz', 'ixians', 'atreides'], ['ecaz', 'ix']))],
  ];
  for (const [label, g] of admitted)
    assert.equal(emperorNexusBankPurchaseModeSupported(g), true, label);
});

void test('the previously accepted classic public condition survives unrelated preview aliases', () => {
  const aliases: [string, (g: Game) => void][] = [
    ['Advanced preview', g => { g.advancedPreview = true; }],
    ['Kull', g => { g.kullPreview = true; }],
    ['Nexus Kull', g => { g.nexusKullPreview = true; }],
    ['Guild Betrayal', g => { g.guildBetrayalPreview = true; }],
    ['Richese Betrayal', g => { g.richeseBetrayalPreview = true; }],
    ['Semuta', g => { g.semutaPreview = true; }],
    ['Ixian replacement', g => { g.nexusIxianReplacementPreview = true; }],
    ['Ixian Betrayal', g => { g.nexusIxianBetrayalPreview = true; }],
    ['Harkonnen Betrayal', g => { g.nexusHarkonnenBetrayalPreview = true; }],
  ];
  for (const [label, flag] of aliases) {
    const classic = lobby(['atreides', 'harkonnen', 'fremen'], []);
    flag(classic);
    // Prior bank receipts on a bare classic roster keep their original condition.
    assert.equal(emperorNexusBankPurchaseModeSupported(classic), true, label);
    // The same flag still never opens a new native envelope, even bare paired.
    const native = withTech(lobby(['harkonnen', 'richese', 'choam'], ['choam']));
    flag(native);
    assert.equal(emperorNexusBankPurchaseModeSupported(native), false, label);
  }
});

void test('Ecaz variant, the missing module and the seated Emperor stay gated', () => {
  const withoutNexus = lobby(['atreides', 'harkonnen', 'fremen'], []);
  withoutNexus.nexusCards = undefined;
  const sandtrout = lobby(['atreides', 'harkonnen', 'fremen'], []);
  sandtrout.sandtrout = true;
  const ecazTreachery = lobby(['ecaz', 'atreides', 'harkonnen'], ['ecaz']);
  ecazTreachery.ecazTreachery = true;
  const blocked: [string, Game][] = [
    ['a missing Nexus module', withoutNexus],
    ['Sandtrout', sandtrout],
    ['Ecaz Treachery', ecazTreachery],
    ['an Emperor seat', lobby(['atreides', 'harkonnen', 'emperor'], [])],
    ['an Emperor seat on a native roster', lobby(['harkonnen', 'richese', 'emperor'], ['choam'])],
  ];
  for (const [label, g] of blocked)
    assert.equal(emperorNexusBankPurchaseModeSupported(g), false, label);
});

void test('unsupported rosters and unsupported module envelopes stay gated', () => {
  const blocked: [string, Game][] = [
    ['an Ecaz seat on a classic roster', lobby(['atreides', 'ecaz'], [])],
    ['a native without its expansion', lobby(['atreides', 'richese'], [])],
    ['an E3 expansion without its natives', lobby(['atreides', 'harkonnen'], ['ecaz'])],
    ['a native from the other E1/E2 family', lobby(['richese', 'ixians', 'atreides'], ['choam'])],
    ['a repeated native faction', lobby(['richese', 'richese', 'choam'], ['choam'])],
    ['Tech with only two seats', withTech(lobby(['atreides', 'harkonnen'], []))],
    ['Strongholds without Advanced', withStrongholds(lobby(['atreides', 'harkonnen', 'fremen'], []))],
    ['Advanced Moritani with Harkonnen',
      lobby(['moritani', 'atreides', 'harkonnen'], ['ecaz'], true)],
    ['Advanced paired E3 with Harkonnen',
      lobby(['ecaz', 'moritani', 'harkonnen'], ['ecaz'], true)],
    ['Skills on an E3 classic mix', withSkills(lobby(['ecaz', 'atreides'], []))],
  ];
  for (const [label, g] of blocked)
    assert.equal(emperorNexusBankPurchaseModeSupported(g), false, label);
});
