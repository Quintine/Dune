# CHOAM Charity funding

The [27 October Advanced player-order cutover](ADVANCED_CHARITY_ORDER.md)
now sequences fresh Advanced claims and Finish. Basic/old unstamped phases
retain concurrent timing. The funding calculations and provisional shortfall
policy below are unchanged; earlier evidence does not certify the new order.

## Source and selected prototype policy — 24 October 2026

Publisher E2 physical p7 says CHOAM collects two spice per faction before
Charity claims, then pays **other** factions' claims from its spice.
The base physical p8 poverty rule still applies to any faction with zero/one
spice. Composing those permissions, CHOAM's own eligible ordinary claim uses
the Spice Bank; debiting its own wallet would either make the claim ineffective
or reject it at zero. Eligibility and the once-per-turn stamp are unchanged.
[Official E2](https://www.gf9games.com/dune/wp-content/uploads/2021/11/CHOAM-Rulebook-low-res.pdf),
[official base rules](https://www.gf9games.com/dunegame/wp-content/uploads/Dune-Rulebook.pdf).

E2 p12 explicitly makes other claims bank-funded when CHOAM's opening advantage
is canceled. Targeted publisher/designer research found no corresponding
insolvency remedy after CHOAM legally spends or transfers its opening cash.
Indexed primary passages remained accessible; direct E2 and designer downloads
returned403. No community implementation or tournament rules settle this choice.
The self-claim composition above is separate from the following unresolved policy.

Under the user's 14 October choose-recommended instruction, the preview now
pays each full eligible claim, debits another faction's CHOAM wallet up to its
available cash, and supplies the ordinary shortfall from the Spice Bank.
This is an explicit **provisional deviation**, not a publisher-confirmed
insolvency rule. It avoids lost entitlements, negative wallets and a blocked
claim without retroactively prohibiting legal transfers or inventing a future
debt/repayment mechanism. It also lets voluntary transfers shift Charity costs
to the bank; that economic consequence remains a limitation pending a stronger
ruling. This prototype cannot certify full CHOAM or complete rules compliance.

Homeworld additions remain entirely bank-funded. Inflation changes the
entitlement first; it never changes the wealth threshold. A wealthy Advanced
Bene Gesserit claim retains its original Karama response before any payment;
cancellation spends the claim but pays nothing. Current canceled CHOAM income
and absent/older income receipts retain their existing bank behavior. No loan,
new persistent field, incoming-bribe acceleration, claim repetition or phase
advance is introduced. Production income remains tied to the original completed
qualifying claim, not to the CHOAM/bank split or opening income.

## Implementation and controls

`game/charity.ts` supplies the original entitlement, beneficiary-aware payer
and private funding quote. `payCharity` in `game/engine.ts` validates before
settlement, debits only the available ordinary contribution and awards the
original full amount exactly once. The bank remainder is implicit in the
existing unlimited-bank accounting; no foreign wallet becomes negative.
The public projection supplies only the existing nominal payer and entitlement,
never a wallet-dependent split. Homeworld logs use constant funding-policy
wording rather than exposing a private shortfall.

`components/charity-claim.tsx` is the actual table control. CHOAM sees normal
bank guidance for its own claim. Other beneficiaries see the same persistent
provisional funding explanation regardless of CHOAM's private balance. Busy,
pending income, completed claims, absent entitlement, Truthtrance and Nexus
Traitor interruption retain their button blocks. The existing minimal legal
bot Charity action uses this same server settlement; no strategy is refined.

## Verification and remaining work

Owner-frozen proof passes **9 affected offline files88/88**, types/lint/build, eight actual claim-control/gameplay/GameTable SSR journeys and eight existing-profile continuations (16 accepted proposals).
The public three-seat CHOAM/Atreides/Guild source uses real lobby readiness,
Basic or explicit Advanced-preview start, native Traitor setup and the first
native Storm/Spice/Charity chronology. Only original scalar shuffle order, three
unopened Treachery positions and two unopened ordinary Spice positions are
selected. Atreides keeps its original starting Karama, so passing the first
CHOAM income response is a genuine response rather than an installed receipt.

CHOAM starts with two and earns six from that opening. Actual Guild and CHOAM
bribes then leave zero/one spendable cash while their recipient's native deferred
receipt remains unspendable. The fixture stops before either claim: 24/27
source actions. No played phase, wallet, army, alliance, claim stamp or payment
receipt is assigned. The actual new controls submit self or other claims with
zero/partial funding, refuse while busy/already claimed and preserve original
pieces/cards/bribes. Each source continues through actual readiness and market
controls into Bidding. Eight existing-profile paths accept two legal Charity
proposals each without strategy/calibration.

The nine-file union also covers existing BG cancellation, Inflation, Homeworld
portions, Production and Semuta return around Charity. First feedback passes
87/88: an old Homeworld test still expects zero-funding rejection. Its updated
case preserves ordinary eligibility rejection and checks full entitlement,
CHOAM debit at cash0/1/4, unchanged source and no duplicate claim. Focused
feedback passes; the next union passes88/88 and type checking, with one const
lint repair. The final frozen batch passes every step. Bounded source and
integration review found no concrete blocker; this is not comprehensive review.

Private artifacts are in
`/home/quintine/.local/share/dune/checkpoints/20261024-choam-charity-funding/`,
including `frozen-integrated-3/report.json`, `runtime-smoke.json`, HTML and
`feedback.json`. Verified base `52832dc0fd8b07e5e25c88245d427a500c4523ba`, tree
`73141dec573c215ec5e05aff208107783d65f16e99bedb480c1f10d28ef5bef7`
(2692 nonignored files, identical before/after checks).
Only checkpoint prose, reference strings and evidence paths follow proof; delivery
records that reviewed overlay and pushed revision. The user PDF stays untracked.

Framework aliases/CSS stubs mean actual callback/gameplay/SSR evidence, not
browser visual or deployed acceptance. Full modes, all rule combinations,
comprehensive rules/recovery/privacy/custody assurance and final deployed
acceptance remain unfinished. No server, saved-room/D1/reset/restart or deployment
operation occurs here. The provisional residual is still an unresolved tabletop
interpretation, even though its selected preview behavior is usable.
