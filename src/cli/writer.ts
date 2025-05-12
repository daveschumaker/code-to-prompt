import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import chalk from 'chalk';
import type { Writer } from '../lib/printers';
import { writeClipboardSafe } from '../lib/clipWriter';
import type { DebugLogger } from '../lib/config';

/**
 * Factory to create a writer function and a finalize handler based on argv.
 */
export async function createWriter(
  argv: any,
  debug: DebugLogger
): Promise<{ writer: Writer; finalize: () => Promise<void> }> {
  // Clipboard mode
  if (argv.clipboard) {
    debug(chalk.blue('Clipboard output mode enabled. Buffering output.'));
    let buffer = '';
    const writer: Writer = (text: string) => {
      buffer += text + '\n';
    };
    const finalize = async () => {
      await writeClipboardSafe(buffer);
      console.error(chalk.green('Output successfully copied to clipboard.'));
    };
    return { writer, finalize };
  }

  // File output mode
  if (argv.output) {
    debug(chalk.blue(`File output mode enabled. Writing to: ${argv.output}`));
    const outDir = path.dirname(argv.output as string);
    await fsp.mkdir(outDir, { recursive: true });
    await fsp.access(outDir, fs.constants.W_OK);
    const fileStream = fs.createWriteStream(argv.output as string, { encoding: 'utf-8' });
    const writer: Writer = (text: string) => fileStream.write(text + '\n');
    const finalize = async () => {
      await new Promise<void>((resolve, reject) => {
        fileStream.end((err?: Error | null) => (err ? reject(err) : resolve()));
      });
      debug(chalk.green(`Output successfully written to ${argv.output}`));
      // Update modification time
      try {
        const now = new Date();
        await fsp.utimes(argv.output as string, now, now);
      } catch {
        debug(chalk.yellow(`Could not update modification time of ${argv.output}`));
      }
    };
    return { writer, finalize };
  }

  // Standard output mode
  debug(chalk.blue('Standard output mode enabled.'));
  const writer: Writer = (text: string) => process.stdout.write(text + '\n');
  const finalize = async () => {
    // no-op
  };
  return { writer, finalize };
}