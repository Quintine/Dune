export const FACTION_RULES: Record<
  string,
  { basic: string[]; advanced: string[] }
> = {
  choam: {
    basic: [
      'Begin with two spice and twenty forces in off-planet reserves. Your treachery hand limit is five cards.',
      'Before any faction claims charity, receive two spice for each faction at the table, including yourself. Other factions’ charity comes from your available spice. Karama cancels your income and makes the bank pay charity for that turn; you may then claim ordinary charity if eligible.',
      'You have no free force revival, but pay one spice per force with no normal quantity limit. A Karama response precedes the revival and may restore the three-force allowance and two-spice price for the phase. Tleilaxu can still permit five. See the CHOAM revival topic for allied benefits and cancellation.',
      'During Mentat Pause, place Inflation to double or cancel next turn’s charity. At the next Mentat it flips to the opposite effect; at the following Mentat it leaves the game. Double prohibits bribes. Placement has a Karama response; mandatory flip and removal do not.',
      'At each phase end, sell Worthless cards for two spice or reveal exact duplicates and sell surplus copies for three each. A Karama response precedes each sale. Once per turn, exchange one card each with your ally; both players choose and CHOAM confirms before either hand changes.',
      'Use Kulon on your movement turn to add one territory of range. Use La La La during Revival to prevent a player’s free force returns for the phase; a reactive decision lets you stop a pending free revival before it resolves. Both cards have Karama responses before discard.',
      'Trip to Gamont returns one other player’s force from a chosen sector to its reserves during Mentat. Elite types are preserved. A Karama response precedes the return, and CHOAM gets a final opportunity after the closing market before victory is checked.',
      'Charity, Inflation, hand limits, force revival, card sales, allied exchanges, Kulon, La La La and Trip to Gamont now have engine controls. The other three Worthless effects and remaining faction powers are unfinished, so CHOAM starts remain disabled.',
    ],
    advanced: [
      'Once per game, spend a real Karama and discard selected other cards for three spice each. The cash-in can occur during pending phase or power decisions, while committed battle cards remain protected. See the CHOAM special Karama topic for funding and timing details.',
      'Reserve spice to pay for some or all of your ally’s battle support. Each sealed plan records its own and allied shares. A Karama response may prevent this alliance benefit for one battle; unused funding returns at the end of Battle.',
      'Receive half of each other player’s actual force-support payment, rounded down, unless any traitor is revealed. Your own payments, including support paid for your ally, go to the bank. A separate Karama response can cancel this battle’s income. See CHOAM combat for examples and outstanding interaction audits.',
      'The Auditor and printed leader setup are not implemented yet.',
    ],
  },
  ixians: {
    basic: [
      'Ixians have seven cyborgs and thirteen suboids. Cyborgs dial strength two in the basic game; each suboid dials one-half. Physical force tokens and combat strength are counted separately.',
      'After battle casualties, surviving suboids may be exchanged one for one for cyborgs lost in that battle. Select the suboid and cyborg sectors in the substitution panel. A separate Karama response can stop the exchange.',
      'Cyborgs move two territories, can bring accompanying suboids, collect three spice and cost three spice to revive. Standalone suboids move one territory and collect normally. These transport, collection and revival details now have tested support; select cyborgs in the force controls and choose the free-revival type in Revival.',
      'Before starting cards are dealt, choose one from a pool of one per faction; shuffle and deal the remainder privately. Before bidding, inspect an extra card and return one to the top or bottom of the deck. Your ally may replace each purchased card with the deck’s top card. These bidding powers have separate Karama responses.',
      'Start with ten spice, three cyborgs and three suboids in the Hidden Mobile Stronghold, and the remaining forces in reserves. One force revival is free, of either type. Mobile stronghold placement, route movement, entry, protection and victory counting now have engine support. Setup/auction technology now has private decision controls; full interaction audits and complete deck integration are unfinished, so faction starts remain disabled.',
    ],
    advanced: [
      'A cyborg needs one spice to dial at strength two; an unsupported cyborg dials strength one. Suboids always dial one-half and cannot receive spice support. Suboid casualty substitution works in both basic and advanced battles.',
      'Before Atreides sees a card, Ixians may once per bidding round replace the card being auctioned with one from hand. A private substitution choice and Karama response resolve before Atreides inspects the card. Special Karama can relocate the occupied mobile stronghold up to two territories during your own Shipment and Movement turn without consuming ordinary transport; use its route panel.',
    ],
  },
  tleilaxu: {
    basic: [
      'Start with twenty forces in off-planet reserves and five spice. Two force revivals are free.',
      'Receive three Face Dancers after other factions choose their traitors. Reveal a matching victorious leader only after battle rewards are resolved, then replace its surviving army with your forces. See the Face Dancer topic for the full sequence.',
      'Zoal copies the opposing leader’s strength in battle and for his death bounty. His ordinary revival value is three spice.',
      'Other factions pay you for revival; your own revival has no normal quantity limit and costs half price, rounded up. Grant five-force limits, offer an ally half price, and negotiate early leader returns through the revival controls. Full faction starts remain disabled pending remaining powers and audits.',
    ],
    advanced: [
      'Revive foreign dead leaders at your discounted bank price while your active pool has fewer than five leaders. Their original traitor identities persist. A dead ghola may be sold back by private agreement; living gholas cannot be sold back. See the foreign-ghola topic. Once per game, spend a real Karama at another faction’s normal revival declaration to prevent its normal force and leader revivals for that turn. The attempt pays nothing and returns no pieces. Card exceptions and complete timing remain under audit.',
    ],
  },
  atreides: {
    basic: [
      'Start with ten forces in Arrakeen, ten in reserve and ten spice. Two force revivals are free each turn.',
      'Inspect each card before its auction begins. At the start of movement, inspect the next spice card. The auction and spice panels show this information privately.',
      'Before battle plans are sealed, request the opponent’s leader, weapon, defense or dial. The opponent commits that element; a reply of no weapon or no defense still uses the request.',
      'When allied, you may use battle prescience for your ally. The ally and their opponent receive the committed element; other players do not.',
      'Voice resolves before prescience. A Karama response precedes the answer. Auction and spice peeks also have response windows; a canceled card stays hidden.',
    ],
    advanced: [
      'Once per game, spend Karama after ordinary battle preparation to privately inspect either combatant’s entire plan. The chosen player commits first. Atreides keeps the private inspection visible while the other combatant prepares and seals a plan; no inspection confirmation is required. This works in another player’s battle and is separate from ordinary prescience. See the special-Karama topic for remaining timing audits.',
      'The Kwisatz Haderach becomes available once Atreides has lost seven forces in battles. Storm and worm losses do not count.',
      'Use it with a leader or Cheap Hero in one territory per turn to add two strength. It contributes nothing if the accompanying leader dies, and it prevents that leader from turning traitor.',
      'A lasgun–shield explosion kills KH only when it accompanies the battle plan and the explosion actually resolves. A traitor victory overrides the explosion. An ordinary leader death removes the bonus but does not kill KH or add to the leader’s bounty.',
      'Revive KH for two spice once the Atreides leader cycle permits it, using the normal one-leader revival allowance. KH’s life or death never blocks ordinary Atreides leader revivals. Ghola can return a dead KH for free without using that allowance.',
    ],
  },
  harkonnen: {
    basic: [
      'Start with ten forces in Carthag, ten in reserve and ten spice. Two force revivals are free each turn.',
      'Keep all four dealt traitors, including any of your own leaders. Begin with two treachery cards and a hand limit of eight.',
      'After acquiring an auction card, draw an extra card if there is room in your hand. The bonus has its own Karama response.',
      'You may reveal a traitor against your ally’s opponent. This choice belongs to Harkonnen; the ally cannot reveal your cards for you.',
      'Karama can cancel an ally-support reveal. It cannot cancel a traitor reveal in Harkonnen’s own battle or reduce the eight-card hand limit.',
    ],
    advanced: [
      'After a battle victory, randomly capture an eligible surviving leader from the loser. Leaders already used in another territory that turn are excluded.',
      'After casualties and card choices, choose whether to capture. A Karama response resolves before the random draw. Inspect the captive, then execute it for two spice or retain it for one battle.',
      'An executed captive is placed face down and counts as having died twice. Its identity and state remain concealed from other factions; the original owner, Harkonnen and Tleilaxu may inspect it. A surviving captive returns after its one battle; a killed captive goes to its owner’s tanks.',
      'Once per game during Bidding, spend Karama to take up to four unseen cards from another player, inspect the combined hand, then return the same number. The return may include newly taken cards; temporary hand-limit excess is allowed during the choice.',
      'Return captives immediately if all of Harkonnen’s own leaders are dead. Captured leaders can still be traitors. Only captor and original owner receive the captive’s identity privately.',
    ],
  },
  emperor: {
    basic: [
      'Start with all twenty forces in reserve and ten spice. One force revival is free each turn.',
      'Receive payments for other players’ auction purchases. Your own purchases pay the bank; a Karama purchase pays no spice. A cancellation sends one auction payment to the bank.',
      'Give spice directly to your ally. After the response window it is immediately spendable, unlike a deferred bribe between non-allies.',
      'During Revival, pay two spice per extra allied force, up to three extra forces per turn. These are separate from the ally’s normal three-force allowance and may be purchased before or after ordinary revivals.',
      'Spice gifts and extra revival uses have Karama response windows. Canceling a use spends neither the Emperor’s spice nor the extra-revival allowance.',
    ],
    advanced: [
      'Five Sardaukar forces have a printed battle strength of two each, except against Fremen, where they count as ordinary forces.',
      'Spice support applies per token. A supported Sardaukar contributes two strength; an unsupported Sardaukar contributes one, except when fighting Fremen.',
      'Once per game during Revival, spend Karama to revive up to three of your own forces or one of your own dead leaders for free, separately from normal revival allowances. The one-Sardaukar-per-turn limit still applies.',
      'An elite token counts as one force for revival. Only one Sardaukar may be revived per turn.',
    ],
  },
  fremen: {
    basic: [
      'Begin with three spice and ten forces split as you choose among sectors of Sietch Tabr, False Wall South and False Wall West. The other ten forces stay in reserve.',
      'Revive up to three forces for free each turn. In the base game, Fremen cannot buy normal force revivals. When Tleilaxu is in the game, paid returns are allowed within the current limit: three normally, or five with Tleilaxu permission. Enabling the Ix expansion without Tleilaxu does not grant this exception. La La La prevents free returns but leaves this paid method available when Tleilaxu is present. Emperor-funded extras and Ghola remain separate.',
      'Bring reserves to the Great Flat or one territory within two territories of it for no spice, subject to storm and occupancy restrictions. Ordinary movement has range two, or three when eligible for ornithopters.',
      'Worms do not devour Fremen. After the Nexus, move some or all forces from the worm territory to a legal destination. The destination’s existing forces survive.',
      'You choose whether a worm spares your ally and whether to grant your ally three free force revivals. These benefits are optional.',
      'At the final turn, the special victory requires Sietch Tabr and Habbanya Sietch to be empty or occupied by Fremen, with no Atreides, Harkonnen or Emperor in Tuek’s Sietch. Allied occupation does not override those conditions.',
    ],
    advanced: [
      'Once per game during Spice Blow and Nexus, spend Karama to call Shai-Hulud in sand. Resolve destruction and optional protections immediately; Nexus follows at the end of the blow, with eligible Fremen rides afterward. The called worm consumes no spice-deck card.',
      'After the first turn’s dials, a secretly selected storm card determines the next storm. Fremen learns that card in advance; it is revealed when used.',
      'Additional worms after the first in a spice blow can be placed in a sand territory chosen by Fremen.',
      'Fremen loses half its forces, rounded up, to storm exposure. Reserves may arrive under storm at half loss. Ordinary movement and worm rides may not enter or leave storm.',
      'Three Fedaykin tokens count as two forces in battle and casualties. Only one may be revived per turn. All Fremen forces fight at full strength without spice support.',
    ],
  },
  guild: {
    basic: [
      'Start with five forces in Tuek’s Sietch, fifteen in reserve and five spice. One force revival is free each turn.',
      'Choose one shipment: reserves to Dune, one on-planet territory to another, or one on-planet territory back to reserves. Movement follows shipment.',
      'Pay half the normal shipment rate, rounding the total cost up. Returning forces cost one spice per two tokens, rounded up.',
      'Receive spice for other factions’ ordinary off-planet shipments and allied cross-shipments. Karama shipping and a canceled Guild payment go to the bank. Fremen’s normal reinforcements provide no income. Any spice the Guild contributes toward its ally’s shipment goes to the bank.',
      'Allies can ship from off-planet or cross-ship on Dune at half price. They cannot ship back to reserves. Allied Fremen may pay to cross-ship from southern reserves to any legal destination. Allied cross-shipments pay the Guild; any Guild-funded share goes to the bank.',
      'If the game reaches its end without another qualifying victory, Guild and its ally win through the Guild special victory.',
    ],
    advanced: [
      'Choose when to take the complete shipment-and-movement turn: first, last or between other players’ turns.',
      'Once per game, spend Karama to stop a declared off-planet shipment before payment and arrival. No Guild income or accompanying advisor is triggered; ordinary movement remains available. The internal special-Karama reference records settlement details still awaiting clarification.',
      'Keep shipment followed by movement together. Other players retain their relative storm order, and no player gets an extra movement turn. Choose now or wait before each remaining player starts; no advance declaration of your eventual position is needed.',
      'The first attempt to act early or delay your normal turn has a Karama window. Cancellation keeps you in normal order for this phase. Once a delayed turn is allowed, you may choose between later players or go last.',
    ],
  },
  beneGesserit: {
    basic: [
      'Start with one force in the Polar Sink, nineteen in reserve and five spice. One force revival is free each turn.',
      'Secretly predict another faction and a turn. If that faction wins normally on that turn, including in an alliance, Bene Gesserit wins alone. Fremen and Guild special victories cannot trigger the prediction.',
      'After another faction ships from off-planet, optionally send one reserve force to the Polar Sink for free. Fremen reinforcements and on-planet Guild transport do not trigger this benefit.',
      'Use Voice to require or forbid a battle card category: projectile, poison, lasgun, shield, snooper, worthless or Cheap Hero. An opponent unable to comply is released from the requirement.',
      'You may Voice an ally’s opponent. Voice resolves before prescience and sealed battle plans; the response window allows one use to be canceled.',
    ],
    advanced: [
      'After Fremen setup, place one advisor in a territory of your choice, turning it into a fighter if the territory is empty. Advisors and fighters use distinct sides of the same force tokens.',
      'Advisors coexist peacefully. They do not contest strongholds, fight, collect spice, supply ornithopters or enable Family Atomics. Storms, worms and explosions can still kill them.',
      'A free accompanying shipment may place an advisor in the arriving faction’s territory. That advisor cannot become a fighter during the same turn while other forces remain there.',
      'Ordinary shipments enter as fighters unless joining existing advisors. Arriving forces match the Bene Gesserit type already in that territory. Advisors moving into an empty territory become fighters; those entering an occupied territory without another Bene Gesserit group may remain advisors or become fighters.',
      'When another faction enters your fighters’ territory, you may turn them into advisors. Between the spice phase and the first shipment, you may turn eligible advisors into fighters to contest their territories.',
      'Receive two charity spice regardless of wealth. Worthless cards may be used as Karama, with the card discarded when used.',
    ],
  },
};
