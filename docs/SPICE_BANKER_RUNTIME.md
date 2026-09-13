# Spice Banker battle commitment prototype

13 September 2026. **Prototyped**, with **Partial** rules coverage. This connects
the lower battle band. The normal income band and combined-module acceptance
remain unfinished; public mode starts and publication stay gated.

## Source and payment contract

The physical card permits spending one through three own spice with the Battle
Plan to add the same amount to the selected leader's strength, independently of
force support. A captured skilled leader can supply this battle band with the
captor's spice. The common skill rules remove the bonus if that leader dies.
See [GF9 CHOAM & Richese rules and Q&A](https://www.gf9games.com/dune/wp-content/uploads/2021/11/CHOAM-Rulebook-low-res.pdf),
pages 8–9 and 12, and [Jack Reda's walkthrough](https://www.youtube.com/watch?v=XT_azRVLq_0&t=1029s),
17:09–17:37. The existing physical card image and sourced full paraphrase are
retained; this creates no new card, resource or leader identity.

The [core rulebook](https://www.gf9games.com/dunegame/wp-content/uploads/Dune-Rulebook.pdf)
provides the payment precedence in its Traitor and Advanced Combat sections:
a sole successful traitor caller loses nothing; otherwise committed Battle Plan
spice goes to the Bank on either outcome. The prototype therefore spends Banker
spice even on leader death or traitor loss, and waives it for a sole traitor-call
winner. Death removes the strength bonus, not the already chosen plan cost.
This is an explicit composition of the card and core payment rules, not a
separately located Banker death FAQ. It supersedes the earlier private research
suggestion that death should release the commitment. Printed disc strength,
Zoal's copied value and leader bounty are unchanged.

The normal band is mandatory once per phase when another player makes one
payment of at least four spice to the Bank; multiple smaller payments do not
combine. Revival qualifies. Earned spice waits in front of the shield until
Mentat Pause. Neither publisher nor designer material located in the renewed
search settles custody of that accumulated income if the trainer dies or is
captured first. The user has been asked whether to retain the pending boundary
or rule that already-earned spice stays with the original faction. No answer
or income implementation is assumed here.

## Connected behavior

`bankerSpice` is an optional sealed-plan amount; absence or zero declines.
The engine validates an actual living controlled skilled disc, its battle
posture, integer range and own funds remaining after force support. Ally aid
and Stronghold support cannot fund this separate commitment. Saved plans reserve
the amount against bribes and other spending. The same checks run before views,
automatic normalization and actions. Legacy plans retain zero Banker spending.

The battle quote computes a separate payment alongside the existing support
settlement and a surviving-leader score bonus. It does not add Banker spice to
CHOAM's force-support share. Payment and resolution commit atomically through
the existing versioned room write, with an automatic explanatory history entry.

The battle panel distinguishes support and Banker amounts and shows the combined
own commitment. The owner and authorized full-plan inspector can see the sealed
amount; rivals see it only when both plans are public. All four AI profiles use
the public skill and private own budget to submit funded plans. This is legal
prototype behavior, not calibrated Banker strategy.

## Evidence and remaining scope

Focused engine checks cover one through three spice, win/loss, death, traitor
win/loss/mutual calls, captured-leader funds, printed values, own-support funding,
private views, malformed saved fields, JSON restoration and all four profiles.
SQLite checks cover reserved-spice diversion, private restart, concurrent final
resolution, exact waiver/bounty and legacy absence. Controls and inspector
checks retain the private/public boundary. Independent rules, persistence and
UI review cover this supported boundary.

Two genuine four-profile Basic/Advanced samples completed with 99/212 actions,
3/6 JSON restorations and no rejected candidates. Their first seat explicitly
selected its offered Banker, but neither game used Banker spending. These are
continuation samples; the targeted tests establish the effect. A fresh browser room
assigned Banker through genuine setup, followed by a conserved staged battle.
The player selected Hasimir Fenring, Baliset, four dialed forces and three Banker
spice. Pending refresh restored that commitment with five spice still held.
Settlement paid three, added three strength and left one Arrakeen force,
fifteen reserves, four Tanks and two spice. Another refresh retained those
values and the same private Crysknife, Baliset and Burseg while card cleanup
awaited the player. This targeted scenario is not a complete human game.
Required broad results are recorded with the checkpoint.

Remaining work includes normal income, all economic trigger routes and ordering,
its public deferred custody, combined modules, wider full-game interaction and
strategy refinement. The existing development gates remain unchanged.
