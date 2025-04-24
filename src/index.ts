#!/usr/bin/env node

// src/index.ts

// src/index.ts

import clipboardy from 'clipboardy'; // Add this line
import yargs from 'yargs/yargs';
import { hideBin } from 'yargs/helpers';
import fs from 'fs'; // Node's File System module
import fsp, { stat } from 'fs/promises'; // Promises API for async operations
import path from 'path'; // Node's Path module
import { minimatch } from 'minimatch'; // Keep for --ignore patterns
import chalk from 'chalk'; // For terminal colors like click.style
import ignore, { Ignore } from 'ignore'; // Import the ignore library
import type { ErrnoException, MaybeError } from './types';
import os from 'os'; // Import os module
import { printPath, Writer } from './lib/printers';
import { generateFileTree, FileTreeOptions } from './lib/fileTree';
import { BINARY_FILE_EXTENSIONS } from './lib/constants';
import { getXdgConfigPath, loadConfig, initConfig, DebugLogger } from './lib/config'; // Import config functions

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
  includeBinaryFiles: boolean; // Whether to include binary files
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
      chalk.cyan(`Checking binary status: ${baseName} (ext: ${fileExt}, isBinary: ${isBinaryFile}, includeBinary: ${options.includeBinaryFiles})`)
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

  // --- Early setup for Debug Logger (needed for config loading) ---
  // We parse verbose flag early, or assume false if it's not present yet
  const preliminaryArgs = process.argv.slice(2); // Get args excluding node and script name
  const isVerbose = preliminaryArgs.includes('--verbose') || preliminaryArgs.includes('-V');
  const debug: DebugLogger = (msg: string) => {
    if (isVerbose) console.error(msg);
  };

  // --- Determine Config Path ---
  // Check if --config is provided, otherwise use default
  let configPathArgIndex = preliminaryArgs.findIndex(arg => arg === '--config');
  let configPath: string;
  if (configPathArgIndex !== -1 && preliminaryArgs.length > configPathArgIndex + 1) {
      configPath = path.resolve(preliminaryArgs[configPathArgIndex + 1]); // Resolve custom path
      debug(chalk.blue(`Using custom config path from argument: ${configPath}`));
  } else {
      configPath = getXdgConfigPath(); // Get default XDG path
      debug(chalk.blue(`Using default config path: ${configPath}`));
  }

  try {
    // --- Yargs Argument Parsing Setup ---
    const argv = await yargs(hideBin(process.argv))
      .usage('Usage: $0 [command] [options] [paths...]')
      // --- Commands ---
      .command(
        'init',
        'Create a default configuration file (~/.config/code-to-prompt/config.json)',
        (yargs) => {}, // No specific options for init command
        async (argv) => {
          // Handle the init command logic here
          debug(chalk.blue('Executing init command...'));
          try {
            await initConfig(debug); // Call the init function
            process.exit(0); // Exit successfully after init
          } catch (error) {
            console.error(chalk.red('Initialization failed.'));
            process.exit(1); // Exit with error if init fails
          }
        }
      )
      // --- Options ---
      .option('config', {
        type: 'string',
        description: `Path to configuration file. Defaults to ${getXdgConfigPath()}`,
        default: configPath, // Use the determined path as default
        normalize: true, // Resolve the path
      })
      .config('config', (cfgPath) => {
          // Use the loadConfig function as the parser
          // cfgPath is the path determined by yargs (default or from --config flag)
          return loadConfig(cfgPath, debug);
      })
      .option('extension', {
        alias: 'e',
        type: 'string',
        array: true,
        nargs: 1,
        default: [],
        description: 'File extensions to include'
      })
      .option('include-hidden', {
        type: 'boolean',
        default: false,
        description: 'Include hidden files/folders'
      })
      .option('include-binary', {
        type: 'boolean',
        default: false,
        description: 'Include binary files (images, executables, etc.)'
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
        array: true,
        nargs: 1,
        default: [],
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
      .option('clipboard', { // Add this block
        alias: 'C',
        type: 'boolean',
        description: 'Copy the output directly to the system clipboard.',
        default: false,
        conflicts: 'output', // Cannot use --clipboard and --output together
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
      .parseAsync(); // Yargs parsing happens here

    // Re-assign debug based on final parsed argv, in case config file set verbose
    const finalVerbose = argv.verbose ?? false;
    const finalDebug: DebugLogger = (msg: string) => {
        if (finalVerbose) console.error(msg);
    };
    // Use finalDebug from now on
    finalDebug(chalk.magenta('Verbose logging enabled.'));


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
    // Yargs automatically merges config file values with CLI flags.
    // CLI flags take precedence over config file values.
    // Default values are used if neither CLI nor config provides them.

    const cliPaths = (argv._ as string[]).filter(arg => arg !== 'init') || []; // Exclude 'init' command from paths
    const stdinPaths = await readPathsFromStdin(argv.null ?? false);
    const allPaths = [...cliPaths, ...stdinPaths];

    // Check if paths are needed (they aren't for 'init', which exits earlier)
    if (allPaths.length === 0 && argv._[0] !== 'init') { // Check command name if needed
        console.error(
            chalk.yellow('No input paths provided. Use --help for usage or `code-to-prompt init` to create a config.')
        );
        process.exit(1);
    }

    // Normalize extensions from the final argv (merged config + flags)
    const extensions: string[] = (
      Array.isArray(argv.extension)
        ? argv.extension
        : argv.extension
          ? [argv.extension]
          : []
    ).map((ext) => (ext.startsWith('.') ? ext : '.' + ext));
    finalDebug(chalk.blue(`Using extensions: ${extensions.join(', ') || 'None'}`));

    // Get ignore patterns from the final argv
    const ignorePatterns: string[] = Array.isArray(argv.ignore)
      ? argv.ignore
      : argv.ignore
        ? [argv.ignore]
        : [];
    finalDebug(chalk.blue(`Using custom ignore patterns: ${ignorePatterns.join(', ') || 'None'}`));

    // Check for mutually exclusive format flags
    if (argv.cxml && argv.markdown) {
      throw new Error('--cxml and --markdown are mutually exclusive. Check config file and flags.');
    }
    finalDebug(chalk.blue(`Output format: ${argv.cxml ? 'Claude XML' : argv.markdown ? 'Markdown' : 'Default'}`));
    finalDebug(chalk.blue(`Line numbers: ${argv['line-numbers'] ? 'Enabled' : 'Disabled'}`));
    finalDebug(chalk.blue(`Include hidden: ${argv['include-hidden'] ? 'Yes' : 'No'}`));
    finalDebug(chalk.blue(`Include binary: ${argv['include-binary'] ? 'Yes' : 'No'}`));
    finalDebug(chalk.blue(`Ignore files only: ${argv['ignore-files-only'] ? 'Yes' : 'No'}`));
    finalDebug(chalk.blue(`Ignore .gitignore: ${argv['ignore-gitignore'] ? 'Yes' : 'No'}`));
    finalDebug(chalk.blue(`Generate tree: ${argv.tree ? 'Yes' : 'No'}`));

    // --- Setup Writer ---
    let writer: Writer;
    let outputBuffer: string | null = null; // Buffer for clipboard content
    let fileStream: fs.WriteStream | null = null;
    const useClipboard = argv.clipboard as boolean; // Check the clipboard flag

    if (useClipboard) {
      finalDebug(chalk.blue('Clipboard output mode enabled. Buffering output.'));
      outputBuffer = '';
      writer = (text: string) => {
        // Append to buffer and add a newline, as printers call writer per logical line.
        if (outputBuffer !== null) {
          outputBuffer += text + '\n';
        }
      };
    } else if (argv.output) {
      finalDebug(chalk.blue(`File output mode enabled. Writing to: ${argv.output}`));
      try {
        // Ensure directory exists and is writable (moved check here)
        await fsp.mkdir(path.dirname(argv.output), { recursive: true });
        await fsp.access(path.dirname(argv.output), fs.constants.W_OK);

        fileStream = fs.createWriteStream(argv.output, { encoding: 'utf-8' });
        writer = (text: string) => fileStream!.write(text); // Write directly, printers add newlines
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        throw new Error(`Cannot write to output file ${argv.output}: ${msg}`);
      }
    } else {
      finalDebug(chalk.blue('Standard output mode enabled.'));
      // Default writer to stdout
      writer = (text: string) => process.stdout.write(text); // Use process.stdout.write for direct control
    }

    // --- Prepare base paths ---
    const cwd = process.cwd();
    // baseIgnorePath is where .gitignore is loaded from and relative paths are calculated
    const baseIgnorePath = cwd;
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
          finalDebug( // Use finalDebug here
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
          finalDebug(chalk.yellow(`No rules found in ${gitignorePath}.`)); // Use finalDebug here
        }
      } catch (error: unknown) {
        const err = error as ErrnoException;
        if (err.code === 'ENOENT') {
          finalDebug(chalk.yellow(`No .gitignore file found at ${baseIgnorePath}.`)); // Use finalDebug here
        } else {
          finalDebug(chalk.yellow(`Could not read main .gitignore: ${err.message}`)); // Use finalDebug here
        }
      }
    } else {
      finalDebug( // Use finalDebug here
        chalk.yellow(`Ignoring .gitignore file due to --ignore-gitignore flag.`)
      );
    }

    // --- Process Paths ---
    const absolutePaths = allPaths.map(p => path.resolve(p)); // Resolve all paths first

    if (argv.tree) {
      // Calculate the common ancestor directory for the tree root
      const treeDisplayRoot = findCommonAncestor(absolutePaths);
      finalDebug(chalk.blue(`Tree display root calculated as: ${treeDisplayRoot}`)); // Use finalDebug

      writer('Folder structure:');
      writer(treeDisplayRoot + path.sep); // Use the common ancestor display root
      writer('---');
      // Pass the calculated treeDisplayRoot as baseIgnorePath *for tree generation only*
      finalDebug(chalk.blue(`Setting up tree options. Include binary: ${argv['include-binary'] ?? false}`)); // Use finalDebug
      const treeOptions: FileTreeOptions = {
          baseIgnorePath: treeDisplayRoot, // Use the correct root for tree display
          mainIg, // .gitignore rules
          includeHidden: argv['include-hidden'] ?? false,
          includeBinaryFiles: argv['include-binary'] ?? false,
          ignorePatterns,   // CLI --ignore patterns
          ignoreFilesOnly: argv['ignore-files-only'] ?? false  // apply ignore only to files if set
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
        debug: finalDebug, // Use finalDebug
        stats: stats,
        includeBinaryFiles: argv['include-binary'] ?? false
      };
      // targetPath is already absolute here
      await processPath(targetPath, options);
    }

    if (argv.cxml) {
      writer('</documents>');
    }

    // --- Final Output Handling ---
    if (fileStream) {
      // Close the file stream if it exists
      await new Promise<void>((resolve, reject) => {
        fileStream!.end((err?: Error | null) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });
      finalDebug(chalk.green(`Output successfully written to ${argv.output}`));

      // Update the modification time of the output file
      if (argv.output) {
        try {
          const now = new Date();
          await fsp.utimes(argv.output, now, now);
        } catch (error) {
          finalDebug(chalk.yellow(`Could not update modification time of ${argv.output}`));
        }
      }
    } else if (useClipboard && outputBuffer !== null) {
      // Write to clipboard if clipboard mode was used
      try {
        await clipboardy.write(outputBuffer);
        // Log success to stderr since stdout isn't used for primary output in clipboard mode
        console.error(chalk.green('Output successfully copied to clipboard.'));
      } catch (err) {
        console.error(chalk.red('Error copying to clipboard:'), err);
        // Optionally: Fallback to printing to stdout if clipboard fails?
        // process.stdout.write(outputBuffer);
      }
    }

    // --- Statistics Logging (Keep this after output handling) ---
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
