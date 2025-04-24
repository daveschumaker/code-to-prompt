import { readPathsFromStdin } from '../../src/lib/stdinUtils';
import { Readable } from 'stream';
import process from 'process'; // Import process

describe('readPathsFromStdin', () => {
  let originalStdin: NodeJS.ReadStream;
  let originalIsTTY: boolean | undefined;

  beforeEach(() => {
    // Backup original stdin properties
    originalStdin = process.stdin;
    originalIsTTY = process.stdin.isTTY;
  });

  afterEach(() => {
    // Restore original stdin properties and clean up mocks
    Object.defineProperty(process, 'stdin', { value: originalStdin, writable: true, configurable: true });
    process.stdin.isTTY = originalIsTTY;
    jest.restoreAllMocks();
  });

  // Helper to mock stdin stream
  const mockStdin = (input: string | null, isTTY: boolean = false): Readable => {
    const stream = new Readable({ read() {} });
    // Make process.stdin replaceable
    Object.defineProperty(process, 'stdin', { value: stream, writable: true, configurable: true });
    process.stdin.isTTY = isTTY;

    // Push input data asynchronously to allow event listeners to attach
    process.nextTick(() => {
        if (input !== null) {
            stream.push(input);
        }
        stream.push(null); // Signal EOF
    });

    return stream;
  };

  test('should return empty array if stdin is TTY', async () => {
    mockStdin(null, true); // Simulate TTY
    const paths = await readPathsFromStdin(false);
    expect(paths).toEqual([]);
  });

  test('should return empty array for empty input stream', async () => {
    mockStdin(''); // Simulate empty input
    const paths = await readPathsFromStdin(false);
    expect(paths).toEqual([]);
  });

   test('should return empty array for input stream with only whitespace', async () => {
    mockStdin('  \n\t  \n ');
    const paths = await readPathsFromStdin(false);
    expect(paths).toEqual([]);
  });

  test('should read space-separated paths', async () => {
    mockStdin('path1 path2');
    const paths = await readPathsFromStdin(false);
    expect(paths).toEqual(['path1', 'path2']);
  });

  test('should read newline-separated paths (LF)', async () => {
    mockStdin('path1\npath2');
    const paths = await readPathsFromStdin(false);
    expect(paths).toEqual(['path1', 'path2']);
  });

  test('should read newline-separated paths (CRLF)', async () => {
    mockStdin('path1\r\npath2');
    const paths = await readPathsFromStdin(false);
    expect(paths).toEqual(['path1', 'path2']);
  });

  test('should read paths separated by mixed whitespace', async () => {
    mockStdin('path1 \n path2\tpath3  \r\npath4');
    const paths = await readPathsFromStdin(false);
    // split(/\s+/) handles mixed whitespace and filter(Boolean) removes empty strings
    expect(paths).toEqual(['path1', 'path2', 'path3', 'path4']);
  });

  test('should handle leading/trailing whitespace/newlines', async () => {
    mockStdin('\n  path1 \n path2 \t ');
    const paths = await readPathsFromStdin(false);
    expect(paths).toEqual(['path1', 'path2']);
  });

  test('should read NUL-separated paths when useNullSeparator is true', async () => {
    mockStdin('path1\0path2\0path3', false); // Input with NUL chars
    const paths = await readPathsFromStdin(true); // Enable NUL separator mode
    expect(paths).toEqual(['path1', 'path2', 'path3']);
  });

  test('should handle NUL-separated paths with trailing NUL', async () => {
    mockStdin('path1\0path2\0', false);
    const paths = await readPathsFromStdin(true);
    // The trailing empty string after the last NUL should be filtered out
    expect(paths).toEqual(['path1', 'path2']);
  });

  test('should handle NUL-separated paths with only NULs', async () => {
    mockStdin('\0\0\0', false);
    const paths = await readPathsFromStdin(true);
    expect(paths).toEqual([]); // Should result in empty strings filtered out
  });

   test('should handle empty input when using NUL separator', async () => {
    mockStdin('', false);
    const paths = await readPathsFromStdin(true);
    expect(paths).toEqual([]);
  });

  test('should ignore NUL characters when useNullSeparator is false (treat as whitespace)', async () => {
    // If not using NUL separator, NUL might be treated as whitespace by /\s+/
    mockStdin('path1\0path2 path3\0path4', false);
    const paths = await readPathsFromStdin(false);
    // Expect NUL to be treated like other whitespace by /\s+/
    expect(paths).toEqual(['path1', 'path2', 'path3', 'path4']);
  });

  test('should handle large input stream', async () => {
      const largeInput = Array.from({ length: 1000 }, (_, i) => `path${i}`).join('\n');
      mockStdin(largeInput);
      const paths = await readPathsFromStdin(false);
      expect(paths.length).toBe(1000);
      expect(paths[0]).toBe('path0');
      expect(paths[999]).toBe('path999');
  }, 10000); // Increase timeout for potentially large stream processing

   test('should handle large input stream with NUL separator', async () => {
      const largeInput = Array.from({ length: 1000 }, (_, i) => `path${i}`).join('\0');
      mockStdin(largeInput);
      const paths = await readPathsFromStdin(true);
      expect(paths.length).toBe(1000);
      expect(paths[0]).toBe('path0');
      expect(paths[999]).toBe('path999');
  }, 10000); // Increase timeout

});
