import fs from 'fs';
import fsp from 'fs/promises';
import os from 'os';
import path from 'path';
import { loadIgnore } from '../../src/cli/ignore';

describe('loadIgnore', () => {
  const originalCwd = process.cwd();
  let tmpDir: string;
  let debug: jest.Mock;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ignore-test-'));
    process.chdir(tmpDir);
    debug = jest.fn();
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns default ignore instance when no .gitignore exists', async () => {
    const argv: any = { 'ignore-gitignore': false };
    const { mainIg, baseIgnorePath } = await loadIgnore(argv, debug);
    // baseIgnorePath may expand symlinks (e.g., /private/var vs /var)
    expect(baseIgnorePath).toBe(fs.realpathSync(tmpDir));
    expect(mainIg.ignores('foo.txt')).toBe(false);
    expect(mainIg.ignores('some/path')).toBe(false);
    expect(debug).toHaveBeenCalledWith(expect.stringContaining('No .gitignore file found'));
  });

  it('returns default ignore instance when .gitignore is empty or comments only', async () => {
    const gitignorePath = path.join(tmpDir, '.gitignore');
    await fsp.writeFile(gitignorePath, '# comment only\n\n', 'utf-8');
    const argv: any = { 'ignore-gitignore': false };
    const { mainIg, baseIgnorePath } = await loadIgnore(argv, debug);
    expect(baseIgnorePath).toBe(fs.realpathSync(tmpDir));
    expect(mainIg.ignores('foo.txt')).toBe(false);
    expect(debug).toHaveBeenCalledWith(expect.stringContaining('No rules found in'));
  });

  it('loads patterns from .gitignore correctly', async () => {
    const rules = ['node_modules/', '*.log', 'build/*.tmp'];
    const gitignorePath = path.join(tmpDir, '.gitignore');
    const content = [
      '# ignore folder',
      rules[0],
      '',
      '# ignore logs',
      rules[1],
      rules[2],
    ].join('\n');
    await fsp.writeFile(gitignorePath, content, 'utf-8');
    const argv: any = { 'ignore-gitignore': false };
    const { mainIg } = await loadIgnore(argv, debug);
    expect(mainIg.ignores('node_modules/index.js')).toBe(true);
    expect(mainIg.ignores('error.log')).toBe(true);
    expect(mainIg.ignores('build/foo.tmp')).toBe(true);
    expect(mainIg.ignores('src/index.js')).toBe(false);
    expect(debug).toHaveBeenCalledWith(expect.stringContaining('Initializing ignore patterns'));
  });

  it('skips loading .gitignore when ignore-gitignore flag is true', async () => {
    const gitignorePath = path.join(tmpDir, '.gitignore');
    await fsp.writeFile(gitignorePath, 'foo\nbar', 'utf-8');
    const argv: any = { 'ignore-gitignore': true };
    const { mainIg, baseIgnorePath } = await loadIgnore(argv, debug);
    expect(baseIgnorePath).toBe(fs.realpathSync(tmpDir));
    expect(mainIg.ignores('foo')).toBe(false);
    expect(debug).toHaveBeenCalledWith(expect.stringContaining('Ignoring .gitignore'));
  });
});