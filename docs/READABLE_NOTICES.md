# Readable progress, recovery and action notices

The user reported that a popup after room creation disappeared before it could
be read or acted on. The first create/join request was rendering the full saved
request recovery panel while awaiting its initial response. Successful creation
then removed it immediately, making actionable recovery instructions appear to
flash on screen even when nothing had gone wrong.

First submissions now show only **Creating your room…** or **Joining the room…**
and a short progress message. Successful responses still open the confirmed
table. A lost/uncertain response, saved request after refresh, or storage problem
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

The notice audit found no other timer removing substantive text in app/component
flows. Errors and recovery prompts have explicit controls; component inspectors
have close buttons. Network progress, polling deadlines and permission-expiry
countdowns keep their existing behavior.

## Verification

Browser QA uses dedicated rooms and a temporary local transport that delays the
first response and can lose one successful create response. This verifies actual
rendered progress, durable recovery instructions, and explicit same-request retry
without introducing production timing changes. Existing room-entry regressions
cover retry identity, storage failure, ambiguous responses and no duplicate
creates; notice regressions cover retention, continuation, summaries and mute.

Record browser, source-bound checks and deployed acceptance separately. Test
normal create/join and notice controls on the deployed revision; a local delayed
transport test does not establish production behavior. Preserve existing games.
