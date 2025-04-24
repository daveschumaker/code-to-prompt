import { readPathsFromStdin } from '../../src/lib/stdinUtils';
import { Readable } from 'stream';
import process from 'process'; // Import process

describe('readPathsFromStdin', () => {
  let originalStdin: NodeJS.ReadStream;
  let originalIsTTY: boolean | undefined;
  let stdinMock: Readable & { isTTY?: boolean } | null = null; // Add isTTY to mock type

  beforeEach(() => {
    // Backup original stdin properties
    originalStdin = process.stdin;
    originalIsTTY = process.stdin.isTTY;
  });

  afterEach(() => {
    // Restore original stdin properties and clean up mocks
    Object.defineProperty(process, 'stdin', {
      value: originalStdin,
      writable: true,
      configurable: true
    });
    // Restore original isTTY value
    process.stdin.isTTY = originalIsTTY;

    if (stdinMock && !stdinMock.destroyed) {
      stdinMock.destroy(); // Ensure stream is destroyed
    }
    stdinMock = null;
    jest.restoreAllMocks(); // Restore any other mocks
  });

  // Helper to mock stdin stream
  const mockStdin = (
    input: string | Buffer | null,
    isTTY: boolean = false
  ): Readable => {
    // Create a mock stream that behaves like process.stdin
    stdinMock = new Readable({ read() {} }) as Readable & { isTTY?: boolean };
    stdinMock.isTTY = isTTY; // Set the isTTY property on the mock

    // Make process.stdin replaceable and assign the mock
    Object.defineProperty(process, 'stdin', {
      value: stdinMock,
      writable: true,
      configurable: true
    });

    // Push input data asynchronously to allow event listeners to attach
    process.nextTick(() => {
      if (input !== null && stdinMock && !stdinMock.destroyed) {
        stdinMock.push(input);
      }
      if (stdinMock && !stdinMock.destroyed) {
        stdinMock.push(null); // Signal EOF
      }
    });

    return stdinMock;
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
    // split(/\s+/) handles mixed whitespace and filter removes empty strings
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

  test('should handle NUL-separated paths with leading NUL', async () => {
    mockStdin('\0path1\0path2', false);
    const paths = await readPathsFromStdin(true);
    // The leading empty string before the first NUL should be filtered out
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
    const largeInput = Array.from({ length: 1000 }, (_, i) => `path${i}`).join(
      '\n'
    );
    mockStdin(largeInput);
    const paths = await readPathsFromStdin(false);
    expect(paths.length).toBe(1000);
    expect(paths[0]).toBe('path0');
    expect(paths[999]).toBe('path999');
  }, 10000); // Increase timeout for potentially large stream processing

  test('should handle large input stream with NUL separator', async () => {
    const largeInput = Array.from({ length: 1000 }, (_, i) => `path${i}`).join(
      '\0'
    );
    mockStdin(largeInput);
    const paths = await readPathsFromStdin(true);
    expect(paths.length).toBe(1000);
    expect(paths[0]).toBe('path0');
    expect(paths[999]).toBe('path999');
  }, 10000); // Increase timeout

  test('should handle stream errors', async () => {
    // Create a mock stream that will emit an error
    const errorStream = new Readable({
      read() {
        // Emit error shortly after read is called
        process.nextTick(() => this.emit('error', new Error('Test stream error')));
      }
    }) as Readable & { isTTY?: boolean };
    errorStream.isTTY = false; // Ensure it's not treated as TTY

    // Assign the error-emitting stream to process.stdin
    Object.defineProperty(process, 'stdin', {
      value: errorStream,
      writable: true,
      configurable: true
    });

    // Expect the promise to reject with the emitted error
    await expect(readPathsFromStdin(false)).rejects.toThrow('Test stream error');

    // Assign the mock back for cleanup in afterEach
    stdinMock = errorStream;
  });

  test('should handle multi-byte characters correctly (whitespace separator)', async () => {
      const input = 'path/你好世界 file/😊 another/path';
      mockStdin(input);
      const paths = await readPathsFromStdin(false);
      expect(paths).toEqual(['path/你好世界', 'file/😊', 'another/path']);
  });

   test('should handle multi-byte characters correctly (NUL separator)', async () => {
      const input = 'path/你好世界\0file/😊\0another/path';
      mockStdin(input);
      const paths = await readPathsFromStdin(true);
      expect(paths).toEqual(['path/你好世界', 'file/😊', 'another/path']);
  });

   test('should handle input split across multiple chunks', async () => {
        const stream = new Readable({ read() {} }) as Readable & { isTTY?: boolean };
        stream.isTTY = false;
        Object.defineProperty(process, 'stdin', { value: stream, writable: true, configurable: true });
        stdinMock = stream; // Assign for cleanup

        const promise = readPathsFromStdin(false); // Start reading

        // Push chunks asynchronously
        process.nextTick(() => stream.push('path1 pa'));
        process.nextTick(() => stream.push('th2\npath'));
        process.nextTick(() => stream.push('3\0path4')); // Include NUL to test non-NUL mode
        process.nextTick(() => stream.push(null)); // EOF

        const paths = await promise;
        expect(paths).toEqual(['path1', 'path2', 'path3', 'path4']);
    });

     test('should handle input split across multiple chunks (NUL separator)', async () => {
        const stream = new Readable({ read() {} }) as Readable & { isTTY?: boolean };
        stream.isTTY = false;
        Object.defineProperty(process, 'stdin', { value: stream, writable: true, configurable: true });
        stdinMock = stream; // Assign for cleanup

        const promise = readPathsFromStdin(true); // Start reading in NUL mode

        // Push chunks asynchronously
        process.nextTick(() => stream.push('path1\0pa'));
        process.nextTick(() => stream.push('th2\0path'));
        process.nextTick(() => stream.push('3 path4')); // Include space to test NUL mode
        process.nextTick(() => stream.push('\0path5'));
        process.nextTick(() => stream.push(null)); // EOF

        const paths = await promise;
        expect(paths).toEqual(['path1', 'path2', 'path3 path4', 'path5']);
    });

});
