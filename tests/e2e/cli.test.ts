// tests/e2e/cli.test.ts (conceptual)
import { spawnSync } from 'child_process';
import path from 'path';
import os from 'os';
import fs from 'fs/promises'; // Or use fs-extra for easier temp dir handling

const cliEntryPoint = path.resolve(__dirname, '../../dist/index.js');
// we will use os.tmpdir() instead of a fixturesDir

describe('CLI End-to-End Tests', () => {
  let tempTestDir: string;

  beforeEach(async () => {
    // Create a temporary directory for the test run
    tempTestDir = await fs.mkdtemp(
      path.join(os.tmpdir(), 'code-to-prompt-test-run-')
    );
    // Create sample.txt and .gitignore in the temp directory
    await fs.writeFile(path.join(tempTestDir, 'sample.txt'), '');
    await fs.writeFile(
      path.join(tempTestDir, '.gitignore'),
      '*.log\nnode_modules/'
    );
  });

  afterEach(async () => {
    // Clean up the temporary directory
    await fs.rm(tempTestDir, { recursive: true, force: true });
  });

  it('should process a single file with default output', async () => {
    const filePath = path.join(tempTestDir, 'sample.txt');
    // Ensure file content exists before running
    await fs.writeFile(filePath, 'Hello World!');

    const result = spawnSync('node', [cliEntryPoint, filePath], {
      cwd: tempTestDir,
      encoding: 'utf-8'
    });

    // Expect stderr to contain stats, but not fatal errors like "Error:"
    expect(result.stderr).toContain('Stats:');
    expect(result.stderr).not.toContain('Error:');
    expect(result.status).toBe(0); // Expect successful exit code
    expect(result.stdout).toContain(`File: ${filePath}`);
    expect(result.stdout).toContain('---');
    expect(result.stdout).toContain('Hello World!');
  });

  it('should handle the --line-numbers flag', async () => {
    const filePath = path.join(tempTestDir, 'sample.txt');
    await fs.writeFile(filePath, 'Line 1\nLine 2');

    const result = spawnSync(
      'node',
      [cliEntryPoint, '--line-numbers', filePath],
      { cwd: tempTestDir, encoding: 'utf-8' }
    );

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('1  Line 1');
    expect(result.stdout).toContain('2  Line 2');
  });

  it('should respect .gitignore', async () => {
    // Make sure the test function is async
    const ignoredFilePath = path.join(tempTestDir, 'test.log');
    const includedFilePath = path.join(tempTestDir, 'test.txt');
    await fs.writeFile(ignoredFilePath, 'This should be ignored');
    await fs.writeFile(includedFilePath, 'This should be included');

    // --- Get the real, resolved paths ---
    const realIncludedPath = await fs.realpath(includedFilePath);
    const realIgnoredPath = await fs.realpath(ignoredFilePath);
    // --- ---

    // Run on the directory
    const result = spawnSync('node', [cliEntryPoint, '.'], {
      cwd: tempTestDir,
      encoding: 'utf-8'
    });

    expect(result.status).toBe(0);
    // --- Use the resolved paths in assertions ---
    expect(result.stdout).toContain(`File: ${realIncludedPath}`); // Use real path here
    expect(result.stdout).not.toContain(`File: ${realIgnoredPath}`); // Use real path here too
    // --- ---
  });

  // Additional flag combinations and modes
  it('should output debug logs when verbose is used', async () => {
    const filePath = path.join(tempTestDir, 'sample.txt');
    await fs.writeFile(filePath, 'test');
    const result = spawnSync('node', [cliEntryPoint, '--verbose', filePath], {
      cwd: tempTestDir,
      encoding: 'utf-8'
    });
    expect(result.status).toBe(0);
    expect(result.stderr).toContain('Processing path:');
  });

  it('should prepend tree and add line numbers when both --tree and --line-numbers are used', async () => {
    const filePath = path.join(tempTestDir, 'sample.txt');
    await fs.writeFile(filePath, 'a\nb');
    const result = spawnSync('node', [cliEntryPoint, '--tree', '--line-numbers', filePath], {
      cwd: tempTestDir,
      encoding: 'utf-8'
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Folder structure:');
    expect(result.stdout).toContain('1  a');
    expect(result.stdout).toContain('2  b');
  });

  it('should wrap output in XML when --cxml is used', async () => {
    const filePath = path.join(tempTestDir, 'sample.txt');
    await fs.writeFile(filePath, '<&>');
    const result = spawnSync('node', [cliEntryPoint, '--cxml', filePath], {
      cwd: tempTestDir,
      encoding: 'utf-8'
    });
    expect(result.status).toBe(0);
    expect(result.stdout.trim().startsWith('<documents>')).toBe(true);
    expect(result.stdout).toContain('&lt;&amp;&gt;');
    expect(result.stdout.trim().endsWith('</documents>')).toBe(true);
  });

  it('should generate tree relative to target path when target is outside cwd', async () => {
    // Create a target directory *outside* the main tempTestDir
    const externalTargetDir = await fs.mkdtemp(
      path.join(os.tmpdir(), 'code-to-prompt-external-target-')
    );
    const targetFileName = 'external_sample.txt';
    const targetFilePath = path.join(externalTargetDir, targetFileName);

    try {
      await fs.writeFile(targetFilePath, 'External content');

      // Run the command from tempTestDir, but target externalTargetDir
      const result = spawnSync(
        'node',
        [cliEntryPoint, '--tree', externalTargetDir], // Target the external dir
        {
          cwd: tempTestDir, // Run from the standard test CWD
          encoding: 'utf-8'
        }
      );

      expect(result.status).toBe(0);
      expect(result.stderr).toContain('Stats:');
      expect(result.stderr).not.toContain('Error:');

      // Check that the tree root is the external target directory
      expect(result.stdout).toContain('Folder structure:');
      expect(result.stdout).toContain(externalTargetDir + path.sep); // Check the correct root path is printed

      // Check the tree structure relative to the external target directory
      const expectedTreeStructure = `.\n└── ${targetFileName}`;
      // Normalize line endings just in case
      const normalizedStdout = result.stdout.replace(/\r\n/g, '\n');
      const treeStartIndex = normalizedStdout.indexOf('---\n') + 4; // Find start of tree after first '---'
      const treeEndIndex = normalizedStdout.indexOf('\n---', treeStartIndex); // Find end of tree before second '---'
      const actualTree = normalizedStdout.substring(treeStartIndex, treeEndIndex).trim();

      expect(actualTree).toBe(expectedTreeStructure);

      // Check that the file content is also included after the tree
      expect(result.stdout).toContain(`File: ${targetFilePath}`);
      expect(result.stdout).toContain('External content');

    } finally {
      // Clean up the external directory
      await fs.rm(externalTargetDir, { recursive: true, force: true });
    }
  });
});
