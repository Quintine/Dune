# Reinforcements battle prototype

The separate Ecaz Treachery Cards variant shuffles one physical Reinforcements
card independently of choosing the Ecaz faction. Its bounded handler supports
Basic or Advanced classic-faction tables and clean Ecaz/Moritani expansion
tables without other optional modules. The fresh opted-in Advanced Occupy
profile additionally composes co-present armies and native Ixian/Tleilaxu/CHOAM
families; Basic/unprofiled co-side use stays guarded. The
holder may commit it in either Battle Plan card slot. It is neither a weapon
nor a defense: Prescience of a category receives **None**, while the physical
slot stays occupied and hidden until reveal. A named-card inspection still
fixes the exact card. Harass & Withdraw may share the plan under the
[provisional original-cost-first policy](#combined-utility-plan--16-october-2026).
Original or copied Stone Burner composes in the existing native Advanced Occupy
envelope; Homeworld, other profile and optional-module boundaries remain.

The [combined-army follow-up](ECAZ_OCCUPY_RULES.md#independent-cards-with-combined-armies--2-october-2026)
retains own-holder reserve cost and selected lead card/payment ownership.
It does not revise the provisional outcome accounting below.

The holder must have three own reserve counters when sealing the plan. The owner-only battle offer displays availability and the exact provisional cost. The current prototype deterministically takes ordinary reserves first, then elite reserves if needed, transferring precisely three physical counters to the corresponding Tanks subpools when the battle settles. There is no spice payment or on-board arrival. The +2 changes the calculated normal-outcome battle score, **not** the committed physical dial, support payment, casualty count or leader survival. The card is discarded after any revealed result, including an own, opposing or mutual Traitor call and Lasgun/Shield explosion. The cost is likewise paid on each of those outcomes. A successful Traitor call still supersedes the normal score; the modifier never overrides it. Public history records the transfer; the sealed card and owner reserve mix stay private until the reveal. JSON-restored decisions and transactional room updates cannot charge the same cost twice.

**Provisional interpretations, not publisher rulings:** The card says “increase the dialed number by 2” and transfer three reserves, but no retrieved combined ruling answers whether a sole successful Traitor caller instead keeps their reserves, how the transfer orders against an explosion, whether +2 adds Advanced support or physical losses, which reserve types the holder may select, or whether the three spent reserves count as battle losses for Atreides. For this bounded prototype, payment is at battle settlement before on-board casualties on every outcome; the engine counts the three as battle losses, chooses normal-first rather than offering a type selection, and keeps the score bonus separate from physical dial. [The source review](ECAZ_TREACHERY_RULES.md#14-september-reinforcements-cost-review) records the competing reading and pending user question. These choices are visible so they can be revised without changing prior hands or inventing hidden information.

The owner receives a card-slot explanation and disabled reason when fewer than three reserve counters remain or the bounded mode is unsupported. All four AI profiles generate legal candidates in the classic and Ecaz/Moritani profiles and can select either slot, including an Advanced plan. The current scoring is a minimal legal participation heuristic, not difficulty calibration. The prototype does not certify the whole three-card variant, other expansion combinations, optional modules, historical-save compatibility or public mode starts.

Focused rule, engine, controls and in-memory SQLite tests cover both slots, Basic/Advanced payment, elite subpool conservation, traitor/explosion disposal, private sealed views, JSON restoration, rejected-action immutability and competing final room commits, now including a paired Ecaz/Moritani saved battle. The test results and actual browser/UI evidence for the current checkpoint are recorded in [Implementation status](IMPLEMENTATION_STATUS.md); test coverage is not a publisher ruling.

## Combined utility plan — 16 October 2026

The standing choose-recommended priority selects the existing native settlement
order for the two physical specials in one plan: quote and debit three
**original own reserve** counters before Harass returns any undialed counters.
This is an implementation interpretation, not a newly retrieved publisher FAQ
or an answer to the earlier reserve-payment question. The source audit's printed
effects and original provisional all-outcome/normal-first cost are unchanged.

Three reserves must exist at commitment. A future return cannot fund a deficient
plan or change its quoted normal/elite mix. For example, two original ordinary
and one elite reserve are spent even when Harass subsequently returns four
ordinary counters. Both cards discard once. The +2 remains normal-score-only,
not extra physical dial, support or winner casualties. Opposing successful
Traitor cancels only Harass; Reinforcements still pays under its existing
provisional all-outcome policy.

Both slot orders compose in the existing Basic/Advanced and selected Advanced
Occupy envelopes. Only the card user's reserves and undialed forces change;
original fixed Ecaz commitment and the other ally's pool stay separate.
Basic/unprofiled co-side and other module gates stay; Stone uses the
[physical-token composition below](#native-stone-composition--16-october-2026).
No persisted state or fresh/public profile is added.

### Scoped proof

The affected eleven-file offline union passes **134/134**, with types/lint and
production build passing (module-register, large-chunk and Unknown-route
warnings). Six new behavioral regressions cover both slots, original typed
costs, deficient original reserves, all Traitor outcomes, explosion and both
active Occupy card-user roles. The test battle uses rock so automatic
collection income cannot obscure support accounting.

Fresh Node programs exercise eight Basic/Advanced cases across all four
profiles, both slot orders and16 accepted continuation actions. A real styled
390px journey starts at three reserves (two normal, one elite), selects both
cards and shows the explicit provisional order. Original dial1/support1 with
leader2 plus bonus2 beats opposing leader4. Four ordinary fighters return;
the original elite reserve is spent, leaving reserves4/Tanks16/elite Tanks5,
spice29 and no army, battle or decision. Both cards discard once; native
collection opens. No root overflow or browser/application error occurred.

Current guide parse, combined-policy anchor and38 evidence paths across the
two topics resolve; all ten checklist facets remain Partial. Removed the
obsolete pair rejection and an incidental absent-card candidate pin. No
human server, saved room, D1, deployment or public gate changed; no new broad,
HTTP, recovery/privacy/custody assurance campaign ran. Private proof artifacts
remain outside Git; the owned source host and throwaway scripts were removed.


## Native Stone composition — 16 October 2026

Reinforcements now composes with same-plan or opposing Stone Burner, including
a physical Mirror Weapon copying Stone. This uses the existing fresh native
Advanced Occupy envelope with the independent Ecaz cards and actual Richese
cache. No new profile, Basic Richese eligibility, public start or optional
module is enabled.

Stone still compares only physical undialed counters, including original
fixed Ecaz and native variable ally contributions. Reinforcements adds no
physical tokens, extra dial, support or on-board casualties; its +2 normal-score
bonus is inactive for Stone comparison. Its original own-reserve cost still
pays once under the existing provisional all-outcome policy. Original/copy
kill-or-ignore modes and Traitor precedence remain unchanged. Reinforcements
discards once; a winning physical Stone or Mirror keeps ordinary retention.

The printed physical-token instruction and the existing score-only reserve
card implementation are composed here. The reserve-payment question remains
unanswered; no new publisher ruling or user answer is implied.

### Scoped native Stone proof

The affected sixteen-file offline union passes **167/167**, with types/lint
and production build passing (module-register, large-chunk and Unknown-route
warnings). New pure/native cases cover physical-token victory despite +2,
same-plan/opposing cost, original elite reserves, fixed/variable card users,
copied kill mode, Traitor precedence and physical retention.

Eight fresh Node programs cover both lead roles and all four legal profiles,
with original/Mirror attacks and36 accepted continuation actions. The native
fixture initially exceeded hand capacity when a third selected card was added;
it now returns unselected real hands to the conserved deck before lead choice
and checks four-card limits. The actual390px journey was repeated on that
corrected fixture, starting with only three held cards.

Original total dial4/support1 compares five undialed coalition counters against
four, never seven. All three native voters decline Traitor through actual
controls. Ecaz pays reserves15→12 plus original fixed3 losses (Tanks6);
Guild loses only variable1, leaving Ecaz2/Guild3 in the territory. Support
costs Ecaz9→8. Reinforcements discards once; Stone is retained through its
original choice, and battle/decision clear into collection. No root overflow,
browser/application error or over-capacity hand occurs in the corrected journey.
The earlier overfull fixture is not accepted evidence of a legal hand.

Current reference parses; the composition anchor and23 evidence paths across
both topics resolve, with all ten facets Partial. No human server, saved room,
D1, deployment, public profile or new broad/HTTP/recovery/privacy/custody
assurance campaign changed. Owned hosts/scripts are removed; private proof
artifacts stay outside Git.

