import { spawn, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  closeSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  readlinkSync,
  realpathSync,
  writeFileSync,
} from 'node:fs';
import {
  resolve,
  relative,
  isAbsolute,
  dirname,
  basename,
  sep,
} from 'node:path';

export function sourceSnapshot(root: string) {
  const git = (...args: string[]) =>
    execFileSync('git', args, {
      cwd: root,
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
    });
  const files = [
    ...new Set(
      git('ls-files', '-z', '--cached', '--others', '--exclude-standard')
        .split('\0')
        .filter(Boolean),
    ),
  ].sort();
  const digest = createHash('sha256');
  for (const file of files) {
    const path = resolve(root, file);
    digest.update(JSON.stringify(file));
    try {
      const stat = lstatSync(path);
      digest.update(
        JSON.stringify([
          stat.mode,
          createHash('sha256')
            .update(
              stat.isSymbolicLink() ? readlinkSync(path) : readFileSync(path),
            )
            .digest('hex'),
        ]),
      );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      digest.update('deleted');
    }
  }
  return {
    commit: git('rev-parse', 'HEAD').trim(),
    tree: digest.digest('hex'),
    files: files.length,
  };
}

export function privateOutputDirectory(root: string, output: string) {
  // Resolve existing ancestors so a symlink cannot redirect artifacts into source.
  const path = resolve(
    realpathSync(dirname(resolve(output))),
    basename(output),
  );
  const rel = relative(realpathSync(root), path);
  if (!rel || (!rel.startsWith('..' + sep) && rel !== '..' && !isAbsolute(rel)))
    throw new Error('Write verification artifacts outside the checkout.');
  mkdirSync(path, { mode: 0o700 }); // Exclusive: existing results are never overwritten.
  return path;
}

export type VerificationStep = {
  name: string;
  command: string;
  args: string[];
};
export async function runVerification(
  root: string,
  output: string,
  steps: VerificationStep[],
) {
  if (!steps.length) throw new Error('Choose at least one verification step.');
  if (
    steps.some((s) => !/^[a-z0-9-]+$/.test(s.name)) ||
    new Set(steps.map((s) => s.name)).size !== steps.length
  )
    throw new Error('Verification steps need unique simple names.');
  const directory = privateOutputDirectory(root, output);
  const report = {
    format: 1,
    startedAt: new Date().toISOString(),
    finishedAt: '',
    before: sourceSnapshot(root),
    after: null as ReturnType<typeof sourceSnapshot> | null,
    status: 'running' as 'running' | 'passed' | 'failed' | 'source-changed',
    steps: [] as {
      name: string;
      command: string;
      args: string[];
      log: string;
      exitCode: number;
      durationMs: number;
    }[],
  };
  const save = () =>
    writeFileSync(
      resolve(directory, 'report.json'),
      JSON.stringify(report, null, 2) + '\n',
      { mode: 0o600 },
    );
  save();
  for (const step of steps) {
    const log = `${step.name}.log`,
      fd = openSync(resolve(directory, log), 'wx', 0o600),
      start = Date.now();
    let exitCode = 1;
    try {
      const child = spawn(step.command, step.args, {
        cwd: root,
        stdio: ['ignore', fd, fd],
        shell: false,
      });
      let interrupted = 0;
      const interrupt = () => {
          interrupted = 130;
          child.kill('SIGINT');
        },
        terminate = () => {
          interrupted = 143;
          child.kill('SIGTERM');
        };
      process.on('SIGINT', interrupt);
      process.on('SIGTERM', terminate);
      try {
        exitCode = await new Promise<number>((resolveExit) => {
          child.once('error', () => resolveExit(1));
          child.once('close', (code, signal) =>
            resolveExit(
              interrupted || (code ?? (signal === 'SIGINT' ? 130 : 1)),
            ),
          );
        });
      } finally {
        process.off('SIGINT', interrupt);
        process.off('SIGTERM', terminate);
      }
    } finally {
      closeSync(fd);
    }
    report.steps.push({
      ...step,
      log,
      exitCode,
      durationMs: Date.now() - start,
    });
    save();
    console.log(
      `${step.name}: ${exitCode === 0 ? 'passed' : 'FAILED'} (${report.steps.at(-1)!.durationMs} ms); ${resolve(directory, log)}`,
    );
    if (exitCode !== 0) break;
  }
  report.after = sourceSnapshot(root);
  report.finishedAt = new Date().toISOString();
  report.status = report.steps.some((s) => s.exitCode !== 0)
    ? 'failed'
    : report.before.tree !== report.after.tree ||
        report.before.commit !== report.after.commit
      ? 'source-changed'
      : 'passed';
  save();
  return report;
}
