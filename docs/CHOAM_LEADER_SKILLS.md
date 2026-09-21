# Basic CHOAM with Leader Skills

Development integration, 21 September 2026. Genuine CHOAM/Skills setup already
existed. This follow-up connects the ordinary skill action paths for Basic CHOAM
with base opponents and checks native card sales and revival interruptions.
It does not certify the full expansion or open public starts/publication.

## Configuration and components

The shared ordinary-skill profile requires Basic rules, exactly CHOAM & Richese,
two through six players including CHOAM, and no other optional modules. Other
seats belong to the six base factions. The existing initializer's wider Richese
and Advanced development admission is retained; those action combinations keep
their separate implementation boundaries.

Setup keeps all fourteen physical skill cards and the real 35-card Treachery
deck: the base cards plus Poison Tooth and Artillery. Neither added battle card
is a green Special for Planetologist. CHOAM has its five ordinary Basic leaders;
Auditor is an additional Advanced disc and never an eligible skill assignment.
Starting cards precede private skill choices, public assignments and Traitors.

## Connected paths

The shared profile now admits ordinary Planetologist, Sandmaster, Smuggler,
Suk Graduate, Rihani, Diplomat copying and the existing Banker battle-spending
path. Existing missing bands stay explicit. Common rule helpers still supply
human controls and minimal legal AI choices; no strategy tuning is performed.

CHOAM's native Worthless-card sales and powers retain their physical card
ownership and response windows. A card committed to a sale cannot also be spent
as a skill substitute. Planetologist uses a qualifying Special solely in its
battle role, without executing its native effect, then discards it through
mandatory winner cleanup. CHOAM cannot sell that already discarded card.

Bureaucrat's existing qualifying third-party auction, shipment and bribe
payments remain available. The skill does not redirect its own owner's payments
or turn a small bank-funded market sale into a qualifying player-to-player
payment. Existing Richese-sale support is preserved.

A real own-leader death returns its skill once. Ghola may revive that leader
while a declared CHOAM sale waits; the revived leader receives the normal
optional replacement offer. The Ghola discard, private draw/decline and any
required skill selection must finish before the exact original sale resumes.
The sale's card, quoted amount, response passes and physical ownership remain
bound throughout. Revival is free; canceling the resumed sale does not undo
the completed revival or duplicate its spent Ghola.

New skill-enabled interruptions also bind the actual revived leader and private
offer event. Altered targets, omitted offers or lost owned decisions reject
without committing an action. A nested card disposal may temporarily hold that
same decision in its saved continuation. Ordinary non-Skills receipts retain
their existing format. A read-only scan before the new QA revival found no
existing skill-enabled market interruption requiring conversion.

The [Leader Skills source contract](LEADER_SKILLS_RULES.md) supplies assignment,
death and own-revival rules. The existing [market rules](CHOAM_REMAINING_RULES.md)
and implemented market/Ghola continuation supply native timing. These are
composed existing effects, not a new way to cancel a skill or a new revival fee.
Later implementation evidence supersedes historical missing-code observations.

## Entry and focused verification

Create and ready a fresh Basic CHOAM lobby with the expansion selected, retaining
its room cookie. Use the backed-up, version-checked
[prototype entry](IX_PROTOTYPE.md) with profile `leader-skills`.

```sh
npm test -- choam-skills
node --import tsx tools/faction-games.ts --profile choam-skills --out /private/new-choam-skills-samples
```

The sample profile adds Emperor, Guild, Harkonnen, Fremen and Bene Gesserit in
order for two through six players, with stable ordinals 31–35. Tests also use
Atreides. The normal/all sample defaults remain unchanged.

Focused regressions use genuine full-deck setup and explicitly conserved
positions for skill/battle/market interactions, strict rejected-action
immutability, JSON/private-view recovery and physical force/card custody.
Authenticated in-memory recovery exercises concurrent private choices and
the interrupted-sale continuation. Final source-bound reports record actual
check/build, complete sample, browser and preservation results.

The browser check completed genuine skill/Traitor setup, then used a backed-up
conserved battle position to kill the assigned leader and declare a sale. Real
controls revived Frankos Aru, drew two private skills, restored the identical
saved offer after refresh and assigned Killer Medic. The sale resumed, paid two
spice once and discarded its card once. Mobile controls fit a 390-pixel viewport
without horizontal overflow. Screenshot capture timed out; full visual acceptance
remains open.

## Remaining scope

Normal Banker income, ordinary Mentat questioning, Diplomat retreat, modified
Smuggler collection, captured replacement entitlement and other recorded skill
questions remain unfinished. Advanced Auditor rules and mixed Richese/other
faction or module combinations remain separate work. See the
[runtime boundaries](LEADER_SKILLS_RUNTIME.md) and [decision register](RULE_DECISIONS.md).
Full AI implementation and difficulty calibration wait until every non-AI
feature is complete.
