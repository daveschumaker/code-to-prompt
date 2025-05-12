import path from 'path';
import yargs from 'yargs/yargs';
import { hideBin } from 'yargs/helpers';
import chalk from 'chalk';
import { getXdgConfigPath, loadConfig, initConfig, DebugLogger } from '../lib/config';

/**
 * Parses CLI arguments and configuration.
 * Returns the parsed argv and a debug logger based on the verbose flag.
 */
export async function parseArgs(): Promise<{ argv: any; debug: DebugLogger }> {
  // Preliminary debug based on --verbose or -V in raw args
  const preliminaryArgs = hideBin(process.argv);
  const isVerbose = preliminaryArgs.includes('--verbose') || preliminaryArgs.includes('-V');
  const debug: DebugLogger = (msg: string) => {
    if (isVerbose) console.error(msg);
  };

  // Determine config file path (CLI flag or default XDG path)
  let configPath: string;
  const configIndex = preliminaryArgs.findIndex((a) => a === '--config');
  if (configIndex !== -1 && preliminaryArgs.length > configIndex + 1) {
    configPath = path.resolve(preliminaryArgs[configIndex + 1]);
    debug(chalk.blue(`Using custom config path from argument: ${configPath}`));
  } else {
    configPath = getXdgConfigPath();
    debug(chalk.blue(`Using default config path: ${configPath}`));
  }

  // Build yargs parser with command, options, and config loading
  const argv = await yargs(hideBin(process.argv))
    .usage('Usage: $0 [command] [options] [paths...]')
    .command(
      'init',
      'Create a default configuration file',
      () => {},
      async () => {
        debug(chalk.blue('Executing init command...'));
        try {
          await initConfig(debug);
          process.exit(0);
        } catch {
          console.error(chalk.red('Initialization failed.'));
          process.exit(1);
        }
      }
    )
    .option('config', {
      type: 'string',
      description: `Path to configuration file. Defaults to ${getXdgConfigPath()}`,
      default: configPath,
      normalize: true,
    })
    .config('config', (cfgPath) => loadConfig(cfgPath as string, debug))
    .option('extension', { alias: 'e', type: 'string', array: true, nargs: 1, default: [], description: 'File extensions to include' })
    .option('include-hidden', { type: 'boolean', default: false, description: 'Include hidden files/folders' })
    .option('include-binary', { type: 'boolean', default: false, description: 'Include binary files' })
    .option('ignore-files-only', { type: 'boolean', default: false, description: '--ignore only ignores files' })
    .option('ignore-gitignore', { type: 'boolean', default: false, description: 'Ignore .gitignore files' })
    .option('ignore', { type: 'string', array: true, nargs: 1, default: [], description: 'Glob patterns to ignore' })
    .option('output', { alias: 'o', type: 'string', description: 'Output to file', normalize: true })
    .option('cxml', { alias: 'c', type: 'boolean', default: false, description: 'Claude XML format' })
    .option('markdown', { alias: 'm', type: 'boolean', default: false, description: 'Markdown format' })
    .option('line-numbers', { alias: 'n', type: 'boolean', default: false, description: 'Add line numbers' })
    .option('clipboard', { alias: 'C', type: 'boolean', default: false, description: 'Copy output to clipboard' })
    .option('null', { alias: '0', type: 'boolean', default: false, description: 'Use NUL separator for stdin' })
    .option('tree', { type: 'boolean', default: false, description: 'Generate file tree at top' })
    .option('add-to-tree', { type: 'string', array: true, nargs: 1, default: [], description: 'Add specified paths to the file tree only, without exporting their contents' })
    .option('verbose', { alias: 'V', type: 'boolean', default: false, description: 'Enable verbose debug logging' })
    .help().alias('help', 'h')
    .version().alias('version', 'v')
    .strictOptions()
    .parserConfiguration({ 'duplicate-arguments-array': true, 'strip-aliased': true })
    .parseAsync();

  // Manual conflict checks
  if (argv.clipboard && argv.output) {
    throw new Error('Arguments clipboard (-C) and output (-o) are mutually exclusive.');
  }
  if (argv.cxml && argv.markdown) {
    throw new Error('--cxml and --markdown are mutually exclusive.');
  }

  // Final debug based on parsed verbose flag
  const finalVerbose = argv.verbose ?? false;
  const finalDebug: DebugLogger = (msg: string) => {
    if (finalVerbose) console.error(msg);
  };
  finalDebug(chalk.magenta('Verbose logging enabled.'));
  return { argv, debug: finalDebug };
}