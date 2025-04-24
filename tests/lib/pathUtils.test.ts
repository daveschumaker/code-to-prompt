import { findCommonAncestor } from '../../src/lib/pathUtils';
import path from 'path';
import process from 'process';

describe('findCommonAncestor', () => {
  const originalCwd = process.cwd();
  const isWindows = process.platform === 'win32';
  const root = isWindows ? 'C:\\' : '/';
  // Define a consistent mock CWD for tests that might involve relative paths resolution implicitly
  const mockCwd = path.resolve(isWindows ? 'C:\\users\\test' : '/users/test');

  // Note: findCommonAncestor itself doesn't use process.cwd(), but the paths passed to it
  // in the main CLI are resolved first. Testing with absolute paths is most direct.

  test('should return parent directory for a single file path', () => {
    const filePath = path.join(mockCwd, 'file.txt');
    expect(findCommonAncestor([filePath])).toBe(mockCwd);
  });

  test('should return the directory itself for a single directory path', () => {
    const dirPath = path.join(mockCwd, 'subdir');
    expect(findCommonAncestor([dirPath])).toBe(dirPath);
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

  test('should handle relative paths (assuming prior resolution)', () => {
    // findCommonAncestor expects absolute paths. Test with resolved paths.
    const resolvedPath1 = path.resolve(mockCwd, './src/a');
    const resolvedPath2 = path.resolve(mockCwd, './src/b');
    const expectedParent = path.resolve(mockCwd, './src');
    expect(findCommonAncestor([resolvedPath1, resolvedPath2])).toBe(expectedParent);
  });

  test('should handle identical paths', () => {
     const p = path.join(root, 'a', 'b', 'c');
     expect(findCommonAncestor([p, p])).toBe(p);
  });

  test('should handle paths with different casing on case-insensitive systems', () => {
      if (!isWindows) {
          // This test is primarily for case-insensitive file systems like Windows default
          return; // Skip on case-sensitive systems
      }
      // On Windows, path.resolve normalizes casing for drive letter but maybe not rest
      // Let's use paths that are distinct only in casing after the root
      const path1 = 'C:\\Users\\Test\\File.txt';
      const path2 = 'C:\\users\\test\\Another.txt';
      // findCommonAncestor uses split(path.sep). It relies on consistent casing *input*.
      // If paths aren't normalized beforehand, results might vary.
      // Assuming paths ARE normalized before calling:
      const normalizedPath1 = path.resolve(path1); // Might become C:\Users\Test\File.txt
      const normalizedPath2 = path.resolve(path2); // Might become C:\users\test\Another.txt
      // If normalization doesn't unify case beyond drive letter, test as is:
      // The function should probably handle this by comparing case-insensitively on Windows.
      // Let's assume it does:
      expect(findCommonAncestor([path1, path2])).toBe(path.join('C:\\', 'users', 'test')); // Expect normalized common part
  });

  test('should handle paths on different drives (Windows)', () => {
      if (!isWindows) {
          return; // Skip on non-Windows
      }
      const path1 = 'C:\\path\\to\\file';
      const path2 = 'D:\\another\\path';
      // No common path components, should return empty string or throw?
      // Current implementation likely returns empty string.
      expect(findCommonAncestor([path1, path2])).toBe('');
  });

  test('should handle UNC paths (Windows)', () => {
      if (!isWindows) {
          return; // Skip on non-Windows
      }
      const path1 = '\\\\server\\share\\folder1\\fileA';
      const path2 = '\\\\server\\share\\folder2\\fileB';
      expect(findCommonAncestor([path1, path2])).toBe('\\\\server\\share');

      const path3 = '\\\\server1\\share\\folder';
      const path4 = '\\\\server2\\share\\folder';
      expect(findCommonAncestor([path3, path4])).toBe(''); // Different servers

      const path5 = '\\\\server\\share1\\folder';
      const path6 = '\\\\server\\share2\\folder';
       expect(findCommonAncestor([path5, path6])).toBe('\\\\server'); // Common server only
  });

   test('should return root for single root path', () => {
        expect(findCommonAncestor([root])).toBe(root);
    });

    // Edge case: What if input array is empty?
    // The CLI prevents this by checking path length after stdin read.
    // If called directly, the current implementation might throw due to accessing parts[0].
    test('should throw error for empty input array', () => {
        expect(() => findCommonAncestor([])).toThrow();
    });
});
