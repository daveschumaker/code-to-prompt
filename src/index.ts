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
import {
  getXdgConfigPath,
  loadConfig,
  initConfig,
  DebugLogger
} from './lib/config'; // Import config functions
import { findCommonAncestor } from './lib/pathUtils'; // Add this line
import { readPathsFromStdin } from './lib/stdinUtils'; // Add this line
import { formatBytes } from './lib/formatUtils'; // Add this line
import { processPath, ProcessPathOptions } from './lib/processor'; // Add this line

// --- Main CLI Execution ---

(async () => {
  const startTime = Date.now();

  // --- Early setup for Debug Logger (needed for config loading) ---
  // We parse verbose flag early, or assume false if it's not present yet
  const preliminaryArgs = process.argv.slice(2); // Get args excluding node and script name
  const isVerbose =
    preliminaryArgs.includes('--verbose') || preliminaryArgs.includes('-V');
  const debug: DebugLogger = (msg: string) => {
    if (isVerbose) console.error(msg);
  };

  // --- Determine Config Path ---
  // Check if --config is provided, otherwise use default
  let configPathArgIndex = preliminaryArgs.findIndex(
    (arg) => arg === '--config'
  );
  let configPath: string;
  if (
    configPathArgIndex !== -1 &&
    preliminaryArgs.length > configPathArgIndex + 1
  ) {
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
        normalize: true // Resolve the path
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
      .option('clipboard', {
        // Add this block
        alias: 'C',
        type: 'boolean',
        description: 'Copy the output directly to the system clipboard.',
        default: false,
        // conflicts: 'output' // Remove this - we will check manually
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

    // --- Debug: Log the final resolved argv object ---
    const finalDebugLogArgs = { ...argv };
    // Avoid logging potentially large stdin content if read early
    // Assign an array containing the string '[paths]'
    if (finalDebugLogArgs._) finalDebugLogArgs._ = ['[paths]'];
    debug(chalk.magenta('--- Final Resolved Yargs argv: ---'));
    debug(chalk.magenta(JSON.stringify(finalDebugLogArgs, null, 2)));
    debug(chalk.magenta('--- End of Resolved argv ---'));
    // --- End Debug ---

    // --- Manual Conflict Check ---
    if (argv.clipboard && argv.output) {
      // Throw the error manually if both options are present in the final argv
      throw new Error('Arguments clipboard (-C) and output (-o) are mutually exclusive.');
    }

    // Re-assign debug based on final parsed argv, in case config file set verbose
    const finalVerbose = argv.verbose ?? false;
    const finalDebug: DebugLogger = (msg: string) => {
      if (finalVerbose) console.error(msg);
    };
    // Use finalDebug from now on
    finalDebug(chalk.magenta('Verbose logging enabled.'));

    const stats = { foundFiles: 0, skippedFiles: 0 };

    // --- Prepare Arguments and Options ---
    // Yargs automatically merges config file values with CLI flags.
    // CLI flags take precedence over config file values.
    // Default values are used if neither CLI nor config provides them.

    const cliPaths = (argv._ as string[]).filter((arg) => arg !== 'init') || []; // Exclude 'init' command from paths
    const stdinPaths = await readPathsFromStdin(argv.null ?? false);
    const allPaths = [...cliPaths, ...stdinPaths];

    // Check if paths are needed (they aren't for 'init', which exits earlier)
    if (allPaths.length === 0 && argv._[0] !== 'init') {
      // Check command name if needed
      console.error(
        chalk.yellow(
          'No input paths provided. Use --help for usage or `code-to-prompt init` to create a config.'
        )
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
    finalDebug(
      chalk.blue(`Using extensions: ${extensions.join(', ') || 'None'}`)
    );

    // Get ignore patterns from the final argv
    const ignorePatterns: string[] = Array.isArray(argv.ignore)
      ? argv.ignore
      : argv.ignore
        ? [argv.ignore]
        : [];
    finalDebug(
      chalk.blue(
        `Using custom ignore patterns: ${ignorePatterns.join(', ') || 'None'}`
      )
    );

    // Check for mutually exclusive format flags
    if (argv.cxml && argv.markdown) {
      throw new Error(
        '--cxml and --markdown are mutually exclusive. Check config file and flags.'
      );
    }
    finalDebug(
      chalk.blue(
        `Output format: ${argv.cxml ? 'Claude XML' : argv.markdown ? 'Markdown' : 'Default'}`
      )
    );
    finalDebug(
      chalk.blue(
        `Line numbers: ${argv['line-numbers'] ? 'Enabled' : 'Disabled'}`
      )
    );
    finalDebug(
      chalk.blue(`Include hidden: ${argv['include-hidden'] ? 'Yes' : 'No'}`)
    );
    finalDebug(
      chalk.blue(`Include binary: ${argv['include-binary'] ? 'Yes' : 'No'}`)
    );
    finalDebug(
      chalk.blue(
        `Ignore files only: ${argv['ignore-files-only'] ? 'Yes' : 'No'}`
      )
    );
    finalDebug(
      chalk.blue(
        `Ignore .gitignore: ${argv['ignore-gitignore'] ? 'Yes' : 'No'}`
      )
    );
    finalDebug(chalk.blue(`Generate tree: ${argv.tree ? 'Yes' : 'No'}`));

    // --- Setup Writer ---
    let writer: Writer;
    let outputBuffer: string | null = null; // Buffer for clipboard content
    let fileStream: fs.WriteStream | null = null;
    const useClipboard = argv.clipboard as boolean; // Check the clipboard flag

    if (useClipboard) {
      finalDebug(
        chalk.blue('Clipboard output mode enabled. Buffering output.')
      );
      outputBuffer = '';
      writer = (text: string) => {
        // Append to buffer and add a newline, as printers call writer per logical line.
        if (outputBuffer !== null) {
          outputBuffer += text + '\n';
        }
      };
    } else if (argv.output) {
      finalDebug(
        chalk.blue(`File output mode enabled. Writing to: ${argv.output}`)
      );
      try {
        // Ensure directory exists and is writable (moved check here)
        await fsp.mkdir(path.dirname(argv.output), { recursive: true });
        await fsp.access(path.dirname(argv.output), fs.constants.W_OK);

        fileStream = fs.createWriteStream(argv.output, { encoding: 'utf-8' });
        writer = (text: string) => fileStream!.write(text + '\n'); // Write directly, printers add newlines
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        throw new Error(`Cannot write to output file ${argv.output}: ${msg}`);
      }
    } else {
      finalDebug(chalk.blue('Standard output mode enabled.'));
      // Default writer to stdout
      writer = (text: string) => process.stdout.write(text + '\n'); // Use process.stdout.write for direct control
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
          finalDebug(
            // Use finalDebug here
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
          finalDebug(
            chalk.yellow(`No .gitignore file found at ${baseIgnorePath}.`)
          ); // Use finalDebug here
        } else {
          finalDebug(
            chalk.yellow(`Could not read main .gitignore: ${err.message}`)
          ); // Use finalDebug here
        }
      }
    } else {
      finalDebug(
        // Use finalDebug here
        chalk.yellow(`Ignoring .gitignore file due to --ignore-gitignore flag.`)
      );
    }

    // --- Process Paths ---
    const absolutePaths = allPaths.map((p) => path.resolve(p)); // Resolve all paths first

    if (argv.tree) {
      // Calculate the common ancestor directory for the tree root
      const treeDisplayRoot = findCommonAncestor(absolutePaths);
      finalDebug(
        chalk.blue(`Tree display root calculated as: ${treeDisplayRoot}`)
      ); // Use finalDebug

      writer('Folder structure:');
      writer(treeDisplayRoot + path.sep); // Use the common ancestor display root
      writer('---');
      // Pass the calculated treeDisplayRoot as baseIgnorePath *for tree generation only*
      finalDebug(
        chalk.blue(
          `Setting up tree options. Include binary: ${argv['include-binary'] ?? false}`
        )
      ); // Use finalDebug
      const treeOptions: FileTreeOptions = {
        baseIgnorePath: treeDisplayRoot, // Use the correct root for tree display
        mainIg, // .gitignore rules
        includeHidden: argv['include-hidden'] ?? false,
        includeBinaryFiles: argv['include-binary'] ?? false,
        ignorePatterns, // CLI --ignore patterns
        ignoreFilesOnly: argv['ignore-files-only'] ?? false // apply ignore only to files if set
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
          finalDebug(
            chalk.yellow(`Could not update modification time of ${argv.output}`)
          );
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
