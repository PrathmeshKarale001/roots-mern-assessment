export const UTF8_BOM = '\uFEFF';

const FORMULA_TRIGGER_REGEX = /^[=+\-@\t\r]/;

/**
 * Escapes a single CSV cell per RFC-4180 and neutralizes spreadsheet formula injection
 * when sanitizeFormula is true.
 */
export function serializeCsvCell(value, { sanitizeFormula = false } = {}) {
  if (value === null || value === undefined) {
    return '';
  }

  let str = String(value);
  if (sanitizeFormula && FORMULA_TRIGGER_REGEX.test(str)) {
    str = `'${str}`;
  }

  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

/**
 * Formats an array of { value, sanitizeFormula? } or primitive cells into an RFC-4180 CRLF row.
 */
export function serializeCsvRow(cells = []) {
  const encoded = cells.map((cell) => {
    if (cell && typeof cell === 'object' && 'value' in cell) {
      return serializeCsvCell(cell.value, { sanitizeFormula: Boolean(cell.sanitize) });
    }
    return serializeCsvCell(cell, { sanitizeFormula: false });
  });
  return `${encoded.join(',')}\r\n`;
}
