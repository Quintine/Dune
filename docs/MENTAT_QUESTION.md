# Mentat before Battle Plans

13 September 2026. This developer preview adds the normal Mentat question to
the existing lower-band strength bonus. It requires an explicit private preview
opt-in while the user decides whether to accept the uniform card-show step.
Ordinary Leader Skills starts do not activate it. Leader Skills and public mode
acceptance remain partial. [Common skill rules](LEADER_SKILLS_RULES.md) govern assignment,
capture, death and the right to conceal a skilled leader.

## Source contract

The physical card permits asking the battle opponent about one **specific named
weapon**, such as Crysknife or Poison Tooth. If held, the opponent must show that
card; otherwise they choose another Treachery Card to show. The card says “show
you”, which makes the answer private to the questioner, not a public reveal.
The [archived physical face](https://cdn.anyfinder.eu/assets/NQOmfvkJitFsQncGJ73kLzv7aC1w7Jp1kQAyy5CJ0pOoj8RlSEN3veAO6wBnw8wV?height=768)
and [designer Jack Reda's walkthrough, 17:37–18:16](https://www.youtube.com/watch?v=XT_azRVLq_0&t=1057s)
agree. The persistent source archive and provenance are listed in the common
skill contract; no inaccessible image text was reconstructed.

The question is optional, and an accepted question requires a truthful answer.
The shown card stays in the opponent's hand and need not appear in their plan.
The owner may ask first, then conceal the same Mentat for possible selection.
Skills precede faction powers: the printed example specifically puts Mentat
before Atreides Prescience. [GF9 CHOAM & Richese, pp. 9 and 12](https://www.gf9games.com/dune/wp-content/uploads/2021/11/CHOAM-Rulebook-low-res.pdf)

A named weapon uses its held/default category, not every role it could take in a
future Battle Plan. Weirding Way defaults to a weapon; Chemistry defaults to a
defense. Heroes, Worthless cards and unrelated Specials are not named weapons.
If the weapon is absent, the fallback may be any held Treachery Card.
[GF9 November FAQ, p. 5](https://www.gf9games.com/dune/wp-content/uploads/2020/11/Dune-FAQ-Nov-2020.pdf#page=5)

## Boundaries and continuation

Offer the question for a living, native face-up Mentat against its actual battle
opponent before skill posture and faction powers. A captured Mentat has only its
lower +2 bonus. Resolve the selected question and its compulsory disclosure as one
saved sequence, then restore the ordinary posture choice. Do not reopen older
battles that have already passed this boundary.

Use canonical weapon names without consulting the opponent's hidden hand to
construct the questioner's choices. After naming, show only the required matching
card, or let the opponent choose a fallback from their own hand. The public record
may identify the question and named weapon; it must never disclose the answer's
physical identity, fallback choices or an extra private hand snapshot.

The observation records what was shown at that time. Later play, transfers or a
leader's death do not turn it into current hand knowledge or require that card in
a plan. Retaining already learned information after death is a persistence
necessity, not a new skill benefit or an additional publisher ruling.

The sources give no fallback when the named weapon is absent and the opponent
has an empty hand. The prototype leaves asking unavailable with an explicit reason
and automatically skips that unavailable opportunity so battle can proceed.
It records no answer. This is an unfinished case, not a
printed ban. No new Karama counter to the skill or public disclosure is inferred.

The pending naming/disclosure sequence must retain exact decision ownership and
battle identity across JSON/SQLite restoration. Invalid, stale or competing
requests must not repeat an observation, change card custody, bypass posture or
start faction powers early. Optional hand-changing actions wait for this short
sequence to complete; that serialization is an explicit implementation boundary.
Every accepted question uses the same target-owned private card-show step,
including an exact match or a sole fallback. Automatically completing only some
answers would reveal held/absent information through different public stages.
Target controls alone receive the eligible physical cards; public decision shape,
logs and number of response steps stay the same across equal-size hands.

That uniform step is an exception to the user's preference to omit forced
confirmations. The user has been asked to approve it or leave the ability disabled
pending another design. No answer has been applied. Private QA can exercise the
reviewable preview; normal activation and any claim of approved UX remain pending.

## Preview evidence and remaining acceptance

Independent review and 22 focused tests cover the common question/answer sequence,
all four AI profiles, private projected controls, exact-match versus fallback
privacy, canonical weapon roles, captured lower-only behavior, saved ownership,
stale/duplicate rejection and competing SQLite writes. Ordinary Basic/Advanced
base and CHOAM skill games stay unactivated; actions cannot set the private flag.

Two complete base-faction samples use genuine Basic/Advanced skill setup, with a
controlled initial skill shuffle to include Mentat. They do not stage hands,
forces or phases. Basic completed 100 actions with three JSON restorations at
turn one; Advanced completed 507 actions with fourteen restorations at turn five.
Each produced one private observation and then reached Atreides Prescience;
neither rejected a candidate. All four profiles participated. These are targeted
preview paths with force/skill custody checks, not general card-custody coverage,
AI calibration or complete module certification.

An isolated browser QA room uses genuine skill setup followed by an explicitly
staged, conserved battle. Naming Lasgun led to the same target-owned private step,
then a Crysknife observation and the ordinary leader posture choice. The owning
seat restored its hand, resources, observation and pending posture after the
reported power failure. The observed card inspector was readable, and the leader
could move behind the shield after asking. Production SQLite tests separately
verify that the opponent and questioner alone retain the observation.

The checkpoint's source-bound broad results are recorded with its Git commit.
Normal activation still awaits the uniform-response UX answer; empty hands and
other module combinations remain unfinished. No mode or publication gate opens.
