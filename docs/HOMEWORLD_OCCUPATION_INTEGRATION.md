# Homeworld occupation integration audit

This is a code integration map, not an occupation ruling or a claim of runtime
completion. It records the current native effect consumers and the boundaries a
future occupation implementation must preserve. Authority and unresolved cases
remain in [Homeworld rules](HOMEWORLD_RULES.md),
[invasion rules](HOMEWORLD_INVASION_RULES.md), and the current source audit.

## Separate physical population from active effects

`game/homeworld-population.ts::homeworldPopulations` is explicitly a public,
physical projection. Its `side` follows native typed counters and the printed
minimum. Visitors never raise native population; Kaitain excludes Salusa's
separate allocation, and Salusa counts Sardaukar only. Keep these calculations,
reserve custody, shipment sources, and before/after population quotes physical.

Occupation qualification is event based; present foreign forces are not a
sufficient replacement for saved qualification. Conversely, a saved reward
entitlement need not answer every present-control question. The existing source
contract leaves repopulation and some competing-occupier cases unresolved. Do
not silently impose an exclusive controller or globally replace physical
`side` with `low` when a foreign force appears.

Three distinct inputs are needed: physical native population, the native
effects currently active under the verified occupation rule, and each qualified
occupier's particular benefits. Low penalties, generic low bonuses, high effects
and native battle strength are separate consumers. Tupile makes this especially
visible: its Worthless-sale restriction is a **high** effect, while its low
disclosure ability is explicitly lost under occupation.

## Existing consumers

| Consumer | Current physical predicate | Occupation integration boundary |
| --- | --- | --- |
| `homeworld-benefits.ts::homeworldLowBonus` | Native primary world low; Salusa excluded | Generic charity/revival bonus eligibility must be resolved independently of retaining a named low penalty. Do not award bonuses merely because an occupation penalty remains. |
| `charity.ts::charityQuote`, `revival.ts::freeRevivalRate` | Shared low bonus | Preserve ordinary eligibility, bank funding, inflation, Recruits and resource caps. Changing the shared helper reaches engine/view quotes. |
| `homeworld-benefits.ts::snapshotHomeworldRevival` | Tleilax physically low at Revival opening | Snapshot the verified low-penalty condition at the original phase-opening event. `tleilaxuHomeworldFreeIncomeBlocked` must continue reading that saved receipt, not current population or occupation. |
| `homeworld-benefits.ts::homeworldSardaukarFreeSupport` | Advanced Salusa high | A native high capability. Occupied Salusa's loss of Sardaukar advantage needs its own rule composition, not a physical force conversion. |
| `homeworld-benefits.ts::homeworldSardaukarGholaBlock` | Salusa population exactly one during an Emperor battle | Existing unresolved support-transition guard. If occupation changes effective support, compare the relevant before/after capability; do not remove the guard solely because occupation exists. |
| `homeworld-mobility.ts::homeworldMovementForesightBlock` | Caladan low | Retained low penalty blocks a new Movement peek; it does not erase already acquired knowledge. |
| `homeworld-mobility.ts::homeworldMobileStrongholdMovementBlock` | Ix low | Retained low penalty blocks stronghold relocation, including its special Karama route; ordinary troop movement remains separate. |
| `homeworld-mobility.ts::homeworldNoFieldMovementBlock` | Richese low | Retained low penalty restricts existing marker movement. Shipment and reveal rules remain separate. |
| `homeworld-mobility.ts::homeworldSpiritualAdvisorAllowance` | Wallach low gives zero; high permits two at Polar Sink | Resolve low suppression and the high two-advisor benefit explicitly. Preserve physical reserve limits and accepted reaction counts. |
| `homeworld-card-economy.ts::highKaitainDiscardsAvailable` | Kaitain high | Native high capability; use the shared effective condition at quote/action time. Keep the shared end-of-Bidding event public and independent of private affordability. |
| `homeworld-card-economy.ts::homeworldWorthlessSaleBlock` | Tupile high | High-face restriction, not a retained low penalty. Both ordinary and duplicate Worthless sales and CHOAM Ambassador bank payouts consume this helper. Trades, Ixian discard/draw and special Karama retain their own rules. |
| `ecaz-poison-income.ts::quoteEcazPoisonIncome` | Ecaz high | Evaluate active high income at actual physical discard, including delayed winner cleanup. Battle roles remain captured at battle resolution; they must not freeze future population or occupation eligibility. |
| `junction-offer.ts::junctionSponsor` and `junction-transport.ts::junctionSponsorEligible` | Independently test Junction high | Replace duplicated eligibility with one shared capability predicate. Preserve public offer-event invalidation and ordinary Guild transport rights. |
| `homeworld-payment-income.ts::quoteHomeworldPaymentIncome` | Kaitain/Junction physically low | Physical low native income reduction only. Future retained low must be supplied through the common effect layer; occupier shares need separate payment provenance and settlement. |
| `homeworld-combat.ts::locations`, `homeworldBattleRules` | Physical face selects native battle strength | Resolve the applicable combat face explicitly. Native dial bonus and Lasgun/shield native casualties use this strength; neither can be inferred from a generic retained-penalty boolean. |

The payment quote is an independently scoped addition being implemented with
this audit; it does not implement occupation or create a payment event.

The engine also uses `homeworldLowBonus` when deciding whether CHOAM's opening
charity income may proceed, and when projecting the owner's revival bonus.
Keep that existing opening-income release boundary explicit: deciding retained
low penalties alone does not resolve the separately documented classification
of CHOAM's opening income. `homeworldRevivalKaramaBlock` also derives from the
generic bonus; its unresolved special-Karama overlap must remain visible.

## Engine, interruptions and projection

`homeworld-game.ts::homeworldGameIntegrity` currently accepts exactly the
`custody` key inside the module record. Any new persisted occupation field needs
an explicit schema/integrity change, a compatible initialization rule and JSON
recovery coverage. Do not reconstruct historical qualification on view/read.
`homeworldContext` deliberately strips players to public identity, faction and
typed reserve counts. Extend public context intentionally rather than passing
hands, secrets or held spice to occupation calculations.

The mobility helpers already feed `movement-phase-quote.ts`,
`terminal-cancellation.ts`, `karama-movement-cancellation.ts`,
`guild-ambassador.ts`, `fremen-ambassador.ts` and engine action/view guards.
Update their narrowed context types consistently. Accepted declarations and
durable continuations require a source-specific choice between current
eligibility and captured eligibility; never rewrite their counts on reload.

Card income and sale settlement already have live rechecks. Preserve the CHOAM
sale parent through Ghola/Tleilaxu income and the battle winner discard queue
through casualties/Ixian substitution. Ecaz income must observe the effect
state at each disposal, so losing-card income before winner casualties can
differ from mandatory and optional winner disposal afterward. Occupied Ecaz's
Duke authority belongs in the unique Duke custody/alliance lifecycle, not in
the poison quote.

`combat-location.ts::homeworldBattleLocation` is the common engine adapter for
Homeworld combat; use it to carry an explicit effective battle projection into
the existing pure combat rules. Physical battle presence, reciprocal-alliance
restrictions, typed loss pools and substitution remain independent.

`components/homeworld-table.tsx` labels `world.side` as population. Keep that
truthful when adding occupied status and active effects. The shipment option
modules and bots also use physical side and native strength for scores; expose
separate values if their strategic evaluation needs effective effects. Bot
heuristics must not become authority for occupation qualification or legality.

## Suggested shared interface

Keep `homeworldPopulations` unchanged. Add one public projection module around
validated occupation receipts, with a Game adapter providing only public
physical context, current turn and explicit occupation state. A suitable shape
is:

```ts
type HomeworldEffectState = {
  physical: HomeworldPopulation;
  occupation: { qualified: readonly string[]; active: boolean };
  highEffectsActive: boolean;
  lowPenaltiesActive: boolean;
  lowBonusActive: boolean;
  battleSide: 'high' | 'low';
};
```

This is a proposed interface, not a decision that the four effect fields follow
one rule. Their construction must follow the completed source audit. Card
exceptions such as occupied Tupile's disclosure loss and occupied Salusa's
Sardaukar restriction should have named quotes consuming this projection; do
not represent every native faction ability with a blanket disabled flag.
Beneficiary selection, allied sharing and expiry obligations require their own
quotes over the receipts; `qualified` alone is not permission to pay every
listed faction.

Migrate existing capability helpers to this projection rather than inserting
occupation conditionals independently into engine, view and bots. The same
projection can supply public explanatory status. Keep actual payment splits,
card selection and physical mutation in their existing focused quotes and
settlement functions.

## Verification targets

- Native low to high while a qualified invader remains, with independent
  assertions for retained low penalties, generic bonuses, high effects and
  battle strength under the finalized ruling.
- Present visitors versus qualified occupiers; departure, return, competing
  qualifiers, turn boundaries and no duplicate awards after JSON restoration.
- Revival phase-start receipt retained across later population/occupation
  changes; ordinary paid income and Ghola remain distinct.
- Sale/Ghola, winner casualties/Ixian substitution, advisor and canceled
  shipment continuations preserve exact original events and resource custody.
- Junction/Kaitain rounding per verified payment unit; retain eligible source
  contributions and explicitly guard cases where transaction and contributor
  rounding disagree until that rule is resolved. No native/occupier income is
  minted on read.
- Opponent private getters are never read; observed public state does not
  disclose hidden discarded card kinds or private balances.

This documentation audit changes no runtime rules. Links and code symbols were
reviewed; it does not certify occupation, any full faction or expansion.
