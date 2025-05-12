import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import chalk from 'chalk';
import ignore, { Ignore } from 'ignore';
import type { DebugLogger } from '../lib/config';

/**
 * Loads .gitignore rules unless ignored, returning an Ignore instance.
 */
export async function loadIgnore(
  argv: any,
  debug: DebugLogger
): Promise<{ mainIg: Ignore; baseIgnorePath: string }> {
  const cwd = process.cwd();
  let mainIg: Ignore = ignore();
  // Wrap ignores to avoid thrown errors
  const wrap = (ig: Ignore) => {
    const orig = ig.ignores.bind(ig);
    ig.ignores = (p: string) => {
      try {
        return orig(p);
      } catch {
        return false;
      }
    };
  };
  wrap(mainIg);

  if (!argv['ignore-gitignore']) {
    try {
      const giPath = path.join(cwd, '.gitignore');
      const content = await fsp.readFile(giPath, 'utf-8');
      const rules = content
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith('#'));
      if (rules.length > 0) {
        debug(chalk.blue(`Initializing ignore patterns from ${giPath} (${rules.length} rules).`));
        mainIg = ignore().add(rules);
        wrap(mainIg);
      } else {
        debug(chalk.yellow(`No rules found in ${giPath}.`));
      }
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        debug(chalk.yellow(`No .gitignore file found at ${cwd}.`));
      } else {
        debug(chalk.yellow(`Could not read .gitignore: ${err.message}`));
      }
    }
  } else {
    debug(chalk.yellow('Ignoring .gitignore due to flag.'));
  }
  return { mainIg, baseIgnorePath: cwd };
}