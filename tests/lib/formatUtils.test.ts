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
    // 1 MB - 1 byte = 1048575 bytes
    // 1048575 / 1024 = 1023.999... KB -> rounds to 1024.00 KB
    expect(formatBytes(1024 * 1024 - 1)).toBe('1024.00 KB');
  });

  test('should format exactly 1 MB', () => {
    expect(formatBytes(1024 * 1024)).toBe('1.00 MB');
  });

  test('should format fractional MB', () => {
    expect(formatBytes(1.5 * 1024 * 1024)).toBe('1.50 MB');
  });

  test('should format large MB value just below 1 GB', () => {
    // 1 GB - 1 byte = 1073741823 bytes
    // 1073741823 / (1024*1024) = 1023.999... MB -> rounds to 1024.00 MB
    expect(formatBytes(1024 * 1024 * 1024 - 1)).toBe('1024.00 MB');
  });

  test('should format exactly 1 GB', () => {
    expect(formatBytes(1024 * 1024 * 1024)).toBe('1.00 GB');
  });

  test('should format fractional GB', () => {
    expect(formatBytes(2.75 * 1024 * 1024 * 1024)).toBe('2.75 GB');
  });

   test('should format large GB value just below 1 TB', () => {
    expect(formatBytes(1024 * 1024 * 1024 * 1024 - 1)).toBe('1024.00 GB');
  });

  test('should format exactly 1 TB', () => {
    expect(formatBytes(1024 * 1024 * 1024 * 1024)).toBe('1.00 TB');
  });

  test('should format fractional TB', () => {
    expect(formatBytes(3.1 * 1024 * 1024 * 1024 * 1024)).toBe('3.10 TB');
  });

   test('should format large TB value just below 1 PB', () => {
    expect(formatBytes(1024 * 1024 * 1024 * 1024 * 1024 - 1)).toBe('1024.00 TB');
  });

  test('should format exactly 1 PB', () => {
    const pb = 1024 * 1024 * 1024 * 1024 * 1024;
    expect(formatBytes(pb)).toBe('1.00 PB');
  });

   test('should format fractional PB', () => {
    const pb = 1024 * 1024 * 1024 * 1024 * 1024;
    expect(formatBytes(1.2 * pb)).toBe('1.20 PB');
  });

  // Test the upper limit of PB (or next unit if defined)
   test('should format large PB value', () => {
    const pb = 1024 * 1024 * 1024 * 1024 * 1024;
    expect(formatBytes(1023 * pb)).toBe('1023.00 PB');
    // Test value exceeding 1024 PB (should still show as PB)
    expect(formatBytes(1025 * pb)).toBe('1025.00 PB');
  });

  // Test edge case around decimals parameter (defaults to 2)
  test('should format with default decimals (2)', () => {
     expect(formatBytes(1024 * 1.2345)).toBe('1.23 KB');
     expect(formatBytes(1024 * 1024 * 2.3456)).toBe('2.35 MB'); // Check rounding
  });

  test('should format with specified decimals (0)', () => {
     expect(formatBytes(1024 * 1.2345, 0)).toBe('1 KB');
     expect(formatBytes(1024 * 1.9, 0)).toBe('2 KB'); // Check rounding
     expect(formatBytes(500, 0)).toBe('500 B');
     expect(formatBytes(1024 * 1024 * 3.7, 0)).toBe('4 MB');
  });

   test('should format with specified decimals (3)', () => {
     expect(formatBytes(1024 * 1.2345, 3)).toBe('1.235 KB'); // Check rounding
     expect(formatBytes(1500, 3)).toBe('1.465 KB');
     expect(formatBytes(1024 * 1024 * 4.5678, 3)).toBe('4.568 MB');
   });

  // Handle non-numeric or invalid inputs
  test('should handle negative input correctly', () => {
      // The function should preserve the sign but format the absolute value
      expect(formatBytes(-512)).toBe('-512 B'); // Expect sign, no decimals for B
      expect(formatBytes(-1500)).toBe('-1.46 KB'); // Expect sign and decimals
      expect(formatBytes(-1.5 * 1024 * 1024)).toBe('-1.50 MB'); // Expect sign and decimals
  });

  test('should handle non-integer byte input', () => {
      // Bytes are typically integers, but test robustness
      expect(formatBytes(1024.5)).toBe('1.00 KB'); // 1024.5 / 1024 = 1.0004... -> 1.00
      expect(formatBytes(1500.7)).toBe('1.47 KB'); // 1500.7 / 1024 = 1.4655... -> 1.47
      // For bytes, we now round to nearest integer
      expect(formatBytes(512.3)).toBe('512 B'); // Rounds to 512
      expect(formatBytes(512.8)).toBe('513 B'); // Rounds to 513
  });

  // Test with NaN - function should return '0 B'
  test('should handle NaN input', () => {
      expect(formatBytes(NaN)).toBe('0 B'); // Updated function handles NaN
  });

  // Test with Infinity - function should return 'Infinity B'
  test('should handle Infinity input', () => {
      expect(formatBytes(Infinity)).toBe('Infinity B'); // Updated function handles Infinity
      expect(formatBytes(-Infinity)).toBe('-Infinity B'); // Handles negative infinity sign
  });

});
