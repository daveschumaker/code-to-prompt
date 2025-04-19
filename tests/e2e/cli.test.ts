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

    expect(result.stderr).toBe(''); // Expect no errors printed to stderr
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

  // Add more tests for different flags, edge cases, stdin, output files etc.
});
