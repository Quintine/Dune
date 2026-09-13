# Smuggler normal shipment prototype

13 September 2026. **Prototyped**, with **Partial** rules coverage. Public module
starts and publication remain gated. The lower battle effect and combined
expansion routes are unfinished.

## Source contract

The physical Smuggler card supplies one optional free accompanying force when
shipping from off planet into an empty territory. The selected total includes
that force: ship three actual counters, price two. At least one paid companion
is needed. Empty strongholds qualify; existing forces anywhere in the territory,
including friendly forces, advisors and No-Field presence, prevent the benefit.
Spice alone does not occupy a territory. Determine emptiness before arrival.
See the [publisher CHOAM & Richese rulebook](https://www.gf9games.com/dune/wp-content/uploads/2021/11/CHOAM-Rulebook-low-res.pdf),
pages 8–9 and 12, and the [designer walkthrough](https://www.youtube.com/watch?v=XT_azRVLq_0&t=724s),
12:04–12:19.

Apply ordinary Guild/ally rounding after removing the free counter from the
priced count. Classic Fremen reserves are on planet, so their ordinary Great
Flat reinforcements retain their existing rule. See the
[base rulebook](https://www.gf9games.com/dunegame/wp-content/uploads/Dune-Rulebook.pdf),
pages 9–11 and 13, and [November 2020 FAQ](https://www.gf9games.com/dune/wp-content/uploads/2020/11/Dune-FAQ-Nov-2020.pdf), page 5.

The CHOAM & Richese FAQ explicitly permits a Richese No-Field with a separate
free Smuggler force into empty territory. That valid combination still needs
concealed-counter integration here; its current guard is an implementation gap.
No new material user ruling was required for the ordinary reserve route.

## Connected behavior

A shared public-custody quote powers the engine, UI, bots and shipment-promise
completion search. Only a living native trainer grants the normal effect;
captured and foreign-ghola leaders do not. The selected amount remains the
actual reserve withdrawal and board arrival, including ordinary/elite identity.
The existing payment pipeline receives the actual discounted cost.

The checkbox starts selected when an eligible shipment is chosen. Declining
preserves the full payment, which can matter to recipients and other payment
powers. API omission and explicit false also retain ordinary pricing. All four
AI profiles have a legal path that explicitly chooses the bonus, including a
two-force shipment when only one force can be afforded at the ordinary rate.
This policy is not full skill strategy or difficulty calibration.

Advanced Guild interception stores the trainer, physical total and original
price before payment or departure. Views, automatic normalization and actions
validate the pending declaration against its unique current or saved Guild
decision. Missing/mismatched decisions, stale leaders, changed occupancy and
prices no longer explained by the saved discount record reject before mutation. Actual legacy unstamped
shipments retain their full price and may omit the older optional turn field.

## Verification and remaining scope

Focused tests cover total-versus-priced counts, desert costs, Guild rounding,
Fremen reinforcement, advisors, hidden/captured custody, opt-out, all four bots,
JSON recovery, malformed saved decisions, elite conservation, private SQLite
views, concurrent allowance, nested decision restoration, cancellation and stale replay. Independent review identified the
saved-decision binding gap, which was fixed before the checkpoint checks.

A fresh genuine two-seat setup assigned Smuggler to Hasimir Fenring in an
isolated browser room. A documented fixture advanced only that room to a clean
shipment boundary with two human spice. The browser checked ordinary cost three
and its disabled action, then enabled Smuggler and shipped three actual forces
for two spice. Refresh restored seventeen reserves, three Arrakeen forces,
zero Tanks, zero spice and the same private hand and traitor. This is a targeted
scenario, not a complete human game.

Two genuine four-profile Basic/Advanced samples completed with 99/212 actions,
3/6 JSON restorations and no rejected candidates. Neither sample used Smuggler;
these samples establish continuation only. Targeted tests and browser play
exercise the new effect. Required broad check/build/HTTP results and final
preservation totals are recorded in the checkpoint commit and private report.

Smuggler battle collection still needs its reveal/survival settlement. Combined
No-Field, Homeworld, Nexus, Discovery, Stronghold and technology routes remain
outside this prototype. Mentat questioning, Bureaucrat payments, Sandmaster
movement collection, Spice Banker and Diplomat also remain incomplete. Reuse
this ordinary route when integrating those dependencies.
