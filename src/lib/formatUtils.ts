const units = ['B', 'KB', 'MB', 'GB', 'TB'];

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
  if (isNaN(bytes)) return '0 B';
  if (!isFinite(bytes)) return `${bytes < 0 ? '-' : ''}Infinity B`;

  const sign = bytes < 0 ? '-' : '';
  const absoluteBytes = Math.abs(bytes);

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;

  let i = 0;
  if (absoluteBytes > 0) {
    // Determine initial unit index
    i = Math.floor(Math.log(absoluteBytes) / Math.log(k));
  }
  i = Math.min(i, units.length - 1);

  // Calculate the value in the initial unit
  const valueInCurrentUnit = absoluteBytes / Math.pow(k, i);

  let finalValue = valueInCurrentUnit;
  let unitIndex = i;

  // Only check for unit change if not already at the highest unit
  if (unitIndex < units.length - 1) {
    const roundedValueCurrentUnit = roundHalfUp(valueInCurrentUnit, dm);

    // *** TOLERANCE FIX LOGIC ***
    const tolerance = 1e-9; // A small tolerance for floating point comparison
    // If the rounded value is close enough to k (within tolerance)
    if (Math.abs(roundedValueCurrentUnit - k) < tolerance) {
      finalValue = k; // Set the value to display as exactly k
      // DO NOT increment unitIndex, stay in the current unit
    }
    // If the rounded value is definitely GREATER than k
    else if (roundedValueCurrentUnit > k) {
      unitIndex++; // Move to the next unit
      finalValue = absoluteBytes / Math.pow(k, unitIndex); // Calculate value in the new unit
    }
    // If the rounded value is LESS than k, do nothing.
    // *** END TOLERANCE FIX LOGIC ***
  }

  // Format the finalValue based on the determined unitIndex
  const valueString =
    unitIndex === 0
      ? String(roundHalfUp(finalValue, 0)) // Bytes are rounded to 0 decimals
      : roundHalfUp(finalValue, dm).toFixed(dm); // Others use specified decimals

  return `${sign}${valueString} ${units[unitIndex]}`;
}
