# Leader Skill battle effects

13 September 2026. **Prototyped, with Partial rules coverage.** This follow-up
connects both Rihani Decipherer bands and the lower battle bands of Mentat,
Bureaucrat and Sandmaster. Normal Mentat questioning, Bureaucrat payments and
Sandmaster movement collection remain missing, as do Spice Banker, Diplomat and
Smuggler. Public module starts and publication remain gated.

## Source contract

The [GF9 CHOAM & Richese rulebook, page 9](https://www.gf9games.com/dune/wp-content/uploads/2021/11/CHOAM-Rulebook-low-res.pdf)
provides the common skill procedure. The printed cards and publisher designer
walkthrough supply the individual effects; see the [component inventory](LEADER_SKILLS_RULES.md).

- [Mentat, 17:37](https://www.youtube.com/watch?v=XT_azRVLq_0&t=1057s): the
  surviving selected skilled disc gains two battle strength. Its printed value,
  bounty and Zoal source value stay unchanged.
- [Bureaucrat, 15:01](https://www.youtube.com/watch?v=XT_azRVLq_0&t=901s): the
  surviving selected skilled disc subtracts one from its opponent's total per
  distinct stronghold that opponent occupies. Contested and storm-covered
  occupation count; advisors and virtual victory control do not. There is no
  implicit zero clamp. The shared board helper recognizes HMS and Jacurutu,
  though combined-module play remains gated.
- [Sandmaster, 15:48](https://www.youtube.com/watch?v=XT_azRVLq_0&t=948s): a
  surviving skilled winner adds three board spice to an existing pile in the
  battle territory automatically. This grants no direct income and does not
  require surviving forces. No pile means no addition. Multiple positive piles
  are guarded before the final battle vote pending a sector-placement ruling.
- [Rihani, 12:49](https://www.youtube.com/watch?v=XT_azRVLq_0&t=769s): a face-up
  native trainer grants the normal private inspection after a victory using
  another leader. A surviving selected native skilled winner receives both
  bands. A surviving captured skilled winner receives only the lower band.

Rihani first privately inspects two random physical Traitor Deck cards and
reshuffles them. It then offers the separate optional two-card draw. Choosing
to draw commits the player to keep one newly drawn card, publicly reveal and
return one unused old card, and secretly return the unkept new card. Those two
returns are shuffled into the actual deck. There is no post-draw decline or
return-both-new alternative. The two samples can contain the same identity.

**Ordering inference:** normal-before-lower follows the printed order and
designer narration; no explicit priority sentence was found. **Unused** means
not actually called, rather than merely known or publicly disclosed. Returning
an old card announces its name without adding it to the actual-use register.
A Traitor Card used to win this battle is already excluded from the exchange.
No eligible old card means no optional draw. There is no partial draw fallback
when fewer than two physical deck cards are available.

The [Ixian/Tleilaxu rules](https://www.gf9games.com/dunegame/wp-content/uploads/2020/09/IxianAndTleilaxuRulebook.pdf)
place skill resolution before faction capture and Face Dance. Tleilaxu Rihani
must instead exchange an unrevealed Face Dancer. That combination, foreign
gholas and the skill lifecycle after non-kill Face Dance remain unimplemented.
The connected entry supports base factions in Basic/Advanced with Leader Skills
alone. These boundaries are implementation limits, not prohibitions in the game.

## Connected behavior and checks

Shared battle quotes calculate score changes; bots use the same public
stronghold count. Sandmaster resolves automatically. Rihani offers owned
draw/decline controls, then separate inspectable keep-new and reveal-old
selections. All four AI profiles use only their permitted view. Only the owner
receives inspection history and drawn identities. The public log names the
returned old card, never the kept or unkept new identity.

Physical snapshots, an event-bound obligation and saved stages preserve Rihani
through casualties, winner cleanup and captive return. Independent review found
that completed receipts were not bound to custody during cleanup; this now
rejects changed deck order after either decline or exchange. JSON and SQLite
restart tests cover both choices, concurrent writes, stale replays, normal versus
captured eligibility, actual-use exclusion and native Suk rescue preceding a
captured Rihani exchange. Focused checks also cover score-boundary winners,
dead/bluffed skills, Sandmaster without surviving forces and UI privacy.

Fresh browser room `HNGSR8GB` used genuine module setup, then a separately
staged conserved battle. The human inspected two private cards, drew two
separate cards, refreshed the pending exchange and selected a keep and public
return. Completion and refresh restored the kept Traitor and winner card cleanup.
This is targeted browser evidence, not a naturally reached complete game.
Two genuine four-profile Basic/Advanced samples completed in 92/188 actions,
with 3/6 JSON continuations and no rejected candidates; neither reached a Rihani
effect. They establish sample continuation, not comprehensive skill acceptance.

The running server responded after the reported outage. A fresh online backup
captured all 393 opening rooms. No restart or reset was needed. Required broad
checks and final saved-game preservation are recorded in the checkpoint commit
and private source-bound report.
