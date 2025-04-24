import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import os from 'os';
import chalk from 'chalk';

export type DebugLogger = (msg: string) => void;

// Default configuration structure
const DEFAULT_CONFIG = {
  ignore: [
    '**/node_modules/**',
    '*.log',
    'package-lock.json',
    'coverage/**',
    '.git/**', // Good default to add
    '.DS_Store', // macOS specific
  ],
  'include-hidden': false,
  'line-numbers': false, // Default to false, user can override
  markdown: false,       // Default to false
  cxml: false,           // Default to false
  'include-binary': false, // Default to false
  tree: false,           // Default to false
  // Add other relevant options with defaults if needed
};

/**
 * Finds the standard configuration file path based on XDG Base Directory Specification.
 * Defaults to ~/.config/code-to-prompt/config.json.
 */
export function getXdgConfigPath(): string {
  const xdgConfigHome = process.env.XDG_CONFIG_HOME;
  const homeDir = os.homedir();
  const configBase = xdgConfigHome && xdgConfigHome !== ''
    ? xdgConfigHome
    : path.join(homeDir, '.config'); // Default fallback

  return path.join(configBase, 'code-to-prompt', 'config.json');
}

/**
 * Loads configuration from a JSON file.
 * @param configPath The path to the configuration file.
 * @param debug A function for logging debug messages.
 * @returns The parsed configuration object, or an empty object if loading fails.
 */
export function loadConfig(configPath: string, debug: DebugLogger): Record<string, unknown> {
  debug(chalk.blue(`Attempting to load configuration from: ${configPath}`));
  try {
    // Check if the file exists before trying to read
    if (!fs.existsSync(configPath)) {
      debug(chalk.yellow(`Config file not found at ${configPath}. Using defaults/flags.`));
      return {}; // Return empty if file doesn't exist
    }

    const configContent = fs.readFileSync(configPath, 'utf-8');
    const parsedConfig = JSON.parse(configContent); // Parse first
    debug(chalk.green(`Successfully read and parsed config file: ${configPath}`)); // Log success after parsing

    // Basic validation: ensure it's an object
    if (typeof parsedConfig !== 'object' || parsedConfig === null) {
        console.error(chalk.red(`Error: Invalid configuration format in ${configPath}. Expected a JSON object.`));
        return {};
    }

    // Check if the loaded path is the default XDG path and if it contained settings
    const defaultXdgPath = getXdgConfigPath();
    if (configPath === defaultXdgPath && Object.keys(parsedConfig).length > 0) {
        // Use console.error to keep this informational message separate from stdout
        console.error(chalk.blue(`ℹ️ Loaded configuration from default path: ${configPath}`));
    }

    // Log the loaded configuration values if verbose logging is enabled
    debug(chalk.blue(`--- Configuration loaded from ${configPath}: ---`));
    for (const key in parsedConfig) {
      if (Object.prototype.hasOwnProperty.call(parsedConfig, key)) {
        // Log key and stringified value
        debug(chalk.blue(`  ${key}: ${JSON.stringify(parsedConfig[key])}`));
      }
    }
    debug(chalk.blue(`--- End of loaded configuration ---`));

    return parsedConfig;
  } catch (err: any) {
    // Handle JSON parsing errors specifically
    if (err instanceof SyntaxError) {
      console.error(chalk.red(`Error parsing config file ${configPath}: ${err.message}`));
    } else if (err.code !== 'ENOENT') { // ENOENT is handled above by existsSync
      // Log other file access errors
      console.error(chalk.red(`Error reading config file ${configPath}: ${err.message}`));
    } else {
       // Should not happen due to existsSync, but good fallback
       debug(chalk.yellow(`Config file not found at ${configPath} (error during read). Using defaults/flags.`));
    }
    return {}; // Return empty object if config load fails for any reason
  }
}


/**
 * Creates the default configuration file if it doesn't exist.
 * @param debug A function for logging debug messages.
 */
export async function initConfig(debug: DebugLogger): Promise<void> {
    const configPath = getXdgConfigPath();
    const configDir = path.dirname(configPath);
    debug(chalk.blue(`Initializing configuration at: ${configPath}`));

    try {
        // Check if file already exists
        if (fs.existsSync(configPath)) {
            console.log(chalk.yellow(`Configuration file already exists at ${configPath}. No action taken.`));
            return;
        }

        // Create directory if it doesn't exist
        if (!fs.existsSync(configDir)) {
            debug(chalk.blue(`Creating config directory: ${configDir}`));
            await fsp.mkdir(configDir, { recursive: true });
            debug(chalk.green(`Successfully created config directory: ${configDir}`));
        }

        // Write the default configuration
        debug(chalk.blue(`Writing default configuration to: ${configPath}`));
        await fsp.writeFile(configPath, JSON.stringify(DEFAULT_CONFIG, null, 2), 'utf-8'); // Pretty print JSON
        console.log(chalk.green(`Successfully created default configuration file at ${configPath}`));

    } catch (error: any) {
        console.error(chalk.red(`Error initializing configuration file at ${configPath}: ${error.message}`));
        // Rethrow or exit if needed, depending on desired behavior
        throw error; // Propagate error for handling in index.ts
    }
}
