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

// Simple implementation of concurrency limiter
class Limiter {
  private concurrency: number;
  private running: number = 0;
  private queue: Array<() => void> = [];

  constructor(concurrency: number) {
    this.concurrency = concurrency;
  }

  async add<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push(() => {
        this.running++;
        
        try {
          const result = fn();
          result
            .then(resolve)
            .catch(reject)
            .finally(() => {
              this.running--;
              this.next();
            });
        } catch (err) {
          this.running--;
          this.next();
          reject(err);
        }
      });
      
      this.next();
    });
  }

  private next(): void {
    if (this.running < this.concurrency && this.queue.length > 0) {
      const nextTask = this.queue.shift();
      if (nextTask) nextTask();
    }
  }
}

// Limit concurrent file operations to avoid overwhelming the system
const limit = new Limiter(10); // Process up to 10 files/directories concurrently

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
  // Calculate relative path *once* for use in ignore checks
  // Ensure it's never empty for root-level checks by using '.' if needed
  let relativePath = path.relative(options.baseIgnorePath, targetPath);
  if (relativePath === '') {
    relativePath = '.'; // Use '.' to represent the base path itself for ignore checks
  }

  // --- Filter Section (Common for Files and Dirs) ---

  // Filter Hidden before checking ignore rules
  if (!options.includeHidden && baseName.startsWith('.')) {
    options.debug(chalk.yellow(`    Skipping hidden: ${baseName}`));
    return;
  }

  // Check .gitignore rules (using the calculated relative path)
  let isIgnoredByGitignore = false;
  try {
    // Use the potentially adjusted relativePath (e.g., '.')
    isIgnoredByGitignore = options.mainIg.ignores(relativePath);
  } catch (e) {
    // Ignore errors from the ignore library (e.g., on absolute paths outside base)
    options.debug(
      chalk.red(
        `Error checking gitignore for ${relativePath}: ${
          e instanceof Error ? e.message : String(e)
        }`
      )
    );
    isIgnoredByGitignore = false;
  }

  if (isIgnoredByGitignore) {
    options.debug(
      chalk.yellow(
        `Skipping due to ignore rules: ${baseName}`
      )
    );
    return;
  }

  // --- Process Single File ---
  if (stats.isFile()) {
    options.debug(chalk.cyan(`Path is a file. Checking filters...`));

    // Filter custom ignore patterns (--ignore) applied to files
    // Use the original relativePath for minimatch comparison
    const minimatchRelativePath = path.relative(
      options.baseIgnorePath,
      targetPath
    );
    if (
      options.ignorePatterns.some((pattern) =>
        minimatch(minimatchRelativePath, pattern, { dot: true })
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
      // Optionally increment skippedFiles here if read errors should count as skipped
      // options.stats.skippedFiles++;
    }
    return; // Done processing the file
  }

  // --- Process Directory ---
  if (stats.isDirectory()) {
    // Filter custom ignore patterns applied to directories (if not --ignore-files-only)
    // Use the original relativePath for minimatch comparison
    const minimatchRelativePath = path.relative(
      options.baseIgnorePath,
      targetPath
    );
    if (
      !options.ignoreFilesOnly &&
      options.ignorePatterns.some((pattern) => {
        // Handle both patterns with and without trailing slash
        const normalizedPattern = pattern.endsWith('/') ? pattern : pattern;
        return minimatch(minimatchRelativePath, normalizedPattern, { dot: true });
      })
    ) {
      options.debug(
        chalk.yellow(`Skipping directory due to --ignore pattern: ${baseName}`)
      );
      // Note: We don't increment skippedFiles for directories, only files.
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

    // Create an array of tasks and process them in parallel
    const subTasks = entries.map(entry => {
      const entryPath = path.join(targetPath, entry.name);
      // Wrap each task with our limiter to control concurrency
      return limit.add(() => processPath(entryPath, options));
    });
    
    // Wait for all subtasks to complete
    await Promise.all(subTasks);
  } // End isDirectory block
} // End processPath function
