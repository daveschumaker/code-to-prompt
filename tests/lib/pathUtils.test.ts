import { findCommonAncestor } from '../../src/lib/pathUtils';
import path from 'path';
import process from 'process';
import fs from 'fs'; // Import fs for statSync

describe('findCommonAncestor', () => {
  const originalCwd = process.cwd();
  const isWindows = process.platform === 'win32';
  const root = isWindows ? 'C:\\' : '/';
  // Define a consistent mock CWD for tests that might involve relative paths resolution implicitly
  const mockCwd = path.resolve(isWindows ? 'C:\\Users\\Test' : '/users/test');

  // Mock fs.statSync for single path tests
  let statSyncMock: jest.SpyInstance;
  let cwdSpy: jest.SpyInstance;

  beforeAll(() => {
    // Mock process.cwd() once for all tests in this suite
    cwdSpy = jest.spyOn(process, 'cwd').mockReturnValue(mockCwd);
  });

  afterAll(() => {
    // Restore original process.cwd()
    cwdSpy.mockRestore();
  });


  beforeEach(() => {
    // Reset statSync mock before each test
    statSyncMock = jest.spyOn(fs, 'statSync');
  });

  afterEach(() => {
    // Restore original statSync implementation
    statSyncMock.mockRestore();
  });

  test('should return parent directory for a single file path', () => {
    const filePath = path.join(mockCwd, 'file.txt');
    // Mock statSync to identify it as a file
    statSyncMock.mockReturnValue({ isDirectory: () => false } as fs.Stats);
    expect(findCommonAncestor([filePath])).toBe(mockCwd);
    expect(statSyncMock).toHaveBeenCalledWith(filePath);
  });

  test('should return the directory itself for a single directory path', () => {
    const dirPath = path.join(mockCwd, 'subdir');
    // Mock statSync to identify it as a directory
    statSyncMock.mockReturnValue({ isDirectory: () => true } as fs.Stats);
    expect(findCommonAncestor([dirPath])).toBe(dirPath);
    expect(statSyncMock).toHaveBeenCalledWith(dirPath);
  });

  test('should return parent directory if statSync fails for single path', () => {
    const nonExistentPath = path.join(mockCwd, 'nonexistent.file');
    // Mock statSync to throw an error
    statSyncMock.mockImplementation(() => {
      throw new Error('ENOENT');
    });
    expect(findCommonAncestor([nonExistentPath])).toBe(mockCwd);
    expect(statSyncMock).toHaveBeenCalledWith(nonExistentPath);
  });

  test('should find common parent for multiple paths', () => {
    const path1 = path.join(root, 'a', 'b', 'c');
    const path2 = path.join(root, 'a', 'b', 'd');
    expect(findCommonAncestor([path1, path2])).toBe(path.join(root, 'a', 'b'));
  });

  test('should find deeper common parent', () => {
    const path1 = path.join(root, 'a', 'b', 'c', 'd');
    const path2 = path.join(root, 'a', 'b', 'e', 'f');
    expect(findCommonAncestor([path1, path2])).toBe(path.join(root, 'a', 'b'));
  });

  test('should return root when only root is common', () => {
    const path1 = path.join(root, 'a', 'b');
    const path2 = path.join(root, 'x', 'y');
    expect(findCommonAncestor([path1, path2])).toBe(root);
  });

  test('should return the ancestor when one path is the ancestor of the other', () => {
    const path1 = path.join(root, 'a', 'b');
    const path2 = path.join(root, 'a', 'b', 'c');
    expect(findCommonAncestor([path1, path2])).toBe(path.join(root, 'a', 'b'));
  });

  test('should return the ancestor when one path is the ancestor of the other (reversed)', () => {
    const path1 = path.join(root, 'a', 'b', 'c');
    const path2 = path.join(root, 'a', 'b');
    expect(findCommonAncestor([path1, path2])).toBe(path.join(root, 'a', 'b'));
  });

  test('should handle paths including the root itself', () => {
    const path1 = root;
    const path2 = path.join(root, 'a');
    expect(findCommonAncestor([path1, path2])).toBe(root);
  });

  test('should handle relative paths (resolved correctly)', () => {
    // findCommonAncestor expects absolute paths. Test with resolved paths.
    const resolvedPath1 = path.resolve(mockCwd, './src/a');
    const resolvedPath2 = path.resolve(mockCwd, './src/b');
    const expectedParent = path.resolve(mockCwd, './src');
    expect(findCommonAncestor([resolvedPath1, resolvedPath2])).toBe(expectedParent);
  });

  test('should handle identical paths', () => {
     const p = path.join(root, 'a', 'b', 'c');
     // Mock statSync for the single path case check (even though it's identical)
     // statSync should not be called for multiple paths
     expect(findCommonAncestor([p, p])).toBe(p);
     expect(statSyncMock).not.toHaveBeenCalled();
  });

  test('should handle paths with different casing on case-insensitive systems', () => {
      // This test relies on the input paths having consistent casing,
      // as the function uses simple string splitting and comparison.
      // Normalization should happen *before* calling findCommonAncestor.
      const path1 = path.join(root, 'Users', 'Test', 'File.txt');
      const path2 = path.join(root, 'Users', 'Test', 'Another.txt');
      const path3 = path.join(root, 'users', 'test', 'Subdir'); // Different case

      // Test 1: Consistent casing -> finds common ancestor
      expect(findCommonAncestor([path1, path2])).toBe(path.join(root, 'Users', 'Test'));

      // Test 2: Inconsistent casing -> finds only common root
      // Because 'Users' !== 'users'
      expect(findCommonAncestor([path1, path3])).toBe(root);
  });

  test('should handle paths on different drives (Windows)', () => {
      if (!isWindows) {
          return; // Skip on non-Windows
      }
      const path1 = 'C:\\path\\to\\file';
      const path2 = 'D:\\another\\path';
      // No common path components, should return empty string (representing no commonality beyond drives)
      expect(findCommonAncestor([path1, path2])).toBe('');
  });

   test('should handle paths on same drive but no common folder (Windows)', () => {
      if (!isWindows) {
          return; // Skip on non-Windows
      }
      const path1 = 'C:\\path1\\file';
      const path2 = 'C:\\path2\\file';
      // Common is only 'C:\'
      expect(findCommonAncestor([path1, path2])).toBe('C:\\');
  });

  test('should handle UNC paths (Windows)', () => {
      if (!isWindows) {
          return; // Skip on non-Windows
      }
      // Note: path.join doesn't work well for UNC roots, construct manually
      const path1 = '\\\\server\\share\\folder1\\fileA';
      const path2 = '\\\\server\\share\\folder2\\fileB';
      // Common: \\server\share
      expect(findCommonAncestor([path1, path2])).toBe('\\\\server\\share');

      const path3 = '\\\\server1\\share\\folder';
      const path4 = '\\\\server2\\share\\folder';
      // Common: '' (no common server)
      expect(findCommonAncestor([path3, path4])).toBe('');

      const path5 = '\\\\server\\share1\\folder';
      const path6 = '\\\\server\\share2\\folder';
      // Common: \\server
       expect(findCommonAncestor([path5, path6])).toBe('\\\\server');

      const path7 = '\\\\server\\share'; // Directory path
      const path8 = '\\\\server\\share\\file';
      // Common: \\server\share
      expect(findCommonAncestor([path7, path8])).toBe('\\\\server\\share');
  });

   test('should return root for single root path', () => {
        // Mock statSync to identify root as a directory
        statSyncMock.mockReturnValue({ isDirectory: () => true } as fs.Stats);
        expect(findCommonAncestor([root])).toBe(root);
        expect(statSyncMock).toHaveBeenCalledWith(root);
    });

    // Edge case: What if input array is empty?
    test('should return CWD for empty input array', () => {
        // Uses the globally mocked process.cwd()
        expect(findCommonAncestor([])).toBe(mockCwd);
    });

    test('should return CWD if paths is null or undefined', () => {
        // Uses the globally mocked process.cwd()
        expect(findCommonAncestor(null as any)).toBe(mockCwd);
        expect(findCommonAncestor(undefined as any)).toBe(mockCwd);
    });

    test('should handle paths with trailing separators correctly', () => {
        const path1 = path.join(root, 'a', 'b') + path.sep; // /a/b/ or C:\a\b\
        const path2 = path.join(root, 'a', 'b', 'c');       // /a/b/c or C:\a\b\c
        // path.resolve normalizes trailing separators, so they become identical up to /a/b
        expect(findCommonAncestor([path1, path2])).toBe(path.join(root, 'a', 'b'));

        const path3 = path.join(root, 'a', 'b', 'd') + path.sep; // /a/b/d/ or C:\a\b\d\
        expect(findCommonAncestor([path1, path3])).toBe(path.join(root, 'a', 'b'));
    });

    test('should handle paths with double separators (POSIX)', () => {
        if (isWindows) return; // POSIX specific
        const path1 = '/a//b/c';
        const path2 = '/a//b/d';
        // path.resolve normalizes // to /
        const expected = path.resolve('/a/b'); // Becomes /a/b after resolve
        expect(findCommonAncestor([path1, path2])).toBe(expected);
    });

     test('should handle paths with double separators (Windows)', () => {
        if (!isWindows) return; // Windows specific
        const path1 = 'C:\\a\\\\b\\c';
        const path2 = 'C:\\a\\\\b\\d';
        // path.resolve normalizes \\ to \
        const expected = path.resolve('C:\\a\\b'); // Becomes C:\a\b after resolve
        expect(findCommonAncestor([path1, path2])).toBe(expected);
    });

    test('should handle root drive only common (Windows)', () => {
        if (!isWindows) return;
        const path1 = 'C:\\';
        const path2 = 'C:\\Users';
        expect(findCommonAncestor([path1, path2])).toBe('C:\\');
    });

    test('should handle root drive only common with file (Windows)', () => {
        if (!isWindows) return;
        const path1 = 'C:\\file.txt';
        const path2 = 'C:\\Users';
        expect(findCommonAncestor([path1, path2])).toBe('C:\\');
    });

     test('should handle only root common (POSIX)', () => {
        if (isWindows) return;
        const path1 = '/';
        const path2 = '/home';
        expect(findCommonAncestor([path1, path2])).toBe('/');
    });

     test('should handle only root common with file (POSIX)', () => {
        if (isWindows) return;
        const path1 = '/file.txt';
        const path2 = '/home';
        expect(findCommonAncestor([path1, path2])).toBe('/');
    });
});
