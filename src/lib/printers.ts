import path from 'path';
import { EXT_TO_LANG } from './processor';

export let globalIndex = 1;
export type Writer = (text: string) => void;

/**
 * Adds line numbers to content block.
 */
function addLineNumbers(content: string): string {
  const lines = content.split('\n');
  const padding = String(lines.length).length;
  const numberedLines = lines.map((line, index) => {
    return `${String(index + 1).padStart(padding)}  ${line}`;
  });
  return numberedLines.join('\n');
}

/**
 * Prints file content in the default format.
 */
function printDefault(
  writer: Writer,
  filePath: string,
  content: string,
  lineNumbers: boolean
): void {
  writer(filePath);
  writer('---');
  if (lineNumbers) {
    content = addLineNumbers(content);
  }
  writer(content);
  writer('');
  writer('---');
}

/**
 * Prints file content in XML-ish format for Claude.
 */
function printAsXml(
  writer: Writer,
  filePath: string,
  content: string,
  lineNumbers: boolean
): void {
  writer(`<document index="${globalIndex}">`);
  writer(`<source>${filePath}</source>`);
  writer('<document_content>');
  if (lineNumbers) {
    content = addLineNumbers(content);
  }
  content = content
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  writer(content);
  writer('</document_content>');
  writer('</document>');
  globalIndex++;
}

/**
 * Prints file content as Markdown fenced code block.
 */
function printAsMarkdown(
  writer: Writer,
  filePath: string,
  content: string,
  lineNumbers: boolean
): void {
  const extension = path.extname(filePath).substring(1);
  const lang = EXT_TO_LANG[extension] || '';
  let backticks = '```';
  while (content.includes(backticks)) {
    backticks += '`';
  }
  writer(filePath);
  writer(`${backticks}${lang}`);
  if (lineNumbers) {
    content = addLineNumbers(content);
  }
  writer(content);
  writer(backticks);
  writer('');
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
  lineNumbers: boolean
): void {
  if (claudeXml) {
    printAsXml(writer, filePath, content, lineNumbers);
  } else if (markdown) {
    printAsMarkdown(writer, filePath, content, lineNumbers);
  } else {
    printDefault(writer, filePath, content, lineNumbers);
  }
}

export { addLineNumbers, printDefault, printAsXml, printAsMarkdown, printPath };
