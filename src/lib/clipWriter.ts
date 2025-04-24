import { tmpdir } from 'os';
import { writeFile } from 'fs/promises';
import path from 'path';
import { v4 as uuid } from 'uuid';
import { spawn } from 'child_process';

/**
 * Writes content to clipboard safely, using a temporary file for large content
 * to avoid memory issues with the clipboard
 */
export async function writeClipboardSafe(buf: string): Promise<void> {
  // Dynamically import clipboardy (ESM module)
  const clipboardy = await import('clipboardy');
  
  if (buf.length < 1_000_000) {
    // Under 1MB, use regular clipboard write
    return clipboardy.default.write(buf);
  }
  
  // For large content, use temp file approach
  const tempPath = path.join(tmpdir(), `ctp-${uuid()}.txt`);
  await writeFile(tempPath, buf);
  
  // Use platform-specific approach for copying from file
  try {
    if (process.platform === 'darwin') {
      // On macOS, use pbcopy
      const pbcopy = spawn('pbcopy');
      pbcopy.stdin.write(buf);
      pbcopy.stdin.end();
    } else if (process.platform === 'win32') {
      // On Windows, use clipboardy normal approach (should be ok with file)
      await clipboardy.default.write(buf);
    } else {
      // On Linux, use xsel
      const xsel = spawn('xsel', ['--clipboard', '--input']);
      xsel.stdin.write(buf);
      xsel.stdin.end();
    }
  } catch (error) {
    // Fallback to clipboardy's normal approach
    await clipboardy.default.write(buf);
  }
}