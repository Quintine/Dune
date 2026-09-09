# Homeworld component and custody foundation

Historical component checkpoint. Subsequent setup, native shipment/revival,
Emperor movement, controls, AI and recovery work is recorded in
[HOMEWORLD_RUNTIME_IMPLEMENTATION.md](HOMEWORLD_RUNTIME_IMPLEMENTATION.md).

9 September 2026. This checkpoint adds the complete public Homeworld card
collection and isolated physical-state helpers. **Homeworld gameplay is not
enabled.** It does not certify the complete module, any expansion or Advanced
play.

## Implemented boundary

- `game/homeworld-cards.ts` contains 13 immutable two-sided definitions, one
  per physical card/token pair, covering all twelve factions. Both faces include
  original gameplay prose, population ranges, native battle/explosion values
  and occupied Collection symbols. No source photographs are bundled.
- `components/homeworld-cards.tsx` renders original local art with selectable
  text, high/reverse tabs and a scrollable enlarged inspector. The reverse
  correctly contains both low and occupied panels. Salusa is marked Advanced
  only. The internal reference searches the complete card text as well as names.
- `game/homeworld-custody.ts` keeps native primary reserves authoritative in
  each player's existing typed totals. It stores only foreign visitors and
  Salusa's allocation within Emperor totals. Explicit withdrawals/deposits
  return detached before/after receipts; a transfer cannot spend forces newly
  deposited during the same transaction. Native and foreign physical totals,
  special-counter caps, active worlds and seated identities are validated.
- `game/homeworld-population.ts` joins the card manifest to those separate
  world locations. It counts native forces only, uses Sardaukar alone on
  Salusa, selects the face at the verified minimum-high boundary, and exposes
  printed native battle values and conditional low-population bonuses.
  Printed occupied income is explicitly potential, never a payment.

The helpers never read private hands or leaders. Homeworld IDs do not enter
the Arrakis territory/sector registry. Both Emperor force types can be
transferred between Kaitain and Salusa without duplicating reserves or
mistaking normal Salusa defenders for Sardaukar population. Starred Fremen
identity can be retained in Basic without granting Advanced strength.

## Source decisions

See [component audit](HOMEWORLD_COMPONENT_AUDIT.md) and
[global rules contract](HOMEWORLD_RULES.md). All 26 physical faces were inspected
and independently reviewed. Caladan's printed native value is 2; the rulebook
delegates to the card despite an inconsistent example saying 3. Salusa's
printed high 2–5 and low 0–2 ranges are both retained; the global minimum-high
instruction selects high at 2. Tupile's reverse says CHOAM on another
Homeworld **or** another faction on Tupile; an initial missing-word reading was
corrected before release.

## Verification

Focused tests cover all 13 card boundaries, inventory and immutable data;
57 base rosters in both modes and every expansion faction; native/foreign
custody and both-type Emperor transfers; death/revival custody deltas; duplicate
change aggregation; malformed state; prototype-like player IDs; private getter
guards; and JSON round trips. The focused Homeworld/reference run passes 39
cases. The runner's five-case subprocess self-check also passes.

Full typecheck, lint and **3,085 offline tests** pass; the final production
build also passes. The final text-size-only adjustment was followed by named
lint, a rebuild and browser verification. Logs:
`/tmp/dune-homeworld-check-final.log`,
`/tmp/dune-homeworld-build-final.log`, and
`/tmp/dune-homeworld-focused-second.log`.

Browser checks exercised both enlarged faces of all 13 cards on desktop and
at 390×844, all normal reverse controls, loaded original artwork, full-text
search, refresh, keyboard face selection/activation and Escape dismissal.
No inspector or visible text overflows horizontally. Normal gameplay text is
16px; enlarged text is 20px with 32px line height. Screenshot review covered
Caladan high/reverse on desktop, Ecaz high on desktop, Tupile high/reverse on
phone, Salusa reverse on phone and the normal Caladan phone card. This is
bounded visual sampling, not a claim that screenshots of every possible face
and viewport have been inspected.

All thirteen 1774×887 original illustrations were individually inspected by
the asset agent. Final files are `public/art/homeworlds/<card-id>-v1.png`;
[the exact prompt manifest](HOMEWORLD_ART_PROMPTS.json) records the built-in
image-generation mode, selected sources, workspace paths and SHA-256 hashes.

The controlled 07:53 UTC development-server restart preserved all **2,617**
saved room versions and state hashes. The human setup room stayed at version
14 and the QA room at version 132. No HTTP/persistence implementation changed,
so unrelated complete-game simulations and HTTP suites were not repeated.

## Remaining runtime work

The custody quote is physical bookkeeping, not action authorization. Callers
must validate the matching Arrakis/Tanks change, turn ownership, destination,
cost, ally restrictions and special permissions before accepting a transfer.
No saved `Game` schema or existing game's reserves were migrated here.

The module still needs setup/migration and complete typed arrival routing;
ordinary and Guild-sponsored shipments; Emperor movement; revival and
post-battle arrivals; occupation entitlements and turnover; battles and native
explosion casualties; all high/low/occupied card effects at their real timing
windows; income sharing, private knowledge, Duke and hand-limit custody;
alliance restrictions and Ecaz victory; authoritative player views, controls,
all four AI profiles, persistence races and complete-game verification.

Population, current foreign forces and a turn-qualified Occupier are separate
concepts. Do not replace them with one high/low/occupied enum or let this
projection decide occupation duration. Homeworld advantage/penalty immunity
must also remain distinct from ordinary cancelable faction powers.

No release gate or maintenance automation was changed. User development
workflow optimizations and all existing saved games are preserved.
