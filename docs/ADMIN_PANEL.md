# Administration panel requirements

Added to the goal on 22 September 2026 at the user's request. This is required
product scope, not a claim that the panel is implemented. Reuse the existing
room, session, recovery and persistence systems where suitable.

## Required capabilities

| Area | Required behavior | Stage |
| --- | --- | --- |
| Administrator access | Secure administrator sign-in, server-enforced permissions, session revocation and a documented initial-owner setup. A room host is not automatically a site administrator. | Missing |
| Room directory | Search, filter, sort and paginate rooms; show lifecycle status, host, roster, rules/modules, last activity and pending decision ownership without exposing private game information. | Missing |
| Create and configure | Create rooms with supported rules and human/AI seats, manage lobby settings and invitations, and assign a host through an explicit workflow. Preserve normal prerequisites and readiness rules. | Missing |
| Lifecycle and removal | Pause/resume, lock/unlock new joins, close/end, archive, restore and delete selected rooms. Offer recoverable removal and explicit permanent deletion with clear scope, consequences and safeguards for related records. | Missing |
| Participant support | Remove disruptive participants or revoke access, manage appropriate restrictions, assist saved-seat recovery and host reassignment, and use supported AI takeover/replacement without losing forces, cards or decisions. | Missing |
| Saved-game operations | Create/list/download backups, validate imports, restore a selected checkpoint safely, and diagnose or resume interrupted automatic work through authoritative game actions. | Missing |
| Operations and audit | Show server/build/storage health, room/player counts and actionable errors; provide maintenance controls and a searchable record of administrator actions. | Missing |

Track each area through Missing, Prototyped, Integrated, Verified and Polished.
As implementation begins, link its controls, server actions, persistence,
documentation and evidence. A working directory alone is not a full admin panel.

## Behavior and safeguards

Every privileged endpoint must authenticate and authorize its caller. Support
least-privilege roles, secure initial provisioning, safe credential/session
management, and accessible desktop/mobile controls. Do not ship default shared
credentials or expose administrator capabilities through ordinary room cookies.

Default views must preserve hands, Traitors, predictions, sealed plans, private
discussion and recovery credentials. Any necessary private support access must
be separately authorized and audited; it must not reveal information to other
players or feed an administrator's playing seat or AI strategy. Redact secrets
and private card contents from routine logs and reports. Backup access needs
equivalent protection, since backups can contain private state.

Pausing must stop human mutations and automatic/AI continuation consistently
without losing pending decisions. Resuming restores the same turn and pacing.
Seat removal or reassignment must explain the effect on an active game and
preserve a legal continuation; do not simply delete a faction's physical pieces.
Existing consent/recovery boundaries remain applicable to seat access.

Use authoritative rules and the existing concurrency model. Reject stale or
duplicate destructive actions safely. Imports and restoration must validate
schema, custody, private-information boundaries and session ownership; capture
a recovery checkpoint before replacing current progress. Never restore old
credentials in a way that silently reauthorizes a revoked participant.

Room removal should be reversible by default. Permanent deletion and bulk
operations must identify the selected rooms and dependent records, explain
irreversibility, require deliberate confirmation and retain appropriate audit
evidence without keeping purged secrets. Protect unrelated games. The existing
saved-game preservation rules still govern development and maintenance; they
do not preclude intentional room deletion through the authorized product workflow.

Record who acted, when, the affected room/seat, operation, reason, outcome and
safe before/after metadata. Maintenance controls must warn about interruptions
to active games and preserve restoration. Do not recreate recurring restarts or
cleanup schedules. Do not add an arbitrary game-state editor that bypasses rules,
silently changes outcomes or makes unfinished modes appear complete.

## Development order and acceptance

Prototype permissions and the room directory first, then room creation and
reversible lifecycle operations, participant support, backup/restore and
operational tools. Include functional server actions and saved continuation in
each slice; continue independent game features in parallel where useful.
Administration is part of the non-AI completion gate in the
[AI development plan](AI_DEVELOPMENT_PLAN.md).

Acceptance requires working controls and documented setup/recovery procedures,
with authenticated HTTP and persistence tests for authorization, privacy,
concurrent actions, exact retries, related-record handling and safe restoration.
Verify pause/resume with both humans and AI, archive/delete/restore with saved
rooms, and denied admin actions by ordinary players. Exercise desktop/mobile
flows and server restart recovery. Use dedicated test rooms and preserve all
unrelated saved games; complete independent security/privacy/persistence review.
Verify the panel's relevant deployed flows at
**https://dune.procrastination.games**, including denied access by ordinary
players, using the [production verification workflow](VERIFICATION_WORKFLOW.md#verify-the-deployed-application).
The full goal remains unfinished until this scope and the other completion
criteria are satisfied.
