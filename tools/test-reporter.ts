import { Readable } from 'node:stream';
import { spec, type TestEvent } from 'node:test/reporters';

// Keep Node's assertion diffs, locations, diagnostics, counts and duration output.
// Omitting starts as well as passes keeps the spec reporter's nesting stack valid.
export default async function* reporter(source: AsyncIterable<TestEvent>) {
  async function* events(): AsyncGenerator<TestEvent> {
    let executed = 0;
    for await (const event of source) {
      // Aggregate counters can include a synthetic pass for an empty test file.
      // Worker summaries distinguish registered cases from that file-level result.
      if (event.type === 'test:summary' && event.data.file !== undefined)
        executed += event.data.counts.tests - event.data.counts.skipped;
      if (
        event.type === 'test:summary' &&
        event.data.file === undefined &&
        event.data.success &&
        executed === 0
      ) {
        // Node otherwise exits successfully when a name pattern matches no tests.
        process.exitCode = 1;
        yield {
          type: 'test:diagnostic' as const,
          data: {
            nesting: 0,
            level: 'error',
            message: 'No tests executed. Check --name and skipped tests.',
          },
        };
      }
      if (
        process.env.DUNE_TEST_VERBOSE !== '1' &&
        (event.type === 'test:pass' || event.type === 'test:start')
      )
        continue;
      yield event;
    }
  }
  yield* Readable.from(events()).pipe(new spec());
}
