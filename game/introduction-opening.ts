import { SPICE_CARDS, type SpiceCard } from './cards';
import { splitLocation, territory } from './board';
import { quoteSpicePlacement, stormExposesTerritory, stormSectorAfter, wormConsumesForces } from './disaster-rules';
import { STORM_START_SECTOR } from './player-positions';

export type IntroductionOpeningChoice = {
  stormExample: 'first' | 'later';
  stormDial: number;
  stormStage: 'draft' | 'sealed' | 'revealed' | 'resolved';
  blowExample: 'clear' | 'storm' | 'worm' | 'first-worm';
  blowStage: 'draft' | 'revealed' | 'settled';
};
export const OPENING_DEFAULTS: IntroductionOpeningChoice = {
  stormExample: 'later', stormDial: 2, stormStage: 'draft', blowExample: 'clear', blowStage: 'draft',
};
export function validateOpeningChoice(s: IntroductionOpeningChoice) {
  if (!['first', 'later'].includes(s.stormExample) || !Number.isSafeInteger(s.stormDial) ||
    s.stormDial < (s.stormExample === 'first' ? 0 : 1) || s.stormDial > (s.stormExample === 'first' ? 20 : 3) ||
    !['draft', 'sealed', 'revealed', 'resolved'].includes(s.stormStage) ||
    !['clear', 'storm', 'worm', 'first-worm'].includes(s.blowExample) || !['draft', 'revealed', 'settled'].includes(s.blowStage))
    throw new Error('Invalid opening-phase practice.');
}

export function introductionStorm(s: IntroductionOpeningChoice) {
  validateOpeningChoice(s);
  const first = s.stormExample === 'first';
  const start = first ? STORM_START_SECTOR : 16;
  const otherDial = first ? 0 : 3;
  const distance = s.stormDial + otherDial;
  const crossed = Array.from({ length: distance }, (_, i) => stormSectorAfter(start, i + 1));
  const initialForces: Record<string, number> = first ? { 'arrakeen:10': 10 } : {
    'cielago_south:2': 2, 'cielago_north:3': 2, 'false_wall_west:18': 2, 'habbanya_ridge_sietch:17': 2,
  };
  const initialSpice: Record<string, number> = first ? {} : { 'cielago_south:2': 4, 'hagga_basin:12': 3 };
  const forces = { ...initialForces }, spice = { ...initialSpice };
  let tanks = 0;
  if (s.stormStage === 'resolved') {
    for (const [key, count] of Object.entries(forces)) {
      const loc = splitLocation(key);
      if (crossed.includes(loc.sector) && stormExposesTerritory(loc.territory)) { tanks += count; delete forces[key]; }
    }
    for (const key of Object.keys(spice)) if (crossed.includes(splitLocation(key).sector)) delete spice[key];
  }
  return { start, sector: s.stormStage === 'resolved' ? stormSectorAfter(start, distance) : start,
    distance: ['revealed', 'resolved'].includes(s.stormStage) ? distance : null,
    otherDial: ['revealed', 'resolved'].includes(s.stormStage) ? otherDial : null,
    crossed: s.stormStage === 'resolved' ? crossed : [],
    initialForces, initialSpice, forces, spice, tanks, reserves: first ? 10 : 12,
    locations: Object.keys(initialForces).map(key => ({ key, name: territory(splitLocation(key).territory).name,
      sector: splitLocation(key).sector, before: initialForces[key], after: forces[key] ?? 0,
      sheltered: !stormExposesTerritory(splitLocation(key).territory) })),
  };
}

function spiceCard(id: string) {
  const row = SPICE_CARDS.find(([territory]) => territory === id)!;
  return { territory: row[0], amount: row[1], sector: row[2] };
}
export const PRACTICE_BLOW_CARD = spiceCard('broken_land');
export const PRACTICE_PREVIOUS_BLOW = spiceCard('the_great_flat');

export function introductionSpiceBlow(s: IntroductionOpeningChoice) {
  validateOpeningChoice(s);
  const first = s.blowExample === 'first-worm';
  const worm = s.blowExample === 'worm';
  const storm = s.blowExample === 'storm' ? PRACTICE_BLOW_CARD.sector : 18;
  const initialSpice: Record<string, number> = first ? {} : { 'the_great_flat:15': 6, ...(s.blowExample === 'storm' ? {} : { 'broken_land:12': 3 }) };
  const spice = { ...initialSpice };
  let forces = first ? 0 : 3;
  const revealed: SpiceCard[] = [];
  if ((s.blowStage !== 'draft')) {
    if (worm || first) revealed.push({ worm: true });
    if (worm) {
      if (wormConsumesForces({ id: 'practice', faction: 'emperor' })) forces = 0;
      for (const key of Object.keys(spice)) if (splitLocation(key).territory === PRACTICE_PREVIOUS_BLOW.territory) delete spice[key];
    }
    const placement = quoteSpicePlacement(spice, storm, PRACTICE_BLOW_CARD);
    if (!placement.blocked) spice[placement.key] = placement.total;
    revealed.push(PRACTICE_BLOW_CARD);
  }
  return { storm, turn: first ? 1 : 2, initialSpice, spice, forces, tanks: !first && (s.blowStage !== 'draft') ? 3 - forces : 0,
    reserves: first ? 20 : 17, revealed, nexus: worm && s.blowStage === 'settled',
    skippedWorm: first && (s.blowStage !== 'draft'), added: (s.blowStage !== 'draft') ? quoteSpicePlacement(initialSpice, storm, PRACTICE_BLOW_CARD).added : null,
  };
}
