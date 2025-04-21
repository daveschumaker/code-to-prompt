import path from 'path';
import fsp from 'fs/promises';
import type { Ignore } from 'ignore';
import { minimatch } from 'minimatch';
import { BINARY_FILE_EXTENSIONS } from './constants';

export interface FileTreeOptions {
  baseIgnorePath: string;
  mainIg: Ignore;
  includeHidden: boolean;
  includeBinaryFiles?: boolean;
  /** Custom CLI ignore patterns (glob) */
  ignorePatterns?: string[];
  /** When true, apply ignorePatterns only to files */
  ignoreFilesOnly?: boolean;
}

export async function generateFileTree(
  paths: string[],
  options: FileTreeOptions
): Promise<string> {
  const fileSet = new Set<string>();
  async function recurse(p: string) {
    const rel = path.relative(options.baseIgnorePath, p);
    // Apply .gitignore rules
    if (rel && options.mainIg.ignores(rel)) return;
    const name = path.basename(p);
    // Hidden files/folders
    if (!options.includeHidden && name.startsWith('.')) return;
    // Stat once for directory/file checks and ignoreFilesOnly logic
    let stats;
    try {
      stats = await fsp.stat(p);
    } catch {
      return;
    }
    // Custom CLI ignore patterns
    if (
      options.ignorePatterns?.some((pattern) =>
        minimatch(rel, pattern, { dot: true })
      )
    ) {
      // If ignore-files-only, only skip files; otherwise skip both
      if (!options.ignoreFilesOnly || stats.isFile()) {
        return;
      }
    }
    if (stats.isDirectory()) {
      const entries = await fsp.readdir(p, { withFileTypes: true });
      for (const e of entries) {
        await recurse(path.join(p, e.name));
      }
    } else {
      // Check for binary files before adding to fileSet
      const fileExt = path.extname(p).toLowerCase();
      const isBinaryFile = BINARY_FILE_EXTENSIONS.includes(fileExt);
      if (!isBinaryFile || options.includeBinaryFiles === true) {
        fileSet.add(p);
      }
    }
  }
  for (const p of paths) await recurse(p);
  const rels = Array.from(fileSet)
    .map((p) => path.relative(options.baseIgnorePath, p))
    .sort();
  type TreeNode = { [name: string]: TreeNode };
  const root: TreeNode = {};
  for (const r of rels) {
    let cur = root;
    for (const part of r.split(path.sep)) {
      cur = (cur[part] ??= {});
    }
  }
  const lines = ['.'];
  function render(node: TreeNode, prefix: string) {
    const keys = Object.keys(node);
    keys.forEach((name, idx) => {
      const last = idx === keys.length - 1;
      const conn = last ? '└── ' : '├── ';
      lines.push(`${prefix}${conn}${name}`);
      render(node[name], prefix + (last ? '    ' : '│   '));
    });
  }
  render(root, '');
  return lines.join('\n');
}
