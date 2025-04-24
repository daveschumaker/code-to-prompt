import { processPath, ProcessPathOptions } from '../../src/lib/processor';
import { printPath, Writer } from '../../src/lib/printers';
import { DebugLogger } from '../../src/lib/config';
import { BINARY_FILE_EXTENSIONS } from '../../src/lib/constants';
import ignore, { Ignore } from 'ignore';
import path from 'path';
import fs from 'fs';
import fsp from 'fs/promises';
import { Dirent } from 'fs'; // Import Dirent type
import chalk from 'chalk'; // Import chalk for verifying debug messages

// --- Mocking Setup ---
jest.mock('fs/promises');
jest.mock('../../src/lib/printers'); // Mock the entire module

// --- Helper Types/Interfaces ---
interface MockDirentParams {
  name: string;
  isFile?: boolean;
  isDirectory?: boolean;
  isSymbolicLink?: boolean; // Add other types if needed
}

// --- Helper Functions ---

// Create a mock Dirent object
const createMockDirent = ({
  name,
  isFile = false,
  isDirectory = false,
  isSymbolicLink = false
}: MockDirentParams): Dirent => {
  const dirent = new fs.Dirent(); // Use actual Dirent constructor
  dirent.name = name;
  dirent.isFile = () => isFile;
  dirent.isDirectory = () => isDirectory;
  dirent.isSymbolicLink = () => isSymbolicLink;
  // Add mocks for other methods if necessary (isBlockDevice, isCharacterDevice, etc.)
  dirent.isBlockDevice = () => false;
  dirent.isCharacterDevice = () => false;
  dirent.isFIFO = () => false;
  dirent.isSocket = () => false;
  return dirent;
};

// Create mock fs.Stats object
const createMockStats = (isFile: boolean, isDirectory: boolean): fs.Stats => {
  // Create a plain object that matches the fs.Stats structure needed by the function
  return {
    isFile: () => isFile,
    isDirectory: () => isDirectory,
    isBlockDevice: () => false,
    isCharacterDevice: () => false,
    isSymbolicLink: () => false,
    isFIFO: () => false,
    isSocket: () => false,
    dev: 0,
    ino: 0,
    mode: 0,
    nlink: 0,
    uid: 0,
    gid: 0,
    rdev: 0,
    size: isFile ? 100 : 0, // Example size
    blksize: 4096,
    blocks: 1,
    atimeMs: Date.now(),
    mtimeMs: Date.now(),
    ctimeMs: Date.now(),
    birthtimeMs: Date.now(),
    atime: new Date(),
    mtime: new Date(),
    ctime: new Date(),
    birthtime: new Date()
  } as fs.Stats; // Cast to fs.Stats
};

describe('processPath', () => {
  let mockWriter: jest.MockedFunction<Writer>;
  let mockDebug: jest.MockedFunction<DebugLogger>;
  let mockStatsCounter: { foundFiles: number; skippedFiles: number }; // Renamed for clarity
  let mockMainIg: Ignore;
  let baseOptions: Omit<
    ProcessPathOptions,
    'writer' | 'debug' | 'stats' | 'mainIg'
  >;
  let mockPrintPath: jest.MockedFunction<typeof printPath>; // Typed mock for printPath

  // Define a base path for tests (use platform-specific separator)
  const baseProjectPath = path.resolve('/project');

  beforeEach(() => {
    // Reset mocks and stats before each test
    mockWriter = jest.fn();
    mockDebug = jest.fn();
    mockStatsCounter = { foundFiles: 0, skippedFiles: 0 };
    mockMainIg = ignore(); // Fresh ignore instance for each test

    // Reset mock file system operations
    jest.clearAllMocks();

    // Mock printPath from the printers module
    mockPrintPath = printPath as jest.MockedFunction<typeof printPath>;
    // Use mockImplementation for async void functions
    mockPrintPath.mockImplementation(async () => {}); // Default mock implementation

    // Default options for most tests
    baseOptions = {
      extensions: [],
      includeHidden: false,
      ignoreFilesOnly: false,
      ignorePatterns: [],
      claudeXml: false,
      markdown: false,
      lineNumbers: false,
      baseIgnorePath: baseProjectPath, // Use consistent base path
      tree: false, // Tree generation is handled before processPath
      includeBinaryFiles: false
    };

    // --- Default Mock Implementations ---
    // Mock fsp.stat to return basic stats or throw ENOENT
    (fsp.stat as jest.Mock).mockImplementation(async (p: string) => {
      // Default: assume path exists and is a directory unless overridden
      // console.log(`Mock fsp.stat called for: ${p}`); // Debugging mock calls
      if (
        p.endsWith('.txt') ||
        p.endsWith('.js') ||
        p.endsWith('.ts') ||
        p.endsWith('.log') ||
        p.endsWith('.tmp') ||
        BINARY_FILE_EXTENSIONS.some((ext) => p.toLowerCase().endsWith(ext))
      ) {
        return createMockStats(true, false); // Assume files based on common extensions
      }
      // Add specific checks for known directories if needed
      if (
        p === baseProjectPath ||
        p.includes('src') ||
        p.includes('node_modules') ||
        p.includes('build') ||
        p.includes('.git')
      ) {
        return createMockStats(false, true); // Assume directory
      }
      // Default throw for unknown paths
      const error: NodeJS.ErrnoException = new Error(
        `ENOENT: no such file or directory, stat '${p}'`
      );
      error.code = 'ENOENT';
      throw error;
    });

    // Mock fsp.readdir to return empty array by default
    (fsp.readdir as jest.Mock).mockResolvedValue([]);

    // Mock fsp.readFile to return empty string by default
    (fsp.readFile as jest.Mock).mockResolvedValue('');
  });

  // --- Helper Function to Run processPath ---
  const runProcessPath = (
    targetPathRelative: string,
    optionsOverrides: Partial<ProcessPathOptions> = {}
  ) => {
    const options: ProcessPathOptions = {
      ...baseOptions,
      ...optionsOverrides, // Apply overrides
      // Ensure these are always fresh/mocked instances
      writer: mockWriter,
      debug: mockDebug,
      stats: mockStatsCounter,
      mainIg: mockMainIg // Use the potentially modified mockMainIg
    };
    // Resolve the target path against the baseIgnorePath for consistency
    const absoluteTargetPath = path.resolve(
      options.baseIgnorePath,
      targetPathRelative
    );
    return processPath(absoluteTargetPath, options);
  };

  // --- Test Scenarios ---

  describe('File Handling', () => {
    const filePathRelative = 'file.txt';
    const absoluteFilePath = path.resolve(baseProjectPath, filePathRelative);

    beforeEach(() => {
      // Ensure stat mock returns 'file' for this path
      (fsp.stat as jest.Mock).mockResolvedValue(createMockStats(true, false));
    });

    test('should process a basic file', async () => {
      (fsp.readFile as jest.Mock).mockResolvedValue('File content'); // Mock content
      await runProcessPath(filePathRelative);

      expect(fsp.stat).toHaveBeenCalledWith(absoluteFilePath);
      expect(fsp.readFile).toHaveBeenCalledWith(absoluteFilePath, 'utf-8');
      expect(mockPrintPath).toHaveBeenCalledWith(
        mockWriter,
        absoluteFilePath, // Should be called with absolute path
        'File content',
        false, // claudeXml
        false, // markdown
        false // lineNumbers
      );
      expect(mockStatsCounter.foundFiles).toBe(1);
      expect(mockStatsCounter.skippedFiles).toBe(0);
      expect(mockDebug).toHaveBeenCalledWith(
        chalk.cyan(`Processing path: ${absoluteFilePath}`)
      );
      expect(mockDebug).toHaveBeenCalledWith(
        chalk.cyan(`Reading file: ${absoluteFilePath}`)
      );
      expect(mockDebug).toHaveBeenCalledWith(
        chalk.cyan(`Printing file: ${absoluteFilePath}`)
      );
    });

    test('should skip file due to extension mismatch', async () => {
      await runProcessPath(filePathRelative, { extensions: ['.js', '.ts'] });
      expect(mockPrintPath).not.toHaveBeenCalled();
      expect(mockStatsCounter.foundFiles).toBe(0);
      expect(mockStatsCounter.skippedFiles).toBe(1);
      expect(mockDebug).toHaveBeenCalledWith(
        chalk.yellow(
          `Skipping file (ext mismatch): ${path.basename(absoluteFilePath)}`
        )
      );
    });

    test('should process file with matching extension', async () => {
      await runProcessPath(filePathRelative, { extensions: ['.txt'] });
      expect(mockPrintPath).toHaveBeenCalled();
      expect(mockStatsCounter.foundFiles).toBe(1);
      expect(mockStatsCounter.skippedFiles).toBe(0);
      expect(mockDebug).toHaveBeenCalledWith(
        chalk.green(
          `File passed extension filter: ${path.basename(absoluteFilePath)}`
        )
      );
    });

    test('should skip hidden file by default', async () => {
      const hiddenFilePathRelative = '.hiddenfile.txt';
      const absoluteHiddenPath = path.resolve(
        baseProjectPath,
        hiddenFilePathRelative
      );
      // Mock stat specifically for this hidden file path
      (fsp.stat as jest.Mock).mockResolvedValueOnce(
        createMockStats(true, false)
      );

      await runProcessPath(hiddenFilePathRelative);
      expect(mockPrintPath).not.toHaveBeenCalled();
      // Skipped files stat is incremented based on filters *after* hidden check in current code
      expect(mockStatsCounter.foundFiles).toBe(0);
      expect(mockStatsCounter.skippedFiles).toBe(0); // Hidden files are skipped *before* incrementing skipped stat
      expect(mockDebug).toHaveBeenCalledWith(
        chalk.yellow(`    Skipping hidden: ${path.basename(absoluteHiddenPath)}`)
      );
    });

    test('should include hidden file when includeHidden is true', async () => {
      const hiddenFilePathRelative = '.hiddenfile.txt';
      const absoluteHiddenPath = path.resolve(
        baseProjectPath,
        hiddenFilePathRelative
      );
      (fsp.stat as jest.Mock).mockResolvedValueOnce(
        createMockStats(true, false)
      );
      (fsp.readFile as jest.Mock).mockResolvedValueOnce('Hidden content');

      await runProcessPath(hiddenFilePathRelative, { includeHidden: true });
      expect(mockPrintPath).toHaveBeenCalledWith(
        mockWriter,
        absoluteHiddenPath,
        'Hidden content',
        false,
        false,
        false
      );
      expect(mockStatsCounter.foundFiles).toBe(1);
      expect(mockStatsCounter.skippedFiles).toBe(0);
    });

    test('should skip file via .gitignore pattern', async () => {
      mockMainIg = ignore().add('*.log'); // Add ignore rule to the instance
      const logFilePathRelative = 'app.log';
      const absoluteLogPath = path.resolve(baseProjectPath, logFilePathRelative);
      (fsp.stat as jest.Mock).mockResolvedValueOnce(
        createMockStats(true, false)
      );

      // Pass the modified mockMainIg via optionsOverrides (or rely on beforeEach setup)
      await runProcessPath(logFilePathRelative, { mainIg: mockMainIg });
      expect(mockPrintPath).not.toHaveBeenCalled();
      expect(mockStatsCounter.foundFiles).toBe(0);
      // Skipped files stat is incremented based on filters *after* gitignore check
      expect(mockStatsCounter.skippedFiles).toBe(0); // Gitignored files are skipped *before* incrementing skipped stat
      expect(mockDebug).toHaveBeenCalledWith(
        expect.stringContaining(
          `Skipping due to ignore rules: ${path.basename(absoluteLogPath)}`
        )
      );
    });

    test('should skip file via options.ignorePatterns', async () => {
      const tempFilePathRelative = 'temp.tmp';
      const absoluteTempPath = path.resolve(
        baseProjectPath,
        tempFilePathRelative
      );
      (fsp.stat as jest.Mock).mockResolvedValueOnce(
        createMockStats(true, false)
      );

      await runProcessPath(tempFilePathRelative, { ignorePatterns: ['*.tmp'] });
      expect(mockPrintPath).not.toHaveBeenCalled();
      expect(mockStatsCounter.foundFiles).toBe(0);
      expect(mockStatsCounter.skippedFiles).toBe(1); // Custom ignore patterns increment skipped stat
      expect(mockDebug).toHaveBeenCalledWith(
        chalk.yellow(
          `Skipping file due to --ignore pattern: ${path.basename(
            absoluteTempPath
          )}`
        )
      );
    });

    test('should skip binary file by default', async () => {
      const binaryFilePathRelative = 'image.png'; // .png is in BINARY_FILE_EXTENSIONS
      const absoluteBinaryPath = path.resolve(
        baseProjectPath,
        binaryFilePathRelative
      );
      (fsp.stat as jest.Mock).mockResolvedValueOnce(
        createMockStats(true, false)
      );

      await runProcessPath(binaryFilePathRelative);
      expect(mockPrintPath).not.toHaveBeenCalled();
      expect(mockStatsCounter.foundFiles).toBe(0);
      expect(mockStatsCounter.skippedFiles).toBe(1); // Binary files increment skipped stat
      expect(mockDebug).toHaveBeenCalledWith(
        expect.stringContaining(
          `Skipping binary file: ${path.basename(absoluteBinaryPath)}`
        )
      );
    });

    test('should include binary file when includeBinaryFiles is true', async () => {
      const binaryFilePathRelative = 'image.png';
      const absoluteBinaryPath = path.resolve(
        baseProjectPath,
        binaryFilePathRelative
      );
      (fsp.stat as jest.Mock).mockResolvedValueOnce(
        createMockStats(true, false)
      );
      (fsp.readFile as jest.Mock).mockResolvedValueOnce('binary content'); // Mock read for binary

      await runProcessPath(binaryFilePathRelative, {
        includeBinaryFiles: true
      });
      expect(mockPrintPath).toHaveBeenCalledWith(
        mockWriter,
        absoluteBinaryPath,
        'binary content',
        false,
        false,
        false
      );
      expect(mockStatsCounter.foundFiles).toBe(1);
      expect(mockStatsCounter.skippedFiles).toBe(0);
    });

    test('should handle file read error gracefully', async () => {
      const error = new Error('Read permission denied');
      (fsp.readFile as jest.Mock).mockRejectedValue(error);
      // Mock console.error to check warning message
      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation();

      await runProcessPath(filePathRelative);

      expect(mockPrintPath).not.toHaveBeenCalled(); // printPath isn't called if readFile fails
      expect(mockStatsCounter.foundFiles).toBe(0); // File wasn't successfully processed
      expect(mockStatsCounter.skippedFiles).toBe(0); // Not skipped by filter, but failed to read
      expect(mockDebug).toHaveBeenCalledWith(
        chalk.cyan(`Reading file: ${absoluteFilePath}`)
      );
      // Check if the warning was logged to console.error
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        chalk.yellow(
          `Warning: Skipping file ${absoluteFilePath} due to read error: ${error.message}`
        )
      );

      consoleErrorSpy.mockRestore(); // Clean up spy
    });

    test('should handle stat error gracefully', async () => {
      const error: NodeJS.ErrnoException = new Error('Stat failed');
      error.code = 'EACCES'; // Example error code
      (fsp.stat as jest.Mock).mockRejectedValue(error);
      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation();

      await runProcessPath(filePathRelative);

      expect(mockPrintPath).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        chalk.red(`Error accessing path ${absoluteFilePath}: ${error.message}`)
      );
      expect(mockStatsCounter.foundFiles).toBe(0);
      expect(mockStatsCounter.skippedFiles).toBe(0); // Not found/skipped, just errored
      consoleErrorSpy.mockRestore();
    });
  });

  describe('Directory Handling', () => {
    const dirPathRelative = 'src';
    const absoluteDirPath = path.resolve(baseProjectPath, dirPathRelative);
    const childFileName = 'index.ts';
    const childFilePathRelative = path.join(dirPathRelative, childFileName);
    const absoluteChildFilePath = path.resolve(
      baseProjectPath,
      childFilePathRelative
    );
    const hiddenDirName = '.git';
    const hiddenDirPathRelative = hiddenDirName;
    const absoluteHiddenDirPath = path.resolve(
      baseProjectPath,
      hiddenDirPathRelative
    );

    beforeEach(() => {
      // --- Setup Mock File System Structure ---
      (fsp.stat as jest.Mock).mockImplementation(async (p: string) => {
        // console.log(`Mock fsp.stat (dir handling) called for: ${p}`); // Debugging
        if (p === absoluteDirPath) return createMockStats(false, true);
        if (p === absoluteChildFilePath) return createMockStats(true, false);
        if (p === absoluteHiddenDirPath) return createMockStats(false, true);
        // Add stat mock for file inside hidden dir if needed for includeHidden test
        if (p === path.resolve(absoluteHiddenDirPath, 'config'))
          return createMockStats(true, false);
        // Add stat mock for ignored dirs/files if needed
        if (p === path.resolve(baseProjectPath, 'node_modules'))
          return createMockStats(false, true);
        if (p === path.resolve(baseProjectPath, 'build'))
          return createMockStats(false, true);
        if (p === path.resolve(baseProjectPath, 'build', 'output.log'))
          return createMockStats(true, false);

        const error: NodeJS.ErrnoException = new Error(
          `ENOENT: no such file or directory, stat '${p}'`
        );
        error.code = 'ENOENT';
        throw error;
      });

      (fsp.readdir as jest.Mock).mockImplementation(
        async (p: string, options?: { withFileTypes: boolean }) => {
          // console.log(`Mock fsp.readdir called for: ${p}`); // Debugging
          if (p === absoluteDirPath) {
            return options?.withFileTypes
              ? [createMockDirent({ name: childFileName, isFile: true })]
              : [childFileName];
          }
          if (p === absoluteHiddenDirPath) {
            return options?.withFileTypes
              ? [createMockDirent({ name: 'config', isFile: true })]
              : ['config'];
          }
          if (p === path.resolve(baseProjectPath, 'build')) {
            return options?.withFileTypes
              ? [createMockDirent({ name: 'output.log', isFile: true })]
              : ['output.log'];
          }
          // Default empty for other paths
          return [];
        }
      );

      (fsp.readFile as jest.Mock).mockImplementation(async (p: string) => {
        if (p === absoluteChildFilePath) return 'Child file content';
        if (p === path.resolve(absoluteHiddenDirPath, 'config'))
          return 'Hidden config content';
        if (p === path.resolve(baseProjectPath, 'build', 'output.log'))
          return 'Build log content';
        return ''; // Default empty content
      });
    });

    test('should process directory and recurse', async () => {
      await runProcessPath(dirPathRelative);

      // Check directory processing
      expect(fsp.stat).toHaveBeenCalledWith(absoluteDirPath);
      expect(fsp.readdir).toHaveBeenCalledWith(absoluteDirPath, {
        withFileTypes: true
      });
      expect(mockDebug).toHaveBeenCalledWith(
        chalk.cyan(`Processing path: ${absoluteDirPath}`)
      );
      expect(mockDebug).toHaveBeenCalledWith(
        chalk.cyan(`Path is a directory. Reading entries...`)
      );
      expect(mockDebug).toHaveBeenCalledWith(
        chalk.cyan(`Found 1 entries in ${absoluteDirPath}`)
      ); // Based on mock readdir

      // Check recursion: processPath should be called for the child
      // (Difficult to check directly without spying on processPath itself)
      // Instead, check if the child file was processed:
      expect(fsp.stat).toHaveBeenCalledWith(absoluteChildFilePath);
      expect(mockPrintPath).toHaveBeenCalledWith(
        mockWriter,
        absoluteChildFilePath,
        'Child file content',
        false,
        false,
        false
      );
      expect(mockStatsCounter.foundFiles).toBe(1); // The child file
      expect(mockStatsCounter.skippedFiles).toBe(0);
    });

    test('should skip hidden directory by default', async () => {
      await runProcessPath(hiddenDirPathRelative); // Process the hidden dir directly

      expect(fsp.stat).toHaveBeenCalledWith(absoluteHiddenDirPath);
      // Should not read inside the hidden directory
      expect(fsp.readdir).not.toHaveBeenCalledWith(
        absoluteHiddenDirPath,
        expect.anything()
      );
      expect(mockPrintPath).not.toHaveBeenCalled();
      expect(mockStatsCounter.foundFiles).toBe(0);
      expect(mockStatsCounter.skippedFiles).toBe(0);
      expect(mockDebug).toHaveBeenCalledWith(
        chalk.yellow(
          `    Skipping hidden: ${path.basename(absoluteHiddenDirPath)}`
        )
      );
    });

    test('should include hidden directory when includeHidden is true', async () => {
      await runProcessPath(hiddenDirPathRelative, { includeHidden: true });

      expect(fsp.stat).toHaveBeenCalledWith(absoluteHiddenDirPath);
      expect(fsp.readdir).toHaveBeenCalledWith(absoluteHiddenDirPath, {
        withFileTypes: true
      });
      // Should process the child file 'config' inside the hidden dir
      const absoluteHiddenChildPath = path.resolve(
        absoluteHiddenDirPath,
        'config'
      );
      expect(fsp.stat).toHaveBeenCalledWith(absoluteHiddenChildPath);
      expect(mockPrintPath).toHaveBeenCalledWith(
        mockWriter,
        absoluteHiddenChildPath,
        'Hidden config content',
        false,
        false,
        false
      );
      expect(mockStatsCounter.foundFiles).toBe(1);
      expect(mockStatsCounter.skippedFiles).toBe(0);
      expect(mockDebug).toHaveBeenCalledWith(
        chalk.cyan(`Processing path: ${absoluteHiddenDirPath}`)
      );
    });

    test('should skip directory via .gitignore pattern', async () => {
      mockMainIg = ignore().add('node_modules/');
      const ignoredDirPathRelative = 'node_modules';
      const absoluteIgnoredDirPath = path.resolve(
        baseProjectPath,
        ignoredDirPathRelative
      );

      await runProcessPath(ignoredDirPathRelative, { mainIg: mockMainIg });

      expect(fsp.stat).toHaveBeenCalledWith(absoluteIgnoredDirPath);
      // Should not read inside the ignored directory
      expect(fsp.readdir).not.toHaveBeenCalledWith(
        absoluteIgnoredDirPath,
        expect.anything()
      );
      expect(mockPrintPath).not.toHaveBeenCalled();
      expect(mockStatsCounter.foundFiles).toBe(0);
      expect(mockStatsCounter.skippedFiles).toBe(0);
      expect(mockDebug).toHaveBeenCalledWith(
        expect.stringContaining(
          `Skipping due to ignore rules: ${path.basename(
            absoluteIgnoredDirPath
          )}`
        )
      );
    });

    test('should skip directory via options.ignorePatterns when ignoreFilesOnly is false', async () => {
      const buildDirPathRelative = 'build';
      const absoluteBuildDirPath = path.resolve(
        baseProjectPath,
        buildDirPathRelative
      );

      await runProcessPath(buildDirPathRelative, {
        ignorePatterns: ['build/'],
        ignoreFilesOnly: false
      });

      expect(fsp.stat).toHaveBeenCalledWith(absoluteBuildDirPath);
      expect(fsp.readdir).not.toHaveBeenCalledWith(
        absoluteBuildDirPath,
        expect.anything()
      );
      expect(mockPrintPath).not.toHaveBeenCalled();
      expect(mockStatsCounter.foundFiles).toBe(0);
      expect(mockStatsCounter.skippedFiles).toBe(0);
      expect(mockDebug).toHaveBeenCalledWith(
        chalk.yellow(
          `Skipping directory due to --ignore pattern: ${path.basename(
            absoluteBuildDirPath
          )}`
        )
      );
    });

    test('should NOT skip directory via options.ignorePatterns when ignoreFilesOnly is true, but skip files inside', async () => {
      const buildDirPathRelative = 'build';
      const absoluteBuildDirPath = path.resolve(
        baseProjectPath,
        buildDirPathRelative
      );
      const fileInBuildPathRelative = path.join(buildDirPathRelative, 'output.log');
      const absoluteFileInBuildPath = path.resolve(
        baseProjectPath,
        fileInBuildPathRelative
      );

      await runProcessPath(buildDirPathRelative, {
        ignorePatterns: ['build/*'],
        ignoreFilesOnly: true
      });

      // Should still process the directory itself
      expect(fsp.stat).toHaveBeenCalledWith(absoluteBuildDirPath);
      expect(fsp.readdir).toHaveBeenCalledWith(absoluteBuildDirPath, {
        withFileTypes: true
      });
      expect(mockDebug).toHaveBeenCalledWith(
        chalk.cyan(`Processing path: ${absoluteBuildDirPath}`)
      );

      // Should attempt to process the file inside
      expect(fsp.stat).toHaveBeenCalledWith(absoluteFileInBuildPath);

      // But the file inside should be skipped by the pattern (applied during file processing)
      expect(mockPrintPath).not.toHaveBeenCalled();
      expect(mockStatsCounter.foundFiles).toBe(0);
      expect(mockStatsCounter.skippedFiles).toBe(1); // The file inside was skipped
      expect(mockDebug).toHaveBeenCalledWith(
        chalk.yellow(
          `Skipping file due to --ignore pattern: ${path.basename(
            absoluteFileInBuildPath
          )}`
        )
      );
    });

    test('should handle directory read error gracefully', async () => {
      const error: NodeJS.ErrnoException = new Error(
        'Readdir permission denied'
      );
      error.code = 'EACCES';
      (fsp.readdir as jest.Mock).mockRejectedValue(error);
      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation();

      await runProcessPath(dirPathRelative);

      expect(fsp.stat).toHaveBeenCalledWith(absoluteDirPath);
      expect(fsp.readdir).toHaveBeenCalledWith(absoluteDirPath, {
        withFileTypes: true
      });
      // Should log the error to console.error
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        chalk.red(`Error reading directory ${absoluteDirPath}: ${error.message}`)
      );
      // Should not process any children or throw further
      expect(mockPrintPath).not.toHaveBeenCalled();
      expect(mockStatsCounter.foundFiles).toBe(0);
      expect(mockStatsCounter.skippedFiles).toBe(0);
      consoleErrorSpy.mockRestore();
    });

    test('should sort directory entries before processing', async () => {
      const dirPath = 'mixedDir';
      const absoluteDirPath = path.resolve(baseProjectPath, dirPath);
      const fileB = 'b.txt';
      const fileA = 'a.txt';
      const subDirC = 'c_sub';

      (fsp.stat as jest.Mock).mockImplementation(async (p: string) => {
        if (p === absoluteDirPath) return createMockStats(false, true);
        if (p === path.resolve(absoluteDirPath, fileA))
          return createMockStats(true, false);
        if (p === path.resolve(absoluteDirPath, fileB))
          return createMockStats(true, false);
        if (p === path.resolve(absoluteDirPath, subDirC))
          return createMockStats(false, true);
        if (p === path.resolve(absoluteDirPath, subDirC, 'd.txt'))
          return createMockStats(true, false); // File in subdir
        throw new Error(`ENOENT: ${p}`);
      });

      (fsp.readdir as jest.Mock).mockImplementation(
        async (p: string, options?: { withFileTypes: boolean }) => {
          if (p === absoluteDirPath) {
            // Return unsorted
            return options?.withFileTypes
              ? [
                  createMockDirent({ name: fileB, isFile: true }),
                  createMockDirent({ name: subDirC, isDirectory: true }),
                  createMockDirent({ name: fileA, isFile: true })
                ]
              : [fileB, subDirC, fileA];
          }
          if (p === path.resolve(absoluteDirPath, subDirC)) {
            // Content of subdir
            return options?.withFileTypes
              ? [createMockDirent({ name: 'd.txt', isFile: true })]
              : ['d.txt'];
          }
          return [];
        }
      );
      (fsp.readFile as jest.Mock).mockResolvedValue('content'); // Generic content

      // Spy on processPath itself to check call order (requires more complex mocking setup)
      // Alternatively, check the order of printPath calls or debug logs
      const processPathCalls: string[] = [];
      mockDebug.mockImplementation((msg: string) => {
        // Capture the path from the "Processing path:" log message
        const match = msg.match(/Processing path: (.*)/);
        if (match && match[1]) {
          // Remove chalk formatting for comparison
          const cleanPath = match[1].replace(
            // eslint-disable-next-line no-control-regex
            /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g,
            ''
          );
          processPathCalls.push(cleanPath);
        }
      });

      await runProcessPath(dirPath);

      // Verify the order of processing based on debug logs (or printPath calls)
      // Expected order: a.txt, b.txt, c_sub (then d.txt inside c_sub)
      const expectedOrder = [
        absoluteDirPath, // Initial call
        path.resolve(absoluteDirPath, fileA),
        path.resolve(absoluteDirPath, fileB),
        path.resolve(absoluteDirPath, subDirC),
        path.resolve(absoluteDirPath, subDirC, 'd.txt') // Recursive call
      ];

      // Check that the captured calls match the expected order
      expect(processPathCalls).toEqual(expectedOrder);
      expect(mockStatsCounter.foundFiles).toBe(3); // a.txt, b.txt, d.txt
    });
  });

  describe('Option Propagation and Formatting', () => {
    const dirPathRelative = 'src';
    const absoluteDirPath = path.resolve(baseProjectPath, dirPathRelative);
    const childFileName = 'index.ts';
    const childFilePathRelative = path.join(dirPathRelative, childFileName);
    const absoluteChildFilePath = path.resolve(
      baseProjectPath,
      childFilePathRelative
    );

    beforeEach(() => {
      // Setup mocks for a directory containing one file
      (fsp.stat as jest.Mock).mockImplementation(async (p: string) => {
        if (p === absoluteDirPath) return createMockStats(false, true);
        if (p === absoluteChildFilePath) return createMockStats(true, false);
        throw new Error(`ENOENT: ${p}`);
      });
      (fsp.readdir as jest.Mock).mockResolvedValue([
        createMockDirent({ name: childFileName, isFile: true })
      ]);
      (fsp.readFile as jest.Mock).mockResolvedValue('File content');
    });

    test('should pass formatting options down during recursion', async () => {
      const specificOptions: Partial<ProcessPathOptions> = {
        lineNumbers: true,
        claudeXml: true, // Claude XML enabled
        markdown: false, // Ensure markdown is explicitly false if claudeXml is true
        includeHidden: true, // Example other option
        ignorePatterns: ['temp.*']
      };
      await runProcessPath(dirPathRelative, specificOptions);

      // Verify printPath was called with the correct formatting options for the child file
      expect(mockPrintPath).toHaveBeenCalledWith(
        mockWriter,
        absoluteChildFilePath,
        'File content',
        true, // claudeXml
        false, // markdown
        true // lineNumbers
      );

      // Verify other options were passed implicitly (checked via mock instances)
      // e.g., writer and debug instances should be the mocked ones.
      // This is harder to check directly without spying on processPath itself,
      // but the call to printPath with the correct writer implies it was passed.
    });

    test('should use markdown formatting when specified', async () => {
      await runProcessPath(dirPathRelative, {
        markdown: true,
        claudeXml: false
      });

      expect(mockPrintPath).toHaveBeenCalledWith(
        mockWriter,
        absoluteChildFilePath,
        'File content',
        false, // claudeXml
        true, // markdown
        false // lineNumbers
      );
    });

    test('should use line numbers when specified', async () => {
      await runProcessPath(dirPathRelative, { lineNumbers: true });

      expect(mockPrintPath).toHaveBeenCalledWith(
        mockWriter,
        absoluteChildFilePath,
        'File content',
        false, // claudeXml
        false, // markdown
        true // lineNumbers
      );
    });
  });
});
