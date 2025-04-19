#!/usr/bin/env node

// src/index.ts

import yargs from 'yargs/yargs';
import { hideBin } from 'yargs/helpers';
import fs from 'fs'; // Node's File System module
import fsp from 'fs/promises'; // Promises API for async operations
import path from 'path'; // Node's Path module
import { minimatch } from 'minimatch'; // Keep for --ignore patterns
import chalk from 'chalk'; // For terminal colors like click.style
import ignore, { Ignore } from 'ignore'; // Import the ignore library
import {
  addLineNumbers,
  printDefault,
  printAsXml,
  printAsMarkdown,
  printPath,
  Writer,
  globalIndex
} from './lib/printers';

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
}

/**
 * Processes a path (file or directory) recursively.
 */
async function processPath(
  targetPath: string,
  options: ProcessPathOptions
): Promise<void> {
  console.error(chalk.cyan(`[Debug] Processing path: ${targetPath}`));
  let stats: fs.Stats;
  try {
    stats = await fsp.stat(targetPath);
  } catch (error: any) {
    /* ... error handling ... */ return;
  }

  const baseName = path.basename(targetPath);
  const relativePath = path.relative(options.baseIgnorePath, targetPath);

  // --- Filter Section (Common for Files and Dirs) ---

  // Filter Hidden before checking ignore rules
  if (!options.includeHidden && baseName.startsWith('.')) {
    console.error(chalk.yellow(`    [Debug] Skipping hidden: ${baseName}`));
    return;
  }

  let isIgnoredByGitignore = false;
  if (relativePath) {
    // <-- Only check if relativePath is NOT empty
    isIgnoredByGitignore = options.mainIg.ignores(relativePath);
  }
  // Now use the result of the check
  if (isIgnoredByGitignore) {
    console.error(
      chalk.yellow(
        `    [Debug] Skipping due to ignore rules: ${baseName} (path: ${
          relativePath || '<root>'
        })` // Log adjusted
      )
    );
    return;
  }

  // --- Process Single File ---
  if (stats.isFile()) {
    console.error(chalk.cyan(`[Debug] Path is a file. Checking filters...`));

    // Filter custom ignore patterns (--ignore) applied to files
    if (
      options.ignorePatterns.some((pattern) =>
        minimatch(baseName, pattern, { dot: true })
      )
    ) {
      console.error(
        chalk.yellow(
          `    [Debug] Skipping file due to --ignore pattern: ${baseName}`
        )
      );
      return;
    }

    // Filter Extensions
    if (options.extensions.length > 0) {
      const fileExt = path.extname(targetPath);
      const matches = options.extensions.some((ext) => fileExt === ext);
      if (!matches) {
        console.error(
          chalk.yellow(`    [Debug] Skipping file (ext mismatch): ${baseName}`)
        );
        return;
      }
      console.error(
        chalk.green(`    [Debug] File passed extension filter: ${baseName}`)
      );
    } else {
      console.error(
        chalk.green(`    [Debug] File added (no ext filter): ${baseName}`)
      );
    }

    // Read and Print (if not skipped by filters above)
    try {
      console.error(chalk.cyan(`[Debug] Reading file: ${targetPath}`));
      const content = await fsp.readFile(targetPath, 'utf-8');
      console.error(chalk.cyan(`[Debug] Printing file: ${targetPath}`));
      printPath(
        options.writer,
        targetPath,
        content,
        options.claudeXml,
        options.markdown,
        options.lineNumbers
      );
    } catch (error: any) {
      const warningMessage = `Warning: Skipping file ${targetPath} due to read error: ${error.message}`;
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
      console.error(
        chalk.yellow(
          `    [Debug] Skipping directory due to --ignore pattern: ${baseName}`
        )
      );
      return; // Skip directory if it matches an ignore pattern
    }

    console.error(
      chalk.cyan(`[Debug] Path is a directory. Reading entries...`)
    );
    let entries: fs.Dirent[];
    try {
      entries = await fsp.readdir(targetPath, { withFileTypes: true });
      console.error(
        chalk.cyan(`[Debug] Found ${entries.length} entries in ${targetPath}`)
      );
    } catch (error: any) {
      console.error(
        chalk.red(`Error reading directory ${targetPath}: ${error.message}`)
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
      } catch (error: any) {
        throw new Error(
          `Cannot write to output file ${argv.output}: ${error.message}`
        );
      }
    }

    // --- Read Root .gitignore and Create Ignore Instance ---
    const baseIgnorePath = process.cwd(); // Assume .gitignore is relative to CWD
    let mainIg: Ignore = ignore();

    if (!(argv['ignore-gitignore'] ?? false)) {
      try {
        const gitignorePath = path.join(baseIgnorePath, '.gitignore');
        const gitignoreContent = await fsp.readFile(gitignorePath, 'utf-8');
        const rules = gitignoreContent
          .split('\n')
          .map((line) => line.trim())
          .filter((line) => line && !line.startsWith('#'));
        if (rules.length > 0) {
          console.error(
            chalk.blue(
              `[Debug] Initializing ignore patterns from ${gitignorePath} with ${rules.length} rules.`
            )
          );
          mainIg = ignore().add(rules);
        } else {
          console.error(
            chalk.yellow(`[Debug] No rules found in ${gitignorePath}.`)
          );
        }
      } catch (error: any) {
        if (error.code === 'ENOENT') {
          console.error(
            chalk.yellow(
              `[Debug] No .gitignore file found at ${baseIgnorePath}.`
            )
          );
        } else {
          console.error(
            chalk.yellow(
              `[Debug] Could not read main .gitignore: ${error.message}`
            )
          );
        }
      }
    } else {
      console.error(
        chalk.yellow(
          `[Debug] Ignoring .gitignore file due to --ignore-gitignore flag.`
        )
      );
    }

    // --- Process Paths ---
    if (options.tree) {
      const treeStr = await generateFileTree(allPaths, options)
      writer(treeStr.trimEnd())
    }
    if (argv.cxml) {
      writer('<documents>');
    }

    for (const targetPath of allPaths) {
      try {
        await fsp.access(targetPath);
      } catch (error: any) {
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
        tree: argv.tree ?? false // Whether to generate file tree
      };
      await processPath(path.resolve(targetPath), options); // Process absolute path
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
  } catch (error: any) {
    console.error(chalk.red(`\n❌ Error: ${error.message}`));
    // console.error(error.stack); // Uncomment for debugging stack traces
    process.exit(1);
  }
})();
