import os from 'os';
import fs from 'fs';
import path from 'path';
import { parseArgs } from '../src/cli/parser';

describe('CLI Argument Parser', () => {
  let originalArgv: string[];
  let originalXdg: string | undefined;
  let tmpXdgDir: string;

  beforeAll(() => {
    // Create a temporary XDG config directory to isolate loadConfig behavior
    tmpXdgDir = fs.mkdtempSync(path.join(os.tmpdir(), 'code-to-prompt-test-'));
  });

  beforeEach(() => {
    originalArgv = process.argv;
    originalXdg = process.env.XDG_CONFIG_HOME;
    process.env.XDG_CONFIG_HOME = tmpXdgDir;
  });

  afterEach(() => {
    process.argv = originalArgv;
    if (originalXdg === undefined) {
      delete process.env.XDG_CONFIG_HOME;
    } else {
      process.env.XDG_CONFIG_HOME = originalXdg;
    }
  });

  it('applies default values when no flags are given', async () => {
    process.argv = ['node', 'script.js'];
    const { argv } = await parseArgs();
    expect(argv.tree).toBe(false);
    expect(argv.extension).toEqual([]);
    expect(argv.markdown).toBe(false);
    expect(argv.cxml).toBe(false);
    expect(argv['add-to-tree']).toEqual([]);
  });

  it('parses multiple extensions and tree flag correctly', async () => {
    process.argv = ['node', 'script.js', '-e', '.ts', '-e', '.js', '--tree'];
    const { argv } = await parseArgs();
    expect(argv.extension).toEqual(['.ts', '.js']);
    expect(argv.tree).toBe(true);
  });

  it('parses multiple add-to-tree flags correctly', async () => {
    process.argv = [
      'node',
      'script.js',
      '--add-to-tree',
      'foo',
      '--add-to-tree',
      'bar',
    ];
    const { argv } = await parseArgs();
    expect(argv['add-to-tree']).toEqual(['foo', 'bar']);
  });

  it('throws on clipboard and output conflict', async () => {
    process.argv = ['node', 'script.js', '-C', '-o', 'out.txt'];
    await expect(parseArgs()).rejects.toThrow(/mutually exclusive/i);
  });

  it('throws on cxml and markdown conflict', async () => {
    process.argv = ['node', 'script.js', '-c', '-m'];
    await expect(parseArgs()).rejects.toThrow(/mutually exclusive/i);
  });

  it('errors on unknown option', async () => {
    process.argv = ['node', 'script.js', '--no-such-option'];
    await expect(parseArgs()).rejects.toThrow(/Unknown argument/);
  });
});