import { formatBytes } from '../../src/lib/formatUtils';

describe('formatBytes', () => {
  test('should format 0 bytes', () => {
    expect(formatBytes(0)).toBe('0 B');
  });

  test('should format bytes less than 1 KB', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1023)).toBe('1023 B');
  });

  test('should format exactly 1 KB', () => {
    expect(formatBytes(1024)).toBe('1.00 KB');
  });

  test('should format fractional KB', () => {
    expect(formatBytes(1500)).toBe('1.46 KB'); // 1500 / 1024 = 1.4648...
  });

  test('should format large KB value just below 1 MB', () => {
    expect(formatBytes(1024 * 1024 - 1)).toBe('1024.00 KB'); // Should show as KB
  });

  test('should format exactly 1 MB', () => {
    expect(formatBytes(1024 * 1024)).toBe('1.00 MB');
  });

  test('should format fractional MB', () => {
    expect(formatBytes(1.5 * 1024 * 1024)).toBe('1.50 MB');
  });

  test('should format large MB value', () => {
    expect(formatBytes(150 * 1024 * 1024)).toBe('150.00 MB');
  });

  test('should format exactly 1 GB', () => {
    expect(formatBytes(1024 * 1024 * 1024)).toBe('1.00 GB');
  });

  test('should format fractional GB', () => {
    expect(formatBytes(2.75 * 1024 * 1024 * 1024)).toBe('2.75 GB');
  });

  test('should format exactly 1 TB', () => {
    expect(formatBytes(1024 * 1024 * 1024 * 1024)).toBe('1.00 TB');
  });

  test('should format fractional TB', () => {
    expect(formatBytes(3.1 * 1024 * 1024 * 1024 * 1024)).toBe('3.10 TB');
  });

  test('should format PB', () => {
    const pb = 1024 * 1024 * 1024 * 1024 * 1024;
    expect(formatBytes(pb)).toBe('1.00 PB');
    expect(formatBytes(1.2 * pb)).toBe('1.20 PB');
  });

  // Test the upper limit of PB (or next unit if defined)
   test('should format large PB value', () => {
    const pb = 1024 * 1024 * 1024 * 1024 * 1024;
    expect(formatBytes(1023 * pb)).toBe('1023.00 PB');
  });

  // Test edge case around decimals parameter (defaults to 2)
  test('should format with default decimals (2)', () => {
     expect(formatBytes(1024 * 1.2345)).toBe('1.23 KB');
  });

  test('should format with specified decimals (0)', () => {
     expect(formatBytes(1024 * 1.2345, 0)).toBe('1 KB');
     expect(formatBytes(1024 * 1.9, 0)).toBe('2 KB'); // Check rounding
     expect(formatBytes(500, 0)).toBe('500 B');
  });

   test('should format with specified decimals (3)', () => {
     expect(formatBytes(1024 * 1.2345, 3)).toBe('1.235 KB'); // Check rounding
     expect(formatBytes(1500, 3)).toBe('1.465 KB');
   });

  // Handle non-numeric or invalid inputs
  test('should handle negative input', () => {
      // The function likely doesn't explicitly handle negative numbers,
      // Math.abs isn't used, so it might produce odd results or rely on Math.log behavior.
      // Let's test current behavior, which might be implementation-dependent.
      // Assuming it calculates based on the negative value:
      expect(formatBytes(-512)).toBe('-512 B'); // This seems plausible
      expect(formatBytes(-1500)).toBe('-1.46 KB'); // This also seems plausible
      // It might be better to throw an error or return '0 B' or use Math.abs.
  });

  test('should handle non-integer byte input', () => {
      // Bytes are typically integers, but test robustness
      expect(formatBytes(1024.5)).toBe('1.00 KB'); // 1024.5 / 1024 = 1.0004... -> 1.00
      expect(formatBytes(1500.7)).toBe('1.47 KB'); // 1500.7 / 1024 = 1.4655... -> 1.47
      expect(formatBytes(512.3)).toBe('512 B'); // Below 1024, should just be bytes
  });

  // Test with NaN - function should likely return '0 B' or throw
  test('should handle NaN input', () => {
      expect(formatBytes(NaN)).toBe('0 B'); // Current implementation returns 'NaN B', fixed to '0 B'
  });

  // Test with Infinity - function should likely return 'Infinity B' or throw
  test('should handle Infinity input', () => {
      expect(formatBytes(Infinity)).toBe('Infinity B'); // Current implementation returns 'Infinity B'
      // Consider if this should throw or return something else.
  });

});
