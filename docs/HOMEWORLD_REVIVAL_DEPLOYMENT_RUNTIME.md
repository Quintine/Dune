# Homeworld revival deployment runtime

Development checkpoint, 10 September 2026. High Southern Hemisphere and high
Tleilax have bounded runtime support. Full Homeworld, Advanced and unfinished
expansion starts remain gated. See the [source contract](HOMEWORLD_REVIVAL_DEPLOYMENT_RULES.md)
for printed evidence and unresolved interpretations; the [integration audit](HOMEWORLD_REVIVAL_DEPLOYMENT_INTEGRATION.md)
is the historical implementation hazard map.

Subsequent Caladan integration adds a shared Ambassador arrival validator and a
separate stage record for newly created revival returns. New original signatures
include a version field and require matching independent progress through
waiting, choice, arrival and completion. Removing that record or editing an
arrival back into a choice rejects even when older reserve forces remain
available. Removing the version field does not preserve the original signature.
Unversioned legacy records retain their previous signature format and explicit
compatibility; this does not retroactively prove their stage history. No stored
room migration is needed. The subsequent
[Caladan checkpoint](HOMEWORLD_VICTORY_REINFORCEMENT_RUNTIME.md) and implementation
status record the combined verification.

## Supported return and placement

Southern selects only the newly revived physical Fedaykin from a successful
ordinary revival, Emperor-funded extra revival or Ghola force return. Basic
preserves starred identity; Advanced retains its shared one-star-per-turn
revival limit. Tleilax selects only the actual ordinary Free Revival portion,
excluding paid counters returned beside it and separately sourced Ghola returns.
Leaders, substitutions and surviving forces returned to reserves create no
deployment permission.

The supported threshold case begins high: at least three native Fremen or nine
native Tleilaxu forces before the return. The original price remains the normal
revival quote. A return that first restores high population is blocked before
cost or force movement while its timing ruling is pending.

The owner may place the whole eligible group in one permitted destination or
leave it in reserves. Southern requires existing Fremen territorial presence;
Homeworlds are excluded. Tleilax permits a territory or Homeworld, including its
own world as a custody-preserving choice, but excludes an allied Homeworld.
There is no second revival, fee, income trigger or ordinary shipment/movement
allowance use. Old reserves cannot enlarge the eligible group. Partial
deployment and splitting among destinations are not enabled.

`homeworld-revival-deployment.ts` validates the source and completed typed
deposit. `homeworld-revival-destinations.ts` supplies current destination and
custody quotes. `homeworld-revival-return.ts` binds the original event, group,
population observations, source/card and retained response. The engine opens an
owned `homeworldRevivalDeployment` decision only after the original return and
required card disposal finish. A new revival cannot replace that outstanding
group.

## Reactions and retained continuations

Ordinary occupancy and sector restrictions remain active. Tleilax cannot enter
storm. Southern storm placement and Hidden Mobile Stronghold entry remain
explicit ruling boundaries; the mobile stronghold uses its actual pointer
sector for storm checks.

An otherwise relevant BG Intrusion or Terror reaction blocks that destination
pending deployment classification. Terror relevance uses the exact arriving
physical count, current low Grumman restriction and public token placement;
it does not read a secret token face. Tleilax arrival onto Arrakis also remains
blocked if BG has reserves and a currently permitted Spiritual Advisor. That
gate does not apply to Homeworld destinations or Southern's on-planet origin.
Concealed No-Field occupancy uses the public marker without its denomination.

Supported Ambassador entry passes through the existing arrival pipeline with a
bound revival event and recorded secondary-entry ancestry. The revival-income
response stays inside the frame until placement and its Ambassador children
finish. The original response then resumes once. Ghola's card disposal and any
CHOAM-market parent remain separate obligations; an unfinished placement cannot
be treated as a completed market interruption.

Independent review found two saved-arrival defects: edited offer identities
could bypass the later effect-specific checks, and deleting a live Ambassador
could prematurely restore income. Offer validation now checks the original
arrival, and each recorded child has a signed completion flag set by the actual
Ambassador settlement. Missing unfinished children reject during reads, actions
and automatic normalization. An actual phase-four Guild shipment, BG
accompaniment and secondary Fremen relocation completes across JSON restores
before the original Tleilax income resumes. The CHOAM-sale regression separately
proves Ghola disposal, placement, income and original sale restoration in order.

Direct cancellation of the Homeworld deployment is not offered. Independently
cancelable revival income and underlying ordinary powers keep their own source
rules. The existing special-Tleilaxu-Karama overlap remains a separate gate.

## Persistence and presentation

Waiting, choice, arrival and complete stages distinguish actual physical work
from an outstanding decision. Independent signatures bind the original return,
saved income response and arrival ancestry. View, action and automatic
normalization reject inconsistent present records. Completion is evidence,
never a command to revive, discard or pay again. No recovery reconstructs a
missing original grant from current reserves.

The projected offer exposes its public owner and eligible count; destinations
belong to the acting seat, and the private Ghola card identity is omitted.
`homeworld-revival-deployment-options.ts` and the dedicated component consume
that offer. All four bot profiles use the same destination and source-specific
threshold guards as the player controls. Group quantities cannot enlarge the
original permission or select previously held reserves.

Browser QA room `463GUCY3` completed normal revival of two counters, placed its
single newly revived Fedaykin in Arrakeen, then played Ghola for another Fedaykin
and left that group in reserves. Both owned choices survived refresh; actual
keyboard submission, three saved seats and private-hand boundaries passed.
Desktop 1440×1000 and phone 390×844 screenshots were inspected, with readable
controls, no horizontal overflow and no page errors. Evidence is retained in
`/tmp/dune-revival-desktop.png`, `/tmp/dune-revival-phone.png` and the isolated QA
scripts. This does not certify complete Homeworld games.

The controlled hourly restart at 14:39 UTC preserved all 3,050 saved room
versions and state hashes. The three QA seats reconnected to version 7 with
the same forces, Tanks, private hands and completed Ghola disposal. The backup
and exact baseline are in `/tmp/dune-maintenance-20260909T1439/`. The removed
recurring automation remains absent.

## Verified scope and remaining gates

Nine destination regressions and seven production SQLite cases pass through the
standard focused runner. Focused lint passes for those test files. Destination
coverage includes exact typed withdrawal, own/foreign Homeworld custody, allied
exclusion, storm and mobile-sector checks, relevant reactions, and throwing
private-field getters.

SQLite tests run the production room module, authentication and SQL. They cover
competing placement requests with one successful CAS, uncertain responses,
module reload and seat refresh, Ghola decline, one-time held income, corrupted
original/resume/completed-arrival records, unchanged unrelated rooms and private
hand boundaries. Two additional cases restore the actual live BG Ambassador
child, race the final Fremen relocation with one successful write, and verify
that held income settles once. Missing children, changed ancestry/completion
flags and premature parent completion reject without changing persisted state.
The shared engine suites cover ordinary and Emperor-extra returns, physical
Ghola disposal, the suspended CHOAM sale, Advanced limits, typed free subsets,
all-profile legal choices and public/private projection.

Final `npm run check` passes types, lint and all **3,634 offline cases** with no
failures or skips (88.4 seconds for the offline suite). Production build, all
**40 HTTP checks** and the browser acceptance above pass. Logs are
`/tmp/dune-revival-complete-check.log`, `/tmp/dune-revival-final-build.log` and
`/tmp/dune-revival-final-http.log`.

The full suite also exposed an intermittent older auction-test assumption:
buying a Karama creates a second eligible Emperor-income responder. The fixture
now deliberately buys that card, verifies the continued response, and counts
the retained current-lot reference separately from physical card custody. The
production auction behavior was unchanged. Earlier Tleilax income tests now
exercise a non-crossing return and explicitly stage their later high-population
position, while verifying that unsupported crossing requests make no writes.

Threshold restoration, arbitrary partial
groups, multiple Southern destinations, storm permission, reaction/Hidden
Mobile Stronghold classification, occupation lifecycle and the earlier Ix bonus
questions remain explicit boundaries. Passing these subsystem tests does not
certify complete games or release any expansion.
