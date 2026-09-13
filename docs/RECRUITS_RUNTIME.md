# Recruits development preview

14 September 2026. **Prototyped, not full card-variant acceptance.** The independent
Ecaz & Moritani Treachery Cards variant is included before genuine Basic or
Advanced faction setup. All three physical cards are present exactly once.
Recruits has connected controls, AI and saved continuation; Reinforcements and
Harass & Withdraw remain unfinished. Public starts and publication remain gated.

## Rules contract

[The source audit](RECRUITS_RULES.md) records publisher Ecaz & Moritani pages 11
and 16, the base and faction revival rules, and designer Jack Reda's explanation
at 8:25–8:48. The card plays during Revival, doubles every current free rate,
raises the normal force limit to seven for this turn, and is discarded after use.
The publisher's four-to-eight example is capped at seven by the ordinary limit.
Fresh publisher/designer-linked PDF fetches on 14 September returned HTTP 403;
this follow-up uses the earlier recorded primary-source audit and independent
source review. No newly retrieved late-paid ruling is claimed.

The connected scope permits clean activation before normal returns or after only
exactly recorded free normal returns, once existing priority windows and transactions
have finished. Earlier paid returns, unknown legacy usage, later Fremen grants,
same-turn replay after recovery and additional optional modules remain guarded.
Those guards identify unfinished cases; they are not new printed timing rules.
Already-ready players retain their Revival opportunity while phase four is open.

Atreides doubles two to four, Fremen three to six, and Guild one to two. Native
CHOAM and Tleilaxu retain their unlimited allowance with free rates zero and four.
Paid prices, prevention and separate elite caps remain in force. A Fremen grant
settled before play doubles the ally's replacement rate three to six.

The seven-force allowance remains an independent global card effect when a
CHOAM or Tleilaxu faction advantage is canceled. **This is an implementation
inference from independent effects, not a direct combined publisher FAQ.** A
Tleilaxu limit response is not opened merely for crossing three under Recruits;
other qualifying price/prevention responses retain their original purposes.

The user has been asked about Atreides taking two free plus one paid return before
Recruits: preserve the gate, provide two further free returns without refund, or
provide one further free return without refund. No answer is assumed. The source
audit also records the refund alternative and later changing-rate ambiguity.

## Connected path and persistence

`initializeEcazTreacheryGameForAudit` composes the complete three-card inventory
with the selected ordinary deck before shuffle/deal. The local `ecaz-treachery`
prototype-room profile accepts only a fresh ready lobby and uses the existing
version/state compare-and-swap. It preserves seats and other rooms.

The holder's existing inspector shows the complete original-language card guide.
The Revival panel submits the shared `recruitsPlayAction`; rivals receive no held
card offer. A successful action discards the physical card once and saves its
player, turn and identity. Every player then sees the same effective public rates
and force limits. No rival hand, private spice or revival-use ledger is added.

Authoritative shared revival quotes use the effect. Exact free usage is separate
from total normal returns only while Recruits is active; inactive/legacy games
retain their previous arithmetic. Active receipts and ledgers are validated on
action and projection. JSON and SQLite restoration retain the same allowance;
the next turn clears the effect. Rejected actions leave the supplied state intact.

All four AI profiles use the same legal owned offer when their faction or ally can
benefit, then ordinary quoted revival choices. The late Fremen grant is excluded
from bot candidates as well as server and UI controls. This is a legal first
strategy, not completed Recruits difficulty calibration.

## Verification

Focused engine, component, AI, genuine prototype-room and authenticated SQLite
recovery suites are maintained alongside the pure arithmetic and inventory tests.
Independent review passes a 37-case related union; four authenticated SQLite cases
cover restored free/paid returns, malformed saves, stale/duplicate actions and
competing writes. Eight fixed-seed six-seat Basic/Advanced samples across all four
AI profiles finish in 7,995 accepted actions with no rejected candidates. Recruits
is genuinely played three times. Physical cards, Traitors, safe force/elite pools,
212 periodic all-seat JSON restores and terminal private views pass. Undefined
object properties are normalized through JSON on both sides of the comparison;
defined values are retained. Earlier harness attempts remain in private artifacts.

A separate conserved browser Revival fixture verifies the full inspector, actual
play/discard, public Atreides four/Fremen six rates, four free returns, automatic
chronicle and active/resolved refresh. Exact state comparison preserves the seat,
cards, forces and unchanged spice. This staged browser position does not establish
naturally reached card use. Final broad checks, source fingerprints, saved-game
preservation and Git delivery are recorded with the checkpoint. These samples do
not certify the unfinished three-card variant or every combined configuration.

See [current status](CURRENT_STATUS.md), [decision index](RULE_DECISIONS.md) and
[the reference checklist](../game/reference.ts), topic `card-recruits`, for the
remaining boundaries. Final polishing, other two effects and valid optional-module
combinations remain required work.
