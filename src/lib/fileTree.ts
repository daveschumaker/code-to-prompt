import path from 'path';
import fsp from 'fs/promises';
import type { Ignore } from 'ignore';

export interface FileTreeOptions {
  baseIgnorePath: string;
  mainIg: Ignore;
  includeHidden: boolean;
}

export async function generateFileTree(
  paths: string[],
  options: FileTreeOptions
): Promise<string> {
  const fileSet = new Set<string>();
  async function recurse(p: string) {
    const rel = path.relative(options.baseIgnorePath, p);
    if (rel && options.mainIg.ignores(rel)) return;
    const name = path.basename(p);
    if (!options.includeHidden && name.startsWith('.')) return;
    const stats = await fsp.stat(p);
    if (stats.isDirectory()) {
      const entries = await fsp.readdir(p, { withFileTypes: true });
      for (const e of entries) {
        await recurse(path.join(p, e.name));
      }
    } else {
      fileSet.add(p);
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
