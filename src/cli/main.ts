import path from 'path';
import fs from 'fs';
import fsp from 'fs/promises';
import chalk from 'chalk';
import { parseArgs } from './parser';
import { createWriter } from './writer';
import { loadIgnore } from './ignore';
import { renderTree } from './tree';
import { readPathsFromStdin } from '../lib/stdinUtils';
import { processPath, ProcessPathOptions } from '../lib/processor';
import { formatBytes } from '../lib/formatUtils';

/**
 * Main entry point for the CLI.
 */
export default async function run(): Promise<void> {
  const startTime = Date.now();
  const { argv, debug } = await parseArgs();
  const stats = { foundFiles: 0, skippedFiles: 0 };

  // Collect input paths
  const cliPaths = (argv._ as string[]).filter((p) => p !== 'init');
  const stdinPaths = await readPathsFromStdin(argv.null ?? false);
  const allPaths = [...cliPaths, ...stdinPaths];
  if (allPaths.length === 0) {
    console.error(
      chalk.yellow(
        'No input paths provided. Use --help for usage or `code-to-prompt init` to create a config.'
      )
    );
    process.exit(1);
  }

  // Paths to add only to tree
  const addToTreeRaw: string[] = Array.isArray(argv['add-to-tree'])
    ? argv['add-to-tree']
    : argv['add-to-tree']
    ? [argv['add-to-tree']]
    : [];

  // Resolve absolute paths
  const absolutePaths = allPaths.map((p) => path.resolve(p));
  const absoluteAddToTree = addToTreeRaw.map((p) => path.resolve(p));

  // Setup writer
  const { writer, finalize } = await createWriter(argv, debug);

  // Load ignore rules
  const { mainIg, baseIgnorePath } = await loadIgnore(argv, debug);

  // Render tree if requested
  await renderTree(argv, absolutePaths, absoluteAddToTree, mainIg, writer, debug);

  // Open cxml wrapper if needed
  if (argv.cxml) {
    writer('<documents>');
  }

  // Process each input path
  for (const targetPath of absolutePaths) {
    try {
      await fsp.access(targetPath);
    } catch {
      console.error(
        chalk.red(`Error: Input path "${targetPath}" not found or inaccessible.`)
      );
      continue;
    }
    const options: ProcessPathOptions = {
      extensions: Array.isArray(argv.extension)
        ? argv.extension
        : argv.extension
        ? [argv.extension]
        : [],
      includeHidden: argv['include-hidden'] ?? false,
      ignoreFilesOnly: argv['ignore-files-only'] ?? false,
      ignorePatterns: Array.isArray(argv.ignore)
        ? argv.ignore
        : argv.ignore
        ? [argv.ignore]
        : [],
      writer,
      claudeXml: argv.cxml ?? false,
      markdown: argv.markdown ?? false,
      lineNumbers: argv['line-numbers'] ?? false,
      mainIg,
      baseIgnorePath,
      tree: argv.tree ?? false,
      debug,
      stats,
      includeBinaryFiles: argv['include-binary'] ?? false,
    };
    await processPath(targetPath, options);
  }

  // Close cxml wrapper
  if (argv.cxml) {
    writer('</documents>');
  }

  // Finalize output (close files or write clipboard)
  await finalize();

  // Print statistics
  const endTime = Date.now();
  console.error(`\nStats:`);
  console.error(`Total files found: ${stats.foundFiles}`);
  console.error(`Files skipped: ${stats.skippedFiles}`);
  if (argv.output) {
    try {
      const { size } = await fsp.stat(argv.output as string);
      console.error(`Output file size: ${formatBytes(size)}`);
    } catch {}
  }
  console.error(`Generation time: ${((endTime - startTime) / 1000).toFixed(2)}s`);
}