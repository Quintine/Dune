# Optional table sounds

The connected sound prototype adds browser-local mute, volume and a test control
to the table header. It defaults to off at 35% volume. Settings are independent of
automatic visual notices and synchronize between tabs on the same origin. Storage
failure retains the preference in memory without interrupting play.

Two original sine-tone cues are synthesized with Web Audio: one for a new tagged
automatic action and two for a phase/status/turn transition. Audio uses only the
existing projected log sequences and public phase identity. It does not inspect
cards, plans, private resources, pending eligibility or other seats. It sends no
actions and changes neither rules, AI pacing nor persistent game state. No audio
download, external service or microphone permission is required.

Initial/restored snapshots establish a silent baseline. Later snapshots are
consumed even when muted, hidden or unable to play. A batch produces at most one
cue, phase changes take precedence, and a 700ms minimum interval drops rapid cues
without keeping a backlog. Log truncation and stale sequences do not replay
automatic events. Switching rooms establishes a fresh baseline.

Audio is unlocked only by a user gesture. A saved enabled preference needs a click
or key press after refresh before new cues can sound. Enable and Test sound offer
a sample. Volume zero is silent and disables Test sound. Mute, backgrounding and
unmount stop active tones; unmount closes the context. Failed/unsupported audio
remains cosmetic; a failed explicit preview reports that play can continue.
Audio is independent of reduced-motion settings.

## Evidence and limits

`tests/table-sound.test.tsx` checks initial/stale/duplicate snapshots, room changes,
silent consumption, coalescing, priority, bounded volume and voice duration,
gesture-only context creation, pending unlock cancellation, mute/disposal,
unavailable audio and accessible initial controls. Its fake audio context does
not prove physical speaker output or every browser's autoplay policy.

Browser verification covers the existing isolated saved seat, sound on/off,
keyboard volume, zero-volume test disabling, refresh persistence and same-origin
tab synchronization. The phone panel's bounds were checked at a 390px requested
viewport. Screenshot capture timed out, so this checkpoint does not claim visual
screenshot acceptance or audible output verification. No game action was needed
to change sound settings. Settings were returned to off and 35% afterward.

This is a functional prototype, not the final sound design. Successful powers
without an automatic notice tag remain outside these cues. Per-component audio,
broader device/browser acceptance and final sound mixing remain unfinished.
