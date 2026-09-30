# Remaining CHOAM rules: primary-source audit and engine contract

Audit date: 2026-09-06; Kull preview policy updated 30 September 2026. Scope: Jubba Cloak, Kull Wahad, Auditor, and CHOAM's printed leaders for the classic GF9 2019 game with CHOAM & Richese. This document separates retrieved official rules from software behavior and explicit product interpretation. Later runtime records supersede historical absence claims; this does not certify complete CHOAM support.

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

The printed trigger is broad, but the retrieved official text does not enumerate every Karama use. The table separates the approved preview handling from publisher confidence limits. The distinct counter and BG-before-conversion choices are recorded in the [source update](CHOAM_KULL_SOURCE_UPDATE.md#user-selected-preview-timing--30-september-2026); they are not outstanding user questions or publisher clarification.

| Attempt or situation | Approved preview handling | Evidence limit |
| --- | --- | --- |
| Real Karama cancels a faction/alliance ability | Intercept before card consumption or canceled-effect settlement; CHOAM may declare Kull | Ordinary use fits the printed trigger; response priority is explicit preview policy |
| Real Karama funds shipment, takes an auction card, or pays a winning bid | Route through the same pre-cost interception; guard an unpayable winning-overbid composition | No purpose restriction is stated; no auction recovery remedy was approved |
| Real Karama activates a once-per-game faction power | Intercept its prepared intent before setting `specialKaramaUsed`, paying additional costs or drawing randomly | Broad trigger is a textual inference; this differs from ordinary Karama canceling an already activated special power |
| Bene Gesserit Worthless-as-Karama | Intercept before conversion/discard; successful Kull retains the unplayed Worthless card | Selected product policy; November FAQ's ordinary conversion cancellation still discards the card if that later stage is reached |
| Holding Karama permits an overspice bid | Holding alone is not an attempted activation and never spends Kull | Winning-payment infeasibility remains deferred, not solved by hidden-card-dependent bidding limits |
| Target already blocked in this turn/phase | Reject another Karama activation before mutations | Use a turn-and-phase stamp so the restriction expires at the right boundary |
| An ally plays Karama for a recipient who is blocked | Apply the restriction to the **card player**, not automatically to its beneficiary | Recommended reading of the named-player restriction; scenario not explicitly answered |
| Acquiring, trading, selling, or discarding Karama without activating it | Do not treat this as a Kull trigger | No primary support for preventing ownership or a non-Karama-effect discard |
| The attempted Karama is aimed at Kull itself | Reserve the original card; allow only a distinct eligible counter before activating the ban | Different-card response priority is selected product policy, not a retrieved publisher ruling |

Implementation responsibilities:

- Save a validated typed intent before mutations, including activating owner, exact physical card, purpose, interrupted response/decision ownership and turn/phase stamp. Invalid attempts must not expose a public reaction or hidden payload.
- Preserve the original continuation rather than recursively dispatching the original user action. Decline resumes it once; successful Kull stops it while retaining the unplayed original and unspent special once-use. No whole-Game rollback is permitted.
- Route ordinary and prepared special activations through interception, including Emperor revival before any physical return and Harkonnen before a random transfer. A hook placed only at discard is too late.
- Keep a BG counter conversion separate from the reserved original attempt and Kull's own cost. Ordinary conversion cancellation has its existing discard consequence; successful pre-conversion Kull does not.
- Guard the deferred winning-overbid composition before payment costs or saving an unfinishable transaction. An actor-private refusal must not depend on hidden Kull custody, reveal funding or install a free award, restart, new subsidy or bid cap.
- Offer CHOAM the same neutral opportunity from an eligible public attempt regardless of private Kull ownership. Only CHOAM sees its own legal costs; neither a raw special selection nor a saved response secret belongs in a rival projection.

An offered or declared Kull is **pending**, not an active ban. Resolve the ordinary CHOAM-effect response first, excluding the reserved original physical card from counter choices. Success then restricts the activating player for the stamped phase only. Prevention retains the Kull cost under existing native CHOAM semantics and resumes the original intent once. The wider publisher scope across canceled copies/effects and full combined-play acceptance remain boundaries.

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

The original 6 September pass was a read-only source/engine audit plus documentation creation. Validation then consisted of official indexed-source retrieval, inspection of integration points, image inspection, metadata/file-type checks and document checks, not gameplay tests. The later 30 September Kull choices are explicitly selected product policy; remaining publisher clarification, deferred overbid recovery and full combined-play acceptance are not completion claims.
