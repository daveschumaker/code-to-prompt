#!/usr/bin/env node

// src/index.ts

import yargs from 'yargs/yargs';
import { hideBin } from 'yargs/helpers';
import fs from 'fs'; // Node's File System module
import fsp, { stat } from 'fs/promises'; // Promises API for async operations
import path from 'path'; // Node's Path module
import { minimatch } from 'minimatch'; // Keep for --ignore patterns
import chalk from 'chalk'; // For terminal colors like click.style
import ignore, { Ignore } from 'ignore'; // Import the ignore library
import type { ErrnoException, MaybeError } from './types';
import { printPath, Writer } from './lib/printers';
import { generateFileTree, FileTreeOptions } from './lib/fileTree'; // Import FileTreeOptions

// --- Helper Functions ---

/**
 * Finds the longest common ancestor path from a list of absolute paths.
 */
function findCommonAncestor(paths: string[]): string {
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

  const pathComponents = paths.map(p => p.split(path.sep).filter(Boolean)); // Split and remove empty strings

  let commonAncestorComponents: string[] = [];
  const firstPathComponents = pathComponents[0];

  for (let i = 0; i < firstPathComponents.length; i++) {
    const component = firstPathComponents[i];
    // Check if this component exists in the same position in all other paths
    if (pathComponents.every(p => p.length > i && p[i] === component)) {
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


// --- Core Logic ---

// Updated Options interface
interface ProcessPathOptions {
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
  tree: boolean; // Generate file tree at top
  debug: (msg: string) => void; // Debug logging helper
  stats: { foundFiles: number; skippedFiles: number }; // Run stats
}

/**
 * Processes a path (file or directory) recursively.
 */
async function processPath(
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
        minimatch(baseName, pattern, { dot: true })
      )
    ) {
      options.debug(
        chalk.yellow(`Skipping file due to --ignore pattern: ${baseName}`)
      );
      options.stats.skippedFiles++;
      return;
    }

    // Filter Extensions
    if (options.extensions.length > 0) {
      const fileExt = path.extname(targetPath);
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
        minimatch(baseName, pattern, { dot: true })
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

/**
 * Reads paths from standard input.
 */
async function readPathsFromStdin(
  useNullSeparator: boolean
): Promise<string[]> {
  if (process.stdin.isTTY) {
    return [];
  }
  let stdinContent = '';
  process.stdin.setEncoding('utf8');
  for await (const chunk of process.stdin) {
    stdinContent += chunk;
  }
  if (!stdinContent) {
    return [];
  }
  const separator = useNullSeparator ? '\0' : /\s+/;
  return stdinContent.split(separator).filter((p) => p);
}

// --- Main CLI Execution ---

(async () => {
  const startTime = Date.now();
  try {
    // --- Yargs Argument Parsing Setup ---
    const argv = await yargs(hideBin(process.argv))
      .usage('Usage: $0 [options] [paths...]')
      .option('extension', {
        alias: 'e',
        type: 'string',
        description: 'File extensions to include'
      })
      .option('include-hidden', {
        type: 'boolean',
        default: false,
        description: 'Include hidden files/folders'
      })
      .option('ignore-files-only', {
        type: 'boolean',
        default: false,
        description: '--ignore only ignores files'
      })
      .option('ignore-gitignore', {
        type: 'boolean',
        default: false,
        description: 'Ignore .gitignore files'
      })
      .option('ignore', {
        type: 'string',
        description: 'Glob patterns to ignore'
      })
      .option('output', {
        alias: 'o',
        type: 'string',
        description: 'Output to file',
        normalize: true
      })
      .option('cxml', {
        alias: 'c',
        type: 'boolean',
        default: false,
        description: 'Claude XML format'
      })
      .option('markdown', {
        alias: 'm',
        type: 'boolean',
        default: false,
        description: 'Markdown format'
      })
      .option('line-numbers', {
        alias: 'n',
        type: 'boolean',
        default: false,
        description: 'Add line numbers'
      })
      .option('null', {
        alias: '0',
        type: 'boolean',
        default: false,
        description: 'Use NUL separator for stdin'
      })
      .option('tree', {
        type: 'boolean',
        default: false,
        description: 'Generate file tree at top'
      })
      .option('verbose', {
        alias: 'V',
        type: 'boolean',
        default: false,
        description: 'Enable verbose debug logging'
      })
      .help()
      .alias('help', 'h')
      .version()
      .alias('version', 'v')
      .strictOptions()
      .parserConfiguration({
        'duplicate-arguments-array': true,
        'strip-aliased': true
      })
      .parseAsync();

    // Enable conditional debug logging
    const verbose = argv.verbose ?? false;
    const debug = (msg: string) => {
      if (verbose) console.error(msg);
    };
    const stats = { foundFiles: 0, skippedFiles: 0 };

    /**
     * Converts a byte count into a human‐readable string.
     */
    function formatBytes(bytes: number): string {
      if (bytes < 1024) return `${bytes} B`;
      const kb = bytes / 1024;
      if (kb < 1024) return `${kb.toFixed(2)} KB`;
      const mb = kb / 1024;
      return `${mb.toFixed(2)} MB`;
    }

    // --- Prepare Arguments and Options ---
    const cliPaths = (argv._ as string[]) || [];
    const stdinPaths = await readPathsFromStdin(argv.null ?? false);
    const allPaths = [...cliPaths, ...stdinPaths];
    if (allPaths.length === 0) {
      console.error(
        chalk.yellow('No input paths provided. Use --help for usage.')
      );
      process.exit(1);
    }
    const extensions: string[] = (
      Array.isArray(argv.extension)
        ? argv.extension
        : argv.extension
          ? [argv.extension]
          : []
    ).map((ext) => (ext.startsWith('.') ? ext : '.' + ext)); // Normalize extensions
    const ignorePatterns: string[] = Array.isArray(argv.ignore)
      ? argv.ignore
      : argv.ignore
        ? [argv.ignore]
        : [];
    if (argv.cxml && argv.markdown) {
      throw new Error('--cxml and --markdown are mutually exclusive.');
    }

    // --- Setup Writer ---
    let writer: Writer = console.log;
    let fileStream: fs.WriteStream | null = null;
    if (argv.output) {
      try {
        await fsp.access(path.dirname(argv.output), fs.constants.W_OK);
        fileStream = fs.createWriteStream(argv.output, { encoding: 'utf-8' });
        writer = (text: string) => fileStream!.write(text + '\n');
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        throw new Error(`Cannot write to output file ${argv.output}: ${msg}`);
      }
    }

    // --- Read Root .gitignore and Create Ignore Instance ---
    const baseIgnorePath = findCommonAncestor(
      allPaths.map(p => path.resolve(p))
    ); // Respect .gitignore at the project root (common ancestor)
    let mainIg: Ignore = ignore();
    // Wrap ignores to avoid thrown errors on non-relative paths
    const _origIgnores = mainIg.ignores.bind(mainIg);
    mainIg.ignores = (p: string): boolean => {
      try {
        return _origIgnores(p);
      } catch {
        return false;
      }
    };

    if (!(argv['ignore-gitignore'] ?? false)) {
      try {
        const gitignorePath = path.join(baseIgnorePath, '.gitignore');
        const gitignoreContent = await fsp.readFile(gitignorePath, 'utf-8');
        const rules = gitignoreContent
          .split('\n')
          .map((line) => line.trim())
          .filter((line) => line && !line.startsWith('#'));
        if (rules.length > 0) {
          debug(
            chalk.blue(
              `Initializing ignore patterns from ${gitignorePath} with ${rules.length} rules.`
            )
          );
          mainIg = ignore().add(rules);
          // Wrap ignores on the new instance as well
          const _origIgnores2 = mainIg.ignores.bind(mainIg);
          mainIg.ignores = (p: string): boolean => {
            try {
              return _origIgnores2(p);
            } catch {
              return false;
            }
          };
        } else {
          debug(chalk.yellow(`No rules found in ${gitignorePath}.`));
        }
      } catch (error: unknown) {
        const err = error as ErrnoException;
        if (err.code === 'ENOENT') {
          debug(chalk.yellow(`No .gitignore file found at ${baseIgnorePath}.`));
        } else {
          debug(chalk.yellow(`Could not read main .gitignore: ${err.message}`));
        }
      }
    } else {
      debug(
        chalk.yellow(`Ignoring .gitignore file due to --ignore-gitignore flag.`)
      );
    }

    // --- Process Paths ---
    const absolutePaths = allPaths.map(p => path.resolve(p)); // Resolve all paths first

    if (argv.tree) {
      // Calculate the common ancestor directory for the tree root
      const treeDisplayRoot = findCommonAncestor(absolutePaths);
      debug(chalk.blue(`Tree display root calculated as: ${treeDisplayRoot}`));

      writer('Folder structure:');
      writer(treeDisplayRoot + path.sep); // Use the common ancestor display root
      writer('---');
      // Pass the calculated treeDisplayRoot as baseIgnorePath *for tree generation only*
      const treeOptions: FileTreeOptions = {
          baseIgnorePath: treeDisplayRoot, // Use the correct root for tree display
          mainIg, // Still use the main ignore instance from cwd
          includeHidden: argv['include-hidden'] ?? false
      };
      const treeStr = await generateFileTree(absolutePaths, treeOptions);
      writer(treeStr.trimEnd());
      writer('---');
      writer('');
    }
    if (argv.cxml) {
      writer('<documents>');
    }

    // Use the resolved absolute paths for processing
    for (const targetPath of absolutePaths) {
      try {
        // Access check might be redundant if stat is done inside processPath anyway,
        // but keep it as a quick initial check.
        await fsp.access(targetPath);
      } catch (error: MaybeError) {
        console.error(
          chalk.red(
            `Error: Input path "${targetPath}" not found or inaccessible.`
          )
        );
        continue;
      }

      const options: ProcessPathOptions = {
        extensions,
        includeHidden: argv['include-hidden'] ?? false,
        ignoreFilesOnly: argv['ignore-files-only'] ?? false,
        ignorePatterns,
        writer,
        claudeXml: argv.cxml ?? false,
        markdown: argv.markdown ?? false,
        lineNumbers: argv['line-numbers'] ?? false,
        mainIg, // Pass the ignore instance
        baseIgnorePath, // Pass the base path
        tree: argv.tree ?? false, // Whether to generate file tree
        debug: debug,
        stats: stats
      };
      // targetPath is already absolute here
      await processPath(targetPath, options);
    }

    if (argv.cxml) {
      writer('</documents>');
    }

    // --- Cleanup ---
    if (fileStream) {
      await new Promise<void>((resolve) => {
        fileStream!.end(() => resolve());
      });
    }

    // Print run statistics to terminal
    const endTime = Date.now();
    console.error(`\nStats:`);
    console.error(`Total files found: ${stats.foundFiles}`);
    console.error(`Files skipped: ${stats.skippedFiles}`);
    if (argv.output) {
      try {
        const { size } = await fsp.stat(argv.output);
        console.error(`Output file size: ${formatBytes(size)}`);
      } catch {}
    }
    console.error(
      `Generation time: ${((endTime - startTime) / 1000).toFixed(2)}s`
    );
  } catch (error: any) {
    console.error(chalk.red(`\n❌ Error: ${error.message}`));
    // console.error(error.stack); // Uncomment for debugging stack traces
    process.exit(1);
  }
})();
