import process from 'process';
import { Readable } from 'stream';

/**
 * Reads paths from standard input.
 * Handles both space/newline separated and NUL separated input.
 */
export async function readPathsFromStdin(
  useNullSeparator: boolean
): Promise<string[]> {
  // If stdin is connected to a TTY (interactive terminal), don't wait for input.
  if (process.stdin.isTTY) {
    return [];
  }

  const chunks: Buffer[] = [];
  const stdinStream: Readable = process.stdin;

  return new Promise((resolve, reject) => {
    stdinStream.on('readable', () => {
      let chunk;
      while (null !== (chunk = stdinStream.read())) {
        chunks.push(chunk);
      }
    });

    stdinStream.on('end', () => {
      const completeInput = Buffer.concat(chunks).toString('utf8');
      if (!completeInput) {
        resolve([]);
        return;
      }

      let paths: string[];
      if (useNullSeparator) {
        // Split by NUL character and filter out empty strings
        paths = completeInput.split('\0').filter((p) => p.length > 0);
      } else {
        // Split by any whitespace and filter out empty strings
        paths = completeInput.split(/\s+/).filter((p) => p.length > 0);
      }
      resolve(paths);
    });

    stdinStream.on('error', (err) => {
      // Reject the promise if there's an error reading stdin
      reject(err);
    });
  });
}
