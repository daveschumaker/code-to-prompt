// tests/lib/stdinUtils.test.ts
import { readPathsFromStdin } from '../../src/lib/stdinUtils';
import { Readable } from 'stream';
import process from 'process';

describe('readPathsFromStdin', () => {
  let originalStdin: NodeJS.ReadStream;
  let originalIsTTY: boolean | undefined;
  let stdinMock: (Readable & { isTTY?: boolean }) | null = null; // Add isTTY to mock type

  beforeEach(() => {
    // Backup original stdin properties
    originalStdin = process.stdin;
    originalIsTTY = process.stdin.isTTY;
  });

  afterEach(() => {
    // Restore original stdin
    Object.defineProperty(process, 'stdin', {
      value: originalStdin,
      writable: true
    });
    
    // Restore original isTTY if it was defined
    if (originalIsTTY !== undefined) {
      Object.defineProperty(process.stdin, 'isTTY', {
        value: originalIsTTY,
        writable: true
      });
    }
  });

  // Helper function to create a mock stdin
  const createMockStdin = (data: string[], isTTY = false): Readable => {
    const mock = new Readable({
      read() {
        for (const chunk of data) {
          this.push(chunk);
        }
        this.push(null); // Signal end of stream
      }
    });
    
    // Add isTTY property
    Object.defineProperty(mock, 'isTTY', {
      value: isTTY,
      writable: true
    });
    
    return mock;
  };

  const mockStdinForProcess = (mockStdin: Readable) => {
    // Replace process.stdin with our mock
    Object.defineProperty(process, 'stdin', {
      value: mockStdin,
      writable: true
    });
  };

  test('should return an empty array if stdin is a TTY', async () => {
    // Create a TTY mock stdin
    stdinMock = createMockStdin([], true);
    mockStdinForProcess(stdinMock);

    const result = await readPathsFromStdin(false);
    expect(result).toEqual([]);
  });

  test('should read and trim file paths from stdin', async () => {
    // Create mock stdin with sample data
    stdinMock = createMockStdin([
      'file1.js\nfile2.ts\n',
      'file3.json\n'
    ]);
    mockStdinForProcess(stdinMock);

    const result = await readPathsFromStdin(false);
    expect(result).toEqual(['file1.js', 'file2.ts', 'file3.json']);
  });

  test('should filter out empty lines', async () => {
    stdinMock = createMockStdin([
      'file1.js\n\n\nfile2.ts\n',
      '\n\nfile3.json\n\n'
    ]);
    mockStdinForProcess(stdinMock);

    const result = await readPathsFromStdin(false);
    expect(result).toEqual(['file1.js', 'file2.ts', 'file3.json']);
  });

  test('should handle Windows-style line endings (CRLF)', async () => {
    stdinMock = createMockStdin([
      'file1.js\r\nfile2.ts\r\n',
      'file3.json\r\n'
    ]);
    mockStdinForProcess(stdinMock);

    const result = await readPathsFromStdin(false);
    expect(result).toEqual(['file1.js', 'file2.ts', 'file3.json']);
  });

  test('should work with mixed line endings', async () => {
    stdinMock = createMockStdin([
      'file1.js\nfile2.ts\r\n',
      'file3.json\n'
    ]);
    mockStdinForProcess(stdinMock);

    const result = await readPathsFromStdin(false);
    expect(result).toEqual(['file1.js', 'file2.ts', 'file3.json']);
  });

  test('should split on whitespace when useNullSeparator is false', async () => {
    stdinMock = createMockStdin([
      '  file with spaces.js  \n',
      ' another file.ts \n'
    ]);
    mockStdinForProcess(stdinMock);

    const result = await readPathsFromStdin(false);
    expect(result).toEqual(['file', 'with', 'spaces.js', 'another', 'file.ts']);
  });

  test('should handle empty input', async () => {
    stdinMock = createMockStdin([]);
    mockStdinForProcess(stdinMock);

    const result = await readPathsFromStdin(false);
    expect(result).toEqual([]);
  });

  test('should handle only whitespace input', async () => {
    stdinMock = createMockStdin(['  \n\t\n  \n']);
    mockStdinForProcess(stdinMock);

    const result = await readPathsFromStdin(false);
    expect(result).toEqual([]);
  });

  test('should preserve paths with spaces when useNullSeparator is true', async () => {
    stdinMock = createMockStdin([
      '/path/to/my file.js\0',
      '/another/path with spaces/file.ts\0'
    ]);
    mockStdinForProcess(stdinMock);

    const result = await readPathsFromStdin(true);
    expect(result).toEqual([
      '/path/to/my file.js',
      '/another/path with spaces/file.ts'
    ]);
  });

  test('should handle input with multiple chunks', async () => {
    stdinMock = createMockStdin([
      'file1',
      '.js\nfile',
      '2.ts\nfil',
      'e3.json\n'
    ]);
    mockStdinForProcess(stdinMock);

    const result = await readPathsFromStdin(false);
    expect(result).toEqual(['file1.js', 'file2.ts', 'file3.json']);
  });

  test('should handle a very large number of paths', async () => {
    // Generate 1000 file paths
    const largePaths: string[] = [];
    for (let i = 1; i <= 1000; i++) {
      largePaths.push(`file${i}.js`);
    }
    
    // Split into chunks to simulate reading from stdin
    const chunks: string[] = [];
    const pathsPerChunk = 100;
    for (let i = 0; i < largePaths.length; i += pathsPerChunk) {
      chunks.push(largePaths.slice(i, i + pathsPerChunk).join('\n') + '\n');
    }
    
    stdinMock = createMockStdin(chunks);
    mockStdinForProcess(stdinMock);

    const result = await readPathsFromStdin(false);
    expect(result.length).toBe(1000);
    expect(result[0]).toBe('file1.js');
    expect(result[999]).toBe('file1000.js');
  });

  test('should handle multibyte Unicode characters', async () => {
    stdinMock = createMockStdin([
      '🔥file.js\n',
      'path/to/👍emoji.ts\n',
      '你好world.py\n'
    ]);
    mockStdinForProcess(stdinMock);

    const result = await readPathsFromStdin(false);
    expect(result).toEqual([
      '🔥file.js',
      'path/to/👍emoji.ts',
      '你好world.py'
    ]);
  });
});