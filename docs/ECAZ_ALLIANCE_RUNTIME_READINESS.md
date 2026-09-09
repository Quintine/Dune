# Reusable Ecaz Ambassador alliance readiness

Read-only architecture audit, 9 September 2026. This records the contract before the alliance branch is integrated. It does not claim optional Duke loans, full Occupy combat or complete Ecaz mode support. Rules authority is being independently reviewed; existing provenance is in [Ambassadors](ECAZ_AMBASSADORS_RULES.md) and [Duke Vidal](DUKE_VIDAL_RULES.md).

## Source-confirmed branch and existing entry

The source reviewer verified E3 p.7: both Ecaz and the entrant must be unallied, and the entrant must consent. Direct Duke acquisition and alliance formation are different alternatives. Duke availability is not a prerequisite for forming an alliance without a loan. BG prediction remains private and unchanged; advisor entry cannot trigger the token. The reusable Ecaz token returns to supply when triggered and never joins or completes the five-token random cohort.

The existing producer near `engine.ts:6534` already establishes the owner, entrant, physical placed token, territory/sector, turn/phase and event, and pauses remaining actions. `finishAmbassador` near 6602 clears that receipt and resumes a saved worm ride exactly once. A Guild Ambassador's final BG accompaniment can transfer its outer continuation to a new Ambassador entry near 7280; preserve its `wormRider` and `guildAdvisorOrigin`, rather than replaying the completed Guild shipment.

Current `decideAmbassador` near 7708 only accepts `choice:'duke'` for the Ecaz token. More importantly, `ambassadorEffectBlock('ecaz')` near 6501 applies the direct Duke gate before choice dispatch. That must be separated: a dead/captured/ghola Duke, same-controller direct-acquisition boundary, or Advanced Harkonnen must not disable an otherwise supported no-loan alliance.

## Reuse alliance mechanics without importing Moritani's rule

`formTerrorAlliance` near `engine.ts:8060` breaks old alliances, refunds touched aid, removes obsolete alliance offers, links the pair, stamps `allySinceTurn` and clears Ready. Its consent stage is useful precedent, but its permission to break existing pairs and refusal-triggered Terror effect are specific to Moritani. The Ecaz branch requires two currently unallied players and must reject before spending the token if either is already allied.

The ordinary Nexus action near 15960 also links reciprocal IDs, stamps the current turn and clears Ready. Its phase restriction must remain intact; the Ambassador is a separate authorized source, not a general relaxation of Nexus timing. A small shared reciprocal-link transaction can serve both special sources after each source validates its own prerequisites. Clear offers involving either new member so an older offer cannot later create a conflicting pair. Validate rather than silently redirect stale escrow. Any actual refund must use the existing safe resource quote and pay its original donor once.

Allied movement, shared collection, victory and faction benefits mostly derive from current reciprocal IDs. Preserve those dynamic consumers. Stamp both `allySinceTurn` fields so existing departure deadlines remain consistent; Ecaz Occupy then permits supported territorial coexistence. Do not clear private hands, BG prediction, paid shipments, movement counters, battle history, traitors or source-bound card reservations as an alliance side effect. Existing promise reconciliation should run after the accepted action; do not manufacture new answers or expose a partner's private commitments.

## Agreed finite API

At the existing owned offer, `{type:'decision', event, trigger:true, choice:'alliance', beneficiary:owner}` validates the actual entry and both unallied identities before calling `triggerAmbassador`. It returns the token to supply immediately and records `effect:'ecaz'`, `stage:'allianceReply'`, `beneficiary:entrant`; the new `ecazAmbassador` decision belongs to the entrant.

The entrant sends `{type:'decision', event, accept:boolean}`. Require the exact boolean and original event. Acceptance revalidates the two unallied identities, forms the pair, clears obsolete offers/Ready, then finishes the Ambassador continuation. Refusal finishes without an alliance, Duke acquisition, fallback effect or token restoration. The latter is the coordinator's composition of committed trigger plus refusal; it is not a retrieved publisher rollback sentence. Declining the original **trigger** still leaves the placed token intact.

The existing generic decision-owner check must explicitly handle `allianceReply`; do not accidentally authorize every later Ecaz stage by the direct-acquisition beneficiary rule. On a saved reply the physical token is now in supply, so validation must distinguish the committed token from the still-placed offer. Bind owner/faction, entrant, effect, stage, source event, turn/phase and continuation. Reject orphaned live or suspended controls as well as mismatched events. No new generic Ambassador Karama response is introduced by this contract; Moritani's alliance cancellation is not authority to add one here.

Nullentropy Box and other supported decision suspensions should retain the complete reply and restore it after their own event finishes. Use the existing saved-control pattern and normalizer/CAS, not another entry event or rollback copy of the game. Test the ordinary phase-five continuation and actual phase-one worm suffix separately.

## Duke loan remains a separate material boundary

`game/duke-vidal.ts` has `source:'ally'`, but that tag is not an implemented loan lifecycle. `expireDuke` releases only unused Moritani tenure; its existing test explicitly preserves unresolved allied tenure. `consumeDuke` always clears controller/source, and actual battle resolution near `engine.ts:11063` calls it when Duke appeared in either plan. Residual Poison also releases his control after death near 9451.

`controlledLeaders` near 9510 and the player projection near 17816 already make the same physical disc available to its controller, subject to exceptional capture/ghola/Advanced-Harkonnen gates. Reusing those consumers is appropriate only after loan expiry, unused return destination and battle-use return are source-resolved. Preserve disc identity, death history and `usedAt`; neither a loan nor a return should grant a second battle use automatically. Ordinary Ecaz tenure persists, Moritani can supersede it, and revival/capture rules retain their separate gates.

The current agreed alliance branch changes **no Duke state**. Optional loan controls remain explicitly unfinished until authoritative return behavior is settled. This still delivers a complete consent-based alliance alternative, including its entry, token, aftermath, UI, AI and recovery behavior.

## Public controls, AI and evidence

Project owner-offer `allianceOffer:{blocked:string|null}` independently from `dukeAcquisition`. Eligibility depends on public identities and entry facts, not hidden Duke custody. Show a distinct alliance action, the existing direct-acquisition action and leave-in-place action. The entrant sees accept/refuse with the actual inviter and territory; everyone else sees who must respond. No confirmation is needed after an accepted automatic link or token return.

All four AI profiles can propose when the authoritative descriptor permits it, otherwise retain direct-Duke/decline behavior, and accept a valid owned reply. They receive no rival prediction, hand or balance through this path. Later negotiation strategy can differ without changing legality or inventing a Duke loan.

Focused evidence should use actual shipment and worm entry; assert both decision owners, immutable rejection of stale/malformed/foreign actions, both existing-alliance exclusions, exact token/cohort conservation, no Duke changes even when Duke is unavailable, accepted/refused continuation, private prediction invariance, actual Box suspension and JSON recovery, and all four AI policies. Production room CAS races belong to the coordinator's separate recovery tests. Keep unrelated expansion release gates in place.
