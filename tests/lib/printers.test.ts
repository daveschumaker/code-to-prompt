// tests/lib/printers.test.ts
import { addLineNumbers } from '../../src/lib/printers'; // Adjust path as needed

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

    // Add more tests for edge cases if needed
  });

  // Add describe blocks for other functions in printers.ts (printDefault, etc.)
  // You might need to mock the 'writer' function for those tests.
});
