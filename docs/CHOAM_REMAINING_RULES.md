# Remaining CHOAM rules: primary-source audit and engine contract

Audit date: 2026-09-06. Scope: Jubba Cloak, Kull Wahad, Auditor, and CHOAM's printed leaders for the classic GF9 2019 game with CHOAM & Richese. This document separates retrieved official rules from proposed software behavior. It does not certify complete CHOAM support. Only this document was authored in this subtask.

## Evidence, access, and precedence

Primary source: [GF9 CHOAM & Richese rulebook](https://www.gf9games.com/dune/wp-content/uploads/2021/11/CHOAM-Rulebook-low-res.pdf), printed pp. 4, 7, 8, 10, 12. Targeted search retrieved indexed publisher text for each cited section. Direct web retrieval returned HTTP 403. A local `curl` fetch succeeded at the transport level but produced HTML, not a PDF: `/tmp/dune-rules/choam-primary.pdf` is **not usable PDF evidence**. `file` and `pdftotext` exposed that failure; no printed-face inspection is claimed from it.

The [November 2020 official FAQ](https://www.gf9games.com/dune/wp-content/uploads/2020/11/Dune-FAQ-Nov-2020.pdf), printed p. 7, was checked through indexed publisher text. It supports the existing general Karama model: one use of an ability, alliance abilities are eligible, and stopping Bene Gesserit Worthless conversion discards that Worthless card. It predates CHOAM and does not settle Kull-specific nesting. Use the later CHOAM-specific table when it differs from the general rule. No later CHOAM-specific official erratum resolving the questions below was located; that is an access/search finding, not proof none exists.

[Designer-uploaded rulebook metadata](https://boardgamegeek.com/filepage/245318/choam-and-richese-rules) identifies an August 2022 PDF uploaded by The Warp. Public metadata was retrieved, but its download returned HTTP 403. The [Future Pastimes component overview](https://futurepastimes.com/dune-expansion-sets) links a small CHOAM/Richese photo; it was inspected, but does not legibly establish the complete leader roster. No Landsraad tournament amendment, community rules compilation, fan-game implementation, or lore roster is used as authority here.

## Verified official mechanics

The following compact rules digest is supported by the publisher rulebook linked above; these are paraphrases, not a transcription of card faces.

- **Jubba, p. 7:** protects CHOAM's forces in one territory from loss when the storm moves.
- **Kull, p. 7:** reacts to a player's attempted Karama play, preventing that player's Karama play for the phase.
- **Worthless cancellation, p. 12:** Karama can prevent the special-effect discard during that phase.
- **Alliances, p. 8:** CHOAM's listed alliance grants a reciprocal card exchange and battle funding; it does not grant these Worthless abilities to its ally.
- **Auditor, p. 8:** an advanced setup addition, including its traitor. When used in battle, CHOAM may inspect two random opposing hand cards if it survives, one if killed, excluding battle-used cards. The opponent can pay CHOAM one spice per inspectable card to prevent the whole audit. It uses the normal one-leader revival allowance without requiring all leaders dead; no foreign ghola, capture, or leader skill is allowed.
- **Audit clarification, p. 10:** payment reflects available cards; partial payment cannot reduce inspection.
- **Audit cancellation, p. 12:** Karama can prevent the audit.

## Jubba: recommended implementation contract

Everything in this section is a proposed realization of the concise printed rule, based on the current `game/engine.ts` architecture. Unresolved interpretations are called out explicitly.

1. Insert an optional CHOAM decision before `continueStorm()` applies the first casualties of the committed `stormResolution`. `moveStorm()` already establishes `from`, `distance`, `traversed`, and pending Fremen losses. Preserve that continuation through the Jubba response rather than replaying `moveStorm()` after resumption.
2. Derive threatened **territories** from CHOAM-owned `forces` keys, the actual crossed sectors, and `stormExposed()`. Offer only territories with a positive exposed force count. Distance zero and a roster entirely in storm-safe locations create no meaningful play. The decision should be offered from public circumstances even when CHOAM lacks the private card, following existing `choamMovement` and `choamFreeRevival` privacy patterns.
3. Store `{ owner, card, territory, stormResolution identity }`, not merely one location key. Proposed interpretation: one declaration protects CHOAM's eligible groups in all crossed sectors of that selected territory during this single traversal. Do not mark other territories protected. The wording identifies a territory; it does not describe how digital sector-by-sector casualty batches map to one loss event. This multi-sector interpretation remains under audit.
4. Use the existing `pendingChoamWorthless` / `choamWorthless` response pattern. Recheck custody and threatened CHOAM forces before settlement. On success, discard the declared physical card exactly once, record protection on the pending storm, and resume. On cancellation, proposed behavior is to keep the card and mark its special use unavailable for that phase, consistent with the current prevention-of-discard architecture. Exact restriction scope across another physical copy or a different Worthless effect is unresolved.
5. In `continueStorm()`, skip only CHOAM's selected force-loss calls. Leave other factions' `kill()`/Fremen `stormCasualties()` processing and spice removal untouched. Retain the independent Fremen `stormProtection` response; its `protected` boolean is not a shared all-faction shield.
6. Resolve existing `stormPending` Weather Control/Family Atomics opportunities before freezing threatened groups, or revalidate those groups if such effects remain legal while Jubba is pending. Never apply losses and then reconstruct dead forces. Persist the selection and the response so reconnect cannot apply a storm twice.

Do not extend this contract to CHOAM's ally, spice, worms, explosions, movement/shipment into a stationary storm, or a later storm event without additional primary support. Protected survivors remaining in the final storm sector should remain subject to the existing storm movement/battle/collection restrictions; Jubba is not a general storm-ignore flag. The hidden mobile stronghold should normally have no exposed candidates, because it has its own protection rules.

Open timing questions: earliest declaration relative to final storm confirmations; priority versus Fremen protection and other simultaneous prevention; whether one copy covers every crossed sector of a territory; reentry into a closed opportunity after a cancellation; and first-storm placement peculiarities. A deterministic implementation may choose an order, but should record it as provisional and preserve the full expansion gate.

## Kull: coverage and interruption design

The printed trigger is broad, but the retrieved official text does not enumerate every Karama use. The table below gives recommended handling and the confidence limit, not an official scenario-by-scenario ruling.

| Attempt or situation | Recommended behavior | Evidence limit |
| --- | --- | --- |
| Real Karama cancels a faction/alliance ability | Intercept before card consumption or canceled-effect settlement; CHOAM may declare Kull | Ordinary use of the named card fits the printed trigger; nested order is unspecified |
| Real Karama funds shipment, takes an auction card, or pays a winning bid | Route through the same interception | No purpose restriction is stated; blocked-bid recovery remains unresolved |
| Real Karama activates a once-per-game faction power | Intercept before setting `specialKaramaUsed` or paying its additional costs | Strong textual inference from attempted card play; distinguish this from ordinary Karama canceling an already activated special power |
| Bene Gesserit Worthless-as-Karama | Expose an equivalent attempt, with an explicit conversion stage | Whether Kull acts before conversion/discard is not settled by the retrieved CHOAM text; November FAQ only settles ordinary Karama cancellation of the conversion |
| Holding Karama permits an overspice bid | Do not consume Kull merely because a hidden card might fund a bid | Holding is not the same as attempting to play; whether an already blocked player retains that bidding permission needs clarification |
| Target already blocked in this turn/phase | Reject another Karama activation before mutations | Use a turn-and-phase stamp so the restriction expires at the right boundary |
| An ally plays Karama for a recipient who is blocked | Apply the restriction to the **card player**, not automatically to its beneficiary | Recommended reading of the named-player restriction; scenario not explicitly answered |
| Acquiring, trading, selling, or discarding Karama without activating it | Do not treat this as a Kull trigger | No primary support for preventing ownership or a non-Karama-effect discard |
| The attempted Karama is aimed at Kull itself | Requires a staged response protocol and a declared provisional priority | The apparent circular case is not resolved by retrieved official text |

Current integration hazards:

- `spendKarama()` discards immediately. Save a validated pending intent before that mutation, including owner, physical card ID, purpose, recipients, interrupted `response`/`decision`, and phase stamp. Revalidate custody/legality on resumption. A blocked attempt should provisionally keep its unplayed card; do not silently charge a cost for an effect prevented before play.
- `completeKarama()` supports `cancel`, `shipment`, `purchase`, and `auctionPayment`. Preserve its continuation instead of recursively calling the original user action, which could reopen Kull indefinitely.
- `specialKarama()` is separate and directly mutates many powers. A fix only in `spendKarama()` would leave special powers outside the gate. Centralize attempted-play interception or explicitly route every branch through the same protocol.
- `pendingKarama` currently represents Bene Gesserit conversion and preserves its original canceled response. Kull cannot overwrite that state or `g.response` without saving the suspended context. Use a bounded explicit stage/continuation, not implicit global ordering.
- `recoverAuctionPayment()` already calls unfunded canceled-payment recovery provisional. A Kull-blocked payment must not award the auction card for free, leave an impossible decision, or assume this routine is source-certified. Distinguish an inability to fund a bid from merely choosing not to use another available payment method.
- Offer CHOAM the Kull opportunity from an actual declared public attempt regardless of private Kull ownership. Reveal only the attempted card and permitted intent, never the rest of either hand.

A possible provisional order is: validate attempted Karama; pause it; allow CHOAM's Kull declaration; resolve permitted responses to that declaration; establish the phase restriction if Kull succeeds; either abandon the still-unspent attempt or resume it once. The target's ability to use the same pending Karama or a second Karama against Kull, and priority for other players, need a primary ruling before this is called complete.

## Auditor: integration and unresolved printed data

The official text establishes an additional advanced leader, not an ordinary fifth basic leader or a Cheap Hero card. The five basic CHOAM names/strengths and the Auditor's purported printed zero strength were **not verified** from a legible primary face in this pass. Do not fill them from novel lore or other implementations. Keep advanced setup explicitly gated until the roster/traitor mapping is sourced.

The designer photo was fetched to `/tmp/dune-rules/choam-designer-components.jpg` and inspected. It shows only a partial stack at low resolution; it is insufficient for a six-disc roster. Public BGG metadata at `/tmp/dune-rules/choam-bgg-filepage.json`, `choam-bgg-files.json`, and `choam-bgg-download.json` identifies file 337703, `CHOAM Rulebook.pdf`, 3,656,728 bytes, but the actual file download failed. These are provenance breadcrumbs, not evidence of face contents.

Recommended engine work, pending that roster verification:

- Give the Auditor an explicit stable leader identity and eligibility helper. `leaders(f)` is currently advanced-unaware; setup must add the extra disc/traitor only under the appropriate rule. Prefer identity checks over `name === 'Auditor'`; the existing foreign-ghola check already uses that fragile name comparison.
- Queue audit data inside `resolveBattle()` before `g.battle` is cleared: CHOAM owner, opponent, whether Auditor died, and the opponent's battle-used card IDs. Do not reconstruct excluded cards after optional winner discards or from a generic hand snapshot. Make continuation ownership explicit in `finishBattle()` alongside pending income, tech transfer, capture and Face Dancer work.
- Let CHOAM decline or initiate; permit Karama prevention; offer the opponent the full affordable buyout or inspection. Randomly sample only from the eligible pool. Save the sampled IDs once, reveal them only to CHOAM, and preserve them through reconnect. An empty eligible hand should settle without an information leak or a paid zero-card transaction.
- Rival hand changes during a pending response need revalidation. Define whether the eligible pool is frozen at battle completion or computed at audit settlement; source text excludes used cards but does not specify this concurrency detail. Paying must precede disclosure.
- Preserve ordinary leader rules unless a specific exception is sourced. Audit outcome after a traitor call, lasgun/shield explosion, activated Poison Tooth, or Artillery stun needs dedicated scenarios. No retrieved primary passage grants Auditor weapon immunity or equates zero strength with absence of a leader. Whether a zero-strength disc is free to revive or produces zero bounty depends on verifying the printed value and applying the general price rules, not an invented Auditor exception.
- Update normal-revival eligibility and once-per-turn accounting without loosening restrictions for other leaders. Keep existing ghola/capture/skill exclusions independent of audit cancellation: preventing the audit does not remove the disc from battle or erase its other restrictions.
- CHOAM's ally does not automatically get private audit results or use of the Auditor. Other information-sharing and future leader-transfer rules need their own explicit handling.

## Acceptance scenarios to add with implementation

| Area | Required evidence |
| --- | --- |
| Jubba scope | Two CHOAM territories threatened; select only one. Same territory spans multiple crossed sectors. Other factions and spice remain affected. Include destroyed Shield Wall exposure, zero distance, safe terrain, final storm-sector survivors and first-storm behavior. |
| Jubba sequencing | Fremen protection plus Jubba, Weather/Atomics before commitment, canceled effect, stale/moved/sold declared card, repeated confirmation, JSON reconnect, exact force/elite conservation. |
| Kull uses | Cancel, shipment, immediate purchase, auction payment, each implemented special power, BG conversion, target already blocked, phase expiry, ally player/recipient distinction, and unfunded winning bid. |
| Nested responses | Kull against Karama aimed at a CHOAM effect; attempted counter-Karama against Kull; third-party counter; no overwritten decision, double discard, or permanent deadlock. State explicitly which results are provisional. |
| Auditor | Survivor/dead and 0/1/2+ eligible-card cases; battle-used exclusions; full payment only; Karama prevention; private projection and stable random sampling; no capture/foreign ghola/skill; additional advanced setup identity; repeated revival and all listed battle outcomes. |
| AI/UI | Easy/Medium/Hard/Brutal resolve every new decision using private projections; human controls explain target/scope and permit legal decline; normal/enlarged text tracks only verified behavior. |

This was a read-only source/engine audit plus documentation creation. No gameplay tests were rerun for unimplemented behavior. Validation consisted of official indexed-source retrieval, inspection of current integration points, image inspection, metadata/file-type checks, and document checks. The unresolved questions above are remaining work, not newly established house rules.
