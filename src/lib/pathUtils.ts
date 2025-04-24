import fs from 'fs';
import path from 'path';
import process from 'process'; // Import process

/**
 * Finds the longest common ancestor path from a list of absolute paths.
 * Handles edge cases like single paths, root paths, and different drives/UNC paths.
 */
export function findCommonAncestor(paths: string[]): string {
  // Handle empty or null input
  if (!paths || paths.length === 0) {
    return process.cwd(); // Default to CWD if no paths provided
  }

  // Resolve all paths to ensure they are absolute and normalized
  const resolvedPaths = paths.map((p) => path.resolve(p));

  // Handle the case of a single path input
  if (resolvedPaths.length === 1) {
    const singlePath = resolvedPaths[0];
    try {
      // Check if the single path is a directory or a file
      const stats = fs.statSync(singlePath);
      // If it's a directory, return the path itself
      // If it's a file, return its containing directory
      return stats.isDirectory() ? singlePath : path.dirname(singlePath);
    } catch (error) {
      // If stat fails (e.g., path doesn't exist), return the parent directory
      // This handles cases like providing a non-existent file path
      return path.dirname(singlePath);
    }
  }

  // Split paths into components, handling the root directory correctly
  const pathComponents = resolvedPaths.map((p) => {
    const components = p.split(path.sep);
    // On Windows, C:\ splits to ['C:', ''], keep it this way.
    // On POSIX, / splits to ['', ''], adjust root to just [''] for easier comparison.
    // /a/b splits to ['', 'a', 'b']
    if (process.platform !== 'win32' && components.length > 1 && components[0] === '') {
        // Keep the leading '' for POSIX root paths like /a/b
        return components;
    }
    // Handle Windows drive root C:\ -> ['C:', '']
    if (process.platform === 'win32' && components.length === 2 && components[1] === '' && components[0].endsWith(':')) {
        return components;
    }
    // Handle Windows UNC root \\server\share -> ['', '', 'server', 'share']
    if (process.platform === 'win32' && components.length >= 4 && components[0] === '' && components[1] === '') {
        return components;
    }
    // For other cases or single-component paths (like just 'C:'), return as is.
    // Filter out empty strings *except* for the root cases handled above.
    // Example: /a//b -> ['', 'a', '', 'b'] -> filter -> ['', 'a', 'b'] - This loses the double slash info.
    // Let's avoid filtering empty strings here and rely on the loop logic.
    return components;
  });


  let commonAncestorComponents: string[] = [];
  const firstPathComponents = pathComponents[0];

  // Iterate through components of the first path
  for (let i = 0; i < firstPathComponents.length; i++) {
    const component = firstPathComponents[i];

    // Check if all other paths have this component at the same position
    if (pathComponents.every((p) => p.length > i && p[i] === component)) {
      commonAncestorComponents.push(component);
    } else {
      // Stop at the first mismatch
      break;
    }
  }

  // Reconstruct the path from common components

  // Handle special Windows cases first
  if (process.platform === 'win32') {
    // UNC path: \\server\share -> ['', '', 'server', 'share']
    if (commonAncestorComponents.length >= 4 && commonAncestorComponents[0] === '' && commonAncestorComponents[1] === '') {
      // Need to handle the case where only \\server is common
      if (commonAncestorComponents.length === 3 && commonAncestorComponents[2] !== '') {
         return '\\\\' + commonAncestorComponents[2]; // Return \\server
      }
      // Otherwise, join normally from the server part
      return '\\\\' + commonAncestorComponents.slice(2).join(path.sep);
    }
    // Drive letter path: C:\folder -> ['C:', 'folder'] or C:\ -> ['C:', '']
    if (commonAncestorComponents.length >= 1 && commonAncestorComponents[0].endsWith(':')) {
      // If only the drive letter is common (e.g., C:), return C:\
      if (commonAncestorComponents.length === 1) {
        return commonAncestorComponents[0] + path.sep;
      }
      // If C:\ is common -> ['C:', '']
      if (commonAncestorComponents.length === 2 && commonAncestorComponents[1] === '') {
          return commonAncestorComponents[0] + path.sep;
      }
      // Otherwise, join C: + separator + rest
      return commonAncestorComponents[0] + path.sep + commonAncestorComponents.slice(1).join(path.sep);
    }
  }

  // Handle POSIX root: /folder -> ['', 'folder'] or / -> ['']
  if (process.platform !== 'win32' && commonAncestorComponents.length >= 1 && commonAncestorComponents[0] === '') {
     // If only root '/' is common -> ['']
     if (commonAncestorComponents.length === 1) {
         return path.sep; // Return '/'
     }
     // Otherwise, join separator + rest
     return path.sep + commonAncestorComponents.slice(1).join(path.sep);
  }

  // If no common components were found (e.g., different drives C:\ vs D:\, or /a vs /b)
  if (commonAncestorComponents.length === 0) {
    return ''; // Indicate no common ancestor found
  }

  // Fallback for potentially relative paths or other structures (though input should be absolute)
  // Join the components. path.join might normalize separators (e.g., // -> /)
  // Using array.join preserves separators exactly as found in commonAncestorComponents.
  let joinedPath = commonAncestorComponents.join(path.sep);

  // Special case: If the only common part was a drive letter 'C:', join adds no separator. Fix it.
  if (process.platform === 'win32' && joinedPath.endsWith(':') && !joinedPath.includes(path.sep)) {
      return joinedPath + path.sep;
  }
  // Special case: If the only common part was POSIX root '', join results in empty string. Fix it.
   if (process.platform !== 'win32' && joinedPath === '' && commonAncestorComponents.length === 1 && commonAncestorComponents[0] === '') {
       return path.sep;
   }


  return joinedPath;
}
