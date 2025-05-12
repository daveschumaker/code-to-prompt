import path from 'path';
import chalk from 'chalk';
import type { Writer } from '../lib/printers';
import type { DebugLogger } from '../lib/config';
import { findCommonAncestor } from '../lib/pathUtils';
import { generateFileTree, FileTreeOptions } from '../lib/fileTree';

/**
 * Renders the ASCII file tree if requested.
 */
export async function renderTree(
  argv: any,
  absolutePaths: string[],
  absoluteAddToTree: string[],
  mainIg: import('ignore').Ignore,
  writer: Writer,
  debug: DebugLogger
): Promise<void> {
  if (!argv.tree) return;
  const treePaths = [...absolutePaths, ...absoluteAddToTree];
  const treeRoot = findCommonAncestor(treePaths);
  debug(chalk.blue(`Tree display root: ${treeRoot}`));
  writer('Folder structure:');
  writer(treeRoot + path.sep);
  writer('---');
  const treeOpts: FileTreeOptions = {
    baseIgnorePath: treeRoot,
    mainIg,
    includeHidden: argv['include-hidden'] ?? false,
    includeBinaryFiles: argv['include-binary'] ?? false,
    ignorePatterns: argv.ignore ?? [],
    ignoreFilesOnly: argv['ignore-files-only'] ?? false,
  };
  const treeStr = await generateFileTree(treePaths, treeOpts);
  writer(treeStr.trimEnd());
  writer('---');
  writer('');
}