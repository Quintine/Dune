import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import type * as Rooms from '../db/rooms';
import type * as RoomContinuation from '../db/room-continuation';

/** Load the production isolate-local continuation gate with fixture room calls. */
export function loadRoomContinuation(
  rooms: Pick<
    typeof Rooms,
    'continueRoomAutomatic' | 'continueRoomBots'
  >,
) {
  const exports = {};
  runInNewContext(
    ts.transpileModule(
      readFileSync(
        new URL('../db/room-continuation.ts', import.meta.url),
        'utf8',
      ),
      {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
        },
      },
    ).outputText,
    {
      exports,
      require: (name: string) => {
        if (name === './rooms') return rooms;
        throw new Error('Unexpected continuation dependency ' + name);
      },
    },
  );
  return exports as typeof RoomContinuation;
}
