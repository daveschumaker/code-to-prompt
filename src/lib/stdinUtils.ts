
/**
 * Reads paths from standard input.
 */
export async function readPathsFromStdin(
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
