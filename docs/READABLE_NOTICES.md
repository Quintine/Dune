# Readable progress, recovery and action notices

The user reported that a popup after room creation disappeared before it could
be read or acted on. The first create/join request was rendering the full saved
request recovery panel while awaiting its initial response. Successful creation
then removed it immediately, making actionable recovery instructions appear to
flash on screen even when nothing had gone wrong.

First submissions now show only **Creating your room…** or **Joining the room…**
and a short progress message. Successful responses open the confirmed
table with a **Room created** or **Room joined** confirmation above it. The
confirmation shows the room code and invitation/seat-protection guidance, and
stays until **Continue**. Polling, reconnecting and ordinary game actions do not
dismiss it. Continue acknowledges only local text, without submitting a game
action. Leaving, reloading or claiming a different seat clears the local notice.
A lost/uncertain response, saved request after refresh, or storage problem
shows the existing persistent recovery panel. Its exact retry, deliberate
abandonment and saved-kit recovery controls remain available until the player
resolves the request. The private retry proof is still saved before submission;
there is no automatic retry or new seat operation.

Completed-action notices also retain their text until **Continue**, instead of
vanishing after 1.5 seconds. This is a local display control: the server has
already completed the action and human/AI play continues normally. New events
cannot replace the text being read. The optional toggle, bounded summaries,
private-information filtering and silent refresh baseline remain; see
[completed-action feedback](ACTION_FEEDBACK.md).

The follow-up audit also covers instructions replaced by a quick server response,
even without a dismissal timer. Initial administrator creation, room/lobby controls,
removal, closure and archive requests now show only progress while awaiting their
first response. The same applies to AI permissions and handover creation,
cancellation and acceptance. Saved requests restored after refresh and uncertain
results retain their recovery controls; explicitly retrying leaves those controls
visible and disabled until the response. Private retry proofs are still saved
before dispatch, independently of whether recovery instructions are visible.

Successful seat recovery and handover show a confirmation above the table with
**Continue**, including the previous owner's/session's revoked access. It remains
while the player reads or plays; background polling and new actions do not clear
it. Continue dismisses only the message. Leaving or reloading the page clears this
local confirmation, without changing the recovered seat.

Errors and recovery prompts have explicit controls; component inspectors have
close buttons. The shared toast provider also defaults to no automatic timeout;
its standard notice list provides a visible **Dismiss** button. Network
progress, polling deadlines and permission-expiry
countdowns keep their existing behavior.

## Verification

24 October user-report follow-up: a fresh local create at source revision
`59aa56af2bd2b98f5996fadb888019b3ebb53498` showed only concise progress, then
**Room created** with **Continue**. The confirmation remained readable for at
least 30 seconds through background polling and a player-circle change.
Continue removed only the notice; the same room and selected circle remained.
The dedicated QA room and screenshot are preserved. The three focused
notice/entry/seat test files pass **23/23**. A bounded source audit found no
remaining automatic dismissal of actionable text: action notices and room/seat
confirmations use Continue, standard toasts use Dismiss, and uncertain request
instructions retain their recovery controls. No application callers override
the toast provider's no-timeout default.

The same follow-up read the live homepage at **dune.procrastination.games**:
it still identifies `716304bb9ed7bcf73202e07712de7c6d857ddc0c`, predating the
room-confirmation fix in `999edb6`. This is an outstanding deployment gap;
no new application change or deployment was made for this recheck. The local
development server had been stopped and was started for this dedicated QA;
existing saved games were preserved. Private evidence is in
`/home/quintine/.local/share/dune/checkpoints/20261024-readable-notices-followup/`.

24 October deployed recheck: the public site displayed revision
`716304bb9ed7bcf73202e07712de7c6d857ddc0c`. A dedicated QA create request showed
the concise progress screen, then opened its lobby without a persistent room
confirmation. That deployed revision predates the **Room created / Room joined**
Continue confirmation added in `999edb6`; it does not verify the current source.
The current action-notice, room-entry client and seat-confirmation tests pass
**23/23**. The QA room and private screenshot/observation are preserved outside
Git. No deployment or server restart was performed. Recheck actual create/join
confirmation retention and Continue after deploying a revision containing the
fix; production acceptance for that fix remains open.

18 October follow-up: local QA room NAZLA8P4 kept its unread confirmation for
43 seconds through background polling and a normal player-circle change.
Continue removed only the notice; the same room stayed open and subsequent
polls did not restore the notice. The screenshot and browser record are kept
outside Git. No console errors; focused23/23 existing entry/notice/seat tests,
types/lint and production build pass. The dedicated QA room is preserved.
This is local evidence; deployed verification remains open.


Browser QA uses dedicated rooms and a temporary local transport that delays the
first response and can lose one successful create response. This verifies actual
rendered progress, durable recovery instructions, and explicit same-request retry
without introducing production timing changes. Existing room-entry regressions
cover retry identity, storage failure, ambiguous responses and no duplicate
creates; notice regressions cover retention, continuation, summaries and mute.

Record browser, source-bound checks and deployed acceptance separately. Test
normal create/join and notice controls on the deployed revision; a local delayed
transport test does not establish production behavior. Preserve existing games.
