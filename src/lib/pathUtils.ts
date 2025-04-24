import fs from 'fs';
import path from 'path';

/**
 * Finds the longest common ancestor path from a list of absolute paths.
 */
export function findCommonAncestor(paths: string[]): string {
  if (!paths || paths.length === 0) {
    return process.cwd(); // Default to CWD if no paths
  }
  if (paths.length === 1) {
    // If it's a file, return its directory, otherwise the path itself
    try {
      // Use sync stat here as it's simpler logic for this helper
      const stats = fs.statSync(paths[0]);
      return stats.isDirectory() ? paths[0] : path.dirname(paths[0]);
    } catch {
      // If stat fails, fallback to dirname
      return path.dirname(paths[0]);
    }
  }

  const pathComponents = paths.map((p) => p.split(path.sep).filter(Boolean)); // Split and remove empty strings

  let commonAncestorComponents: string[] = [];
  const firstPathComponents = pathComponents[0];

  for (let i = 0; i < firstPathComponents.length; i++) {
    const component = firstPathComponents[i];
    // Check if this component exists in the same position in all other paths
    if (pathComponents.every((p) => p.length > i && p[i] === component)) {
      commonAncestorComponents.push(component);
    } else {
      break; // Stop at the first mismatch
    }
  }

  // Handle the root case (e.g., '/' or 'C:\')
  const rootSeparator = paths[0].startsWith(path.sep) ? path.sep : '';
  const commonPath = rootSeparator + commonAncestorComponents.join(path.sep);

  // If the common path is empty (e.g., paths like /a/b and /c/d), return the root
  // Or if it's just the root separator, return that.
  return commonPath || rootSeparator || process.cwd(); // Fallback to CWD if truly no commonality
}
