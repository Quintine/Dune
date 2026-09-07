import Link from 'next/link';
export default function Rules() {
  return (
    <main className="rule-page">
      <Link href="/">← Return to the table</Link>
      <h1>Rules coverage ledger</h1>
      <p>
        This project targets classic Gale Force Nine Dune, the advanced game,
        and all three faction expansions. The current build is in development
        and does not yet provide full rules compliance. Playable tables use
        Basic rules with the six base factions; optional tech tokens require at
        least three players. Advanced and expansion table starts remain disabled
        while their remaining rules and complete games are verified.
      </p>
      <table>
        <thead>
          <tr>
            <th>Area</th>
            <th>Current implementation</th>
            <th>Verification remaining</th>
          </tr>
        </thead>
        <tbody>
          {[
            [
              'Multiplayer',
              'Persistent rooms, private seats, version checks, reconnects',
              'Hosted deployment and broader game scenarios',
            ],
            [
              'Setup',
              'Staged base setup: secret Bene Gesserit prediction before traitor dealing, all traitor choices before force placement, and starting treachery after placement. Advanced Fremen and advisor setup verified offline; existing saved setups keep their dealt cards',
              'Complete Advanced rules and browser acceptance, expansion setup and optional-module setup; sampled complete games alone do not enable Advanced play',
            ],
            [
              'Storm & spice',
              'Printed player circles and first-storm ordering audited; secret dials, double spice blow, Fremen forecasts, storm casualty choices, worms, Nexus and rides implemented',
              'Full Advanced-game integration and remaining expansion storm/spice interactions',
            ],
            [
              'Economy',
              'Charity, auctions, revival, Fremen ally revival, ally funding, Guild and Emperor income, and Advanced stronghold income',
              'Auction clock and remaining power/payment timing windows',
            ],
            [
              'Movement',
              'Territories, sector groups, routes, ornithopters, per-move Fremen Karama cancellation, Guild transport with private price/funding previews and contributor-based income, Advanced turn timing, BG free shipments, advisor stances and intrusion choices',
              'Temporary allied entry with enforced departure, printed-board graph audit, remaining advisor timing and Guild cancellation cases, and combined expansion entry effects',
            ],
            [
              'Battle',
              'Sealed plans, weapons, defenses, ties, traitors, Harkonnen ally support, Voice, element-only prescience, lasgun/shield, optional winner discards, spice combat, elite casualties, Kwisatz Haderach, captured leaders and advisor exclusions',
              'Remaining advisor, special-power and timing interactions; complete Advanced battles within full games',
            ],
            [
              'Victory',
              'Basic stronghold targets, alliances, Fremen/Guild special wins, prediction',
              'Rulebook scenarios and contested stronghold checks',
            ],
            [
              'Treachery cards',
              'Base inventory; Hajr, Ghola, Weather Control, Family Atomics, Harvester, Karama auctions, shipment benefit, faction response windows and Truthtrance card, traitor and current-spice facts, battle commitments with Ghola preparation and freeform questions',
              'Remaining Karama powers, Truthtrance arbitrary commitments, other future card/power sequences and timing windows',
            ],
            [
              'Special Karama',
              'Atreides plan inspection, Emperor revival, Fremen worm, Harkonnen hand exchange, Guild shipment stop, Tleilaxu revival prevention, Ixian stronghold relocation, CHOAM cash-in and Richese acquisition',
              'Expansion powers; pre-reveal timing, worm/card sequencing, auction recovery and canceled-shipment settlement clarification',
            ],
            [
              'Ixians & Tleilaxu',
              'Full fourteen-card inventory, tech tokens, special battle cards, Sandtrout, Thumper, Cheap Hero traitor, Amal, Tleilaxu Face Dancers, Zoal, revival commerce, foreign gholas and Ixian combat/substitution, movement, revival pricing, mobile stronghold and setup/bidding technology',
              'Special-Karama timing/exception audit, mobile-stronghold collection/entry audits, complete-game setup, multi-Harvester/card-face audits and other auction modes, two-player tokens and expansion interactions',
            ],
            [
              'CHOAM & Richese',
              'Partial mechanics: CHOAM charity, revival, Inflation, sales, allied exchanges, battle funding, five Worthless powers and Auditor inspection; Richese auctions, Black Market, No-Fields, allied shipments, card gifts and seven card effects; all six Stronghold Card effects, custody, inspectors and mobile choices',
              'Kull Wahad, Auditor repeat-revival cycles, Semuta Drug, Mirror Weapon, Juice of Sapho, leader skills, complete Stronghold module combinations; remaining timing, payment and full-game checks',
            ],
            [
              'Ecaz & Moritani',
              'Partial mechanics: Ambassador placement and five entry effects, Moritani Terror placement and supported reactions, Extortion, alliance powers, advanced leader assassination, and Moritani acquisition and battle use of Duke Vidal',
              'Remaining Ambassador effects, Atomics/Aftermath, Ecaz setup and Vidal revival/control, competing entry effects, homeworlds, Nexus cards, discoveries and complete games',
            ],
            [
              'Presentation',
              'Original desert artwork, interactive map, private hand, phase animations, portraits for all 60 ordinary leaders and a separate Duke Vidal portrait',
              'Other special components, reveal animations, and broader responsive and accessibility review',
            ],
          ].map(([a, b, c]) => (
            <tr key={a}>
              <td>{a}</td>
              <td>{b}</td>
              <td>{c}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>
        Verification checkpoint: 1,631 rules, client and component tests and 152
        persistence/API tests pass. Advanced setup has 456 roster, difficulty
        and seating-order cases. A separate study completed 456 Advanced base
        games across two through six players. Another 40 sampled base-faction
        games with Stronghold Cards completed across every count and AI level,
        with no rejected actions or stalls. Remaining Advanced rules and browser
        acceptance, expansion games and optional modules still need
        verification; these checks do not establish full rules compliance.
      </p>
      <h2>About this adaptation</h2>
      <p>
        Rules are being checked against the GF9 base rulebook, November 2020
        FAQ, and the Ixians &amp; Tleilaxu, CHOAM &amp; Richese, and Ecaz &amp;
        Moritani expansion rulebooks.
      </p>
      <p>
        Board geometry adapted from the MIT-licensed Truthsayer project. Faction
        and game names identify the board game being implemented. This is an
        unofficial fan project.
      </p>
    </main>
  );
}
