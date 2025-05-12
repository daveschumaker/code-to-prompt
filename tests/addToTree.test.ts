import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('--add-to-tree option', () => {
  let tmpDir: string;
  let fileA: string;
  let fileB: string;
  const contentA = 'alpha';
  const contentB = 'beta';

  beforeAll(() => {
    // Create a temporary directory for testing
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-add-to-tree-'));
    fileA = path.join(tmpDir, 'a.txt');
    fileB = path.join(tmpDir, 'b.txt');
    fs.writeFileSync(fileA, contentA);
    fs.writeFileSync(fileB, contentB);
  });

  it('includes add-to-tree paths in the tree but skips their content', () => {
    // Resolve real paths to account for possible symlinks (e.g., /var vs /private/var)
    const realFileA = fs.realpathSync(fileA);
    const realFileB = fs.realpathSync(fileB);
    // Invoke the CLI in the temp directory
    const cliPath = path.join(__dirname, '..', 'dist', 'index.js');
    const res = spawnSync(
      'node',
      ['--no-warnings', cliPath, '--tree', '--add-to-tree', 'b.txt', 'a.txt'],
      { cwd: tmpDir, encoding: 'utf8' }
    );
    // Expect successful execution
    expect(res.status).toBe(0);

    const stdout = res.stdout || '';
    const lines = stdout.split(/\r?\n/);

    // Check tree header
    expect(lines[0]).toBe('Folder structure:');
    // The second line is the root path with trailing separator
    expect(lines[1].endsWith(path.sep)).toBe(true);
    expect(lines[1]).toContain(path.basename(tmpDir));
    // Separator line before tree entries
    expect(lines[2]).toBe('---');

    // Ensure both files appear in the ASCII tree
    expect(lines).toContain('├── a.txt');
    expect(lines).toContain('└── b.txt');

    // After tree, the CLI should output content for a.txt only
    // It prints "File: <path>" for each content block
    expect(stdout).toContain(`File: ${realFileA}`);
    expect(stdout).toContain(contentA);
    // b.txt content should not be included
    expect(stdout).not.toContain(`File: ${realFileB}`);
    expect(stdout).not.toContain(contentB);
  });
});