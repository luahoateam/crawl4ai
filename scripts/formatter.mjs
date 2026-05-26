/**
 * Vietnam Stock Data Hub - Formatter Module
 * Goal: Clean and format financial structure extractions before D1 sync.
 */

/**
 * Clean string by trimming whitespace and compressing multiple spaces/newlines.
 * @param {string} str Input string to clean
 * @returns {string|null} Cleaned string or null if empty
 */
export function cleanString(str) {
  if (str === null || str === undefined) return null;
  const cleaned = str
    .toString()
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned === '' ? null : cleaned;
}

/**
 * Format extraction data from snake_case raw JSON to camelCase clean format.
 * @param {object} data Raw extraction data
 * @returns {object} Cleaned camelCase object
 */
export function formatExtraction(data) {
  if (!data) {
    return {
      revenueStruct: null,
      profitStruct: null
    };
  }

  return {
    revenueStruct: cleanString(data.revenue_struct),
    profitStruct: cleanString(data.profit_struct)
  };
}
