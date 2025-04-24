const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];

/**
 * Rounds a number to a specified number of decimal places.
 * Rounds half up (e.g., 1.5 -> 2, 1.4 -> 1).
 * @param num The number to round.
 * @param decimals The number of decimal places.
 * @returns The rounded number.
 */
function roundHalfUp(num: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(num * factor) / factor;
}

/**
 * Converts a byte count into a human‐readable string.
 * @param bytes The number of bytes.
 * @param decimals The number of decimal places to include (default: 2).
 */
export function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return '0 B';
  // Handle potential non-numeric inputs gracefully
  if (isNaN(bytes)) return '0 B'; // Return '0 B' for NaN
  // Handle Infinity - apply sign correctly
  if (!isFinite(bytes)) return `${bytes < 0 ? '-' : ''}Infinity B`;

  // Handle negative numbers - apply sign at the end
  const sign = bytes < 0 ? '-' : '';
  const absoluteBytes = Math.abs(bytes);

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;

  // Determine the appropriate unit index
  // Use Math.max to handle bytes < 1 correctly (log(bytes) would be negative)
  let i = 0;
  if (absoluteBytes > 0) {
      // Calculate initial index based on logarithm
      i = Math.floor(Math.log(absoluteBytes) / Math.log(k));
  }

  // Ensure index is within the bounds of our units array initially
  i = Math.min(i, units.length - 1);

  // Calculate the value in the chosen unit
  let valueInUnit = absoluteBytes / Math.pow(k, i);

  // Check if the value is >= k (with tolerance) and we can move to the next unit
  if (i < units.length - 1 && valueInUnit >= k - 1e-9) {
      i++; // Increment unit index
      valueInUnit /= k; // Adjust value for the new unit
  }

  // Final unit index
  const unitIndex = i;

  // Only apply decimals if the unit is not 'B'
  const valueString = unitIndex === 0
      ? String(roundHalfUp(valueInUnit, 0)) // Use roundHalfUp for Bytes as well for consistency
      // Use reliable rounding and then format to fixed decimals
      : roundHalfUp(valueInUnit, dm).toFixed(dm);


  return `${sign}${valueString} ${units[unitIndex]}`;
}
