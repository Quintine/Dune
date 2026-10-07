import { STRONGHOLD_CARDS } from './stronghold-cards';
import { FACTION_RULES } from './faction-reference';
import { FACTIONS, PHASES } from './catalog';
import { RICHESE_CARD_DEFINITIONS } from './richese-cards';
import { HOMEWORLD_CARDS } from './homeworld-cards';
import { NEXUS_CARD_REFERENCE } from './nexus-card-reference';
import { LEADER_SKILL_CARDS } from './leader-skill-cards';
import { KWISATZ_RULES } from './kwisatz-display';

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
  /** Development progress is separate from the scope of verified rules coverage. */
  developmentStage?: 'Missing' | 'Prototyped' | 'Integrated' | 'Verified' | 'Polished';
  summary: string;
  searchText?: string;
  steps: string[];
  example?: string;
  related?: string[];
  checklist?: RuleChecklistItem[];
};

export const PHASE_HELP = [
  'Complete the table’s storm dials or card reveal. After the distance is revealed, play any storm cards and confirm movement.',
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
    'Kulon adds one territory of movement range on CHOAM’s turn. La La La prevents free force revival. Baliset blocks movement into a CHOAM-occupied territory, not shipment. Trip to Gamont returns another player’s force during Mentat. Jubba Cloak protects one territory from a moving storm. In the opt-in Kull preview, Kull Wahad intercepts a Karama attempt; only successful settlement activates the phase ban. A distinct counter may prevent it. Canceled Worthless costs remain held.',
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
    'Every new Advanced turn after the first reveals a random Storm Deck card, one through six, even without Fremen. First-turn dials are unchanged. Native Fremen keeps its private forecast; without Fremen nobody receives one. An already recorded saved Storm finishes its existing dial or card protocol without a reroll.',
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
    'In the fresh local ixian-betrayal preview, native Ixian Bidding inspection and Advanced Technology first finish their original Karama responses, then pause for neutral Nexus acknowledgements before their effects. A legal rival Use prevents only the current attempt; all required passes allow it. See Ixian Nexus Betrayal for both alternatives, private-card limits and the unchanged public release gate.',
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
    'A classic Guild or reciprocal ally’s discounted ordinary reserve shipment or eligible cross-planet transport waits for a Karama response before paying. Guild’s own return to reserves waits too. Canceling the rate uses normal destination pricing for the same physical forces and approved payment split; a return costs one spice per force. If the split or exact group cannot complete, the declaration returns unused and a replacement this turn uses full price. Full-price return and unaffordable withdrawal are documented table interpretations, not separate publisher examples. Guild income, purchased Karama rates, transport permission and optional modules remain distinct.',
    'For movement, select the source forces. Enable Combine sectors to include several groups from the same territory.',
    'A Fremen move using the two-territory advantage has a Karama response. Cancellation leaves the forces in place and limits this move to one territory; city ornithopters and a later extra move keep their normal rules.',
    'Guild transport can move one exact physical group across the planet or return it to reserves. In classic games its normal half-price rate can be canceled separately from its transport permission. Ordinary movement is checked against range, storm and stronghold occupancy.',
    'You may pass through an ally’s territory on a legal route that ends elsewhere. Basic ordinary physical reserve shipments may also enter allied territory before movement, provided the visiting group departs during that turn. Storm and stronghold capacity remain binding. The table visibly labels its provisional no-exit policy: excess new visitors still present when the turn ends go to Tanks, without destroying the ally or granting an extra move. Concealed No-Fields, optional arrivals and Advanced entry remain separate.',
    'Ecaz and its reciprocal ally may share territories permanently and count as one faction toward stronghold capacity. This applies to normal shipment, ground routes and Ambassador arrivals. It does not grant extra movement, bypass storm or mobile-stronghold entry rules, or apply to homeworlds. Their three jointly occupied stronghold victory and shared desert allocation are supported. Allied Ecaz and Fremen together in Sietch Tabr do not block the Fremen final-turn victory; its other conditions still apply. Combined combat and the Habbanya extension remain unfinished.',
    'A restored pending physical shipment is checked again before forces or spice are committed. If its saved turn, force allocation, destination, price or authorized contribution no longer matches the table, it is rejected without changing the saved declaration.',
    'Finish shipment and movement explicitly. Any Bene Gesserit free-shipment decision and its response must finish first.',
    'In Advanced, finishing your turn sends your own fighters in territories shared with your ally to Tanks, even if your ally acts later or the alliance formed this turn. Polar Sink, Bene Gesserit advisor coexistence in either direction and native Ecaz peaceful coexistence are exempt. The finish warning names affected territories without revealing concealed forces. Loss is mandatory, not a separate confirmation; finishing remains legal if you cannot escape.',
    'Basic keeps its existing later-player separation deadline and same-turn alliance exemption for old co-occupation; these do not waive a new temporary shipment’s departure obligation. Advisors have no new Basic exemption. Homeworlds keep their separate allied-entry restrictions.',
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
      'The linked topics contain a five-part checklist. Implemented describes only the stated feature boundary; Partial identifies remaining work. Planned means that facet is not complete: for Verification it means evidence is still pending, not that a connected preview is inactive.',
      'Verification entries identify focused regression suites. Passing those checks does not certify every interaction, browser journey or complete expansion game.',
      'Development stages distinguish Missing functions, working Prototypes, Integrated functions, Verified behavior and Polished presentation. A prototype stage does not certify complete rules coverage; check the stated limits and evidence.',
      'This checklist is being extended across the rules. Features without a checklist still have a topic-level coverage label and are not implicitly complete.',
      'Choose Rules → Advanced preview when creating a room, or as host in the lobby. After everyone is ready, choose Begin Advanced preview. This unfinished mode supports the six classic factions, with optional Tech Tokens (3+ players) and Stronghold Cards. Expansion starts remain disabled; preview access does not certify complete rules compliance.',
    ],
    related: [
      'setup',
      'interactive-introduction',
      'storm-cards',
      'draw-piles',
      'hand-browsing',
      'kwisatz-haderach',
      'truthtrance-spice',
      'ecaz-ambassadors',
      'richese-cards',
      'nexus-richese-betrayal',
      'nexus-ixian-betrayal',
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
      'table-sounds',
      'seat-handover',
      'seat-ai-permission',
      'ecaz-modules',
      'discoveries',
      'homeworlds',
      'advanced-combat',
    ],
  },
  {
    id: 'faction-sheets',
    title: 'Inspect public faction sheets',
    category: 'Getting started', coverage: 'Partial', developmentStage: 'Prototyped',
    summary: 'Open a faction’s powers and alliance guidance beside the table, or browse all twelve factions here.',
    steps: [
      'Choose Inspect faction beneath any player. Every faction sheet is public; opening one does not reveal that player’s cards, spice, leaders, cache or hidden tokens.',
      'The sheet begins in your table’s Basic or Advanced mode. Include Advanced powers previews the other mode without changing table rules. Advanced powers appear after the Basic powers they extend.',
      'Read the enlarged sheet, scroll with the keyboard and follow internal faction links for detailed timing and exceptions. Close or Escape returns to the table. Inspection remains available while a game action is pending.',
      'The gallery includes all twelve factions. Changing its faction starts with Basic guidance. It is a reference, not a faction selection or a change to a saved game.',
      'The sheets share their text with the internal faction reference. Remaining powers, unresolved interactions and development-only availability stay explicit; this prototype does not certify complete faction text or rules compliance.',
    ],
    checklist: [
      { area: 'Implementation', status: 'Implemented', detail: 'Public faction identity and rules mode select shared guidance and bundled artwork, with no game action or private state.', evidence: ['game/faction-reference.ts', 'components/faction-inspector.tsx'] },
      { area: 'Player controls', status: 'Implemented', detail: 'Every table player has an inspector; the internal gallery offers all twelve factions, Advanced preview, scrolling and close controls.', evidence: ['components/game-table.tsx', 'components/rules-reference.tsx'] },
      { area: 'AI', status: 'Partial', detail: 'Static inspection introduces no AI decision. Existing legal participation remains; full strategy work waits for feature completion.' },
      { area: 'Documentation', status: 'Partial', detail: 'Shared guidance covers existing faction powers and names remaining boundaries. Full printed-text and combined-rule verification remain open.', evidence: ['docs/FACTION_SHEETS.md'] },
      { area: 'Verification', status: 'Partial', detail: 'Focused rendering checks all identities, mode separation, shared reference and public inspector controls; browser and final acceptance have separate evidence.', evidence: ['tests/faction-inspector.test.tsx'] },
    ],
    related: ['force-counters', 'privacy', ...FACTIONS.map(house => `faction-${house.id}`)],
  },
  {
    id: 'interactive-introduction',
    title: 'Interactive introduction',
    category: 'Getting started',
    coverage: 'Partial',
    developmentStage: 'Prototyped',
    summary: 'Practice storm dials, spice blows, alliances, charity, bidding, revival, shipping, movement, sealed battle plans, Traitor calls and spice collection before joining a table.',
    steps: [
      'Choose Learn to play in the lobby or at the top of this reference. Thirteen lessons introduce table information, storm dials, spice blows, ordinary Nexus alliances, charity, bidding, revival, shipping budgets, movement, battle choices, Traitor calls, collection and saved-seat recovery.',
      'The eleven practice positions are separate Basic examples. Compare movement range with city access, storm and stronghold limits; reveal a matching Traitor or decline after both plans appear. Bidding, shipping, combat and collection use the same rule calculations as live games.',
      'Storm practice separates your sealed dial, both revealed dials and movement. Compare first-turn 0–20 and later Basic 1–3 ranges, counterclockwise wrapping, exposed sand, sheltered forces and lost spice. Spice Blow compares accumulation, storm loss, later Shai-Hulud and ignored first-turn worms; finish the replacement blow before opening the Nexus.',
      'Bidding lets you raise, pass and re-enter while the card remains for sale. Only the winner pays; a purchased card stays private. Try a full hand or opponents who all pass, then restart the example.',
      'Charity compares zero, one and two-or-more spice. Revival compares three factions’ free allowances, cumulative force returns, shared spending and leader eligibility across first-death, surviving and repeat-death rosters. Force and leader returns remain separately limited.',
      'At the Nexus, offer an alliance or accept the Emperor’s offer. An unanswered offer does not form an alliance. Break it or finish the Nexus, then compare three versus four shared strongholds at a later Mentat Pause. Changing practice options restarts that example.',
      'The opponent uses a fixed teaching plan, revealed only after you seal yours. Try another plan to compare a Shield with a Snooper, or a low dial with the aggressor’s winning tie. This is an exercise, not an AI match.',
      'Lesson progress stays in this browser, including a revealed plan. No room, multiplayer action or saved-seat credential is created or read. If browser storage is unavailable, practice still works for the current visit.',
      'Faction lessons, Advanced combat, alliance powers, broader storm exceptions and expansions remain outside this introduction. The full reference and phase guidance explain more; existing mode gates still apply.',
    ],
    related: ['setup', 'storm', 'spice-blow', 'alliance-funding', 'charity', 'revival', 'bidding', 'movement', 'battle', 'collection', 'privacy', 'implementation-checklist'],
    checklist: [
      { area: 'Implementation', status: 'Partial', detail: 'Thirteen lessons and eleven interactive Basic examples reuse production storm/exposure/spice, alliance/victory, charity/revival, bidding, shipment, map/occupancy, combat and collection calculations. The complete teaching curriculum remains unfinished.', evidence: ['game/introduction.ts', 'game/introduction-movement.ts', 'game/introduction-bidding.ts', 'game/introduction-alliance.ts', 'game/nexus-alliance.ts', 'game/introduction-resources.ts', 'game/introduction-opening.ts', 'game/disaster-rules.ts'] },
      { area: 'Player controls', status: 'Partial', detail: 'Separate storm sealing/reveal/movement, four spice scenarios and first-turn skip/Nexus timing, charity claims, cumulative free/paid force returns, eligible leader revival and inspection, alliance offer/accept/withdraw/break and later victory, bid/pass, full-hand and all-pass choices, lesson navigation, keyboard force sliders and battle wheel, card inspectors, seal/reveal, retry and browser-local continuation are connected.', evidence: ['components/introduction.tsx', 'components/introduction-practice.tsx', 'components/introduction-bidding.tsx', 'components/introduction-alliance.tsx', 'components/introduction-resources.tsx', 'components/introduction-opening.tsx'] },
      { area: 'AI', status: 'Partial', detail: 'Fixed alliance responses, bidding scripts and an opponent battle plan provide reproducible teaching examples. The introduction is not an AI game and does not demonstrate opponent strategy or calibration.' },
      { area: 'Documentation', status: 'Partial', detail: 'Internal links connect each lesson to existing rules; the setup and saved-seat guidance distinguish practice from a live multiplayer game.', evidence: ['docs/INTERACTIVE_INTRODUCTION.md'] },
      { area: 'Verification', status: 'Partial', detail: 'Focused checks compare all 24 offered storm dials and four spice scenarios with real engine actions, preserve v5 lesson identities, and compare resource payments, allowances and leader custody with engine actions, validate paid-save continuation and prior lesson migration, and cover alliance consent/break and later victory across 24 engine comparisons, bidding/re-entry against the live engine, full hands, payment/card custody, pricing, all offered plans, weapon survival, ties, losses, collection limits, 96 movement comparisons against the engine, single/mutual/declined Traitor calls and saved-choice migration/validation. This does not certify all rules or the complete learning journey.', evidence: ['tests/introduction.test.ts', 'tests/introduction-practice.test.ts', 'tests/introduction-bidding.test.ts', 'tests/introduction-alliance.test.ts', 'tests/nexus-alliance.test.ts', 'tests/introduction-resources.test.ts', 'tests/introduction-resources-migration.test.ts', 'tests/introduction-opening.test.ts'] },
    ],
  },
  {
    id: 'bribes',
    title: 'Paying and collecting bribes',
    category: 'Getting started',
    coverage: 'Partial',
    developmentStage: 'Prototyped',
    summary: 'Pay a non-allied faction now; its recipient share becomes spendable at the next Mentat Pause.',
    steps: [
      'Open Bribes beneath the table. Choose a non-allied faction and a positive whole amount, then use the named Pay button. The amount is public and leaves your supply immediately. A message or promise alone does not pay spice.',
      'The recipient keeps paid spice separately until the next Mentat Pause. Your incoming bribes are shown separately from your spendable supply; they cannot fund bids, shipments or another bribe yet.',
      'You may pay out of turn when no decision or response is pending. You cannot bribe yourself or your ally, during Mentat Pause, or while Inflation shows Double. Emperor gifts to allies use their own power controls.',
      'Your payment limit excludes reserved spending and preserves binding Truthtrance answers. If an alliance, pending decision or available supply changes, recheck the recipient and amount. A rejected payment does not change the game.',
      'A qualifying Bureaucrat may divert two spice to the Bank without reducing the payer’s cost. The remainder stays deferred. Unsupported combinations remain unavailable and do not imply an official rule prohibition.',
      'AI seats can receive bribes but do not negotiate promises yet. Discuss an agreement with human players, then use the corresponding game controls; prose deals are not automatically enforced.',
    ],
    related: ['table-discussion', 'alliance-funding', 'card-truthtrance', 'privacy'],
    checklist: [
      { area: 'Implementation', status: 'Partial', detail: 'Existing payment and escrow are connected to private server-derived limits and supported Bureaucrat continuation. Complete negotiation and all module combinations remain open.', evidence: ['game/bribe-options.ts', 'game/engine.ts'] },
      { area: 'Player controls', status: 'Implemented', detail: 'Named recipient, amount, explicit payment, deferred incoming supply and current availability guidance.', evidence: ['components/bribes.tsx'] },
      { area: 'AI', status: 'Partial', detail: 'Passive receipt/collection and existing Bureaucrat responses work. Strategic bribe initiation and negotiation wait for feature completion.' },
      { area: 'Documentation', status: 'Implemented', detail: 'Payment, escrow, restrictions, saved continuation and remaining boundaries are recorded.', evidence: ['docs/BRIBE_CONTROLS.md'] },
      { area: 'Verification', status: 'Partial', detail: 'Projection/JSON, committed budgets, privacy, target validation, Bureaucrat decisions, rendered controls and concurrent HTTP payment are covered. Full integrated acceptance remains open.', evidence: ['tests/bribe-controls.test.tsx', 'tests/bribe-controls-http.test.ts', 'tests/battle-promises.test.ts', 'tests/shipment-promises.test.ts'] },
    ],
  },
  {
    id: 'table-discussion',
    title: 'Table discussion and private messages',
    category: 'Getting started',
    coverage: 'Partial',
    developmentStage: 'Prototyped',
    summary: 'Discuss plans publicly or privately with another human seat, with saved history and exact message retries.',
    steps: [
      'Open Table discussion beneath the board. Choose Everyone at the table or a named human seat before sending. The server supplies your sender identity; messages are plain text, up to 1,000 characters.',
      'Public messages can be read by everyone who joins this room. Private messages can be read only by the two addressed seats. Recovery or handover gives a seat’s next controller its message history and revokes the old credential.',
      'Messages are available while game decisions are pending and do not change their state. Use the game controls to carry out agreed actions; typing a message does not transfer spice, form an alliance or make a Truthtrance commitment.',
      'If sending is uncertain, Retry exact message confirms the original request without sending a duplicate. Refresh restores pending sends. Discarding retry details cannot undo a message already sent.',
      'Load older messages to browse saved history. Return to latest messages resumes live updates. The panel shows no private-activity counts to other seats.',
      'Human owners using AI control can still talk. Permanent AI opponents do not read or answer messages yet; AI negotiation waits until the game features are complete.',
    ],
    related: ['privacy', 'alliance-funding', 'card-truthtrance', 'implementation-checklist'],
    checklist: [
      { area: 'Implementation', status: 'Partial', detail: 'Separate durable message storage supports public/direct conversation, private pagination, session-fenced reads/writes and exact retries without changing game state.', evidence: ['db/table-talk.ts', 'lib/table-talk.ts'] },
      { area: 'Player controls', status: 'Partial', detail: 'Named conversation selection, plain-text messages, saved retries and older history are connected. Full notification, accessibility and visual acceptance remain open.', evidence: ['components/table-talk.tsx'] },
      { area: 'AI', status: 'Planned', detail: 'Human controllers can communicate while AI operates their seat. Automated message understanding and negotiation are deferred until non-AI feature completion.' },
      { area: 'Documentation', status: 'Implemented', detail: 'Audience, seat inheritance, saved retries and the distinction between discussion and game actions are explained.', evidence: ['docs/TABLE_DISCUSSION.md'] },
      { area: 'Verification', status: 'Partial', detail: 'Production SQL and HTTP cases cover audience, cursor privacy, exact retries, token rotation, saved-kit recovery and unchanged sealed setup. Full browser/network and multiplayer acceptance remain open.', evidence: ['tests/table-talk-recovery.test.ts', 'tests/table-talk-http.test.ts', 'tests/table-talk-client.test.ts'] },
    ],
  },
  {
    id: 'table-sounds',
    title: 'Sound effects',
    category: 'Getting started',
    coverage: 'Partial',
    developmentStage: 'Prototyped',
    summary: 'Optional short cues for phase changes and automatic actions, with local mute and volume controls.',
    steps: [
      'Open Sound effects in the table header to enable or mute audio, change its volume or test a sample. Sound starts off. Preferences stay in this browser and are shared by its tabs.',
      'One short tone marks a new automatic action notice. Two tones mark a phase, turn or game-status change. Several updates arriving together produce at most one cue.',
      'Sound and automatic visual notices have separate controls. Muting sound does not hide notices or change AI pacing.',
      'Refresh restores your preference without replaying old events. Click or press a key to allow future sounds after refresh. Background tabs stay silent and do not queue old sounds.',
      'Volume zero is silent and disables Test sound. Muting stops current tones. If audio is unavailable, play continues normally; cues never reveal concealed cards or decisions.',
    ],
    related: ['automatic-casualties', 'ai-pacing', 'privacy', 'implementation-checklist'],
    checklist: [
      { area: 'Implementation', status: 'Partial', detail: 'Local synthesized phase and tagged automatic-action cues are connected; broader event coverage and final sound design remain unfinished.' },
      { area: 'Player controls', status: 'Implemented', detail: 'Mute, keyboard volume, test sample and refresh-persistent browser preferences.' },
      { area: 'AI', status: 'Implemented', detail: 'Existing projected human and AI updates share the same cosmetic cues without changing legal actions or pacing.' },
      { area: 'Documentation', status: 'Implemented', detail: 'This guide explains preferences, browser activation, background silence and unavailable audio.' },
      { area: 'Verification', status: 'Partial', detail: 'Focused cursor/audio checks and browser preference controls; physical output and broader browser acceptance remain open.', evidence: ['tests/table-sound.test.tsx'] },
    ],
  },
  {
    id: 'seat-ai-permission',
    title: 'Let a player start AI for your seat',
    category: 'Getting started',
    coverage: 'Partial',
    developmentStage: 'Prototyped',
    summary: 'Authorize one named human player to start your chosen AI once while keeping your seat and private information.',
    steps: [
      'After the game starts, open Let a player start AI for your seat below the table. Choose another human and a difficulty, then grant permission. It expires after 24 hours and can be used even while you are online.',
      'The named player can start only the authorized difficulty. They do not receive your hand, seat credentials or recovery kit. Public history records who activated AI.',
      'You can replace or revoke unused permission. Changing your own AI control or recovering or transferring either seat invalidates unused permission. Take back control stops future AI decisions, but completed choices remain.',
      'An uncertain permission request stays in this tab for exact retry, including after refresh. Retrying cannot renew consent or activate AI twice. Discarding a retry record cannot cancel an operation that reached the server.',
      'Host status and disconnection alone never grant permission. A lost unprepared seat and unattended server recovery remain outside this feature.',
    ],
    related: ['privacy', 'ai-players', 'ai-pacing', 'seat-handover', 'implementation-checklist'],
    checklist: [
      { area: 'Implementation', status: 'Implemented', detail: 'One-use, fixed-profile permission with expiry, both credential fences, atomic activation and owner takeback invalidation.' },
      { area: 'Player controls', status: 'Implemented', detail: 'Named owner consent/replacement/revocation and delegate activation; exact tab-scoped retry continuation.' },
      { area: 'AI', status: 'Implemented', detail: 'Uses the existing legal private-view autopilot and saved 1.5-second pacing; no strategy changes.' },
      { area: 'Documentation', status: 'Implemented', detail: 'Explains consent, expiry, retained ownership, private-information boundaries and uncertain replies.' },
      { area: 'Verification', status: 'Partial', detail: 'Focused SQLite races, recovery, HTTP privacy and browser controls; broader network-failure acceptance remains open.', evidence: ['tests/seat-ai-delegation-client.test.ts', 'tests/seat-ai-delegation-recovery.test.ts', 'tests/seat-ai-delegation-http.test.ts'] },
    ],
  },
  {
    id: 'seat-handover',
    title: 'Pass a seat to another player',
    category: 'Getting started',
    coverage: 'Partial',
    developmentStage: 'Prototyped',
    summary: 'A current human owner can offer their own seat through a private one-time kit without changing the faction or game progress.',
    steps: [
      'Open Pass your seat to another player below the table and create a private handover. Send the complete kit only to your intended recipient. It expires after 24 hours; play can continue until acceptance.',
      'The recipient chooses Accept a seat handover on the home page and confirms the room and seat. Acceptance preserves private cards, resources, decisions and AI-control settings. It revokes the previous owner’s browser sessions and recovery kits. The recipient should protect their seat with a new recovery kit.',
      'An owner may cancel or replace an offer. A confirmed replacement invalidates the old kit. Recovering the issuing seat also invalidates its pending offer. A browser already controlling another seat in that room must use a separate browser profile.',
      'Keep the tab open after an uncertain result and retry the same request. Private retry details survive refresh in that tab. They are removed after both acceptance and the new browser session are confirmed. Closing the tab or abandoning its details can lose access to a completed transfer.',
      'Host status and inactivity do not authorize taking another player’s seat. Broader disconnected-seat and hosted acceptance remains unfinished.',
    ],
    related: ['privacy', 'ai-players', 'implementation-checklist'],
    checklist: [
      { area: 'Implementation', status: 'Implemented', detail: 'Bounded voluntary owner issue/cancel/replace and one-time recipient claim with persistent private custody and exact retry receipts.' },
      { area: 'Player controls', status: 'Implemented', detail: 'Private owner kit controls and a separate recipient acceptance/retry screen, including refresh continuation and deliberate abandonment.' },
      { area: 'AI', status: 'Implemented', detail: 'Transfer preserves the human seat’s existing autopilot setting; bots cannot issue or claim someone else’s handover.' },
      { area: 'Documentation', status: 'Implemented', detail: 'This guide explains expiry, revoked access, retry proof and the need for a new owner recovery kit.' },
      { area: 'Verification', status: 'Partial', detail: 'Focused private state, custody, concurrency, HTTP and browser checks. Complete network-failure acceptance remains open.', evidence: ['tests/seat-handover-client.test.ts', 'tests/seat-handover-store.test.ts', 'tests/seat-handover-http.test.ts'] },
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
      'The opt-in Richese Nexus Betrayal auction preview adds a neutral before-payment acknowledgement. A legal rival holder may veto a public self-cache purchase or send another buyer’s sale payment to the bank. See its separate guide and bounded verification evidence; normal hidden self-purchases and special-Karama acquisition are not connected triggers.',
      'A player whose hand becomes full is automatically passed, or submits zero in an unfinished Silent lot. A full-hand owner’s unbid cache card is removed automatically. If every hand is full, preparing the normal pool does not draw and lose unseen cards.',
      'AI supports cache choices and all three offered bidding methods using its own projected information. It currently skips the optional Black Market prelude. A seller in an already offered Black Market lot passes or submits zero.',
      'Karama may prevent the declared cache auction before the ordinary pool is drawn. Cancellation leaves the cache intact and restores its deducted ordinary lot; first/last position does not create another cache offer that round. The independent reduction for a completed Black Market sale remains. An exhausted cache similarly causes no cache deduction. Positive Black Market self-bids and advanced Ixian Technology substitution on special lots retain their separate boundaries.',
      'Juice of Sapho now supports bounded first/last Once Around, movement and remaining battle-choice ordering; see its timing guide for current limits. Richese’s Karama uses the existing generic handler, Distrans supports a separate private hand transfer, Nullentropy Box supports a paid private discard search, Ornithopter supports its two movement modes, and Residual Poison supports a random opposing leader death before leader commitment in development fixtures. Portable Snooper supports ordinary and late poison defense. Stone Burner supports a guarded weapon commitment and revealed leader-effect choice. Mirror Weapon copies opposing revealed attacks, with independent copy-first choices for Tooth and Stone in bounded CHOAM/Richese-deck classic-faction battles. A winning physical Mirror may be kept even after copying activated Tooth or Artillery under the user-selected interpretation, not a publisher clarification. Semuta Drug has a bounded clean public ordinary-discard preview; other discard producers and Sapho timing modes remain unfinished. This does not certify every Karama interaction. Richese expansion starts remain disabled. Each component guide identifies its currently available action. Independent continuation and persisted-room checks pass. Desktop checks confirmed all ten enlarged guides, direct topic links, Once Around payment and restored private Silent bidding. Mobile and full Richese-game verification remain unfinished.',
    ],
    related: [
      'choam-modules',
      'faction-richese',
      'richese-acquisition',
      'nexus-richese-betrayal',
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
    developmentStage: 'Prototyped',
    summary:
      'Choose an available order change or become battle aggressor before plans, then discard Sapho. Later intervention and other timing modes remain unfinished.',
    steps: [
      'In a current Once Around auction, first or last can reorder remaining bidders while you have not yet bid. Earlier bids stay committed; a position you already hold is unavailable. You still get only one bidding opportunity and must outbid the current high bid to win.',
      'Discarding Sapho frees a hand slot. A full-hand holder can join a still-open lot through this order change. A completed bid or pass cannot be repeated, and a finished lot cannot reopen.',
      'The movement controls change complete shipment and movement turns at a boundary before the current player begins. First moves you ahead of the remaining unstarted turns, including after earlier players have fully finished. In Advanced, the Guild must have finished or be absent. Last stays after the Guild even if the Guild later chooses to wait.',
      'Between completed battles, choose first or last among remaining battle choosers. The priority lasts for the rest of the Battle phase. You still need a real unresolved battle. Others may choose battles against you before your own turn; last is not immunity. This scope changes the chooser, not each battle’s aggressor or tie advantage.',
      'During your open pre-plan preparation, use Sapho to become the current battle’s aggressor before declaring ready. You win ordinary ties, while the Habbanya Stronghold advantage still takes precedence. Physical participants, plans and later battle-choice order do not swap. The accepted priority survives refresh.',
      'Finish existing shipment, movement, card preparation and pending decisions before changing order. Your hand panel lists only currently available choices. A reserved card or a position you already hold cannot be selected.',
      'Completed bids and turns stay completed. Storm order, committed funding and movement counters do not reset. Refreshing preserves the same remaining opportunities and any declared last position.',
      'In the explicitly opted-in Semuta preview, clean Once Around and movement-order discards pause after their bidder/turn queues reorder; a clean between-battles chooser discard pauses after changing battle priority but before the next chooser acts; a clean pre-plan aggressor discard pauses after changing ordinary tie priority. Every seat receives the same neutral offer. Claim or decline moves only the used card or leaves it discarded; each committed queue or unsealed battle then continues once.',
      'These are the supported development controls, not additional printed restrictions. Later aggressor intervention, ordinary cyclic auction scope, other phase ordering and intervention during a partly completed combined turn remain unfinished. Silent bids are simultaneous; their storm-order tie rule is unchanged.',
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
          'Finite Once Around, clean combined-turn and remaining Battle-phase ordering; authoritative chooser/participant separation, phase priority, physical discard, full-hand auction eligibility and persisted last-over-Guild movement protection. Remaining timing modes are guarded.',
      },
      {
        area: 'Player controls',
        status: 'Partial',
        detail:
          'Owner-only first/last and pre-plan aggressor actions, public aggressor/tie priority and remaining battle order, owner-relative targets, readable inspector and timing explanations. Later aggressor and cyclic-auction controls remain unfinished.',
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
          'Finite-order, engine, all-profile and real persisted-room tests cover once-only play, funding, full-hand eligibility, privacy, Guild deferral and battle scheduling through actual outcomes. Full expansion compliance remains unverified.',
        evidence: [
          'tests/ordered-opportunity.test.ts',
          'tests/juice-of-sapho-engine.test.ts',
          'tests/juice-of-sapho-engine-review.test.ts',
          'tests/juice-of-sapho-bots.test.ts',
          'tests/juice-of-sapho-recovery.test.ts',
          'tests/juice-of-sapho-boundary-recovery.test.ts',
          'tests/sapho-battle-order.test.ts',
          'tests/sapho-battle-order-bots.test.ts',
          'tests/sapho-battle-order-controls.test.tsx',
          'tests/sapho-battle-order-recovery.test.ts',
          'tests/sapho-aggressor.test.ts',
          'tests/sapho-aggressor-recovery.test.ts',
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
      'The separate Richese Nexus Betrayal preview connects ordinary public self-cache auctions, not this private special acquisition. The native Karama cancellation exception above is not authority for deciding whether Nexus Betrayal applies to a special purchase.',
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
      'nexus-richese-betrayal',
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
      'All ten canonical Richese cards may be transferred when legal, and Karama has its existing card-effect handler. Distrans supports its separate card-transfer effect, Nullentropy Box supports paid private discard search, Ornithopter supports its two movement modes, and Residual Poison supports a random opposing leader death before leader commitment. Portable Snooper supports ordinary and late poison defense. Stone Burner supports a guarded weapon commitment and revealed leader-effect choice. Mirror Weapon copies an opposing revealed weapon in bounded CHOAM/Richese-deck classic-faction battles, with copy-first Tooth/Stone choices; physical-Mirror winner retention even after copied activated Tooth/Artillery is a user-selected interpretation. Juice of Sapho supports bounded Once Around and movement ordering. Semuta Drug has a bounded clean ordinary-discard preview; other discard producers and Sapho timing modes remain unfinished. Desktop gift transfer and fresh-tab pending recovery have been checked in a synthetic table. Mobile, broader interactions and full Richese games remain pending; Richese starts remain disabled.',
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
      'The explicitly opted-in Semuta preview now offers a neutral all-seat response to the public used Distrans after a clean completed private transfer. The given card remains private and belongs to its recipient; only the used Distrans is claimable. Responses or decisions already in progress, unresolved bid and self-transfer rulings, full combined Richese games and ordinary expansion starts remain unfinished.',
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
          'Synchronous two-card custody, private transfer, normal Distrans disposal, both-card reservations and prospective transaction/promise checks are integrated. The explicit Semuta preview offers a neutral reaction only after a clean completed transfer; open-lot timing, competing transactions and self-transfer remain guarded.',
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
      'This bounded search, its controls and recovery are integrated in development fixtures. Full-hand activation and the provisional Guild refund interaction remain unresolved. In the explicit Semuta preview, another holder may recover the used Box after a clean completed search without replaying payment or shuffle; other Semuta discard sources remain unfinished. Mirror Weapon has a separate bounded CHOAM/Richese-deck classic-faction battle path, and full Richese starts remain disabled. Complete browser, mobile and full-game acceptance is not claimed here.',
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
    developmentStage: 'Prototyped',
    summary:
      'Concealed zero, three and five tokens represent one force until they are revealed.',
    steps: [
      'Richese has three No-Fields, numbered zero, three and five. A concealed token counts as one force. Only one may be deployed on Arrakis, and consecutive own or allied shipments cannot use the same token.',
      'A normal No-Field shipment pays the one-force price. The concealed token moves like a force. Before Battle, Richese may reveal it voluntarily; a token involved in battle is revealed with the Battle Plan. Revelation brings the indicated forces from reserves, limited by what remains there.',
      'The revealed token stays face up until another token is placed. Revealing it does not clear the previous-shipment restriction. An allied No-Field shipment reveals immediately and uses the ally’s reserves; an existing token must be revealed before another shipment.',
      'Before an eligible ally uses its shipment, the game holds an offer opportunity for Richese. Richese may pass or privately propose a token, destination and payment. The ally accepts the exact offer and chooses its permitted regular/elite mix, or declines without payment. Success consumes the ally’s shipment, not Richese’s shipment or either player’s movement.',
      'Ordinary allied shipment costs one spice into a stronghold or two elsewhere, funded by either ally or one each at cost two. Basic Guild recipients and already-active Karama rates now use a visibly provisional one-spice price, paid entirely to bank even if Richese funds it; their Advanced counterparts remain guarded. Prevention precedes payment and the old-marker/new-token reveals. Fremen reserves are on the planet and remain ineligible.',
      'Storm and worm exposure reveal the token and destroy its forces. A zero token still had one-force presence before revelation. Trip to Gamont forces a reveal, then returns one force if present. Revealing a token already in a territory does not trigger Terror a second time.',
      'Development tables support your own concealed shipment, movement of a marker alone or with a physical group, voluntary reveal and one-force board presence. Physical reserves remain unchanged until reveal. Karama can prevent the No-Field shipment, with Guild shipment prevention and payment handled separately. Price and chosen allied funding are shown before shipment.',
      'The map shows a concealed marker without its denomination to everyone. Richese privately sees its token values, last-use restriction and reveal control. Movement selection keeps the marker separate from physical forces. No hidden denomination or physical token identity is included in another player’s projected board state.',
      'Marker-only battles use the owner’s private reserve-limited force pool. Both plans must be sealed before the token materializes. A zero-token battle still resolves with its leader, cards and traitor decisions. Ordinary Atreides prescience cannot request this opponent’s dial; other eligible plan elements remain available.',
      'Basic ordinary mixed battles have a provisional private pool: physical forces already here plus the token value capped by current reserves. The Battle Wheel labels that interpretation explicitly. Both plans seal before materialization, then native casualties and aftermath use actual forces. This first version does not adjudicate the FAQ mixed dial cap.',
      'Concealed collection, occupancy and control use one-force presence. Exposed storm sectors and unprotected worm destruction reveal and remove the resulting actual forces. Storm shelter and other sectors remain separate. Trip to Gamont at a location with a marker reveals it, even if ordinary forces also occupy that sector, then returns one actual force if present. It is still used if zero forces remain. Canceling the CHOAM power leaves the marker concealed.',
      'All four AI profiles choose from their own private token inventory, pay only the one-force shipment price, move the marker explicitly and reveal positive tokens when useful. They retain zero-token presence and use only public information to assess opponents. They also offer safe positive tokens from their own inventory during the allied opportunity, fund them with their own spice and accept or decline private offers using their own force and payment information. A human Richese player’s offer window holds an AI ally’s shipment. Pending responses, decisions and Truthtrance retain priority.',
      'Advanced mixed-force battles, combined Ecaz Occupy, Advanced Guild/Karama allied prices and entire-plan special Karama inspection against a No-Field remain guarded. Homeworld custody, broader Truthtrance and interrupted compositions remain unfinished. Basic mixed-pool and discounted-price prototypes are not publisher-adjudicated formulas. Richese starts remain disabled.',
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
          'Own shipment, movement, reveal, effective presence, collection, hazards, Gamont and marker-only battles work in development fixtures. Basic mixed battles have a provisional private pool and native aftermath. Allied consent, typed forces, full/split funding, prevention and immediate reveal are integrated; Basic Guild/active-Karama offers have a shared provisional one-spice/bank quote. Advanced/combined mixed battles, Advanced discounted allied prices, whole-plan inspection and wider combinations remain separate.',
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
          'All four profiles support own shipment, marker movement/reveal and marker-only battles using entitled projections. Basic mixed groups now use the private authoritative battle pool; one Easy planning/aftermath smoke passes. Allied offer/acceptance preserves human ownership and avoids repeated declined offers and forbidden dial prescience. Complete Richese-game strategy remains unverified.',
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
          ? 'Use the Juice of Sapho panel for an available order change or pre-plan aggressor. Later intervention and other timing modes remain unfinished; consult the timing guide.'
          : definition.card.effect === 'karama'
            ? 'This physical Karama uses the existing generic handler in development fixtures. In the explicit Semuta preview, clean printed cancellations of CHOAM Charity, Inflation or Bene Gesserit Charity pause on the public cost before settling that response; a clean printed normal-auction purchase or winning-bid payment pauses before its reserved lot settles. Full Richese starts and other Karama-to-Semuta reactions remain unavailable.'
            : definition.card.effect === 'distrans'
              ? 'Use the Distrans transfer panel to choose another player and a separate held card. Open-bid timing and self-transfer remain guarded pending clarification.'
              : definition.card.effect === 'nullentropyBox'
                ? 'Use the Nullentropy Box panel to pay two bank spice for a private discard search. Full-hand activation and provisional Guild refund claims remain guarded pending resolution.'
                : definition.card.effect === 'ornithopter'
                  ? 'Use the Ornithopter movement controls with a selected group and destination. Hajr/prior-move composition, fixed-range Kulon and advanced advisors remain explicitly unresolved.'
                  : definition.card.effect === 'residualPoison'
                    ? 'Use the Residual Poison panel before either combatant commits a leader. A shared preparation step provides an opportunity regardless of hand contents; advanced Harkonnen tables remain guarded pending the secret-captive ruling. In the explicit Semuta preview, a clean death with no readiness or inspection commitments pauses after public disposal for the neutral offer, then resumes the same preparation.'
                    : definition.card.effect === 'stoneBurner'
                      ? 'Use Stone Burner in the battle weapon selector and review the chosen dial/support guard before sealing. Choose the leader effect after revelation; combined timing remains guarded.'
                      : definition.card.effect === 'mirrorWeapon'
                        ? 'Choose Mirror Weapon in the battle weapon slot in a supported CHOAM/Richese-deck table. Its attack copies the opposing revealed weapon; copied Tooth or Stone choices resolve first and independently. Under the user-selected interpretation, a winning physical Mirror may be retained even after a copied Tooth or Artillery attack. Full Richese starts and combined modules remain guarded.'
                      : definition.card.effect === 'portableSnooper'
                        ? 'Choose Portable Snooper as your ordinary poison defense, or use the late-defense panel after reveal before your own traitor decision. It uses ordinary winner retention and cannot stop Poison Tooth.'
                        : definition.card.effect === 'semutaDrug'
                          ? 'In the explicit Richese development preview, every seat sees a neutral response to supported clean discards. A CHOAM & Richese game may include the Ix deck: Thumper pauses before worm/spice draw; Amal pauses after halving spice before opening resumes. Other public sources include ordinary cards, paid Box, Ornithopter, Distrans, final Truthtrance, four clean Sapho scopes, pre-leader Residual Poison, printed Karama canceling clean CHOAM Charity, Inflation or Bene Gesserit Charity, a clean printed Karama normal-auction purchase or winning-bid payment before lot settlement, a completed CHOAM card sale after its bank income, clean Kulon Worthless disposal before its movement bonus, proactive La La La disposal before blocking free revival, proactive Baliset before restricting movement, proactive ordinary Trip to Gamont before returning a force, accepted Jubba Cloak before storm protection, and three battle batches. A private normal-auction Ixian ally replacement also pauses before drawing, without showing its face until a holder commits. Under the user-selected exchange ruling, Commit may replace Semuta even at your faction hand limit: acquisition and Semuta disposal settle atomically, without increasing your completed hand. Reserved incoming cards still need room. For multiple eligible cards, inspect and select exactly one after commitment. Saved effects resume once. Other private discards, Karama uses, reactive Worthless uses except printed Jubba, elite or concealed Trip returns, inspected/partly ready battles, nested responses, pending rewards and public starts remain unfinished.'
                        : 'Reference component only: this Richese card’s game actions are not enabled.',
      ],
      ...(definition.card.effect === 'semutaDrug'
        ? {
            checklist: [
              {
                area: 'Implementation' as const,
                status: 'Partial' as const,
                detail:
                  'The Richese preview interrupts clean ordinary-card, paid Box, Ornithopter, Distrans, Truthtrance, four Sapho scopes, pre-leader Residual Poison, printed Karama canceling clean CHOAM Charity, Inflation or Bene Gesserit Charity or settling a normal auction purchase or winning bid, a completed CHOAM sale, clean Kulon and proactive La La La/Baliset/ordinary Trip to Gamont Worthless use, accepted printed Jubba before storm protection, Ix-deck Thumper/Amal and three battle discard stages. A private normal-auction Ixian ally replacement pauses before its draw with a neutral, face-hidden offer. CHOAM sale income is committed before its neutral offer and the same market resumes once; Kulon adds one movement range, La La La blocks one target’s free revival, Baliset restricts the chosen player’s movement, ordinary Trip returns one selected force, and Jubba protects one CHOAM territory only after their offers. Karama’s physical cost is discarded before its neutral offer; the original response is canceled or the reserved lot settles once. Residual Poison commits one random leader death; Sapho commits its finite priority. Thumper waits before worm/spice draw; Amal restores an already-halved opening. Owner-only candidates and one physical Semuta transfer retain privacy. The user-approved full-hand exchange preserves final hand count and incoming reservations. Other Karama uses, other reactive Worthless uses, private discards, nested responses and pending rewards remain unfinished.',
              },
              {
                area: 'Player controls' as const,
                status: 'Partial' as const,
                detail:
                  'All seats can Continue at the neutral fresh-discard boundary; only the actual holder sees Commit. In a mixed-owner battle batch, a committed holder can inspect and select only cards discarded by another player; nonholders receive no candidates. Normal Richese starts remain gated.',
              },
              {
                area: 'AI' as const,
                status: 'Partial' as const,
                detail:
                  'All four AI profiles use their own projected hand to commit or pass the exact current event, and can choose only privately projected committed candidates. This is minimal legal participation, not tuned strategy.',
              },
              {
                area: 'Documentation' as const,
                status: 'Partial' as const,
                detail:
                  'The guide distinguishes clean public ordinary-card, paid Box, Ornithopter, Distrans, Truthtrance, four Sapho scopes, pre-leader Residual Poison, printed Karama cancellation of CHOAM Charity, Inflation or Bene Gesserit Charity or clean normal-auction purchase or winning-bid payment, completed CHOAM card sales, clean Kulon/proactive La La La/Baliset/ordinary Trip to Gamont Worthless and accepted printed Jubba Cloak, Ix-deck Thumper/Amal and three battle batches from a private normal-auction Ixian ally replacement, privacy-neutral acknowledgements, the user-approved atomic full-hand exchange and remaining discard sources.',
              },
              {
                area: 'Verification' as const,
                status: 'Partial' as const,
                detail:
                  'Genuine setup, custody, hidden-hand parity, saved JSON, authenticated SQLite continuation and legal AI participation cover clean ordinary-card, paid Box, Ornithopter, Distrans, Truthtrance, four Sapho scopes, pre-leader Residual Poison, printed Karama cancellation of CHOAM Charity, Inflation or Bene Gesserit Charity or clean normal-auction purchase or winning-bid payment, completed CHOAM card sales, clean Kulon/proactive La La La/Baliset/ordinary Trip to Gamont Worthless and accepted printed Jubba Cloak, Ix-deck Thumper/Amal, a private normal-auction Ixian ally replacement and three battle discard stages. Other private producers, Karama uses, other reactive Worthless uses, pending rewards, full games and live deployment remain unverified.',
                evidence: [
                  'tests/semuta-engine.test.ts',
                  'tests/semuta-recovery.test.ts',
                  'tests/bot-semuta.test.ts',
                  'tests/semuta-reaction-controls.test.tsx',
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
                      : definition.card.effect === 'mirrorWeapon'
                        ? ['battle', 'stone-burner']
                      : definition.card.effect === 'portableSnooper'
                        ? ['portable-snooper']
                        : []),
      ],
    }),
  ),
  {
    id: 'ecaz-occupy',
    title: 'Ecaz Occupy: Basic and Advanced combined-army battles',
    category: 'Advanced & expansions',
    coverage: 'Partial',
    developmentStage: 'Prototyped',
    summary: 'Ecaz chooses who leads its combined army. Basic provisionally follows the main printed paragraph for odd as well as even counts: ceiling contribution/loss and floor survivors. Advanced retains its user-authorized revision. Usable controls and legal participation are connected; interaction refinement remains.',
    steps: [
      'When reciprocal Ecaz allies coexist with fighting forces, Ecaz chooses Ecaz or its ally to lead. Every participating whole-territory army must be clear of storm and connected; no component-only battle or casualties are created. The selected lead uses its own leaders, Treachery cards and spice; the original battle-order chooser is not replaced. Advisors are not fighters but retain their native voluntary fighter-conversion opportunity.',
      'Basic combined battles use the native Ecaz deck and existing roster prerequisites. Ecaz contributes the ceiling of half its forces at full strength and loses that many on an ordinary win; survivors round down. This follows the main printed paragraph provisionally because its odd-count FAQ example conflicts. A visible control warning distinguishes the prototype from a settled correction. Basic has no Emperor/Fremen elite inventory and its supplied support normalizes to zero.',
      'With Advanced Occupy active, the total dial includes the ceiling of half the Ecaz fighters as mandatory full-strength contribution without spice cost, plus the chosen allied army strength. The variable army retains its native Fremen/Fedaykin or Emperor/Sardaukar properties even when Ecaz forms the plan.',
      'An ordinary victory leaves the floor of half the Ecaz fighters alive and separately applies the variable army’s dial losses. A sole successful Traitor-call winner preserves both armies; an ordinary defeat, mutual Traitor result or resolved explosion removes the actual combined side. Ecaz and its ally share the printed same-faction Traitor/Face Dancer relation.',
      'Eligible Karama can prevent Occupy after the lead choice and before powers/plans. The chosen lead remains lead and dials its own army; the other ally contributes zero. The plan editor then uses the new force pool and no fixed Ecaz strength.',
      'An Ixian variable army takes its own typed losses and chooses native surviving-Suboid substitution, including when Ecaz formed the plan. Actual Ixians own the exchange/counter; the selected lead still owns winner cards and continuation. CHOAM support income uses original eligible payer/donor shares, not the free fixed contribution.',
      'A Tleilaxu winning co-side cannot Face Dance itself. External Face Dance returns both actual winning allied armies with a combined survivor maximum, while the selected winner keeps original rewards and card cleanup. Reserve/board zero/partial/full replacements remain native choices, not a copied player.',
      'A native Richese ally may supply ordinary counters or its concealed No-Field alone. A zero or reserve-limited marker remains battle presence; the original Richese owner materializes it only after both plans seal. The selected lead receives the private variable pool needed for its plan; rivals do not. Dial prescience and whole-plan restrictions follow the selected plan’s actual force owner, while cancellation to Ecaz’s own pool removes that concealed-dial restriction. Richese’s own ordinary-plus-marker dialing remains guarded.',
      'Stone Burner compares physical undialed counters, not total dial or paid strength: active Occupy contributes floor(Ecaz forces / 2) plus the ally’s native undialed tokens. Canceled Occupy compares only the selected lead’s own pool. Physical Mirror copies use the same comparison and retain their original cleanup. Hidden opposing No-Field preflight uses public possible pools, not its actual denomination; genuinely winner-changing typed allocations remain blocked.',
      'With the independent variant, Harass returns only the actual card user’s undialed forces. An Ecaz user keeps the original mandatory ceil contribution committed at free full strength while its floor count returns; ally support is separate. An allied user subtracts fixed strength before choosing its native typed commitment. Canceled Occupy uses its selected lead’s own pool. Returned reserves are outside later casualties/explosion/Face Dance.',
      'Reinforcements consumes three card-user reserves normal-first and adds +2 score without extra support or on-board arrivals. Its existing provisional cost/disposal on every revealed outcome is unchanged, not a new publisher ruling. Own same-plan Harass/Reinforcements and Stone remain guarded; Basic/unprofiled co-side cards remain unsupported.',
      'Advanced numbers come from the user-authorized revised PDF, physical pages 32 and 19, not a newly located publisher erratum. Basic follows the main printed paragraph provisionally. Existing faction/deck prerequisites remain:33 Ecaz alone,47 Ix,35 CHOAM,47 both; Richese retains its separate ten-card cache. Explicit --ecaz-treachery independently adds all three cards. Whole-plan disclosure, mixed No-Field and optional-overlay interactions remain for refinement; public starts remain gated.',
    ],
    checklist: [
      { area: 'Implementation', status: 'Partial', detail: 'Combined-side enumeration, lead choice, native Occupy response and owner-labelled physical outcomes are connected. Basic odd counts now follow the main printed paragraph provisionally; Advanced retains its authorized arithmetic. Optional/exotic composition refinement remains.', evidence: ['game/ecaz-occupy-battle.ts', 'game/board-resolution-quote.ts', 'game/battle-resolution-quote.ts', 'game/engine.ts'] },
      { area: 'Player controls', status: 'Partial', detail: 'Original 390px controls cover mandatory/free dials, native Karama redial, Ix substitutions and whole-side Face Dance. Richese human T78EFNZK chose Ecaz lead, sealed total5/support2 with its real leader, revealed the ally’s original No-Field5 into only two available reserves, and reached Collection with Ecaz2 and two Richese losses. Basic human FEJ6SBFB shows the correct even-force labels, a total-dial slider bounded2..6 with no support control, and real Ecaz/guild casualties after an8–6 win. Other combinations remain open.', evidence: ['components/ecaz-occupy.tsx', 'components/face-dance-decision.tsx', 'components/game-table.tsx', 'game/ecaz-occupy-options.ts'] },
      { area: 'AI', status: 'Partial', detail: 'All four native policies actually seal legal total plans for either lead, active or canceled, using native leaders/cards and physical support. Strategy remains deferred.', evidence: ['game/ecaz-occupy-options.ts', 'game/bots.ts', 'tests/ecaz-occupy-options.test.ts'] },
      { area: 'Documentation', status: 'Implemented', detail: 'Authorized Advanced arithmetic and provisional main-paragraph Basic arithmetic are distinguished from the conflicting FAQ, specific Duke ruling and deferred interaction refinement.', evidence: ['docs/ECAZ_OCCUPY_RULES.md', 'docs/RULE_DECISIONS.md', 'game/reference.ts'] },
      { area: 'Verification', status: 'Partial', detail: 'Development Verified: affected363 rules cases,26 actual native programs including all four legal policies, and original390px Richese/No-Field controls. Source-band Basic adds focused even/odd/canceled quote cases and native runtime cases with all four policies and original Collection/victory. Five genuine2..6-seat Basic games: four complete2090 accepted actions/54 JSON continuations/no rejection; four-seat seed20261299 is captured at the preserved odd-count conflict. Earlier46 ordinary/variant games and source-specific card evidence remain historical; complete factions/optional combinations and comprehensive assurance follow all rules.', evidence: ['tests/ecaz-occupy-battle.test.ts', 'tests/basic-ecaz-occupy-runtime.test.ts', 'tests/ecaz-occupy-richese.test.ts', 'tests/ecaz-occupy-stone.test.ts', 'tests/ecaz-occupy-cards-runtime.test.ts', 'tools/faction-games.ts', 'docs/ECAZ_OCCUPY_RULES.md'] },
    ],
    related: ['faction-ecaz', 'advanced-ecaz', 'ecaz-ambassadors', 'battle', 'victory', 'implementation-checklist'],
  },
  {
    id: 'ecaz-loyalty',
    title: 'Ecaz Loyalty: public Traitor Card',
    category: 'Advanced & expansions',
    coverage: 'Partial',
    summary: 'Advanced Ecaz sets one randomly chosen native Traitor Card aside face up before the initial deal.',
    steps: [
      'Before any initial Traitor Cards are drawn, randomly select one of the five ordinary Ecaz Traitor Cards and set it aside face up. Everyone may inspect it. It remains outside the deck for the rest of the game, including later Traitor and Face Dancer draws.',
      'Loyalty is automatic and cannot be stopped with Karama. It creates no player choice, payment or acknowledgment. The card names a leader, but does not remove, kill, transfer or otherwise change that leader disc. Duke Vidal has no Traitor Card and is never a candidate.',
      'In new Advanced development games with Ecaz, the table displays the selected card before the Traitor choices. Inspect traitor enlarges its identity; refreshing or resuming the saved game keeps the same card. Basic games and games without native Ecaz do not use this power.',
      'Older saved games that have already dealt their Traitor Cards retain that inventory; they do not gain a retroactive Loyalty draw. Bounded native Ecaz Leader Skills retain this original draw after public assignment. Public expansion starts, combined Occupy skills and Moritani assassination combinations remain gated.',
    ],
    checklist: [
      { area: 'Implementation', status: 'Partial', detail: 'One persisted native Ecaz card is selected before genuine initial dealing, excluded from setup and Nexus deck construction, and validated against all known circulating or retired Traitor locations. Older saves stay unchanged. Broader combinations remain gated.', evidence: ['game/ecaz-loyalty.ts', 'game/engine.ts'] },
      { area: 'Player controls', status: 'Implemented', detail: 'A public named card and existing enlarged Traitor inspector appear before setup choices and during play, with internal help and no acknowledgment.', evidence: ['components/ecaz-loyalty.tsx', 'components/game-table.tsx'] },
      { area: 'AI', status: 'Partial', detail: 'All four profiles complete genuine setup through existing legal actions without choosing, rerolling or acknowledging Loyalty. Strategy remains deferred until game features are complete.', evidence: ['tests/ecaz-loyalty-engine.test.ts'] },
      { area: 'Documentation', status: 'Implemented', detail: 'Public setup, permanent card exclusion, normal leader custody and old-save limits have internal guidance and sourced developer notes.', evidence: ['game/reference.ts', 'game/faction-reference.ts', 'docs/ECAZ_LOYALTY.md'] },
      { area: 'Verification', status: 'Partial', detail: 'Two-through-six-player deals, full Tleilaxu setup, Harkonnen and Tleilaxu Nexus draws, public projection, invalid-state rejection, all-profile setup, rendering and JSON continuity have focused checks. Final browser and checkpoint evidence is recorded separately; combined-module acceptance remains open.', evidence: ['tests/ecaz-loyalty.test.tsx', 'tests/ecaz-loyalty-engine.test.ts', 'tests/nexus-traitor-engine.test.ts'] },
    ],
    related: ['setup', 'faction-ecaz', 'advanced-ecaz', 'ecaz-ambassadors', 'duke-vidal', 'implementation-checklist'],
  },
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
      'Destroyed tokens return to supply; triggered regular tokens are set aside, Bene Gesserit is permanently removed, and replenishment waits for all five random tokens. Storm crossings and resolved explosions use destruction rather than trigger accounting. The reusable Ecaz token returns to supply after Duke acquisition or an alliance proposal. Basic now also offers a provisional new-ally Duke loan after consent.',
      'When an eligible entrant reaches the reusable Ecaz token, Ecaz may acquire the available shared Duke. The token returns to supply and its five companions are unchanged. Unused Ecaz control persists until battle use or Moritani acquisition. Basic also connects the separate optional new-ally loan after an accepted Ambassador alliance; standing ally assignment and exceptional capture remain unfinished.',
      'Unallied Ecaz can instead propose an alliance to an unallied entrant. The entrant accepts or refuses; the token returns to supply either way. Acceptance activates alliance abilities immediately. In Basic, Ecaz may then lend an available Duke to this newly allied faction or continue without a loan. The first-version loan allows one battle and sets an unused living Duke aside at turn end; those return/tenure details are provisional, not a resolved publisher ruling. An unavailable Duke never prevents alliance consent.',
      'When another eligible faction enters a marked stronghold, Ecaz may trigger its Ambassador for itself or its current ally, or leave the token in place. Ecaz itself, its ally, advisors and the faction matching the physical Ambassador do not trigger it. Entries with competing arrival reactions remain blocked until their ordering is implemented; a rejected entry does not spend or move its pieces.',
      'Emperor grants five bank spice. Atreides records the entrant’s current Treachery hand privately for the beneficiary; Harkonnen records one randomly selected held Traitor identity, or Face Dancer identity for a Tleilaxu entrant. These snapshots remain in the recipient’s private inspection history, identify when they were taken, and do not become a live view of later changes. Opening, enlarging or closing them needs no game acknowledgement.',
      'CHOAM lets the beneficiary choose any available hand cards, including none, for three spice each. Ixians require one available card to discard before drawing its replacement. Card controls respect projected reservations. After committing an Ixian exchange, a voluntary interruption must leave a card available for its required discard; a queued Truthtrance counts as already committed. A Bene Gesserit trigger permanently removes its token, then the beneficiary chooses an available effect outside the original supply for this group; unsupported copies remain visibly blocked.',
      'The Richese Ambassador automatically spends three of the chosen beneficiary’s spice for the top Treachery Card if the purchase can be completed. There is no extra purchase confirmation. An unavailable purchase consumes the triggered token without charging spice or granting a card; the public outcome does not disclose whether the beneficiary lacked spice or hand space. Emperor receives another faction’s payment unless that income is canceled. A Harkonnen buyer may receive its normal bonus card, subject to its hand limit and Karama. These benefits finish before movement or a worm ride resumes. Ixian allied replacement requires Bidding, so it does not apply to these entries.',
      'The Fremen Ambassador lets the beneficiary relocate one group already on the board directly to any available territory and sector, subject to storm and occupancy. Select physical forces from one territory, preserve elite quantities, and optionally include your concealed No-Field without revealing it. This independent move costs no shipment spice and does not use ordinary movement allowances. It can change sectors within one territory, but pieces already in the destination sector stay in place. Homeworlds and reserves are not board territories.',
      'The mobile stronghold can receive a non-Ixian group only from the territory it points to. Ecaz and its ally may co-occupy under Occupy. Advisors keep their applicable stance and accompaniment locks; an eligible arrival can request fighters. CHOAM may use Baliset during Shipment and Movement; if allowed, choose another legal destination. Intrusion or Terror resolves before the original entrant continues. A destination that causes both settles the Intrusion first and then offers the committed Terror entry; no payment or force transfer replays. There is no extra decline after triggering; if no legal move remains, the effect finishes without moving pieces and its token stays consumed.',
      'The Guild Ambassador grants an immediate free shipment of zero through four physical reserve forces for Ecaz or its ally, including typed elites. Choose a clear territory and sector; this does not spend ordinary shipment or movement, ally aid or a retained rate card. Fremen may use destinations outside their ordinary reinforcement radius, but their southern reserves stay on-planet and this effect never permits storm entry. Only Ixians may ship directly into their placed mobile stronghold.',
      'During Shipment and Movement, Guild can use its special Karama to stop another eligible off-planet Ambassador shipment before forces arrive; it does not stop this grant during a phase-one worm sequence. A successful off-planet shipment may invite Bene Gesserit accompaniment and accrues applicable phase-five Heighliner income once. BG can accompany Ixians into the mobile stronghold. Projected accompaniment choices show blocked sectors and keep Polar Sink and decline available when legal. Intrusion, separate Terror and accompanying fighter-triggered Ambassadors finish before the original entrant or worm rider resumes.',
      'No-Field substitution into the free four-force grant remains unavailable. In bounded classic plus Ecaz/Moritani games, a shared Ambassador/Terror entry gives both owners saved optional prompts in current storm order without repeating the committed entry; this is a provisional table order, not a printed publisher priority. A Terror entry now waits for the arrival’s own interaction — Guild income, a Bene Gesserit fighter Intrusion or advisor choice, or Fremen storm protection — and then opens without replaying payment or force transfer. Ambassador-created Fremen/Guild child arrivals remain gated. Atomics Aftermath, Homeworlds, Nexus and Discovery combinations do not gain coverage from this overlap path.',
      'The Tleilaxu Ambassador offers one first-death own-leader revival or up to four physical forces for free. These are exclusive choices; the beneficiary sees its own eligible leaders privately. The ordinary allowance remains unchanged provisionally. Repeat-death, shared-leader and revival-income interactions remain for refinement.',
      'All eleven effect guides are readable. Emperor, Atreides, Harkonnen, CHOAM, Ixian, Richese, Fremen and Guild entry effects are integrated, together with Bene Gesserit copies of those eight effects and direct Duke acquisition or consensual alliance through the reusable Ecaz token. Advanced combined Occupy has a separate bounded Development Verified guide, and Basic even-force Occupy now composes the same shared controls. Remaining effects, exceptional Duke custody and complete Ecaz rules remain unfinished. Mobile stronghold placement is gated. Full Ecaz starts remain disabled.',
    ],
    checklist: [
      {
        area: 'Implementation',
        status: 'Partial',
        detail:
          'Inventory, placement and eight entry effects plus their Bene Gesserit copies and direct Ecaz Duke acquisition or consensual alliance are integrated. Storm/explosion token returns are integrated. A Terror entry now defers behind competing Intrusion, Guild income and BG advisor windows; Ambassador-created child arrivals and remaining effects remain unfinished.',
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
          'Placement, entry choices, private inspections, token inventory and all eleven effect guides are available. The Basic new-ally Duke loan and its provisional tenure policy are distinguished from Advanced and exceptional-custody work. Complete timing and interaction refinement remains open.',
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
      'The notice is cosmetic and does not stop game progression. Reduced-motion settings suppress its fade. Reloading treats existing events as a baseline rather than replaying them. Events received while notices are off are consumed; turning notices on does not replay them. At most three notices, including the visible one, remain queued. Bursts summarize older pending actions with a count while their details remain in the table chronicle. Hiding the page clears old notices and consumes updates silently.',
      'Current notice events include committed ordinary movement, shipment, revival, collection and battle results, native Guild transport and Hidden Mobile Stronghold relocation. Declared or canceled actions do not announce an uncompleted result. Existing notices also cover automatic casualties, successful Ecaz Ambassador placement, supported successful Ambassador effects, Emperor auction income, Harkonnen bonus-card draws and private full-plan inspection availability. The Harkonnen draw is announced without exposing its private card identity. Notices reveal no private card identities or plan details. Uncancelable responses now settle automatically as described in Automatic allowance of powers. Successful powers without a notice tag remain outside the current coverage.',
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
          'Multiple allocations and optional continuations retain controls. The cosmetic 1.5-second house notice has an on/off button, reduced-motion behavior and bounded burst summaries.',
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
          'tests/completed-action-events.test.ts',
          'tests/action-notice-queue.test.tsx',
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
    developmentStage: 'Prototyped',
    summary:
      'Fourteen expansion cards join the thirty-three base cards; matching names still represent distinct physical cards.',
    steps: [
      'The expansion includes Poison Blade, Shield Snooper, Weirding Way, Chemistry, Poison Tooth, Artillery Strike, Thumper and Amal, plus the six ordinary card types below.',
      'Hunter Seeker is a projectile weapon and Basilia Weapon is a poison weapon. Normal matching defenses and Voice categories apply. Basilia Weapon belongs to this expansion; Ellaca Drug is the base-game poison card.',
      'The additional Shield and Snooper behave like their base copies, including the Shield’s lasgun interaction. Kull Wahad is a Worthless card and can be played in a battle plan or converted with advanced Bene Gesserit’s Karama advantage.',
      'The second Harvester is a separate card. Each available copy can be played while the fresh blow window remains open; the current implementation doubles that blow again, without multiplying pre-existing spice. Neither copy can restore a worm-destroyed blow or create spice in storm. Multiple-copy timing and multiplier interpretation remain under card-face audit.',
      'With this expansion the combined deck has forty-seven distinct card identities: five ordinary projectile weapons, five ordinary poison weapons, five ordinary Shields, five ordinary Snoopers, six Worthless cards and two Harvesters, in addition to the other base and special expansion cards.',
      'The local development prototype uses genuine setup with the complete deck, Sandtrout, Ixians and Tleilaxu in Basic or Advanced play. Starting cards, private choices, controls, AI and saved continuation use the normal game paths. Public expansion starts remain disabled pending complete rule and interaction acceptance.',
    ],
    checklist: [
      { area: 'Implementation', status: 'Partial', detail: 'Working prototype with the actual 47-card setup, both expansion factions and Sandtrout. Optional module combinations and remaining printed-card interpretations are unfinished.', evidence: ['game/cards.ts', 'game/engine.ts'] },
      { area: 'Player controls', status: 'Implemented', detail: 'Prototype rooms use the existing private setup, faction, battle-card and special-card controls. Local development initialization preserves the normal release gate.', evidence: ['components/game-table.tsx', 'tools/start-prototype.ts'] },
      { area: 'AI', status: 'Partial', detail: 'All four profiles share the existing legal private actions. Complete-game prototype runs exercise both expansion factions; comprehensive strength calibration remains later work.', evidence: ['game/bots.ts', 'tests/ix-prototype.test.ts'] },
      { area: 'Documentation', status: 'Implemented', detail: 'The prototype setup record separates functional progress, source interpretations and final acceptance.', evidence: ['docs/IX_PROTOTYPE.md'] },
      { area: 'Verification', status: 'Partial', detail: 'Genuine setup, complete prototype games, private views, physical-card custody and saved continuation have targeted checks. This does not certify every combination.', evidence: ['tests/ix-prototype.test.ts', 'tests/prototype-room.test.ts'] },
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
      'The separate fresh ixian-betrayal profile connects both Nexus Betrayal alternatives to those original native attempts. After native counters pass, a neutral acknowledgement precedes the draw or declared Advanced exchange. Use prevents just that attempt: ordinary Bidding count without Ixian inspection, or unchanged hand/lot custody with the Technology declaration still used. All-pass keeps the native advantage. This bounded ordering/privacy convention is an inference, not a universal publisher priority.',
      'The controls preserve decisions and private cards across reconnects. Complete expansion starts, Richese/other auction modes, exact phase-opening ordering, short-deck behavior and interruption timing remain under audit.',
    ],
    related: ['bidding', 'setup', 'ix-forces', 'nexus-ixian-replacement', 'nexus-ixian-betrayal'],
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
      'In the explicitly opted-in Semuta preview with a physical Ix deck, a clean Amal discard pauses after the spice reduction and opening-pass reset. Another holder may claim only the used Amal card; all-seat decline leaves it discarded. Either path restores the same phase-opening confirmation window before bidding, draws or other opening effects begin.',
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
      'A pending spice-card effect that can cross phases and turns. It is included in local Ix prototype setup; normal expansion starts remain gated.',
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
      'A poison weapon with an optional attack on both leaders. It is included in the local Ix prototype deck; normal expansion starts remain gated.',
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
      'The local Ix prototype deals the full expansion deck through genuine setup. Poison Tooth and Artillery Strike have their own topics. Complete rules compliance and combined expansion interactions remain unfinished; prototype access does not open normal expansion starts.',
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
      'Older saved tables that already received their cards keep those cards and their existing unfinished choices. Returning to a table does not restart setup or deal another hand. The six classic factions can start Advanced preview from the lobby while remaining rules and interactions are completed. Expansion starts remain unavailable.',
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
      'In the lobby, choose an unoccupied faction and difficulty, then select Add AI player. Open Configure on an AI seat to change its difficulty, faction or player circle, or remove it before starting. Changes save immediately, keep the same seat and clear human readiness; AI seats remain ready.',
      'Easy uses varied destinations, small deployments and low bids. Medium balances strongholds and spice. Hard uses more conservative battle estimates and targeted Karama responses. Brutal spends more and prioritizes disrupting rivals holding several strongholds.',
      'AI decisions use the same private player view and legal-action checks as human decisions. Difficulty never grants extra spice, hidden cards or access to an opponent’s sealed plan.',
      'Online rooms schedule one AI action at a time with a 1.5-second interval. A response that needs your input waits for you, even when every other seat is AI. Reconnecting preserves the saved AI deadline and seat control; see Online AI action pacing for its verification boundary.',
      'These policies complete Basic games. A balanced study found Easy weaker than the other levels, but did not establish a reliable strength ordering among Medium, Hard and Brutal. Advanced and expansion decisions are still being developed.',
      'Full AI strategy development and strength tuning wait until all other game features are complete. Final targets are approximately 75% wins for Medium against Easy, Hard against Medium, and Brutal against Hard in balanced pairwise matches; these targets have not yet been demonstrated.',
    ],
    related: [
      'setup',
      'privacy',
      'battle',
      'ai-pacing',
      'implementation-checklist',
    ],
    checklist: [
      {
        area: 'Implementation',
        status: 'Partial',
        detail:
          'Integrated: lobby AI seats keep their identity and saved settings. Basic legal participation is connected; final strategies across every faction and module remain unfinished.',
      },
      {
        area: 'Player controls',
        status: 'Implemented',
        detail:
          'Integrated: hosts add, remove and configure permanent AI seats in the lobby. Shared validation preserves identity, available factions/circles and readiness. Final AI strategy and calibration remain missing.',
      },
      {
        area: 'AI',
        status: 'Partial',
        detail:
          'Existing four profiles remain available. Full strategic implementation and adjacent 75% strength targets wait until all non-AI features are complete.',
      },
      {
        area: 'Documentation',
        status: 'Implemented',
        detail:
          'Lobby configuration, readiness resets and the distinction between current profiles and final strength targets are explained here.',
      },
      {
        area: 'Verification',
        status: 'Partial',
        detail:
          'Focused host authority, private views, saved settings, JSON restoration and concurrent-start checks cover configuration. Full AI strategy, multiplayer and calibrated strength acceptance remain unfinished.',
        evidence: [
          'tests/lobby-bot-configuration.test.ts',
          'tests/lobby-bot-configuration-recovery.test.ts',
          'tests/lobby-bot-configuration-http.test.ts',
        ],
      },
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
    related: ['battle', 'alliance-funding', 'ai-pacing', 'seat-ai-permission'],
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
              : phase === 3
                ? ['ix-technology', 'nexus-ixian-betrayal', 'nexus-ixian-replacement', 'richese-cards']
                : phase === 1
                  ? ['card-harvester', 'faction-fremen']
                  : phase === 0
                    ? ['storm-cards', 'advanced-storm-spice', 'faction-fremen']
                    : undefined,
    }),
  ),
  {
    id: 'storm-cards',
    title: 'Storm Cards: forecast and revealed faces',
    category: 'Cards',
    coverage: 'Partial',
    developmentStage: 'Prototyped',
    summary: 'Inspect the six possible faces, your permitted private forecast, and a card already revealed to the table.',
    steps: [
      'The gallery shows the six possible values, one through six. It does not identify a live draw.',
      'Every new Advanced Storm after the first uses these cards, even without Fremen. That does not give another faction Fremen’s private forecast. First-turn dials, Basic and an already recorded saved opening keep their own protocol.',
      'When the table grants Fremen its private forecast, Inspect Storm Card opens that exact face. Other players do not receive the private forecast.',
      'When the card is publicly revealed, its chronicle entry gains an inspector. The recorded face remains available while that entry remains in the chronicle, including after refresh.',
      'The card value and actual movement can differ. Weather Control and Ecological Testing Station do not rewrite the recorded card face. Read the current storm result for the distance actually moved.',
      'Earlier saved chronicle entries without a recorded face retain their text. Inspection is read-only and never draws, plays or reveals another card.',
    ],
    related: ['storm', 'advanced-storm-spice', 'faction-fremen', 'privacy', 'implementation-checklist'],
    checklist: [
      { area: 'Implementation', status: 'Partial', detail: 'Six numeric faces and a public reveal record connect existing Storm Card state to inspection. Inspection itself changes no draw or movement; the later Advanced default is tracked separately. Full component artwork and printed-face verification remain open.', evidence: ['game/storm-cards.ts', 'game/engine.ts'] },
      { area: 'Player controls', status: 'Implemented', detail: 'Private forecasts, public revealed-card chronicle entries and the six-face reference gallery share a keyboard-accessible enlarged inspector.', evidence: ['components/storm-cards.tsx', 'components/game-table.tsx', 'components/rules-reference.tsx'] },
      { area: 'AI', status: 'Implemented', detail: 'Inspection adds no game action or AI decision. Existing forecast authorization, legal choices and profiles remain unchanged.' },
      { area: 'Documentation', status: 'Partial', detail: 'Guidance distinguishes private forecasts, public history, reference examples and modified storm distance. This is not complete physical-component certification.', evidence: ['docs/STORM_CARD_INSPECTION.md'] },
      { area: 'Verification', status: 'Partial', detail: 'Focused checks cover private forecast authorization, public reveal records, saved continuation, original versus modified distance and malformed component rejection. Broader rules and visual acceptance remain separate.', evidence: ['tests/storm-card-inspection.test.ts'] },
    ],
  },
  {
    id: 'nexus-offers',
    title: 'Propose, withdraw and break alliances',
    category: 'Getting started',
    coverage: 'Partial',
    developmentStage: 'Prototyped',
    summary: 'Manage ordinary alliance offers during a Nexus; each partner must agree before an alliance forms.',
    steps: [
      'When a Nexus opens, choose a partner and use Propose / accept alliance. A player who has invited you is marked in the partner list. Both players must be unallied and the current rules must permit the pairing.',
      'Your outgoing offer names its recipient. You remain unallied until the other player agrees. Choose another partner to replace the offer, or use Withdraw your alliance offer to cancel it.',
      'Withdrawal removes only your outgoing offer. Another player’s invitation may remain, and you can still accept it while the Nexus is open. Once allied, use the separate Break alliance action to leave during a Nexus.',
      'The table chronicle records proposals, formation, withdrawals and breaks. Changing an offer clears Nexus readiness so the table can review the updated negotiations.',
      'Refresh restores saved offers and alliances. If acceptance and withdrawal arrive together, only one action is committed; refresh or reconcile a changed table before choosing again. Pending responses and decisions must finish first.',
      'Allied forces, cards and spice keep their owners. Alliance funding and individual faction powers use their own controls; special alliances and expansion restrictions remain separate.',
    ],
    related: ['spice-blow', 'alliance-funding', 'table-discussion', 'privacy'],
    checklist: [
      { area: 'Implementation', status: 'Partial', detail: 'Existing ordinary reciprocal offers, withdrawal and break preserve readiness and configured alliance restrictions. Broader special diplomacy remains unfinished.', evidence: ['game/nexus-alliance.ts', 'game/engine.ts'] },
      { area: 'Player controls', status: 'Implemented', detail: 'Named outgoing offers now have live withdrawal, alongside existing proposal, acceptance and break controls.', evidence: ['components/game-table.tsx'] },
      { area: 'AI', status: 'Partial', detail: 'All four existing profiles can continue legally after withdrawal. Full diplomacy and difficulty tuning remain deferred.' },
      { area: 'Documentation', status: 'Implemented', detail: 'Offer versus alliance, incoming invitations, readiness, refresh and concurrent choices are explained.', evidence: ['docs/NEXUS_OFFERS.md'] },
      { area: 'Verification', status: 'Partial', detail: 'Full-table rendering, JSON continuation, pending-window rejection and SQLite acceptance/withdrawal races are covered. All-configuration and full visual acceptance remain open.', evidence: ['tests/nexus-offer-controls.test.tsx', 'tests/nexus-offer-recovery.test.ts', 'tests/nexus-alliance.test.ts'] },
    ],
  },
  {
    id: 'hand-browsing',
    title: 'Browse your private hand',
    category: 'Getting started',
    coverage: 'Partial',
    developmentStage: 'Prototyped',
    summary: 'Find cards by name or printed category and arrange their display while keeping every physical card and its controls.',
    steps: [
      'Open Your private hand and type part of a card name in Search your hand. Search ignores capitalization, surrounding spaces and accents; punctuation is literal. The result count shows how many of your current cards are visible.',
      'Printed category filters weapons, defenses, Worthless cards, Cheap Heroes or Heroines, and Special cards. These are the cards’ primary printed categories. Flexible battle roles and faction powers still use their normal choices and rules.',
      'Display order offers your saved hand order, Name A–Z or printed category with names within each category. Identical names remain separate physical cards. Choosing Hand order restores their saved sequence.',
      'Show all cards clears the name and category filters while keeping your selected display order. An empty hand has a different message from a search with no matches.',
      'Inspect and play the displayed cards using their existing controls. Required decisions and dedicated effect panels remain outside this filter. Browsing does not play, discard, rearrange the saved hand or change a Battle Plan.',
      'Incoming table updates recalculate the results from the cards you currently own. Filters and display sorting are local to the open hand panel; leaving the tab, changing seats or refreshing resets them. Saved cards and pending game decisions remain intact.',
    ],
    related: ['draw-piles', 'battle-cards', 'privacy', 'nullentropy-search'],
    checklist: [
      { area: 'Implementation', status: 'Implemented', detail: 'Search, printed-category filtering and stable display sorting select only the current owned cards without changing their physical IDs or saved order.', evidence: ['game/hand-browsing.ts'] },
      { area: 'Player controls', status: 'Implemented', detail: 'Native search/category/order controls, result count, clear filters, keyboard scrolling and existing per-card inspectors/actions are connected.', evidence: ['components/hand-browser.tsx', 'components/game-table.tsx'] },
      { area: 'AI', status: 'Partial', detail: 'This local display adds no game action. Existing legal AI participation is unchanged; strategic refinement remains deferred.' },
      { area: 'Documentation', status: 'Implemented', detail: 'Filtering, printed roles, sort order, identical cards, empty states, live changes and refresh behavior are explained.', evidence: ['docs/HAND_BROWSING.md'] },
      { area: 'Verification', status: 'Partial', detail: 'Focused selection and live table rendering cover expansion categories, physical identity, immutable sorting, current-card updates and viewer privacy. Browser and full visual acceptance have separate evidence and limits.', evidence: ['tests/hand-browsing.test.ts', 'tests/hand-browser-controls.test.tsx'] },
    ],
  },
  {
    id: 'draw-piles',
    title: 'Cards and draw piles',
    category: 'Getting started',
    coverage: 'Partial',
    developmentStage: 'Prototyped',
    summary: 'Read the Treachery and Spice draw counts above the board and distinguish them from cards already elsewhere on the table.',
    steps: [
      'Once setup begins, the two draw counts show cards currently in the Treachery and Spice draw piles. Everyone sees the same counts. The numbers follow table updates and refresh without a separate game action.',
      'Cards in hands, the auction pool, separate faction caches and discard piles are outside these draw counts. The ordinary auction’s remaining count includes its current lot. Nexus Cards retain their separate deck and discard counts in the Nexus panel.',
      'Zero means the current draw pile is empty. The existing draw rules may replenish it from eligible discards; the count is not a total of all cards remaining in the game. First-turn worms temporarily set aside rejoin the Spice draw pile when that sequence finishes.',
      'A pile count does not reveal card identities or their order. Inspect your own hand, the public Spice discard tops and any private cards an effect permits you to see using their existing card inspectors.',
      'Treachery discard contents remain private unless an effect permits inspection. A paid Nullentropy Box search uses its own private controls; the draw counts do not grant additional inspection.',
    ],
    related: ['bidding', 'spice-blow', 'nullentropy-search', 'nexus-cards', 'privacy'],
    checklist: [
      { area: 'Implementation', status: 'Implemented', detail: 'Authoritative Treachery and Spice physical draw counts are projected after setup begins, separately from auction, hands and discards.', evidence: ['game/engine.ts'] },
      { area: 'Player controls', status: 'Implemented', detail: 'A read-only display above the board follows live updates and links to this guide.', evidence: ['components/draw-piles.tsx', 'components/game-table.tsx'] },
      { area: 'AI', status: 'Partial', detail: 'Counts add no decision or strategy change. Minimal legal participation remains available; strength tuning waits for feature completion.' },
      { area: 'Documentation', status: 'Implemented', detail: 'Physical pile boundaries, empty/refill behavior and existing inspection permissions are explained.', evidence: ['docs/DRAW_PILES.md'] },
      { area: 'Verification', status: 'Partial', detail: 'Genuine Basic setup, actual auction draws, refill, skipped worms, Thumper exclusion, view privacy, JSON restoration and live component rendering are checked. Complete combined-game and visual acceptance remain open.', evidence: ['tests/draw-piles.test.ts', 'tests/draw-piles-controls.test.tsx'] },
    ],
  },
  {
    id: 'force-counters',
    title: 'Inspect force counters and their locations',
    category: 'Getting started',
    coverage: 'Partial',
    developmentStage: 'Prototyped',
    summary: 'Enlarge faction counters and read public reserves, Tanks, deployed groups and Homeworld breakdowns.',
    steps: [
      'Use Inspect forces beneath any player’s force summary. Everyone can inspect these public counts, including while another player is making a decision. Opening the inspector does not move forces or submit a game action.',
      'Reserves, the Tleilaxu Tanks and each deployed location show physical counters. A special counter is included in that location’s total, not added again. Battle strength, spice support, leaders and temporary powers are separate.',
      'Ixian normal counters are Suboids and their special counters are Cyborgs. Emperor’s special counters are Sardaukar; Fremen’s are Fedaykin. When a table uses combined counts, it does not assign a separate starred count to each location.',
      'Bene Gesserit advisors are the reverse face of the same force counters. A territory’s advisor stance applies across its sectors; advisor counts are included in that territory’s total. Reserves and the Tanks have no deployed stance.',
      'Native Homeworld groups subdivide reserves and are listed separately as a breakdown. Foreign Homeworld deployments are additional locations. Counters inside the Mobile Stronghold remain inspectable before its setup placement; Discovery locations use their names without a map sector.',
      'A concealed No-Field appears as a separate marker with its public location. It counts as one for board presence, but adds no physical counter to this inventory. Its hidden value is not revealed or inferred; revelation draws from the reserves available then.',
      'Refresh restores the saved public groups. The inspector follows table updates while open. Counter illustrations are enlarged original diagrams; the gallery shows component types rather than quantities in a saved game.',
    ],
    related: ['advanced-combat', 'ix-forces', 'advanced-advisors', 'homeworlds', 'richese-no-field'],
    checklist: [
      { area: 'Implementation', status: 'Partial', detail: 'Public physical pools, special subsets, advisor stances, native reserve breakdowns and foreign deployments are projected without changing game state. Full physical-component and rules certification remain open.', evidence: ['game/force-inventory.ts'] },
      { area: 'Player controls', status: 'Implemented', detail: 'Every live player summary opens enlarged force inspection; the internal reference includes all twelve factions.', evidence: ['components/force-inspector.tsx', 'components/game-table.tsx', 'components/rules-reference.tsx'] },
      { area: 'AI', status: 'Partial', detail: 'Read-only inspection adds no game action. Existing minimal legal participation is unchanged; strategy tuning remains deferred.' },
      { area: 'Documentation', status: 'Implemented', detail: 'Physical counts, special identities, advisor faces, Homeworld accounting and concealed markers are explained.', evidence: ['docs/FORCE_INSPECTION.md'] },
      { area: 'Verification', status: 'Partial', detail: 'Focused checks cover all faction identities, public-view equivalence, JSON recovery, physical subsets, Basic Homeworld special identity, unplaced HMS, foreign deployments and concealed-value privacy. Full visual and combined-game acceptance remain open.', evidence: ['tests/force-inventory.test.ts', 'tests/force-inspector.test.tsx'] },
    ],
  },
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
    id: 'revealed-battle-components',
    title: 'Compare revealed battle components',
    category: 'Cards',
    coverage: 'Partial',
    developmentStage: 'Prototyped',
    summary: 'After both plans are public, compare their dials, leaders and played card faces in one shared area.',
    steps: [
      'Use Compare revealed battle plans beside your next decision. Attacker and defender are shown in a stable order with the exact force dial and the played leader’s printed strength. These numbers alone are not the final battle score.',
      'Weapon and original-defense cards show their names, printed categories and gameplay guidance. A Cheap Hero appears in the leader slot. None marks an empty slot. Added after reveal is separate from the original defense; Diplomat and other effect details explain changes without replacing the recorded plan.',
      'Inspect card or Inspect leader enlarges that public component. Return to battle decisions takes you back to the pending controls. Inspection never plays a card, changes a dial or submits a Traitor call.',
      'The shared display stays available while another player owns a post-reveal choice. It does not appear while either plan remains sealed. Private Atreides inspection and unplayed hand cards stay on their separate authorized surfaces.',
    ],
    checklist: [
      { area: 'Implementation', status: 'Implemented', detail: 'One read-only display consumes existing revealed projections, exact used card identities and authorized leaders. No new engine or saved-state behavior.', evidence: ['components/revealed-battle.tsx', 'components/revealed-plan-pieces.tsx'] },
      { area: 'Player controls', status: 'Implemented', detail: 'Public faces, exact dials, direct enlarged inspection and navigation to the decision controls remain available across decision ownership.', evidence: ['components/game-table.tsx', 'app/globals.css'] },
      { area: 'AI', status: 'Implemented', detail: 'The same public components display an AI plan after normal revelation; presentation adds no AI decision or strategy change.', evidence: ['components/revealed-battle.tsx'] },
      { area: 'Documentation', status: 'Implemented', detail: 'The guide distinguishes public disclosure, printed values, original and late slots, private insight and decision ownership.', evidence: ['game/reference.ts', 'docs/REVEALED_BATTLE_COMPONENTS.md'] },
      { area: 'Verification', status: 'Partial', detail: 'Sealed/revealed actions, used-card privacy, JSON rendering, empty/hero/late slots and shared display during another player’s choice have focused tests. Browser and final checkpoint evidence are recorded separately; full visual and interaction acceptance remain open.', evidence: ['tests/revealed-plan-pieces.test.tsx', 'tests/kwisatz.test.ts', 'tests/diplomat-defense-controls.test.tsx', 'tests/spice-banker-controls.test.tsx'] },
    ],
    related: ['battle', 'battle-cards', 'kwisatz-haderach', 'implementation-checklist'],
  },
  {
    id: 'battle-cards',
    title: 'Weapons, defenses and winning cards',
    category: 'Cards',
    coverage: 'Partial',
    summary: 'Build a legal combination and decide what to keep after winning.',
    steps: [
      'Choose one weapon, one defense, both, or neither. A worthless card can occupy a weapon or defense slot.',
      'Choose an available leader or Cheap Hero when required. Without either, battle cards cannot be played. In Advanced, sealing a legal leaderless plan announces that fact to the whole table before reveal; its dial, spice and other choices remain sealed. Refresh retains the same announcement without submitting another plan.',
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
          'Ordinary and typed forces, controlled leaders and Kwisatz return with conserved usage and recovery. Ecaz-only dead shared Duke paid revival and physical Ghola return the same living set-aside disc; exceptional custody and broader expansion combinations remain unfinished.',
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
      'In classic-faction games without optional modules, cancel Guild’s half-price rate before an ordinary reserve shipment, eligible cross-planet transport or Guild return moves any spice or forces. Full destination price applies to the same physical group if the original approved payment split can afford it; otherwise the declaration returns unused and its replacement is full price this turn. The full-price return tariff and unaffordable withdrawal are documented table policies, not printed refund examples. Guild income, permission to cross/return and the independent rate purchased by Karama remain separate.',
      'During shipment, use Guild rates for the active player before they ship. They choose and pay for their shipment at the rounded half rate, paid to the bank. You may provide this benefit for another player; it expires if they move or finish without shipping.',
      'Advanced Bene Gesserit may spend Worthless cards as Karama. Each conversion opens a separate cancellation response; the Worthless card is discarded even if the power is canceled. Normal Karama cards resolve without that conversion response.',
      'A pending Worthless purchase keeps space for its original auction card. Gifts and hand exchanges must leave enough room for every committed incoming card. Refreshing restores the same auction, unused shipment opportunity or original canceled power.',
      'Atreides full-plan inspection, Emperor revival, Fremen’s summoned worm, Harkonnen hand exchange the Guild shipment stop and Tleilaxu revival prevention are implemented as once-per-game uses. Other cancellations and special Karamas are still being implemented.',
      'In the opt-in Kull development preview, another player’s legal ordinary Karama or supported special activation pauses before its costs for CHOAM’s neutral reaction. A declared Kull is pending, not yet a phase ban. Only a different eligible physical Karama can counter it; the original stays reserved. Successful Kull retains the unplayed original, including an advanced Bene Gesserit Worthless card intercepted before conversion, and prevents further Karama activations for that phase. See Kull Wahad for the explicit preview policy and deferred winning-overbid warning.',
    ],
    related: ['bidding', 'battle', 'advanced-combat', 'special-karama', 'choam-kull', 'nexus-choam-kull'],
  },
  {
    id: 'truthtrance-forces',
    title: 'Truthtrance: physical force counts',
    category: 'Cards',
    coverage: 'Partial',
    developmentStage: 'Prototyped',
    summary: 'Ask about current physical counters in reserves, the Tanks or an exact board location.',
    steps: [
      'Choose Current physical forces, then the pool, counter type and an Exactly, At least or At most comparison. A board question names both territory and sector. Available HMS interiors and revealed Discovery locations are separate from their outside territories.',
      'Every physical counter counts once, including advisors. The total includes elites, and the normal count excludes them. Combat bonuses, concealed No-Field markers and their hidden force values do not enter the count.',
      'Reserves includes the native Homeworld reserve breakdown. These controls do not query individual Homeworld populations. A Basic faction whose starred counters are not tracked separately supports only the aggregate total.',
      'Combine the question with another supported fact using AND or OR. Only the respondent sees the expected answer; the published result does not identify which clause matched. Later legal movement or revival does not change this historical answer or break a promise.',
    ],
    related: ['card-truthtrance', 'force-counters', 'truthtrance-spice', 'privacy'],
    checklist: [
      { area: 'Implementation', status: 'Implemented', detail: 'Physical pool comparisons, exact live locations, typed-counter availability and saved fact revalidation are connected.', evidence: ['game/truthtrance-force-count.ts', 'game/truthtrance.ts'] },
      { area: 'Player controls', status: 'Implemented', detail: 'Pool, territory/sector, counter type and numeric comparison share validation with the server.', evidence: ['components/truthtrance-force-count.tsx', 'components/truthtrance.tsx'] },
      { area: 'AI', status: 'Partial', detail: 'All profiles answer the shared private projection legally. Broader questioning strategy and tuning remain deferred.', evidence: ['game/bots.ts', 'tests/truthtrance-force-engine.test.ts'] },
      { area: 'Documentation', status: 'Implemented', detail: 'Source composition, present custody, marker exclusions and remaining question forms are explicit.', evidence: ['docs/TRUTHTRANCE_FORCE_FACTS.md'] },
      { area: 'Verification', status: 'Partial', detail: 'Genuine setup, typed pools, private compounds, live board boundaries, later legal actions, malformed saves, controls and authenticated concurrent answers have focused checks.', evidence: ['tests/truthtrance-force-count.test.ts', 'tests/truthtrance-force-engine.test.ts', 'tests/truthtrance-force-controls.test.tsx', 'tests/truthtrance-force-recovery.test.ts'] },
    ],
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
    id: 'truthtrance-hand-inventory',
    title: 'Truthtrance: hand size and primary card roles',
    category: 'Cards',
    coverage: 'Partial',
    summary:
      'Ask a verified Yes/No question about total hand size or how many held cards have a selected primary role.',
    steps: [
      'Declare Truthtrance, choose Verified cards, traitors or spice, then Hand size or primary card role. Select all cards or a primary role, a comparison and a whole count of zero or more. Review the question before asking.',
      'Count only physical cards currently in the target’s hand, including reserved cards still held there. Decks, discards, separate caches and cards already on the table do not count. Every held physical copy counts once.',
      'Primary roles are the cards’ default roles. Weirding Way is a weapon; Chemistry is a defense. Alternate battle roles do not change these counts. Worthless cards and Cheap Heroes or Heroines are separate categories. Bene Gesserit and CHOAM powers do not turn held Worthless cards into another category.',
      'Richese cards use their printed roles: Stone Burner and Mirror Weapon are weapons; Portable Snooper is a defense. Other Special cards belong to the Special category. A classification question does not make an unfinished card effect available.',
      'Only the target receives the verified answer before answering. Other players see the question and its final aggregate Yes/No answer, without a list of matching cards. An exact comparison answered Yes necessarily confirms that count. AND/OR combinations publish only their combined result.',
      'These are current facts, not promises to keep cards or to use them in battle. All four AI levels answer from their own verified result. Broader freeform questions and future-action commitments remain unfinished.',
    ],
    example:
      'A hand of Weirding Way, Chemistry and Baliset has three cards: one primary weapon, one primary defense and one Worthless card.',
    related: [
      'card-truthtrance',
      'truthtrance-card-count',
      'truthtrance-spice',
      'truthtrance-forces',
      'privacy',
    ],
    checklist: [
      {
        area: 'Implementation',
        status: 'Implemented',
        detail:
          'Validated total and primary-role physical hand counts share the component classification and aggregate fact evaluator.',
      },
      {
        area: 'Player controls',
        status: 'Implemented',
        detail:
          'Role selection, comparison, accessible count input, invalid-input feedback and the exact public question preview.',
      },
      {
        area: 'AI',
        status: 'Partial',
        detail:
          'All four profiles truthfully answer; strategic choice of these questions remains uncalibrated.',
      },
      {
        area: 'Documentation',
        status: 'Implemented',
        detail:
          'Explains hand custody, default roles, alternate uses, private aggregation and current-fact lifetime.',
      },
      {
        area: 'Verification',
        status: 'Partial',
        detail:
          'Focused role, engine, privacy, AI, JSON and persisted concurrent-answer checks; no complete mode certificate.',
        evidence: [
          'tests/truthtrance-hand-inventory.test.ts',
          'tests/truthtrance-spice-recovery.test.ts',
        ],
      },
    ],
  },
  {
    id: 'truthtrance-knowledge',
    title: 'Truthtrance: recorded predictions and storm knowledge',
    category: 'Cards',
    coverage: 'Partial',
    developmentStage: 'Prototyped',
    summary: 'Ask about the target’s recorded Bene Gesserit prediction, submitted storm dial or currently known Fremen storm card, with a single fact or an AND/OR combination.',
    steps: [
      'Choose a recorded prediction faction, compare its turn, or compare the target’s current submitted storm dial or known Fremen forecast. Exactly, at least and at most are available for numeric facts.',
      'These questions describe a choice already recorded or information currently known. They do not require anyone to win on a future turn, change a choice, or make the storm move a promised distance.',
      'A missing prediction, an unsubmitted or expired storm dial, or an unknown forecast yields I don’t know. A forecast question never gives another faction the Fremen’s private knowledge.',
      'Only the target sees the verified answer before replying. The published response gives the combined result, without identifying which clause matched or separately displaying the stored values.',
      'As with other Truthtrance questions, an unknown answer lets the holder ask something else or save the card. A definite answer spends the physical card once and restores the interrupted interaction.',
    ],
    related: ['card-truthtrance', 'truthtrance-spice', 'privacy'],
    checklist: [
      { area: 'Implementation', status: 'Partial', detail: 'Stored prediction and entitled current storm knowledge use shared three-valued fact evaluation; no future commitment or unknown deck lookup.', evidence: ['game/truthtrance-knowledge.ts', 'game/truthtrance.ts', 'game/engine.ts'] },
      { area: 'Player controls', status: 'Partial', detail: 'Four fact choices, numeric comparisons, public faction names, bounded inputs and compound question previews.', evidence: ['components/truthtrance-knowledge.tsx', 'components/truthtrance.tsx'] },
      { area: 'AI', status: 'Partial', detail: 'All four profiles answer the owner-only verified scalar through the existing Truthtrance flow. Strategic question selection and freeform understanding remain incomplete.', evidence: ['game/bots.ts', 'tests/truthtrance-knowledge.test.ts'] },
      { area: 'Documentation', status: 'Partial', detail: 'Current-knowledge semantics, unknown cases and original FAQ authority are explicit.', evidence: ['docs/TRUTHTRANCE_KNOWLEDGE.md'] },
      { area: 'Verification', status: 'Partial', detail: 'Focused rules, UI, compound privacy, bots, JSON and production SQLite restoration; broader Truthtrance acceptance remains open.', evidence: ['tests/truthtrance-knowledge.test.ts', 'tests/truthtrance-knowledge-controls.test.tsx', 'tests/truthtrance-knowledge-recovery.test.ts'] },
    ],
  },
  {
    id: 'truthtrance-shipment',
    title: 'Truthtrance: shipment promises',
    category: 'Cards',
    coverage: 'Partial',
    summary:
      'Bind a shipment from reserves to a named territory with a minimum physical force count during the active supported shipment opportunity.',
    steps: [
      'Declare Truthtrance, select the active player and choose Bind a shipment from reserves. Choose a printed destination and minimum of one to twenty forces, or combine two shipment conditions using AND or OR. Each describes the same shipment. Automatic enforcement supports base Basic games and base Advanced games without Guild or optional modules, before that player ships and after pending decisions finish.',
      'Yes requires the complete statement to match while possible: all AND conditions or at least one OR condition. No requires the whole statement to be false: at least one AND condition false, or every OR condition false. A smaller count, different destination, transport of forces already on the board or no shipment may satisfy No. Forces already in the destination and ground movement do not satisfy the question. Fremen reinforcements and Guild transport from southern reserves do count.',
      'The target privately sees feasible answers based on their own resources and earlier promises. Available Ghola revival, Karama discounts, incoming pledged aid and reclaiming their own unused pledge are included. Other players’ unplayed cards and future voluntary gifts are not assumed.',
      'Accepted whole answers are public and constrain the event together with earlier promises. When an answer requires a shipment, honor it before ground movement or finishing and do not voluntarily spend away the last legal completion. A completed opposing effect that makes compliance impossible releases it publicly.',
      'Choose Mixed current fact and shipment for nested AND/OR groups of supported current facts and this-turn reserve shipments. Current facts freeze privately when answered: Yes OR a true current fact can allow skipping even after later losing that holding; No AND a false current fact can allow shipping even after that fact changes. Unknown is not false. Only the whole question and answer are public.',
      'Your own promises show the original grouped question, not private compiled clause results. Optional private next-step guidance includes preparation, funding or shipment. All four legal policies use server-feasible choices and the same complete route. Earlier phases, Advanced Guild/other modules, expansion shipment modes, other future actions and arbitrary prose enforcement remain unfinished.',
    ],
    example:
      'Yes to at least six forces to Carthag and No to at least eight there leaves a shipment of six or seven. Moving existing forces into Carthag does not fulfill either shipment event.',
    related: ['card-truthtrance', 'movement', 'alliance-funding', 'privacy'],
    checklist: [
      {
        area: 'Implementation',
        status: 'Partial',
        detail:
          'Authoritative supported reserve-origin commitments, shipment and mixed current-fact AND/OR, frozen private clause values, joint legal preparation, actual shipment/skip, voluntary-spend guards and opposing release. Broader timing and expansion routes remain unfinished.',
      },
      {
        area: 'Player controls',
        status: 'Implemented',
        detail:
          'Single shipment questions and complete bounded nested mixed authoring, grouped public preview, target-private feasible answers, original-question promise text and optional private next steps.',
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
          'tests/compound-shipment-promises.test.ts',
          'tests/compound-shipment-bots.test.ts',
          'tests/compound-shipment-controls.test.tsx',
          'tests/compound-shipment-recovery.test.ts',
          'tests/mixed-shipment-question.test.ts',
          'tests/mixed-shipment-engine.test.ts',
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
      'Ask another player a public yes/no question. Verified facts, supported shipment promises, current-battle plan commitments, freeform answers and saving an unanswered card are supported; arbitrary promise enforcement is unfinished.',
    steps: [
      'Declare the card from your hand at any time after cards are dealt. Other players may declare a competing Truthtrance or pass; questions are then asked in storm order. The interrupted phase, response, or battle decision resumes afterward.',
      'Ask a game-related yes/no question. Named-card, selected-traitor and current personal-spice questions are checked by the server. AND and OR combine facts; only the combined answer is published, with no extra inventory details or separate answer for each clause.',
      'For current spice, choose Exactly, At least or At most and a nonnegative whole amount. This counts spice personally held when answering, excluding separately pledged aid and incoming payments. It does not ask whether a particular action is affordable or promise that the balance will stay unchanged. A true current-spice answer does not prevent later legal spending.',
      'The questioned player answers publicly. A definite answer discards the card. If the answer cannot be known, the holder may ask a different question or save Truthtrance for later.',
      'A saved definite answer resumes automatically: its public answer, binding promise and consumed card are recorded once, then the next queued question or interrupted action resumes. Private answer and preparation guidance is unavailable during this automatic recovery.',
      'Freeform questions also accept public Yes, No, or I don’t know answers. Their truthfulness relies on the players. AI answers structured facts and battle-plan questions; it cannot yet interpret freeform questions.',
      'An answer may bind actions or decisions during the current turn only. The answering player must do everything in their power to comply; if compliance later becomes impossible, the answer is no longer binding. Freeform promises are recorded in the table’s turn history. Arbitrary freeform enforcement and broader action commitments remain unfinished. Structured reserve-shipment promises are enforced for the active unused shipment in base Basic and no-Guild Advanced games; see the shipment promise guide.',
      'Battle-plan questions can bind dial values or ranges, named weapon/defense slots, a leader or either Cheap Hero, spice support and Kwisatz use. AND/OR combinations preserve legal alternatives. Only answers with a legal completion now or through available Ghola preparation are offered; a sealed plan fixes its answer. Previous battle commitments, Voice and prescience also apply. Private preparation guidance can play a required Ghola, then a compliant-plan example can fill the form for review before sealing.',
      'If a completed opposing power makes a battle answer impossible, it is publicly released. A pending Voice response resolves before that release. A player cannot voluntarily spend a promised battle card or give away necessary support spice to evade the answer. Feasibility includes available Ghola cards, eligible leader/Kwisatz or force revivals, and possible revival income. Each actual card can be spent only once. Other future card/power sequences and the full timing audit remain unfinished.',
      'Holding both copies lets you declare one or both. Each question resolves separately, and each card is discarded only after its definite answer. Full timing and card-face audits remain pending.',
    ],
    related: [
      'battle',
      'privacy',
      'truthtrance-spice',
      'truthtrance-forces',
      'truthtrance-card-count',
      'truthtrance-hand-inventory',
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
      steps: FACTION_RULES[f.id].basic,
      related: [
        'setup',
        'battle',
        `advanced-${f.id}`,
        'faction-sheets',
        ...(f.id === 'richese' ? ['richese-cards', 'richese-no-field', 'richese-gift', 'richese-acquisition'] : []),
        ...(f.id === 'choam' ? ['choam-auditor', 'choam-worthless', 'choam-kull', 'nexus-choam-kull', 'choam-combat'] : []),
        ...(f.id === 'ecaz'
          ? ['ecaz-loyalty', 'ecaz-ambassadors', 'duke-vidal', 'implementation-checklist']
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
        'ecaz',
      ].includes(id)
        ? 'Partial'
        : 'Planned',
      summary:
        'Advanced faction rules. The six classic factions can use the unfinished Advanced preview; complete rules compliance remains under verification.',
      steps: rules.advanced,
      related: [`faction-${id}`, 'advanced-combat', ...(id === 'ecaz' ? ['ecaz-loyalty'] : [])],
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
      'Current development support includes Moritani acquisition, Ecaz Ambassador self-acquisition, consensual alliances, a Basic optional new-ally loan, one-battle use, and Ecaz-only revival to living set-aside custody. The new loan uses provisional one-battle and unused-living turn-end set-aside policies. Native ordinary-disc skills coexist with Duke without assigning him a skill. Advanced loans, shared skill assignment and captured-leader interactions remain for later work; this does not certify complete modes.',
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
      'Six hidden tokens threaten stronghold entrants. Bounded Atomics revelation is available in classic-plus-Moritani tables; complete Moritani starts remain unavailable.',
    steps: [
      'Placement and isolated entry decisions have controls for Robbery, Sabotage, Sneak Attack, Extortion, ordinary native-leader Assassination and bounded Atomics. You may instead leave a token hidden. Arrivals with unsupported competing reactions remain gated; Moritani starts remain disabled.',
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
      'Robbery, Sabotage, Sneak Attack, ordinary native-leader Assassination, Extortion and bounded Atomics have controls for supported entry reactions. After a Robbery draw, finish any required discard; after Sabotage, give one of your own cards or decline. Enemy of My Enemy has partial alliance controls. Complete Moritani games remain unfinished.',
      'Assassination: randomly select one of the entrant’s leaders and send it to the Tanks. Moritani collects spice for that leader’s value; Zoal pays three. Revealing the token resolves the random selection without letting Moritani choose a victim. This token needs neither a battle loss nor a matching Traitor Card. Current controls support ordinary native leaders; unresolved captured, foreign or special-leader pools block revelation and show Moritani the reason privately.',
      'Atomics: send every faction’s forces in the territory to the Tanks and place public Atomics Aftermath there. Supported revelation is limited to classic-plus-Moritani without Guild, Ecaz or optional modules and with a stable Moritani alliance. Its lasting shipment prohibition and hand-limit penalty are explained in the Aftermath topic.',
      'Extortion: set aside five spice from the bank for collection during Mentat Pause. After collection, recover this token unless one player pays you three spice in the storm-order opportunity. The Extortion topic explains the two separate payments.',
      'Robbery: choose between taking half the entrant’s spice, rounded up, and drawing the top Treachery Card. If the draw exceeds your hand limit, choose a card to discard afterward; a full hand does not remove the draw option.',
      'Sabotage: randomly draw and discard a Treachery Card from the entrant if possible. Then you may give that player a card of your choice from your own hand. Giving a card is optional.',
      'Sneak Attack: send up to five of your reserve forces into the triggered territory at no cost, respecting storm and occupancy restrictions. This particular entry is allowed even when Atomics Aftermath is present.',
      'Before revealing Sneak Attack, inspect its private available maximum and any reason positive entry is blocked. You may keep it hidden. Revealing spends the token even if you then choose Send no forces. For a supported entry, select zero through the displayed maximum; forces enter the arrival’s territory and sector without consuming your ordinary shipment or movement turn. Zero remains available when positive entry is blocked. Aftermath’s printed exception allows this reserve entry even after Atomics resolves. A positive entry during Shipment and Movement is treated as an off-planet shipment for the Heighliners token, which accrues its once-per-turn income for its owner, and the committed entry finishes before Bene Gesserit may answer it with an Intrusion choice or a free spiritual-advisor shipment.',
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
    coverage: 'Partial',
    summary:
      'Bounded Atomics reveals destroy the territory’s forces, prohibit future shipment there, and reduce hand limits.',
    steps: [
      'On a supported classic-plus-Moritani table without Guild, Ecaz or optional modules, revealing Atomics sends every faction’s forces in the triggered territory to the Tanks and places a public Atomics Aftermath marker there. Hidden tokens remain face down until revealed.',
      'Aftermath permanently prohibits shipping forces into that territory, including Fremen reinforcements. The restriction is on shipment: it does not prohibit otherwise legal ordinary movement into the territory.',
      'Sneak Attack expressly permits its reserve forces to enter despite Aftermath. Its storm and occupancy restrictions still apply.',
      'Beginning on the activation turn, Moritani’s hand limit and its ally’s at activation are each reduced by one. If either hand exceeds its reduced limit on resolution, discard one random card per excess card. The public Aftermath notice identifies the affected players; their individual projected hand limits reflect the penalty.',
      'The lasting penalty’s treatment after a later alliance change is unresolved. Supported play gates later Moritani alliance changes rather than guessing whether the penalty remains with an old ally or follows a new one.',
      'The Atomics Terror token and Family Atomics Treachery Card are separate components with different effects. Aftermath is not the destroyed Shield Wall. Complete Moritani games and public expansion starts remain unavailable.',
    ],
    related: ['moritani-terror-effects', 'movement', 'card-atomics', 'bidding'],
  },
  {
    id: 'moritani-extortion',
    title: 'Moritani Extortion: collection and recovery',
    category: 'Advanced & expansions',
    coverage: 'Partial',
    summary:
      'Five deferred bank spice and a separate opportunity to prevent the token’s return.',
    steps: [
      'Revealing Extortion sets aside five spice from the bank in front of Moritani’s shield. Moritani collects it during Mentat Pause; it is not available to spend when the token is revealed.',
      'For this table’s selected timing, Moritani’s normal Mentat Terror placement or relocation opportunity resolves first, including any Karama response. Only afterward does Moritani collect the five spice and offer the Extortion payment opportunity. A token recovered afterward cannot be placed again during that same Mentat Pause.',
      'If Extortion is revealed during Mentat after placement has already finished, resolve that committed entry and its interruptions first. Then collect the bank award and offer payment before any player can end the turn.',
      'After collection, each non-Moritani player in storm order may pay Moritani three spice or decline. A player without three spice cannot pay but may decline. The first payment permanently removes Extortion from play and ends the offers; it does not undo the bank award.',
      'If every eligible player declines, rotate Extortion and return it face down to Moritani’s hidden supply for a future placement. Other revealed Terror tokens have no corresponding recovery provision.',
      'These controls cover Extortion collection, the payment choice and return or removal, not complete Moritani expansion games. Public module starts remain unavailable.',
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
      'Accepting the alliance does not immediately remove shared forces. In Advanced, the ending player’s own shared fighters go to Tanks at each Shipment and Movement end, including this formation turn, unless a normal exception applies. Basic retains the later-player deadline on the following turn. This does not change the offer’s formation timing or open unsupported entry combinations.',
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
    coverage: 'Partial',
    developmentStage: 'Prototyped',
    summary:
      'An opted-in Advanced Moritani preview reveals a different opposing-faction Traitor Card after a loss and replaces it during Mentat Pause.',
    steps: [
      'After you lose a battle, this advanced advantage is available only if the opposing leader disc survived and no Traitor was called.',
      'You may reveal a Traitor Card for that opposing faction, but it must name a different leader from the one you just fought. If that named leader is not in the Tanks, kill it and collect spice for its value.',
      'An already-dead named leader remains a legal reveal, awarding no death or spice. During Mentat Pause, set the revealed card aside face up as a marker and draw a new Traitor Card. You can use this advantage only once against each faction in the game.',
      'The authorized revised Advanced PDF, physical page35, requires that you have not revealed your Traitor Card normally this game. A normal own-card reveal therefore forfeits Assassinate Leaders for the rest of this game, across turns and opponents. Existing state preserves that forfeiture; Karama has no effect against the ability. This is the authorized source, not a new GF9 erratum.',
      'If Harkonnen has captured your own leader and you hold its Traitor Card, you may call that traitor normally; you may not use Assassinate Leaders on that basis.',
      'Terror Assassination chooses a random leader when its token is triggered. It does not use this battle-loss condition, different-leader Traitor Card or once-per-faction allowance. Moritani starts remain unavailable in Basic and Advanced.',
    ],
    checklist: [
      {area:'Implementation',status:'Partial',detail:'Explicit Advanced Moritani/base-opponent preview before any normal traitor call; native disc deaths, printed bounty, dead-target zero bounty and exact Mentat replacement.',evidence:['game/moritani-assassinate.ts','game/engine.ts']},
      {area:'Player controls',status:'Partial',detail:'Uniform private choice/decline, named target and bounty, public face-up markers and readable inspection; normal activation awaits private-step UX decision.',evidence:['components/moritani-assassinate.tsx','components/game-table.tsx']},
      {area:'AI',status:'Partial',detail:'All four profiles choose from the owner-only quote or decline; no hidden rival data or strength-calibration claim.',evidence:['game/bots.ts','tests/moritani-assassinate-engine.test.ts']},
      {area:'Documentation',status:'Partial',detail:'Printed effect and authorized Advanced game-long normal-reveal forfeiture are explicit; exceptional leader custody, private-step UX and optional-module boundaries remain open.',evidence:['docs/MORITANI_ASSASSINATE_LEADERS.md','docs/RULE_DECISIONS.md']},
      {area:'Verification',status:'Partial',detail:'Rules, controls, genuine-setup staged battles, private views, authenticated recovery, concurrent writes and physical replacement chains; full faction acceptance remains open.',evidence:['tests/moritani-assassinate-quote.test.ts','tests/moritani-assassinate-engine.test.ts','tests/moritani-assassinate-controls.test.tsx','tests/moritani-assassinate-recovery.test.ts']},
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
      'The combat engine now distinguishes ordinary and elite tokens, accepts half-strength dials and seals spice support with the battle plan. The unfinished Advanced preview is available for the six classic factions while other Advanced rules are completed.',
      'One spice supports one token at its full strength. Unsupported tokens fight at half strength. Fremen uses full strength without spice; Sardaukar counts as ordinary against Fremen.',
      'After resolution, casualties must match both the dial and spice spent. One legal ordinary/elite allocation settles automatically; several legal allocations ask the winner to choose. The losing army is destroyed. Only a traitor winner avoids its committed spice payment.',
      'Elite tokens are tracked in reserves, territories and tanks. Normal revival, Ghola and the Emperor’s extra revival all share the limit of one elite revival per faction per turn.',
      'Atreides privately tracks losses and can add KH to a sealed plan after seven battle losses. The accompanying leader or Cheap Hero gains two strength if it survives, and cannot turn traitor. KH can be used in only one territory per turn.',
      'Before sealing plans, the table offers separate Karama responses for doubled elite strength and Fremen’s free spice support. Canceling elite strength makes those tokens fight as ordinary forces for this battle; it does not change their token type. Canceling free support makes Fremen pay spice or fight at half strength. Sardaukar already fights as ordinary against Fremen.',
      'The KH cancellation window does not disclose Atreides’ activation status or selected plan. Canceling prevents both its bonus and its traitor protection in this battle.',
    ],
    example:
      'An Emperor army with one Sardaukar and five ordinary forces dials 3 and spends 1 spice. It may lose the supported Sardaukar and two unsupported ordinary forces, or one supported ordinary force and four unsupported ordinary forces.',
    related: ['battle', 'revival', 'automatic-casualties', 'kwisatz-haderach'],
  },
  {
    id: 'kwisatz-haderach',
    title: 'Kwisatz Haderach: companion and loss track',
    category: 'Advanced & expansions',
    coverage: 'Partial',
    developmentStage: 'Prototyped',
    summary: 'Inspect the Atreides battle companion, its rules and your private battle-loss progress.',
    steps: [...KWISATZ_RULES],
    related: ['faction-atreides', 'advanced-combat', 'revival', 'card-ghola', 'card-karama'],
    checklist: [
      { area: 'Implementation', status: 'Partial', detail: 'Existing activation, battle inclusion and revival remain authoritative. The original component face and private loss track connect to inspection; combined-module and final physical-component verification remain open.', evidence: ['game/kwisatz-display.ts', 'game/engine.ts'] },
      { area: 'Player controls', status: 'Implemented', detail: 'Private Atreides status and battle composition, authorized full-plan inspection, public revealed plans and the reference share an enlarged component inspector.', evidence: ['components/kwisatz-inspector.tsx', 'components/game-table.tsx', 'components/battle-component-inspection.tsx'] },
      { area: 'AI', status: 'Partial', detail: 'Existing legal battle and revival participation is unchanged. Strength tuning remains deferred until all non-AI features are complete.', evidence: ['game/bots.ts', 'tests/kwisatz.test.ts'] },
      { area: 'Documentation', status: 'Implemented', detail: 'Internal guidance explains activation, territory limits, conditional strength, protection, death and separate revival. Private progress is never inferred from a public plan.', evidence: ['game/kwisatz-display.ts', 'docs/KWISATZ_INSPECTION.md'] },
      { area: 'Verification', status: 'Partial', detail: 'Focused checks cover private versus public views, sealed/revealed plan inspection, JSON restoration, availability labels and the separate companion asset. Full Advanced and combination acceptance remains open.', evidence: ['tests/kwisatz.test.ts', 'tests/kwisatz-inspection.test.tsx'] },
    ],
  },
  {
    id: 'advanced-storm-spice',
    title: 'Advanced storms and double spice blow',
    category: 'Advanced & expansions',
    coverage: 'Partial',
    summary:
      'Post-first-turn Storm Deck in every Advanced roster, native Fremen forecasts, two spice piles and worm responses.',
    steps: [
      'Advanced normally uses these phase rules, not an extra source profile. The adopted unofficial revision changes later Storm determination; it is not a publisher clarification or complete-mode certification. The six classic factions can start the unfinished Advanced preview while remaining powers are completed.',
      'Resolve blow A, its worms, Harvester window, Nexus and rides, then do the same for blow B. Each pile uses its own previous discard. First-turn worms are set aside and shuffled back only after both blows finish.',
      'Keep the first storm’s two secret nearby-player dials, each zero through twenty. Every later newly opened Advanced Storm draws a random card from one through six, including without Fremen. The last revealed face is eligible again next time. A saved current dial or card opening finishes as recorded; returning to the table never rerolls it.',
      'After the first storm, native Fremen privately learns the actual card for the next turn. Canceling foresight hides that card from Fremen without changing its eventual distance. Without Fremen, nobody gets a forecast or a foresight response. Weather Control may replace a revealed distance before movement without changing the recorded card face.',
      'Fremen storm losses are half the exposed group, rounded up. Choose ordinary and Fedaykin casualties when more than one combination is possible. A legal reserve shipment into storm applies this loss only to the arriving group.',
      'Fremen may place additional worms from a spice blow in a sand territory. Canceling this placement prevents further additional-worm placements for the rest of the turn. Ordinary worm appearances and their Nexus still resolve.',
      'Fremen worm survival and optional allied protection have separate responses before casualties. Canceling Fremen survival destroys the Fremen forces at that worm’s location and removes that ride; it does not cancel an allowed protection of allied forces.',
    ],
    checklist: [
      { area: 'Implementation', status: 'Partial', detail: 'New post-first Advanced Storm openings use the canonical six-card source in every roster; first dials, native foresight and recorded current openings retain their own protocol. Wider Advanced interactions remain incomplete.', evidence: ['game/engine.ts', 'game/storm-cards.ts'] },
      { area: 'Player controls', status: 'Partial', detail: 'Controls follow the current recorded dial or card opening. Public card inspection does not grant a private forecast; pending responses keep priority.', evidence: ['components/game-table.tsx', 'components/storm-cards.tsx'] },
      { area: 'AI', status: 'Partial', detail: 'Legal Storm participation follows the projected opening, including recorded dials and no-Fremen cards. Strategy calibration and full-mode acceptance remain separate.', evidence: ['game/bots.ts'] },
      { area: 'Documentation', status: 'Implemented', detail: 'Internal guidance distinguishes the authorized unofficial Advanced default, unchanged Basic rules, first dials, native forecasts and saved continuation.', evidence: ['docs/RULE_DECISIONS.md', 'docs/BASE_ADVANCED_READINESS_20260907.md', 'docs/STORM_CARD_INSPECTION.md'] },
      { area: 'Verification', status: 'Partial', detail: 'Focused native and authenticated SQLite checks cover fresh no-Fremen cards, first dials, a genuinely captured prior Advanced dial opening, forecast privacy and unchanged Basic continuation. Actual phone inspection and confirmation continued a saved no-Fremen card opening; broader Advanced and deployment acceptance remain open.', evidence: ['tests/advanced-source-engine.test.ts', 'tests/advanced-source-recovery.test.ts', 'tests/advanced-source-controls.test.tsx', 'tests/bot-advanced-source.test.ts', 'docs/STORM_CARD_INSPECTION.md'] },
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
    id: 'advanced-allied-separation',
    title: 'Advanced alliances: ending shared occupation',
    category: 'Advanced & expansions',
    coverage: 'Partial',
    summary: 'Each ending player loses its own shared fighters; advisor coexistence, Polar Sink and native Ecaz coexistence are exempt.',
    steps: [
      'Under the adopted unofficial Advanced revision, finish each player’s Shipment and Movement separately. Your own fighters still sharing a territory with your ally go to Tanks when your turn ends. Your ally’s fighters stay; its later turn does not postpone your loss. An alliance formed this turn has no Advanced grace period.',
      'Polar Sink is exempt. If either allied group is Bene Gesserit advisors, coexistence sends neither group to Tanks. Bene Gesserit fighters have no advisor exemption. Native Ecaz peaceful coexistence keeps its own conditions, including applicable Karama effects.',
      'Before an ordinary finish, the table warns which public territories would lose your forces. It does not reveal force amounts or concealed No-Field values. Finish movement uses the existing action, without another loss confirmation. If no legal escape is available, you may still finish and accept the mandatory consequence.',
      'Complete any pending shipment, movement, arrival or response before ordinary finish controls become available. Extra-move and deferred-turn endings use the same separation rule; they do not replay the arrival or charge shipment again.',
      'Basic still uses its existing later-player deadline and formation-turn exemption, without this advisor exception. Homeworlds are outside this Dune-territory rule and keep their native allied-entry restrictions. The rule grants no new allied-entry permission or alliance formation window, and completed turns are not reevaluated.',
    ],
    checklist: [
      { area: 'Implementation', status: 'Partial', detail: 'One canonical separation quote distinguishes Basic from Advanced timing and exceptions; native ending-group custody remains responsible for physical losses.', evidence: ['game/allied-separation.ts', 'game/engine.ts'] },
      { area: 'Player controls', status: 'Partial', detail: 'The own clean-turn warning contains public loss territories only; forced loss adds no action or confirmation and shared pending-control locks retain priority.', evidence: ['components/game-table.tsx'] },
      { area: 'AI', status: 'Partial', detail: 'All four legal policies use native projected movement/ending availability and can finish with mandatory loss; no duplicate separation calculator or strategic alliance calibration was added.', evidence: ['game/bots.ts', 'tests/bot-advanced-source.test.ts'] },
      { area: 'Documentation', status: 'Implemented', detail: 'The unofficial per-player/advisor departures are distinguished from the earlier publisher/FAQ and unchanged Basic policy.', evidence: ['docs/ALLIED_TRANSIT_RULES.md', 'docs/RULE_DECISIONS.md', 'docs/BASE_ADVANCED_READINESS_20260907.md'] },
      { area: 'Verification', status: 'Partial', detail: 'Genuine native overlaps cover first/later newly allied ends, exact normal/elite custody, Hajr, advisor/Ecaz/Polar exceptions and unchanged Basic policy. Authenticated SQLite covers restart, races, privacy and immutable rejects. Actual phone ending moved only the ending group to Tanks and refresh retained it; wider combinations, full modes and deployment remain open.', evidence: ['tests/allied-separation.test.ts', 'tests/advanced-source-engine.test.ts', 'tests/advanced-source-recovery.test.ts', 'tests/bot-advanced-source.test.ts', 'docs/ALLIED_TRANSIT_RULES.md'] },
    ],
    related: ['movement', 'spice-blow', 'advanced-advisors', 'ecaz-ambassadors', 'homeworlds'],
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
      'The separately marked fresh native Ecaz Homeworld preview has another printed route: native Ecaz must currently have at least seven reserves, the reciprocal alliance must jointly hold one actual uncontested stronghold, and it must occupy worlds of two other native factions. Two Emperor worlds count as one faction. This joins normal winners before a correct BG prediction or final-turn fallback; it adds no ordinary stronghold points.',
      'Opposing forces may survive together in a stronghold covered by storm. That contested stronghold does not count for either side. A sole occupant still counts it even under storm.',
      'A correct Bene Gesserit faction-and-turn prediction replaces a normal win, including an allied win, with a Bene Gesserit solo win. Guild and Fremen special wins cannot be predicted.',
      'On turn ten, a normal stronghold victory comes first. Otherwise, check Fremen’s special condition, then award the game to Guild and its ally if present. If Guild is absent, Fremen and its ally win even when the usual Fremen special condition fails.',
      'When neither Guild nor Fremen is playing and nobody has reached the normal target, compare individual qualifying stronghold counts. Every player tied for the highest count wins. A correct Bene Gesserit prediction can replace this stronghold win.',
      'With tech tokens enabled, owning all three adds one stronghold. One player must hold all three, even in an alliance. If several sides reach their target at the same check, they share a normal win before any correct prediction replaces it.',
      'The table’s Stronghold victory progress shows current qualifying territories, a complete Tech Token set, Ecaz joint occupation and Fremen’s final-turn conditions. Allied Ecaz and Fremen may co-occupy Sietch Tabr without blocking that special win; solitary or non-allied Ecaz does not receive this exception. Tech Tokens cannot supply a jointly occupied territory. These public counts do not resolve a private prediction or award victory before the proper checkpoint.',
      'Other expansion additions to victory remain in development. Advanced preview supports the six classic factions; expansion starts remain disabled.',
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
    id: 'fremen-ecaz-endgame',
    title: 'Fremen and Ecaz: the final-turn exception',
    category: 'Advanced & expansions',
    coverage: 'Partial',
    developmentStage: 'Integrated',
    summary: 'Allied Ecaz and Fremen may share Sietch Tabr while qualifying for the Fremen special victory.',
    steps: [
      'At the final-turn victory check, ordinary stronghold victories come first. If none qualifies, Fremen’s special occupation conditions are checked before the Guild fallback. A qualifying Fremen victory includes its ally and is not replaced by a Bene Gesserit prediction.',
      'Ecaz and Fremen must be current reciprocal allies and both have fighters in Sietch Tabr. Their co-occupation does not block the Fremen special condition. Ecaz alone, non-allied Ecaz or another faction’s fighters still block it. Accompanying Bene Gesserit advisors do not count as fighters.',
      'Habbanya Sietch retains its existing empty-or-Fremen condition; extending the Ecaz exception there is not yet supported. Tuek’s Sietch must contain no Atreides, Harkonnen or Emperor presence, and Advanced play also excludes Richese presence. A concealed No-Field counts without revealing its hidden value.',
      'The public victory guide lists the three territories and any blocking factions. It uses the same settled-board facts as automatic victory resolution. No extra confirmation is required; the table chronicle explains a successful special victory.',
    ],
    checklist: [
      { area: 'Implementation', status: 'Partial', detail: 'The source-confirmed Sietch Tabr exception is connected in Basic and Advanced. Habbanya symmetry and broader expansion acceptance remain incomplete.', evidence: ['game/fremen-victory.ts', 'game/victory-quote.ts', 'game/engine.ts'] },
      { area: 'Player controls', status: 'Implemented', detail: 'Read-only public territory conditions and blockers; victory resolves at the existing checkpoint without a new decision.', evidence: ['components/victory-progress.tsx', 'components/game-table.tsx'] },
      { area: 'AI', status: 'Partial', detail: 'All four profiles reach the automatic outcome through legal final-turn actions. Strategic defense of this allied exception is not separately calibrated.', evidence: ['tests/fremen-ecaz-victory-engine.test.ts'] },
      { area: 'Documentation', status: 'Implemented', detail: 'The explicit FAQ exception is separated from the unsupported Habbanya extension.', evidence: ['docs/ECAZ_VICTORY_RULES.md', 'game/reference.ts'] },
      { area: 'Verification', status: 'Partial', detail: 'Public presence, precedence, all-profile continuation, JSON and authenticated SQLite recovery are covered. Final-turn positions are explicitly staged after genuine setup.', evidence: ['tests/fremen-victory.test.ts', 'tests/fremen-victory-controls.test.tsx', 'tests/fremen-ecaz-victory-engine.test.ts', 'tests/fremen-ecaz-victory-recovery.test.ts'] },
    ],
    related: ['victory', 'faction-fremen', 'faction-ecaz'],
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
      'Fresh Advanced local development tables may combine all fourteen Leader Skills with Stronghold Cards in classic or supported Ixian, Tleilaxu, CHOAM and Richese skill rosters, two through six players; optional Tech Tokens needs three through six. Original deck/cache and end-Mentat claims remain. Arrakeen pays bank support, not personal income; only the remaining actual payer debit qualifies separate normal Banker income. Skill rescue preserves the original support charge, then card cleanup and Tech reward finish before Face Dance. Modified/copied Diplomat defenses and active skill/Stone interpretations stay guarded; public activation, E3/other overlays and save conversion remain separate.',
      'The original standalone Ecaz or Moritani skill roster additionally supports these Advanced combinations with the exact ecaz deck, original five-disc training and native exclusions. Normal Warmaster one on a temporary Duke composes Carthag Shield without granting trained three; normal winner Suk precedes unused-disc Moritani assassination, printed bounty, retained winner Tech and one private Mentat replacement. E3 pairs, mixtures and allied Occupy skills stay separate.',
      'The six effects, public ownership and pre-plan choice are integrated in development games. Enable Stronghold Cards in an Advanced preview lobby. Complete Advanced compliance and every expansion interaction remain under verification.',
    ],
    example:
      'You hold Arrakeen’s card and support four forces. The bank pays two spice; you and any permitted ally cover the remaining two. Leaving Arrakeen later does not transfer its card until turn end.',
    related: [
      'battle',
      'mentat',
      'choam-combat',
      'mobile-stronghold',
      'stronghold-factions',
      'choam-modules',
    ],
    checklist: [
      {
        area: 'Implementation',
        status: 'Partial',
        detail:
          'All six local effects/end-Mentat custody are integrated. Fresh Advanced classic/supported native skill rosters, including standalone Ecaz/Moritani, compose all14 skills and optional original Tech. Original subsidy, physical rescue, native income/Duke/assassination and reward order remain; full combinations stay open.',
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
          'Dated standalone and E1/E2 Skills/Stronghold cases remain. Standalone E3 adds15 meaningful cases,152 affected, types/lint/build, nine actual programs and eight E3 games (1531 actions/no rejection,38 JSON continuations); the expanded47-game batch completes13936 actions/358 continuations. Human390px normal Duke/Carthag poison survival and Guild Suk before unused-disc assassination preserve original cards/Tech/income/replacement on refresh. Full/deployed acceptance remains unfinished.',
        evidence: [
          'tests/stronghold-cards.test.ts',
          'tests/stronghold-engine.test.ts',
          'tests/classic-skills-stronghold-runtime.test.ts',
          'tests/native-skills-stronghold-runtime.test.ts',
          'tests/ecaz-skills-modules-runtime.test.ts',
          'tests/moritani-skills-modules-runtime.test.ts',
        ],
      },
    ],
  },
  {
    id: 'stronghold-factions',
    title: 'Expansion factions with Stronghold Cards',
    category: 'Advanced & expansions',
    coverage: 'Partial',
    developmentStage: 'Verified',
    summary: 'Fresh Advanced Stronghold play connects native E1/E2 families and standalone Ecaz or Moritani through original holder-only rule handlers.',
    steps: [
      'This private local profile admits selected native Ixian/Tleilaxu and CHOAM/Richese families with classic opponents in unique two-to-six-seat Advanced rosters. Standalone Ecaz OR Moritani with classic opponents additionally uses the exact ecaz deck. Moritani excludes Harkonnen under its original assassination/Duke boundary. Original unused Tech Tokens may additionally be selected with three through six seats, without Leader Skills; an E3 pair, E1/E2/E3 mixtures, Basic Strongholds and unrelated overlays remain separate.',
      'CHOAM-only ordinary Treachery has 35 physical cards; Ix or both decks have47, not49, because CHOAM replaces the shared Ix cards. Native Richese’s ten-card cache remains separate. Genuine setup retains original faction offers/leaders/forces and any native Auditor/HMS, with all six Stronghold Cards initially unowned.',
      'Card ownership begins only at the real first end of Mentat and is retained through the following turn. It is not assigned by a battle fixture or reset on refresh. Hidden Mobile Stronghold interior forces and its outside pointing territory stay distinct.',
      'The mobile card copies an advantage of another currently controlled stronghold, not merely a retained card. A sole choice is automatic; multiple choices use the existing public pre-plan selection. Accepted choices stay bound to the same original battle through private plans and saved continuation.',
      'Arrakeen provides at most two spice toward actual support, not extra personal cash. Native CHOAM income uses the original bank and player payment shares, including its established traitor and own-donor exclusions. Original cyborg/suboid and starred casualties, bounty and other native income stay separate.',
      'Carthag, Habbanya, Sietch Tabr and Tuek’s Sietch retain their existing defense, tie, opposing-dial and played-Worthless contracts. New Richese coverage uses actual No-Field shipment/reveal and native cache acquisition for Stone Burner; mixed No-Field dials/full-plan and unresolved Stone/Poison Tooth cases are not silently enabled.',
      'Shared Ecaz control holds the card at Ecaz; the selected lead gets only its own held advantage. Ecaz-led Arrakeen may bank-fund actual ally-variable support up to two, never fixed free Ecaz strength. Choosing the ally gives no automatically shared card benefit. Original Habbanya tie and Tabr income likewise follow the actual holder-plan.',
      'Native Moritani losing Tuek holder still earns two bank spice per played Worthless card. Original post-loss assassination follows support/card income, retains only printed bounty and one actual private Mentat replacement. Winner cleanup and force losses finish once; normal Traitor revelation forfeits assassination for the game. Native Terror placement remains free.',
      'Bounded expanded-family evidence includes sixteen rule cases, eleven actual No-Field/Stone/FaceDance program cases, all four legal policies and eighteen unstaged complete paired/mixed2..6 games (11066 accepted actions, no rejections). Human390px Stone kill/Habbanya and two-reserve Face Dance controls complete their native decisions. Save/recovery/privacy/custody assurance follows all rules, not a new prototype gate. Full-card/faction/module/deployed acceptance and public expansion starts remain open.',
    ],
    related: ['stronghold-cards', 'mobile-stronghold', 'choam-combat', 'setup', 'implementation-checklist'],
    checklist: [
      { area: 'Implementation', status: 'Implemented', detail: 'Fresh selected E1/E2 setup and standalone Ecaz/Moritani exact ecaz deck, actual end-Mentat ownership, holder-only Ecaz coalition funding and original Moritani loss/assassination compose existing effects. Optional original Tech requires three through six seats and awards the actual selected lead before Face Dance, without public-start or old-game changes.', evidence: ['game/engine.ts', 'game/faction-module-profile.ts', 'game/stronghold-cards.ts', 'game/battle-resolution-quote.ts'] },
      { area: 'Player controls', status: 'Implemented', detail: 'Original local390px controls cover HMS copy/support, real cache Stone reveal mode and partial Face Dance replacement. Standalone E3 human controls select the Ecaz holder lead, show bank2/personal1 for actual support3, seal native plans and keep the physical Shield; Moritani reveals printed Master Bewt bounty through its original inspector and choice. Original Collection and Mentat continue after refresh.', evidence: ['components/stronghold-cards.tsx', 'components/game-table.tsx'] },
      { area: 'AI', status: 'Partial', detail: 'Four minimal legal policies consume actual marker/Stone/FaceDance/copy choices; eighteen genuine paired/mixed Advanced2..6 games complete. Strategy/calibration and other combinations remain deferred.', evidence: ['game/bots.ts', 'tools/faction-games.ts'] },
      { area: 'Documentation', status: 'Partial', detail: 'Advanced family/deck/cache admission, existing six effects, original winner versus replacement and explicit guarded combinations are recorded without completing every card or faction.', evidence: ['docs/STRONGHOLD_CARDS.md', 'docs/RULE_DECISIONS.md'] },
      { area: 'Verification', status: 'Partial', detail: 'Prior E1/E2 evidence remains dated. Standalone E3 adds20 focused cases, affected native/CLI179, types/lint/build and actual controlled holder-only funding, tie/income, assassination/death/forfeiture and four legal policies. Four genuine two/three-seat E3 games complete642 accepted actions,15 JSON continuations and3 battles without rejection; no natural assassination claim. Human390px Ecaz reaches v18/Mentat with bank2/personal1, separate Collection2 and physical Ecaz2/Guild1 survivors; Moritani reaches v11/Mentat with wallet18 and one original private replacement. No new assurance/full-suite campaign or public/deployed certification.', evidence: ['tests/ecaz-stronghold-runtime.test.ts', 'tests/moritani-stronghold-runtime.test.ts', 'tests/richese-strongholds-runtime.test.ts', 'tests/tleilaxu-strongholds-runtime.test.ts'] },
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
      'Token ownership and pending income are public and persist with the room. Fresh supported classic, E1/E2 native or standalone Ecaz/Moritani Leader Skills tables retain original three-through-six-seat Basic/Advanced setup and effects; Advanced may also retain Stronghold Cards. Skill rescue or board-spice awards finish before the mandatory original winner token reward and later Face Dance. Banker remains a separate source-to-Mentat opt-in. CHOAM’s separate native opening payout is not ordinary poverty Charity. Two-player tokens, mixed E3/other combinations and full combined acceptance remain unfinished.',
      'Without Skills, fresh native E1/E2 families or standalone Ecaz OR Moritani with classic opponents may preserve unused original Tech Tokens through the local factions entry, Basic/Advanced three through six players; Advanced stronghold-factions adds the original six Stronghold Cards. Native payments, typed casualties, selected Ecaz lead rewards and Moritani original assassination remain separate. Split allied holdings never qualify as a complete set. Basic odd Occupy, Richese cache/No-Field rulings, unrelated overlays, public starts and saved-game conversion remain guarded.',
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
      'The capture engine and private views have focused tests. The six classic factions can start Advanced preview; remaining Advanced rules and expansion interactions are unfinished.',
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
      'If every card in the combined hand must return, the return happens automatically with a brief notice. Larger hands retain their return choice. Your Harkonnen inspection keeps the cards actually drawn privately readable after the exchange and after refresh; this records what you saw then, not the target’s current hand. Older saved forced returns record the cards held before returning them without claiming which were originally drawn.',
      'A hand exchange pauses the current auction action or response and resumes it after the return. If the exchange removes the only Karama backing an unfunded bid, the current auction recovery remains provisional pending primary-source confirmation.',
      'During Shipment and Movement, the Guild may stop a declared off-planet shipment by spending its once-per-game special Karama. The decision happens before payment or arrival, so a stopped shipment earns no Guild income and triggers no accompanying advisor. Fremen’s on-planet reinforcements and cross-planet movement are excluded.',
      'The stopped shipment uses the shipper’s shipment opportunity while retaining forces, spice, allied credit and any shipment-rate card; ordinary movement remains available. These settlement details remain provisional pending primary-source clarification. The Guild decision appears regardless of its hidden hand.',
      'Fremen may call a worm in a sand territory during Spice Blow and Nexus. It destroys spice and unprotected forces immediately. Ally protection and Fremen survival have separate responses; a second Karama may cause Fremen to be devoured. The special summon itself consumes no spice-deck card.',
      'Resume any interrupted spice draw, fresh-blow window or worm response after the summoned worm resolves. Its Nexus occurs at the end of the blow, followed by eligible Fremen rides. During an open Nexus, the new ride joins the existing queue. Destroyed fresh spice cannot later be doubled by Harvester.',
      'Tleilaxu receive a decision before another faction’s normal revival completes, whether or not they hold Karama. Decline to continue the revival, or spend a real Karama once per game to prevent that faction’s normal force and leader revivals for the current turn. A stopped attempt spends no spice, returns no pieces and consumes no elite or extra-revival quota.',
      'This includes negotiated leaders, KH and Emperor-funded allied extra forces. The Emperor remains the payer when an extra revival is allowed. Hidden leader identities and prices are not added to the public stop decision. Ghola treachery and the Emperor’s special Karama currently remain separate from the normal-revival restriction.',
      'The printed Tleilaxu power is brief. Its full-turn scope, precise timing and card/special-power exceptions remain provisional pending the complete primary-source audit. These choices are tested implementation behavior, not certification of the full expansion rules.',
      'Remaining expansion special powers, plus further timing and expansion interaction audits, remain unfinished. Advanced preview is available for the six classic factions.',
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
      'Six printed effects cover range, revival, movement, storm protection, force return and Kull Wahad’s opt-in Karama reaction.',
    steps: [
      'These CHOAM abilities work in basic and advanced games. Choose a printed Worthless card from the phase controls. Its name and intended effect are announced, then a Karama response occurs before discard. A canceled card remains in hand and cannot be retried for its effect during that phase.',
      'On your own Shipment and Movement turn, play Kulon while a movement remains. It adds one territory to your movement range, including ornithopters. It does not add another movement action, bypass the storm or relax alliance/stronghold entry rules. The current implementation applies the bonus to both movements if Hajr is used; this combination remains under audit.',
      'During Revival, play La La La and select a player to prevent its free force revivals for the rest of the phase. Earlier revivals are unchanged. The prohibition also prevents a Fremen allied free allowance from providing free returns, even if granted later.',
      'Whenever another faction requests a normal revival with a free portion, CHOAM receives a response decision independently of its private hand. Allow the request, or declare La La La for that requester. If the effect succeeds, the whole pending request stops without payment, force movement or quota use; a faction permitted to purchase normal revivals can submit a paid request. If the effect is canceled, the original quote resumes through any Tleilaxu and other applicable responses.',
      'La La La does not prevent otherwise legal paid revivals or separate Ghola card effects. With Tleilaxu in the game, Fremen may submit a paid request within their current limit after free revival is prevented. Without Tleilaxu, Fremen’s base purchase restriction leaves no normal force return available. Emperor-funded extras remain separate. The prohibition resets when the next Revival phase begins. Card custody is checked at settlement: if CHOAM cashed in the declared card during the response, no Worthless effect occurs and the interrupted revival resumes.',
      'During Shipment and Movement, use Baliset to select another player and a territory CHOAM occupies. The current implementation prevents that player from entering that territory by movement for the phase while CHOAM remains there; shipment is allowed. A declared move into a CHOAM territory pauses for CHOAM regardless of its private hand. Allow it or declare Baliset. A successful effect leaves the moving forces in place and the movement unspent; a canceled or unavailable card resumes the original move after checking its legality again.',
      'Kulon, La La La, Baliset, Jubba Cloak and Trip to Gamont have engine, private controls and AI support. Printed Kull Wahad has a separate opt-in development preview; the explicit Nexus Kull profile adds Cunning fuel choices at that same reaction, not in every Nexus game. See both Kull guides for distinct counters, pre-conversion Bene Gesserit custody and the deferred winning-overbid boundary. Exact cancellation scope, Hajr/ornithopter combinations, Baliset duration and destination scope, simultaneous prevention and later module exceptions remain under audit. Normal expansion starts remain disabled.',
    ],
    related: [
      'faction-choam',
      'choam-gamont',
      'choam-jubba',
      'choam-kull',
      'nexus-choam-kull',
      'choam-market',
      'choam-revival',
      'movement',
      'revival',
      'card-karama',
    ],
  },
  {
    id: 'choam-kull',
    title: 'Kull Wahad: Karama interception preview',
    category: 'Advanced & expansions',
    coverage: 'Partial',
    developmentStage: 'Prototyped',
    summary: 'React before a Karama is played; a distinct counter can stop Kull before its phase restriction begins.',
    steps: [
      'This opt-in development preview supports CHOAM with classic factions in Basic or Advanced, using the physical CHOAM and Ix Treachery decks without optional modules. Basic supports printed ordinary Karama; Advanced also supports Bene Gesserit substitutions and the legal special powers of this roster. Existing games are not retrofitted. Normal expansion starts remain closed, and the visible preview warning is not rules-completion approval.',
      'Another player’s legal Karama cancellation, shipment-rate use, immediate auction purchase, winning-bid payment or supported special activation pauses before its card and other costs. CHOAM sees the attempted player and purpose and may decline or choose a legal held Kull Wahad. Each Use names its printed source explicitly. The separate Nexus Kull guide covers additional Cunning costs in its new profile only. The same public opportunity appears without Kull in hand, so waiting does not disclose hidden ownership. Invalid attempts never open this window; CHOAM does not receive a self-targeted Kull offer.',
      'Decline resumes the original attempt once. Declaring Kull opens the ordinary CHOAM-effect response. Kull is still pending: its target may counter with a different eligible physical Karama before any phase ban applies. The interrupted card stays reserved and cannot serve as its own counter. Other eligible responders use their existing response controls.',
      'If everyone allows Kull, CHOAM discards the exact Kull card. The original attempted card remains in its owner’s hand; its effect and additional costs do not occur, and an attempted special once-per-game use remains unspent. The activating player cannot activate printed or substituted Karama again during this turn’s current phase. An allied shipment recipient is not automatically the restricted player.',
      'The successful restriction ends when the phase or turn changes, not during a temporary response, market or worm substep. It does not prohibit holding, acquiring, transferring or otherwise legally discarding a Karama without activating it.',
      'A successful distinct counter spends or converts its own card under ordinary rules. Kull then stays held and its exact physical card cannot use its CHOAM effect again that phase. No Karama ban is established on the original player, and the reserved original attempt resumes once with its normal costs. Prevention is not a refund of a counter card.',
      'Advanced Bene Gesserit is intercepted before Worthless conversion or discard: successful Kull keeps that original unplayed Worthless card held. If CHOAM declines or Kull is countered, the original proceeds to its separate conversion response. Ordinary cancellation of that conversion still leaves its Worthless card discarded. A different BG Worthless counter has its own conversion response; it is never the reserved original.',
      'Winning overbids whose Karama payment would become unplayable remain deferred. To avoid accepting a bid that the preview cannot settle, a non-CHOAM unfunded Karama-dependent bid is refused privately before commitment, independently of CHOAM’s hidden Kull ownership. CHOAM self-activations are outside interception; normal non-preview bidding is unchanged. An already unfunded winning activation remains guarded. Holding Karama alone is not a reaction trigger. This unfinished-composition fence does not restart bidding, award the lot free, supply new funding or change numeric UI bid limits.',
      'A live Truthtrance battle or shipment promise also constrains original attempts, Kull costs and counters. A cost that cannot be proved compatible is unavailable before disposal; CHOAM may decline instead. Proven supported cancellations remain available. Pending Kull cannot release a suspended promise, and its counter choices exclude unproven costs so legal AI can progress. Unsupported continuations remain an incomplete preview composition, not a publisher ban or permission to release the promise.',
      'The different-card counter and before-conversion custody are explicitly selected development policy, not a located publisher clarification. This printed-only profile still excludes Nexus. The separate Nexus Kull profile adds one bounded Cunning interaction without changing older games; other expansion rosters, optional modules, unpayable-auction recovery and full CHOAM acceptance remain outside both previews. Nexus cards do not receive blanket immunity to Karama.',
    ],
    example: 'Bene Gesserit attempts to use Baliset as Karama. CHOAM declares Kull. Baliset cannot also counter Kull; a different eligible Karama may. If Kull succeeds, Baliset stays held and BG cannot activate any Worthless-as-Karama again this phase. If a distinct counter prevents Kull, the original Baliset attempt proceeds to its normal conversion response.',
    related: ['choam-worthless', 'nexus-choam-kull', 'faction-choam', 'card-karama', 'advanced-beneGesserit', 'special-karama', 'bidding', 'choam-karama', 'nexus-cards', 'implementation-checklist'],
    checklist: [
      { area: 'Implementation', status: 'Partial', detail: 'Opt-in printed Kull interception binds typed ordinary or prepared special intents, distinct physical counters and a stamped activation restriction. Deferred overbid recovery and combined-module support remain excluded.', evidence: ['game/choam-kull.ts', 'game/engine.ts'] },
      { area: 'Player controls', status: 'Partial', detail: 'Owner-only legal held costs and decline use the Kull event; counters reuse ordinary response controls. Public viewers receive purpose/actors, not private intent payloads or hidden choices.', evidence: ['components/choam-kull.tsx', 'components/game-table.tsx'] },
      { area: 'AI', status: 'Partial', detail: 'Legal preview participation uses projected reactor choices and ordinary distinct counter controls. Full strategy and difficulty calibration remain deferred.', evidence: ['game/bot-choam-kull.ts', 'game/bots.ts'] },
      { area: 'Documentation', status: 'Partial', detail: 'Pending versus active restrictions, distinct custody, decline/prevention/success, BG-before-conversion and deferred overbid limits have internal explanations. Publisher-source and full-faction acceptance remain separate.', evidence: ['docs/CHOAM_KULL_DESIGN.md', 'docs/CHOAM_KULL_SOURCE_UPDATE.md', 'docs/NEXUS_CHOAM_RULES.md'] },
      { area: 'Verification', status: 'Partial', detail: 'Focused engine, controls, all-profile legal bots and authenticated SQLite cover saved offer/counter/decline, exact custody, promises, orphan rejection and profile safeguards. Actual phone-width Basic/Advanced seats exercised Kull use, distinct counter and refreshed decline through the table. Complete combined games, proxy-free checkpoint HTTP and deployed acceptance remain separate.', evidence: ['tests/choam-kull-engine.test.ts', 'tests/choam-kull-recovery.test.ts', 'tests/choam-kull-controls.test.tsx', 'tests/bot-choam-kull.test.ts', 'tests/choam-kull.test.ts', 'tests/prototype-room.test.ts'] },
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
      'Cash-in takes effect immediately and preserves a pending phase opening, revival, response, market sale or allied exchange. If it consumes a card already offered for a market sale or trade, that transaction later pays nothing or moves neither card. In the Kull preview, a declared original or counter cost remains reserved while that transaction is pending.',
      'The battle preparation guide can find a cash-in that funds a promised plan while retaining required cards. Complete the listed preparation before reviewing and sealing the plan. This can combine with Ghola preparation when both remain possible.',
      'The power is available in all nine playing phases. Finish an active Truthtrance question first. Its precise timing against other simultaneous effects, activation-card payment interpretation and remaining expansion interactions are still under audit; full CHOAM starts remain disabled.',
    ],
    related: [
      'faction-choam',
      'choam-market',
      'card-karama',
      'choam-kull',
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
      'In Advanced, advisors may coexist with their ally without triggering the end-turn alliance constraint in either direction. Neither the advisors nor the allied fighters are lost for that coexistence. Bene Gesserit fighters remain subject to ordinary separation; Basic receives no new advisor exception.',
      'After Fremen setup, choose the starting advisor’s territory and sector. Advisors become fighters automatically whenever no other faction remains in their territory.',
      'A normal shipment enters as fighters unless joining existing advisors. Moving or shipping into your existing group must match its type. Advisors moved into an occupied territory without another Bene Gesserit group may remain peaceful or request a flip to fighters.',
      'When another faction ships, moves or worm rides into your fighters, immediately choose whether to become advisors. The choice opens a Karama response. Repeated entry can offer a new choice.',
      'After another faction’s off-planet shipment, choose a free force in the Polar Sink or an accompanying force at the shipment destination. An accompanying advisor group cannot flip to fighters in that turn while other factions remain.',
      'Before the first shipment, choose eligible advisor territories to prepare for battle. Each chosen flip has a Karama response. Advisors cannot prepare against an ally or where storm prevents the battle.',
      'The engine and these choices have focused tests. Advanced preview is available for the six classic factions; the full advisor timing audit, forced-flip cancellation and expansion interactions remain unfinished.',
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
      'Fresh private Homeworld prototypes retain all fourteen Skills, Discovery7/8 or both in classic or supported E1/E2 and standalone Ecaz OR Moritani tables. Original Nexus entries additionally support single or paired one-family E1/E2, natives from BOTH selected Ix+CHOAM families with union47, and standalone OR paired Ecaz/Moritani/ecaz33 with classics, with or without Skills. Basic/Advanced2–6, Tech3+ and Advanced Strongholds2+ retain original setup, native placement, phase-end industry and source-local held cards. Advanced Moritani/paired E3 excludes Harkonnen; otherwise legal standalone no-Skills Ecaz/Harkonnen does not lift its separate Duke Cunning exclusion. Winning typed native Suk saves stay at that home; external Emperor returns allocate physical normal/elite counters to original homes as the existing interpretation. Normal revival separately deposits Sardaukar at Salusa. Nested battles receive no Homeworld bonus. Mixed E3/three-family Nexus, pending effects, public starts and played-save conversion remain separate.',
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
      'The fresh local homeworld-occupation profile uses original selected decks and no other modules. Advanced occupation begins with sole foreign presence and its benefits remain until the occupier’s last force leaves, including across contests, native population recovery and later turns. A later sole arrival after departure creates a new source epoch. Basic still guards unresolved lifecycle cases; original history, not a current garrison shortcut, proves entitlement.',
      'Printed occupied bank income is collected once and can be immediately allocated to a reciprocal ally. Separate Kaitain and Junction paid-receipt shares and Richese’s actual net sale income use frozen original invoices without charging the payer again. Southern Hemisphere rounds one completed actual native Collection total, including settled shared and occupied-bank credits; it redistributes rather than collecting twice. Ordinary native income cancellation remains distinct from printed occupied effects.',
      'Proved Wallach IX occupation protects the occupier and ally from native Voice; Tleilax prevents native Face Dancers against them; Grumman prevents revealing Terror on their entry. Occupied Salusa removes Sardaukar advantage without changing starred physical identity. These printed effects cannot be restored or canceled with Karama. Other occupied powers and full Homeworld acceptance remain open.',
      'Caladan shares the admitted original Bidding inspection with the occupier, not its ally; native inspection can still be prevented independently. Ix gives the occupier the actual private drawn pool and selection, not unrelated setup or Technology. Richese sets its own method/direction before the occupier chooses only the physical cache card; seller, payment and other decisions stay native. Giedi gives one original purchase bonus to the occupier or its reciprocal ally with real receiver capacity, even when Harkonnen’s purchased card fills its hand.',
      'The separately marked fresh Tupile entry grants one hand slot to the proved occupier and reciprocal ally. Every server-derived hand limit includes it, so Harkonnen can hold nine without receiving a tenth bonus. After a proved loss, each old holder privately selects exactly its excess original eligible cards to return to the normal limit; committed cards remain protected. Original phase opening and remaining movement resume without another shipment or payment. Basic unknown lifecycle blocks rather than guesses cleanup. Advanced departure can restore CHOAM’s low intelligence without clearing its previous answers or used factions.',
      'The fresh native Ecaz high-card preview shows a separate prospective conjunction: native seven-plus population, at least one actual jointly held stronghold and proved current alliance holdings of two other native factions’ Homeworlds. This does not change the ordinary four-stronghold or three-joint Ecaz targets. Original Mentat decides the win before prediction/fallback; source uncertainty remains blocked. Duke authority and the Ecaz-only revival ruling are separate.',
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
          'All 13 cards, saved typed custody, supported-deck setup, Emperor movement, native Arrakis shipment sources, revival destinations, low charity/free-revival benefits, Tleilax’s phase-start income penalty and high-Salusa free Sardaukar support are connected. World-to-world invasion, Guild transport from Arrakis and Guild native returns use exact source pools, funding and interception. Homeworld battles connect native bonuses, limited explosion casualties, native-only Traitors and Face Dancers, and Ixian substitution. Junction offers connect sponsored board and Homeworld routes, including own returns, foreign departures and their distinct payments. Caladan foresight, Wallach advisor counts, Ix stronghold movement and Richese token movement now respect native population. High Tupile blocks Worthless sales and Ambassador payouts, including after an interrupted Ghola revival. Kaitain paid discards share the closing Bidding opportunity with CHOAM; Ecaz poison income uses actual physical disposal and current native population. Mandatory winning-card disposal follows winner casualties. Supported low Kaitain and Junction payment receipts preserve the payer’s cost and use current native population; divergent allied rounding remains guarded. Giedi grants its once-per-phase bonus on actual positive desert receipts, including settled Ecaz shares. Low Grumman uses original public entry counts across Terror and competing-reaction checks. Southern and Tleilax preserve the exact eligible revival group through one optional placement, with held income and explicit unresolved destination rules. Fresh occupation additionally connects bank and percentage receipts, completed Southern Collection, immediate sharing, Caladan inspection, displaced Ix pool, Richese card-only choice with native terms, real Giedi receiver choice and native protections. Fresh native CHOAM entries additionally connect original Tupile slots, actual normal-limit cleanup and restored low-query authority without resetting usage. Advanced retains sole-qualified ownership until last departure; Basic lifecycle, exceptional Duke, concealed transport and full/public acceptance remain unfinished.',
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
          'components/grumman-collection.tsx',
          'components/terror-board-markers.tsx',
          'game/homeworld-arrival.ts',
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
          'game/homeworld-stable-occupation.ts',
          'game/homeworld-occupied-income.ts',
          'game/homeworld-occupied-percentage.ts',
          'game/homeworld-occupied-bidding.ts',
          'game/homeworld-occupied-defenses.ts',
          'game/homeworld-occupied-tupile.ts',
          'game/ecaz-homeworld-victory.ts',
          'game/victory-quote.ts',
          'components/victory-progress.tsx',
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
          'Card inspection is available in the reference. Development tables display native reserves, explicit Imperial shipment sources, world-to-world shipment and Guild transport from Arrakis with costs and pledged funding, Guild interception, optional Junction half/full offers and typed sponsored transport, transfers between Kaitain and Salusa, charity payment sources, current revival allowances, population-based movement restrictions and one/two-advisor choices, native battle bonuses, Homeworld casualties, replacement controls, Tupile sale explanations, shared end-of-Bidding actions, Ecaz’s private poison-income record, current low-population payment splits, automatic Giedi collection history, count-dependent Ambassador destinations and the optional revived-group placement. Fresh occupation adds bounded actual percentage allocation, real bonus receiver choice, source-authorized Ix pool/cache controls and separate native Richese terms. Normal starts remain unavailable.',
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
          'components/homeworld-occupied-income.tsx',
          'components/homeworld-occupied-percentage.tsx',
          'components/homeworld-occupied-bonus.tsx',
          'components/ix-technology.tsx',
          'components/richese-auctions.tsx',
          'components/homeworld-tupile-cleanup.tsx',
        ],
      },
      {
        area: 'AI',
        status: 'Partial',
        detail:
          'Shared public choices supply native shipment counters, Imperial transfers and current low revival allowances. All four profiles use Salusa’s per-type support legality and respect unresolved special-Karama and mid-battle Ghola timing boundaries. All four profiles handle world-to-world shipment, Guild transport from Arrakis, native returns and interception, Homeworld battle choices, typed losses, late defense and supported replacement actions. All four profiles can offer and use Junction transport through public quotes, respect population-based movement restrictions and choose legal Spiritual Advisor quantities. Market choices exclude high-Tupile Worthless sales. All four profiles use eligible unused low-Tupile requests without reading opponents’ private hands or balances. All four profiles use the shared closing opportunity for CHOAM actions, affordable Kaitain discards and readiness. Ecaz income needs no separate claim. Fresh occupied decisions supply legal bank/percentage allocation, one eligible real bonus receiver, displaced Ix/cache selection and native Richese terms. Concealed transport, remaining card-effect strategy and difficulty calibration are unfinished.',
        evidence: ['game/homeworld-options.ts', 'game/homeworld-shipment-options.ts', 'game/guild-homeworld-shipment-options.ts', 'game/junction-transport-options.ts'],
      },
      {
        area: 'Documentation',
        status: 'Partial',
        detail:
          'All 26 faces, global rules and source discrepancies are documented. Imperial shipment and movement controls explain sources, costs and unavailable actions. Card-economy notes explain shared closing actions, private poison income, winner-discard ordering and low-population payment splits. The authorized Advanced sole/last-departure cutover and original occupied economic/Bidding ownership are explicit. Divergent allied rounding, Basic occupation lifecycle and remaining effects stay separate; full interaction guidance remains in progress.',
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
          'Mixed E1/E2 and paired E3 Nexus adds31 original physical programmes plus2 Loyalty-stock regressions. Final489/489 affected checks across42 files pass with types/lint. All64 original families finish258/288 six-seat games with338931 accepted/339426 attempted actions and9013 JSON across three frozen trees and preserved-prefix continuations. All30 remaining source-guard traces are read. Actual390px original Ixian offer/training, typed native and foreign-world payment/free Suboid plan and paired Ecaz foreign entry/living shared Duke preserve20 physical counters. Human Ixian loses, so no winning Suk rescue is claimed. Earlier qualified evidence remains canonical; full rules, assurance, calibration and deployed acceptance remain open.',
        evidence: ['tests/mixed-nexus-modules-runtime.test.ts', 'tests/paired-e3-nexus-modules-runtime.test.ts', 'tests/sample-custody.test.ts', 'tests/ambassador-terror-overlap-engine.test.ts', 'tests/single-nexus-e1-runtime.test.ts', 'tests/single-nexus-e2-runtime.test.ts', 'tests/homeworld-classic-skills-runtime.test.ts',
        'tests/homeworld-classic-discovery-runtime.test.ts',
        'tests/homeworld-skills-discovery-runtime.test.ts',
        'tests/homeworld-optional-modules-runtime.test.ts',
        'tests/homeworld-native-e1e2-modules-runtime.test.ts',
        'tests/homeworld-native-e3-modules-runtime.test.ts',
        'tests/homeworld-classic-nexus-skills-runtime.test.ts',
        'tests/homeworld-classic-discovery-nexus-runtime.test.ts',
        'tests/homeworld-paired-nexus-runtime.test.ts',
        'tests/homeworld-standalone-nexus-runtime.test.ts',
        'tests/e3-nexus-ecaz-runtime.test.ts',
        'tests/e3-nexus-moritani-runtime.test.ts',
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
        'tests/homeworld-occupied-income.test.ts',
        'tests/homeworld-occupied-percentage.test.ts',
        'tests/homeworld-occupied-bidding.test.ts',
        'tests/homeworld-occupied-defenses.test.ts',
        'tests/homeworld-occupation-runtime.test.ts',
        'tests/homeworld-occupied-producers-engine.test.ts',
        'tests/homeworld-occupied-private-lots.test.ts',
        'tests/homeworld-occupied-tupile.test.ts',
        'tests/homeworld-occupied-tupile-runtime.test.ts',
        'tests/ecaz-homeworld-victory.test.ts',
        'tests/ecaz-homeworld-victory-runtime.test.ts',
        'tests/grumman-collection.test.ts',
        'tests/grumman-collection-engine.test.ts',
        'tests/grumman-collection-controls.test.ts',
        'tests/grumman-collection-recovery.test.ts',
        'tests/grumman-selection-integrity.test.ts',
        'tests/homeworld-benefits-recovery.test.ts',],
      },
    ],
  },
  {
    id: 'discoveries',
    title: 'Discoveries: first playable functions',
    category: 'Advanced & expansions',
    coverage: 'Partial',
    developmentStage: 'Prototyped',
    summary: 'A development prototype connects Great Maker, six Discovery spice blows, private token inspection, stash rewards, revealed locations, next-turn entry, Cistern income, bounded Orgiz transfers, Ornithopter movement, Jacurutu income, Testing Station and Shrine. Remaining interpretations and normal public starts stay gated.',
    searchText: 'Hiereg Smuggler Jacurutu Sietch Cistern Ecological Testing Station Shrine Orgiz Processing Station Treachery Card Stash Spice Stash Ornithopter',
    steps: [
      'The Discovery-only fresh entry supports classics, selected Ixian/Tleilaxu/CHOAM/Richese families or standalone Ecaz OR Moritani with classics, Basic/Advanced2–6, seven extra Spice Cards/eight tokens, optional unused Tech3+ and Advanced Strongholds. Its separate Nexus/Skills entries below admit their additional exact compositions; Discovery-only paired or mixed E3 and public starts remain gated.',
      'Fresh Discovery retains original Homeworlds and native reserves in classic, supported E1/E2 or standalone E3 tables, Basic/Advanced2–6, optional Tech3+/Advanced Strongholds. Original Nexus entries additionally admit natives from BOTH Ix+CHOAM families/union47 or BOTH Ecaz+Moritani/ecaz33 with classics, with or without all14 Skills. Maker, actual parent/nested entry, source-local payments/rescue, phase-end industry and original-winner cleanup/Tech remain. Held benefits do not migrate into nested locations. Original capture/roster and unresolved-effect guards remain.',
      'The original leader-skills --nexus-cards --discoveries entry composes all14 offered training/all12 Nexus/Discovery7/8 for classics/base33, single or paired one-family E1/E2, natives from BOTH selected Ix+CHOAM families/union47, or standalone OR paired Ecaz/Moritani/ecaz33 with classics. Original Homeworlds may be retained; Tech requires3+ and Strongholds Advanced. Hands/offers, native components and actual Maker/both-pile/alliance-change closing draws remain authoritative. Shared Duke never trains; Advanced paired E3/Moritani excludes Harkonnen. Mixed E3/three-family and pending effects/public starts/save conversion remain separate.',
      'Connected native outcomes use original sources: Suboid Cunning and winning trained Suk settle typed fixed casualties before one equal actual Cyborg Tank substitution; original cleanup and mandatory winner Tech precede matching Face Dance, retaining its foreign-Homeworld suppression. Signed Richese two-marker one-invoice physical shipment requires a currently revealed nested site. Ecaz-selected coalition armies and Moritani skill-first assassination remain distinct from shared-Duke training. These programmes do not certify every skill or card band.',
      'The original nexus --discoveries entry retains NO Skills with classics/base33, single or paired one-family E1/E2, both selected Ix+CHOAM native families/union47, or standalone OR paired Ecaz/Moritani/ecaz33 with classics. Original Homeworlds/Tech3+/Advanced Strongholds remain optional. Real native Traitors, Arrakis Occupy and Advanced assassination marks remain; no starting Nexus hand or training is added. Maker losses/votes/typed reserve rides, both Advanced piles and actual settled alliance change precede the closing card deal. Source guards and public/played-save boundaries remain.',
      'Original Stronghold Cards are claimed only at end-Mentat. A held benefit applies in its named territory or the mobile stronghold through its actual declared copy; revealed Discovery locations do not inherit another territory’s defense or bank support. Jacurutu counts toward stronghold victory but creates no seventh Stronghold Card. Physical free entry, nested tariffs, trained or native force casualties, card cleanup and optional Tech reward retain their original sources.',
      'Great Maker first resolves the ordinary worm consequences. All players then vote in storm order on creating a Nexus. A strict majority is required; a tie adds no Nexus and an existing Nexus in the phase stays recorded. Fremen may then ride with actual reserve forces to one legal destination for free, without using ordinary shipment or movement. Storm and occupancy restrictions still apply.',
      'Each of the six Discovery territory cards destroys prior spice and forces in the named blow territory, including Fremen forces, before placing six new spice subject to the storm. It also places a random available face-down token of the printed type at the card’s separate token destination.',
      'Fremen privately see placed Hiereg tokens; Guild privately sees placed Smuggler tokens. During Spice Collection, non-advisor forces in a token’s surrounding territory may inspect it privately, then choose whether to reveal it. The Discovery panel shows only authorized faces. Reading an already visible token’s rules does not reveal or use it.',
      'Spice Stash grants seven bank spice and leaves play. Treachery Card Stash draws one private Treachery Card and leaves play; if the new hand is too large, choose any held card to discard, including the newly drawn card. The owned discard panel includes a card inspector.',
      'Revealing Ornithopter records who carries it and the turn it was gained. On a later turn, its owner may spend it on one ordinary movement action to give that selected group a fixed range of three. It grants no extra action, adds no shipment and is removed only after the movement commits; saved arrival interactions retain the exact selected group.',
      'The five revealed location tokens become separate, initially empty territories inside their surroundings. A private peek does not open the location. Normal ground movement enters through the surrounding territory, shipment uses stronghold prices, at most two factions may occupy it, and forces inside are protected from storms and sandworms. Only Jacurutu Sietch counts toward stronghold victory.',
      'Native typed forces enter as their actual ordinary and elite groups, never as passengers from the mobile stronghold or the concealed value of a No-Field. Richese may ship or move a concealed marker into an actually revealed nested location at sector zero; it remains one effective presence until its original reveal materializes available reserves. CHOAM Card Stash uses its five-card limit, drawing first and choosing any held discard afterward.',
      'At the start of the next turn, before the storm and mobile stronghold movement, each eligible faction may move any positive subset of its non-advisor groups from the surrounding territory into the newly revealed location. The signed choice preserves ordinary and elite forces across sectors, normal source storm and occupancy restrictions, and costs no spice, shipment or normal movement. The printed text gives no sequence and does not restate the source-storm restriction; processing tokens in reveal order and factions in storm order while excluding storm sources are source inferences.',
      'A sole Cistern occupant receives two bank spice during Collection. In Advanced, a sole Orgiz occupant takes one collected spice per territory where an unambiguous rival collected board spice. Multiple collected deposits in that territory do not add transfers. Basic retains its provisional one-per-positive-deposit interpretation. Contested ownership, different or shared payers leave only that uncertain transfer unpaid; ordinary Collection continues.',
      'Jacurutu automatically pays one bank spice for each opposing undialed physical force sent to the Tanks. Where Advanced normal/elite allocations would produce different rewards, this prototype records the unpaid gap pending a ruling; it never guesses from the numeric wheel alone.',
      'A sole non-advisor occupant of Ecological Testing Station may decrease ordinary storm movement by one, keep it, or increase it by one. Choose after the ordinary storm-card window, before movement and storm protection. Weather Control cannot be changed. Two-occupant adjustment order remains unresolved. An already saved pending storm without its original movement source keeps its distance until a new storm is produced.',
      'A current non-advisor Shrine occupant may play a physical Truthtrance card as Karama, or a physical Karama as Truthtrance, within the implemented timing and effect paths. The printed identity and actual card custody remain unchanged; a committed Truthtrance conversion survives departure. This does not create missing Karama powers or settle their pending rules.',
      'All four AI profiles use the same offered inspection, reveal, stash-discard, Great Maker, free-entry, Ornithopter and Testing Station choices as the player controls. Private knowledge and unfinished decisions survive saved JSON continuations. These focused paths do not establish complete variant compliance or combined-module acceptance.',
    ],
    related: ['ecaz-modules', 'spice-blow', 'collection', 'movement', 'mentat', 'implementation-checklist'],
    checklist: [
      {
        area: 'Implementation', status: 'Partial',
        detail: 'Original classic and supported paired E1/E2 or standalone E3 Skills/Nexus/Discovery, and separate paired E1/E2 no-Skills Nexus/Discovery, retain selected Tech/Advanced Strongholds alongside existing original classic/native Discovery entries. Actual Maker votes/typed rides and settled-alliance closing deals, one-invoice signed markers, training, rescue, Cyborg substitution and cleanup/Tech/Face Dance use original consumers. Held benefits stay source-local; mandatory Ecaz coalition keeps owner-labelled armies. Smuggler policies use projected authoritative support. Advanced Orgiz aggregates actual territory Collection; Basic stays provisional per deposit. Pending sources and public starts remain guarded.',
        evidence: ['game/discovery-module-profile.ts', 'game/richese-no-field.ts', 'game/discoveries.ts', 'game/discovery-actions.ts', 'game/discovery-entry.ts', 'game/discovery-collection.ts', 'game/discovery-flight.ts', 'game/discovery-battle.ts', 'game/discovery-storm.ts', 'game/shrine.ts', 'game/great-maker.ts', 'game/board.ts', 'game/engine.ts'],
      },
      {
        area: 'Player controls', status: 'Partial',
        detail: 'Private backs and readable authorized faces, optional inspection/reveal, owned stash discard with card inspection, ordered Great Maker controls, multi-sector free entry and carried-Ornithopter movement use shared table controls. Testing Station offers three legal distances and Shrine uses existing card controls. Unambiguous Jacurutu and bounded Orgiz income are automatic and logged; unresolved rewards have no invented choice.',
        evidence: ['components/discoveries.tsx', 'components/discovery-entry.tsx', 'components/discovery-flight-movement.tsx', 'components/discovery-storm.tsx', 'components/truthtrance.tsx', 'components/great-maker.tsx', 'components/spice-card-inspector.tsx', 'components/game-table.tsx'],
      },
      {
        area: 'AI', status: 'Partial',
        detail: 'Four profiles share the private quoted token, discard, vote, reserve-ride, free-entry, carried-Ornithopter and conservative Testing Station actions. Shrine uses the existing legal Karama and Truthtrance policies. Complete Discovery strategy, combined games and strength calibration remain unfinished.',
        evidence: ['game/discovery-options.ts', 'game/discovery-entry-options.ts', 'game/discovery-flight-options.ts', 'game/discovery-storm-options.ts', 'game/shrine.ts', 'game/great-maker-options.ts', 'game/bots.ts'],
      },
      {
        area: 'Documentation', status: 'Partial',
        detail: 'Sourced identities and native/classic-skill boundaries are recorded. Advanced Orgiz follows the authorized territory-Collection trigger; Basic keeps its provisional deposit mapping. Great Maker first-turn/Sandtrout, exhausted supply, entry order and source-storm handling remain explicit inferences. Contested Cistern/Testing Station/Orgiz, mixed-force Jacurutu and shared-lot theft are unresolved.',
        evidence: ['docs/DISCOVERY_COMPONENTS.md', 'docs/DISCOVERY_PROTOTYPE.md'],
      },
      {
        area: 'Verification', status: 'Partial',
        detail: 'Mixed E1/E2 and paired E3 preserves Discovery7/8/all12 Nexus, optional all14/HW/Tech/Advanced Strongholds. New31 physical programmes plus2 stock regressions; final489/489 affected checks across42 files pass with types/lint. Across64 original families,258/288 games finish338931/339426 actions and9013 JSON across three frozen trees and preserved continuations. Native Ecaz assassination, actual separate Loyalty stock and existing selected overlap order are repaired without new printed rulings. Actual original Maker votes/both piles and native card draws retain physical sources; no human nested entry or winning Suk is invented. Source guards and full acceptance remain open.',
        evidence: ['tests/mixed-nexus-modules-runtime.test.ts', 'tests/paired-e3-nexus-modules-runtime.test.ts', 'tests/sample-custody.test.ts', 'tests/ambassador-terror-overlap-engine.test.ts', 'tests/e3-nexus-ecaz-runtime.test.ts', 'tests/e3-nexus-moritani-runtime.test.ts', 'tests/single-nexus-e1-runtime.test.ts', 'tests/single-nexus-e2-runtime.test.ts', 'tests/homeworld-paired-nexus-runtime.test.ts', 'tests/homeworld-standalone-nexus-runtime.test.ts',
        'tests/homeworld-classic-nexus-skills-runtime.test.ts', 'tests/homeworld-classic-discovery-nexus-runtime.test.ts', 'tests/homeworld-native-e1e2-modules-runtime.test.ts', 'tests/homeworld-native-e3-modules-runtime.test.ts', 'tests/homeworld-classic-discovery-runtime.test.ts', 'tests/homeworld-skills-discovery-runtime.test.ts', 'tests/homeworld-optional-modules-runtime.test.ts', 'tests/discovery-native-e1-skills-runtime.test.ts', 'tests/discovery-native-e2-skills-runtime.test.ts', 'tests/discovery-native-e3-skills-runtime.test.ts', 'tests/discovery-skills-strongholds-runtime.test.ts', 'tests/discovery-native-strongholds-runtime.test.ts', 'tests/ecaz-stronghold-runtime.test.ts', 'tests/e3-native-tech-runtime.test.ts', 'tests/discovery-classic-nexus-lifecycle.test.ts', 'tests/discovery-classic-nexus-effects.test.ts', 'tests/discovery-orgiz-advanced-runtime.test.ts', 'tests/discovery-classic-skills-runtime.test.ts', 'tests/discovery-module-profile.test.ts', 'tests/discovery-native-typed-runtime.test.ts', 'tests/discovery-native-marker-runtime.test.ts', 'tests/discovery-native-e3-runtime.test.ts', 'tests/discoveries.test.ts', 'tests/discovery-runtime.test.ts', 'tests/great-maker.test.ts', 'tests/discovery-board.test.ts', 'tests/discovery-admission.test.ts', 'tests/discovery-controls.test.ts', 'tests/discovery-entry.test.ts', 'tests/discovery-entry-runtime.test.ts', 'tests/discovery-entry-controls.test.ts', 'tests/discovery-entry-review.test.ts', 'tests/discovery-collection.test.ts', 'tests/discovery-flight.test.ts', 'tests/discovery-flight-engine.test.ts', 'tests/discovery-flight-recovery.test.ts', 'tests/discovery-battle.test.ts', 'tests/discovery-battle-recovery.test.ts', 'tests/discovery-storm.test.ts', 'tests/discovery-storm-recovery.test.ts', 'tests/discovery-shrine-engine.test.ts', 'tests/discovery-shrine-recovery.test.ts', 'docs/HOMEWORLD_RUNTIME_IMPLEMENTATION.md'],
      },
    ],
  },
  {
    id: 'nexus-choam-kull',
    title: 'CHOAM Nexus Cunning: choose Kull Wahad',
    category: 'Advanced & expansions',
    coverage: 'Partial',
    developmentStage: 'Verified',
    summary: 'In the explicit Nexus Kull preview, choose one actual Treachery fuel card at a Karama attempt; the CHOAM Nexus is spent when the declaration is accepted, even if Kull is prevented.',
    steps: [
      'This is the fresh local nexus-kull development profile, not a public expansion start or an upgrade to existing saves. It admits two to six ready seats with native CHOAM and otherwise classic factions in Basic or Advanced, physical CHOAM and Ix Treachery decks, and Nexus alone. Other optional modules, expansion factions, Semuta and Richese Betrayal stay outside its boundary. The older kull profile remains printed-only and has no Nexus cards.',
      'The CHOAM Nexus face says: Discard any Treachery Card to obtain a Worthless Card special effect of your choice. The CHOAM rulebook gives Kull its attempted-Karama timing and phase restriction. Cunning changes the fuel identity, not the effect, target or timing. Neither text supplies a nested counter priority: distinct counters and BG-before-conversion custody are the recorded user-selected policy, not a publisher clarification.',
      'Wait for another player’s validated Karama attempt. There is no proactive Kull choice in the generic Nexus panel. The public event, attempted player and purpose are the same whether CHOAM holds CHOAM Nexus, another Nexus, no eligible fuel or no Nexus at all. Only CHOAM receives its private source-aware plays and blocking reasons; opponents do not see the cost list or reserved original card.',
      'Choose a cost through the shared selector and inspect that actual card before Use. Printed source requires a held printed Kull Wahad. Nexus source requires unallied native CHOAM holding the actual CHOAM Nexus in this profile and one uniquely held canonical Treachery Card: a weapon, defense, special, Karama or Worthless card can be fuel. Reserved or promise-incompatible fuel is unavailable. The card does not become a manufactured Kull, and Karama used as fuel does not activate its own power.',
      'Use must identify the offered event, selected source (printed or nexus) and actual fuel card. Omitting the source, guessing another event or supplying someone else’s card is not a valid Use. Decline needs only the event and spends nothing; the exact original attempt resumes once. You do not choose a new target, price, effect or Nexus identity.',
      'An accepted Nexus declaration discards the physical CHOAM Nexus once immediately. The selected fuel stays held while the ordinary CHOAM-effect response is pending. Pending Kull is not yet a phase ban. The interrupted original stays reserved; it cannot counter its own interruption. A distinct eligible printed Karama or Advanced BG substitution uses the existing response controls before any restriction begins.',
      'If Kull succeeds, discard exactly the selected fuel once, retain the original unplayed Karama or BG Worthless card and leave the original special once-use and additional costs unspent. The activating player, not an allied shipment beneficiary, cannot activate printed or substituted Karama for the stamped current turn and phase. This does not ban holding, acquiring, trading or otherwise legally discarding Karama.',
      'If a distinct counter prevents Kull, the selected fuel remains held under the existing exact-cost phase prevention policy, but the accepted Nexus spend is not refunded. No Kull activation ban is established. Resume the original attempt once with its normal costs. A BG original resumes its separate ordinary conversion response; ordinary prevention of that conversion still leaves its Worthless card discarded. A BG counter likewise owns its separate conversion, never the reserved original.',
      'The selected deferred-overbid policy still privately refuses non-CHOAM unfunded Karama-dependent bids before commitment, independently of hidden Kull or Nexus ownership. No auction restart, free award, invented funding or numeric UI cap is added. Own Truthtrance promises and reservations constrain the original, fuel and counters; unsupported continuations are guarded before an offer rather than silently releasing a promise.',
      'Refresh restores the same event, selected source, physical costs, spent Nexus and original continuation, including a suspended BG response. Corrupt ownership rejects without changing the game. Verified older printed-only counter saves receive a bounded immutable binding migration, not Nexus choices or a source-omitting action shim. Frozen checks and actual Basic/Advanced CLI/runtime/phone success and prevention are verified locally; complete CHOAM/Nexus, wider combinations and deployed acceptance remain open.',
    ],
    example: 'CHOAM selects a held weapon as Nexus fuel when BG attempts a Worthless-as-Karama activation. Accepted Use spends CHOAM Nexus but keeps the weapon pending. If everyone allows Kull, the weapon is discarded and BG keeps its original Worthless card unplayed. If a different Karama prevents Kull, CHOAM keeps the weapon but not the Nexus, and BG’s original conversion continues once.',
    related: ['choam-kull', 'choam-worthless', 'nexus-cards', 'faction-choam', 'card-karama', 'advanced-beneGesserit', 'special-karama', 'bidding', 'privacy', 'implementation-checklist'],
    checklist: [
      { area: 'Implementation', status: 'Partial', detail: 'The explicit new profile adds source-aware Kull fuel to the existing typed interception, with accepted-declaration Nexus spend and saved original continuation. It does not retrofit old games or admit wider module/faction compositions.', evidence: ['game/choam-kull.ts', 'game/nexus-choam.ts', 'game/engine.ts'] },
      { area: 'Player controls', status: 'Partial', detail: 'Actual private weapon-fuel selection, fuel and Nexus inspectors, required source Use, distinct counter/allow and refreshed Basic/Advanced phone paths pass. Wider controls/presentation acceptance remains open.', evidence: ['components/choam-kull.tsx', 'components/choam-power-cost.tsx', 'components/game-table.tsx'] },
      { area: 'AI', status: 'Partial', detail: 'All four profiles complete source-aware legal choices, decline and distinct counter continuations from canonical own projections. These are bounded legal policies, not calibrated Nexus strategy.', evidence: ['game/bot-choam-kull.ts', 'game/bots.ts'] },
      { area: 'Documentation', status: 'Partial', detail: 'This guide separates the printed effect and Cunning fuel from user-selected priority/custody and application privacy/spend conventions. New-profile limits and old printed-only behavior are explicit; publisher clarification and full-family acceptance remain open.', evidence: ['docs/NEXUS_CHOAM_RULES.md', 'docs/NEXUS_CHOAM_RUNTIME.md', 'docs/CHOAM_KULL_DESIGN.md', 'docs/CHOAM_KULL_SOURCE_UPDATE.md', 'docs/RULE_DECISIONS.md'] },
      { area: 'Verification', status: 'Partial', detail: 'Types/lint/6,022 offline tests/build, authenticated SQLite source ownership/restart/races and actual Basic/Advanced CLI/runtime/phone success/prevention/refresh pass. Review repairs protect canonical fuel, suspended native parents, reserved counters, payment coverage and old printed saves. Fresh profile omits Sandtrout. Local HTTP 49/55 retains four 503s and two timeouts; full combinations and deployed acceptance remain open.', evidence: ['tests/nexus-choam-kull-engine.test.ts', 'tests/nexus-choam-kull-recovery.test.ts', 'tests/nexus-choam-kull-controls.test.tsx', 'tests/bot-nexus-choam-kull.test.ts', 'tests/choam-kull-recovery.test.ts', 'docs/NEXUS_CHOAM_RUNTIME.md'] },
    ],
  },
  {
    id: 'nexus-choam-trade',
    title: 'CHOAM Nexus: Collection trade or victorious inspection',
    category: 'Advanced & expansions',
    coverage: 'Partial',
    developmentStage: 'Prototyped',
    summary: 'When CHOAM is absent, an unallied holder may spend the CHOAM Nexus card with a Worthless card for two bank spice during Spice Collection, or inspect one random unused opposing hand card after winning a battle.',
    steps: [
      'The Collection trade and post-victory inspection are available only while CHOAM is absent and you are unallied. This works in Basic and Advanced play.',
      'During Spice Collection, choose one Worthless card from your own hand. The chosen card and your CHOAM Nexus card are discarded, and you receive two spice from the bank.',
      'Finish any current choice, Truthtrance or automatic continuation first. Continuing the phase without trading keeps your cards.',
      'After winning a battle, the private inspection choice may instead spend the Nexus card to reveal one random opposing hand card that was not used in that battle. Only you see the sampled face; if none is eligible, continue without spending the card.',
    ],
    related: ['nexus-cards', 'collection', 'battle'],
    checklist: [
      { area: 'Implementation', status: 'Partial', detail: 'Collection trade has physical payment/discard custody; victorious inspection samples one unused opposing card privately after battle cleanup. Both retain saved receipts. Combined-module acceptance remains open.', evidence: ['game/nexus-choam-trade.ts', 'game/nexus-choam-inspection.ts', 'game/engine.ts'] },
      { area: 'Player controls', status: 'Partial', detail: 'Private Worthless-card picker and inspector, plus a separate post-victory inspect-or-continue choice and owner-only sampled face.', evidence: ['components/nexus-choam-trade.tsx'] },
      { area: 'AI', status: 'Partial', detail: 'All four profiles take legal private trade and inspection choices; strategic choice between uses remains unfinished.', evidence: ['game/nexus-choam-trade-options.ts', 'game/bots.ts'] },
      { area: 'Documentation', status: 'Partial', detail: 'Both alternatives and their timing, privacy and remaining combination boundaries are documented.', evidence: ['docs/NEXUS_CHOAM_SECRET_ALLY.md'] },
      { area: 'Verification', status: 'Partial', detail: 'Focused rules, private controls, AI, saved continuation and competing SQLite actions for trade and inspection. Complete family acceptance remains open.', evidence: ['tests/nexus-choam-trade.test.ts', 'tests/nexus-choam-trade-recovery.test.ts', 'tests/nexus-choam-inspection.test.ts'] },
    ],
  },
  {
    id: 'nexus-choam-betrayal',
    title: 'CHOAM Nexus Betrayal: random discard',
    category: 'Advanced & expansions',
    coverage: 'Partial',
    developmentStage: 'Prototyped',
    summary: 'With CHOAM seated, an unallied rival may spend its CHOAM Nexus card to discard one random physical Treachery Card from CHOAM without paying spice.',
    steps: [
      'Hold the CHOAM Nexus card while CHOAM is seated and holds at least one Treachery Card. Finish other choices or automatic continuations before using Betrayal; the printed panel has no phase restriction.',
      'The server chooses uniformly from CHOAM’s held cards, not from a client choice. Discard both the Nexus card and the selected Treachery Card; CHOAM receives no spice.',
      'Only the holder sees the Betrayal control. CHOAM’s hand count is shown only during Bidding; no rival card identity is disclosed before the ordinary discard reveal. Outside Bidding an empty-hand attempt rejects without spending the card.',
      'Basic and Advanced share this bounded effect. Other Nexus effects and complete expansion combinations retain their separate gates.',
    ],
    related: ['nexus-cards', 'choam-modules'],
    checklist: [
      { area: 'Implementation', status: 'Partial', detail: 'Physical random discard, spent Nexus custody, clean action boundary and saved discard receipt are connected. Full CHOAM Nexus family and module acceptance remain open.', evidence: ['game/nexus-choam-betrayal.ts', 'game/engine.ts'] },
      { area: 'Player controls', status: 'Partial', detail: 'Private holder control shows CHOAM’s name, Bidding-only public hand count, blocked reasons and spent-card cost without a non-Bidding count leak.', evidence: ['components/nexus-choam-betrayal.tsx'] },
      { area: 'AI', status: 'Partial', detail: 'All four profiles use the legal server-quoted action during Bidding when CHOAM’s count is public. Other phases avoid blind hidden-hand attempts; the server samples the actual card.', evidence: ['game/nexus-choam-betrayal-options.ts', 'game/bots.ts'] },
      { area: 'Documentation', status: 'Partial', detail: 'Printed outcome, bounded timing, custody, privacy and remaining gates are explicit.', evidence: ['docs/NEXUS_CARD_RULES.md'] },
      { area: 'Verification', status: 'Partial', detail: 'Focused Basic/Advanced custody, rejected actions, private controls, legal bots and JSON discard continuation are covered; complete module acceptance is not.', evidence: ['tests/nexus-choam-betrayal-engine.test.ts', 'tests/nexus-choam-betrayal-quote.test.ts', 'tests/nexus-choam-betrayal-controls.test.tsx'] },
    ],
  },
  {
    id: 'nexus-emperor-secret-ally',
    title: 'Emperor Nexus Secret Ally: extra revivals and bank-auction purchase',
    category: 'Advanced & expansions',
    coverage: 'Partial',
    developmentStage: 'Prototyped',
    summary: 'When Emperor is absent, an unallied holder can spend its Nexus card on exactly three additional free force returns during Revival or on an ordinary bank-auction purchase after proving the full winning bid from personal spice. Seller-paid, allied, non-Bidding and combined-module acceptance remain unfinished.',
    steps: [
      'Use the private Emperor Secret Ally controls during Revival. Select the physical elite count when more than one legal group is available. The card returns exactly three eligible forces from Tanks to reserves and is discarded once.',
      'These returns cost no spice and do not consume ordinary force-revival or free-revival allowances. You may use the card before or after ordinary revivals, while Revival remains open.',
      'The Advanced one-per-turn Fedaykin limit still applies across ordinary revivals and this card. The extra total allowance does not permit another elite revival. Fewer than three eligible counters is an unresolved case and remains unavailable.',
      'The revival prototype supports Basic and Advanced base factions with Nexus alone. Other expansion, Homeworld, suppression and combined-module effects retain their separate boundaries. Keeping the card during Revival creates no public decision or extra confirmation.',
      'At an eligible normal bank-auction winner payment, prove the positive final bid entirely from your own spice, then spend Emperor Nexus to receive that physical Treachery Card without losing spice. Every winner sees the same payment confirmation even if they hold no Nexus card; this privacy-preserving timing remains a provisional product choice pending the existing user question. Ordinary spice or legal Karama payment is still available.',
    ],
    related: ['nexus-cards', 'revival'],
    checklist: [
      { area: 'Implementation', status: 'Partial', detail: 'Fixed three-force return preserves ordinary allowances and physical elite limits. The separate bank-auction path retains the personally funded bid, transfers one physical lot and spends the Nexus with signed saved receipts. Seller/allied, other-purchase and combined producers remain unfinished.', evidence: ['game/nexus-emperor-secret-ally.ts', 'game/nexus-emperor-purchase.ts', 'game/engine.ts'] },
      { area: 'Player controls', status: 'Partial', detail: 'Private revival/auction options, legal elite selection, bid proof and unavailable reasons with readable physical card reference; normal payment remains offered.', evidence: ['components/nexus-emperor-secret-ally.tsx', 'components/nexus-cards.tsx', 'components/game-table.tsx'] },
      { area: 'AI', status: 'Partial', detail: 'All four profiles use projected legal revival and personally funded bank-purchase choices without rival hand/spice inspection. Complete Nexus strategy remains uncalibrated.', evidence: ['game/nexus-emperor-secret-ally-options.ts', 'game/bots.ts'] },
      { area: 'Documentation', status: 'Partial', detail: 'Printed alternatives, revival allowances, bid proof, physical purchase and provisional uniform payment timing retain explicit unresolved boundaries.', evidence: ['docs/NEXUS_EMPEROR_RULES.md', 'docs/NEXUS_EMPEROR_SECRET_ALLY_RUNTIME.md'] },
      { area: 'Verification', status: 'Partial', detail: 'Focused Basic/Advanced rules, controls, bots, JSON, browser owner/rival projection and SQLite restart/CAS cover stale cross-lot offers, hand/custody rejection and duplicate requests; broader module acceptance remains open.', evidence: ['tests/nexus-emperor-secret-ally.test.ts', 'tests/nexus-emperor-secret-ally-recovery.test.ts', 'tests/nexus-emperor-purchase-engine.test.ts', 'tests/nexus-emperor-purchase-recovery.test.ts', 'tests/nexus-emperor-secret-ally-purchase-controls.test.ts'] },
    ],
  },
  {
    id: 'nexus-richese-betrayal',
    title: 'Richese Nexus Betrayal: veto purchase or divert sale payment',
    category: 'Advanced & expansions',
    coverage: 'Partial',
    developmentStage: 'Verified',
    summary: 'Before a supported Richese auction settles, an unallied rival may spend the physical Richese Nexus card to discard a public self-cache lot without payment, or keep another buyer’s purchase intact while sending the original sale payment to the Spice Bank.',
    steps: [
      'This is an explicit local Richese Betrayal preview, not a public expansion start. It supports fresh two-to-six-seat Basic or Advanced tables with CHOAM, Richese and otherwise classic factions, the physical CHOAM deck and Nexus alone. Other optional modules, expansion factions, Semuta and Kull previews remain outside this boundary; older games do not silently acquire the effect.',
      'To use either alternative, remain unallied and hold the singleton Richese Nexus card while another seat is native Richese. A successful Use discards that physical Nexus card once. It spends no ordinary Treachery card, hand slot, Karama or activation spice. Current own-card promises and committed-resource legality still apply.',
      'The opportunity opens after a valid winning quote but before any purchase payment, source removal or hand delivery. You do not choose a different card, buyer, price or recipient: those terms are bound to the original auction.',
      'Purchase veto applies to Richese winning its own public cache lot through Once Around or Silent bidding. The exact selected cache card enters ordinary Treachery discard instead of Richese’s hand. No buyer or ally spice is spent; no payment goes to Richese, Emperor or bank, and no purchase bonus is created. The original lot retires once.',
      'Sale diversion applies when another buyer owes a positive payment to Richese for a cache auction or an Advanced Black Market auction using normal, Once Around or Silent bidding. The same buyer receives the same physical card for the same price and own/authorized-ally split. That original payment goes to the bank, with zero sale income for Richese; it is not an extra charge, refund or second purchase.',
      'A diverted sale still earns the original buyer consequences. In particular, an applicable Harkonnen purchase bonus continues once. Losing offers do not spend spice. A vetoed purchase, zero/free cache keep or unsold Black Market retention does not fabricate a bonus or a positive sale.',
      'Your voluntary Nexus spend must preserve your own binding shipment promises. If the involuntary purchase veto makes an opponent’s promise impossible, the existing native reconciliation may release that promise; it does not pretend Richese acquired the vetoed card or paid the price.',
      'All publicly possible responders receive the same neutral acknowledgement: unallied non-Richese seats with public held-Nexus presence. A seat may pass even if its secret card is irrelevant; only a privately eligible Richese-card holder sees Use. If no seat is publicly possible, settlement is automatic. This privacy-preserving application protocol is not publisher-prescribed timing or a general Nexus/Karama priority ruling.',
      'Pass spends nothing and keeps your Nexus card. Your recorded pass cannot be undone within this event. Once every required responder passes, the original quoted purchase settles once with its original payment recipient, card delivery and earned consequences. An accepted Use closes the opportunity with its one selected outcome.',
      'The panel shows the public Richese target, original buyer, cache/Black Market source and winning price. It does not show payer resources, ally balances, rival hands, secret Nexus identities or the saved private receipt. Read your own unavailable reason rather than guessing Use from a held-card face alone.',
      'A public cache face remains inspectable through existing entitled Card controls. A concealed Black Market face stays unknown unless you already have a separate inspection entitlement; a seller’s public claim is not its face. Nexus inspection shows printed reference text, not anybody’s hidden custody. This response grants no new card inspection.',
      'Normal-deck Richese self-purchases are outside the connected veto boundary because the Richese-family identity may be hidden. The private advanced special-Karama acquisition has its own activating card and once-use ordering and is also outside this boundary. Native Karama exceptions do not certify Nexus coverage of either producer.',
      'Existing exhausted-cache, cache-ordering, positive Black Market seller-bid and special-acquisition guards remain. Unsupported counters or any-time overlays must not enter this saved purchase boundary. Finish the response before underlying bidding or other actions can change its reserved card or funding.',
      'Refreshing resumes the same event, passes and original auction continuation. Saved pending and completed history must retain exact physical source and once-only payment without rerolls, raw-action replay or requiring old cards to remain forever in discard. Stale or foreign event submissions reject rather than selecting another lot.',
      'All four AI difficulties use the same private legal Use/public Pass projection. This is minimal legal participation, not calibrated Richese strategy. Bounded engine, authenticated SQL, real table controls and refreshed phone-browser scenarios are verified locally; full Richese/Nexus games, wider compositions and deployed acceptance remain open.',
    ],
    example: 'Richese wins a revealed cache lot for 4: Betrayal veto discards that card, charges nobody and delivers nothing. If Harkonnen instead buys it for 4, sale diversion charges the original four spice once, sends it to the bank, delivers the card and preserves the applicable Harkonnen bonus. If everyone passes, the original purchase settles unchanged: Richese’s self-buy pays Emperor/bank; the other buyer’s sale pays Richese.',
    related: ['nexus-cards', 'richese-cards', 'richese-acquisition', 'bidding', 'alliance-funding', 'privacy', 'faction-richese', 'implementation-checklist'],
    checklist: [
      { area: 'Implementation', status: 'Partial', detail: 'Bounded public self-cache veto and other-buyer cache/Black Market recipient override bind original source, invoice and continuation with independent pending/completed history. Hidden normal self-buys, special acquisition and combined responses remain excluded.', evidence: ['game/nexus-richese-betrayal.ts', 'game/engine.ts', 'game/auction-continuation-quote.ts'] },
      { area: 'Player controls', status: 'Partial', detail: 'Mounted preview controls separate public neutral pass/wait from private legal Use, retain existing entitled inspectors and suspend the underlying auction panel without revealing the unknown Black Market face.', evidence: ['components/nexus-richese-betrayal.tsx', 'components/game-table.tsx'] },
      { area: 'AI', status: 'Partial', detail: 'All four minimal legal policies consume canonical own-view eligibility and acknowledge publicly required opportunities; full strategy and calibration remain unfinished.', evidence: ['game/bot-nexus-richese-betrayal.ts', 'game/bots.ts'] },
      { area: 'Documentation', status: 'Partial', detail: 'Prepayment veto, same-invoice diversion, singleton cost, pass behavior, neutral protocol, entitled faces and excluded producer/counter boundaries are explained without full-family or publisher-timing claims.', evidence: ['docs/NEXUS_RICHESE_RULES.md', 'docs/NEXUS_CARD_RULES.md', 'docs/RULE_DECISIONS.md'] },
      { area: 'Verification', status: 'Partial', detail: '80 focused cases and 5,953 offline checks cover both alternatives/all-pass, exact custody/escrow/bonus, identity parity, four legal bot profiles, real table controls and authenticated SQLite restart/races/orphan rejection. Actual CLI/runtime and phone controls prove Basic veto, Advanced all-pass and cache/Black Market diversion with refresh. Local HTTP 51/55 retains three 503s and one timeout; full-family, wider-module and deployed acceptance remain open.', evidence: ['tests/nexus-richese-betrayal.test.ts', 'tests/nexus-richese-betrayal-engine.test.ts', 'tests/nexus-richese-betrayal-controls.test.tsx', 'tests/bot-nexus-richese-betrayal.test.ts', 'tests/nexus-richese-betrayal-recovery.test.ts', 'docs/NEXUS_RICHESE_RULES.md'] },
    ],
  },
  {
    id: 'nexus-guild-betrayal',
    title: 'Guild Nexus Betrayal: take one funded shipment payment',
    category: 'Advanced & expansions',
    coverage: 'Partial',
    developmentStage: 'Verified',
    summary: 'In the explicit Guild Betrayal preview, an unallied rival holding Guild Nexus may take one full original positive shipment payment, including their own pre-funded payment, instead of Guild, bank or occupied Junction income.',
    steps: [
      'This is the fresh local guild-betrayal development profile, not a public module start or an upgrade to saved games. It admits two to six ready classic-faction seats in Basic or Advanced, with native Guild and at least one other faction, physical base decks and Nexus. Homeworlds are optional only when genuinely enabled and seeded at setup. Other expansion factions/decks, Leader Skills, Discoveries, Tech Tokens, Stronghold Cards, Semuta, Kull and Richese previews remain outside this boundary.',
      'Remain unallied and hold the actual singleton Guild Nexus while another seated player is native Guild. Use spends that physical Nexus once, with no Treachery Card, hand slot or extra activation spice. Cunning and absent-Guild Secret Ally are separate modes. An empty Guild board or temporary leader control does not change the mode.',
      'Only original native shipment producers are admitted in this profile. Guild Nexus Cunning’s second shipment and Richese Nexus Secret Ally’s discounted shipment are blocked before spending a card or creating a native parent; those effects outside this profile remain unchanged. Guild Secret Ally is already unavailable because native Guild is seated, not because Betrayal adds a new prohibition to that panel.',
      'Wait for a legal positive shipment fee after any applicable native stop and rate responses. The original source, tariff and physical forces must already be legal and fully funded. Stopped, declined, invalid or zero-cost shipments cannot award spice or spend this Nexus; ordinary free Fremen reinforcement and free Guild Ambassador transport stay distinct.',
      'Use takes the full original charged payment, not merely eligible Guild income or its reduced half. The original payer and authorized ally contribution pay once, but Guild, bank and any occupied-Junction receiver get none of that invoice. This is replacement of one fee, not an extra award or second charge.',
      'You may take your own payment, but you must afford it before receiving it back. A wholly self-funded payment is paid and returned for net zero spice; future receipt cannot finance the declaration. An ally’s pledge has already debited that donor into escrow: the original escrow is consumed once, not charged to the donor again. Taking the fee does not change the payer’s own remainder or donor split. Your live voluntary-spend promises and reservations still apply.',
      'The printed occupied-Junction override delivers the entire fee: a four-spice payment gives the holder four, not two while an occupier gets two. It does not decide ordinary low-Junction contribution rounding, occupation entitlement after departure/replacement/contest or retained penalties. Non-overridden settlement keeps its native restrictions; a hypothetical Nexus play cannot bypass an unresolved original invoice.',
      'Supported original producers are ordinary physical reserve shipment onto Arrakis, native Guild cross-planet/return transport, existing native Homeworld shipment and an accepted Junction-sponsored transport. Keep the same tariff, physical elite/advisor group, selected native Homeworld reserve sources, source/destination custody and sponsor/offer. No new foreign Homeworld route or Secret Ally return permission is granted.',
      'The original native shipment completes once: pay the bound fee, move the exact physical forces, mark that shipment used and finish applicable native arrival and response decisions. Ordinary movement afterward remains available under the shipper’s own rules. Betrayal does not grant another shipment, move, rate or sponsorship.',
      'Every publicly possible unallied non-Guild seat with held-Nexus presence receives the same event and shipper, including an eligible shipper. A secret irrelevant face still uses Pass; only a privately eligible Guild-card holder sees Use and their own unavailable reason. This neutral acknowledgement is an application privacy protocol, not publisher timing authority, blanket Karama immunity or a new general response priority.',
      'The response adds no price, source/family/world, destination, force count, donor, balance, recipient or saved-receipt disclosure. Existing own-source and public inspector entitlements do not expand. Neutral acknowledgement logs no secret fee or source; the original committed shipment retains its normal result logging. Inspecting a printed Nexus reference is not evidence of another player’s held card.',
      'Pass spends nothing and keeps Nexus. A recorded pass cannot be undone for this event. All required passes settle the original shipment once with its original receiver; with no publicly possible responder it settles automatically. Accepted Use spends the physical Nexus and redirects the same fee. Both actions submit only the offered event: the server binds payment and recipient. Finish this gate before shipping, moving, pledging, playing cards or opening another decision.',
      'Refresh resumes the same typed producer, original invoice, passes and pending/completed ownership without a second donor debit, fee, card spend or force move. Stale or foreign events, malformed/orphaned saves and competing Use/final-Pass requests cannot select a new shipment or replay a raw action. Bounded direct engine, authenticated SQLite and actual Basic/Advanced CLI/phone source paths are verified locally; this does not certify complete Guild or Nexus rules.',
      'Easy, Medium, Hard and Brutal share a minimal legal projected Use/Pass path; this is not Guild strategy or calibrated difficulty. Full Guild/Nexus/Homeworld families, wider compositions, full games, public starts and live deployment remain separate closed gates.',
    ],
    example: 'Your original shipment costs four spice and you already have four available: Use pays that fee once and returns all four to you, spending Guild Nexus but granting no extra shipment. If another shipper pays four, you receive four instead of Guild, bank or an occupied Junction receiver. Passing leaves the original routing unchanged.',
    related: ['nexus-cards', 'movement', 'alliance-funding', 'homeworlds', 'privacy', 'faction-guild', 'implementation-checklist'],
    checklist: [
      { area: 'Implementation', status: 'Partial', detail: 'Bounded reserve, native Guild transport, Homeworld and Junction producers bind the full funded invoice and original typed continuation with independent pending/completed ownership. Own refund, donor escrow and occupied-Junction replacement retain once-only native payment/delivery; wider producers remain excluded.', evidence: ['game/nexus-guild-betrayal.ts', 'game/engine.ts'] },
      { area: 'Player controls', status: 'Partial', detail: 'The bounded contract separates uniform acknowledgement from private Use and own blocked reason, with event-only actions, unchanged inspector entitlements and no new fee/source disclosure. Broader presentation and acceptance remain open.', evidence: ['components/nexus-guild-betrayal.tsx', 'components/game-table.tsx'] },
      { area: 'AI', status: 'Partial', detail: 'All four profiles use only canonical projected legal Use/Pass choices while the payment gate suspends underlying actions. Full strategy and calibration remain unfinished.', evidence: ['game/bot-nexus-guild-betrayal.ts', 'game/bots.ts'] },
      { area: 'Documentation', status: 'Partial', detail: 'Printed full-fee and own-payment clauses, escrow funding, explicit occupied-Junction override, four native adapters, privacy protocol and unchanged open occupation/rounding/priority boundaries are recorded. Full-family acceptance remains open.', evidence: ['docs/NEXUS_GUILD_RULES.md', 'docs/NEXUS_CARD_RULES.md', 'docs/HOMEWORLD_PAYMENT_INCOME_RULES.md', 'docs/RULE_DECISIONS.md'] },
      { area: 'Verification', status: 'Partial', detail: '147 selected offline cases and 6,114 full offline checks cover four native adapters, funded own refunds, original escrow, full low-Junction override, face-neutral acknowledgement, four legal bot profiles, actual handlers, authenticated restart/races and independent native-grant/orphan rejection. Eight real backed-up CLI entries and 390-pixel controls prove own/other/escrow/Guild-return/Homeworld/Junction Use, all-pass, free Fremen and refresh with exact saved force/card/spice custody. Local HTTP 48/55 has five 503s and two timeouts; broader and deployed acceptance remain open.', evidence: ['tests/nexus-guild-betrayal.test.ts', 'tests/nexus-guild-betrayal-engine.test.ts', 'tests/nexus-guild-betrayal-controls.test.tsx', 'tests/bot-nexus-guild-betrayal.test.ts', 'tests/nexus-guild-betrayal-recovery.test.ts', 'docs/NEXUS_GUILD_RULES.md'] },
    ],
  },
  {
    id: 'nexus-ixian-replacement',
    title: 'Ixian Nexus Secret Ally: replace the just-purchased card',
    category: 'Advanced & expansions',
    coverage: 'Partial',
    developmentStage: 'Verified',
    summary: 'In the fresh local ixian-replacement preview, an unallied holder with Ixians absent may spend the physical Ixian Nexus to discard exactly the card just bought in a normal auction and draw the next Treachery deck card privately.',
    searchText: 'Ixian Nexus Secret Ally purchased card replacement normal auction Karama full hand empty deck same card',
    steps: [
      'This fresh local profile admits two-to-six unique classic-faction seats in Basic or Advanced with base Treachery, or additionally Basic Tleilaxu plus classic opponents with the original Ix47 deck and Ixians absent. Nexus alone; optional Sandtrout is omitted only in the fresh native variant. Advanced Tleilaxu, other native expansions, Leader Skills, Homeworlds, Semuta, Discoveries, Ecaz variants and other overlays remain guarded. No public start or saved-game upgrade.',
      'Nexus has no starting deal. A draw requires a qualifying closing Nexus with an alliance. A two-seat profile can continue its base game but cannot naturally create an unallied Secret Ally holder; actual replacement needs at least three seats, or four for two simultaneous unallied recipients.',
      'The photographed publisher face grants an independent Secret Ally operation when Ixians are absent. Remain unallied and hold the actual singleton Ixian Nexus. Native Ixian allied replacement is a different cancelable advantage and is not removed or used as a fallback. The adopted unofficial Advanced rulebook supplies relevant core rules, not this absent Nexus face or a new Nexus ruling.',
      'Wait for a genuine normal-auction purchase, paid with spice or through an actual printed Karama purchase, including direct printed acquisition before a positive bid. Native Bene Gesserit Worthless/Truthtrance substitutions continue unchanged without this bounded offer; that producer limit is not a ruling that they are not purchases. A Harkonnen buyer and cache, Black Market or special-purchase origins are guarded pending bonus priority and independent Nexus cache-scope rulings. A Harkonnen rival remains allowed. Gifts, bonus draws, Technology swaps and old hand cards are not eligible purchases.',
      'Every publicly unallied supported buyer with public held-Nexus presence receives the same neutral Purchased card choice, irrespective of the secret face. An irrelevant-face buyer may Pass but cannot Use. This is an inferred development privacy convention, not publisher-prescribed timing or a general resolution of pending anytime and response-priority questions.',
      'Only the buyer may inspect its already-owned purchased card in this choice. You may inspect your own actually held Nexus through the existing authorized inspector; the prompt does not identify anybody else’s Nexus. Rivals receive no purchased or replacement face, private price, receipt, deck order or eligibility reason. Earlier Atreides auction inspection does not grant a peek of the replacement.',
      'Pass keeps your purchased card and Nexus and closes this purchase opportunity. Use spends your physical Ixian Nexus once and discards exactly that just-purchased Treachery Card before drawing the actual next deck card. You cannot select another held card, replacement face, price or recipient; both actions bind only the offered event.',
      'A full legal hand can replace because the discard opens its slot first. If the draw deck is empty, recycle eligible Treachery discards including the card just discarded: the same physical card can legally return. The unsold auction row is not the draw deck, and no different-card guarantee or new auction is created.',
      'Keep the original payment, funded contribution and free/paid source. There is no refund or second debit. Original income and the native auction continuation finish once after the choice, preserving existing response and decision priority. Other lot, card, transfer and payment actions cannot bypass the pending source lock; independent own-seat autopilot changes remain available.',
      'Refresh restores the same pending event or closed outcome without another payment, draw, shuffle or Nexus spend. A later genuine purchase may create a new event; closed, stale, foreign or malformed events cannot reopen an old one. Later transfers and reshuffles do not invalidate history merely because the old physical card has moved again. Receipt links are nonrecursive so saved history stays linear across retained purchases.',
      'Easy, Medium, Hard and Brutal use their own projected legal Use/Pass choices. These are minimal legal policies, not calibrated Nexus strategy. Frozen native, private controls, actual local CLI/phone and authenticated recovery evidence verifies only this bounded path. Full faction/module games, wider compositions, public starts and deployed acceptance remain separate gates.',
    ],
    example: 'You buy a card for four spice and inspect it privately. Pass keeps it and the Nexus. Use keeps the original four-spice purchase settled, spends Ixian Nexus, discards that exact card and draws the next deck card. If the draw deck is empty, its new discard joins the actual recycled pile and can be drawn again.',
    related: ['nexus-cards', 'bidding', 'ix-technology', 'card-karama', 'alliance-funding', 'privacy', 'implementation-checklist'],
    checklist: [
      { area: 'Implementation', status: 'Partial', detail: 'The fresh bounded profile binds the exact canonical normal paid/printed Karama purchase, physical replacement and closed-event history to native payment/discard/draw/auction continuation. Harkonnen buyers, special origins and combined modules remain guarded.', evidence: ['game/nexus-ixian-replacement.ts', 'game/engine.ts', 'tools/prototype-room.ts'] },
      { area: 'Player controls', status: 'Partial', detail: 'Neutral Purchased card choice separates buyer-only purchased-card inspection and legal Use/Pass from public waiting; own-held Nexus inspection grants no rival entitlement. Broader presentation acceptance remains open.', evidence: ['components/nexus-ixian-replacement.tsx', 'components/game-table.tsx'] },
      { area: 'AI', status: 'Partial', detail: 'All four minimal legal policies consume only their own projected event and eligibility while the underlying auction waits. Full strategy and difficulty calibration remain unfinished.', evidence: ['game/bots.ts'] },
      { area: 'Documentation', status: 'Partial', detail: 'Photographed face, exact physical target, full-hand/empty-deck rules, original settlement once, privacy convention and unresolved cache/Harkonnen/priority boundaries are recorded without PDF Nexus authority or full-family claims.', evidence: ['docs/NEXUS_IXIAN_REPLACEMENT_RULES.md', 'docs/NEXUS_CARD_RULES.md', 'docs/RULE_DECISIONS.md'] },
      { area: 'Verification', status: 'Partial', detail: 'Original base acquisition/full-hand/depleted-pool/native ledger and private/SQLite/phone evidence remains historical. Native Basic Tleilaxu/Ix47: four meaningful regressions, shared affected110 and final native/guide26, twelve actual card/policy programs, original CLI and390px Thumper-to-Amal/spent-Nexus/buyer3/Emperor10-to12 before phase4 opening. No new assurance campaign; full families/modules and deployment remain open.', evidence: ['tests/nexus-ixian-replacement.test.ts', 'tests/nexus-ixian-replacement-engine.test.ts', 'tests/fixtures/nexus-ixian-native-depleted.json', 'tests/fixture-nexus-ixian-replacement.ts', 'tests/fixture-native-ixian-replacement.ts', 'tests/native-ixian-replacement.test.ts', 'tests/nexus-ixian-replacement-controls.test.tsx', 'tests/bot-nexus-ixian-replacement.test.ts', 'tests/nexus-ixian-replacement-recovery.test.ts', 'tests/prototype-room.test.ts', 'docs/NEXUS_IXIAN_REPLACEMENT_RULES.md'] },
    ],
  },
  {
    id: 'nexus-ixian-betrayal',
    title: 'Ixian Nexus Betrayal: prevent Bidding or Technology',
    category: 'Advanced & expansions',
    coverage: 'Partial',
    developmentStage: 'Verified',
    summary: 'In the fresh local ixian-betrayal preview, an unallied rival may spend the physical Ixian Nexus to prevent one original native Bidding inspection/draw attempt or one Advanced Technology exchange before its effect.',
    searchText: 'Ixian Nexus Betrayal Bidding extra card inspection draw Advanced Technology exchange native counter neutral acknowledgement',
    steps: [
      'This fresh local profile admits two to six unique Basic or Advanced seats with native Ixians and otherwise classic factions or Tleilaxu, the physical forty-seven-card Ix Treachery Deck and Nexus alone. CHOAM, Richese, Ecaz, Moritani, Homeworlds, Leader Skills, Semuta, Discoveries and other optional overlays are excluded. It is not a public start, reset or upgrade to an old save.',
      'Nexus has no initial deal or automatic draw. Finish a genuine qualifying closing Nexus with an alliance before an unallied seat may draw. One natural receiver needs at least three actual seats; two simultaneous receivers need four. A two-seat profile can continue ordinary play without fabricating an unreachable Betrayal card.',
      'The photographed publisher face grants both alternatives, but one card cannot prevent both. Remain unallied and hold the actual singleton Ixian Nexus while another seat is native Ixians. Use discards that physical Nexus once, without a Treachery Card, Karama, activation spice, hand slot or force cost. Cunning and absent-Ixian Secret Ally remain separate modes.',
      'The current original native attempt determines the alternative. Bidding works in Basic and Advanced; Technology requires Advanced and an actual accepted exchange declaration before bidding or Atreides inspection. You cannot choose a different source, provider, draw count, hand card, lot, price or completed attempt.',
      'Resolve the original native Karama window first, including legal Advanced Bene Gesserit substitutions. A successful native counter takes the original denied transition once without opening a Nexus gate or spending Nexus. After all native passes, pause before the actual draw, exchange or Atreides peek.',
      'Original native response ownership survives legal BG Worthless-Karama conversion and hand-exchange suspension. If a legal pre-offer Harkonnen exchange removes the declared Technology card, the native attempt completes without an exchange or Nexus offer; the declared attempt stays used. An already-open Nexus source still rejects changed card custody or parent state.',
      'All publicly possible unallied non-Ixian seats with public held-Nexus presence receive the same Native Ixian advantage acknowledgement, irrespective of secret face. An irrelevant-face seat may Pass; only the canonical privately eligible owner sees Use and their own unavailable reason. Native-counter-first and neutral acknowledgement are explicit bounded privacy/ordering inferences, not publisher-prescribed universal priority or a ruling for other pending stacks.',
      'Pass · allow the original advantage spends nothing and retains Nexus. Your saved pass cannot be undone for this event. All required passes allow the original native effect once; no publicly possible responders allow it immediately. Use Ixian Nexus · prevent this Bidding advantage or Technology advantage spends the singleton card and denies just this source.',
      'Bidding prevention draws exactly the normal allocated count, without an extra inspection card, Ixian private inspection or return selector. All-pass retains the native extra draw, private top/bottom return and auction continuation. The real native deck allocation still governs depleted stock; Nexus does not manufacture cards or rebuild the pool.',
      'Technology prevention keeps the selected Ixian hand card and unseen lot where they were, preserves the declaration’s spent once-per-turn attempt, then resumes the original normal Atreides/auction continuation once. All-pass performs the actual declared exchange and its continuation once. A native decline before declaration still saves the option.',
      'This is one current attempt, not a whole-phase ban, removal of all Ixian powers or undo of already completed draws, selections, exchanges, inspections or purchases. A later legally available native attempt may open a new event, including after later physical card recycling. General duration over other multiple-lot situations remains outside this bounded profile.',
      'The acknowledgement exposes only its public event, Bidding/Technology kind and native provider. It reveals no selected Ixian hand card, unseen lot, extra inspection faces, deck order, rival Nexus identity, private source or rival eligibility reason. Inspect only your own actually held Nexus through its existing inspector; a neutral prompt grants no new card entitlement.',
      'Both actions submit only the offered event. Refresh resumes the same source and passes without another declaration, native counter cost, Nexus spend, draw, swap or suffix. Closed events expire; nonrecursive saved history remains valid when cards later move or recycle. Stale, foreign, malformed or orphaned sources reject instead of silently allowing the native effect.',
      'Finish the pending source before ordinary bidding, draws, exchanges or competing card mutation. Existing responses, decisions and Truthtrance retain priority; independent own-seat autopilot changes remain available to every seat. No additional Karama counter to direct Nexus prevention is invented, and no blanket Nexus immunity follows.',
      'Easy, Medium, Hard and Brutal use their own projected legal Use/Pass choices for minimal continuation, not calibrated Nexus strategy. Frozen native, private controls, bots, authenticated recovery, exact-version CLI and phone evidence verify this bounded path. Raw administrator progress follows the same public unfinished acknowledgements; full modes and deployment remain separate gates.',
      'Advanced Technology on Richese cache/Black Market lots remains unresolved and excluded; its separate saved decline elsewhere is not an exchange ruling. General competing-effect priority, combined modules, complete Ixian/Nexus games, strategic calibration, public release and live deployment remain separate gates. The adopted unofficial Advanced PDF supplies core defaults, not this Nexus face or a new Nexus ruling.',
    ],
    example: 'After native counters pass, a rival spends Ixian Nexus on Bidding: only the ordinary allocated auction cards are drawn and Ixians inspect none. On an Advanced Technology declaration instead, Use keeps both cards in place and the declared attempt used; the normal Atreides/auction suffix follows. Passing permits the corresponding original advantage unchanged.',
    related: ['nexus-cards', 'bidding', 'ix-technology', 'ix-deck', 'card-karama', 'advanced-beneGesserit', 'privacy', 'implementation-checklist'],
    checklist: [
      { area: 'Implementation', status: 'Partial', detail: 'Both current-attempt alternatives bind original native source and continuation, separate singleton Nexus cost, native counters first, uniform public membership and nonrecursive pending/closed history. Wider producers, duration and combined modules remain excluded.', evidence: ['game/nexus-ixian-betrayal.ts', 'game/engine.ts', 'game/ix-auction-draw-quote.ts', 'game/ix-technology-cancellation.ts', 'tools/prototype-room.ts'] },
      { area: 'Player controls', status: 'Partial', detail: 'Neutral native-advantage acknowledgement separates public Pass/wait from private eligible Use and own-held Nexus inspection, with event-only actions, no rival card/source disclosure and pending native controls suspended. Broader presentation acceptance remains open.', evidence: ['components/nexus-ixian-betrayal.tsx', 'components/game-table.tsx', 'game/table-turn.ts'] },
      { area: 'AI', status: 'Partial', detail: 'All four minimal legal policies consume only canonical own-view Use/Pass eligibility and preserve pending priority. Full Nexus strategy and difficulty calibration remain unfinished.', evidence: ['game/bot-nexus-ixian-betrayal.ts', 'game/bots.ts'] },
      { area: 'Documentation', status: 'Partial', detail: 'Photographed face, native source order, both alternatives, current-attempt duration, physical cost, inferred privacy/ordering, fresh natural Nexus rights and explicit Richese/module/public/deployment boundaries are recorded without PDF Nexus authority or full-family claims.', evidence: ['docs/NEXUS_CARD_RULES.md', 'docs/NEXUS_CARD_RUNTIME.md', 'docs/RULE_DECISIONS.md'] },
      { area: 'Verification', status: 'Partial', detail: 'Genuine native Basic/Advanced Bidding and Advanced Technology allow/prevent, printed/BG priority, exact stock/count/attempt/suffix, public face parity, legal bots and authenticated restart/races/rejection pass. Actual backed-up CLI/phone Use/Pass/partial refresh and saved stock prove both endpoints. Native Harkonnen/BG and public admin ownership regressions retain prior continuation; wider modes and deployment remain open.', evidence: ['tests/nexus-ixian-betrayal.test.ts', 'tests/nexus-ixian-betrayal-runtime.test.ts', 'tests/fixture-nexus-ixian-betrayal.ts', 'tests/nexus-ixian-betrayal-controls.test.tsx', 'tests/bot-nexus-ixian-betrayal.test.ts', 'tests/nexus-ixian-betrayal-recovery.test.ts', 'tests/prototype-room.test.ts', 'tests/ix-technology.test.ts', 'tests/admin-directory.test.ts'] },
    ],
  },
  {
    id: 'nexus-harkonnen-betrayal',
    title: 'Harkonnen Nexus Betrayal: cancel a declared traitor',
    category: 'Advanced & expansions',
    coverage: 'Partial',
    developmentStage: 'Verified',
    summary: 'The fresh local harkonnen-betrayal preview cancels one original native Harkonnen traitor call, returns that physical card immediately and gives Harkonnen a private replacement during Mentat Pause.',
    searchText: 'Harkonnen Nexus Betrayal revealed declared traitor ally caller beneficiary shuffle replacement Mentat neutral acknowledgement',
    steps: [
      'The bounded development profile requires native Harkonnen and two to six unique classic factions, Basic or Advanced, the base Treachery Deck and Nexus alone. No public start, existing-game retrofit, expansion deck, Homeworld, Leader Skill, Discovery or other overlay is enabled.',
      'Nexus has no initial deal. An actual alliance-qualified closing Nexus must supply the unallied holder. An effect scenario needs at least three seats; two seats can continue ordinary play without inventing a card. Two simultaneous receivers need four actual seats.',
      'The photographed publisher face cancels a revealed Harkonnen traitor, shuffles that exact card back immediately, and gives Harkonnen one replacement during Mentat Pause. It is not a draw-now exchange, whole-battle ban or refund of an already resolved outcome. Native Cunning and absent-Harkonnen Secret Ally remain separate effects.',
      'Only a genuine legally matching native personal or allied Harkonnen call is a source. Preserve the actual caller, combatant beneficiary, target, original revealed plans and physical identity. A false or invalid call, protected leader, another faction or finished battle cannot offer this effect.',
      'Resolve the original allied Harkonnen Karama counter first, including legal Advanced Bene Gesserit conversion. Native cancellation opens no Nexus gate or cost. A personal Harkonnen call gains no invented native counter. After native allowance, declare the actual matched traitor before its outcome and await the neutral acknowledgements.',
      'Every publicly possible unallied non-Harkonnen held-Nexus owner sees the same declared-traitor acknowledgement, regardless of secret face. Only an actual privately eligible Harkonnen-card holder sees Use and their own unavailable reason. Native-counter-first and this uniform local preview timing are bounded inferences, not an answer to the outstanding universal reaction-policy question.',
      'Pass retains both cards and cannot be withdrawn for that event; all required passes retain the original call and resume it once. Use spends the physical singleton Nexus, returns only that declared Harkonnen traitor to the actual shuffled reserve, prevents only that call and resumes the surviving original battle once.',
      'The replacement is automatic at the actual current Mentat opening, before optional actions and victory acceptance in this bounded profile. Draw the actual reserve top privately once; it may be the returned card after its shuffle. No extra confirmation, selected replacement, Treachery slot, activation spice, force or leader cost is added.',
      'The public declaration exposes only its actual matched traitor and roles, not other held Harkonnen cards, rival Nexus faces, reserve order or private source. Inspect that declared Traitor Card through its public inspector, and inspect only your own actually held Nexus. A replacement identity remains private to Harkonnen; prior public history must not claim continued ownership of the returned card.',
      'Both actions submit only the offered event. Refresh retains the same acknowledgement and partial passes; due and completed replacement provenance survives without reshuffling, redrawing or replaying native battle and phase effects. Stale, foreign, malformed or changed committed sources reject before any cost.',
      'Finish the source before ordinary votes or competing card mutation. Existing response, decision and Truthtrance priority remain intact; every seat retains independent own autopilot control. Four difficulties use minimal legal projected Use/Pass, not calibrated strategy.',
      'Frozen genuine personal/allied Basic/Advanced, exact retirement and actual Mentat continuation, private controls, legal bots, authenticated races/rejection, backed-up same-setup CLI and phone evidence verify this bounded path. Raw administrator progress follows the same sole public remaining acknowledgement. The separate universal response and competing-module questions remain open; this is not complete Harkonnen/Nexus or deployed acceptance.',
    ],
    related: ['nexus-cards', 'battle', 'card-karama', 'implementation-checklist'],
    checklist: [
      { area: 'Implementation', status: 'Partial', detail: 'Original personal/allied call and native counter, exact immediate retirement, canceled call, surviving battle once and automatic private actual Mentat replacement are connected through a strict fresh local profile with bounded custody/history checks.', evidence: ['game/engine.ts', 'game/nexus-harkonnen-betrayal.ts'] },
      { area: 'Player controls', status: 'Partial', detail: 'Public declared-Traitor inspector, own eligible event-only Use/Pass/Nexus inspector, sole/multiple public ownership and every-seat independent autopilot are connected. Actual phone Use, wrong-face Pass, partial refresh and raw administrator owner agree.', evidence: ['components/nexus-harkonnen-betrayal.tsx', 'components/game-table.tsx', 'game/table-turn.ts', 'db/admin-directory.ts'] },
      { area: 'AI', status: 'Partial', detail: 'All four minimal policies consume canonical own-view choices and native pending priority with legal paced continuation; full strategy and calibration remain separate.', evidence: ['game/bot-nexus-harkonnen-betrayal.ts', 'game/bots.ts'] },
      { area: 'Documentation', status: 'Partial', detail: 'Printed immediate/delayed operations, personal/allied roles, inferred local counter/privacy convention, fresh natural card rights and unchanged outside-profile/module/public/deployment questions are explicit.', evidence: ['docs/NEXUS_HARKONNEN_RULES.md', 'docs/NEXUS_CARD_RUNTIME.md', 'docs/RULE_DECISIONS.md'] },
      { area: 'Verification', status: 'Partial', detail: 'Genuine native personal/allied Use/all-pass and actual Mentat top, printed/BG preemption, canonical stock, own/public entitlement, four bots and authenticated restart/races/rejection pass. Four privately backed-up original-setup CLI/phone rooms prove Use, wrong-face Pass, partial refresh, administrator owner and saved stock through real HTTP Mentat once. Independent native/privacy reviews have no finding; wider and deployed acceptance remain open.', evidence: ['tests/fixture-nexus-harkonnen-betrayal.ts', 'tests/nexus-harkonnen-betrayal.test.ts', 'tests/nexus-harkonnen-betrayal-runtime.test.ts', 'tests/nexus-harkonnen-betrayal-controls.test.tsx', 'tests/bot-nexus-harkonnen-betrayal.test.ts', 'tests/nexus-harkonnen-betrayal-recovery.test.ts', 'tests/prototype-room.test.ts', 'tests/admin-directory.test.ts'] },
    ],
  },
  {
    id: 'nexus-cards',
    title: 'Nexus Cards',
    searchText: NEXUS_CARD_REFERENCE.map(card => `${card.faction} ${card.betrayal} ${card.cunning} ${card.secretAlly}`).join(' '),
    category: 'Advanced & expansions',
    coverage: 'Partial',
    summary: 'A separate twelve-card deck rewards remaining unallied. Private draws and selected Atreides, Harkonnen, Tleilaxu, Ixian, Bene Gesserit, Emperor, Fremen, CHOAM, Moritani, Richese and Guild effects are connected. Other effects and complete module play remain in development.',
    steps: [
      'This optional module can be combined with Basic or Advanced rules independently of the factions and other expansion modules selected. Include one Nexus Card for each of the twelve factions.',
      'At the end of the entire Spice Blow and Nexus phase, if a Nexus occurred and at least one alliance exists, each unallied player may draw one card or discard their held card and draw a replacement. You may decline. The two Advanced spice piles do not grant two closing draws.',
      'Keep your card secret until it is used. You may hold at most one Nexus Card. It is separate from your Treachery hand and does not occupy a Treachery hand slot.',
      'Whenever you draw your own faction card, you may immediately discard it and draw again, in either Basic or Advanced play. A replacement is discarded before the new draw; when the deck is empty, shuffle its discard pile to refill it.',
      'Before drawing, choose whether to keep your own faction card, redraw it once, or redraw whenever it appears. Its effect is available in the reference before making this choice. The server applies that preference immediately; the table never pauses in a way that identifies a card you chose to keep.',
      'Entering any alliance discards your held Nexus Card, including alliances made through an Ambassador or Terror token. An offer that has not been accepted does not discard it.',
      'Use Cunning for your own faction, Betrayal when another player controls the printed faction, and Secret Ally when that faction is absent. Used cards go to the separate Nexus discard pile. Each printed effect has its own timing.',
      'Fresh original Nexus tables may retain Homeworlds, Discovery7/8, Tech3+ Basic/Advanced and Strongholds2+ Advanced, optionally all14 through leader-skills --nexus-cards. Original roster/deck envelopes are classics/base33, single or paired one-family E1/E2, both selected Ix+CHOAM native families/union47, or standalone OR paired Ecaz/Moritani/ecaz33 with classics. Printed/native setup, first-Storm Tech, actual end-Mentat claims and all12 closing draws remain. Advanced paired E3/Moritani excludes Harkonnen; shared Duke never trains. Public starts, played-save conversion, mixed E3/three-family and pending effects remain separate.',
      'Fresh nexus --discoveries uses the original no-Skills envelopes above with optional Homeworlds, Tech3+ and Advanced Strongholds. Seven Discovery Spice Cards/eight tokens, protected nested sites, next-turn physical entry and actual Maker losses/votes/reserve ride remain. The card draw follows both Advanced piles and actual settled alliance change; earlier Shai-Hulud losses never repeat. Source-clear quotas, borrowed Guild tariffs and signed native one-invoice pairs at revealed sites use original controls, not new transport adapters.',
      'Without Skills, the existing generic Nexus initializer handles single and mixed selected E1/E2 natives, while paired one-family and paired E3 entries use their original paired initializer and require BOTH original natives. Native HMS/Face Dancers/Auditor/Richese cache, Ecaz ordinary discs/Loyalty/shared Duke and Advanced Moritani assassination remain physical. New overlays do not create a first Nexus hand, free native return, arbitrary marker companion or played-game conversion.',
      'The separate fresh local leader-skills --nexus-cards entry combines classic base33/all14 Skills/all12 Nexus in Basic or Advanced, two through six seats, optionally adding original Discovery7/8 through --discoveries. Original Tech requires three or more seats; Stronghold Cards require Advanced. Starting hands/offers, actual end-Spice closing draws, first-Storm Tech and end-Mentat held custody remain. Extra/ordinary free-three returns earn original phase-end Axlotl without changing skill custody. Emperor Cunning composes skill posture, support and Suk rescue; Arrakeen reduces payer cost, not committed support or rescue eligibility. Winner cleanup precedes mandatory Tech reward. Unrelated overlays and public starts remain guarded.',
      'The original all14 skill/Nexus envelope admits single or paired one-family E1/E2, BOTH selected Ix+CHOAM native families/union47, and standalone OR paired E3/ecaz33 with classics, Basic/Advanced2–6, optional Homeworlds/Discovery7/8/Tech3+/Advanced Strongholds. Full Suboid support composes winning typed fixed-loss Suk before equal actual Cyborg Tank substitution. Held subsidy changes debit, not rescue entitlement. Original cleanup/winner Tech precedes Face Dance; the replaced trainer dies/returns its skill once without another bounty, while earlier held rewards stay with the original winner. Original Auditor exclusion, signed Richese invoices, CHOAM fuel, native cache and pending-effect guards remain.',
      'Standalone OR paired Ecaz/Moritani original skill/Nexus entries use ecaz33/all14/all12 and classics, Basic/Advanced2–6, optional Homeworlds/Discovery/Tech3+/Advanced Strongholds. Each original roster/capture guard remains, including Advanced Harkonnen exclusion and no shared-Duke training. Quiet living/unclaimed Duke Cunning and native Advanced assassination use original distinct discs and exact continuation. In paired tables, native Ecaz may be a different opposing-faction assassination target; normal foreign-world Traitor prohibition does not become an assassination ban. Exceptional Duke custody, mixed E3/three-family, enhanced Terror/HMS/Grumman and pending effects remain separate.',
      'The original nexus entry also admits standalone Ecaz OR Moritani with classics, ecaz33/all12 and NO Skills, Basic/Advanced2–6, optionally Homeworlds, Discovery7/8, Tech3+ and Advanced Strongholds2+. Original Traitors/native setup precede a qualifying closing draw, with no starting Nexus hand. Quiet Duke Cunning stays separate from shared-disc training; no-Skills Ecaz may face Advanced Harkonnen without lifting the Cunning exclusion. Advanced Moritani excludes Harkonnen, retains post-loss private assassination/normal-call forfeiture and Mentat replacement, and uses supply-only Terror Cunning. Original Ecaz-selected coalition losses/payments and source-local held benefits/Tech remain. A sole loser token transfers automatically after cleanup; a real multi-token choice remains mandatory. Other native/mixed families, borrowed free-return/companion and relocation rulings, public starts and save conversion remain separate.',
      'Atreides Cunning adds a second, different opposing plan element after the first native answer. Both remain binding. Use it in your own battle before sealing your plan; Karama may cancel the extra attempt while preserving the first disclosure.',
      'With Atreides absent, Secret Ally inspects one opposing element in your battle. A sealed plan supplies only that selected answer automatically. Otherwise the opponent chooses an answer that permits a legal plan. Other players receive no private answer.',
      'The No-Field restriction names Atreides, so Cunning cannot inspect that dial. A non-Atreides Secret Ally holder may request it without learning the token denomination or other plan elements.',
      'Residual Poison cannot follow a committed leader. If it makes a single nonleader inspection impossible, the same field is answered again and the earlier observation remains private history. Residual Poison after two completed Cunning inspections awaits a ruling on incompatible surviving commitments.',
      'Harkonnen Cunning draws one Traitor Card before you choose one held card to return. It can pause another action, including a response or decision. Finish the private return before that action continues; active Truthtrance takes priority. Returning an identity already declared as a traitor does not cancel that declaration.',
      'With Harkonnen absent, Secret Ally draws two Traitor Cards during Mentat Pause, then you choose exactly two distinct held identities to return. Newly drawn cards may be returned. Tleilaxu receives Face Dancers and can return newly drawn or existing unrevealed dancers; previously revealed dancers stay protected.',
      'The Harkonnen exchange spends the Nexus Card when you draw and shuffles the returned cards into the Traitor Deck after your selection. Your original hand size is restored. Other players see that the exchange is pending, without learning your drawn or returned identities.',
      'Harkonnen Betrayal has a separate fresh local harkonnen-betrayal profile for an actual personal or allied native traitor call. After any original allied counter allows it, uniform public possible held-Nexus owners acknowledge the actually declared traitor before its outcome. Use returns that exact physical traitor immediately and schedules one private actual Mentat replacement; all-pass keeps the original call. This provisional bounded convention does not answer the outstanding universal reaction policy; see its dedicated guide for bounded verified native/private/recovery/CLI/phone evidence and unchanged module/public/deployment gates.',
      'Tleilaxu Cunning sets aside all your revealed Face Dancers, draws their replacements secretly, and only then shuffles the set-aside cards into the Traitor Deck. Unrevealed dancers stay in your hand. This single operation does not use or renew your ordinary Mentat replacement; the native all-three-revealed reset keeps its separate shuffle-before-draw order.',
      'Ixian Cunning is used in your battle before submitting your Battle Plan. Your Suboids then count as strength one without spice support in every battle for the rest of the turn, in Basic and Advanced. Cyborg strength and support are unchanged. Earlier inspected or promised plan elements remain binding; you cannot activate the card if the new strength would make them impossible.',
      'Ixian Secret Ally has a fresh local ixian-replacement profile for normal paid or printed Karama-paid auction purchases in classic base-deck/Nexus Basic or Advanced games. A supported unallied buyer may spend its actual Nexus to discard exactly the just-purchased card and draw the real deck top privately; Pass keeps both cards. Full-hand replacement and empty-deck same-card redraw are allowed, and original payment/income/auction continuation occur once. Harkonnen buyers, cache/Black Market/special origins and combined modules remain guarded. The neutral buyer choice is an inferred privacy convention, not publisher timing. See the dedicated guide for bounded verified native, private, recovery and phone evidence; this is not full-module certification.',
      'Ixian Betrayal has a separate fresh native-Ixian ixian-betrayal profile for both original Bidding inspection/draw and Advanced Technology attempts. Native counters resolve first; then every publicly possible unallied rival held-Nexus seat acknowledges uniformly before the effect. A legal Use spends one physical Ixian Nexus to deny only that attempt; all-pass preserves the native effect once. No completed-card undo or whole-phase ban is added. This bounded ordering/privacy is an inference, not universal publisher priority; see its bounded verified native/private/recovery/phone evidence and unchanged Richese/module/public/deployment gates.',
      'Tleilaxu Secret Ally revival remains unavailable pending its ordinary-allowance, leader-eligibility and optional-leader rulings. The printed fixed force price does not resolve those questions.',
      'In Advanced play, Bene Gesserit Cunning converts selected whole advisor territories during your own Shipment and Movement action. All your counters in each selected territory become fighters together across sectors. It spends the Nexus card once, with no spice, shipment or movement cost.',
      'One Karama response covers the entire declared territory set. Cancellation keeps every selected group as advisors and leaves the Nexus card spent. Existing territory restrictions still apply; fresh accompanied advisors and storm-related conversion remain unavailable pending their rulings.',
      'Bene Gesserit Secret Ally borrowed Voice remains unavailable pending its cancellation and timing interpretation. Its printed permission does not make the other unfinished effects available.',
      'Bene Gesserit Betrayal can prevent the native Voice while the ordinary pre-plan response is open. In Nexus games every seat responds even without a canceling card, so the window does not reveal the hidden holder. An unallied opponent spends one physical Bene Gesserit Nexus card to remove only that declared Voice; Prescience and plan commitments continue. Truthtrance has priority. This path does not grant borrowed Voice.',
      'Emperor Cunning requires an Advanced battle with at least five ordinary Emperor counters and no actual Sardaukar, before submitting your plan. The played Nexus card opens one Karama response. Allowing it makes five ordinary counters count as Sardaukar for this battle; cancellation prevents the entire enhancement and leaves the Nexus card spent.',
      'Temporary Sardaukar use the applicable strength and support rules, including the Fremen exception, but remain physically ordinary counters. Their losses go to Tanks as ordinary counters, without changing starred reserves or Tanks. Existing inspected or promised plans remain binding. The role ends after this battle; fewer-than-five groups remain unavailable. The separate Secret Ally revival and normal bank-auction purchase have connected controls; seller-paid and forced Emperor payments remain unfinished.',
      'Emperor Betrayal has a battle alternative in Advanced play: an unallied opponent holding the Emperor Nexus card can spend it during the ordinary pre-plan Sardaukar response to suppress actual Sardaukar strength for this battle. Every seat receives the same response opportunity even with no card, keeping hidden custody private. The starred pieces remain physical Sardaukar; no card grants a new force or cancels their separate support benefit.',
      'With Fremen absent, an unallied holder may spend Fremen Secret Ally during Revival to return exactly three eligible forces from Tanks to reserves at no spice cost. Unlike Emperor Secret Ally, these three consume the ordinary force and free-force allowances, including the Advanced one-elite cap. This bounded base-faction path keeps prior-return and competing-revival guards; supported classic Tech/Stronghold composition invokes actual Axlotl activity after the batch, independently of allowance accounting. Both free returns collect Tech only at phase end, never as spendable advance spice. Partial returns, prior returns, higher free rates and separate sandworm protection remain unavailable.',
      'Native Fremen Cunning has a bounded Nexus-only path: when a natural, accepted additional, or Advanced special-Karama summoned worm appears in a territory initially containing no forces, Fremen may spend their own Nexus card before the worm resolves. The special summon retains its original Spice Blow parent. After the applicable Nexus, choose some forces from one occupied desert territory and ride to a legal Arrakis destination without using normal movement. The choice appears even without the secret card, so declining does not disclose custody. Karama provisionally prevents only the additional remote ride; the original worm still resolves and the card remains spent. An interrupted existing Cunning control is restored, and a selected ride waits for the summoned Nexus without granting a second Cunning offer; Great Maker and combined optional modules await integration.',
      'CHOAM Secret Ally has a working Collection trade: when CHOAM is absent, an unallied holder may discard one Worthless card and the Nexus card for two bank spice. After a battle victory, every winner in an eligible Nexus game receives the same use-or-continue window; an unallied CHOAM-card holder may instead spend that card to inspect one random unused card in the opposing combatant’s current hand. Played battle cards remain excluded even if retained. The inspected face is private, while use is public. The universal window protects concealed card custody; this is an interface interpretation, not a publisher-prescribed prompt. An ordinary Karama response to this Secret Ally inspection remains unestablished.',
      'With CHOAM seated, an unallied holder may spend CHOAM Betrayal at a clean play boundary to discard one uniformly random held CHOAM Treachery Card without spice compensation. The target name is public, but its hand count is offered only during Bidding; the holder cannot pick or inspect the card before the ordinary discard reveal.',
      'CHOAM Cunning spends its Nexus card to use one held Treachery Card for one chosen Worthless effect at that effect’s normal timing, in Basic and Advanced. Choose the physical card separately from the effect. Kulon, La La La, Baliset, Jubba Cloak and Trip to Gamont retain their existing runtime. The explicit new Nexus Kull profile adds Kull at the canonical Karama reaction only; it remains unavailable in other Nexus previews. The old printed Kull profile still excludes Nexus. See the source-aware Kull guide for cost custody, counters and pending verification.',
      'One Karama response covers the CHOAM effect. Cancellation leaves the chosen Treachery Card in hand and the Nexus spent. An allowed use discards the actual card once, retaining its printed identity and applicable discard consequences; it does not create a named Worthless card or a turn-long conversion permission.',
      'Moritani Cunning modifies its normal Mentat placement: choose one available supply token and a territory on the printed Arrakis board, including a territory already containing Terror. The explicit Cunning toggle keeps ordinary placement and relocation unchanged. Homeworlds, the Hidden Mobile Stronghold, Cunning relocation and combined Grumman use are unavailable.',
      'With Moritani seated, an unallied holder of its Nexus card may spend Betrayal at a clean play boundary to return one placed Terror token to hidden Moritani supply without revealing its face. Choose the public location and token, not its secret effect; this does not use Moritani’s Mentat placement or trigger that token.',
      'When Moritani is absent, a defeated combatant with an eligible publicly played card receives the same postbattle choice whether or not they hold Moritani Nexus. An unallied holder may spend it to retain one played card that a winner could keep; other played cards follow ordinary discard. Without a publicly eligible card there is no prompt. The choice is after the battle result and before later income/capture; the public prompt protects hidden custody and is an interface inference. This Secret Ally effect has no invented ordinary Karama response. Native Moritani allied retention remains a different, cancelable ability.',
      'With actual Advanced Stronghold Cards, Arrakeen bank support changes the real payer debit, not personal income. Emperor Cunning temporary Sardaukar remain physically ordinary counters and retain ordinary Tanks custody. Original losing Moritani retention precedes mandatory original-winner Tech, then CHOAM inspection excludes used opposing cards even if retained. Ordinary city Collection remains separate; none of these windows repeats the original support, card cost or casualties.',
      'Ecaz Betrayal is available to an unallied holder with Ecaz seated and reciprocally allied in a shared Arrakis territory. At the opening of Shipment and Movement, choose one such territory; the ally returns its entire normal and starred force group from every sector there to reserves, leaving Ecaz forces in place. The Nexus card is spent before a Karama response. Cancellation preserves the board but not the card. Only the base/Ecaz Nexus roster without combined modules is supported.',
      'Ecaz Cunning lets an unallied native holder spend its physical Nexus at a quiet Battle boundary to take the existing living, unclaimed Duke for this turn, even from Moritani. Original standalone OR paired Ecaz/Moritani/classic Nexus profiles admit this bounded effect with or without Skills and optional Homeworlds/Discovery/Tech/Advanced Strongholds. The one shared Duke remains separate from ordinary training and is set aside after use or at turn end. Advanced Harkonnen is independently excluded even where standalone no-Skills roster admission otherwise permits it. Captured, dead or foreign-Ghola Duke custody and unqualified reaction timing remain guarded; this Battle boundary is the existing product interpretation, not a printed phase restriction.',
      'Fremen Betrayal has two bounded advance-declaration alternatives for an unallied holder in a classic Nexus table. Before the first Spice Blow or worm appearance, spend the physical card to prevent Fremen ordinary and Cunning worm rides for the turn; worm survival, destruction and Nexus still resolve. This clean timing is a product boundary, not an official post-appearance priority ruling. Instead, before Fremen move during Shipment and Movement, spend it to suppress their native two-territory advantage for that turn while ordinary movement and independent ornithopters remain. Only one alternative can be used even if the card is recycled later that turn. Owner controls show the currently available choice; combined modules and reactive post-worm timing remain gated.',
      'When Ecaz is absent, an unallied holder may spend its Nexus card at a quiet play boundary to ask whether any one player, including themself, holds one of the holder’s native faction leaders as an ordinary Traitor Card. The owner receives a private yes/no answer saved at the moment of use; no name or count is disclosed. Dead or captured native leaders count, but foreign Gholas, Duke Vidal, Cheap Hero and Face Dancers do not. Native-leader scope and private-only audience are explicit product interpretations, not publisher rulings; exceptional controlled-leader and public-disclosure combinations remain open.',
      'When Richese is absent, its Secret Ally replaces your ordinary reserve shipment with up to five physical forces charged as one. Select the explicit shipment checkbox; forces, elite identity, destination restrictions, Homeworld reserve sources and normal movement remain unchanged. Fremen remain free within their normal reinforcement range; Guild and an active Karama rate retain their existing tariff and payment routing. This is not a concealed No-Field or an extra shipment.',
      'Native Richese Cunning uses the original signed two-No-Field shipment in supported single/paired E2 or selected mixed Ix+CHOAM native Nexus tables with classics, optional Skills/Homeworlds/Discovery/Tech/Advanced Strongholds. Select two distinct unused physical tokens: one reveals immediately into reserve-capped forces, one remains concealed; pay one marker invoice and spend the Nexus. The previous shipment token cannot be either choice, and the concealed one becomes last-used. Native/Guild response and actual payer/counter sources remain; a nested destination must be revealed. Prevention keeps physical tokens and unpaid spice, after any printed card cost. Sandtrout, arbitrary companions, shared allocation and other pending combinations retain their guards.',
      'Richese Betrayal has a separate opt-in auction preview. Before payment, an unallied rival may spend its physical Richese Nexus card to discard a public self-cache win without any purchase debit, or redirect another buyer’s cache/Black Market payment to the bank while preserving delivery and earned bonus. Every publicly possible holder acknowledges the same opportunity; private Use eligibility cannot determine public timing. Normal hidden self-purchases and private special-Karama acquisitions are not connected. See the dedicated guide for its existing local runtime/browser evidence and remaining release gates; that evidence does not verify Nexus Kull.',
      'Guild Cunning is declared when finishing your ordinary Shipment and Movement turn. It spends the Nexus and opens one Karama response. Allowance grants a second native shipment at normal Guild prices, including supported cross-shipment, return and Homeworld routes. Cancellation leaves the completed first turn intact. Only an unused Hajr move can follow the second shipment; no ordinary movement or third move is granted. The physical Ornithopter card combination remains unavailable. The separate guild-betrayal profile admits only original native shipment producers and explicitly blocks this second-shipment offer before Nexus spending; Cunning outside that profile is unchanged.',
      'With Guild absent, its Secret Ally is an explicit optional source for one ordinary shipment at Guild prices. It supports physical reserve shipment, cross-shipment and return to the holder’s own reserves, including the native-Homeworld return when Homeworlds are enabled, plus half-price independently legal world-to-world shipment. Fremen may retain free reinforcement or choose the paid card route beyond its normal range, outside the storm. Native faction, typed sources and normal movement stay unchanged. Arbitrary foreign-world transport and concealed No-Fields are not granted.',
      'Borrowed Guild/Richese tariffs do not change native faction or physical reserve origin. Non-Guild/non-Fremen off-planet arrivals can accrue Heighliners once for collection at the original phase end. A paid borrowed Guild route from Fremen southern reserves is still on-planet and does not trigger it; stopped and native-Guild-only shipments likewise remain excluded. The existing Emperor bank-auction purchase retains the actual buyer wallet and creates no industry activity.',
      'Guild Betrayal has a separate fresh classic/native-Guild development preview. Before a fully funded positive shipment settles, an unallied holder may spend the physical Guild Nexus to take the full original fee, including their own pre-funded payment, instead of Guild, bank or occupied Junction income. Original donor escrow is consumed once and original physical delivery is unchanged. Neutral public acknowledgements reveal no fee/source; only private eligibility exposes Use. Zero/stopped shipments create no award or Nexus cost. See the dedicated guide; new verification remains Planned and ordinary Homeworld occupation/rounding questions stay local.',
      'Cunning spends its Nexus card and uses the native Mentat placement opportunity. A Karama response precedes placement; cancellation leaves the token where it was and the Nexus spent. Later Terror entry still uses the existing one-token stack selection and supported effect rules. If Extortion was revealed this turn, its bank award and payment choices follow that placement response; this does not implement Atomics or complete Moritani games.',
      'Hidden reactive Betrayal timing remains unresolved for other effects. Complete module games are unfinished, so public module starts remain disabled.',
    ],
    related: ['ecaz-modules', 'spice-blow', 'alliance-funding', 'choam-worthless', 'choam-kull', 'nexus-choam-kull', 'nexus-richese-betrayal', 'nexus-guild-betrayal', 'nexus-ixian-replacement', 'nexus-ixian-betrayal'],
    checklist: [
      { area: 'Implementation', status: 'Partial', detail: 'Physical lifecycle, Atreides inspections, Harkonnen exchanges/declarations, Face Dancers, Suboids, advisors, native Voice, Emperor Sardaukar and Betrayal, bounded Fremen revival/Cunning, CHOAM effects, Moritani Cunning/Betrayal, Ecaz Betrayal, native Duke Cunning and private Secret Ally inquiry, Richese shipment and bounded auction Betrayal, and bounded Emperor bank-auction purchase are integrated. Ecaz Cunning transfers the existing Duke at a quiet Battle boundary with a real card and distinct turn-end expiry. Ecaz inquiry scope/audience and Emperor purchase timing are provisional. Borrowed Voice, exceptional Duke custody, other reactions, Tleilaxu revival, Fremen worm protection and combined Cunning interactions remain unfinished.', evidence: ['game/nexus-cards.ts', 'game/nexus-card-phase.ts', 'game/nexus-traitor-exchange.ts', 'game/traitor-declarations.ts', 'game/nexus-face-dancers.ts', 'game/nexus-suboids.ts', 'game/nexus-advisors.ts', 'game/nexus-sardaukar-options.ts', 'game/nexus-fremen-revival.ts', 'game/nexus-fremen-cunning.ts', 'game/nexus-ecaz-betrayal.ts', 'game/nexus-ecaz-inquiry.ts', 'game/nexus-ecaz-duke.ts', 'game/duke-vidal.ts', 'game/nexus-emperor-secret-ally.ts', 'game/choam-power-options.ts', 'game/nexus-moritani-options.ts', 'game/nexus-moritani-betrayal.ts', 'game/nexus-richese-options.ts', 'game/nexus-richese-betrayal.ts', 'game/nexus-guild-cunning-options.ts', 'game/nexus-guild-secret-ally-options.ts', 'game/nexus-module-profile.ts', 'game/engine.ts'] },
      { area: 'Player controls', status: 'Partial', detail: 'Private lifecycle, inspections, exchanges, Tleilaxu refresh, Ixian activation, advisor selection, temporary Sardaukar and CHOAM effects, Moritani Betrayal, Ecaz Betrayal and owner-only Secret Ally inquiry, native Duke Cunning, Richese shipment and bounded auction Betrayal, Emperor purchase and Fremen Cunning controls are connected. Remaining effect controls are unfinished.', evidence: ['components/nexus-cards.tsx', 'components/nexus-traitors.tsx', 'components/nexus-tleilaxu.tsx', 'components/nexus-suboids.tsx', 'components/nexus-advisors.tsx', 'components/nexus-sardaukar.tsx', 'components/choam-power-cost.tsx', 'components/moritani-terror.tsx', 'components/nexus-moritani-betrayal.tsx', 'components/nexus-ecaz-betrayal.tsx', 'components/nexus-ecaz-inquiry.tsx', 'components/nexus-ecaz-duke.tsx', 'components/nexus-richese-betrayal.tsx', 'components/game-table.tsx'] },
      { area: 'AI', status: 'Partial', detail: 'All four profiles choose legal actions through private offers, including Moritani/Ecaz Betrayal, Ecaz Secret Ally inquiry and native Duke Cunning, Fremen Cunning, Emperor purchase and bounded Richese auction Betrayal. Complete module strategy and calibration remain unfinished.', evidence: ['game/nexus-card-options.ts', 'game/nexus-traitor-options.ts', 'game/nexus-tleilaxu-options.ts', 'game/nexus-suboid-options.ts', 'game/nexus-advisor-options.ts', 'game/nexus-sardaukar-options.ts', 'game/choam-power-options.ts', 'game/nexus-moritani-options.ts', 'game/nexus-moritani-betrayal-options.ts', 'game/nexus-ecaz-betrayal-options.ts', 'game/nexus-ecaz-inquiry-options.ts', 'game/nexus-ecaz-duke-options.ts', 'game/nexus-richese-options.ts', 'game/bot-nexus-richese-betrayal.ts', 'game/nexus-guild-cunning-options.ts', 'game/bots.ts'] },
      { area: 'Documentation', status: 'Partial', detail: 'Common rules, twelve printed faces and bounded runtime contracts retain explicit unresolved Ecaz Duke capture/Tanks/Ghola and inquiry audience/scope, Fremen nested Cunning, Great Maker, combined modules, fresh advisors, storm and borrowed Voice. Richese auction Betrayal has a separate cost/prepayment/privacy contract and excluded-producer boundaries. Guild Betrayal separately records full funded payment, own pre-funding, donor escrow once, the printed full-Junction override, four native adapters and neutral privacy; ordinary occupation/rounding and general response-priority questions remain unresolved.', evidence: ['docs/NEXUS_CARD_RULES.md', 'docs/NEXUS_ATREIDES_RULES.md', 'docs/NEXUS_HARKONNEN_RULES.md', 'docs/NEXUS_TLEILAXU_RULES.md', 'docs/NEXUS_IXIAN_CUNNING_RULES.md', 'docs/NEXUS_CUNNING_RUNTIME.md', 'docs/NEXUS_BENE_GESSERIT_RULES.md', 'docs/NEXUS_ADVISOR_RUNTIME.md', 'docs/NEXUS_EMPEROR_RULES.md', 'docs/NEXUS_SARDAUKAR_RUNTIME.md', 'docs/NEXUS_FREMEN_RULES.md', 'docs/NEXUS_ECAZ_RULES.md', 'docs/NEXUS_CHOAM_RULES.md', 'docs/NEXUS_CHOAM_RUNTIME.md', 'docs/NEXUS_MORITANI_RULES.md', 'docs/NEXUS_MORITANI_RUNTIME.md', 'docs/NEXUS_RICHESE_RUNTIME.md', 'docs/NEXUS_RICHESE_RULES.md', 'docs/NEXUS_GUILD_CUNNING_RUNTIME.md', 'docs/NEXUS_GUILD_RULES.md'] },
      { area: 'Verification', status: 'Partial', detail: 'Mixed E1/E2 and paired E3 adds31 physical programmes plus2 Loyalty-stock regressions, final489/489 affected checks across42 files and types/lint. All64 original six-seat families finish258/288 games with338931/339426 actions and9013 JSON across three frozen trees and preserved-prefix continuations. Native Ecaz assassination, separate physical Loyalty stock and exact paired overlap admission are repaired; all30 remaining traces retain printed source guards. Actual390px original human Ixian offer/training, typed shipment/free Suboid plan and paired Ecaz foreign arrival/living shared Duke preserve20 counters. Earlier evidence remains canonical; not complete modes, new assurance or protected deployed acceptance.', evidence: ['tests/mixed-nexus-modules-runtime.test.ts', 'tests/paired-e3-nexus-modules-runtime.test.ts', 'tests/sample-custody.test.ts', 'tests/ambassador-terror-overlap-engine.test.ts', 'tests/single-nexus-e1-runtime.test.ts', 'tests/single-nexus-e2-runtime.test.ts', 'tests/e3-nexus-ecaz-runtime.test.ts', 'tests/e3-nexus-moritani-runtime.test.ts', 'tests/homeworld-classic-nexus-skills-runtime.test.ts', 'tests/homeworld-classic-discovery-nexus-runtime.test.ts', 'tests/nexus-cards.test.ts', 'tests/nexus-card-engine.test.ts', 'tests/nexus-fremen-cunning.test.ts', 'tests/nexus-fremen-cunning-recovery.test.ts', 'tests/nexus-fremen-cunning-summon.test.ts', 'tests/nexus-fremen-cunning-summon-recovery.test.ts', 'tests/nexus-ecaz-betrayal-quotes.test.ts', 'tests/nexus-ecaz-betrayal.test.ts', 'tests/nexus-ecaz-betrayal-recovery.test.ts', 'tests/nexus-ecaz-inquiry.test.ts', 'tests/nexus-ecaz-duke-quote.test.ts', 'tests/nexus-ecaz-duke-engine.test.ts', 'tests/nexus-ecaz-duke-controls.test.ts', 'tests/nexus-ecaz-duke-recovery.test.ts', 'tests/nexus-traitor-recovery.test.ts', 'tests/nexus-face-dancer-engine.test.ts', 'tests/nexus-suboids-engine.test.ts', 'tests/normal-free-support.test.ts', 'tests/nexus-suboid-controls.test.ts', 'tests/nexus-advisor-controls.test.ts', 'tests/nexus-advisor-bots.test.ts', 'tests/nexus-sardaukar-controls.test.ts', 'tests/nexus-sardaukar-bots.test.ts', 'tests/nexus-choam-controls.test.ts', 'tests/nexus-choam-bots.test.ts', 'tests/nexus-moritani-controls.test.ts', 'tests/nexus-moritani-bots.test.ts', 'tests/nexus-moritani-betrayal.test.ts', 'tests/nexus-richese-controls.test.ts', 'tests/nexus-richese-bots.test.ts', 'tests/nexus-richese-betrayal-engine.test.ts', 'tests/nexus-richese-betrayal-recovery.test.ts', 'tests/nexus-guild-cunning-controls.test.ts', 'tests/nexus-guild-cunning-bots.test.ts', 'tests/nexus-module-payments-runtime.test.ts', 'tests/nexus-module-battles-runtime.test.ts', 'tests/paired-ix-nexus-modules-runtime.test.ts', 'tests/paired-choam-nexus-modules-runtime.test.ts', 'tests/classic-nexus-skills-payments-runtime.test.ts', 'tests/classic-nexus-skills-battles-runtime.test.ts', 'tests/nexus-skills-modules-payments-runtime.test.ts', 'tests/nexus-skills-modules-battles-runtime.test.ts', 'tests/paired-ix-nexus-skills-modules-runtime.test.ts', 'tests/paired-choam-nexus-skills-modules-runtime.test.ts', 'tests/ecaz-nexus-skills-modules-runtime.test.ts', 'tests/moritani-nexus-skills-modules-runtime.test.ts', 'docs/NEXUS_CARD_RULES.md'] },
    ],
  },
  {
    id: 'choam-leader-skills',
    title: 'CHOAM with Leader Skills',
    category: 'Advanced & expansions',
    coverage: 'Partial',
    developmentStage: 'Prototyped',
    summary: 'Native CHOAM connects full-deck skill actions, Basic suspended-sale revival and bounded Advanced support and aftermath.',
    steps: [
      'This development combination uses Basic CHOAM and base opponents, the full fourteen-skill deck and no other optional modules. Starting cards precede skills and Traitors. Its 35-card Treachery deck includes Poison Tooth and Artillery; neither is a green Special. Auditor belongs to Advanced and cannot receive a skill.',
      'Connected movement, shipping, payment and battle skills share their normal controls and legal choices. CHOAM cannot spend a card already committed to a sale or sell a Special already discarded after Planetologist battle use.',
      'Ghola may revive an eligible own leader while a declared sale waits. Finish the spent Ghola, optional private replacement draw or decline, and any required assignment before the original sale resumes. The replacement belongs to the actual revived leader.',
      'The sale resumes with its original card, price and response passes. Canceling that sale preserves the completed free revival and does not return the spent Ghola.',
      'Fresh Advanced CHOAM and/or Ixians plus classic tables use distinct required family decks and all fourteen skills. Auditor is excluded both at assignment and paid revival; original support income and bank-held allied funding remain distinct. Richese and further optional combinations retain separate boundaries. Remaining skill effects are unfinished; this prototype does not certify complete expansion rules or AI strength.',
    ],
    related: ['leader-skills', 'choam-modules', 'implementation-checklist'],
    checklist: [
      { area: 'Implementation', status: 'Partial', detail: 'Existing genuine setup now connects ordinary skill actions, native card sales, mandatory disposal and exact interrupted-sale revival continuation.', evidence: ['game/leader-skill-profile.ts', 'game/choam-market-ghola.ts', 'game/engine.ts'] },
      { area: 'Player controls', status: 'Implemented', detail: 'Existing private draw, decline and assignment controls complete the revival before returning to the sale response.', evidence: ['components/leader-skills.tsx', 'components/game-table.tsx'] },
      { area: 'AI', status: 'Partial', detail: 'All profiles follow current private offers and legal action lists. Full strategy and calibration wait for feature completion.', evidence: ['game/bots.ts', 'tools/faction-games.ts'] },
      { area: 'Documentation', status: 'Implemented', detail: 'Exact configuration, inventory, source composition and remaining boundaries are recorded.', evidence: ['docs/CHOAM_LEADER_SKILLS.md'] },
      { area: 'Verification', status: 'Partial', detail: 'Full-deck setup, native powers, skill controls, card custody, saved-sale corruption, private concurrent recovery and bounded complete games have focused checks. Final acceptance remains open.', evidence: ['tests/choam-skills-integration.test.ts', 'tests/choam-skills-ghola.test.ts', 'tests/choam-skills-recovery.test.ts', 'tools/faction-games.ts'] },
    ],
  },
  {
    id: 'ixian-leader-skills',
    title: 'Ixians with Leader Skills',
    category: 'Advanced & expansions',
    coverage: 'Partial',
    developmentStage: 'Prototyped',
    summary: 'Native Ixians connect the full skill deck to cyborg movement, the HMS and Basic or bounded Advanced battle aftermath.',
    steps: [
      'The private starting-card choice precedes the full skill deal, Traitors and real first-Storm HMS placement. Basic Ixians retain Tleilaxu and base combinations. Fresh Advanced Ixians and/or CHOAM plus classic tables use distinct required family decks; unrelated optional overlays and foreign gholas remain guarded.',
      'Planetologist calculates each gathered origin separately using its selected cyborgs. Canceling native cyborg movement leaves the independent skill range available. Sandmaster routes can enter or leave the HMS through its current pointer.',
      'Suk Graduate rescues finish before substitution. Select the original sectors of rescued cyborgs where needed; only cyborgs actually sent to the Tanks can return through substitution. Rihani also finishes before native substitution.',
      'Planetologist may substitute the green Thumper, Harvester or Amal in its weapon role. Their normal effects do not execute, and mandatory disposal still follows allowed, declined or canceled substitution.',
      'Missing skill bands, Sandmaster eligibility during native HMS relocation and other combined configurations remain unresolved or unfinished. This prototype does not certify complete rules or AI strength.',
    ],
    related: ['leader-skills', 'tleilaxu-leader-skills', 'implementation-checklist'],
    checklist: [
      { area: 'Implementation', status: 'Partial', detail: 'Genuine setup, per-origin range, HMS force routes, actual rescued/casualty custody and ordered battle cleanup are connected.', evidence: ['game/leader-skill-profile.ts', 'game/suk-graduate.ts', 'game/engine.ts'] },
      { area: 'Player controls', status: 'Implemented', detail: 'Private setup, typed movement, room-local routes and explicit rescue-origin choices retain saved decisions.', evidence: ['components/planetologist-movement.tsx', 'components/sandmaster-movement.tsx', 'components/suk-graduate.tsx'] },
      { area: 'AI', status: 'Partial', detail: 'Existing profiles use legal shared ranges and current choice lists. Full strategy and difficulty tuning remain deferred until feature completion.', evidence: ['game/bot-mobility.ts', 'game/bots.ts'] },
      { area: 'Documentation', status: 'Implemented', detail: 'Configuration, physical source inventory, source composition and remaining boundaries are recorded.', evidence: ['docs/IX_LEADER_SKILLS.md'] },
      { area: 'Verification', status: 'Partial', detail: 'Full-deck setups, controls, corruption/custody, authenticated concurrent recovery and two-through-six-player samples cover this bounded composition.', evidence: ['tests/ix-skills-movement.test.ts', 'tests/ix-skills-battle.test.ts', 'tests/ix-skills-suk.test.ts', 'tests/ix-skills-recovery.test.ts', 'tools/faction-games.ts'] },
    ],
  },
  {
    id: 'tleilaxu-leader-skills',
    title: 'Tleilaxu with Leader Skills',
    category: 'Advanced & expansions',
    coverage: 'Partial',
    developmentStage: 'Prototyped',
    summary: 'Native Basic and bounded Advanced Tleilaxu retain fourteen skills, Face Dancers and original foreign-ghola ownership without a new skill.',
    steps: [
      'Basic Tleilaxu with base opponents retains its existing full skill deck. Fresh Advanced native Tleilaxu, optionally Ixians and/or CHOAM, plus classic tables use distinct required Ix/CHOAM decks and all fourteen skills. Starting choices, actual traitors and three native Face Dancers remain. Unrelated overlays and public starts stay gated.',
      'Rihani draws become unrevealed Face Dancers. Keep one new card by revealing and returning one unrevealed old card; the other new card returns privately. Only the owner sees the inspection history and new identities.',
      'A successful own-leader revival preserves the optional skill draw after revival responses. Winner skill and card cleanup precede Face Dance; a killed skilled leader returns its card once. Zoal copies the opposing disc value for unmodified Smuggler collection.',
      'Actual foreign revival pays its native half price and fills the controlled living pool only up to five, but never draws or assigns a skill. The original faction keeps the sole physical disc; Tleilaxu controls it. A native trainer can supply its normal role bonus to that different selected disc, not its trained lower bonus. Own revival still offers its eligible optional draw. Auditor and the Ecaz-only Duke/Ghola exclusions remain.',
      'Foreign death and negotiated original-owner buyback use original handlers. Harkonnen capture temporarily overrides Tleilaxu control without moving the disc into another physical roster. Its actual plan reveal removes the concealed snapshot; surviving use returns the ghola to Tleilaxu. Execution preserves the original dead-ghola return path. No skill attaches to a foreign disc.',
      'Other unfinished skill effects retain their stated limits. This development combination does not certify the full expansion or every optional-module interaction.',
    ],
    related: ['leader-skills', 'tleilaxu-face-dancers', 'implementation-checklist'],
    checklist: [
      { area: 'Implementation', status: 'Partial', detail: 'Full native setup, own revival, Advanced foreign control/no-new-skill, original Harkonnen capture/revelation/use-return/execution, Rihani exchanges, death custody and copied Zoal collection compose. Other modules and pending skill rulings stay explicit.', evidence: ['game/leader-skill-profile.ts', 'game/leader-skills.ts', 'game/rihani-decipherer.ts', 'game/engine.ts'] },
      { area: 'Player controls', status: 'Implemented', detail: 'Private offers, Face Dancer keep/reveal inspectors and saved own-revival choices reuse the table controls.', evidence: ['components/rihani-decipherer.tsx', 'components/leader-skills.tsx'] },
      { area: 'AI', status: 'Partial', detail: 'Existing profiles follow their private legal offers. Full strategy and strength tuning wait for feature completion.', evidence: ['game/bots.ts', 'tools/faction-games.ts'] },
      { area: 'Documentation', status: 'Implemented', detail: 'Entry, source contracts and remaining boundaries are recorded.', evidence: ['docs/TLEILAXU_LEADER_SKILLS.md'] },
      { area: 'Verification', status: 'Partial', detail: 'Original native role checks remain. Advanced own/foreign revival, normal versus lower bonus, death/buyback, Face Dance and captured use/execution cases pass with all fourteen cards and current JSON. Fourteen genuine games finish6,620 accepted actions/no rejection/171 JSON continuations, including62 battles and two foreign revivals. Actual manual/four-policy revival and captive revelation/return/execution smoke pass; complete module acceptance remains open.', evidence: ['tests/advanced-tleilaxu-skills.test.ts','tests/tleilaxu-skills-integration.test.ts','tests/tleilaxu-skills-revival.test.ts','tests/rihani-face-dancers.test.ts'] },
    ],
  },
  {
    id: 'ecaz-leader-skills',
    title: 'Ecaz with Leader Skills',
    category: 'Advanced & expansions',
    coverage: 'Partial',
    developmentStage: 'Prototyped',
    summary: 'Five native trained discs, original Ambassador choices and ordinary battle effects, with the separate temporary Duke retained.',
    steps: [
      'Fresh Basic or Advanced native Ecaz with classic opponents retains the ecaz deck and all fourteen skills. Starting cards precede public skill assignments, Loyalty/Traitors and original six-force placement. Five native discs are eligible; the separate Duke is not an assignment disc. Public starts remain gated.',
      'Ordinary native role scores, actual Suk casualties, trainer death and optional own normal-disc revival skills use their original rules. Normal rescue returns one physical casualty; surviving trained rescue keeps one and returns up to two more, without refunding support or creating extra forces.',
      'Original paid Ambassador placement and entrant reactions keep the exact token, training and movement suffix. Emperor Ambassador grants five bank spice; it is income, not a qualifying bank payment from another player for Banker.',
      'A temporarily acquired Duke has printed strength six. A different living face-up Warmaster may give him only the normal one-point bonus with a physical Worthless card, never the trained-disc three. Surviving release or actual Duke death leaves the native trainer and card intact; bounty remains printed six.',
      'Ecaz-only paid five-spice Duke revival retains the same living set-aside disc under the earlier selected interpretation. These paths keep an existing native skill and do not authorize shared-Duke assignment. Advanced Harkonnen, combined Occupy skills and other module/ruling boundaries remain explicit.',
      'Fresh standalone Ecaz skill tables may preserve original Tech Tokens in Basic/Advanced with three through six seats, and Stronghold Cards in Advanced with two through six, optionally both. Original five-disc training, Ambassador/Duke acquisition, local held-card protection or income, Suk rescue and mandatory winner Tech remain. A native face-up Warmaster gives temporary Duke only normal one; Carthag physical Shield can prevent poison. Original paid five-spice Duke revival remains living and set aside, not reassigned. Advanced Harkonnen, allied Occupy skills, pairs, mixtures and other guards stay unchanged.',
    ],
    related: ['leader-skills', 'duke-vidal', 'ecaz-ambassadors', 'spice-banker-income', 'implementation-checklist'],
    checklist: [
      {area:'Implementation',status:'Partial',detail:'Native five-disc profile composes original setup, Ambassador, ordinary rescue/death/revival and separate temporary Duke handlers. Combined Occupy skills and shared-Duke assignment remain guarded.',evidence:['game/leader-skill-profile.ts','game/engine.ts']},
      {area:'Player controls',status:'Partial',detail:'Original skill offers, posture, battle slots, rescue, Ambassador acquisition and revival controls are reused. Human390px LQWE8TZM v18 exercises paid token/arrival/acquisition, Duke Worthless battle and original cleanup/refresh.',evidence:['components/leader-skills.tsx','components/duke-vidal.tsx','components/game-table.tsx']},
      {area:'AI',status:'Partial',detail:'Existing legal native choices and all four physical Suk rescues compose. No new strategy or calibration.',evidence:['game/bots.ts','tools/faction-games.ts']},
      {area:'Documentation',status:'Partial',detail:'Ordinary native and temporary Duke scope are separated from unresolved assignment, capture and combined force rules.',evidence:['docs/LEADER_SKILLS_RUNTIME.md','docs/DUKE_VIDAL_RULES.md']},
      {area:'Verification',status:'Partial',detail:'Affected67/67, types/lint/build and twenty controlled rule programs pass. Ten genuine two-through-six-seat Basic/Advanced games complete4,264 accepted actions without rejection,110 JSON continuations and59 battles. Original CLI24HGMJCD v4 retains setup; humanLQWE8TZM v18 retains Collection/wallet11/eight real counters/living set-aside Duke and native Warmaster. Full combinations/assurance/public/deployed acceptance remain open.',evidence:['tests/native-ecaz-skills.test.ts','tests/native-ecaz-duke-skills.test.ts']},
    ],
  },
  {
    id: 'richese-leader-skills',
    title: 'Richese with Leader Skills',
    category: 'Advanced & expansions',
    coverage: 'Partial',
    developmentStage: 'Prototyped',
    summary: 'Native cache setup, fourteen skills, capped concealed-force aftermath and exact green-card substitution in bounded development tables.',
    steps: [
      'Basic or Advanced native Richese retains its required CHOAM deck, separate ten-card cache and all fourteen skills. Native CHOAM may share the table; Advanced selected Ix decks and Tleilaxu retain their original inventory and explicit combination limits. Starting cards precede skills, public assignment and traitors. Public starts remain gated.',
      'Marker-only zero, three and five battles use the owning private reserve-capped pool and reveal only after both plans seal. Actual force loss then feeds original Suk rescue; no token value is a second casualty or a phantom reserve. Ordinary forces are separate. Own mixed marker/physical battle stays guarded; voluntary reveal must occur before Battle.',
      'A selected surviving Planetologist may use a canonical printed green Richese Special or Special - Movement in its weapon slot for two strength. Exact physical identity is required. Stone Burner, Mirror Weapon and Portable Snooper do not qualify. The green card is discarded once without its native effect, fee, search or early leader kill.',
      'The normal Smuggler own companion is one separate force alongside the marker, not added to its hidden value. Ordinary allied No-Field cancellation and Guild stages retain their exact owner/recipient/token frame; an allied free companion is not granted.',
      'The authorized Advanced recipient cutover keeps Richese ally contributions distinct: buyer four goes to Richese, funded Richese four goes to Emperor or bank. This also applies when Emperor is the buyer. Cancellation redirects only the original Emperor share, not unrelated buyer credit, with no second donor debit or card transfer. Basic keeps its publisher receipt.',
      'Separate normal Banker income uses only actual bank-routed payer legs and remains unavailable until actual Mentat. Allowed Emperor income and ordinary seller credit are not bank payments. Native Ixian Technology on Richese lots, exhausted-cache arithmetic, positive Black Market self-bidding, Bureaucrat split funding and other module/ruling boundaries remain explicit.',
    ],
    related: ['leader-skills', 'richese-cards', 'richese-no-field', 'spice-banker-income', 'implementation-checklist'],
    checklist: [
      {area:'Implementation',status:'Partial',detail:'Original native setup, exact green role lookup, private capped marker outcomes, ordinary allied declaration and Advanced original payer/recipient continuation compose. Existing rule guards and Basic source remain.',evidence:['game/leader-skill-profile.ts','game/leader-skill-combat.ts','game/auction-continuation-quote.ts','game/engine.ts']},
      {area:'Player controls',status:'Partial',detail:'Original skill offers, cache bidding, concealed shipment, original preparation and plan slots, physical rescue, partial income and deferred grant controls are reused. Actual human evidence is recorded separately.',evidence:['components/leader-skills.tsx','components/richese-no-field.tsx','components/game-table.tsx']},
      {area:'AI',status:'Partial',detail:'Shared exact roles and native private pools supply legal candidates; all four policies perform actual capped Suk rescue. No new strategy or calibration. Source questions can still stop full games.',evidence:['game/bots.ts','game/leader-skill-combat.ts']},
      {area:'Documentation',status:'Partial',detail:'Exact native skill, green disposal and Basic-versus-Advanced contribution source are documented without full-family certification.',evidence:['docs/LEADER_SKILLS_RUNTIME.md','docs/RICHESE_AUCTION_RULES.md','docs/SMUGGLER_NO_FIELD.md']},
      {area:'Verification',status:'Partial',detail:'Final affected rule/CLI union151/151, types/lint/build and eleven controlled programs pass. Genuine29-game batch is not green:28 finish11,788 actions/303 JSON continuations/130 battles; one exhausted-cache guard is captured. Actual390px green battle358WLPYA v16 and funded sale/native Mentat E2K2U5ZW v26 retain original controls and refresh without repeated payment. Broader/full/deployed acceptance remains open.',evidence:['tests/native-richese-skills.test.ts','tests/native-richese-green-battle.test.ts','tests/richese-contribution-payments.test.ts','tests/faction-games-cli.test.ts']},
    ],
  },
  {
    id: 'moritani-leader-skills',
    title: 'Moritani with Leader Skills',
    category: 'Advanced & expansions',
    coverage: 'Partial',
    developmentStage: 'Prototyped',
    summary: 'Native Basic and bounded Advanced Moritani compose fourteen skills with Terror, original assassination and skill-first aftermath.',
    steps: [
      'Assign skills after starting Treachery Cards and before Traitor choices. Moritani places its six starting forces last. All fourteen skills remain in the physical deck; each player keeps one of two private choices and publicly assigns it to an eligible leader.',
      'Connected movement, shipping, payment and battle skills use the same controls and legal quotes as the base profile. Terror Assassination returns a killed leader’s exact skill once; a later own-leader revival offers the normal private optional replacement. Sabotage affects Treachery Cards, not skills.',
      'An Enemy of My Enemy alliance preserves each faction’s assignments. A losing ally cannot retain a used Planetologist Special or the Worthless card used for a Diplomat copy, because those cards must be discarded.',
      'Basic Moritani with base opponents keeps its existing entry, including Harkonnen. Fresh Advanced Moritani plus classic opponents except Harkonnen uses the ecaz deck and the original assassination preview with all fourteen skills. Winner Suk rescue and Rihani choice finish before post-loss assassination, without replaying casualties. The actual winning disc remains excluded; another eligible trained disc returns its skill once and pays only printed bounty. Normal traitor revelation forfeits assassination for the whole game. Ecaz/Duke skill assignment, other native families, optional modules and public starts remain separate.',
      'The original standalone skill profile may additionally preserve Tech Tokens in Basic/Advanced three-through-six-seat tables and Stronghold Cards in Advanced two-through-six, optionally both. Actual normal winner Suk rescue finishes before unused trained-disc assassination and printed bounty; original winner cards/Tech, losing Tuek earnings, support and one real Mentat replacement remain. Ordinary Collection is separate. E3 pairs, mixtures, allied Occupy skills and other overlays remain guarded; public starts and save conversion stay excluded.',
    ],
    related: ['leader-skills', 'expansion-faction-games', 'implementation-checklist'],
    checklist: [
      { area: 'Implementation', status: 'Partial', detail: 'Genuine setup, shared native skill quotes, original Terror/retention, skill-first Suk/Rihani continuation and actual trained-disc assassination/one Mentat replacement compose in the bounded Advanced roster. Basic and unresolved module/roster boundaries remain.', evidence: ['game/leader-skill-profile.ts', 'game/moritani-assassinate.ts', 'game/engine.ts'] },
      { area: 'Player controls', status: 'Implemented', detail: 'Existing private offers, public assignments, battle and revival choices are reused; Planetologist controls share the expanded server predicate.', evidence: ['components/leader-skills.tsx', 'components/planetologist-movement.tsx'] },
      { area: 'AI', status: 'Partial', detail: 'Existing profiles retain minimal legal participation through shared public choices. Strategy and difficulty calibration remain deferred until game features are complete.', evidence: ['game/bots.ts', 'tools/faction-games.ts'] },
      { area: 'Documentation', status: 'Implemented', detail: 'The integration guide records entry, exact scope, existing source contracts and remaining effects without claiming full module compliance.', evidence: ['docs/MORITANI_LEADER_SKILLS.md'] },
      { area: 'Verification', status: 'Partial', detail: 'Affected64/64 and CLI2/2 pass. Five genuine Advanced games finish1,425 accepted actions/no rejection/37 JSON continuations/24 battles; none opens assassination. Nine actual controlled cases cover original skill-first decisions, manual/four-policy assassination death/card return/one replacement and private Mentat/Banker opt-ins. Actual human/checkpoint evidence is recorded separately; full module acceptance remains open.', evidence: ['tests/advanced-moritani-skills.test.ts', 'tests/advanced-moritani-skills-assassinate.test.ts', 'tests/moritani-skills-integration.test.ts', 'tests/moritani-assassinate-engine.test.ts'] },
    ],
  },
  {
    id: 'spice-banker-income',
    title: 'Spice Banker: front-shield income until Mentat',
    category: 'Advanced & expansions',
    coverage: 'Partial',
    developmentStage: 'Verified',
    summary: 'The fresh banker-income preview gains one deferred spice once per phase when another player makes one qualifying payment to the Spice Bank, then collects automatically at native Mentat.',
    searchText: 'Spice Banker normal income bank payment four spice phase deferred front shield original owner death capture Mentat',
    steps: [
      'This separate fresh profile admits classic Basic/Advanced, supported Basic native families, bounded Advanced Ixian/Tleilaxu/CHOAM/Richese plus classic seats with required decks, or separate non-Harkonnen Advanced Moritani. All fourteen skills and native setup remain. Richese cache self-payments and authorized Advanced donor legs count only when actually paid to bank; allowed Emperor or seller income does not. Basic receipts and unrelated module/public gates remain.',
      'The printed normal band is mandatory once per phase: when another player makes a payment of at least four spice to the Spice Bank, gain one spice and place it in front of the shield. It is an additional bank grant, not a reduction of the payer’s payment or another player’s income.',
      'Only an actual completed positive bank payment qualifies. A payment to a player, zero/free/waived cost, self-payment, invalid declaration or unfinished possible payment supplies no income. Several smaller payments do not combine to reach four.',
      'Use the original actual bank portion after recipient and counter settlement, not a quoted fee or guessed wallet change. Paid auctions, funded shipments, paid revival and eligible resolved battle support keep their native continuation once. Canceled Emperor, Guild or Tleilaxu revival income can leave a real bank payment. Tleilaxu self-revival pays the Bank; other-player revival normally pays Tleilaxu. Its separate free-revival bank award is not payer debit: three paid plus that one reward never becomes four paid to the Bank. A stopped shipment supplies no payment.',
      'Actual payer contribution legs stay distinct. Two different players paying two each do not become one player paying four. Banker’s separate one-to-three battle payment does not combine with two support to manufacture a qualifying payment. These split-source conventions are explicit conservative local compositions, not a publisher split-payment example.',
      'A new grant requires an actual available living native trainer. A captive grants no normal income. Hidden unselected skills do not supply their normal band; in the trainer’s own battle, its actual selected surviving leader supplies the appropriate eligibility after reveal/resolution, not private pre-reveal timing.',
      'One physical Banker card has one use per turn and phase. Repeated payments, refresh, death, return or same-phase reassignment cannot reset that use; the next phase or turn permits a new grant.',
      'The front-shield pile is not spendable spice. It cannot fund the triggering payment, a later bid, shipment, revival, support or lower-band Banker commitment before collection. Human and all four AI policies keep using their actual available balance.',
      'At the real current Mentat opening, collect the uncollected grants automatically once before optional actions and victory. No extra response, counter, confirmation or collect action is added. Collection itself is not another player-to-bank payment.',
      'This fresh local prototype provisionally keeps already-earned spice with the original gaining faction when the trainer dies, is captured or the skill changes owner. That is a conservative earned-currency custody choice, not an answer to the previously asked universal death/capture question.',
      'Public projection shows only physical front-shield owner/count and current-phase use. Private payment receipts, exact hidden source amounts, plans, and future skill entitlement are not exposed. Current and collected history survive JSON/recovery without replaying either original payment or collection.',
      'Bounded development verification covers actual payment families, threshold/recipient/trainer eligibility, deferred budgets, lifecycle custody and authenticated payment/collection races. Native smoke preserves all 33 Treachery Cards and 14 skills; two original-backed-up six-seat Basic/Advanced rooms verify human phone payment, refresh and actual Mentat collection. Local HTTP remains 49/55 with six upstream 503 failures, not green. Existing lower battle spending stays separate; complete skill/module and deployment acceptance remain open.',
    ],
    related: ['leader-skills', 'battle', 'bidding', 'revival', 'implementation-checklist'],
    checklist: [
      { area: 'Implementation', status: 'Implemented', detail: 'Actual final bank payer legs, one physical Banker phase grant and original-owner Mentat collection connect through fresh classic and supported native skill profiles, including separate bounded Advanced Moritani assassination. Tleilaxu paid revival remains distinct from its free award; free Terror placement is not a new payment.', evidence: ['game/engine.ts', 'game/spice-banker-income.ts'] },
      { area: 'Player controls', status: 'Implemented', detail: 'A full-width read-only public front-shield notice explains unavailable spice and automatic collection; genuine original payment and final Collection controls work at 390px through refresh. No new income action or confirmation.', evidence: ['components/spice-banker-income.tsx', 'components/game-table.tsx'] },
      { area: 'AI', status: 'Partial', detail: 'All four minimal legal policies preserve identical available-budget actions with deferred income present or absent. Original wallets exclude front-shield currency; strategy/calibration remain deferred.', evidence: ['game/bots.ts', 'game/spice-banker.ts'] },
      { area: 'Documentation', status: 'Partial', detail: 'Printed gain/threshold/one-payment/phase/collection, original payment separation, provisional earned custody and per-payer split composition are explicit without universal rulings.', evidence: ['docs/LEADER_SKILLS_RULES.md', 'docs/SPICE_BANKER_RUNTIME.md', 'docs/RULE_DECISIONS.md'] },
      { area: 'Verification', status: 'Partial', detail: 'Original classic checkpoint: types/lint,6,487 offline and140 focused cases, eighteen source programs and two six-seat CLI/phone rooms. Native integration: affected110, final native/guide26, twelve Banker cases plus four legal post-income policies, native original CLI and390px deferred10-to-Mentat11. Tleilaxu paid/free/self/canceled3-or4 boundaries are exercised. Comprehensive assurance follows all rules; no deployed/full-module claim.', evidence: ['tests/fixture-spice-banker-income.ts', 'tests/spice-banker-income.test.ts', 'tests/spice-banker-income-runtime.test.ts', 'tests/fixture-native-banker-income.ts', 'tests/native-banker-income.test.ts', 'tests/spice-banker-income-recovery.test.ts', 'tests/prototype-room.test.ts'] },
    ],
  },
  {
    id: 'leader-skills',
    title: 'Leader Skills',
    category: 'Advanced & expansions',
    coverage: 'Partial',
    developmentStage: 'Prototyped',
    summary: 'Fourteen physical skills, private assignment choices, five battle disciplines, Planetologist movement/battle effects and Suk Graduate rescues, Mentat/Bureaucrat scoring and Bureaucrat payment redirection, Sandmaster victory spice, Rihani exchanges, optional Smuggler shipping and unmodified battle collection, Sandmaster route and worm-ride collection, sealed Spice Banker battle spending and optional Diplomat base-defense copying in development tables. Other effects and combined-module acceptance remain unfinished.',
    steps: [
      'Fresh all14 Leader Skills preserves original classic, supported E1/E2 or standalone Ecaz OR Moritani setup with Homeworlds/Discovery/Tech3+/Advanced Strongholds under each envelope. Explicit --nexus-cards additionally admits single/paired one-family E1/E2, BOTH selected Ix+CHOAM native families/union47 and standalone OR paired Ecaz/Moritani/ecaz33 with classics. Basic/Advanced2–6, original Ix pre-training offer, ordinary native discs and actual hands remain; Auditor/shared Duke never train. Winning normal/trained Suk uses source-labelled native, visitor or nested fixed-loss pools; native saved counters stay at that home and external Emperor returns allocate original homes. Original phase-end industry, held benefits, cleanup/Tech before Face Dance and native assassination remain; unreconciled bands, mixed E3/three-family, public starts and played-save conversion stay separate.',
      'Basic Moritani retains base opponents including Harkonnen. Its separate bounded Advanced classic/non-Harkonnen roster now composes the original assassination preview and all fourteen skills: winner Suk rescue and Rihani choice finish first, then an eligible different trained disc may be assassinated with its exact card return and printed bounty. No casualties repeat; original set-aside and one private Mentat replacement remain. See Moritani with Leader Skills for the exact scope.',
      'Fresh Advanced profiles compose native Ixians, Tleilaxu, CHOAM and/or Richese with classic opponents and distinct required family decks. All fourteen skills and native starts remain. Auditor stays unskilled; cyborg casualties, original CHOAM support and Richese capped marker revelation remain physical. Foreign revival creates no new skill. Native Ixian Technology on Richese lots, own mixed No-Field, captured replacement, Advanced Atreides Suk/KH and unrelated overlays retain their guards.',
      'Fresh three-through-six-seat Basic/Advanced development tables may compose all fourteen Skills with original Tech Tokens: classic factions, supported E1/E2 native families, or standalone Ecaz/Moritani with the exact ecaz deck and original roster exclusions. Starting cards/cache, skill/Traitor choices and printed/first-Storm assignment stay genuine. Existing leader-skills/banker-income entry preserves unused selected tokens; mixed E3 families, other overlays, public activation and saved-game conversion remain separate.',
      'Fresh Advanced classic or supported native two-through-six-seat skill tables may retain six original Stronghold Cards, with Tech at three or more seats. Original end-Mentat/local held effects remain. Arrakeen changes actual payer cost, not rescue or Banker eligibility; native CHOAM income retains bank support. Physical defenses, normal disciplines, holder ties and original dial/Worthless earnings remain. Standalone Ecaz Duke and Moritani assassination compose original rules; mixed E3, allied Occupy skills, copied Diplomat defenses, active skill/Stone and other guards stay separate.',
      'Fresh classic Leader Skills may explicitly add Nexus through local leader-skills --nexus-cards, Basic/Advanced two through six players, retaining selected original Tech at three or more seats and/or Advanced Strongholds. --discoveries additionally composes original Discovery7/8 in this classic profile. Saved hands/offers remain authoritative; the actual end-Spice closing draw follows Maker votes/typed rides, both Advanced piles and settled alliance. Free-return ledgers, bank purchase and Traitor Deck declarations stay distinct from training. Original phase-end industry, held payer support/physical defenses, physical Suk rescue and subsequent mandatory winner Tech rewards retain their own timing. Homeworlds, Banker/Mentat previews, borrowed Smuggler arithmetic and unresolved interactions remain separate.',
      'The same fresh entry also adds --nexus-cards --discoveries to paired Ixians+Tleilaxu, paired CHOAM+Richese or standalone Ecaz OR Moritani with classics, original all14/all12/Discovery7/8, Basic/Advanced two through six with optional Tech3+ and Advanced Strongholds. Original offers/hands/native components remain authoritative. E1 Suboid Cunning settles typed Suk rescue before one equal Cyborg Tank substitution, then original cleanup and mandatory winner Tech precede a matching Face Dance; E2 keeps its signed one-invoice pair; Ecaz keeps quiet living/unclaimed Duke then a real owner-labelled mandatory Occupy; Moritani keeps skill-first assassination and one private Mentat replacement. Mixed/E3 pairs, shared Duke, borrowed Smuggler/pair companions, native free returns, captured/foreign training, Basic odd Ecaz, Advanced Harkonnen and other pending rulings stay guarded.',
      'Both original paired Ixian/Tleilaxu or CHOAM/Richese factions plus classics may add Nexus through that fresh local skill entry, with one family deck/all14/all12, Basic/Advanced two through six players. Selected original Tech requires3+; Strongholds requires Advanced. Full unsupported Suboids retain Cyborg support and skill posture; physical Suk rescue precedes equal actual Cyborg Tank substitution. Original winner cleanup and mandatory Tech precede Face Dance, which returns a matching killed trainer skill once without another bounty. Held custody stays with the original winner. Richese Cunning retains its signed two-marker/one-invoice operation and native phase-end industry; ordinary skill proofs and companion exclusions stay separate. CHOAM fuel precedes ordinary Planetologist movement without a second card effect or artificial combat Special.',
      'Standalone Ecaz OR Moritani with classics can add Nexus through the original fresh skill entry, exact ecaz33/all14/all12, Basic/Advanced2–6, optionally preserving original Tech3+ and/or Advanced Strongholds2+. Ordinary assignment discs and native skill bands remain. Ecaz spends actual Cunning before Battle to acquire the living/unclaimed separate Duke for the turn; normal discipline may apply, never a Duke assignment. Moritani retains Advanced skill-first assassination and normal-Traitor forfeiture, printed post-loss bounty and one private actual Mentat replacement, while Basic keeps legal Terror without gaining that Advanced power. Supply-only Cunning placement stays distinct from ordinary relocation; its enhanced relocation/HMS/Grumman questions remain pending. No public or saved-game conversion.',
      'In this standalone Ecaz Nexus/Skills profile, mandatory Advanced Occupy keeps the chosen faction’s own leaders, cards, payment and battle skill. Training is not lent between allies. Ecaz-led Suk rescues its own fixed casualties after the ally’s variable losses; Diplomat retreats the selected faction’s undialed own counters, not a remainder computed from the combined dial. Native cancellation restores that selected lead’s ordinary own pool. These owner-labelled compositions are explicit implementation inferences, not a new combined-skill FAQ.',
      'With this optional module, starting Treachery Cards are dealt after prediction and before skill assignment. Every faction privately receives two skills, keeps one, returns the other to the shuffled deck, and assigns its chosen card to an eligible leader. Skill and leader become public before traitor selection.',
      'Before Battle Plans, leave the skilled leader face up to keep its normal effect, or move it behind the shield for possible use. A face-up leader cannot be selected for the plan. Concealing it while choosing another leader gives neither effect. A leader that must be used because no alternative remains moves behind the shield automatically.',
      'Warmaster, Master of Assassins, Swordmaster of Ginaz, Killer Medic and Prana-Bindu Adept are connected. They give another leader +1 for the matching physical card role, or the surviving assigned leader +3. These bonuses do not stack to +4. They change battle strength, not the printed disc value or leader bounty.',
      'The assigned leader keeps its skill through capture and returns with it if it survives its captive battle. The known skill identifies that captured leader; Harkonnen receives only its lower battle effect. Normal effects remain unavailable to both the captor and original faction while it is captured. A killed skilled leader returns its card to the shuffled skill deck.',
      'When reviving an own leader without an assigned skill, decide whether to draw before seeing two private cards. Once drawn, keep one and assign it to that revived leader. Replacement while an earlier skill is captured remains a separate unresolved case.',
      'Planetologist chooses either one extra movement range (maximum three) or forces from two territories to one destination at normal range. These alternatives do not stack. The actual skilled leader can use an eligible green Special in the weapon slot for +2 if it survives; discard that Special after battle without activating its ordinary effect. Mixed advisor/fighter entry into an enemy-only territory and combined expansion modules remain unfinished.',
      'Suk Graduate returns one selected casualty to reserves while its leader stays face up, or lets its surviving battle leader save up to three: one stays in its original sector and the rest return to reserves. The effects do not stack. Rescued counters still count toward Advanced Atreides’ seven battle losses for Kwisatz Haderach; combined modules remain unfinished.',
      'In the supported classic Nexus/Skills composition, Emperor Cunning counts five actual ordinary counters as temporary Sardaukar. Normal or trained Suk rescue still saves physical ordinary casualties. The original casualty allocation remains pending while the rescue choice is open; physical counters move only when rescue settles. Original support is already paid and is not refunded or charged twice. A normal save returns one to reserves; a trained save keeps one and returns the rest. Actual starred reserves and Tanks remain unchanged.',
      'A surviving selected Mentat adds two battle strength. A surviving selected Bureaucrat subtracts one from the opponent’s total per distinct stronghold occupied by that opponent; advisors do not count. Printed disc values and bounties stay unchanged.',
      'A living native Sandmaster may collect one spice per entered territory along a declared legal ground route. Choose each collection separately; canceled moves earn nothing. The initial source and a sector-only reposition earn nothing. Separate movements have separate collection opportunities. Native Fremen worm rides may collect once at the destination before faction arrival reactions, without a ground route or normal movement use. When a native Ixian Hidden Mobile Stronghold relocates, its interior passengers count as entering the territories it points into, so the Sandmaster collects there before the faction’s own traversed-sector collection. Multiple piles and other special relocation remain unfinished.',
      'A surviving skilled Sandmaster victory automatically adds three board spice to an existing pile in the battle territory, even with no surviving forces. Multiple piles await a placement ruling.',
      'Rihani normally inspects two random Traitor Deck cards privately, then reshuffles them. A surviving selected native Rihani also offers a separate optional draw of two. Decide before seeing them: once drawn, keep one new card and publicly reveal and return one unused old card. The other new card returns secretly. A captured Rihani grants only the optional exchange. Your private history records both samples; a card just called to win is already used.',
      'Smuggler can include one free accompanying force in an off-planet shipment into an empty territory. Select the entire physical total; three forces cost the ordinary price of two. The checkbox can decline this optional benefit. Guild rounding follows the free force. Richese may instead ship one separate free reserve force beside its owned No-Field into an empty territory; the marker retains its ordinary price and hidden value. Existing forces, including advisors, prevent the bonus; ordinary Fremen on-planet reinforcement has no bonus.',
      'Spice Banker can commit one through three own spice with its Battle Plan, separate from force support. Only the surviving selected skilled disc gains that strength. The amount stays private until authorized plan inspection or public reveal. It is paid on win or loss, including leader death, except a sole traitor-call winner spends nothing. Normal deferred income connects only in the separate fresh classic or supported native banker-income profiles, including the bounded Advanced Moritani roster; ordinary/default starts are unchanged.',
      'Diplomat may use one committed Worthless card as the opponent’s base Shield or Snooper if you played no defense. After both plans reveal, choose the card or decline before traitor decisions. A native Diplomat may protect its own selected trained leader this way; a captive grants no upper effect. The chosen Worthless must be discarded afterward, even if you win. A surviving trained leader that loses a supported battle may retreat selected undialed physical counters up to its printed/copied disc strength into one empty adjacent non-stronghold territory before ordinary loser losses; modified defenses remain unfinished.',
      'Mentat has an explicit private developer preview for naming a specific weapon before posture and faction powers in supported classic and native skill profiles, including bounded Advanced Moritani. The target privately shows the named held card or chooses another held card. Weirding Way is a nameable default weapon; Chemistry is not. The card stays held and need not enter a Battle Plan. Every answer uses the same private response step; ordinary activation awaits the user’s timing-design decision. Empty hands skip without an answer. Private history is an observation, not a later hand guarantee.',
      'Bureaucrat may redirect two spice from a payment of at least five between two other players, once per phase. The payer still pays in full; the recipient receives two less. Declining keeps the use available for a later payment. Paid bribes qualify when transferred, with the remaining share still unavailable until Mentat Pause. Ordinary auctions, Guild income, Richese sales and actual paid Tleilaxu revival income in supported Basic or bounded Advanced native skill profiles have connected payment paths. A separate free-revival award is not part of the paid price and stays with Tleilaxu. Split funding, gifts, other payment families and combined modules remain unfinished.',
      'Smuggler records the existing battle-territory spice when plans reveal, capped by the selected leader’s unmodified strength. If that leader survives, it collects automatically even when losing or no forces remain. A captive pays its controller. Pending spice cannot fund the plan. Collection precedes Sandmaster’s addition; a drained pile receives none. Modified strength, multiple positive piles and combined modules remain guarded. Older saved battles keep their original behavior.',
      'In classic and supported E1/E2 native Tech composition, actual Smuggler prices and normal Banker qualifying fees remain distinct from phase-end Tech income. Tech piles cannot fund their triggering action; Banker front-shield grants still wait for actual Mentat. Winning physical Suk rescue and Sandmaster board spice precede original played-card cleanup and mandatory winner token reward. One token transfers automatically, several require a selection, and no token skips without an invented decline. A later Face Dancer retains the original winner’s cards, bounty and Tech reward, kills the matching trainer without another bounty and replaces only actual survivors from real sources. Native Tleilaxu-only free revival excludes Axlotl; CHOAM initial income is not Charity. Richese’s free companion does not change its marker price or create the concealed counters early.',
      'Other special Sandmaster relocation remains missing. Normal Banker income has separate fresh classic or supported native source-to-Mentat previews with provisional original-earned-faction custody, not general activation. Diplomat retreat retains its documented conservative outcome order. Native Advanced foreign gholas/Face Dancers, skill-first Moritani assassination and ordinary-disc Ecaz skills follow their bounded contracts; shared-Duke assignment, combined Occupy skills and other combined modules remain unfinished. This prototype does not enable public module starts.',
      ...LEADER_SKILL_CARDS.map(card => `${card.name}. Normal: ${card.normal.join(' ')} Skilled battle: ${card.battle.join(' ')}`),
    ],
    related: ['spice-banker-income', 'choam-leader-skills', 'ixian-leader-skills', 'tleilaxu-leader-skills', 'richese-leader-skills', 'ecaz-leader-skills', 'moritani-leader-skills', 'setup','choam-modules','implementation-checklist'],
    checklist: [
      { area:'Implementation',status:'Partial',detail:'Exact fourteen-card custody, source-ordered setup, public capture, concealment, death and own revival connect five role bonuses, Planetologist movement/Special substitution and Suk Graduate casualty rescue. Rihani inspection/exchange and lower Mentat/Bureaucrat/Sandmaster effects are connected. Smuggler normal reserve shipping, the owned Richese No-Field companion, unmodified battle collection and optional Sandmaster ground-route and native Fremen worm-ride collection are connected. A separately opted-in Mentat preview connects private pre-plan questions and historical observations while ordinary activation awaits the uniform-response decision. Spice Banker lower spending and native Diplomat base Shield/Snooper copying are connected; skilled Diplomat retreat now transfers undialed normal/elite forces before losing casualties in supported battles. Normal Banker income connects only in the separate fresh classic or supported Basic native banker-income profile; other remaining bands and combined modules remain missing. Bureaucrat redirects supported third-party auction, shipment and bribe payments with exact saved once-per-phase use.',evidence:['game/leader-skill-cards.ts','game/leader-skills.ts','game/leader-skill-combat.ts','game/suk-graduate.ts','game/rihani-decipherer.ts','game/mentat-question.ts','game/bureaucrat-payment.ts','game/leader-skill-battle-board.ts','game/smuggler-shipment.ts','game/smuggler-no-field.ts','game/smuggler-battle.ts','game/spice-banker.ts','game/spice-banker-income.ts','game/sandmaster-movement.ts','game/sandmaster-worm.ts','game/diplomat-defense.ts','game/diplomat-retreat.ts','game/engine.ts'] },
      { area:'Player controls',status:'Partial',detail:'Private card/leader selection, readable inspectors, public battle posture and revival draw/decline, Planetologist range/gather controls, Special weapon selection and Suk Graduate physical rescue choices are connected. Rihani has private history and separate keep-new/reveal-old controls; automatic battle effects need no confirmation. Smuggler has explicit ordinary shipping opt-out and No-Field companion opt-in with physical-versus-priced force counts, plus automatic surviving-leader battle collection with reveal-time guidance. Banker exposes separate sealed spending and authorized inspection. Sandmaster exposes explicit legal routes, per-territory collection choices and an optional worm-destination checkbox. Diplomat offers a named committed Worthless choice or decline after public reveal, and a separate surviving-loser destination/normal/elite retreat or decline. Bureaucrat offers redirect or full payment with explicit recipient amounts and deferred bribe custody. Remaining effect controls are missing.',evidence:['components/leader-skills.tsx','components/planetologist-movement.tsx','components/suk-graduate.tsx','components/rihani-decipherer.tsx','components/mentat-question.tsx','components/bureaucrat-payment.tsx','components/leader-skill-battle-guide.tsx','components/smuggler-shipment.tsx','components/spice-banker.tsx','components/sandmaster-movement.tsx','components/sandmaster-worm.tsx','components/diplomat-defense.tsx','components/diplomat-retreat.tsx','components/game-table.tsx'] },
      { area:'AI',status:'Partial',detail:'All four profiles use private offers, legal visibility/revival actions and Planetologist movement/battle candidates and legal Suk Graduate rescues, Rihani exchanges, shared battle scoring, Smuggler reserve/owned No-Field shipments and unmodified collection plans, Sandmaster route and worm collection, funded Banker commitments and optional Diplomat copying from public revealed defenses or choosing legal losing-battle retreat. Bureaucrat uses the public payee alliance to redirect enemy income or preserve allied income. These are legal prototype paths; complete skill strategy and difficulty calibration remain unfinished.',evidence:['game/bots.ts'] },
      { area:'Documentation',status:'Partial',detail:'All fourteen faces and common rules are recorded. Skilled capture follows public physical-card custody; replacement entitlement and other material timing interpretations remain explicit.',evidence:['docs/LEADER_SKILLS_RULES.md','docs/LEADER_SKILLS_CAPTURE.md','docs/LEADER_SKILLS_RUNTIME.md','docs/PLANETOLOGIST_RULES.md','docs/SUK_GRADUATE_RULES.md','docs/LEADER_BATTLE_EFFECTS.md','docs/MENTAT_QUESTION.md','docs/BUREAUCRAT_PAYMENTS.md','docs/SMUGGLER_SHIPMENT.md','docs/SPICE_BANKER_RUNTIME.md','docs/SANDMASTER_WORM.md','docs/DIPLOMAT_DEFENSE.md'] },
      { area:'Verification',status:'Partial',detail:'Classic Homeworld Nexus optional modules add13 meaningful cases; affected242/242, types/lint/build pass. Twenty-two original six-seat games across15 families finish14233/14233 actions with375 JSON on one unchanged source tree. Human390px original typed invasion/zero-Suk and exact-three native return retain Kaitain14/Salusa5/visitor1; actual random Shrine entry, typed Maker ride and both-pile closing Moritani draw retain original armies. Native35-case and earlier source-qualified evidence remains in canonical logs. Native compositions, pending effects, full rules/combinations and deployed acceptance remain open.',evidence:['tests/homeworld-classic-nexus-skills-runtime.test.ts','tests/homeworld-classic-discovery-nexus-runtime.test.ts','tests/homeworld-native-e1e2-modules-runtime.test.ts','tests/homeworld-native-e3-modules-runtime.test.ts','tests/homeworld-classic-skills-runtime.test.ts','tests/homeworld-skills-discovery-runtime.test.ts','tests/homeworld-optional-modules-runtime.test.ts','tests/leader-skills-engine.test.ts','tests/leader-skills-capture.test.ts','tests/leader-battle-effects.test.ts','tests/suk-graduate.test.ts','tests/mentat-question.test.ts','tests/bureaucrat-payment.test.ts','tests/smuggler-battle.test.ts','tests/spice-banker.test.ts','tests/advanced-native-skills.test.ts','tests/fixture-advanced-native-skills.ts','tests/skills-tech-payments-runtime.test.ts','tests/skills-tech-battle-runtime.test.ts','tests/ix-choam-skills-tech-runtime.test.ts','tests/tleilaxu-skills-tech-runtime.test.ts','tests/richese-skills-tech-runtime.test.ts','tests/classic-skills-stronghold-runtime.test.ts','tests/native-skills-stronghold-runtime.test.ts','tests/ecaz-skills-modules-runtime.test.ts','tests/moritani-skills-modules-runtime.test.ts','docs/LEADER_SKILLS_RUNTIME.md','docs/HOMEWORLD_RUNTIME_IMPLEMENTATION.md'] },
    ],
  },
  {
    id: 'card-recruits',
    title: 'Recruits and the Ecaz Treachery Cards variant',
    category: 'Cards',
    coverage: 'Partial',
    developmentStage: 'Prototyped',
    summary: 'During Revival, Recruits doubles every faction’s current free rate and raises the ordinary force limit to seven for this turn.',
    steps: [
      'The separate three-card variant includes Recruits, Reinforcements and Harass & Withdraw. It does not require the Ecaz faction. A development preview includes all three physical cards before setup; Recruits, bounded Reinforcements and Harass & Withdraw controls are connected.',
      'The holder may play Recruits from its Revival panel. Discard the card once, then all players use the increased rates while this Revival phase remains open, including players who had already marked themselves ready. Completed returns still count toward their turn totals.',
      'Atreides rises from two free forces to four; Fremen from three to six; Guild from one to two. The ordinary force limit becomes seven. Native unlimited CHOAM and Tleilaxu allowances remain unlimited, and their free rates become zero and four. Paid prices and separate elite limits still apply.',
      'Free-revival prevention still prevents free returns. A Fremen ally grant completed before Recruits doubles from three to six. A later grant, play after a paid ordinary return, unresolved transactions and a second use in the same turn remain guarded pending their rules decisions.',
      'The preview supports Basic or Advanced classic-faction games without additional optional modules. Public activation and complete combined-game acceptance remain unfinished.',
    ],
    related: ['revival', 'ecaz-modules', 'expansion-faction-games', 'implementation-checklist'],
    checklist: [
      { area: 'Implementation', status: 'Partial', detail: 'Genuine independent three-card setup, physical Recruits play/discard, public turn effect, shared revival quotes, preserved use and guarded timing are connected. Harass and Reinforcements have separate bounded battle prototypes; complete variant interactions remain gated.', evidence: ['game/ecaz-cards.ts', 'game/recruits.ts', 'game/revival.ts', 'game/engine.ts'] },
      { area: 'Player controls', status: 'Implemented', detail: 'The owned physical card has full inspection, a Revival action and explicit unavailable reasons. All seats see the effective public rates after play.', evidence: ['components/recruits.tsx', 'components/game-table.tsx', 'game/card-presentation.ts'] },
      { area: 'AI', status: 'Partial', detail: 'All four profiles use the same legal owned offer for useful own or allied revival, then existing authoritative revival choices. Complete card strategy and calibration remain unfinished.', evidence: ['game/bots.ts'] },
      { area: 'Documentation', status: 'Implemented', detail: 'The card guide records examples, current prototype limits and the independent-cap inference; late-paid and late-rate questions remain explicit.', evidence: ['docs/RECRUITS_RULES.md', 'docs/RECRUITS_RUNTIME.md'] },
      { area: 'Verification', status: 'Partial', detail: 'Focused rules, controls, AI and authenticated recovery checks cover the bounded preview. Sample and browser evidence is recorded separately; full variant acceptance remains open.', evidence: ['tests/recruits.test.ts', 'tests/recruits-engine.test.ts', 'tests/recruits-controls.test.tsx', 'tests/recruits-recovery.test.ts', 'tests/prototype-room.test.ts'] },
    ],
  },
  {
    id: 'card-reinforcements',
    title: 'Reinforcements',
    category: 'Cards',
    coverage: 'Partial',
    developmentStage: 'Verified',
    summary: 'Add two to battle strength while paying three own reserve counters into the Tanks when the physical card is revealed.',
    steps: [
      'In the independent Ecaz Treachery Cards variant, place your held Reinforcements card in either battle-card slot; it is neither a weapon nor a defense. A category Prescience answer is None, not the name of this card. One physical card cannot fill both slots.',
      'Have three own forces in reserves when sealing. Classic/paired Ecaz/Moritani Basic/Advanced and explicitly selected native Advanced Occupy prototypes spend ordinary reserves first and then elite reserves, moving exactly three to corresponding Tanks subpools at resolution. These are the actual card holder’s reserves, not the variable ally’s pool; no extra forces arrive.',
      'The normal-outcome score gains 2 without adding to the physical dial, spice support or on-board casualties. The card and its reserve cost are consumed even on a Traitor victory, a mutual Traitor result or a Lasgun/Shield explosion; successful Traitor calls still decide the outcome directly.',
      'All-outcome payment, normal-first selection and reserve transfer counting as battle losses remain provisional interpretations, not publisher rulings. The explicit Advanced Occupy/independent-card profile is verified through native and human play; Basic/unprofiled co-side, own same-plan Harass/Reinforcements, Stone Burner and other optional modules remain guarded.',
    ],
    related: ['battle-cards', 'battle', 'card-recruits', 'card-harass-withdraw', 'implementation-checklist'],
    checklist: [
      { area: 'Implementation', status: 'Partial', detail: 'Physical card, both slots, own typed reserve cost, score-only bonus and single mandatory discard connect in classic/paired modes and explicit native Advanced Occupy. Selected lead cards/payment and variable ally casualties stay separate.', evidence: ['game/reinforcements.ts', 'game/battle-resolution-quote.ts', 'game/engine.ts'] },
      { area: 'Player controls', status: 'Partial', detail: 'Owner-only availability, exact cost guidance and both battle selectors support the card; private category answers remain None.', evidence: ['components/battle-preparation.tsx', 'components/game-table.tsx'] },
      { area: 'AI', status: 'Partial', detail: 'Four profiles consider legal physical slot candidates and the normal score bonus; strategy and calibration remain unfinished.', evidence: ['game/bots.ts'] },
      { area: 'Documentation', status: 'Partial', detail: 'The printed effect and unresolved Traitor, explosion, type-selection and accounting interpretations are distinguished from this temporary prototype.', evidence: ['docs/ECAZ_TREACHERY_RULES.md', 'docs/REINFORCEMENTS_RUNTIME.md'] },
      { area: 'Verification', status: 'Partial', detail: 'Existing rule/control proofs plus combined-card67 cases, actual27-case program, four policies, natural combined games and390px decisive equal-leader Reinforcements cover the bounded profile. Full faction/optional-module acceptance remains open; comprehensive assurance follows all rules.', evidence: ['tests/reinforcements.test.ts', 'tests/reinforcements-engine.test.ts', 'tests/ecaz-occupy-cards-runtime.test.ts', 'docs/ECAZ_OCCUPY_RULES.md'] },
    ],
  },
  {
    id: 'card-harass-withdraw',
    title: 'Harass & Withdraw',
    category: 'Advanced & expansions',
    coverage: 'Partial',
    developmentStage: 'Prototyped',
    summary: 'Return your undialed forces to reserves when your Battle Plan is revealed; your leader still faces normal battle risks.',
    steps: [
      'Include the physical card in either battle-card slot. It is neither a weapon nor a defense and cannot supply either category for Chemistry or Weirding Way’s alternate role. A single card cannot occupy both slots.',
      'When Atreides asks for that weapon or defense category, answer None without exposing Harass & Withdraw. The category is fixed, while the special card may occupy its physical slot. A literal Truthtrance promise that a slot is empty still means no physical card.',
      'Return your undialed ordinary and elite forces to reserves. Your leader can still be killed. An opponent’s successful Traitor call cancels withdrawal, including mutual calls. A Face Dancer cannot replace the forces already returned.',
      'Discard Harass after use, including a win by your own Traitor call. Reveal-before-explosion return and card-specific discard precedence are explicit implementation inferences; neither is a dedicated combined FAQ ruling.',
      'For multiple legal physical allocations, choose all undialed ordinary and elite counters by sector after both plans reveal and before traitor declarations. Unique returns are automatic. The selected return is public; it is not an extra sealed plan element. Richese card combinations and additional optional modules remain guarded. The printed card forbids use on your own Homeworld.',
      'In explicitly selected Advanced Occupy, only the actual card user’s undialed forces return. An Ecaz user preserves its original mandatory fixed count at free full strength; an allied user uses its native variable commitment, while canceled Occupy uses its selected lead’s ordinary own pool. Returned reserves remain outside losses and Face Dance. Basic/unprofiled co-side, public starts and full acceptance remain gated.',
    ],
    related: ['battle-cards', 'battle', 'card-recruits', 'ecaz-modules', 'implementation-checklist'],
    checklist: [
      { area: 'Implementation', status: 'Partial', detail: 'Physical slot commitment, category inspection, revealed typed/sector return selection, exact committed losses, opponent-Traitor cancellation, mandatory disposal and saved continuation are connected. Richese and optional-module combinations remain gated.', evidence: ['game/harass-withdraw.ts', 'game/battle-card-slots.ts', 'game/battle-resolution-quote.ts', 'game/engine.ts'] },
      { area: 'Player controls', status: 'Partial', detail: 'Either slot, compatible pair selection, category-null commitment and card inspection are usable. Multiple legal typed or sector returns have an owner choice after plans reveal and before traitor declarations; unique returns are automatic.', evidence: ['components/battle-preparation.tsx', 'components/harass-withdraw.tsx', 'components/game-table.tsx'] },
      { area: 'AI', status: 'Partial', detail: 'All four profiles have a legal shared-quote path and preserve inspection secrecy. Retreat strategy and combined-game strength remain uncalibrated.', evidence: ['game/bots.ts', 'tests/ecaz-battle-bots.test.ts'] },
      { area: 'Documentation', status: 'Implemented', detail: 'The card guide distinguishes printed effects, explicit inference and unfinished physical allocation/Stone Burner combinations.', evidence: ['docs/HARASS_WITHDRAW_RUNTIME.md', 'docs/ECAZ_TREACHERY_RULES.md'] },
      { area: 'Verification', status: 'Partial', detail: 'Focused rules, controls, AI and authenticated recovery checks cover the prototype; final sample and browser evidence remains bounded, with full combination acceptance open.', evidence: ['tests/harass-allocation-engine.test.ts', 'tests/harass-allocation-recovery.test.ts', 'tests/harass-withdraw-choice-controls.test.tsx', 'tests/harass-withdraw.test.ts', 'tests/ecaz-battle-controls.test.tsx', 'tests/ecaz-battle-bots.test.ts', 'tests/ecaz-battle-recovery.test.ts'] },
    ],
  },
  {
    id: 'expansion-faction-games',
    title: 'Expansion faction development games',
    category: 'Advanced & expansions',
    coverage: 'Partial',
    developmentStage: 'Prototyped',
    summary: 'Genuine setup connects selected expansion factions to development tables. Complete faction rules and combined-game acceptance remain unfinished.',
    steps: [
      'Development setup supports two through six distinct seats from the base factions and selected expansion sets. Expansion selection and optional modules are separate; public expansion starts remain disabled.',
      'Ecaz places six starting forces in Imperial Basin, allocated among sectors 9, 10 and 11, and keeps fourteen in reserve. Finish Fremen placement first; Bene Gesserit then places its Advanced starting advisor. Moritani places its six forces in an unoccupied territory after all other setup is complete.',
      'Ixians keep their private starting-card selection and physical cyborg/suboid forces. Tleilaxu receives three private Face Dancers. Advanced CHOAM receives its Auditor. Richese has a separate ten-card cache and three private No-Fields. Ecaz and Moritani receive their Ambassador and Terror inventories and share one Duke Vidal disc.',
      'Without Ix, CHOAM adds Poison Tooth and Artillery Strike to the 33-card ordinary deck; Ix or combined decks contain47. Ecaz faction selection adds no cards. Explicit independent variant adds Recruits/Harass/Reinforcements for36/50/38, with classic/paired controls and a separately verified native Advanced Occupy combined-army path.',
      'Advanced Ixians may explicitly decline Technology for one Richese special lot. Their once-per-round use remains available later. The special-lot exchange itself is unfinished pending replacement-card custody interpretation.',
      'Fresh unsupported movement arrivals still reject before opening prevention choices or reserving a new movement card. A saved CHOAM allow choice can return an uncommitted unsupported move for another choice, preserving its existing reserved Ornithopter. The bounded Ecaz/Moritani same-entry Ambassador/Terror overlap instead snapshots both eligible owners in storm order without replaying the original move.',
      'Ordinary shipment checks unfinished arrival combinations before saving the Guild interception choice. An already saved ordinary shipment may return unspent when its still-gated arrival cannot commit; older No-Field, Smuggler, Nexus and Ambassador shipments retain their separate recovery boundaries. Classic plus Ecaz/Moritani Ambassador/Terror overlap has a provisional saved storm-order sequence, while other simultaneous priorities remain unfinished.',
      'Remaining abilities and combined timing can still encounter explicit development guards. Setup and saved-continuation evidence does not certify complete expansion play.',
    ],
    related: ['setup', 'ix-modules', 'choam-modules', 'ecaz-modules', 'implementation-checklist'],
    checklist: [
      { area: 'Implementation', status: 'Partial', detail: 'Genuine setup for seven expansion selections reuses existing faction effects and corrects Ecaz starting placement. Saved per-lot Ixian decline resumes Richese bidding without changing card custody or consuming Technology. Optional variants and unfinished interactions remain separate.', evidence: ['game/engine.ts', 'game/cards.ts', 'game/ecaz-setup.ts', 'tools/prototype-room.ts'] },
      { area: 'Player controls', status: 'Partial', detail: 'Existing faction choices and private hands are reused. Ecaz has an owned sector-allocation control and setup waiting messages; Ixians have an explicit per-lot decline control. Public starts and full acceptance remain gated.', evidence: ['components/ecaz-setup.tsx', 'components/ix-richese-technology.tsx', 'components/game-table.tsx'] },
      { area: 'AI', status: 'Partial', detail: 'All four profiles use genuine setup choices and the shared Ecaz allocation quote, and can decline this Richese lot without using Technology. Combined gameplay strategy, guarded interactions and full-game reliability remain unfinished.', evidence: ['game/bots.ts', 'game/ecaz-setup.ts'] },
      { area: 'Documentation', status: 'Partial', detail: 'The faction profile records ordinary deck composition, independent variants, Ecaz territory allocation and deterministic setup-order interpretations, with unfinished play explicit.', evidence: ['docs/EXPANSION_FACTIONS_PROTOTYPE.md'] },
      { area: 'Verification', status: 'Partial', detail: 'Setup, inventory, private views, JSON/SQLite continuation, concurrent start and dirty-lobby rejection have focused checks. Ixian per-lot decline has ownership, stale/corrupt decision, private card custody and concurrent recovery checks. Sample gameplay and browser evidence are recorded separately, with remaining guards retained. Deferred movement and ordinary shipment checks cover arrival preflight, retained resources and saved concurrent recovery; special shipment receipts keep their separate guards.', evidence: ['tests/deferred-movement-arrival.test.ts', 'tests/deferred-movement-arrival-recovery.test.ts', 'tests/deferred-shipment-arrival.test.ts', 'tests/deferred-shipment-arrival-recovery.test.ts', 'docs/DEFERRED_SHIPMENT_ARRIVAL.md', 'tools/faction-games.ts', 'tests/expansion-factions-prototype.test.ts', 'tests/expansion-factions-recovery.test.ts', 'tests/ecaz-setup-controls.test.tsx', 'tests/ecaz-cards.test.ts', 'tests/ix-richese-technology.test.ts', 'tests/ix-richese-technology-controls.test.tsx', 'tests/ix-richese-technology-recovery.test.ts'] },
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
              'The Discovery prototype connects seven Spice Cards, eight tokens, Great Maker, private Collection inspection/reveal, stash rewards, revealed nested locations, next-turn free entry, sole-occupant Cistern income, bounded Orgiz transfers and later-turn Ornithopter movement. Jacurutu income, Testing Station and Shrine also have bounded prototypes. Mixed-force Jacurutu and contested benefits remain pending; see the Discovery checklist.',
            ]
          : []),
        'The expansion catalog is present. Expansion faction mechanics, remaining modules and their full interaction reference remain in development.',
      ],
      related: [
        'setup',
        'advanced-combat',
        ...(id === 'ix-modules' ? ['tech-tokens'] : []),
        ...(id === 'choam-modules' ? ['stronghold-cards', 'leader-skills'] : []),
        ...(id === 'choam-modules' ? ['richese-cards', 'nexus-richese-betrayal'] : []),
        ...(id === 'ecaz-modules'
          ? [
              'faction-moritani',
              'moritani-terror',
              'ecaz-ambassadors',
              'homeworlds',
              'discoveries',
              'implementation-checklist',
            ]
          : []),
      ],
    }),
  ),
];
