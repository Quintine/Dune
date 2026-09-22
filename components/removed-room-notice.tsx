import { Button } from './ui/button';

export function RemovedRoomNotice({ code, busy, onRetry, onExit, exitDisabled }: { code: string; busy: boolean; onRetry: () => void; onExit: () => void; exitDisabled?: boolean }) {
  return <section className="notice" aria-labelledby="removed-room-title">
    <h1 id="removed-room-title">Room {code} has been removed</h1>
    <p>An administrator removed this room from active play. Its game, saved seats and pending choices are retained for restoration.</p>
    <p>Only an administrator can restore the room. Restoring it keeps existing seat ownership and access restrictions.</p>
    <p>Keep this tab open if a seat or room request is unconfirmed. Its exact retry details remain here; check for restoration before continuing.</p>
    <Button disabled={busy} onClick={onRetry}>{busy ? 'Checking room…' : 'Check for restoration'}</Button>
    <Button variant="outline" disabled={busy || exitDisabled} onClick={onExit}>Return home</Button>
  </section>;
}
