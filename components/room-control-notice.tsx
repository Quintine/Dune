import type { RoomControl } from '@/lib/room-control';

/** Public operational status only; administrator reasons and identity stay private. */
export function RoomControlNotice({ control }: { control?: RoomControl }) {
  if (control?.closed) return <section className="notice" aria-label="Room availability" aria-live="polite">
    <h2 className="text-lg font-semibold">Room closed by an administrator</h2>
    <p>This room is closed to further play. Your table and discussion history remain readable. The saved position and pending choices are preserved; closing does not award a winner.</p>
    <p>New joins, game decisions, AI, messages and seat changes are stopped. Keep any unconfirmed request and recovery kit. Exact saved requests can still confirm an earlier completed action. An administrator can reopen the room.</p>
  </section>;
  if (!control?.paused && !control?.joinLocked) return null;
  return <section className="notice" aria-label="Room availability" aria-live="polite">
    {control.paused ? <>
      <h2 className="text-lg font-semibold">Room paused by an administrator</h2>
      <p>Player decisions and automatic play are paused. Your game and pending choices are saved. An administrator can resume this room.</p>
      <p>You can still read the table, use discussion, protect or recover your seat, and take back control from AI.</p>
    </> : <h2 className="text-lg font-semibold">New joins are locked</h2>}
    {control.joinLocked && <p>New players cannot join. Existing players can reconnect and recover their saved seats.</p>}
  </section>;
}
