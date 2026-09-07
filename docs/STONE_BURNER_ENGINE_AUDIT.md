# Stone Burner: source and engine integration audit

Audit: 2026-09-06. Scope: the canonical weapon, its revealed-plan choice and physical undialed-force comparison. No runtime files were changed in this audit. This is not a full optional-module or expansion certification.

## Stone Burner, complete ordinary portraits and recovery checkpoint (2026-09-06)

- Canonical Stone Burner now uses the weapon slot without changing its saved `kind: special` identity. It has a named Voice role, Prescience/Truth-compatible original commitments, a private precommit availability check, and an event-bound owner choice after both plans reveal. Kill mode kills both participating leader discs; ignore mode preserves other weapon attacks. Both replace ordinary strength with undialed physical-token comparison, with the aggressor winning ties. Neither adds the Kwisatz Haderach bonus or kills that companion. Normal support, bounty, traitor/explosion precedence, casualty choices and winner/loser/Moritani retention remain shared with the existing battle flow.

- Physical counting enumerates every legal casualty allocation. A winner is accepted only when every permitted pair agrees. The printed Advanced Emperor example includes three possible remaining-token totals; where all give the same winner, the winner still chooses its normal casualty allocation afterward. Where the choice could change the winner, a conservative check rejects Stone before either hidden opposing plan is inspected. Foreign No-Field values are represented by public possibilities, never read to decide availability. Compulsory Stone Voice must leave a common zero-spice completion across those public possibilities.

- Two actual interpretation questions remain unanswered: the commitment procedure when Advanced or Basic Ix physical allocations change the winner, and the priority of opposing Stone/Poison Tooth revealed choices. No policy was inferred from silence. A public Ix-configuration guard prevents accepting a Stone plan whose combined timing cannot yet finish. This is an explicit implementation boundary, not a printed prohibition. Mirror/copied weapons and unfinished modules remain uncertified. See [STONE_BURNER_ENGINE_AUDIT.md](STONE_BURNER_ENGINE_AUDIT.md).

- Player controls show both original plans, exact undialed counts or honest possible totals, the mode choice and a complete internal guide. No victim/death confirmation is added. The card stays physically reserved until standard cleanup; stale events, duplicate requests and corrupted source custody fail before resources change. All four AI profiles use public force possibilities, legal low-dial plans and revealed leader/bounty information. They preserve leader value when Artillery suppresses bounty and leave traitor/explosion precedence intact.

- **1,385/1,385 registered rules/client/component tests and 113/113 persisted/API tests pass**, together with TypeScript, lint and the production build. New coverage is eight pure Stone cases, seven root engine cases, nine independent reviews, five AI cases, three persisted recovery cases and four special-art cases. Logs: `/tmp/dune-stone-final-full.log` (34.28 seconds), `/tmp/dune-stone-final-multiplayer.log` (16.22 seconds), and `/tmp/dune-stone-final-{type,lint,build}.log`. All original card identities and the full expansion start gates remain intact.

The complete integrated validation checkpoint is recorded in [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md).

## Primary evidence and exact effect

The physical publisher face was visually read at `/tmp/dune-rules/choam-stone-reading.png`, enlarged from the [component photograph](https://cdn.anyfinder.eu/assets/QsUJtVktEC87xwK08oLlwnKyaozUWfuaLzG0LFEn67ENEEVgNrDGoITy3608Dqe7) linked by the [product gallery](https://www.tabletopfinder.eu/en/boardgame/32692/dune-choam-richese). Photograph provenance/hash are recorded in `RICHESE_ACQUISITION_RULES.md`. The visible publisher wording is the evidence; uploader printing/date remains unverified.

The card is **Weapon – Special**. After Battle Plans are revealed its user chooses one of two effects: kill both leaders, or omit both leaders' strength if they otherwise survive. Either mode determines the winner from the greater number of **undialed force tokens**; dialed forces are lost normally. It uses the ordinary discard-after-use wording. The second mode is not protection from the opposing weapon. No fee, separate purchase, ordinary Karama cancellation or faction restriction is printed.

Sources freshly checked through publisher-indexed search:

- [GF9 base rulebook, p13](https://www.gf9games.com/dunegame/wp-content/uploads/Dune-Rulebook.pdf#page=13): advanced dial/support and the winner's casualty-allocation choice.
- [GF9 Ixian/Tleilaxu rulebook, pp9–10](https://www.gf9games.com/dunegame/wp-content/uploads/2020/09/IxianAndTleilaxuRulebook.pdf#page=10): mixed Cyborg/Suboid casualties, subsequent substitution and cancellation examples.
- [GF9 November 2020 FAQ, pp1 and8](https://www.gf9games.com/dune/wp-content/uploads/2020/11/Dune-FAQ-Nov-2020.pdf#page=8): standard battle-card retention and the specific used-Tooth/Artillery exceptions.
- [GF9 CHOAM/Richese rules](https://www.gf9games.com/dune/wp-content/uploads/2021/11/CHOAM-Rulebook-low-res.pdf): physical inventory and updated card context. The readable publisher-authored local mirror is `/tmp/dune-rules/choam-lelekan-mirror.pdf`/`.txt`; invalid HTML files with older PDF names were not used.

Bounded official searches for Stone Burner with undialed, tie, leader, bounty and Kwisatz terms retrieved no Stone-specific FAQ deciding mixed-force allocation or simultaneous revealed-card ordering. Do not cite a community implementation as a publisher ruling.

## Ordinary battle composition

Use **physical tokens**, not dial strength, force equivalents, spice support or leader strength. Both normal and elite tokens each count as one undialed token. In a simple ordinary Basic battle the value is participating physical forces minus the integer dial. Exclude forces outside this battle, including any storm-separated group. Use the engine's established combat pool rather than total faction forces or an entire territory count that includes nonparticipants.

The normal aggressor tie-break continues because the card provides no replacement tie rule. Its score replaces the usual force-plus-leader total; it does not add an undialed bonus to the old score. The loser still loses its army normally; the text does not grant the loser immunity for undialed forces. The winner loses its dialed allocation, which may leave no surviving occupation even though it won.

Kill mode kills both participating leader discs without an ordinary weapon-defense test. Ignore mode leaves ordinary weapon effects intact. Determine each leader's death once even if another effect also kills it. A Cheap Hero remains a card governed by its ordinary disposal, not a new physical leader disc. Current supported captured/ghola/Duke battle-use cleanup should remain shared with ordinary battle resolution; never duplicate a separate Duke into a native roster.

Base pp11 and17 award normal killed-leader bounty and limit Kwisatz Haderach death to Lasgun–shield explosion. Stone states no bounty exception: the actual winner receives the appropriate killed-leader value, including its own, unless a separate applicable effect suppresses bounty. Zoal uses the existing battle death-value calculation. Stone does not kill the Kwisatz Haderach, and neither Stone score mode adds the KH strength bonus. KH's traitor protection remains applicable.

Successful traitor resolution and a Lasgun–shield explosion retain their existing precedence over ordinary weapon scoring. An actual explosion has no Stone winner or ordinary bounty. If Stone coexists with an opposing Poison Tooth, Tooth's activation remains optional and its normal leader effects still apply; no defense stops Stone kill mode. Artillery keeps its shield test, stun and no-bounty effect. Portable Snooper can address an ordinary opposing poison attack, but it cannot defend against Stone kill mode, Tooth, Artillery or an explosion. These are compositions of existing effects, not special Stone-specific FAQs.

The general FAQ permits the battle winner to retain used cards even when their faces merely say to discard after use. Stone has no retrieved exception comparable to used Poison Tooth or Artillery. Therefore use normal winner retention and ordinary loser disposal; an eligible defeated Moritani ally may retain it under the same winner-eligible-card predicate. Actual mutual loss/explosion has no winner retention. Do not immediately discard Stone when its mode is selected.

## The advanced allocation gap is real; ordinary casualty timing is not a bug

Base p13 expressly allows the already-determined winner to choose losses consistent with dial and paid spice. Its example gives the same dial/support two physically different losses: three tokens or five tokens. Ix's FAQ similarly allows different Cyborg/Suboid combinations and describes substitution after losses. Consequently, `casualtyOptions` followed by a winner-only `battleLosses` choice is source-backed for normal battles. Globally forcing typed losses into every sealed Battle Plan would remove this printed later choice; do not call that a base-rule correction.

Stone can require those physical quantities before deciding who is entitled to the later choice. For example, six participating tokens with dial3/support1 can leave three or one undialed tokens under the printed Emperor allocation alternatives. An opponent with two undialed tokens wins against one allocation and loses against the other. The card does not specify whether either player precommits a mix, whether a losing faction must select a hypothetical mix, whether selections are secret/simultaneous, or whose selection occurs first. Choosing the minimum loss/maximal survivor mix by default is not printed. Nor is defining undialed tokens as `physical - strength` in a mixed/half-strength battle.

This is a material combined-rule gap, not merely an implementation detail. No retrieved official answer resolves it. It also occurs with Basic Ixian mixed units, so an Advanced-only guard is insufficient. Single-type Advanced normal units often have a unique token total even when internal support details vary; a blanket Advanced ban would exclude unambiguous cases unnecessarily.

### Safe supported coverage without inventing allocation timing

1. Obtain each side's already-supported `CombatForces`, revealed dial and support, then enumerate `casualtyOptions` without mutation or RNG.
2. For every option, calculate `physicalTotal - (normal + elite)`. Never count `paidNormal` or `paidElite` a second time.
3. If each side has one distinct possible undialed total, compare those totals. Multiple typed allocations with the same total can still be chosen by the eventual winner afterward.
4. More generally, if **every pair** of legal totals gives the same winner, the outcome is unambiguous. The ordinary later casualty choice can remain intact. Attacker always wins when its minimum undialed total is at least the defender's maximum; defender always wins when its minimum exceeds the attacker's maximum.
5. If possible allocations change the winner, keep an explicit unresolved-combination boundary until the allocation commitment/timing policy is settled. Do not quietly freeze a convenient first option, maximum or minimum. A UI warning must describe the support gap rather than declare mixed forces illegal by printed rule.

The invariant-winner extension safely preserves more source-supported cases than requiring a single typed allocation. When using it, display possible token totals/ranges honestly, not a fabricated exact count before the winner chooses losses. Existing Ixian Suboid-for-Cyborg substitution remains after casualties; it is not a second pre-winner calculation of undialed tokens.

**Do not strand an accepted battle.** The comparison above is an outcome calculation, not permission to discover an unsupported case only after both plans are committed. Until an allocation procedure is settled, preflight must conservatively establish finishability before accepting Stone, using only public armies/rules and the acting player's chosen plan. It can quantify over all legal opposing dial/support possibilities; it must not look at the opponent's already sealed hidden plan to accept or reject. That would make the error response a plan oracle. If public information cannot prove supported completion, reject before commitment with the explicit implementation boundary. A hidden opposing No-Field value cannot be read to narrow that guard. Rejecting the opponent's otherwise legal plan only because it conflicts with an already accepted Stone plan is not a substitute for correct first-commit finishability.

No-Field participation needs the real revealed/reconstructed physical battle pool, not the earlier hidden marker's effective presence of one. Current marker-only battle reveal and reserve limitation can supply that pool. Do not peek hidden values in foreign preplan availability or reopen unsupported mixed-marker battles. Future homeworld, Occupy, leader-skill or force-modifier contexts require their own valid combat pool, not assumptions added inside Stone scoring.

## Revealed-mode timing and privacy

The Stone mode is explicitly a choice **after** public Battle Plan reveal. Do not add it to `Plan`, bind it through a pre-reveal Prescience answer, or have the bot decide secretly at plan construction. An already revealed canonical Stone is public, so a mode decision for its owner does not leak an unplayed hand card. No new universal readiness or irrelevant nonholder pass is required.

Existing `nextRevealedDecision` schedules Poison Tooth choices before traitor declarations. Adding a public Stone choice there is the natural technical hook. However, the retrieved text does not establish priority between opposing Stone and Tooth choices, or any future mirrored Stone effects. Giving one owner knowledge of the other's choice can affect use/retention. A fixed storm-order or card-order schedule must be recorded as an application convention or left as an explicit combined timing boundary, not represented as a direct publisher instruction. The final battle-effect precedence remains separate from declaration ordering.

Preserve original plan commitments, Voice, Truthtrance and active reaction continuations. The canonical card is an original weapon, so a weapon-name Prescience answer and structured Truth promise can identify it; its later mode is not one of the ordinary four original plan fields. A genuinely broader freeform promise about a later decision needs its existing honest scope treatment. Do not reject a legal mode merely because a bot's prior evaluation preferred another.

## Concrete engine contract

```ts
// Canonical stored Card remains kind:'special'; role adapter identifies the weapon.
Battle.stoneBurner?: Record<string, 'kill' | 'ignore'>;
{ type: 'decision', event: battleEvent, mode: 'kill' | 'ignore' }
// Public decision appears only for an already revealed Stone card.
{ kind: 'stoneBurner', player: stoneOwner }
```

Use an exact canonical `isStoneBurner`/shared weapon-role predicate in plan validation, Voice, Prescience, all feasibility searches, bots and UI. Never make every `special` card a weapon. Extend canonical name support in structured battle promises and hand-fact questions. Keep source-card reservation through every pending revealed choice and normal card cleanup.

Before final settlement, validate that every needed mode and supported token-count comparison is available. Separate a pure outcome calculation from mutations. Then perform support/ally payment once, apply traitor/explosion precedence, merge ordinary deaths with Stone's selected effect, choose the unambiguous winner, apply bounty rules, destroy the loser, and carry the winner's existing legal casualty options forward. Reuse `settleWinnerCasualties`, Ix substitution, `finishWinner`, Moritani retention, Harkonnen capture, Face Dance, technology and income continuations rather than copying or bypassing them.

A revealed choice must be event-bound, owner-only and immutable after submission. Its public projection may show the selected mode and computable public token counts, but no pre-reveal private plan, pending hidden token value or imagined allocation. Pure view/preflight work must not consume RNG or choose casualties. Normal room CAS and JSON persistence must survive mode selection and later casualty/retention pauses without duplicate payment, leader death or card disposal.

## Acceptance checklist

- Both modes in a real ordinary battle; undialed winner differs from normal strength winner; tied physical counts favor aggressor; loser loses normally and winner dial0/all-dial edge cases conserve tokens.
- Kill versus shield/Snooper, ignore versus ordinary poison/projectile, supported Tooth/Artillery composition, real traitor and explosion precedence, no KH death/bonus, ordinary bounty including Zoal/Duke.
- Advanced unambiguous physical count, equal-count typed alternatives, invariant winner across different totals, actual outcome-changing Emperor example guard, Basic Ix mixed counts and post-loss substitution.
- Original Stone weapon-slot legality, Voice/name-based Truth/Prescience, explicit mode timing, active overlay preservation and no private card/No-Field projection leak.
- Winner retain/discard, loser/Moritani retention, capture/Face Dance/tech/income after advanced casualties, exactly one physical card and one death increment per killed disc.
- JSON/restart, authenticated concurrent mode submissions and stale events, no repeated support payment or postbattle effects, private preflight without RNG, and all four AI profiles.

No user question was sent by this audit. The advanced physical-allocation circularity and simultaneous revealed-card declaration ordering are the material unresolved interactions; ordinary card roles, physical counting where the winner is invariant, death/bounty composition and continuation are technical integration work.
