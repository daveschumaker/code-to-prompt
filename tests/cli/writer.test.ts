import fs from 'fs';
import fsp from 'fs/promises';
import os from 'os';
import path from 'path';
import chalk from 'chalk';
import { createWriter } from '../../src/cli/writer';
import * as clipWriter from '../../src/lib/clipWriter';

describe('createWriter', () => {
  const debug = jest.fn();

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('writes to stdout when no output or clipboard flags are set', async () => {
    const argv: any = {};
    const writes: string[] = [];
    const origWrite = process.stdout.write;
    process.stdout.write = ((chunk: any) => {
      writes.push(chunk.toString());
      return true;
    }) as any;
    const { writer, finalize } = await createWriter(argv, debug as any);
    writer('line1');
    writer('line2');
    await finalize();
    process.stdout.write = origWrite;
    expect(writes).toEqual(['line1\n', 'line2\n']);
  });

  it('writes to a file and updates mtime when output flag is set', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'writer-test-'));
    const outFile = path.join(tmpDir, 'out.txt');
    const argv: any = { output: outFile };
    const before = new Date();
    const { writer, finalize } = await createWriter(argv, debug as any);
    writer('foo');
    writer('bar');
    await finalize();
    const content = await fsp.readFile(outFile, 'utf-8');
    expect(content).toBe('foo\nbar\n');
    const stats = await fsp.stat(outFile);
    expect(stats.mtime.getTime()).toBeGreaterThanOrEqual(before.getTime());
  });

  it('buffers and writes to clipboard when clipboard flag is set', async () => {
    const argv: any = { clipboard: true };
    const spy = jest.spyOn(clipWriter, 'writeClipboardSafe').mockResolvedValue(undefined);
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { writer, finalize } = await createWriter(argv, debug as any);
    writer('A');
    writer('B');
    await finalize();
    expect(spy).toHaveBeenCalledWith('A\nB\n');
    expect(errSpy).toHaveBeenCalledWith(chalk.green('Output successfully copied to clipboard.'));
  });
});