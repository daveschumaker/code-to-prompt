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
    const result = spawnSync(
      'node',
      [cliEntryPoint, '--tree', '--line-numbers', filePath],
      {
        cwd: tempTestDir,
        encoding: 'utf-8'
      }
    );
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
      const actualTree = normalizedStdout
        .substring(treeStartIndex, treeEndIndex)
        .trim();

      expect(actualTree).toBe(expectedTreeStructure);

      // Check that the file content is also included after the tree
      expect(result.stdout).toContain(`File: ${targetFilePath}`);
      expect(result.stdout).toContain('External content');
    } finally {
      // Clean up the external directory
      await fs.rm(externalTargetDir, { recursive: true, force: true });
    }
  });

  it('should generate tree relative to common ancestor when multiple paths outside cwd are given', async () => {
    // Create a structure outside the main tempTestDir
    const externalBaseDir = await fs.mkdtemp(
      path.join(os.tmpdir(), 'code-to-prompt-external-multi-')
    );
    const subDir1 = path.join(externalBaseDir, 'sub1');
    const subDir2 = path.join(externalBaseDir, 'sub2');
    const file1Path = path.join(subDir1, 'file1.txt');
    const file2Path = path.join(subDir2, 'file2.txt');

    try {
      await fs.mkdir(subDir1);
      await fs.mkdir(subDir2);
      await fs.writeFile(file1Path, 'Content file 1');
      await fs.writeFile(file2Path, 'Content file 2');

      // Run the command from tempTestDir, targeting the two external files/dirs
      const result = spawnSync(
        'node',
        [cliEntryPoint, '--tree', file1Path, subDir2], // Target file and dir
        {
          cwd: tempTestDir, // Run from the standard test CWD
          encoding: 'utf-8'
        }
      );

      expect(result.status).toBe(0);
      expect(result.stderr).toContain('Stats:');
      expect(result.stderr).not.toContain('Error:');

      // Check that the tree root is the common ancestor directory
      expect(result.stdout).toContain('Folder structure:');
      // Use path.dirname to be sure we get the directory containing the files/dirs
      const expectedRootDir = externalBaseDir;
      expect(result.stdout).toContain(expectedRootDir + path.sep);

      // Check the tree structure relative to the common ancestor
      // Note: path.sep is crucial for cross-platform compatibility
      const expectedTreeStructure = [
        '.',
        `├── sub1`,
        `│   └── file1.txt`,
        `└── sub2`,
        `    └── file2.txt`
      ].join('\n');

      const normalizedStdout = result.stdout.replace(/\r\n/g, '\n');
      const treeStartIndex = normalizedStdout.indexOf('---\n') + 4;
      const treeEndIndex = normalizedStdout.indexOf('\n---', treeStartIndex);
      const actualTree = normalizedStdout
        .substring(treeStartIndex, treeEndIndex)
        .trim();

      // Normalize path separators in actual tree for comparison if needed (though generateFileTree should use path.sep)
      expect(actualTree).toBe(expectedTreeStructure);

      // Check that the file contents are also included
      expect(result.stdout).toContain(`File: ${file1Path}`);
      expect(result.stdout).toContain('Content file 1');
      expect(result.stdout).toContain(`File: ${file2Path}`);
      expect(result.stdout).toContain('Content file 2');
    } finally {
      // Clean up the external directory structure
      await fs.rm(externalBaseDir, { recursive: true, force: true });
    }
  });

  it('should filter binary files by default and include them with --include-binary flag', async () => {
    // Create a binary file (PNG) and a text file
    const binaryFilePath = path.join(tempTestDir, 'sample.png');
    const textFilePath = path.join(tempTestDir, 'sample.txt');

    // Create a simple binary content (not a valid PNG, but has binary characteristics)
    const binaryContent = Buffer.from([
      0x89,
      0x50,
      0x4e,
      0x47,
      0x0d,
      0x0a,
      0x1a,
      0x0a, // PNG signature
      0x00,
      0x00,
      0x00,
      0x0d, // IHDR chunk length
      0x49,
      0x48,
      0x44,
      0x52 // IHDR chunk type
    ]);

    await fs.writeFile(binaryFilePath, binaryContent);
    await fs.writeFile(textFilePath, 'Text content');

    // Get real paths for assertions
    const realBinaryPath = await fs.realpath(binaryFilePath);
    const realTextPath = await fs.realpath(textFilePath);

    // Run without --include-binary flag (default behavior)
    const withoutFlag = spawnSync('node', [cliEntryPoint, '.'], {
      cwd: tempTestDir,
      encoding: 'utf-8'
    });

    // Run with --include-binary flag
    const withFlag = spawnSync(
      'node',
      [cliEntryPoint, '--include-binary', '.'],
      { cwd: tempTestDir, encoding: 'utf-8' }
    );

    // Default behavior: binary file should be excluded
    expect(withoutFlag.status).toBe(0);
    expect(withoutFlag.stdout).not.toContain(`File: ${realBinaryPath}`);
    expect(withoutFlag.stdout).toContain(`File: ${realTextPath}`);
    expect(withoutFlag.stdout).toContain('Text content');

    // With --include-binary: binary file should be included
    expect(withFlag.status).toBe(0);
    expect(withFlag.stdout).toContain(`File: ${realBinaryPath}`);
    expect(withFlag.stdout).toContain(`File: ${realTextPath}`);
  });

  it('should exclude binary files from tree view by default', async () => {
    // Create a binary file and a text file
    const binaryFilePath = path.join(tempTestDir, 'image.png');
    const textFilePath = path.join(tempTestDir, 'document.txt');

    await fs.writeFile(binaryFilePath, Buffer.from([0x89, 0x50, 0x4e, 0x47])); // PNG signature
    await fs.writeFile(textFilePath, 'Text content');

    // Run with tree view, without --include-binary flag
    const resultWithoutBinary = spawnSync(
      'node',
      [cliEntryPoint, '--tree', '.'],
      { cwd: tempTestDir, encoding: 'utf-8' }
    );

    // Run with tree view and --include-binary flag
    const resultWithBinary = spawnSync(
      'node',
      [cliEntryPoint, '--tree', '--include-binary', '.'],
      { cwd: tempTestDir, encoding: 'utf-8' }
    );

    // Without --include-binary: binary file should not be in tree
    expect(resultWithoutBinary.status).toBe(0);
    expect(resultWithoutBinary.stdout).toContain('document.txt');
    expect(resultWithoutBinary.stdout).not.toContain('image.png');

    // With --include-binary: binary file should be in tree
    expect(resultWithBinary.status).toBe(0);
    expect(resultWithBinary.stdout).toContain('document.txt');
    expect(resultWithBinary.stdout).toContain('image.png');
  });

  it('should include only specified extensions when multiple -e flags are used', async () => {
    const jsFile = path.join(tempTestDir, 'file1.js');
    const tsFile = path.join(tempTestDir, 'file2.ts');
    const txtFile = path.join(tempTestDir, 'file3.txt');
    await fs.writeFile(jsFile, 'JS content');
    await fs.writeFile(tsFile, 'TS content');
    await fs.writeFile(txtFile, 'TXT content');

    const result = spawnSync(
      'node',
      [cliEntryPoint, '-e', '.js', '-e', '.ts', '.'],
      { cwd: tempTestDir, encoding: 'utf-8' }
    );

    expect(result.status).toBe(0);
    const realJs = await fs.realpath(jsFile);
    const realTs = await fs.realpath(tsFile);
    const realTxt = await fs.realpath(txtFile);
    expect(result.stdout).toContain(`File: ${realJs}`);
    expect(result.stdout).toContain(`File: ${realTs}`);
    expect(result.stdout).not.toContain(`File: ${realTxt}`);
  });

  it('should ignore files matching multiple --ignore patterns', async () => {
    const logFile = path.join(tempTestDir, 'a.log');
    const snapFile = path.join(tempTestDir, 'b.snap');
    const txtFile = path.join(tempTestDir, 'c.txt');
    await fs.writeFile(logFile, 'ignore me');
    await fs.writeFile(snapFile, 'ignore me too');
    await fs.writeFile(txtFile, 'include me');

    const result = spawnSync(
      'node',
      [cliEntryPoint, '--ignore', '*.log', '--ignore', '*.snap', '.'],
      { cwd: tempTestDir, encoding: 'utf-8' }
    );

    expect(result.status).toBe(0);
    const realLog = await fs.realpath(logFile);
    const realSnap = await fs.realpath(snapFile);
    const realTxt = await fs.realpath(txtFile);
    expect(result.stdout).not.toContain(`File: ${realLog}`);
    expect(result.stdout).not.toContain(`File: ${realSnap}`);
    expect(result.stdout).toContain(`File: ${realTxt}`);
  });

  it('applies --ignore patterns to the tree view', async () => {
    // Setup: create foo.ts, bar.js and baz.txt
    await fs.writeFile(path.join(tempTestDir, 'foo.ts'), '');
    await fs.writeFile(path.join(tempTestDir, 'bar.js'), '');
    await fs.writeFile(path.join(tempTestDir, 'baz.txt'), '');

    // Run with tree + ignore only .txt files
    const result = spawnSync(
      'node',
      [cliEntryPoint, '--tree', '--ignore', '*.txt', tempTestDir],
      { cwd: tempTestDir, encoding: 'utf-8' }
    );

    expect(result.status).toBe(0);
    // Extract tree block between first '---' delimiters
    const out = result.stdout.replace(/\r\n/g, '\n');
    const start = out.indexOf('---\n');
    const end = out.indexOf('\n---', start + 4);
    const treeBlock = out.substring(start + 4, end);
    // baz.txt should not appear in the tree
    expect(treeBlock).toContain('foo.ts');
    expect(treeBlock).toContain('bar.js');
    expect(treeBlock).not.toContain('baz.txt');
  });
});
