# Homeworld setup and native reserve runtime

9 September 2026. This checkpoint connects the physical Homeworld model to
the authoritative game, player table and AI. **Public Homeworld starts remain
disabled.** It does not certify Homeworld battles, occupation, card effects or
complete Advanced/expansion games. The earlier component checkpoint remains
in [HOMEWORLD_IMPLEMENTATION.md](HOMEWORLD_IMPLEMENTATION.md).

## Implemented behavior

`Game.homeworlds` is optional for existing saves. An enabled fresh lobby stores
`{custody:null}` until the genuine setup pipeline places forces, after prediction
and traitor choices. Setup then records typed native reserves and Advanced
Emperor's separate Salusa allocation. The offline-only initializer does not
replace the public start gates or dispatch through the room API. It supports
the currently implemented base/Ix deck sets; CHOAM/Richese and Ecaz/Moritani
deck construction still rejects instead of substituting a different deck.

Native primary counts derive from the player's aggregate reserves; Salusa is
an allocation within those totals. Foreign garrisons remain separate physical
pools. Reads, actions and automatic normalization validate custody and all
twenty physical counters, including special-counter identities across board,
Tanks, native worlds and foreign worlds. Missing Salusa allocation is rejected,
not reconstructed. Ixians have seven Cyborgs total, initially four in reserves
and three in the mobile stronghold. The earlier custody limit of four is fixed.

Basic Homeworld setup retains Emperor's five Sardaukar and Fremen's three
starred counters. They count as strength one in ordinary Basic combat and do
not activate Advanced faction responses. Basic winner casualties preserve the
owner's physical normal/special selection. Basic revival and Ghola preserve
identity without imposing the Advanced one-special-counter-per-turn limit.
Ixian special-counter rules retain their separate behavior.

The Advanced Emperor's `emperorHomeworldMove` action transfers an explicit
normal/Sardaukar group between Kaitain and Salusa. The server checks current
owner, phase, movement budget, pending controls and a public-state event. It
spends one movement, charges no spice and conserves aggregate reserves.
Starting with movement passes an unused shipment. A real Hajr supplies the
second movement; active Ornithopter composition remains explicitly blocked.
Homeworld permission is independent of ordinary faction Karama cancellation.

Ordinary native-to-Arrakis shipments now withdraw exact typed Homeworld sources.
An omitted selection is inferred only when the allocation is unique; ambiguous
partial draws from both Imperial worlds require explicit choices. The same
transaction places the matching Arrakis counters once. The chronicle records
the Homeworld sources and cost. No-Fields retain their separate source contract.
Normal force revival, Emperor special-Karama force revival and Ghola deposit
Advanced Emperor's normal forces on Kaitain and Sardaukar on Salusa, even when
those counters previously moved between worlds. Other factions return to their
one native reserve pool. Completed Ghola discard receipts bind the full
Homeworld custody as well as aggregate counters.

The public table displays each native world's physical counts and population,
with the full local-art card inspector. Emperor controls select a movement's
origin and force types and the Salusa contribution to a combined shipment.
Kaitain's complementary contribution is displayed and submitted explicitly.
Invalid source counts disable submission; stale choices are revalidated by the
server. Shared public helpers give all four AI levels legal typed shipment
sources and a bounded transfer policy to restore Imperial population. They
do not read opponent hands, decks, predictions or spice.

The server's shipment-completion search uses the same source helper. Its
mixed-Imperial proof is tested as an internal future integration seam: actual
Advanced Truthtrance shipment questions still remain Basic-gated.

## Verification scope

- Genuine setup: sixteen six-seat setups span the eight supported factions,
  Basic/Advanced and all four profiles; another eight mixed-Ix setups cover
  two through five seats. Unsupported deck combinations reject unchanged.
  Prediction/traitor privacy, physical card uniqueness and JSON recovery pass.
- Actual actions: transfer, Hajr, wrong-owner/stale/blocked rejections, mixed
  native shipment and a Sardaukar's shipment → Storm death → revival on Salusa.
  Ghola's saved completed-effect frame drains once; changing only its Salusa
  allocation rejects despite unchanged aggregate counters.
- Basic counters: both Emperor and Fremen retain strength-one stars, legal
  casualty choices, repeated typed revival and Ghola. Ordinary Basic behavior
  without the module remains unchanged.
- AI: every offered movement/shipment candidate is individually accepted by
  the real dispatcher across all four levels. Explicit sources, unavoidable
  elite draws, hidden-information independence, Basic exclusions and no
  oscillating population repair are verified.
- In-memory production SQL: duplicate and competing transfer requests commit
  one version; fresh module instances and authentication restore the same
  physical state/private hand. Corrupt missing Salusa state rejects without
  writes. Unrelated rooms remain unchanged.

`npm run check` passes typecheck, lint and **3,152 offline tests**. The final
production build passes; `npm test -- homeworld reference` passes **106**
focused cases. Logs: `/tmp/dune-homeworld-runtime-check-final.log`,
`/tmp/dune-homeworld-runtime-build-final.log`,
`/tmp/dune-homeworld-runtime-focused-final.log`, and
`/tmp/dune-homeworld-actions-engine-final.log`.

The live browser used a new named QA room, `VQ6ALGRE`. Genuine setup preceded
a documented conserved dual-source phase position. UI actions shipped three
forces (one normal from Kaitain; one normal and one Sardaukar from Salusa),
then moved three normal forces from Kaitain to Salusa. The final position has
Kaitain 7 normal + 2 Sardaukar; Salusa 6 normal + 2 Sardaukar; Arrakeen three
forces including one Sardaukar; seventeen reserves and seven spice. Refresh
preserved it. Invalid source input disabled shipment, enlarged Kaitain opened
from the table, and 390×844 inspection found no horizontal overflow in the
world panels or inspector. Desktop card and phone movement screenshots were
visually reviewed; this is bounded sampling, not full module acceptance.

Forty live HTTP tests pass. Twenty ordinary **two-player Basic** games finish
3,079 accepted actions with no rejected candidates or stalls, using seed
20261026 and unchanged source fingerprints. This small regression sample is
not new strength calibration or Homeworld/full-player-count verification.
All 2,617 pre-existing room versions and hashes remain unchanged. The separate
QA room and thirty HTTP-test rooms were added. The development server remains
running from the 07:53 UTC controlled restart; no hourly restart was yet due
during this checkpoint. The removed automation stays removed.

## Remaining integration

Homeworld population values currently describe physical state; they do not yet
apply high/low advantages, charity/free-revival bonuses or occupation penalties.
Foreign Homeworld shipment permissions, Guild sponsorship, alliance rules,
occupation qualification/turnover, Homeworld combat and aftermath, explosions,
all card effects, occupation Collection, Ecaz victory and full AI policies
remain unfinished. Ordinary special arrival/return routes still need the
reserve integration audit, including Ambassador, Face Dance, No-Field and
card-specific destinations. Emperor transfer with Ornithopter is also pending.

Occupation history must remain distinct from population and current foreign
forces. Some turnover/expiry interpretations still need source resolution.
Do not infer a complete mode from a valid physical state or successful native
transfer. No release gate, saved-game migration or hosting access was changed.
