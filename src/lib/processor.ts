import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import { minimatch } from 'minimatch';
import chalk from 'chalk';
import { Ignore } from 'ignore';
import type { MaybeError } from '../types';
import { printPath, Writer } from './printers';
import { BINARY_FILE_EXTENSIONS } from './constants';
import type { DebugLogger } from './config'; // Import DebugLogger type

// Define and export the options interface
export interface ProcessPathOptions {
  extensions: string[];
  includeHidden: boolean;
  ignoreFilesOnly: boolean;
  ignorePatterns: string[];
  writer: Writer;
  claudeXml: boolean;
  markdown: boolean;
  lineNumbers: boolean;
  mainIg: Ignore; // The ignore instance
  baseIgnorePath: string; // Path relative to which ignore rules apply
  tree: boolean; // Generate file tree at top (though not directly used in processPath itself)
  debug: DebugLogger; // Debug logging helper
  stats: { foundFiles: number; skippedFiles: number }; // Run stats
  includeBinaryFiles: boolean; // Whether to include binary files
}

/**
 * Processes a path (file or directory) recursively.
 */
export async function processPath(
  targetPath: string,
  options: ProcessPathOptions
): Promise<void> {
  options.debug(chalk.cyan(`Processing path: ${targetPath}`));
  let stats: fs.Stats;
  try {
    stats = await fsp.stat(targetPath);
  } catch (error: MaybeError) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error(chalk.red(`Error accessing path ${targetPath}: ${errMsg}`));
    return;
  }

  const baseName = path.basename(targetPath);
  const relativePath = path.relative(options.baseIgnorePath, targetPath);

  // --- Filter Section (Common for Files and Dirs) ---

  // Filter Hidden before checking ignore rules
  if (!options.includeHidden && baseName.startsWith('.')) {
    options.debug(chalk.yellow(`    Skipping hidden: ${baseName}`));
    return;
  }

  let isIgnoredByGitignore = false;
  if (relativePath) {
    // <-- Only check if relativePath is NOT empty
    try {
      isIgnoredByGitignore = options.mainIg.ignores(relativePath);
    } catch {
      isIgnoredByGitignore = false;
    }
  }
  // Now use the result of the check
  if (isIgnoredByGitignore) {
    options.debug(
      chalk.yellow(
        `    Skipping due to ignore rules: ${baseName} (path: ${
          relativePath || '<root>'
        })`
      )
    );
    return;
  }

  // --- Process Single File ---
  if (stats.isFile()) {
    options.debug(chalk.cyan(`Path is a file. Checking filters...`));

    // Filter custom ignore patterns (--ignore) applied to files
    if (
      options.ignorePatterns.some((pattern) =>
        minimatch(relativePath, pattern, { dot: true })
      )
    ) {
      options.debug(
        chalk.yellow(`Skipping file due to --ignore pattern: ${baseName}`)
      );
      options.stats.skippedFiles++;
      return;
    }

    // Check for binary files first
    const fileExt = path.extname(targetPath).toLowerCase();
    const isBinaryFile = BINARY_FILE_EXTENSIONS.includes(fileExt);

    options.debug(
      chalk.cyan(
        `Checking binary status: ${baseName} (ext: ${fileExt}, isBinary: ${isBinaryFile}, includeBinary: ${options.includeBinaryFiles})`
      )
    );

    if (isBinaryFile && !options.includeBinaryFiles) {
      options.debug(
        chalk.yellow(`Skipping binary file: ${baseName} (ext: ${fileExt})`)
      );
      options.stats.skippedFiles++;
      return;
    }

    // Filter Extensions
    if (options.extensions.length > 0) {
      const matches = options.extensions.some((ext) => fileExt === ext);
      if (!matches) {
        options.debug(
          chalk.yellow(`Skipping file (ext mismatch): ${baseName}`)
        );
        options.stats.skippedFiles++;
        return;
      }
      options.debug(chalk.green(`File passed extension filter: ${baseName}`));
    } else {
      options.debug(chalk.green(`File added (no ext filter): ${baseName}`));
    }

    // Read and Print (if not skipped by filters above)
    try {
      options.debug(chalk.cyan(`Reading file: ${targetPath}`));
      const content = await fsp.readFile(targetPath, 'utf-8');
      options.debug(chalk.cyan(`Printing file: ${targetPath}`));
      printPath(
        options.writer,
        targetPath,
        content,
        options.claudeXml,
        options.markdown,
        options.lineNumbers
      );
      options.stats.foundFiles++;
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      const warningMessage = `Warning: Skipping file ${targetPath} due to read error: ${errMsg}`;
      console.error(chalk.yellow(warningMessage));
    }
    return; // Done processing the file
  }

  // --- Process Directory ---
  if (stats.isDirectory()) {
    // Filter custom ignore patterns applied to directories (if not --ignore-files-only)
    if (
      !options.ignoreFilesOnly &&
      options.ignorePatterns.some((pattern) =>
        minimatch(relativePath, pattern, { dot: true })
      )
    ) {
      options.debug(
        chalk.yellow(`Skipping directory due to --ignore pattern: ${baseName}`)
      );
      return; // Skip directory if it matches an ignore pattern
    }

    options.debug(chalk.cyan(`Path is a directory. Reading entries...`));
    let entries: fs.Dirent[];
    try {
      entries = await fsp.readdir(targetPath, { withFileTypes: true });
      options.debug(
        chalk.cyan(`Found ${entries.length} entries in ${targetPath}`)
      );
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      console.error(
        chalk.red(`Error reading directory ${targetPath}: ${errMsg}`)
      );
      return;
    }

    // Recursively process entries
    // Sort entries for consistent order
    entries.sort((a, b) => a.name.localeCompare(b.name));

    for (const entry of entries) {
      const entryPath = path.join(targetPath, entry.name);
      // Pass the same options down, including the mainIg instance
      // The filtering logic at the start of processPath will handle each entry
      await processPath(entryPath, options);
    }
  } // End isDirectory block
} // End processPath function
