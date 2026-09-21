import assert from 'node:assert/strict';
import { leaders, treacheryDeck } from '../game/cards';
import type { Game } from '../game/engine';
import { richeseCards } from '../game/richese-cards';
import { traitorDeck } from '../game/traitors';
import { basicExpansionLeaderSkillsProfile } from '../game/leader-skill-profile';
import { validateLeaderSkills } from '../game/leader-skills';

/** Fixed inventory captured after genuine setup initialization, before any choices. */
export function sampleInventory(game: Game) {
  return {
    leaderSkills: !!game.leaderSkills,
    cards: [
      ...treacheryDeck(game.expansions),
      ...(game.players.some((player) => player.faction === 'richese')
        ? richeseCards()
        : []),
    ]
      .map((card) => card.id)
      .sort(),
    // Other expansion assassination zones require a separate adapter.
    traitors: game.expansions.length && !basicExpansionLeaderSkillsProfile(game)
      ? null
      : traitorDeck(
          game.players.map((player) => ({ leaders: leaders(player.faction) })),
          game.expansions.includes('ix'),
        ).sort(),
  };
}

export function verifySampleCustody(
  game: Game,
  inventory: ReturnType<typeof sampleInventory>,
) {
  assert.equal(!!game.leaderSkills, inventory.leaderSkills, 'Leader Skills module custody');
  if (game.leaderSkills) validateLeaderSkills(game.leaderSkills, game.players);
  const cards = [
    ...game.players.flatMap((player) => player.hand),
    ...game.deck,
    ...game.discard,
    ...(game.richeseCache ?? []),
    ...(game.richeseRemoved ?? []),
    ...(game.ixSetupCards ?? []),
    ...(game.ixAuction?.cards ?? []),
    ...(game.ornithopter ? [game.ornithopter.card] : []),
    ...(game.auction?.cards.slice(
      game.auction.index + Number(game.currentAuctionSale?.origin === 'normal'),
    ) ?? []),
  ];
  assert.deepEqual(
    cards.map((card) => card.id).sort(),
    inventory.cards,
    'physical card custody',
  );
  for (const player of game.players) {
    const amounts = [
      player.reserves,
      player.tanks,
      ...Object.values(player.forces),
    ];
    assert.ok(
      amounts.every((amount) => Number.isSafeInteger(amount) && amount >= 0),
      `nonnegative forces ${player.faction}`,
    );
    assert.equal(
      amounts.reduce((sum, amount) => sum + amount, 0),
      20,
      `force custody ${player.faction}`,
    );
    assert.ok(
      Number.isSafeInteger(player.spice) && player.spice >= 0,
      `nonnegative spice ${player.faction}`,
    );
    if (
      game.status !== 'setup' &&
      (player.faction === 'ixians' ||
        (game.advanced && ['emperor', 'fremen'].includes(player.faction)))
    )
      assert.ok(player.elites, `missing elite inventory ${player.faction}`);
    if (player.elites) {
      const elites = player.elites;
      const typed = [
        elites.reserves,
        elites.tanks,
        ...Object.values(elites.forces),
      ];
      assert.ok(
        typed.every((amount) => Number.isSafeInteger(amount) && amount >= 0),
        `nonnegative elites ${player.faction}`,
      );
      assert.ok(
        ['emperor', 'fremen', 'ixians'].includes(player.faction),
        'known elite inventory',
      );
      assert.equal(
        typed.reduce((sum, amount) => sum + amount, 0),
        player.faction === 'fremen' ? 3 : player.faction === 'ixians' ? 7 : 5,
        `elite custody ${player.faction}`,
      );
      assert.ok(
        elites.reserves <= player.reserves && elites.tanks <= player.tanks,
        `elite reserve/Tanks subset ${player.faction}`,
      );
      for (const [location, amount] of Object.entries(elites.forces))
        assert.ok(
          amount <= (player.forces[location] ?? 0),
          `elite board subset ${player.faction}`,
        );
    }
  }
  if (inventory.traitors && game.status !== 'setup')
    assert.deepEqual(
      [
        ...(game.traitorReserve ?? []),
        ...game.players.flatMap((player) => [
          ...player.traitors, ...(player.faceDancers ?? []).map(card => card.leader),
        ]),
      ].sort(),
      inventory.traitors,
      'physical traitor custody',
    );
}
