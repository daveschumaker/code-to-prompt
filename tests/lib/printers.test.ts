// tests/lib/printers.test.ts
import {
  addLineNumbers,
  printDefault,
  printAsXml,
  printAsMarkdown,
  printPath,
  resetGlobalIndex
} from '../../src/lib/printers';

describe('Printers Module', () => {
  describe('addLineNumbers', () => {
    it('should add line numbers correctly to multi-line content', () => {
      const content = 'First line\nSecond line\nThird line';
      const expected = '1  First line\n2  Second line\n3  Third line';
      expect(addLineNumbers(content)).toBe(expected);
    });

    it('should handle single-line content', () => {
      const content = 'Only one line';
      const expected = '1  Only one line';
      expect(addLineNumbers(content)).toBe(expected);
    });

    it('should handle empty content', () => {
      const content = '';
      const expected = '1  '; // Split adds an empty string, gets numbered
      expect(addLineNumbers(content)).toBe(expected);
    });

    it('should handle content with trailing newline', () => {
      // Split behavior means trailing newline results in an extra empty string
      const content = 'Line one\n';
      const expected = '1  Line one\n2  ';
      expect(addLineNumbers(content)).toBe(expected);
    });

    // Tests for other printer functions
    describe('printDefault', () => {
      it('prints default with no line numbers', () => {
        const output: string[] = [];
        const writer = (text: string) => output.push(text);
        printDefault(writer, 'file.ts', 'content', false);
        expect(output).toEqual(['File: file.ts', '---', 'content', '---', '']);
      });

      it('prints default with line numbers', () => {
        const output: string[] = [];
        const writer = (text: string) => output.push(text);
        printDefault(writer, 'file.ts', 'line1\nline2', true);
        expect(output).toEqual(['File: file.ts', '---', '1  line1\n2  line2', '---', '']);
      });
    });

    describe('printAsXml', () => {
      beforeEach(() => { resetGlobalIndex(); });
      it('escapes xml chars and increments index', () => {
        const output: string[] = [];
        const writer = (text: string) => output.push(text);
        printAsXml(writer, 'file.ts', '<&>', false);
        expect(output).toContain('<document index="1">');
        expect(output).toContain('&lt;&amp;&gt;');
      });
    });

    describe('printAsMarkdown', () => {
      it('prints fenced code blocks with language', () => {
        const output: string[] = [];
        const writer = (text: string) => output.push(text);
        printAsMarkdown(writer, 'file.ts', 'code()', false);
        expect(output).toEqual(['file.ts', '```ts', 'code()', '```', '']);
      });
    });

    describe('printPath', () => {
      it('dispatches to default printer', () => {
        const output: string[] = [];
        const writer = (text: string) => output.push(text);
        printPath(writer, 'file.ts', 'x', false, false, false);
        expect(output[0]).toBe('File: file.ts');
      });
    });
  });

  // Add describe blocks for other functions in printers.ts (printDefault, etc.)
  // You might need to mock the 'writer' function for those tests.
});
