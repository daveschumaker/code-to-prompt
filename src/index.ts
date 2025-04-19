#!/usr/bin/env node

// src/index.ts

import yargs from 'yargs/yargs';
import { hideBin } from 'yargs/helpers';
import fs from 'fs'; // Node's File System module (sync for simplicity here, async preferred for performance)
import fsp from 'fs/promises'; // Promises API for async operations
import path from 'path'; // Node's Path module
import { minimatch } from 'minimatch'; // Like fnmatch for glob patterns
import chalk from 'chalk'; // For terminal colors like click.style

// --- Constants and Global State ---

// Equivalent to EXT_TO_LANG dictionary
const EXT_TO_LANG: { [key: string]: string } = {
  py: 'python',
  c: 'c',
  cpp: 'cpp',
  java: 'java',
  js: 'javascript',
  ts: 'typescript',
  html: 'html',
  css: 'css',
  xml: 'xml',
  json: 'json',
  yaml: 'yaml',
  yml: 'yaml',
  sh: 'bash',
  rb: 'ruby',
  // Add other extensions as needed
};

// Equivalent to global_index (scoped within the async function later)
let globalIndex = 1;

// Type definition for the writer function
type Writer = (text: string) => void;

// --- Helper Functions ---

/**
 * Checks if a given path should be ignored based on gitignore rules.
 * Equivalent to Python's should_ignore using fnmatch.
 */
function shouldIgnore(filePath: string, gitignoreRules: string[]): boolean {
  const baseName = path.basename(filePath);
  for (const rule of gitignoreRules) {
    // Basic check for file/directory name match
    if (minimatch(baseName, rule, { dot: true })) {
      // dot:true matches hidden files like .gitignore patterns
      return true;
    }
    // Check if it's a directory match (rule ends with /)
    try {
      // Use statSync for simplicity, could be async
      const stats = fs.statSync(filePath);
      if (
        stats.isDirectory() &&
        rule.endsWith('/') &&
        minimatch(baseName + '/', rule, { dot: true })
      ) {
        return true;
      }
    } catch (e) {
      // Ignore errors (e.g., file not found during check, though unlikely here)
    }
  }
  return false;
}

/**
 * Reads and parses a .gitignore file from a given directory path.
 * Equivalent to Python's read_gitignore.
 */
async function readGitignore(dirPath: string): Promise<string[]> {
  const gitignorePath = path.join(dirPath, '.gitignore');
  try {
    const content = await fsp.readFile(gitignorePath, 'utf-8');
    return content
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#')); // Filter empty lines and comments
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      // .gitignore file doesn't exist, return empty rules
      return [];
    }
    // Rethrow other errors (e.g., permissions)
    console.error(
      chalk.red(`Error reading ${gitignorePath}: ${error.message}`),
    );
    return []; // Return empty on error to avoid crashing
  }
}

/**
 * Adds line numbers to content block.
 * Equivalent to Python's add_line_numbers.
 */
function addLineNumbers(content: string): string {
  const lines = content.split('\n');
  // Calculate padding based on the total number of lines
  const padding = String(lines.length).length;
  const numberedLines = lines.map((line, index) => {
    // Pad line number (index + 1) to the calculated width
    return `${String(index + 1).padStart(padding)}  ${line}`;
  });
  return numberedLines.join('\n');
}

// --- Printing Functions ---

/**
 * Prints file content in the default format.
 */
function printDefault(
  writer: Writer,
  filePath: string,
  content: string,
  lineNumbers: boolean,
): void {
  writer(filePath);
  writer('---');
  if (lineNumbers) {
    content = addLineNumbers(content);
  }
  writer(content);
  writer(''); // Add a blank line for separation
  writer('---');
}

/**
 * Prints file content in XML-ish format for Claude.
 */
function printAsXml(
  writer: Writer,
  filePath: string,
  content: string,
  lineNumbers: boolean,
): void {
  writer(`<document index="${globalIndex}">`);
  writer(`<source>${filePath}</source>`);
  writer('<document_content>');
  if (lineNumbers) {
    content = addLineNumbers(content);
  }
  // Basic XML escaping (only handles essential characters)
  content = content
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  writer(content);
  writer('</document_content>');
  writer('</document>');
  globalIndex++; // Increment global index
}

/**
 * Prints file content as Markdown fenced code block.
 */
function printAsMarkdown(
  writer: Writer,
  filePath: string,
  content: string,
  lineNumbers: boolean,
): void {
  const extension = path.extname(filePath).substring(1); // Get extension without dot
  const lang = EXT_TO_LANG[extension] || ''; // Get language hint or empty string

  // Figure out how many backticks to use (to avoid issues if content has ```)
  let backticks = '```';
  while (content.includes(backticks)) {
    backticks += '`';
  }

  writer(filePath);
  writer(`${backticks}${lang}`); // Start fenced code block
  if (lineNumbers) {
    content = addLineNumbers(content);
  }
  writer(content);
  writer(backticks); // End fenced code block
  writer(''); // Add a blank line for separation
}

/**
 * Dispatches to the correct printing function based on flags.
 */
function printPath(
  writer: Writer,
  filePath: string,
  content: string,
  claudeXml: boolean,
  markdown: boolean,
  lineNumbers: boolean,
): void {
  if (claudeXml) {
    printAsXml(writer, filePath, content, lineNumbers);
  } else if (markdown) {
    printAsMarkdown(writer, filePath, content, lineNumbers);
  } else {
    printDefault(writer, filePath, content, lineNumbers);
  }
}

// --- Core Logic ---

interface ProcessPathOptions {
  extensions: string[];
  includeHidden: boolean;
  ignoreFilesOnly: boolean;
  ignoreGitignore: boolean;
  currentGitignoreRules: string[]; // Rules applicable to the current directory level
  ignorePatterns: string[];
  writer: Writer;
  claudeXml: boolean;
  markdown: boolean;
  lineNumbers: boolean;
}

/**
 * Processes a path (file or directory) recursively.
 * Equivalent to Python's process_path.
 */
async function processPath(
  targetPath: string,
  options: ProcessPathOptions,
): Promise<void> {
  let stats: fs.Stats;
  try {
    stats = await fsp.stat(targetPath);
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      console.error(chalk.red(`Error: Path does not exist: ${targetPath}`));
    } else {
      console.error(
        chalk.red(`Error accessing path ${targetPath}: ${error.message}`),
      );
    }
    return; // Skip this path if stat fails
  }

  // --- Process Single File ---
  if (stats.isFile()) {
    // 1. Check Extensions (if provided)
    if (options.extensions.length > 0) {
      const fileExt = path.extname(targetPath); // includes the dot e.g. ".js"
      // Allow extension matching with or without leading dot
      const matches = options.extensions.some(
        (ext) => fileExt === (ext.startsWith('.') ? ext : '.' + ext),
      );
      if (!matches) {
        return; // Skip file if extension doesn't match
      }
    }

    // 2. Check Custom Ignore Patterns
    if (
      options.ignorePatterns.some((pattern) =>
        minimatch(path.basename(targetPath), pattern, { dot: true }),
      )
    ) {
      return; // Skip if matches ignore pattern
    }

    // 3. Read and Print
    try {
      // Use utf-8 encoding, handle potential decoding errors
      const content = await fsp.readFile(targetPath, 'utf-8');
      printPath(
        options.writer,
        targetPath,
        content,
        options.claudeXml,
        options.markdown,
        options.lineNumbers,
      );
    } catch (error: any) {
      // Handle potential read errors (permissions, decoding)
      // Equivalent to Python's UnicodeDecodeError catch
      const warningMessage = `Warning: Skipping file ${targetPath} due to read error: ${error.message}`;
      console.error(chalk.yellow(warningMessage)); // Use yellow for warnings
    }
    return;
  }

  // --- Process Directory ---
  if (stats.isDirectory()) {
    let entries: fs.Dirent[];
    try {
      // Read directory entries with file types to avoid extra stats calls later
      entries = await fsp.readdir(targetPath, { withFileTypes: true });
    } catch (error: any) {
      console.error(
        chalk.red(`Error reading directory ${targetPath}: ${error.message}`),
      );
      return; // Skip directory if cannot read
    }

    let effectiveGitignoreRules = [...options.currentGitignoreRules]; // Inherit rules from parent

    // 1. Read .gitignore for this directory if not ignoring them globally
    if (!options.ignoreGitignore) {
      const localRules = await readGitignore(targetPath);
      effectiveGitignoreRules.push(...localRules);
    }

    const filesToProcess: string[] = [];
    const dirsToProcess: string[] = [];

    for (const entry of entries) {
      const entryPath = path.join(targetPath, entry.name);
      const baseName = entry.name; // path.basename(entryPath) is equivalent

      // 2. Filter Hidden Files/Dirs
      if (!options.includeHidden && baseName.startsWith('.')) {
        continue;
      }

      // 3. Filter based on .gitignore rules
      if (
        !options.ignoreGitignore &&
        shouldIgnore(entryPath, effectiveGitignoreRules)
      ) {
        continue;
      }

      // 4. Filter based on custom ignore patterns
      const ignoreMatch = options.ignorePatterns.some((pattern) =>
        minimatch(baseName, pattern, { dot: true }),
      );
      if (ignoreMatch) {
        // If it's a directory and we're not ignoring files only, skip it.
        // If it's a file, skip it.
        if (
          (entry.isDirectory() && !options.ignoreFilesOnly) ||
          entry.isFile()
        ) {
          continue;
        }
      }

      // 5. Categorize remaining entries
      if (entry.isDirectory()) {
        dirsToProcess.push(entryPath);
      } else if (entry.isFile()) {
        // Apply extension filter *before* adding to list for processing
        if (options.extensions.length > 0) {
          const fileExt = path.extname(entryPath);
          const matches = options.extensions.some(
            (ext) => fileExt === (ext.startsWith('.') ? ext : '.' + ext),
          );
          if (matches) {
            filesToProcess.push(entryPath);
          }
        } else {
          // No extension filter, add the file
          filesToProcess.push(entryPath);
        }
      }
    } // End loop through directory entries

    // 6. Recursively process subdirectories
    // Sort directories alphabetically like os.walk might implicitly do
    dirsToProcess.sort();
    for (const dir of dirsToProcess) {
      // Pass down the *effective* gitignore rules for this level
      await processPath(dir, {
        ...options,
        currentGitignoreRules: effectiveGitignoreRules,
      });
    }

    // 7. Process files in this directory
    // Sort files alphabetically
    filesToProcess.sort();
    for (const file of filesToProcess) {
      try {
        const content = await fsp.readFile(file, 'utf-8');
        printPath(
          options.writer,
          file,
          content,
          options.claudeXml,
          options.markdown,
          options.lineNumbers,
        );
      } catch (error: any) {
        const warningMessage = `Warning: Skipping file ${file} due to read error: ${error.message}`;
        console.error(chalk.yellow(warningMessage));
      }
    }
  } // End isDirectory block
}

/**
 * Reads paths from standard input.
 * Equivalent to Python's read_paths_from_stdin.
 */
async function readPathsFromStdin(
  useNullSeparator: boolean,
): Promise<string[]> {
  if (process.stdin.isTTY) {
    // No input piped, return empty
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

  const separator = useNullSeparator ? '\0' : /\s+/; // Split by NUL or whitespace
  return stdinContent.split(separator).filter((p) => p); // Filter empty strings
}

// --- Main CLI Execution ---

(async () => {
  try {
    // --- Yargs Argument Parsing Setup ---
    // Mimics the click options
    const argv = await yargs(hideBin(process.argv))
      .usage('Usage: $0 [options] [paths...]')
      .option('extension', {
        alias: 'e',
        type: 'string',
        description: 'File extensions to include (e.g., .ts, .py)',
        // Yargs automatically handles multiple uses by making it an array
      })
      .option('include-hidden', {
        type: 'boolean',
        default: false,
        description: 'Include files and folders starting with .',
      })
      .option('ignore-files-only', {
        type: 'boolean',
        default: false,
        description: '--ignore option only ignores files, not directories',
      })
      .option('ignore-gitignore', {
        type: 'boolean',
        default: false,
        description: 'Ignore .gitignore files and include all files',
      })
      .option('ignore', {
        type: 'string',
        description: 'Glob patterns to ignore (can be used multiple times)',
        // Yargs automatically handles multiple uses by making it an array
      })
      .option('output', {
        alias: 'o',
        type: 'string',
        description: 'Output to a file instead of stdout',
        normalize: true, // Normalizes the path
      })
      .option('cxml', {
        // claude-xml -> cxml
        alias: 'c',
        type: 'boolean',
        default: false,
        description:
          "Output in XML-ish format suitable for Claude's long context window.",
      })
      .option('markdown', {
        alias: 'm',
        type: 'boolean',
        default: false,
        description: 'Output Markdown with fenced code blocks',
      })
      .option('line-numbers', {
        alias: 'n',
        type: 'boolean',
        default: false,
        description: 'Add line numbers to the output',
      })
      .option('null', {
        // Renamed from '0' which isn't a valid identifier
        alias: '0',
        type: 'boolean',
        default: false,
        description:
          'Use NUL character as separator when reading path list from stdin',
      })
      .positional('paths', {
        describe: 'Paths to files or directories to process',
        type: 'string',
        // Yargs handles variable arguments via argv._ after parsing
      })
      .help()
      .alias('help', 'h')
      .version() // Add default version flag behavior
      .alias('version', 'v') // Use -v for version (common)
      .strict() // Report errors for unknown options/commands
      .parserConfiguration({
        // Ensure that multiple flags of the same type become arrays
        'duplicate-arguments-array': true,
        'strip-aliased': true, // Treat e.g. -e foo -e bar as ['foo', 'bar']
      })
      .parseAsync(); // Use parseAsync() for await

    // Reset global index at the start of each run
    globalIndex = 1;

    // --- Prepare Arguments and Options ---

    // Combine positional arguments (paths) and stdin paths
    const cliPaths = (argv._ as string[]) || []; // Positional args are in argv._
    const stdinPaths = await readPathsFromStdin(argv.null ?? false);
    const allPaths = [...cliPaths, ...stdinPaths];

    if (allPaths.length === 0) {
      console.error(
        chalk.yellow(
          'No input paths provided either via arguments or stdin. Use --help for usage.',
        ),
      );
      process.exit(1);
    }

    // Ensure options that expect arrays are arrays
    const extensions: string[] = Array.isArray(argv.extension)
      ? argv.extension
      : argv.extension
      ? [argv.extension]
      : [];
    const ignorePatterns: string[] = Array.isArray(argv.ignore)
      ? argv.ignore
      : argv.ignore
      ? [argv.ignore]
      : [];

    // Check for mutually exclusive output formats
    if (argv.cxml && argv.markdown) {
      throw new Error(
        'Options --cxml (-c) and --markdown (-m) are mutually exclusive.',
      );
    }

    // --- Setup Writer ---
    let writer: Writer = console.log; // Default to stdout
    let fileStream: fs.WriteStream | null = null;

    if (argv.output) {
      try {
        // Check if directory exists, is writable etc. (basic check)
        await fsp.access(path.dirname(argv.output), fs.constants.W_OK);
        fileStream = fs.createWriteStream(argv.output, { encoding: 'utf-8' });
        writer = (text: string) => fileStream!.write(text + '\n'); // Write line by line
      } catch (error: any) {
        throw new Error(
          `Cannot write to output file ${argv.output}: ${error.message}`,
        );
      }
    }

    // --- Process Paths ---
    let initialGitignoreRules: string[] = []; // Collect rules from dirs containing initial paths

    // Add XML document wrapper if needed
    if (argv.cxml) {
      writer('<documents>');
    }

    for (const targetPath of allPaths) {
      // Check path existence before processing
      try {
        await fsp.access(targetPath); // Throws if doesn't exist or no permissions
      } catch (error: any) {
        console.error(
          chalk.red(
            `Error: Input path "${targetPath}" not found or inaccessible.`,
          ),
        );
        continue; // Skip this path
      }

      // Read .gitignore from the *directory containing* the initial path, if applicable
      let initialRulesForPath: string[] = [];
      if (!argv.ignoreGitignore) {
        try {
          const stats = await fsp.stat(targetPath);
          const dirOfPath = stats.isDirectory()
            ? targetPath
            : path.dirname(targetPath);
          initialRulesForPath = await readGitignore(dirOfPath);
        } catch {
          // Ignore stat errors here, existence checked above
        }
      }

      const options: ProcessPathOptions = {
        extensions: extensions.map((ext) =>
          ext.startsWith('.') ? ext : '.' + ext,
        ), // Normalize extensions to start with .
        includeHidden: argv['include-hidden'] ?? false,
        ignoreFilesOnly: argv['ignore-files-only'] ?? false,
        ignoreGitignore: argv['ignore-gitignore'] ?? false,
        currentGitignoreRules: initialRulesForPath, // Start with rules from the containing dir
        ignorePatterns,
        writer,
        claudeXml: argv.cxml ?? false,
        markdown: argv.markdown ?? false,
        lineNumbers: argv['line-numbers'] ?? false,
      };
      await processPath(path.resolve(targetPath), options); // Resolve to absolute path
    }

    // Close XML document wrapper if needed
    if (argv.cxml) {
      writer('</documents>');
    }

    // --- Cleanup ---
    if (fileStream) {
      // End the stream and wait for it to finish writing
      await new Promise<void>((resolve) => {
        fileStream!.end(() => resolve());
      });
    }
  } catch (error: any) {
    console.error(chalk.red(`\n❌ Error: ${error.message}`));
    // console.error(error.stack); // Uncomment for debugging stack traces
    process.exit(1); // Exit with a non-zero code to indicate failure
  }
})(); // Immediately invoke the async function
