# Truthtrance: Charity claim commitment

## Live Basic Charity — 27 October 2026

**Prototyped / Partial.** A Truthtrance holder may ask another player whether
that player will claim Charity **after the answer** in the currently open,
concurrent Basic Charity phase. The [GF9 November 2020 FAQ, page 8](https://www.gf9games.com/dune/wp-content/uploads/2020/11/Dune-FAQ-Nov-2020.pdf#page=8)
supports current-turn questions about a player's actions while they remain
possible; it does not provide a Charity-specific worked example. This precise
online binding and release procedure is a provisional interpretation.

The target's answer quote uses the native current claim entitlement and payer,
including the original faction, turn, claim status, funds and any resolved CHOAM
opening. Yes is offered when the native claim is possible now or the player
can make a quoted native ordinary payment to reach eligibility, provided no
earlier live No conflicts. No is available when no earlier live Yes conflicts.
The quote does not invent future funding or unverified preparations beyond the
supported payment route. A player cannot be asked again about a claim already
completed that turn. Unknown answers and conflicting independent action
families requiring a joint future-action planner remain partial.

A definite answer reopens that player's concurrent Basic Ready, if already
marked, without reopening a completed phase. The actual native Charity action
fulfills Yes and pays through the existing rules; Ready cannot voluntarily close
an attainable Yes. No forbids the native claim for the rest of the original
Charity phase, including if a later response reopens Ready. A voluntary action
cannot abandon an attainable Yes; after another player changes the target's
funds, an existing Yes remains binding if the supported ordinary-payment route
still makes the claim possible. A genuinely external change that removes every
supported opportunity releases it, while a No completes at phase close. Pending
responses are not treated as proof of impossibility. Ordinary eligibility,
inflation, payment and the original once-per-turn claim remain authoritative.

The respondent sees their available answers and persistent guidance; a live No
explains why the ordinary claim control is disabled, while an attainable Yes
provides an event- and turn-bound guide to the exact native claim or ordinary
bribe. The payer spends the bribe immediately and the recipient receives it at
Mentat Pause. AI uses the same target-only quote and legal action. Questions and
answers are public as in the existing
Truthtrance history; private receipts and target-only guide are not projected
to other seats. This is a usable first version, not full enforcement of all
Charity questions or a complete implementation of Truthtrance.

The native fixture `tests/fixture-truth-charity-commitment.ts` starts original
Basic classic factions with the selected Ix deck and original Truth cards,
uses genuine Amal and Charity chronology, and makes a real four-spice bribe to
leave the target at one spice. It does not install new wallets, cards, phase or
readiness. A separate external-income test uses a labeled, conserved controlled
transfer before real Ready, bribe and claim actions. Fourteen related files pass
187/187; type/lint and build pass. Server-rendered controls are exercised, but
that is not browser or deployed acceptance.

Questions earlier than the live phase, other preparation or later eligibility
forecasts, Advanced ordered Charity, broader overlapping promises,
optional-module and pending-response combinations, full games, browser and
deployed acceptance remain open. No independent joint planner is introduced.
