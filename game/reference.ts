import { STRONGHOLD_CARDS } from './stronghold-cards';
import { FACTION_RULES } from './faction-reference';
import { FACTIONS, PHASES } from './catalog';
import { RICHESE_CARD_DEFINITIONS } from './richese-cards';
import { HOMEWORLD_CARDS } from './homeworld-cards';
import { NEXUS_CARD_REFERENCE } from './nexus-card-reference';

export const RULE_CHECKLIST_AREAS = [
  'Implementation',
  'Player controls',
  'AI',
  'Documentation',
  'Verification',
] as const;
export type RuleChecklistItem = {
  area: (typeof RULE_CHECKLIST_AREAS)[number];
  status: 'Implemented' | 'Partial' | 'Planned';
  detail: string;
  /** Repository evidence for this bounded development checkpoint. */
  evidence?: string[];
};
export type RuleTopic = {
  id: string;
  title: string;
  category:
    | 'Getting started'
    | 'Turn phases'
    | 'Cards'
    | 'Factions'
    | 'Advanced & expansions';
  coverage: 'Implemented' | 'Partial' | 'Planned';
  summary: string;
  searchText?: string;
  steps: string[];
  example?: string;
  related?: string[];
  checklist?: RuleChecklistItem[];
};

export const PHASE_HELP = [
  'Seal the storm dials. After the distance is revealed, play any storm cards and confirm movement.',
  'Reveal a spice blow, resolve worms and card responses, then finish any Nexus and Fremen rides.',
  'Claim charity once if below two spice. Advanced Bene Gesserit receives two spice regardless of wealth. Then mark yourself ready.',
  'Bid or pass in turn. A winning bidder chooses how to pay before income and bonus-card responses resolve.',
  'Return eligible forces and leaders from the tanks to your reserves. Finish when your revival choices are complete.',
  'Ship before moving. Select a destination sector and, for a move, the forces leaving one territory.',
  'Choose a battle, resolve faction powers, seal plans, decide traitors, then choose which winning cards to keep.',
  'Forces collect spice in their own sector. Review the results, then continue to Mentat Pause.',
  'Bribes become available and the table checks victory. If nobody wins, the next turn begins.',
];
export const HELP = {
  truthBattle:
    'A Yes or No battle answer restricts only the stated condition. Your other plan elements may change. Earlier Truthtrance, Voice and prescience must also be satisfied. Available Ghola revivals can prepare a required leader or support income. Complete the private preparation and its response before sealing; an impossible promise is released after the pending power response resolves.',
  ixTechnology:
    'Ixians privately choose a starting card before the rest are shuffled and dealt. Before bidding, inspect one extra card and return one to the top or bottom, then shuffle the auction pool. Advanced Ixians can swap one upcoming card with a hand card before Atreides looks, once per round. An ally may replace the card it just purchased with the deck’s top card. Each bidding advantage has its own Karama response before the effect; canceled inspection reveals nothing.',

  mobileStronghold:
    'The Hidden Mobile Stronghold is a separate stronghold whose occupants survive storms and worms. It cannot relocate into, out of or through the storm; battles wait while its pointing sector is in storm. After the first storm, Ixians place it at a non-stronghold sector. While Ixian forces occupy it, they may relocate it up to three territories before later storm dials or reveals. Declare the sector route to collect spice along it. Other factions enter by movement through the pointing sector; only Ixians ship directly inside, with Bene Gesserit accompaniment allowed. It counts toward victory for its controller. Further movement and collection interaction audits are pending.',

  ixTransport:
    'A selected cyborg lets its movement group travel two territories; a cyborg left behind does not. Ornithopters allow three. Cyborgs collect three spice each and cost three to revive; suboids collect normally and cost two. Choose either type for the free revival.',
  ixForces:
    'Suboids always dial one-half strength and cannot receive spice support. Cyborgs count two in basic play; in advanced play they need one spice each for strength two and otherwise count one. After losses, surviving suboids may replace cyborgs lost in that battle, one for one.',
  tleilaxuSpecial:
    'Once per game, Tleilaxu can spend a real Karama at a normal revival declaration to prevent that faction’s normal force and leader revivals for this turn. The attempt costs no spice and returns no pieces. Ghola treachery and Emperor special Karama remain separate; full timing and exception audits are pending.',
  techTokens:
    'Tech tokens are public industries. Their income is paid once at the end of the matching phase, in an amount equal to the owner’s token count. A battle winner takes one from the loser. All three must belong to one player to count as a stronghold.',
  summonedWorm:
    'Fremen’s special Karama summons a worm in sand once per game during Spice Blow and Nexus. Resolve destruction and protection immediately, then resume the spice blow. The worm causes a Nexus at the end of that blow, followed by Fremen rides. Calling the worm does not draw or discard a spice card.',
  choamWorthless:
    'Kulon adds one territory of movement range on CHOAM’s turn. La La La prevents a player’s free force revival for the phase. Baliset blocks a player’s movement into a CHOAM-occupied territory while permitting shipment. Trip to Gamont returns another player’s force to reserves during Mentat, before victory. Jubba Cloak protects CHOAM’s forces in one territory during a storm movement. A Karama response precedes discarding these cards; canceled cards remain in hand.',
  choamCombat:
    'CHOAM may reserve spice for an ally’s advanced battle support. The ally chooses the payment split when sealing. A traitor victory costs the winner no support; any revealed traitor prevents CHOAM force-payment income.',
  fullPlan:
    'Atreides may spend its special Karama once per game to inspect a full battle plan. The chosen combatant commits dial, leader, weapon, defense, spice support and KH before the private inspection. Only Atreides receives this view. The private panel stays available while the other combatant plans, without an inspection confirmation.',
  guildShipment:
    'The Guild may spend its special Karama once per game to stop a declared off-planet shipment before payment or arrival. The shipper keeps its forces and spice and may still move. Fremen’s southern reinforcements are on-planet.',
  specialKarama:
    'A faction’s special Karama consumes a Karama card and may be used once per game in its permitted phase. This does not prevent later ordinary Karama uses.',
  handExchange:
    'Choose exactly as many cards to return as you took. You may include newly acquired cards. The game resumes the suspended auction step after your return.',
  spice:
    'Your available spice pays for bids, shipments and revivals. Ally pledges and deferred bribes are tracked separately.',
  sector:
    'The storm covers one numbered sector. Choose the exact sector where your forces arrive; collection also uses sectors.',
  reserves:
    'Forces outside the board. Shipment brings reserves onto Dune; revival returns dead forces here first.',
  tanks:
    'Dead forces and leaders wait in the Tleilaxu Tanks until an eligible revival returns them to play.',
  dial: 'Commit forces to a battle. In the basic game, each force dialed contributes one strength. The winner loses the forces dialed; the loser loses its army.',
  leader:
    'Choose an available leader or Cheap Hero. A surviving leader used in another territory this turn is unavailable. Harkonnen can use a captive once; its original faction cannot use it while captured.',
  weapon:
    'Projectile weapons defeat an unshielded leader; poison defeats a leader without a snooper. A lasgun and any played shield cause an explosion unless traitors override the battle.',
  defense:
    'A shield protects against projectiles. A snooper protects against poison. One card cannot occupy both battle slots.',
  response:
    'The table pauses before this power resolves. Other factions can use a legal Karama cancellation; everyone can allow the power.',
  ally: 'Set aside spice for an ally’s bids or shipments. You may reclaim unused funds, but a current winning bid must remain funded.',
  prescience:
    'Only the requested element becomes fixed. The opponent keeps the rest of their plan private until both combatants seal their plans.',
};

const phaseDetails = [
  [
    'The storm begins in sector 1. Player circles stay at sectors 2, 5, 8, 11, 14 and 17, including at smaller tables. After movement, the next occupied circle approached counterclockwise acts first.',
    'On the first turn, the players nearest the start on its two sides each secretly dial zero through twenty. Add both dials to move the storm. Later basic turns use the two players who last used the battle wheels, with dials one through three. If no battle intervened, the previous storm dialers continue. Both dials stay hidden until both are submitted.',
    'After revelation, everyone has a chance to play Weather Control or Family Atomics. A card change clears previous confirmations.',
    'Confirm movement to let the storm advance once everyone is ready.',
    'In the advanced game with Fremen, later turns reveal the forecast storm card instead of collecting new dials. Storm casualties and Fremen foresight each resolve before the spice draw.',
  ],
  [
    'Everyone confirms the draw. A new blow remains open for Harvester before the table accepts it.',
    'Worm protection decisions resolve before the Nexus. Alliances change only once the spice response window is finished.',
    'After the Nexus, Fremen choose whether to ride. Select forces from the worm territory and a legal destination.',
    'The advanced game resolves two separate spice blows. Finish the first blow’s Nexus and rides before revealing the second. Each blow has its own Harvester window.',
  ],
  [
    'If CHOAM is present, first resolve its income response. CHOAM then pays other factions’ charity; if its income was canceled, charity comes from the bank. Use Claim charity when eligible to bring ordinary available spice to two.',
    'Mark yourself ready after making your choice. Other players complete their choices independently.',
  ],
  [
    'Before each auction, resolve the Atreides foresight response. The card stays hidden until that response is allowed. Cancellation affects this card only.',
    'The highlighted player may raise the bid or pass. A new high bid clears previous passes.',
    'Holding Karama permits a bid above your available spice. If outbid, keep the card. A winning bid above your funds requires Karama.',
    'After everyone else passes, the winner chooses spice payment or Karama. The table then resolves applicable Emperor-income and Harkonnen-bonus responses.',
    'In Homeworld development tables with Emperor, the last completed auction opens End of Bidding. High Kaitain paid discards and CHOAM closing sales or trades may occur in either order. Finish your opportunity when ready; another card action clears readiness before the phase advances.',
  ],
  [
    'Choose the number of forces to revive. The server tracks the free allowance and the phase limit across multiple requests.',
    'In the base game, Fremen can take their available free force revivals but cannot buy normal force revivals. When the Tleilaxu faction is in the game, Fremen may also pay for normal returns within the current limit. The limit remains three unless Tleilaxu permits five; merely enabling the Ix expansion does not grant this exception. Emperor-funded extras and Ghola use separate rules.',
    'An allied Fremen player can grant three free force revivals during this phase.',
    'Use the leader selector to choose a dead leader. Revival cycles determine whether it is eligible; strength determines its normal cost.',
    'In development Ecaz fixtures, finishing Revival opens Ambassador placement after any CHOAM closing market. See Ecaz Ambassadors for the supported placement controls and remaining effects. Full expansion starts remain disabled.',
  ],
  [
    'At the start of this phase, resolve the Atreides spice foresight response. If allowed, Atreides privately inspects the next card, including when using double spice blow.',
    'Select a destination and sector. Ship from reserves before making a force move.',
    'For movement, select the source forces. Enable Combine sectors to include several groups from the same territory.',
    'A Fremen move using the two-territory advantage has a Karama response. Cancellation leaves the forces in place and limits this move to one territory; city ornithopters and a later extra move keep their normal rules.',
    'Guild transport can move a group across the planet or return it to reserves. Ordinary movement is checked against range, storm and stronghold occupancy.',
    'You may pass through an ally’s territory on a legal route that ends elsewhere. The printed clarification also permits shipping into allied territory followed by departure; that temporary arrival and its departure obligation are not yet supported by the table.',
    'Ecaz and its reciprocal ally may share territories permanently and count as one faction toward stronghold capacity. This applies to normal shipment, ground routes and Ambassador arrivals. It does not grant extra movement, bypass storm or mobile-stronghold entry rules, or apply to homeworlds. Their three jointly occupied stronghold victory is supported; shared desert allocation is also supported. Combined combat and the Fremen endgame exception remain unfinished.',
    'A restored pending physical shipment is checked again before forces or spice are committed. If its saved turn, force allocation, destination, price or authorized contribution no longer matches the table, it is rejected without changing the saved declaration.',
    'Finish shipment and movement explicitly. Any Bene Gesserit free-shipment decision and its response must finish first.',
    'Advanced Guild may choose when to take its complete shipment-and-movement turn. The table offers a choice before another player starts. Guild cannot interrupt a turn already underway.',
  ],
  [
    'The current aggressor selects a territory and opponent.',
    'Bene Gesserit chooses or declines Voice, then Atreides chooses or declines prescience. Each used power has a Karama response window.',
    'The opponent commits only the requested prescience element. Both combatants then independently seal their full plans.',
    'After revelation, each eligible player chooses whether to reveal a traitor. Harkonnen may support an ally.',
    'When the revealed dial and support permit only one winning casualty allocation, it settles automatically. Multiple legal allocations still ask the winner to choose. Optional card retention and faction responses remain separate.',
    'A winner with played cards chooses which to discard before the next battle or collection.',
  ],
  [
    'Ordinary collection resolves automatically when this phase begins. If Ecaz and its ally both collect from a desert territory, their shared pool waits for allocation.',
    'Only forces in the sector containing spice collect it. Remaining spice stays on the board.',
    'In the advanced game, an occupant receives two additional spice for Arrakeen, two for Carthag and one for Tuek’s Sietch. These payments stack and are separate from spice gathered by forces.',
    'For each shared desert pool, Ecaz can propose a split. The other ally may accept or counter; either decision owner may instead choose an equal split, with any odd spice going to Ecaz’s ally. Proposals remain private to the pair until settlement. The table cannot advance until every pool is allocated.',
    'Advanced Ecaz Collection gives both allies their full bank income in co-occupied Arrakeen, Carthag and Tuek’s Sietch. Karama prevents only Ecaz’s income from those shared strongholds; the ally’s income, Ecaz’s other stronghold income and desert allocation remain unchanged.',
    'Review the table chronicle and your spice, then mark yourself ready.',
  ],
  [
    'Deferred bribes become available when Mentat begins. At CHOAM tables, victory waits until Mentat actions, the closing market and a final Trip to Gamont opportunity finish. Other tables currently check victory on entering the phase.',
    'A single faction needs three strongholds; an alliance or a player in a two-player game needs four. A stronghold still occupied by opponents under storm does not count toward victory.',
    'On the final turn, check normal wins, then the Fremen special condition, then Guild. Without Guild, Fremen wins; without either faction, the highest individual stronghold count wins, including ties.',
    'If play continues, mark yourself ready to start the next turn.',
  ],
];
const phaseIds = [
  'storm',
  'spice-blow',
  'charity',
  'bidding',
  'revival',
  'movement',
  'battle',
  'collection',
  'mentat',
];
export const phaseRuleId = (phase: number) => phaseIds[phase] ?? 'setup';

export const RULE_TOPICS: RuleTopic[] = [
  {
    id: 'implementation-checklist',
    title: 'Rules implementation checklist',
    category: 'Getting started',
    coverage: 'Partial',
    summary:
      'Track implementation, player controls, AI, documentation and verification separately for each reviewed feature.',
    steps: [
      'The linked topics contain a five-part checklist. Implemented describes only the stated feature boundary; Partial identifies remaining work and Planned means it is not active.',
      'Verification entries identify focused regression suites. Passing those checks does not certify every interaction, browser journey or complete expansion game.',
      'This checklist is being extended across the rules. Features without a checklist still have a topic-level coverage label and are not implicitly complete.',
      'Advanced and full expansion faction starts remain disabled. Development fixture coverage is not permission to start an unsupported mode.',
    ],
    related: [
      'setup',
      'truthtrance-spice',
      'ecaz-ambassadors',
      'richese-cards',
      'richese-acquisition',
      'richese-gift',
      'distrans-transfer',
      'nullentropy-search',
      'richese-no-field',
      'automatic-casualties',
      'fremen-movement-karama',
      'automatic-responses',
      'automatic-decisions',
      'ai-pacing',
      'ecaz-modules',
      'homeworlds',
      'advanced-combat',
    ],
  },
  {
    id: 'richese-cards',
    title: 'Richese card collection',
    category: 'Cards',
    coverage: 'Partial',
    summary:
      'Inspect ten Richese cards and review the implemented auction flow. Card-effect integration is incomplete and full Richese starts remain disabled.',
    steps: [
      'Richese begins with one of each of these ten cards in a separate cache. These cached cards are not part of its hand and are not initially shuffled into the ordinary Treachery deck.',
      'This public reference shows printed identities, not the contents of any player’s current cache or hand. Open an inspector for the full original gameplay explanation. Inspection never plays, acquires or discards a card.',
      'When a Richese card is discarded, it enters the normal discard pile rather than returning to the cache. Removing an unsold card from the game is a different outcome. Discard contents remain private except when a card effect authorizes inspection.',
      'Nullentropy Box grants its user a private discard search for two spice, excluding any Nullentropy Box. It does not draw from the deck. After the search, shuffle the remaining discard pile and discard the Box on top.',
      'The collection belongs to Richese in both Basic and Advanced play. Advanced Black Market and special Karama acquisition add ways to obtain cards; they do not change these ten physical identities.',
      'Development tables support the cache auction first or last, with Once Around or Silent bidding. Advanced Black Market offers a hand card using normal, Once Around or Silent bidding; other players may buy it, and an unbid or canceled offer returns to the seller.',
      'The controls show the card only to entitled viewers, accept a public Black Market claim, and let bidders choose their own and pledged ally spice. Silent bids remain private until all eligible players submit. A donor cannot reduce pledged funding during unfinished Silent bidding, and a Black Market card reserved for sale cannot be played elsewhere. Atreides inspection, applicable Harkonnen bonus draws and Ixian allied replacement follow the sale’s origin.',
      'Other buyers pay Richese for a cache or Black Market sale. Richese buying its own cache card pays the Emperor or bank. Only the winner’s committed funding is collected; losing Silent bids do not spend their spice. An unbid cache card may be kept for free if the hand has room, or removed from the game.',
      'A player whose hand becomes full is automatically passed, or submits zero in an unfinished Silent lot. A full-hand owner’s unbid cache card is removed automatically. If every hand is full, preparing the normal pool does not draw and lose unseen cards.',
      'AI supports cache choices and all three offered bidding methods using its own projected information. It currently skips the optional Black Market prelude. A seller in an already offered Black Market lot passes or submits zero.',
      'Some unresolved rules are explicitly blocked: changing the normal card count after cache-auction cancellation, exhausted-cache arithmetic, positive Black Market self-bids, and advanced Ixian Technology substitution on special lots. These are implementation guards while the rules are resolved, not claims of official prohibitions.',
      'Juice of Sapho now supports bounded first/last Once Around and movement ordering; see its timing guide for current limits. Richese’s Karama uses the existing generic handler, Distrans supports a separate private hand transfer, Nullentropy Box supports a paid private discard search, Ornithopter supports its two movement modes, and Residual Poison supports a random opposing leader death before leader commitment in development fixtures. Portable Snooper supports ordinary and late poison defense. Stone Burner supports a guarded weapon commitment and revealed leader-effect choice. Mirror Weapon and Semuta Drug remain unfinished, as do the other Sapho timing modes; this does not certify every Karama interaction. Richese expansion starts remain disabled. Each component guide identifies its currently available action. Independent continuation and persisted-room checks pass. Desktop checks confirmed all ten enlarged guides, direct topic links, Once Around payment and restored private Silent bidding. Mobile and full Richese-game verification remain unfinished.',
    ],
    related: [
      'choam-modules',
      'faction-richese',
      'richese-acquisition',
      'richese-gift',
      'nullentropy-search',
      'juice-of-sapho',
      'implementation-checklist',
      'richese-no-field',
      ...RICHESE_CARD_DEFINITIONS.map(({ card }) => `card-${card.id}`),
    ],
    checklist: [
      {
        area: 'Implementation',
        status: 'Partial',
        detail:
          'Verified inventory and the first/last cache and advanced Black Market auction pipelines are integrated in development fixtures, including funding, secrecy and sale-origin effects. Card actions and guarded unresolved combinations remain unfinished; full starts stay disabled.',
      },
      {
        area: 'Player controls',
        status: 'Partial',
        detail:
          'Readable inspectors accompany cache/hand offer selection, method and direction, first/last declaration, public claims, sealed bids, funding splits and free-card/removal choices. Desktop catalog inspection, bidding and sealed-bid restoration passed. Browser rechecking confirmed the printed hand category, disabled unsupported action, visible reason and working inspector. Mobile and ordinary card-effect verification remain unfinished.',
      },
      {
        area: 'AI',
        status: 'Partial',
        detail:
          'All four profiles choose cache options and legal funded bids from their own projections, including offered Black Market lots. They currently decline the optional Black Market prelude. Card-effect strategies and complete Richese games remain unverified.',
      },
      {
        area: 'Documentation',
        status: 'Partial',
        detail:
          'Each card has an original guide; auction controls, payment and privacy rules are explained here. Source ambiguities and card-effect interaction gaps are retained explicitly rather than filled with assumed rules.',
      },
      {
        area: 'Verification',
        status: 'Partial',
        detail:
          'Focused checks pass for thirteen engine scenarios, eleven independent reviews, seven persisted-room scenarios, eight AI scenarios across four profiles, eighteen auction mechanisms, nine funding cases, six inventory cases, six presentation cases and five roster cases. Bounded desktop inspection, payment and reconnect checks pass. Full Richese games and mobile coverage remain unverified.',
        evidence: [
          'tests/richese-cards.test.ts',
          'tests/richese-card-presentation.test.ts',
          'tests/richese-engine.test.ts',
          'tests/richese-engine-review.test.ts',
          'tests/richese-auction-review.test.ts',
          'tests/richese-auction-recovery.test.ts',
          'tests/richese-auction-bots.test.ts',
          'tests/richese-auction.test.ts',
          'tests/richese-funding.test.ts',
          'tests/choam-richese-leaders.test.ts',
        ],
      },
    ],
  },
  {
    id: 'juice-of-sapho',
    title: 'Juice of Sapho: changing order',
    category: 'Cards',
    coverage: 'Partial',
    summary:
      'Choose one available first or last position, then discard Sapho. Battle aggressor and other timing modes remain unfinished.',
    steps: [
      'In a current Once Around auction, first is available before anyone bids. Last is available before your own bid, including after Richese. You still get only one bidding opportunity and must outbid the current high bid to win.',
      'Discarding Sapho frees a hand slot. A full-hand holder can join a still-open lot through this order change. A completed bid or pass cannot be repeated, and a finished lot cannot reopen.',
      'The movement controls change complete shipment and movement turns at a boundary before the current player begins. First requires that nobody has begun a combined turn this phase and that Advanced Guild timing is absent. Last stays after the Guild even if the Guild later chooses to wait.',
      'Finish existing shipment, movement, card preparation and pending decisions before changing order. Your hand panel lists only currently available choices. A reserved card or a position you already hold cannot be selected.',
      'Completed bids and turns stay completed. Storm order, committed funding and movement counters do not reset. Refreshing preserves the same remaining opportunities and any declared last position.',
      'These are the supported development controls, not additional printed restrictions. Battle aggressor, ordinary cyclic auction scope, other phase ordering and intervention during a partly completed combined turn remain unfinished. Silent bids are simultaneous; their storm-order tie rule is unchanged.',
    ],
    example:
      'Atreides bids 2. Before taking its bid, the Emperor uses Sapho to go last. Richese bids 3, then the Emperor must bid at least 4 to win. Atreides does not receive another bid.',
    related: [
      'richese-cards',
      'movement',
      'faction-guild',
      'implementation-checklist',
    ],
    checklist: [
      {
        area: 'Implementation',
        status: 'Partial',
        detail:
          'Finite Once Around and clean combined-turn ordering, physical discard, full-hand eligibility and persisted last-over-Guild protection. Remaining timing modes are guarded.',
      },
      {
        area: 'Player controls',
        status: 'Partial',
        detail:
          'Owner-only first/last actions, readable inspector and timing explanations. No aggressor or cyclic-auction controls yet.',
      },
      {
        area: 'AI',
        status: 'Partial',
        detail:
          'All four levels use the server-derived private options. Full Richese games and comparative timing strategy remain unverified.',
      },
      {
        area: 'Documentation',
        status: 'Partial',
        detail:
          'Printed alternatives, implemented boundaries and unresolved timing distinctions are recorded separately.',
      },
      {
        area: 'Verification',
        status: 'Partial',
        detail:
          'Finite-order, engine, all-profile and real persisted-room tests cover once-only play, funding, full-hand eligibility, privacy and Guild deferral. Full expansion games remain unverified.',
        evidence: [
          'tests/ordered-opportunity.test.ts',
          'tests/juice-of-sapho-engine.test.ts',
          'tests/juice-of-sapho-engine-review.test.ts',
          'tests/juice-of-sapho-bots.test.ts',
          'tests/juice-of-sapho-recovery.test.ts',
        ],
      },
    ],
  },
  {
    id: 'richese-acquisition',
    title: 'Richese special Karama purchase',
    category: 'Advanced & expansions',
    coverage: 'Partial',
    summary:
      'Spend a Karama and three spice once per game to choose a private cache card for your own hand.',
    steps: [
      'In advanced development tables, Richese can use its special Karama once per game. Select an available Karama in your hand and one eligible card from your own cache. The activating Karama is discarded; the chosen card enters your hand secretly.',
      'This is a purchase for Richese itself. Pay three of your available spice to Emperor when present, otherwise the bank. The general Emperor purchase-income rule supplies this payment destination. An ally receives no Harkonnen bonus or Ixian replacement from this direct cache acquisition.',
      'A Karama cannot cancel the special purchase itself. Emperor income has a separate response: canceling that income does not undo the purchase or restore the spent special power.',
      'The private hand panel provides both card selectors and enlarged inspection. It shows the payment recipient and the server’s current availability reason. A reserved auction card cannot be taken from that lot. Spending pledged or already committed funds is not allowed.',
      'Full-hand activation is guarded pending a ruling on when the spent Karama leaves the hand. Buying the final cached card is also guarded pending the empty-cache auction rule. Pending interactions may need to finish first. These development limits are not claimed as printed prohibitions.',
      'All four AI profiles can choose the canonical Richese Karama when the projection allows it and enough spice remains. They leave other cache effects to future implementation and give pending responses, decisions and Truthtrance priority.',
      'Richese ally gifts, Distrans transfer and Nullentropy Box search have their own hand-panel controls and rules topics. These are separate from special Karama purchase and retain their own capacity, timing and private-custody boundaries. Selectable Richese and combined advanced starts remain disabled.',
    ],
    related: [
      'richese-cards',
      'richese-gift',
      'nullentropy-search',
      'special-karama',
      'card-richese-karama',
      'implementation-checklist',
    ],
    checklist: [
      {
        area: 'Implementation',
        status: 'Partial',
        detail:
          'Private cache acquisition, once-per-game consumption and separate Emperor income are integrated in development fixtures. Full-hand, final-cache and further transfer/search cases remain guarded or unfinished.',
      },
      {
        area: 'Player controls',
        status: 'Partial',
        detail:
          'Private activation and cache selectors include inspectors, payment recipient and authoritative blocked reasons. The desktop purchase flow and restored income response were verified in the browser. Mobile and broader interaction checks remain.',
      },
      {
        area: 'AI',
        status: 'Partial',
        detail:
          'Four profiles conservatively acquire only the currently usable canonical Karama, retain a spice reserve and honor pending interaction priority.',
      },
      {
        area: 'Documentation',
        status: 'Partial',
        detail:
          'Purchase, secrecy, payment, cancellation and explicit interpretation boundaries are explained here. Other acquisition effects await integration.',
      },
      {
        area: 'Verification',
        status: 'Partial',
        detail:
          'Engine and independent review tests cover private custody, payments, nested response restoration and guards. All four AI profiles, concurrent purchase requests, restart and a real browser purchase are verified in bounded fixtures. Complete Richese games remain unverified.',
        evidence: [
          'tests/richese-acquisition-bots.test.ts',
          'tests/richese-acquisition.test.ts',
          'tests/richese-acquisition-review.test.ts',
          'tests/richese-auction-recovery.test.ts',
          'tests/reference.test.ts',
        ],
      },
    ],
  },
  {
    id: 'richese-gift',
    title: 'Richese allied card gift',
    category: 'Advanced & expansions',
    coverage: 'Partial',
    summary:
      'Give a Richese card already in your hand to your current ally when their hand has room.',
    steps: [
      'This Basic alliance ability lets Richese give one of its ten Richese card identities from its own hand to its current ally at any time. It does not take a card from the cache, charge spice, draw a bonus card or require an exchange. Giving a card is distinct from playing its effect.',
      'In your private hand, open Give a Richese card to your ally. Inspect the available cards, choose one and press Give. The panel explains unavailable cards and hand-space or commitment restrictions. A pending gift shows its card only to the two allies; inspecting it never transfers it or answers a game decision.',
      'Karama can cancel this alliance power before transfer. The gift card stays reserved in Richese’s hand while that response resolves. Cancellation leaves both hands unchanged; allowing the power transfers the card once. There is no separate recipient confirmation for this gift.',
      'An ordinary decision, another response or a phase-opening window can be suspended while the gift resolves, then restored with its existing choices and passes. An active Truthtrance question must finish first. A newly received Karama may be used in a restored response that is still open, under the normal response rules.',
      'You cannot give a card committed to a sealed plan, fixed prescience answer, unresolved played-card retention, unsold Black Market lot or accepted replacement. Gifts must preserve binding battle promises and enough resources for committed exchanges. Your ally must retain space for an unsettled auction commitment and the mandatory return from a Harkonnen hand exchange; completed plans and private inspection snapshots do not change when a gift arrives.',
      'The server checks alliance, exact card ownership, capacity and commitments again before transfer. An obsolete pending gift aborts without a partial transfer and restores its interrupted flow. Unrelated players see the gift power, not its private card identity. A pending card cannot also be spent, exchanged or randomly extracted.',
      'After cancellation, trying the same card again in the same phase is currently blocked pending a ruling on repeated use. This is an explicit implementation guard, not a printed once-per-phase limit on all gifts. Other legally available cards are assessed separately.',
      'All four AI profiles conservatively give only the canonical Richese Karama during Bidding to free a full hand when the ally’s public card count is lower and there is room. They do not inspect ally hand contents or infer an unknown need for a card. Pending responses, decisions and Truthtrance take priority.',
      'All ten canonical Richese cards may be transferred when legal, and Karama has its existing card-effect handler. Distrans supports its separate card-transfer effect, Nullentropy Box supports paid private discard search, Ornithopter supports its two movement modes, and Residual Poison supports a random opposing leader death before leader commitment. Portable Snooper supports ordinary and late poison defense. Stone Burner supports a guarded weapon commitment and revealed leader-effect choice. Juice of Sapho supports bounded Once Around and movement ordering. Mirror Weapon and Semuta Drug remain unfinished, as do the other Sapho timing modes. Desktop gift transfer and fresh-tab pending recovery have been checked in a synthetic table. Mobile, broader interactions and full Richese games remain pending; Richese starts remain disabled.',
    ],
    related: [
      'richese-cards',
      'richese-acquisition',
      'card-karama',
      'alliance-funding',
      'card-truthtrance',
      'implementation-checklist',
    ],
    checklist: [
      {
        area: 'Implementation',
        status: 'Partial',
        detail:
          'Canonical hand-to-ally transfer, private reservation, Karama cancellation, suspended continuation restoration and commitment/capacity revalidation are integrated in development fixtures. Same-card same-phase retry after cancellation awaits a ruling; complete Richese interactions remain unfinished.',
      },
      {
        area: 'Player controls',
        status: 'Partial',
        detail:
          'The hand panel offers card selection, full inspection, unavailable reasons and one explicit Give control. Pending card details are limited to the two allies and standard response controls resolve the power. Desktop owner selection, automatic uncontested transfer and fresh-tab recovery of a contested gift have passed synthetic-table browser checks. Mobile acceptance remains pending.',
      },
      {
        area: 'AI',
        status: 'Partial',
        detail:
          'All four profiles make a bounded canonical-Karama gift to free a full bidding hand using public ally counts and owner-only legal choices. Other card effects and broader gift strategy are unfinished; canceled gifts are not automatically retried.',
      },
      {
        area: 'Documentation',
        status: 'Partial',
        detail:
          'The Basic alliance source, transfer versus card use, private controls, nested continuation, commitments and cancellation-retry interpretation are explained separately. This does not certify all expansion rules.',
      },
      {
        area: 'Verification',
        status: 'Partial',
        detail:
          'Six pure custody, five engine, eight independent review, four all-profile AI and three persisted recovery tests pass. Engine cases cover all ten card identities in Basic and Advanced across nine phases; recovery includes competing requests and changed-alliance abort without hand replacement. The complete registered suites pass 1,230 rules/client and 93 persisted/API tests. Desktop transfer and fresh-tab pending recovery pass in a synthetic table. Mobile and complete Richese-game acceptance remain pending.',
        evidence: [
          'tests/richese-gift.test.ts',
          'tests/richese-gift-engine.test.ts',
          'tests/richese-gift-review.test.ts',
          'tests/richese-gift-bots.test.ts',
          'tests/richese-gift-recovery.test.ts',
        ],
      },
    ],
  },
  {
    id: 'distrans-transfer',
    title: 'Distrans card transfer',
    category: 'Cards',
    coverage: 'Partial',
    summary:
      'Give another player a card from your hand, then discard Distrans.',
    steps: [
      'Any faction holding Distrans may use it. Choose another player whose hand has room and a different Treachery Card from your own hand. The recipient need not be your ally. Transfer that card intact, then discard Distrans into the ordinary discard pile.',
      'Open the Distrans transfer panel in your hand, select the recipient and card, inspect either card, then press Give and discard Distrans. There is no spice payment, purchase bonus, recipient acknowledgement or faction-power Karama response. Other players see the played Distrans, not the transferred card identity.',
      'The printed exception is during a bid. Its exact span remains unresolved: an unpaid open auction lot is currently guarded, while a pre-bid context or completed purchase income response may allow the effect. This is not a prohibition on the entire Bidding phase. Giving Distrans itself also remains guarded pending clarification.',
      'Distrans resolves in one server action and keeps an existing response, decision or phase opening in place. Active Truthtrance retains priority. Both outgoing cards must be uncommitted; a sealed plan, fixed prescience answer, pending Richese gift or accepted replacement cannot lose its reserved card.',
      'A transfer must preserve binding battle answers, compulsory discards and both sides of a pending Harkonnen hand exchange. The recipient must retain room for its mandatory incoming return. Optional proposals that become unavailable can still finish through their existing decline or no-effect path.',
      'A different legal transfer can fill or free space for a pending Richese gift. The ordinary Distrans transfer resolves first, and the pending gift rechecks capacity before moving its own card. A canceled alliance gift does not automatically prevent using this separate card effect.',
      'All four AI profiles use their own legal projected cards. They may give an allied Bene Gesserit or CHOAM a Worthless card, or share a duplicate ordinary weapon, defense or Karama to free a full hand. They do not inspect the recipient’s private cards and preserve existing decision priority.',
      'Semuta discard reactions, mobile acceptance, the unresolved bid and self-transfer cases, and full combined Richese games remain unfinished. Completing this transfer does not enable all remaining Richese cards or expansion starts.',
    ],
    related: [
      'card-richese-distrans',
      'richese-gift',
      'richese-cards',
      'card-truthtrance',
      'implementation-checklist',
    ],
    checklist: [
      {
        area: 'Implementation',
        status: 'Partial',
        detail:
          'Synchronous two-card custody, private transfer, normal Distrans disposal, both-card reservations and prospective transaction/promise checks are integrated. Open-lot timing and self-transfer remain explicit guards; future Semuta reactions are unfinished.',
      },
      {
        area: 'Player controls',
        status: 'Partial',
        detail:
          'Recipient and given-card selectors, both inspectors, unavailable reasons and an explicit give-and-discard action are integrated. Desktop selection, real transfer and fresh-tab recovery passed in a synthetic table, including a preserved pending gift. Mobile acceptance remains pending.',
      },
      {
        area: 'AI',
        status: 'Partial',
        detail:
          'All four profiles make bounded useful transfers from entitled projections, preserve decision priority and cannot repeat a consumed physical card. Broader negotiation and complete expansion-game strategy remain unfinished.',
      },
      {
        area: 'Documentation',
        status: 'Partial',
        detail:
          'The ordinary card effect is explained separately from Richese alliance gifts, with its printed bid exception, exact disposal, private controls and unresolved interactions.',
      },
      {
        area: 'Verification',
        status: 'Partial',
        detail:
          'Six pure custody, six engine matrix, six independent review, five all-profile AI and three persisted/API cases cover the implemented boundaries. The integrated suites pass 1,258 registered rules/client/component and 96 persisted/API tests. Desktop transfer and fresh-tab recovery passed in a synthetic table. Mobile and full Richese games remain unverified.',
        evidence: [
          'tests/distrans.test.ts',
          'tests/distrans-engine.test.ts',
          'tests/distrans-engine-review.test.ts',
          'tests/distrans-bots.test.ts',
          'tests/distrans-recovery.test.ts',
        ],
      },
    ],
  },
  {
    id: 'portable-snooper',
    title: 'Portable Snooper: ordinary or late poison defense',
    category: 'Cards',
    coverage: 'Partial',
    summary:
      'Choose it as your defense, or add it after revealing a plan with room for a late defense.',
    steps: [
      'Portable Snooper is a poison defense. Any faction holding the canonical card may select it in the normal defense slot. It protects against ordinary poison and Chemistry used as a weapon. It is not a shield; it does not stop projectiles, Lasgun, Artillery Strike or an activated Poison Tooth. Poison Blade still kills through its projectile attack.',
      'After both battle plans are publicly revealed, open Portable Snooper in your hand to add it as a late defense. Your original plan must have a leader or Cheap Hero and no actual defense. A lone Worthless card in either slot permits this extra defense; a weapon plus Worthless, two Worthless cards or another two-card plan does not. There must be room within the two battle-card slots.',
      'The Bene Gesserit Voice still applies. A prohibition on poison defense forbids Portable Snooper; a poison-weapon prohibition does not. When Voice compels a poison defense and you hold this card, satisfy that requirement in the original plan. You cannot omit it on the promise of adding it later.',
      'Play the late defense before submitting your own traitor decision, after any current Truthtrance, response or Poison Tooth choice finishes. This application procedure uses the existing decision opportunity, regardless of either hand, and does not add a holder-only public window. Your submitted traitor decision closes your late opportunity; another combatant submitting first does not close it.',
      'The original revealed plan remains unchanged. The public table shows Portable Snooper separately as added after reveal, with its own inspector. Prescience and structured Truthtrance claims about the original defense slot still refer to that original slot. Broader freeform promises remain broader than the structured slot model.',
      'The played card stays reserved with your battle cards until normal cleanup. A losing player discards it; the general official FAQ permits a winner to retain it. Moritani alliance retention can apply when its ordinary conditions allow. Successful traitors and actual Lasgun–shield explosions keep their existing precedence. Portable adds no spice payment, bounty or automatic traitor call.',
      'The saved battle event and physical reservation survive refresh and reconnect. Duplicate or stale play cannot add another defense or repeat cleanup. The card identity stays private before play; only its owner sees its availability. All four AI profiles use the ordinary defense slot and may add it late when public revealed effects show it saves their leader.',
    ],
    related: [
      'card-richese-portable-snooper',
      'richese-cards',
      'battle',
      'implementation-checklist',
    ],
    checklist: [
      {
        area: 'Implementation',
        status: 'Partial',
        detail:
          'Ordinary defense role, Voice, late defense overlay, immutable original plans, physical reservation and winner/loser/Moritani cleanup are integrated. Full expansion combinations remain unfinished.',
      },
      {
        area: 'Player controls',
        status: 'Partial',
        detail:
          'Normal defense and Prescience selectors include the card. A private late-play panel gives timing reasons; revealed components distinguish and inspect the added defense.',
      },
      {
        area: 'AI',
        status: 'Partial',
        detail:
          'All four profiles select a legal normal defense or use public revealed damage to assess late protection, with no opponent-hand access. Full expansion strategy calibration remains unfinished.',
      },
      {
        area: 'Documentation',
        status: 'Partial',
        detail:
          'Explains printed extra timing, card limits, Voice, damage exceptions, original plan promises, application scheduling and the official general winner-retention clarification.',
      },
      {
        area: 'Verification',
        status: 'Partial',
        detail:
          'Pure role/slot checks, twelve-faction Basic/Advanced matrix, independent interaction review, all-profile AI and forced concurrent recovery tests cover supported behavior. Full expansion games remain unverified.',
        evidence: [
          'tests/portable-snooper.test.ts',
          'tests/portable-snooper-engine.test.ts',
          'tests/portable-snooper-review.test.ts',
          'tests/portable-snooper-bots.test.ts',
          'tests/portable-snooper-recovery.test.ts',
        ],
      },
    ],
  },
  {
    id: 'residual-poison',
    title: 'Residual Poison: a random leader before battle plans',
    category: 'Cards',
    coverage: 'Partial',
    summary:
      'Before either combatant chooses a leader, send one available opposing leader at random to the Tanks, without spice payment.',
    steps: [
      'Any faction holding the physical card may play it against its actual battle opponent before either combatant commits a leader. Open Residual Poison in your private hand and use its play action. The server selects the victim at random; neither player chooses or confirms that death.',
      'An available leader must be alive and eligible for this battle territory. A leader used in this same territory remains eligible; one used elsewhere does not. Cheap Hero cards are not leader discs. The card is discarded once, the victim enters the Tanks, and no spice bounty or battle victory is awarded. Force counts and ordinary battle preparation continue.',
      'In games with Richese seated, both combatants finish a shared preparation opportunity before submitting plans or a leader-valued Prescience answer. This application timing procedure appears independently of both hands and does not reveal who holds a preparation card. Active responses, decisions and Truthtrance resolve first. A completed readiness step does not itself choose a leader.',
      'A foreign ghola retains its recorded revival custody when killed. Duke Vidal is the same physical disc with its death history retained, and his temporary control ends. An involuntary death releases impossible battle promises and can require a previously answered non-leader Prescience question to be answered again; it never redraws the victim to preserve an answer.',
      'The handling of a still-secret Harkonnen captive after this death is unresolved. Advanced games with Harkonnen seated therefore guard this card based on that public configuration, independently of any hidden captive. This is a development limitation, not a printed ban. Legacy battles without a saved preparation event are not retroactively reopened.',
      'Saved battle events bind readiness and card actions. Reconnect preserves the opportunity and a committed death. Competing actions use room versions: a stale request cannot repeat the discard or death and must refresh before retrying. All four AI profiles use only their entitled card availability and opponent information.',
    ],
    related: [
      'card-richese-residual-poison',
      'richese-cards',
      'battle',
      'implementation-checklist',
    ],
    checklist: [
      {
        area: 'Implementation',
        status: 'Partial',
        detail:
          'Pre-leader timing, uniform eligible-disc selection, automatic death, single discard, custody, promise reconciliation and exact event validation are integrated. Advanced Harkonnen disclosure and full expansion combinations remain unresolved.',
      },
      {
        area: 'Player controls',
        status: 'Partial',
        detail:
          'Private card inspection and one play action accompany neutral readiness controls for both combatants. Death adds no acknowledgement or victim selector.',
      },
      {
        area: 'AI',
        status: 'Partial',
        detail:
          'All four profiles use entitled availability before readiness and leader commitment; they cannot inspect or score a hidden victim pool. Full expansion-game calibration remains unfinished.',
      },
      {
        area: 'Documentation',
        status: 'Partial',
        detail:
          'Explains printed timing and disposal, the shared application opportunity, casualty custody and explicit unresolved disclosure.',
      },
      {
        area: 'Verification',
        status: 'Partial',
        detail:
          'Pure selection, twelve-holder engine, independent review, four-profile AI and persisted concurrent-action tests cover supported boundaries. Full expansion games remain unverified.',
        evidence: [
          'tests/residual-poison.test.ts',
          'tests/residual-poison-engine.test.ts',
          'tests/residual-poison-engine-review.test.ts',
          'tests/residual-poison-bots.test.ts',
          'tests/residual-poison-recovery.test.ts',
        ],
      },
    ],
  },
  {
    id: 'ornithopter-movement',
    title: 'Ornithopter: one longer move or two different groups',
    category: 'Cards',
    coverage: 'Partial',
    summary:
      'Play the movement card for a maximum three-territory route or two distinct groups using their normal movement.',
    steps: [
      'During your movement turn, select your forces and destination using the normal board controls. In Ornithopter movement controls, choose one group up to three territories or two different groups using normal movement. No spice fee or extra reserve shipment is added.',
      'The longer-route option provides its own maximum of three territories without requiring Arrakeen or Carthag. It does not add three to another range. Storm, occupancy, alliance and route restrictions still apply. Card-derived range is independent of the Ixian cyborg movement advantage.',
      'For two groups, make the first move and resolve its actual arrival reactions before selecting the second. The second group uses the current normal range, including access established by the first move. Different subsets from the same origin are allowed; the first group cannot move again after merging with another force stack. Original eligible ordinary and elite counts are shown in your controls.',
      'A concealed No-Field may move as a group member without exposing its value. A marker moved in the first group cannot also move in the second. Revealing an unmoved marker converts its remaining entitlement to its actual placed forces; revealing a moved marker does not give those forces another move.',
      'A validated declaration moves the physical card from your hand to the public played-card area. It remains there through genuine CHOAM, Ixian or other arrival decisions and is discarded once when the chosen use ends. Random hand effects act on cards still in hand. Ending your movement closes any remaining card movement without undoing a completed group.',
      'The saved event binds retries and the remaining original-group data. Refresh and reconnect preserve that event. After disposal, recovery preserves the completed forces and marker event before opening arrival decisions or advancing an early-ended turn; it does not move the group again. Missing saved group data cannot be reconstructed from merged forces and blocks the damaged continuation instead of allowing reuse.',
      'Hajr and prior-move composition, Kulon against the fixed three-territory maximum, and advanced advisor use remain explicit unresolved combinations. These development guards are not printed prohibitions. Existing unfinished entry and optional-module interactions remain unfinished; full Richese starts are still disabled.',
      'All four AI profiles use their own projected movement choices and original-group limits. They can use a longer route, split distinct groups, finish interrupted movement and end optional movement when no legal second group remains. Complete Richese-game calibration is not yet certified.',
    ],
    related: [
      'card-richese-ornithopter',
      'richese-cards',
      'movement',
      'implementation-checklist',
    ],
    checklist: [
      {
        area: 'Implementation',
        status: 'Partial',
        detail:
          'Both movement modes, played-card custody, exact event continuation, typed original-group quotas, concealed-marker conversion and separate disposal recovery for completed moves or early endings are integrated. Three named source combinations and existing expansion interactions remain unresolved.',
      },
      {
        area: 'Player controls',
        status: 'Partial',
        detail:
          'Uses the existing board source/destination and multi-sector controls, a mode selector, an inspector and remaining-group guidance. Automatic disposal adds no confirmation.',
      },
      {
        area: 'AI',
        status: 'Partial',
        detail:
          'Four profiles use projected ranges and remaining ordinary/elite/marker quotas without hidden-value access. Complete expansion strength calibration remains unfinished.',
      },
      {
        area: 'Documentation',
        status: 'Partial',
        detail:
          'Explains both choices, independent card range, current normal range, distinct groups, public played-card custody and explicit unresolved combinations.',
      },
      {
        area: 'Verification',
        status: 'Partial',
        detail:
          'Pure quota and engine checks cover twelve holders, both game modes, merged groups, exact marker events, stale state and interrupted faction decisions. Full expansion acceptance remains unverified.',
        evidence: [
          'tests/ornithopter.test.ts',
          'tests/ornithopter-engine.test.ts',
          'tests/ornithopter-engine-review.test.ts',
          'tests/ornithopter-discard-continuations.test.ts',
          'tests/ornithopter-discard-recovery.test.ts',
        ],
      },
    ],
  },
  {
    id: 'nullentropy-search',
    title: 'Nullentropy Box: paid private discard search',
    category: 'Cards',
    coverage: 'Partial',
    summary:
      'Pay two spice to search privately, recover one non-Box card, shuffle the remainder and discard the Box on top.',
    steps: [
      'Any faction holding the canonical Nullentropy Box can use its paid search. Pay two spice to the bank, choose one card from the Treachery discard pile other than any Nullentropy Box, shuffle the remaining pile, then discard the played Box on top. This is not a deck draw or a purchase: there is no Emperor income, Harkonnen bonus or Ixian purchase replacement.',
      'Open Nullentropy Box in your private hand. Before payment, the panel shows only your Box and its availability reason, with no discard names or candidate count. Pay 2 spice and search privately begins the search. Only the paying player receives the eligible discard faces.',
      'During the paid decision, inspect the cards and use Take on one card to finish. Inspection itself does not select anything. There is no free cancellation after viewing the pile and no second confirmation after selection. If exactly one legal card is available, the server selects it automatically without asking for an identical acknowledgement.',
      'Payment is recorded once before inspection. Refresh or reconnect restores an unfinished paid search for its owner without charging again. While it is open, other gameplay actions wait so they cannot change the reserved Box or discard pile. The completed search saves the recovered card and shuffled pile before restoring an interrupted response, decision or phase opening. Recovery does not charge, select or shuffle again, and does not replay the earlier action.',
      'The selected card enters your hand privately. Other players do not receive the selected identity or the shuffled discard faces. Temporary search access ends on completion; the normal discard pile remains private, even though the played Box is placed face up on top. Past inspection records do not become a permanent live discard browser.',
      'An active Truthtrance question and exact card or transaction commitments must resolve as required. A full hand is currently guarded: the printed sequence adds the recovered card before discarding the Box, and the temporary capacity question is unresolved. The current implementation requires a pre-existing free hand slot. This is not a verified prohibition on every net-zero exchange.',
      'A pending Guild refund claim on a discarded shipping Karama also blocks starting the search while that provisional refund policy is unresolved. The guard protects the competing claim to that card; it is not a general ban on Box during Shipment. Empty or only-Box searches are rejected before payment under the current unsupported-empty-search policy; there is no fallback deck draw.',
      'All four AI profiles start only when their own projected availability and spice reserve allow it. They do not inspect unpaid discard contents. Once paid, they choose from their entitled cards, prefer existing functional effects over unfinished Richese faces and complete a legal selection even if only unfinished effects remain. A paid search takes priority over optional actions.',
      'This bounded search, its controls and recovery are integrated in development fixtures. Full-hand activation, the provisional Guild refund interaction and future Semuta discard reactions remain unresolved or unfinished. Mirror Weapon and Semuta Drug remain inactive, and full Richese starts remain disabled. Complete browser, mobile and full-game acceptance is not claimed here.',
    ],
    related: [
      'card-richese-nullentropy-box',
      'richese-cards',
      'richese-acquisition',
      'card-truthtrance',
      'implementation-checklist',
    ],
    checklist: [
      {
        area: 'Implementation',
        status: 'Partial',
        detail:
          'Paid inspection, exact private custody, server-shuffled remainder, Box on top, sole-choice automatic completion and restored parent continuations are integrated. Full-hand and provisional Guild-refund guards remain; future discard reactions are unfinished.',
      },
      {
        area: 'Player controls',
        status: 'Partial',
        detail:
          'The hand panel shows only the owned Box before payment. The owner’s paid decision has readable card guidance, inspectors and one Take action per eligible card. Other players wait without receiving faces. Browser/mobile acceptance remains pending.',
      },
      {
        area: 'AI',
        status: 'Partial',
        detail:
          'All four profiles use their own budget and availability to begin, without discard lookahead. Paid choices use only entitled candidates, prefer functional effects and finish without an extra acknowledgement or retry. Full Richese strategy remains unverified.',
      },
      {
        area: 'Documentation',
        status: 'Partial',
        detail:
          'Payment, temporary private access, disposal order, continuation recovery and separate capacity/refund interpretations are documented. This does not grant generic discard browsing or certify the remaining expansion effects.',
      },
      {
        area: 'Verification',
        status: 'Partial',
        detail:
          'Pure custody, engine, independent review, AI and persisted recovery suites exercise the bounded search contract. Checks cover payment once, private candidates, exact selection, shuffled custody, stale/repeated requests and sole-card completion. Static rendering verifies prepayment secrecy and paid controls; final global totals and browser success are not claimed.',
        evidence: [
          'tests/nullentropy-box.test.ts',
          'tests/nullentropy-box-engine.test.ts',
          'tests/nullentropy-box-engine-review.test.ts',
          'tests/nullentropy-box-bots.test.ts',
          'tests/nullentropy-box-recovery.test.ts',
          'tests/box-discard-continuations.test.ts',
          'tests/box-discard-recovery.test.ts',
          'tests/box-discard-auditor.test.ts',
        ],
      },
    ],
  },
  {
    id: 'richese-no-field',
    title: 'Richese No-Field tokens',
    category: 'Advanced & expansions',
    coverage: 'Partial',
    summary:
      'Concealed zero, three and five tokens represent one force until they are revealed.',
    steps: [
      'Richese has three No-Fields, numbered zero, three and five. A concealed token counts as one force. Only one may be deployed on Arrakis, and consecutive own or allied shipments cannot use the same token.',
      'A normal No-Field shipment pays the one-force price. The concealed token moves like a force. Before Battle, Richese may reveal it voluntarily; a token involved in battle is revealed with the Battle Plan. Revelation brings the indicated forces from reserves, limited by what remains there.',
      'The revealed token stays face up until another token is placed. Revealing it does not clear the previous-shipment restriction. An allied No-Field shipment reveals immediately and uses the ally’s reserves; an existing token must be revealed before another shipment.',
      'Before an eligible ally uses its shipment, the game holds an offer opportunity for Richese. Richese may pass or privately propose a token, destination and payment. The ally accepts the exact offer and chooses its permitted regular/elite mix, or declines without payment. Success consumes the ally’s shipment, not Richese’s shipment or either player’s movement.',
      'Allied shipment costs one spice into a stronghold or two elsewhere. Either ally may pay the full price; a two-spice shipment may instead cost each ally one. Resolve prevention before payment or revealing an existing Richese marker; a successful shipment reveals that old marker first, then immediately reveals and materializes the allied token. Fremen reserves are on the planet, so they are not eligible for this off-planet method. Guild recipients and active Karama shipment discounts remain unavailable while their pricing is unresolved.',
      'Storm and worm exposure reveal the token and destroy its forces. A zero token still had one-force presence before revelation. Trip to Gamont forces a reveal, then returns one force if present. Revealing a token already in a territory does not trigger Terror a second time.',
      'Development tables support your own concealed shipment, movement of a marker alone or with a physical group, voluntary reveal and one-force board presence. Physical reserves remain unchanged until reveal. Karama can prevent the No-Field shipment, with Guild shipment prevention and payment handled separately. Price and chosen allied funding are shown before shipment.',
      'The map shows a concealed marker without its denomination to everyone. Richese privately sees its token values, last-use restriction and reveal control. Movement selection keeps the marker separate from physical forces. No hidden denomination or physical token identity is included in another player’s projected board state.',
      'Marker-only battles use the owner’s private reserve-limited force pool. Both plans must be sealed before the token materializes. A zero-token battle still resolves with its leader, cards and traitor decisions. Ordinary Atreides prescience cannot request this opponent’s dial; other eligible plan elements remain available.',
      'Concealed collection, occupancy and control use one-force presence. Exposed storm sectors and unprotected worm destruction reveal and remove the resulting actual forces. Storm shelter and other sectors remain separate. Trip to Gamont at a location with a marker reveals it, even if ordinary forces also occupy that sector, then returns one actual force if present. It is still used if zero forces remain. Canceling the CHOAM power leaves the marker concealed.',
      'All four AI profiles choose from their own private token inventory, pay only the one-force shipment price, move the marker explicitly and reveal positive tokens when useful. They retain zero-token presence and use only public information to assess opponents. They also offer safe positive tokens from their own inventory during the allied opportunity, fund them with their own spice and accept or decline private offers using their own force and payment information. A human Richese player’s offer window holds an AI ally’s shipment. Pending responses, decisions and Truthtrance retain priority.',
      'Mixed-force battle dials and entire-plan special Karama inspection against a No-Field are guarded pending rules resolution. Guild-recipient and active-Karama allied pricing, Homeworld custody, broader Truthtrance and some interrupted entry combinations remain unfinished. Ordinary physical movement can coexist with a marker, but this does not settle the mixed battle formula. Richese starts remain disabled.',
    ],
    related: [
      'richese-cards',
      'richese-acquisition',
      'movement',
      'battle',
      'implementation-checklist',
    ],
    checklist: [
      {
        area: 'Implementation',
        status: 'Partial',
        detail:
          'Own shipment, movement, voluntary reveal, effective presence, collection, storm/unprotected-worm destruction, Gamont reveal/return and marker-only battle integration work in development fixtures. Allied offers, typed recipient consent, either full payer or a one-each two-spice split, prevention and immediate reveal are integrated. Mixed battles, whole-plan inspection, Guild/Karama allied pricing and broader combinations remain guarded or unfinished.',
      },
      {
        area: 'Player controls',
        status: 'Partial',
        detail:
          'Private inventory, token selection, exact payment/funding feedback, reveal and marker movement controls are integrated with concealed map markers and private battle bounds. Browser shipment, marker-only movement, invitation recovery and voluntary reveal have been checked. The allied opportunity, private proposal, payment selection and recipient force/consent controls are integrated; owner proposal, restart recovery and recipient acceptance have been checked in synthetic browser fixtures. Mobile and full battle acceptance remain pending.',
      },
      {
        area: 'AI',
        status: 'Partial',
        detail:
          'All four profiles support own shipment, marker movement/reveal and marker-only battles using entitled projections. They handle the allied offer/acceptance window, preserve human ownership and avoid repeated declined offers, unsupported mixed groups and forbidden dial prescience. Complete Richese-game strategy remains unverified.',
      },
      {
        area: 'Documentation',
        status: 'Partial',
        detail:
          'The lifecycle, allied consent/payment/typed forces, on-planet Fremen exclusion, current controls, privacy and five separate progress facets are recorded. Source interpretations and guarded combinations remain explicit; no combined-mode certification is claimed.',
      },
      {
        area: 'Verification',
        status: 'Partial',
        detail:
          'Thirteen pure-model, ten engine, eight independent review and nine AI scenarios pass, plus nineteen existing Gamont regressions. Tests include all hidden values, exact payments, private projections, zero battles, hazards, Gamont cancellation and JSON continuation. Four persisted-room tests also pass for private recovery, competing shipments, cancellation, stale movement and duplicate reveal. Allied shipment adds eleven engine, seven independent review, seven AI and three persisted scenarios, including declineable arrival preflight and AI fallback. The allied shipment checkpoint passed 1,207 rules/client and 90 persisted/API tests. Browser own shipment, movement and invitation recovery/reveal pass, and the allied owner proposal survived a server restart and recipient acceptance was checked in a synthetic fixture. Complete Richese-game acceptance remains pending.',
        evidence: [
          'tests/richese-no-field.test.ts',
          'tests/richese-no-field-engine.test.ts',
          'tests/richese-no-field-review.test.ts',
          'tests/richese-no-field-bots.test.ts',
          'tests/richese-no-field-recovery.test.ts',
          'tests/choam-gamont.test.ts',
          'tests/richese-allied-no-field.test.ts',
          'tests/richese-allied-no-field-review.test.ts',
          'tests/richese-allied-no-field-bots.test.ts',
          'tests/richese-allied-no-field-recovery.test.ts',
        ],
      },
    ],
  },
  {
    id: 'stone-burner',
    title: 'Stone Burner: undialed force tokens',
    category: 'Cards',
    coverage: 'Partial',
    summary:
      'Choose a leader effect after revelation; undialed physical tokens decide the battle.',
    steps: [
      'Any faction holding canonical Stone Burner may commit it as a Weapon / Special. It is a named special weapon for Voice, not a poison or projectile weapon. Prescience reveals its actual card identity while other plan elements stay private.',
      'After both plans reveal, choose to kill both leaders or ignore the strength of leaders who otherwise survive. Neither leader strength nor Kwisatz Haderach strength determines this battle. The choice affects deaths and bounty, not which undialed-force comparison is used. Ignoring strength supplies no protection against another weapon.',
      'Compare the number of physical force tokens not dialed into battle. The aggressor wins a tie. Dialed losses and spice support still follow their normal rules; elite strength is not an extra physical token.',
      'The plan editor checks the chosen dial and support against every projected public opposing force possibility. If legal force allocations could change the winner, commitment is blocked until that combined timing is supported. Ix expansion timing involving Poison Tooth also remains guarded pending its ordering ruling. Opposing hidden No-Field values are not inspected.',
      'Traitor and Lasgun–shield explosion precedence remain intact. Ordinary bounty applies unless another effect suppresses it. Stone Burner uses the general winning battle-card retention rule: a winner may keep it, and a losing played card is discarded. Normal Moritani ally retention may apply.',
      'The post-reveal choice is bound to the current battle event and cannot be repeated after refresh. Review both revealed plans and select one mode; there is no separate victim or death confirmation.',
    ],
    related: [
      'card-richese-stone-burner',
      'richese-cards',
      'battle',
      'implementation-checklist',
    ],
    checklist: [
      {
        area: 'Implementation',
        status: 'Partial',
        detail:
          'Canonical weapon admission, public pre-commit safety, persisted reveal choice, physical-token comparison and ordinary cleanup are integrated in development fixtures. Ambiguous combinations remain guarded.',
      },
      {
        area: 'Player controls',
        status: 'Partial',
        detail:
          'Weapon and prescience selectors include Stone Burner; the editor explains chosen dial/support restrictions, provides an inspector and exposes both reveal modes.',
      },
      {
        area: 'AI',
        status: 'Partial',
        detail:
          'All profiles generate guarded low-dial Stone candidates and choose a reveal mode from public force/leader information. Broader expansion strategy remains unverified.',
      },
      {
        area: 'Documentation',
        status: 'Partial',
        detail:
          'Explains physical-token victory, both leader choices, ordinary winner retention and explicit combined timing limits.',
      },
      {
        area: 'Verification',
        status: 'Partial',
        detail:
          'Pure, engine, independent review, bot and recovery scenarios cover the supported slice; browser and complete expansion-game certification are separate.',
        evidence: [
          'tests/stone-burner.test.ts',
          'tests/stone-burner-engine.test.ts',
          'tests/stone-burner-review.test.ts',
          'tests/stone-burner-bots.test.ts',
          'tests/stone-burner-recovery.test.ts',
        ],
      },
    ],
  },
  ...RICHESE_CARD_DEFINITIONS.map(
    (definition): RuleTopic => ({
      id: `card-${definition.card.id}`,
      title: `${definition.card.name} — Richese`,
      category: 'Cards',
      coverage: 'Partial',
      summary: `${definition.printedType}. ${definition.summary}`,
      steps: [
        ...definition.gameplay,
        definition.card.effect === 'juiceOfSapho'
          ? 'Use the Juice of Sapho panel for an available first or last Once Around or movement position. Battle aggressor and other timing modes remain unfinished; consult the timing guide.'
          : definition.card.effect === 'karama'
            ? 'This physical Karama uses the existing generic handler in development fixtures. Full Richese starts and complete interaction verification remain unavailable.'
            : definition.card.effect === 'distrans'
              ? 'Use the Distrans transfer panel to choose another player and a separate held card. Open-bid timing and self-transfer remain guarded pending clarification.'
              : definition.card.effect === 'nullentropyBox'
                ? 'Use the Nullentropy Box panel to pay two bank spice for a private discard search. Full-hand activation and provisional Guild refund claims remain guarded pending resolution.'
                : definition.card.effect === 'ornithopter'
                  ? 'Use the Ornithopter movement controls with a selected group and destination. Hajr/prior-move composition, fixed-range Kulon and advanced advisors remain explicitly unresolved.'
                  : definition.card.effect === 'residualPoison'
                    ? 'Use the Residual Poison panel before either combatant commits a leader. A shared preparation step provides an opportunity regardless of hand contents; advanced Harkonnen tables remain guarded pending the secret-captive ruling.'
                    : definition.card.effect === 'stoneBurner'
                      ? 'Use Stone Burner in the battle weapon selector and review the chosen dial/support guard before sealing. Choose the leader effect after revelation; combined timing remains guarded.'
                      : definition.card.effect === 'portableSnooper'
                        ? 'Choose Portable Snooper as your ordinary poison defense, or use the late-defense panel after reveal before your own traitor decision. It uses ordinary winner retention and cannot stop Poison Tooth.'
                        : 'Reference component only: this Richese card’s game actions are not enabled.',
      ],
      ...(definition.card.effect === 'semutaDrug'
        ? {
            checklist: [
              {
                area: 'Implementation' as const,
                status: 'Partial' as const,
                detail:
                  'Fresh-card recovery has isolated transfer rules. Ixian and CHOAM exchanges, battle cleanup, Sabotage, Robbery, the used Nullentropy Box, retired Ornithopter, answered Truthtrance and completed ordinary card effects preserve unfinished steps for recovery. Random victims, completed draws and the paid Box shuffle are not repeated. Semuta activation and the remaining discard timings are unfinished.',
              },
              {
                area: 'Player controls' as const,
                status: 'Partial' as const,
                detail:
                  'The complete card can be inspected. Playing Semuta, declining its opportunity and choosing a fresh discard are not enabled.',
              },
              {
                area: 'AI' as const,
                status: 'Partial' as const,
                detail:
                  'AI resumes saved exchanges, battle cleanup, forced Terror discards, completed Box searches, retired Ornithopter movement, answered Truthtrance queues and completed ordinary card effects automatically. No difficulty can yet play Semuta or choose its claimed card.',
              },
              {
                area: 'Documentation' as const,
                status: 'Partial' as const,
                detail:
                  'The guide explains one fresh other-player discard and selection from simultaneous discards. Reaction timing and full-hand use remain unresolved.',
              },
              {
                area: 'Verification' as const,
                status: 'Partial' as const,
                detail:
                  'Isolated transfer, private exchange, battle, Box, Ornithopter, Truthtrance and ordinary-card recovery, and concurrent settlement checks pass. These do not verify an actual Semuta opportunity or a complete Richese game.',
                evidence: [
                  'tests/semuta-drug.test.ts',
                  'tests/treachery-discard-continuations.test.ts',
                  'tests/multiplayer-discard-continuations.test.ts',
                  'tests/battle-discard-continuations.test.ts',
                  'tests/battle-discard-recovery.test.ts',
                  'tests/terror-discard-continuations.test.ts',
                  'tests/terror-discard-recovery.test.ts',
                  'tests/box-discard-continuations.test.ts',
                  'tests/box-discard-recovery.test.ts',
                  'tests/box-discard-auditor.test.ts',
                  'tests/ornithopter-discard-continuations.test.ts',
                  'tests/ornithopter-discard-recovery.test.ts',
                  'tests/truthtrance-discard-continuations.test.ts',
                  'tests/truthtrance-discard-recovery.test.ts',
                  'tests/ordinary-card-discard-continuations.test.ts',
                  'tests/ordinary-card-discard-recovery.test.ts',
                ],
              },
            ],
          }
        : {}),
      related: [
        'richese-cards',
        'choam-modules',
        ...(definition.card.effect === 'juiceOfSapho'
          ? ['juice-of-sapho']
          : definition.card.effect === 'karama'
            ? ['card-karama']
            : definition.card.effect === 'distrans'
              ? ['distrans-transfer']
              : definition.card.effect === 'nullentropyBox'
                ? ['nullentropy-search']
                : definition.card.effect === 'ornithopter'
                  ? ['ornithopter-movement']
                  : definition.card.effect === 'residualPoison'
                    ? ['residual-poison']
                    : definition.card.effect === 'stoneBurner'
                      ? ['stone-burner']
                      : definition.card.effect === 'portableSnooper'
                        ? ['portable-snooper']
                        : []),
      ],
    }),
  ),
  {
    id: 'ecaz-ambassadors',
    title: 'Ecaz Ambassadors: placement and remaining effects',
    category: 'Advanced & expansions',
    coverage: 'Partial',
    summary:
      'End-of-Revival placement, eight random entry effects, direct Ecaz Duke acquisition and consensual alliance formation are supported in development fixtures, with public token guides and private inspection history.',
    steps: [
      'Ecaz has its reusable Ambassador plus five randomly selected Ambassadors from the other ten identities. Inspect the public supply, placed tokens, triggered group and unused pool to read each effect.',
      'Placed Ambassadors are face up by designer clarification. This implementation also shows the unplaced supply openly by default; that supply policy is an interpretation, not an explicit official FAQ ruling.',
      'After everyone finishes Revival and any CHOAM closing market is complete, Ecaz may choose a supply token and an ordinary stronghold outside the storm with no Ambassador. The panel shows the next price and available spice. Placed Ambassadors cannot relocate through this control.',
      'The current closing order is CHOAM market, deferred technology income, then Ecaz placement. Income received at that point can fund placement. This combined order is an implementation choice, not a priority established by a combined official FAQ.',
      'The first placement costs one spice, the second two, and so on that turn. A declaration opens a Karama response before spice is paid or the token moves. Canceling stops the remaining placement opportunity for that turn; previous placements and payments remain.',
      'Finish Ambassador placement advances the phase. On a later turn the price begins at one again and the earlier placement block expires. Pending declarations survive reload without charging twice.',
      'The custody model returns destroyed tokens to supply and returns Ecaz after its trigger. Supported entry effects set regular tokens aside, permanently remove Bene Gesserit after its trigger, and replenish only after all five random tokens have triggered. Storm crossings return tokens from exposed Arrakeen and Carthag after the Shield Wall is destroyed. A Lasgun–shield explosion returns a token only if the explosion actually resolves; an overriding traitor victory leaves it placed. Destruction does not count toward the five triggers. The reusable Ecaz Ambassador can acquire Duke directly for Ecaz; it also offers a consensual alliance, while Duke loans remain unfinished.',
      'When an eligible entrant reaches the reusable Ecaz token, Ecaz may choose Acquire Duke Vidal for Ecaz if the shared disc is available. The token immediately returns to supply, its five random companions are unchanged, and the entrant resumes. Ecaz keeps an unused Duke across turns until battle use or Moritani acquisition. Already controlling him, assigning this effect to an ally, loans and Advanced Harkonnen custody remain visibly unavailable while their interactions are unfinished.',
      'Instead of acquiring Duke, unallied Ecaz can offer an alliance to an unallied entrant. The entrant accepts or refuses, then resumes its remaining actions. The triggered token returns to supply in either case. Acceptance activates both factions’ alliance abilities immediately and leaves Duke unchanged. An unavailable Duke does not prevent this alliance choice. Duke loans remain unfinished pending their custody ruling.',
      'When another eligible faction enters a marked stronghold, Ecaz may trigger its Ambassador for itself or its current ally, or leave the token in place. Ecaz itself, its ally, advisors and the faction matching the physical Ambassador do not trigger it. Entries with competing arrival reactions remain blocked until their ordering is implemented; a rejected entry does not spend or move its pieces.',
      'Emperor grants five bank spice. Atreides records the entrant’s current Treachery hand privately for the beneficiary; Harkonnen records one randomly selected held Traitor identity, or Face Dancer identity for a Tleilaxu entrant. These snapshots remain in the recipient’s private inspection history, identify when they were taken, and do not become a live view of later changes. Opening, enlarging or closing them needs no game acknowledgement.',
      'CHOAM lets the beneficiary choose any available hand cards, including none, for three spice each. Ixians require one available card to discard before drawing its replacement. Card controls respect projected reservations. After committing an Ixian exchange, a voluntary interruption must leave a card available for its required discard; a queued Truthtrance counts as already committed. A Bene Gesserit trigger permanently removes its token, then the beneficiary chooses an available effect outside the original supply for this group; unsupported copies remain visibly blocked.',
      'The Richese Ambassador automatically spends three of the chosen beneficiary’s spice for the top Treachery Card if the purchase can be completed. There is no extra purchase confirmation. An unavailable purchase consumes the triggered token without charging spice or granting a card; the public outcome does not disclose whether the beneficiary lacked spice or hand space. Emperor receives another faction’s payment unless that income is canceled. A Harkonnen buyer may receive its normal bonus card, subject to its hand limit and Karama. These benefits finish before movement or a worm ride resumes. Ixian allied replacement requires Bidding, so it does not apply to these entries.',
      'The Fremen Ambassador lets the beneficiary relocate one group already on the board directly to any available territory and sector, subject to storm and occupancy. Select physical forces from one territory, preserve elite quantities, and optionally include your concealed No-Field without revealing it. This independent move costs no shipment spice and does not use ordinary movement allowances. It can change sectors within one territory, but pieces already in the destination sector stay in place. Homeworlds and reserves are not board territories.',
      'The mobile stronghold can receive a non-Ixian group only from the territory it points to. Ecaz and its ally may co-occupy under Occupy. Advisors keep their applicable stance and accompaniment locks; an eligible arrival can request fighters. CHOAM may use Baliset during Shipment and Movement; if allowed, choose another legal destination. Intrusion or Terror resolves before the original entrant continues. Destinations causing both remain visibly unavailable pending a table interpretation. There is no extra decline after triggering; if no legal move remains, the effect finishes without moving pieces and its token stays consumed.',
      'The Guild Ambassador grants an immediate free shipment of zero through four physical reserve forces for Ecaz or its ally, including typed elites. Choose a clear territory and sector; this does not spend ordinary shipment or movement, ally aid or a retained rate card. Fremen may use destinations outside their ordinary reinforcement radius, but their southern reserves stay on-planet and this effect never permits storm entry. Only Ixians may ship directly into their placed mobile stronghold.',
      'During Shipment and Movement, Guild can use its special Karama to stop another eligible off-planet Ambassador shipment before forces arrive; it does not stop this grant during a phase-one worm sequence. A successful off-planet shipment may invite Bene Gesserit accompaniment and accrues applicable phase-five Heighliner income once. BG can accompany Ixians into the mobile stronghold. Projected accompaniment choices show blocked sectors and keep Polar Sink and decline available when legal. Intrusion, separate Terror and accompanying fighter-triggered Ambassadors finish before the original entrant or worm rider resumes.',
      'No-Field substitution into the free four-force grant awaits the user’s interpretation and is unavailable. Simultaneous Intrusion/Terror and Ambassador/Terror combinations remain blocked. Moritani Atomics Aftermath, Homeworlds and Discovery locations require their still-gated producers or modules; this checkpoint does not claim those combinations.',
      'All eleven effect guides are readable. Emperor, Atreides, Harkonnen, CHOAM, Ixian, Richese, Fremen and Guild entry effects are integrated, together with Bene Gesserit copies of those eight effects and direct Duke acquisition or consensual alliance through the reusable Ecaz token. The remaining effects, combined Occupy combat, exceptional Duke custody and complete Ecaz rules remain unfinished. Mobile stronghold placement is gated. Full Ecaz starts remain disabled.',
    ],
    checklist: [
      {
        area: 'Implementation',
        status: 'Partial',
        detail:
          'Inventory, placement and eight entry effects plus their Bene Gesserit copies and direct Ecaz Duke acquisition or consensual alliance are integrated. Storm/explosion token returns are integrated. Competing arrival ordering and remaining effects remain unfinished.',
      },
      {
        area: 'Player controls',
        status: 'Partial',
        detail:
          'Placement and entry controls show valid destinations, beneficiaries, copies and card choices with blocked reasons. Ecaz can offer an alliance to an eligible entrant, whose separate accept/refuse controls preserve decision ownership. Relocation controls select physical and elite forces by source sector, concealed markers and eligible advisor flips. Independent Guild shipment controls select typed reserve counts, destination sector or zero; BG accompaniment controls show source-specific blocked reasons. Public token guides and recipient-only historical card/identity inspectors remain available without acknowledgement.',
      },
      {
        area: 'AI',
        status: 'Partial',
        detail:
          'All four profiles handle placement, supported trigger/beneficiary choices, copied effects, legal CHOAM/Ixian card selection, Fremen relocation, Guild reserve shipment and its BG accompaniment from their own projections. They prefer an available Ecaz alliance offer and accept a valid owned reply; direct Duke acquisition remains the fallback when a new alliance is unavailable. Unsupported effects are declined; remaining effect policies are unfinished.',
      },
      {
        area: 'Documentation',
        status: 'Partial',
        detail:
          'Placement, supported entry decisions, private historical inspections, inventory lifecycle and all eleven effect descriptions are available. The Ecaz guide distinguishes consent, token commitment and Duke loans awaiting a custody ruling. Complete timing and interaction coverage remains open.',
      },
      {
        area: 'Verification',
        status: 'Partial',
        detail:
          'Focused tests cover custody, placement payment, entry continuation, private snapshots, effect choices, destruction and all four bot profiles. Persisted tests cover concurrent triggers, private snapshot restoration, and stale-event rejection; browser checks verified entry and enlarged private cards. Guild-focused tests cover physical quotes, historical continuations, cancellation, resume provenance, actual engine journeys and all four AI profiles. Guild multiplayer and browser verification are pending at this documentation checkpoint. Ecaz alliance tests cover both consent outcomes, real arrival and worm continuations, card suspension, private-state preservation and racing replies; browser checks confirm keyboard proposal and AI acceptance. Complete expansion games and competing arrivals remain.',
        evidence: [
          'tests/ecaz-ambassadors.test.ts',
          'tests/ecaz-placement.test.ts',
          'tests/ecaz-entry.test.ts',
          'tests/ecaz-duke-acquisition.test.ts',
          'tests/ecaz-duke-bots.test.ts',
          'tests/ecaz-duke-recovery.test.ts',
          'tests/ecaz-alliance.test.ts',
          'tests/ecaz-alliance-engine.test.ts',
          'tests/ecaz-alliance-recovery.test.ts',
          'tests/ecaz-entry-bots.test.ts',
          'tests/ecaz-entry-continuations.test.ts',
          'tests/ecaz-entry-recovery.test.ts',
          'tests/richese-ambassador.test.ts',
          'tests/richese-ambassador-bots.test.ts',
          'tests/richese-ambassador-interruptions.test.ts',
          'tests/fremen-ambassador-quote.test.ts',
          'tests/fremen-ambassador-engine.test.ts',
          'tests/fremen-ambassador-bots.test.ts',
          'tests/fremen-ambassador-cancellation.test.ts',
          'tests/fremen-ambassador-recovery.test.ts',
          'tests/guild-ambassador-quote.test.ts',
          'tests/guild-ambassador-advisor-quote.test.ts',
          'tests/guild-ambassador-continuation.test.ts',
          'tests/guild-ambassador-cancellation.test.ts',
          'tests/ambassador-resume.test.ts',
          'tests/guild-ambassador-engine.test.ts',
          'tests/guild-ambassador-bots.test.ts',
          'tests/treachery-discard-continuations.test.ts',
          'tests/multiplayer-discard-continuations.test.ts',
        ],
      },
    ],
    related: [
      'revival',
      'card-karama',
      'faction-ecaz',
      'duke-vidal',
      'ecaz-modules',
      'implementation-checklist',
    ],
  },
  {
    id: 'automatic-casualties',
    title: 'Automatic battle casualties and action notices',
    category: 'Getting started',
    coverage: 'Partial',
    summary:
      'A single legal casualty allocation settles immediately; optional choices still wait. A toggleable house notice explains tagged automatic events.',
    steps: [
      'After a battle resolves, the server calculates casualty allocations consistent with the revealed wheel and spice support. If exactly one allocation is legal, it applies that allocation without asking for an identical confirmation.',
      'If several physical casualty combinations are legal, the winner still chooses. Automatic casualties preserve later optional Ixian substitutions, winner card cleanup and Moritani ally retention; they do not choose those benefits for you.',
      'Newly received tagged events queue in order, with the acting house and event name shown for approximately 1.5 seconds each. Use Automatic action notices to turn the display on or off. The preference belongs to this browser; hiding notices does not disable automatic rule settlement or change AI timing.',
      'The notice is cosmetic and does not stop game progression. Reduced-motion settings suppress its fade. Reloading treats existing events as a baseline rather than replaying them. Events received while notices are off are consumed; turning notices on does not replay them. The bounded queue keeps the newest pending events if an unusually large backlog exceeds its capacity.',
      'Current notice events cover automatic battle casualties, successful Ecaz Ambassador placement, Emperor auction income, Harkonnen bonus-card draws and private full-plan inspection availability and supported successful Ambassador effects. The Harkonnen event reports the draw without exposing its private card identity. The inspection notice reveals no plan details; the entitled player reads those in the persistent private panel. Uncancelable responses now settle automatically as described in Automatic allowance of powers. Successful powers without a notice tag remain outside the current notice coverage.',
    ],
    checklist: [
      {
        area: 'Implementation',
        status: 'Partial',
        detail:
          'Sole battle casualty allocations settle automatically. The separate response checklist tracks automatic allowance; other forced outcomes and successful-power notice tags remain incomplete.',
      },
      {
        area: 'Player controls',
        status: 'Implemented',
        detail:
          'Multiple allocations and optional continuations retain controls. The cosmetic 1.5-second house notice has an on/off button and reduced-motion behavior.',
      },
      {
        area: 'AI',
        status: 'Implemented',
        detail:
          'Human and AI seats share the same automatic casualty settlement; bots still choose when multiple allocations remain.',
      },
      {
        area: 'Documentation',
        status: 'Partial',
        detail:
          'This topic explains the supported settlement and notice scope; further automatic outcomes require their own documentation.',
      },
      {
        area: 'Verification',
        status: 'Partial',
        detail:
          'Regression coverage preserves force counts, JSON replay safety, real casualty choices, substitution and retention. This does not certify all automatic effects or complete notice browser behavior.',
        evidence: [
          'tests/automatic-casualties.test.ts',
          'tests/moritani-retention.test.ts',
          'tests/duke-vidal-engine.test.ts',
        ],
      },
    ],
    related: [
      'battle',
      'advanced-combat',
      'ix-forces',
      'moritani-ally-retention',
      'automatic-responses',
      'ai-pacing',
      'implementation-checklist',
    ],
  },
  {
    id: 'automatic-responses',
    title: 'Automatic allowance of powers',
    category: 'Getting started',
    coverage: 'Partial',
    summary:
      'A power proceeds when no remaining player has a usable physical Karama option. Meaningful cancellation choices still wait for their player.',
    steps: [
      'The power’s owner cannot cancel that power and needs no Allow click. Other players without a usable physical Karama card also need no input. Once every remaining player with a cancellation option has explicitly allowed, the server completes the power and checks its next continuation.',
      'Your controls show only your own cancelable cards and whether you explicitly allowed. Other players’ pass choices, eligible cards and reasons for having no option are not exposed. A pending window can still reveal that some blocking option remains somewhere.',
      'A player who already allowed may still cancel while another player’s choice keeps the window open. Allies retain legal cancellation choices. Automatic allowance never chooses a card or a cancellation for you.',
      'Physical availability includes Advanced Bene Gesserit Worthless conversion and excludes cards reserved for Moritani battle retention, a sealed Battle Plan or prescience. Another Worthless conversion cannot directly cancel the live conversion response; an otherwise usable real Karama remains eligible.',
      'An active Truthtrance question or phase-opening choice pauses automatic allowance. After suspended windows return, the server checks the current hands and bindings again. Your battle promises are checked when committing an action: a physically usable card can remain listed conservatively even if spending it would break a promise and be rejected.',
      'New uncancelable windows settle with the action that creates them. Reconnecting can resume an older saved window through an authoritative background update; merely preparing a player’s view does not award spice or draw cards. Concurrent updates cannot award the same income or card twice.',
      'Supported responses share this behavior for human and AI seats. Complete promise-aware option filtering, all successful-power notice tags, and full expansion interaction verification remain unfinished. See Automatic battle casualties and action notices for the cosmetic queue.',
    ],
    checklist: [
      {
        area: 'Implementation',
        status: 'Partial',
        detail:
          'Physical-card eligibility and bounded response chains are integrated, including restored windows and persisted legacy recovery. Promise feasibility remains conservative until commit.',
      },
      {
        area: 'Player controls',
        status: 'Partial',
        detail:
          'Only the current viewer receives cancel-card IDs and explicit-pass state. Owners and players without a physical blocking option need no Allow click; promise-constrained candidates may still be rejected.',
      },
      {
        area: 'AI',
        status: 'Implemented',
        detail:
          'Bots use the same private response controls, skip unavailable response actions, and retain their own strategy for a meaningful cancellation choice.',
      },
      {
        area: 'Documentation',
        status: 'Implemented',
        detail:
          'This topic records physical eligibility, private explicit passes, restored continuations, timing inference and the conservative promise boundary.',
      },
      {
        area: 'Verification',
        status: 'Partial',
        detail:
          'Fifteen engine tests cover response chains, custody, overlays, promises and private views; seven persistence tests cover exact-once recovery, takeback races, bounded CAS and worker coalescing. Full expansion and notice-browser certification remain open.',
        evidence: [
          'tests/automatic-responses.test.ts',
          'tests/automatic-response-recovery.test.ts',
          'tests/moritani-retention-bots.test.ts',
        ],
      },
    ],
    related: [
      'card-karama',
      'card-truthtrance',
      'privacy',
      'automatic-casualties',
      'ai-pacing',
      'implementation-checklist',
    ],
  },
  {
    id: 'automatic-decisions',
    title: 'Automatic settlement without a choice',
    category: 'Getting started',
    coverage: 'Partial',
    summary:
      'A fully funded auction payment with no Karama alternative settles automatically. Atreides can keep reading a private plan without a confirmation step.',
    steps: [
      'When a winning bid’s declared split between your own spice and pledged ally funding can be paid exactly, and you have no physically usable Karama alternative, the server pays it automatically. A genuine Karama option or an unfunded payment still requires its existing decision; automatic settlement does not choose a card or alter the declared funding split.',
      'Atreides special Karama still requires a voluntary declaration and the selected combatant still commits first. Once that plan is committed, its entitled Atreides viewer can inspect the dial, support, leader and played cards persistently beside the normal planning controls. There is no Finish inspection action.',
      'The same private panel remains available when Atreides is outside the battle helping an ally. Only Atreides receives this special inspection; it is not copied into the ally’s private view. The inspection ends when both committed plans become public. Card enlargement and Truthtrance promise controls remain separate from sealing your plan.',
      'Older saved inspection acknowledgements and eligible payment confirmations can be resumed through authoritative normalization. A private view alone does not spend spice or expose a sealed plan to an unauthorized seat.',
      'Single-allocation battle casualties and uncancelable faction responses have their own linked checklists. Other decisions with only one legal outcome, complete promise-aware payment alternatives, and full expansion timing coverage remain under review.',
    ],
    checklist: [
      {
        area: 'Implementation',
        status: 'Partial',
        detail:
          'Exact funded payment without a physical Karama alternative and inspection-only acknowledgement removal are implemented, including eligible legacy normalization. Other forced decisions remain to audit.',
      },
      {
        area: 'Player controls',
        status: 'Implemented',
        detail:
          'Real payment alternatives retain controls. Entitled private plan details and inspectors persist in the action panel during planning, including external Atreides, without a dismissal gate.',
      },
      {
        area: 'AI',
        status: 'Implemented',
        detail:
          'Bots no longer submit an inspection acknowledgement. They share authoritative automatic payment settlement and still choose genuine payment alternatives and battle plans from their own views.',
      },
      {
        area: 'Documentation',
        status: 'Implemented',
        detail:
          'This checklist separates no-choice payment, persistent private inspection, legacy recovery and unfinished forced-decision scope.',
      },
      {
        area: 'Verification',
        status: 'Partial',
        detail:
          'Focused automatic-decision and full-plan regressions cover settlement, target-first order, private entitlement and continued planning. Browser readability and complete expansion interaction verification remain separate.',
        evidence: [
          'tests/automatic-decisions.test.ts',
          'tests/full-plan.test.ts',
        ],
      },
    ],
    related: [
      'bidding',
      'special-karama',
      'card-truthtrance',
      'automatic-casualties',
      'automatic-responses',
      'implementation-checklist',
    ],
  },
  {
    id: 'ai-pacing',
    title: 'Online AI action pacing',
    category: 'Getting started',
    coverage: 'Partial',
    summary:
      'Online rooms schedule one AI decision at a time with a 1.5-second interval, including human seats on autopilot.',
    steps: [
      'Online AI progression saves a due time and commits at most one AI action per step. The next action is scheduled using a 1.5-second interval. Network and server delays can make the visible interval longer.',
      'The server rechecks the current room after waiting. Reconnects preserve the pending deadline; they do not replay a backlog of elapsed AI actions. Competing workers cannot both commit the same action.',
      'Take back control remains available for your own autopilot seat while the worker waits. The server checks current control and room version before saving an AI action; already completed decisions remain in the game.',
      'Pacing does not reveal hidden cards, change difficulty, or turn optional human decisions into automatic actions. Disabling Automatic action notices changes only cosmetic feedback, not this server interval.',
      'Offline simulations use fast batches for testing and are not evidence of the online visual cadence. Hosted and broader browser cadence verification remain separate from focused server tests.',
    ],
    checklist: [
      {
        area: 'Implementation',
        status: 'Implemented',
        detail:
          'Online room persistence schedules and commits individual AI actions with a saved 1.5-second interval; offline batches stay fast.',
      },
      {
        area: 'Player controls',
        status: 'Implemented',
        detail:
          'Existing difficulty and Take back control controls apply. The notice toggle does not change server pacing.',
      },
      {
        area: 'AI',
        status: 'Implemented',
        detail:
          'The online scheduler covers permanent AI seats and voluntary autopilot using the same authorized private views.',
      },
      {
        area: 'Documentation',
        status: 'Implemented',
        detail:
          'This topic separates server pacing, reconnect behavior, takeover and cosmetic notices.',
      },
      {
        area: 'Verification',
        status: 'Partial',
        detail:
          'Eight focused server tests cover deadlines, early requests, reconnects, competing workers, takeback races and offline simulation. Broader hosted/browser cadence remains to verify.',
        evidence: ['tests/bot-pacing.test.ts'],
      },
    ],
    related: [
      'ai-players',
      'privacy',
      'automatic-casualties',
      'implementation-checklist',
    ],
  },
  {
    id: 'ix-deck',
    title: 'Ixians & Tleilaxu treachery deck',
    category: 'Advanced & expansions',
    coverage: 'Partial',
    summary:
      'Fourteen expansion cards join the thirty-three base cards; matching names still represent distinct physical cards.',
    steps: [
      'The expansion includes Poison Blade, Shield Snooper, Weirding Way, Chemistry, Poison Tooth, Artillery Strike, Thumper and Amal, plus the six ordinary card types below.',
      'Hunter Seeker is a projectile weapon and Basilia Weapon is a poison weapon. Normal matching defenses and Voice categories apply. Basilia Weapon belongs to this expansion; Ellaca Drug is the base-game poison card.',
      'The additional Shield and Snooper behave like their base copies, including the Shield’s lasgun interaction. Kull Wahad is a Worthless card and can be played in a battle plan or converted with advanced Bene Gesserit’s Karama advantage.',
      'The second Harvester is a separate card. Each available copy can be played while the fresh blow window remains open; the current implementation doubles that blow again, without multiplying pre-existing spice. Neither copy can restore a worm-destroyed blow or create spice in storm. Multiple-copy timing and multiplier interpretation remain under card-face audit.',
      'With this expansion the combined deck has forty-seven distinct card identities: five ordinary projectile weapons, five ordinary poison weapons, five ordinary Shields, five ordinary Snoopers, six Worthless cards and two Harvesters, in addition to the other base and special expansion cards.',
      'The complete inventory is assembled in the engine, with internal guidance and AI card recognition. Expansion starts remain disabled pending remaining rule and interaction audits; this is not a claim of complete expansion compliance.',
    ],
    related: [
      'ix-battle-cards',
      'card-harvester',
      'card-thumper',
      'card-amal',
      'ix-technology',
    ],
  },
  {
    id: 'ix-technology',
    title: 'Ixian setup and bidding technology',
    category: 'Advanced & expansions',
    coverage: 'Partial',
    summary:
      'Private starting-card selection, auction preparation, advanced substitution and allied purchase replacement.',
    steps: [
      'Before starting treachery cards are dealt, Ixians inspect one card per faction and choose one to keep. Shuffle and privately deal the remainder, one per other faction. Harkonnen receives its additional card from the deck afterward.',
      'Before the auction is prepared, everyone receives a Karama response window. Allowing Ixian inspection draws one extra card above the number up for bid. Ixians privately return one to the top or bottom of the deck, then shuffle the rest for auction. Canceling leaves only the ordinary auction cards and reveals none to Ixians.',
      'A full Ixian hand does not prevent its inspection advantage. The number of auction cards is determined by factions able to bid. The private pool record is unordered and includes cards already auctioned; it is not a view of another player’s hand or the upcoming card.',
      'In advanced play, before bidding on a card and before Atreides gets its peek, Ixians may offer one hand card for the upcoming unseen card. Declining saves the option for a later card. Declaring an exchange spends the once-per-round attempt and opens a separate Karama response; cancellation keeps both cards where they are.',
      'After a paid or Karama-paid purchase, an Ixian ally may keep the purchased card or request its replacement. A response resolves before discarding that exact card and drawing the deck’s top card privately. Payment still settles normally. Harkonnen’s separate bonus draw follows the replacement.',
      'The controls preserve decisions and private cards across reconnects. Complete expansion starts, Richese/other auction modes, exact phase-opening ordering, short-deck behavior and interruption timing remain under audit.',
    ],
    related: ['bidding', 'setup', 'ix-forces'],
  },
  {
    id: 'mobile-stronghold',
    title: 'Hidden Mobile Stronghold',
    category: 'Advanced & expansions',
    coverage: 'Partial',
    summary:
      'A separate movable stronghold with its own occupants, entrance and victory control.',
    steps: [
      'Ixians begin with three cyborgs and three suboids inside. After the first storm moves, select its pointing sector in any non-stronghold territory, including the Polar Sink. Placement collects no spice.',
      'Before later storm dials or card reveals, occupied Ixians may keep the current position or declare a route of up to three territories. Use the route selector to name each sector. The destination must be a non-stronghold territory. The route cannot begin, end or pass through the current storm sector. Occupants stay inside throughout relocation.',
      'The route preview shows spice available in its visited sectors, including the starting sector. Collection may be declined. A public Karama response resolves before any relocation or collection. Multiple-pile capacity and precise route interpretations remain under audit.',
      'Forces inside are separate from forces outside. Enter and leave through the pointing sector, counting the stronghold as one more territory of movement. A storm in that pointing sector blocks ordinary entry or exit. Direct shipping inside is restricted to Ixians; advanced Bene Gesserit may accompany their shipment.',
      'Worms and storms do not kill the occupants. Battles wait while the pointing sector is in storm; otherwise normal battles and the two-faction capacity apply inside. The sole controller counts it toward victory, even when that controller is not Ixian. Capturing it does not grant another faction permission to move it.',
      'In advanced play, Ixians may spend special Karama once during their own Shipment and Movement turn to relocate up to two territories while their forces occupy it. This preserves their ordinary shipment and troop movement. Setup and bidding technology now have decision controls; expansion starts and remaining interaction audits are unfinished.',
    ],
    related: ['ix-forces', 'movement', 'storm'],
  },
  {
    id: 'fremen-movement-karama',
    title: 'Fremen movement and Karama',
    category: 'Factions',
    coverage: 'Partial',
    summary:
      'Karama can remove the two-territory advantage for one movement use.',
    steps: [
      'Declare the force group and destination. A move that needs the Fremen two-territory advantage waits only for players with an available cancellation choice. Without a blocker, it proceeds automatically.',
      'If allowed, the declared group continues to its destination. If canceled, no forces move and no movement is spent. Choose a legal one-territory replacement or finish movement.',
      'The restriction belongs to that movement use. A separate extra move granted by Hajr can use two territories again. Reserve reinforcements and worm rides use their own rules.',
      'Forces in Arrakeen or Carthag grant ordinary ornithopter range independently. The Richese Ornithopter card’s fixed three-territory mode is also independent; its two-group mode uses each group’s normal range. Other unresolved combinations of that expansion card remain guarded.',
      'All four AI profiles respect the reduced range. Hard and Brutal may cancel an enemy Fremen move toward their own fighters. Pending responses and reduced-range choices are saved with the game.',
    ],
    related: [
      'movement',
      'faction-fremen',
      'card-hajr',
      'automatic-responses',
      'implementation-checklist',
    ],
    checklist: [
      {
        area: 'Implementation',
        status: 'Implemented',
        detail:
          'A declared movement is validated before continuation; cancellation applies to the current movement use and preserves its forces.',
      },
      {
        area: 'Player controls',
        status: 'Implemented',
        detail:
          'The response shows the destination and cancellation consequence; the movement panel explains the reduced range.',
      },
      {
        area: 'AI',
        status: 'Implemented',
        detail:
          'All profiles plan using the projected range restriction, including normal-range Ornithopter groups.',
      },
      {
        area: 'Documentation',
        status: 'Implemented',
        detail:
          'The internal guide distinguishes per-use cancellation, reserve reinforcements, Hajr and independent ornithopter ranges.',
      },
      {
        area: 'Verification',
        status: 'Partial',
        detail:
          'Fourteen movement scenarios and three persisted-room scenarios pass, including both cancellation outcomes, nested responses, exact group custody and all four AI profiles. Complete Advanced and expansion games and mobile acceptance remain unverified.',
        evidence: [
          'tests/fremen-movement-karama.test.ts',
          'tests/fremen-movement-review.test.ts',
          'tests/fremen-movement-recovery.test.ts',
        ],
      },
    ],
  },
  {
    id: 'ix-forces',
    title: 'Ixian cyborgs and suboids',
    category: 'Advanced & expansions',
    coverage: 'Partial',
    summary:
      'Half-strength suboids, spice-supported cyborgs and post-battle casualty substitution.',
    steps: [
      'Your twenty forces consist of seven cyborgs and thirteen suboids. In basic battles, cyborgs dial two strength and suboids one-half. Ixians can therefore use half-strength dial increments in the basic game.',
      'In advanced battles, each supported cyborg costs one spice and contributes two strength. Unsupported cyborgs contribute one. Suboids always contribute one-half and cannot receive spice support.',
      'Choose casualties that match your revealed dial and spice support. After those losses, surviving suboids can be sent to the tanks in place of cyborgs lost in that same battle, one for one. This preserves the number of physical casualties while changing their types.',
      'In the substitution panel, choose surviving suboids to sacrifice and lost cyborgs to retain. The two counts must match. Retained cyborgs return to their casualty sectors. The exchange may be partial or declined.',
      'A Karama response before the exchange can cancel it, leaving the original casualties. Basic cyborg double strength also has a response before plans. Suboid half strength cannot be canceled. Traitor destruction and explosions leave no survivors available for substitution.',
      'A cyborg in the selected movement group lets that group move two territories. Suboids moving without a cyborg move one. Ornithopters allow three territories regardless of force type. A two-territory cyborg move has a Karama response; if canceled, the army remains in place and can choose a shorter move.',
      'Cyborgs collect three spice each. Suboids collect two, or three with ornithopters. Collection still requires the force to occupy the spice sector, outside the storm.',
      'Ixians have one free force revival, either type. Choose cyborgs-first or suboids-first in the revival form. Each paid cyborg costs three spice, each paid suboid two; a Tleilaxu ally discount rounds the paid total up after halving. The one-per-turn Sardaukar/Fedaykin restriction does not apply to cyborgs.',
      'Combat and substitution have tested engine, UI and AI support. Cyborg movement, collection and typed revival pricing also have tested support. The mobile stronghold and faction setup/auction technology now have tested support. The complete sector/timing/expansion audit remains unfinished, so expansion starts remain disabled.',
    ],
    example:
      'Two cyborgs and six suboids dial six: lose two cyborgs (four strength) and four suboids (two strength). The two surviving suboids can replace the two lost cyborgs. Six suboids end in the tanks and two cyborgs remain on the board. In advanced play, the dial needs two spice for those cyborgs.',
    related: ['faction-ixians', 'advanced-ixians', 'battle', 'advanced-combat'],
  },
  {
    id: 'tleilaxu-gholas',
    title: 'Tleilaxu foreign gholas',
    category: 'Advanced & expansions',
    coverage: 'Partial',
    summary:
      'Revive foreign leaders into your pool, retain their identities, and negotiate dead-ghola buybacks.',
    steps: [
      'During advanced Revival, Tleilaxu with fewer than five active leaders may pay the bank to revive dead leaders of other factions. Each costs half its printed value, rounded up. Several may be revived in the phase, up to five active leaders. The Auditor and Kwisatz Haderach cannot be acquired as foreign gholas.',
      'The revived leader becomes part of the Tleilaxu leader pool. Its original faction and traitor identity do not change. It fights for its current controller and remains vulnerable to the corresponding traitor card. Harkonnen capture temporarily overrides ghola control.',
      'Face-down leaders can become gholas, preserving their death history. A dead ghola stays associated with the Tleilaxu pool and can be revived again. Returning an existing member with Ghola treachery is distinct from acquiring a new foreign leader.',
      'A living ghola cannot be sold back. After it dies, its original faction may request a private buyback quote through revival commerce, even when all native leaders are unavailable. Tleilaxu may refuse. An accepted return costs the agreed price and uses the requester’s one-leader allowance.',
      'A foreign-ghola revival opens a Karama response before payment or transfer. Cancellation prevents revival of that specific leader for the turn; another eligible dead leader may still be chosen. A separate response governs a paid discount.',
      'Acquisition, private buybacks, identity and combat control have tested support. Complete timing, captive-pool counting, own-leader returns above a five-member pool, buyback/card exceptions and later leader-skill, homeworld and Ecaz interactions remain in the expansion audit. Expansion starts remain disabled.',
    ],
    related: [
      'tleilaxu-revival',
      'tleilaxu-face-dancers',
      'captured-leaders',
      'card-ghola',
    ],
  },
  {
    id: 'tleilaxu-revival',
    title: 'Tleilaxu revival commerce',
    category: 'Advanced & expansions',
    coverage: 'Partial',
    summary:
      'Revival payments, force permissions, discounts and private early-leader quotes.',
    steps: [
      'Other factions pay Tleilaxu for force and leader revival. Tleilaxu pay the bank at half price, rounded up, and have no normal limit on their own force or leader revivals. The one-elite-force limit still applies.',
      'Tleilaxu receive one spice from the bank when a faction uses its normal free force revival, including their own. Splitting that allowance into smaller actions never grants extra income. Playing a Ghola treachery card grants a separate one-spice payment.',
      'Tleilaxu may allow any other faction to revive up to five forces. They may also offer their ally half-price force and leader revival. The ally pays; Tleilaxu cannot fund that payment. Emperor extra revivals remain separate and their payments go to Tleilaxu.',
      'For early leader revival, request a particular dead leader while at least one native leader remains available. Tleilaxu quote a price, possibly zero, and the requester accepts or withdraws. Only these two players see the request and price. With all native leaders unavailable, ordinary revival rules apply.',
      'An accepted early revival uses the normal one-leader allowance of the requesting faction. Kwisatz Haderach can also be requested. Tleilaxu can revive several of their own dead leaders in a phase, including before all five die.',
      'The server pauses before a larger limit, discount or early revival takes effect. Karama can cancel that benefit. Forces and spice remain unchanged if the return is aborted; a canceled discount is repriced before payment. A separate response governs the payment to Tleilaxu after a successful return.',
      'Revival commerce and the private controls are tested. Exact cancellation duration, simultaneous card timing, special free-revival effects, foreign gholas and later expansion economy interactions remain in the complete rules audit. Full expansion starts remain disabled.',
    ],
    related: [
      'revival',
      'card-ghola',
      'card-karama',
      'tleilaxu-face-dancers',
      'ix-modules',
    ],
  },

  {
    id: 'tleilaxu-face-dancers',
    title: 'Tleilaxu Face Dancers and Zoal',
    category: 'Advanced & expansions',
    coverage: 'Partial',
    summary:
      'Secret identities replace a victorious army after the battle is settled.',
    steps: [
      'Tleilaxu take no ordinary traitors. Once everyone else has selected their traitors, shuffle the unused cards and deal Tleilaxu three private Face Dancers.',
      'After another faction wins, that winner resolves losses, leader bounties, card choices and tech-token rewards. Tleilaxu then have a separate opportunity to reveal an unrevealed Face Dancer matching the winning leader.',
      'Return the winner’s surviving forces to reserves, then replace up to that number with Tleilaxu forces from reserves or other board locations. The winning leader goes to the tanks with no additional bounty. A leader already killed does not die again.',
      'A winning Cheap Hero may be a Face Dancer. Kwisatz Haderach does not protect an accompanying leader against Face Dancing. Karama cannot cancel the reveal or the replacement army.',
      'Keep revealed Face Dancers face up until all three have been used. Shuffle those cards back into the unused deck and draw three new ones. During Mentat Pause, you may instead replace one unrevealed Face Dancer; this once-per-turn exchange has a Karama response.',
      'Zoal has variable battle strength: he copies the opposing leader disc, without any KH bonus, or counts zero against a Cheap Hero. His death bounty uses that copied strength. His ordinary revival value is three spice before discounts.',
      'The core setup, reveal sequence, card cycling, Zoal effects and AI controls are tested. Tleilaxu revival commerce also has tested support. Foreign ghola acquisition and buyback controls are also implemented. Their special Karama now also has tested support; its timing and the complete expansion interaction audit are still unfinished, so expansion starts remain disabled.',
    ],
    related: [
      'battle',
      'cheap-hero-traitor',
      'tech-tokens',
      'mentat',
      'ix-modules',
    ],
  },

  {
    id: 'card-amal',
    title: 'Amal and phase openings',
    category: 'Cards',
    coverage: 'Partial',
    summary:
      'Return half of every faction’s available spice before the new phase takes effect.',
    steps: [
      'Amal is played at the beginning of a phase and discarded. Every faction, including its owner, returns half the spice behind its shield to the bank, rounded up. Five spice becomes two; one becomes zero.',
      'Ix tables open a public confirmation window before each phase. Play Amal or pass. Everyone receives this window regardless of who holds a card. Once everyone passes, the phase begins.',
      'A pass commits until another opening card is played. Playing Amal resets the confirmations, so everyone can respond to the changed state before continuing.',
      'Automatic auctions, collection and Mentat payments wait for confirmation. Unpaid bribes are not available spice until paid at Mentat. Income from the previous phase and unused ally credit are settled before the next opening.',
      'The server, phase controls and AI support this timing. Full expansion starts remain gated. Printed card timing, conflicts among simultaneous beginning-of-phase powers and later expansion economy interactions still need the complete audit.',
    ],
    related: ['bidding', 'collection', 'mentat', 'card-thumper', 'ix-modules'],
  },
  {
    id: 'cheap-hero-traitor',
    title: 'Cheap Hero and Heroine traitor',
    category: 'Advanced & expansions',
    coverage: 'Partial',
    summary:
      'One expansion traitor card can betray either Cheap Hero card repeatedly.',
    steps: [
      'The Ixians & Tleilaxu expansion adds one Cheap Hero traitor to setup. It is separate from the Cheap Hero and Cheap Heroine treachery cards and is not a leader disc.',
      'If an opponent uses either hero as their battle leader, the holder may reveal this traitor. The ordinary traitor outcome applies: the opponent loses its army and played cards; the hero has zero strength and grants no leader bounty.',
      'Keep the traitor after revealing it. You can call it again against either hero in later battles, including against a different opponent. Revealed traitor identities remain visible in the player panels; unrevealed holdings remain private.',
      'Harkonnen may call this traitor against its ally’s opponent through the ordinary ally-power response. Kwisatz Haderach protects an accompanying hero against a traitor call.',
      'The matching, outcome, public memory and AI support are implemented and tested. Full expansion deck setup and later expansion interactions remain gated with the rest of the expansion.',
    ],
    related: [
      'setup',
      'battle',
      'faction-harkonnen',
      'advanced-atreides',
      'ix-modules',
    ],
  },
  {
    id: 'card-thumper',
    title: 'Thumper: a worm instead of a reveal',
    category: 'Cards',
    coverage: 'Partial',
    summary:
      'Start the spice phase with a worm encounter without consuming the next spice card. Tested support exists; expansion decks remain gated.',
    steps: [
      'Play Thumper at the opening of Spice Blow, before the first reveal. Discard the treachery card. Resolve a Shai-Hulud encounter against the previous territory in the first spice discard pile.',
      'Fremen survival, optional allied protection, cancellation responses, Nexus and rides resolve through the ordinary worm sequence. If protection needs a decision, the actual next spice card stays in the deck until that decision finishes.',
      'Continue drawing afterward to reach a territory. In the advanced game, another worm drawn after Thumper is an additional worm and can offer Fremen placement. The second spice blow then resolves normally against its separate pile.',
      'A waiting Sandtrout suppresses the encounter. Its immediate territory replacement receives double spice; a replacement worm instead resolves normally.',
      'Thumper does not add a Shai-Hulud card to the spice deck. The generated encounter is remembered in the discard history for timing but disappears when the deck is reshuffled.',
      'The implementation currently treats first-turn Thumper as an ignored worm, retaining exactly the original worm-card count. The precise first-turn allowance, initial-phase timing and Sandtrout interaction remain printed-card audit items before live expansion starts are enabled.',
    ],
    related: ['spice-blow', 'sandtrout', 'advanced-storm-spice', 'ix-modules'],
  },
  {
    id: 'sandtrout',
    title: 'Sandtrout: broken alliances and the next worm',
    category: 'Advanced & expansions',
    coverage: 'Partial',
    summary:
      'A pending spice-card effect that can cross phases and turns. Tested support exists; the expansion spice deck remains unavailable in live rooms.',
    steps: [
      'Drawing Sandtrout immediately breaks existing alliances and clears pending alliance offers. It is then held aside while spice draws continue. A territory drawn before the next active Shai-Hulud receives its usual spice amount.',
      'The next active Shai-Hulud drawn is suppressed: it does not devour the previous territory, offer Fremen protection or a ride, or trigger its own Nexus. Discard the consumed Sandtrout with that suppressed worm.',
      'If the immediate replacement is a territory, double its spice. Harvester can then double that enhanced blow again. Spice still cannot appear in the storm.',
      'If the immediate replacement is another Shai-Hulud, resolve it normally and do not double a later territory. A normal worm can trigger a Nexus, and further normal worms can offer advanced Fremen placement.',
      'The pending Sandtrout effect survives until consumed, including between the two advanced spice blows and across turns. Its status is public. A still-hidden Sandtrout at the top of the deck is visible only to authorized Atreides foresight.',
      'The engine preserves first-turn ignored worms without consuming Sandtrout, and treats a summoned Fremen worm separately from drawn Shai-Hulud. Those timing interpretations and later expansion interactions still require a full printed-card audit before expansion starts are enabled.',
    ],
    related: [
      'spice-blow',
      'advanced-storm-spice',
      'card-harvester',
      'ix-modules',
    ],
  },
  {
    id: 'card-poison-tooth',
    title: 'Poison Tooth: choose after the reveal',
    category: 'Cards',
    coverage: 'Partial',
    summary:
      'A poison weapon with an optional attack on both leaders. Engine support exists; expansion decks remain unavailable.',
    steps: [
      'Commit Poison Tooth in your weapon slot. After both plans are revealed, its owner chooses whether to activate it before traitor decisions proceed. Committing the card does not yet activate its poison.',
      'When activated, the tooth attacks both leaders, including its owner’s leader. Chemistry in the defense slot protects that leader. Snooper and Shield Snooper do not protect against the tooth. A Chemistry card used as a weapon supplies no defense.',
      'When left unused, the tooth kills neither leader. Other weapons still work. A winning player may keep the unused tooth or discard it; a losing player normally discards it. Moritani’s defeated ally may choose an unused tooth as its one retained card when the battle has a winner. A used tooth is discarded even when its owner wins.',
      'Voice can name Poison Tooth specifically or address poison weapons. Requiring it in a plan does not remove its later activation choice. A traitor victory takes precedence over the weapon effects.',
      'Choose after comparing the revealed plans: killing both leaders may turn a loss into a win, but may also remove your own winning leader strength. The ordinary dial, tie, spice-support and casualty rules still apply.',
      'The effect and choice have focused tests. Complete expansion setup, direct comparison against the CHOAM replacement printing, and interactions with later expansion cards remain under audit.',
    ],
    related: ['battle', 'ix-battle-cards', 'advanced-combat'],
  },
  {
    id: 'card-artillery',
    title: 'Artillery Strike: shields and stunned leaders',
    category: 'Cards',
    coverage: 'Partial',
    summary:
      'An attack on both leaders that suppresses leader strength and bounty. Engine support exists; expansion decks remain unavailable.',
    steps: [
      'Play Artillery Strike in the weapon slot. It attacks both leaders. Each side protects its own leader with Shield or Shield Snooper. Weirding Way as projectile defense is not a shield and does not protect against this card.',
      'Surviving leaders contribute no battle strength. The implemented battle comparison uses the dials, with the aggressor winning ties; the attached Kwisatz Haderach bonus is also suppressed. The surviving KH token is not killed by Artillery Strike.',
      'No bounty is collected for leaders killed in a battle resolved with Artillery Strike, including a leader killed by the opposing weapon. Spice support and force casualties still follow the usual rules.',
      'Discard the card after use. A traitor victory overrides its effect; lasgun/shield explosions also take precedence and destroy the territory’s forces and spice as usual.',
      'Bene Gesserit must name Artillery Strike specifically. A generic prohibition on projectile weapons does not prohibit it.',
      'The effects have focused tests. Complete expansion setup, direct comparison against the CHOAM replacement printing, and Stone Burner, leader-skill and other expansion interactions remain under audit.',
    ],
    related: ['battle', 'ix-battle-cards', 'advanced-combat'],
  },
  {
    id: 'ix-battle-cards',
    title: 'Ix battle cards: combined and alternate roles',
    category: 'Advanced & expansions',
    coverage: 'Partial',
    summary:
      'Poison Blade, Shield Snooper, Weirding Way and Chemistry have tested combat support. The fourteen-card inventory is assembled; live expansion starts await the remaining rules audit.',
    steps: [
      'Poison Blade attacks with both projectile and poison. A defense against only one of those types does not save the leader. Shield Snooper defends against both types.',
      'Shield Snooper counts as a shield for a lasgun explosion. Weirding Way used as projectile defense does not count as a shield: it neither stops a lasgun nor causes an explosion.',
      'Weirding Way normally fills the weapon slot as a projectile weapon. With another weapon, it fills the defense slot as projectile defense. Chemistry normally fills the defense slot as poison defense; with another defense, it fills the weapon slot as poison. One card cannot fill both slots.',
      'Voice can name one of these special cards directly or use a matching generic attack or defense type. A prohibition uses the role the card actually plays. For example, forbidding poison weapons still allows Chemistry as poison defense.',
      'Compulsion uses the default role. Requiring a projectile weapon can compel Weirding Way as a weapon. Requiring a projectile defense cannot force a player to turn Weirding Way into that defense. Likewise, requiring a poison weapon cannot force Chemistry out of its default defense role.',
      'Prescience reveals the card occupying the requested slot. With a poison weapon and Weirding Way, a weapon question reveals the poison weapon; a defense question reveals Weirding Way. The other card remains private, and the revealed slot must remain unchanged.',
      'These cards are not yet added to live room decks. Poison Tooth and Artillery Strike also have tested effects described in their own topics. Remaining Ix treachery cards, complete deck setup and expansion interactions are still in development.',
    ],
    related: [
      'battle',
      'battle-cards',
      'ix-modules',
      'card-poison-tooth',
      'card-artillery',
    ],
  },
  {
    id: 'setup',
    title: 'Start a table and take your seat',
    category: 'Getting started',
    coverage: 'Partial',
    summary:
      'Create a room, invite rivals with its code, and complete each faction’s starting choices.',
    steps: [
      'Each player chooses a distinct faction and an unoccupied player circle, then marks Ready. The six circles appear around the map and determine storm order. Changing your circle resets readiness. The host starts when everyone is ready.',
      'After positions are fixed, Bene Gesserit seals a secret prediction of a faction and turn. No traitor or Treachery Cards have been dealt yet. Other players wait for this choice; if Bene Gesserit is absent, the table continues automatically.',
      'Each player receives four private traitor choices and keeps one. Harkonnen keeps all four automatically. Every remaining selection must finish before starting spice and forces are placed. Your starting Treachery hand is still empty.',
      'Starting spice and fixed forces are then placed. Fremen distributes ten forces among Sietch Tabr, False Wall South and False Wall West, choosing their printed sectors. Basic Bene Gesserit starts with one fighter in Polar Sink. In Advanced setup, Bene Gesserit instead chooses a printed territory and sector after Fremen placement; its advisor becomes a fighter when alone.',
      'After all starting force choices, each player receives one private Treachery Card and Harkonnen receives two. Dealing and entry into the first Storm phase are automatic. The table names the player whose setup choice is still required; there is no separate confirmation for dealing.',
      'Older saved tables that already received their cards keep those cards and their existing unfinished choices. Returning to a table does not restart setup or deal another hand. Advanced and expansion starts remain unavailable while their remaining rules and interactions are completed.',
      'The browser keeps a private seat cookie. Returning to the same room in that browser restores your seat. Separate players should use separate browsers or profiles.',
    ],
    related: ['privacy', 'ai-players', 'storm', 'implementation-checklist'],
    checklist: [
      {
        area: 'Implementation',
        status: 'Partial',
        detail:
          'Base setup enforces prediction, traitors, forces and automatic dealing in order, with private choices and preserved saved tables. Advanced starting advisors and elite forces share the same setup logic. Expansion and optional-module setup remain unfinished.',
      },
      {
        area: 'Player controls',
        status: 'Partial',
        detail:
          'The table names the current stage and waiting players, shows only timely private choices, and requires exactly ten Fremen forces. Desktop prediction, traitor selection, multi-sector placement and invitation restoration passed. Mobile and live Advanced controls still need acceptance.',
      },
      {
        area: 'AI',
        status: 'Partial',
        detail:
          'All four profiles follow the stage order using only their own views. The base-roster setup matrix and sampled Basic and Advanced games complete without rejected candidates. Initial Fedaykin allocation strategy and complete expansion setup remain unfinished.',
      },
      {
        area: 'Documentation',
        status: 'Partial',
        detail:
          'This guide explains base setup order, private information, waiting ownership, automatic dealing and saved-table recovery. Expansion and optional-module instructions still need their complete rule-specific ordering.',
      },
      {
        area: 'Verification',
        status: 'Partial',
        detail:
          'Checks cover all 57 base-faction rosters, four AI profiles, two seating orders, private stage restoration, duplicate final choices, card and force conservation, and saved setup without redealing. Full rules and browser acceptance remain separate.',
        evidence: [
          'tests/base-setup-order.test.ts',
          'tests/bot-staged-setup.test.ts',
          'tests/base-setup-recovery.test.ts',
        ],
      },
    ],
  },
  {
    id: 'ai-players',
    title: 'Play with AI opponents',
    category: 'Getting started',
    coverage: 'Partial',
    summary:
      'The host can fill open faction seats with Easy, Medium, Hard or Brutal AI players.',
    steps: [
      'In the lobby, choose an unoccupied faction and difficulty, then select Add AI player. The host can remove an AI seat before starting. AI seats mark themselves ready.',
      'Easy uses varied destinations, small deployments and low bids. Medium balances strongholds and spice. Hard uses more conservative battle estimates and targeted Karama responses. Brutal spends more and prioritizes disrupting rivals holding several strongholds.',
      'AI decisions use the same private player view and legal-action checks as human decisions. Difficulty never grants extra spice, hidden cards or access to an opponent’s sealed plan.',
      'Online rooms schedule one AI action at a time with a 1.5-second interval. A response that needs your input waits for you, even when every other seat is AI. Reconnecting preserves the saved AI deadline and seat control; see Online AI action pacing for its verification boundary.',
      'These policies complete Basic games. A balanced study found Easy weaker than the other levels, but did not establish a reliable strength ordering among Medium, Hard and Brutal. Advanced and expansion decisions are still being developed.',
    ],
    related: [
      'setup',
      'privacy',
      'battle',
      'ai-pacing',
      'implementation-checklist',
    ],
  },
  {
    id: 'privacy',
    title: 'Private information and reconnecting',
    category: 'Getting started',
    coverage: 'Implemented',
    summary:
      'Each player receives their own hand and secrets. Room codes invite players; they do not grant control of an existing seat.',
    steps: [
      'Your spice, hand, traitors and prediction remain private in other players’ views. Inspect buttons enlarge only components your current view is allowed to see; inspection does not select, play or reveal them.',
      'The treachery discard pile is private and cannot be searched unless a card effect specifically permits it. A previously revealed card does not make the whole discard pile available for inspection.',
      'A submitted plan stays hidden until both plans are sealed. Prescience exposes only its chosen element to the combatants.',
      'If the table changes while you act, your view refreshes. Review the current decision before trying again.',
      'A failed connection offers retry controls. An uncertain game action is checked against the saved table rather than automatically played again.',
      'If creating or joining a room has an uncertain result, keep the browser tab open. Its saved retry details survive refresh; Retry same request recovers the original room and seat when the request already succeeded. Closing the tab or clearing browser data can remove those details. A clearly rejected first request lets you correct the form.',
      'Before losing this browser’s seat, open Protect your saved seat, save its complete private recovery kit and enable the key. Keep it separate from the public invitation. Anyone with that kit can control the seat and see its private information.',
      'Recover a saved seat restores the same faction and pending commitments, and revokes its previous browser sessions. Keep the recovery page open if a result is uncertain and retry the same request. A replacement key invalidates the older kit.',
      'A room code alone cannot recover an occupied seat. Use the retained entry request for an uncertain create or join, or a previously saved kit for later seat recovery. Hosts cannot take over another human’s seat.',
      'After the game starts, Let AI play for me lets you delegate your own seat to Easy, Medium, Hard or Brutal AI. It uses only your seat’s information and can complete setup, spend resources and commit plans. Your seat, saved choices and recovery kit remain yours. Take back control stops future AI decisions without undoing completed actions.',
      'The table displays which human seats are on autopilot. AI stops when another human must decide. Online progress is saved one AI action at a time; if processing is interrupted, reopen the table and use its reconnect or resume control when offered. Autopilot does not automatically start because a player disconnects.',
    ],
    related: ['battle', 'alliance-funding', 'ai-pacing'],
  },
  ...PHASES.map(
    (title, phase): RuleTopic => ({
      id: phaseIds[phase],
      title: `${phase + 1}. ${title}`,
      category: 'Turn phases',
      coverage: 'Partial',
      summary: PHASE_HELP[phase],
      steps: phaseDetails[phase],
      related:
        phase === 5
          ? ['alliance-funding', 'faction-guild', 'faction-fremen']
          : phase === 6
            ? [
                'card-karama',
                'card-truthtrance',
                'battle-cards',
                'automatic-casualties',
              ]
            : phase === 4
              ? ['ecaz-ambassadors', 'tleilaxu-revival']
              : phase === 1
                ? ['card-harvester', 'faction-fremen']
                : undefined,
    }),
  ),
  {
    id: 'alliance-funding',
    title: 'Fund an ally’s bid or shipment',
    category: 'Getting started',
    coverage: 'Implemented',
    summary:
      'Use Alliance funding during bidding or shipment and movement to authorize a payment contribution.',
    steps: [
      'Set an unspent pledge. That spice is reserved for your ally for the current phase.',
      'Your ally can choose its share of the next payment, or leave it blank to use personal spice first.',
      'Shipment contributions go directly to the Guild, including a contribution toward the Guild’s own shipment. Spice paid by the Guild itself goes to the bank. If the Guild is absent, an independent Karama shipment rate applies, or Guild income is prevented, the applicable payment goes to the bank.',
      'Guild transport, southern-reserve cross-shipment and return controls show the selected physical forces, rounded total cost, personal payment and pledged share before you submit. A combined-sector group is priced by its actual total. The Guild must fund its own share before receiving shipment income.',
      'Unspent funding returns at phase end. A pledge committed to the current high bid cannot be withdrawn.',
    ],
    example:
      'You have two spice and your ally pledges four. You may bid six; winning uses two of yours and four of theirs.',
    related: ['bidding', 'movement', 'faction-guild', 'card-karama'],
  },
  {
    id: 'battle-cards',
    title: 'Weapons, defenses and winning cards',
    category: 'Cards',
    coverage: 'Partial',
    summary: 'Build a legal combination and decide what to keep after winning.',
    steps: [
      'Choose one weapon, one defense, both, or neither. A worthless card can occupy a weapon or defense slot.',
      'Choose an available leader or Cheap Hero when required. Without either, battle cards cannot be played.',
      'A loser normally discards all played cards. If allied with Moritani and the battle has a winner, the defeated ally may retain one played card that a winner could keep. A winner may discard selected played cards; Cheap Heroes are discarded after use.',
    ],
    related: ['battle', 'card-karama', 'moritani-ally-retention'],
  },
  {
    id: 'card-weather',
    title: 'Weather Control',
    category: 'Cards',
    coverage: 'Implemented',
    summary: 'Set the pending storm distance before movement resolves.',
    steps: [
      'Set Storm distance on the card to a number from zero to ten.',
      'Play it during the storm phase, including after the dials are revealed.',
      'Everyone confirms the revised storm movement.',
      'A saved play preserves your chosen distance and cleared readiness. Recovery does not move the storm or ask you to play the card again.',
    ],
    related: ['storm', 'card-atomics'],
  },
  {
    id: 'card-atomics',
    title: 'Family Atomics',
    category: 'Cards',
    coverage: 'Partial',
    summary:
      'Destroy the Shield Wall while you have forces on or adjacent to it.',
    steps: [
      'Play before storm movement. The window remains open after the storm dials are revealed.',
      'Forces on the wall are destroyed. Arrakeen, Carthag and Imperial Basin lose the wall’s storm protection.',
      'Storm adjacency and card-interaction edge cases remain under audit.',
      'A saved play preserves the destroyed wall and its casualties. Recovery does not require your already-destroyed qualifying forces to remain on the wall.',
    ],
    related: ['storm', 'card-weather'],
  },
  {
    id: 'card-harvester',
    title: 'Harvester',
    category: 'Cards',
    coverage: 'Partial',
    summary: 'Double the fresh spice blow while its response window is open.',
    steps: [
      'Play after the territory card is revealed and before the table accepts the blow.',
      'Only the new blow is doubled; existing spice is unchanged. Spice under the storm still does not appear.',
      'With the Ixian expansion there are two separate Harvester cards. The current implementation permits both on an open blow, doubling its current amount each time; multiple-copy timing and multiplier interpretation remain under card-face audit.',
      'A worm that destroys the fresh blow closes its Harvester window. This does not increase your forces’ collection rate.',
      'A saved play preserves the doubled blow and its existing ground spice. Recovery does not add the spice again or consume another Harvester.',
    ],
    example:
      'A territory has three spice. A new blow adds eight. Harvester adds another eight, leaving nineteen.',
    related: ['spice-blow', 'collection'],
  },
  {
    id: 'card-hajr',
    title: 'Hajr',
    category: 'Cards',
    coverage: 'Implemented',
    summary: 'Make an additional force move during your movement turn.',
    steps: [
      'Play during your shipment and movement turn.',
      'Make a second legal group move. Normal source, range and destination restrictions still apply.',
      'A saved play preserves the extra movement allowance. Recovery neither grants another move nor finishes your movement turn.',
    ],
    related: ['movement'],
  },
  {
    id: 'card-ghola',
    title: 'Tleilaxu Ghola',
    category: 'Cards',
    coverage: 'Partial',
    summary: 'Return forces or a leader from the tanks using the card.',
    steps: [
      'Choose a dead leader for leader revival, or leave the leader choice empty to return up to five forces. A card pays for one of these choices; it cannot revive both a leader and the Kwisatz Haderach.',
      'A binding battle answer or prescience commitment may require this preparation. The private guide identifies a Ghola play that can fulfill the answer, without spending or revealing the card until you choose to play it. Resolve any revival-income response before using that income to support a battle.',
      'Returned forces go to reserves. A leader revived with this card can fight again this turn, including in another territory. Atreides can also select a dead Kwisatz Haderach; revive it separately from its accompanying leader. Returning a controlled foreign ghola does not transfer it back to its original faction. Additional advanced and expansion interactions remain under audit.',
      'A saved play preserves the revived pieces, any earned technology income and the discarded card. Recovery restores any pending Tleilaxu income response without reviving or paying twice. Private preparation guidance waits for recovery to finish.',
    ],
    checklist: [
      {
        area: 'Implementation',
        status: 'Partial',
        detail:
          'Ordinary and typed forces, controlled leaders and Kwisatz return with conserved usage and recovery; only Ecaz may revive Duke. Dead set-aside Duke revival and all expansion interactions remain unfinished.',
        evidence: ['game/engine.ts', 'game/ecaz-duke-revival.ts'],
      },
      {
        area: 'Player controls',
        status: 'Implemented',
        detail:
          'The hand selector uses current authoritative eligible targets, physical force and elite counts, and explains blocked timing or selections.',
        evidence: ['components/game-table.tsx'],
      },
      {
        area: 'AI',
        status: 'Partial',
        detail:
          'All four profiles choose useful Ghola recovery in open windows while preserving specific actions and binding preparation. Full strength calibration remains open.',
        evidence: ['game/bots.ts', 'tests/ghola-bots.test.ts'],
      },
      {
        area: 'Documentation',
        status: 'Implemented',
        detail:
          'The internal card guide explains target choice, same-turn use, separate leader/Kwisatz returns and exact-once recovery.',
        evidence: ['game/reference.ts'],
      },
      {
        area: 'Verification',
        status: 'Partial',
        detail:
          'Actual battle death, subsequent territory use, Kwisatz explosion/revival, private targets and concurrent persisted actions are covered; every expansion combination remains uncertified.',
        evidence: [
          'tests/ghola-lifecycle.test.ts',
          'tests/ghola-lifecycle-recovery.test.ts',
          'tests/ordinary-card-discard-continuations.test.ts',
        ],
      },
    ],
    related: ['revival'],
  },
  {
    id: 'card-karama',
    title: 'Karama',
    category: 'Cards',
    coverage: 'Partial',
    summary:
      'Buy an auction card or cancel a supported use of a faction power.',
    steps: [
      'If eligible to bid, use the card to take the current auction card without paying spice. A full hand cannot bypass the bidding limit.',
      'Holding Karama also permits bids beyond your available spice. A winner can choose to spend it; an outbid player keeps it.',
      'Use Cancel with Karama during a power response. Supported responses include Voice, prescience, Atreides auction and spice peeks, spiritual advisors, Emperor gifts and revival, faction income, Harkonnen bonus cards and allied traitors, plus Fremen storm and worm powers, elite combat strength and Fremen free spice support.',
      'During shipment, use Guild rates for the active player before they ship. They choose and pay for their shipment at the rounded half rate, paid to the bank. You may provide this benefit for another player; it expires if they move or finish without shipping.',
      'Advanced Bene Gesserit may spend Worthless cards as Karama. Each conversion opens a separate cancellation response; the Worthless card is discarded even if the power is canceled. Normal Karama cards resolve without that conversion response.',
      'A pending Worthless purchase keeps space for its original auction card. Gifts and hand exchanges must leave enough room for every committed incoming card. Refreshing restores the same auction, unused shipment opportunity or original canceled power.',
      'Atreides full-plan inspection, Emperor revival, Fremen’s summoned worm, Harkonnen hand exchange the Guild shipment stop and Tleilaxu revival prevention are implemented as once-per-game uses. Other cancellations and special Karamas are still being implemented.',
    ],
    related: ['bidding', 'battle', 'advanced-combat', 'special-karama'],
  },
  {
    id: 'truthtrance-spice',
    title: 'Truthtrance: current spice questions',
    category: 'Cards',
    coverage: 'Partial',
    summary:
      'Ask whether another player personally holds exactly, at least or at most an amount of spice.',
    steps: [
      'Declare Truthtrance, choose a player and select Current personal spice under verified facts. Choose Exactly, At least or At most and a whole amount of zero or more. Preview the public question before asking.',
      'The answer uses that player’s current personal spice. Separate pledged aid and incoming payments are excluded. The server verifies the answer; all four AI levels can answer this question. An exact comparison answered Yes naturally identifies that amount, while a range question reveals only its answer.',
      'Combine spice with a named card or selected traitor using AND or OR. The combined answer is published, without separate clause results or additional inventory details. A question about current holdings creates no promise about later holdings or spending.',
      'The Truthtrance card is discarded once after a definite answer and the interrupted decision resumes. Broader facts, arbitrary prose and nonbattle promises remain unfinished; this support does not establish complete Truthtrance compliance.',
    ],
    related: ['card-truthtrance', 'privacy', 'implementation-checklist'],
    checklist: [
      {
        area: 'Implementation',
        status: 'Implemented',
        detail:
          'Current personal-spice comparisons validate whole thresholds, enforce truthful answers and compose with existing fact groups without creating future commitments.',
      },
      {
        area: 'Player controls',
        status: 'Partial',
        detail:
          'The question form offers comparisons, a styled amount field, unavailable reasons and a public preview. Desktop asking and AI response were checked; mobile and broader question journeys remain to be verified.',
      },
      {
        area: 'AI',
        status: 'Partial',
        detail:
          'All four profiles answer from the private verified result. This does not add strategic spice-question selection or natural-language interpretation.',
      },
      {
        area: 'Documentation',
        status: 'Implemented',
        detail:
          'The guide distinguishes current personal holdings, separate aid and incoming payments, comparison disclosures and future promises within this fact scope.',
      },
      {
        area: 'Verification',
        status: 'Partial',
        detail:
          'Focused checks cover numeric boundaries, truthful answers, private combined results, all profiles, later legal spending, persisted interruptions and duplicate answers. Full Truthtrance and mode acceptance remain separate.',
        evidence: [
          'tests/truthtrance-spice.test.ts',
          'tests/truthtrance-spice-recovery.test.ts',
        ],
      },
    ],
  },
  {
    id: 'truthtrance-card-count',
    title: 'Truthtrance: named-card counts',
    category: 'Cards',
    coverage: 'Partial',
    summary:
      'Ask whether another player holds exactly, at least or at most a number of copies of one named card.',
    steps: [
      'Declare Truthtrance and choose Verified cards, traitors or spice. Select Number of a named card, choose its exact name, select a comparison and enter a whole count of zero or more. Review the public question before asking.',
      'Only physical cards currently in that player’s hand count. Separate cache cards, cards in discard and cards still in a deck are excluded. Shield and Shield Snooper are different names. A card retained in hand after battle still counts.',
      'The server establishes the truthful Yes or No privately for the target. Their public answer reveals only the requested comparison, not card identities or the rest of their hand. An exact-count question answered Yes naturally confirms that count.',
      'Combine a card count with another count, named-card possession, traitor or spice fact using AND or OR. Only the combined answer is published. The answer describes current custody; it does not require the player to keep those cards afterward.',
      'All four AI levels answer the structured comparison. A definite answer discards Truthtrance once and resumes the interrupted table decision. This question type does not complete arbitrary facts or nonbattle future promises.',
    ],
    example:
      '“Do you currently hold at least two cards named Shield?” is Yes with two Shields and No with one Shield plus one Shield Snooper.',
    related: ['card-truthtrance', 'truthtrance-spice', 'privacy'],
    checklist: [
      {
        area: 'Implementation',
        status: 'Implemented',
        detail:
          'Exact named physical-card comparisons validate nonnegative safe integers and compose with verified fact groups.',
      },
      {
        area: 'Player controls',
        status: 'Implemented',
        detail:
          'Named-card selection, three comparisons, accessible count input, invalid-input feedback and a public preview.',
      },
      {
        area: 'AI',
        status: 'Partial',
        detail:
          'All four profiles answer from their own verified result; strategic selection of count questions is not yet calibrated.',
      },
      {
        area: 'Documentation',
        status: 'Implemented',
        detail:
          'Explains current hand custody, exact printed names, compound answers and the absence of a future retention promise.',
      },
      {
        area: 'Verification',
        status: 'Partial',
        detail:
          'Focused parser, actual question/answer, privacy, AI and persistence checks; complete Truthtrance acceptance remains unfinished.',
        evidence: [
          'tests/truthtrance-card-count.test.ts',
          'tests/truthtrance-spice-recovery.test.ts',
        ],
      },
    ],
  },
  {
    id: 'truthtrance-shipment',
    title: 'Truthtrance: shipment promises',
    category: 'Cards',
    coverage: 'Partial',
    summary:
      'Bind a shipment from reserves to a named territory with a minimum physical force count during the active Basic shipment opportunity.',
    steps: [
      'Declare Truthtrance, select the active player and choose Bind a shipment from reserves. Choose a printed destination and minimum of one to twenty forces. Automatic enforcement currently supports the Basic game without expansions, before that player ships and after pending decisions finish.',
      'Yes requires a matching shipment while possible. No prohibits only that matching shipment: a smaller count, different destination, transport of forces already on the board or no shipment remains available. Forces already in the destination and ground movement do not satisfy the question. Fremen reinforcements and Guild transport from southern reserves do count.',
      'The target privately sees feasible answers based on their own resources and earlier promises. Available Ghola revival, Karama discounts, incoming pledged aid and reclaiming their own unused pledge are included. Other players’ unplayed cards and future voluntary gifts are not assumed.',
      'Accepted answers are public and constrain the actual shipment, including any earlier shipment promises. Yes leaves count, sector and legal funding choices open. The shipper cannot move first, finish movement or voluntarily spend away their last way to comply. A completed opposing effect that makes the answer impossible releases it with a public notice.',
      'Your shipment promises remain visible during Movement. Open Suggested next step for a private executable preparation or funded shipment example. It is optional guidance; any legal action sequence honoring the answer is allowed. Shipment fulfillment survives later movement or losses because it records what was shipped.',
      'All four AI profiles answer supported questions and retain a complete legal preparation route when their normal strategic shortlist misses the required count or destination. Earlier-phase questions, Advanced and expansion shipment promises, combined shipment/fact logic and arbitrary freeform promises remain unfinished.',
    ],
    example:
      'Yes to at least six forces to Carthag and No to at least eight there leaves a shipment of six or seven. Moving existing forces into Carthag does not fulfill either shipment event.',
    related: ['card-truthtrance', 'movement', 'alliance-funding', 'privacy'],
    checklist: [
      {
        area: 'Implementation',
        status: 'Partial',
        detail:
          'Authoritative Basic reserve-origin commitments, joint feasibility with owned preparation, actual shipment completion, voluntary-spend guards and opposing release. Broader timing and expansion routes remain unfinished.',
      },
      {
        area: 'Player controls',
        status: 'Implemented',
        detail:
          'Destination/count question, target-private feasible answers, visible accepted promises and private next-step guidance with costs.',
      },
      {
        area: 'AI',
        status: 'Partial',
        detail:
          'All four profiles answer and preserve a legal route beyond their strategic shortlist. Wider promise strategy and strength calibration remain unfinished.',
      },
      {
        area: 'Documentation',
        status: 'Implemented',
        detail:
          'Explains reserve-origin events, Yes/No alternatives, preparation, public release and current software boundaries.',
      },
      {
        area: 'Verification',
        status: 'Partial',
        detail:
          'Focused rules, all-profile AI, privacy and production-room persistence/concurrency coverage. Full Truthtrance and Advanced/expansion acceptance remain unfinished.',
        evidence: [
          'tests/shipment-promises.test.ts',
          'tests/shipment-promises-bots.test.ts',
          'tests/shipment-promises-recovery.test.ts',
        ],
      },
    ],
  },
  {
    id: 'card-truthtrance',
    title: 'Truthtrance',
    category: 'Cards',
    coverage: 'Partial',
    summary:
      'Ask another player a public yes/no question. Verified facts, current-battle plan commitments, freeform answers and saving an unanswered card are supported; arbitrary promise enforcement is unfinished.',
    steps: [
      'Declare the card from your hand at any time after cards are dealt. Other players may declare a competing Truthtrance or pass; questions are then asked in storm order. The interrupted phase, response, or battle decision resumes afterward.',
      'Ask a game-related yes/no question. Named-card, selected-traitor and current personal-spice questions are checked by the server. AND and OR combine facts; only the combined answer is published, with no extra inventory details or separate answer for each clause.',
      'For current spice, choose Exactly, At least or At most and a nonnegative whole amount. This counts spice personally held when answering, excluding separately pledged aid and incoming payments. It does not ask whether a particular action is affordable or promise that the balance will stay unchanged. A true current-spice answer does not prevent later legal spending.',
      'The questioned player answers publicly. A definite answer discards the card. If the answer cannot be known, the holder may ask a different question or save Truthtrance for later.',
      'A saved definite answer resumes automatically: its public answer, binding promise and consumed card are recorded once, then the next queued question or interrupted action resumes. Private answer and preparation guidance is unavailable during this automatic recovery.',
      'Freeform questions also accept public Yes, No, or I don’t know answers. Their truthfulness relies on the players. AI answers structured facts and battle-plan questions; it cannot yet interpret freeform questions.',
      'An answer may bind actions or decisions during the current turn only. The answering player must do everything in their power to comply; if compliance later becomes impossible, the answer is no longer binding. Freeform promises are recorded in the table’s turn history. Arbitrary freeform enforcement and broader action commitments remain unfinished. Structured reserve-shipment promises are enforced for the active unused Basic shipment without expansions; see the shipment promise guide.',
      'Battle-plan questions can bind dial values or ranges, named weapon/defense slots, a leader or either Cheap Hero, spice support and Kwisatz use. AND/OR combinations preserve legal alternatives. Only answers with a legal completion now or through available Ghola preparation are offered; a sealed plan fixes its answer. Previous battle commitments, Voice and prescience also apply. Private preparation guidance can play a required Ghola, then a compliant-plan example can fill the form for review before sealing.',
      'If a completed opposing power makes a battle answer impossible, it is publicly released. A pending Voice response resolves before that release. A player cannot voluntarily spend a promised battle card or give away necessary support spice to evade the answer. Feasibility includes available Ghola cards, eligible leader/Kwisatz or force revivals, and possible revival income. Each actual card can be spent only once. Other future card/power sequences and the full timing audit remain unfinished.',
      'Holding both copies lets you declare one or both. Each question resolves separately, and each card is discarded only after its definite answer. Full timing and card-face audits remain pending.',
    ],
    related: [
      'battle',
      'privacy',
      'truthtrance-spice',
      'truthtrance-card-count',
      'truthtrance-shipment',
    ],
  },
  ...FACTIONS.map(
    (f): RuleTopic => ({
      id: `faction-${f.id}`,
      title: f.name,
      category: 'Factions',
      coverage:
        f.expansion === 'base' || ['tleilaxu', 'ixians', 'ecaz'].includes(f.id)
          ? 'Partial'
          : 'Planned',
      summary: f.title,
      steps:
        f.id === 'ecaz'
          ? [
              'Begin with six forces in the Imperial Basin, fourteen in reserves and twelve spice. Two force revivals are free.',
              'Your Ambassador supply contains the Ecaz token and five random tokens from the remaining pool. Inspect the linked Ambassador guide for all eleven identities and their custody rules.',
              'End-of-Revival placement has owner controls, escalating prices, cancellation responses and bot support in development fixtures. Full faction starts remain disabled.',
              'Eight entry effects and their Bene Gesserit copies, plus direct Ecaz Duke acquisition, have focused support. Storm/explosion token returns, ordinary territorial co-occupation and the three jointly occupied stronghold victory are also supported. Shared desert allocation and Advanced Collection income, including cancellation, are also supported in development fixtures. Tleilaxu revival, combined Occupy battles, the Fremen endgame exception and the complete Duke revival and custody interactions remain unfinished. Consult the feature checklist for the exact tested boundary.',
            ]
          : f.id === 'moritani'
            ? [
                'Set up after every other faction: place six forces in an unoccupied territory, keep fourteen in reserves, and begin with twelve spice. Two force revivals are free.',
                'Keep six Terror tokens hidden: Assassination, Atomics, Extortion, Robbery, Sabotage and Sneak Attack. During each Mentat Pause, you may place one token or relocate one already on the board.',
                'Enemy entry into a marked stronghold offers an optional Terror reaction. Enemy of My Enemy can instead offer the entrant an alliance before the token is revealed, except when the entrant is Ecaz.',
                'When your ally loses a battle that has a winner, the ally may retain one played Treachery Card that it could have kept after winning.',
                'These topics describe the verified rules. Moritani remains unavailable for new games while its complete faction implementation and interaction checks are unfinished.',
              ]
            : (FACTION_RULES[f.id]?.basic ?? [
                'This faction’s complete rules engine and reference are still being developed.',
              ]),
      related: [
        'setup',
        'battle',
        ...(FACTION_RULES[f.id] ? [`advanced-${f.id}`] : []),
        ...(f.id === 'ecaz'
          ? ['ecaz-ambassadors', 'duke-vidal', 'implementation-checklist']
          : []),
        ...(f.id === 'moritani'
          ? [
              'moritani-terror',
              'moritani-enemy',
              'moritani-ally-retention',
              'moritani-assassinate-leaders',
              'duke-vidal',
            ]
          : []),
        ...(f.id === 'ecaz' ? ['duke-vidal'] : []),
      ],
    }),
  ),
  ...Object.entries(FACTION_RULES).map(
    ([id, rules]): RuleTopic => ({
      id: `advanced-${id}`,
      title: `${FACTIONS.find((f) => f.id === id)!.name}: advanced powers`,
      category: 'Advanced & expansions',
      coverage: [
        'atreides',
        'harkonnen',
        'fremen',
        'guild',
        'emperor',
        'tleilaxu',
        'ixians',
      ].includes(id)
        ? 'Partial'
        : 'Planned',
      summary:
        'Advanced faction rules. Some powers have tested engine support; advanced table starts remain disabled until the full rules are ready.',
      steps: rules.advanced,
      related: [`faction-${id}`, 'advanced-combat'],
    }),
  ),
  {
    id: 'duke-vidal',
    title: 'Duke Prad Vidal: shared leader',
    category: 'Advanced & expansions',
    coverage: 'Partial',
    summary:
      'A separate Ecaz leader disc of strength six, with changing control and no Traitor Card.',
    steps: [
      'Duke Vidal is separate from both factions’ five ordinary leaders. His Ecaz identity does not mean Ecaz currently controls him. Inspect the shared disc to see its current controller, whether it is set aside, or whether it is in the Tanks.',
      'At the end of Shipping and Movement, Moritani gains Vidal if it faces battles in at least two strongholds, excluding battles involving Ecaz, and Vidal is not in the Tanks. The printed rule takes him from the current controller. Moritani has him for one battle; it may acquire him again on a later turn by meeting the condition again. At turn end, set him aside unless he is in the Tanks or captured.',
      'Karama can prevent Moritani from acquiring Vidal. That cancellation does not remove him once Moritani already controls him.',
      'Ecaz gains Vidal through its Ecaz Ambassador if he is neither in the Tanks, captured nor a ghola. Ecaz keeps him until battle use or Moritani takes him. The Ambassador can instead form a consensual alliance when both factions are unallied; Ecaz may then lend Vidal to that new ally for the turn.',
      'Only Ecaz may revive Vidal, including with Ghola Treachery. Ecaz may revive him for five spice regardless of how many of its leaders are in the Tanks. Five spice is his special revival cost; his printed battle strength is six. Ecaz may begin ordinary leader revival when five leaders are in the Tanks, counting Vidal, even if it still holds another leader.',
      'The current implementation supports Moritani acquisition, direct Ecaz Ambassador self-acquisition, consensual Ambassador alliances and one-battle use. Duke loans, reacquisition while already controlled, revival and captured-leader interactions remain unfinished. This shared component does not enable complete Ecaz or Moritani games. Inspection does not commit a battle plan.',
    ],
    related: [
      'faction-ecaz',
      'faction-moritani',
      'battle',
      'revival',
      'captured-leaders',
      'card-karama',
    ],
  },
  {
    id: 'moritani-terror',
    title: 'Moritani Terror: placement and entry',
    category: 'Advanced & expansions',
    coverage: 'Partial',
    summary:
      'Six hidden tokens threaten stronghold entrants. Moritani starts remain unavailable.',
    steps: [
      'Placement and isolated entry decisions have controls for Robbery, Sabotage, Sneak Attack and ordinary native-leader Assassination. You may instead leave a token hidden. Arrivals with competing reactions remain unavailable while their timing is clarified; Moritani starts remain disabled.',
      'Begin with all six Terror tokens in your hidden supply. Once during Mentat Pause, you may either place one from supply or move one already placed to another eligible stronghold. There is no spice cost.',
      'The destination must have no Terror token. A stronghold under storm is eligible, but the Hidden Mobile Stronghold and Homeworlds are excluded.',
      'When another faction ships or moves into the marked stronghold, you may reveal its token and apply the effect to that entrant. Your ally does not trigger this opportunity. Bene Gesserit advisors do.',
      'You may decline a normal trigger, leaving the token hidden where it is. Being present when a token is placed does not itself count as entering. A revealed token leaves the game, except when Extortion is subsequently recovered.',
      'Richese No-Field placement can trigger Terror, including a zero No-Field. Revealing that No-Field later does not create another trigger. Replacing an army with Face Dancers does not trigger Terror either.',
      'Terror tokens survive storms and Lasgun–Shield explosions. Their survival is separate from the fate of forces in the territory.',
      'Karama can prevent a Terror placement or relocation. The Moritani cancellation table does not list a cancellation of a token’s reveal or effect. Enemy of My Enemy has its own alliance cancellation.',
      'The relative order of Terror, ambassadors, Bene Gesserit reactions and other effects from the same arrival remains under review. These rules do not establish a priority order between those reactions.',
    ],
    related: [
      'faction-moritani',
      'moritani-terror-effects',
      'moritani-enemy',
      'movement',
      'mentat',
      'advanced-advisors',
    ],
  },
  {
    id: 'moritani-terror-effects',
    title: 'Moritani: the six Terror effects',
    category: 'Advanced & expansions',
    coverage: 'Partial',
    summary:
      'Random assassination, territorial destruction, deferred income, theft, sabotage and reserve entry.',
    steps: [
      'Robbery, Sabotage, Sneak Attack and ordinary native-leader Assassination have controls for supported entry reactions. After a Robbery draw, finish any required discard; after Sabotage, give one of your own cards or decline. Enemy of My Enemy has partial alliance controls. Atomics, Extortion and complete Moritani games remain unfinished.',
      'Assassination: randomly select one of the entrant’s leaders and send it to the Tanks. Moritani collects spice for that leader’s value; Zoal pays three. Revealing the token resolves the random selection without letting Moritani choose a victim. This token needs neither a battle loss nor a matching Traitor Card. Current controls support ordinary native leaders; unresolved captured, foreign or special-leader pools block revelation and show Moritani the reason privately.',
      'Atomics: send every faction’s forces in the territory to the Tanks and place Atomics Aftermath there. Its lasting shipment prohibition and hand-limit penalty are explained in the Aftermath topic.',
      'Extortion: set aside five spice from the bank for collection during Mentat Pause. After collection, recover this token unless one player pays you three spice in the storm-order opportunity. The Extortion topic explains the two separate payments.',
      'Robbery: choose between taking half the entrant’s spice, rounded up, and drawing the top Treachery Card. If the draw exceeds your hand limit, choose a card to discard afterward; a full hand does not remove the draw option.',
      'Sabotage: randomly draw and discard a Treachery Card from the entrant if possible. Then you may give that player a card of your choice from your own hand. Giving a card is optional.',
      'Sneak Attack: send up to five of your reserve forces into the triggered territory at no cost, respecting storm and occupancy restrictions. This particular entry is allowed even when Atomics Aftermath is present.',
      'Before revealing Sneak Attack, inspect its private available maximum and any reason positive entry is blocked. You may keep it hidden. Revealing spends the token even if you then choose Send no forces. For a supported entry, select zero through the displayed maximum; forces enter the arrival’s territory and sector without consuming your ordinary shipment or movement turn. Zero remains available when positive entry is blocked. Aftermath’s printed exception does not mean the unfinished Atomics lifecycle is enabled.',
      'The random Assassination token is separate from the advanced Assassinate Leaders advantage. Neither ability supplies the other’s selection or timing rules.',
    ],
    related: [
      'moritani-terror',
      'moritani-aftermath',
      'moritani-extortion',
      'moritani-assassinate-leaders',
    ],
  },
  {
    id: 'moritani-aftermath',
    title: 'Moritani Atomics and Aftermath',
    category: 'Advanced & expansions',
    coverage: 'Planned',
    summary:
      'Destroy the territory’s forces, prohibit future shipment there, and reduce hand limits.',
    steps: [
      'When the Atomics Terror token resolves, all forces in that territory go to the Tanks. Put the separate Atomics Aftermath marker in the territory.',
      'Aftermath permanently prohibits shipping forces into that territory, including Fremen reinforcements. The restriction is on shipment: it does not prohibit otherwise legal ordinary movement into the territory.',
      'Sneak Attack expressly permits its reserve forces to enter despite Aftermath. Its storm and occupancy restrictions still apply.',
      'Beginning this turn, Moritani’s hand limit and its ally’s hand limit are each reduced by one. If a hand exceeds its reduced limit, discard a random card.',
      'The lasting penalty’s treatment after a later alliance change is unresolved. This topic does not decide whether the penalty remains with an old ally or follows a new one.',
      'The Atomics Terror token and Family Atomics Treachery Card are separate components with different effects. Aftermath is not the destroyed Shield Wall.',
    ],
    related: ['moritani-terror-effects', 'movement', 'card-atomics', 'bidding'],
  },
  {
    id: 'moritani-extortion',
    title: 'Moritani Extortion: collection and recovery',
    category: 'Advanced & expansions',
    coverage: 'Planned',
    summary:
      'Five deferred bank spice and a separate opportunity to prevent the token’s return.',
    steps: [
      'Revealing Extortion sets aside five spice from the bank in front of Moritani’s shield. This is collected during Mentat Pause; it is not immediately available to spend.',
      'After collecting that spice, Moritani regains Extortion unless a player pays Moritani three spice. Offer the payment opportunity in storm order. One payment is sufficient to prevent recovery.',
      'The three-spice payment is additional to the five-spice bank award. It prevents the token returning to supply; it does not cancel the bank income.',
      'If nobody pays, return Extortion to Moritani’s supply. Other revealed Terror tokens have no corresponding recovery provision.',
      'The ordering of this recovery against Moritani’s placement opportunity and other Mentat actions is not settled here. Do not assume that a recovered token can always be placed again in the same Mentat Pause.',
    ],
    related: ['moritani-terror', 'moritani-terror-effects', 'mentat'],
  },
  {
    id: 'moritani-enemy',
    title: 'Moritani: Enemy of My Enemy',
    category: 'Advanced & expansions',
    coverage: 'Partial',
    summary:
      'Offer the entrant an alliance before revealing a would-trigger Terror token.',
    steps: [
      'Supported entry opportunities offer private Moritani controls followed by a public Karama response and, if allowed, an accept/refuse decision for the entrant. The entrant sees the alliance terms, not the hidden token’s name, face or Moritani’s private eligibility details. Complete Moritani games remain unavailable.',
      'When an eligible faction would trigger Terror, Moritani may offer that entrant an alliance before revealing the token. This offer cannot be made to Ecaz.',
      'If accepted, Moritani and the entrant become allies immediately, ending any existing alliance either had. Return the unrevealed Terror token to Moritani’s supply.',
      'If newly allied forces already share a territory, neither is immediately removed. If they still share it at the beginning of the next turn, one faction must leave during that turn’s Shipment and Movement; if the first does not leave, the second must leave or lose its forces there to the Tanks.',
      'If the entrant refuses the offer, Moritani must reveal the token. Making an offer and receiving a refusal does not retain the ordinary option to decline the trigger.',
      'This alliance opportunity comes from the faction ability; it does not wait for a Nexus. Karama can prevent the alliance forming, while Moritani may still reveal the token.',
      'In the current controls, Karama is checked before the entrant replies. If canceled, the decision returns to Moritani: reveal the token or leave it hidden. The canceled offer cannot be offered again during this entry opportunity.',
      'An offer is available only when the implementation can resolve the token if the entrant refuses. Unfinished effects or unsupported leader and entry interactions therefore block the offer upfront; the private reason is shown to Moritani. This is an implementation limit, not an extra printed alliance rule.',
      'No token identity is revealed merely by making or accepting the offer.',
    ],
    related: [
      'faction-moritani',
      'moritani-terror',
      'spice-blow',
      'card-karama',
    ],
  },
  // Source/implementation audit: docs/MORITANI_ALLY_RETENTION_RULES.md.
  // GF9 Ecaz & Moritani p.6 supplies the ally choice; base p.14 supplies general
  // Karama composition. The continuation order below describes this engine,
  // not a dedicated publisher ruling on simultaneous postbattle effects.
  {
    id: 'moritani-ally-retention',
    title: 'Moritani alliance: retain a battle card',
    category: 'Advanced & expansions',
    coverage: 'Partial',
    summary:
      'A defeated Moritani ally may keep one eligible played Treachery Card when the battle has a winner.',
    steps: [
      'The choice belongs to the defeated ally. Moritani does not gain this benefit for its own losses, and no separate Moritani approval is required. Choose one of your played cards that you could have retained after winning, or decline the ability.',
      'A single successful traitor call still produces a winner and can allow retention. Mutual traitor destruction and a resolved Lasgun–Shield explosion have no winner, so they provide no opportunity. Resolve the actual battle outcome before checking this condition.',
      'Only eligible physical cards from your Battle Plan appear in the controls. Unplayed cards, opposing cards and leader discs cannot be chosen. Cheap Hero or Heroine must be discarded. Other mandatory-discard rules use the same test as winner cleanup, including whether Poison Tooth was actually used and whether a traitor decided the battle.',
      'In the current sequence, the winner first completes any casualty choice and its own played-card cleanup. The defeated ally then declares one eligible card. That declaration opens the general Karama response against the Moritani alliance power before the card is finally retained; declining skips this response and discards the pending played cards.',
      'If Karama cancels the power, discard all of the defeated ally’s pending played cards. If the table allows it, retain the declared card and discard the rest. Cards awaiting this cleanup remain reserved and cannot be spent through another power during the decision or response.',
      'The played cards were already revealed in battle. The table can see the retention declaration; inspection and selection do not reveal unrelated cards from the defeated ally’s hand.',
      'After retention resolves, this implementation continues pending CHOAM battle income, technology transfer, Harkonnen capture and Face Dancer opportunities. The retained card is settled before those continuations; the original battle is not recalculated. This order is the current implementation of the combined rules, not a separate expansion priority ruling.',
      'The card choice, cancellation and cleanup have controls, but complete Moritani faction games remain unavailable while other powers and interactions are unfinished.',
    ],
    related: [
      'faction-moritani',
      'battle',
      'card-karama',
      'captured-leaders',
      'privacy',
    ],
  },
  {
    id: 'moritani-assassinate-leaders',
    title: 'Moritani: advanced Assassinate Leaders',
    category: 'Advanced & expansions',
    coverage: 'Planned',
    summary:
      'A battle-loss advantage using a different Traitor Card, separate from Terror Assassination.',
    steps: [
      'After you lose a battle, this advanced advantage is available only if the opposing leader disc survived and no Traitor was called.',
      'You may reveal a Traitor Card for that opposing faction, but it must name a different leader from the one you just fought. If that named leader is not in the Tanks, kill it and collect spice for its value.',
      'During Mentat Pause, set the revealed card aside face up as a marker and draw a new Traitor Card. You can use this advantage only once against each faction in the game.',
      'You may instead reveal a traitor normally in battle, but doing so loses this advanced advantage. The cancellation table gives Karama no effect against Assassinate Leaders.',
      'If Harkonnen has captured your own leader and you hold its Traitor Card, you may call that traitor normally; you may not use Assassinate Leaders on that basis.',
      'Terror Assassination chooses a random leader when its token is triggered. It does not use this battle-loss condition, different-leader Traitor Card or once-per-faction allowance. Advanced starts and Moritani starts remain unavailable.',
    ],
    related: [
      'faction-moritani',
      'moritani-terror-effects',
      'battle',
      'captured-leaders',
    ],
  },
  {
    id: 'advanced-combat',
    title: 'Advanced combat and elite forces',
    category: 'Advanced & expansions',
    coverage: 'Partial',
    summary:
      'Spice-supported combat, elite units, casualty selection and Kwisatz Haderach.',
    steps: [
      'The combat engine now distinguishes ordinary and elite tokens, accepts half-strength dials and seals spice support with the battle plan. Advanced table starts remain disabled while other advanced rules are built.',
      'One spice supports one token at its full strength. Unsupported tokens fight at half strength. Fremen uses full strength without spice; Sardaukar counts as ordinary against Fremen.',
      'After resolution, casualties must match both the dial and spice spent. One legal ordinary/elite allocation settles automatically; several legal allocations ask the winner to choose. The losing army is destroyed. Only a traitor winner avoids its committed spice payment.',
      'Elite tokens are tracked in reserves, territories and tanks. Normal revival, Ghola and the Emperor’s extra revival all share the limit of one elite revival per faction per turn.',
      'Atreides privately tracks losses and can add KH to a sealed plan after seven battle losses. The accompanying leader or Cheap Hero gains two strength if it survives, and cannot turn traitor. KH can be used in only one territory per turn.',
      'Before sealing plans, the table offers separate Karama responses for doubled elite strength and Fremen’s free spice support. Canceling elite strength makes those tokens fight as ordinary forces for this battle; it does not change their token type. Canceling free support makes Fremen pay spice or fight at half strength. Sardaukar already fights as ordinary against Fremen.',
      'The KH cancellation window does not disclose Atreides’ activation status or selected plan. Canceling prevents both its bonus and its traitor protection in this battle.',
    ],
    example:
      'An Emperor army with one Sardaukar and five ordinary forces dials 3 and spends 1 spice. It may lose the supported Sardaukar and two unsupported ordinary forces, or one supported ordinary force and four unsupported ordinary forces.',
    related: ['battle', 'revival', 'automatic-casualties'],
  },
  {
    id: 'advanced-storm-spice',
    title: 'Advanced storms and double spice blow',
    category: 'Advanced & expansions',
    coverage: 'Partial',
    summary:
      'Two spice piles, Fremen forecasts, half storm losses and additional worms.',
    steps: [
      'These phase rules have engine support and focused tests. Advanced table starts remain disabled while the other advanced powers are completed.',
      'Resolve blow A, its worms, Harvester window, Nexus and rides, then do the same for blow B. Each pile uses its own previous discard. First-turn worms are set aside and shuffled back only after both blows finish.',
      'After the first storm, Fremen privately learns a random storm card for the next turn. A foresight cancellation hides that card from Fremen without changing its eventual distance. Weather Control may replace a revealed card distance before movement.',
      'Fremen storm losses are half the exposed group, rounded up. Choose ordinary and Fedaykin casualties when more than one combination is possible. A legal reserve shipment into storm applies this loss only to the arriving group.',
      'Fremen may place additional worms from a spice blow in a sand territory. Canceling this placement prevents further additional-worm placements for the rest of the turn. Ordinary worm appearances and their Nexus still resolve.',
      'Fremen worm survival and optional allied protection have separate responses before casualties. Canceling Fremen survival destroys the Fremen forces at that worm’s location and removes that ride; it does not cancel an allowed protection of allied forces.',
    ],
    example:
      'Five Fremen forces caught in storm lose three tokens. If the group includes two Fedaykin, Fremen can keep both by losing three ordinary tokens.',
    related: [
      'storm',
      'spice-blow',
      'advanced-fremen',
      'card-karama',
      'card-weather',
      'card-harvester',
    ],
  },
  {
    id: 'victory',
    title: 'Winning and the final turn',
    category: 'Getting started',
    coverage: 'Partial',
    summary:
      'Stronghold targets, storm-contested occupation, prediction and final-turn fallback.',
    steps: [
      'Victory is checked when the Mentat pause begins. A faction needs three strongholds, or four when allied or playing a two-player game. Allies combine distinct qualifying strongholds.',
      'Ecaz and its reciprocal ally can also win by jointly occupying three strongholds: both factions need non-advisor presence in each, without opposing fighters. The ordinary four-stronghold alliance route remains available. Occupy cancellation does not remove this victory condition. A concealed No-Field supplies public presence; its secret value is not revealed by this check.',
      'Opposing forces may survive together in a stronghold covered by storm. That contested stronghold does not count for either side. A sole occupant still counts it even under storm.',
      'A correct Bene Gesserit faction-and-turn prediction replaces a normal win, including an allied win, with a Bene Gesserit solo win. Guild and Fremen special wins cannot be predicted.',
      'On turn ten, a normal stronghold victory comes first. Otherwise, check Fremen’s special condition, then award the game to Guild and its ally if present. If Guild is absent, Fremen and its ally win even when the usual Fremen special condition fails.',
      'When neither Guild nor Fremen is playing and nobody has reached the normal target, compare individual qualifying stronghold counts. Every player tied for the highest count wins. A correct Bene Gesserit prediction can replace this stronghold win.',
      'With tech tokens enabled, owning all three adds one stronghold. One player must hold all three, even in an alliance. If several sides reach their target at the same check, they share a normal win before any correct prediction replaces it.',
      'The table’s Stronghold victory progress shows current qualifying territories, a complete Tech Token set and Ecaz joint occupation. Tech Tokens cannot supply a jointly occupied territory. These public counts do not resolve a private prediction or award victory before the proper checkpoint.',
      'Other expansion additions to victory remain in development. Advanced and expansion faction starts remain disabled.',
    ],
    example:
      'At the final turn with neither Guild nor Fremen, two players each hold two qualifying strongholds and a third holds one. The two leaders of the count share the win.',
    related: [
      'mentat',
      'tech-tokens',
      'faction-fremen',
      'faction-guild',
      'faction-beneGesserit',
    ],
  },
  {
    id: 'stronghold-cards',
    title: 'Stronghold Cards: control and battle advantages',
    category: 'Advanced & expansions',
    coverage: 'Partial',
    summary:
      'Six public cards reward control with local battle advantages. This optional module requires Advanced rules.',
    steps: [
      'Set all six cards aside at setup. At the end of the first Mentat Pause, give each card to the faction controlling its stronghold. At every later turn end, transfer it to the new controller or set it aside if nobody controls that place.',
      'Keep each card throughout the following turn even if your forces leave or lose control. The benefit applies only to its holder when battling in that stronghold. It is separate from your Treachery hand and does not use a hand slot.',
      'One faction must occupy the stronghold with fighters. Bene Gesserit advisors do not contest control. When Ecaz and its reciprocal ally are the only occupying fighters, Ecaz controls it. A concealed Richese No-Field counts as an occupying presence without revealing its value.',
      ...STRONGHOLD_CARDS.map(
        (card) => `${card.name}: ${card.gameplay.join(' ')}`,
      ),
      'The mobile card copies a currently controlled stronghold, even if another faction still holds that location’s card. Holding a card after leaving its location does not itself make that location an eligible copy. The choice is public and fixed before battle plans; a sole eligible advantage is announced automatically.',
      'Arrakeen pays only for actual support and creates no personal cash. CHOAM force-payment income includes the bank contribution, subject to its normal traitor and donor exclusions. Carthag does not protect an empty or Worthless defense, stop Poison Tooth, or remove a Shield’s Lasgun explosion risk.',
      'Sietch Tabr uses the opposing dial, excluding leaders and other bonuses. A single traitor victory qualifies; mutual destruction does not. Tuek pays after an ordinary loss or a single traitor outcome as well as a win; a double traitor gives neither faction spice. Habbanya also decides a tied Stone Burner comparison.',
      'The six effects, public ownership and pre-plan choice are integrated in development games. Complete Advanced games and every expansion interaction remain under verification, so public Advanced starts remain unavailable.',
    ],
    example:
      'You hold Arrakeen’s card and support four forces. The bank pays two spice; you and any permitted ally cover the remaining two. Leaving Arrakeen later does not transfer its card until turn end.',
    related: [
      'battle',
      'mentat',
      'choam-combat',
      'mobile-stronghold',
      'choam-modules',
    ],
    checklist: [
      {
        area: 'Implementation',
        status: 'Partial',
        detail:
          'All six local effects and end-Mentat custody are integrated. Full optional-module combinations remain under review.',
        evidence: [
          'game/stronghold-cards.ts',
          'game/stronghold-battle.ts',
          'game/engine.ts',
        ],
      },
      {
        area: 'Player controls',
        status: 'Implemented',
        detail:
          'Public held cards, enlarged inspection, event-bound mobile copy and bank-aware support cost.',
        evidence: [
          'components/stronghold-cards.tsx',
          'components/game-table.tsx',
        ],
      },
      {
        area: 'AI',
        status: 'Partial',
        detail:
          'All four policies understand public copy choices, support subsidies, defense and tie effects; comparative full-game calibration remains pending.',
        evidence: ['game/bots.ts'],
      },
      {
        area: 'Documentation',
        status: 'Implemented',
        detail:
          'All six full effect guides, custody timing, examples and interaction explanations are available here.',
        evidence: ['game/reference.ts', 'docs/STRONGHOLD_CARDS.md'],
      },
      {
        area: 'Verification',
        status: 'Partial',
        detail:
          'Focused ownership, payment, defense, ties and income checks pass. Whole-game and all-combination acceptance remains unfinished.',
        evidence: [
          'tests/stronghold-cards.test.ts',
          'tests/stronghold-engine.test.ts',
        ],
      },
    ],
  },
  {
    id: 'tech-tokens',
    title: 'Tech tokens: income, conquest and victory',
    category: 'Advanced & expansions',
    coverage: 'Partial',
    summary:
      'An optional Ixians & Tleilaxu module, available with three or more players independently of expansion factions.',
    steps: [
      'The host can enable tech tokens in the lobby. Changing this option clears human readiness. Fremen begins with Spice Production, Ixians with Heighliners, and Tleilaxu with Axlotl Tanks. After the first storm, randomly assign any remaining tokens in storm order to factions without one.',
      'Spice Production triggers when a faction takes CHOAM charity, except when only Bene Gesserit does so. Axlotl Tanks triggers when a faction receives free revival in the Revival phase, except when only Tleilaxu does so. Heighliners triggers when a faction ships from off planet, except when only Guild does so.',
      'Each token triggers once in its matching phase. Place spice on the token equal to the number of tech tokens its owner holds, including itself. Collect that spice only at the end of the phase; it is unavailable for spending before then.',
      'Fremen reserve arrivals and Guild cross-planet or return shipments do not trigger Heighliners. A stopped shipment never arrives and cannot trigger it. Bene Gesserit accompanying forces do arrive from off planet and can trigger the token even after a Guild shipment.',
      'A battle winner takes one tech token from the defeated faction after casualties and played-card decisions. With several available tokens, the winner chooses. A winner still takes the token if no winning forces survive. Mutual destruction has no winner and transfers no token.',
      'Owning all three tokens counts as one additional stronghold at victory checks. An alliance cannot combine separate token holdings to qualify: one member must own the complete set. Multiple sides reaching the victory target can share the win.',
      'Token ownership and pending income are public and persist with the room. Two-player token setup and interactions with the unfinished expansion factions and other modules remain unavailable.',
    ],
    example:
      'You own Heighliners and Axlotl Tanks. When Emperor ships from reserves, place two spice on Heighliners. A later shipment adds nothing. Collect the two spice when Shipping and Movement ends.',
    related: [
      'charity',
      'revival',
      'movement',
      'battle',
      'victory',
      'ix-modules',
    ],
  },
  {
    id: 'captured-leaders',
    title: 'Harkonnen captured leaders',
    category: 'Advanced & expansions',
    coverage: 'Partial',
    summary:
      'Capture, execution, borrowed battle leaders and private information.',
    steps: [
      'After a Harkonnen battle victory, finish casualties and played-card decisions, then choose whether to capture a leader. A cancellation window resolves before the random draw.',
      'The draw includes eligible surviving leaders from the loser, including the leader just used if alive. A leader used in another territory this turn is excluded.',
      'Inspect the captive privately. Execute it for two spice or retain it for one battle. Execution sends the leader face down to its original faction’s tanks; it counts as having died twice and normal revival restrictions apply.',
      'A retained captive is available only to Harkonnen. Its territorial use restrictions remain. It can turn traitor, returns to its faction if it survives its one battle, and enters its original faction’s tanks if killed.',
      'When all native Harkonnen leaders are dead, return every unused captive immediately. A new captive retained in that situation also returns immediately.',
      'Only Harkonnen and the original owner know a concealed living captive’s identity. Tleilaxu can inspect a concealed executed leader. Using a captive in a revealed battle makes its identity public.',
      'The capture engine and private views have focused tests. Advanced table starts remain disabled while other advanced rules and expansion interactions are completed.',
    ],
    related: [
      'advanced-harkonnen',
      'battle',
      'revival',
      'card-karama',
      'card-ghola',
    ],
  },
  {
    id: 'special-karama',
    title: 'Once-per-game faction Karama powers',
    category: 'Advanced & expansions',
    coverage: 'Partial',
    summary:
      'The five base faction special powers and Tleilaxu revival prevention have engine support; timing and expansion audits remain.',
    steps: [
      'Spend an actual Karama card to activate your faction’s special power once per game. The usage remains spent on later turns, but you may still use other Karama cards normally. These powers resolve directly without a normal faction cancellation window.',
      'After Voice and ordinary prescience are resolved or declined, Atreides may spend its special Karama to inspect either combatant’s entire plan, including in a battle it is not fighting. The target commits first; Atreides receives the dial, leader, weapon, defense, spice support and KH selection privately. Its ally does not automatically receive this view.',
      'The inspected plan remains privately visible in Atreides’ action panel while the other combatant prepares a plan. No inspection acknowledgement is required. This also applies when Atreides is outside the battle helping an ally; that ally does not receive the inspection automatically. Both committed plans trigger the public reveal, which ends the private inspection. The inspected plan stays committed. Atreides may retain the power by declining this battle’s offer. A canceled ordinary prescience request does not remove the special power.',
      'The full-plan commitment order is an implementation timing choice awaiting the remaining card-interaction audit; it must not be treated as proof that every pre-reveal Karama or expansion timing interaction is complete.',
      'During Revival, Emperor may revive up to three of its own forces or one of its own dead leaders for free. This is separate from normal revival allowances. The shared one-Sardaukar-per-turn limit still applies.',
      'During Bidding, Harkonnen chooses another player and takes up to four unseen cards. Inspect the combined hand, then return exactly the same number of cards. Newly taken cards may be included in the return.',
      'Harkonnen may temporarily exceed eight cards during this choice. The return restores normal limits. Other players see the exchange count, but only each hand’s owner sees its cards.',
      'A hand exchange pauses the current auction action or response and resumes it after the return. If the exchange removes the only Karama backing an unfunded bid, the current auction recovery remains provisional pending primary-source confirmation.',
      'During Shipment and Movement, the Guild may stop a declared off-planet shipment by spending its once-per-game special Karama. The decision happens before payment or arrival, so a stopped shipment earns no Guild income and triggers no accompanying advisor. Fremen’s on-planet reinforcements and cross-planet movement are excluded.',
      'The stopped shipment uses the shipper’s shipment opportunity while retaining forces, spice, allied credit and any shipment-rate card; ordinary movement remains available. These settlement details remain provisional pending primary-source clarification. The Guild decision appears regardless of its hidden hand.',
      'Fremen may call a worm in a sand territory during Spice Blow and Nexus. It destroys spice and unprotected forces immediately. Ally protection and Fremen survival have separate responses; a second Karama may cause Fremen to be devoured. The special summon itself consumes no spice-deck card.',
      'Resume any interrupted spice draw, fresh-blow window or worm response after the summoned worm resolves. Its Nexus occurs at the end of the blow, followed by eligible Fremen rides. During an open Nexus, the new ride joins the existing queue. Destroyed fresh spice cannot later be doubled by Harvester.',
      'Tleilaxu receive a decision before another faction’s normal revival completes, whether or not they hold Karama. Decline to continue the revival, or spend a real Karama once per game to prevent that faction’s normal force and leader revivals for the current turn. A stopped attempt spends no spice, returns no pieces and consumes no elite or extra-revival quota.',
      'This includes negotiated leaders, KH and Emperor-funded allied extra forces. The Emperor remains the payer when an extra revival is allowed. Hidden leader identities and prices are not added to the public stop decision. Ghola treachery and the Emperor’s special Karama currently remain separate from the normal-revival restriction.',
      'The printed Tleilaxu power is brief. Its full-turn scope, precise timing and card/special-power exceptions remain provisional pending the complete primary-source audit. These choices are tested implementation behavior, not certification of the full expansion rules.',
      'Remaining expansion special powers, plus further timing and expansion interaction audits, remain unfinished. Advanced table starts remain disabled.',
      'Richese’s special purchase is available in development tables: spend a Karama and three spice to choose privately from the cache, with separate Emperor income and explicit full-hand/final-cache guards. See its acquisition guide for current controls and limits.',
    ],
    related: [
      'card-karama',
      'richese-acquisition',
      'bidding',
      'revival',
      'faction-harkonnen',
      'faction-emperor',
      'faction-atreides',
      'faction-guild',
      'movement',
    ],
  },
  {
    id: 'choam-gamont',
    title: 'Trip to Gamont and Mentat victory',
    category: 'Advanced & expansions',
    coverage: 'Partial',
    summary:
      'Return one other player’s force to reserves before stronghold control is checked.',
    steps: [
      'In basic or advanced play, CHOAM may use Trip to Gamont during Mentat Pause. Select another player, an occupied board sector and an ordinary or elite force. One physical token returns to that player’s reserves; it is not killed, revived or shipped. If the selected Richese sector has a No-Field, it must reveal first. Return one force if any are present; the card is still used if there are none.',
      'You may select forces in storm, peaceful Bene Gesserit advisors, or occupants inside the Hidden Mobile Stronghold. An elite force remains elite in reserves. No spice, revival allowance, battle-loss count or transport income changes. If removing the last opposing force leaves advisors alone, their stance settles before victory.',
      'The declared card, recipient, sector and force type are public before a Karama response. Cancellation leaves both card and force in place and prevents retrying that physical card’s effect for the phase. If the card or selected force disappears during an interruption, no return occurs and the card is not discarded for the effect.',
      'At CHOAM tables, Mentat starts by settling bribes and Inflation, while victory remains pending. Play ordinary Mentat actions and mark ready, then finish the closing sales and allied exchange. CHOAM receives a final Trip to Gamont opportunity even with an empty hand. A copy acquired in the closing exchange can be used here.',
      'After any final declaration and its response, CHOAM may make another available play or choose Finish and check victory. Normal stronghold wins, the tech-token bonus, Bene Gesserit prediction and final-turn special conditions use the resulting board. If nobody wins, the next turn begins. A prevented return does not skip this confirmation.',
      'The implemented timing prevents premature victory, but ordering with later simultaneous Mentat powers, future force types and module exceptions remains under audit. Full CHOAM starts remain gated alongside unfinished faction powers.',
    ],
    related: [
      'faction-choam',
      'choam-worthless',
      'choam-market',
      'mentat',
      'tech-tokens',
      'card-karama',
    ],
  },
  {
    id: 'choam-jubba',
    title: 'Jubba Cloak and the moving storm',
    category: 'Advanced & expansions',
    coverage: 'Partial',
    summary:
      'Save CHOAM’s forces in one threatened territory when the storm moves.',
    steps: [
      'After the storm distance and storm-card choices are settled, CHOAM receives a decision if the storm will cross any of its exposed forces. This opportunity appears even with no Jubba Cloak in hand, so it reveals no private card information.',
      'Choose one listed territory and declare Jubba Cloak. The target is public. Other factions may cancel the Worthless effect with Karama before the card is discarded. Successful protection covers CHOAM forces in the selected territory across the sectors crossed by this storm movement.',
      'Protection does not cover spice, other factions or allied forces in that territory. Other CHOAM territories remain exposed. Sheltered forces need no Jubba protection. The current implementation protects against one storm movement, not later shipment or movement into the stationary storm.',
      'If the effect is canceled, Jubba stays in hand and its effect is unavailable for the rest of the phase. If the declared card or threatened forces are no longer available, no card is discarded for this effect. CHOAM can then continue the storm, accepting any remaining losses.',
      'A remaining-threat decision follows a successful or canceled play. Continue when finished; any Fremen storm-protection response and casualty choices follow before final movement settlement. Each successfully protected territory is listed. Protection ends when the storm finishes moving.',
      'Exact simultaneous-power ordering and the territory-wide timing interpretation remain under audit alongside the other expansion interactions. Full expansion starts remain unavailable until that audit and complete-game validation finish.',
    ],
    related: [
      'choam-worthless',
      'storm',
      'faction-choam',
      'card-karama',
      'card-weather',
      'card-atomics',
    ],
  },
  {
    id: 'choam-worthless',
    title: 'CHOAM Worthless card powers',
    category: 'Advanced & expansions',
    coverage: 'Partial',
    summary:
      'Use Kulon for range, La La La to deny free revival, Baliset to prevent enemy movement, Jubba Cloak for storm protection or Trip to Gamont to return a force.',
    steps: [
      'These CHOAM abilities work in basic and advanced games. Choose a printed Worthless card from the phase controls. Its name and intended effect are announced, then a Karama response occurs before discard. A canceled card remains in hand and cannot be retried for its effect during that phase.',
      'On your own Shipment and Movement turn, play Kulon while a movement remains. It adds one territory to your movement range, including ornithopters. It does not add another movement action, bypass the storm or relax alliance/stronghold entry rules. The current implementation applies the bonus to both movements if Hajr is used; this combination remains under audit.',
      'During Revival, play La La La and select a player to prevent its free force revivals for the rest of the phase. Earlier revivals are unchanged. The prohibition also prevents a Fremen allied free allowance from providing free returns, even if granted later.',
      'Whenever another faction requests a normal revival with a free portion, CHOAM receives a response decision independently of its private hand. Allow the request, or declare La La La for that requester. If the effect succeeds, the whole pending request stops without payment, force movement or quota use; a faction permitted to purchase normal revivals can submit a paid request. If the effect is canceled, the original quote resumes through any Tleilaxu and other applicable responses.',
      'La La La does not prevent otherwise legal paid revivals or separate Ghola card effects. With Tleilaxu in the game, Fremen may submit a paid request within their current limit after free revival is prevented. Without Tleilaxu, Fremen’s base purchase restriction leaves no normal force return available. Emperor-funded extras remain separate. The prohibition resets when the next Revival phase begins. Card custody is checked at settlement: if CHOAM cashed in the declared card during the response, no Worthless effect occurs and the interrupted revival resumes.',
      'During Shipment and Movement, use Baliset to select another player and a territory CHOAM occupies. The current implementation prevents that player from entering that territory by movement for the phase while CHOAM remains there; shipment is allowed. A declared move into a CHOAM territory pauses for CHOAM regardless of its private hand. Allow it or declare Baliset. A successful effect leaves the moving forces in place and the movement unspent; a canceled or unavailable card resumes the original move after checking its legality again.',
      'Kulon, La La La, Baliset, Jubba Cloak and Trip to Gamont now have engine, private controls and AI support. See the linked Trip to Gamont topic for force selection and victory timing. See Jubba Cloak for protection during storm movement. Kull Wahad still needs its special effect. Exact cancellation scope, Hajr/ornithopter combinations, Baliset duration and destination scope, ordering of simultaneous prevention powers, and later module exceptions remain under audit. Full faction starts remain disabled.',
    ],
    related: [
      'faction-choam',
      'choam-gamont',
      'choam-jubba',
      'choam-market',
      'choam-revival',
      'movement',
      'revival',
      'card-karama',
    ],
  },
  {
    id: 'choam-combat',
    title: 'CHOAM combat funding and force income',
    category: 'Advanced & expansions',
    coverage: 'Partial',
    summary:
      'Finance an ally’s supported forces and receive a share of other players’ combat payments.',
    steps: [
      'In advanced play, CHOAM may pay some or all of its ally’s force support. At the start of an allied battle, choose the amount of unspent spice to reserve for the phase. CHOAM can update this pledge during ordinary Battle controls. Only a current mutual ally may use it.',
      'A Karama response can prevent allied funding for the current battle. Reserved spice stays with the pledge, but the ally must plan with its own funds. Later battles get a fresh response and may use the remaining pledge.',
      'When sealing a plan, choose total spice support and optionally CHOAM’s share. With no explicit share, your own spice is used first and the pledge covers the shortfall. The chosen amounts remain reserved until resolution; CHOAM cannot withdraw a committed share. Unspent pledged spice returns at the end of Battle, after the closing market.',
      'When other players pay for battle forces, CHOAM receives half of each player’s actual payment, rounded down. Its own force payments and any spice it supplies for its ally go to the bank without generating a rebate. For example, payments of three and five from two other players produce one plus two spice for CHOAM.',
      'Any revealed traitor prevents all CHOAM force-payment income from that battle. A sole traitor winner pays no support, including its pledged allied share. If both sides reveal traitors, both pay their support but CHOAM still gets no income. A lasgun–shield explosion without a traitor still pays support and generates income.',
      'After casualty and winner-card choices, a separate Karama response precedes CHOAM’s income. Cancellation sends the amount to the bank and does not refund the combatants. Complete the response before post-battle technology, capture and Face Dancer rewards continue.',
      'Pledges and unrevealed payment splits stay private to their authorized viewers. Battle guides and all four AI levels account for reserved allied funds when finding legal plans. The precise ordering with later expansion powers, rounding across simultaneous payers, allied-payment interpretation and the alliance cancellation window remain under final audit. CHOAM starts stay disabled pending its remaining powers.',
    ],
    related: [
      'faction-choam',
      'choam-economy',
      'choam-market',
      'battle',
      'card-karama',
      'card-truthtrance',
    ],
  },
  {
    id: 'choam-karama',
    title: 'CHOAM special Karama cash-in',
    category: 'Advanced & expansions',
    coverage: 'Partial',
    summary:
      'Once per game, spend Karama to convert selected other cards into spice.',
    steps: [
      'In the advanced game, use the special Karama controls above your private hand. Choose the activating Karama and one or more other cards. Each selected card earns three spice, including Worthless cards or a second Karama.',
      'The activating Karama is spent separately and earns no spice in this implementation. All selected cards must be distinct and still in your hand. The entire operation succeeds or changes nothing.',
      'Cards fixed in your sealed battle plan or committed to prescience cannot be cashed in. You must also retain enough spice, committed allied funding or another Karama to honor a current winning auction bid.',
      'Cash-in takes effect immediately and preserves a pending phase opening, revival, response, market sale or allied exchange. If it consumes a card already offered for a market sale or trade, that transaction later pays nothing or moves neither card.',
      'The battle preparation guide can find a cash-in that funds a promised plan while retaining required cards. Complete the listed preparation before reviewing and sealing the plan. This can combine with Ghola preparation when both remain possible.',
      'The power is available in all nine playing phases. Finish an active Truthtrance question first. Its precise timing against other simultaneous effects, activation-card payment interpretation and remaining expansion interactions are still under audit; full CHOAM starts remain disabled.',
    ],
    related: [
      'faction-choam',
      'choam-market',
      'card-karama',
      'card-truthtrance',
      'battle',
      'bidding',
    ],
  },
  {
    id: 'choam-market',
    title: 'CHOAM end-of-phase sales and trades',
    category: 'Advanced & expansions',
    coverage: 'Partial',
    summary:
      'Convert surplus cards into spice or arrange a private two-way allied exchange.',
    steps: [
      'At the end of every phase, CHOAM has a closing opportunity for sales and trades. The next phase waits, including automatic auction, revival and collection effects. Choose Finish this phase when done. At the end of Bidding, an empty hand finishes automatically when public card counts also rule out an incoming gift; a short CHOAM notice explains the continuation.',
      'Hand counts may remain secret outside Bidding, so those closing windows are preserved. A nonempty hand keeps its opportunity even without an immediately eligible sale: a card effect may prepare one. An empty hand also waits when another player could give a card. These checks preserve private counts and card identities.',
      'Sell a Worthless card for two spice, or reveal two cards with the exact same printed name and sell one surplus copy for three. You retain the matching copy. Repeat to sell further surplus cards; cards sharing only a role do not qualify.',
      'The sale reveals its card before a Karama response. If allowed, the card is discarded and CHOAM receives the spice. A canceled card stays in hand and cannot be offered for another sale during that closing window. Other eligible cards remain available.',
      'Once per turn, offer one of your cards to your ally. The ally chooses a card to return or declines. CHOAM then confirms or declines the proposed exchange. Confirmation moves both cards together and spends the turn’s trade; a decline moves neither card.',
      'Only the two allies see the proposed cards. A private exchange does not reveal the rest of either hand. Card counts stay unchanged. If an intervening effect makes a sale or exchange impossible, it pays nothing and returns to the closing decision.',
      'Truthtrance can interrupt these decisions. Complete its question before returning to the sale or trade. Existing end-of-phase tech income and unspent allied escrow settle after the market closes.',
      'These actions have focused tests. Batch-sale timing, exact Karama scope, ordering among simultaneous end-phase effects and the remaining Worthless special effects still require a combined-expansion audit; CHOAM starts remain disabled.',
    ],
    related: [
      'faction-choam',
      'choam-economy',
      'bidding',
      'card-karama',
      'card-truthtrance',
    ],
  },
  {
    id: 'choam-inflation',
    title: 'CHOAM Inflation token',
    category: 'Advanced & expansions',
    coverage: 'Partial',
    summary:
      'Double then cancel charity, or cancel then double, across two turns.',
    steps: [
      'During Mentat Pause, CHOAM can place its unused token with either side up. The selected effect begins at next turn’s Charity phase. Mark ready without placing it to save it.',
      'Double multiplies CHOAM’s per-faction income and every eligible charity payout by two. This implementation keeps ordinary eligibility at zero or one spice and doubles the amount received: four from zero, two from one. Advanced Bene Gesserit receives four regardless of wealth.',
      'Cancel prevents all charity, including CHOAM income and advanced Bene Gesserit. No zero-value income response or claim is required.',
      'At the next Mentat Pause, the token flips automatically. At the following Mentat it is removed permanently. Amal’s phase-opening window resolves before those automatic changes.',
      'Karama can prevent initial placement for this Mentat Pause. The token remains available for a later attempt. Karama cannot stop the mandatory flip or removal. Canceling CHOAM income during Double preserves doubled ordinary payouts from the bank.',
      'Bribes are prohibited whenever the active token shows Double, including immediately after placement. Previously promised bribes still settle at Mentat. Spice Production’s payout is unchanged, and CHOAM’s automatic income alone does not trigger it.',
      'Lifecycle, response, payment and AI scenarios have focused tests. The exact ordinary one-spice interpretation and interactions with unfinished expansion modules remain under audit; full CHOAM starts are still disabled.',
    ],
    related: [
      'charity',
      'choam-economy',
      'faction-choam',
      'card-karama',
      'tech-tokens',
    ],
  },
  {
    id: 'choam-auditor',
    title: 'CHOAM Auditor',
    category: 'Advanced & expansions',
    coverage: 'Partial',
    summary:
      'An additional strength-2 leader inspects unused opposing hand cards after battle.',
    steps: [
      'Advanced CHOAM adds the Auditor and its matching traitor identity before setup draws. The five ordinary CHOAM leaders are unchanged. The Auditor can also appear in the remaining Face Dancer pool.',
      'Using the Auditor in a battle grants an optional inspection of two random opposing hand cards if it survives, or one if it dies. Victory is not required. Cards used in that battle are excluded, including a retained weapon, defense, hero or late Portable Snooper.',
      'Choose Audit or Decline after battle cleanup. The table completes battle income, tech claims and Harkonnen capture before this choice, then resolves Face Dancing afterward. Auditor survival is recorded from the battle itself.',
      'Karama cancellation resolves first. If the power remains active, the opponent can pay CHOAM one spice per actually viewable card to cancel the entire inspection. A surviving Auditor with only one eligible card costs one spice to stop. There is no partial payment.',
      'If the opponent cannot afford the full payment, inspection proceeds automatically. An empty eligible hand needs no decision. Sampling happens once after cancellation choices; no card is transferred or discarded.',
      'Only CHOAM receives the inspected faces. Its private snapshot survives refresh and the transition out of Battle, and expires at the next battle or turn. It does not track later changes in the opposing hand and needs no confirmation to continue.',
      'The Auditor cannot be captured, acquired as a foreign ghola by Tleilaxu, or receive a leader skill. CHOAM’s own Ghola card can revive it. Its first ordinary revival can occur before the other leaders die, costs two spice before any discount, and consumes the usual one-leader allowance.',
      'Repeated Auditor revival and the effect of its sixth disc on ordinary CHOAM death cycles await a ruling. Full expansion starts remain disabled until all required powers and interactions are complete.',
    ],
    example:
      'CHOAM loses a battle but its Auditor survives. The opponent keeps a played Shield and has one unplayed Crysknife. Only Crysknife is eligible: the opponent can pay one spice to CHOAM or let CHOAM inspect it.',
    related: [
      'faction-choam',
      'choam-combat',
      'choam-revival',
      'battle',
      'card-karama',
    ],
    checklist: [
      {
        area: 'Implementation',
        status: 'Partial',
        detail:
          'Setup identity, inspection, payment, Karama, capture/foreign-ghola exclusions and first revival are integrated; repeat cycles and full combinations remain open.',
        evidence: [
          'game/choam-auditor.ts',
          'game/engine.ts',
          'game/revival.ts',
        ],
      },
      {
        area: 'Player controls',
        status: 'Implemented',
        detail:
          'Auditor offer, exact cancellation payment and private inspectable card results have dedicated controls.',
        evidence: ['components/choam-auditor.tsx'],
      },
      {
        area: 'AI',
        status: 'Partial',
        detail:
          'All four profiles use public facts and their own hand to handle the decisions; complete faction-game calibration remains open.',
        evidence: ['game/bots.ts'],
      },
      {
        area: 'Documentation',
        status: 'Implemented',
        detail:
          'Internal instructions, source precedence and remaining interpretation boundaries are recorded.',
        evidence: ['docs/CHOAM_AUDITOR.md'],
      },
      {
        area: 'Verification',
        status: 'Partial',
        detail:
          'Identity, uniform sampling and focused engine/lifecycle/recovery scenarios are being verified; full expansion combinations remain uncertified.',
        evidence: ['tests/choam-auditor.test.ts'],
      },
    ],
  },
  {
    id: 'choam-revival',
    title: 'CHOAM force revival',
    category: 'Advanced & expansions',
    coverage: 'Partial',
    summary:
      'Pay one spice per force with no normal quantity limit; Karama cancels both benefits.',
    steps: [
      'CHOAM has no native free revival. Select any number of available forces and pay one spice for each. The table resolves the CHOAM power response before spice or forces move.',
      'Karama restores the three-force total allowance and two-spice price for the rest of this Revival phase. Earlier revivals still count. Tleilaxu permission can raise the allowance to five and has its own response.',
      'A canceled request within the new allowance uses the new price. If it is too large or cannot be paid, no forces or spice move; choose another request. Completed earlier revivals remain intact.',
      'Fremen may grant their allied CHOAM three free revivals. The free allowance is tracked across requests. Tleilaxu may separately offer its ally half price, rounded up on the total payment; canceling that discount retains CHOAM’s native price if it is still active.',
      'Emperor-funded extra revivals keep their separate allowance and price. Advanced Tleilaxu special Karama can prevent the normal request before either pricing response. Revival payments go to Tleilaxu when present, with a separate income response.',
      'Force revival has tested support. Auditor’s first normal return and separate inspection power are described in its topic; repeated death cycles, combined-expansion pricing and the complete faction audit remain unfinished. CHOAM starts stay disabled.',
    ],
    related: [
      'revival',
      'faction-choam',
      'tleilaxu-revival',
      'card-karama',
      'choam-economy',
      'choam-auditor',
    ],
  },
  {
    id: 'choam-economy',
    title: 'CHOAM charity and hand limit',
    category: 'Advanced & expansions',
    coverage: 'Partial',
    summary:
      'CHOAM collects before charity claims and holds up to five treachery cards.',
    steps: [
      'At the start of Charity, resolve CHOAM’s public Karama response. If allowed, CHOAM receives two spice per faction, including itself. In a six-player game this is twelve spice.',
      'Other factions claim normally, with payments taken from CHOAM’s spice. Advanced Bene Gesserit receives two even when wealthy; its cancelable claim resolves before CHOAM pays.',
      'Canceling CHOAM’s income sends all charity payments that turn to the bank. CHOAM can then claim ordinary charity if it has zero or one spice. Cancellation does not affect next turn’s income.',
      'CHOAM may hold five treachery cards and can bid for a fifth. A full five-card hand prevents further purchases, including purchases with Karama.',
      'Inflation now has engine support; see its topic for the two-turn lifecycle. Insolvency after intervening spending still needs a rules ruling; unsupported claims fail without altering balances. CHOAM games remain disabled until the remaining powers and full interaction audit are complete.',
    ],
    related: [
      'charity',
      'bidding',
      'card-karama',
      'faction-choam',
      'choam-revival',
      'choam-inflation',
      'choam-market',
      'choam-karama',
      'choam-combat',
      'choam-worthless',
      'bg-charity-karama',
    ],
  },
  {
    id: 'bg-charity-karama',
    title: 'Bene Gesserit charity and Worthless cards',
    category: 'Advanced & expansions',
    coverage: 'Partial',
    summary:
      'Two charity spice and a cancelable conversion of Worthless cards into Karama.',
    steps: [
      'Advanced Bene Gesserit receives two spice during charity, including the first turn. At one spice this increases the total to three. A claim at two or more spice opens a Karama response; cancellation spends the turn’s claim without paying the bonus.',
      'Every faction can claim charity only once per turn. Spending or giving away the proceeds does not allow a second claim.',
      'A Worthless card can pay for a supported Karama use: cancel a faction power, grant a shipment benefit, take an auction card or pay a winning bid. Choose the particular card to spend. The card is discarded immediately; the effect waits for the conversion response.',
      'If a Worthless cancellation is itself canceled, the original faction response resumes with its prior confirmations intact. Private details of that suspended response remain private. A real Karama resolves directly.',
      'Holding a Worthless card permits an overbid without spending it when outbid. A full hand still prevents direct acquisition. Sealed battle cards and cards committed to prescience cannot also be spent as Karama.',
      'While an auction conversion waits, its incoming card reserves one hand slot. A gift may still be accepted if room remains for that card and any cards due back from a hand exchange. Supported Box, gift, Truthtrance and hand-exchange interruptions restore the original conversion without repeating its cancellation, purchase or shipment benefit. A separately summoned worm can add its own ride before the original response resumes.',
      'An unsupported cancellation must be rejected before beginning the conversion. Canceling Richese’s normal auction count remains unavailable pending its ruling; canceling an older saved Worthless attempt at that power instead restores the original Richese response.',
      'An unfunded winning bid after a canceled conversion currently restarts bidding for the same card as provisional recovery. This exact auction edge case still requires primary-source confirmation before advanced play is enabled.',
    ],
    related: ['charity', 'card-karama', 'bidding', 'faction-beneGesserit'],
    checklist: [
      {
        area: 'Implementation',
        status: 'Partial',
        detail:
          'New cancellations, shipments and normal-auction conversions preserve their original source. Incoming-card capacity includes pending exchanges and purchases. Richese settlement, Moritani cleanup, resumed movement, revealed battle resolution, ordered battle aftermath, aid refunds and collection, combat preparation, terminal income and knowledge, denied No-Fields and CHOAM sales, restored Richese gifts and purchase-income controls, canceled Moritani alliance offers and Ixian substitution, Ixian auction draws and technology, paid-auction income, bonuses and next lots, CHOAM Worthless restoration and unchanged revival requests, canceled Ecaz and Moritani placement and Duke acquisition with shared movement setup, phase income, refunds and victory, canceled movement, owner promises, revival repricing and storm or worm casualties have shared checks before supported cancellation costs. Exhaustive cancellation and pre-effect discard recovery remain unfinished.',
      },
      {
        area: 'Player controls',
        status: 'Partial',
        detail:
          'Existing selected-card, cancellation and payment controls resume after supported private interruptions. Invalid gifts and mismatched saved opportunities reject before changing the table.',
      },
      {
        area: 'AI',
        status: 'Partial',
        detail:
          'Every seat uses the same authoritative cost and capacity checks. Complete Advanced and expansion games at every difficulty remain unverified.',
      },
      {
        area: 'Documentation',
        status: 'Partial',
        detail:
          'This guide explains saved purchases, combined incoming capacity, nested cancellation and the remaining provisional payment rule.',
      },
      {
        area: 'Verification',
        status: 'Partial',
        detail:
          'Focused scenarios cover gifts, Box searches, hand exchanges, summoned worms, unchanged cancellation sources, battle cleanup, resumed movement, final allied traitor calls, revival prices, typed storm or worm losses, capture and technology cleanup, collection boundaries, promise feasibility, malformed saves and concurrent persisted allowance. These do not certify every cancellation suffix or full expansion play.',
        evidence: [
          'tests/karama-preflight.test.ts',
          'tests/richese-settlement-preflight.test.ts',
          'tests/bg-karama-opportunity.test.ts',
          'tests/bg-karama-nested-controls.test.ts',
          'tests/bg-karama-opportunity-recovery.test.ts',
          'tests/bg-karama-cancel-context.test.ts',
          'tests/karama-battle-preflight.test.ts',
          'tests/karama-movement-preflight.test.ts',
          'tests/battle-resolution-quote.test.ts',
          'tests/battle-aftermath-quote.test.ts',
          'tests/battle-aftermath-recovery.test.ts',
          'tests/board-resolution-quote.test.ts',
          'tests/karama-movement-cancellation.test.ts',
          'tests/karama-promise-preflight.test.ts',
          'tests/combat-response-quote.test.ts',
          'tests/combat-terminal-recovery.test.ts',
          'tests/terminal-cancellation.test.ts',
          'tests/karama-no-field-cancellation.test.ts',
          'tests/ix-substitution-cancellation.test.ts',
          'tests/richese-cancellation.test.ts',
          'tests/moritani-alliance-cancellation.test.ts',
          'tests/restored-cancellation-recovery.test.ts',
          'tests/ix-auction-draw-quote.test.ts',
          'tests/ix-technology-cancellation.test.ts',
          'tests/auction-continuation-quote.test.ts',
          'tests/auction-unsold-custody.test.ts',
          'tests/choam-storm-quote.test.ts',
          'tests/choam-worthless-cancellation.test.ts',
          'tests/revival-resume.test.ts',
          'tests/placement-cancellation.test.ts',
          'tests/phase-resource-quote.test.ts',
          'tests/movement-phase-quote.test.ts',
          'tests/victory-quote.test.ts',
          'tests/placement-cancellation-recovery.test.ts',
          'tests/choam-worthless-cancellation-recovery.test.ts',
          'tests/auction-cancellation-recovery.test.ts',
          'tests/choam-sale-cancellation.test.ts',
          'tests/revival-cancellation.test.ts',
          'tests/storm-worm-cancellation.test.ts',
          'tests/disaster-revival-recovery.test.ts',
        ],
      },
    ],
  },
  {
    id: 'advanced-advisors',
    title: 'Bene Gesserit advisors',
    category: 'Advanced & expansions',
    coverage: 'Partial',
    summary:
      'Peaceful occupation, matching token types, intrusion and preparing for battle.',
    steps: [
      'Bene Gesserit forces share one token type throughout a territory. The map marks advisors with a dashed outer ring and labels their stance in the territory details.',
      'Advisors do not fight, contest stronghold victory, block another faction’s entry, collect spice, earn stronghold income, grant ornithopters or enable Family Atomics. Storms, worms, explosions and Atomics still destroy them.',
      'After Fremen setup, choose the starting advisor’s territory and sector. Advisors become fighters automatically whenever no other faction remains in their territory.',
      'A normal shipment enters as fighters unless joining existing advisors. Moving or shipping into your existing group must match its type. Advisors moved into an occupied territory without another Bene Gesserit group may remain peaceful or request a flip to fighters.',
      'When another faction ships, moves or worm rides into your fighters, immediately choose whether to become advisors. The choice opens a Karama response. Repeated entry can offer a new choice.',
      'After another faction’s off-planet shipment, choose a free force in the Polar Sink or an accompanying force at the shipment destination. An accompanying advisor group cannot flip to fighters in that turn while other factions remain.',
      'Before the first shipment, choose eligible advisor territories to prepare for battle. Each chosen flip has a Karama response. Advisors cannot prepare against an ally or where storm prevents the battle.',
      'The engine and these choices have focused tests. The full advisor timing audit, forced-flip cancellation and expansion interactions remain unfinished; advanced table starts are disabled.',
    ],
    related: ['faction-beneGesserit', 'movement', 'battle', 'victory'],
  },
  {
    id: 'homeworlds',
    title: 'Homeworlds: population and occupation',
    category: 'Advanced & expansions',
    coverage: 'Partial',
    summary:
      'Inspect all thirteen Homeworld cards, their population faces and occupied effects. Gameplay integration is in development.',
    searchText: HOMEWORLD_CARDS.map((card) =>
      [
        card.name,
        ...card.high.gameplay,
        ...card.low.gameplay,
        ...card.occupied.gameplay,
      ].join(' '),
    ).join(' '),
    steps: [
      'Homeworlds are an optional module from Ecaz & Moritani, available under the official rules with Basic or Advanced play. They are separate locations outside Arrakis; they do not receive ordinary storm movement or count as ordinary strongholds.',
      'Each faction uses its own card and matching world token. In Basic play the Emperor uses Kaitain alone. Advanced play adds Salusa Secundus for its Sardaukar; movement can transfer both force types between the two Emperor worlds.',
      'Native reserves determine high or low population. Salusa counts Sardaukar, while the other cards count the faction’s reserves there. Reaching the high face’s minimum restores high population. Occupation also applies the low penalty.',
      'Low population normally grants one additional free force revival and one additional bank spice when collecting CHOAM Charity. Salusa grants neither bonus; CHOAM’s Tupile reverses the usual pattern by granting an advantage while low and a penalty while high.',
      'A qualifying charity claim separates its ordinary payer from the extra bank spice. Inflation doubles both portions or prevents the whole collection. Canceling Bene Gesserit charity prevents both portions of that claim.',
      'Quote a group of normal revivals using population before that group returns. A later group uses the resulting population: a low Fremen group can return four free forces, but returning a smaller group that restores high population can remove the fourth allowance. La La La prevents the full free rate.',
      'When Southern Hemisphere begins a supported revival at high population, Fremen may place the newly revived starred forces together in one territory already containing their forces, or leave them in reserves. This includes supported ordinary, Emperor-funded and Ghola revivals. Basic keeps the starred counters; Advanced still limits Fedaykin revival to one per turn.',
      'When Tleilax begins ordinary Free Revival at high population, Tleilaxu may send the newly revived free group together to one permitted territory or Homeworld, or leave it in reserves. Paid counters in the same return and Ghola returns do not join this group. An allied Homeworld is forbidden. Placement costs no additional spice and uses no ordinary shipment or movement allowance.',
      'The revival placement choice shows unavailable destinations. A return that first restores high population, partial groups, split destinations, Southern storm placement and entry effects requiring a shipment classification remain guarded while their rules are unresolved. Independent revival income waits until placement and supported Ambassador reactions finish; refreshing does not repeat the return or payment.',
      'While Tupile has at least eleven native forces, CHOAM cannot discard Worthless cards for spice through either ordinary sale price or a CHOAM Ambassador. Non-Worthless duplicate sales, allied trades and the Advanced CHOAM Karama cash-in retain their own rules. If a Ghola revival raises Tupile before a declared sale settles, that Worthless card stays in hand and earns no spice.',
      'At the end of Bidding, high-population Kaitain lets Emperor pay two spice per selected Treachery Card to discard it. This does not play the card or begin another auction. Emperor and CHOAM share the closing opportunity, so sales, allied trades and paid discards can occur in either order. Current hands, spice and native population determine each action. Finish when ready; a new action clears readiness.',
      'In supported payment cases, low Kaitain halves Emperor’s Treachery payment income and low Junction halves eligible Guild shipping income, rounded up. The payer still pays the full cost. For example, a five-spice auction payment gives low-population Emperor three spice and leaves two in the bank. The income opportunity shows the original payment, current receipt and bank remainder. A population change before collection updates the split; ordinary Karama can still prevent the separate faction income.',
      'Guild’s own shipment contribution goes to the bank before any low-Junction reduction. Splits with two odd contributions from other factions remain unavailable while their rounding rule is unresolved; choose another funding split. Single-contributor payments and splits where both rounding interpretations agree remain supported. Occupier income is still unfinished.',
      'With at least seven native forces on Giedi Prime, Harkonnen automatically gains two bank spice after collecting positive desert spice during Spice Collection, once for the whole phase. Several deposits still earn only two. Shared Ecaz spice qualifies when Harkonnen actually receives a positive allocation; a zero share, stronghold income or technology income does not qualify. Refreshing preserves the completed bonus.',
      'With fewer than eight native forces on Grumman, Moritani can reveal Terror only when at least three forces enter together. Count each incoming physical counter once, including advisors, and a concealed No-Field as one regardless of its hidden value. Forces already at the destination do not count. High Grumman’s separate Collection choice can add a token to an existing stronghold stack and collect four bank spice; removal still requires a custody ruling.',
      'While Ecaz has at least seven native reserves, it automatically receives three bank spice for each discarded poison weapon, including its own. Poison Blade and Poison Tooth qualify; Chemistry qualifies only when used as a weapon. Poison defenses and Residual Poison do not qualify. Ecaz sees its income in a private Homeworld record; private discarded faces stay private.',
      'Battle cleanup checks population when each card is actually discarded. Losing-card disposal comes before winner casualties. Mandatory winning cards, including a used Poison Tooth, are discarded after winner casualties and any Ixian substitution, before optional winning-card cleanup. If Ecaz falls below seven during its winning losses, its later card discards earn no poison income.',
      'If Tleilax starts Revival at low population, it receives no bank income for other factions’ ordinary free revivals throughout that phase, even if its population rises. Paid revival receipts and the separately named Ghola reward remain available.',
      'Low Caladan prevents the phase-opening Spice Blow peek. Low Wallach IX prevents free Spiritual Advisors, while high Wallach IX allows one or two to Polar Sink after another faction’s qualifying shipment. Accompanying elsewhere still uses one. Low Ix prevents moving the mobile stronghold; low Richese prevents moving a No-Field token. Physical-force movement and ordinary paid shipments retain their separate rules.',
      'After a supported Atreides victory, Caladan with at least six native reserves may add one reserve force to the battle location if an Atreides force survives there. The owned choice follows ordinary battle cleanup and offers an eligible sector or the original foreign Homeworld. This spends no spice or shipment allowance. Leaving the force in reserves is optional; a battle on Caladan itself cannot create an extra counter from reserves already there.',
      'Caladan reinforcement keeps the original battle identity through refresh and supported Ambassador reactions, so the same victory cannot add a second force. Placement involving Face Dancer ordering, storm, the mobile stronghold or unresolved entry reactions remains guarded. These guards do not certify those combined rules.',
      'At low population, Tupile lets CHOAM learn an opposing faction’s current spice and either its weapon count or defense count, once per faction for the entire game. CHOAM must have forces on that faction’s Homeworld, or that faction must have forces on Tupile. Either Emperor Homeworld supplies the same single entitlement. The answer is recorded privately as a historical observation and does not update when that faction’s hand or spice changes.',
      'Choose weapons or defenses in the private Tupile panel at a settled action boundary. The server answers immediately without an opponent confirmation, and does not expose individual cards. Count physical held Treachery cards by their default category: Weirding Way is a weapon, Chemistry is a defense, while Worthless cards and leader substitutes count as neither. Selecting the other category later cannot renew a faction’s used entitlement.',
      'Occupation removes Tupile’s low advantage. New Homeworld games record qualifying foreign presence from setup, including brief sole occupation during ordered battle losses and presence at turn boundaries. Earlier saves without that history, or histories with a Tupile qualifier whose continuing entitlement is unresolved, cannot make a new intelligence request. Already learned observations remain readable. Recorded qualification does not itself award occupied income or settle its expiry.',
      'During Spice Collection, Grumman with at least eight native reserves may add one available Terror token to an ordinary stronghold that already has Terror, then collect four bank spice. This opportunity is separate from Mentat placement and follows any pending shared spice allocation. Declining collects nothing. Removing a token remains unavailable while its destination after removal awaits a ruling.',
      'When several Terror tokens share a stronghold, Moritani privately selects one for an eligible entry, then chooses whether to reveal it or offer an alliance. The other tokens remain hidden. The board shows the public stack count; refresh preserves the selected token and original arrival.',
      'While Junction has high population, Guild may offer another faction transport at half or full price during that faction’s shipment. The recipient can choose exact forces from one territory or Homeworld, including a return to their own world. An allied Homeworld remains forbidden. Half-price totals round up; five forces to a Homeworld cost three spice. The Junction route and offered rate resist Karama.',
      'Homeworld shipment, battle and occupation have special rules. Occupiers receive the printed Collection income and card effects. An alliance can gain a special Homeworld victory through high-population Ecaz; this is separate from ordinary stronghold victory.',
      'The card collection below is available for reference. Starting a Homeworld game remains disabled while shipment, battles, occupation, economy and faction interactions are being completed.',
    ],
    example:
      'Atreides with six reserves on Caladan uses the high face. Dropping to five uses the low face and removes the next-Spice-Blow inspection advantage. Either face adds two to native battle strength on Caladan.',
    related: [
      'ecaz-modules',
      'setup',
      'revival',
      'movement',
      'battle',
      'victory',
    ],
    checklist: [
      {
        area: 'Implementation',
        status: 'Partial',
        detail:
          'All 13 cards, saved typed custody, supported-deck setup, Emperor movement, native Arrakis shipment sources, revival destinations, low charity/free-revival benefits, Tleilax’s phase-start income penalty and high-Salusa free Sardaukar support are connected. World-to-world invasion, Guild transport from Arrakis and Guild native returns use exact source pools, funding and interception. Homeworld battles connect native bonuses, limited explosion casualties, native-only Traitors and Face Dancers, and Ixian substitution. Junction offers connect sponsored board and Homeworld routes, including own returns, foreign departures and their distinct payments. Caladan foresight, Wallach advisor counts, Ix stronghold movement and Richese token movement now respect native population. High Tupile blocks Worthless sales and Ambassador payouts, including after an interrupted Ghola revival. Kaitain paid discards share the closing Bidding opportunity with CHOAM; Ecaz poison income uses actual physical disposal and current native population. Mandatory winning-card disposal follows winner casualties. Supported low Kaitain and Junction payment receipts preserve the payer’s cost and use current native population; divergent allied rounding remains guarded. Giedi grants its once-per-phase bonus on actual positive desert receipts, including settled Ecaz shares. Low Grumman uses original public entry counts across Terror and competing-reaction checks. Southern and Tleilax preserve the exact eligible revival group through one optional placement, with held income and explicit unresolved destination rules. Concealed transport, occupation and remaining card effects are unfinished; game starts stay disabled.',
        evidence: [
          'game/homeworld-cards.ts',
          'game/homeworld-game.ts',
          'game/homeworld-native-reserves.ts',
          'game/homeworld-revival-deployment.ts',
          'game/homeworld-revival-destinations.ts',
          'game/homeworld-revival-return.ts',
          'game/homeworld-victory-reinforcement.ts',
          'game/homeworld-victory-return.ts',
          'game/grumman-collection.ts',
          'game/grumman-collection-return.ts',
          'game/grumman-collection-options.ts',
          'game/terror-entry-receipt.ts',
          'components/grumman-collection.tsx',
          'components/terror-board-markers.tsx',
          'game/homeworld-arrival.ts',
          'game/tupile-intelligence.ts',
          'game/homeworld-shipment.ts',
          'game/guild-homeworld-shipment.ts',
          'game/junction-transport.ts',
          'game/junction-offer.ts',
          'game/homeworld-alliance.ts',
          'game/homeworld-benefits.ts',
          'game/homeworld-mobility.ts',
          'game/homeworld-card-economy.ts',
          'game/homeworld-payment-income.ts',
          'game/homeworld-collection.ts',
          'game/homeworld-occupation-history.ts',
          'game/tupile-intelligence.ts',
          'game/tupile-intelligence-answer.ts',
          'game/tupile-intelligence-state.ts',
          'components/tupile-intelligence.tsx',
          'game/giedi-collection.ts',
          'game/terror-entry-receipt.ts',
          'game/bidding-end.ts',
          'game/ecaz-poison-income.ts',
          'game/choam-market-ghola.ts',
          'game/charity.ts',
        ],
      },
      {
        area: 'Player controls',
        status: 'Partial',
        detail:
          'Card inspection is available in the reference. Development tables display native reserves, explicit Imperial shipment sources, world-to-world shipment and Guild transport from Arrakis with costs and pledged funding, Guild interception, optional Junction half/full offers and typed sponsored transport, transfers between Kaitain and Salusa, charity payment sources, current revival allowances, population-based movement restrictions and one/two-advisor choices, native battle bonuses, Homeworld casualties, replacement controls, Tupile sale explanations, shared end-of-Bidding actions, Ecaz’s private poison-income record, current low-population payment splits, automatic Giedi collection history, count-dependent Ambassador destinations and the optional revived-group placement; starting this module remains unavailable.',
        evidence: [
          'components/homeworld-cards.tsx',
          'components/homeworld-table.tsx',
          'components/homeworld-revival-deployment.tsx',
          'components/caladan-reinforcement.tsx',
          'components/homeworld-shipment.tsx',
          'components/guild-homeworld-shipment.tsx',
          'components/junction-transport.tsx',
          'components/bidding-end.tsx',
          'components/ecaz-poison-income.tsx',
        ],
      },
      {
        area: 'AI',
        status: 'Partial',
        detail:
          'Shared public choices supply native shipment counters, Imperial transfers and current low revival allowances. All four profiles use Salusa’s per-type support legality and respect unresolved special-Karama and mid-battle Ghola timing boundaries. All four profiles handle world-to-world shipment, Guild transport from Arrakis, native returns and interception, Homeworld battle choices, typed losses, late defense and supported replacement actions. All four profiles can offer and use Junction transport through public quotes, respect population-based movement restrictions and choose legal Spiritual Advisor quantities. Market choices exclude high-Tupile Worthless sales. All four profiles use eligible unused low-Tupile requests without reading opponents’ private hands or balances. All four profiles use the shared closing opportunity for CHOAM actions, affordable Kaitain discards and readiness. Ecaz income needs no separate claim. Concealed transport, occupation and remaining card-effect strategies are unfinished.',
        evidence: ['game/homeworld-options.ts', 'game/homeworld-shipment-options.ts', 'game/guild-homeworld-shipment-options.ts', 'game/junction-transport-options.ts'],
      },
      {
        area: 'Documentation',
        status: 'Partial',
        detail:
          'All 26 faces, global rules and source discrepancies are documented. Imperial shipment and movement controls explain sources, costs and unavailable actions. Card-economy notes explain shared closing actions, private poison income, winner-discard ordering and low-population payment splits. Divergent allied rounding and occupation entitlement remain unresolved; full interaction guidance remains in progress.',
        evidence: [
          'docs/HOMEWORLD_COMPONENT_AUDIT.md',
          'docs/HOMEWORLD_RULES.md',
          'docs/HOMEWORLD_RUNTIME_IMPLEMENTATION.md',
          'docs/HOMEWORLD_BENEFITS_RULES.md',
          'docs/HOMEWORLD_REVIVAL_DEPLOYMENT_RULES.md',
          'docs/HOMEWORLD_REVIVAL_DEPLOYMENT_INTEGRATION.md',
          'docs/HOMEWORLD_REVIVAL_DEPLOYMENT_RUNTIME.md',
          'docs/HOMEWORLD_COMBAT_IMPLEMENTATION.md',
          'docs/HOMEWORLD_BATTLE_RUNTIME.md',
          'docs/HOMEWORLD_SHIPMENT_RUNTIME.md',
          'docs/GUILD_HOMEWORLD_TRANSPORT_RUNTIME.md',
          'docs/JUNCTION_TRANSPORT_RULES.md',
          'docs/JUNCTION_TRANSPORT_RUNTIME.md',
          'docs/HOMEWORLD_MOBILITY_RULES.md',
          'docs/HOMEWORLD_MOBILITY_RUNTIME.md',
          'docs/HOMEWORLD_CARD_ECONOMY_RULES.md',
          'docs/HOMEWORLD_CARD_ECONOMY_RUNTIME.md',
          'docs/HOMEWORLD_PAYMENT_INCOME_RULES.md',
          'docs/HOMEWORLD_PAYMENT_INCOME_RUNTIME.md',
          'docs/HOMEWORLD_COLLECTION_RULES.md',
          'docs/HOMEWORLD_COLLECTION_INTEGRATION.md',
          'docs/HOMEWORLD_COLLECTION_RUNTIME.md',
          'docs/ECAZ_POISON_INCOME_RULES.md',
        ],
      },
      {
        area: 'Verification',
        status: 'Partial',
        detail:
          'Tests cover genuine setup with implemented decks, Basic special-counter identity, actual transfer/shipment/revival, saved-state rejection and competing database submissions. Complete Homeworld games and module combinations are not yet verified.',
        evidence: [
          'tests/homeworld-custody.test.ts',
          'tests/homeworld-cards.test.ts',
          'tests/homeworld-payment-income.test.ts',
          'tests/homeworld-payment-income-engine.test.ts',
          'tests/homeworld-payment-income-recovery.test.ts',
          'tests/homeworld-collection.test.ts',
          'tests/homeworld-collection-engine.test.ts',
          'tests/homeworld-collection-recovery.test.ts',
          'tests/homeworld-grumman-engine.test.ts',
          'tests/homeworld-grumman-recovery.test.ts',
          'tests/homeworld-setup-engine.test.ts',
          'tests/homeworld-actions-engine.test.ts',
          'tests/homeworld-basic-counters.test.ts',
          'tests/homeworld-salusa-engine.test.ts',
          'tests/homeworld-combat.test.ts',
          'tests/homeworld-battle-resolution.test.ts',
          'tests/homeworld-battle-engine.test.ts',
          'tests/homeworld-battle-recovery.test.ts',
          'tests/homeworld-shipment-engine.test.ts',
          'tests/homeworld-shipment-recovery.test.ts',
          'tests/homeworld-shipment-controls.test.ts',
          'tests/homeworld-shipment-review.test.ts',
          'tests/guild-homeworld-shipment-engine.test.ts',
          'tests/guild-homeworld-shipment-recovery.test.ts',
          'tests/guild-homeworld-shipment-controls.test.ts',
          'tests/junction-transport.test.ts',
          'tests/junction-transport-engine.test.ts',
          'tests/junction-transport-recovery.test.ts',
          'tests/junction-transport-controls.test.ts',
          'tests/junction-transport-review.test.ts',
          'tests/homeworld-card-economy.test.ts',
          'tests/homeworld-tupile-sales-engine.test.ts',
          'tests/homeworld-tupile-sales-recovery.test.ts',
          'tests/bidding-end-engine.test.ts',
          'tests/bidding-end-controls.test.ts',
          'tests/bidding-end-recovery.test.ts',
          'tests/ecaz-poison-income.test.ts',
          'tests/ecaz-poison-income-engine.test.ts',
          'tests/homeworld-mobility.test.ts',
          'tests/homeworld-mobility-engine.test.ts',
          'tests/homeworld-mobility-recovery.test.ts',
          'tests/homeworld-spiritual-advisors.test.ts',
          'tests/homeworld-spiritual-advisors-recovery.test.ts',
          'tests/homeworld-advisor-ambassador.test.ts',
          'tests/homeworld-replacement-engine.test.ts',
          'tests/homeworld-recovery.test.ts',
          'tests/homeworld-charity-engine.test.ts',
          'tests/homeworld-revival-benefits-engine.test.ts',
          'tests/homeworld-revival-deployment.test.ts',
          'tests/homeworld-revival-return.test.ts',
          'tests/homeworld-revival-destinations.test.ts',
          'tests/homeworld-revival-deployment-engine.test.ts',
          'tests/homeworld-revival-deployment-controls.test.ts',
          'tests/homeworld-revival-deployment-recovery.test.ts',
          'tests/homeworld-victory-reinforcement.test.ts',
          'tests/caladan-reinforcement-controls.test.ts',
          'tests/homeworld-victory-reinforcement-recovery.test.ts',
          'tests/tupile-intelligence.test.ts',
          'tests/tupile-intelligence-answer.test.ts',
          'tests/tupile-intelligence-state.test.ts',
          'tests/tupile-intelligence-controls.test.ts',
          'tests/tupile-intelligence-engine.test.ts',
          'tests/tupile-intelligence-recovery.test.ts',
          'tests/homeworld-occupation-history.test.ts',
          'tests/grumman-collection.test.ts',
          'tests/grumman-collection-engine.test.ts',
          'tests/grumman-collection-controls.test.ts',
          'tests/grumman-collection-recovery.test.ts',
          'tests/grumman-selection-integrity.test.ts',
          'tests/homeworld-benefits-recovery.test.ts',
        ],
      },
    ],
  },
  {
    id: 'nexus-cards',
    title: 'Nexus Cards',
    searchText: NEXUS_CARD_REFERENCE.map(card => `${card.faction} ${card.betrayal} ${card.cunning} ${card.secretAlly}`).join(' '),
    category: 'Advanced & expansions',
    coverage: 'Partial',
    summary: 'A separate twelve-card deck rewards remaining unallied. Private draws and Atreides inspection controls are integrated. Other effects and complete module play remain in development.',
    steps: [
      'This optional module can be combined with Basic or Advanced rules independently of the factions and other expansion modules selected. Include one Nexus Card for each of the twelve factions.',
      'At the end of the entire Spice Blow and Nexus phase, if a Nexus occurred and at least one alliance exists, each unallied player may draw one card or discard their held card and draw a replacement. You may decline. The two Advanced spice piles do not grant two closing draws.',
      'Keep your card secret until it is used. You may hold at most one Nexus Card. It is separate from your Treachery hand and does not occupy a Treachery hand slot.',
      'Whenever you draw your own faction card, you may immediately discard it and draw again, in either Basic or Advanced play. A replacement is discarded before the new draw; when the deck is empty, shuffle its discard pile to refill it.',
      'Before drawing, choose whether to keep your own faction card, redraw it once, or redraw whenever it appears. Its effect is available in the reference before making this choice. The server applies that preference immediately; the table never pauses in a way that identifies a card you chose to keep.',
      'Entering any alliance discards your held Nexus Card, including alliances made through an Ambassador or Terror token. An offer that has not been accepted does not discard it.',
      'Use Cunning for your own faction, Betrayal when another player controls the printed faction, and Secret Ally when that faction is absent. Used cards go to the separate Nexus discard pile. Each printed effect has its own timing.',
      'Atreides Cunning adds a second, different opposing plan element after the first native answer. Both remain binding. Use it in your own battle before sealing your plan; Karama may cancel the extra attempt while preserving the first disclosure.',
      'With Atreides absent, Secret Ally inspects one opposing element in your battle. A sealed plan supplies only that selected answer automatically. Otherwise the opponent chooses an answer that permits a legal plan. Other players receive no private answer.',
      'The No-Field restriction names Atreides, so Cunning cannot inspect that dial. A non-Atreides Secret Ally holder may request it without learning the token denomination or other plan elements.',
      'Residual Poison cannot follow a committed leader. If it makes a single nonleader inspection impossible, the same field is answered again and the earlier observation remains private history. Residual Poison after two completed Cunning inspections awaits a ruling on incompatible surviving commitments.',
      'Betrayal reactions await a private response timing decision. Other factions’ Nexus effects and complete module games are unfinished, so public module starts remain disabled.',
    ],
    related: ['ecaz-modules', 'spice-blow', 'alliance-funding'],
    checklist: [
      { area: 'Implementation', status: 'Partial', detail: 'Physical lifecycle plus Atreides Cunning and Secret Ally inspections, distinct commitments and cancellation. Betrayal and remaining card families are unfinished.', evidence: ['game/nexus-cards.ts', 'game/nexus-card-phase.ts', 'game/engine.ts'] },
      { area: 'Player controls', status: 'Partial', detail: 'Private card lifecycle, Atreides element selection, owned answers, private history and all four plan locks. Remaining effect controls are unfinished.', evidence: ['components/nexus-cards.tsx'] },
      { area: 'AI', status: 'Partial', detail: 'All profiles handle lifecycle, offered Atreides inspections and both binding answers using only authorized views. Complete module strategy and calibration remain unfinished.', evidence: ['game/nexus-card-options.ts'] },
      { area: 'Documentation', status: 'Partial', detail: 'Common rules, twelve printed faces and Atreides inspection interactions are recorded with explicit unresolved boundaries.', evidence: ['docs/NEXUS_CARD_RULES.md', 'docs/NEXUS_ATREIDES_RULES.md'] },
      { area: 'Verification', status: 'Partial', detail: 'Custody, phase, inspection, controls, bot and concurrent recovery regressions; complete module games remain a release requirement.', evidence: ['tests/nexus-cards.test.ts', 'tests/nexus-card-engine.test.ts'] },
    ],
  },
  ...[
    [
      'ix-modules',
      'Ixians & Tleilaxu modules',
      'Additional treachery cards, tech tokens, sandtrout and faction rules.',
    ],
    [
      'choam-modules',
      'CHOAM & Richese modules',
      'Richese auctions, inflation, leader skills and stronghold cards.',
    ],
    [
      'ecaz-modules',
      'Ecaz & Moritani modules',
      'Ambassadors, terror, homeworlds, Nexus cards and discoveries.',
    ],
  ].map(
    ([id, title, summary]): RuleTopic => ({
      id,
      title,
      summary,
      category: 'Advanced & expansions',
      coverage: 'Partial',
      steps: [
        ...(id === 'choam-modules'
          ? [
              'Richese cache and Black Market auction controls are integrated in development fixtures, alongside the ten-card reference collection. Remaining card-effect integration is incomplete and full expansion starts remain disabled; source guards and pending verification are listed in the collection’s five-part checklist.',
            ]
          : []),
        ...(id === 'ix-modules'
          ? [
              'Tech tokens can be enabled for tables of three or more base factions. See the tech-token topic for ownership, deferred income and battle transfers.',
            ]
          : []),
        ...(id === 'ecaz-modules'
          ? [
              'Ecaz inventory, public Ambassador inspection, end-of-Revival placement, six entry effects with Bene Gesserit copies and direct Ecaz Duke acquisition have focused support. Storm/explosion token returns are supported. Other effects and competing arrival ordering remain unfinished. See the linked feature checklist; full expansion starts remain disabled.',
            ]
          : []),
        'The expansion catalog is present. Expansion faction mechanics, remaining modules and their full interaction reference remain in development.',
      ],
      related: [
        'setup',
        'advanced-combat',
        ...(id === 'ix-modules' ? ['tech-tokens'] : []),
        ...(id === 'choam-modules' ? ['stronghold-cards'] : []),
        ...(id === 'choam-modules' ? ['richese-cards'] : []),
        ...(id === 'ecaz-modules'
          ? [
              'faction-moritani',
              'moritani-terror',
              'ecaz-ambassadors',
              'homeworlds',
              'implementation-checklist',
            ]
          : []),
      ],
    }),
  ),
];
