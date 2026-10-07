import assert from 'node:assert/strict';
import { createAuditorLeader, leaders, treacheryDeck } from '../game/cards';
import type { Game } from '../game/engine';
import { richeseCards } from '../game/richese-cards';
import { ecazTreacheryCards } from '../game/ecaz-cards';
import { traitorDeck } from '../game/traitors';
import { basicExpansionLeaderSkillsProfile } from '../game/leader-skill-profile';
import { validateLeaderSkills } from '../game/leader-skills';
import { ownedStrongholdCards, STRONGHOLD_CARDS } from '../game/stronghold-cards';

/** Fixed inventory captured after genuine setup initialization, before any choices. */
export function sampleInventory(game: Game) {
  return {
    leaderSkills: !!game.leaderSkills,
    strongholds: game.strongholdCards
      ? STRONGHOLD_CARDS.map(card => card.id).sort()
      : null,
    cards: [
      ...treacheryDeck(game.expansions),
      ...(game.ecazTreachery ? ecazTreacheryCards() : []),
      ...(game.players.some((player) => player.faction === 'richese')
        ? richeseCards()
        : []),
    ]
      .map((card) => card.id)
      .sort(),
    // The bounded Moritani preview has a separate public retired-card zone.
    traitors: game.expansions.length && !basicExpansionLeaderSkillsProfile(game) &&
      !game.moritaniAssassinatePreview
      ? null
      : traitorDeck(
          game.players.map((player) => ({
            // Advanced CHOAM adds its printed extra Auditor disc during setup, so
            // its Traitor Card is part of the physical deck.
            leaders: [
              ...leaders(player.faction),
              ...(game.advanced && player.faction === 'choam'
                ? [createAuditorLeader()]
                : []),
            ],
          })),
          game.expansions.includes('ix'),
        ).sort(),
  };
}

export function verifySampleCustody(
  game: Game,
  inventory: ReturnType<typeof sampleInventory>,
  previous?: Game,
) {
  assert.equal(!!game.leaderSkills, inventory.leaderSkills, 'Leader Skills module custody');
  if (game.leaderSkills) validateLeaderSkills(game.leaderSkills, game.players);
  assert.equal(!!game.strongholdCards, !!inventory.strongholds, 'Stronghold Cards module custody');
  if (game.strongholdCards) {
    const state = game.strongholdCards;
    // Reuse the module's physical map and acquisition-turn validation. Custody
    // is retained during play; current board control is not a custody census.
    ownedStrongholdCards(state, game.players[0].id);
    assert.deepEqual(Object.keys(state.owners).sort(), inventory.strongholds,
      'physical Stronghold Card custody');
    assert.ok(state.claimedTurn <= game.turn, 'Stronghold acquisition cannot be in the future');
    for (const owner of Object.values(state.owners))
      assert.ok(owner === null || game.players.some(player => player.id === owner),
        'Stronghold owner must be a current seat');
    if (state.claimedTurn === 0)
      assert.ok(Object.values(state.owners).every(owner => owner === null),
        'unclaimed Stronghold Cards must be unowned');
    if (game.status === 'setup')
      assert.equal(state.claimedTurn, 0, 'Stronghold setup cannot have settled custody');
    if (previous?.strongholdCards) {
      assert.ok(state.claimedTurn >= previous.strongholdCards.claimedTurn,
        'Stronghold acquisition cannot move backward');
      if (state.claimedTurn === previous.strongholdCards.claimedTurn)
        assert.deepEqual(state.owners, previous.strongholdCards.owners,
          'Stronghold holders must persist until the next end-Mentat settlement');
    }
  }
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
    let visitorNormal = 0;
    let visitorElite = 0;
    for (const occupants of Object.values(game.homeworlds?.custody?.visitors ?? {})) {
      const group = occupants[player.id];
      if (group) {
        visitorNormal += group.normal;
        visitorElite += group.elite;
      }
    }
    const amounts = [
      player.reserves,
      player.tanks,
      ...Object.values(player.forces),
      visitorNormal,
      visitorElite,
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
    if (!player.elites) assert.equal(visitorElite, 0, `unexpected elite visitors ${player.faction}`);
    if (player.elites) {
      const elites = player.elites;
      const typed = [
        elites.reserves,
        elites.tanks,
        ...Object.values(elites.forces),
        visitorElite,
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
        ...(game.ecazLoyalty?.card ? [game.ecazLoyalty.card] : []),
        ...game.players.flatMap((player) => [
          ...player.traitors, ...(player.faceDancers ?? []).map(card => card.leader),
        ]),
        ...(game.moritaniAssassinate?.opportunities ?? [])
          .filter(receipt => receipt.stage === 'replaced')
          .map(receipt => receipt.card!),
      ].sort(),
      inventory.traitors,
      'physical traitor custody',
    );
}
