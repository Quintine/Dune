# Revival deployment integration audit

Historical integration audit, retained as the pre-implementation hazard map.
Statements below describing proposed hooks or missing controls reflect that
earlier audit, not the current runtime. As of 10 September 2026, source-specific
normal, Emperor-extra and Ghola settlement hooks create `homeworldRevivalReturn`;
the engine connects its owned placement decision, typed custody transfer,
Ambassador continuation and held revival-income response. Dedicated destination,
return-receipt and projected-choice modules now exist, with focused engine and
production SQLite coverage.

Use [the runtime checkpoint](HOMEWORLD_REVIVAL_DEPLOYMENT_RUNTIME.md) for current
behavior and verification limits, and [the source contract](HOMEWORLD_REVIVAL_DEPLOYMENT_RULES.md)
for the unresolved threshold, quantity and arrival classifications. This
historical document does not select those interpretations or lift the full
Homeworld/expansion release gates.
Related contracts are [Homeworld benefits](HOMEWORLD_BENEFITS_RULES.md),
[Homeworld replacement](HOMEWORLD_REPLACEMENT_RULES.md),
[occupation integration](HOMEWORLD_OCCUPATION_INTEGRATION.md), and
[Collection/Terror integration](HOMEWORLD_COLLECTION_INTEGRATION.md).

## Concrete integration hazards

1. `engine.ts::addRevivedReserves` is a physical destination adapter shared by
   normal revival, Ghola and Emperor special Karama. Adding the ability there
   would lose the distinction between ordinary Free Revival, a free card effect
   and a paid return. The effect needs a producer-supplied source receipt.
2. `PendingRevival` saves total `amount`, total `elite`, scalar `free`, price and
   ordered checks. It does not save a generally usable typed free group.
   `action.freeElite` is currently meaningful only for Ixian pricing; that split
   is recoverable from the frozen normal price. Do not infer every free elite
   allocation from cost zero, or deploy all revived forces when only some were
   Free-Revived. Native Tleilaxu has no special counters, simplifying its own
   group, but the shared contract still needs explicit types.
3. Once returned counters merge into reserves, counts alone cannot distinguish
   the new eligible batch from previously held reserves. A bounded, protected
   typed group must survive until placement or decline; a second independent
   revival must not append to the earlier permission or substitute its pieces.
4. Normal revival and Ghola both create income continuations. Installing a new
   `decision` before those existing controls are saved can overwrite the income
   response or let the original parent continue before the placement finishes.
5. Ghola's `ordinaryCardDiscard` integrity explicitly rejects a suspended
   decision. Simply opening a placement inside `applyGholaEffect` makes its
   normal card-disposal continuation invalid. Any supported Ghola trigger needs
   a deliberately extended continuation, including market-sale Ghola's parent.
6. Ordinary Homeworld shipment has phase, cost, source and own-world permission
   rules. Reusing `quoteHomeworldShipment` or its engine dispatcher directly
   would consume a shipment, apply a price, or reject a separately authorized
   native destination. Reuse custody and destination validation, not that action.
7. Arrival may trigger Intrusion, Terror or an Ambassador only if the verified
   rule classifies this deployment as a qualifying entry. A new phase-four
   placement is not automatically an ordinary phase-five shipment. Conversely,
   skipping the existing arrival pipeline without checking that classification
   could omit a required reaction.

## Actual force-return producers

| Producer | Original source evidence | Current settlement |
| --- | --- | --- |
| Normal `revive` action | `forceRevivalQuote`, selected total/elite, scalar free, costs and ordered checks | `beginRevival` → CHOAM free-revival opportunity → Tleilaxu stop/checks → `finishRevival` |
| Emperor-funded extra ally revival | `PendingRevival.emperorExtra`, distinct payer, free zero and full frozen price | Same `finishRevival`; increments `emperorExtra` rather than normal revival usage |
| Ghola force branch | Physical owned card, selected total/elite, separate card timing and per-turn special-counter limit | `applyGholaEffect` returns forces, then Axlotl/Tleilaxu income and physical card disposal |
| Emperor special Karama force branch | Prepared `emperorForces` intent, original turn/phase/card, total/elite | `executeSpecialKaramaIntent` returns forces, marks special usage and consumes the card |
| Leader/Kwisatz/foreign-ghola/Duke revival | Explicit leader identity and its own cycle/custody authority | Does not produce a force group; must not create a deployment receipt |
| Ixian substitution or Face Dancer replacement | Their own already-committed battle/replacement receipt | Not a generic revival event merely because counters leave Tanks or reserves |

`addRevivedReserves` calls `quoteNativeRevivalDeposit` when Homeworlds are active.
This deposits normal Emperor counters on Kaitain and Sardaukar on Salusa;
other factions deposit on their native primary world. It does not authorize
revival, price it or inspect Tanks. Retain that separation. Existing withdrawal
uses `quoteNativeReserveWithdrawal`, which enforces exact normal/elite sources
and cannot consume visitor forces or guess an ambiguous Emperor allocation.

Do not silently broaden Southern Hemisphere to every listed return producer.
The source audit must decide normal paid revival, Ghola, Basic starred counters,
and any exceptional replacement cases from the actual wording. High Tleilax
specifically requires identifying the qualifying Free-Revived group; paying
zero for some other effect is not adequate source evidence.

## Normal revival sequencing

The declaration quotes the current free rate and selected group before changing
population. `beginRevival` allows CHOAM's reactive La La La before offering
Tleilaxu's special stop and ordinary advantage checks. A successful La La La
clears the request without payment or force movement; its cancellation resumes
the same original request. `quoteRevivalCancellation` and `quoteRevivalResume`
preserve the frozen request rather than silently reprice an accepted batch.

`finishRevival` is the first normal producer hook that proves the force return
actually succeeded. Unfunded and Fremen-limit outcomes must produce no deployment
permission. Successful settlement debits the correct payer, deposits the exact
typed group, removes it from Tanks, updates normal or Emperor-extra allowances,
and handles Axlotl income. It then clears `pendingRevival`, records ordinary free
income use and installs the quoted `revivalIncome` response.

Capture a completed return receipt at that settlement boundary. Do not leave
`pendingRevival` live after counters have moved: its resume validation expects
the original unreturned group and accepted free allocation. Preserve the native
eligibility observation required by the source audit separately from the
resulting population. In particular, a return can cross Southern Hemisphere's
three-counter or Tleilax's nine-counter minimum, and a later deployment can
cross back. These are distinct observations, not a reason to recalculate the
accepted price or grant another bonus.

Keep Tleilax's existing low-income observation at the start of Revival separate
from its high deployment eligibility. `homeworldRevival` owns that phase-start
condition; ordinary free-income once-per-player history uses
`revivalFreeIncome`. Neither is a record of which returned counters can deploy.
The deployment must not create another Axlotl or Tleilaxu revival payment.

## Ghola and nested controls

`applyGholaEffect` has explicit leader and force branches. Its force branch
returns at most five physical counters, updates elite usage, and leaves normal
revival allowance untouched. `collectRevivalIncome(..., ghola=true)` creates the
separate Ghola bank reward; it is not ordinary Free Revival income.

`stageOrdinaryCardDiscard` captures the current controls, clears them and binds
the completed effect through `ordinaryDiscardSignature`. That signature includes
Homeworld custody, revival income history, force/Tanks/resource totals and the
saved response. The current validator admits only the expected Tleilaxu income
response after Ghola and no suspended decision. `finishTreacheryDiscard` restores
those controls after the physical card retires.

The scoped `pendingChoamMarketGhola` additionally preserves the original CHOAM
sale through discard → income → complete, then `resumeMarketGhola` restores the
sale. If Southern Hemisphere also applies to a Ghola return, its deployment
must remain inside this original parent, without replaying the card, revival,
income or sale. Add an explicit source-linked child stage; never mark the market
interruption complete merely because no income response exists while a placement
still waits. Ghola played in battle also needs the original battle controls and
population-sensitive support limits preserved.

Richese gifts/purchases, Nullentropy, Truthtrance, Worthless-as-Karama and generic
response suspensions retain their original controls while source state remains
live. Include a new placement obligation in their integrity fences where it can
legally coexist. Do not restore a whole old Game snapshot over newly settled
resources. Existing Duke revival remains leader-only with its own source/custody
gates; no force-deployment decision should change Duke controller or cycle.

## Proposed shared contract

Use a focused pure module with a public physical context and an explicit
completed-return receipt. A possible receipt shape is:

```ts
type RevivalReturnReceipt = {
  event: string;
  turn: number;
  phase: number;
  owner: string;
  source: 'normal' | 'emperorExtra' | 'ghola' | 'emperorKarama';
  returned: { normal: number; elite: number };
  free: { normal: number; elite: number };
  paid: { normal: number; elite: number };
  card?: string;
  nativeSources: Record<string, { normal: number; elite: number }>;
  // Exact eligible subset and eligibility observation are fixed by source rules.
};
```

This is a proposed shape, not a decision that every source activates either
Homeworld. Require `free + paid = returned` for normal classified groups; a
card-effect source must retain its own classification rather than automatically
calling all zero-cost pieces Free-Revived. If card effects need a third category,
model it explicitly. Bind the original eligible subset and producing event in
an immutable consistency receipt, with an independent outstanding obligation so
deleting the pending choice cannot silently erase or duplicate it.

A pure destination quote should accept that receipt, actor and a discriminated
choice (`decline` or one explicit destination). Return exact custody transfers
and arrival facts; do not mutate counters, spend another allowance, mint income
or select opponent secrets. Source verification decides whether a subset may
deploy or the entire eligible group must move together. Never offer more than
the receipt's eligible types, even if reserves contain many other counters.

The optional decision needs an independent event and stage, with the original
income/card/outer continuation retained. Serialize stages such as awaiting
selection, committed arrival and completed; exact order follows the source
audit. Once physical departure and arrival commit, resume only the reaction
suffix. Decline consumes the optional placement opportunity while keeping the
already revived counters at their recorded native location.

## Destination validation and entry

For an Arrakis destination, reuse `allowedEntry`'s sector/storm/occupancy checks
where the printed route requires them, but do not automatically grant Fremen's
ordinary storm-shipment exception or enforce its Great Flat reinforcement range.
Those belong to the ordinary shipment source. Southern Hemisphere's destination
presence prerequisite should read the verified native physical presence, not a
foreign player's forces or hypothetical future placement. Exact advisor, mobile
stronghold and Homeworld scope remains a source question.

For a Homeworld, use explicit `homeworld:*` identity and
`quoteHomeworldCustody` transfers, respecting the verified ally/native destination
rules. Homeworld locations are not Arrakis sectors and must not pass through
`place`, `territory` or a fabricated sector zero. Do not turn free deployment
into a Guild tariff, paid shipment, ordinary shipment promise or Heighliner event
without a rule establishing that trigger.

If this arrival qualifies for reactions, extend `openTerritoryEntry`, Intrusion,
Terror/Ambassador continuation identity and `terror-entry-receipt.ts` with the
new explicit cause and resume contract. Terror's original count must be exactly
the deployed batch, not all destination occupants. Low Grumman's three-force
rule and all preflight checks must use that same count. Existing simultaneous
arrival ordering gates remain until the new composition is verified. Off-planet
deployment must likewise call the eventual occupation lifecycle at its actual
physical event, without inventing an Arrakis reaction.

## UI, bots and recovery hooks

`GameView.revival.pending` currently means only `pendingRevival`; it cannot stand
in for the new optional decision. Add a source-labelled owner-only descriptor
with event, exact eligible types, currently legal destinations and decline.
Observers need the public pending owner and committed result, not the owner's
card or undisclosed choices. Reuse the destination quote for UI and bots.

Normal revival controls in `components/game-table.tsx` select total, elites and
Ixian free elites. Ghola controls use `GameView.ghola`; neither currently selects
a later deployment. Add a separate decision component rather than reusing the
ordinary shipment form. All four bot levels need a legal destination or explicit
decline. `standaloneGholaAction` already avoids pending decisions; preserve that
behavior and prevent a new revival from replacing an outstanding group.

Integrate obligation validation with pre-action/view/normalization integrity and
`finishActionContinuations`. Automatic progression must wait for a real choice;
`automaticContinuationPending` should represent only an automatic stage. Test
JSON plus SQL competing workers so an accepted uncertain response cannot repeat
the revival, deployment, income or optional decline.

Minimum regression matrix: pre/post threshold crossing; mixed free/paid return;
new versus previously held reserves; exact Fedaykin identity; module off and
Basic/Advanced physical counters; La La La allowed/canceled and revival denied;
Tleilax income allowed/canceled; Ghola card disposal and market/battle parents if
supported; destination storm/occupancy and actual arrival reactions; deleted or
altered original receipt; all four bots; private getter and observer equivalence.

Only this document changed in the audit. Local links and current code symbols
were reviewed; no tests or runtime behavior were changed.
