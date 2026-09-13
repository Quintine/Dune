# Suk Graduate rescue prototype

13 September 2026. **Prototyped / Partial**. This connects both Suk Graduate
bands to real battle resolution, player choices, AI and saved continuation.
Complete module, faction and publication gates remain closed.

## Source contract

Use the physical card and the [Leader Skills source archive](LEADER_SKILLS_RULES.md).
The [GF9 CHOAM & Richese rulebook](https://www.gf9games.com/dune/wp-content/uploads/2021/11/CHOAM-Rulebook-low-res.pdf)
page 9 governs visibility, survival and skill-before-faction ordering; its
page 12 Q&A gives a captor only the lower band of an actually used captive.
The [designer walkthrough at 11:10–11:59](https://www.youtube.com/watch?v=XT_azRVLq_0&t=670s)
expressly distinguishes the normal and selected-leader rescues and says they
do not accumulate. The archived card photograph supplies the precise quantities.

After an ordinary win with physical casualties, a face-up native Suk Graduate
returns exactly one chosen casualty to reserves instead of the Tanks. This band
is mandatory. When the actual skilled leader is used and survives, the player
may instead save zero through three casualties, limited by the raw casualties.
If any are saved, exactly one stays in the battle territory and the rest return
to reserves. Declining this lower band does not trigger the normal band.

A concealed skill with another selected leader grants neither band. A killed
selected skilled leader grants no rescue. A different selected leader may die
while the face-up native trainer remains alive and grants the normal rescue.
A traitor victory loses no winning forces; mutual traitors and explosions have
no winner. None creates a Suk rescue. The zero-dial case also creates no window.

## Physical settlement and continuation

The existing legal raw normal/elite casualty choices are retained. Choose that
allocation first; Suk then redirects only those actual counters. Paid support
is unchanged. Saved elites remain elites in reserves or on the board. The
normal band resolves automatically when only one counter type can be saved;
the lower band's optional choice remains with its owner.

The receipt freezes revealed eligibility before the live battle is cleared or
a used captive returns. It records the battle, raw commitment, source groups,
physical pool and remaining card cleanup. A separate obligation in the last
battle context prevents a missing receipt from silently bypassing rescue.
Actions, views and automatic continuation validate it. A stale event, altered
allocation, changed physical pool or missing choice rejects without mutation.
The server alone projects the legal rescue options; the receipt is not exposed.

The current engine assigns a raw casualty mix across sectors in existing
location order. A saved counter that remains stays in that original sector;
there is no free sector relocation. This is an explicit implementation inference:
the card specifies a territory, not how to select sectors. Saved counter types
and any eligible sector choice remain visible to the player.

Suk settles before winner card choices and faction aftermath, including capture
and Face Dance. Mandatory loser-card cleanup uses its existing continuation.
The exact ordering against future combined optional card interruptions still
needs integrated acceptance. Homeworld custody, Nexus and expansion-faction
combinations are explicitly rejected before resources or traitor votes commit;
the genuine Leader Skills initializer currently admits base factions only.

## Atreides loss-count question

The base Advanced rules activate Kwisatz Haderach after seven force losses.
Suk describes rescued counters as losses redirected away from the Tanks, and
the designer describes the retained counter as having been killed. Counting
the raw dialed casualties is therefore the stronger textual inference, but
the retrieved publisher/designer sources do not expressly settle this combination.
The user question is pending. New Advanced Atreides setup and revival offers
retain their physical cards but make Suk unavailable, explain why and allow the
other offered card. The server, private view, controls and bots share this
prototype restriction. Already-assigned saved combinations retain the battle
preflight guard before final traitor votes or resources commit. This availability
restriction is not an official rule. Other rescued counters are kept out of the
physical Tank and ordinary battle-loss totals in this bounded prototype.

## Evidence and remaining work

Focused regressions cover genuine module setup followed by conserved targeted
battles; both bands, no stacking, decline, killed leaders, captured-leader return,
normal/elite routing, unchanged support and all four bot profiles. JSON and
SQLite store restart retain the pending choice. Concurrent submissions commit
one rescue; the stale submission changes no counters. Component checks cover
clear destinations, required selection and disabled controls.

Fresh browser room `BD33WTTV` used genuine Emperor/Guild module setup and selected
Suk Graduate/Hasimir Fenring. A separately staged, conserved battle position used
one physical Baliset from the deck. Actual browser rescue saved three ordinary
casualties: one stayed in sector 10 and two returned to reserves. The result was
two board forces, seventeen reserves and one Tank. Refresh after another reported
outage retained that result, the private Crysknife/Baliset/Burseg and winner card
cleanup. This was a targeted battle, not a naturally reached full game.

Four-profile samples completed Basic seed 20260918 (92 actions, three JSON
restorations) and Advanced seed 20260919 (188 actions, six restorations), with no
rejected actions and conserved cards/forces after each action. Neither sample
encountered an eligible Suk rescue; effect evidence comes from the targeted
tests and browser journey. Checkpoint-wide results and final preservation are
recorded in the commit and source-bound private report.

These tests do not certify the full expansion, every combination,
AI strength ordering or complete human games. Seven other skill effects remain
missing; retain the [full scope and pending rulings](CURRENT_STATUS.md).
