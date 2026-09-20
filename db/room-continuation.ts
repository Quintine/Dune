import { continueRoomAutomatic, continueRoomBots } from './rooms';

// Coalesce polls and control requests inside this isolate. Database CAS fences
// other isolates, restarts, seat recovery and human actions.
const continuations = new Map<string, Promise<void>>();
export function resumeRoom(code: string): Promise<void> {
  const existing = continuations.get(code);
  if (existing) return existing;
  const pending = (async () => {
    await continueRoomAutomatic(code);
    await continueRoomBots(code);
  })().finally(() => {
    if (continuations.get(code) === pending) continuations.delete(code);
  });
  continuations.set(code, pending);
  return pending;
}
